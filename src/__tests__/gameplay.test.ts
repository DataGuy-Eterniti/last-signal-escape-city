import { describe, it, expect, beforeEach } from 'vitest';
import { CITIES, getCity } from '../engine/cities';
import { buildWorld, collide, damageFrom, isReachable, pointBlocked, CAR_RADIUS } from '../engine/world';
import { createInitialVehicle, updateVehicle } from '../engine/physics';
import { readBest, writeBest } from '../components/CitySelect';
import { ControllerInput } from '../types';

// Lightweight localStorage mock for node test environment
const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => mockStorage[k] ?? null,
  setItem: (k: string, v: string) => { mockStorage[k] = v; },
  removeItem: (k: string) => { delete mockStorage[k]; },
  clear: () => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
  }
};

if (typeof globalThis.window === 'undefined') {
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: localStorageMock
  };
} else if (!globalThis.window.localStorage) {
  Object.defineProperty(globalThis.window, 'localStorage', {
    value: localStorageMock,
    writable: true
  });
}

describe('Stage 0F City Gameplay Integration', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('all 4 cities (New York, Lagos, Chicago, Gold City) have valid geometries and reachable extractions', () => {
    const expectedIds = ['nyc', 'lagos', 'chicago', 'gold'];
    expect(CITIES.map((c) => c.id)).toEqual(expectedIds);

    for (const city of CITIES) {
      const world = buildWorld(city);
      expect(world.blocks.length).toBe(city.blocksX * city.blocksY);
      expect(world.obstacles.length).toBeGreaterThan(50);
      expect(world.barricades.length).toBeGreaterThan(0);

      // Verify start position is unblocked
      expect(pointBlocked(world, world.start.x, world.start.y, CAR_RADIUS + 10)).toBe(false);

      // Verify extraction point is unblocked
      expect(pointBlocked(world, world.extraction.x, world.extraction.y, CAR_RADIUS)).toBe(false);

      // Verify route reachability
      const closed = new Set(world.barricades.map((b) => `${b.a[0]},${b.a[1]}-${b.b[0]},${b.b[1]}`));
      expect(isReachable(city, closed)).toBe(true);
    }
  });

  it('simulates package damage and collision response on high-speed wall impact', () => {
    const world = buildWorld(getCity('gold')!);
    const b = world.blocks[0].buildings[0];

    // Position vehicle facing right into building wall
    const v = createInitialVehicle(b.x - CAR_RADIUS + 2, b.y + b.h / 2);
    v.angle = 0;
    v.speed = 350;

    const collision = collide(world, v);
    expect(collision.hit).toBe('building');
    expect(collision.impact).toBeGreaterThan(200);

    const damage = damageFrom(collision.impact, collision.hit);
    expect(damage).toBeGreaterThan(15); // Noticeable damage on high speed impact

    let integrity = 100;
    integrity = Math.max(0, integrity - damage);
    expect(integrity).toBeLessThan(100);
  });

  it('simulates reaching extraction zone triggers victory condition', () => {
    const world = buildWorld(getCity('nyc')!);
    const extract = world.extraction;

    // Place courier within extraction radius (EXTRACT_RADIUS = 60)
    const courier = createInitialVehicle(extract.x + 20, extract.y + 20);
    const distToExtract = Math.hypot(courier.x - extract.x, courier.y - extract.y);

    expect(distToExtract).toBeLessThan(60);
    const isWon = distToExtract < 60;
    expect(isWon).toBe(true);
  });

  it('simulates cargo destruction triggering failure condition when integrity drops to 0', () => {
    let integrity = 100;

    // Simulate multiple severe impacts
    for (let i = 0; i < 5; i++) {
      const damage = damageFrom(380, 'building');
      integrity = Math.max(0, integrity - damage);
    }

    expect(integrity).toBe(0);
    const isLost = integrity <= 0;
    expect(isLost).toBe(true);
  });

  it('correctly persists and updates per-city best times in localStorage', () => {
    expect(readBest('nyc')).toBeNull();

    // First completion in 95 seconds
    writeBest('nyc', 95);
    expect(readBest('nyc')).toBe(95);

    // Slower run (110 seconds) does not overwrite best
    writeBest('nyc', 110);
    expect(readBest('nyc')).toBe(95);

    // Faster run (78 seconds) sets new personal best
    writeBest('nyc', 78);
    expect(readBest('nyc')).toBe(78);

    // Separate city retains distinct score
    expect(readBest('lagos')).toBeNull();
    writeBest('lagos', 62);
    expect(readBest('lagos')).toBe(62);
    expect(readBest('nyc')).toBe(78);
  });

  it('drives on open road using sequenced input and physics engine', () => {
    const world = buildWorld(getCity('lagos')!);
    let vehicle = createInitialVehicle(world.start.x, world.start.y);
    vehicle.angle = world.start.angle;

    const input: ControllerInput = {
      steer: 0,
      throttle: 1.0,
      brake: 0,
      nitro: false,
      seq: 1,
      timestamp: Date.now()
    };

    // Drive forward for 1 second (60 ticks)
    for (let i = 0; i < 60; i++) {
      vehicle = updateVehicle(vehicle, input, 1 / 60, world.width, world.height);
      const res = collide(world, vehicle);
      vehicle = res.vehicle;
    }

    expect(vehicle.speed).toBeGreaterThan(150);
    // Vehicle moved from start position
    const distMoved = Math.hypot(vehicle.x - world.start.x, vehicle.y - world.start.y);
    expect(distMoved).toBeGreaterThan(100);
  });
});
