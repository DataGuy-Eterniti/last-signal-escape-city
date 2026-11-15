# LAST SIGNAL: Escape the City

A phone-controlled browser arcade game where players escape a citywide lockdown carrying a mysterious package, using an Android-powered wireless driving dashboard and a laptop game screen.

Built for the **Base44 × Nitro by Overwolf $65K Web Game Contest**.

---

## Features

- **Dual-Screen Architecture**:
  - **Laptop Screen (`/game`)**: Top-down HTML5 Canvas 2D running at 60 FPS. Features camera-follow street grid, sleek courier car, dynamic headlight beams, brake lights, nitro exhaust flames, and real-time HUD telemetry.
  - **Android Dashboard (`/controller`)**: Mobile-optimized touch cockpit with virtual analog steering, gas/brake pedals, nitro boost, and haptic feedback.
- **Instant Pairing**:
  - Connects phone and laptop over peer-to-peer WebRTC DataChannels using ephemeral 4-character room codes or QR code scanning.
  - No mobile app downloads, no player accounts, no paywalls.
- **Fail-Safe Controls**: Full keyboard fallback on laptop (`WASD` or Arrow keys + `Shift/Space` for Nitro).
- **Zero-Billing & Ephemeral Data**: Pure P2P low-latency UDP streams with zero database credit consumption.

---

## Quick Start (Local Run)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

### 3. Open Routes
- **Laptop Game Screen**: Navigate to `http://localhost:5173/game`
- **Android Phone Controller**: Scan the QR code displayed on the laptop, or open the game's `/controller` page and enter the room code. Any internet connection works (mobile data or any Wi-Fi) — see *Phone pairing* below.

---

## Testing & Quality Assurance

```bash
# Run unit tests
npm test

# Build production bundle
npm run build
```

---

## Architecture & Tooling

See [AI_TOOLS.md](AI_TOOLS.md) for transparent documentation of development tools and human project ownership.
See `base44/config.jsonc` for Base44 cloud deployment configuration.


## Phone pairing

The phone and laptop do **not** need to share Wi-Fi. Pairing goes through the internet:

1. Both devices load the game from the public Base44 URL (HTTPS).
2. The PeerJS signalling server introduces them; inputs then flow phone → laptop over WebRTC.
3. If the two networks block a direct link (common with mobile data vs campus Wi-Fi), a TURN relay carries the inputs. Configure a free relay (e.g. Metered) with `VITE_TURN_URLS`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL` in `.env.local` (git-ignored) and in the Base44 build environment.

In local development (`npm run dev`), the QR code automatically uses the laptop's current network IP.
