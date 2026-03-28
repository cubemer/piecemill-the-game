import type { GameState, Order, ImageType } from './types'
import type { RNG } from './rng'
import { calculateRevenue } from './economy'

const CUSTOMER_NAMES = [
  'Puzzlemania Inc.',
  'The Jigsaw Joint',
  'Piece of Mind Co.',
  'Fragment & Sons',
  'Tessellation Labs',
  'Corner Piece Cafe',
  'Interlock Studios',
  'Missing Piece LLC',
  'Edge Case Puzzles',
  'Fit Together Co.',
]

const IMAGE_TYPES: ImageType[] = ['landscape', 'portrait', 'abstract']

export function generateNewOrders(state: GameState, rng: RNG): Order[] {
  const count = rng.nextInt(1, 2)
  const orders: Order[] = []

  for (let i = 0; i < count; i++) {
    const imageType = IMAGE_TYPES[rng.nextInt(0, 2)]!
    const pieceCount = rng.nextInt(2, 20) * 50 // 100-1000 in steps of 50
    const deadline = state.day + rng.nextInt(2, 4)

    // priority: 70% normal, 20% rush, 10% vip
    const priorityRoll = rng.next()
    const priority =
      priorityRoll < 0.7 ? 'normal' : priorityRoll < 0.9 ? 'rush' : 'vip'

    const customerName =
      CUSTOMER_NAMES[rng.nextInt(0, CUSTOMER_NAMES.length - 1)]!

    const order: Order = {
      id: `order-${state.day}-${i}`,
      customerName,
      pieceCount,
      imageType,
      deadline,
      priority,
      payment: 0, // calculated below
      stage: 'intake',
      quality: 0,
    }

    order.payment = calculateRevenue(order)
    orders.push(order)
  }

  return orders
}
