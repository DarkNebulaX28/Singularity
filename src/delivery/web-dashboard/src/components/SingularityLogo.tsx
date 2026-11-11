import React from 'react';

export interface SingularityLogoProps {
  /**
   * 'symbol': Raw isometric vector mark
   * 'badge': Mark inside a tactical dark squircle container with border glow
   * 'lockup': Badge/Symbol + SINGULARITY wordmark & NEBULAX STUDIO sub-brand
   */
  variant?: 'symbol' | 'badge' | 'lockup';
  /**
   * Visual scale of the mark. 'xs' and 'sm' automatically use the optical Small-Size Cut
   * with thicker orbital bands and wider negative-space channels.
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Enables the ultra-detailed cinematic quantum core pulse, gyroscopic rotation,
   * floating mineral levitation, and stellar flare animations (respects prefers-reduced-motion)
   */
  animated?: boolean;
  /**
   * Optional version pill shown next to the wordmark in 'lockup' variant
   */
  versionBadge?: string;
  /**
   * Subtitle text under SINGULARITY in 'lockup' variant
   */
  subtitle?: string;
  className?: string;
}

const SIZE_MAP = {
  xs: { svg: 18, box: 'w-6 h-6 rounded-md p-0.5', title: 'text-xs', sub: 'text-[8px]' },
  sm: { svg: 22, box: 'w-8 h-8 rounded-lg p-1', title: 'text-sm', sub: 'text-[9px]' },
  md: { svg: 30, box: 'w-10 h-10 rounded-xl p-1.5', title: 'text-base', sub: 'text-[10px]' },
  lg: { svg: 42, box: 'w-12 h-12 rounded-2xl p-2', title: 'text-lg', sub: 'text-[10px]' },
  xl: { svg: 64, box: 'w-18 h-18 rounded-2xl p-2.5', title: 'text-2xl', sub: 'text-xs' }
} as const;

export const SingularityLogo: React.FC<SingularityLogoProps> = ({
  variant = 'symbol',
  size = 'md',
  animated = false,
  versionBadge,
  subtitle = 'NEBULAX STUDIO',
  className = ''
}) => {
  const cfg = SIZE_MAP[size];
  const useSmallOpticalCut = size === 'xs' || size === 'sm';

  const svgElement = useSmallOpticalCut ? (
    /* OPTICAL SMALL-CUT (16px to 32px display clarity with quantum motion hooks) */
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={cfg.svg}
      height={cfg.svg}
      role="img"
      aria-label="Singularity — Small-Size Optical Mark"
      className={`shrink-0 select-none ${animated ? 'singularity-logo-animated' : ''} ${
        variant === 'symbol' ? className : ''
      }`}
    >
      <title>Singularity — NebulaX Studio</title>
      <defs>
        <filter id="sg-rsm-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="sg-rsm-plate" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>
        <linearGradient id="sg-rsm-top" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="100%" stopColor="#00f0ff" />
        </linearGradient>
        <linearGradient id="sg-rsm-left" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f5d0fe" />
          <stop offset="100%" stopColor="#9333ea" />
        </linearGradient>
        <linearGradient id="sg-rsm-right" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a7f3d0" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>

      {/* Heavy Outer Armored Hull (6 Thick Plates) */}
      <g id="sm-plates" className="sg-anim-hull" strokeLinejoin="round">
        <path className="sg-anim-plate sg-anim-plate-1" d="M 244,48 L 76,146 L 76,210 L 116,186 L 116,168 L 244,92 Z" fill="url(#sg-rsm-plate)" stroke="#00f0ff" strokeWidth="6" />
        <path className="sg-anim-plate sg-anim-plate-2" d="M 268,48 L 268,92 L 396,168 L 396,186 L 436,210 L 436,146 Z" fill="url(#sg-rsm-plate)" stroke="#00f0ff" strokeWidth="6" />
        <path className="sg-anim-plate sg-anim-plate-3" d="M 450,230 L 406,206 L 406,306 L 450,282 Z" fill="url(#sg-rsm-plate)" stroke="#d946ef" strokeWidth="6" />
        <path className="sg-anim-plate sg-anim-plate-4" d="M 436,302 L 396,326 L 396,344 L 268,420 L 268,464 L 436,366 Z" fill="url(#sg-rsm-plate)" stroke="#00ff88" strokeWidth="6" />
        <path className="sg-anim-plate sg-anim-plate-5" d="M 244,464 L 244,420 L 116,344 L 116,326 L 76,302 L 76,366 Z" fill="url(#sg-rsm-plate)" stroke="#00ff88" strokeWidth="6" />
        <path className="sg-anim-plate sg-anim-plate-6" d="M 62,230 L 106,206 L 106,306 L 62,282 Z" fill="url(#sg-rsm-plate)" stroke="#d946ef" strokeWidth="6" />
      </g>

      {/* Central Quantum Voxel Core */}
      <g id="sm-voxel-core" className="sg-anim-voxel-core" strokeLinejoin="round">
        <polygon className="sg-anim-facet-top" points="256,150 348,202 256,256 164,202" fill="url(#sg-rsm-top)" stroke="#ffffff" strokeWidth="5" />
        <polygon className="sg-anim-facet-left" points="164,202 256,256 256,362 164,310" fill="url(#sg-rsm-left)" stroke="#f5d0fe" strokeWidth="5" />
        <polygon className="sg-anim-facet-right" points="256,256 348,202 348,310 256,362" fill="url(#sg-rsm-right)" stroke="#a7f3d0" strokeWidth="5" />
        
        {/* Core Eye */}
        <polygon className="sg-anim-singularity-aperture" points="256,224 284,240 284,272 256,288 228,272 228,240" fill="#020617" stroke="#00f0ff" strokeWidth="5" />
        <circle className="sg-anim-singularity-core" cx="256" cy="256" r="14" fill="#ffffff" filter="url(#sg-rsm-glow)" />
        <circle className="sg-anim-singularity-center" cx="256" cy="256" r="6" fill="#00f0ff" />
      </g>

      {/* 6 Large Orbiting Mineral Gems */}
      <g id="sm-minerals" className="sg-anim-minerals" filter="url(#sg-rsm-glow)">
        <circle className="sg-anim-min sg-anim-min-diamond" cx="416" cy="120" r="18" fill="#00f0ff" stroke="#ffffff" strokeWidth="4" />
        <circle className="sg-anim-min sg-anim-min-amethyst" cx="92" cy="170" r="16" fill="#d946ef" stroke="#ffffff" strokeWidth="4" />
        <circle className="sg-anim-min sg-anim-min-emerald" cx="420" cy="380" r="18" fill="#00ff88" stroke="#ffffff" strokeWidth="4" />
        <circle className="sg-anim-min sg-anim-min-gold" cx="120" cy="404" r="16" fill="#fbbf24" stroke="#ffffff" strokeWidth="4" />
        <circle className="sg-anim-min sg-anim-min-redstone" cx="128" cy="100" r="16" fill="#f43f5e" stroke="#ffffff" strokeWidth="4" />
        <circle className="sg-anim-min sg-anim-min-lapis" cx="256" cy="450" r="15" fill="#38bdf8" stroke="#ffffff" strokeWidth="4" />
      </g>
    </svg>
  ) : (
    /* MASTER V2 HEXACORE QUANTUM VOXEL MARK (Full Cinematic Detail) */
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={cfg.svg}
      height={cfg.svg}
      role="img"
      aria-label="Singularity — Ultimate Hexacore Quantum Voxel Master Mark"
      className={`shrink-0 select-none ${animated ? 'singularity-logo-animated' : ''} ${
        variant === 'symbol' ? className : ''
      }`}
    >
      <title>Singularity — NebulaX Studio</title>
      <defs>
        <filter id="sg-react-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="sg-react-portal-nebula" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="25%" stopColor="#00f0ff" stopOpacity="0.8" />
          <stop offset="60%" stopColor="#7c3aed" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#020617" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sg-react-plate-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#243247" />
          <stop offset="50%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>
        <linearGradient id="sg-react-facet-top" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#00f0ff" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>
        <linearGradient id="sg-react-facet-left" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f5d0fe" />
          <stop offset="60%" stopColor="#9333ea" />
          <stop offset="100%" stopColor="#3b0764" />
        </linearGradient>
        <linearGradient id="sg-react-facet-right" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a7f3d0" />
          <stop offset="50%" stopColor="#00ff88" />
          <stop offset="100%" stopColor="#022c22" />
        </linearGradient>
        <linearGradient id="sg-react-beacon-beam" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="30%" stopColor="#00f0ff" stopOpacity="0.6" />
          <stop offset="70%" stopColor="#a855f7" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#020617" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Layer 0: Calibration Radar Guidelines */}
      <g id="sg-compass-calibration" className="sg-anim-compass" opacity="0.6">
        <circle cx="256" cy="256" r="236" fill="none" stroke="#00f0ff" strokeWidth="1.5" strokeOpacity="0.3" strokeDasharray="8 8 2 8" />
        <g stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" opacity="0.5">
          <line x1="256" y1="12" x2="256" y2="20" />
          <line x1="500" y1="256" x2="492" y2="256" />
          <line x1="256" y1="500" x2="256" y2="492" />
          <line x1="12" y1="256" x2="20" y2="256" />
        </g>
      </g>

      {/* Layer 1: Dimensional Event Horizon & Beacon Pillar */}
      <g id="sg-portal-layer">
        <circle className="sg-anim-nebula" cx="256" cy="256" r="180" fill="url(#sg-react-portal-nebula)" />
        <polygon className="sg-anim-beacon" points="251,16 261,16 270,496 242,496" fill="url(#sg-react-beacon-beam)" opacity="0.45" />
        <line className="sg-anim-beacon-line" x1="256" y1="14" x2="256" y2="498" stroke="#ffffff" strokeWidth="2" strokeDasharray="24 16" />
      </g>

      {/* Layer 2: Interstellar Gyroscopic Particle Accelerators */}
      <g id="sg-gyroscopes">
        {/* Orbit 1: Cyber Cyan (-30°) */}
        <g transform="rotate(-30 256 256)" className="sg-anim-gyro-group-1">
          <ellipse cx="256" cy="256" rx="180" ry="76" fill="none" stroke="#0f172a" strokeWidth="6" strokeOpacity="0.8" />
          <ellipse className="sg-anim-gyro-1" cx="256" cy="256" rx="180" ry="76" fill="none" stroke="#00f0ff" strokeWidth="3" strokeDasharray="60 120" strokeLinecap="round" />
          <circle className="sg-anim-kinetic-charge" cx="436" cy="256" r="5" fill="#ffffff" filter="url(#sg-react-glow)" />
        </g>
        {/* Orbit 2: Arcane Nether (+40°) */}
        <g transform="rotate(40 256 256)" className="sg-anim-gyro-group-2">
          <ellipse cx="256" cy="256" rx="172" ry="68" fill="none" stroke="#0f172a" strokeWidth="5" strokeOpacity="0.8" />
          <ellipse className="sg-anim-gyro-2" cx="256" cy="256" rx="172" ry="68" fill="none" stroke="#f472b6" strokeWidth="3" strokeDasharray="50 100" strokeLinecap="round" />
          <circle className="sg-anim-kinetic-charge" cx="84" cy="256" r="4.5" fill="#ffffff" filter="url(#sg-react-glow)" />
        </g>
      </g>

      {/* Layer 3: Monolithic Tactical Hull (6 Armored Pylons) */}
      <g id="sg-hull" className="sg-anim-hull" strokeLinejoin="round">
        <path className="sg-anim-plate sg-anim-plate-1" d="M 244,42 L 68,144 C 64,146 61,151 61,156 L 61,212 L 108,185 L 108,164 L 244,85 Z" fill="url(#sg-react-plate-grad)" stroke="#00f0ff" strokeWidth="2.5" />
        <path className="sg-anim-plate sg-anim-plate-2" d="M 268,42 L 268,85 L 404,164 L 404,185 L 451,212 L 451,156 C 451,151 448,146 444,144 Z" fill="url(#sg-react-plate-grad)" stroke="#00f0ff" strokeWidth="2.5" />
        <path className="sg-anim-plate sg-anim-plate-3" d="M 462,234 L 416,207 L 416,305 L 462,278 C 466,276 469,271 469,266 L 469,246 C 469,241 466,236 462,234 Z" fill="url(#sg-react-plate-grad)" stroke="#d946ef" strokeWidth="2.5" />
        <path className="sg-anim-plate sg-anim-plate-4" d="M 451,300 L 404,327 L 404,348 L 268,427 L 268,470 L 444,368 C 448,366 451,361 451,356 Z" fill="url(#sg-react-plate-grad)" stroke="#00ff88" strokeWidth="2.5" />
        <path className="sg-anim-plate sg-anim-plate-5" d="M 244,470 L 244,427 L 108,348 L 108,327 L 61,300 L 61,356 C 61,361 64,366 68,368 Z" fill="url(#sg-react-plate-grad)" stroke="#00ff88" strokeWidth="2.5" />
        <path className="sg-anim-plate sg-anim-plate-6" d="M 50,234 C 46,236 43,241 43,246 L 43,266 C 43,271 46,276 50,278 L 96,305 L 96,207 Z" fill="url(#sg-react-plate-grad)" stroke="#d946ef" strokeWidth="2.5" />

        {/* Heat Dissipation Plasma Slots */}
        <g className="sg-anim-exhaust" strokeLinecap="round">
          <line x1="432" y1="228" x2="432" y2="284" stroke="#c084fc" strokeWidth="3" />
          <line x1="444" y1="234" x2="444" y2="278" stroke="#f472b6" strokeWidth="2" />
          <line x1="80" y1="228" x2="80" y2="284" stroke="#c084fc" strokeWidth="3" />
          <line x1="68" y1="234" x2="68" y2="278" stroke="#f472b6" strokeWidth="2" />
        </g>

        {/* Hull Sensor Emitters */}
        <g className="sg-anim-emitters" filter="url(#sg-react-glow)">
          <circle cx="256" cy="46" r="4" fill="#00f0ff" />
          <circle cx="446" cy="152" r="4" fill="#38bdf8" />
          <circle cx="464" cy="256" r="4" fill="#f472b6" />
          <circle cx="446" cy="360" r="4" fill="#00ff88" />
          <circle cx="66" cy="360" r="4" fill="#00ff88" />
          <circle cx="48" cy="256" r="4" fill="#c084fc" />
        </g>
      </g>

      {/* Layer 4: Central Quantum Voxel Core (Minecraft 3D Block Geometry) */}
      <g id="sg-voxel-core" className="sg-anim-voxel-core" strokeLinejoin="round">
        {/* Top: Diamond Sky Voxel */}
        <polygon className="sg-anim-facet-top" points="256,160 339.14,208 256,256 172.86,208" fill="url(#sg-react-facet-top)" stroke="#e0f2fe" strokeWidth="2.5" />
        
        {/* Left: Nether Portal Rift */}
        <polygon className="sg-anim-facet-left" points="172.86,208 256,256 256,352 172.86,304" fill="url(#sg-react-facet-left)" stroke="#f5d0fe" strokeWidth="2.5" />
        <path className="sg-anim-rift-lightning" d="M 218,245 L 216,270 L 222,282 L 217,302" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" filter="url(#sg-react-glow)" />

        {/* Right: Emerald Telemetry Matrix */}
        <polygon className="sg-anim-facet-right" points="256,256 339.14,208 339.14,304 256,352" fill="url(#sg-react-facet-right)" stroke="#a7f3d0" strokeWidth="2.5" />
        <path className="sg-anim-circuit-trace" d="M 294,245 L 296,268 L 302,274 L 302,298" fill="none" stroke="#6ee7b7" strokeWidth="2" strokeLinecap="round" />
        <circle className="sg-anim-circuit-node" cx="302" cy="274" r="3" fill="#00ff88" filter="url(#sg-react-glow)" />

        {/* The Singularity: Event Horizon Aperture & Cosmic Diffraction Star */}
        <polygon className="sg-anim-singularity-aperture" points="256,230 278.52,243 278.52,269 256,282 233.48,269 233.48,243" fill="#020617" stroke="#00f0ff" strokeWidth="2.5" />
        <circle className="sg-anim-singularity-core" cx="256" cy="256" r="8" fill="#ffffff" filter="url(#sg-react-glow)" />
        
        {/* 8-Point Cosmic Star Flare (Rotates smoothly in idle) */}
        <g className="sg-anim-star-flare" fill="#ffffff" filter="url(#sg-react-glow)">
          <polygon points="256,238 258.5,256 256,274 253.5,256" />
          <polygon points="238,256 256,258.5 274,256 256,253.5" />
          <polygon points="244,244 256,255 268,268 255,256" opacity="0.8" />
          <polygon points="268,244 256,255 244,268 255,256" opacity="0.8" />
          <circle cx="256" cy="256" r="3.5" fill="#00f0ff" />
          <circle cx="256" cy="256" r="1.5" fill="#ffffff" />
        </g>
      </g>

      {/* Layer 5: 6 Orbiting Minecraft 3D Minerals */}
      <g id="sg-minerals" className="sg-anim-minerals">
        {/* 1. Diamond (Top Right High Orbit) */}
        <g transform="translate(404, 134)" className="sg-anim-min sg-anim-min-diamond">
          <polygon points="0,-16 16,-7 0,2.5 -16,-7" fill="#00f0ff" stroke="#ffffff" strokeWidth="1" />
          <polygon points="-16,-7 0,2.5 0,20 -16,11" fill="#0284c7" />
          <polygon points="0,2.5 16,-7 16,11 0,20" fill="#38bdf8" />
          <circle cx="0" cy="2.5" r="2.5" fill="#ffffff" filter="url(#sg-react-glow)" />
        </g>
        {/* 2. Amethyst (West Mid Orbit) */}
        <g transform="translate(98, 178)" className="sg-anim-min sg-anim-min-amethyst">
          <polygon points="0,-14 14,-6 0,2 -14,-6" fill="#d946ef" stroke="#ffffff" strokeWidth="1" />
          <polygon points="-14,-6 0,2 0,18 -14,10" fill="#7e22ce" />
          <polygon points="0,2 14,-6 14,10 0,18" fill="#c084fc" />
          <circle cx="0" cy="2" r="2" fill="#ffffff" filter="url(#sg-react-glow)" />
        </g>
        {/* 3. Emerald (Bottom Right Orbit) */}
        <g transform="translate(412, 362)" className="sg-anim-min sg-anim-min-emerald">
          <polygon points="0,-15 15,-6.5 0,2 -15,-6.5" fill="#00ff88" stroke="#ffffff" strokeWidth="1" />
          <polygon points="-15,-6.5 0,2 0,19 -15,10.5" fill="#047857" />
          <polygon points="0,2 15,-6.5 15,10.5 0,19" fill="#34d399" />
          <circle cx="0" cy="2" r="2" fill="#ffffff" filter="url(#sg-react-glow)" />
        </g>
        {/* 4. Gold (Bottom Left Gravitational Ascent) */}
        <g transform="translate(132, 396)" className="sg-anim-min sg-anim-min-gold">
          <polygon points="0,-12 12,-5.5 0,2 -12,-5.5" fill="#fbbf24" stroke="#ffffff" strokeWidth="1" />
          <polygon points="-12,-5.5 0,2 0,16 -12,8.5" fill="#b45309" />
          <polygon points="0,2 12,-5.5 12,8.5 0,16" fill="#fde047" />
          <circle cx="0" cy="2" r="1.5" fill="#ffffff" />
        </g>
        {/* 5. Redstone (Top Left Inbound Pulse - 1Hz TPS Clock) */}
        <g transform="translate(138, 114)" className="sg-anim-min sg-anim-min-redstone">
          <polygon points="0,-11 11,-5 0,1.5 -11,-5" fill="#f43f5e" stroke="#ffffff" strokeWidth="1" />
          <polygon points="-11,-5 0,1.5 0,14 -11,7.5" fill="#9f1239" />
          <polygon points="0,1.5 11,-5 11,7.5 0,14" fill="#fb7185" />
          <circle cx="0" cy="1.5" r="3" fill="#ff0055" filter="url(#sg-react-glow)" />
          <circle cx="0" cy="1.5" r="1.5" fill="#ffffff" />
        </g>
        {/* 6. Lapis (South Anchor Orbit) */}
        <g transform="translate(256, 442)" className="sg-anim-min sg-anim-min-lapis">
          <polygon points="0,-10 10,-4.5 0,1.5 -10,-4.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="0.8" />
          <polygon points="-10,-4.5 0,1.5 0,13 -10,7" fill="#1e40af" />
          <polygon points="0,1.5 10,-4.5 10,7 0,13" fill="#60a5fa" />
          <circle cx="0" cy="1.5" r="1.5" fill="#ffffff" />
        </g>
      </g>
    </svg>
  );

  if (variant === 'symbol') {
    return svgElement;
  }

  const badgeElement = (
    <div
      className={`${cfg.box} bg-nebula-950 border border-nebula-750 hover:border-nebula-cyber/60 flex items-center justify-center shadow-lg shadow-black/60 ring-1 ring-inset ring-nebula-sky/15 transition-all duration-300 hover:shadow-cyan-500/10 hover:ring-nebula-cyber/30 shrink-0 ${
        variant === 'badge' ? className : ''
      }`}
    >
      {svgElement}
    </div>
  );

  if (variant === 'badge') {
    return badgeElement;
  }

  return (
    <div className={`inline-flex items-center gap-2.5 min-w-0 select-none ${className}`}>
      {badgeElement}
      <div className="flex flex-col min-w-0 leading-none">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`${cfg.title} font-black tracking-wider text-slate-100 uppercase truncate`}
          >
            Singularity
          </span>
          {versionBadge && (
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-nebula-850 text-nebula-accent border border-nebula-accent/30 tabular-nums shrink-0">
              {versionBadge}
            </span>
          )}
        </div>
        {subtitle && (
          <span
            className={`${cfg.sub} font-mono font-semibold tracking-[0.2em] text-nebula-cyber uppercase mt-1 truncate`}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};
