import type { GameState } from '../engine/types'
import { BALANCE } from '../engine/balance'
import { STARTING_MACHINES } from './machines'
import { STARTING_ARTISTS } from './artists'

export function createInitialState(seed?: number): GameState {
  return {
    seed: seed ?? Date.now(),
    day: 1,
    phase: 'planning',

    money: BALANCE.startingMoney,
    reputation: BALANCE.startingReputation,
    machines: STARTING_MACHINES.map((m) => ({ ...m })),
    artists: STARTING_ARTISTS.map((a) => ({ ...a })),
    orders: [
      {
        id: 'order-start-1',
        customerName: 'Puzzlemania Inc.',
        pieceCount: 500,
        imageType: 'landscape',
        deadline: 3,
        priority: 'normal',
        payment: 500 * BALANCE.basePiecePrice,
        stage: 'intake',
        quality: 0,
      },
      {
        id: 'order-start-2',
        customerName: 'Fragment & Sons',
        pieceCount: 300,
        imageType: 'portrait',
        deadline: 4,
        priority: 'rush',
        payment: 300 * BALANCE.basePiecePrice * BALANCE.rushMultiplier,
        stage: 'intake',
        quality: 0,
      },
      {
        id: 'order-start-3',
        customerName: 'Tessellation Labs',
        pieceCount: 200,
        imageType: 'abstract',
        deadline: 5,
        priority: 'normal',
        payment: 200 * BALANCE.basePiecePrice,
        stage: 'intake',
        quality: 0,
      },
    ],

    completedOrders: 0,
    lateOrders: 0,
    totalRevenue: 0,
    dayResults: [],
  }
}
