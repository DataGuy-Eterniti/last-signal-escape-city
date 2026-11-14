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
