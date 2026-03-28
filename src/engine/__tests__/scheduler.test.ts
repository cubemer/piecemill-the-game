import { describe, it, expect } from 'vitest'
import { validatePlan } from '../scheduler'
import type { GameState, DayPlan } from '../types'

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    seed: 1,
    day: 1,
    phase: 'planning',
    money: 10000,
    reputation: 50,
    machines: [
      { id: 'm1', name: 'M1', speed: 100, precision: 0.9, reliability: 0.9, condition: 80, status: 'idle' },
      { id: 'm2', name: 'M2', speed: 80, precision: 0.85, reliability: 0.85, condition: 60, status: 'idle' },
    ],
    artists: [
      { id: 'a1', name: 'A1', specialty: 'landscape', speed: 1, quality: 0.8, morale: 75, status: 'available' },
      { id: 'a2', name: 'A2', specialty: 'portrait', speed: 1, quality: 0.7, morale: 60, status: 'available' },
    ],
    orders: [
      { id: 'o1', customerName: 'C1', pieceCount: 500, imageType: 'landscape', deadline: 3, priority: 'normal', payment: 1000, stage: 'design', quality: 0 },
      { id: 'o2', customerName: 'C2', pieceCount: 300, imageType: 'portrait', deadline: 4, priority: 'rush', payment: 1200, stage: 'cutting', quality: 25 },
    ],
    completedOrders: 0,
    lateOrders: 0,
    totalRevenue: 0,
    dayResults: [],
    ...overrides,
  }
}

describe('validatePlan', () => {
  it('accepts a valid plan', () => {
    const plan: DayPlan = {
      assignments: [
        { orderId: 'o1', artistId: 'a1' },
        { orderId: 'o2', machineId: 'm1' },
      ],
      maintenance: [],
      overtime: false,
      skipQA: [],
    }
    expect(validatePlan(makeState(), plan)).toEqual([])
  })

  it('catches double-booking an artist', () => {
    const plan: DayPlan = {
      assignments: [
        { orderId: 'o1', artistId: 'a1' },
        { orderId: 'o2', artistId: 'a1' },
      ],
      maintenance: [],
      overtime: false,
      skipQA: [],
    }
    const errors = validatePlan(makeState(), plan)
    expect(errors).toHaveLength(1)
    expect(errors[0]!.type).toBe('double_booking_artist')
  })

  it('catches double-booking a machine', () => {
    const plan: DayPlan = {
      assignments: [
        { orderId: 'o1', machineId: 'm1' },
        { orderId: 'o2', machineId: 'm1' },
      ],
      maintenance: [],
      overtime: false,
      skipQA: [],
    }
    const errors = validatePlan(makeState(), plan)
    expect(errors).toHaveLength(1)
    expect(errors[0]!.type).toBe('double_booking_machine')
  })

  it('catches invalid order ID', () => {
    const plan: DayPlan = {
      assignments: [{ orderId: 'nonexistent' }],
      maintenance: [],
      overtime: false,
      skipQA: [],
    }
    const errors = validatePlan(makeState(), plan)
    expect(errors.some((e) => e.type === 'invalid_order')).toBe(true)
  })

  it('catches invalid artist ID', () => {
    const plan: DayPlan = {
      assignments: [{ orderId: 'o1', artistId: 'ghost' }],
      maintenance: [],
      overtime: false,
      skipQA: [],
    }
    const errors = validatePlan(makeState(), plan)
    expect(errors.some((e) => e.type === 'invalid_artist')).toBe(true)
  })

  it('catches unavailable (sick) artist', () => {
    const state = makeState()
    state.artists[0] = { ...state.artists[0]!, status: 'sick' }
    const plan: DayPlan = {
      assignments: [{ orderId: 'o1', artistId: 'a1' }],
      maintenance: [],
      overtime: false,
      skipQA: [],
    }
    const errors = validatePlan(state, plan)
    expect(errors.some((e) => e.type === 'unavailable_artist')).toBe(true)
  })

  it('catches maintenance conflict', () => {
    const plan: DayPlan = {
      assignments: [{ orderId: 'o1', machineId: 'm1' }],
      maintenance: ['m1'],
      overtime: false,
      skipQA: [],
    }
    const errors = validatePlan(makeState(), plan)
    expect(errors.some((e) => e.type === 'maintenance_conflict')).toBe(true)
  })

  it('catches assigning shipped orders', () => {
    const state = makeState()
    state.orders[0] = { ...state.orders[0]!, stage: 'shipped' }
    const plan: DayPlan = {
      assignments: [{ orderId: 'o1', artistId: 'a1' }],
      maintenance: [],
      overtime: false,
      skipQA: [],
    }
    const errors = validatePlan(state, plan)
    expect(errors.some((e) => e.type === 'unassignable_order')).toBe(true)
  })
})
