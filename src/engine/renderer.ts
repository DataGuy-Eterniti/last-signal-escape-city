import { VehicleState } from '../types';

/* ==========================================================================
   Gold Noir city renderer (visual only — physics is unchanged).

   Layout: a street grid with roads every BLOCK_PITCH world px, centred on
   multiples of the pitch, so the car's start point (1000, 1000) sits on an
   intersection. Each block is generated deterministically from its (i, j)
   index — the same street always looks the same — and rendered once into a
   cached sprite, so a frame only blits ~20 images on integrated GPUs.
   ========================================================================== */

export const BLOCK_PITCH = 500; // distance between road centrelines
export const ROAD_WIDTH = 160; // asphalt width (two lanes each way)
const SIDEWALK = 16;
const BLOCK_INNER = BLOCK_PITCH - ROAD_WIDTH; // 340: sidewalk + lots
const LOT = BLOCK_INNER - SIDEWALK * 2; // 308: buildable area

// Matches the clamp in physics.ts (2000 x 2000 world, 50 px margin)
const WORLD_MIN = 50;
const WORLD_MAX = 1950;

const C = {
  asphalt: '#100a05',
  asphaltSeam: 'rgba(241, 216, 168, 0.025)',
  sidewalk: '#22160b',
  curb: 'rgba(241, 216, 168, 0.20)',
  laneDash: 'rgba(241, 216, 168, 0.30)',
  laneEdge: 'rgba(255, 195, 77, 0.10)',
  zebra: 'rgba(241, 216, 168, 0.16)',
  body: '#1c1209',
  bodyLine: '#ffc34d',
  glass: '#3a2611',
  cargo: '#ffd27a',
  tire: '#0a0603'
};

const ROOFS = ['#2b1c0e', '#24170b', '#311f0f', '#1f1409', '#29190c', '#352312'];

/* ---------- deterministic noise ---------- */

function hash(i: number, j: number, salt = 0): number {
  let h = (i * 374761393 + j * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function makeRng(i: number, j: number) {
  let n = 0;
  return () => hash(i, j, ++n);
}

/* ---------- sprite caches ---------- */

const canMakeCanvas = () => typeof document !== 'undefined';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] | null {
  if (!canMakeCanvas()) return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  return ctx ? [c, ctx] : null;
}

const blockCache = new Map<string, HTMLCanvasElement>();
const BLOCK_CACHE_MAX = 80;

function getBlock(i: number, j: number): HTMLCanvasElement | null {
  const key = `${i},${j}`;
  const hit = blockCache.get(key);
  if (hit) {
    // refresh LRU order
    blockCache.delete(key);
    blockCache.set(key, hit);
    return hit;
  }
  const made = makeCanvas(BLOCK_INNER, BLOCK_INNER);
  if (!made) return null;
  const [canvas, b] = made;
  drawBlock(b, i, j);
  blockCache.set(key, canvas);
  if (blockCache.size > BLOCK_CACHE_MAX) {
    const oldest = blockCache.keys().next().value;
    if (oldest !== undefined) blockCache.delete(oldest);
  }
  return canvas;
}

function drawBlock(b: CanvasRenderingContext2D, i: number, j: number) {
  const rnd = makeRng(i, j);

  // Sidewalk slab + curb
  b.fillStyle = C.sidewalk;
  b.fillRect(0, 0, BLOCK_INNER, BLOCK_INNER);
  b.strokeStyle = C.curb;
  b.lineWidth = 1.5;
  b.strokeRect(0.75, 0.75, BLOCK_INNER - 1.5, BLOCK_INNER - 1.5);
  // paving joints
  b.fillStyle = 'rgba(241, 216, 168, 0.05)';
  for (let p = 24; p < BLOCK_INNER; p += 24) {
    b.fillRect(p, 2, 1, SIDEWALK - 4);
    b.fillRect(p, BLOCK_INNER - SIDEWALK + 2, 1, SIDEWALK - 4);
    b.fillRect(2, p, SIDEWALK - 4, 1);
    b.fillRect(BLOCK_INNER - SIDEWALK + 2, p, SIDEWALK - 4, 1);
  }

  const x0 = SIDEWALK;
  const y0 = SIDEWALK;
  const kind = rnd();

  if (kind < 0.12) {
    drawPark(b, x0, y0, rnd);
    return;
  }
  if (kind < 0.22) {
    drawTower(b, x0, y0, rnd);
    return;
  }

  // Split the lot into 2–4 buildings with alleys
  const gap = 12;
  const lots: [number, number, number, number][] = [];
  const split = rnd();
  if (split < 0.35) {
    const cut = Math.round(LOT * (0.4 + rnd() * 0.2));
    lots.push([x0, y0, cut - gap / 2, LOT], [x0 + cut + gap / 2, y0, LOT - cut - gap / 2, LOT]);
  } else if (split < 0.7) {
    const cutX = Math.round(LOT * (0.42 + rnd() * 0.16));
    const cutY = Math.round(LOT * (0.42 + rnd() * 0.16));
    lots.push(
      [x0, y0, cutX - gap / 2, cutY - gap / 2],
      [x0 + cutX + gap / 2, y0, LOT - cutX - gap / 2, cutY - gap / 2],
      [x0, y0 + cutY + gap / 2, cutX - gap / 2, LOT - cutY - gap / 2],
      [x0 + cutX + gap / 2, y0 + cutY + gap / 2, LOT - cutX - gap / 2, LOT - cutY - gap / 2]
    );
  } else {
    const cut = Math.round(LOT * (0.38 + rnd() * 0.24));
    lots.push(
      [x0, y0, LOT, cut - gap / 2],
      [x0, y0 + cut + gap / 2, Math.round(LOT * 0.55) - gap / 2, LOT - cut - gap / 2],
      [x0 + Math.round(LOT * 0.55) + gap / 2, y0 + cut + gap / 2, LOT - Math.round(LOT * 0.55) - gap / 2, LOT - cut - gap / 2]
    );
  }

  // alley ground
  b.fillStyle = '#160e07';
  b.fillRect(x0, y0, LOT, LOT);

  for (const [lx, ly, lw, lh] of lots) {
    // setbacks so buildings don't all touch the sidewalk
    const inset = 4 + Math.round(rnd() * 10);
    drawBuilding(b, lx + inset, ly + inset, lw - inset * 2, lh - inset * 2, rnd);
  }
}

function drawBuilding(
  b: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rnd: () => number
) {
  if (w < 30 || h < 30) return;
  const height = 6 + rnd() * 14; // fake height → shadow length

  // Cast shadow (light from top-left, like the reference's sun rays)
  b.fillStyle = 'rgba(0, 0, 0, 0.55)';
  b.beginPath();
  b.moveTo(x + w, y);
  b.lineTo(x + w + height, y + height);
  b.lineTo(x + w + height, y + h + height);
  b.lineTo(x + height, y + h + height);
  b.lineTo(x, y + h);
  b.lineTo(x + w, y + h);
  b.closePath();
  b.fill();

  // Roof
  const roof = ROOFS[Math.floor(rnd() * ROOFS.length)];
  b.fillStyle = roof;
  b.fillRect(x, y, w, h);

  // Parapet: lit top-left edge, dark bottom-right edge
  b.fillStyle = 'rgba(255, 220, 150, 0.16)';
  b.fillRect(x, y, w, 2);
  b.fillRect(x, y, 2, h);
  b.fillStyle = 'rgba(0, 0, 0, 0.35)';
  b.fillRect(x, y + h - 2, w, 2);
  b.fillRect(x + w - 2, y, 2, h);

  // Inner roof panel
  const m = 7;
  b.strokeStyle = 'rgba(241, 216, 168, 0.06)';
  b.lineWidth = 1;
  b.strokeRect(x + m + 0.5, y + m + 0.5, w - m * 2 - 1, h - m * 2 - 1);

  // Rooftop units (AC boxes, vents)
  const units = Math.floor(rnd() * 4);
  for (let u = 0; u < units; u++) {
    const uw = 8 + rnd() * 14;
    const uh = 8 + rnd() * 10;
    const ux = x + m + 2 + rnd() * Math.max(1, w - m * 2 - uw - 4);
    const uy = y + m + 2 + rnd() * Math.max(1, h - m * 2 - uh - 4);
    b.fillStyle = 'rgba(0,0,0,0.4)';
    b.fillRect(ux + 2, uy + 2, uw, uh);
    b.fillStyle = '#3b2814';
    b.fillRect(ux, uy, uw, uh);
    b.fillStyle = 'rgba(241, 216, 168, 0.10)';
    b.fillRect(ux, uy, uw, 1);
  }

  // Warm skylights — a few lit windows seen from above
  const cols = Math.max(1, Math.floor((w - m * 2) / 16));
  const rows = Math.max(1, Math.floor((h - m * 2) / 16));
  const litChance = 0.08 + rnd() * 0.14;
  for (let cx = 0; cx < cols; cx++) {
    for (let cy = 0; cy < rows; cy++) {
      if (rnd() > litChance) continue;
      const wx = x + m + 4 + cx * 16;
      const wy = y + m + 4 + cy * 16;
      b.fillStyle = 'rgba(255, 195, 77, 0.18)';
      b.fillRect(wx - 2, wy - 2, 10, 8);
      b.fillStyle = rnd() < 0.5 ? 'rgba(255, 210, 120, 0.75)' : 'rgba(241, 216, 168, 0.55)';
      b.fillRect(wx, wy, 6, 4);
    }
  }
}

function drawTower(b: CanvasRenderingContext2D, x0: number, y0: number, rnd: () => number) {
  // Plaza around a landmark tower
  b.fillStyle = '#1d1309';
  b.fillRect(x0, y0, LOT, LOT);
  b.strokeStyle = 'rgba(241, 216, 168, 0.06)';
  for (let p = 0; p < LOT; p += 22) {
    b.beginPath();
    b.moveTo(x0 + p, y0);
    b.lineTo(x0 + p, y0 + LOT);
    b.stroke();
  }
  const s = Math.round(LOT * (0.52 + rnd() * 0.12));
  const tx = x0 + (LOT - s) / 2;
  const ty = y0 + (LOT - s) / 2;
  const height = 30;
  b.fillStyle = 'rgba(0,0,0,0.6)';
  b.fillRect(tx + height, ty + height, s, s);
  // stepped roof
  b.fillStyle = '#2c1d0e';
  b.fillRect(tx, ty, s, s);
  b.fillStyle = '#382411';
  b.fillRect(tx + 14, ty + 14, s - 28, s - 28);
  b.fillStyle = '#44301a';
  b.fillRect(tx + 30, ty + 30, s - 60, s - 60);
  // gold crown
  b.strokeStyle = 'rgba(255, 195, 77, 0.55)';
  b.lineWidth = 2;
  b.strokeRect(tx + 1, ty + 1, s - 2, s - 2);
  b.strokeStyle = 'rgba(255, 195, 77, 0.25)';
  b.lineWidth = 1;
  b.strokeRect(tx + 14.5, ty + 14.5, s - 29, s - 29);
  // beacon
  const g = b.createRadialGradient(tx + s / 2, ty + s / 2, 0, tx + s / 2, ty + s / 2, 26);
  g.addColorStop(0, 'rgba(255, 220, 140, 0.9)');
  g.addColorStop(1, 'rgba(255, 195, 77, 0)');
  b.fillStyle = g;
  b.fillRect(tx + s / 2 - 26, ty + s / 2 - 26, 52, 52);
}

function drawPark(b: CanvasRenderingContext2D, x0: number, y0: number, rnd: () => number) {
  b.fillStyle = '#1a1407';
  b.fillRect(x0, y0, LOT, LOT);
  // paths
  b.strokeStyle = 'rgba(241, 216, 168, 0.12)';
  b.lineWidth = 6;
  b.beginPath();
  b.moveTo(x0, y0 + LOT / 2);
  b.lineTo(x0 + LOT, y0 + LOT / 2);
  b.moveTo(x0 + LOT / 2, y0);
  b.lineTo(x0 + LOT / 2, y0 + LOT);
  b.stroke();
  // fountain
  b.strokeStyle = 'rgba(255, 195, 77, 0.35)';
  b.lineWidth = 2;
  b.beginPath();
  b.arc(x0 + LOT / 2, y0 + LOT / 2, 22, 0, Math.PI * 2);
  b.stroke();
  b.fillStyle = 'rgba(255, 210, 130, 0.18)';
  b.beginPath();
  b.arc(x0 + LOT / 2, y0 + LOT / 2, 14, 0, Math.PI * 2);
  b.fill();
  // trees (canopies with a lit rim)
  for (let t = 0; t < 22; t++) {
    const tx = x0 + 14 + rnd() * (LOT - 28);
    const ty = y0 + 14 + rnd() * (LOT - 28);
    if (Math.abs(tx - (x0 + LOT / 2)) < 16 || Math.abs(ty - (y0 + LOT / 2)) < 16) continue;
    const r = 9 + rnd() * 9;
    b.fillStyle = 'rgba(0,0,0,0.45)';
    b.beginPath();
    b.arc(tx + 4, ty + 4, r, 0, Math.PI * 2);
    b.fill();
    b.fillStyle = '#2a2410';
    b.beginPath();
    b.arc(tx, ty, r, 0, Math.PI * 2);
    b.fill();
    b.strokeStyle = 'rgba(241, 216, 168, 0.14)';
    b.lineWidth = 1;
    b.beginPath();
    b.arc(tx, ty, r - 1, Math.PI * 1.0, Math.PI * 1.6);
    b.stroke();
  }
}

/* Intersection: crosswalks on all four approaches (one shared sprite) */
let crossing: HTMLCanvasElement | null = null;
const ZEBRA_DEPTH = 22;
function getCrossing(): HTMLCanvasElement | null {
  if (crossing) return crossing;
  const size = ROAD_WIDTH + ZEBRA_DEPTH * 2 + 8;
  const made = makeCanvas(size, size);
  if (!made) return null;
  const [c, x] = made;
  const o = ZEBRA_DEPTH + 4; // where the intersection square begins
  x.fillStyle = C.zebra;
  for (let s = 10; s < ROAD_WIDTH - 10; s += 14) {
    // north & south approaches (stripes run along the road direction)
    x.fillRect(o + s, 2, 7, ZEBRA_DEPTH);
    x.fillRect(o + s, o + ROAD_WIDTH + 2, 7, ZEBRA_DEPTH);
    // west & east approaches
    x.fillRect(2, o + s, ZEBRA_DEPTH, 7);
    x.fillRect(o + ROAD_WIDTH + 2, o + s, ZEBRA_DEPTH, 7);
  }
  crossing = c;
  return c;
}

/* Street-light pool (additive glow sprite) */
let lamp: HTMLCanvasElement | null = null;
const LAMP_R = 110;
function getLamp(): HTMLCanvasElement | null {
  if (lamp) return lamp;
  const made = makeCanvas(LAMP_R * 2, LAMP_R * 2);
  if (!made) return null;
  const [c, x] = made;
  const g = x.createRadialGradient(LAMP_R, LAMP_R, 0, LAMP_R, LAMP_R, LAMP_R);
  g.addColorStop(0, 'rgba(255, 200, 110, 0.20)');
  g.addColorStop(0.45, 'rgba(255, 190, 90, 0.07)');
  g.addColorStop(1, 'rgba(255, 190, 90, 0)');
  x.fillStyle = g;
  x.fillRect(0, 0, LAMP_R * 2, LAMP_R * 2);
  lamp = c;
  return c;
}

/* Vignette + warm light wash (cached per canvas size) */
let overlay: HTMLCanvasElement | null = null;
let overlayKey = '';
function getOverlay(width: number, height: number): HTMLCanvasElement | null {
  const key = `${width}x${height}`;
  if (overlay && overlayKey === key) return overlay;
  const made = makeCanvas(width, height);
  if (!made) return null;
  const [c, o] = made;
  const r = Math.hypot(width, height) / 2;
  const v = o.createRadialGradient(width / 2, height / 2, r * 0.3, width / 2, height / 2, r);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(6,3,1,0.72)');
  o.fillStyle = v;
  o.fillRect(0, 0, width, height);
  const g = o.createLinearGradient(width, 0, width * 0.35, height);
  g.addColorStop(0, 'rgba(255,200,110,0.08)');
  g.addColorStop(0.5, 'rgba(255,200,110,0.015)');
  g.addColorStop(1, 'rgba(255,200,110,0)');
  o.fillStyle = g;
  o.fillRect(0, 0, width, height);
  overlay = c;
  overlayKey = key;
  return c;
}

/* ---------- city pass ---------- */

function drawCity(ctx: CanvasRenderingContext2D, camX: number, camY: number, width: number, height: number) {
  const halfW = width / 2;
  const halfH = height / 2;
  const left = camX - halfW;
  const right = camX + halfW;
  const top = camY - halfH;
  const bottom = camY + halfH;
  const sx = (wx: number) => wx - camX; // world → camera space
  const sy = (wy: number) => wy - camY;
  const P = BLOCK_PITCH;
  const HR = ROAD_WIDTH / 2;

  // Asphalt seams (subtle texture so the road doesn't feel flat)
  ctx.fillStyle = C.asphaltSeam;
  const seam = 64;
  for (let y = Math.floor(top / seam) * seam; y < bottom; y += seam) ctx.fillRect(-halfW, sy(y), width, 1);

  // Blocks
  const i0 = Math.floor((left - HR) / P);
  const i1 = Math.floor((right + HR) / P);
  const j0 = Math.floor((top - HR) / P);
  const j1 = Math.floor((bottom + HR) / P);
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      const bx = i * P + HR;
      const by = j * P + HR;
      if (bx > right || by > bottom || bx + BLOCK_INNER < left || by + BLOCK_INNER < top) continue;
      const sprite = getBlock(i, j);
      if (sprite) ctx.drawImage(sprite, Math.round(sx(bx)), Math.round(sy(by)));
    }
  }

  // Lane paint between intersections
  ctx.strokeStyle = C.laneDash;
  ctx.lineWidth = 2;
  ctx.setLineDash([22, 20]);
  ctx.beginPath();
  for (let k = i0; k <= i1 + 1; k++) {
    const x = sx(k * P);
    if (x < -halfW - 10 || x > halfW + 10) continue;
    for (let j = j0; j <= j1; j++) {
      ctx.moveTo(x, sy(j * P + HR + ZEBRA_DEPTH + 10));
      ctx.lineTo(x, sy((j + 1) * P - HR - ZEBRA_DEPTH - 10));
    }
  }
  for (let k = j0; k <= j1 + 1; k++) {
    const y = sy(k * P);
    if (y < -halfH - 10 || y > halfH + 10) continue;
    for (let i = i0; i <= i1; i++) {
      ctx.moveTo(sx(i * P + HR + ZEBRA_DEPTH + 10), y);
      ctx.lineTo(sx((i + 1) * P - HR - ZEBRA_DEPTH - 10), y);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Faint lane-edge lines (parking lane) along each road
  ctx.fillStyle = C.laneEdge;
  for (let k = i0; k <= i1 + 1; k++) {
    const x = sx(k * P);
    if (x < -halfW - HR || x > halfW + HR) continue;
    ctx.fillRect(x - HR + 14, -halfH, 1, height);
    ctx.fillRect(x + HR - 15, -halfH, 1, height);
  }
  for (let k = j0; k <= j1 + 1; k++) {
    const y = sy(k * P);
    if (y < -halfH - HR || y > halfH + HR) continue;
    ctx.fillRect(-halfW, y - HR + 14, width, 1);
    ctx.fillRect(-halfW, y + HR - 15, width, 1);
  }

  // Intersections: crosswalks + four street-light pools
  const cross = getCrossing();
  const light = getLamp();
  for (let k = i0; k <= i1 + 1; k++) {
    for (let m = j0; m <= j1 + 1; m++) {
      const cx = sx(k * P);
      const cy = sy(m * P);
      if (cx < -halfW - P / 2 || cx > halfW + P / 2 || cy < -halfH - P / 2 || cy > halfH + P / 2) continue;
      // repaint intersection asphalt over the lane-edge lines
      ctx.fillStyle = C.asphalt;
      ctx.fillRect(cx - HR + 1, cy - HR + 1, ROAD_WIDTH - 2, ROAD_WIDTH - 2);
      if (cross) {
        const half = cross.width / 2;
        ctx.drawImage(cross, Math.round(cx - half), Math.round(cy - half));
      }
      if (light) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const lx = cx + dx * (HR + 6);
          const ly = cy + dy * (HR + 6);
          ctx.drawImage(light, Math.round(lx - LAMP_R), Math.round(ly - LAMP_R));
        }
        ctx.restore();
        // lamp heads
        ctx.fillStyle = '#ffe2a0';
        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          ctx.fillRect(Math.round(cx + dx * (HR + 6)) - 2, Math.round(cy + dy * (HR + 6)) - 2, 4, 4);
        }
      }
    }
  }

  // Lockdown barrier at the edge of the playable city (matches the physics clamp)
  drawLockdownEdge(ctx, sx, sy, halfW, halfH);
}

function drawLockdownEdge(
  ctx: CanvasRenderingContext2D,
  sx: (x: number) => number,
  sy: (y: number) => number,
  halfW: number,
  halfH: number
) {
  const a = WORLD_MIN - 30;
  const b = WORLD_MAX + 30;
  const x0 = sx(a);
  const y0 = sy(a);
  const x1 = sx(b);
  const y1 = sy(b);
  // darken outside the barrier
  ctx.fillStyle = 'rgba(5, 3, 1, 0.55)';
  if (x0 > -halfW) ctx.fillRect(-halfW, -halfH, x0 + halfW, halfH * 2);
  if (x1 < halfW) ctx.fillRect(x1, -halfH, halfW - x1, halfH * 2);
  if (y0 > -halfH) ctx.fillRect(Math.max(x0, -halfW), -halfH, Math.min(x1, halfW) - Math.max(x0, -halfW), y0 + halfH);
  if (y1 < halfH) ctx.fillRect(Math.max(x0, -halfW), y1, Math.min(x1, halfW) - Math.max(x0, -halfW), halfH - y1);

  // hazard-striped barrier
  ctx.save();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#2a1a0a';
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.setLineDash([14, 14]);
  ctx.strokeStyle = 'rgba(255, 195, 77, 0.75)';
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.restore();
}

/* ---------- main entry (signature unchanged) ---------- */

export function renderGame(ctx: CanvasRenderingContext2D, width: number, height: number, vehicle: VehicleState) {
  ctx.fillStyle = C.asphalt;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  // Camera transform: keep vehicle centered on screen
  ctx.translate(width / 2, height / 2);

  drawCity(ctx, vehicle.x, vehicle.y, width, height);

  // Courier vehicle (top-down, procedural)
  ctx.rotate(vehicle.angle + Math.PI / 2); // 0 angle points right, car model points up

  const carW = 28;
  const carH = 52;

  // Warm headlight cone
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const beam = ctx.createRadialGradient(0, -carH / 2, 5, 0, -carH / 2 - 120, 110);
  beam.addColorStop(0, 'rgba(255, 226, 160, 0.38)');
  beam.addColorStop(1, 'rgba(255, 226, 160, 0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(-10, -carH / 2);
  ctx.lineTo(-60, -carH / 2 - 160);
  ctx.lineTo(60, -carH / 2 - 160);
  ctx.lineTo(10, -carH / 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Nitro — molten gold / white-hot core
  if (vehicle.nitroActive) {
    ctx.save();
    ctx.fillStyle = '#ffc34d';
    ctx.shadowColor = '#ffb020';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(-8, carH / 2);
    ctx.lineTo(0, carH / 2 + 26 + Math.random() * 12);
    ctx.lineTo(8, carH / 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fff6dc';
    ctx.beginPath();
    ctx.moveTo(-4, carH / 2);
    ctx.lineTo(0, carH / 2 + 15 + Math.random() * 6);
    ctx.lineTo(4, carH / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Soft ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(-carW / 2 - 2, -carH / 2 + 4, carW + 4, carH);

  // Wheels
  ctx.fillStyle = C.tire;
  ctx.fillRect(-carW / 2 - 4, -carH / 2 + 6, 5, 12);
  ctx.fillRect(carW / 2 - 1, -carH / 2 + 6, 5, 12);
  ctx.fillRect(-carW / 2 - 4, carH / 2 - 18, 5, 12);
  ctx.fillRect(carW / 2 - 1, carH / 2 - 18, 5, 12);

  // Body — espresso shell with gold pinstripe
  ctx.fillStyle = C.body;
  ctx.strokeStyle = C.bodyLine;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-carW / 2 + 4, -carH / 2);
  ctx.lineTo(carW / 2 - 4, -carH / 2);
  ctx.lineTo(carW / 2, -carH / 2 + 12);
  ctx.lineTo(carW / 2, carH / 2 - 4);
  ctx.lineTo(carW / 2 - 4, carH / 2);
  ctx.lineTo(-carW / 2 + 4, carH / 2);
  ctx.lineTo(-carW / 2, carH / 2 - 4);
  ctx.lineTo(-carW / 2, -carH / 2 + 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Folded-metal facets (origami echo)
  ctx.fillStyle = 'rgba(255, 195, 77, 0.10)';
  ctx.beginPath();
  ctx.moveTo(-carW / 2 + 4, -carH / 2);
  ctx.lineTo(0, -carH / 2 + 10);
  ctx.lineTo(-carW / 2, -carH / 2 + 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 230, 170, 0.06)';
  ctx.beginPath();
  ctx.moveTo(0, -carH / 2 + 10);
  ctx.lineTo(carW / 2, -carH / 2 + 12);
  ctx.lineTo(carW / 2, carH / 2 - 4);
  ctx.closePath();
  ctx.fill();

  // Windshield
  ctx.fillStyle = C.glass;
  ctx.beginPath();
  ctx.moveTo(-carW / 2 + 5, -carH / 2 + 14);
  ctx.lineTo(carW / 2 - 5, -carH / 2 + 14);
  ctx.lineTo(carW / 2 - 4, -carH / 2 + 28);
  ctx.lineTo(-carW / 2 + 4, -carH / 2 + 28);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(241, 216, 168, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // The mysterious package — glowing gold
  ctx.fillStyle = C.cargo;
  ctx.shadowColor = '#ffc34d';
  ctx.shadowBlur = vehicle.speed > 50 ? 12 : 6;
  ctx.fillRect(-6, carH / 2 - 16, 12, 10);
  ctx.shadowBlur = 0;

  // Tail / brake lights (warm copper → bright on braking)
  ctx.fillStyle = vehicle.isBraking ? '#ff6a2a' : '#5a2a12';
  if (vehicle.isBraking) {
    ctx.shadowColor = '#ff6a2a';
    ctx.shadowBlur = 14;
  }
  ctx.fillRect(-carW / 2 + 2, carH / 2 - 3, 7, 3);
  ctx.fillRect(carW / 2 - 9, carH / 2 - 3, 7, 3);
  ctx.shadowBlur = 0;

  ctx.restore();

  // Cached vignette + light wash
  const ov = getOverlay(width, height);
  if (ov) ctx.drawImage(ov, 0, 0);
}
