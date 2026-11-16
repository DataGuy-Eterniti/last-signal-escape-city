import type { World } from '../../engine/world';
import { HR, INNER, SIDEWALK, METERS_PER_PX, hash, roadX, roadY, segKey } from '../../engine/world';

/* ==========================================================================
   Rescue Run — mission model (pure, no DOM, no engine edits).
   Reads the world to place survivors; never changes geometry or physics.

   Loop: drive to a waiting survivor → stop inside the pickup ring for 2 s
   (boarding) → repeat up to capacity → stop in the safe zone for 1.5 s to
   drop everyone off. Waiting survivors have patience; when it runs out they
   are lost. The run ends when nobody is left waiting or onboard.
   ========================================================================== */

export type SurvivorStatus = 'waiting' | 'boarding' | 'onboard' | 'rescued' | 'lost';
export type RescueDifficulty = 'Easy' | 'Medium' | 'Hard' | 'Extreme';
export type NavLevel = 'guided' | 'explorer' | 'survival';

export interface Survivor {
  id: number;
  x: number;
  y: number;
  status: SurvivorStatus;
  board: number; // 0–1 boarding progress
  patience: number; // seconds left while waiting
  patienceMax: number;
  street: string;
}

export interface RescueState {
  survivors: Survivor[];
  capacity: number;
  safe: { x: number; y: number; name: string; r: number };
  dropProgress: number; // 0–1 while unloading in the safe zone
  time: number;
  lastDrop: { count: number; at: number } | null;
  nav: NavLevel;
}

export const PICKUP_R = 70; // px — ring drawn around each survivor
export const BOARD_TIME = 2; // s — brief: 2-second boarding
export const DROP_TIME = 1.5; // s
export const STOP_SPEED = 45; // px/s — "stopped enough" to board / unload
export const SAFE_R = 120;

export interface RescueConfig {
  survivors: number;
  capacity: number;
  patience: number; // seconds each survivor waits
}

export const RESCUE_CONFIG: Record<RescueDifficulty, RescueConfig> = {
  Easy: { survivors: 5, capacity: 3, patience: 240 },
  Medium: { survivors: 7, capacity: 3, patience: 180 },
  Hard: { survivors: 9, capacity: 3, patience: 140 },
  Extreme: { survivors: 11, capacity: 2, patience: 110 }
};

/** Estimated threat 1–5 for the mission card (survivor load × difficulty × armed checkpoints). */
export function estimateThreat(difficulty: RescueDifficulty, checkpoints: number): number {
  const base = { Easy: 1, Medium: 2, Hard: 3, Extreme: 4 }[difficulty];
  return Math.min(5, base + (checkpoints >= 10 ? 1 : 0));
}

/**
 * Survivors stand on sidewalks at the kerb (never inside buildings or on the
 * road), spread across the map and away from the start and the safe zone.
 */
export function planRescue(world: World, difficulty: RescueDifficulty, nav: NavLevel = 'explorer'): RescueState {
  const cfg = RESCUE_CONFIG[difficulty];
  const { city } = world;
  const spots: { x: number; y: number; street: string; r: number }[] = [];
  const kerb = HR + SIDEWALK * 0.5;
  for (let i = 0; i <= city.blocksX; i++)
    for (let j = 0; j < city.blocksY; j++) {
      // a point on the sidewalk beside the vertical road i, mid-segment j
      const side = hash(city.seed, i * 31 + j, 601) < 0.5 ? -1 : 1;
      const x = roadX(i) + side * kerb;
      const y = (roadY(j) + roadY(j + 1)) / 2 + (hash(i, j, 607) - 0.5) * INNER * 0.4;
      if (i === 0 && side < 0) continue;
      if (i === city.blocksX && side > 0) continue;
      spots.push({ x, y, street: city.vRoads[i] ?? city.name, r: hash(city.seed, i * 97 + j, 613) });
    }
  for (let j = 0; j <= city.blocksY; j++)
    for (let i = 0; i < city.blocksX; i++) {
      const side = hash(city.seed, j * 37 + i, 617) < 0.5 ? -1 : 1;
      const y = roadY(j) + side * kerb;
      const x = (roadX(i) + roadX(i + 1)) / 2 + (hash(i, j, 619) - 0.5) * INNER * 0.4;
      if (j === 0 && side < 0) continue;
      if (j === city.blocksY && side > 0) continue;
      spots.push({ x, y, street: city.hRoads[j] ?? city.name, r: hash(city.seed, j * 89 + i, 631) });
    }
  const safe = { x: world.extraction.x, y: world.extraction.y, name: world.extraction.name, r: SAFE_R };
  const chosen: typeof spots = [];
  for (const s of spots.sort((a, b) => a.r - b.r)) {
    if (chosen.length >= cfg.survivors) break;
    if (Math.hypot(s.x - world.start.x, s.y - world.start.y) < 450) continue;
    if (Math.hypot(s.x - safe.x, s.y - safe.y) < 450) continue;
    if (chosen.some((c) => Math.hypot(c.x - s.x, c.y - s.y) < 700)) continue;
    chosen.push(s);
  }
  return {
    survivors: chosen.map((s, id) => {
      const p = cfg.patience * (0.8 + hash(id, city.seed, 641) * 0.4);
      return { id, x: s.x, y: s.y, status: 'waiting', board: 0, patience: p, patienceMax: p, street: s.street };
    }),
    capacity: cfg.capacity,
    safe,
    dropProgress: 0,
    time: 0,
    lastDrop: null,
    nav
  };
}

export interface RescueCounts {
  waiting: number;
  onboard: number;
  rescued: number;
  lost: number;
  total: number;
}

export function counts(s: RescueState): RescueCounts {
  const c = { waiting: 0, onboard: 0, rescued: 0, lost: 0, total: s.survivors.length };
  for (const v of s.survivors) {
    if (v.status === 'waiting' || v.status === 'boarding') c.waiting++;
    else c[v.status]++;
  }
  return c;
}

export type RescueEvent = { kind: 'boarded'; id: number } | { kind: 'dropped'; count: number } | { kind: 'lost'; id: number } | { kind: 'full' };

/** Advance the mission. `pos`/`speed` are the courier's; nothing here moves the car. */
export function stepRescue(s: RescueState, pos: { x: number; y: number }, speed: number, dt: number): RescueEvent[] {
  const ev: RescueEvent[] = [];
  s.time += dt;
  const stopped = Math.abs(speed) < STOP_SPEED;
  let onboard = s.survivors.filter((v) => v.status === 'onboard').length;
  let boardingClaimed = false;

  for (const v of s.survivors) {
    if (v.status !== 'waiting' && v.status !== 'boarding') continue;
    v.patience -= dt;
    if (v.patience <= 0) {
      v.status = 'lost';
      v.board = 0;
      ev.push({ kind: 'lost', id: v.id });
      continue;
    }
    const inRing = Math.hypot(v.x - pos.x, v.y - pos.y) < PICKUP_R;
    if (inRing && stopped && onboard < s.capacity && !boardingClaimed) {
      boardingClaimed = true; // one survivor boards at a time
      v.status = 'boarding';
      v.board = Math.min(1, v.board + dt / BOARD_TIME);
      if (v.board >= 1) {
        v.status = 'onboard';
        onboard++;
        ev.push({ kind: 'boarded', id: v.id });
        if (onboard >= s.capacity) ev.push({ kind: 'full' });
      }
    } else {
      // leaving the ring or moving bleeds progress back out (fast but not instant)
      v.board = Math.max(0, v.board - dt / (BOARD_TIME * 0.75));
      v.status = 'waiting';
      if (inRing && onboard >= s.capacity && v.board === 0) {
        /* car is full: survivor keeps waiting */
      }
    }
  }

  // unloading at the safe zone
  const inSafe = Math.hypot(s.safe.x - pos.x, s.safe.y - pos.y) < s.safe.r;
  if (inSafe && stopped && onboard > 0) {
    s.dropProgress = Math.min(1, s.dropProgress + dt / DROP_TIME);
    if (s.dropProgress >= 1) {
      let n = 0;
      for (const v of s.survivors)
        if (v.status === 'onboard') {
          v.status = 'rescued';
          n++;
        }
      s.dropProgress = 0;
      s.lastDrop = { count: n, at: s.time };
      ev.push({ kind: 'dropped', count: n });
    }
  } else s.dropProgress = Math.max(0, s.dropProgress - dt / DROP_TIME);
  return ev;
}

export const isFinished = (s: RescueState) => {
  const c = counts(s);
  return c.waiting === 0 && c.onboard === 0;
};

/** Score: rescues dominate; speed, car condition and zero losses add bonuses. */
export function rescueScore(s: RescueState, vehicleHealth: number): { total: number; parts: { label: string; value: number }[] } {
  const c = counts(s);
  const parts = [
    { label: 'Survivors saved', value: c.rescued * 1000 },
    { label: 'Time bonus', value: Math.max(0, Math.round((600 - s.time) * 2)) * (c.rescued > 0 ? 1 : 0) },
    { label: 'Vehicle condition', value: Math.round(vehicleHealth * 5) },
    { label: 'Nobody left behind', value: c.lost === 0 && c.rescued === c.total ? 1500 : 0 },
    { label: 'Lost', value: -c.lost * 300 }
  ];
  return { total: Math.max(0, parts.reduce((n, p) => n + p.value, 0)), parts };
}

/* ---------- navigation assistance ---------- */

export interface NavPolicy {
  label: string;
  blurb: string;
  ribbon: boolean; // route ribbon to the current objective
  markers: 'all' | 'near' | 'none'; // edge markers for survivors
  markerRange: number; // px for 'near'
  distances: boolean; // show metres on markers / chip
  safeMarker: boolean; // safe-zone edge marker
  minimapSurvivors: boolean;
}

export const NAV_LEVELS: Record<NavLevel, NavPolicy> = {
  guided: {
    label: 'Guided',
    blurb: 'Route ribbon to the nearest survivor, every survivor marked with distance.',
    ribbon: true,
    markers: 'all',
    markerRange: Infinity,
    distances: true,
    safeMarker: true,
    minimapSurvivors: true
  },
  explorer: {
    label: 'Explorer',
    blurb: 'Survivors appear on the edge of the screen once you are close. Find your own route.',
    ribbon: false,
    markers: 'near',
    markerRange: 900,
    distances: true,
    safeMarker: true,
    minimapSurvivors: true
  },
  survival: {
    label: 'Survival',
    blurb: 'No markers, no minimap pings. Watch the streets and listen to the radio.',
    ribbon: false,
    markers: 'none',
    markerRange: 0,
    distances: false,
    safeMarker: false,
    minimapSurvivors: false
  }
};

/** What the car should head for now: nearest waiting survivor, or the safe zone when full / nobody left. */
export function currentObjective(s: RescueState, pos: { x: number; y: number }): { kind: 'survivor' | 'safe'; x: number; y: number; distM: number; label: string } | null {
  const onboard = s.survivors.filter((v) => v.status === 'onboard').length;
  const waiting = s.survivors.filter((v) => v.status === 'waiting' || v.status === 'boarding');
  if (onboard >= s.capacity || (onboard > 0 && waiting.length === 0)) {
    return { kind: 'safe', x: s.safe.x, y: s.safe.y, distM: Math.hypot(s.safe.x - pos.x, s.safe.y - pos.y) * METERS_PER_PX, label: s.safe.name };
  }
  if (!waiting.length) return null;
  const n = waiting.reduce((a, b) => (Math.hypot(a.x - pos.x, a.y - pos.y) < Math.hypot(b.x - pos.x, b.y - pos.y) ? a : b));
  return { kind: 'survivor', x: n.x, y: n.y, distM: Math.hypot(n.x - pos.x, n.y - pos.y) * METERS_PER_PX, label: n.street };
}

/* ---------- HUD view-model ---------- */

export interface SurvivorMarker {
  id: number;
  angle: number; // screen radians from the car
  distM: number;
  urgent: boolean; // patience under 30 %
  kind: 'survivor' | 'safe';
}

/** Edge markers allowed by the navigation level. */
/** `minDist` hides markers for targets already on screen (default ≈ half a laptop screen). */
export function rescueMarkers(s: RescueState, pos: { x: number; y: number }, nav: NavLevel, minDist = 340): SurvivorMarker[] {
  const pol = NAV_LEVELS[nav];
  const out: SurvivorMarker[] = [];
  if (pol.markers !== 'none')
    for (const v of s.survivors) {
      if (v.status !== 'waiting' && v.status !== 'boarding') continue;
      const d = Math.hypot(v.x - pos.x, v.y - pos.y);
      if (pol.markers === 'near' && d > pol.markerRange) continue;
      if (d < minDist) continue;
      out.push({ id: v.id, angle: Math.atan2(v.y - pos.y, v.x - pos.x), distM: d * METERS_PER_PX, urgent: v.patience / v.patienceMax < 0.3, kind: 'survivor' });
    }
  if (pol.safeMarker && s.survivors.some((v) => v.status === 'onboard') && Math.hypot(s.safe.x - pos.x, s.safe.y - pos.y) > Math.max(s.safe.r, minDist))
    out.push({ id: -1, angle: Math.atan2(s.safe.y - pos.y, s.safe.x - pos.x), distM: Math.hypot(s.safe.x - pos.x, s.safe.y - pos.y) * METERS_PER_PX, urgent: false, kind: 'safe' });
  return out;
}

/* ---------- Guided navigation: route to any point (survivor or safe zone) ---------- */

type J = [number, number];

/** Nearest junction to a world point. */
export function nearestJunction(world: World, x: number, y: number): J {
  const { blocksX, blocksY } = world.city;
  const ix = Math.max(0, Math.min(blocksX, Math.round((x - roadX(0)) / (roadX(1) - roadX(0)))));
  const iy = Math.max(0, Math.min(blocksY, Math.round((y - roadY(0)) / (roadY(1) - roadY(0)))));
  return [ix, iy];
}

/** BFS over open road segments (barricades respected) from `from` to `to`. */
export function junctionPath(world: World, from: J, to: J): J[] | null {
  const key = (p: J) => p[0] * 1000 + p[1];
  const prev = new Map<number, J | null>([[key(from), null]]);
  const q: J[] = [from];
  while (q.length) {
    const cur = q.shift()!;
    if (cur[0] === to[0] && cur[1] === to[1]) {
      const out: J[] = [];
      let c: J | null = cur;
      while (c) {
        out.unshift(c);
        c = prev.get(key(c)) ?? null;
      }
      return out;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ] as const) {
      const n: J = [cur[0] + dx, cur[1] + dy];
      if (n[0] < 0 || n[1] < 0 || n[0] > world.city.blocksX || n[1] > world.city.blocksY || prev.has(key(n))) continue;
      const lo = cur[0] < n[0] || cur[1] < n[1];
      const a = lo ? cur : n;
      const b = lo ? n : cur;
      if (world.closed.has(segKey({ a, b }))) continue;
      prev.set(key(n), cur);
      q.push(n);
    }
  }
  return null;
}

/** Route ribbon polyline (world px) from the car to a target, along road centre lines. */
export function routePolylineTo(world: World, x: number, y: number, tx: number, ty: number): { x: number; y: number }[] {
  const path = junctionPath(world, nearestJunction(world, x, y), nearestJunction(world, tx, ty));
  if (!path) return [];
  return [{ x, y }, ...path.map(([i, j]) => ({ x: roadX(i), y: roadY(j) })), { x: tx, y: ty }];
}
