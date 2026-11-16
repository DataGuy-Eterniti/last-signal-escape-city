import React from 'react';
import { CrimeHudState, PURSUIT_AT } from '../../ui/hudModel';
import { AlertBanner, DangerRing, PipRow, RadioFeed, RouteCard } from './HudKit';
import { IconBadge } from './Icons';

/* ==========================================================================
   Crime City Pursuit HUD — layered over the existing game HUD (which keeps
   the city title, link status, speed gauge and minimap). Adds:
   heat / wanted meter · pursuit warning · danger markers · route guidance ·
   police radio. Pointer-events none: never blocks the canvas.
   ========================================================================== */

export const HEAT_LABELS = ['Clean', 'Spotted', 'Wanted', 'Pursuit', 'Manhunt', 'Lockdown'];

export const HeatMeter: React.FC<{ heat: number }> = ({ heat }) => {
  const level = Math.floor(heat);
  const hot = heat >= PURSUIT_AT;
  return (
    <div className="hud-panel" style={{ padding: '10px 14px', borderColor: hot ? 'rgba(224,88,58,0.55)' : 'var(--line)', minWidth: 190 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="hud-label">Heat</span>
        <span className="serif" style={{ fontSize: 17, fontStyle: 'italic', color: hot ? 'var(--ember)' : level > 0 ? '#e9a06a' : 'var(--gold-pale)' }}>
          {HEAT_LABELS[Math.min(5, level)]}
        </span>
      </div>
      <PipRow value={heat} color={hot ? 'var(--ember)' : '#e9a06a'} label="Heat level" render={(filled) => <IconBadge size={22} filled={filled} />} />
    </div>
  );
};

export const CrimeHud: React.FC<{ state: CrimeHudState }> = ({ state }) => {
  const pursuit = state.pursuit;
  const closest = state.markers[0];
  return (
    <>
      {pursuit && (
        <>
          <div className="siren-wash red" />
          <div className="siren-wash blue" />
        </>
      )}
      <DangerRing markers={state.markers} />

      <div className="hud-slot hud-tc">
        {pursuit ? (
          <AlertBanner tone="pursuit" title="Pursuit" detail={closest ? `${state.markers.length} unit${state.markers.length > 1 ? 's' : ''} closing — break line of sight` : 'Units responding'} />
        ) : closest?.firing ? (
          <AlertBanner tone="info" title="Under fire" detail="Get a building between you and the shooter" />
        ) : null}
      </div>

      <div className="hud-slot hud-tl">
        <RouteCard route={state.route} />
      </div>

      <div className="hud-slot hud-tr">
        <HeatMeter heat={state.heat} />
      </div>

      <div className="hud-slot hud-bc">
        <RadioFeed messages={state.radio} />
      </div>
    </>
  );
};
