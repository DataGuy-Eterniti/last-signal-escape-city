import { CityProfile, DEFAULT_KINDS, LandmarkKind } from './cities';
import { VehicleState } from '../types';
import { BODY_SIZE, BuildingPaint, CarBody, buildingPaint, carBody, paintFor } from './palette';

/* ==========================================================================
   World model — the single source of truth for BOTH the renderer and the
   collision system, so what you see is exactly what you hit.
   Pure and deterministic (no DOM): unit-testable.
   ========================================================================== */

export const PITCH = 500; // road centreline spacing (px)
export const ROAD = 160; // asphalt width
export const HR = ROAD / 2;
export const SIDEWALK = 16;
export const INNER = PITCH - ROAD; // 340: block incl. sidewalk
export const LOT = INNER - SIDEWALK * 2; // 308: buildable
export const OFFSET = 220; // road 0 centre sits here (physics clamps at 50 px)
export const METERS_PER_PX = 0.1;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ObstacleKind = 'building' | 'barrier' | 'barricade' | 'car' | 'cone' | 'fountain' | 'edge' | 'traffic' | 'officer';

export interface Obstacle extends Rect {
  kind: ObstacleKind;
}

export interface Building extends Rect {
  label: string;
  roof: number; // legacy palette index
  paint: BuildingPaint; // unique per building
  height: number; // shadow length
  seed: number;
}

export interface Block {
  i: number;
  j: number;
  x: number; // world px of block's top-left (sidewalk edge)
  y: number;
  type: 'lots' | LandmarkKind;
  landmark?: string; // name if part of a landmark
  district: string;
  buildings: Building[];
}

export interface Barricade {
  // closes the road segment between intersections a and b
  a: [number, number];
  b: [number, number];
  rects: Rect[];
}

export interface ParkedCar extends Rect {
  angle: 0 | 1; // 0 = along a vertical road, 1 = along a horizontal road
  body: CarBody;
  color: string;
  seed: number;
}

export interface World {
  city: CityProfile;
  width: number;
  height: number;
  blocks: Block[]; // row-major: j * blocksX + i
  obstacles: Obstacle[];
  grid: Map<string, number[]>; // spatial index: cell "cx,cy" → obstacle indices
  barricades: Barricade[];
  parkedCars: ParkedCar[];
  closed: Set<string>; // barricaded road segments (segKey)
  cones: Rect[];
  start: { x: number; y: number; angle: number };
  extraction: { x: number; y: number; name: string };
  landmarkLabels: { name: string; x: number; y: number; kind: LandmarkKind }[];
}

/* ---------- helpers ---------- */

export const roadX = (ix: number) => OFFSET + ix * PITCH;
export const roadY = (iy: number) => OFFSET + iy * PITCH;

export function hash(a: number, b: number, salt = 0): number {
  let h = (a * 374761393 + b * 668265263 + salt * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function rngFor(seed: number, i: number, j: number) {
  let n = 0;
  return () => hash(i * 31 + seed, j * 17 + seed * 7, ++n);
}

const CELL = PITCH;
const cellKey = (cx: number, cy: number) => `${cx},${cy}`;

function index(world: World, o: Obstacle, idx: number) {
  const cx0 = Math.floor(o.x / CELL);
  const cx1 = Math.floor((o.x + o.w) / CELL);
  const cy0 = Math.floor(o.y / CELL);
  const cy1 = Math.floor((o.y + o.h) / CELL);
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cy = cy0; cy <= cy1; cy++) {
      const k = cellKey(cx, cy);
      const list = world.grid.get(k);
      if (list) list.push(idx);
      else world.grid.set(k, [idx]);
    }
  }
}

/* ---------- generation ---------- */

function districtFor(city: CityProfile, i: number, j: number) {
  return city.districts.find((d) => i >= d.i0 && i <= d.i1 && j >= d.j0 && j <= d.j1);
}

function landmarkFor(city: CityProfile, i: number, j: number) {
  return city.landmarks.find((l) => i >= l.bx && i < l.bx + (l.bw ?? 1) && j >= l.by && j < l.by + (l.bh ?? 1));
}

function makeBuildings(x0: number, y0: number, kinds: string[], rnd: () => number): Building[] {
  const gap = 12;
  const lots: Rect[] = [];
  const split = rnd();
  if (split < 0.35) {
    const cut = Math.round(LOT * (0.4 + rnd() * 0.2));
    lots.push({ x: x0, y: y0, w: cut - gap / 2, h: LOT }, { x: x0 + cut + gap / 2, y: y0, w: LOT - cut - gap / 2, h: LOT });
  } else if (split < 0.7) {
    const cx = Math.round(LOT * (0.42 + rnd() * 0.16));
    const cy = Math.round(LOT * (0.42 + rnd() * 0.16));
    lots.push(
      { x: x0, y: y0, w: cx - gap / 2, h: cy - gap / 2 },
      { x: x0 + cx + gap / 2, y: y0, w: LOT - cx - gap / 2, h: cy - gap / 2 },
      { x: x0, y: y0 + cy + gap / 2, w: cx - gap / 2, h: LOT - cy - gap / 2 },
      { x: x0 + cx + gap / 2, y: y0 + cy + gap / 2, w: LOT - cx - gap / 2, h: LOT - cy - gap / 2 }
    );
  } else {
    const cut = Math.round(LOT * (0.38 + rnd() * 0.24));
    const half = Math.round(LOT * 0.55);
    lots.push(
      { x: x0, y: y0, w: LOT, h: cut - gap / 2 },
      { x: x0, y: y0 + cut + gap / 2, w: half - gap / 2, h: LOT - cut - gap / 2 },
      { x: x0 + half + gap / 2, y: y0 + cut + gap / 2, w: LOT - half - gap / 2, h: LOT - cut - gap / 2 }
    );
  }
  return lots.map((l) => {
    const seed = Math.floor(rnd() * 1e6);
    const inset = 4 + Math.round(rnd() * 10);
    return {
      x: l.x + inset,
      y: l.y + inset,
      w: l.w - inset * 2,
      h: l.h - inset * 2,
      label: kinds[Math.floor(rnd() * kinds.length)],
      roof: Math.floor(rnd() * 6),
      height: 6 + rnd() * 14,
      seed,
      paint: buildingPaint(seed)
    };
  });
}

/** Road segment between two neighbouring intersections → barricade rects across it. */
function barricadeRects(a: [number, number], b: [number, number]): Rect[] {
  const vertical = a[0] === b[0];
  const mx = (roadX(a[0]) + roadX(b[0])) / 2;
  const my = (roadY(a[1]) + roadY(b[1])) / 2;
  // three concrete jersey blocks with no gap — the segment is closed
  const rects: Rect[] = [];
  for (let k = 0; k < 3; k++) {
    const off = -HR + 4 + k * ((ROAD - 8) / 3);
    if (vertical) rects.push({ x: mx + off, y: my - 9, w: (ROAD - 8) / 3 - 4, h: 18 });
    else rects.push({ x: mx - 9, y: my + off, w: 18, h: (ROAD - 8) / 3 - 4 });
  }
  return rects;
}

type Seg = { a: [number, number]; b: [number, number] };
export const segKey = (s: Seg) => `${s.a[0]},${s.a[1]}-${s.b[0]},${s.b[1]}`;

function allSegments(city: CityProfile): Seg[] {
  const segs: Seg[] = [];
  for (let ix = 0; ix <= city.blocksX; ix++)
    for (let iy = 0; iy < city.blocksY; iy++) segs.push({ a: [ix, iy], b: [ix, iy + 1] });
  for (let iy = 0; iy <= city.blocksY; iy++)
    for (let ix = 0; ix < city.blocksX; ix++) segs.push({ a: [ix, iy], b: [ix + 1, iy] });
  return segs;
}

/** BFS over the road graph: can we still get from start to extraction? */
export function isReachable(city: CityProfile, closed: Set<string>): boolean {
  const W = city.blocksX + 1;
  const H = city.blocksY + 1;
  const seen = new Uint8Array(W * H);
  const q: [number, number][] = [[city.start.ix, city.start.iy]];
  seen[city.start.iy * W + city.start.ix] = 1;
  while (q.length) {
    const [x, y] = q.shift()!;
    if (x === city.extraction.ix && y === city.extraction.iy) return true;
    const nbrs: [number, number][] = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (const [nx, ny] of nbrs) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx]) continue;
      const s: Seg = nx < x || ny < y ? { a: [nx, ny], b: [x, y] } : { a: [x, y], b: [nx, ny] };
      if (closed.has(segKey(s))) continue;
      seen[ny * W + nx] = 1;
      q.push([nx, ny]);
    }
  }
  return false;
}

export function buildWorld(city: CityProfile): World {
  const width = OFFSET * 2 + city.blocksX * PITCH;
  const height = OFFSET * 2 + city.blocksY * PITCH;

  const world: World = {
    city,
    width,
    height,
    blocks: [],
    obstacles: [],
    grid: new Map(),
    barricades: [],
    parkedCars: [],
    closed: new Set(),
    cones: [],
    start: { x: roadX(city.start.ix), y: roadY(city.start.iy), angle: -Math.PI / 2 },
    extraction: { x: roadX(city.extraction.ix), y: roadY(city.extraction.iy), name: city.extraction.name },
    landmarkLabels: []
  };

  const add = (o: Obstacle) => {
    const idx = world.obstacles.push(o) - 1;
    index(world, o, idx);
  };

  // Blocks
  for (let j = 0; j < city.blocksY; j++) {
    for (let i = 0; i < city.blocksX; i++) {
      const rnd = rngFor(city.seed, i, j);
      const x = roadX(i) + HR;
      const y = roadY(j) + HR;
      const lm = landmarkFor(city, i, j);
      const dist = districtFor(city, i, j);
      const block: Block = {
        i,
        j,
        x,
        y,
        type: lm ? lm.kind : 'lots',
        landmark: lm?.name,
        district: dist?.name ?? city.name,
        buildings: []
      };
      const lx = x + SIDEWALK;
      const ly = y + SIDEWALK;
      if (!lm) {
        block.buildings = makeBuildings(lx, ly, dist?.kinds ?? DEFAULT_KINDS, rnd);
      } else if (lm.kind === 'tower' || lm.kind === 'arena') {
        const s = Math.round(LOT * (lm.kind === 'tower' ? 0.58 : 0.78));
        block.buildings = [
          {
            x: lx + (LOT - s) / 2,
            y: ly + (LOT - s) / 2,
            w: s,
            h: lm.kind === 'arena' ? Math.round(s * 0.7) : s,
            label: lm.name.toUpperCase(),
            roof: 2,
            height: lm.kind === 'tower' ? 30 : 16,
            seed: 0,
            paint: buildingPaint(0)
          }
        ];
      } else if (lm.kind === 'market') {
        // rows of stalls — solid but with lanes between
        const rows = 4;
        const sh = (LOT - (rows + 1) * 18) / rows;
        for (let r = 0; r < rows; r++) {
          block.buildings.push({
            x: lx + 18,
            y: ly + 18 + r * (sh + 18),
            w: LOT - 36,
            h: sh,
            label: r === 1 ? lm.name.toUpperCase() : 'STALLS',
            roof: 4,
            height: 4,
            seed: city.seed + i * 131 + j * 17 + r,
            paint: buildingPaint(city.seed + i * 131 + j * 17 + r)
          });
        }
      }
      for (const b of block.buildings) add({ x: b.x, y: b.y, w: b.w, h: b.h, kind: 'building' });
      if (lm?.kind === 'park' || lm?.kind === 'plaza') {
        // fountain / monument in the middle is solid
        add({ x: lx + LOT / 2 - 16, y: ly + LOT / 2 - 16, w: 32, h: 32, kind: 'fountain' });
      }
      world.blocks.push(block);
    }
  }

  // Landmark labels at the centre of each landmark's footprint
  for (const l of city.landmarks) {
    const bw = l.bw ?? 1;
    const bh = l.bh ?? 1;
    world.landmarkLabels.push({
      name: l.name,
      kind: l.kind,
      x: roadX(l.bx) + (bw * PITCH) / 2,
      y: roadY(l.by) + (bh * PITCH) / 2
    });
  }

  // Police barricades: close random segments, never cutting off the extraction
  const segs = allSegments(city);
  const closed = world.closed;
  const near = (s: Seg, p: { ix: number; iy: number }) =>
    (s.a[0] === p.ix && s.a[1] === p.iy) || (s.b[0] === p.ix && s.b[1] === p.iy);
  const order = segs
    .map((s, k) => ({ s, r: hash(city.seed, k, 91) }))
    .sort((p, q) => p.r - q.r)
    .map((p) => p.s);
  for (const s of order) {
    if (world.barricades.length >= city.checkpoints) break;
    if (near(s, city.start) || near(s, city.extraction)) continue;
    const key = segKey(s);
    closed.add(key);
    if (!isReachable(city, closed)) {
      closed.delete(key);
      continue;
    }
    const rects = barricadeRects(s.a, s.b);
    world.barricades.push({ a: s.a, b: s.b, rects });
    for (const r of rects) add({ ...r, kind: 'barricade' });
    // warning cones on both approaches
    const vertical = s.a[0] === s.b[0];
    const mx = (roadX(s.a[0]) + roadX(s.b[0])) / 2;
    const my = (roadY(s.a[1]) + roadY(s.b[1])) / 2;
    for (const side of [-1, 1]) {
      for (const lane of [-40, 0, 40]) {
        const c = vertical ? { x: mx + lane - 5, y: my + side * 46 - 5, w: 10, h: 10 } : { x: mx + side * 46 - 5, y: my + lane - 5, w: 10, h: 10 };
        world.cones.push(c);
        add({ ...c, kind: 'cone' });
      }
    }
  }

  // Parked cars along the curbs (skip near intersections and barricades)
  for (const s of segs) {
    const key = segKey(s);
    if (closed.has(key)) continue;
    const vertical = s.a[0] === s.b[0];
    const k0 = hash(city.seed + s.a[0] * 13, s.a[1] * 7 + (vertical ? 1 : 2), 5);
    if (k0 > city.parkedCarDensity) continue;
    const startAlong = vertical ? roadY(s.a[1]) + HR + 40 : roadX(s.a[0]) + HR + 40;
    const count = 1 + Math.floor(hash(s.a[0], s.a[1], vertical ? 11 : 12) * 3);
    const curbSide = hash(s.a[0], s.a[1], vertical ? 21 : 22) < 0.5 ? -1 : 1;
    for (let n = 0; n < count; n++) {
      const along = startAlong + 20 + n * 70 + hash(n, s.a[0] + s.a[1], 31) * 20;
      if (along > startAlong + INNER - 120) break;
      const seed = Math.floor(hash(n, s.a[0] * 3 + s.a[1] * 101 + (vertical ? 7 : 3), 41 + city.seed) * 1e9);
      const body = carBody(seed, city.id, false);
      const [bw, bl] = BODY_SIZE[body];
      const color = paintFor(body, seed, city.id);
      const car: ParkedCar = vertical
        ? { x: roadX(s.a[0]) + curbSide * (HR - 16) - bw / 2, y: along, w: bw, h: bl, angle: 0, body, color, seed }
        : { x: along, y: roadY(s.a[1]) + curbSide * (HR - 16) - bw / 2, w: bl, h: bw, angle: 1, body, color, seed };
      world.parkedCars.push(car);
      add({ x: car.x, y: car.y, w: car.w, h: car.h, kind: 'car' });
    }
  }

  // Lockdown barrier around the playable city
  const m = OFFSET - HR - 24; // just outside the outer roads
  const t = 20;
  add({ x: m - t, y: m - t, w: width - 2 * m + 2 * t, h: t, kind: 'edge' });
  add({ x: m - t, y: height - m, w: width - 2 * m + 2 * t, h: t, kind: 'edge' });
  add({ x: m - t, y: m, w: t, h: height - 2 * m, kind: 'edge' });
  add({ x: width - m, y: m, w: t, h: height - 2 * m, kind: 'edge' });

  return world;
}

/* ---------- queries ---------- */

export function blockAt(world: World, x: number, y: number): Block | undefined {
  const i = Math.floor((x - OFFSET) / PITCH);
  const j = Math.floor((y - OFFSET) / PITCH);
  if (i < 0 || j < 0 || i >= world.city.blocksX || j >= world.city.blocksY) return undefined;
  return world.blocks[j * world.city.blocksX + i];
}

export function districtAt(world: World, x: number, y: number): string {
  return blockAt(world, x, y)?.district ?? world.city.name;
}

export function nearby(world: World, x: number, y: number, r: number): number[] {
  const out = new Set<number>();
  const cx0 = Math.floor((x - r) / CELL);
  const cx1 = Math.floor((x + r) / CELL);
  const cy0 = Math.floor((y - r) / CELL);
  const cy1 = Math.floor((y + r) / CELL);
  for (let cx = cx0; cx <= cx1; cx++)
    for (let cy = cy0; cy <= cy1; cy++) for (const k of world.grid.get(cellKey(cx, cy)) ?? []) out.add(k);
  return [...out];
}

export function pointBlocked(world: World, x: number, y: number, r = 0): boolean {
  for (const k of nearby(world, x, y, r)) {
    const o = world.obstacles[k];
    const px = Math.max(o.x, Math.min(x, o.x + o.w));
    const py = Math.max(o.y, Math.min(y, o.y + o.h));
    if ((px - x) ** 2 + (py - y) ** 2 < r * r || (r === 0 && px === x && py === y)) return true;
  }
  return false;
}

/* ---------- collision response ---------- */

export const CAR_RADIUS = 13;
export const CAR_AXLE = 13; // circles at ±13 px along the heading

export interface CollisionResult {
  vehicle: VehicleState;
  impact: number; // closing speed into the obstacle (px/s), 0 if none
  hit: ObstacleKind | null;
}

/**
 * Two-circle car vs axis-aligned obstacles. Pushes the car out, removes the
 * velocity component into the wall (with a little bounce) and keeps the
 * tangential part so the car slides along walls.
 */
export function collide(world: World, v: VehicleState): CollisionResult {
  let x = v.x;
  let y = v.y;
  let vx = Math.cos(v.angle) * v.speed;
  let vy = Math.sin(v.angle) * v.speed;
  let impact = 0;
  let hit: ObstacleKind | null = null;
  const ax = Math.cos(v.angle) * CAR_AXLE;
  const ay = Math.sin(v.angle) * CAR_AXLE;

  for (let pass = 0; pass < 2; pass++) {
    for (const side of [1, -1]) {
      const cx = x + ax * side;
      const cy = y + ay * side;
      for (const k of nearby(world, cx, cy, CAR_RADIUS + 2)) {
        const o = world.obstacles[k];
        const px = Math.max(o.x, Math.min(cx, o.x + o.w));
        const py = Math.max(o.y, Math.min(cy, o.y + o.h));
        const dx = cx - px;
        const dy = cy - py;
        const d2 = dx * dx + dy * dy;
        if (d2 >= CAR_RADIUS * CAR_RADIUS) continue;
        let nx: number;
        let ny: number;
        let pen: number;
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          nx = dx / d;
          ny = dy / d;
          pen = CAR_RADIUS - d;
        } else {
          // centre inside the rect: push out along the shallowest axis
          const left = cx - o.x;
          const right = o.x + o.w - cx;
          const top = cy - o.y;
          const bottom = o.y + o.h - cy;
          const mn = Math.min(left, right, top, bottom);
          nx = mn === left ? -1 : mn === right ? 1 : 0;
          ny = mn === top ? -1 : mn === bottom ? 1 : 0;
          pen = mn + CAR_RADIUS;
        }
        x += nx * pen;
        y += ny * pen;
        const vn = vx * nx + vy * ny;
        if (vn < 0) {
          vx -= vn * nx * 1.25; // 0.25 restitution
          vy -= vn * ny * 1.25;
          if (-vn > impact) {
            impact = -vn;
            hit = o.kind;
          }
        }
      }
    }
  }

  if (impact === 0 && x === v.x && y === v.y) return { vehicle: v, impact: 0, hit: null };

  // project the remaining velocity back onto the heading (physics uses speed + angle)
  const along = vx * Math.cos(v.angle) + vy * Math.sin(v.angle);
  const scrape = impact > 0 ? 0.92 : 1;
  const next: VehicleState = { ...v, x, y, speed: along * scrape };
  next.vx = Math.cos(next.angle) * next.speed;
  next.vy = Math.sin(next.angle) * next.speed;
  return { vehicle: next, impact, hit };
}

/** Damage to the package from an impact (px/s closing speed). */
export function damageFrom(impact: number, hit: ObstacleKind | null): number {
  if (impact < 80) return 0;
  if (hit === 'officer') return 0;
  const soft = hit === 'cone' ? 0.25 : hit === 'traffic' ? 0.8 : 1;
  return Math.min(45, ((impact - 80) / 11) * soft);
}
