import React from 'react';
import { DangerMarker, ObjectiveState, RadioMessage, RouteHint, TurnKind } from '../../ui/hudModel';
import { IconCrosshair, IconFlag, IconHorde, IconRadio, IconSiren } from './Icons';

/* ==========================================================================
   Shared HUD primitives for every mission mode. Presentational only:
   everything arrives through props (see ui/hudModel.ts).
   ========================================================================== */

export const fmtDist = (m: number) => (!Number.isFinite(m) ? '— m' : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.max(0, Math.round(m / 10) * 10)} m`);
export const fmtClock = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

export const toneFor = (v: number) => (v > 60 ? 'var(--gold)' : v > 30 ? '#e9a06a' : 'var(--ember)');

/* ---------- segmented condition meter ---------- */

export const Meter: React.FC<{
  label: string;
  value: number; // 0–100
  icon: React.ReactNode;
  segments?: number;
  accent?: string;
  compact?: boolean;
}> = ({ label, value, icon, segments = 10, accent, compact }) => {
  const v = Math.max(0, Math.min(100, value));
  const color = accent ?? toneFor(v);
  const lit = Math.ceil((v / 100) * segments);
  const critical = v <= 25;
  return (
    <div style={{ minWidth: compact ? 120 : 150 }} aria-label={`${label} ${Math.round(v)} percent`} role="meter" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, color }}>
        <span className={critical ? 'blink' : undefined} style={{ display: 'flex' }}>
          {icon}
        </span>
        <span className="hud-label" style={{ color: 'var(--muted)' }}>
          {label}
        </span>
        <span className="num" style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color }}>
          {Math.round(v)}%
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${segments}, 1fr)`, gap: 2 }}>
        {Array.from({ length: segments }, (_, k) => (
          <span
            key={k}
            style={{
              height: compact ? 4 : 6,
              borderRadius: 1.5,
              background: k < lit ? color : 'rgba(241,216,168,0.09)',
              boxShadow: k < lit && k === lit - 1 ? `0 0 8px ${color}` : 'none',
              transition: 'background 200ms'
            }}
          />
        ))}
      </div>
    </div>
  );
};

/* ---------- pip row (heat stars / threat level) ---------- */

export const PipRow: React.FC<{
  value: number; // fractional 0–max
  max?: number;
  render: (filled: boolean, k: number) => React.ReactNode;
  color: string;
  label: string;
}> = ({ value, max = 5, render, color, label }) => (
  <div style={{ display: 'flex', gap: 4 }} role="img" aria-label={`${label} ${Math.floor(value)} of ${max}`}>
    {Array.from({ length: max }, (_, k) => {
      const fill = Math.max(0, Math.min(1, value - k));
      return (
        <span key={k} style={{ position: 'relative', color: fill > 0 ? color : 'rgba(241,216,168,0.22)', transition: 'color 300ms' }}>
          {render(fill >= 1, k)}
          {fill > 0 && fill < 1 && (
            <span style={{ position: 'absolute', left: 0, right: 0, bottom: -4, height: 2, background: color, transform: `scaleX(${fill})`, transformOrigin: 'left', borderRadius: 1 }} />
          )}
        </span>
      );
    })}
  </div>
);

/* ---------- screen-edge danger markers ---------- */

const KIND_COLOR: Record<DangerMarker['kind'], string> = { police: 'var(--siren)', gunman: 'var(--ember)', horde: 'var(--toxic)' };

export const DangerRing: React.FC<{ markers: DangerMarker[] }> = ({ markers }) => (
  <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6 }}>
    {markers.map((m) => {
      const c = KIND_COLOR[m.kind];
      const size = 16 + m.proximity * 16;
      return (
        <div
          key={`${m.kind}-${m.id}`}
          style={{
            position: 'absolute',
            left: `calc(50% + ${Math.cos(m.angle) * 42}%)`,
            top: `calc(50% + ${Math.sin(m.angle) * 36}%)`,
            transform: `translate(-50%, -50%) rotate(${m.angle}rad)`,
            opacity: 0.35 + m.proximity * 0.65,
            transition: 'left 120ms linear, top 120ms linear'
          }}
        >
          <div className={m.firing ? 'danger-pip' : undefined} style={{ width: size, height: size, color: c, filter: `drop-shadow(0 0 6px ${c})` }}>
            <svg viewBox="0 0 24 24" width={size} height={size}>
              <path d="M6 4 20 12 6 20 9 12Z" fill="currentColor" />
            </svg>
          </div>
        </div>
      );
    })}
  </div>
);

/* ---------- police / evac radio ---------- */

export const RadioFeed: React.FC<{ messages: RadioMessage[]; channel?: string; accent?: string }> = ({ messages, channel = 'Police radio', accent = 'var(--siren)' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 300, maxWidth: '42vw' }} aria-live="polite">
    {messages.slice(-3).map((m) => (
      <div
        key={m.id}
        className="hud-panel radio-in"
        style={{
          padding: '8px 12px',
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
          borderLeft: `2px solid ${m.tone === 'alert' ? 'var(--ember)' : m.tone === 'success' ? 'var(--gold)' : accent}`
        }}
      >
        <span style={{ color: m.tone === 'alert' ? 'var(--ember)' : accent, marginTop: 1 }}>
          <IconRadio size={14} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="hud-label" style={{ fontSize: 8, color: m.tone === 'alert' ? 'var(--ember)' : 'var(--muted)' }}>
            {channel} · {m.from}
          </div>
          <div style={{ fontSize: 12, color: 'var(--cream)', lineHeight: 1.35, marginTop: 2 }}>{m.text}</div>
        </div>
      </div>
    ))}
  </div>
);

/* ---------- route guidance ---------- */

export const TurnGlyph: React.FC<{ turn: TurnKind; size?: number }> = ({ turn, size = 30 }) => {
  if (turn === 'arrive') return <IconFlag size={size} />;
  const paths: Record<Exclude<TurnKind, 'arrive'>, string> = {
    straight: 'M12 21V4M6 10l6-6 6 6',
    left: 'M16 21v-7a4 4 0 0 0-4-4H5M9 6l-4 4 4 4',
    right: 'M8 21v-7a4 4 0 0 1 4-4h7M15 6l4 4-4 4',
    uturn: 'M8 21V9a4 4 0 0 1 8 0v6M12 12l4 4 4-4'
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[turn]} />
    </svg>
  );
};

const TURN_TEXT: Record<TurnKind, string> = { straight: 'Continue on', left: 'Turn left onto', right: 'Turn right onto', uturn: 'Turn around on', arrive: 'Arriving at' };

export const RouteCard: React.FC<{ route: RouteHint | null; accent?: string }> = ({ route, accent = 'var(--gold)' }) => {
  if (!route) return null;
  return (
    <div className="hud-panel" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px 10px 12px' }} aria-live="polite">
      <div style={{ width: 44, height: 44, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'rgba(255,195,77,0.08)', border: '1px solid var(--line)', color: accent }}>
        <TurnGlyph turn={route.turn} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="serif num" style={{ fontSize: 22, color: accent, lineHeight: 1 }}>
          {route.distM < 15 && route.turn !== 'straight' ? 'Now' : fmtDist(route.distM)}
        </div>
        <div style={{ fontSize: 11, color: 'var(--gold-pale)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
          {TURN_TEXT[route.turn]} <strong style={{ fontWeight: 600, color: 'var(--cream)' }}>{route.street}</strong>
        </div>
      </div>
    </div>
  );
};

/* ---------- objective chip (extraction + bearing + clock) ---------- */

export const ObjectiveChip: React.FC<{ objective: ObjectiveState; label?: string; accent?: string; clock?: React.ReactNode }> = ({
  objective,
  label = 'Extraction',
  accent = 'var(--gold)',
  clock
}) => (
  <div className="hud-panel" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 18px', borderRadius: 999 }}>
    <svg width={20} height={20} viewBox="0 0 24 24" style={{ transform: `rotate(${objective.bearing + Math.PI / 2}rad)`, transition: 'transform 120ms linear', color: accent }} aria-hidden="true">
      <path d="M12 3 19 20 12 16 5 20Z" fill="currentColor" />
    </svg>
    <div>
      <div className="hud-label" style={{ fontSize: 8 }}>
        {label}
      </div>
      <div className="serif" style={{ fontSize: 17, color: 'var(--cream)', lineHeight: 1.1 }}>
        {objective.name}
      </div>
    </div>
    <span className="serif num" style={{ fontSize: 20, color: accent, minWidth: 64, textAlign: 'right' }}>
      {fmtDist(objective.distM)}
    </span>
    <span className="kicker num" style={{ fontSize: 10, color: 'var(--gold-pale)', borderLeft: '1px solid var(--line)', paddingLeft: 12 }}>
      {clock ?? fmtClock(objective.time)}
    </span>
  </div>
);

/* ---------- top-centre alert banner ---------- */

export const AlertBanner: React.FC<{
  tone: 'pursuit' | 'infected' | 'info';
  title: string;
  detail?: string;
}> = ({ tone, title, detail }) => {
  const color = tone === 'pursuit' ? 'var(--ember)' : tone === 'infected' ? 'var(--toxic)' : 'var(--gold)';
  const icon = tone === 'pursuit' ? <IconSiren size={18} /> : tone === 'infected' ? <IconHorde size={18} /> : <IconCrosshair size={18} />;
  return (
    <div
      role="alert"
      className={`hud-panel${tone === 'infected' ? ' hazard-stripes' : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 18px',
        borderColor: color,
        color,
        animation: 'scaleIn 360ms var(--ease-out) both'
      }}
    >
      <span className="blink" style={{ display: 'flex' }}>
        {icon}
      </span>
      <div>
        <div style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12, letterSpacing: '0.28em', textTransform: 'uppercase' }}>{title}</div>
        {detail && <div className="hud-hide-compact" style={{ fontSize: 11, color: 'var(--gold-pale)', marginTop: 2 }}>{detail}</div>}
      </div>
    </div>
  );
};

/* ---------- circular countdown ---------- */

export const CountdownRing: React.FC<{ seconds: number; total: number; label: string; size?: number }> = ({ seconds, total, label, size = 96 }) => {
  const frac = total > 0 ? Math.max(0, Math.min(1, seconds / total)) : 0;
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const urgent = seconds <= 30;
  const color = urgent ? 'var(--ember)' : frac < 0.5 ? '#e9a06a' : 'var(--gold)';
  return (
    <div style={{ position: 'relative', width: size, height: size }} role="timer" aria-label={`${label} ${fmtClock(seconds)}`}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(241,216,168,0.1)" strokeWidth={4} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: 'stroke-dashoffset 900ms linear, stroke 300ms', filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div className={`serif num${urgent ? ' blink' : ''}`} style={{ fontSize: size * 0.27, color, lineHeight: 1 }}>
            {fmtClock(seconds)}
          </div>
          <div className="hud-label" style={{ fontSize: 7, marginTop: 3 }}>
            {label}
          </div>
        </div>
      </div>
    </div>
  );
};
