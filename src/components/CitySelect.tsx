import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, QrCode, MapPin, ShieldAlert, Flag } from 'lucide-react';
import { CITIES, CityProfile } from '../engine/cities';
import { buildWorld, World } from '../engine/world';
import { cityThumbnail } from '../engine/renderer';
import { GoldBackdrop, Letters } from './Ornaments';

const i = (n: number) => ({ ['--i' as string]: n } as React.CSSProperties);

const bestKey = (id: string) => `last-signal:best:${id}`;
export const readBest = (id: string): number | null => {
  try {
    const v = window.localStorage.getItem(bestKey(id));
    return v ? Number(v) : null;
  } catch {
    return null;
  }
};
export const writeBest = (id: string, seconds: number) => {
  try {
    const prev = readBest(id);
    if (prev === null || seconds < prev) window.localStorage.setItem(bestKey(id), String(seconds));
  } catch {
    /* storage unavailable — fine */
  }
};
export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const Thumb: React.FC<{ world: World; size: number }> = ({ world, size }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const src = cityThumbnail(world, size);
    const c = ref.current;
    if (!src || !c) return;
    c.width = src.width;
    c.height = src.height;
    c.getContext('2d')?.drawImage(src, 0, 0);
  }, [world, size]);
  return <canvas ref={ref} style={{ display: 'block', margin: '0 auto', borderRadius: 8, maxWidth: '100%' }} aria-hidden="true" />;
};

export const CitySelect: React.FC<{
  onPick: (city: CityProfile) => void;
  onBack?: () => void;
  onPair: () => void;
  phoneLinked: boolean;
}> = ({ onPick, onBack, onPair, phoneLinked }) => {
  const worlds = useMemo(() => CITIES.map((c) => buildWorld(c)), []);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'ArrowRight' || e.code === 'KeyD') setActive((a) => (a + 1) % CITIES.length);
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') setActive((a) => (a - 1 + CITIES.length) % CITIES.length);
      if (e.code === 'Enter') onPick(CITIES[active]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onPick]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', zIndex: 60 }}>
      <GoldBackdrop glowX="50%" glowY="20%" size={680} />
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 1240, margin: '0 auto', padding: '28px 32px 40px' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {onBack && (
              <button
                onClick={onBack}
                className="glass-light reveal-fade"
                aria-label="Back to menu"
                style={{ ...i(0), width: 40, height: 40, display: 'grid', placeItems: 'center', color: 'var(--gold-pale)', cursor: 'pointer' }}
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <span className="serif reveal" style={{ ...i(0), fontSize: 20, color: 'var(--gold-pale)', fontStyle: 'italic' }}>
              Last Signal
            </span>
          </div>
          <button className="btn btn-ghost reveal" style={{ ...i(1), padding: '10px 18px' }} onClick={onPair}>
            <QrCode size={15} /> {phoneLinked ? 'Phone linked' : 'Pair phone'}
          </button>
        </header>

        <span className="kicker reveal" style={i(1)}>
          Choose your city
        </span>
        <div className="hairline reveal" style={{ ...i(2), margin: '14px 0 16px' }} />
        <h1 className="serif gold-text" style={{ fontSize: 'clamp(44px, 6vw, 76px)', lineHeight: 0.95, fontWeight: 400 }}>
          <Letters text="Where does the" />
          <br />
          <Letters text="signal die tonight?" />
        </h1>
        <p className="reveal" style={{ ...i(5), color: 'var(--muted)', fontSize: 13, margin: '14px 0 28px', maxWidth: 560, lineHeight: 1.7 }}>
          Each city is a stylised take on real streets and landmarks. Deliver the package to the extraction point — buildings, barricades and
          traffic are solid, armed officers open fire when they see you, and every hit damages the cargo.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 18 }}>
          {CITIES.map((c, idx) => {
            const best = readBest(c.id);
            const on = idx === active;
            return (
              <button
                key={c.id}
                className="glass reveal"
                onMouseEnter={() => setActive(idx)}
                onFocus={() => setActive(idx)}
                onClick={() => onPick(c)}
                style={{
                  ...i(6 + idx),
                  textAlign: 'left',
                  padding: 18,
                  cursor: 'pointer',
                  borderColor: on ? 'rgba(255,195,77,0.65)' : 'var(--line)',
                  boxShadow: on ? '0 0 0 1px rgba(255,195,77,0.35), 0 24px 60px rgba(0,0,0,0.5)' : undefined,
                  transform: on ? 'translateY(-4px)' : 'none',
                  transition: 'transform 300ms var(--ease-out), border-color 300ms, box-shadow 300ms'
                }}
              >
                <div
                  style={{
                    background: '#0d0804',
                    borderRadius: 10,
                    padding: 10,
                    marginBottom: 14,
                    border: '1px solid var(--line)',
                    height: 222,
                    display: 'grid',
                    placeItems: 'center'
                  }}
                >
                  <Thumb world={worlds[idx]} size={200} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span className="serif" style={{ fontSize: 30, color: on ? 'var(--gold)' : 'var(--cream)', transition: 'color 300ms' }}>
                    {c.name}
                  </span>
                  <span
                    className="kicker"
                    style={{ fontSize: 9, color: c.difficulty === 'Hard' ? '#e9a06a' : c.difficulty === 'Medium' ? 'var(--gold)' : 'var(--gold-pale)' }}
                  >
                    {c.difficulty}
                  </span>
                </div>
                <div className="kicker" style={{ fontSize: 9, margin: '4px 0 10px' }}>
                  {c.region}
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, minHeight: 58 }}>{c.tagline}</p>
                <div style={{ display: 'grid', gap: 6, marginTop: 12, fontSize: 11, color: 'var(--gold-pale)' }}>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <MapPin size={12} color="var(--gold)" /> Start · {c.start.label}
                  </span>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Flag size={12} color="var(--gold)" /> Extraction · {c.extraction.name}
                  </span>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <ShieldAlert size={12} color="#e9a06a" /> {c.checkpoints} armed checkpoints
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                  <span className="kicker num" style={{ fontSize: 9 }}>
                    {best !== null ? `Best ${fmtTime(best)}` : 'Not yet escaped'}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--gold)', fontSize: 12, fontWeight: 600 }}>
                    Drive <ArrowRight size={14} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        <p className="reveal" style={{ ...i(11), fontSize: 11, color: 'var(--dim)', marginTop: 20 }}>
          ← → to browse · Enter to drive · Street layouts are simplified for play and are not exact maps.
        </p>
      </div>
    </div>
  );
};
