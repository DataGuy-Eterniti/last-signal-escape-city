import { BOARD_TIME, PICKUP_R, RescueState, Survivor } from './rescueModel';

/* ==========================================================================
   Rescue Run — in-world graphics (procedural Canvas 2D, no images).
   Call AFTER renderGame with a transform that maps world px → screen, e.g.

     ctx.setTransform(dpr*zoom, 0, 0, dpr*zoom, dpr*(w/2 - cam.x*zoom), dpr*(h/2 - cam.y*zoom));
     drawRescueWorld(ctx, rescue, time);

   Signals are white (people) + gold (objectives) so they read over the dark
   city and never clash with ember (police) or toxic (infected) accents.
   ========================================================================== */

const GOLD = '#ffc34d';
const PALE = '#f1d8a8';
const WHITE = '#fff6e4';
const EMBER = '#e0583a';

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, width: number, dash?: number[]) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash ?? []);
  ctx.stroke();
  ctx.setLineDash([]);
}

function arc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, frac: number, color: string, width: number) {
  if (frac <= 0) return;
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, frac));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size = 10) {
  ctx.font = `700 ${size}px Inter, "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = 'rgba(16, 10, 5, 0.85)';
  ctx.beginPath();
  const h = size + 8;
  const r = h / 2;
  ctx.moveTo(x - w / 2 + r, y - h / 2);
  ctx.arcTo(x + w / 2, y - h / 2, x + w / 2, y + h / 2, r);
  ctx.arcTo(x + w / 2, y + h / 2, x - w / 2, y + h / 2, r);
  ctx.arcTo(x - w / 2, y + h / 2, x - w / 2, y - h / 2, r);
  ctx.arcTo(x - w / 2, y - h / 2, x + w / 2, y - h / 2, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(241, 216, 168, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillText(text, x, y + 0.5);
}

/** Top-down person: shoulders, head, one arm raised with a flare. */
function figure(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(1.4, 1.4);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // shoulders: a light capsule (reads as a person from above, not a dot)
  ctx.fillStyle = '#e8dcc4';
  ctx.beginPath();
  ctx.moveTo(-8, -2);
  ctx.arcTo(-9.5, -2, -9.5, 2, 3.5);
  ctx.arcTo(-9.5, 5, 9.5, 5, 3.5);
  ctx.arcTo(9.5, 5, 9.5, -2, 3.5);
  ctx.arcTo(9.5, -2, -9.5, -2, 3.5);
  ctx.closePath();
  ctx.fill();
  const wave = Math.sin(t * 6) * 0.5;
  // raised arm
  ctx.strokeStyle = '#e8dcc4';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(7, -1);
  ctx.lineTo(10 + wave * 2, -9);
  ctx.stroke();
  ctx.lineCap = 'butt';
  // head, offset forward, skin + hair cap
  ctx.fillStyle = '#9a6a45';
  ctx.beginPath();
  ctx.arc(0, -3.5, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a1a0e';
  ctx.beginPath();
  ctx.arc(0, -3.5, 3.6, Math.PI * 0.95, Math.PI * 2.05);
  ctx.fill();
  if (alpha > 0.5) {
    // flare in the raised hand
    const f = 0.7 + 0.3 * Math.sin(t * 18);
    const g = ctx.createRadialGradient(10 + wave * 2, -10, 0, 10 + wave * 2, -10, 12);
    g.addColorStop(0, `rgba(255, 246, 228, ${f})`);
    g.addColorStop(0.4, `rgba(255, 195, 77, ${0.5 * f})`);
    g.addColorStop(1, 'rgba(255, 195, 77, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(10 + wave * 2, -10, 12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Floating map pin above a survivor: white disc + person glyph, bobbing. Readable at any zoom. */
function pin(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, urgent: boolean, id: number) {
  const bob = Math.sin(t * 2.4 + id) * 3;
  const py = y - 40 + bob;
  const r = 14;
  const edge = urgent ? EMBER : GOLD;
  ctx.save();
  // stem
  ctx.strokeStyle = 'rgba(255, 246, 228, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, py + r);
  ctx.lineTo(x, y - 12);
  ctx.stroke();
  // halo
  const g = ctx.createRadialGradient(x, py, r * 0.6, x, py, r * 2.4);
  g.addColorStop(0, urgent ? 'rgba(224, 88, 58, 0.45)' : 'rgba(255, 246, 228, 0.40)');
  g.addColorStop(1, 'rgba(255, 246, 228, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, py, r * 2.4, 0, Math.PI * 2);
  ctx.fill();
  // disc
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.arc(x, py, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // person glyph, arm raised
  ctx.strokeStyle = '#2a1808';
  ctx.fillStyle = '#2a1808';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x - 1, py - 6, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 1, py - 3);
  ctx.lineTo(x - 1, py + 3);
  ctx.moveTo(x - 1, py + 3);
  ctx.lineTo(x - 4, py + 8);
  ctx.moveTo(x - 1, py + 3);
  ctx.lineTo(x + 2, py + 8);
  ctx.moveTo(x - 1, py - 1);
  ctx.lineTo(x - 5, py + 2);
  ctx.moveTo(x - 1, py - 1);
  ctx.lineTo(x + 4, py - 5);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.restore();
}

/** Waiting / boarding survivor with pickup ring, patience arc and sonar pulse. */
export function drawSurvivor(ctx: CanvasRenderingContext2D, v: Survivor, t: number, opts: { showPatience?: boolean } = {}) {
  if (v.status === 'onboard' || v.status === 'rescued') return;
  if (v.status === 'lost') {
    figure(ctx, v.x, v.y, 0, 0.22);
    return;
  }
  const boarding = v.status === 'boarding' || v.board > 0;
  // sonar pulse (two staggered rings) — readable from a block away
  for (const off of [0, 0.5]) {
    const p = (t / 1.8 + off + v.id * 0.13) % 1;
    ctx.globalAlpha = (1 - p) * 0.55;
    ring(ctx, v.x, v.y, 14 + p * 70, WHITE, 2);
  }
  ctx.globalAlpha = 1;
  // pickup ring
  ctx.fillStyle = boarding ? 'rgba(255, 195, 77, 0.10)' : 'rgba(255, 195, 77, 0.04)';
  ctx.beginPath();
  ctx.arc(v.x, v.y, PICKUP_R, 0, Math.PI * 2);
  ctx.fill();
  ring(ctx, v.x, v.y, PICKUP_R, boarding ? GOLD : 'rgba(255, 195, 77, 0.55)', boarding ? 2 : 1.5, boarding ? undefined : [8, 7]);
  // patience (depletes clockwise; turns ember when low)
  if (opts.showPatience !== false && !boarding) {
    const frac = v.patience / v.patienceMax;
    arc(ctx, v.x, v.y, PICKUP_R + 6, frac, frac < 0.3 ? EMBER : 'rgba(241, 216, 168, 0.55)', 3);
  }
  // boarding progress
  if (boarding) {
    arc(ctx, v.x, v.y, PICKUP_R - 8, v.board, GOLD, 6);
    label(ctx, `BOARDING ${(Math.floor(v.board * BOARD_TIME * 10) / 10).toFixed(1)}s / ${BOARD_TIME}s`, v.x, v.y - PICKUP_R - 16, GOLD);
  }
  figure(ctx, v.x, v.y, t);
  if (!boarding) pin(ctx, v.x, v.y, t, v.patience / v.patienceMax < 0.3, v.id);
}

/** Safe zone: double gold ring, rotating dashes, inward chevrons, unload arc. */
export function drawSafeZone(ctx: CanvasRenderingContext2D, s: RescueState['safe'], dropProgress: number, active: boolean, t: number) {
  const { x, y, r } = s;
  const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
  g.addColorStop(0, `rgba(255, 195, 77, ${active ? 0.22 : 0.12})`);
  g.addColorStop(1, 'rgba(255, 195, 77, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ring(ctx, x, y, r, GOLD, 2.5);
  ring(ctx, x, y, r - 10, 'rgba(255, 195, 77, 0.35)', 1);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 0.4);
  ring(ctx, 0, 0, r + 12, 'rgba(241, 216, 168, 0.45)', 2, [14, 12]);
  ctx.restore();
  // inward chevrons, pulsing toward the centre
  if (active) {
    ctx.fillStyle = GOLD;
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      const d = r + 34 - ((t * 30) % 20);
      ctx.save();
      ctx.translate(x + Math.cos(a) * d, y + Math.sin(a) * d);
      ctx.rotate(a + Math.PI);
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-5, -7);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-5, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  arc(ctx, x, y, r - 22, dropProgress, WHITE, 6);
  label(ctx, dropProgress > 0 ? `UNLOADING ${Math.round(dropProgress * 100)}%` : `SAFE ZONE · ${s.name.toUpperCase()}`, x, y - r - 26, dropProgress > 0 ? WHITE : GOLD, 11);
}

/** Everything Rescue Run draws in the world, in the right order. */
export function drawRescueWorld(ctx: CanvasRenderingContext2D, s: RescueState, t: number, opts: { showPatience?: boolean } = {}) {
  const onboard = s.survivors.some((v) => v.status === 'onboard');
  drawSafeZone(ctx, s.safe, s.dropProgress, onboard, t);
  for (const v of s.survivors) drawSurvivor(ctx, v, t, opts);
}

/** Colour of a survivor blip for minimaps / edge markers. */
export const survivorTone = (v: Survivor) => (v.status === 'boarding' ? GOLD : v.patience / v.patienceMax < 0.3 ? EMBER : PALE);
