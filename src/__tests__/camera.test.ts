import { describe, expect, it } from 'vitest';
import { createCamera, updateCamera, MIN_ZOOM } from '../engine/camera';
import { createInitialVehicle } from '../engine/physics';

const settle = (cam: ReturnType<typeof createCamera>, v: ReturnType<typeof createInitialVehicle>, w = 1366, h = 768) => {
  for (let k = 0; k < 600; k++) cam = updateCamera(cam, v, 1 / 60, w, h);
  return cam;
};

describe('driving camera', () => {
  it('centres on a parked car at native zoom', () => {
    const v = createInitialVehicle(500, 500);
    const c = settle(createCamera(v), v);
    expect(c.x).toBeCloseTo(500, 1);
    expect(c.y).toBeCloseTo(500, 1);
    expect(c.zoom).toBeCloseTo(1, 2);
  });
  it('leads in the direction of travel, capped to a quarter-ish of the screen', () => {
    const v = { ...createInitialVehicle(500, 500), angle: 0, speed: 300 };
    const c = settle(createCamera(v), v);
    expect(c.x - 500).toBeGreaterThan(150);
    expect(c.x - 500).toBeLessThanOrEqual(768 * 0.27 + 0.5);
    expect(Math.abs(c.y - 500)).toBeLessThan(1);
    const up = { ...v, angle: -Math.PI / 2 };
    expect(settle(createCamera(up), up).y).toBeLessThan(400);
  });
  it('zooms out with speed but never below the floor', () => {
    const v = { ...createInitialVehicle(0, 0), speed: 2000 };
    const c = settle(createCamera(v), v);
    expect(c.zoom).toBeCloseTo(MIN_ZOOM, 2);
  });
  it('does not lead while reversing', () => {
    const v = { ...createInitialVehicle(500, 500), angle: 0, speed: -150 };
    expect(settle(createCamera(v), v).x).toBeCloseTo(500, 1);
  });
  it('moves smoothly (no jump in a single frame)', () => {
    const v = createInitialVehicle(500, 500);
    const c = updateCamera(createCamera(v), { ...v, angle: 0, speed: 380 }, 1 / 60, 1366, 768);
    expect(c.x - 500).toBeLessThan(15);
  });
});
