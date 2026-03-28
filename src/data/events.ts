import type { GameEvent } from '../engine/types'

export const EVENT_DECK: GameEvent[] = [
  {
    id: 'laser-drift',
    name: 'Laser Drift',
    description:
      'The cutting laser has drifted off-center. Puzzles are coming out slightly wonky.',
    weight: 20,
    minDay: 1,
    choices: [
      {
        label: 'Recalibrate',
        description: 'Shut down and recalibrate. Delays current order by 1 day.',
        effects: [{ type: 'delay_order', days: 1 }],
      },
      {
        label: 'Let it ride',
        description: 'Push through. Quality takes a hit.',
        effects: [{ type: 'quality_modifier', delta: -20 }],
      },
    ],
  },
  {
    id: 'wood-warp',
    name: 'Wood Warp',
    description:
      'A batch of puzzle board stock arrived warped. The humidity got to it.',
    weight: 15,
    minDay: 1,
    choices: [
      {
        label: 'Reject shipment',
        description: 'Send it back and pay rush pricing for replacement materials.',
        effects: [{ type: 'money_change', delta: -500 }],
      },
      {
        label: 'Use it anyway',
        description: 'Cut corners. All orders today take a quality hit.',
        effects: [{ type: 'quality_modifier', delta: -15 }],
      },
    ],
  },
  {
    id: 'rush-order',
    name: 'Rush Order',
    description:
      'A VIP customer calls in a panic. They need a custom puzzle by tomorrow. Big money.',
    weight: 20,
    minDay: 1,
    choices: [
      {
        label: 'Accept',
        description: 'Take the money and figure it out.',
        effects: [{ type: 'money_change', delta: 800 }],
      },
      {
        label: 'Decline',
        description: "Can't do it. Small hit to your reputation.",
        effects: [{ type: 'reputation_change', delta: -5 }],
      },
    ],
  },
  {
    id: 'artist-sick',
    name: 'Artist Sick Day',
    description:
      "Your artist woke up with the flu. They're not coming in today.",
    weight: 15,
    minDay: 2,
    choices: [
      {
        label: 'General backup',
        description: 'Reassign to a generalist. Quality drops 25%.',
        effects: [{ type: 'quality_modifier', delta: -25 }],
      },
      {
        label: 'Delay design work',
        description: 'Push all design work back a day.',
        effects: [{ type: 'delay_order', days: 1 }],
      },
    ],
  },
  {
    id: 'machine-overheat',
    name: 'Machine Overheat',
    description:
      "The cutting laser is running hot. You can smell the capacitors working overtime.",
    weight: 15,
    minDay: 2,
    choices: [
      {
        label: 'Shut it down',
        description: 'Cool off for a day. Lose the machine tomorrow.',
        effects: [{ type: 'machine_break', duration: 1 }],
      },
      {
        label: 'Push through',
        description: 'Keep running. Condition drops and defect rate climbs.',
        effects: [{ type: 'quality_modifier', delta: -10 }],
      },
    ],
  },
  {
    id: 'viral-moment',
    name: 'Viral Moment',
    description:
      'One of your puzzles just blew up on social media. Your inbox is flooding.',
    weight: 10,
    minDay: 3,
    choices: [
      {
        label: 'Capitalize',
        description: 'Take on the extra work. Two new orders with tight deadlines.',
        effects: [{ type: 'morale_change', delta: -5 }],
      },
      {
        label: 'Ride it out',
        description: 'Enjoy the clout. Small reputation boost.',
        effects: [{ type: 'reputation_change', delta: 5 }],
      },
    ],
  },
]
