import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, QrCode, Lock } from 'lucide-react';
import type { CityProfile } from '../engine/cities';
import { HazardIcon, MISSIONS, Mission, difficultyRank, missionDifficulty } from '../ui/missions';
import { GoldBackdrop, Letters } from './Ornaments';
import { IconBiohazard, IconCargo, IconCourier, IconCrosshair, IconHorde, IconInfected, IconRadio, IconSiren, IconTimer } from './hud/Icons';
import { readBest, fmtTime } from './CitySelect';

/* ==========================================================================
   Step 2 of 2 — mission mode. Three cards (objective, difficulty for this
   city, hazards) and a briefing panel that reads like an in-world order.
   Keyboard: ← → to browse, Enter to start, Esc to go back.
   ========================================================================== */

const i = (n: number) => ({ ['--i' as string]: n } as React.CSSProperties);

export const HazardGlyph: React.FC<{ icon: HazardIcon; size?: number }> = ({ icon, size = 15 }) => {
  switch (icon) {
    case 'barricade':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
          <rect x="2.5" y="8" width="19" height="7" rx="1" />
          <path d="m6 8-3.5 7M11 8l-3.5 7M16 8l-3.5 7M21 8l-3.5 7M5 15v5M19 15v5" />
        </svg>
      );
    case 'traffic':
      return <IconCourier size={size} />;
    case 'gunman':
      return <IconCrosshair size={size} />;
    case 'siren':
      return <IconSiren size={size} />;
    case 'radio':
      return <IconRadio size={size} />;
    case 'horde':
      return <IconHorde size={size} />;
    case 'infected':
      return <IconInfected size={size} />;
    case 'timer':
      return <IconTimer size={size} />;
    case 'cargo':
      return <IconCargo size={size} />;
  }
};

const Emblem: React.FC<{ mission: Mission; size?: number }> = ({ mission, size = 40 }) =>
  mission.id === 'crime' ? <IconSiren size={size} /> : mission.id === 'zombie' ? <IconBiohazard size={size} /> : <IconCourier size={size} />;

/** Lightweight card art: gradients + one emblem, no images. */
const CardArt: React.FC<{ mission: Mission; on: boolean }> = ({ mission, on }) => {
  const bg =
    mission.id === 'crime'
      ? 'radial-gradient(60% 90% at 15% 30%, rgba(224,88,58,0.35), transparent 70%), radial-gradient(60% 90% at 85% 70%, rgba(122,162,255,0.28), transparent 70%), #140c06'
      : mission.id === 'zombie'
        ? 'radial-gradient(70% 100% at 50% 100%, rgba(111,138,46,0.42), transparent 70%), #110d05'
        : 'radial-gradient(70% 100% at 50% 0%, rgba(255,195,77,0.28), transparent 70%), #140c06';
  return (
    <div
      className={mission.id === 'zombie' ? 'hazard-stripes' : undefined}
      style={{
        height: 120,
        borderRadius: 12,
        border: '1px solid var(--line)',
        background: mission.id === 'zombie' ? undefined : bg,
        backgroundColor: mission.id === 'zombie' ? '#110d05' : undefined,
        position: 'relative',
        overflow: 'hidden',
        display: 'grid',
        placeItems: 'center',
        marginBottom: 16,
        color: mission.accent
      }}
    >
      {mission.id === 'zombie' && <div style={{ position: 'absolute', inset: 0, background: bg }} />}
      {/* city-grid hint */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.18, backgroundImage: 'linear-gradient(rgba(241,216,168,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(241,216,168,0.35) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      <div style={{ position: 'relative', filter: `drop-shadow(0 0 ${on ? 18 : 8}px currentColor)`, transition: 'filter 300ms', transform: on ? 'scale(1.08)' : 'none' }}>
        <Emblem mission={mission} size={46} />
      </div>
    </div>
  );
};

export const DifficultyBars: React.FC<{ rank: number; color: string; label: string }> = ({ rank, color, label }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }} aria-label={`Difficulty ${label}`}>
    <span style={{ display: 'inline-flex', gap: 2, alignItems: 'flex-end' }}>
      {[1, 2, 3, 4].map((k) => (
        <span key={k} style={{ width: 4, height: 5 + k * 3, borderRadius: 1, background: k <= rank ? color : 'rgba(241,216,168,0.14)' }} />
      ))}
    </span>
    <span className="kicker" style={{ fontSize: 9, color }}>
      {label}
    </span>
  </span>
);

export const MissionSelect: React.FC<{
  city: CityProfile;
  onPick: (m: Mission) => void;
  onBack: () => void;
  onPair: () => void;
  phoneLinked: boolean;
}> = ({ city, onPick, onBack, onPair, phoneLinked }) => {
  const [active, setActive] = useState(0);
  const m = MISSIONS[active];
  const diff = missionDifficulty(m, city);
  const best = readBest(city.id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'ArrowRight' || e.code === 'KeyD') setActive((a) => (a + 1) % MISSIONS.length);
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') setActive((a) => (a - 1 + MISSIONS.length) % MISSIONS.length);
      if (e.code === 'Enter' && MISSIONS[active].available) onPick(MISSIONS[active]);
      if (e.code === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onPick, onBack]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', zIndex: 60 }}>
      <GoldBackdrop glowX="50%" glowY="18%" size={680} />
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 1240, margin: '0 auto', padding: '28px clamp(16px, 3vw, 32px) 40px' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26, gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              onClick={onBack}
              className="glass-light reveal-fade"
              aria-label="Back to city select"
              style={{ ...i(0), width: 40, height: 40, display: 'grid', placeItems: 'center', color: 'var(--gold-pale)', cursor: 'pointer' }}
            >
              <ArrowLeft size={16} />
            </button>
            <span className="serif reveal" style={{ ...i(0), fontSize: 20, color: 'var(--gold-pale)', fontStyle: 'italic' }}>
              Last Signal
            </span>
          </div>
          <button className="btn btn-ghost reveal" style={{ ...i(1), padding: '10px 18px' }} onClick={onPair}>
            <QrCode size={15} /> {phoneLinked ? 'Phone linked' : 'Pair phone'}
          </button>
        </header>

        <span className="kicker reveal" style={i(1)}>
          Step 2 of 2 · {city.name}
        </span>
        <div className="hairline reveal" style={{ ...i(2), margin: '14px 0 16px' }} />
        <h1 className="serif gold-text" style={{ fontSize: 'clamp(38px, 5vw, 62px)', lineHeight: 0.95, fontWeight: 400 }}>
          <Letters text="Choose your mission" />
        </h1>
        <p className="reveal" style={{ ...i(5), color: 'var(--muted)', fontSize: 13, margin: '12px 0 22px', maxWidth: 600, lineHeight: 1.7 }}>
          Same streets, different night. Each mode changes what hunts you and what counts as a win.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.55fr) minmax(280px, 1fr)', gap: 20, alignItems: 'start' }} className="mission-layout">
          {/* Mode cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }} role="radiogroup" aria-label="Mission mode">
            {MISSIONS.map((mm, idx) => {
              const on = idx === active;
              const d = missionDifficulty(mm, city);
              return (
                <button
                  key={mm.id}
                  role="radio"
                  aria-checked={on}
                  className="glass reveal"
                  onMouseEnter={() => setActive(idx)}
                  onFocus={() => setActive(idx)}
                  onClick={() => (on && mm.available ? onPick(mm) : setActive(idx))}
                  style={{
                    ...i(6 + idx),
                    textAlign: 'left',
                    padding: 16,
                    cursor: 'pointer',
                    position: 'relative',
                    borderColor: on ? mm.accent : 'var(--line)',
                    boxShadow: on ? `0 0 0 1px ${mm.accent}, 0 24px 60px rgba(0,0,0,0.5)` : undefined,
                    transform: on ? 'translateY(-4px)' : 'none',
                    transition: 'transform 300ms var(--ease-out), border-color 300ms, box-shadow 300ms',
                    opacity: mm.available || on ? 1 : 0.78
                  }}
                >
                  {!mm.available && (
                    <span className="kicker" style={{ position: 'absolute', top: 24, right: 24, zIndex: 2, fontSize: 8, display: 'flex', gap: 5, alignItems: 'center', color: 'var(--cream)', background: 'rgba(13,8,4,0.8)', padding: '5px 9px', borderRadius: 999, border: '1px solid var(--line)' }}>
                      <Lock size={10} /> Coming soon
                    </span>
                  )}
                  <CardArt mission={mm} on={on} />
                  <div className="kicker" style={{ fontSize: 8, color: mm.accent }}>
                    {mm.kicker}
                  </div>
                  <div className="serif" style={{ fontSize: 26, color: on ? 'var(--cream)' : 'var(--gold-pale)', margin: '4px 0 8px', lineHeight: 1.05 }}>
                    {mm.name}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.55, minHeight: 56 }}>{mm.tagline}</p>
                  <div style={{ marginTop: 12 }}>
                    <DifficultyBars rank={difficultyRank(d)} color={mm.accent} label={d} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Briefing */}
          <aside
            key={m.id}
            className="glass reveal-fade"
            aria-live="polite"
            style={{ padding: 0, overflow: 'hidden', borderColor: m.accent, position: 'sticky', top: 20 }}
          >
            <div
              className={m.id === 'zombie' ? 'hazard-stripes' : undefined}
              style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10, color: m.accent, background: m.id === 'zombie' ? undefined : 'rgba(255,195,77,0.04)' }}
            >
              <Emblem mission={m} size={18} />
              <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase' }}>
                {m.id === 'zombie' ? 'Evac order' : m.id === 'crime' ? 'All units bulletin' : 'Mission briefing'}
              </span>
            </div>
            <div style={{ padding: '18px 20px 20px' }}>
              <div className="hud-label" style={{ marginBottom: 6 }}>
                Objective
              </div>
              <p className="serif" style={{ fontSize: 19, color: 'var(--cream)', lineHeight: 1.3 }}>
                {m.objective}
              </p>

              <div style={{ display: 'flex', gap: 22, margin: '18px 0', flexWrap: 'wrap' }}>
                <div>
                  <div className="hud-label" style={{ marginBottom: 6 }}>
                    Difficulty · {city.name}
                  </div>
                  <DifficultyBars rank={difficultyRank(diff)} color={m.accent} label={diff} />
                </div>
                <div>
                  <div className="hud-label" style={{ marginBottom: 6 }}>
                    Extraction
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--gold-pale)' }}>{city.extraction.name}</span>
                </div>
                {m.id === 'courier' && best !== null && (
                  <div>
                    <div className="hud-label" style={{ marginBottom: 6 }}>
                      Best
                    </div>
                    <span className="num" style={{ fontSize: 12, color: 'var(--gold)' }}>
                      {fmtTime(best)}
                    </span>
                  </div>
                )}
              </div>

              <div className="hud-label" style={{ marginBottom: 8 }}>
                Hazards
              </div>
              <ul style={{ listStyle: 'none', display: 'grid', gap: 8, marginBottom: 18 }}>
                {m.hazards.map((h) => (
                  <li key={h.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--gold-pale)' }}>
                    <span style={{ color: m.accent, width: 26, height: 26, borderRadius: 8, display: 'grid', placeItems: 'center', border: '1px solid var(--line)', background: 'rgba(255,255,255,0.02)' }}>
                      <HazardGlyph icon={h.icon} />
                    </span>
                    {h.label}
                  </li>
                ))}
              </ul>

              <div style={{ borderLeft: `2px solid ${m.accent}`, padding: '4px 0 4px 12px', marginBottom: 20 }}>
                <div className="hud-label" style={{ fontSize: 8, marginBottom: 4, color: m.accent }}>
                  {m.channel}
                </div>
                {m.briefing.map((line) => (
                  <p key={line} className="serif" style={{ fontStyle: 'italic', fontSize: 15, color: 'var(--gold-pale)', lineHeight: 1.45 }}>
                    “{line}”
                  </p>
                ))}
              </div>

              <button className="btn btn-gold" disabled={!m.available} onClick={() => onPick(m)} style={{ width: '100%', opacity: m.available ? 1 : 0.5, cursor: m.available ? 'pointer' : 'not-allowed' }}>
                {m.available ? (
                  <>
                    Begin mission <ArrowRight size={16} className="btn-arrow" />
                  </>
                ) : (
                  <>
                    <Lock size={15} /> Coming soon
                  </>
                )}
              </button>
            </div>
          </aside>
        </div>
        <p className="reveal" style={{ ...i(11), fontSize: 11, color: 'var(--dim)', marginTop: 20 }}>
          ← → to browse · Enter to begin · Esc to change city
        </p>
      </div>
    </div>
  );
};
