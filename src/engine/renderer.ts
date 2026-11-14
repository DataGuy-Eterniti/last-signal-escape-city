import { VehicleState } from '../types';
import { Block, Building, HR, INNER, LOT, OFFSET, PITCH, ROAD, SIDEWALK, World, roadX, roadY } from './world';
import { BODY_SIZE, CarBody } from './palette';
import type { Actors } from './actors';

/* ==========================================================================
   Gold Noir city renderer. Draws ONLY from the World model, so the picture
   always matches the collision shapes.

   Performance budget (Intel UHD 620): everything static is pre-rendered once
   into sprites — city blocks (with rooftop labels), crossings, lamp glows,
   headlight beam, parked cars, text labels. A frame is ~30–50 drawImage calls
   plus a few lines; no per-frame gradients or shadowBlur.
   ========================================================================== */

const C = {
  asphalt: '#100a05',
  seam: 'rgba(241, 216, 168, 0.025)',
  sidewalk: '#22160b',
  curb: 'rgba(241, 216, 168, 0.20)',
  dash: 'rgba(241, 216, 168, 0.30)',
  laneEdge: 'rgba(255, 195, 77, 0.10)',
  zebra: 'rgba(241, 216, 168, 0.16)',
  water: '#0b0f0d',
  label: 'rgba(241, 216, 168, 0.62)',
  roadLabel: 'rgba(241, 216, 168, 0.30)'
};

const SANS = 'Inter, "Segoe UI", Arial, sans-serif';
const SERIF = '"Cormorant Garamond", Georgia, serif';

/* ---------- canvas helpers ---------- */

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext('2d');
  return ctx ? [c, ctx] : null;
}

function tryLetterSpacing(ctx: CanvasRenderingContext2D, px: number) {
  const anyCtx = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ('letterSpacing' in anyCtx) anyCtx.letterSpacing = `${px}px`;
}

/* ---------- text sprite cache ---------- */

const textCache = new Map<string, HTMLCanvasElement>();
function textSprite(text: string, font: string, color: string, spacing = 0): HTMLCanvasElement | null {
  const key = `${font}|${color}|${spacing}|${text}`;
  const hit = textCache.get(key);
  if (hit) return hit;
  const probe = makeCanvas(4, 4);
  if (!probe) return null;
  probe[1].font = font;
  tryLetterSpacing(probe[1], spacing);
  const w = probe[1].measureText(text).width + 8;
  const size = parseInt(font.match(/(\d+)px/)?.[1] ?? '12', 10);
  const made = makeCanvas(w, size * 1.6);
  if (!made) return null;
  const [c, x] = made;
  x.font = font;
  tryLetterSpacing(x, spacing);
  x.fillStyle = color;
  x.textBaseline = 'middle';
  x.fillText(text, 4, c.height / 2);
  if (textCache.size > 400) textCache.clear();
  textCache.set(key, c);
  return c;
}

/* ---------- block sprites (LRU) ---------- */

const blockCache = new Map<string, HTMLCanvasElement>();
const BLOCK_CACHE_MAX = 90;

function getBlockSprite(world: World, block: Block): HTMLCanvasElement | null {
  const key = `${world.city.id}:${block.i},${block.j}`;
  const hit = blockCache.get(key);
  if (hit) {
    blockCache.delete(key);
    blockCache.set(key, hit);
    return hit;
  }
  const made = makeCanvas(INNER, INNER);
  if (!made) return null;
  const [canvas, b] = made;
  drawBlock(b, block);
  blockCache.set(key, canvas);
  if (blockCache.size > BLOCK_CACHE_MAX) {
    const oldest = blockCache.keys().next().value;
    if (oldest !== undefined) blockCache.delete(oldest);
  }
  return canvas;
}

/** Pre-render blocks around a point in idle time so the first seconds of driving never hitch. */
export function prewarm(world: World, x: number, y: number, radius = 2) {
  const ci = Math.floor((x - OFFSET) / PITCH);
  const cj = Math.floor((y - OFFSET) / PITCH);
  const todo: Block[] = [];
  for (let j = cj - radius; j <= cj + radius; j++)
    for (let i = ci - radius; i <= ci + radius; i++) {
      if (i < 0 || j < 0 || i >= world.city.blocksX || j >= world.city.blocksY) continue;
      todo.push(world.blocks[j * world.city.blocksX + i]);
    }
  const idle =
    (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback ??
    ((cb: () => void) => window.setTimeout(cb, 16));
  const step = () => {
    const b = todo.shift();
    if (!b) return;
    getBlockSprite(world, b);
    idle(step);
  };
  idle(step);
}

function hashN(n: number, k: number) {
  let h = (n * 2654435761 + k * 40503) | 0;
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967295;
}

function drawBlock(b: CanvasRenderingContext2D, block: Block) {
  // Sidewalk + curb + paving joints
  b.fillStyle = C.sidewalk;
  b.fillRect(0, 0, INNER, INNER);
  b.strokeStyle = C.curb;
  b.lineWidth = 1.5;
  b.strokeRect(0.75, 0.75, INNER - 1.5, INNER - 1.5);
  b.fillStyle = 'rgba(241, 216, 168, 0.05)';
  for (let p = 24; p < INNER; p += 24) {
    b.fillRect(p, 2, 1, SIDEWALK - 4);
    b.fillRect(p, INNER - SIDEWALK + 2, 1, SIDEWALK - 4);
    b.fillRect(2, p, SIDEWALK - 4, 1);
    b.fillRect(INNER - SIDEWALK + 2, p, SIDEWALK - 4, 1);
  }
  const ox = block.x; // world → sprite offset
  const oy = block.y;
  const lx = SIDEWALK;
  const ly = SIDEWALK;

  if (block.type === 'park') {
    drawPark(b, lx, ly, block);
    return;
  }
  if (block.type === 'plaza') {
    drawPlaza(b, lx, ly);
    return;
  }

  // ground between buildings
  b.fillStyle = block.type === 'market' ? '#1d1308' : '#160e07';
  b.fillRect(lx, ly, LOT, LOT);
  if (block.type === 'tower' || block.type === 'arena') {
    b.strokeStyle = 'rgba(241, 216, 168, 0.06)';
    b.lineWidth = 1;
    for (let p = 0; p < LOT; p += 22) {
      b.beginPath();
      b.moveTo(lx + p, ly);
      b.lineTo(lx + p, ly + LOT);
      b.stroke();
    }
  }
  for (const bd of block.buildings) {
    const local = { ...bd, x: bd.x - ox, y: bd.y - oy };
    if (block.type === 'tower') drawTower(b, local);
    else if (block.type === 'arena') drawArena(b, local);
    else drawBuilding(b, local, block.type === 'market');
  }
}

function drawShadow(b: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, len: number) {
  b.fillStyle = 'rgba(0, 0, 0, 0.55)';
  b.beginPath();
  b.moveTo(x + w, y);
  b.lineTo(x + w + len, y + len);
  b.lineTo(x + w + len, y + h + len);
  b.lineTo(x + len, y + h + len);
  b.lineTo(x, y + h);
  b.lineTo(x + w, y + h);
  b.closePath();
  b.fill();
}

function roofLabel(b: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, h: number, gold = false) {
  let size = gold ? 13 : 9;
  const font = (s: number) => (gold ? `600 ${s}px ${SERIF}` : `600 ${s}px ${SANS}`);
  b.font = font(size);
  tryLetterSpacing(b, gold ? 1.5 : 2);
  while (b.measureText(text).width > w - 14 && size > 7) {
    size -= 1;
    b.font = font(size);
  }
  if (b.measureText(text).width > w - 10 || h < 22) return;
  const tw = b.measureText(text).width;
  const cx = x + w / 2;
  const cy = y + h / 2;
  // plaque behind the label for legibility
  b.fillStyle = 'rgba(12, 7, 3, 0.55)';
  b.fillRect(cx - tw / 2 - 6, cy - size * 0.8, tw + 12, size * 1.6);
  b.strokeStyle = gold ? 'rgba(255, 195, 77, 0.45)' : 'rgba(241, 216, 168, 0.14)';
  b.lineWidth = 1;
  b.strokeRect(cx - tw / 2 - 5.5, cy - size * 0.8 + 0.5, tw + 11, size * 1.6 - 1);
  b.fillStyle = gold ? '#ffc34d' : C.label;
  b.textAlign = 'center';
  b.textBaseline = 'middle';
  b.fillText(text, cx, cy + 0.5);
  b.textAlign = 'left';
}

function drawBuilding(b: CanvasRenderingContext2D, bd: Building, stall = false) {
  const { x, y, w, h } = bd;
  if (w < 24 || h < 20) return;
  const paint = bd.paint;
  drawShadow(b, x, y, w, h, bd.height);
  b.fillStyle = stall ? paint.accent : paint.base;
  b.fillRect(x, y, w, h);
  // lit parapet (top-left) and shaded edge (bottom-right), in the roof's own hue
  b.fillStyle = paint.rim;
  b.globalAlpha = 0.55;
  b.fillRect(x, y, w, 2);
  b.fillRect(x, y, 2, h);
  b.globalAlpha = 1;
  b.fillStyle = 'rgba(0, 0, 0, 0.38)';
  b.fillRect(x, y + h - 2, w, 2);
  b.fillRect(x + w - 2, y, 2, h);

  if (stall) {
    // striped awnings in the stall's own colour
    b.fillStyle = paint.rim;
    b.globalAlpha = 0.35;
    for (let p = 6; p < w - 6; p += 16) b.fillRect(x + p, y + 3, 8, h - 6);
    b.globalAlpha = 1;
    roofLabel(b, bd.label, x, y, w, h);
    return;
  }
  const m = 7;
  b.strokeStyle = 'rgba(241, 216, 168, 0.06)';
  b.lineWidth = 1;
  b.strokeRect(x + m + 0.5, y + m + 0.5, w - m * 2 - 1, h - m * 2 - 1);
  const iw = w - m * 2;
  const ih = h - m * 2;
  switch (paint.style) {
    case 1: {
      // solar array
      b.fillStyle = 'rgba(40, 60, 80, 0.55)';
      for (let px = 0; px + 14 <= iw - 4; px += 16)
        for (let py = 0; py + 9 <= ih * 0.55; py += 11) b.fillRect(x + m + 2 + px, y + m + 2 + py, 14, 9);
      break;
    }
    case 2: {
      // gravel + water tank
      b.fillStyle = 'rgba(255, 240, 210, 0.05)';
      for (let k = 0; k < 60; k++) b.fillRect(x + m + hashN(bd.seed, 200 + k) * iw, y + m + hashN(bd.seed, 300 + k) * ih, 1.5, 1.5);
      const r = Math.min(11, iw / 6, ih / 6);
      const tx = x + m + r + 4 + hashN(bd.seed, 5) * Math.max(1, iw - r * 2 - 8);
      const ty = y + m + r + 4 + hashN(bd.seed, 6) * Math.max(1, ih - r * 2 - 8);
      b.fillStyle = 'rgba(0,0,0,0.45)';
      b.beginPath();
      b.arc(tx + 3, ty + 3, r, 0, Math.PI * 2);
      b.fill();
      b.fillStyle = paint.accent;
      b.beginPath();
      b.arc(tx, ty, r, 0, Math.PI * 2);
      b.fill();
      b.strokeStyle = paint.rim;
      b.stroke();
      break;
    }
    case 3: {
      // ribbed metal
      b.fillStyle = 'rgba(0, 0, 0, 0.18)';
      for (let p = 0; p < iw; p += 6) b.fillRect(x + m + p, y + m, 2, ih);
      break;
    }
    case 4: {
      // roof garden
      b.fillStyle = 'hsl(95, 22%, 16%)';
      b.fillRect(x + m + 4, y + m + 4, Math.max(0, iw * 0.45), Math.max(0, ih - 8));
      b.fillStyle = 'hsl(100, 25%, 22%)';
      for (let k = 0; k < 6; k++) {
        b.beginPath();
        b.arc(x + m + 8 + hashN(bd.seed, 400 + k) * iw * 0.4, y + m + 8 + hashN(bd.seed, 410 + k) * (ih - 16), 3 + hashN(bd.seed, 420 + k) * 3, 0, Math.PI * 2);
        b.fill();
      }
      break;
    }
    default: {
      // rooftop units
      const units = 1 + Math.floor(hashN(bd.seed, 1) * 3);
      for (let u = 0; u < units; u++) {
        const uw = 8 + hashN(bd.seed, 10 + u) * 12;
        const uh = 8 + hashN(bd.seed, 20 + u) * 9;
        const ux = x + m + 2 + hashN(bd.seed, 30 + u) * Math.max(1, iw - uw - 4);
        const uy = y + m + 2 + hashN(bd.seed, 40 + u) * Math.max(1, ih - uh - 4);
        b.fillStyle = 'rgba(0,0,0,0.4)';
        b.fillRect(ux + 2, uy + 2, uw, uh);
        b.fillStyle = paint.accent;
        b.fillRect(ux, uy, uw, uh);
      }
    }
  }
  // warm skylights (density varies per building)
  const cols = Math.max(1, Math.floor(iw / 16));
  const rows = Math.max(1, Math.floor(ih / 16));
  const lit = 0.05 + hashN(bd.seed, 2) * 0.16;
  let n = 0;
  for (let cx = 0; cx < cols; cx++)
    for (let cy = 0; cy < rows; cy++) {
      if (hashN(bd.seed, 100 + n++) > lit) continue;
      const wx = x + m + 4 + cx * 16;
      const wy = y + m + 4 + cy * 16;
      b.fillStyle = 'rgba(255, 195, 77, 0.18)';
      b.fillRect(wx - 2, wy - 2, 10, 8);
      b.fillStyle = 'rgba(255, 210, 120, 0.72)';
      b.fillRect(wx, wy, 6, 4);
    }
  roofLabel(b, bd.label, x, y, w, h);
}

function drawTower(b: CanvasRenderingContext2D, bd: Building) {
  const { x, y, w, h } = bd;
  b.fillStyle = 'rgba(0,0,0,0.6)';
  b.fillRect(x + bd.height, y + bd.height, w, h);
  b.fillStyle = '#2c1d0e';
  b.fillRect(x, y, w, h);
  b.fillStyle = '#382411';
  b.fillRect(x + 14, y + 14, w - 28, h - 28);
  b.fillStyle = '#44301a';
  b.fillRect(x + 30, y + 30, w - 60, h - 60);
  b.strokeStyle = 'rgba(255, 195, 77, 0.55)';
  b.lineWidth = 2;
  b.strokeRect(x + 1, y + 1, w - 2, h - 2);
  const g = b.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, 30);
  g.addColorStop(0, 'rgba(255, 220, 140, 0.55)');
  g.addColorStop(1, 'rgba(255, 195, 77, 0)');
  b.fillStyle = g;
  b.fillRect(x + w / 2 - 30, y + h / 2 - 30, 60, 60);
  roofLabel(b, bd.label, x, y + h - 30, w, 26, true);
}

function drawArena(b: CanvasRenderingContext2D, bd: Building) {
  const { x, y, w, h } = bd;
  drawShadow(b, x, y, w, h, bd.height);
  b.fillStyle = '#2f1f10';
  b.fillRect(x, y, w, h);
  // ribbed roof
  b.strokeStyle = 'rgba(255, 195, 77, 0.16)';
  b.lineWidth = 1;
  for (let p = 10; p < w; p += 12) {
    b.beginPath();
    b.moveTo(x + p, y + 4);
    b.lineTo(x + p, y + h - 4);
    b.stroke();
  }
  b.strokeStyle = 'rgba(255, 195, 77, 0.5)';
  b.lineWidth = 2;
  b.strokeRect(x + 1, y + 1, w - 2, h - 2);
  roofLabel(b, bd.label, x, y, w, h, true);
}

function drawPark(b: CanvasRenderingContext2D, x0: number, y0: number, block: Block) {
  b.fillStyle = '#1a1407';
  b.fillRect(x0, y0, LOT, LOT);
  b.strokeStyle = 'rgba(241, 216, 168, 0.12)';
  b.lineWidth = 6;
  b.beginPath();
  b.moveTo(x0, y0 + LOT / 2);
  b.lineTo(x0 + LOT, y0 + LOT / 2);
  b.moveTo(x0 + LOT / 2, y0);
  b.lineTo(x0 + LOT / 2, y0 + LOT);
  b.stroke();
  drawFountain(b, x0 + LOT / 2, y0 + LOT / 2);
  const seed = block.i * 97 + block.j * 31;
  for (let t = 0; t < 24; t++) {
    const tx = x0 + 14 + hashN(seed, t * 3) * (LOT - 28);
    const ty = y0 + 14 + hashN(seed, t * 3 + 1) * (LOT - 28);
    if (Math.abs(tx - (x0 + LOT / 2)) < 18 || Math.abs(ty - (y0 + LOT / 2)) < 18) continue;
    const r = 9 + hashN(seed, t * 3 + 2) * 9;
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
    b.arc(tx, ty, r - 1, Math.PI, Math.PI * 1.6);
    b.stroke();
  }
}

function drawPlaza(b: CanvasRenderingContext2D, x0: number, y0: number) {
  b.fillStyle = '#2a1c0e';
  b.fillRect(x0, y0, LOT, LOT);
  b.strokeStyle = 'rgba(255, 195, 77, 0.08)';
  b.lineWidth = 1;
  for (let p = 0; p <= LOT; p += 28) {
    b.beginPath();
    b.moveTo(x0 + p, y0);
    b.lineTo(x0 + p, y0 + LOT);
    b.moveTo(x0, y0 + p);
    b.lineTo(x0 + LOT, y0 + p);
    b.stroke();
  }
  // billboards glow along the edges (Times-Square energy, in gold)
  b.fillStyle = 'rgba(255, 195, 77, 0.22)';
  b.fillRect(x0 + 10, y0 + 6, LOT - 20, 6);
  b.fillRect(x0 + 10, y0 + LOT - 12, LOT - 20, 6);
  drawFountain(b, x0 + LOT / 2, y0 + LOT / 2);
}

function drawFountain(b: CanvasRenderingContext2D, cx: number, cy: number) {
  b.fillStyle = 'rgba(0,0,0,0.4)';
  b.fillRect(cx - 14, cy - 14, 32, 32);
  b.fillStyle = '#3a2814';
  b.fillRect(cx - 16, cy - 16, 32, 32);
  b.strokeStyle = 'rgba(255, 195, 77, 0.45)';
  b.lineWidth = 2;
  b.strokeRect(cx - 15, cy - 15, 30, 30);
  b.fillStyle = 'rgba(255, 210, 130, 0.35)';
  b.fillRect(cx - 7, cy - 7, 14, 14);
}

/* ---------- shared sprites ---------- */

let crossing: HTMLCanvasElement | null = null;
const ZEBRA = 22;
function getCrossing(): HTMLCanvasElement | null {
  if (crossing) return crossing;
  const size = ROAD + ZEBRA * 2 + 8;
  const made = makeCanvas(size, size);
  if (!made) return null;
  const [c, x] = made;
  const o = ZEBRA + 4;
  x.fillStyle = C.asphalt;
  x.fillRect(o + 1, o + 1, ROAD - 2, ROAD - 2); // clean intersection square
  x.fillStyle = C.zebra;
  for (let s = 10; s < ROAD - 10; s += 14) {
    x.fillRect(o + s, 2, 7, ZEBRA);
    x.fillRect(o + s, o + ROAD + 2, 7, ZEBRA);
    x.fillRect(2, o + s, ZEBRA, 7);
    x.fillRect(o + ROAD + 2, o + s, ZEBRA, 7);
  }
  crossing = c;
  return c;
}

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

const glowCache = new Map<string, HTMLCanvasElement>();
function getGlow(color: string, r: number): HTMLCanvasElement | null {
  const key = `${color}|${r}`;
  const hit = glowCache.get(key);
  if (hit) return hit;
  const made = makeCanvas(r * 2, r * 2);
  if (!made) return null;
  const [c, x] = made;
  const g = x.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, r * 2, r * 2);
  glowCache.set(key, c);
  return c;
}

let beam: HTMLCanvasElement | null = null;
function getBeam(): HTMLCanvasElement | null {
  if (beam) return beam;
  const made = makeCanvas(140, 180);
  if (!made) return null;
  const [c, x] = made;
  const g = x.createRadialGradient(70, 180, 4, 70, 60, 120);
  g.addColorStop(0, 'rgba(255, 226, 160, 0.40)');
  g.addColorStop(1, 'rgba(255, 226, 160, 0)');
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(60, 180);
  x.lineTo(8, 10);
  x.lineTo(132, 10);
  x.lineTo(80, 180);
  x.closePath();
  x.fill();
  beam = c;
  return c;
}

const carSprites = new Map<string, HTMLCanvasElement>();
/** One sprite per body + paint (front of the car points up). */
function getCarSprite(body: CarBody, color: string, lagos = false): HTMLCanvasElement | null {
  const key = `${body}|${color}|${lagos ? 1 : 0}`;
  const hit = carSprites.get(key);
  if (hit) return hit;
  const [w, l] = BODY_SIZE[body];
  const made = makeCanvas(w + 8, l + 8);
  if (!made) return null;
  const [c, x] = made;
  const o = 3;
  x.fillStyle = 'rgba(0,0,0,0.45)';
  x.fillRect(o + 3, o + 4, w, l);
  // body
  x.fillStyle = color;
  const r = body === 'bus' || body === 'van' ? 3 : 5;
  x.beginPath();
  x.moveTo(o + r, o);
  x.lineTo(o + w - r, o);
  x.quadraticCurveTo(o + w, o, o + w, o + r);
  x.lineTo(o + w, o + l - r);
  x.quadraticCurveTo(o + w, o + l, o + w - r, o + l);
  x.lineTo(o + r, o + l);
  x.quadraticCurveTo(o, o + l, o, o + l - r);
  x.lineTo(o, o + r);
  x.quadraticCurveTo(o, o, o + r, o);
  x.fill();
  // glass + roof
  const glass = '#0d0907';
  if (body === 'bus') {
    x.fillStyle = glass;
    x.fillRect(o + 3, o + 4, w - 6, 6);
    for (let k = 14; k < l - 6; k += 9) {
      x.fillRect(o + 1, o + k, 3, 6);
      x.fillRect(o + w - 4, o + k, 3, 6);
    }
    if (lagos) {
      x.fillStyle = 'rgba(10, 8, 5, 0.85)';
      x.fillRect(o, o + l * 0.4, w, 3);
      x.fillRect(o, o + l * 0.6, w, 3);
    }
    x.fillStyle = 'rgba(0,0,0,0.12)';
    x.fillRect(o + 5, o + 14, w - 10, l - 22);
  } else {
    const front = body === 'van' ? 5 : body === 'hatch' ? 8 : 9;
    const rear = body === 'hatch' ? l - 7 : body === 'van' ? l - 5 : l - 10;
    x.fillStyle = glass;
    x.fillRect(o + 3, o + front, w - 6, 7);
    x.fillRect(o + 3, o + rear - 5, w - 6, 5);
    x.fillStyle = 'rgba(0,0,0,0.18)';
    x.fillRect(o + 3, o + front + 8, w - 6, rear - front - 14);
    if (body === 'suv') {
      x.fillStyle = 'rgba(255, 240, 210, 0.18)';
      x.fillRect(o + 4, o + front + 9, 1.5, rear - front - 16);
      x.fillRect(o + w - 5.5, o + front + 9, 1.5, rear - front - 16);
    }
    if (body === 'taxi') {
      x.fillStyle = '#fff2c4';
      x.fillRect(o + w / 2 - 5, o + l / 2 - 3, 10, 5);
      x.fillStyle = 'rgba(10,8,5,0.6)';
      x.fillRect(o, o + l / 2 + 6, w, 2);
    }
  }
  // sheen
  x.fillStyle = 'rgba(255, 245, 225, 0.16)';
  x.fillRect(o + 2, o + 1, w - 4, 1.5);
  // headlights / tail lights (unlit)
  x.fillStyle = 'rgba(255, 236, 190, 0.7)';
  x.fillRect(o + 2, o + 1, 4, 2);
  x.fillRect(o + w - 6, o + 1, 4, 2);
  x.fillStyle = '#6a1f12';
  x.fillRect(o + 2, o + l - 2, 4, 2);
  x.fillRect(o + w - 6, o + l - 2, 4, 2);
  // sink it into the night
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = 'rgba(14, 8, 3, 0.26)';
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'source-over';
  if (carSprites.size > 600) carSprites.clear();
  carSprites.set(key, c);
  return c;
}

/* ---------- thumbnails (city select + minimap) ---------- */

const thumbCache = new Map<string, HTMLCanvasElement>();
export function cityThumbnail(world: World, size: number): HTMLCanvasElement | null {
  const key = `${world.city.id}:${size}`;
  const hit = thumbCache.get(key);
  if (hit) return hit;
  const scale = size / Math.max(world.width, world.height);
  const made = makeCanvas(world.width * scale, world.height * scale);
  if (!made) return null;
  const [c, t] = made;
  t.fillStyle = '#0d0804';
  t.fillRect(0, 0, c.width, c.height);
  // water edges
  t.fillStyle = '#132022';
  const edge = (OFFSET - HR - 24) * scale;
  for (const w of world.city.water) {
    if (w.edge === 'west') t.fillRect(0, 0, edge, c.height);
    if (w.edge === 'east') t.fillRect(c.width - edge, 0, edge, c.height);
    if (w.edge === 'north') t.fillRect(0, 0, c.width, edge);
    if (w.edge === 'south') t.fillRect(0, c.height - edge, c.width, edge);
  }
  // roads
  t.fillStyle = 'rgba(241, 216, 168, 0.22)';
  for (let i = 0; i <= world.city.blocksX; i++) t.fillRect((roadX(i) - HR) * scale, (OFFSET - HR) * scale, ROAD * scale, (world.height - 2 * OFFSET + ROAD) * scale);
  for (let j = 0; j <= world.city.blocksY; j++) t.fillRect((OFFSET - HR) * scale, (roadY(j) - HR) * scale, (world.width - 2 * OFFSET + ROAD) * scale, ROAD * scale);
  // blocks
  for (const b of world.blocks) {
    t.fillStyle = b.type === 'park' ? '#3a3414' : b.type === 'lots' ? '#2a1b0e' : '#6a4518';
    t.fillRect(b.x * scale, b.y * scale, INNER * scale, INNER * scale);
  }
  // barricades
  t.fillStyle = '#c2622d';
  for (const bar of world.barricades) {
    const mx = (roadX(bar.a[0]) + roadX(bar.b[0])) / 2;
    const my = (roadY(bar.a[1]) + roadY(bar.b[1])) / 2;
    t.fillRect(mx * scale - 2, my * scale - 2, 4, 4);
  }
  // extraction
  t.fillStyle = '#ffc34d';
  t.beginPath();
  t.arc(world.extraction.x * scale, world.extraction.y * scale, Math.max(3, size / 45), 0, Math.PI * 2);
  t.fill();
  thumbCache.set(key, c);
  return c;
}

/* ---------- vignette ---------- */

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
  g.addColorStop(1, 'rgba(255,200,110,0)');
  o.fillStyle = g;
  o.fillRect(0, 0, width, height);
  overlay = c;
  overlayKey = key;
  return c;
}

/* ---------- city pass ---------- */

function drawActors(ctx: CanvasRenderingContext2D, world: World, a: Actors, camX: number, camY: number, halfW: number, halfH: number, time: number) {
  const sx = (x: number) => Math.round(x - camX);
  const sy = (y: number) => Math.round(y - camY);
  const vis = (x: number, y: number, m = 60) => Math.abs(x - camX) < halfW + m && Math.abs(y - camY) < halfH + m;
  const lagos = world.city.id === 'lagos';

  // traffic
  const head = getGlow('rgba(255, 230, 170, 0.35)', 22);
  const tail = getGlow('rgba(255, 70, 40, 0.5)', 10);
  for (const c of a.traffic) {
    if (!vis(c.x, c.y)) continue;
    const spr = getCarSprite(c.body, c.color, lagos);
    if (!spr) continue;
    ctx.save();
    ctx.translate(sx(c.x), sy(c.y));
    ctx.rotate(c.angle + Math.PI / 2);
    ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
    ctx.globalCompositeOperation = 'lighter';
    if (head) {
      ctx.drawImage(head, -c.w / 2 - 14, -c.len / 2 - 30);
      ctx.drawImage(head, c.w / 2 - 30, -c.len / 2 - 30);
    }
    if (tail && (c.speed < c.cruise * 0.5 || c.stunned > 0)) {
      ctx.drawImage(tail, -c.w / 2 - 6, c.len / 2 - 10);
      ctx.drawImage(tail, c.w / 2 - 14, c.len / 2 - 10);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    if (c.honk > 0 && Math.sin(time * 20) > 0) {
      const t = textSprite('HONK', `700 9px ${SANS}`, 'rgba(241, 216, 168, 0.8)', 2);
      if (t) ctx.drawImage(t, sx(c.x) - t.width / 2, sy(c.y) - c.len / 2 - 22);
    }
  }

  // aim lasers (fade in while the officer lines up the shot)
  for (const o of a.officers) {
    if (o.stunned > 0 || o.aim <= 0.05 || !vis(o.x, o.y, 400)) continue;
    ctx.strokeStyle = `rgba(255, 70, 40, ${0.12 + o.aim * 0.4})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx(o.x), sy(o.y));
    ctx.lineTo(sx(o.x + Math.cos(o.angle) * 260), sy(o.y + Math.sin(o.angle) * 260));
    ctx.stroke();
  }

  // officers (top-down: shoulders, vest, head, rifle), each in a faint light pool so they read at night
  const pool = getGlow('rgba(255, 220, 160, 0.22)', 22);
  for (const o of a.officers) {
    if (!vis(o.x, o.y)) continue;
    if (pool) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(pool, sx(o.x) - 22, sy(o.y) - 22);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.save();
    ctx.translate(sx(o.x), sy(o.y));
    ctx.scale(1.5, 1.5);
    if (o.stunned > 0) {
      // knocked down: lying flat, dimmed, with a ring
      ctx.globalAlpha = 0.7;
      ctx.rotate(o.angle + Math.PI / 2);
      ctx.fillStyle = o.uniform;
      ctx.fillRect(-5, -10, 10, 20);
      ctx.fillStyle = o.skin;
      ctx.beginPath();
      ctx.arc(0, -12, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(241, 216, 168, 0.5)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(0, 0, 14, time * 4, time * 4 + Math.PI * 1.5);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      continue;
    }
    ctx.rotate(o.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(2, 2, 7, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // rifle pointing forward
    ctx.fillStyle = '#0a0806';
    ctx.fillRect(2, 2, 16, 2.5);
    ctx.fillStyle = o.uniform;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = o.vest;
    ctx.fillRect(-4, -5, 7, 10);
    ctx.fillStyle = o.skin;
    ctx.beginPath();
    ctx.arc(1, 0, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(10, 10, 14, 0.9)'; // cap
    ctx.beginPath();
    ctx.arc(0.5, 0, 3.2, Math.PI * 0.5, Math.PI * 1.5);
    ctx.fill();
    ctx.restore();
    if (o.kind === 'checkpoint') {
      ctx.fillStyle = 'rgba(120, 170, 255, 0.85)';
      if (Math.sin(time * 6 + o.id) > 0) ctx.fillRect(sx(o.x) - 1.5, sy(o.y) - 21, 4, 4);
    }
  }

  // tracers
  if (a.bullets.length) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const b of a.bullets) {
      ctx.strokeStyle = 'rgba(255, 150, 60, 0.35)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sx(b.px - b.vx * 0.02), sy(b.py - b.vy * 0.02));
      ctx.lineTo(sx(b.x), sy(b.y));
      ctx.stroke();
      ctx.strokeStyle = '#ffe2a0';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    ctx.globalCompositeOperation = 'source-over';
  }
  const spark = getGlow('rgba(255, 200, 110, 0.8)', 14);
  if (spark && a.sparks.length) {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of a.sparks) ctx.drawImage(spark, sx(p.x) - 14, sy(p.y) - 14);
    ctx.globalCompositeOperation = 'source-over';
  }
}

function drawCity(ctx: CanvasRenderingContext2D, world: World, camX: number, camY: number, w: number, h: number, time: number, actors?: Actors) {
  const halfW = w / 2;
  const halfH = h / 2;
  const left = camX - halfW;
  const right = camX + halfW;
  const top = camY - halfH;
  const bottom = camY + halfH;
  const sx = (x: number) => Math.round(x - camX);
  const sy = (y: number) => Math.round(y - camY);
  const { blocksX, blocksY } = world.city;

  // water beyond the lockdown line
  const edge = OFFSET - HR - 28;
  ctx.fillStyle = C.water;
  for (const wtr of world.city.water) {
    if (wtr.edge === 'west' && left < edge) ctx.fillRect(-halfW, -halfH, sx(edge) + halfW, h);
    if (wtr.edge === 'east' && right > world.width - edge) ctx.fillRect(sx(world.width - edge), -halfH, w, h);
    if (wtr.edge === 'north' && top < edge) ctx.fillRect(-halfW, -halfH, w, sy(edge) + halfH);
    if (wtr.edge === 'south' && bottom > world.height - edge) ctx.fillRect(-halfW, sy(world.height - edge), w, h);
  }

  // asphalt seams
  ctx.fillStyle = C.seam;
  for (let y = Math.floor(top / 64) * 64; y < bottom; y += 64) ctx.fillRect(-halfW, sy(y), w, 1);

  // blocks
  const i0 = Math.max(0, Math.floor((left - OFFSET - HR) / PITCH));
  const i1 = Math.min(blocksX - 1, Math.floor((right - OFFSET + HR) / PITCH));
  const j0 = Math.max(0, Math.floor((top - OFFSET - HR) / PITCH));
  const j1 = Math.min(blocksY - 1, Math.floor((bottom - OFFSET + HR) / PITCH));
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const block = world.blocks[j * blocksX + i];
      if (block.x > right || block.y > bottom || block.x + INNER < left || block.y + INNER < top) continue;
      const sprite = getBlockSprite(world, block);
      if (sprite) ctx.drawImage(sprite, sx(block.x), sy(block.y));
    }

  const ri0 = Math.max(0, i0);
  const ri1 = Math.min(blocksX, i1 + 1);
  const rj0 = Math.max(0, j0);
  const rj1 = Math.min(blocksY, j1 + 1);

  // lane paint between intersections
  ctx.strokeStyle = C.dash;
  ctx.lineWidth = 2;
  ctx.setLineDash([22, 20]);
  ctx.beginPath();
  for (let k = ri0; k <= ri1; k++) {
    const x = sx(roadX(k));
    for (let j = rj0; j < rj1; j++) {
      ctx.moveTo(x, sy(roadY(j) + HR + ZEBRA + 10));
      ctx.lineTo(x, sy(roadY(j + 1) - HR - ZEBRA - 10));
    }
  }
  for (let k = rj0; k <= rj1; k++) {
    const y = sy(roadY(k));
    for (let i = ri0; i < ri1; i++) {
      ctx.moveTo(sx(roadX(i) + HR + ZEBRA + 10), y);
      ctx.lineTo(sx(roadX(i + 1) - HR - ZEBRA - 10), y);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // parking-lane edge lines
  ctx.fillStyle = C.laneEdge;
  const roadTop = roadY(0) - HR;
  const roadBottom = roadY(blocksY) + HR;
  const roadLeft = roadX(0) - HR;
  const roadRight = roadX(blocksX) + HR;
  for (let k = ri0; k <= ri1; k++) {
    const x = roadX(k);
    ctx.fillRect(sx(x - HR + 14), sy(roadTop), 1, roadBottom - roadTop);
    ctx.fillRect(sx(x + HR - 15), sy(roadTop), 1, roadBottom - roadTop);
  }
  for (let k = rj0; k <= rj1; k++) {
    const y = roadY(k);
    ctx.fillRect(sx(roadLeft), sy(y - HR + 14), roadRight - roadLeft, 1);
    ctx.fillRect(sx(roadLeft), sy(y + HR - 15), roadRight - roadLeft, 1);
  }

  // intersections
  const cross = getCrossing();
  const light = getLamp();
  ctx.save();
  for (let k = ri0; k <= ri1; k++)
    for (let m = rj0; m <= rj1; m++) {
      const cx = roadX(k);
      const cy = roadY(m);
      if (cross) ctx.drawImage(cross, sx(cx) - cross.width / 2, sy(cy) - cross.height / 2);
    }
  if (light) {
    ctx.globalCompositeOperation = 'lighter';
    for (let k = ri0; k <= ri1; k++)
      for (let m = rj0; m <= rj1; m++)
        for (const [dx, dy] of CORNERS) ctx.drawImage(light, sx(roadX(k) + dx * (HR + 6)) - LAMP_R, sy(roadY(m) + dy * (HR + 6)) - LAMP_R);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.fillStyle = '#ffe2a0';
  for (let k = ri0; k <= ri1; k++)
    for (let m = rj0; m <= rj1; m++)
      for (const [dx, dy] of CORNERS) ctx.fillRect(sx(roadX(k) + dx * (HR + 6)) - 2, sy(roadY(m) + dy * (HR + 6)) - 2, 4, 4);
  ctx.restore();

  // street names (one per visible segment, beside the centre line)
  for (let k = ri0; k <= ri1; k++) {
    const name = world.city.vRoads[k];
    const spr = name ? textSprite(name.toUpperCase(), `600 10px ${SANS}`, C.roadLabel, 2.5) : null;
    if (!spr) continue;
    for (let j = rj0; j < rj1; j++) {
      const my = (roadY(j) + roadY(j + 1)) / 2;
      if (my < top - 200 || my > bottom + 200) continue;
      ctx.save();
      ctx.translate(sx(roadX(k)) + 18, sy(my));
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
      ctx.restore();
    }
  }
  for (let m = rj0; m <= rj1; m++) {
    const name = world.city.hRoads[m];
    const spr = name ? textSprite(name.toUpperCase(), `600 10px ${SANS}`, C.roadLabel, 2.5) : null;
    if (!spr) continue;
    for (let i = ri0; i < ri1; i++) {
      const mx = (roadX(i) + roadX(i + 1)) / 2;
      if (mx < left - 200 || mx > right + 200) continue;
      ctx.drawImage(spr, sx(mx) - spr.width / 2, sy(roadY(m)) + 8);
    }
  }

  // parked cars
  for (const car of world.parkedCars) {
    if (car.x > right || car.y > bottom || car.x + car.w < left || car.y + car.h < top) continue;
    const spr = getCarSprite(car.body, car.color, world.city.id === 'lagos');
    if (!spr) continue;
    const flip = car.seed % 2 === 0 ? 0 : Math.PI;
    ctx.save();
    ctx.translate(sx(car.x + car.w / 2), sy(car.y + car.h / 2));
    ctx.rotate((car.angle === 0 ? 0 : Math.PI / 2) + flip);
    ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
    ctx.restore();
  }

  // police barricades + cones
  for (const bar of world.barricades) {
    for (const r of bar.rects) {
      if (r.x > right || r.y > bottom || r.x + r.w < left || r.y + r.h < top) continue;
      ctx.fillStyle = '#d8c7a4';
      ctx.fillRect(sx(r.x), sy(r.y), r.w, r.h);
      ctx.fillStyle = '#c2622d';
      const stripes = Math.max(r.w, r.h) / 10;
      for (let s = 0; s < stripes; s += 2) {
        if (r.w > r.h) ctx.fillRect(sx(r.x) + s * 10, sy(r.y), 10, r.h);
        else ctx.fillRect(sx(r.x), sy(r.y) + s * 10, r.w, 10);
      }
    }
  }
  const blink = Math.sin(time * 6) > 0;
  for (const c of world.cones) {
    if (c.x > right || c.y > bottom || c.x + c.w < left || c.y + c.h < top) continue;
    ctx.fillStyle = '#e07a35';
    ctx.beginPath();
    ctx.moveTo(sx(c.x + c.w / 2), sy(c.y));
    ctx.lineTo(sx(c.x + c.w), sy(c.y + c.h));
    ctx.lineTo(sx(c.x), sy(c.y + c.h));
    ctx.closePath();
    ctx.fill();
  }
  // flashing beacons on each barricade
  const beacon = getGlow('rgba(255, 120, 60, 0.55)', 26);
  if (beacon && blink) {
    ctx.globalCompositeOperation = 'lighter';
    for (const bar of world.barricades) {
      const r = bar.rects[1];
      if (r.x > right + 30 || r.y > bottom + 30 || r.x + r.w < left - 30 || r.y + r.h < top - 30) continue;
      ctx.drawImage(beacon, sx(r.x + r.w / 2) - 26, sy(r.y + r.h / 2) - 26);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  if (actors) drawActors(ctx, world, actors, camX, camY, halfW, halfH, time);

  // extraction beacon (pulsing gold ring)
  const ex = world.extraction;
  if (Math.abs(ex.x - camX) < halfW + 200 && Math.abs(ex.y - camY) < halfH + 200) {
    const pulse = (time * 0.8) % 1;
    const glow = getGlow('rgba(255, 210, 120, 0.55)', 90);
    if (glow) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(glow, sx(ex.x) - 90, sy(ex.y) - 90);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.strokeStyle = `rgba(255, 195, 77, ${0.9 - pulse * 0.9})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx(ex.x), sy(ex.y), 30 + pulse * 50, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffc34d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx(ex.x), sy(ex.y), 26, 0, Math.PI * 2);
    ctx.stroke();
    const t = textSprite(`EXTRACTION · ${ex.name.toUpperCase()}`, `600 11px ${SANS}`, '#ffc34d', 2.5);
    if (t) ctx.drawImage(t, sx(ex.x) - t.width / 2, sy(ex.y) - 54);
  }

  // landmark names (serif, centred on the footprint)
  for (const l of world.landmarkLabels) {
    if (Math.abs(l.x - camX) > halfW + 300 || Math.abs(l.y - camY) > halfH + 300) continue;
    if (l.kind === 'tower' || l.kind === 'arena') continue; // already on the roof
    const t = textSprite(l.name, `italic 500 22px ${SERIF}`, 'rgba(255, 210, 130, 0.85)', 0.5);
    if (t) ctx.drawImage(t, sx(l.x) - t.width / 2, sy(l.y) - 60);
  }

  // water names
  for (const wtr of world.city.water) {
    const t = textSprite(wtr.name, `italic 500 26px ${SERIF}`, 'rgba(160, 190, 185, 0.35)', 1);
    if (!t) continue;
    let x = camX;
    let y = camY;
    if (wtr.edge === 'west') x = edge / 2 - 40;
    if (wtr.edge === 'east') x = world.width - edge / 2 + 40;
    if (wtr.edge === 'north') y = edge / 2 - 40;
    if (wtr.edge === 'south') y = world.height - edge / 2 + 40;
    if (Math.abs(x - camX) > halfW + 200 || Math.abs(y - camY) > halfH + 200) continue;
    ctx.save();
    ctx.translate(sx(x), sy(y));
    if (wtr.edge === 'west' || wtr.edge === 'east') ctx.rotate(-Math.PI / 2);
    ctx.drawImage(t, -t.width / 2, -t.height / 2);
    ctx.restore();
  }

  // lockdown barrier (darken beyond it)
  const a = OFFSET - HR - 28;
  const x0 = sx(a);
  const y0 = sy(a);
  const x1 = sx(world.width - a);
  const y1 = sy(world.height - a);
  ctx.fillStyle = 'rgba(5, 3, 1, 0.5)';
  if (x0 > -halfW) ctx.fillRect(-halfW, -halfH, x0 + halfW, h);
  if (x1 < halfW) ctx.fillRect(x1, -halfH, halfW - x1, h);
  const cl = Math.max(x0, -halfW);
  const cr = Math.min(x1, halfW);
  if (y0 > -halfH) ctx.fillRect(cl, -halfH, cr - cl, y0 + halfH);
  if (y1 < halfH) ctx.fillRect(cl, y1, cr - cl, halfH - y1);
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#2a1a0a';
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.setLineDash([14, 14]);
  ctx.strokeStyle = 'rgba(255, 195, 77, 0.75)';
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.setLineDash([]);
}

const CORNERS: [number, number][] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1]
];

/* ---------- main entry ---------- */

export interface RenderOptions {
  time: number; // seconds, for beacons/pulses
  shakeX?: number;
  shakeY?: number;
  actors?: Actors;
}

export function renderGame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  vehicle: VehicleState,
  world: World,
  opts: RenderOptions
) {
  ctx.fillStyle = C.asphalt;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(Math.round(width / 2 + (opts.shakeX ?? 0)), Math.round(height / 2 + (opts.shakeY ?? 0)));
  drawCity(ctx, world, vehicle.x, vehicle.y, width, height, opts.time, opts.actors);

  // ---- courier car ----
  ctx.rotate(vehicle.angle + Math.PI / 2);
  const carW = 28;
  const carH = 52;

  const bm = getBeam();
  if (bm) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(bm, -70, -carH / 2 - 176);
    ctx.globalCompositeOperation = 'source-over';
  }

  if (vehicle.nitroActive) {
    const glow = getGlow('rgba(255, 176, 32, 0.7)', 30);
    if (glow) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(glow, -30, carH / 2 - 8);
      ctx.globalCompositeOperation = 'source-over';
    }
    const flick = Math.random();
    ctx.fillStyle = '#ffc34d';
    ctx.beginPath();
    ctx.moveTo(-8, carH / 2);
    ctx.lineTo(0, carH / 2 + 26 + flick * 12);
    ctx.lineTo(8, carH / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff6dc';
    ctx.beginPath();
    ctx.moveTo(-4, carH / 2);
    ctx.lineTo(0, carH / 2 + 15 + flick * 6);
    ctx.lineTo(4, carH / 2);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(-carW / 2 - 2, -carH / 2 + 4, carW + 4, carH);
  ctx.fillStyle = '#0a0603';
  ctx.fillRect(-carW / 2 - 4, -carH / 2 + 6, 5, 12);
  ctx.fillRect(carW / 2 - 1, -carH / 2 + 6, 5, 12);
  ctx.fillRect(-carW / 2 - 4, carH / 2 - 18, 5, 12);
  ctx.fillRect(carW / 2 - 1, carH / 2 - 18, 5, 12);

  ctx.fillStyle = '#1c1209';
  ctx.strokeStyle = '#ffc34d';
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

  ctx.fillStyle = 'rgba(255, 195, 77, 0.10)';
  ctx.beginPath();
  ctx.moveTo(-carW / 2 + 4, -carH / 2);
  ctx.lineTo(0, -carH / 2 + 10);
  ctx.lineTo(-carW / 2, -carH / 2 + 12);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#3a2611';
  ctx.beginPath();
  ctx.moveTo(-carW / 2 + 5, -carH / 2 + 14);
  ctx.lineTo(carW / 2 - 5, -carH / 2 + 14);
  ctx.lineTo(carW / 2 - 4, -carH / 2 + 28);
  ctx.lineTo(-carW / 2 + 4, -carH / 2 + 28);
  ctx.closePath();
  ctx.fill();

  const cargoGlow = getGlow('rgba(255, 195, 77, 0.6)', 16);
  if (cargoGlow) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(cargoGlow, -16, carH / 2 - 27);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.fillStyle = '#ffd27a';
  ctx.fillRect(-6, carH / 2 - 16, 12, 10);

  if (vehicle.isBraking) {
    const bg = getGlow('rgba(255, 106, 42, 0.7)', 14);
    if (bg) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(bg, -carW / 2 - 8, carH / 2 - 16);
      ctx.drawImage(bg, carW / 2 - 20, carH / 2 - 16);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.fillStyle = vehicle.isBraking ? '#ff6a2a' : '#5a2a12';
  ctx.fillRect(-carW / 2 + 2, carH / 2 - 3, 7, 3);
  ctx.fillRect(carW / 2 - 9, carH / 2 - 3, 7, 3);

  ctx.restore();

  const ov = getOverlay(width, height);
  if (ov) ctx.drawImage(ov, 0, 0);
}
