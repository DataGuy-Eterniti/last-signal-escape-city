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
    brakeForce: 450,     // braking in px/s^2
    friction: 95,        // ground drag in px/s^2
    turnSpeed: 2.8,      // balanced turning rate (rad/s)
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

  // Steering: speed-sensitive authority + cornering scrub + caster road-alignment
  const absSpeed = Math.abs(next.speed);
  if (absSpeed > 2) {
    // Cornering scrub: hard steering naturally bleeds speed for controlled cornering
    if (Math.abs(steer) > 0.25 && next.speed > 80) {
      const scrub = Math.min(next.speed - 80, (Math.abs(steer) - 0.25) * 110 * dt);
      next.speed -= scrub;
    }

    // Speed-sensitive steering authority:
    // - Low speed (<80 px/s): 0.70..1.0 authority for nimble maneuvering and parking
    // - Mid speed (80..200 px/s): 1.0 peak authority for sharp, controlled 90° intersection turns
    // - High speed (200..380 px/s): gently tapered (down to 0.72) to prevent oversteer while keeping turn authority
    let speedRatio: number;
    if (absSpeed < 80) {
      speedRatio = 0.70 + 0.30 * (absSpeed / 80);
    } else if (absSpeed <= 200) {
      speedRatio = 1.0;
    } else {
      const highSpeedFactor = (absSpeed - 200) / (effectiveMaxSpeed - 200);
      speedRatio = Math.max(0.72, 1.0 - 0.28 * Math.min(1, highSpeedFactor));
    }

    const direction = next.speed >= 0 ? 1 : -1;
    next.angle += steer * next.turnSpeed * speedRatio * direction * dt;

    // Caster Self-Centering / Road Alignment:
    // When the driver centers steering (|steer| < 0.10) and is moving forward,
    // gently stabilize heading parallel to the nearest cardinal road axis (0, ±π/2, ±π).
    // This allows rock-solid straight driving down avenues and crisp 90° corner exits.
    if (Math.abs(steer) < 0.10 && next.speed > 25) {
      const nearestCardinal = Math.round(next.angle / (Math.PI / 2)) * (Math.PI / 2);
      let dev = next.angle - nearestCardinal;
      while (dev > Math.PI) dev -= 2 * Math.PI;
      while (dev < -Math.PI) dev += 2 * Math.PI;

      if (Math.abs(dev) < 0.38) {
        const centerStrength = (1 - Math.abs(steer) / 0.10) * Math.min(1, next.speed / 100);
        next.angle -= dev * Math.min(1, 5.0 * dt) * centerStrength;
      }
    }
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
