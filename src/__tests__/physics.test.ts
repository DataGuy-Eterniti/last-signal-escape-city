import { describe, it, expect } from 'vitest';
import { createInitialVehicle, updateVehicle } from '../engine/physics';
import { ControllerInput } from '../types';

describe('Vehicle Physics Engine', () => {
  it('creates initial vehicle facing upwards with 0 speed', () => {
    const v = createInitialVehicle(500, 500);
    expect(v.x).toBe(500);
    expect(v.y).toBe(500);
    expect(v.speed).toBe(0);
    expect(v.angle).toBeCloseTo(-Math.PI / 2);
  });

  it('accelerates forward under throttle', () => {
    const v0 = createInitialVehicle(500, 500);
    const input: ControllerInput = {
      steer: 0,
      throttle: 1.0,
      brake: 0,
      nitro: false,
      seq: 1,
      timestamp: Date.now()
    };

    const v1 = updateVehicle(v0, input, 1.0); // 1 second
    expect(v1.speed).toBeGreaterThan(0);
    expect(v1.speed).toBeCloseTo(v0.accel, 1);
    expect(v1.y).toBeLessThan(500); // Moving up in screen coordinates
  });

  it('brakes and brings speed to zero', () => {
    const v0 = createInitialVehicle(500, 500);
    v0.speed = 100;

    const input: ControllerInput = {
      steer: 0,
      throttle: 0,
      brake: 1.0,
      nitro: false,
      seq: 2,
      timestamp: Date.now()
    };

    const v1 = updateVehicle(v0, input, 0.5);
    expect(v1.speed).toBeLessThan(100);
    expect(v1.isBraking).toBe(true);
  });

  it('nitro boosts acceleration and max speed', () => {
    const v0 = createInitialVehicle(500, 500);
    const normalInput: ControllerInput = {
      steer: 0,
      throttle: 1.0,
      brake: 0,
      nitro: false,
      seq: 1,
      timestamp: 0
    };
    const nitroInput: ControllerInput = {
      steer: 0,
      throttle: 1.0,
      brake: 0,
      nitro: true,
      seq: 2,
      timestamp: 0
    };

    const vNormal = updateVehicle(v0, normalInput, 0.5);
    const vNitro = updateVehicle(v0, nitroInput, 0.5);

    expect(vNitro.speed).toBeGreaterThan(vNormal.speed);
  });

  it('steers vehicle angle according to direction and speed', () => {
    const v0 = createInitialVehicle(500, 500);
    v0.speed = 200;

    const rightSteer: ControllerInput = {
      steer: 1.0,
      throttle: 0,
      brake: 0,
      nitro: false,
      seq: 1,
      timestamp: 0
    };

    const v1 = updateVehicle(v0, rightSteer, 0.5);
    expect(v1.angle).toBeGreaterThan(v0.angle); // Clockwise rotation
  });

  it('clamps vehicle coordinates to world boundaries', () => {
    const v0 = createInitialVehicle(10, 10);
    v0.speed = -200; // moving backward/out of bounds

    const input: ControllerInput = {
      steer: 0,
      throttle: 0,
      brake: 1.0,
      nitro: false,
      seq: 1,
      timestamp: 0
    };

    const v1 = updateVehicle(v0, input, 1.0, 1000, 1000);
    expect(v1.x).toBeGreaterThanOrEqual(50);
    expect(v1.y).toBeGreaterThanOrEqual(50);
  });
});
