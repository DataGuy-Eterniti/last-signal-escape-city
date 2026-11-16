# Gold Noir UI/UX upgrade — files in this package

Copy this folder over your project root (overwrite when asked). Then run `npm test` and `npm run build`.

## Changed
- index.html — Cormorant Garamond + Inter fonts, theme colour, no white flash
- public/car-icon.svg — gold favicon
- src/main.tsx — imports the new design system
- src/App.tsx — "/" now shows the title screen; cross-fade page transitions; ?room= still opens the controller directly (QR unchanged)
- src/engine/renderer.ts — gold-noir city and car (same function signature; vignette cached for performance)
- src/routes/GameRoute.tsx — new HUD, gold speed gauge, input-source indicator, connect/disconnect toasts, redesigned pairing panel (QR retained)
- src/routes/ControllerRoute.tsx — new join screen and cockpit; error message on failed join; rotate hint

## New
- src/styles/theme.css — palette, typography, buttons, staggered reveal + cross-fade motion
- src/components/Ornaments.tsx — gold backdrop, letter reveal, folded-gold car emblem, speed arc
- src/routes/LandingRoute.tsx — title screen

## Not touched
src/engine/physics.ts, src/network/webrtc.ts, src/utils/room.ts, src/types.ts, all tests, package.json (no new dependencies).

Verified: 12/12 tests pass, tsc clean, production bundle 92 KB gzipped (budget 100 KB).

---

# Gold Noir 2.0 — controller, missions, Crime City & Zombie HUDs

Branch: `feature/gold-noir-2-ui` (created by the install script on the owner's machine, committed under the owner's identity only).
Review every screen and state at **`/design`** (not linked from the game).

## Protected files — what was and wasn't touched

| Area | Status |
| --- | --- |
| `src/network/webrtc.ts`, `src/utils/room.ts`, `src/utils/url.ts` | **Not touched** |
| `src/engine/*` (physics, world, actors, renderer, cities, palette) | **Not touched** |
| Authentication / Base44 config | **Not touched** |
| `src/types.ts` (`ControllerInput` packet shape) | **Not touched** — the new controller sends the same `{ steer, throttle, brake, nitro }` |
| `src/routes/ControllerRoute.tsx` | UI only. The room-join screen, `ControllerNetwork` usage and the 25 Hz sender are unchanged; the old cockpit JSX and horizontal-joystick handlers were replaced by `<Cockpit>`, which writes the same four refs. |
| `src/routes/GameRoute.tsx` | UI + mission flow. Host networking, physics stepping and rendering calls unchanged. Adds the mission step, Crime City rules (via `ui/crimeDirector.ts`), the Crime HUD and the mode-aware results card. |
| `src/App.tsx` | Adds the lazy `/design` route only. |

## New files

| File | Deliverable |
| --- | --- |
| `src/components/controller/Cockpit.tsx` | 1 · Controller: 360° analog stick, 8-way D-pad, Classic / Advanced modes, left-handed mirror, haptics, settings sheet, link-quality bars, input echo, reconnect banner, portrait hint |
| `src/ui/controls.ts` | Pure input mapping (dead zone, expo, D-pad sectors, mode mapping, link bars, settings persistence) |
| `src/components/MissionSelect.tsx` | 2 · Mission selection (step 2 after city): objective, per-city difficulty, hazards, in-world briefing, locked state |
| `src/ui/missions.ts` | Mission data: Courier Escape, Crime City Pursuit, Zombie Outbreak |
| `src/components/hud/CrimeHud.tsx` | 3 · Heat / wanted meter, pursuit banner + siren edge wash, danger markers, route guidance, police radio |
| `src/components/hud/ZombieHud.tsx` | 4 · Threat level, infected-zone banner + toxic wash, horde radar, evac countdown, evac radio |
| `src/components/hud/HudKit.tsx` | Shared HUD parts: segmented meters, pip rows, edge danger ring, radio feed, turn-by-turn route card, objective chip, alert banner, countdown ring |
| `src/components/hud/MissionResult.tsx` | Mode-aware results: Escaped · Package lost · Wrecked · Busted · Extracted · Overrun · Evac missed |
| `src/components/hud/Icons.tsx` | 5 · 17 original line icons (badge, siren, crosshair, radio, wrench, cargo, route, flag, timer, biohazard, horde, infected, radar, courier, sliders, mirror) |
| `src/ui/hudModel.ts` | HUD view-models: route guidance (BFS around barricades), street names, danger markers, heat model |
| `src/ui/crimeDirector.ts` | Crime City rules: heat, officer sharpening, vehicle health, busted, radio chatter with real street names |
| `src/routes/DesignRoute.tsx` | 6 · `/design` review sheet: all controller, HUD, mission and results states, desktop + phone sizes |
| `src/__tests__/controls.test.ts`, `src/__tests__/missions.test.ts` | 19 new tests |
| `src/styles/theme.css` (appended) | Threat accents (ember, siren blue, toxic olive), HUD slots with compact breakpoints, lightweight keyframes |

No new dependencies. No images. All motion is CSS opacity/transform; `prefers-reduced-motion` is respected by the existing global rule.

## Implementation notes for Antigravity

1. **Controller modes.**
   - **Classic:** stick x steers and the pedals drive; pushing the stick forward or back also accelerates or brakes, so diagonals work with one thumb.
   - **Advanced:** stick y is throttle (up) or brake/reverse (down). The pedals are hidden and Nitro takes their space.
   - **D-pad:** uses 45° sectors, so one thumb can hit diagonals.
   - Settings persist in `localStorage` under `last-signal:controller`, wrapped in try/catch.
2. **Multitouch.** Every control uses Pointer Events with `setPointerCapture`. The stick panel accepts one pointer at a time, so a second thumb sliding onto it is ignored. Inputs are zeroed while the settings sheet is open.
3. **Mission flow.** The flow is City → Mission → Play. `?city=…&mission=…` deep-links straight into a run. The header back button returns to mission select, and the results card offers Retry, Change mission or Choose city.
4. **Crime City rules** live in `ui/crimeDirector.ts`. They adjust `actors.tuning` (sight range and aim time) from heat, which is the only engine touch-point, done through the existing public field.
   - **Heat** rises on shots, hits, traffic crashes and shoved officers, then cools after 6 s of calm.
   - **Pursuit** starts at heat 3.
   - **Busted** happens after 2.5 s stopped within 130 px of an officer at heat 4 or more.
   - **Wrecked** happens when vehicle health reaches 0. Crashes cost 0.9× and bullets 1.3× of package damage.
5. **Zombie Outbreak** is designed but locked: `available: false` in `ui/missions.ts`, so the card shows "Coming soon". To ship it:
   - Add zombie actors in the engine (the protected area, which needs owner approval).
   - Build a `ZombieHudState` each HUD tick. The type is in `ui/hudModel.ts`.
   - Render `<ZombieHud state radio>` the same way `CrimeHud` is rendered.
   - Map the outcomes `extracted`, `overrun` and `evac-missed` to `MissionResult`.
   - Flip `available` to `true`.
6. **Performance.** `.hud-panel` deliberately has no `backdrop-filter`: blurring over the live canvas cost about 12 FPS. Crime mode measured 60 FPS at 1366×768 in headless Chromium. The HUD re-renders at the existing 10 Hz sampler, not per frame.
7. **Bundle.** The phone loads index + ControllerRoute + Cockpit + Icons + webrtc, about 89 KB gzipped, under the 100 KB budget. `/design` is lazy and never loads during play.
8. **Responsive.**
   - **Laptop layout:** HUD slots (`.hud-tl`, `.hud-tr`, `.hud-tc`, `.hud-bc`, `.hud-mr`) are positioned for laptop screens.
   - **Small windows** (≤900 px wide or ≤620 px tall): the slots scale to 88%, the radio hides and the radar shrinks.
   - **Mission select:** stacks to one column at ≤900 px.
   - **Cockpit:** sizes the stick to its panel (150–250 px) and shows a dismissible rotate hint in portrait.

Verified: 56/56 tests, `tsc` clean, production build OK, 60 FPS in Courier and Crime modes.

### Follow-up fix (after f9b262e)
- `src/routes/GameRoute.tsx`: wires Antigravity's `InputReceiver` into the host. Phone packets are now accepted latest-input-wins, stale or out-of-order packets are dropped, and input falls back to neutral after 250 ms of silence. The receiver resets when a phone connects or disconnects, so a reloaded phone, whose sequence restarts at 1, is accepted. Antigravity's uncommitted `GameRoute.tsx` edits were overwritten when the Gold Noir 2.0 package was copied in; this restores the intent.
- `src/__tests__/inputReceiver.test.ts`: removed an unused import that made `tsc` (and therefore `npm run build` / Base44 deploy) fail.

---

# Road visibility review (branch `feature/road-visibility`)

Visual, camera and route-guidance pass on top of Gold Noir 2.0. No world geometry, physics, collision or networking changes. Full handoff with screenshots: `docs/handoff/road-visibility/ROAD_VISIBILITY_HANDOFF.md`.

---

# Gold Noir 3.0 — Rescue Run (design branch `design/rescue-run`)

Base: `integration/road-geometry-and-visibility` @ `6dea714` (210 px roads + visibility pass). **Not merged into `main`, and must not be without owner approval.**
Preview: **`/design#rescue`** (sheet) and full-screen frames at **`/design?frame=rescue-<state>`**, where state is `missions`, `approach`, `boarding`, `guided`, `unloading`, `dropped`, `survival`, `results` or `results-partial`.
Screenshots: `docs/handoff/rescue-run/` (1366×768 and 640×360).

## Protected areas — untouched

| Area | Status |
| --- | --- |
| `src/network/*` (WebRTC, TURN, input receiver, RTT) | Not touched |
| `src/engine/*` (physics, world generation, collisions, actors, renderer, camera, cities) | Not touched; read-only imports only |
| Courier Escape and Crime City screens and rules | Unchanged (60 FPS re-measured in both) |
| Zombie Outbreak | Still locked, "Coming soon" |
| Rescue Run | Visible but locked with a **"Design preview"** badge until Antigravity wires it in (steps below) |

## Deliverables

| # | Brief item | Where |
| --- | --- | --- |
| 1 | Mission card: difficulty, survivor count, seats, estimated threat (1–5) | `MissionSelect.tsx` (`RescueStats`), data in `ui/missions.ts` |
| 2 | In-world survivor markers: white figure with waving flare, floating white pin (turns ember when patience is under 30%), sonar pulse, patience arc | `ui/rescue/rescueCanvas.ts` (`drawSurvivor`) |
| 3 | Pickup ring plus 2-second boarding: ring turns solid gold, progress arc in the world, "BOARDING 1.2s / 2s" label, HUD boarding card | `rescueCanvas.ts`, `RescueHud.tsx` (`BoardingCard`) |
| 4 | Capacity: seat icons plus "2/3 onboard" and a context line (Full: head to the safe zone, and so on) | `RescueHud.tsx` (`CapacitySeats`) |
| 5 | Safe zone: double gold ring, rotating dashes, inward chevrons, white unload arc (1.5 s); drop-off confirmation card "3 survivors safe +3,000 pts" | `rescueCanvas.ts` (`drawSafeZone`), `RescueHud.tsx` (`DropConfirm`) |
| 6 | Rescue HUD: waiting / onboard / rescued / lost counts and "x/y saved" | `RescueHud.tsx` (`RescueCounter`) |
| 7 | Results: survivors saved, time, vehicle condition, lost, score with breakdown | `MissionResult.tsx` (`score` prop, outcomes `rescue-complete`, `rescue-partial`, `rescue-failed`) |
| 8 | Navigation levels **Guided / Explorer (default) / Survival**: picker in the briefing, badge in the HUD | `ui/rescue/rescueModel.ts` (`NAV_LEVELS`), `MissionSelect.tsx` (`NavLevelPicker`), `RescueHud.tsx` (`NavBadge`) |
| 9 | Compact phone and desktop states | `theme.css`: `.hud-root` compact rules, `.hud-rescue-card` |
| 10 | Threat warnings: police pursuit (siren wash + banner) and outbreak (toxic wash + hazard banner), for future zombies | `RescueHud.tsx` (`threat` prop) |

New icons in `Icons.tsx`: `IconSurvivor`, `IconSeat`, `IconSafeZone`, `IconCompass`, `IconTrophy`, `IconLost`.

## Navigation levels

| Level | Route ribbon | Survivor edge markers | Distances | Safe-zone marker | Minimap survivors |
| --- | --- | --- | --- | --- | --- |
| Guided | Yes, to the nearest survivor, or the safe zone when full | All | Yes | Yes | Yes |
| **Explorer (default)** | No | Within 900 px (≈ 90 m) | Yes | Yes | Yes |
| Survival | No | None | No ("— m") | No | No |

Markers are hidden for targets already on screen (`minDist` 340 px).

## Rescue rules (pure, tested: `ui/rescue/rescueModel.ts`)

- **Survivors per difficulty:** 5 / 7 / 9 / 11. **Seats:** 3 / 3 / 3 / 2. **Patience:** 240 / 180 / 140 / 110 s, ±20% each.
- **Placement:** survivors stand on the kerb sidewalk, at least 450 px from the start and the safe zone and at least 700 px apart. They are never inside buildings (tested in all four cities).
- **Boarding:** stop within 70 px, below 45 px/s, for 2 s. One survivor boards at a time. Leaving the ring or moving drains progress.
- **Drop-off:** stop inside the safe zone (120 px, at the city's extraction point) for 1.5 s. Everyone onboard is rescued at once.
- **End of run:** when nobody is waiting or onboard.
- **Score:** 1,000 per rescue, plus a time bonus of max(0, 600 − t) × 2, plus vehicle health × 5, plus 1,500 if nobody is left behind, minus 300 per lost survivor.
- **Guided routing:** `routePolylineTo()` does a barricade-aware search to any point.

## Integration steps for Antigravity (`GameRoute.tsx`; no engine edits needed)

1. **Unlock:** in `ui/missions.ts`, set Rescue Run `available: true` and remove `lockLabel`.
2. **Navigation level:** `MissionSelect` now calls `onPick(mission, { nav })`. Store `nav` alongside the mission.
3. **Start of run:** in `resetRun`, for rescue missions set `rescueRef.current = planRescue(world, missionDifficulty(mission, city), nav)`.
4. **Every frame, after physics:** `const ev = stepRescue(rescueRef.current, vehicle, vehicle.speed, dt)`.
   - On `dropped`, show `DropConfirm` for about 2.5 s with `points = count × 1000`.
   - On `lost`, `boarded` and `full`, use toasts or radio lines as wanted.
5. **Draw in the world:** after `renderGame`, using the same camera:
   ```ts
   const s = scaleRef.current, z = cam.zoom;
   ctx.setTransform(s * z, 0, 0, s * z, s * (cssW / 2 + shakeX - cam.x * z), s * (cssH / 2 + shakeY - cam.y * z));
   drawRescueWorld(ctx, rescueRef.current, time, { showPatience: nav !== 'survival' });
   ```
6. **Route ribbon:** for Guided, pass `route: routePolylineTo(world, v.x, v.y, obj.x, obj.y)` to `renderGame`, where `obj = currentObjective(...)`. For Explorer and Survival, pass no route.
7. **HUD, at the existing 10 Hz sampler:** build `RescueHudState` exactly like `hudFor()` in `routes/design/RescueDesign.tsx`.
   - Render `<RescueHud state={…} />`.
   - In the header, replace the Extraction chip with `<RescueObjectiveChip objective={…} showDistance={NAV_LEVELS[nav].distances} />`.
8. **Compact state:** wrap the game HUD layer in `<div className="hud-root">`, and add `className="hud-top"` to the header, `"hud-speed"` to the speed panel and `"hud-minimap"` to the minimap. Below 760×430 the HUD then scales to 80% and secondary text hides.
9. **Pursuit threat:** optionally run `crimeDirector` alongside Rescue and pass `threat: heat >= 3 ? 'pursuit' : null`. Keep `'outbreak'` for when zombies exist.
10. **Results:**
    - Outcome is `rescue-complete` if everyone was saved, `rescue-partial` if some were, and `rescue-failed` if none were (or `wrecked` if vehicle health reaches 0).
    - Pass `score={rescueScore(rescue, vehicleHealth)}` and the stats Survivors saved, Vehicle and Lost.
    - The result lines are already in `GameRoute`.
11. **Minimap:** if `NAV_LEVELS[nav].minimapSurvivors`, add white dots for waiting survivors (ember when urgent; `survivorTone()`).

## Engine follow-ups (protected area: owner approval needed)

1. **Bug, from the road-visibility pass:** `renderer.ts` `drawGoalMarker()` uses a fixed safe frame (`T = 150`, `B = height − 190`). On screens shorter than about 400 px that frame inverts, and the off-screen extraction arrow lands on the car (see `11-compact-survival-640x360.jpg`). Fix by clamping the frame:
   ```ts
   const T = Math.min(150, height * 0.28);
   const B = Math.max(T + 40, height - Math.min(190, height * 0.3));
   ```
2. **Option to hide that marker:** add `goalMarker?: boolean` to `RenderOptions`, so Rescue can turn it off in Survival and when nothing is onboard.
3. **Suppress the label:** in Rescue mode, hide the renderer's "EXTRACTION · …" label, since the safe zone draws its own.
4. **Optional layering:** draw `drawRescueWorld` inside `renderGame`, before the car, so the car sits above the pickup ring.

## Verification

- 93/93 tests: 10 new rescue tests, plus the existing suite including Antigravity's driving-experience tests.
- `tsc` clean, production build OK.
- Phone bundle unchanged: the Rescue code is only in the Game and Design chunks.
- 60 FPS in Courier Escape and Crime City at 1366×768 in headless Chromium.
- Layout checked at 1366×768 and 640×360. Not tested on a physical Android phone.
