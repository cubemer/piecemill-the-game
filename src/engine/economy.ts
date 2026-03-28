import { BALANCE } from './balance'
import type { DayPlan, GameState, Order, Shipment, DayFinancials } from './types'

export function calculateRevenue(order: Order): number {
  let price = order.pieceCount * BALANCE.basePiecePrice
  if (order.priority === 'rush') price *= BALANCE.rushMultiplier
  if (order.priority === 'vip') price *= BALANCE.vipMultiplier
  return price
}

export function calculateDayFinancials(
  state: GameState,
  plan: DayPlan,
  shipments: Shipment[],
): DayFinancials {
  const revenue = shipments.reduce((sum, s) => sum + s.revenue, 0)

  // material cost: all orders being worked on today
  const activeOrders = plan.assignments
    .map((a) => state.orders.find((o) => o.id === a.orderId))
    .filter((o): o is Order => o != null)
  const materialCost = activeOrders.reduce(
    (sum, o) => sum + o.pieceCount * BALANCE.materialCostPerPiece,
    0,
  )

  // labor cost: all artists working today
  const workingArtistCount = new Set(
    plan.assignments.map((a) => a.artistId).filter(Boolean),
  ).size
  const baseLaborCost = workingArtistCount * BALANCE.dailyLaborCost
  const overtimeCost = plan.overtime
    ? baseLaborCost * (BALANCE.overtimeMultiplier - 1)
    : 0
  const laborCost = baseLaborCost + overtimeCost

  // maintenance cost
  const maintenanceCost = plan.maintenance.length * BALANCE.maintenanceCost

  const netIncome = revenue - materialCost - laborCost - maintenanceCost

  return {
    revenue,
    materialCost,
    laborCost,
    maintenanceCost,
    overtimeCost,
    netIncome,
  }
}
