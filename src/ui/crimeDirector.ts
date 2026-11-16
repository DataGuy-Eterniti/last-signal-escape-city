import { VehicleState } from '../types';
import type { Actors } from '../engine/actors';
import { World, districtAt } from '../engine/world';
import { HeatEvent, HeatState, PURSUIT_AT, RadioMessage, compassWord, streetAt, updateHeat } from './hudModel';

/* ==========================================================================
   Crime City Pursuit director — the thin layer of mission rules on top of
   the existing simulation (no engine files touched):
   - heat rises with incidents and cools when you lie low
   - heat sharpens the existing officers (longer sight, faster aim)
   - separate vehicle health; "busted" if you stop near police at high heat
   - generates police radio chatter using the city's real street names
   ========================================================================== */

export interface CrimeRun {
  heat: HeatState;
  peakHeat: number;
  vehicle: number; // 0–100
  radio: RadioMessage[];
  nextId: number;
  lastRadioAt: number;
  level: number; // last announced whole heat level
  bustTimer: number;
  base: { range: number; aimTime: number };
}

export type CrimeLoss = 'wrecked' | 'busted' | null;

export function createCrimeRun(actors: Actors | null, world: World): CrimeRun {
  const run: CrimeRun = {
    heat: { value: 0.6, calm: 0 },
    peakHeat: 0.6,
    vehicle: 100,
    radio: [],
    nextId: 1,
    lastRadioAt: -99,
    level: 0,
    bustTimer: 0,
    base: actors ? { range: actors.tuning.range, aimTime: actors.tuning.aimTime } : { range: 320, aimTime: 0.75 }
  };
  say(run, 0, 'Dispatch', `All units: courier vehicle reported in ${world.city.name}. Approach with caution.`, 'info', true);
  return run;
}

function say(run: CrimeRun, t: number, from: string, text: string, tone: RadioMessage['tone'], force = false) {
  if (!force && t - run.lastRadioAt < 3.2) return;
  run.radio = [...run.radio, { id: run.nextId++, from, text, tone }].slice(-4);
  run.lastRadioAt = t;
}

const unit = (run: CrimeRun) => `Unit ${((run.nextId * 7) % 23) + 2}`;

export interface CrimeStepInput {
  t: number; // seconds into the run
  dt: number;
  events: HeatEvent[];
  crashDamage: number; // package damage this frame from collisions
  bulletDamage: number;
  world: World;
  vehicle: VehicleState;
  actors: Actors | null;
}

export function crimeStep(run: CrimeRun, s: CrimeStepInput): CrimeLoss {
  const before = run.heat.value;
  run.heat = updateHeat(run.heat, s.dt, s.events);
  run.peakHeat = Math.max(run.peakHeat, run.heat.value);
  run.vehicle = Math.max(0, run.vehicle - s.crashDamage * 0.9 - s.bulletDamage * 1.3);

  // heat sharpens the officers already on the map
  if (s.actors) {
    const h = run.heat.value;
    s.actors.tuning.range = run.base.range * (1 + 0.07 * h);
    s.actors.tuning.aimTime = run.base.aimTime * (1 - 0.07 * h);
  }

  // radio
  const street = streetAt(s.world, s.vehicle.x, s.vehicle.y);
  const district = districtAt(s.world, s.vehicle.x, s.vehicle.y);
  const dir = compassWord(s.vehicle.angle);
  const lvl = Math.floor(run.heat.value);
  if (lvl > run.level) {
    const lines = [
      '',
      `Courier vehicle spotted on ${street}.`,
      `Suspect ${dir} on ${street}. Units, take positions.`,
      `Pursuit authorised. All units converge on ${district}.`,
      `Manhunt in ${district}. Requesting air support.`,
      `City-wide lockdown. Stop that car at any cost.`
    ];
    say(run, s.t, lvl >= PURSUIT_AT ? 'Command' : unit(run), lines[lvl], lvl >= PURSUIT_AT ? 'alert' : 'info', true);
  } else if (before >= PURSUIT_AT && run.heat.value < PURSUIT_AT) {
    say(run, s.t, 'Dispatch', 'Lost visual on the suspect. Units, hold your positions.', 'success', true);
  } else if (s.events.includes('officer-down')) {
    say(run, s.t, unit(run), `Officer down on ${street}!`, 'alert');
  } else if (s.events.includes('hit')) {
    say(run, s.t, unit(run), `Shots on target near ${street}.`, 'alert');
  } else if (s.events.includes('traffic-crash')) {
    say(run, s.t, unit(run), `Collision reported, ${street}. Suspect still moving ${dir}.`, 'info');
  }
  run.level = lvl;

  if (run.vehicle <= 0) return 'wrecked';

  // busted: stopped next to police while heat is very high
  let near = false;
  if (s.actors) for (const o of s.actors.officers) if (o.stunned <= 0 && Math.hypot(o.x - s.vehicle.x, o.y - s.vehicle.y) < 130) near = true;
  if (run.heat.value >= 4 && near && Math.abs(s.vehicle.speed) < 25) run.bustTimer += s.dt;
  else run.bustTimer = Math.max(0, run.bustTimer - s.dt * 2);
  return run.bustTimer > 2.5 ? 'busted' : null;
}
