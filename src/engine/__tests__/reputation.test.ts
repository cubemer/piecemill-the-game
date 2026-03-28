import { describe, it, expect } from 'vitest'
import { calculateRepDelta, clampReputation } from '../reputation'
import { BALANCE } from '../balance'
import type { Shipment } from '../types'

function makeShipment(overrides: Partial<Shipment> = {}): Shipment {
  return {
    orderId: 'test',
    onTime: true,
    qualityScore: 80,
    revenue: 1000,
    customerSatisfaction: 80,
    ...overrides,
  }
}

describe('calculateRepDelta', () => {
  it('rewards on-time delivery', () => {
    const delta = calculateRepDelta([makeShipment({ onTime: true, qualityScore: 70 })])
    expect(delta).toBe(BALANCE.onTimeDeliveryRep)
  })

  it('penalizes late delivery', () => {
    const delta = calculateRepDelta([makeShipment({ onTime: false, qualityScore: 70 })])
    expect(delta).toBe(BALANCE.lateDeliveryRep)
  })

  it('penalizes defective shipments (quality < 60)', () => {
    const delta = calculateRepDelta([makeShipment({ onTime: true, qualityScore: 50 })])
    expect(delta).toBe(BALANCE.onTimeDeliveryRep + BALANCE.defectShippedRep)
  })

  it('rewards perfect orders (on-time + quality >= 90)', () => {
    const delta = calculateRepDelta([makeShipment({ onTime: true, qualityScore: 95 })])
    expect(delta).toBe(BALANCE.onTimeDeliveryRep + BALANCE.perfectOrderRep)
  })

  it('stacks late + defective penalties', () => {
    const delta = calculateRepDelta([makeShipment({ onTime: false, qualityScore: 40 })])
    expect(delta).toBe(BALANCE.lateDeliveryRep + BALANCE.defectShippedRep)
  })

  it('sums across multiple shipments', () => {
    const delta = calculateRepDelta([
      makeShipment({ onTime: true, qualityScore: 80 }),
      makeShipment({ onTime: false, qualityScore: 80 }),
    ])
    expect(delta).toBe(BALANCE.onTimeDeliveryRep + BALANCE.lateDeliveryRep)
  })
})

describe('clampReputation', () => {
  it('clamps to 0', () => {
    expect(clampReputation(5, -20)).toBe(0)
  })

  it('clamps to 100', () => {
    expect(clampReputation(95, 20)).toBe(100)
  })

  it('allows normal values', () => {
    expect(clampReputation(50, 10)).toBe(60)
  })
})
