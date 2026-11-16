import React, { useMemo } from 'react';
import { getCity } from '../engine/cities';
import { buildWorld, roadX, roadY } from '../engine/world';
import { createActors } from '../engine/actors';
import { createInitialVehicle } from '../engine/physics';
import { MissionSelect } from '../components/MissionSelect';
import { CrimeHud } from '../components/hud/CrimeHud';
import { ZombieHud } from '../components/hud/ZombieHud';
import { MissionResult } from '../components/hud/MissionResult';
import { Meter } from '../components/hud/HudKit';
import { Cockpit } from '../components/controller/Cockpit';
import * as Icons from '../components/hud/Icons';
import { CrimeHudState, ZombieHudState, dangerMarkers, nextTurn } from '../ui/hudModel';
import { Artboard, CityFrame, ConditionPanel, Section, TopBar, grid2 } from './design/kit';
import { RescueFrame, RescueSection } from './design/RescueDesign';

/* ==========================================================================
   /design — Gold Noir 2.0 review sheet for the owner and Antigravity.
   Every screen and state rendered with the real components (real city
   renderer behind the HUDs, mock values where the engine has no data yet).
   Not linked from the game; open /design directly.
   ========================================================================== */

export const DesignRoute: React.FC = () => {
  // live-derived crime states from the real NYC world, so markers & route are genuine
  const nyc = useMemo(() => {
    const city = getCity('nyc')!;
    const world = buildWorld(city);
    const actors = createActors(world);
    const v = createInitialVehicle(roadX(4) + 38, roadY(6) + 120);
    v.angle = -Math.PI / 2;
    return { world, actors, v };
  }, []);
  // full-screen single-state frames for real-viewport checks: /design?frame=rescue-<state>
  const frame = new URLSearchParams(window.location.search).get('frame');
  const route = nextTurn(nyc.world, nyc.v.x, nyc.v.y, nyc.v.angle);
  const markers = dangerMarkers(nyc.actors, nyc.v);
  const objective = { name: nyc.world.extraction.name, distM: 412, bearing: -2.4, time: 74 };

  const calm: CrimeHudState = {
    heat: 1.4,
    pursuit: false,
    vehicleHealth: 92,
    integrity: 88,
    markers: markers.slice(0, 2).map((m) => ({ ...m, firing: false })),
    radio: [{ id: 1, from: 'Unit 9', text: 'Courier vehicle spotted on 7th Ave.', tone: 'info' }],
    route,
    objective
  };
  const fire: CrimeHudState = {
    ...calm,
    heat: 2.6,
    vehicleHealth: 64,
    integrity: 71,
    markers: markers.slice(0, 3).map((m, k) => ({ ...m, firing: k === 0, proximity: Math.max(m.proximity, 0.6) })),
    radio: [...calm.radio, { id: 2, from: 'Unit 4', text: 'Suspect northbound on 7th Ave. Units, take positions.', tone: 'info' }, { id: 3, from: 'Unit 4', text: 'Shots on target near W 50th St.', tone: 'alert' }]
  };
  const chase: CrimeHudState = {
    ...fire,
    heat: 3.7,
    pursuit: true,
    vehicleHealth: 38,
    integrity: 46,
    markers: [
      { id: 91, angle: 2.6, proximity: 0.85, kind: 'police', firing: true },
      { id: 92, angle: -2.2, proximity: 0.6, kind: 'police' },
      { id: 93, angle: 0.4, proximity: 0.45, kind: 'gunman', firing: true },
      { id: 94, angle: -0.9, proximity: 0.3, kind: 'gunman' }
    ],
    radio: [...fire.radio.slice(1), { id: 4, from: 'Command', text: 'Pursuit authorised. All units converge on Hell’s Kitchen.', tone: 'alert' }]
  };

  const zBase: ZombieHudState = {
    threat: 2.3,
    infected: null,
    blips: [
      { id: 1, angle: 0.6, dist: 0.7, size: 1 },
      { id: 2, angle: 2.4, dist: 0.85, size: 2 },
      { id: 3, angle: -1.2, dist: 0.5, size: 1 }
    ],
    vehicleHealth: 81,
    cargo: 94,
    countdown: 162,
    countdownTotal: 240,
    route: { turn: 'left', street: 'Marina', distM: 140 },
    objective: { name: 'Third Mainland Bridge', distM: 860, bearing: -2.9, time: 78 },
    markers: [{ id: 11, angle: 2.4, proximity: 0.35, kind: 'horde' }]
  };
  const zBad: ZombieHudState = {
    ...zBase,
    threat: 4.4,
    infected: { active: true, zone: 'Idumota', severity: 3 },
    blips: [
      { id: 1, angle: 0.2, dist: 0.3, size: 3 },
      { id: 2, angle: 1.4, dist: 0.45, size: 2 },
      { id: 3, angle: -0.6, dist: 0.25, size: 2 },
      { id: 4, angle: 3.0, dist: 0.8, size: 1 },
      { id: 5, angle: -2.2, dist: 0.65, size: 3 }
    ],
    vehicleHealth: 33,
    cargo: 52,
    countdown: 24,
    route: { turn: 'right', street: 'Broad Street', distM: 60 },
    markers: [
      { id: 21, angle: -0.3, proximity: 0.9, kind: 'horde', firing: true },
      { id: 22, angle: 1.3, proximity: 0.7, kind: 'horde', firing: true },
      { id: 23, angle: -2.4, proximity: 0.5, kind: 'horde' }
    ]
  };

  const lagos = getCity('lagos')!;
  const noop = () => undefined;
  const iconList = Object.entries(Icons) as [string, React.FC<{ size?: number; filled?: boolean }>][];

  if (frame?.startsWith('rescue')) return <RescueFrame frame={frame} />;

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: 'var(--ink-950)' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '36px clamp(16px, 3vw, 32px) 80px' }}>
        <span className="kicker">Last Signal · Design sheet</span>
        <h1 className="serif gold-text" style={{ fontSize: 'clamp(44px, 6vw, 76px)', fontWeight: 400, lineHeight: 0.95, marginTop: 12 }}>
          Gold Noir 2.0
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, maxWidth: 720, lineHeight: 1.7, marginTop: 14 }}>
          Every new screen and state, rendered with the production components. Crime City frames use the real New York map, officers and route guidance.
          Zombie frames use mock values until the zombie engine lands.
        </p>
        <nav style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 18, fontSize: 12 }}>
          {[
            ['controller', 'Controller'],
            ['missions', 'Mission select'],
            ['crime', 'Crime City HUD'],
            ['zombie', 'Zombie HUD'],
            ['results', 'Results'],
            ['rescue', 'Rescue Run'],
            ['icons', 'Icons']
          ].map(([id, t]) => (
            <a key={id} href={`#${id}`} style={{ color: 'var(--gold)', textDecoration: 'none' }}>
              {t}
            </a>
          ))}
        </nav>

        <Section id="controller" kicker="Task 1" title="Android controller" intro="Landscape phone at 800 × 370. Every control captures its own touch, so Gas, steering and Nitro can be held at the same time without cross-talk.">
          <div style={grid2}>
            <Artboard w={800} h={370} label="Classic · joystick" note="Stick steers, pedals drive. Gas held, steering right.">
              <Cockpit room="K7R9" link="connected" pingMs={38} onLeave={noop} onInput={noop} demo={{ settings: { mode: 'classic', style: 'joystick', leftHanded: false }, vec: { x: 0.62, y: 0.08 }, pedals: { gas: true, brake: false } }} />
            </Artboard>
            <Artboard w={800} h={370} label="Advanced · joystick" note="Up-right diagonal = accelerate + steer. Pedals off, Nitro enlarged.">
              <Cockpit room="K7R9" link="connected" pingMs={74} onLeave={noop} onInput={noop} demo={{ settings: { mode: 'advanced', style: 'joystick', leftHanded: false }, vec: { x: 0.5, y: 0.72 }, nitro: true }} />
            </Artboard>
            <Artboard w={800} h={370} label="Classic · D-pad · left-handed" note="8-way pad: one thumb hits the up-left diagonal.">
              <Cockpit room="K7R9" link="connected" pingMs={41} onLeave={noop} onInput={noop} demo={{ settings: { mode: 'classic', style: 'dpad', leftHanded: true }, dpad: { up: true, left: true, down: false, right: false } }} />
            </Artboard>
            <Artboard w={800} h={370} label="Reconnecting" note="Banner over the cockpit; inputs paused until the link returns.">
              <Cockpit room="K7R9" link="reconnecting" pingMs={0} onLeave={noop} onInput={noop} demo={{ settings: { mode: 'classic', style: 'joystick', leftHanded: false } }} />
            </Artboard>
            <Artboard w={800} h={370} label="Settings sheet" note="Mode, input style, handedness and haptics. Saved on the phone.">
              <Cockpit room="K7R9" link="connected" pingMs={38} onLeave={noop} onInput={noop} demo={{ settings: { mode: 'classic', style: 'joystick', leftHanded: false }, sheetOpen: true }} />
            </Artboard>
            <Artboard w={640} h={360} label="Small phone (640 × 360)" note="Stick scales to the panel; minimum 150 px.">
              <Cockpit room="K7R9" link="connected" pingMs={120} onLeave={noop} onInput={noop} demo={{ settings: { mode: 'classic', style: 'joystick', leftHanded: false }, vec: { x: -0.4, y: 0 }, pedals: { gas: false, brake: true } }} />
            </Artboard>
          </div>
        </Section>

        <Section id="missions" kicker="Task 4" title="Mission select" intro="Step 2 after choosing a city. Cards explain objective and difficulty for that city; the briefing panel lists hazards in-world.">
          <Artboard w={1366} h={900} label="Desktop · Lagos Island · Crime City selected on hover">
            <MissionSelect city={lagos} onPick={noop} onBack={noop} onPair={noop} phoneLinked />
          </Artboard>
        </Section>

        <Section id="crime" kicker="Task 2" title="Crime City HUD" intro="Heat meter, pursuit warning, edge danger markers (blue = police unit, ember = gunman, pulsing = aiming at you), turn-by-turn route and police radio.">
          <Artboard w={1366} h={768} label="Heat 1 · Spotted" note="Calm: route guidance and one radio line.">
            <CityFrame cityId="nyc" ix={4} iy={6} />
            <TopBar city="NEW YORK" district="Hell’s Kitchen" objective={objective.name} dist="410 m" clock="1:14" />
            <CrimeHud state={calm} />
            <ConditionPanel kmh={86} vehicle={calm.vehicleHealth} cargo={calm.integrity} />
          </Artboard>
          <div style={grid2}>
            <Artboard w={1366} h={768} label="Heat 2 · Under fire">
              <CityFrame cityId="nyc" ix={4} iy={6} />
              <TopBar city="NEW YORK" district="Hell’s Kitchen" objective={objective.name} dist="380 m" clock="1:31" />
              <CrimeHud state={fire} />
              <ConditionPanel kmh={112} vehicle={fire.vehicleHealth} cargo={fire.integrity} />
            </Artboard>
            <Artboard w={1366} h={768} label="Heat 3+ · Pursuit" note="Siren wash at the screen edges, pursuit banner.">
              <CityFrame cityId="nyc" ix={4} iy={6} />
              <TopBar city="NEW YORK" district="Hell’s Kitchen" objective={objective.name} dist="240 m" clock="2:02" />
              <CrimeHud state={chase} />
              <ConditionPanel kmh={164} vehicle={chase.vehicleHealth} cargo={chase.integrity} />
            </Artboard>
          </div>
        </Section>

        <Section id="zombie" kicker="Task 3" title="Zombie Outbreak HUD" intro="Same layout grammar, toxic accent. Threat level, infected-zone warning, heading-up horde radar, evac countdown and the evac radio channel.">
          <div style={grid2}>
            <Artboard w={1366} h={768} label="Threat rising">
              <CityFrame cityId="lagos" ix={3} iy={4} tint="rgba(30,40,10,0.25)" />
              <TopBar city="LAGOS" district="Marina" objective={zBase.objective.name} dist="860 m" clock="2:42" accent="var(--toxic)" clockLabel="evac" />
              <ZombieHud state={zBase} radio={[{ id: 1, from: 'Evac command', text: 'Airlift holding at Third Mainland Bridge. Bring the samples.', tone: 'info' }]} />
              <ConditionPanel kmh={92} vehicle={zBase.vehicleHealth} cargo={zBase.cargo} cargoLabel="Vaccine" />
            </Artboard>
            <Artboard w={1366} h={768} label="Infected zone · 0:24 left" note="Hazard banner, toxic wash, urgent countdown, horde closing.">
              <CityFrame cityId="lagos" ix={2} iy={3} tint="rgba(30,40,10,0.35)" />
              <TopBar city="LAGOS" district="Idumota" objective={zBase.objective.name} dist="210 m" clock="0:24" accent="var(--toxic)" clockLabel="evac" />
              <ZombieHud
                state={zBad}
                radio={[
                  { id: 1, from: 'Evac command', text: 'Rotors spinning. Thirty seconds.', tone: 'alert' },
                  { id: 2, from: 'Spotter', text: 'Horde massing on Broad Street — go right, now.', tone: 'alert' }
                ]}
              />
              <ConditionPanel kmh={140} vehicle={zBad.vehicleHealth} cargo={zBad.cargo} cargoLabel="Vaccine" />
            </Artboard>
          </div>
        </Section>

        <Section id="results" kicker="Task 2 · 3" title="Mission results">
          <div style={grid2}>
            <Artboard w={1366} h={768} label="Courier · Escaped">
              <CityFrame cityId="gold" ix={3} iy={3} />
              <MissionResult mode="courier" outcome="escaped" cityName="Gold City" line="You made Harbor Gate in 1:48." time={108} stats={[{ label: 'Package', value: '84%', icon: 'cargo' }]} note="New best time" onRetry={noop} onMission={noop} onCity={noop} />
            </Artboard>
            <Artboard w={1366} h={768} label="Crime · Busted">
              <CityFrame cityId="nyc" ix={4} iy={6} />
              <MissionResult
                mode="crime"
                outcome="busted"
                cityName="New York"
                line="You stopped too close to the law. Cuffs on, cargo seized."
                time={131}
                stats={[
                  { label: 'Package', value: '41%', icon: 'cargo' },
                  { label: 'Vehicle', value: '22%', icon: 'vehicle', highlight: true },
                  { label: 'Peak heat · Manhunt', value: '4/5', icon: 'heat', highlight: true }
                ]}
                onRetry={noop}
                onMission={noop}
                onCity={noop}
              />
            </Artboard>
            <Artboard w={1366} h={768} label="Zombie · Extracted">
              <CityFrame cityId="lagos" ix={0} iy={1} tint="rgba(30,40,10,0.3)" />
              <MissionResult
                mode="zombie"
                outcome="extracted"
                cityName="Lagos Island"
                line="The evac lifted off with you aboard."
                time={214}
                stats={[
                  { label: 'Vaccine', value: '67%', icon: 'cargo' },
                  { label: 'Time to spare', value: '0:26', icon: 'flag' },
                  { label: 'Peak threat', value: '4/5', icon: 'threat', highlight: true }
                ]}
                onRetry={noop}
                onMission={noop}
                onCity={noop}
              />
            </Artboard>
            <Artboard w={1366} h={768} label="Zombie · Overrun">
              <CityFrame cityId="lagos" ix={2} iy={3} tint="rgba(30,40,10,0.4)" />
              <MissionResult mode="zombie" outcome="overrun" cityName="Lagos Island" line="The horde closed in before you reached the evac." time={176} stats={[{ label: 'Vaccine', value: '0%', icon: 'cargo', highlight: true }, { label: 'Peak threat', value: '5/5', icon: 'threat', highlight: true }]} onRetry={noop} onMission={noop} onCity={noop} />
            </Artboard>
          </div>
        </Section>

        <RescueSection />

        <Section id="icons" kicker="Task 5" title="Icons & status indicators" intro="Original 24 px line icons, 1.6 px stroke, currentColor. Shown in gold, then in the three threat accents.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
            {iconList.map(([name, I]) => (
              <div key={name} className="glass" style={{ padding: 14, display: 'grid', placeItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <span style={{ color: 'var(--gold)' }}>
                    <I size={26} />
                  </span>
                  <span style={{ color: 'var(--ember)' }}>
                    <I size={18} />
                  </span>
                  <span style={{ color: 'var(--siren)' }}>
                    <I size={18} />
                  </span>
                  <span style={{ color: 'var(--toxic)' }}>
                    <I size={18} />
                  </span>
                </div>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>{name.replace('Icon', '')}</span>
              </div>
            ))}
          </div>
          <div className="glass" style={{ padding: 18, display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            <Meter label="Vehicle" value={86} icon={<Icons.IconWrench size={12} />} />
            <Meter label="Package" value={48} icon={<Icons.IconCargo size={12} />} />
            <Meter label="Cargo" value={18} icon={<Icons.IconCargo size={12} />} />
            <Meter label="Infection" value={64} accent="var(--toxic)" icon={<Icons.IconBiohazard size={12} />} />
          </div>
        </Section>
      </div>
    </div>
  );
};
