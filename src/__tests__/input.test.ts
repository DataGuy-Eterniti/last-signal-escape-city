import { describe, it, expect } from 'vitest';
import { updateVehicle, createInitialVehicle } from '../engine/physics';
import { ControllerInput } from '../types';

describe('Input Validation and Clamping', () => {
  it('clamps excessive steering input to [-1, 1]', () => {
    const v0 = createInitialVehicle(500, 500);
    v0.speed = 100;

    const extremeInput: ControllerInput = {
      steer: 999.0, // Out of bounds
      throttle: 0,
      brake: 0,
      nitro: false,
      seq: 1,
      timestamp: 0
    };

    const normalInput: ControllerInput = {
      steer: 1.0,
      throttle: 0,
      brake: 0,
      nitro: false,
      seq: 1,
      timestamp: 0
    };

    const vExtreme = updateVehicle(v0, extremeInput, 0.1);
    const vNormal = updateVehicle(v0, normalInput, 0.1);

    expect(vExtreme.angle).toBeCloseTo(vNormal.angle, 4);
  });

  it('clamps excessive throttle input to [0, 1]', () => {
    const v0 = createInitialVehicle(500, 500);

    const extremeInput: ControllerInput = {
      steer: 0,
      throttle: 50.0, // Out of bounds
      brake: 0,
      nitro: false,
      seq: 1,
      timestamp: 0
    };

    const normalInput: ControllerInput = {
      steer: 0,
      throttle: 1.0,
      brake: 0,
      nitro: false,
      seq: 1,
      timestamp: 0
    };

    const vExtreme = updateVehicle(v0, extremeInput, 0.5);
    const vNormal = updateVehicle(v0, normalInput, 0.5);

    expect(vExtreme.speed).toBeCloseTo(vNormal.speed, 4);
  });
});
