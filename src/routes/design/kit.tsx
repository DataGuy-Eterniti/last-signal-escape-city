import React, { useEffect, useRef, useState } from 'react';
import { getCity } from '../../engine/cities';
import { buildWorld, roadX, roadY } from '../../engine/world';
import { createActors, updateActors } from '../../engine/actors';
import { createInitialVehicle } from '../../engine/physics';
import { renderGame } from '../../engine/renderer';
import { Meter } from '../../components/hud/HudKit';
import * as Icons from '../../components/hud/Icons';
import { SpeedArc } from '../../components/Ornaments';

/* Shared building blocks for the /design review sheet. */

/** Fixed-size artboard scaled to the column width. */
export const Artboard: React.FC<{ w: number; h: number; label: string; note?: string; children: React.ReactNode }> = ({ w, h, label, note, children }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / w));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w]);
  return (
    <figure style={{ margin: 0 }}>
      <div ref={ref} style={{ width: '100%', height: h * scale, position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)' }}>
        <div style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0, overflow: 'hidden', background: 'var(--ink-950)' }}>{children}</div>
      </div>
      <figcaption style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span className="kicker" style={{ fontSize: 9 }}>
          {label}
        </span>
        {note && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{note}</span>}
      </figcaption>
    </figure>
  );
};

/** A real rendered city frame (static) to sit behind HUD mock-ups. */
export const CityFrame: React.FC<{ cityId: string; ix: number; iy: number; angle?: number; seconds?: number; tint?: string }> = ({ cityId, ix, iy, angle = -Math.PI / 2, seconds = 4, tint }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    const city = getCity(cityId);
    if (!c || !city) return;
    const world = buildWorld(city);
    const actors = createActors(world);
    const v = createInitialVehicle(roadX(ix) + 38, roadY(iy) + 120);
    v.angle = angle;
    for (let t = 0; t < seconds * 30; t++) updateActors(actors, world, v, 1 / 30, false);
    c.width = 1366;
    c.height = 768;
    const ctx = c.getContext('2d');
    if (ctx) renderGame(ctx, 1366, 768, v, world, { time: 1.2, actors });
  }, [cityId, ix, iy, angle, seconds]);
  return (
    <>
      <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      {tint && <div style={{ position: 'absolute', inset: 0, background: tint, pointerEvents: 'none' }} />}
    </>
  );
};

/** Bottom-left condition panel as it appears in mission modes. */
export const ConditionPanel: React.FC<{ kmh: number; vehicle: number; cargo?: number; cargoLabel?: string }> = ({ kmh, vehicle, cargo, cargoLabel = 'Package' }) => (
  <div className="glass hud-speed" style={{ position: 'absolute', bottom: 24, left: 24, padding: '16px 22px 16px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
    <div style={{ position: 'relative', width: 112, height: 112 }}>
      <SpeedArc value={kmh / 220} size={112} />
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div className="serif num" style={{ fontSize: 38, lineHeight: 1, color: 'var(--cream)' }}>
            {kmh}
          </div>
          <div className="kicker" style={{ fontSize: 8, letterSpacing: '0.28em' }}>
            km/h
          </div>
        </div>
      </div>
    </div>
    <div style={{ display: 'grid', gap: 8, minWidth: 160 }}>
      <Meter label="Vehicle" value={vehicle} icon={<Icons.IconWrench size={12} />} compact />
      {cargo !== undefined && <Meter label={cargoLabel} value={cargo} icon={<Icons.IconCargo size={12} />} compact />}
    </div>
  </div>
);

export const TopBar: React.FC<{ city: string; district: string; objective: string; dist: string; clock: string; accent?: string; clockLabel?: string; label?: string }> = ({ city, district, objective, dist, clock, accent = 'var(--gold)', clockLabel, label }) => (
  <header className="hud-top" style={{ position: 'absolute', top: 20, left: 24, right: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
    <div>
      <div className="serif gold-text" style={{ fontSize: 26, lineHeight: 1, letterSpacing: '0.06em' }}>
        {city}
      </div>
      <div className="kicker" style={{ fontSize: 9, marginTop: 4 }}>
        {district}
      </div>
    </div>
    <div className="hud-panel" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 18px', borderRadius: 999 }}>
      <svg width={20} height={20} viewBox="0 0 24 24" style={{ color: accent, transform: 'rotate(40deg)' }}>
        <path d="M12 3 19 20 12 16 5 20Z" fill="currentColor" />
      </svg>
      <div>
        <div className="hud-label" style={{ fontSize: 8 }}>
          {label ?? (clockLabel ? 'Evac point' : 'Extraction')}
        </div>
        <div className="serif" style={{ fontSize: 17, color: 'var(--cream)' }}>
          {objective}
        </div>
      </div>
      <span className="serif num" style={{ fontSize: 20, color: accent }}>
        {dist}
      </span>
      <span className="kicker num hud-hide-compact" style={{ fontSize: 10, color: clockLabel ? 'var(--ember)' : 'var(--gold-pale)', borderLeft: '1px solid var(--line)', paddingLeft: 12 }}>
        {clock}
      </span>
    </div>
    <span className="btn btn-ghost hud-hide-compact" style={{ padding: '10px 18px', fontSize: 12 }}>
      Phone linked · 38 ms
    </span>
  </header>
);

export const Section: React.FC<{ id: string; title: string; kicker: string; children: React.ReactNode; intro?: string }> = ({ id, title, kicker, children, intro }) => (
  <section id={id} style={{ margin: '56px 0' }}>
    <span className="kicker">{kicker}</span>
    <div className="hairline" style={{ margin: '12px 0 14px' }} />
    <h2 className="serif" style={{ fontSize: 'clamp(30px, 4vw, 44px)', fontWeight: 400, color: 'var(--cream)', lineHeight: 1 }}>
      {title}
    </h2>
    {intro && <p style={{ color: 'var(--muted)', fontSize: 13, maxWidth: 720, lineHeight: 1.7, margin: '10px 0 0' }}>{intro}</p>}
    <div style={{ marginTop: 22, display: 'grid', gap: 26 }}>{children}</div>
  </section>
);

export const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 520px), 1fr))', gap: 22 };

