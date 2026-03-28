import { describe, it, expect } from 'vitest'
import { drawEvents, applyEvent } from '../events'
import { createRNG } from '../rng'
import type { GameState, GameEvent } from '../types'

const testDeck: GameEvent[] = [
  {
    id: 'early',
    name: 'Early Event',
    description: 'Fires from day 1',
    weight: 50,
    minDay: 1,
    choices: [
      { label: 'A', description: 'a', effects: [{ type: 'money_change', delta: -100 }] },
      { label: 'B', description: 'b', effects: [{ type: 'reputation_change', delta: 5 }] },
    ],
  },
  {
    id: 'late',
    name: 'Late Event',
    description: 'Only fires from day 3+',
    weight: 50,
    minDay: 3,
    choices: [
      { label: 'A', description: 'a', effects: [{ type: 'morale_change', delta: -10 }] },
    ],
  },
]

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    seed: 1,
    day: 1,
    phase: 'simulation',
    money: 10000,
    reputation: 50,
    machines: [
      { id: 'm1', name: 'M1', speed: 100, precision: 0.9, reliability: 0.9, condition: 80, status: 'idle' },
    ],
    artists: [
      { id: 'a1', name: 'A1', specialty: 'landscape', speed: 1, quality: 0.8, morale: 75, status: 'available' },
    ],
    orders: [
      { id: 'o1', customerName: 'C1', pieceCount: 500, imageType: 'landscape', deadline: 3, priority: 'normal', payment: 1000, stage: 'design', quality: 50 },
    ],
    completedOrders: 0,
    lateOrders: 0,
    totalRevenue: 0,
    dayResults: [],
    ...overrides,
  }
}

describe('drawEvents', () => {
  it('is deterministic with the same seed', () => {
    const state = makeState()
    const a = drawEvents(state, createRNG(42), testDeck)
    const b = drawEvents(state, createRNG(42), testDeck)
    expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id))
  })

  it('respects minDay — late event excluded on day 1', () => {
    const state = makeState({ day: 1 })
    // run many times to ensure late event never appears
    for (let seed = 0; seed < 100; seed++) {
      const events = drawEvents(state, createRNG(seed), testDeck)
      expect(events.every((e) => e.id !== 'late')).toBe(true)
    }
  })

  it('allows late event on day 3+', () => {
    const state = makeState({ day: 3 })
    let sawLate = false
    for (let seed = 0; seed < 200; seed++) {
      const events = drawEvents(state, createRNG(seed), testDeck)
      if (events.some((e) => e.id === 'late')) sawLate = true
    }
    expect(sawLate).toBe(true)
  })

  it('returns at most 2 events', () => {
    const state = makeState({ day: 5 })
    for (let seed = 0; seed < 200; seed++) {
      const events = drawEvents(state, createRNG(seed), testDeck)
      expect(events.length).toBeLessThanOrEqual(2)
    }
  })
})

describe('applyEvent', () => {
  it('applies money_change effect', () => {
    const state = makeState({ money: 5000 })
    const event = testDeck[0]! // choice 0 = money -100
    const result = applyEvent(state, event, 0, createRNG(1))
    expect(result.money).toBe(4900)
  })

  it('applies reputation_change effect', () => {
    const state = makeState({ reputation: 50 })
    const event = testDeck[0]! // choice 1 = rep +5
    const result = applyEvent(state, event, 1, createRNG(1))
    expect(result.reputation).toBe(55)
  })

  it('clamps reputation to [0, 100]', () => {
    const state = makeState({ reputation: 98 })
    const event = testDeck[0]!
    const result = applyEvent(state, event, 1, createRNG(1))
    expect(result.reputation).toBe(100)
  })

  it('applies morale_change to all artists when no targetId', () => {
    const state = makeState({ day: 3 })
    const event = testDeck[1]! // morale -10 to all
    const result = applyEvent(state, event, 0, createRNG(1))
    expect(result.artists[0]!.morale).toBe(65) // 75 - 10
  })

  it('does not mutate input state', () => {
    const state = makeState({ money: 5000 })
    const originalMoney = state.money
    applyEvent(state, testDeck[0]!, 0, createRNG(1))
    expect(state.money).toBe(originalMoney)
  })
})
