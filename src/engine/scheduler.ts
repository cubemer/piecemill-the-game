import type { GameState, DayPlan, PlanValidationError } from './types'

export function validatePlan(
  state: GameState,
  plan: DayPlan,
): PlanValidationError[] {
  const errors: PlanValidationError[] = []
  const artistUses = new Map<string, string[]>()
  const machineUses = new Map<string, string[]>()

  for (const a of plan.assignments) {
    // validate order exists and is assignable
    const order = state.orders.find((o) => o.id === a.orderId)
    if (!order) {
      errors.push({
        type: 'invalid_order',
        message: `Order ${a.orderId} not found`,
        ids: [a.orderId],
      })
      continue
    }
    if (order.stage === 'shipped' || order.stage === 'late') {
      errors.push({
        type: 'unassignable_order',
        message: `Order ${a.orderId} is already ${order.stage}`,
        ids: [a.orderId],
      })
    }

    // validate artist
    if (a.artistId) {
      const artist = state.artists.find((ar) => ar.id === a.artistId)
      if (!artist) {
        errors.push({
          type: 'invalid_artist',
          message: `Artist ${a.artistId} not found`,
          ids: [a.artistId],
        })
      } else if (artist.status === 'sick' || artist.status === 'quit') {
        errors.push({
          type: 'unavailable_artist',
          message: `Artist ${a.artistId} is ${artist.status}`,
          ids: [a.artistId],
        })
      }

      const uses = artistUses.get(a.artistId) ?? []
      uses.push(a.orderId)
      artistUses.set(a.artistId, uses)
    }

    // validate machine
    if (a.machineId) {
      const machine = state.machines.find((m) => m.id === a.machineId)
      if (!machine) {
        errors.push({
          type: 'invalid_machine',
          message: `Machine ${a.machineId} not found`,
          ids: [a.machineId],
        })
      } else if (
        machine.status === 'broken' ||
        machine.status === 'maintenance'
      ) {
        errors.push({
          type: 'unavailable_machine',
          message: `Machine ${a.machineId} is ${machine.status}`,
          ids: [a.machineId],
        })
      }

      const uses = machineUses.get(a.machineId) ?? []
      uses.push(a.orderId)
      machineUses.set(a.machineId, uses)
    }
  }

  // check double-booking
  for (const [artistId, orders] of artistUses) {
    if (orders.length > 1) {
      errors.push({
        type: 'double_booking_artist',
        message: `Artist ${artistId} assigned to multiple orders`,
        ids: [artistId, ...orders],
      })
    }
  }

  for (const [machineId, orders] of machineUses) {
    if (orders.length > 1) {
      errors.push({
        type: 'double_booking_machine',
        message: `Machine ${machineId} assigned to multiple orders`,
        ids: [machineId, ...orders],
      })
    }
  }

  // check maintenance conflicts
  for (const machineId of plan.maintenance) {
    if (machineUses.has(machineId)) {
      errors.push({
        type: 'maintenance_conflict',
        message: `Machine ${machineId} is in maintenance and assigned to orders`,
        ids: [machineId],
      })
    }
  }

  return errors
}
