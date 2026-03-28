import type { GameState, GameEvent, Effect, ResolvedEvent } from './types'
import type { RNG } from './rng'

/**
 * Draw 0-2 events from the deck using weighted random selection.
 * ~40% chance of zero events, ~45% one, ~15% two.
 */
export function drawEvents(
  state: GameState,
  rng: RNG,
  eventDeck: GameEvent[],
): GameEvent[] {
  const eligible = eventDeck.filter((e) => e.minDay <= state.day)
  if (eligible.length === 0) return []

  // determine how many events fire
  const roll = rng.next()
  let count: number
  if (roll < 0.4) count = 0
  else if (roll < 0.85) count = 1
  else count = 2

  const drawn: GameEvent[] = []
  const remaining = [...eligible]

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((sum, e) => sum + e.weight, 0)
    let pick = rng.next() * totalWeight

    for (let j = 0; j < remaining.length; j++) {
      pick -= remaining[j]!.weight
      if (pick <= 0) {
        drawn.push(remaining[j]!)
        remaining.splice(j, 1)
        break
      }
    }
  }

  return drawn
}

/**
 * Apply a resolved event's chosen effects to the game state.
 * Returns a new state — never mutates the input.
 */
export function applyEvent(
  state: GameState,
  event: GameEvent,
  choiceIndex: number,
  rng: RNG,
): GameState {
  const choice = event.choices[choiceIndex]
  if (!choice) return state

  let result = { ...state }

  for (const effect of choice.effects) {
    result = applyEffect(result, effect, rng)
  }

  return result
}

function applyEffect(state: GameState, effect: Effect, rng: RNG): GameState {
  switch (effect.type) {
    case 'machine_break': {
      const targetId =
        effect.machineId ??
        pickRandom(
          state.machines.filter((m) => m.status === 'running' || m.status === 'idle'),
          rng,
        )?.id
      if (!targetId) return state
      return {
        ...state,
        machines: state.machines.map((m) =>
          m.id === targetId ? { ...m, status: 'broken' as const } : m,
        ),
      }
    }

    case 'morale_change': {
      if (effect.targetId) {
        return {
          ...state,
          artists: state.artists.map((a) =>
            a.id === effect.targetId
              ? { ...a, morale: clamp(a.morale + effect.delta, 0, 100) }
              : a,
          ),
        }
      }
      // apply to all artists
      return {
        ...state,
        artists: state.artists.map((a) => ({
          ...a,
          morale: clamp(a.morale + effect.delta, 0, 100),
        })),
      }
    }

    case 'money_change':
      return { ...state, money: state.money + effect.delta }

    case 'reputation_change':
      return {
        ...state,
        reputation: clamp(state.reputation + effect.delta, 0, 100),
      }

    case 'delay_order': {
      const targetId =
        effect.orderId ??
        pickRandom(
          state.orders.filter(
            (o) => o.stage !== 'shipped' && o.stage !== 'late',
          ),
          rng,
        )?.id
      if (!targetId) return state
      return {
        ...state,
        orders: state.orders.map((o) =>
          o.id === targetId
            ? { ...o, deadline: o.deadline + effect.days }
            : o,
        ),
      }
    }

    case 'quality_modifier':
      return {
        ...state,
        orders: state.orders.map((o) =>
          o.stage !== 'shipped' && o.stage !== 'late'
            ? { ...o, quality: clamp(o.quality + effect.delta, 0, 100) }
            : o,
        ),
      }
  }
}

function pickRandom<T>(items: T[], rng: RNG): T | undefined {
  if (items.length === 0) return undefined
  return items[rng.nextInt(0, items.length - 1)]
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function resolveEvent(
  event: GameEvent,
  choiceIndex: number,
): ResolvedEvent {
  return { ...event, chosenOption: choiceIndex }
}
