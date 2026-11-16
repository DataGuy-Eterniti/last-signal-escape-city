import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, Keyboard, QrCode, X, ArrowLeft, Flame, Navigation, Map as MapIcon, Shield } from 'lucide-react';
import { ControllerInput, NetworkPacket, RoomConnectionState, VehicleState } from '../types';
import { createInitialVehicle, updateVehicle } from '../engine/physics';
import { renderGame, prewarm, cityThumbnail } from '../engine/renderer';
import { buildWorld, collide, damageFrom, districtAt, METERS_PER_PX, World } from '../engine/world';
import { CityProfile, getCity } from '../engine/cities';
import { Actors, collideTraffic, createActors, updateActors } from '../engine/actors';
import { GameHostNetwork } from '../network/webrtc';
import { InputReceiver } from '../network/inputReceiver';
import { generateRoomCode } from '../utils/room';
import { Letters, SpeedArc } from '../components/Ornaments';
import { CitySelect, fmtTime, readBest, writeBest } from '../components/CitySelect';
import { getControllerUrl } from '../utils/url';
import { MissionSelect } from '../components/MissionSelect';
import { CrimeHud } from '../components/hud/CrimeHud';
import { Meter } from '../components/hud/HudKit';
import { IconCargo, IconWrench } from '../components/hud/Icons';
import { MissionResult, Outcome, ResultStat } from '../components/hud/MissionResult';
import { Mission, getMission } from '../ui/missions';
import { CrimeHudState, HeatEvent, PURSUIT_AT, dangerMarkers, nextTurn } from '../ui/hudModel';
import { CrimeRun, createCrimeRun, crimeStep } from '../ui/crimeDirector';
import { HEAT_LABELS } from '../components/hud/CrimeHud';

const i = (n: number) => ({ ['--i' as string]: n } as React.CSSProperties);
const MAX_KMH = 220;
const STEP = 1 / 120; // fixed physics step — deterministic and tunnel-free at nitro speed
const EXTRACT_RADIUS = 60;

type Phase = 'select' | 'mission' | 'play' | 'won' | 'lost';

interface Hud {
  kmh: number;
  nitro: boolean;
  source: 'keyboard' | 'phone';
  integrity: number;
  time: number;
  distM: number;
  bearing: number; // radians, screen space
  district: string;
}

/** Minimap: cached city thumbnail + live markers, redrawn only on HUD ticks (~10 Hz). */
const Minimap: React.FC<{ world: World; x: number; y: number; angle: number }> = ({ world, x, y, angle }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const SIZE = 168;
  useEffect(() => {
    const c = ref.current;
    const base = cityThumbnail(world, SIZE);
    if (!c || !base) return;
    if (c.width !== base.width) {
      c.width = base.width;
      c.height = base.height;
    }
    const m = c.getContext('2d');
    if (!m) return;
    m.drawImage(base, 0, 0);
    const s = base.width / world.width;
    m.save();
    m.translate(x * s, y * s);
    m.rotate(angle + Math.PI / 2);
    m.fillStyle = '#fff3d1';
    m.beginPath();
    m.moveTo(0, -6);
    m.lineTo(4.5, 5);
    m.lineTo(-4.5, 5);
    m.closePath();
    m.fill();
    m.restore();
  }, [world, x, y, angle]);
  return <canvas ref={ref} style={{ display: 'block', borderRadius: 8 }} aria-label="Minimap" />;
};

export const GameRoute: React.FC<{ onExit?: () => void }> = ({ onExit }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // City / phase
  const [city, setCity] = useState<CityProfile | null>(() => getCity(new URLSearchParams(window.location.search).get('city')) ?? null);
  const [mission, setMission] = useState<Mission | null>(() => {
    const m = getMission(new URLSearchParams(window.location.search).get('mission'));
    return m?.available ? m : null;
  });
  const missionRef = useRef<Mission | null>(mission);
  missionRef.current = mission;
  const [phase, setPhase] = useState<Phase>(() => (city ? (mission ? 'play' : 'mission') : 'select'));
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const world = useMemo(() => (city ? buildWorld(city) : null), [city]);
  const worldRef = useRef<World | null>(world);
  worldRef.current = world;

  // Connection and Room state
  const [roomCode] = useState<string>(() => generateRoomCode());
  const [networkState, setNetworkState] = useState<RoomConnectionState>({
    status: 'disconnected',
    roomId: null,
    pingMs: 0,
    packetsReceived: 0,
    lastPacketTime: 0
  });
  const [showPairingModal, setShowPairingModal] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);
  const [flash, setFlash] = useState(0);
  const [result, setResult] = useState<{ time: number; best: number | null; newBest: boolean; outcome: Outcome; stats: ResultStat[] } | null>(null);
  const [crimeHud, setCrimeHud] = useState<CrimeHudState | null>(null);
  const crimeRef = useRef<CrimeRun | null>(null);

  const [hud, setHud] = useState<Hud>({
    kmh: 0,
    nitro: false,
    source: 'keyboard',
    integrity: 100,
    time: 0,
    distM: 0,
    bearing: 0,
    district: ''
  });
  const inputSourceRef = useRef<'keyboard' | 'phone'>('keyboard');

  // Live simulation state
  const vehicleRef = useRef<VehicleState>(createInitialVehicle(1000, 1000));
  const integrityRef = useRef(100);
  const elapsedRef = useRef(0);
  const shakeRef = useRef(0);
  const activeInputRef = useRef<ControllerInput>({ steer: 0, throttle: 0, brake: 0, nitro: false, seq: 0, timestamp: Date.now() });
  const keysDownRef = useRef<{ [key: string]: boolean }>({});
  const lastPacketTimeRef = useRef<number>(0);
  // latest-input-wins: drops stale / out-of-order phone packets, falls back to neutral after 250 ms
  const receiverRef = useRef(new InputReceiver());
  const wasConnectedRef = useRef<boolean>(false);
  const districtRef = useRef('');
  const actorsRef = useRef<Actors | null>(null);
  const lastFireToastRef = useRef(0);

  // Adaptive resolution (keeps 60 FPS on integrated GPUs)
  const scaleRef = useRef(Math.min(window.devicePixelRatio || 1, 1));
  const frameAvgRef = useRef(16.7);

  const resetRun = useCallback((w: World) => {
    const v = createInitialVehicle(w.start.x, w.start.y);
    v.angle = w.start.angle;
    vehicleRef.current = v;
    integrityRef.current = 100;
    elapsedRef.current = 0;
    shakeRef.current = 0;
    districtRef.current = '';
    actorsRef.current = createActors(w);
    crimeRef.current = missionRef.current?.id === 'crime' ? createCrimeRun(actorsRef.current, w) : null;
    setCrimeHud(null);
    setResult(null);
    prewarm(w, w.start.x, w.start.y);
  }, []);

  useEffect(() => {
    if (world) resetRun(world);
  }, [world, mission, resetRun]);

  const pickCity = (c: CityProfile) => {
    const url = new URL(window.location.href);
    url.searchParams.set('city', c.id);
    window.history.replaceState({}, '', url.toString());
    setCity(c);
    setPhase('mission');
  };

  const pickMission = (m: Mission) => {
    const url = new URL(window.location.href);
    url.searchParams.set('mission', m.id);
    window.history.replaceState({}, '', url.toString());
    setMission(m);
    missionRef.current = m;
    if (world) resetRun(world);
    setPhase('play');
    if (networkState.status !== 'connected') setShowPairingModal(true);
  };

  const backToMission = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('mission');
    window.history.replaceState({}, '', url.toString());
    setPhase('mission');
  };

  const backToSelect = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('city');
    url.searchParams.delete('mission');
    window.history.replaceState({}, '', url.toString());
    setPhase('select');
    setCity(null);
  };

  const restart = () => {
    if (world) resetRun(world);
    setPhase('play');
  };

  // 1. WebRTC host (starts immediately so the phone can pair during city select)
  useEffect(() => {
    const handleNetworkMessage = (packet: NetworkPacket) => {
      if ('steer' in packet) {
        if (receiverRef.current.receive(packet)) {
          lastPacketTimeRef.current = Date.now();
          activeInputRef.current = receiverRef.current.getActiveInput();
        }
      }
    };
    const host = new GameHostNetwork(roomCode, handleNetworkMessage, (state) => {
      setNetworkState(state);
      if (state.status === 'connected') {
        setShowPairingModal(false);
        if (!wasConnectedRef.current) {
          receiverRef.current.reset(); // a reloaded phone restarts its sequence at 1
          setToast('Phone connected');
        }
        wasConnectedRef.current = true;
      } else if (wasConnectedRef.current && state.status !== 'reconnecting') {
        wasConnectedRef.current = false;
        receiverRef.current.reset();
        setToast('Phone disconnected — keyboard active');
      }
    });
    host.init();
    return () => host.destroy();
  }, [roomCode]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  // 2. Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysDownRef.current[e.code] = true;
      if (e.code === 'KeyP') setShowPairingModal((p) => !p);
      if (e.code === 'Escape') setShowPairingModal(false);
      if (e.code === 'KeyR' && (phaseRef.current === 'play' || phaseRef.current === 'won' || phaseRef.current === 'lost') && worldRef.current) {
        resetRun(worldRef.current);
        setPhase('play');
      }
    };
    const up = (e: KeyboardEvent) => {
      keysDownRef.current[e.code] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [resetRun]);

  // 3. Fixed-timestep simulation + render loop
  useEffect(() => {
    let animId = 0;
    let last = performance.now();
    let acc = 0;
    let lastScaleCheck = last;
    const t0 = last;

    const loop = (now: number) => {
      animId = requestAnimationFrame(loop);
      const frameMs = now - last;
      const dt = Math.min(frameMs / 1000, 0.1);
      last = now;
      frameAvgRef.current = frameAvgRef.current * 0.95 + frameMs * 0.05;

      const w = worldRef.current;
      const canvas = canvasRef.current;
      if (!w || !canvas || phaseRef.current === 'select' || phaseRef.current === 'mission') return; // nothing to draw behind the menus

      const keys = keysDownRef.current;
      const kbdSteer = (keys['ArrowRight'] || keys['KeyD'] ? 1 : 0) - (keys['ArrowLeft'] || keys['KeyA'] ? 1 : 0);
      const kbdThrottle = keys['ArrowUp'] || keys['KeyW'] ? 1 : 0;
      const kbdBrake = keys['ArrowDown'] || keys['KeyS'] ? 1 : 0;
      const kbdNitro = Boolean(keys['ShiftLeft'] || keys['ShiftRight'] || keys['Space']);
      const hasKbdInput = kbdSteer !== 0 || kbdThrottle !== 0 || kbdBrake !== 0 || kbdNitro;
      const phoneInputRecent = receiverRef.current.isRecent(Date.now(), 250);

      let input: ControllerInput;
      if (hasKbdInput || !phoneInputRecent) {
        input = { steer: kbdSteer, throttle: kbdThrottle, brake: kbdBrake, nitro: kbdNitro, seq: 0, timestamp: Date.now() };
        inputSourceRef.current = 'keyboard';
      } else {
        input = receiverRef.current.getActiveInput(Date.now(), 250);
        inputSourceRef.current = 'phone';
      }

      const heatEvents: HeatEvent[] = [];
      let crashDamage = 0;
      if (phaseRef.current === 'play') {
        acc += dt;
        while (acc >= STEP) {
          acc -= STEP;
          const moved = updateVehicle(vehicleRef.current, input, STEP, w.width, w.height);
          const res = collide(w, moved);
          const actors = actorsRef.current;
          const tr = actors ? collideTraffic(actors, res.vehicle) : { vehicle: res.vehicle, impact: 0, hit: null };
          vehicleRef.current = tr.vehicle;
          for (const hit of [res, tr]) {
            const dmg = damageFrom(hit.impact, hit.hit);
            if (dmg > 0) {
              crashDamage += dmg;
              if (hit.hit === 'traffic' && !heatEvents.includes('traffic-crash')) heatEvents.push('traffic-crash');
              integrityRef.current = Math.max(0, integrityRef.current - dmg);
              shakeRef.current = Math.min(14, shakeRef.current + hit.impact / 40);
              if (hit.impact > 160) setFlash((f) => f + 1);
            }
          }
        }
        elapsedRef.current += dt;

      } else {
        acc = 0;
      }

      // living city: traffic always moves; officers only open fire after a 2 s grace period while you drive
      const actors = actorsRef.current;
      let bulletDamage = 0;
      if (actors) {
        const ev = updateActors(actors, w, vehicleRef.current, Math.min(dt, 0.05), phaseRef.current === 'play' && elapsedRef.current > 2);
        if (ev.shotsFired > 0) heatEvents.push('shot-at');
        if (ev.officerStunned) heatEvents.push('officer-down');
        if (ev.bulletDamage > 0 && phaseRef.current === 'play') {
          bulletDamage = ev.bulletDamage;
          heatEvents.push('hit');
          integrityRef.current = Math.max(0, integrityRef.current - ev.bulletDamage);
          shakeRef.current = Math.min(14, shakeRef.current + 5);
          setFlash((f) => f + 1);
        }
        if (ev.shotsFired > 0 && !crimeRef.current && now - lastFireToastRef.current > 6000) {
          lastFireToastRef.current = now;
          setToast('Under fire — break line of sight');
        }
      }

      // mission rules + outcome
      if (phaseRef.current === 'play') {
        const v = vehicleRef.current;
        const crime = crimeRef.current;
        const loss = crime
          ? crimeStep(crime, { t: elapsedRef.current, dt: Math.min(dt, 0.05), events: heatEvents, crashDamage, bulletDamage, world: w, vehicle: v, actors })
          : null;
        const finish = (outcome: Outcome, won: boolean) => {
          const time = elapsedRef.current;
          const prev = readBest(w.city.id);
          const isCourier = !crime;
          if (won && isCourier) writeBest(w.city.id, time);
          const stats: ResultStat[] = [{ label: 'Package', value: `${Math.round(integrityRef.current)}%`, icon: 'cargo', highlight: integrityRef.current < 30 }];
          if (crime) {
            stats.push({ label: 'Vehicle', value: `${Math.round(crime.vehicle)}%`, icon: 'vehicle', highlight: crime.vehicle < 30 });
            stats.push({ label: `Peak heat · ${HEAT_LABELS[Math.min(5, Math.floor(crime.peakHeat))]}`, value: `${Math.floor(crime.peakHeat)}/5`, icon: 'heat', highlight: crime.peakHeat >= PURSUIT_AT });
          }
          setResult({ time, best: prev, newBest: won && isCourier && (prev === null || time < prev), outcome, stats });
          setPhase(won ? 'won' : 'lost');
        };
        if (Math.hypot(v.x - w.extraction.x, v.y - w.extraction.y) < EXTRACT_RADIUS) finish('escaped', true);
        else if (integrityRef.current <= 0) finish('package-lost', false);
        else if (loss) finish(loss, false);
      }

      // adaptive resolution: drop to 0.75× if frames run long, recover when smooth
      if (now - lastScaleCheck > 2000) {
        lastScaleCheck = now;
        const cap = Math.min(window.devicePixelRatio || 1, 1);
        if (frameAvgRef.current > 19 && scaleRef.current > 0.75) scaleRef.current = Math.max(0.75, scaleRef.current - 0.125);
        else if (frameAvgRef.current < 14 && scaleRef.current < cap) scaleRef.current = Math.min(cap, scaleRef.current + 0.125);
      }
      const cssW = window.innerWidth;
      const cssH = window.innerHeight;
      const pw = Math.round(cssW * scaleRef.current);
      const ph = Math.round(cssH * scaleRef.current);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
        ctxRef.current = null;
      }
      if (!ctxRef.current) ctxRef.current = canvas.getContext('2d', { alpha: false, desynchronized: true });
      const ctx = ctxRef.current;
      if (!ctx) return;

      shakeRef.current *= 0.88;
      const sh = shakeRef.current;
      ctx.setTransform(scaleRef.current, 0, 0, scaleRef.current, 0, 0);
      renderGame(ctx, cssW, cssH, vehicleRef.current, w, {
        time: (now - t0) / 1000,
        shakeX: sh > 0.3 ? (Math.random() - 0.5) * sh : 0,
        shakeY: sh > 0.3 ? (Math.random() - 0.5) * sh : 0,
        actors: actorsRef.current ?? undefined
      });
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // HUD sampler (~10 Hz)
  useEffect(() => {
    const t = window.setInterval(() => {
      const w = worldRef.current;
      if (!w) return;
      const v = vehicleRef.current;
      const dx = w.extraction.x - v.x;
      const dy = w.extraction.y - v.y;
      const district = districtAt(w, v.x, v.y);
      if (phaseRef.current === 'play' && district !== districtRef.current) {
        if (districtRef.current) setToast(district);
        districtRef.current = district;
      }
      setHud({
        kmh: Math.round(Math.abs(v.speed) * 0.36),
        nitro: v.nitroActive,
        source: inputSourceRef.current,
        integrity: Math.round(integrityRef.current),
        time: elapsedRef.current,
        distM: Math.hypot(dx, dy) * METERS_PER_PX,
        bearing: Math.atan2(dy, dx),
        district
      });
      const crime = crimeRef.current;
      if (crime && phaseRef.current !== 'select' && phaseRef.current !== 'mission') {
        setCrimeHud({
          heat: crime.heat.value,
          pursuit: crime.heat.value >= PURSUIT_AT,
          vehicleHealth: crime.vehicle,
          integrity: integrityRef.current,
          markers: dangerMarkers(actorsRef.current, v),
          radio: crime.radio,
          route: nextTurn(w, v.x, v.y, v.angle),
          objective: { name: w.extraction.name, distM: Math.hypot(dx, dy) * METERS_PER_PX, bearing: Math.atan2(dy, dx), time: elapsedRef.current }
        });
      }
    }, 100);
    return () => window.clearInterval(t);
  }, []);

  const controllerUrl = getControllerUrl(roomCode);
  const connected = networkState.status === 'connected';
  const statusText = connected
    ? `Phone linked · ${networkState.pingMs} ms`
    : networkState.status === 'error'
      ? 'Signal error — reload to retry'
      : networkState.status === 'reconnecting'
        ? 'Re-establishing signal…'
        : `Room ${roomCode} · awaiting phone`;
  const integrityColor = hud.integrity > 60 ? 'var(--gold)' : hud.integrity > 30 ? '#e9a06a' : '#e0583a';
  const dist = hud.distM >= 1000 ? `${(hud.distM / 1000).toFixed(1)} km` : `${Math.round(hud.distM)} m`;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: 'var(--ink-950)' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

      {phase === 'select' && (
        <CitySelect onPick={pickCity} onBack={onExit} onPair={() => setShowPairingModal(true)} phoneLinked={connected} />
      )}

      {phase === 'mission' && city && (
        <MissionSelect city={city} onPick={pickMission} onBack={backToSelect} onPair={() => setShowPairingModal(true)} phoneLinked={connected} />
      )}

      {phase !== 'select' && phase !== 'mission' && world && (
        <>
          {mission?.id === 'crime' && crimeHud && phase === 'play' && <CrimeHud state={crimeHud} />}
          {/* Crash flash */}
          {flash > 0 && (
            <div
              key={flash}
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                boxShadow: 'inset 0 0 160px rgba(224, 88, 58, 0.55)',
                animation: 'pageOut 520ms var(--ease-soft) both'
              }}
            />
          )}

          {/* Top HUD */}
          <header
            style={{ position: 'absolute', top: 20, left: 24, right: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pointerEvents: 'none', gap: 16 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <button
                onClick={backToMission}
                className="glass-light reveal-fade"
                aria-label="Change mission"
                style={{ ...i(0), pointerEvents: 'auto', width: 40, height: 40, display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--gold-pale)' }}
              >
                <ArrowLeft size={16} />
              </button>
              <div className="reveal" style={i(1)}>
                <div className="serif gold-text" style={{ fontSize: 26, lineHeight: 1, letterSpacing: '0.06em' }}>
                  {world.city.name.toUpperCase()}
                </div>
                <div className="kicker" style={{ fontSize: 9, marginTop: 4 }}>
                  {hud.district || world.city.region}
                </div>
              </div>
              <div className="glass-light reveal" style={{ ...i(2), display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', pointerEvents: 'auto' }}>
                <span className={`dot ${connected ? 'ok' : networkState.status === 'error' ? 'warn' : ''}`} />
                <span style={{ fontSize: 12, color: 'var(--gold-pale)', letterSpacing: '0.04em' }} className="num">
                  {statusText}
                </span>
              </div>
            </div>

            {/* Objective */}
            <div className="glass reveal" style={{ ...i(3), display: 'flex', alignItems: 'center', gap: 14, padding: '10px 18px', borderRadius: 999 }}>
              <Navigation
                size={18}
                color="var(--gold)"
                style={{ transform: `rotate(${hud.bearing + Math.PI / 4}rad)`, transition: 'transform 120ms linear' }}
              />
              <div>
                <div className="kicker" style={{ fontSize: 8 }}>
                  Extraction
                </div>
                <div className="serif" style={{ fontSize: 17, color: 'var(--cream)', lineHeight: 1.1 }}>
                  {world.extraction.name}
                </div>
              </div>
              <span className="serif num" style={{ fontSize: 20, color: 'var(--gold)', minWidth: 64, textAlign: 'right' }}>
                {dist}
              </span>
              <span className="kicker num" style={{ fontSize: 10, color: 'var(--gold-pale)', borderLeft: '1px solid var(--line)', paddingLeft: 12 }}>
                {fmtTime(hud.time)}
              </span>
            </div>

            <button
              onClick={() => setShowPairingModal((p) => !p)}
              className="btn btn-ghost reveal"
              style={{ ...i(4), pointerEvents: 'auto', padding: '10px 18px', background: 'rgba(20,12,6,0.6)' }}
            >
              <QrCode size={15} />
              {connected ? 'Re-pair' : 'Pair phone'}
            </button>
          </header>

          {/* Speed + integrity — bottom left */}
          <div className="glass reveal" style={{ ...i(5), position: 'absolute', bottom: 24, left: 24, padding: '16px 22px 16px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ position: 'relative', width: 112, height: 112 }}>
              <SpeedArc value={hud.kmh / MAX_KMH} nitro={hud.nitro} size={112} />
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
                <div>
                  <div className="serif num" style={{ fontSize: 38, lineHeight: 1, color: 'var(--cream)' }}>
                    {hud.kmh}
                  </div>
                  <div className="kicker" style={{ fontSize: 8, letterSpacing: '0.28em' }}>
                    km/h
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, minWidth: 150 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gold-pale)' }}>
                {hud.source === 'phone' ? <Smartphone size={14} /> : <Keyboard size={14} />}
                <span className="serif" style={{ fontSize: 17 }}>
                  {hud.source === 'phone' ? 'Phone' : 'Keyboard'}
                </span>
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: hud.nitro ? 'var(--gold)' : 'var(--dim)' }}>
                  <Flame size={11} /> Nitro
                </span>
              </div>
              {mission?.id === 'crime' && crimeHud ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <Meter label="Vehicle" value={crimeHud.vehicleHealth} icon={<IconWrench size={12} />} compact />
                  <Meter label="Package" value={crimeHud.integrity} icon={<IconCargo size={12} />} compact />
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span className="kicker" style={{ fontSize: 8, display: 'flex', gap: 5, alignItems: 'center' }}>
                      <Shield size={10} /> Package
                    </span>
                    <span className="num" style={{ fontSize: 11, color: integrityColor }}>
                      {hud.integrity}%
                    </span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'rgba(241,216,168,0.1)', overflow: 'hidden' }}>
                    <div style={{ width: `${hud.integrity}%`, height: '100%', background: integrityColor, transition: 'width 200ms, background 300ms' }} />
                  </div>
                </div>
              )}
              <div className="kicker" style={{ fontSize: 8, color: 'var(--dim)' }}>
                R restart · P pair
              </div>
            </div>
          </div>

          {/* Minimap — bottom right */}
          <div className="glass reveal" style={{ ...i(6), position: 'absolute', bottom: 24, right: 24, padding: 10 }}>
            <div className="kicker" style={{ fontSize: 8, display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 8px 2px' }}>
              <MapIcon size={10} /> {world.city.name}
            </div>
            <Minimap world={world} x={vehicleRef.current.x} y={vehicleRef.current.y} angle={vehicleRef.current.angle} />
          </div>

          {/* Result overlay (mode-aware) */}
          {(phase === 'won' || phase === 'lost') && result && (
            <MissionResult
              mode={mission?.id ?? 'courier'}
              outcome={result.outcome}
              cityName={world.city.name}
              time={result.time}
              stats={result.stats}
              line={
                {
                  escaped: mission?.id === 'crime' ? `You shook the police and made ${world.extraction.name}.` : `You made ${world.extraction.name} in ${fmtTime(result.time)}.`,
                  'package-lost': 'Too much damage — the cargo didn’t survive the city.',
                  wrecked: 'The car gave out before the police did.',
                  busted: 'You stopped too close to the law. Cuffs on, cargo seized.',
                  extracted: `The evac lifted off with you aboard.`,
                  overrun: 'The horde closed in before you reached the evac.',
                  'evac-missed': 'The last airlift left without you.'
                }[result.outcome]
              }
              note={result.newBest ? 'New best time' : !mission || mission.id === 'courier' ? (result.best !== null && phase === 'won' ? `Best ${fmtTime(result.best)}` : undefined) : undefined}
              onRetry={restart}
              onMission={backToMission}
              onCity={backToSelect}
            />
          )}
        </>
      )}

      {/* Toast */}
      {toast && (
        <div
          key={toast}
          className="glass-light"
          style={{ position: 'absolute', top: 88, left: '50%', padding: '10px 20px', fontSize: 13, color: 'var(--gold-pale)', animation: 'toastIn 500ms var(--ease-out) both', display: 'flex', alignItems: 'center', gap: 10, zIndex: 90 }}
        >
          <span className={`dot ${connected ? 'ok' : ''}`} /> <span className="serif" style={{ fontSize: 16, fontStyle: 'italic' }}>{toast}</span>
        </div>
      )}

      {/* Pairing modal */}
      {showPairingModal && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(80% 80% at 50% 40%, rgba(40,24,10,0.72), rgba(10,6,3,0.9))',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 100,
            animation: 'fadeIn 420ms var(--ease-out) both',
            padding: 20
          }}
          onClick={() => setShowPairingModal(false)}
        >
          <div className="rays" style={{ opacity: 0.6 }} />
          <div
            className="glass reveal-scale"
            onClick={(e) => e.stopPropagation()}
            style={{
              ...i(0),
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              gap: 36,
              padding: '36px 40px',
              maxWidth: 760,
              width: '100%',
              borderColor: 'var(--line-strong)'
            }}
          >
            <button
              onClick={() => setShowPairingModal(false)}
              aria-label="Close"
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <span className="kicker reveal" style={i(1)}>
                Pair your controller
              </span>
              <div className="hairline reveal" style={{ ...i(2), margin: '14px 0 16px' }} />
              <h2 className="serif" style={{ fontSize: 44, lineHeight: 1, fontWeight: 400, color: 'var(--cream)' }}>
                <Letters text="Your phone" />
                <br />
                <span className="gold-text">
                  <Letters text="is the wheel" />
                </span>
              </h2>

              <ol style={{ listStyle: 'none', margin: '24px 0 26px', display: 'grid', gap: 12 }}>
                {[
                  'Open the signal on your phone or scan the code',
                  'Scan the code with your phone camera',
                  'Turn your phone sideways and drive'
                ].map((t, idx) => (
                  <li key={t} className="reveal" style={{ ...i(4 + idx), display: 'flex', gap: 14, alignItems: 'baseline' }}>
                    <span className="serif num" style={{ color: 'var(--gold)', fontSize: 18, width: 20 }}>
                      {idx + 1}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--gold-pale)' }}>{t}</span>
                  </li>
                ))}
              </ol>

              <div className="reveal" style={{ ...i(7), display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button className="btn btn-gold" onClick={() => setShowPairingModal(false)}>
                  <Keyboard size={15} /> Drive with keyboard
                </button>
              </div>
              <span className="reveal" style={{ ...i(8), fontSize: 11, color: 'var(--dim)', marginTop: 12 }}>
                Press P any time to reopen this panel.
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              {/* QR code (retained) on cream with a gold frame */}
              <div
                className="reveal-scale"
                style={{
                  ...i(3),
                  padding: 14,
                  borderRadius: 16,
                  background: 'var(--cream)',
                  boxShadow: '0 0 0 1px rgba(255,195,77,0.6), 0 0 0 7px rgba(255,195,77,0.08), 0 20px 50px rgba(0,0,0,0.5)'
                }}
              >
                <QRCodeSVG value={controllerUrl} size={188} bgColor="#f6ebd3" fgColor="#1f1206" level="M" />
              </div>

              <div className="reveal" style={{ ...i(5), textAlign: 'center' }}>
                <div className="kicker" style={{ fontSize: 9, marginBottom: 8 }}>
                  Room code
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  {roomCode.split('').map((ch, idx) => (
                    <span
                      key={idx}
                      className="serif reveal-scale num"
                      style={{
                        ...i(6 + idx),
                        width: 42,
                        height: 50,
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 30,
                        color: 'var(--gold)',
                        border: '1px solid var(--line-strong)',
                        borderRadius: 10,
                        background: 'rgba(255,195,77,0.05)'
                      }}
                    >
                      {ch}
                    </span>
                  ))}
                </div>
              </div>

              <a
                href={controllerUrl}
                target="_blank"
                rel="noreferrer"
                className="reveal"
                style={{ ...i(10), fontSize: 10, color: 'var(--muted)', maxWidth: 220, wordBreak: 'break-all', textAlign: 'center', textDecoration: 'none' }}
              >
                {controllerUrl}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
