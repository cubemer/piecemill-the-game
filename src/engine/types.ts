export interface Machine {
  id: string
  name: string
  speed: number
  precision: number
  reliability: number
  condition: number
  status: 'idle' | 'running' | 'broken' | 'maintenance'
}

export interface Artist {
  id: string
  name: string
  specialty: ImageType
  speed: number
  quality: number
  morale: number
  status: 'available' | 'working' | 'sick' | 'quit'
}

export type ImageType = 'landscape' | 'portrait' | 'abstract'

export interface Order {
  id: string
  customerName: string
  pieceCount: number
  imageType: ImageType
  deadline: number
  priority: 'normal' | 'rush' | 'vip'
  payment: number
  stage: 'intake' | 'design' | 'cutting' | 'finishing' | 'shipped' | 'late'
  quality: number
  assignedArtist?: string
  assignedMachine?: string
}

export interface GameEvent {
  id: string
  name: string
  description: string
  weight: number
  minDay: number
  choices: EventChoice[]
}

export interface EventChoice {
  label: string
  description: string
  effects: Effect[]
}

export type Effect =
  | { type: 'machine_break'; machineId?: string; duration: number }
  | { type: 'morale_change'; targetId?: string; delta: number }
  | { type: 'money_change'; delta: number }
  | { type: 'reputation_change'; delta: number }
  | { type: 'delay_order'; orderId?: string; days: number }
  | { type: 'quality_modifier'; delta: number }

export interface DayPlan {
  assignments: Assignment[]
  maintenance: string[]
  overtime: boolean
  skipQA: string[]
}

export interface Assignment {
  orderId: string
  artistId?: string
  machineId?: string
}

export interface DayResult {
  newState: GameState
  events: ResolvedEvent[]
  shipments: Shipment[]
  financials: DayFinancials
  repDelta: number
}

export interface Shipment {
  orderId: string
  onTime: boolean
  qualityScore: number
  revenue: number
  customerSatisfaction: number
}

export interface DayFinancials {
  revenue: number
  materialCost: number
  laborCost: number
  maintenanceCost: number
  overtimeCost: number
  netIncome: number
}

export interface GameState {
  seed: number
  day: number
  phase: 'planning' | 'simulation' | 'event' | 'report' | 'between-days' | 'gameover'

  money: number
  reputation: number
  machines: Machine[]
  artists: Artist[]
  orders: Order[]

  completedOrders: number
  lateOrders: number
  totalRevenue: number
  dayResults: DayResult[]
}

export type ResolvedEvent = GameEvent & { chosenOption: number }

export interface PlanValidationError {
  type:
    | 'double_booking_artist'
    | 'double_booking_machine'
    | 'invalid_order'
    | 'invalid_artist'
    | 'invalid_machine'
    | 'maintenance_conflict'
    | 'unavailable_artist'
    | 'unavailable_machine'
    | 'unassignable_order'
  message: string
  ids: string[]
}
