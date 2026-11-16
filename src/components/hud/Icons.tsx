import React from 'react';

/* ==========================================================================
   LAST SIGNAL icon set — original, hand-drawn on a 24 px grid.
   1.6 px strokes in currentColor, so every icon inherits the Gold Noir
   palette (or a danger tone) from its parent. No icon fonts, no images.
   ========================================================================== */

type P = { size?: number; style?: React.CSSProperties; title?: string; filled?: boolean };

const Svg: React.FC<P & { children: React.ReactNode }> = ({ size = 18, style, title, children }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'block', flexShrink: 0, ...style }}
    role={title ? 'img' : undefined}
    aria-hidden={title ? undefined : true}
    aria-label={title}
  >
    {children}
  </svg>
);

/** Police badge (heat pip). */
export const IconBadge: React.FC<P> = ({ filled, ...p }) => (
  <Svg {...p}>
    <path d="M12 2.8 19 5.6v5.6c0 4.6-3 8.3-7 10-4-1.7-7-5.4-7-10V5.6L12 2.8Z" fill={filled ? 'currentColor' : 'none'} />
    <path d="m12 8 1.2 2.5 2.7.3-2 1.9.6 2.7-2.5-1.4-2.5 1.4.6-2.7-2-1.9 2.7-.3L12 8Z" stroke={filled ? '#1b1209' : 'currentColor'} />
  </Svg>
);

/** Rotating light bar. */
export const IconSiren: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M7 18v-5a5 5 0 0 1 10 0v5" />
    <path d="M5 18h14v2.5H5z" />
    <path d="M12 3v2.5M4.2 6.2l1.7 1.7M19.8 6.2l-1.7 1.7M2.5 12H4.5M19.5 12h2" />
  </Svg>
);

/** Patrol / gunman in sights. */
export const IconCrosshair: React.FC<P> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="7.5" />
    <circle cx="12" cy="12" r="2" />
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
  </Svg>
);

/** Police radio handset. */
export const IconRadio: React.FC<P> = (p) => (
  <Svg {...p}>
    <rect x="6.5" y="7" width="11" height="14" rx="2" />
    <path d="M9 7 8 2.5M9.5 11h5M9.5 14h5M9.5 17h2" />
  </Svg>
);

/** Vehicle health: wrench over a chassis line. */
export const IconWrench: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M14.7 6.3a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.7-7.7" />
    <path d="M14.7 6.3 17 4l3 3-2.3 2.3" />
    <path d="M3 21h6" />
  </Svg>
);

/** Package / cargo crate with seal. */
export const IconCargo: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z" />
    <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
    <path d="m7.8 5.2 8.4 4.6" />
  </Svg>
);

/** Route guidance: fork with chosen branch. */
export const IconRoute: React.FC<P> = (p) => (
  <Svg {...p}>
    <circle cx="6" cy="19" r="2" />
    <circle cx="18" cy="5" r="2" />
    <path d="M6 17V12a4 4 0 0 1 4-4h6" />
    <path d="m14 6 2 2-2 2" />
  </Svg>
);

/** Extraction flag. */
export const IconFlag: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M5 21V4" />
    <path d="M5 4h11l-2 3.5L16 11H5" />
  </Svg>
);

/** Countdown stopwatch. */
export const IconTimer: React.FC<P> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="13.5" r="7.5" />
    <path d="M12 9.5v4l2.5 2M9.5 2.5h5M19 6l1.5-1.5" />
  </Svg>
);

/** Biohazard (zombie threat level). */
export const IconBiohazard: React.FC<P> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="2" />
    <path d="M12 10a5 5 0 0 1-1-9.5M12 10a5 5 0 0 0 1-9.5" />
    <path d="M13.8 13a5 5 0 0 1 7.2 6.6M13.8 13a5 5 0 0 0 6 7.6" />
    <path d="M10.2 13a5 5 0 0 0-6 7.6M10.2 13A5 5 0 0 1 3 19.6" />
  </Svg>
);

/** Horde: three silhouettes. */
export const IconHorde: React.FC<P> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="7" r="2.6" />
    <path d="M7.5 20v-3.5a4.5 4.5 0 0 1 9 0V20" />
    <circle cx="5" cy="9.5" r="1.9" />
    <path d="M1.8 20v-2.5A3.2 3.2 0 0 1 5 14.3" />
    <circle cx="19" cy="9.5" r="1.9" />
    <path d="M22.2 20v-2.5A3.2 3.2 0 0 0 19 14.3" />
  </Svg>
);

/** Infected zone: hazard triangle with droplet. */
export const IconInfected: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M12 3 22 20H2L12 3Z" />
    <path d="M12 9.5c-1.6 2-2.4 3.3-2.4 4.4a2.4 2.4 0 0 0 4.8 0c0-1.1-.8-2.4-2.4-4.4Z" />
  </Svg>
);

/** Radar sweep. */
export const IconRadar: React.FC<P> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <path d="M12 12 18.4 5.6" />
  </Svg>
);

/** Courier: folded-gold car silhouette (top-down). */
export const IconCourier: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M9 2.5h6l2 3.5v13.5l-2 2H9l-2-2V6l2-3.5Z" />
    <path d="M8.5 8h7M9 16h6" />
    <path d="M10.5 11.5h3v2h-3z" />
  </Svg>
);

/** Settings gear for the controller sheet. */
export const IconSliders: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </Svg>
);

/** Mirror / handedness. */
export const IconMirror: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M12 3v18" strokeDasharray="2 2.5" />
    <path d="M9 7 4 12l5 5M15 7l5 5-5 5" />
  </Svg>
);

/* ---------- Gold Noir 3.0 · Rescue Run ---------- */

/** Survivor: person with a raised, waving arm. */
export const IconSurvivor: React.FC<P> = (p) => (
  <Svg {...p}>
    <circle cx="10" cy="5" r="2.4" />
    <path d="M10 8.5v6.5M10 15l-3 6M10 15l3 6M10 10.5 6 13" />
    <path d="m10 10.5 4.5-3.5 2-4" />
    <path d="M19 2.5v2M21.5 4.5h-2M17.6 6.4l-1.2 1.2" />
  </Svg>
);

/** Passenger seat (capacity). */
export const IconSeat: React.FC<P> = ({ filled, ...p }) => (
  <Svg {...p}>
    <path d="M7 4h6a2 2 0 0 1 2 2v7H7V4Z" fill={filled ? 'currentColor' : 'none'} />
    <path d="M5 13h12a2 2 0 0 1 2 2v2H5v-4ZM7 17v3M17 17v3" fill={filled ? 'currentColor' : 'none'} />
  </Svg>
);

/** Safe zone: shield ring with a house. */
export const IconSafeZone: React.FC<P> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9.5" strokeDasharray="3 2.5" />
    <path d="M7.5 12.5 12 8.5l4.5 4V17h-9v-4.5Z" />
    <path d="M10.5 17v-2.5h3V17" />
  </Svg>
);

/** Navigation assistance: compass. */
export const IconCompass: React.FC<P> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
  </Svg>
);

/** Score / trophy. */
export const IconTrophy: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
    <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20.5h7M9.5 17h5v3.5h-5z" />
  </Svg>
);

/** Lost / missed survivor. */
export const IconLost: React.FC<P> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 8.5 7 7M15.5 8.5l-7 7" />
  </Svg>
);
