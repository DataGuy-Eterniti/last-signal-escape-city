import { describe, expect, it } from 'vitest';
import { CITIES, getCity } from '../engine/cities';
import { buildWorld, roadX, roadY, segKey } from '../engine/world';
import { createActors } from '../engine/actors';
import { createInitialVehicle } from '../engine/physics';
import { dangerMarkers, nextTurn, routePath, updateHeat, streetAt, PURSUIT_AT } from '../ui/hudModel';
import { createCrimeRun, crimeStep } from '../ui/crimeDirector';
import { MISSIONS, missionDifficulty } from '../ui/missions';

describe('route guidance', () => {
  it('finds a barricade-free path to the extraction in every city', () => {
    for (const c of CITIES) {
      const w = buildWorld(c);
      const path = routePath(w, [c.start.ix, c.start.iy])!;
      expect(path).not.toBeNull();
      expect(path[path.length - 1]).toEqual([c.extraction.ix, c.extraction.iy]);
      for (let k = 1; k < path.length; k++) {
        const a = path[k - 1];
        const b = path[k];
        const lo = a[0] < b[0] || a[1] < b[1];
        expect(w.closed.has(segKey(lo ? { a, b } : { a: b, b: a }))).toBe(false);
      }
    }
  });
  it('gives a named manoeuvre from the start and "arrive" at the goal', () => {
    for (const c of CITIES) {
      const w = buildWorld(c);
      const hint = nextTurn(w, w.start.x, w.start.y, w.start.angle)!;
      expect(hint).not.toBeNull();
      expect(['straight', 'left', 'right', 'uturn']).toContain(hint.turn);
      expect(hint.street.length).toBeGreaterThan(0);
      expect(nextTurn(w, w.extraction.x + 20, w.extraction.y, 0)!.turn).toBe('arrive');
    }
  });
  it('names the street under the car', () => {
    const w = buildWorld(getCity('nyc')!);
    expect(streetAt(w, roadX(2), roadY(1) + 200)).toBe(w.city.vRoads[2]);
    expect(streetAt(w, roadX(2) + 200, roadY(3))).toBe(w.city.hRoads[3]);
  });
});

describe('heat', () => {
  it('builds with incidents, caps at 5 and cools after calm', () => {
    let h = { value: 0, calm: 0 };
    for (let k = 0; k < 20; k++) h = updateHeat(h, 0.1, ['officer-down']);
    expect(h.value).toBe(5);
    for (let k = 0; k < 600; k++) h = updateHeat(h, 0.1, []);
    expect(h.value).toBeLessThan(PURSUIT_AT);
  });
});

describe('crime director', () => {
  const setup = () => {
    const w = buildWorld(getCity('nyc')!);
    const actors = createActors(w);
    const v = createInitialVehicle(w.start.x, w.start.y);
    return { w, actors, v, run: createCrimeRun(actors, w) };
  };
  it('opens with a dispatch call and announces rising heat with real street names', () => {
    const { w, actors, v, run } = setup();
    expect(run.radio[0].text).toContain('New York');
    for (let k = 0; k < 10; k++) crimeStep(run, { t: k, dt: 0.1, events: ['officer-down'], crashDamage: 0, bulletDamage: 0, world: w, vehicle: v, actors });
    expect(run.heat.value).toBeGreaterThanOrEqual(PURSUIT_AT);
    expect(run.radio.some((m) => m.tone === 'alert')).toBe(true);
    expect(actors.tuning.range).toBeGreaterThan(run.base.range);
  });
  it('wrecks the car when vehicle health runs out', () => {
    const { w, actors, v, run } = setup();
    let loss = null;
    for (let k = 0; k < 20 && !loss; k++) loss = crimeStep(run, { t: k, dt: 0.1, events: [], crashDamage: 10, bulletDamage: 0, world: w, vehicle: v, actors });
    expect(loss).toBe('wrecked');
  });
  it('busts a stationary courier next to police at high heat', () => {
    const { w, actors, v, run } = setup();
    const o = actors.officers[0];
    const parked = { ...v, x: o.x + 40, y: o.y, speed: 0 };
    run.heat.value = 4.5;
    let loss = null;
    for (let k = 0; k < 40 && !loss; k++) loss = crimeStep(run, { t: k * 0.1, dt: 0.1, events: ['shot-at'], crashDamage: 0, bulletDamage: 0, world: w, vehicle: parked, actors });
    expect(loss).toBe('busted');
  });
  it('lists nearby armed officers as danger markers', () => {
    const { actors, v } = setup();
    const o = actors.officers[0];
    const m = dangerMarkers(actors, { ...v, x: o.x + 100, y: o.y });
    expect(m.length).toBeGreaterThan(0);
    expect(m[0].proximity).toBeGreaterThan(0.7);
  });
});

describe('missions', () => {
  it('difficulty steps up per mode and caps at Extreme', () => {
    const gold = getCity('gold')!;
    const nyc = getCity('nyc')!;
    expect(missionDifficulty(MISSIONS[0], gold)).toBe('Easy');
    expect(missionDifficulty(MISSIONS[1], gold)).toBe('Medium');
    expect(missionDifficulty(MISSIONS[2], nyc)).toBe('Extreme');
  });
  it('zombie mode is visible but locked until the engine exists', () => {
    expect(MISSIONS.find((m) => m.id === 'zombie')!.available).toBe(false);
  });
});
