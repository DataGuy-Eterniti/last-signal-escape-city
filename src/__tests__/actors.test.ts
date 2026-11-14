import { describe, expect, it } from 'vitest';
import { CITIES, getCity } from '../engine/cities';
import { buildWorld, segKey, pointBlocked } from '../engine/world';
import { createActors, updateActors, collideTraffic, lineBlocked } from '../engine/actors';
import { createInitialVehicle } from '../engine/physics';

const parked = (x: number, y: number) => {
  const v = createInitialVehicle(x, y);
  v.speed = 0;
  return v;
};

describe('living city', () => {
  it('spawns traffic and armed officers in every city', () => {
    for (const c of CITIES) {
      const w = buildWorld(c);
      const a = createActors(w);
      expect(a.traffic.length).toBeGreaterThan(15);
      expect(a.officers.filter((o) => o.kind === 'checkpoint').length).toBe(w.barricades.length * 2);
      expect(a.officers.some((o) => o.kind === 'patrol')).toBe(true);
    }
  });

  it('traffic stays on open roads, never in buildings or barricaded segments, for 60 s', () => {
    for (const c of CITIES) {
      const w = buildWorld(c);
      const a = createActors(w);
      const far = parked(-5000, -5000); // player out of the way
      for (let f = 0; f < 60 * 60; f++) {
        updateActors(a, w, far, 1 / 60, false);
        if (f % 30 !== 0) continue;
        for (const car of a.traffic) {
          const lo = car.a[0] < car.b[0] || car.a[1] < car.b[1];
          expect(w.closed.has(segKey(lo ? { a: car.a, b: car.b } : { a: car.b, b: car.a }))).toBe(false);
          expect(pointBlocked(w, car.x, car.y, 0)).toBe(false);
        }
      }
    }
  });

  it('traffic keeps moving (no gridlock) over two minutes', () => {
    const w = buildWorld(getCity('nyc')!);
    const a = createActors(w);
    const far = parked(-5000, -5000);
    const start = a.traffic.map((c) => [c.x, c.y]);
    for (let f = 0; f < 120 * 60; f++) updateActors(a, w, far, 1 / 60, false);
    const moved = a.traffic.filter((c, k) => Math.hypot(c.x - start[k][0], c.y - start[k][1]) > 200).length;
    expect(moved / a.traffic.length).toBeGreaterThan(0.8);
  });

  it('is deterministic', () => {
    const w = buildWorld(getCity('lagos')!);
    const a1 = createActors(w);
    const a2 = createActors(w);
    const p = parked(-5000, -5000);
    for (let f = 0; f < 600; f++) {
      updateActors(a1, w, p, 1 / 60, false);
      updateActors(a2, w, p, 1 / 60, false);
    }
    expect(a1.traffic.map((c) => [Math.round(c.x), Math.round(c.y)])).toEqual(a2.traffic.map((c) => [Math.round(c.x), Math.round(c.y)]));
  });

  it('officers shoot a visible courier and bullets damage it; walls block sight', () => {
    const w = buildWorld(getCity('gold')!);
    const a = createActors(w);
    const o = a.officers[0];
    a.officers = [o];
    a.traffic = [];
    const target = parked(o.x + 120, o.y);
    // keep the target on the open road next to the officer
    let dmg = 0;
    let shots = 0;
    for (let f = 0; f < 600; f++) {
      const ev = updateActors(a, w, target, 1 / 60, true);
      dmg += ev.bulletDamage;
      shots += ev.shotsFired;
    }
    expect(lineBlocked(w, o.x, o.y, target.x, target.y)).toBe(false);
    expect(shots).toBeGreaterThan(0);
    expect(dmg).toBeGreaterThan(0);
    // a building between shooter and target blocks the line
    const b = w.blocks.find((bl) => bl.buildings.length > 0)!.buildings[0];
    expect(lineBlocked(w, b.x - 40, b.y + b.h / 2, b.x + b.w + 40, b.y + b.h / 2)).toBe(true);
  });

  it('no shooting while unarmed (grace period / menus)', () => {
    const w = buildWorld(getCity('nyc')!);
    const a = createActors(w);
    const o = a.officers[0];
    const p = parked(o.x + 60, o.y);
    let shots = 0;
    for (let f = 0; f < 300; f++) shots += updateActors(a, w, p, 1 / 60, false).shotsFired;
    expect(shots).toBe(0);
  });

  it('ramming traffic pushes the courier out and reports an impact', () => {
    const w = buildWorld(getCity('chicago')!);
    const a = createActors(w);
    const car = a.traffic[0];
    car.speed = 0;
    const v = createInitialVehicle(car.x - 30, car.y);
    v.angle = 0;
    v.speed = 300;
    const res = collideTraffic(a, v);
    expect(res.hit).toBe('traffic');
    expect(res.impact).toBeGreaterThan(100);
    expect(res.vehicle.x).toBeLessThan(v.x);
    expect(car.stunned).toBeGreaterThan(0);
  });

  it('buildings and cars get unique colours', () => {
    const w = buildWorld(getCity('nyc')!);
    const roofs = new Set(w.blocks.flatMap((b) => b.buildings.map((bd) => bd.paint.base)));
    const total = w.blocks.reduce((n, b) => n + b.buildings.length, 0);
    expect(roofs.size / total).toBeGreaterThan(0.8);
    const a = createActors(w);
    const paints = new Set([...w.parkedCars.map((c) => c.color), ...a.traffic.filter((c) => c.body !== 'taxi' && c.body !== 'bus').map((c) => c.color)]);
    expect(paints.size).toBeGreaterThan(40);
  });
});
