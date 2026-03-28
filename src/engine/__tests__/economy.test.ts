import { describe, it, expect } from 'vitest'
import { calculateRevenue, calculateDayFinancials } from '../economy'
import { BALANCE } from '../balance'
import type { Order, GameState, DayPlan, Shipment } from '../types'

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'test-order',
    customerName: 'Test Co.',
    pieceCount: 500,
    imageType: 'landscape',
    deadline: 5,
    priority: 'normal',
    payment: 0,
    stage: 'cutting',
    quality: 50,
    ...overrides,
  }
}

describe('calculateRevenue', () => {
  it('calculates normal order revenue', () => {
    const order = makeOrder({ pieceCount: 500, priority: 'normal' })
    expect(calculateRevenue(order)).toBe(500 * BALANCE.basePiecePrice)
  })

  it('applies rush multiplier', () => {
    const order = makeOrder({ pieceCount: 500, priority: 'rush' })
    expect(calculateRevenue(order)).toBe(
      500 * BALANCE.basePiecePrice * BALANCE.rushMultiplier,
    )
  })

  it('applies vip multiplier', () => {
    const order = makeOrder({ pieceCount: 500, priority: 'vip' })
    expect(calculateRevenue(order)).toBe(
      500 * BALANCE.basePiecePrice * BALANCE.vipMultiplier,
    )
  })
})

describe('calculateDayFinancials', () => {
  it('computes all cost components', () => {
    const state: GameState = {
      seed: 1,
      day: 1,
      phase: 'simulation',
      money: 10000,
      reputation: 50,
      machines: [],
      artists: [],
      orders: [makeOrder({ id: 'o1', pieceCount: 200 })],
      completedOrders: 0,
      lateOrders: 0,
      totalRevenue: 0,
      dayResults: [],
    }

    const plan: DayPlan = {
      assignments: [{ orderId: 'o1', artistId: 'a1', machineId: 'm1' }],
      maintenance: [],
      overtime: false,
      skipQA: [],
    }

    const shipments: Shipment[] = [
      {
        orderId: 'o1',
        onTime: true,
        qualityScore: 80,
        revenue: 400,
        customerSatisfaction: 80,
      },
    ]

    const result = calculateDayFinancials(state, plan, shipments)

    expect(result.revenue).toBe(400)
    expect(result.materialCost).toBe(200 * BALANCE.materialCostPerPiece)
    expect(result.laborCost).toBe(BALANCE.dailyLaborCost) // 1 artist
    expect(result.overtimeCost).toBe(0)
    expect(result.maintenanceCost).toBe(0)
    expect(result.netIncome).toBe(
      400 - 200 * BALANCE.materialCostPerPiece - BALANCE.dailyLaborCost,
    )
  })

  it('applies overtime cost', () => {
    const state: GameState = {
      seed: 1,
      day: 1,
      phase: 'simulation',
      money: 10000,
      reputation: 50,
      machines: [],
      artists: [],
      orders: [makeOrder({ id: 'o1' })],
      completedOrders: 0,
      lateOrders: 0,
      totalRevenue: 0,
      dayResults: [],
    }

    const plan: DayPlan = {
      assignments: [{ orderId: 'o1', artistId: 'a1' }],
      maintenance: [],
      overtime: true,
      skipQA: [],
    }

    const result = calculateDayFinancials(state, plan, [])
    expect(result.overtimeCost).toBe(
      BALANCE.dailyLaborCost * (BALANCE.overtimeMultiplier - 1),
    )
    expect(result.laborCost).toBe(
      BALANCE.dailyLaborCost * BALANCE.overtimeMultiplier,
    )
  })

  it('includes maintenance cost', () => {
    const state: GameState = {
      seed: 1,
      day: 1,
      phase: 'simulation',
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

    const plan: DayPlan = {
      assignments: [],
      maintenance: ['m1', 'm2'],
      overtime: false,
      skipQA: [],
    }

    const result = calculateDayFinancials(state, plan, [])
    expect(result.maintenanceCost).toBe(2 * BALANCE.maintenanceCost)
  })
})
