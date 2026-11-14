/* ==========================================================================
   Per-object colour variation. Every building and every car gets its own
   deterministic colour, picked from realistic families (brick, slate,
   sandstone… / white, silver, red, blue…) and kept dim enough to sit inside
   the Gold Noir night. The UI, the courier car, landmarks and the extraction
   beacon keep the original gold palette — only the city's "extras" vary.
   ========================================================================== */

function h3(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

const hsl = (h: number, s: number, l: number) =>
  `hsl(${Math.round(((h % 360) + 360) % 360)}, ${Math.round(Math.max(0, Math.min(100, s)))}%, ${Math.round(Math.max(0, Math.min(100, l)))}%)`;

export interface BuildingPaint {
  base: string; // roof
  accent: string; // rooftop units / trim
  rim: string; // lit edge
  style: number; // 0 units · 1 solar · 2 gravel + tank · 3 ribbed metal · 4 roof garden
}

/** Night-time roof colours: brick, slate, verdigris, sandstone, charcoal, plum. */
export function buildingPaint(seed: number): BuildingPaint {
  const r = (k: number) => h3(seed, k, 7);
  const fam = r(1);
  let h: number;
  let s: number;
  let l: number;
  if (fam < 0.26) [h, s, l] = [14 + r(2) * 24, 30 + r(3) * 22, 13 + r(4) * 8]; // brick / terracotta
  else if (fam < 0.44) [h, s, l] = [198 + r(2) * 34, 10 + r(3) * 16, 13 + r(4) * 9]; // slate
  else if (fam < 0.58) [h, s, l] = [150 + r(2) * 40, 12 + r(3) * 16, 12 + r(4) * 7]; // verdigris
  else if (fam < 0.76) [h, s, l] = [32 + r(2) * 18, 10 + r(3) * 16, 15 + r(4) * 10]; // sandstone / concrete
  else if (fam < 0.88) [h, s, l] = [r(2) * 360, 4 + r(3) * 6, 10 + r(4) * 9]; // charcoal
  else [h, s, l] = [320 + r(2) * 45, 16 + r(3) * 16, 12 + r(4) * 7]; // plum / burgundy
  return {
    base: hsl(h, s, l),
    accent: hsl(h + 8, s * 0.8, l + 9),
    rim: hsl(h, s * 0.6, l + 22),
    style: Math.floor(r(5) * 5)
  };
}

export type CarBody = 'sedan' | 'hatch' | 'suv' | 'van' | 'taxi' | 'bus';

/** Footprint in px (width across, length along). */
export const BODY_SIZE: Record<CarBody, [number, number]> = {
  sedan: [22, 42],
  hatch: [21, 36],
  suv: [24, 44],
  van: [24, 48],
  taxi: [22, 42],
  bus: [26, 60]
};

/** Real-world paint distribution, jittered so no two cars match. */
export function carPaint(seed: number): string {
  const r = (k: number) => h3(seed, k, 13);
  const f = r(1);
  if (f < 0.17) return hsl(40, 5 + r(2) * 6, 68 + r(3) * 14); // white / pearl
  if (f < 0.32) return hsl(205 + r(2) * 20, 4 + r(3) * 8, 40 + r(4) * 20); // silver / grey
  if (f < 0.46) return hsl(r(2) * 360, 5 + r(3) * 5, 9 + r(4) * 6); // black
  if (f < 0.57) return hsl(352 + r(2) * 14, 55 + r(3) * 20, 30 + r(4) * 12); // red
  if (f < 0.67) return hsl(208 + r(2) * 22, 45 + r(3) * 25, 26 + r(4) * 16); // blue
  if (f < 0.74) return hsl(135 + r(2) * 35, 28 + r(3) * 20, 20 + r(4) * 12); // green
  if (f < 0.80) return hsl(340 + r(2) * 12, 42 + r(3) * 18, 18 + r(4) * 8); // maroon
  if (f < 0.87) return hsl(36 + r(2) * 8, 22 + r(3) * 18, 48 + r(4) * 14); // champagne / beige
  if (f < 0.93) return hsl(16 + r(2) * 14, 58 + r(3) * 20, 36 + r(4) * 10); // copper / orange
  return hsl(r(2) < 0.5 ? 178 + r(3) * 14 : 268 + r(3) * 20, 30 + r(4) * 20, 28 + r(5) * 10); // teal / purple
}

/** Body mix per city: NYC has more yellow cabs, Lagos has yellow danfo buses. */
export function carBody(seed: number, cityId: string, allowBus: boolean): CarBody {
  const f = h3(seed, 3, 29);
  const taxi = cityId === 'nyc' ? 0.18 : 0.06;
  const bus = allowBus ? (cityId === 'lagos' ? 0.16 : 0.04) : 0;
  if (f < taxi) return 'taxi';
  if (f < taxi + bus) return 'bus';
  const g = (f - taxi - bus) / (1 - taxi - bus);
  if (g < 0.42) return 'sedan';
  if (g < 0.64) return 'hatch';
  if (g < 0.86) return 'suv';
  return 'van';
}

/** Taxis and buses wear their city's livery; everything else gets a unique paint. */
export function paintFor(body: CarBody, seed: number, cityId: string): string {
  if (body === 'taxi') return cityId === 'nyc' ? hsl(45, 82, 50) : hsl(44 + h3(seed, 9, 2) * 6, 70, 46);
  if (body === 'bus') return cityId === 'lagos' ? hsl(46, 88, 52) : hsl(205, 30, 34);
  return carPaint(seed);
}

/** Officer uniforms vary by city and person (navy, charcoal, olive tones). */
export function uniformFor(seed: number, cityId: string): { uniform: string; vest: string; skin: string } {
  const r = (k: number) => h3(seed, k, 41);
  const baseHue = cityId === 'lagos' ? 215 : cityId === 'chicago' ? 222 : cityId === 'nyc' ? 225 : 30;
  const olive = r(1) < 0.25;
  const uniform = olive ? hsl(75 + r(2) * 15, 18 + r(3) * 10, 18 + r(4) * 6) : hsl(baseHue + r(2) * 14 - 7, 22 + r(3) * 18, 14 + r(4) * 8);
  const vest = hsl(r(5) * 20 + 200, 8 + r(6) * 8, 10 + r(7) * 6);
  const skinL = 22 + r(8) * 50;
  const skin = hsl(22 + r(9) * 10, 30 + r(10) * 25, skinL);
  return { uniform, vest, skin };
}
