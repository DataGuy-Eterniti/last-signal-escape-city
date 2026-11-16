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
