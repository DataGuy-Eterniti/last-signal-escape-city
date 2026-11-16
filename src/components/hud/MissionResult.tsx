import React from 'react';
import { RotateCcw, Map as MapIcon, Swords } from 'lucide-react';
import { Letters } from '../Ornaments';
import type { MissionId } from '../../ui/missions';
import { fmtClock } from './HudKit';
import { IconBadge, IconBiohazard, IconCargo, IconCourier, IconFlag, IconLost, IconSafeZone, IconSiren, IconSurvivor, IconTrophy, IconWrench } from './Icons';

/* ==========================================================================
   Mission results — one card, three moods. Success keeps the gold rays;
   failure dims them and tints the card with the mode's danger accent.
   ========================================================================== */

export type Outcome = 'escaped' | 'package-lost' | 'wrecked' | 'busted' | 'extracted' | 'overrun' | 'evac-missed' | 'rescue-complete' | 'rescue-partial' | 'rescue-failed';

const COPY: Record<Outcome, { title: string; kicker: string; win: boolean }> = {
  escaped: { title: 'Escaped', kicker: 'Extraction reached', win: true },
  'package-lost': { title: 'Package lost', kicker: 'Run over', win: false },
  wrecked: { title: 'Wrecked', kicker: 'Vehicle destroyed', win: false },
  busted: { title: 'Busted', kicker: 'Pursuit ended', win: false },
  extracted: { title: 'Extracted', kicker: 'Evac reached', win: true },
  overrun: { title: 'Overrun', kicker: 'The horde caught up', win: false },
  'evac-missed': { title: 'Evac missed', kicker: 'The airlift has left', win: false },
  'rescue-complete': { title: 'All saved', kicker: 'Nobody left behind', win: true },
  'rescue-partial': { title: 'Rescue complete', kicker: 'Survivors delivered', win: true },
  'rescue-failed': { title: 'No survivors', kicker: 'The streets went quiet', win: false }
};

export interface ResultStat {
  label: string;
  value: string;
  icon?: 'time' | 'cargo' | 'vehicle' | 'heat' | 'threat' | 'flag' | 'survivor' | 'safe' | 'lost';
  highlight?: boolean;
}

const StatIcon: React.FC<{ icon?: ResultStat['icon'] }> = ({ icon }) => {
  switch (icon) {
    case 'cargo':
      return <IconCargo size={15} />;
    case 'vehicle':
      return <IconWrench size={15} />;
    case 'heat':
      return <IconBadge size={15} />;
    case 'threat':
      return <IconBiohazard size={15} />;
    case 'flag':
      return <IconFlag size={15} />;
    case 'survivor':
      return <IconSurvivor size={15} />;
    case 'safe':
      return <IconSafeZone size={15} />;
    case 'lost':
      return <IconLost size={15} />;
    default:
      return <IconCourier size={15} />;
  }
};

export const MissionResult: React.FC<{
  mode: MissionId;
  outcome: Outcome;
  cityName: string;
  line: string; // one-sentence summary
  time: number;
  stats: ResultStat[];
  note?: string; // e.g. "New best time"
  score?: { total: number; parts: { label: string; value: number }[] }; // Rescue Run
  onRetry: () => void;
  onMission: () => void;
  onCity: () => void;
}> = ({ mode, outcome, cityName, line, time, stats, note, score, onRetry, onMission, onCity }) => {
  const c = COPY[outcome];
  const accent = mode === 'crime' ? 'var(--ember)' : mode === 'zombie' ? 'var(--toxic)' : 'var(--gold)';
  const i = (n: number) => ({ ['--i' as string]: n } as React.CSSProperties);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: c.win
          ? 'radial-gradient(80% 80% at 50% 45%, rgba(40,24,10,0.7), rgba(10,6,3,0.92))'
          : mode === 'zombie'
            ? 'radial-gradient(80% 80% at 50% 45%, rgba(30,34,12,0.75), rgba(8,8,3,0.94))'
            : 'radial-gradient(80% 80% at 50% 45%, rgba(48,16,8,0.72), rgba(10,5,3,0.94))',
        zIndex: 80,
        animation: 'fadeIn 500ms var(--ease-out) both',
        padding: 20
      }}
    >
      <div className="rays" style={{ opacity: c.win ? 0.8 : 0.2 }} />
      <div
        className="glass reveal-scale"
        role="dialog"
        aria-label={`${c.title} — ${cityName}`}
        style={{ ...i(0), position: 'relative', padding: '36px clamp(22px, 5vw, 48px)', textAlign: 'center', maxWidth: 560, width: '100%', borderColor: c.win ? 'var(--line-strong)' : accent }}
      >
        <span className="kicker reveal" style={{ ...i(1), color: c.win ? undefined : accent, display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          {mode === 'crime' ? <IconSiren size={13} /> : mode === 'zombie' ? <IconBiohazard size={13} /> : mode === 'rescue' ? <IconSurvivor size={13} /> : <IconCourier size={13} />}
          {cityName} · {c.kicker}
        </span>
        <h2 className="serif gold-text" style={{ fontSize: 'clamp(46px, 8vw, 64px)', fontWeight: 400, lineHeight: 1, margin: '14px 0 10px' }}>
          <Letters text={c.title} />
        </h2>
        <p className="serif reveal" style={{ ...i(4), fontStyle: 'italic', fontSize: 19, color: 'var(--gold-pale)' }}>
          {line}
        </p>

        <div className="reveal" style={{ ...i(5), display: 'grid', gridTemplateColumns: `repeat(${Math.min(4, stats.length + 1)}, 1fr)`, gap: 10, margin: '22px 0 6px' }}>
          <Stat stat={{ label: 'Time', value: fmtClock(time), icon: 'time' }} accent={accent} />
          {stats.map((s) => (
            <Stat key={s.label} stat={s} accent={accent} />
          ))}
        </div>
        {score && (
          <div className="reveal" style={{ ...i(6), margin: '16px 0 0', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 18px', alignItems: 'center', textAlign: 'left', borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <div style={{ gridRow: `span ${score.parts.length}`, display: 'grid', justifyItems: 'center', gap: 4, paddingRight: 18, borderRight: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--gold)' }}>
                <IconTrophy size={22} />
              </span>
              <span className="serif num" style={{ fontSize: 34, color: 'var(--gold)', lineHeight: 1 }}>
                {score.total.toLocaleString()}
              </span>
              <span className="hud-label" style={{ fontSize: 7 }}>
                Score
              </span>
            </div>
            {score.parts
              .filter((p) => p.value !== 0)
              .map((p) => (
                <div key={p.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: p.value < 0 ? 'var(--ember)' : 'var(--gold-pale)' }}>
                  <span>{p.label}</span>
                  <span className="num">
                    {p.value > 0 ? '+' : ''}
                    {p.value.toLocaleString()}
                  </span>
                </div>
              ))}
          </div>
        )}
        {note && (
          <p className="kicker reveal num" style={{ ...i(6), marginTop: 12, color: 'var(--gold)' }}>
            {note}
          </p>
        )}

        <div className="reveal" style={{ ...i(7), display: 'flex', gap: 10, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
          <button className="btn btn-gold" onClick={onRetry} autoFocus>
            <RotateCcw size={15} /> {c.win ? 'Run it again' : 'Retry'}
          </button>
          <button className="btn btn-ghost" onClick={onMission}>
            <Swords size={15} /> Change mission
          </button>
          <button className="btn btn-ghost" onClick={onCity}>
            <MapIcon size={15} /> Choose city
          </button>
        </div>
      </div>
    </div>
  );
};

const Stat: React.FC<{ stat: ResultStat; accent: string }> = ({ stat, accent }) => (
  <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '10px 8px', background: 'rgba(255,255,255,0.02)' }}>
    <div style={{ display: 'flex', justifyContent: 'center', color: stat.highlight ? accent : 'var(--muted)', marginBottom: 6 }}>
      <StatIcon icon={stat.icon} />
    </div>
    <div className="serif num" style={{ fontSize: 22, color: 'var(--cream)', lineHeight: 1 }}>
      {stat.value}
    </div>
    <div className="hud-label" style={{ fontSize: 7, marginTop: 5 }}>
      {stat.label}
    </div>
  </div>
);
