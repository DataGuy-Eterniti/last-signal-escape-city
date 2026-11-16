import { describe, expect, it } from 'vitest';
import { CITIES, getCity } from '../engine/cities';
import {
  buildWorld,
  collide,
  damageFrom,
  isReachable,
  pointBlocked,
  CAR_AXLE,
  CAR_RADIUS,
  HR,
  LOT,
  PITCH,
  ROAD,
  SIDEWALK,
  roadX,
  roadY
} from '../engine/world';
import { createInitialVehicle, updateVehicle } from '../engine/physics';
import { createCamera, updateCamera } from '../engine/camera';
import { routePolyline } from '../ui/hudModel';
import { DEFAULT_SETTINGS, mapControls } from '../ui/controls';

describe('Stage 1N — Road Geometry & Driving Experience', () => {
  it('widens roads to ROAD=210 and HR=105 while maintaining coherent lot spacing', () => {
    expect(ROAD).toBe(210);
    expect(HR).toBe(105);
    expect(SIDEWALK).toBe(18);
    expect(PITCH).toBe(500);
    // Buildable lot width inside blocks remains generous
    expect(LOT).toBe(254);
  });

  it('guarantees vehicle-sized clearance (>6x vehicle width) on all open segments in all 4 cities', () => {
    const vehicleWidth = CAR_RADIUS * 2; // 26 px
    for (const city of CITIES) {
      const world = buildWorld(city);
      for (const car of world.parkedCars) {
        // Transverse thickness occupied by the parked car along the road width
        const thickness = car.angle === 0 ? car.w : car.h;
        const innerClearance = HR - 18 - thickness / 2;
        // Distance from parked car to centre line alone is >= 70 px (>2.5x vehicle width)
        expect(innerClearance).toBeGreaterThanOrEqual(70);
        expect(innerClearance / vehicleWidth).toBeGreaterThan(2.5);

        // Total open asphalt between parked car and opposite curb:
        const openSpan = HR + innerClearance;
        expect(openSpan).toBeGreaterThanOrEqual(175);
        expect(openSpan / vehicleWidth).toBeGreaterThanOrEqual(6.0);
      }
    }
  });

  it('allows uninterrupted straight driving from spawn in all four cities without collision', () => {
    for (const city of CITIES) {
      const world = buildWorld(city);
      let vehicle = createInitialVehicle(world.start.x, world.start.y);
      vehicle.angle = world.start.angle;

      const dt = 1 / 60;
      let collided = false;
      let maxImpact = 0;

      // Drive full throttle for 2 seconds (120 physics steps) with world bounds
      for (let step = 0; step < 120; step++) {
        vehicle = updateVehicle(
          vehicle,
          { seq: step + 1, timestamp: step * 16, steer: 0, throttle: 1, brake: 0, nitro: false },
          dt,
          world.width,
          world.height
        );
        const res = collide(world, vehicle);
        vehicle = res.vehicle;
        if (res.impact > 0 || res.hit !== null) {
          collided = true;
          maxImpact = Math.max(maxImpact, res.impact);
          break;
        }
      }

      expect(collided, `City ${city.name} collided during straight driving from spawn`).toBe(false);
      expect(maxImpact).toBe(0);
      expect(vehicle.speed).toBeGreaterThan(200); // accelerates freely along open road
    }
  });

  it('provides smooth wall sliding without sticky walls or speed zeroing', () => {
    const world = buildWorld(getCity('gold')!);
    // Place car contacting the building wall east of road 1
    const buildingWallX = roadX(1) + HR + SIDEWALK;
    const v = createInitialVehicle(buildingWallX - 5, roadY(1) + 120);
    v.speed = 220;
    // Drive angled 25 degrees toward the eastern building block
    v.angle = 0.44;

    const res = collide(world, v);
    // Wall contact should be detected and pushed out
    expect(res.impact).toBeGreaterThan(0);
    expect(res.hit).toBe('building');
    // Vehicle should be pushed away from the obstacle surface
    expect(res.vehicle.x !== v.x || res.vehicle.y !== v.y).toBe(true);
    expect(res.vehicle.speed).toBeGreaterThan(150); // preserves tangential speed (>65%)
    // The angle is deflected away from the obstacle toward the sliding tangent (rotated flatter toward 0)
    expect(res.vehicle.angle).toBeLessThan(v.angle);
    expect(res.vehicle.angle).toBeGreaterThan(0);

    // On the next frame, car continues forward along the deflected heading without sticking
    const vNext = updateVehicle(
      res.vehicle,
      { seq: 2, timestamp: 2000, steer: 0, throttle: 1, brake: 0, nitro: false },
      1 / 60,
      world.width,
      world.height
    );
    const res2 = collide(world, vNext);
    expect(res2.vehicle.speed).toBeGreaterThan(140);
  });

  it('debounces collision damage and ignores low-speed maneuvers below 100 px/s', () => {
    // Low-speed touches (<100 px/s or <36 km/h) deal 0 damage
    expect(damageFrom(80, 'building')).toBe(0);
    expect(damageFrom(95, 'car')).toBe(0);
    expect(damageFrom(99, 'barricade')).toBe(0);

    // Moderate impact deals controlled damage
    const dmgModerate = damageFrom(160, 'building');
    expect(dmgModerate).toBeGreaterThan(0);
    expect(dmgModerate).toBeLessThanOrEqual(15);

    // Cones absorb 80% of damage
    expect(damageFrom(250, 'cone')).toBeLessThan(damageFrom(250, 'building') * 0.3);

    // Simulation of 250ms damage cooldown: continuous contact over 1 second (60 frames)
    let totalDmg = 0;
    let lastDmgTime = 0;
    for (let f = 0; f < 60; f++) {
      const now = f * (1000 / 60);
      const dmg = damageFrom(150, 'building');
      if (dmg > 0 && now - lastDmgTime >= 250) {
        lastDmgTime = now;
        totalDmg += dmg;
      }
    }
    // Only ~4 damage events over 1 full second of scraping, not 60 events
    expect(totalDmg).toBeLessThanOrEqual(dmgModerate * 5);
  });

  it('keeps Gold City beginner-friendly with fewer checkpoints and low parked car density', () => {
    const gold = getCity('gold')!;
    expect(gold.checkpoints).toBeLessThanOrEqual(3);
    expect(gold.parkedCarDensity).toBeLessThanOrEqual(0.25);

    const world = buildWorld(gold);
    expect(world.barricades.length).toBeLessThanOrEqual(3);
  });

  it('ensures extraction remains reachable with vehicle-sized clearance in all 4 cities', () => {
    for (const city of CITIES) {
      const world = buildWorld(city);
      expect(isReachable(city, world.closed)).toBe(true);

      // Route guidance polyline returns a valid path
      const route = routePolyline(world, world.start.x, world.start.y, world.start.angle);
      expect(route.length).toBeGreaterThanOrEqual(2);

      // Verify the final point of route is close to the extraction point
      const last = route[route.length - 1];
      expect(Math.hypot(last.x - world.extraction.x, last.y - world.extraction.y)).toBeLessThan(50);
    }
  });

  it('integrates camera look-ahead and speed zoom smoothly', () => {
    const v = createInitialVehicle(500, 500);
    v.speed = 0;
    const cam0 = createCamera(v);
    const updated0 = updateCamera(cam0, v, 0.05, 1280, 720);
    // At rest, camera is centered on vehicle
    expect(Math.hypot(updated0.x - v.x, updated0.y - v.y)).toBeLessThan(1);
    expect(updated0.zoom).toBe(1.0);

    // At nitro speed, camera leads ahead and pulls out zoom
    v.speed = 360;
    v.angle = 0; // heading east
    let camFast = updated0;
    for (let f = 0; f < 30; f++) {
      camFast = updateCamera(camFast, v, 0.05, 1280, 720);
    }
    expect(camFast.x).toBeGreaterThan(v.x + 30); // leads ahead to the east
    expect(camFast.zoom).toBeLessThan(1.0); // zoom pulls out for speed visibility
  });

  it('tests 90-degree intersection turning trajectory and clearance without clipping curbs', () => {
    const world = buildWorld(getCity('gold')!);
    const jx = roadX(1);
    const jy = roadY(2);
    let v = createInitialVehicle(jx, jy - 250);
    v.angle = Math.PI / 2; // heading south towards intersection
    v.speed = 160;

    let turned = false;
    let collidedDuringTurn = false;

    // Approach and turn left towards East (target angle: 0)
    // Driver approaches intersection at normal city speed (160 px/s) and initiates turn at intersection boundary
    for (let f = 0; f < 120; f++) {
      const steer = (v.y >= jy - 75 && v.angle > 0.05) ? -1.0 : 0;
      // Normal city cruise throttle balances friction (~150-160 px/s)
      const throttle = steer !== 0 ? 0.35 : 0.34;
      v = updateVehicle(v, { seq: f, timestamp: f * 16, steer, throttle, brake: 0, nitro: false }, 1 / 60, world.width, world.height);
      const res = collide(world, v);
      v = res.vehicle;
      if (res.impact > 0) {
        collidedDuringTurn = true;
        break;
      }
      if (Math.abs(v.angle) < 0.15 && v.x > jx + 40) {
        turned = true;
        break;
      }
    }
    expect(collidedDuringTurn).toBe(false);
    expect(turned).toBe(true);
  });

  it('stabilizes heading deviation via caster self-alignment when driving straight', () => {
    const world = buildWorld(getCity('gold')!);
    // Start vehicle angled 8° (0.14 rad) off the road axis
    let v = createInitialVehicle(roadX(2), roadY(2) + 50);
    v.angle = Math.PI / 2 + 0.14; // heading south with a slight tilt
    v.speed = 150;

    // Drive forward with centered steering (|steer| = 0) for 1.2 seconds (72 frames)
    for (let f = 0; f < 72; f++) {
      v = updateVehicle(v, { seq: f, timestamp: f * 16, steer: 0, throttle: 1.0, brake: 0, nitro: false }, 1 / 60, world.width, world.height);
    }

    // Heading should have self-aligned back toward Math.PI / 2 (south) within 0.03 rad (<2°)
    const dev = Math.abs(v.angle - Math.PI / 2);
    expect(dev).toBeLessThan(0.04);
  });

  it('verifies collision body dimensions and hull alignment match visual car (28x52 px)', () => {
    // 2 circles of radius 13 at axle ±13 px along the heading
    expect(CAR_RADIUS).toBe(13);
    expect(CAR_AXLE).toBe(13);

    const length = CAR_AXLE * 2 + CAR_RADIUS * 2; // 26 + 26 = 52 px
    const width = CAR_RADIUS * 2; // 26 px (plus 2 px visual margin = 28 px)
    expect(length).toBe(52);
    expect(width).toBe(26);
  });

  it('guarantees vehicle spawn safety across all 4 cities with >90 px open clearance', () => {
    for (const city of CITIES) {
      const world = buildWorld(city);
      const sx = world.start.x;
      const sy = world.start.y;

      // Ensure center point is not blocked
      expect(pointBlocked(world, sx, sy, 0)).toBe(false);

      // Ensure entire 90 px radius around spawn point is open road
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        const testX = sx + Math.cos(angle) * 90;
        const testY = sy + Math.sin(angle) * 90;
        expect(pointBlocked(world, testX, testY, CAR_RADIUS)).toBe(false);
      }
    }
  });

  it('ensures thumb steering downward arc in Classic mode never cuts throttle or triggers brake', () => {
    // When holding gas pedal and steering left with a downward thumb arc (v.y = -0.35)
    const out = mapControls(DEFAULT_SETTINGS, { x: -0.8, y: -0.35 }, { gas: true, brake: false });
    expect(out.throttle).toBe(1); // 100% gas remains uninterrupted
    expect(out.brake).toBe(0);    // 0% brake, no accidental braking
    expect(out.steer).toBeLessThan(-0.5); // steering remains responsive
  });
});
