/// <reference types="vite/client" />

/**
 * URL and Origin Resolution Utility for LAST SIGNAL
 *
 * Ensures the QR code and deep links provide a reachable address for Android phones
 * both in local development (resolving LAN/hotspot IP instead of 'localhost')
 * and in production (using the public HTTPS Base44 origin).
 */

export function getControllerUrl(roomCode: string): string {
  const code = (roomCode || '').trim().toUpperCase();

  let baseOrigin = '';

  if (typeof window !== 'undefined') {
    const loc = window.location;
    const params = new URLSearchParams(loc.search);

    // 1. Explicit query param override: ?controllerOrigin=... or ?origin=...
    const queryOrigin = params.get('controllerOrigin') || params.get('origin');
    if (queryOrigin) {
      baseOrigin = queryOrigin.trim();
    }
    // 2. Explicit Vite environment variable
    else if ((import.meta as any)?.env?.VITE_CONTROLLER_ORIGIN) {
      baseOrigin = String((import.meta as any).env.VITE_CONTROLLER_ORIGIN).trim();
    }
    // 3. If running locally on localhost/127.0.0.1, substitute the reachable LAN IP
    else if (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') {
      // In local testing on the owner's Dell Latitude hotspot/LAN:
      const defaultLanIp = '10.211.24.122';
      const port = loc.port ? `:${loc.port}` : '';
      baseOrigin = `${loc.protocol}//${defaultLanIp}${port}`;
    }
    // 4. Production or accessed via LAN/WAN IP / Base44 domain (*.base44.app)
    else {
      baseOrigin = loc.origin;
    }
  }

  const cleanOrigin = (baseOrigin || 'http://localhost:5173').replace(/\/+$/, '');
  return `${cleanOrigin}/controller?room=${encodeURIComponent(code)}`;
}
