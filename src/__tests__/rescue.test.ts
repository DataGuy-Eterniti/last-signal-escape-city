import { describe, expect, it } from 'vitest';
import { CITIES, getCity } from '../engine/cities';
import { buildWorld, pointBlocked } from '../engine/world';
import { BOARD_TIME, NAV_LEVELS, RESCUE_CONFIG, counts, currentObjective, estimateThreat, isFinished, planRescue, rescueScore, stepRescue } from '../ui/rescue/rescueModel';

const dt = 1 / 30;
const hold = (s: ReturnType<typeof planRescue>, pos: { x: number; y: number }, secs: number, speed = 0) => {
  const evs = [];
  for (let t = 0; t < secs; t += dt) evs.push(...stepRescue(s, pos, speed, dt));
  return evs;
};

describe('rescue planning', () => {
  it('places the right number of survivors on open sidewalk in every city', () => {
    for (const c of CITIES) {
      const w = buildWorld(c);
      const s = planRescue(w, 'Medium');
      expect(s.survivors.length).toBe(RESCUE_CONFIG.Medium.survivors);
      for (const v of s.survivors) {
        expect(pointBlocked(w, v.x, v.y, 6)).toBe(false);
        expect(Math.hypot(v.x - w.start.x, v.y - w.start.y)).toBeGreaterThan(400);
      }
    }
  });
  it('is deterministic', () => {
    const w = buildWorld(getCity('lagos')!);
    expect(planRescue(w, 'Hard').survivors.map((v) => [v.x, v.y])).toEqual(planRescue(w, 'Hard').survivors.map((v) => [v.x, v.y]));
  });
  it('estimates threat between 1 and 5', () => {
    expect(estimateThreat('Easy', 5)).toBe(1);
    expect(estimateThreat('Extreme', 12)).toBe(5);
  });
});

describe('boarding and drop-off', () => {
  const setup = () => {
    const w = buildWorld(getCity('gold')!);
    return planRescue(w, 'Easy');
  };
  it('boards after 2 s stopped in the ring, not while moving', () => {
    const s = setup();
    const v = s.survivors[0];
    hold(s, v, BOARD_TIME * 0.5, 300); // driving through
    expect(v.status).toBe('waiting');
    const ev = hold(s, v, BOARD_TIME * 0.6);
    expect(v.status).toBe('boarding');
    expect(v.board).toBeGreaterThan(0.4);
    expect(ev.length).toBe(0);
    hold(s, v, BOARD_TIME * 0.5);
    expect(v.status).toBe('onboard');
  });
  it('progress bleeds away when you leave the ring', () => {
    const s = setup();
    const v = s.survivors[0];
    hold(s, v, 1);
    const p = v.board;
    hold(s, { x: v.x + 500, y: v.y }, 0.5);
    expect(v.board).toBeLessThan(p);
  });
  it('respects capacity and unloads everyone at the safe zone', () => {
    const s = setup();
    for (const v of s.survivors.slice(0, 4)) hold(s, v, BOARD_TIME + 0.2);
    expect(counts(s).onboard).toBe(s.capacity);
    expect(currentObjective(s, s.survivors[0])!.kind).toBe('safe');
    const ev = hold(s, s.safe, 1.7);
    expect(ev).toContainEqual({ kind: 'dropped', count: s.capacity });
    expect(counts(s).rescued).toBe(s.capacity);
  });
  it('loses survivors when patience runs out and finishes the run', () => {
    const s = setup();
    hold(s, { x: -9999, y: -9999 }, 400);
    const c = counts(s);
    expect(c.lost).toBe(c.total);
    expect(isFinished(s)).toBe(true);
    expect(rescueScore(s, 100).total).toBe(0);
  });
  it('scores rescues highest and rewards a clean sweep', () => {
    const s = setup();
    for (const v of s.survivors) {
      hold(s, v, BOARD_TIME + 0.2);
      if (counts(s).onboard >= s.capacity) hold(s, s.safe, 1.7);
    }
    hold(s, s.safe, 1.7);
    const sc = rescueScore(s, 80);
    expect(counts(s).rescued).toBe(s.survivors.length);
    expect(sc.parts.find((p) => p.label === 'Nobody left behind')!.value).toBe(1500);
    expect(sc.total).toBeGreaterThan(s.survivors.length * 1000);
  });
});

describe('navigation levels', () => {
  it('Explorer is the middle ground, Survival hides everything', () => {
    expect(NAV_LEVELS.guided.ribbon).toBe(true);
    expect(NAV_LEVELS.explorer.ribbon).toBe(false);
    expect(NAV_LEVELS.explorer.markers).toBe('near');
    expect(NAV_LEVELS.survival.markers).toBe('none');
    expect(NAV_LEVELS.survival.minimapSurvivors).toBe(false);
  });
});

describe('guided routing', () => {
  it('routes from the start to every survivor and to the safe zone, around barricades', async () => {
    const { routePolylineTo } = await import('../ui/rescue/rescueModel');
    for (const c of CITIES) {
      const w = buildWorld(c);
      const s = planRescue(w, 'Hard');
      for (const t of [...s.survivors, s.safe]) {
        const pts = routePolylineTo(w, w.start.x, w.start.y, t.x, t.y);
        expect(pts.length).toBeGreaterThan(1);
        expect(pts[pts.length - 1]).toEqual({ x: t.x, y: t.y });
      }
    }
  });
});
