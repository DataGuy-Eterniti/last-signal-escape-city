import React from 'react';
import { RadioMessage, ZombieBlip, ZombieHudState } from '../../ui/hudModel';
import { AlertBanner, CountdownRing, DangerRing, PipRow, RadioFeed, RouteCard } from './HudKit';
import { IconBiohazard, IconHorde } from './Icons';

/* ==========================================================================
   Zombie Outbreak HUD. Same layout grammar as Crime City (objective top
   centre, guidance top left, threat top right) so players never relearn the
   screen — but the accent switches from ember to toxic olive, and the radio
   becomes the evac channel.
   ========================================================================== */

export const THREAT_LABELS = ['Quiet', 'Stirring', 'Rising', 'High', 'Severe', 'Overrun'];

export const ThreatMeter: React.FC<{ threat: number; horde: number }> = ({ threat, horde }) => {
  const level = Math.min(5, Math.floor(threat));
  const severe = threat >= 4;
  return (
    <div className="hud-panel" style={{ padding: '10px 14px', minWidth: 190, borderColor: severe ? 'rgba(180,201,95,0.55)' : 'var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="hud-label">Threat</span>
        <span className="serif" style={{ fontSize: 17, fontStyle: 'italic', color: severe ? 'var(--toxic)' : 'var(--gold-pale)' }}>
          {THREAT_LABELS[level]}
        </span>
      </div>
      <PipRow value={threat} color="var(--toxic)" label="Threat level" render={() => <IconBiohazard size={21} />} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9, color: 'var(--toxic)', fontSize: 11 }}>
        <IconHorde size={14} />
        <span className="num">{horde}</span>
        <span style={{ color: 'var(--muted)' }}>infected nearby</span>
      </div>
    </div>
  );
};

/** Heading-up radar: the courier is the centre, blips are infected groups. */
export const HordeRadar: React.FC<{ blips: ZombieBlip[]; size?: number }> = ({ blips, size = 150 }) => (
  <div className="hud-panel" style={{ padding: 10, borderRadius: '50%' }}>
    <div style={{ position: 'relative', width: size, height: size, borderRadius: '50%', overflow: 'hidden', background: 'radial-gradient(circle, rgba(111,138,46,0.12), rgba(10,8,4,0.6) 70%)' }} role="img" aria-label={`Horde radar: ${blips.length} contacts`}>
      {[0.33, 0.66, 1].map((r) => (
        <span key={r} style={{ position: 'absolute', left: '50%', top: '50%', width: size * r, height: size * r, transform: 'translate(-50%,-50%)', borderRadius: '50%', border: '1px solid rgba(180,201,95,0.18)' }} />
      ))}
      <span style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(180,201,95,0.12)' }} />
      <span style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(180,201,95,0.12)' }} />
      <div className="radar-sweep" />
      {blips.map((b) => {
        const r = (size / 2 - 6) * Math.min(1, b.dist);
        const s = 4 + b.size * 3;
        return (
          <span
            key={b.id}
            className={b.dist < 0.35 ? 'danger-pip' : undefined}
            style={{
              position: 'absolute',
              left: size / 2 + Math.cos(b.angle - Math.PI / 2) * r - s / 2,
              top: size / 2 + Math.sin(b.angle - Math.PI / 2) * r - s / 2,
              width: s,
              height: s,
              borderRadius: '50%',
              background: 'var(--toxic)',
              boxShadow: '0 0 8px rgba(180,201,95,0.9)'
            }}
          />
        );
      })}
      {/* courier at the centre, pointing up */}
      <svg width={14} height={14} viewBox="0 0 24 24" style={{ position: 'absolute', left: size / 2 - 7, top: size / 2 - 7 }} aria-hidden="true">
        <path d="M12 3 19 20 12 16 5 20Z" fill="#ffc34d" />
      </svg>
    </div>
  </div>
);

export const ZombieHud: React.FC<{ state: ZombieHudState; radio?: RadioMessage[] }> = ({ state, radio = [] }) => {
  const horde = state.blips.reduce((n, b) => n + b.size * 3, 0);
  return (
    <>
      {state.infected?.active && <div className="toxic-wash" />}
      <DangerRing markers={state.markers} />

      <div className="hud-slot hud-tc">
        {state.infected?.active && (
          <AlertBanner tone="infected" title="Infected zone" detail={`${state.infected.zone} — ${['light', 'heavy', 'critical'][state.infected.severity - 1]} infection, keep moving`} />
        )}
      </div>

      <div className="hud-slot hud-tl">
        <RouteCard route={state.route} />
        <div className="hud-panel" style={{ padding: 10, alignSelf: 'flex-start' }}>
          <CountdownRing seconds={state.countdown} total={state.countdownTotal} label="Evac departs" />
        </div>
      </div>

      <div className="hud-slot hud-tr">
        <ThreatMeter threat={state.threat} horde={horde} />
      </div>

      <div className="hud-slot hud-mr">
        <HordeRadar blips={state.blips} />
      </div>

      <div className="hud-slot hud-bc">
        <RadioFeed messages={radio} channel="Evac" accent="var(--toxic)" />
      </div>
    </>
  );
};
