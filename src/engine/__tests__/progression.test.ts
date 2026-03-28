import { describe, it, expect } from 'vitest'
import { generateNewOrders } from '../progression'
import { createRNG } from '../rng'
import type { GameState } from '../types'

function makeState(): GameState {
  return {
    seed: 1,
    day: 2,
    phase: 'planning',
    money: 10000,
    reputation: 50,
    machines: [],
    artists: [],
    orders: [],
    completedOrders: 0,
    lateOrders: 0,
    totalRevenue: 0,
    dayResults: [],
  }
}

describe('generateNewOrders', () => {
  it('generates 1-2 orders', () => {
    for (let seed = 0; seed < 50; seed++) {
      const orders = generateNewOrders(makeState(), createRNG(seed))
      expect(orders.length).toBeGreaterThanOrEqual(1)
      expect(orders.length).toBeLessThanOrEqual(2)
    }
  })

  it('is deterministic with the same seed', () => {
    const state = makeState()
    const a = generateNewOrders(state, createRNG(42))
    const b = generateNewOrders(state, createRNG(42))
    expect(a).toEqual(b)
  })

  it('generates valid orders', () => {
    const orders = generateNewOrders(makeState(), createRNG(123))
    for (const order of orders) {
      expect(order.id).toBeTruthy()
      expect(order.customerName).toBeTruthy()
      expect(order.pieceCount).toBeGreaterThanOrEqual(100)
      expect(order.pieceCount).toBeLessThanOrEqual(1000)
      expect(order.pieceCount % 50).toBe(0)
      expect(['landscape', 'portrait', 'abstract']).toContain(order.imageType)
      expect(['normal', 'rush', 'vip']).toContain(order.priority)
      expect(order.deadline).toBeGreaterThan(makeState().day)
      expect(order.payment).toBeGreaterThan(0)
      expect(order.stage).toBe('intake')
      expect(order.quality).toBe(0)
    }
  })
})
