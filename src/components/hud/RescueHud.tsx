import React from 'react';
import type { ObjectiveState, RouteHint } from '../../ui/hudModel';
import { NAV_LEVELS, NavLevel, RescueCounts, SurvivorMarker } from '../../ui/rescue/rescueModel';
import { AlertBanner, ObjectiveChip, RouteCard, fmtDist } from './HudKit';
import { IconCompass, IconLost, IconSafeZone, IconSeat, IconSurvivor } from './Icons';

/* ==========================================================================
   Rescue Run HUD (Gold Noir 3.0). Same slot grammar as Crime / Zombie:
   objective top-centre, guidance top-left, status top-right, transient
   cards bottom-centre. White = people, gold = objectives.
   ========================================================================== */

export interface RescueHudState {
  counts: RescueCounts;
  capacity: number;
  objective: (ObjectiveState & { kind: 'survivor' | 'safe' }) | null;
  route: RouteHint | null; // Guided only
  nav: NavLevel;
  markers: SurvivorMarker[];
  boarding: { mode: 'board' | 'unload'; progress: number; seconds: number; total: number } | null;
  drop: { count: number; points: number } | null; // recent drop-off confirmation
  threat: 'pursuit' | 'outbreak' | null;
}

/* ---------- waiting / onboard / rescued / lost ---------- */

const Count: React.FC<{ icon: React.ReactNode; value: number; label: string; color: string; dim?: boolean }> = ({ icon, value, label, color, dim }) => (
  <div style={{ display: 'grid', justifyItems: 'center', gap: 3, minWidth: 54, opacity: dim ? 0.5 : 1 }}>
    <span style={{ color }}>{icon}</span>
    <span className="serif num" style={{ fontSize: 24, lineHeight: 1, color: 'var(--cream)' }}>
      {value}
    </span>
    <span className="hud-label hud-hide-compact" style={{ fontSize: 7, letterSpacing: '0.18em' }}>
      {label}
    </span>
  </div>
);

export const RescueCounter: React.FC<{ counts: RescueCounts }> = ({ counts }) => (
  <div className="hud-panel" style={{ padding: '10px 12px' }} role="group" aria-label={`${counts.waiting} waiting, ${counts.onboard} onboard, ${counts.rescued} rescued, ${counts.lost} lost`}>
    <div className="hud-hide-compact" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, padding: '0 2px' }}>
      <span className="hud-label">Survivors</span>
      <span className="kicker num" style={{ fontSize: 9, color: 'var(--gold-pale)' }}>
        {counts.rescued}/{counts.total} saved
      </span>
    </div>
    <div style={{ display: 'flex', gap: 4 }}>
      <Count icon={<IconSurvivor size={16} />} value={counts.waiting} label="Waiting" color="#fff6e4" />
      <Count icon={<IconSeat size={16} filled />} value={counts.onboard} label="Onboard" color="var(--gold)" />
      <Count icon={<IconSafeZone size={16} />} value={counts.rescued} label="Rescued" color="var(--gold)" />
      <Count icon={<IconLost size={16} />} value={counts.lost} label="Lost" color="var(--ember)" dim={counts.lost === 0} />
    </div>
  </div>
);

/* ---------- capacity seats ---------- */

export const CapacitySeats: React.FC<{ onboard: number; capacity: number; unloading?: boolean }> = ({ onboard, capacity, unloading }) => {
  const full = onboard >= capacity;
  return (
    <div className="hud-panel" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 12, borderColor: full ? 'rgba(255,195,77,0.6)' : 'var(--line)' }} aria-label={`${onboard} of ${capacity} seats taken`}>
      <div style={{ display: 'flex', gap: 3 }}>
        {Array.from({ length: capacity }, (_, k) => (
          <span key={k} style={{ color: k < onboard ? 'var(--gold)' : 'rgba(241,216,168,0.25)', filter: k < onboard ? 'drop-shadow(0 0 5px rgba(255,195,77,0.6))' : 'none', transition: 'color 300ms' }}>
            <IconSeat size={20} filled={k < onboard} />
          </span>
        ))}
      </div>
      <div>
        <div className="serif num" style={{ fontSize: 20, lineHeight: 1, color: full ? 'var(--gold)' : 'var(--cream)' }}>
          {onboard}/{capacity} <span style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>onboard</span>
        </div>
        <div className="hud-hide-compact" style={{ fontSize: 10, color: full ? 'var(--gold)' : 'var(--muted)', marginTop: 2 }}>{unloading ? 'Unloading at the safe zone' : full ? 'Full: head to the safe zone' : onboard > 0 ? 'Room for more, or drop off now' : 'Pick up survivors'}</div>
      </div>
    </div>
  );
};

/* ---------- 2 s boarding / unloading progress ---------- */

export const BoardingCard: React.FC<{ b: NonNullable<RescueHudState['boarding']> }> = ({ b }) => {
  const size = 58;
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const unload = b.mode === 'unload';
  return (
    <div className="hud-panel" role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 18px 10px 12px', borderColor: 'rgba(255,195,77,0.6)', animation: 'scaleIn 280ms var(--ease-out) both' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(241,216,168,0.12)" strokeWidth={5} fill="none" />
          <circle cx={size / 2} cy={size / 2} r={r} stroke={unload ? '#fff6e4' : 'var(--gold)'} strokeWidth={5} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - b.progress)} style={{ transition: 'stroke-dashoffset 100ms linear' }} />
        </svg>
        <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: unload ? '#fff6e4' : 'var(--gold)' }}>{unload ? <IconSafeZone size={22} /> : <IconSurvivor size={22} />}</span>
      </div>
      <div>
        <div style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 11, letterSpacing: '0.26em', textTransform: 'uppercase', color: unload ? '#fff6e4' : 'var(--gold)' }}>{unload ? 'Unloading' : 'Boarding'}</div>
        <div className="serif num" style={{ fontSize: 20, color: 'var(--cream)', lineHeight: 1.1 }}>
          {b.seconds.toFixed(1)}s <span style={{ color: 'var(--muted)', fontSize: 14 }}>/ {b.total}s</span>
        </div>
        <div className="hud-hide-compact" style={{ fontSize: 10, color: 'var(--muted)' }}>Hold still. Moving resets the timer.</div>
      </div>
    </div>
  );
};

/* ---------- drop-off confirmation ---------- */

export const DropConfirm: React.FC<{ drop: NonNullable<RescueHudState['drop']> }> = ({ drop }) => (
  <div className="hud-panel" role="status" aria-live="assertive" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', borderColor: 'var(--gold)', boxShadow: '0 0 40px rgba(255,195,77,0.25)', animation: 'scaleIn 360ms var(--ease-out) both' }}>
    <span style={{ color: 'var(--gold)', filter: 'drop-shadow(0 0 8px rgba(255,195,77,0.7))' }}>
      <IconSafeZone size={30} />
    </span>
    <div>
      <div className="serif" style={{ fontSize: 22, color: 'var(--cream)', lineHeight: 1.05 }}>
        {drop.count} survivor{drop.count === 1 ? '' : 's'} safe
      </div>
      <div className="kicker num" style={{ fontSize: 10, color: 'var(--gold)', marginTop: 3 }}>
        +{drop.points.toLocaleString()} pts
      </div>
    </div>
  </div>
);

/* ---------- navigation level badge ---------- */

export const NavBadge: React.FC<{ nav: NavLevel }> = ({ nav }) => (
  <div className="hud-panel hud-hide-compact" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', alignSelf: 'flex-start', borderRadius: 999 }} title={NAV_LEVELS[nav].blurb}>
    <span style={{ color: 'var(--gold)' }}>
      <IconCompass size={14} />
    </span>
    <span className="kicker" style={{ fontSize: 8, color: 'var(--gold-pale)' }}>
      Nav · {NAV_LEVELS[nav].label}
    </span>
  </div>
);

/* ---------- survivor edge markers ---------- */

export const SurvivorRing: React.FC<{ markers: SurvivorMarker[]; distances: boolean }> = ({ markers, distances }) => (
  <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6 }}>
    {markers.map((m) => {
      const color = m.kind === 'safe' ? 'var(--gold)' : m.urgent ? 'var(--ember)' : '#fff6e4';
      return (
        <div
          key={`${m.kind}-${m.id}`}
          style={{ position: 'absolute', left: `calc(50% + ${Math.cos(m.angle) * 40}%)`, top: `calc(50% + ${Math.sin(m.angle) * 33}%)`, transform: 'translate(-50%, -50%)', display: 'grid', justifyItems: 'center', gap: 2, transition: 'left 120ms linear, top 120ms linear' }}
        >
          <div className={m.urgent ? 'danger-pip' : undefined} style={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(16,10,5,0.85)', border: `1.5px solid ${color}`, color, boxShadow: `0 0 12px ${m.kind === 'safe' ? 'rgba(255,195,77,0.5)' : 'rgba(255,246,228,0.35)'}`, position: 'relative' }}>
            {m.kind === 'safe' ? <IconSafeZone size={16} /> : <IconSurvivor size={16} />}
            <svg width={10} height={10} viewBox="0 0 10 10" style={{ position: 'absolute', left: 15 + Math.cos(m.angle) * 19 - 5, top: 15 + Math.sin(m.angle) * 19 - 5, transform: `rotate(${m.angle}rad)` }}>
              <path d="M2 1 9 5 2 9Z" fill={color} />
            </svg>
          </div>
          {distances && (
            <span className="kicker num" style={{ fontSize: 8, color, textShadow: '0 1px 3px #000' }}>
              {fmtDist(m.distM)}
            </span>
          )}
        </div>
      );
    })}
  </div>
);

/** Objective chip for the game's top bar in Rescue mode (replaces the Extraction chip). */
export const RescueObjectiveChip: React.FC<{ objective: NonNullable<RescueHudState['objective']>; showDistance: boolean }> = ({ objective, showDistance }) => (
  <ObjectiveChip
    objective={showDistance ? objective : { ...objective, distM: NaN }}
    label={objective.kind === 'safe' ? 'Safe zone' : 'Nearest survivor'}
    accent={objective.kind === 'safe' ? 'var(--gold)' : '#fff6e4'}
  />
);

/* ---------- full HUD ---------- */

export const RescueHud: React.FC<{ state: RescueHudState }> = ({ state }) => {
  const pol = NAV_LEVELS[state.nav];
  return (
    <>
      {state.threat === 'pursuit' && (
        <>
          <div className="siren-wash red" />
          <div className="siren-wash blue" />
        </>
      )}
      {state.threat === 'outbreak' && <div className="toxic-wash" />}
      <SurvivorRing markers={state.markers} distances={pol.distances} />

      <div className="hud-slot hud-tc" style={{ display: 'grid', justifyItems: 'center', gap: 8 }}>
        {state.threat === 'pursuit' && <AlertBanner tone="pursuit" title="Pursuit" detail="Police are tailing the rescue van. Shake them before the drop-off." />}
        {state.threat === 'outbreak' && <AlertBanner tone="infected" title="Outbreak" detail="Infected moving toward the survivors. Prioritise red markers." />}
      </div>

      <div className="hud-slot hud-tl">
        {pol.ribbon && <RouteCard route={state.route} />}
        <NavBadge nav={state.nav} />
      </div>

      <div className="hud-slot hud-tr">
        <RescueCounter counts={state.counts} />
        <CapacitySeats onboard={state.counts.onboard} capacity={state.capacity} unloading={state.boarding?.mode === 'unload'} />
      </div>

      <div className="hud-slot hud-rescue-card">{state.drop ? <DropConfirm drop={state.drop} /> : state.boarding ? <BoardingCard b={state.boarding} /> : null}</div>
    </>
  );
};
