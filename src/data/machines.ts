import type { Machine } from '../engine/types'

export const STARTING_MACHINES: Machine[] = [
  {
    id: 'machine-1',
    name: 'Old Reliable',
    speed: 100,
    precision: 0.85,
    reliability: 0.9,
    condition: 80,
    status: 'idle',
  },
]
