# Road visibility review — visual handoff for Antigravity

**Branch:** `feature/road-visibility`, cut from `feature/gold-noir-2-ui` at `3e9c9c6`; that branch is left untouched.
**Scope:** rendering, camera and route guidance only. **Not touched:** world geometry (`world.ts`), physics, collisions, `actors.ts`, networking, HUD and controller design.

## 1. How it adapts to Antigravity's wider roads

Every road marking is now derived from `ROAD`, `HR` and `SIDEWALK` in `world.ts`. Changing the road width there needs no renderer edits.

| Marking | Rule (ROAD = 160 → 210) |
| --- | --- |
| Parking-lane line | `ROAD × 0.09` in from the kerb (14 → 19 px) |
| Centre dashes | `ROAD × 0.15` dash, `ROAD × 0.12` gap (24/19 → 32/25 px) |
| Zebra depth | `max(18, ROAD × 0.14)` (22 → 29 px) |
| Zebra stripe | `max(6, ROAD × 0.045)` |
| Street-name offset | `ROAD × 0.11` from centre |
| Corner lamps | at `HR + SIDEWALK × 0.4` |

Previews at `ROAD = 210` (03, 05) were built from a scratch copy, **without editing `world.ts`**. Both widths measured 60 FPS at 1366×768.

> Antigravity: `actors.ts` still uses `LANE = 38` and parked cars sit at `HR − 16`. With wider roads you may want `LANE ≈ ROAD × 0.24` so traffic stays centred in its lane. That's your call: it's geometry, so I haven't changed it.

## 2. Lane markings, junctions and road edges

| Element | Before | After |
| --- | --- | --- |
| Kerb / road edge | 1.5 px at 20% | 2 px at 42% pale gold, plus an inner sidewalk line |
| Parking-lane line | 1 px at 10% | 2 px at 24% gold |
| Centre line | 2 px dashes at 30% | 3 px dashes at 50% warm gold, ending before the stop bar |
| Junction box | same colour as the road | `#17100a`, a touch lighter, so turns read at a glance |
| Zebras | 16% | 26%, inset from the kerb |
| Stop bars | none | 4 px bar on the inbound half of each approach (right-hand traffic) |
| Kerb corners | none | small kerb-corner highlights |

See `07-junction-closeup-before-after.jpg`.

## 3. Solid vs non-solid at a glance

One rule: **anything you can crash into has a dark keyline and a thin gold rim**.

- **Buildings:** 2 px black keyline, plus a 1 px rim at `rgba(255,214,150,0.30)`.
- **Barricades:** black keyline around the striped jersey blocks.
- **Parked and traffic cars, cones, fountains:** already high-contrast, unchanged.
- **Park tree canopies are not solid in the physics:** they now have a soft shadow and lower contrast, so they no longer read as walls.

## 4. Extraction route

- **Route ribbon:** a soft gold band with chevrons flowing toward the goal along the road centre lines. It shows 1,600 px ahead, fades with distance, and is recomputed 10 times a second using the barricade-aware search from `ui/hudModel.ts`.
  - The first leg snaps to the current road, so it never cuts through a block.
  - It compares the junction ahead with the one behind and draws the shorter route, so it never doubles back.
  - **G** toggles it. The hint "G route" was added to the speed panel.
- **Off-screen goal marker:** a gold arrow plus distance at the screen edge when the extraction is out of view, kept inside a safe frame that clears the header, speed panel and minimap.

## 5. Camera framing (`src/engine/camera.ts`, visual only)

- **Look-ahead:** the view leads the car by 0.55 s of travel, capped at 27% of the shorter screen side. At speed the car sits in the lower or rear part of the frame and the next junction is visible (06).
- **Speed zoom:** pulls out up to 18% at nitro speed (`ZOOM_AT = 520 px/s`, floor 0.82).
- **Smooth:** exponential smoothing (camera 4.5/s, zoom 1.6/s). No lead while reversing.
- **Plumbing:** `renderGame(…, { camera, route })` takes both as optional options. Without them it behaves exactly as before, which the `/design` sheet relies on.

## Files

| File | Change |
| --- | --- |
| `src/engine/renderer.ts` | Markings, junction sprite, solid keylines, canopy, route ribbon, goal marker, camera transform. No geometry or collision code. |
| `src/engine/camera.ts` | **New**: look-ahead and speed-zoom camera, pure function |
| `src/ui/hudModel.ts` | `junctionAhead()`, `routePolyline()` |
| `src/routes/GameRoute.tsx` | Camera update per frame, route refresh at 10 Hz, **G** toggle |
| `src/__tests__/camera.test.ts` | **New**: 5 tests |
| `src/__tests__/missions.test.ts` | +2 route-ribbon tests |

Verified: 75/75 tests, `tsc` clean, production build OK, 60 FPS at ROAD 160 and 210.

## Screenshots

1. `01-before-160.jpg`: current branch
2. `02-after-160.jpg`: same spot after: markings, ribbon, look-ahead
3. `03-after-wide-210-preview.jpg`: preview with wider roads
4. `04-route-turn-160.jpg` / `05-route-turn-wide-210-preview.jpg`: route after a turn
5. `06-camera-lookahead-speed.jpg`: camera leading at speed, next turn in view
6. `07-junction-closeup-before-after.jpg`: junction close-up
