import { describe, it, expect } from 'vitest'
import { beginDayWithDeck, finishDay } from '../simulator'
import { createRNG } from '../rng'
import { BALANCE } from '../balance'
import type { GameState, DayPlan, ResolvedEvent } from '../types'
import { EVENT_DECK } from '../../data/events'

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    seed: 42,
    day: 1,
    phase: 'planning',
    money: 10000,
    reputation: 50,
    machines: [
      { id: 'm1', name: 'Old Reliable', speed: 100, precision: 0.85, reliability: 0.95, condition: 80, status: 'idle' },
    ],
    artists: [
      { id: 'a1', name: 'Sam Rivers', specialty: 'landscape', speed: 1, quality: 0.8, morale: 75, status: 'available' },
    ],
    orders: [
      { id: 'o1', customerName: 'Test Co.', pieceCount: 500, imageType: 'landscape', deadline: 3, priority: 'normal', payment: 1000, stage: 'design', quality: 25 },
    ],
    completedOrders: 0,
    lateOrders: 0,
    totalRevenue: 0,
    dayResults: [],
    ...overrides,
  }
}

function simplePlan(): DayPlan {
  return {
    assignments: [{ orderId: 'o1', artistId: 'a1', machineId: 'm1' }],
    maintenance: [],
    overtime: false,
    skipQA: [],
  }
}

describe('simulator', () => {
  it('is deterministic — same inputs produce same outputs', () => {
    const state = makeState()
    const plan = simplePlan()

    const begin1 = beginDayWithDeck(state, plan, createRNG(42), EVENT_DECK)
    const begin2 = beginDayWithDeck(state, plan, createRNG(42), EVENT_DECK)

    // same events drawn
    expect(begin1.events.map((e) => e.id)).toEqual(begin2.events.map((e) => e.id))

    // resolve with no events for simplicity
    const result1 = finishDay(begin1.intermediateState, plan, [], begin1.eventRng)
    const result2 = finishDay(begin2.intermediateState, plan, [], begin2.eventRng)

    expect(result1.financials).toEqual(result2.financials)
    expect(result1.repDelta).toEqual(result2.repDelta)
    expect(result1.newState.orders.map((o) => o.stage)).toEqual(
      result2.newState.orders.map((o) => o.stage),
    )
  })

  it('advances order stage with proper assignment', () => {
    // order in design stage + artist assigned → should advance to cutting
    const state = makeState({
      orders: [
        { id: 'o1', customerName: 'C', pieceCount: 500, imageType: 'landscape', deadline: 5, priority: 'normal', payment: 1000, stage: 'design', quality: 0 },
      ],
    })
    const plan: DayPlan = {
      assignments: [{ orderId: 'o1', artistId: 'a1' }],
      maintenance: [],
      overtime: false,
      skipQA: [],
    }

    const begin = beginDayWithDeck(state, plan, createRNG(999), [])
    const result = finishDay(begin.intermediateState, plan, [], begin.eventRng)

    expect(result.newState.orders.find((o) => o.id === 'o1')!.stage).toBe('cutting')
  })

  it('does not advance design stage without artist', () => {
    const state = makeState({
      orders: [
        { id: 'o1', customerName: 'C', pieceCount: 500, imageType: 'landscape', deadline: 5, priority: 'normal', payment: 1000, stage: 'design', quality: 0 },
      ],
    })
    const plan: DayPlan = {
      assignments: [{ orderId: 'o1', machineId: 'm1' }], // no artist!
      maintenance: [],
      overtime: false,
      skipQA: [],
    }

    const begin = beginDayWithDeck(state, plan, createRNG(999), [])
    const result = finishDay(begin.intermediateState, plan, [], begin.eventRng)

    expect(result.newState.orders.find((o) => o.id === 'o1')!.stage).toBe('design')
  })

  it('degrades machine condition when used', () => {
    const state = makeState()
    const plan = simplePlan()

    const begin = beginDayWithDeck(state, plan, createRNG(100), [])
    const result = finishDay(begin.intermediateState, plan, [], begin.eventRng)

    const machine = result.newState.machines.find((m) => m.id === 'm1')!
    // condition should have decreased (unless machine broke, in which case it's broken)
    if (machine.status !== 'broken') {
      expect(machine.condition).toBeLessThan(80)
    }
  })

  it('restores machine condition with maintenance', () => {
    const state = makeState({
      machines: [
        { id: 'm1', name: 'M1', speed: 100, precision: 0.85, reliability: 0.9, condition: 40, status: 'idle' },
      ],
      orders: [], // no orders needed
    })
    const plan: DayPlan = {
      assignments: [],
      maintenance: ['m1'],
      overtime: false,
      skipQA: [],
    }

    const begin = beginDayWithDeck(state, plan, createRNG(1), [])
    const result = finishDay(begin.intermediateState, plan, [], begin.eventRng)

    const machine = result.newState.machines.find((m) => m.id === 'm1')!
    expect(machine.condition).toBe(40 + BALANCE.maintenanceRestoreAmount)
  })

  it('applies overtime morale penalty', () => {
    const state = makeState()
    const plan: DayPlan = {
      ...simplePlan(),
      overtime: true,
    }

    const begin = beginDayWithDeck(state, plan, createRNG(1), [])
    const result = finishDay(begin.intermediateState, plan, [], begin.eventRng)

    const artist = result.newState.artists.find((a) => a.id === 'a1')!
    // morale = 75 - 10 (overtime) + 3 (recovery) = 68
    expect(artist.morale).toBe(75 - BALANCE.moraleDecayOvertime + BALANCE.moraleRecoverPerDay)
  })

  it('triggers game over after day 5', () => {
    const state = makeState({ day: 5 })
    const plan: DayPlan = {
      assignments: [],
      maintenance: [],
      overtime: false,
      skipQA: [],
    }

    const begin = beginDayWithDeck(state, plan, createRNG(1), [])
    const result = finishDay(begin.intermediateState, plan, [], begin.eventRng)

    expect(result.newState.phase).toBe('gameover')
    expect(result.newState.day).toBe(6)
  })

  it('applies event effects when resolved', () => {
    const state = makeState({ money: 5000 })
    const plan: DayPlan = {
      assignments: [],
      maintenance: [],
      overtime: false,
      skipQA: [],
    }

    const moneyEvent: ResolvedEvent = {
      id: 'test-event',
      name: 'Test',
      description: 'test',
      weight: 1,
      minDay: 1,
      choices: [
        { label: 'Pay', description: 'pay up', effects: [{ type: 'money_change', delta: -500 }] },
      ],
      chosenOption: 0,
    }

    const begin = beginDayWithDeck(state, plan, createRNG(1), [])
    const result = finishDay(begin.intermediateState, plan, [moneyEvent], begin.eventRng)

    // money should reflect the -500 from event + any financials
    expect(result.newState.money).toBeLessThan(5000)
  })

  it('ships orders that complete finishing stage', () => {
    const state = makeState({
      orders: [
        { id: 'o1', customerName: 'C', pieceCount: 200, imageType: 'landscape', deadline: 5, priority: 'normal', payment: 400, stage: 'finishing', quality: 75 },
      ],
    })
    const plan: DayPlan = {
      assignments: [{ orderId: 'o1', artistId: 'a1', machineId: 'm1' }],
      maintenance: [],
      overtime: false,
      skipQA: [],
    }

    const begin = beginDayWithDeck(state, plan, createRNG(500), [])
    const result = finishDay(begin.intermediateState, plan, [], begin.eventRng)

    expect(result.shipments.length).toBeGreaterThanOrEqual(1)
    const shipped = result.newState.orders.find((o) => o.id === 'o1')
    expect(shipped!.stage).toBe('shipped')
  })
})
