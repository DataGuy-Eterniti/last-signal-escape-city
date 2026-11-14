import { VehicleState } from '../types';
import { BODY_SIZE, CarBody, carBody, paintFor, uniformFor } from './palette';
import {
  CAR_AXLE,
  CAR_RADIUS,
  CollisionResult,
  HR,
  INNER,
  ObstacleKind,
  World,
  hash,
  nearby,
  roadX,
  roadY,
  segKey
} from './world';

/* ==========================================================================
   Living city: moving traffic, armed police officers and their tracer fire.
   Pure and deterministic given the same dt sequence (Math.random is never
   used), so it is unit-testable like the world model.

   Traffic drives on the right, follows the road graph, never enters a
   barricaded segment, queues behind other cars, waits for a free
   intersection (one car per junction, so no overlaps and no deadlocks) and
   brakes for the courier. Officers aim, then fire visible tracers that can be
   dodged; buildings block line of sight and bullets.
   ========================================================================== */

export const LANE = 38; // lane centre offset from the road centreline
const STOP = HR + 22; // stop line distance before a junction centre
const CLEAR = HR + 14; // a car has left the junction after this distance

export interface TrafficCar {
  id: number;
  a: [number, number]; // junction we came from
  b: [number, number]; // junction we drive to
  t: number; // px travelled from a's centre
  speed: number;
  cruise: number;
  x: number; // smoothed render / collision position
  y: number;
  angle: number;
  body: CarBody;
  color: string;
  w: number;
  len: number;
  stunned: number;
  honk: number;
  holding: string | null; // junction key we hold
  seed: number;
}

export interface Officer {
  id: number;
  x: number;
  y: number;
  angle: number;
  kind: 'checkpoint' | 'patrol';
  p0: { x: number; y: number };
  p1: { x: number; y: number };
  dir: 1 | -1;
  aim: number; // 0..1 aim progress
  cooldown: number;
  stunned: number;
  uniform: string;
  vest: string;
  skin: string;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  px: number; // previous position (tracer tail)
  py: number;
}

export interface Spark {
  x: number;
  y: number;
  life: number;
}

export interface Actors {
  traffic: TrafficCar[];
  officers: Officer[];
  bullets: Bullet[];
  sparks: Spark[];
  locks: Map<string, number>; // junction key → car id
  rng: number;
  tuning: { range: number; aimTime: number; damage: number; bulletSpeed: number };
}

export interface ActorEvents {
  shotsFired: number;
  bulletDamage: number;
  officerStunned: boolean;
}

const jKey = (p: [number, number]) => `${p[0]},${p[1]}`;
const segOf = (a: [number, number], b: [number, number]) =>
  a[0] < b[0] || a[1] < b[1] ? segKey({ a, b }) : segKey({ a: b, b: a });

function nextRand(s: Actors): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function laneTarget(c: TrafficCar) {
  const ax = roadX(c.a[0]);
  const ay = roadY(c.a[1]);
  const dx = Math.sign(c.b[0] - c.a[0]);
  const dy = Math.sign(c.b[1] - c.a[1]);
  // right-hand traffic: lane is to the right of the heading (screen y points down)
  return { x: ax + dx * c.t - dy * LANE, y: ay + dy * c.t + dx * LANE, angle: Math.atan2(dy, dx) };
}

function neighbours(world: World, p: [number, number]): [number, number][] {
  const out: [number, number][] = [];
  const { blocksX, blocksY } = world.city;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ]) {
    const n: [number, number] = [p[0] + dx, p[1] + dy];
    if (n[0] < 0 || n[1] < 0 || n[0] > blocksX || n[1] > blocksY) continue;
    if (world.closed.has(segOf(p, n))) continue;
    out.push(n);
  }
  return out;
}

function chooseNext(s: Actors, world: World, c: TrafficCar): [number, number] {
  const opts = neighbours(world, c.b).filter((n) => !(n[0] === c.a[0] && n[1] === c.a[1]));
  if (opts.length === 0) return c.a; // dead end: U-turn
  return opts[Math.floor(nextRand(s) * opts.length)];
}

/* ---------- creation ---------- */

export function createActors(world: World): Actors {
  const city = world.city;
  const diff = city.difficulty;
  const s: Actors = {
    traffic: [],
    officers: [],
    bullets: [],
    sparks: [],
    locks: new Map(),
    rng: city.seed * 7919,
    tuning: {
      range: diff === 'Hard' ? 360 : diff === 'Medium' ? 320 : 280,
      aimTime: diff === 'Hard' ? 0.6 : diff === 'Medium' ? 0.75 : 0.95,
      damage: diff === 'Hard' ? 5 : diff === 'Medium' ? 4 : 3,
      bulletSpeed: 720
    }
  };

  // Traffic: spread over open segments, away from the player's start
  const segs: { a: [number, number]; b: [number, number] }[] = [];
  for (let ix = 0; ix <= city.blocksX; ix++)
    for (let iy = 0; iy < city.blocksY; iy++) segs.push({ a: [ix, iy], b: [ix, iy + 1] });
  for (let iy = 0; iy <= city.blocksY; iy++)
    for (let ix = 0; ix < city.blocksX; ix++) segs.push({ a: [ix, iy], b: [ix + 1, iy] });
  const open = segs
    .filter((g) => !world.closed.has(segKey(g)))
    .map((g, k) => ({ g, r: hash(city.seed, k, 301) }))
    .sort((p, q) => p.r - q.r)
    .map((p) => p.g);
  const want = Math.round((city.blocksX + 1) * (city.blocksY + 1) * 0.42);
  let id = 0;
  for (const g of open) {
    if (s.traffic.length >= want) break;
    const flip = hash(g.a[0], g.a[1], 307) < 0.5;
    const a = flip ? g.b : g.a;
    const b = flip ? g.a : g.b;
    const t = STOP - 10 + hash(g.b[0], g.b[1], 311) * (500 - STOP * 2);
    const seed = Math.floor(hash(city.seed, id, 313) * 1e9);
    const body = carBody(seed, city.id, true);
    const [w, len] = BODY_SIZE[body];
    const car: TrafficCar = {
      id: id++,
      a,
      b,
      t: Math.max(CLEAR + 4, Math.min(500 - STOP - 4, t)),
      speed: 0,
      cruise: 120 + hash(seed, 1, 317) * 70,
      x: 0,
      y: 0,
      angle: 0,
      body,
      color: paintFor(body, seed, city.id),
      w,
      len,
      stunned: 0,
      honk: 0,
      holding: null,
      seed
    };
    const p = laneTarget(car);
    if (Math.hypot(p.x - world.start.x, p.y - world.start.y) < 420) {
      id--;
      continue;
    }
    car.x = p.x;
    car.y = p.y;
    car.angle = p.angle;
    car.speed = car.cruise * 0.6;
    s.traffic.push(car);
  }

  // Checkpoint officers: one on each side of every barricade
  let oid = 0;
  for (const bar of world.barricades) {
    const vertical = bar.a[0] === bar.b[0];
    const mx = (roadX(bar.a[0]) + roadX(bar.b[0])) / 2;
    const my = (roadY(bar.a[1]) + roadY(bar.b[1])) / 2;
    for (const side of [-1, 1]) {
      const x = vertical ? mx + side * (HR - 12) : mx + side * 26;
      const y = vertical ? my + side * 26 : my + side * (HR - 12);
      const u = uniformFor(city.seed * 31 + oid, city.id);
      s.officers.push({
        id: oid++,
        x,
        y,
        angle: 0,
        kind: 'checkpoint',
        p0: { x, y },
        p1: { x, y },
        dir: 1,
        aim: 0,
        cooldown: 0.5 + hash(oid, city.seed, 331) * 1.2,
        stunned: 0,
        ...u
      });
    }
  }

  // Foot patrols on sidewalks, away from the start
  const patrols = Math.round(city.checkpoints * 0.7) + 2;
  const blocks = world.blocks
    .filter((b) => b.type === 'lots' || b.type === 'market')
    .map((b, k) => ({ b, r: hash(city.seed, k, 337) }))
    .sort((p, q) => p.r - q.r)
    .map((p) => p.b);
  for (const blk of blocks) {
    if (s.officers.length >= world.barricades.length * 2 + patrols) break;
    const side = Math.floor(hash(blk.i, blk.j, 347) * 4);
    const e = 8;
    const pts = [
      [{ x: blk.x + e, y: blk.y + e }, { x: blk.x + INNER - e, y: blk.y + e }],
      [{ x: blk.x + INNER - e, y: blk.y + e }, { x: blk.x + INNER - e, y: blk.y + INNER - e }],
      [{ x: blk.x + e, y: blk.y + INNER - e }, { x: blk.x + INNER - e, y: blk.y + INNER - e }],
      [{ x: blk.x + e, y: blk.y + e }, { x: blk.x + e, y: blk.y + INNER - e }]
    ][side];
    const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    if (Math.hypot(mid.x - world.start.x, mid.y - world.start.y) < 600) continue;
    const u = uniformFor(city.seed * 31 + oid, city.id);
    s.officers.push({
      id: oid++,
      x: mid.x,
      y: mid.y,
      angle: 0,
      kind: 'patrol',
      p0: pts[0],
      p1: pts[1],
      dir: 1,
      aim: 0,
      cooldown: 1 + hash(oid, city.seed, 353),
      stunned: 0,
      ...u
    });
  }
  return s;
}

/* ---------- line of sight ---------- */

const SOLID_FOR_SIGHT: ObstacleKind[] = ['building', 'edge'];

export function lineBlocked(world: World, x0: number, y0: number, x1: number, y1: number): boolean {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.ceil(d / 20);
  for (let k = 1; k < steps; k++) {
    const x = x0 + ((x1 - x0) * k) / steps;
    const y = y0 + ((y1 - y0) * k) / steps;
    for (const idx of nearby(world, x, y, 0)) {
      const o = world.obstacles[idx];
      if (!SOLID_FOR_SIGHT.includes(o.kind)) continue;
      if (x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h) return true;
    }
  }
  return false;
}

/* ---------- per-frame update ---------- */

export function updateActors(s: Actors, world: World, player: VehicleState, dt: number, armed = true): ActorEvents {
  const ev: ActorEvents = { shotsFired: 0, bulletDamage: 0, officerStunned: false };
  const pvx = Math.cos(player.angle) * player.speed;
  const pvy = Math.sin(player.angle) * player.speed;

  // ---- traffic ----
  for (const c of s.traffic) {
    c.honk = Math.max(0, c.honk - dt);
    if (c.stunned > 0) {
      c.stunned -= dt;
      c.speed = 0;
    } else {
      let target = c.cruise;
      // queue behind the car ahead on the same segment
      for (const o of s.traffic) {
        if (o === c || o.a[0] !== c.a[0] || o.a[1] !== c.a[1] || o.b[0] !== c.b[0] || o.b[1] !== c.b[1]) continue;
        const gap = o.t - c.t - (o.len + c.len) / 2;
        if (gap > 0 && gap < 70) target = Math.min(target, gap < 14 ? 0 : (o.speed * gap) / 70);
      }
      // junction: wait at the stop line unless we hold (or can take) the lock
      const key = jKey(c.b);
      const distToJ = 500 - c.t;
      if (distToJ < STOP + 40 && c.holding !== key) {
        const owner = s.locks.get(key);
        if (owner === undefined && distToJ <= STOP + 4) {
          s.locks.set(key, c.id);
          c.holding = key;
        } else if (owner !== undefined && owner !== c.id) {
          const room = distToJ - STOP;
          target = Math.min(target, room < 4 ? 0 : room * 2.2);
        }
      }
      // brake for the courier if it is ahead of us
      const hx = Math.cos(c.angle);
      const hy = Math.sin(c.angle);
      const rx = player.x - c.x;
      const ry = player.y - c.y;
      const ahead = rx * hx + ry * hy;
      const lateral = Math.abs(-rx * hy + ry * hx);
      if (ahead > 0 && ahead < 90 + c.len / 2 && lateral < 26) target = 0;

      const rate = target < c.speed ? 520 : 160;
      c.speed += Math.sign(target - c.speed) * Math.min(Math.abs(target - c.speed), rate * dt);
    }

    c.t += c.speed * dt;
    // release a junction once we are clear of it on the new segment
    if (c.holding && c.holding !== jKey(c.b) && c.t > CLEAR) {
      if (s.locks.get(c.holding) === c.id) s.locks.delete(c.holding);
      c.holding = null;
    }
    if (c.t >= 500) {
      c.t -= 500;
      const next = chooseNext(s, world, c);
      c.a = c.b;
      c.b = next;
    }
    const p = laneTarget(c);
    const k = Math.min(1, dt * 9);
    c.x += (p.x - c.x) * k;
    c.y += (p.y - c.y) * k;
    let da = p.angle - c.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    c.angle += da * Math.min(1, dt * 7);
  }

  // ---- officers ----
  const { range, aimTime, bulletSpeed } = s.tuning;
  for (const o of s.officers) {
    o.cooldown = Math.max(0, o.cooldown - dt);
    // the courier shoves officers aside on contact (no damage either way)
    const dxp = o.x - player.x;
    const dyp = o.y - player.y;
    const dp = Math.hypot(dxp, dyp);
    if (dp < CAR_RADIUS + CAR_AXLE + 4 && Math.abs(player.speed) > 40 && o.stunned <= 0) {
      const push = (CAR_RADIUS + CAR_AXLE + 10 - dp) / Math.max(dp, 1);
      o.x += dxp * push;
      o.y += dyp * push;
      o.stunned = 2.5;
      o.aim = 0;
      ev.officerStunned = true;
    }
    if (o.stunned > 0) {
      o.stunned -= dt;
      continue;
    }
    const inRange = dp < range && armed && !lineBlocked(world, o.x, o.y, player.x, player.y);
    if (inRange) {
      o.angle = Math.atan2(-dyp, -dxp);
      o.aim = Math.min(1, o.aim + dt / aimTime);
      if (o.aim >= 1 && o.cooldown <= 0) {
        // partial lead: dodgeable if you keep moving
        const tFly = dp / bulletSpeed;
        const tx = player.x + pvx * tFly * 0.55;
        const ty = player.y + pvy * tFly * 0.55;
        const spread = (nextRand(s) - 0.5) * 0.12;
        const ang = Math.atan2(ty - o.y, tx - o.x) + spread;
        const mx = o.x + Math.cos(ang) * 10;
        const my = o.y + Math.sin(ang) * 10;
        s.bullets.push({ x: mx, y: my, px: mx, py: my, vx: Math.cos(ang) * bulletSpeed, vy: Math.sin(ang) * bulletSpeed, life: 0.7 });
        o.cooldown = 1.5 + nextRand(s) * 0.8;
        o.aim = 0.35;
        ev.shotsFired++;
      }
    } else {
      o.aim = Math.max(0, o.aim - dt * 1.5);
      if (o.kind === 'patrol') {
        const tgt = o.dir === 1 ? o.p1 : o.p0;
        const dx = tgt.x - o.x;
        const dy = tgt.y - o.y;
        const d = Math.hypot(dx, dy);
        if (d < 2) o.dir = o.dir === 1 ? -1 : 1;
        else {
          const step = Math.min(d, 38 * dt);
          o.x += (dx / d) * step;
          o.y += (dy / d) * step;
          o.angle = Math.atan2(dy, dx);
        }
      }
    }
  }

  // ---- bullets ----
  const ax = Math.cos(player.angle) * CAR_AXLE;
  const ay = Math.sin(player.angle) * CAR_AXLE;
  s.bullets = s.bullets.filter((b) => {
    b.px = b.x;
    b.py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) return false;
    for (const side of [1, -1]) {
      const cx = player.x + ax * side;
      const cy = player.y + ay * side;
      // closest point on the tracer segment this frame
      const sx = b.x - b.px;
      const sy = b.y - b.py;
      const L = sx * sx + sy * sy || 1;
      const u = Math.max(0, Math.min(1, ((cx - b.px) * sx + (cy - b.py) * sy) / L));
      if (Math.hypot(b.px + sx * u - cx, b.py + sy * u - cy) < CAR_RADIUS + 3) {
        ev.bulletDamage += s.tuning.damage;
        s.sparks.push({ x: cx, y: cy, life: 0.25 });
        return false;
      }
    }
    if (lineBlocked(world, b.px, b.py, b.x, b.y)) {
      s.sparks.push({ x: b.x, y: b.y, life: 0.2 });
      return false;
    }
    return true;
  });
  s.sparks = s.sparks.filter((p) => (p.life -= dt) > 0);
  return ev;
}

/* ---------- courier vs traffic ---------- */

/** Two-circle vs two-circle. Traffic is heavy: the courier takes the push. */
export function collideTraffic(s: Actors, v: VehicleState): CollisionResult {
  let x = v.x;
  let y = v.y;
  let vx = Math.cos(v.angle) * v.speed;
  let vy = Math.sin(v.angle) * v.speed;
  let impact = 0;
  const pax = Math.cos(v.angle) * CAR_AXLE;
  const pay = Math.sin(v.angle) * CAR_AXLE;
  for (const c of s.traffic) {
    if (Math.abs(c.x - x) > 70 || Math.abs(c.y - y) > 70) continue;
    const r = c.w / 2;
    const axle = c.len / 2 - r;
    const hx = Math.cos(c.angle);
    const hy = Math.sin(c.angle);
    const cvx = hx * c.speed;
    const cvy = hy * c.speed;
    let touched = false;
    for (const ps of [1, -1])
      for (const cs of [-1, 0, 1]) {
        const px = x + pax * ps;
        const py = y + pay * ps;
        const qx = c.x + hx * axle * cs;
        const qy = c.y + hy * axle * cs;
        const dx = px - qx;
        const dy = py - qy;
        const d = Math.hypot(dx, dy);
        const min = CAR_RADIUS + r;
        if (d >= min || d < 1e-6) continue;
        const nx = dx / d;
        const ny = dy / d;
        x += nx * (min - d);
        y += ny * (min - d);
        const rel = (vx - cvx) * nx + (vy - cvy) * ny;
        if (rel < 0) {
          vx -= rel * nx * 1.3;
          vy -= rel * ny * 1.3;
          impact = Math.max(impact, -rel);
        }
        touched = true;
      }
    if (touched && impact > 60) {
      c.stunned = Math.max(c.stunned, 1.2);
      c.honk = 1.4;
    }
  }
  if (x === v.x && y === v.y) return { vehicle: v, impact: 0, hit: null };
  const along = vx * Math.cos(v.angle) + vy * Math.sin(v.angle);
  const next: VehicleState = { ...v, x, y, speed: along * (impact > 0 ? 0.9 : 1) };
  next.vx = Math.cos(next.angle) * next.speed;
  next.vy = Math.sin(next.angle) * next.speed;
  return { vehicle: next, impact, hit: impact > 0 ? 'traffic' : null };
}
