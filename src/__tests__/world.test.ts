import { describe, it, expect } from 'vitest';
import { CITIES } from '../engine/cities';
import { buildWorld, collide, damageFrom, isReachable, pointBlocked, CAR_RADIUS, OFFSET, PITCH, roadX, roadY } from '../engine/world';
import { createInitialVehicle } from '../engine/physics';

describe('City worlds', () => {
  it('every city has one road name per road line', () => {
    for (const c of CITIES) {
      expect(c.vRoads.length).toBe(c.blocksX + 1);
      expect(c.hRoads.length).toBe(c.blocksY + 1);
    }
  });

  it('is deterministic: the same city always builds the same layout', () => {
    const a = buildWorld(CITIES[0]);
    const b = buildWorld(CITIES[0]);
    expect(a.obstacles.length).toBe(b.obstacles.length);
    expect(a.blocks[5].buildings.map((x) => x.label)).toEqual(b.blocks[5].buildings.map((x) => x.label));
  });

  it('starts the car on open road and keeps the extraction reachable', () => {
    for (const c of CITIES) {
      const w = buildWorld(c);
      expect(pointBlocked(w, w.start.x, w.start.y, CAR_RADIUS + 13)).toBe(false);
      expect(pointBlocked(w, w.extraction.x, w.extraction.y, CAR_RADIUS)).toBe(false);
      const closed = new Set(w.barricades.map((b) => `${b.a[0]},${b.a[1]}-${b.b[0]},${b.b[1]}`));
      expect(isReachable(c, closed)).toBe(true);
      expect(w.barricades.length).toBeGreaterThan(0);
    }
  });

  it('labels buildings and places landmarks', () => {
    const w = buildWorld(CITIES[0]);
    const labels = w.blocks.flatMap((b) => b.buildings.map((x) => x.label));
    expect(labels.length).toBeGreaterThan(50);
    expect(w.landmarkLabels.map((l) => l.name)).toContain('Times Square');
  });
});

describe('Collisions', () => {
  it('stops the car at a building wall and reports the impact', () => {
    const w = buildWorld(CITIES[3]);
    const b = w.blocks[0].buildings[0];
    // car just overlapping the building's left wall, driving right into it
    const v = createInitialVehicle(b.x - CAR_RADIUS + 4, b.y + b.h / 2);
    v.angle = 0;
    v.speed = 300;
    const res = collide(w, v);
    expect(res.impact).toBeGreaterThan(200);
    expect(res.hit).toBe('building');
    expect(res.vehicle.x).toBeLessThan(v.x);
    expect(res.vehicle.speed).toBeLessThan(v.speed);
    expect(damageFrom(res.impact, res.hit)).toBeGreaterThan(0);
  });

  it('leaves a car on open road untouched', () => {
    const w = buildWorld(CITIES[3]);
    const v = createInitialVehicle(roadX(1), roadY(1));
    v.speed = 200;
    const res = collide(w, v);
    expect(res.impact).toBe(0);
    expect(res.vehicle).toBe(v);
  });

  it('gentle scrapes do no damage', () => {
    expect(damageFrom(40, 'building')).toBe(0);
    expect(damageFrom(400, 'cone')).toBeLessThan(damageFrom(400, 'building'));
  });

  it('has a solid lockdown barrier around the city', () => {
    const w = buildWorld(CITIES[1]);
    expect(pointBlocked(w, OFFSET - 80 - 34, OFFSET + PITCH, 1)).toBe(true);
    expect(pointBlocked(w, OFFSET - 80 + 20, OFFSET + PITCH, 1)).toBe(false);
  });
});
