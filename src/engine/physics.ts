import { ControllerInput, VehicleState } from '../types';

export function createInitialVehicle(x: number, y: number): VehicleState {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2, // Facing upwards
    speed: 0,
    maxSpeed: 380,       // pixels per second
    accel: 280,          // acceleration in px/s^2
    brakeForce: 420,     // braking in px/s^2
    friction: 90,        // ground drag in px/s^2
    turnSpeed: 3.2,      // radians per second at full steer
    isBraking: false,
    nitroActive: false
  };
}

/**
 * Updates vehicle state deterministically using fixed timestep dt.
 * Laptop authoritative: inputs are sanitized and bounded.
 */
export function updateVehicle(
  current: VehicleState,
  rawInput: ControllerInput,
  dt: number,
  worldWidth: number = 2000,
  worldHeight: number = 2000
): VehicleState {
  // Sanitize and clamp inputs
  const steer = Math.max(-1, Math.min(1, rawInput.steer || 0));
  const throttle = Math.max(0, Math.min(1, rawInput.throttle || 0));
  const brake = Math.max(0, Math.min(1, rawInput.brake || 0));
  const nitro = Boolean(rawInput.nitro);

  const next = { ...current };

  // Nitro multiplier
  const effectiveMaxSpeed = nitro ? next.maxSpeed * 1.5 : next.maxSpeed;
  const effectiveAccel = nitro ? next.accel * 1.6 : next.accel;
  next.nitroActive = nitro && next.speed > 10;

  // Longitudinal acceleration / braking
  if (throttle > 0) {
    next.speed += throttle * effectiveAccel * dt;
    if (next.speed > effectiveMaxSpeed) {
      next.speed = effectiveMaxSpeed;
    }
    next.isBraking = false;
  } else if (brake > 0) {
    next.isBraking = true;
    if (next.speed > 0) {
      next.speed -= brake * next.brakeForce * dt;
      if (next.speed < 0) next.speed = 0;
    } else {
      // Reverse gear up to -120 px/s
      next.speed -= brake * (next.accel * 0.5) * dt;
      if (next.speed < -120) next.speed = -120;
    }
  } else {
    // Natural friction / rolling resistance
    next.isBraking = false;
    if (next.speed > 0) {
      next.speed -= next.friction * dt;
      if (next.speed < 0) next.speed = 0;
    } else if (next.speed < 0) {
      next.speed += next.friction * dt;
      if (next.speed > 0) next.speed = 0;
    }
  }

  // Steering: turning authority scales with speed (can't pivot in place like a tank)
  const speedRatio = Math.min(1, Math.abs(next.speed) / (next.maxSpeed * 0.25));
  if (Math.abs(next.speed) > 1) {
    const direction = next.speed >= 0 ? 1 : -1;
    next.angle += steer * next.turnSpeed * speedRatio * direction * dt;
  }

  // Velocity components from angle and forward speed
  next.vx = Math.cos(next.angle) * next.speed;
  next.vy = Math.sin(next.angle) * next.speed;

  // Integrate position
  next.x += next.vx * dt;
  next.y += next.vy * dt;

  // Wrap around or clamp within bounds
  if (next.x < 50) next.x = 50;
  if (next.x > worldWidth - 50) next.x = worldWidth - 50;
  if (next.y < 50) next.y = 50;
  if (next.y > worldHeight - 50) next.y = worldHeight - 50;

  return next;
}
