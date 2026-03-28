# CLAUDE.md — Piecemill: The Game

## what is this

a puzzle factory manager sim. you run a custom jigsaw puzzle factory: schedule machines, assign artists, survive chaos. it's a spreadsheet disguised as a game.

browser-only. no backend. the game engine is pure typescript. react is just the view layer.

## stack

- **react 18** + **typescript** (strict)
- **vite** for build
- **zustand** for state (with `persist` middleware for save/load)
- **tailwind css** for styling
- **@dnd-kit** for drag-and-drop (schedule view — NOT in mvp, but structure for it)
- **recharts** for dashboard charts (post-mvp)
- **vitest** for testing engine logic

## project structure

```
src/
├── engine/                # PURE TYPESCRIPT. no react imports. ever.
│   ├── types.ts           # all game types
│   ├── simulator.ts       # simulateDay(state, plan, rng) → DayResult
│   ├── scheduler.ts       # validatePlan, scorePlan
│   ├── events.ts          # event deck, drawEvents, applyEvent
│   ├── economy.ts         # revenue, costs, cash flow
│   ├── reputation.ts      # rep gain/loss calculations
│   ├── progression.ts     # difficulty scaling, unlocks
│   ├── balance.ts         # tuning constants (export const BALANCE = {...})
│   └── rng.ts             # seeded PRNG (xoshiro128** or similar)
├── ui/
│   ├── components/
│   │   ├── GameShell.tsx       # top-level layout, phase routing
│   │   ├── PlanningPhase.tsx   # resource assignment UI
│   │   ├── SimulationPhase.tsx # day execution display
│   │   ├── EventCard.tsx       # chaos event modal + choices
│   │   ├── DayReport.tsx       # end-of-day results
│   │   ├── OrderCard.tsx       # single order display
│   │   ├── MachineCard.tsx     # machine status display
│   │   └── ArtistCard.tsx      # artist status display
│   ├── hooks/
│   │   └── useGameLoop.ts      # orchestrates phase transitions
│   └── App.tsx
├── store/
│   ├── gameStore.ts        # zustand store, all slices
│   └── selectors.ts        # derived state
├── data/
│   ├── events.ts           # event definitions + weights
│   ├── machines.ts         # starting machine templates
│   ├── artists.ts          # starting artist templates
│   └── scenarios.ts        # initial game setups by difficulty
└── main.tsx
```

## architecture rules

1. **engine/ has ZERO react imports.** it's pure functions: state in, state out. if you're importing react in engine/, stop.
2. **all game logic lives in engine/.** ui components call engine functions via the store. components never compute game outcomes directly.
3. **zustand store is the single source of truth.** components read via selectors. engine writes via store actions.
4. **seeded RNG everywhere.** no `Math.random()`. ever. same seed = same run. store the seed in game state.
5. **types.ts is the contract.** define types first, implement second. if a type is wrong, fix the type, not the implementation.

## core types

```typescript
// engine/types.ts

interface Machine {
  id: string
  name: string
  speed: number         // pieces per hour
  precision: number     // 0-1, affects defect rate
  reliability: number   // 0-1, breakdown chance per day
  condition: number     // 0-100, degrades without maintenance
  status: 'idle' | 'running' | 'broken' | 'maintenance'
}

interface Artist {
  id: string
  name: string
  specialty: 'landscape' | 'portrait' | 'abstract' | 'general'
  speed: number         // designs per day
  quality: number       // 0-1
  morale: number        // 0-100
  status: 'available' | 'working' | 'sick' | 'quit'
}

interface Order {
  id: string
  customerName: string
  pieceCount: number
  imageType: 'landscape' | 'portrait' | 'abstract'
  deadline: number      // game day
  priority: 'normal' | 'rush' | 'vip'
  payment: number
  stage: 'intake' | 'design' | 'cutting' | 'finishing' | 'shipped' | 'late'
  quality: number       // accumulated quality score 0-100
  assignedArtist?: string
  assignedMachine?: string
}

interface GameEvent {
  id: string
  name: string
  description: string
  weight: number
  minDay: number
  choices: EventChoice[]
}

interface EventChoice {
  label: string
  description: string
  effects: Effect[]
}

type Effect =
  | { type: 'machine_break'; machineId?: string; duration: number }
  | { type: 'morale_change'; targetId?: string; delta: number }
  | { type: 'money_change'; delta: number }
  | { type: 'reputation_change'; delta: number }
  | { type: 'delay_order'; orderId?: string; days: number }
  | { type: 'quality_modifier'; delta: number }

interface DayPlan {
  assignments: {
    orderId: string
    artistId?: string
    machineId?: string
  }[]
  maintenance: string[]   // machine IDs
  overtime: boolean
  skipQA: string[]        // order IDs
}

interface DayResult {
  newState: GameState
  events: ResolvedEvent[]  // events that fired + player's choice
  shipments: Shipment[]
  financials: DayFinancials
  repDelta: number
}

interface Shipment {
  orderId: string
  onTime: boolean
  qualityScore: number
  revenue: number
  customerSatisfaction: number
}

interface DayFinancials {
  revenue: number
  materialCost: number
  laborCost: number
  maintenanceCost: number
  overtimeCost: number
  netIncome: number
}

interface GameState {
  // meta
  seed: number
  day: number
  phase: 'planning' | 'simulation' | 'event' | 'report' | 'between-days' | 'gameover'

  // resources
  money: number
  reputation: number     // 0-100
  machines: Machine[]
  artists: Artist[]
  orders: Order[]

  // history
  completedOrders: number
  lateOrders: number
  totalRevenue: number
  dayResults: DayResult[] // for end-of-game summary
}

type ResolvedEvent = GameEvent & { chosenOption: number }
```

## simulation logic

the core loop is `simulateDay()`:

```
validatePlan(state, plan)
  → draw events from weighted deck using seeded RNG
  → for each order in plan:
      - check artist assignment: specialty match? morale modifier?
      - check machine assignment: speed, precision, condition
      - advance order through pipeline stages
      - apply quality modifiers
  → fire events, pause for player choice if needed
  → resolve shipments (orders that reach 'finishing' stage)
  → calculate financials
  → calculate reputation delta
  → return DayResult
```

key simulation rules:
- **artist-image mismatch**: speed -30%, quality -20%
- **low machine condition** (<30): breakdown chance doubles
- **overtime**: +50% throughput, +15% defect rate, -10 morale to all workers
- **skip QA**: saves time, 40% chance defect ships undetected. defects = reputation hit
- **rush orders**: 2x payment, but deadline is tomorrow
- **order quality** accumulates across stages. each stage adds/subtracts based on who did the work and what went wrong

## balance constants

put these in `engine/balance.ts` as a single exported object. easy to tune.

```typescript
export const BALANCE = {
  // economy
  basePiecePrice: 2,            // $ per puzzle piece
  rushMultiplier: 2,
  vipMultiplier: 1.5,
  materialCostPerPiece: 0.5,
  dailyLaborCost: 200,          // per worker/artist
  overtimeMultiplier: 1.5,
  maintenanceCost: 300,         // per machine per maintenance day

  // quality
  baseDefectRate: 0.05,
  overtimeDefectBonus: 0.15,
  skipQADetectionFailure: 0.4,
  mismatchSpeedPenalty: 0.3,
  mismatchQualityPenalty: 0.2,

  // reputation
  onTimeDeliveryRep: 5,
  lateDeliveryRep: -10,
  defectShippedRep: -15,
  perfectOrderRep: 8,

  // machines
  conditionDegradePerDay: 5,    // condition lost per day of use
  breakdownThreshold: 30,       // below this, breakdown chance doubles
  maintenanceRestoreAmount: 40, // condition restored per maintenance day

  // artists
  moraleDecayOvertime: 10,
  moraleRecoverPerDay: 3,       // natural recovery when not overworked
  lowMoraleThreshold: 30,       // below this, quality tanks

  // progression
  startingMoney: 10000,
  startingReputation: 50,
  mvpDayCount: 5,               // days in a single run for MVP
} as const
```

## MVP scope — build exactly this

### what to build
1. **game start**: initialize state with 1 machine, 1 artist, 3 orders, seed from `Date.now()`
2. **planning phase**: simple UI — each order shows a card. player assigns artist + machine via dropdowns. toggle overtime. toggle skip QA per order.
3. **simulate button**: runs `simulateDay()`. if events fire, show `EventCard` modal with choices. player picks, simulation continues.
4. **day report**: modal/screen showing what shipped, revenue, reputation change, any breakdowns or quality issues.
5. **next day**: return to planning. new orders may arrive (1-2 per day from a small pool). existing orders advance or slip.
6. **game over**: after 5 days, show summary — total revenue, reputation, orders completed vs late, final score.

### what NOT to build yet
- drag-and-drop scheduling timeline
- charts/dashboards
- save/load (zustand persist is free, but don't build UI for slots)
- multiple save slots
- progression/unlocks
- hiring/firing
- machine upgrades
- difficulty selection
- sound
- animations beyond simple transitions

### UI for MVP
- keep it dead simple. cards, dropdowns, buttons.
- tailwind utility classes only. no custom CSS unless absolutely necessary.
- responsive is nice but not required. desktop-first.
- dark mode not required. light theme, slight warmth. think "clean spreadsheet that doesn't hate you."
- use `shadcn/ui`-style component patterns if helpful but don't install it — just write clean tailwind components.

## game phase flow

```
START → planning → simulation → [event? → choice →] report → planning → ... → GAME OVER (day 5)
```

the `phase` field in GameState drives which UI renders. `useGameLoop` hook manages transitions:

```typescript
// pseudocode for phase management
function useGameLoop() {
  const phase = useGameStore(s => s.phase)
  const advancePhase = useGameStore(s => s.advancePhase)

  // planning → user clicks "Start Day" → phase = 'simulation'
  // simulation → engine runs → if events, phase = 'event'
  // event → user picks choice → continue simulation or phase = 'report'
  // report → user clicks "Next Day" → phase = 'planning' (or 'gameover' if day 5)
}
```

## event data for MVP

include at least these 6 events in `data/events.ts`:

1. **Laser Drift** — machine cutting off-center. choices: recalibrate (lose time, order delayed 1 day) or let it ride (quality -20 on current order)
2. **Wood Warp** — bad material batch. choices: reject shipment (material cost +50%, no quality hit) or use it (quality -15 all orders today)
3. **Rush Order** — VIP wants it yesterday. choices: accept (new high-pay order, deadline = tomorrow) or decline (small reputation hit)
4. **Artist Sick Day** — your artist can't come in. choices: reassign to general backup (quality -25%) or delay all design work 1 day
5. **Machine Overheat** — laser needs cooldown. choices: shut down 1 day (lose machine tomorrow) or push through (condition -20, defect rate +10%)
6. **Viral Moment** — puzzle goes viral on social media. choices: capitalize (2 new orders flood in, tight deadlines) or ride it out (small reputation boost, no pressure)

weight them so 1-2 fire per day. not every day needs chaos. some days the factory just... works. that's satisfying too.

## testing priorities

1. `simulateDay()` — given known state + plan + seed, output is deterministic
2. `validatePlan()` — catches double-booking, missing assignments
3. `drawEvents()` — respects weights and minDay
4. `calculateRevenue()` — math is correct
5. reputation calculations

write engine tests FIRST before wiring up UI. the engine is the game. the UI is just buttons.

## commands

```bash
# setup
npm create vite@latest piecemill-game -- --template react-ts
cd piecemill-game
npm install zustand
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# dev
npm run dev

# test
npx vitest

# build
npm run build
```

## tone

this is a game about a real place. the factory has warmth. the chaos is funny, not punishing. the player should feel like a capable person juggling hard problems, not a victim of RNG. when things go wrong, the game should make you laugh and adapt, not ragequit.

the UI should feel like a well-designed internal tool — competent, data-dense, slightly playful. think Linear meets Factorio's production screen.

---

*"state in, state out. everything else is decoration."*
