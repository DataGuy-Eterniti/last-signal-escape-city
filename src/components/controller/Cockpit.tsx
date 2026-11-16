import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Flame, RotateCw, X } from 'lucide-react';
import {
  ControlSettings,
  DpadState,
  Pedals,
  Vec,
  dpadFrom,
  dpadVector,
  linkBars,
  loadSettings,
  mapControls,
  saveSettings,
  stickVector
} from '../../ui/controls';
import { IconMirror, IconSliders } from '../hud/Icons';

/* ==========================================================================
   Gold Noir 2.0 phone cockpit (landscape).
   - 360° analog stick or 8-way D-pad (one thumb reaches diagonals)
   - Classic: stick steers, pedals drive · Advanced: stick does both
   - Left-handed mirror, haptics toggle, settings remembered on the device
   - Live link quality, input echo and reconnect state
   Every control captures its own pointer, so multitouch never cross-talks
   (hold Gas with one thumb, steer with the other, tap Nitro).
   Output is the unchanged { steer, throttle, brake, nitro } input shape.
   ========================================================================== */

export interface CockpitOutput {
  steer: number;
  throttle: number;
  brake: number;
  nitro: boolean;
}

export type LinkState = 'connected' | 'connecting' | 'reconnecting';

const vibrate = (on: boolean, ms: number) => {
  if (!on || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(ms);
  } catch {
    /* unsupported */
  }
};

/* ---------- link quality ---------- */

const LinkMeter: React.FC<{ link: LinkState; pingMs: number }> = ({ link, pingMs }) => {
  const bars = link === 'connected' ? linkBars(pingMs) : 0;
  const color = link === 'connected' ? (bars >= 2 ? 'var(--gold)' : '#e9a06a') : 'var(--muted)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} role="status" aria-live="polite">
      <span style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 12 }} aria-hidden="true">
        {[1, 2, 3].map((k) => (
          <span key={k} style={{ width: 3, height: 3 + k * 3, borderRadius: 1, background: k <= bars ? color : 'rgba(241,216,168,0.18)' }} />
        ))}
      </span>
      <span className="kicker num" style={{ fontSize: 10, color }}>
        {link === 'connected' ? `${pingMs || '—'} ms` : link === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}
      </span>
    </div>
  );
};

/* ---------- analog stick ---------- */

const Stick: React.FC<{
  vec: Vec;
  held: boolean;
  advanced: boolean;
  size: number;
}> = ({ vec, held, advanced, size }) => {
  const knob = Math.round(size * 0.38);
  const travel = size / 2 - knob / 2 + 4;
  const ang = Math.atan2(-vec.y, vec.x);
  const mag = Math.min(1, Math.hypot(vec.x, vec.y));
  return (
    <div style={{ position: 'relative', width: size, height: size }} aria-hidden="true">
      {/* base */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 40%, #2c1c0d 0%, #140c06 75%)',
          boxShadow: 'inset 0 0 0 1px rgba(241,216,168,0.22), inset 0 10px 34px rgba(0,0,0,0.65), 0 0 0 10px rgba(255,195,77,0.035)'
        }}
      />
      {/* direction glow follows the vector */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          opacity: mag,
          background: `conic-gradient(from ${ang + Math.PI / 2 - 0.6}rad, rgba(255,195,77,0.38), rgba(255,195,77,0) 1.2rad, rgba(255,195,77,0) 360deg)`,
          WebkitMask: 'radial-gradient(circle, transparent 58%, #000 60%)',
          mask: 'radial-gradient(circle, transparent 58%, #000 60%)'
        }}
      />
      {/* 8 direction ticks + centre cross */}
      {Array.from({ length: 8 }, (_, k) => {
        const a = (k * Math.PI) / 4;
        const major = k % 2 === 0;
        return (
          <span
            key={k}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: major ? 12 : 7,
              height: 1.5,
              background: major ? 'rgba(241,216,168,0.45)' : 'rgba(241,216,168,0.22)',
              transform: `rotate(${a}rad) translateX(${size / 2 - 16}px)`,
              transformOrigin: '0 0'
            }}
          />
        );
      })}
      <span style={{ position: 'absolute', left: '50%', top: '50%', width: 18, height: 1, background: 'rgba(241,216,168,0.3)', transform: 'translate(-50%,-50%)' }} />
      <span style={{ position: 'absolute', left: '50%', top: '50%', width: 1, height: 18, background: 'rgba(241,216,168,0.3)', transform: 'translate(-50%,-50%)' }} />
      {advanced && (
        <>
          <span className="hud-label" style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', fontSize: 8, color: 'var(--gold-pale)' }}>
            Gas
          </span>
          <span className="hud-label" style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', fontSize: 8, color: '#e9a06a' }}>
            Brake
          </span>
        </>
      )}
      {/* knob */}
      <div
        className={`stick-knob${held ? ' held' : ''}`}
        style={{
          position: 'absolute',
          left: size / 2 - knob / 2,
          top: size / 2 - knob / 2,
          width: knob,
          height: knob,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, #fff1c4, #ffc34d 55%, #b9771f)',
          boxShadow: `0 0 ${10 + mag * 26}px rgba(255,195,77,${0.35 + mag * 0.45}), inset 0 -4px 8px rgba(90,50,10,0.5)`,
          transform: `translate(${vec.x * travel}px, ${-vec.y * travel}px)`
        }}
      >
        <span style={{ position: 'absolute', inset: '30%', borderRadius: '50%', border: '1px solid rgba(90,50,10,0.35)' }} />
      </div>
    </div>
  );
};

/* ---------- 8-way D-pad ---------- */

const Dpad: React.FC<{ d: DpadState; size: number }> = ({ d, size }) => {
  const long = size * 0.36;
  const short = size * 0.28;
  const gap = size * 0.07;
  const arm = (on: boolean, dir: 'up' | 'right' | 'down' | 'left') => {
    const vertical = dir === 'up' || dir === 'down';
    const pos: React.CSSProperties =
      dir === 'up'
        ? { left: (size - short) / 2, top: gap }
        : dir === 'down'
          ? { left: (size - short) / 2, bottom: gap }
          : dir === 'left'
            ? { top: (size - short) / 2, left: gap }
            : { top: (size - short) / 2, right: gap };
    const rot = { up: 0, right: 90, down: 180, left: 270 }[dir];
    return (
      <div
        key={dir}
        style={{
          position: 'absolute',
          ...pos,
          width: vertical ? short : long,
          height: vertical ? long : short,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 12,
          background: on ? 'linear-gradient(180deg, #ffd479, #d9952b)' : 'linear-gradient(180deg, rgba(241,216,168,0.14), rgba(241,216,168,0.04))',
          border: `1px solid ${on ? 'rgba(255,195,77,0.9)' : 'var(--line-strong)'}`,
          boxShadow: on ? '0 0 22px rgba(255,195,77,0.55)' : 'none',
          color: on ? '#2a1808' : 'var(--gold-pale)',
          transition: 'background 90ms, box-shadow 90ms'
        }}
      >
        <svg width={20} height={20} viewBox="0 0 24 24" style={{ transform: `rotate(${rot}deg)` }} aria-hidden="true">
          <path d="M12 5 19 15H5Z" fill="currentColor" />
        </svg>
      </div>
    );
  };
  return (
    <div style={{ position: 'relative', width: size, height: size }} aria-hidden="true">
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle, #24170b, #140c06 72%)', boxShadow: 'inset 0 0 0 1px rgba(241,216,168,0.18)' }} />
      {arm(d.up, 'up')}
      {arm(d.right, 'right')}
      {arm(d.down, 'down')}
      {arm(d.left, 'left')}
      <span style={{ position: 'absolute', left: '50%', top: '50%', width: size * 0.16, height: size * 0.16, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: '#1b1209', border: '1px solid var(--line)' }} />
    </div>
  );
};

/* ---------- pedal button ---------- */

const Pedal: React.FC<{
  label: string;
  sub: string;
  tone: 'gas' | 'brake' | 'nitro';
  on: boolean;
  disabled?: boolean;
  onChange: (down: boolean) => void;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ label, sub, tone, on, disabled, onChange, style, children }) => {
  const pal = {
    gas: { border: 'rgba(241,216,168,0.45)', idle: 'linear-gradient(160deg, rgba(241,216,168,0.16), rgba(241,216,168,0.04))', on: 'linear-gradient(180deg, #ffd479, #ffc34d 55%, #d9952b)', fg: 'var(--gold-pale)', fgOn: '#2a1808', glow: 'rgba(255,195,77,0.6)' },
    brake: { border: 'rgba(194,98,45,0.55)', idle: 'linear-gradient(160deg, rgba(194,98,45,0.18), rgba(96,62,30,0.12))', on: 'linear-gradient(180deg, #e0834a, #9c451c)', fg: '#e9a06a', fgOn: '#fff3e2', glow: 'rgba(224,131,74,0.55)' },
    nitro: { border: 'rgba(255,195,77,0.45)', idle: 'linear-gradient(160deg, rgba(255,195,77,0.14), rgba(255,195,77,0.04))', on: 'linear-gradient(180deg, #fff1c4, #ffc34d)', fg: 'var(--gold)', fgOn: '#2a1808', glow: 'rgba(255,195,77,0.7)' }
  }[tone];
  const down = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    onChange(true);
  };
  const up = () => !disabled && onChange(false);
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      disabled={disabled}
      className={`pad-btn${on ? ' on' : ''}`}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        border: `1px solid ${disabled ? 'var(--line)' : pal.border}`,
        background: disabled ? 'rgba(241,216,168,0.03)' : on ? pal.on : pal.idle,
        color: disabled ? 'var(--dim)' : on ? pal.fgOn : pal.fg,
        boxShadow: on ? `0 0 30px ${pal.glow}` : 'inset 0 1px 0 rgba(255,230,180,0.06)',
        cursor: disabled ? 'default' : 'pointer',
        ...style
      }}
    >
      {children}
      <span className="serif" style={{ fontSize: tone === 'nitro' ? 24 : 26, letterSpacing: tone === 'nitro' ? '0.12em' : undefined }}>
        {label}
      </span>
      <span className="kicker" style={{ fontSize: 8, color: 'inherit', opacity: 0.75 }}>
        {sub}
      </span>
    </button>
  );
};

/* ---------- input echo (centre strip) ---------- */

const InputEcho: React.FC<{ out: CockpitOutput }> = ({ out }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }} aria-hidden="true">
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', height: 70 }}>
      {[
        { v: out.brake, c: '#e9a06a', l: 'B' },
        { v: out.throttle, c: 'var(--gold)', l: 'G' }
      ].map((b) => (
        <div key={b.l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 56, borderRadius: 4, background: 'rgba(241,216,168,0.08)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${b.v * 100}%`, background: b.c, transition: 'height 60ms linear' }} />
          </div>
          <span className="hud-label" style={{ fontSize: 7, letterSpacing: '0.1em' }}>
            {b.l}
          </span>
        </div>
      ))}
    </div>
    <div style={{ width: 70, height: 8, borderRadius: 4, background: 'rgba(241,216,168,0.08)', position: 'relative' }}>
      <span style={{ position: 'absolute', left: '50%', top: -2, bottom: -2, width: 1, background: 'rgba(241,216,168,0.3)' }} />
      <span
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: out.steer < 0 ? `${50 + out.steer * 50}%` : '50%',
          width: `${Math.abs(out.steer) * 50}%`,
          background: 'var(--gold)',
          borderRadius: 4,
          transition: 'left 60ms linear, width 60ms linear'
        }}
      />
    </div>
    <span className="hud-label" style={{ fontSize: 7 }}>
      Steer
    </span>
    <span style={{ color: out.nitro ? 'var(--gold)' : 'var(--dim)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
      <Flame size={11} /> Nitro
    </span>
  </div>
);

/* ---------- settings sheet ---------- */

const Segmented = <T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; t: string; d: string }[]; onChange: (v: T) => void; label: string }) => (
  <div role="radiogroup" aria-label={label} style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length}, 1fr)`, gap: 8 }}>
    {options.map((o) => {
      const on = o.v === value;
      return (
        <button
          key={o.v}
          role="radio"
          aria-checked={on}
          onClick={() => onChange(o.v)}
          style={{
            textAlign: 'left',
            padding: '10px 12px',
            borderRadius: 12,
            border: `1px solid ${on ? 'var(--gold)' : 'var(--line)'}`,
            background: on ? 'rgba(255,195,77,0.1)' : 'rgba(255,255,255,0.02)',
            color: on ? 'var(--cream)' : 'var(--gold-pale)',
            cursor: 'pointer'
          }}
        >
          <div className="serif" style={{ fontSize: 18 }}>
            {o.t}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2, lineHeight: 1.35 }}>{o.d}</div>
        </button>
      );
    })}
  </div>
);

const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void; label: string; detail: string; icon?: React.ReactNode }> = ({ on, onChange, label, detail, icon }) => (
  <button
    role="switch"
    aria-checked={on}
    onClick={() => onChange(!on)}
    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid var(--line)', background: 'rgba(255,255,255,0.02)', color: 'var(--gold-pale)', cursor: 'pointer', textAlign: 'left' }}
  >
    {icon && <span style={{ color: 'var(--gold)' }}>{icon}</span>}
    <span style={{ flex: 1 }}>
      <span className="serif" style={{ fontSize: 17, display: 'block', color: 'var(--cream)' }}>
        {label}
      </span>
      <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>{detail}</span>
    </span>
    <span style={{ width: 40, height: 22, borderRadius: 11, background: on ? 'var(--gold)' : 'rgba(241,216,168,0.15)', position: 'relative', transition: 'background 200ms', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: on ? '#2a1808' : 'var(--gold-pale)', transition: 'left 200ms var(--ease-out)' }} />
    </span>
  </button>
);

export const ControlSettingsSheet: React.FC<{ settings: ControlSettings; onChange: (s: ControlSettings) => void; onClose: () => void }> = ({ settings, onChange, onClose }) => (
  <div
    style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(10,6,3,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, animation: 'fadeIn 260ms var(--ease-out) both' }}
    onClick={onClose}
  >
    <div
      className="glass"
      role="dialog"
      aria-label="Controller settings"
      onClick={(e) => e.stopPropagation()}
      style={{ width: 'min(720px, 100%)', maxHeight: '100%', overflowY: 'auto', padding: '16px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, position: 'relative' }}
    >
      <button onClick={onClose} aria-label="Close settings" style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 6 }}>
        <X size={18} />
      </button>
      <div>
        <div className="hud-label" style={{ marginBottom: 8 }}>
          Control mode
        </div>
        <Segmented
          label="Control mode"
          value={settings.mode}
          onChange={(mode) => onChange({ ...settings, mode })}
          options={[
            { v: 'classic', t: 'Classic', d: 'Stick steers. Gas and Brake pedals drive.' },
            { v: 'advanced', t: 'Advanced', d: 'Stick does it all: up accelerates, down brakes. Pedals off.' }
          ]}
        />
        <div className="hud-label" style={{ margin: '14px 0 8px' }}>
          Steering input
        </div>
        <Segmented
          label="Steering input"
          value={settings.style}
          onChange={(style) => onChange({ ...settings, style })}
          options={[
            { v: 'joystick', t: 'Joystick', d: 'Analog 360°. Smooth, precise turns.' },
            { v: 'dpad', t: 'D-pad', d: '8 directions. Digital, full lock.' }
          ]}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 22 }}>
        <Toggle on={settings.leftHanded} onChange={(leftHanded) => onChange({ ...settings, leftHanded })} label="Left-handed" detail="Pedals on the left, steering on the right." icon={<IconMirror size={18} />} />
        <Toggle on={settings.haptics} onChange={(haptics) => onChange({ ...settings, haptics })} label="Haptics" detail="Short buzz on pedals and full lock." />
        <p style={{ fontSize: 10.5, color: 'var(--dim)', lineHeight: 1.5, marginTop: 'auto' }}>Saved on this phone. Inputs pause while this panel is open.</p>
      </div>
    </div>
  </div>
);

/* ---------- cockpit ---------- */

export const Cockpit: React.FC<{
  room: string;
  link: LinkState;
  pingMs: number;
  onLeave: () => void;
  onInput: (out: CockpitOutput) => void;
  /** design preview: no vibration, starts with a given state */
  demo?: { settings?: Partial<ControlSettings>; vec?: Vec; pedals?: Pedals; nitro?: boolean; dpad?: DpadState; sheetOpen?: boolean };
}> = ({ room, link, pingMs, onLeave, onInput, demo }) => {
  const [settings, setSettingsState] = useState<ControlSettings>(() => ({ ...loadSettings(), ...(demo?.settings ?? {}) }));
  const [sheet, setSheet] = useState(demo?.sheetOpen ?? false);
  const [vec, setVec] = useState<Vec>(demo?.vec ?? { x: 0, y: 0 });
  const [held, setHeld] = useState(false);
  const [dpad, setDpad] = useState<DpadState>(demo?.dpad ?? { up: false, down: false, left: false, right: false });
  const [pedals, setPedals] = useState<Pedals>(demo?.pedals ?? { gas: false, brake: false });
  const [nitro, setNitro] = useState(demo?.nitro ?? false);
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<number | null>(null);
  const atRimRef = useRef(false);
  const [stickSize, setStickSize] = useState(200);
  const [portrait, setPortrait] = useState(() => window.innerHeight > window.innerWidth);
  const [hintHidden, setHintHidden] = useState(!!demo);

  const setSettings = (s: ControlSettings) => {
    setSettingsState(s);
    if (!demo) saveSettings(s);
  };

  // size the stick to the panel (thumb-friendly on small phones, not huge on tablets)
  useEffect(() => {
    const fit = () => {
      const el = zoneRef.current;
      if (el) setStickSize(Math.round(Math.max(150, Math.min(250, Math.min(el.clientWidth, el.clientHeight) * 0.8))));
      setPortrait(window.innerHeight > window.innerWidth);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const steerVec: Vec = settings.style === 'dpad' ? dpadVector(dpad) : vec;
  const mapped = mapControls(settings, sheet ? { x: 0, y: 0 } : steerVec, sheet ? { gas: false, brake: false } : pedals);
  const out: CockpitOutput = { ...mapped, nitro: !sheet && nitro };

  // push every change to the network layer (it samples at its own fixed rate)
  const outKey = `${out.steer}|${out.throttle}|${out.brake}|${out.nitro}`;
  useEffect(() => {
    onInput(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outKey]);

  // switching to Advanced releases any held pedal
  useEffect(() => {
    if (settings.mode === 'advanced') setPedals({ gas: false, brake: false });
  }, [settings.mode]);

  const track = useCallback(
    (clientX: number, clientY: number) => {
      const el = zoneRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const radius = stickSize / 2 - stickSize * 0.19 + 4;
      if (settings.style === 'dpad') {
        setDpad(dpadFrom(clientX - cx, clientY - cy, stickSize / 2));
        return;
      }
      const v = stickVector(clientX - cx, clientY - cy, radius);
      setVec({ x: v.x, y: v.y });
      const rim = v.mag > 0.95;
      if (rim && !atRimRef.current) vibrate(settings.haptics && !demo, 8);
      atRimRef.current = rim;
    },
    [settings.style, settings.haptics, stickSize, demo]
  );

  const onZoneDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerRef.current !== null) return; // one thumb owns the stick
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerRef.current = e.pointerId;
    setHeld(true);
    track(e.clientX, e.clientY);
  };
  const onZoneMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== pointerRef.current) return;
    track(e.clientX, e.clientY);
  };
  const onZoneUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== pointerRef.current) return;
    pointerRef.current = null;
    atRimRef.current = false;
    setHeld(false);
    setVec({ x: 0, y: 0 }); // knob springs back via CSS
    setDpad({ up: false, down: false, left: false, right: false });
  };

  const setPedal = (k: keyof Pedals) => (down: boolean) => {
    setPedals((p) => ({ ...p, [k]: down }));
    if (down) vibrate(settings.haptics && !demo, 18);
  };

  const advanced = settings.mode === 'advanced';
  const connected = link === 'connected';

  const steerPanel = (
    <section
      ref={zoneRef}
      className="glass"
      aria-label={settings.style === 'dpad' ? 'Direction pad' : 'Steering joystick'}
      onPointerDown={onZoneDown}
      onPointerMove={onZoneMove}
      onPointerUp={onZoneUp}
      onPointerCancel={onZoneUp}
      onLostPointerCapture={onZoneUp}
      onContextMenu={(e) => e.preventDefault()}
      style={{ position: 'relative', display: 'grid', placeItems: 'center', touchAction: 'none', minHeight: 0, overflow: 'hidden' }}
    >
      <span className="kicker" style={{ position: 'absolute', top: 10, left: 14, fontSize: 9 }}>
        {settings.style === 'dpad' ? 'D-pad' : advanced ? 'Drive' : 'Steer'}
      </span>
      {settings.style === 'dpad' ? <Dpad d={dpad} size={stickSize} /> : <Stick vec={vec} held={held} advanced={advanced} size={stickSize} />}
    </section>
  );

  const drivePanel = (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
      <Pedal label="NITRO" sub="Hold to boost" tone="nitro" on={nitro} onChange={(d) => { setNitro(d); if (d) vibrate(settings.haptics && !demo, 35); }} style={{ flex: advanced ? 3 : 1, flexDirection: 'row', gap: 10 }}>
        <Flame size={20} />
      </Pedal>
      {advanced ? (
        <div className="glass-light" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>
          <span style={{ color: 'var(--gold)' }}>
            <IconSliders size={16} />
          </span>
          Advanced mode: push the stick up to accelerate, pull down to brake. Pedals are off.
        </div>
      ) : (
        <div style={{ flex: 2, display: 'grid', gridTemplateColumns: settings.leftHanded ? '1fr 1fr' : '1fr 1fr', gap: 12, minHeight: 0 }}>
          {settings.leftHanded ? (
            <>
              <Pedal label="Gas" sub="Accelerate" tone="gas" on={pedals.gas} onChange={setPedal('gas')} />
              <Pedal label="Brake" sub="Reverse" tone="brake" on={pedals.brake} onChange={setPedal('brake')} />
            </>
          ) : (
            <>
              <Pedal label="Brake" sub="Reverse" tone="brake" on={pedals.brake} onChange={setPedal('brake')} />
              <Pedal label="Gas" sub="Accelerate" tone="gas" on={pedals.gas} onChange={setPedal('gas')} />
            </>
          )}
        </div>
      )}
    </section>
  );

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'radial-gradient(120% 100% at 50% 0%, #2a190b 0%, #140c06 55%, #0d0804 100%)',
        touchAction: 'none',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}
    >
      <div className="grain" />

      <header style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <button onClick={onLeave} aria-label="Leave room" style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex', padding: 6 }}>
            <ArrowLeft size={18} />
          </button>
          <span className="serif" style={{ fontSize: 17, color: 'var(--gold-pale)', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
            Last Signal
          </span>
          <span className="kicker num" style={{ fontSize: 10, color: 'var(--gold)' }}>
            Room {room}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="kicker" style={{ fontSize: 8, padding: '4px 8px', borderRadius: 999, border: '1px solid var(--line)', color: 'var(--gold-pale)' }}>
            {advanced ? 'Advanced' : 'Classic'} · {settings.style === 'dpad' ? 'D-pad' : 'Stick'}
            {settings.leftHanded ? ' · L' : ''}
          </span>
          <LinkMeter link={link} pingMs={pingMs} />
          <button onClick={() => setSheet(true)} aria-label="Controller settings" className="glass-light" style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', color: 'var(--gold-pale)', cursor: 'pointer' }}>
            <IconSliders size={16} />
          </button>
        </div>
      </header>

      <main
        style={{
          position: 'relative',
          zIndex: 2,
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: settings.leftHanded ? 'minmax(0,1fr) 92px minmax(0,1.05fr)' : 'minmax(0,1.05fr) 92px minmax(0,1fr)',
          padding: 12,
          gap: 12
        }}
      >
        {settings.leftHanded ? drivePanel : steerPanel}
        <div style={{ display: 'grid', placeItems: 'center' }}>
          <InputEcho out={out} />
        </div>
        {settings.leftHanded ? steerPanel : drivePanel}
      </main>

      {/* reconnect feedback: shown over the cockpit, never steals touches */}
      {!connected && (
        <div style={{ position: 'absolute', top: 56, left: '50%', transform: 'translateX(-50%)', zIndex: 6, pointerEvents: 'none' }}>
          <div className="glass-light" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderColor: 'rgba(233,160,106,0.5)', animation: 'fadeIn 300ms both' }}>
            <span className="dot warn" />
            <span style={{ fontSize: 12, color: 'var(--gold-pale)' }}>{link === 'reconnecting' ? 'Signal lost — reconnecting. Inputs paused.' : 'Linking to the game…'}</span>
          </div>
        </div>
      )}

      {portrait && !hintHidden && (
        <button
          onClick={() => setHintHidden(true)}
          className="glass-light"
          style={{ position: 'absolute', bottom: 18, left: '50%', zIndex: 5, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--gold-pale)', animation: 'toastIn 500ms var(--ease-out) both', cursor: 'pointer' }}
        >
          <RotateCw size={14} /> Turn your phone sideways for the best grip · tap to hide
        </button>
      )}

      {sheet && <ControlSettingsSheet settings={settings} onChange={setSettings} onClose={() => setSheet(false)} />}
    </div>
  );
};
