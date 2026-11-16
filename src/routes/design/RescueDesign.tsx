import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getCity } from '../../engine/cities';
import { PITCH, World, buildWorld, roadX, roadY } from '../../engine/world';
import { createActors, updateActors } from '../../engine/actors';
import { createInitialVehicle } from '../../engine/physics';
import { renderGame } from '../../engine/renderer';
import { VehicleState } from '../../types';
import { MissionSelect } from '../../components/MissionSelect';
import { MissionResult } from '../../components/hud/MissionResult';
import { RescueHud, RescueHudState } from '../../components/hud/RescueHud';
import { nextTurn } from '../../ui/hudModel';
import { BOARD_TIME, DROP_TIME, NAV_LEVELS, NavLevel, RescueState, Survivor, counts, currentObjective, planRescue, rescueMarkers, rescueScore, routePolylineTo } from '../../ui/rescue/rescueModel';
import { drawRescueWorld } from '../../ui/rescue/rescueCanvas';
import { Artboard, ConditionPanel, Section, TopBar, grid2 } from './kit';
import { fmtDist } from '../../components/hud/HudKit';

/* ==========================================================================
   /design — Gold Noir 3.0 Rescue Run previews.
   Real Lagos map, real traffic and officers, real rescue model; only the
   moment in time is staged. Every state also opens full-screen at
   /design?frame=rescue-<state> so it can be checked at true phone and
   laptop sizes (the HUD's compact breakpoints are viewport-based).
   ========================================================================== */

export type RescueKind = 'approach' | 'boarding' | 'guided' | 'unloading' | 'dropped' | 'survival';

interface Scenario {
  world: World;
  state: RescueState;
  car: VehicleState;
  kmh: number;
  vehicle: number;
  threat: RescueHudState['threat'];
  drop: RescueHudState['drop'];
  district: string;
}

/** Put the car in a lane beside a survivor, `dist` px back, facing them. */
function carNear(_world: World, v: { x: number; y: number }, dist: number): VehicleState {
  const ix = Math.round((v.x - roadX(0)) / PITCH);
  const iy = Math.round((v.y - roadY(0)) / PITCH);
  const dv = Math.abs(v.x - roadX(ix));
  const dh = Math.abs(v.y - roadY(iy));
  const car = createInitialVehicle(0, 0);
  if (dv < dh) {
    car.x = roadX(ix) + Math.sign(v.x - roadX(ix)) * 48;
    car.y = v.y + dist;
    car.angle = -Math.PI / 2;
  } else {
    car.y = roadY(iy) + Math.sign(v.y - roadY(iy)) * 48;
    car.x = v.x - dist;
    car.angle = 0;
  }
  car.speed = 0;
  return car;
}

export function buildScenario(kind: RescueKind, progress = 0.6): Scenario {
  const world = buildWorld(getCity('lagos')!);
  const nav: NavLevel = kind === 'guided' ? 'guided' : kind === 'survival' ? 'survival' : 'explorer';
  const state = planRescue(world, 'Medium', nav);
  const sv: Survivor[] = state.survivors;
  sv[1].status = 'rescued';
  sv[2].status = 'rescued';
  sv[3].status = 'lost';
  sv[5].patience = sv[5].patienceMax * 0.22; // urgent: red patience arc / marker
  state.time = 196;
  let car = carNear(world, sv[0], 210);
  let kmh = 46;
  let threat: Scenario['threat'] = null;
  let drop: Scenario['drop'] = null;
  switch (kind) {
    case 'approach':
      car.speed = 128;
      break;
    case 'boarding':
      car = carNear(world, sv[0], 30);
      sv[0].status = 'boarding';
      sv[0].board = progress;
      sv[4].status = 'onboard';
      kmh = 0;
      break;
    case 'guided':
      for (const k of [0, 4, 6]) sv[k].status = 'onboard';
      car = carNear(world, sv[4], 260);
      {
        // face along the first leg of the route to the safe zone
        const r = routePolylineTo(world, car.x, car.y, state.safe.x, state.safe.y);
        const nxt = r.find((p) => Math.hypot(p.x - car.x, p.y - car.y) > 60);
        if (nxt) car.angle = Math.atan2(nxt.y - car.y, nxt.x - car.x);
      }
      car.speed = 300;
      kmh = 108;
      threat = 'pursuit';
      break;
    case 'unloading':
      for (const k of [0, 4, 6]) sv[k].status = 'onboard';
      car = createInitialVehicle(state.safe.x, state.safe.y + 34);
      car.angle = -Math.PI / 2;
      state.dropProgress = progress;
      kmh = 0;
      break;
    case 'dropped':
      for (const k of [0, 4, 6]) sv[k].status = 'rescued';
      car = createInitialVehicle(state.safe.x, state.safe.y + 34);
      car.angle = -Math.PI / 2;
      drop = { count: 3, points: 3000 };
      kmh = 0;
      break;
    case 'survival':
      car = carNear(world, sv[5], 420);
      car.speed = 220;
      kmh = 79;
      threat = 'outbreak';
      break;
  }
  return { world, state, car, kmh, vehicle: kind === 'guided' ? 58 : 84, threat, drop, district: kind === 'unloading' || kind === 'dropped' ? 'Third Mainland' : 'Marina' };
}

export function hudFor(sc: Scenario): RescueHudState {
  const { world, state, car } = sc;
  const pol = NAV_LEVELS[state.nav];
  const obj = currentObjective(state, car);
  const boardingSurvivor = state.survivors.find((v) => v.status === 'boarding');
  return {
    counts: counts(state),
    capacity: state.capacity,
    objective: obj ? { kind: obj.kind, name: obj.label, distM: obj.distM, bearing: Math.atan2(obj.y - car.y, obj.x - car.x), time: state.time } : null,
    route: pol.ribbon && obj?.kind === 'safe' ? nextTurn(world, car.x, car.y, car.angle) : null,
    nav: state.nav,
    markers: rescueMarkers(state, car, state.nav),
    boarding: boardingSurvivor
      ? { mode: 'board', progress: boardingSurvivor.board, seconds: boardingSurvivor.board * BOARD_TIME, total: BOARD_TIME }
      : state.dropProgress > 0
        ? { mode: 'unload', progress: state.dropProgress, seconds: state.dropProgress * DROP_TIME, total: DROP_TIME }
        : null,
    drop: sc.drop,
    threat: sc.threat
  };
}

/** City + rescue overlay + HUD at any size. `animate` loops the 2 s boarding. */
export const RescueScene: React.FC<{ kind: RescueKind; w: number; h: number; animate?: boolean; dpr?: number }> = ({ kind, w, h, animate, dpr = 1 }) => {
  const sc = useMemo(() => buildScenario(kind), [kind]);
  const base = useRef<HTMLCanvasElement | null>(null);
  const over = useRef<HTMLCanvasElement | null>(null);
  const [hud, setHud] = useState<RescueHudState>(() => hudFor(sc));

  // static city frame
  useEffect(() => {
    const c = base.current;
    if (!c) return;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const actors = createActors(sc.world);
    for (let t = 0; t < 120; t++) updateActors(actors, sc.world, sc.car, 1 / 30, false);
    const obj = currentObjective(sc.state, sc.car);
    const route = NAV_LEVELS[sc.state.nav].ribbon && obj ? routePolylineTo(sc.world, sc.car.x, sc.car.y, obj.x, obj.y) : undefined;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderGame(ctx, w, h, sc.car, sc.world, { time: 1.2, actors, route });
  }, [sc, w, h, dpr]);

  // rescue overlay (animated)
  useEffect(() => {
    const c = over.current;
    if (!c) return;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let last = 0;
    const t0 = performance.now();
    const draw = (now: number) => {
      const t = (now - t0) / 1000 + 1.2;
      if (animate && kind === 'boarding') {
        const cyc = ((now - t0) / 1000 + 0.4) % (BOARD_TIME + 1.2); // starts mid-boarding
        const s0 = sc.state.survivors[0];
        s0.board = Math.min(1, cyc / BOARD_TIME);
        s0.status = s0.board >= 1 ? 'onboard' : 'boarding';
        if (now - last > 66) {
          last = now;
          setHud(hudFor(sc));
        }
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.setTransform(dpr, 0, 0, dpr, Math.round(w / 2 - sc.car.x) * dpr, Math.round(h / 2 - sc.car.y) * dpr);
      drawRescueWorld(ctx, sc.state, t);
      if (animate) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [sc, w, h, dpr, animate, kind]);

  const obj = hud.objective;
  const pol = NAV_LEVELS[hud.nav];
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: 'var(--ink-950)' }}>
      <canvas ref={base} style={{ position: 'absolute', inset: 0, width: w, height: h }} />
      <canvas ref={over} style={{ position: 'absolute', inset: 0, width: w, height: h }} />
      <div className="hud-root">
      <TopBar
        city="LAGOS"
        district={sc.district}
        objective={obj ? obj.name : 'All survivors accounted for'}
        dist={obj && pol.distances ? fmtDist(obj.distM) : '—'}
        clock="3:16"
        label={obj?.kind === 'safe' ? 'Safe zone' : 'Nearest survivor'}
        accent={obj?.kind === 'safe' ? 'var(--gold)' : '#fff6e4'}
      />
      <RescueHud state={hud} />
      <ConditionPanel kmh={sc.kmh} vehicle={sc.vehicle} />
      </div>
    </div>
  );
};

const resultStats = (sc: Scenario) => {
  const c = counts(sc.state);
  return [
    { label: 'Survivors saved', value: `${c.rescued}/${c.total}`, icon: 'survivor' as const, highlight: true },
    { label: 'Vehicle', value: `${sc.vehicle}%`, icon: 'vehicle' as const },
    { label: 'Lost', value: String(c.lost), icon: 'lost' as const, highlight: c.lost > 0 }
  ];
};

const RescueResultDemo: React.FC<{ all: boolean }> = ({ all }) => {
  const sc = useMemo(() => {
    const s = buildScenario('dropped');
    for (const v of s.state.survivors) v.status = all ? 'rescued' : v.status === 'waiting' ? 'lost' : v.status;
    if (all) s.vehicle = 91;
    return s;
  }, [all]);
  const score = rescueScore(sc.state, sc.vehicle);
  const noop = () => undefined;
  return (
    <MissionResult
      mode="rescue"
      outcome={all ? 'rescue-complete' : 'rescue-partial'}
      cityName="Lagos Island"
      line={all ? 'Every survivor reached the safe zone.' : 'Some made it out. The city will remember the rest.'}
      time={all ? 284 : 352}
      stats={resultStats(sc)}
      score={score}
      note={all ? 'Perfect rescue' : undefined}
      onRetry={noop}
      onMission={noop}
      onCity={noop}
    />
  );
};

/* ---------- sheet section ---------- */

export const RescueSection: React.FC = () => {
  const lagos = getCity('lagos')!;
  const noop = () => undefined;
  const scenes: [RescueKind, string, string][] = [
    ['approach', 'Explorer · approaching', 'Survivor markers appear within 900 m; white = waiting, red = patience low. Sonar pulse and waving flare read from a block away.'],
    ['boarding', 'Boarding · 2 s (animated)', 'Pickup ring turns solid gold; progress arc in the world and in the HUD card. Moving resets the timer.'],
    ['guided', 'Guided · full 3/3 · pursuit', 'Route ribbon to the safe zone, turn card, seats full; police-pursuit warning.'],
    ['unloading', 'Safe zone · unloading', 'Inward chevrons + white unload arc; HUD switches to the unloading card.'],
    ['dropped', 'Drop-off confirmed', '“3 survivors safe +3,000 pts”; counts move from Onboard to Rescued.'],
    ['survival', 'Survival · outbreak warning', 'No markers, no distances; objective shows “— m”. Outbreak banner for the future zombie mode.']
  ];
  return (
    <Section id="rescue" kicker="Gold Noir 3.0" title="Rescue Run" intro="Survivor markers, pickup and boarding, capacity, safe-zone drop-off, rescue HUD, results and the three navigation levels. Real Lagos map and traffic; open any state full-screen with the link under it.">
      <Artboard w={1366} h={900} label="Mission select · Rescue Run" note="Difficulty, survivor count, seats and estimated threat on the card; navigation level picker (Explorer default) in the briefing.">
        <MissionSelect city={lagos} onPick={noop} onBack={noop} onPair={noop} phoneLinked initialMission="rescue" />
      </Artboard>
      <div style={grid2}>
        {scenes.map(([k, label, note]) => (
          <div key={k}>
            <Artboard w={1366} h={768} label={label} note={note}>
              <RescueScene kind={k} w={1366} h={768} animate={k === 'boarding'} />
            </Artboard>
            <a href={`/design?frame=rescue-${k}`} style={{ fontSize: 11, color: 'var(--gold)' }}>
              Open full-screen ↗
            </a>
          </div>
        ))}
        <Artboard w={1366} h={768} label="Results · all saved" note="Score with breakdown: rescues, time, vehicle condition, clean-sweep bonus.">
          <RescueResultDemo all />
        </Artboard>
        <Artboard w={1366} h={768} label="Results · partial" note="Lost survivors subtract from the score.">
          <RescueResultDemo all={false} />
        </Artboard>
      </div>
    </Section>
  );
};

/* ---------- full-screen frames: /design?frame=rescue-<state> ---------- */

export const RescueFrame: React.FC<{ frame: string }> = ({ frame }) => {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const kind = frame.replace('rescue-', '');
  const noop = () => undefined;
  if (kind === 'missions') return <MissionSelect city={getCity('lagos')!} onPick={noop} onBack={noop} onPair={noop} phoneLinked initialMission="rescue" />;
  if (kind === 'results') return <RescueResultDemo all />;
  if (kind === 'results-partial') return <RescueResultDemo all={false} />;
  const valid: RescueKind[] = ['approach', 'boarding', 'guided', 'unloading', 'dropped', 'survival'];
  const k = (valid.includes(kind as RescueKind) ? kind : 'approach') as RescueKind;
  return <RescueScene kind={k} w={size.w} h={size.h} animate={k === 'boarding'} dpr={Math.min(2, window.devicePixelRatio || 1)} />;
};
