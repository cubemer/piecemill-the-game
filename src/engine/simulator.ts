import type {
  GameState,
  DayPlan,
  DayResult,
  GameEvent,
  ResolvedEvent,
  Shipment,
  Order,
  Machine,
  Artist,
  Assignment,
} from './types'
import type { RNG } from './rng'
import { BALANCE } from './balance'
import { validatePlan } from './scheduler'
import { drawEvents, applyEvent } from './events'
import { calculateDayFinancials } from './economy'
import {
  calculateRepDelta,
  calculateCustomerSatisfaction,
  clampReputation,
} from './reputation'

export interface BeginDayResult {
  events: GameEvent[]
  intermediateState: GameState
  eventRng: RNG
}

/**
 * First half of the day: validate plan and draw events.
 * Returns events for the UI to present to the player.
 */
export function beginDay(
  state: GameState,
  plan: DayPlan,
  rng: RNG,
): BeginDayResult {
  const errors = validatePlan(state, plan)
  if (errors.length > 0) {
    throw new Error(
      `Invalid plan: ${errors.map((e) => e.message).join(', ')}`,
    )
  }

  // fork RNG into separate streams
  const eventRng = rng.fork()
  const events = drawEvents(state, eventRng, []) // deck passed from caller

  return {
    events,
    intermediateState: { ...state, phase: 'simulation' },
    eventRng,
  }
}

/**
 * Draws events from the provided deck during beginDay.
 */
export function beginDayWithDeck(
  state: GameState,
  plan: DayPlan,
  rng: RNG,
  eventDeck: GameEvent[],
): BeginDayResult {
  const errors = validatePlan(state, plan)
  if (errors.length > 0) {
    throw new Error(
      `Invalid plan: ${errors.map((e) => e.message).join(', ')}`,
    )
  }

  const eventRng = rng.fork()
  const productionRng = rng.fork()
  const events = drawEvents(state, eventRng, eventDeck)

  return {
    events,
    intermediateState: { ...state, phase: 'simulation' },
    eventRng: productionRng,
  }
}

/**
 * Second half: process production, shipments, and end-of-day updates
 * after the player has resolved all events.
 */
export function finishDay(
  state: GameState,
  plan: DayPlan,
  resolvedEvents: ResolvedEvent[],
  rng: RNG,
): DayResult {
  let current = { ...state }

  // 1. Apply resolved event effects
  for (const event of resolvedEvents) {
    const choice = event.choices[event.chosenOption]
    if (choice) {
      current = applyEvent(current, event, event.chosenOption, rng)
    }
  }

  // 2. Process assignments and advance orders
  let orders = current.orders.map((o) => ({ ...o }))
  let machines = current.machines.map((m) => ({ ...m }))
  const artists = current.artists.map((a) => ({ ...a }))

  for (const assignment of plan.assignments) {
    const orderIdx = orders.findIndex((o) => o.id === assignment.orderId)
    if (orderIdx === -1) continue
    const order = orders[orderIdx]!

    const result = processAssignment(
      order,
      assignment,
      machines,
      artists,
      plan.overtime,
      rng,
    )
    orders[orderIdx] = result.order
    machines = result.machines
  }

  // 3. Advance unassigned orders that can progress without resources
  // (intake -> design is automatic)
  orders = orders.map((o) => {
    if (o.stage === 'intake') {
      return { ...o, stage: 'design' as const }
    }
    return o
  })

  // 4. Process shipments — orders completing finishing stage
  const shipments: Shipment[] = []
  orders = orders.map((o) => {
    if (o.stage === 'shipped') {
      const onTime = current.day <= o.deadline
      const qualityScore = o.quality

      // check for undetected defects on skipped QA
      let finalQuality = qualityScore
      if (plan.skipQA.includes(o.id) && rng.nextBool(BALANCE.skipQADetectionFailure)) {
        finalQuality = Math.max(0, finalQuality - 20)
      }

      shipments.push({
        orderId: o.id,
        onTime,
        qualityScore: finalQuality,
        revenue: o.payment,
        customerSatisfaction: calculateCustomerSatisfaction(onTime, finalQuality),
      })
      return o
    }
    return o
  })

  // 5. Mark late orders
  orders = orders.map((o) => {
    if (
      o.stage !== 'shipped' &&
      o.stage !== 'late' &&
      current.day > o.deadline
    ) {
      return { ...o, stage: 'late' as const }
    }
    return o
  })

  // 6. Machine condition degradation
  machines = machines.map((m) => {
    if (plan.maintenance.includes(m.id)) {
      return {
        ...m,
        status: 'idle' as const,
        condition: Math.min(100, m.condition + BALANCE.maintenanceRestoreAmount),
      }
    }
    // machines that were used degrade
    const wasUsed = plan.assignments.some((a) => a.machineId === m.id)
    if (wasUsed && m.status !== 'broken') {
      const newCondition = Math.max(0, m.condition - BALANCE.conditionDegradePerDay)
      return { ...m, condition: newCondition, status: 'idle' as const }
    }
    return { ...m, status: m.status === 'running' ? 'idle' as const : m.status }
  })

  // 7. Morale changes
  const updatedArtists = artists.map((a) => {
    let morale = a.morale
    if (plan.overtime) morale -= BALANCE.moraleDecayOvertime
    morale += BALANCE.moraleRecoverPerDay
    return {
      ...a,
      morale: Math.max(0, Math.min(100, morale)),
      status: 'available' as const,
    }
  })

  // 8. Calculate financials
  const financials = calculateDayFinancials(current, plan, shipments)

  // 9. Reputation
  const repDelta = calculateRepDelta(shipments)
  const newReputation = clampReputation(current.reputation, repDelta)

  // 10. Count completed and late
  const newCompletedOrders =
    current.completedOrders + shipments.length
  const newLateOrders =
    current.lateOrders +
    orders.filter(
      (o) =>
        o.stage === 'late' &&
        !current.orders.find((co) => co.id === o.id && co.stage === 'late'),
    ).length

  // 11. Advance day, check game over
  const nextDay = current.day + 1
  const isGameOver = nextDay > BALANCE.mvpDayCount

  const newState: GameState = {
    ...current,
    day: nextDay,
    phase: isGameOver ? 'gameover' : 'report',
    money: current.money + financials.netIncome,
    reputation: newReputation,
    machines,
    artists: updatedArtists,
    orders,
    completedOrders: newCompletedOrders,
    lateOrders: newLateOrders,
    totalRevenue: current.totalRevenue + financials.revenue,
    dayResults: current.dayResults, // will be appended by store
  }

  const dayResult: DayResult = {
    newState,
    events: resolvedEvents,
    shipments,
    financials,
    repDelta,
  }

  // append this result to history
  newState.dayResults = [...current.dayResults, dayResult]

  return dayResult
}

/**
 * Process a single order assignment: apply quality, advance stage.
 */
function processAssignment(
  order: Order,
  assignment: Assignment,
  machines: Machine[],
  artists: Artist[],
  overtime: boolean,
  rng: RNG,
): { order: Order; machines: Machine[] } {
  let qualityGain = 25 // base per-stage quality contribution
  let updatedMachines = machines

  // artist quality contribution
  if (assignment.artistId) {
    const artist = artists.find((a) => a.id === assignment.artistId)
    if (artist) {
      qualityGain *= artist.quality

      // specialty mismatch penalty
      if (artist.specialty !== order.imageType) {
        qualityGain *= 1 - BALANCE.mismatchQualityPenalty
      }

      // low morale penalty
      if (artist.morale < BALANCE.lowMoraleThreshold) {
        qualityGain *= 0.7
      }
    }
  }

  // machine quality contribution
  if (assignment.machineId) {
    const machineIdx = machines.findIndex((m) => m.id === assignment.machineId)
    const machine = machines[machineIdx]
    if (machine && machineIdx !== -1) {
      qualityGain *= machine.precision

      // check for breakdown
      let breakdownChance = 1 - machine.reliability
      if (machine.condition < BALANCE.breakdownThreshold) {
        breakdownChance *= 2
      }

      if (rng.nextBool(breakdownChance)) {
        updatedMachines = machines.map((m, i) =>
          i === machineIdx ? { ...m, status: 'broken' as const } : m,
        )
        // breakdown — no quality contribution from machine this stage
        qualityGain *= 0.5
      } else {
        updatedMachines = machines.map((m, i) =>
          i === machineIdx ? { ...m, status: 'running' as const } : m,
        )
      }
    }
  }

  // overtime defect penalty
  if (overtime) {
    qualityGain *= 1 - BALANCE.overtimeDefectBonus
  }

  // advance stage
  const nextStage = advanceStage(order.stage, assignment)

  return {
    order: {
      ...order,
      stage: nextStage,
      quality: Math.min(100, order.quality + qualityGain),
      assignedArtist: assignment.artistId,
      assignedMachine: assignment.machineId,
    },
    machines: updatedMachines,
  }
}

type WorkStage = Exclude<Order['stage'], 'shipped' | 'late'>

function advanceStage(
  currentStage: Order['stage'],
  assignment: Assignment,
): Order['stage'] {
  const stageMap: Record<WorkStage, Order['stage']> = {
    intake: 'design',
    design: assignment.artistId ? 'cutting' : 'design',
    cutting: assignment.machineId ? 'finishing' : 'cutting',
    finishing: 'shipped',
  }

  if (currentStage === 'shipped' || currentStage === 'late') return currentStage
  return stageMap[currentStage]
}
