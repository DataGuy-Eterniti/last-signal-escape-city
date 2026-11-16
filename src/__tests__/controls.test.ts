import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, dpadFrom, dpadVector, linkBars, mapControls, stickVector } from '../ui/controls';

const adv = { ...DEFAULT_SETTINGS, mode: 'advanced' as const };
const none = { gas: false, brake: false };

describe('360° joystick', () => {
  it('dead zone at centre, full deflection at the rim in every direction', () => {
    expect(stickVector(3, 3, 60)).toEqual({ x: 0, y: 0, mag: 0 });
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const v = stickVector(Math.cos(a) * 200, -Math.sin(a) * 200, 60);
      expect(v.mag).toBeCloseTo(1, 5);
      expect(Math.atan2(v.y, v.x)).toBeCloseTo(Math.atan2(Math.sin(a), Math.cos(a)), 5);
    }
  });
  it('screen-up is forward, screen-right is right', () => {
    const v = stickVector(0, -60, 60);
    expect(v.y).toBeCloseTo(1);
    expect(stickVector(60, 0, 60).x).toBeCloseTo(1);
  });
  it('diagonals keep both components', () => {
    const v = stickVector(42, -42, 60);
    expect(v.x).toBeGreaterThan(0.5);
    expect(v.y).toBeGreaterThan(0.5);
  });
});

describe('control modes', () => {
  it('classic: pedals drive, stick steers, stick forward also accelerates', () => {
    expect(mapControls(DEFAULT_SETTINGS, { x: 0, y: 0 }, { gas: true, brake: false })).toEqual({ steer: 0, throttle: 1, brake: 0 });
    expect(mapControls(DEFAULT_SETTINGS, { x: -1, y: 0 }, none).steer).toBe(-1);
    expect(mapControls(DEFAULT_SETTINGS, { x: 0, y: 0.6 }, none).throttle).toBeCloseTo(0.6);
    expect(mapControls(DEFAULT_SETTINGS, { x: 0, y: 0 }, { gas: true, brake: true })).toEqual({ steer: 0, throttle: 0, brake: 1 });
  });
  it('advanced: stick y is throttle / brake, pedals ignored', () => {
    expect(mapControls(adv, { x: 0, y: 0.8 }, { gas: false, brake: true })).toEqual({ steer: 0, throttle: 0.8, brake: 0 });
    expect(mapControls(adv, { x: 0.5, y: -1 }, { gas: true, brake: false }).brake).toBe(1);
    expect(mapControls(adv, { x: 0.5, y: -1 }, { gas: true, brake: false }).throttle).toBe(0);
  });
  it('steering keeps sign and stays within ±1', () => {
    for (const x of [-1, -0.5, -0.1, 0.1, 0.5, 1]) {
      const s = mapControls(DEFAULT_SETTINGS, { x, y: 0 }, none).steer;
      expect(Math.sign(s)).toBe(Math.sign(x));
      expect(Math.abs(s)).toBeLessThanOrEqual(1);
    }
  });
});

describe('8-way D-pad', () => {
  it('cardinals and diagonals', () => {
    expect(dpadVector(dpadFrom(0, -50, 60))).toEqual({ x: 0, y: 1 });
    expect(dpadVector(dpadFrom(50, 0, 60))).toEqual({ x: 1, y: 0 });
    expect(dpadVector(dpadFrom(-40, 40, 60))).toEqual({ x: -1, y: -1 });
    expect(dpadVector(dpadFrom(40, -40, 60))).toEqual({ x: 1, y: 1 });
  });
  it('centre tap does nothing', () => {
    expect(dpadVector(dpadFrom(2, 2, 60))).toEqual({ x: 0, y: 0 });
  });
});

describe('link quality', () => {
  it('maps ping to bars', () => {
    expect(linkBars(0)).toBe(0);
    expect(linkBars(30)).toBe(3);
    expect(linkBars(90)).toBe(2);
    expect(linkBars(300)).toBe(1);
  });
});
