import { VehicleState } from '../types';
import type { Actors } from '../engine/actors';
import { HR, METERS_PER_PX, OFFSET, PITCH, World, roadX, roadY, segKey } from '../engine/world';

/* ==========================================================================
   HUD view-models. Pure functions that turn live game state into what the
   Crime / Zombie HUDs draw. The HUD components only ever receive these
   plain objects, so they can be previewed with mock data (/design) and
   wired to new engine systems later without touching the visuals.
   ========================================================================== */

export type ThreatKind = 'police' | 'gunman' | 'horde';

export interface DangerMarker {
  id: number;
  angle: number; // screen-space radians, 0 = right, π/2 = down
  proximity: number; // 0 (edge of range) … 1 (on top of you)
  kind: ThreatKind;
  firing?: boolean;
}

export interface RadioMessage {
  id: number;
  from: string;
  text: string;
  tone: 'info' | 'alert' | 'success';
}

export type TurnKind = 'straight' | 'left' | 'right' | 'uturn' | 'arrive';

export interface RouteHint {
  turn: TurnKind;
  street: string;
  distM: number;
}

export interface ObjectiveState {
  name: string;
  distM: number;
  bearing: number; // screen radians toward the objective
  time: number; // seconds elapsed
}

export interface CrimeHudState {
  heat: number; // 0–5 stars (fractional while building)
  pursuit: boolean;
  vehicleHealth: number; // 0–100
  integrity: number; // package 0–100
  markers: DangerMarker[];
  radio: RadioMessage[];
  route: RouteHint | null;
  objective: ObjectiveState;
}

export interface ZombieBlip {
  id: number;
  angle: number; // radians relative to heading-up radar
  dist: number; // 0 centre … 1 radar edge
  size: number; // 1 lone walker … 3 horde
}

export interface ZombieHudState {
  threat: number; // 0–5
  infected: { active: boolean; zone: string; severity: 1 | 2 | 3 } | null;
  blips: ZombieBlip[];
  vehicleHealth: number;
  cargo: number;
  countdown: number; // seconds until extraction leaves
  countdownTotal: number;
  route: RouteHint | null;
  objective: ObjectiveState;
  markers: DangerMarker[];
}

/* ---------- streets & directions ---------- */

const clampIdx = (n: number, max: number) => Math.max(0, Math.min(max, n));

/** Name of the road the point is on (or nearest to). */
export function streetAt(world: World, x: number, y: number): string {
  const ix = clampIdx(Math.round((x - OFFSET) / PITCH), world.city.blocksX);
  const iy = clampIdx(Math.round((y - OFFSET) / PITCH), world.city.blocksY);
  const dv = Math.abs(x - roadX(ix));
  const dh = Math.abs(y - roadY(iy));
  return (dv < dh ? world.city.vRoads[ix] : world.city.hRoads[iy]) ?? world.city.name;
}

export function compassWord(angle: number): string {
  const words = ['eastbound', 'southbound', 'westbound', 'northbound'];
  const k = Math.round(angle / (Math.PI / 2));
  return words[((k % 4) + 4) % 4];
}

/* ---------- route guidance (BFS over the open road grid) ---------- */

type J = [number, number];
const jk = (p: J) => p[0] * 1000 + p[1];

function openNeighbours(world: World, p: J): J[] {
  const out: J[] = [];
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ] as const) {
    const n: J = [p[0] + dx, p[1] + dy];
    if (n[0] < 0 || n[1] < 0 || n[0] > world.city.blocksX || n[1] > world.city.blocksY) continue;
    const lo = p[0] < n[0] || p[1] < n[1];
    if (world.closed.has(segKey(lo ? { a: p, b: n } : { a: n, b: p }))) continue;
    out.push(n);
  }
  return out;
}

/** Shortest junction path from `from` to the extraction junction, avoiding barricades. */
export function routePath(world: World, from: J): J[] | null {
  const goal: J = [world.city.extraction.ix, world.city.extraction.iy];
  const prev = new Map<number, J | null>([[jk(from), null]]);
  const q: J[] = [from];
  while (q.length) {
    const cur = q.shift()!;
    if (cur[0] === goal[0] && cur[1] === goal[1]) {
      const path: J[] = [];
      let c: J | null = cur;
      while (c) {
        path.unshift(c);
        c = prev.get(jk(c)) ?? null;
      }
      return path;
    }
    for (const n of openNeighbours(world, cur)) {
      if (prev.has(jk(n))) continue;
      prev.set(jk(n), cur);
      q.push(n);
    }
  }
  return null;
}

/** The junction in front of the car on its current road (heading snapped to the grid). */
export function junctionAhead(world: World, x: number, y: number, angle: number): { dir: J; ahead: J } {
  const card = Math.round(angle / (Math.PI / 2));
  const dir: J = [Math.round(Math.cos(card * (Math.PI / 2))), Math.round(Math.sin(card * (Math.PI / 2)))];
  const fx = (x - OFFSET) / PITCH;
  const fy = (y - OFFSET) / PITCH;
  const jx = dir[0] > 0 ? Math.ceil(fx - 0.05) : dir[0] < 0 ? Math.floor(fx + 0.05) : Math.round(fx);
  const jy = dir[1] > 0 ? Math.ceil(fy - 0.05) : dir[1] < 0 ? Math.floor(fy + 0.05) : Math.round(fy);
  return { dir, ahead: [clampIdx(jx, world.city.blocksX), clampIdx(jy, world.city.blocksY)] };
}

/** Route polyline in world px for the renderer's guidance ribbon: car → junctions → extraction. */
export function routePolyline(world: World, x: number, y: number, angle: number): { x: number; y: number }[] {
  const { dir, ahead } = junctionAhead(world, x, y, angle);
  // candidates: the junction ahead, and the one behind (a U-turn) — draw whichever is shorter,
  // so the ribbon never runs forward and then doubles back on itself
  const behind = junctionAhead(world, x, y, angle + Math.PI).ahead;
  let best: { x: number; y: number }[] = [];
  let bestLen = Infinity;
  for (const j of [ahead, behind]) {
    const path = routePath(world, j);
    if (!path) continue;
    // first leg runs along the current road's centre line (never diagonally through a block)
    const start = dir[0] !== 0 ? { x, y: roadY(j[1]) } : { x: roadX(j[0]), y };
    const pts = [start, ...path.map(([i, k]) => ({ x: roadX(i), y: roadY(k) }))];
    pts.push({ x: world.extraction.x, y: world.extraction.y });
    let len = 0;
    for (let k = 1; k < pts.length; k++) len += Math.abs(pts[k].x - pts[k - 1].x) + Math.abs(pts[k].y - pts[k - 1].y);
    if (len < bestLen - 1) {
      best = pts;
      bestLen = len;
    }
  }
  return best;
}

/**
 * Next manoeuvre for a car at (x, y) heading `angle`: picks the junction ahead
 * on the current road, routes from there, and expresses the first change of
 * direction relative to the car's heading.
 */
export function nextTurn(world: World, x: number, y: number, angle: number): RouteHint | null {
  const ex = world.extraction;
  const toGoal = Math.hypot(ex.x - x, ex.y - y);
  if (toGoal < 140) return { turn: 'arrive', street: ex.name, distM: toGoal * METERS_PER_PX };

  const { dir, ahead } = junctionAhead(world, x, y, angle);
  const [jx, jy] = ahead;
  const path = routePath(world, ahead);
  const distAhead = Math.hypot(roadX(jx) - x, roadY(jy) - y);
  if (!path) return null;
  if (path.length === 1) return { turn: 'straight', street: ex.name, distM: toGoal * METERS_PER_PX };

  const step: J = [path[1][0] - path[0][0], path[1][1] - path[0][1]];
  const cross = dir[0] * step[1] - dir[1] * step[0]; // screen coords: + = right turn
  const dot = dir[0] * step[0] + dir[1] * step[1];
  const turn: TurnKind = dot > 0 ? 'straight' : dot < 0 ? 'uturn' : cross > 0 ? 'right' : 'left';
  // street we turn onto
  const street = step[0] !== 0 ? world.city.hRoads[path[0][1]] : world.city.vRoads[path[0][0]];
  // for "straight" report the distance to the first real turn
  let dist = distAhead;
  if (turn === 'straight') {
    for (let k = 1; k < path.length - 1; k++) {
      const a: J = [path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]];
      const b: J = [path[k + 1][0] - path[k][0], path[k + 1][1] - path[k][1]];
      if (a[0] !== b[0] || a[1] !== b[1]) break;
      dist += PITCH;
    }
    dist += PITCH;
  }
  return { turn, street: street ?? world.city.name, distM: Math.max(0, dist - HR) * METERS_PER_PX };
}

/* ---------- threats ---------- */

export const DANGER_RANGE = 650;

/** Armed officers near the courier, as edge markers (heading-independent, screen space). */
export function dangerMarkers(actors: Actors | null, v: VehicleState): DangerMarker[] {
  if (!actors) return [];
  const out: DangerMarker[] = [];
  for (const o of actors.officers) {
    if (o.stunned > 0) continue;
    const dx = o.x - v.x;
    const dy = o.y - v.y;
    const d = Math.hypot(dx, dy);
    if (d > DANGER_RANGE || d < 1) continue;
    out.push({ id: o.id, angle: Math.atan2(dy, dx), proximity: 1 - d / DANGER_RANGE, kind: o.kind === 'checkpoint' ? 'police' : 'gunman', firing: o.aim > 0.5 });
  }
  return out.sort((a, b) => b.proximity - a.proximity).slice(0, 8);
}

/* ---------- heat ---------- */

export interface HeatState {
  value: number; // 0–5
  calm: number; // seconds since last provocation
}

export type HeatEvent = 'shot-at' | 'hit' | 'traffic-crash' | 'officer-down' | 'barricade';

const HEAT_GAIN: Record<HeatEvent, number> = { 'shot-at': 0.25, hit: 0.35, 'traffic-crash': 0.3, 'officer-down': 0.9, barricade: 0.5 };

/** Heat builds with provocations and cools after 6 s of calm. */
export function updateHeat(h: HeatState, dt: number, events: HeatEvent[]): HeatState {
  let value = h.value;
  let calm = h.calm + dt;
  for (const e of events) {
    value += HEAT_GAIN[e];
    calm = 0;
  }
  if (calm > 6) value -= dt * 0.18;
  return { value: Math.max(0, Math.min(5, value)), calm };
}

export const PURSUIT_AT = 3;
