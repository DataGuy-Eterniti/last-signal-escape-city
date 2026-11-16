import type { CityProfile } from '../engine/cities';

/* ==========================================================================
   Mission modes. Data only — the selection screen, HUD choice and results
   copy all read from here, so adding a mode is a one-entry change.
   ========================================================================== */

export type MissionId = 'courier' | 'crime' | 'zombie';
export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Extreme';
export type HazardIcon = 'barricade' | 'traffic' | 'gunman' | 'siren' | 'radio' | 'horde' | 'infected' | 'timer' | 'cargo';

export interface Mission {
  id: MissionId;
  name: string;
  kicker: string;
  tagline: string;
  objective: string;
  hazards: { icon: HazardIcon; label: string }[];
  briefing: string[]; // shown in the briefing panel, written as an in-world order
  channel: string; // who is talking in the briefing / radio
  accent: string; // CSS colour token
  difficultyStep: number; // added to the city's base difficulty
  available: boolean; // false = visible but locked ("Coming soon")
}

export const MISSIONS: Mission[] = [
  {
    id: 'courier',
    name: 'Courier Escape',
    kicker: 'The original run',
    tagline: 'One package. One way out. Every crash costs the cargo.',
    objective: 'Deliver the package to the extraction point before it is destroyed.',
    hazards: [
      { icon: 'barricade', label: 'Police barricades' },
      { icon: 'traffic', label: 'Moving traffic' },
      { icon: 'gunman', label: 'Armed checkpoints' }
    ],
    briefing: ['The city is in lockdown.', 'Your contact is waiting at the extraction point.', 'Keep the package intact — they only pay for what arrives.'],
    channel: 'Handler',
    accent: 'var(--gold)',
    difficultyStep: 0,
    available: true
  },
  {
    id: 'crime',
    name: 'Crime City Pursuit',
    kicker: 'Heat builds fast',
    tagline: 'Every shot, crash and officer you shove raises your heat. Lose them, or lose everything.',
    objective: 'Reach the extraction point with the car and the cargo in one piece while police heat climbs.',
    hazards: [
      { icon: 'siren', label: 'Heat & pursuit' },
      { icon: 'gunman', label: 'Patrols that shoot on sight' },
      { icon: 'radio', label: 'Police radio tracking you' },
      { icon: 'traffic', label: 'Traffic & barricades' }
    ],
    briefing: [
      'All units: courier vehicle sighted downtown.',
      'Suspect is armed with sensitive cargo. Lethal force authorised at checkpoints.',
      'Heat rises with every incident. At three badges, a full pursuit begins.'
    ],
    channel: 'Police dispatch',
    accent: 'var(--ember)',
    difficultyStep: 1,
    available: true
  },
  {
    id: 'zombie',
    name: 'Zombie Outbreak',
    kicker: 'The last evac is leaving',
    tagline: 'The infection is spreading block by block. Reach the evac point before it lifts off.',
    objective: 'Drive the vaccine cargo through infected districts to the evac point before the countdown ends.',
    hazards: [
      { icon: 'horde', label: 'Roaming hordes' },
      { icon: 'infected', label: 'Infected zones' },
      { icon: 'timer', label: 'Evac countdown' },
      { icon: 'cargo', label: 'Fragile vaccine cargo' }
    ],
    briefing: [
      'EVAC ORDER 7: civilian airlift departs on the countdown, no exceptions.',
      'Vaccine samples must reach the evac point intact.',
      'Hordes gather around noise. Keep moving — stopping draws them in.'
    ],
    channel: 'Evac command',
    accent: 'var(--toxic)',
    difficultyStep: 2,
    available: false // HUD + briefing designed; zombie actors pending in the engine (see UI_UPGRADE_CHANGES.md)
  }
];

const LEVELS: Difficulty[] = ['Easy', 'Medium', 'Hard', 'Extreme'];

export function missionDifficulty(m: Mission, city: CityProfile): Difficulty {
  const base = LEVELS.indexOf(city.difficulty as Difficulty);
  return LEVELS[Math.min(LEVELS.length - 1, Math.max(0, base) + m.difficultyStep)];
}

export const difficultyRank = (d: Difficulty) => LEVELS.indexOf(d) + 1; // 1–4

export const getMission = (id: string | null | undefined): Mission | undefined => MISSIONS.find((m) => m.id === id);
