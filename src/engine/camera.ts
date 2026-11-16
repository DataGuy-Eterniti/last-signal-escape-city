import { VehicleState } from '../types';

/* ==========================================================================
   Driving camera (visual only — never touches physics or collisions).
   - Look-ahead: the view leads the car in its direction of travel, so the
     next junction appears sooner. At cruising speed the car sits ~1/4 of
     the screen behind centre.
   - Speed zoom: pulls out up to 18% at top speed for a wider view of turns.
   - Critically damped smoothing, so braking or crashing never jerks the view.
   ========================================================================== */

export interface Camera {
  x: number;
  y: number;
  zoom: number; // 1 = native, <1 = zoomed out
}

export const LOOK_AHEAD_S = 0.55; // seconds of travel the camera leads by
export const MAX_LEAD = 0.27; // fraction of the shorter screen side
export const MIN_ZOOM = 0.82;
export const ZOOM_AT = 520; // px/s at which zoom reaches MIN_ZOOM (nitro territory)

export function createCamera(v: VehicleState): Camera {
  return { x: v.x, y: v.y, zoom: 1 };
}

const approach = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

export function updateCamera(cam: Camera, v: VehicleState, dt: number, viewW: number, viewH: number): Camera {
  const speed = v.speed;
  const fwd = Math.max(0, speed); // reversing keeps the car centred
  const maxLead = Math.min(viewW, viewH) * MAX_LEAD;
  const lead = Math.min(maxLead, fwd * LOOK_AHEAD_S);
  const tx = v.x + Math.cos(v.angle) * lead;
  const ty = v.y + Math.sin(v.angle) * lead;
  const tz = 1 - (1 - MIN_ZOOM) * Math.min(1, Math.abs(speed) / ZOOM_AT);
  return {
    x: approach(cam.x, tx, 4.5, dt),
    y: approach(cam.y, ty, 4.5, dt),
    zoom: approach(cam.zoom, tz, 1.6, dt)
  };
}
