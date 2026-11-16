/* ==========================================================================
   Controller input mapping — pure functions, no DOM.
   Turns raw touch state (stick vector, pedals, D-pad) into the existing
   ControllerInput fields { steer, throttle, brake }. The network packet
   shape is unchanged, so webrtc.ts / physics.ts need no edits.
   ========================================================================== */

export type ControlMode = 'classic' | 'advanced';
export type InputStyle = 'joystick' | 'dpad';

export interface ControlSettings {
  mode: ControlMode; // classic: stick steers, pedals drive · advanced: stick does both
  style: InputStyle; // analog stick or 8-way D-pad
  leftHanded: boolean; // mirror the cockpit
  haptics: boolean;
}

export const DEFAULT_SETTINGS: ControlSettings = { mode: 'classic', style: 'joystick', leftHanded: false, haptics: true };

export interface Vec {
  x: number; // -1 (left) … 1 (right)
  y: number; // -1 (back) … 1 (forward)
}

export const DEADZONE = 0.15;

/**
 * Pointer offset (px, screen space: +y is down) → normalised stick vector,
 * clamped to the unit circle with a radial dead zone that is rescaled so
 * output still reaches 1.0 at the rim (no "dead ring").
 */
export function stickVector(dx: number, dy: number, radius: number): Vec & { mag: number } {
  if (radius <= 0) return { x: 0, y: 0, mag: 0 };
  let x = dx / radius;
  let y = -dy / radius; // screen down → stick back
  const m = Math.hypot(x, y);
  if (m > 1) {
    x /= m;
    y /= m;
  }
  const mag = Math.min(1, m);
  if (mag < DEADZONE) return { x: 0, y: 0, mag: 0 };
  const scaled = (mag - DEADZONE) / (1 - DEADZONE);
  return { x: (x / mag) * scaled, y: (y / mag) * scaled, mag: scaled };
}

/** Gentle expo curve: fine control near centre, full lock at the rim. */
export const expo = (v: number, k = 0.4) => Math.sign(v) * (Math.abs(v) * (1 - k) + Math.abs(v) ** 3 * k);

export interface DpadState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

/** 8-way D-pad from a touch offset: 45° sectors, so one thumb can hit diagonals. */
export function dpadFrom(dx: number, dy: number, radius: number): DpadState {
  const none = { up: false, down: false, left: false, right: false };
  if (Math.hypot(dx, dy) < radius * 0.18) return none;
  const a = Math.atan2(-dy, dx); // 0 = right, π/2 = up
  const sector = Math.round(a / (Math.PI / 4)); // -4…4
  const s = ((sector % 8) + 8) % 8; // 0 right, 1 up-right, 2 up, 3 up-left, 4 left, 5 down-left, 6 down, 7 down-right
  return {
    right: s === 0 || s === 1 || s === 7,
    up: s === 1 || s === 2 || s === 3,
    left: s === 3 || s === 4 || s === 5,
    down: s === 5 || s === 6 || s === 7
  };
}

export const dpadVector = (d: DpadState): Vec => ({ x: (d.right ? 1 : 0) - (d.left ? 1 : 0), y: (d.up ? 1 : 0) - (d.down ? 1 : 0) });

export interface Pedals {
  gas: boolean;
  brake: boolean;
}

/**
 * Final mapping.
 * - classic: x steers; pedals control speed. Pushing the stick forward/back
 *   also accelerates/brakes, so diagonal gestures work without the pedals.
 * - advanced: x steers, y is throttle (forward) / brake-reverse (back);
 *   pedals are hidden and ignored.
 */
export function mapControls(settings: ControlSettings, v: Vec, pedals: Pedals): { steer: number; throttle: number; brake: number } {
  const steer = clamp(expo(v.x, 0.4));
  const fwd = Math.max(0, v.y);
  const back = Math.max(0, -v.y);
  if (settings.mode === 'advanced') return { steer, throttle: round(fwd), brake: round(back) };
  // Classic mode: pedals have priority. Brake pedal overrides gas pedal for safety.
  // When gas pedal is held and brake pedal is not, stick thumb arc cannot trigger stick braking.
  let throttle = 0;
  let brake = 0;
  if (pedals.brake) {
    brake = 1;
    throttle = 0;
  } else if (pedals.gas) {
    throttle = 1;
    brake = 0;
  } else {
    throttle = fwd;
    brake = back;
  }
  return { steer, throttle: round(throttle), brake: round(brake) };
}

const clamp = (n: number) => Math.round(Math.max(-1, Math.min(1, n)) * 1000) / 1000;
const round = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 1000) / 1000;

/** Link quality from round-trip time, for the 3-bar latency indicator. */
export function linkBars(pingMs: number): 0 | 1 | 2 | 3 {
  if (!pingMs) return 0;
  if (pingMs < 60) return 3;
  if (pingMs < 130) return 2;
  return 1;
}

const KEY = 'last-signal:controller';
export function loadSettings(): ControlSettings {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
export function saveSettings(s: ControlSettings) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — settings last for this session */
  }
}
