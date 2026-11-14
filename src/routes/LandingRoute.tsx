import React, { useEffect, useState } from 'react';
import { ArrowRight, Monitor, Smartphone, QrCode, Gauge } from 'lucide-react';
import { GoldBackdrop, GoldEmblem, Letters } from '../components/Ornaments';
import type { Route } from '../App';

const i = (n: number) => ({ ['--i' as string]: n } as React.CSSProperties);

const useIsMobile = () => {
  const query = '(max-width: 820px)';
  const [mobile, setMobile] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
};

const STEPS = [
  { icon: Monitor, n: '01', title: 'Open the city', text: 'Launch the game screen on your laptop. A private room opens instantly.' },
  { icon: QrCode, n: '02', title: 'Scan the signal', text: 'Point your phone camera at the QR code. No app, no login.' },
  { icon: Gauge, n: '03', title: 'Drive out', text: 'Steer with your thumb, hold gas, tap nitro. Escape the lockdown.' }
];

export const LandingRoute: React.FC<{ onNavigate: (r: Route) => void }> = ({ onNavigate }) => {
  const mobile = useIsMobile();

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
      <GoldBackdrop glowX={mobile ? '50%' : '70%'} glowY={mobile ? '58%' : '42%'} size={mobile ? 460 : 760} />

      {/* Navigation */}
      <nav
        className="reveal-fade"
        style={{
          ...i(0),
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: mobile ? '20px 22px' : '28px 56px',
          borderBottom: '1px solid var(--line)'
        }}
      >
        <span className="serif" style={{ fontSize: 22, color: 'var(--gold-pale)', fontStyle: 'italic' }}>
          Last Signal
        </span>
        {!mobile && (
          <div style={{ display: 'flex', gap: 40 }}>
            {([['Home', null], ['The Escape', 'game'], ['Controller', 'controller'], ['How it works', null]] as const).map(([label, target], idx) => (
              <span
                key={label}
                className="kicker"
                role={target ? 'link' : undefined}
                onClick={target ? () => onNavigate(target) : undefined}
                style={{
                  cursor: target ? 'pointer' : 'default',
                  fontSize: 10,
                  color: idx === 0 ? 'var(--gold-pale)' : 'var(--dim)',
                  borderBottom: idx === 0 ? '1px solid var(--gold-pale)' : '1px solid transparent',
                  paddingBottom: 6
                }}
              >
                {label}
              </span>
            ))}
          </div>
        )}
        <span className="glass-light kicker" style={{ fontSize: 9, padding: '8px 14px', color: 'var(--gold-pale)' }}>
          Free · No login
        </span>
      </nav>

      {/* Hero */}
      <main
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'grid',
          gridTemplateColumns: mobile ? '1fr' : '1.05fr 1fr 120px',
          alignItems: 'center',
          gap: mobile ? 8 : 24,
          padding: mobile ? '28px 22px 12px' : '40px 56px 16px',
          minHeight: mobile ? undefined : 'calc(100% - 260px)'
        }}
      >
        <section>
          <div className="reveal" style={{ ...i(1), display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <span className="kicker">A city in lockdown</span>
          </div>
          <div className="hairline reveal" style={{ ...i(2), marginBottom: 22 }} />

          <h1
            className="serif gold-text"
            style={{
              fontSize: mobile ? 'clamp(64px, 20vw, 96px)' : 'clamp(84px, 10vw, 150px)',
              lineHeight: 0.86,
              fontWeight: 400,
              letterSpacing: '0.02em'
            }}
          >
            <Letters text="LAST" />
            <br />
            <Letters text="SIGNAL" />
            <span className="sparkle" style={{ fontSize: '0.22em', verticalAlign: 'top', marginLeft: 8, color: 'var(--gold)' }}>
              ✦
            </span>
          </h1>

          <p
            className="serif reveal"
            style={{ ...i(6), fontSize: mobile ? 20 : 24, fontStyle: 'italic', color: 'var(--gold-pale)', margin: '22px 0 10px', maxWidth: 460 }}
          >
            Carry the package. Outrun the curfew. Escape before the signal dies.
          </p>
          <p className="reveal" style={{ ...i(7), fontSize: 13, color: 'var(--muted)', maxWidth: 440, lineHeight: 1.7 }}>
            A two-screen arcade escape — the city on your laptop, the wheel in your hand.
          </p>

          <div className="reveal" style={{ ...i(8), display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 30 }}>
            {mobile ? (
              <>
                <button className="btn btn-gold" onClick={() => onNavigate('controller')}>
                  <Smartphone size={16} /> Use as controller <ArrowRight size={16} className="btn-arrow" />
                </button>
                <button className="btn btn-ghost" onClick={() => onNavigate('game')}>
                  <Monitor size={16} /> Game screen
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-gold" onClick={() => onNavigate('game')}>
                  Start the escape <ArrowRight size={16} className="btn-arrow" />
                </button>
                <button className="btn btn-ghost" onClick={() => onNavigate('controller')}>
                  <Smartphone size={16} /> Open controller
                </button>
              </>
            )}
          </div>
        </section>

        <section className="reveal-scale" style={{ ...i(4), position: 'relative' }}>
          <GoldEmblem width="100%" style={{ maxWidth: mobile ? 420 : 640, display: 'block', margin: '0 auto' }} />
        </section>

        {!mobile && (
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 22, alignItems: 'flex-start' }}>
            <div className="reveal" style={i(9)}>
              <div className="kicker" style={{ fontSize: 9, lineHeight: 2 }}>
                Two screens
                <br />
                One escape
              </div>
              <div className="hairline" style={{ marginTop: 12 }} />
            </div>
            <div
              className="glass reveal"
              style={{ ...i(10), width: 110, height: 130, borderRadius: 12, display: 'grid', placeItems: 'center', padding: 12 }}
            >
              <Smartphone size={34} color="var(--gold)" strokeWidth={1.25} />
              <span className="kicker" style={{ fontSize: 8, textAlign: 'center' }}>
                Phone is
                <br />
                the wheel
              </span>
            </div>
            <div className="reveal" style={i(11)}>
              <div className="kicker" style={{ fontSize: 9, lineHeight: 2 }}>
                No download
                <br />
                No account
              </div>
              <div className="hairline" style={{ marginTop: 12 }} />
            </div>
          </aside>
        )}
      </main>

      {/* How it works — rows arrive one by one */}
      <section
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'grid',
          gridTemplateColumns: mobile ? '1fr' : 'repeat(3, 1fr)',
          gap: mobile ? 12 : 20,
          padding: mobile ? '18px 22px 36px' : '8px 56px 40px'
        }}
      >
        {STEPS.map((s, idx) => (
          <div
            key={s.n}
            className="glass reveal"
            style={{ ...i(12 + idx), padding: '20px 22px', display: 'flex', gap: 16, alignItems: 'flex-start', borderRadius: 14 }}
          >
            <span className="serif num" style={{ fontSize: 30, color: 'var(--gold)', lineHeight: 1 }}>
              {s.n}
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <s.icon size={14} color="var(--gold-pale)" />
                <span className="serif" style={{ fontSize: 19, color: 'var(--cream)' }}>
                  {s.title}
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{s.text}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
};
