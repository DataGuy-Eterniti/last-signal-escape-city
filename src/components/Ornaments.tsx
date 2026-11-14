import React from 'react';

/** Per-letter blur-rise headline reveal (motion from the reference video). */
export const Letters: React.FC<{ text: string; className?: string; style?: React.CSSProperties }> = ({
  text,
  className,
  style
}) => (
  <span className={`letters ${className ?? ''}`} style={style} aria-label={text}>
    {Array.from(text).map((ch, i) => (
      <span key={i} aria-hidden="true" style={{ ['--l' as string]: i } as React.CSSProperties}>
        {ch === ' ' ? ' ' : ch}
      </span>
    ))}
  </span>
);

/** Ambient gold backdrop: god rays, breathing glow and film grain. */
export const GoldBackdrop: React.FC<{ glowX?: string; glowY?: string; size?: number }> = ({
  glowX = '68%',
  glowY = '40%',
  size = 720
}) => (
  <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background:
          'radial-gradient(120% 90% at 70% 30%, #3a240f 0%, #1d1209 45%, #0d0804 100%)'
      }}
    />
    <div
      className="glow-orb"
      style={{ width: size, height: size, left: `calc(${glowX} - ${size / 2}px)`, top: `calc(${glowY} - ${size / 2}px)` }}
    />
    <div className="rays" />
    <div className="grain" />
  </div>
);

/**
 * Original low-poly "folded gold" courier car — our answer to the reference's
 * origami heron. Faceted polygons in four gold tones + a water reflection.
 */
export const GoldEmblem: React.FC<{ width?: number | string; style?: React.CSSProperties }> = ({
  width = '100%',
  style
}) => (
  <svg viewBox="0 0 520 420" width={width} style={style} role="img" aria-label="Folded gold courier car">
    <defs>
      <linearGradient id="g-hi" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff2c8" />
        <stop offset="1" stopColor="#ffc34d" />
      </linearGradient>
      <linearGradient id="g-mid" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffcf6a" />
        <stop offset="1" stopColor="#d9952b" />
      </linearGradient>
      <linearGradient id="g-low" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#c7832a" />
        <stop offset="1" stopColor="#7a4a1c" />
      </linearGradient>
      <linearGradient id="g-dark" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#8a561f" />
        <stop offset="1" stopColor="#4a2d12" />
      </linearGradient>
      <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="rgba(255,220,140,0.55)" />
        <stop offset="1" stopColor="rgba(255,220,140,0)" />
      </linearGradient>
      <linearGradient id="refl" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <mask id="refl-mask">
        <rect x="0" y="282" width="520" height="140" fill="url(#refl)" />
      </mask>
      <filter id="soft-glow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
    </defs>

    {/* headlight beam */}
    <polygon points="455,214 520,180 520,262" fill="url(#beam)" opacity="0.9" />

    <g id="car" style={{ animation: 'float 6s ease-in-out infinite' }}>
      {/* roof / cabin facets */}
      <polygon points="170,150 270,112 330,148 250,170" fill="url(#g-hi)" />
      <polygon points="250,170 330,148 368,196 278,206" fill="url(#g-mid)" />
      <polygon points="170,150 250,170 278,206 150,204" fill="url(#g-low)" />
      {/* windows */}
      <polygon points="190,156 262,124 300,148 244,166" fill="#2a1808" opacity="0.55" />
      <polygon points="258,172 318,156 344,192 282,200" fill="#2a1808" opacity="0.45" />
      {/* hood */}
      <polygon points="368,196 450,206 458,232 372,226" fill="url(#g-hi)" />
      <polygon points="278,206 368,196 372,226 286,236" fill="url(#g-mid)" />
      {/* trunk */}
      <polygon points="150,204 278,206 286,236 92,238" fill="url(#g-low)" />
      <polygon points="70,214 150,204 92,238 64,240" fill="url(#g-mid)" />
      {/* lower body */}
      <polygon points="64,240 458,232 464,262 70,272" fill="url(#g-dark)" />
      <polygon points="92,238 286,236 300,262 96,268" fill="url(#g-low)" opacity="0.65" />
      {/* wheels — faceted hexagons */}
      <g>
        <polygon points="118,250 140,240 162,250 166,274 140,288 114,274" fill="#1f1308" />
        <polygon points="128,258 140,252 152,258 154,272 140,280 126,272" fill="url(#g-mid)" />
        <polygon points="350,246 372,236 394,246 398,270 372,284 346,270" fill="#1f1308" />
        <polygon points="360,254 372,248 384,254 386,268 372,276 358,268" fill="url(#g-mid)" />
      </g>
      {/* headlight + tail light */}
      <polygon points="446,210 460,214 458,226 444,222" fill="#fff6dc" />
      <circle cx="452" cy="218" r="10" fill="#ffe6a8" filter="url(#soft-glow)" opacity="0.9" />
      <polygon points="66,220 80,216 82,228 66,232" fill="#ff8a4a" />
      {/* the mysterious package glow */}
      <circle cx="120" cy="214" r="9" fill="#ffd27a" filter="url(#soft-glow)" />
    </g>

    {/* water line */}
    <line x1="20" y1="284" x2="500" y2="284" stroke="rgba(241,216,168,0.35)" strokeWidth="1" />

    {/* reflection */}
    <g mask="url(#refl-mask)" opacity="0.55">
      <use href="#car" transform="translate(0,570) scale(1,-1)" />
    </g>
    {/* ripples */}
    <g stroke="rgba(255,215,140,0.25)" strokeWidth="1" fill="none">
      <path d="M120 300 q40 -4 80 0 t80 0" />
      <path d="M200 318 q40 -4 80 0 t80 0" />
      <path d="M90 336 q40 -4 80 0" />
    </g>
  </svg>
);

/** Arc speedometer in gold. value 0..1 */
export const SpeedArc: React.FC<{ value: number; nitro?: boolean; size?: number }> = ({ value, nitro, size = 132 }) => {
  const r = 52;
  const c = Math.PI * r * 1.5; // 270° arc
  const v = Math.max(0, Math.min(1, value));
  return (
    <svg width={size} height={size} viewBox="0 0 132 132" aria-hidden="true">
      <defs>
        <linearGradient id="arc-g" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#a8681f" />
          <stop offset="0.6" stopColor="#ffc34d" />
          <stop offset="1" stopColor={nitro ? '#fff6dc' : '#ffe2a0'} />
        </linearGradient>
      </defs>
      <g transform="rotate(135 66 66)">
        <circle cx="66" cy="66" r={r} fill="none" stroke="rgba(241,216,168,0.12)" strokeWidth="6" strokeDasharray={`${c} 999`} strokeLinecap="round" />
        <circle
          cx="66"
          cy="66"
          r={r}
          fill="none"
          stroke="url(#arc-g)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${c * v} 999`}
          style={{ transition: 'stroke-dasharray 180ms linear', filter: nitro ? 'drop-shadow(0 0 6px #ffc34d)' : undefined }}
        />
      </g>
    </svg>
  );
};
