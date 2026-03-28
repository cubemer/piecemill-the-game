import { BALANCE } from './balance'
import type { Shipment } from './types'

const DEFECT_QUALITY_THRESHOLD = 60
const PERFECT_QUALITY_THRESHOLD = 90

export function calculateCustomerSatisfaction(
  onTime: boolean,
  qualityScore: number,
): number {
  let satisfaction = qualityScore
  if (!onTime) satisfaction -= 20
  return Math.max(0, Math.min(100, satisfaction))
}

export function calculateRepDelta(shipments: Shipment[]): number {
  let delta = 0
  for (const s of shipments) {
    if (s.onTime) {
      delta += BALANCE.onTimeDeliveryRep
    } else {
      delta += BALANCE.lateDeliveryRep
    }

    if (s.qualityScore < DEFECT_QUALITY_THRESHOLD) {
      delta += BALANCE.defectShippedRep
    }

    if (s.onTime && s.qualityScore >= PERFECT_QUALITY_THRESHOLD) {
      delta += BALANCE.perfectOrderRep
    }
  }
  return delta
}

export function clampReputation(current: number, delta: number): number {
  return Math.max(0, Math.min(100, current + delta))
}
