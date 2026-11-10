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
   * Enables the subtle staggered build-on and quantum core pulse (respects prefers-reduced-motion)
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
  md: { svg: 28, box: 'w-10 h-10 rounded-xl p-1.5', title: 'text-base', sub: 'text-[10px]' },
  lg: { svg: 40, box: 'w-12 h-12 rounded-2xl p-2', title: 'text-lg', sub: 'text-[10px]' },
  xl: { svg: 56, box: 'w-16 h-16 rounded-2xl p-2.5', title: 'text-2xl', sub: 'text-xs' }
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

  const svgElement = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={cfg.svg}
      height={cfg.svg}
      role="img"
      aria-label="Singularity — NebulaX Studio"
      className={`shrink-0 select-none ${animated ? 'singularity-logo-animated' : ''} ${
        variant === 'symbol' ? className : ''
      }`}
    >
      <title>Singularity — NebulaX Studio</title>
      <g>
        {/* Upper-Left Orbital Event Horizon Arm (#06B6D4 Singularity Cyber Cyan) */}
        <path
          className="sg-piece sg-piece-1"
          d={
            useSmallOpticalCut
              ? 'M 31.00 133.00 L 31.00 72.00 L 128.00 16.00 L 225.00 72.00 L 225.00 101.00 L 197.28 117.00 L 197.28 88.00 L 128.00 48.00 L 58.72 88.00 L 58.72 117.00 Z'
              : 'M 31.00 133.00 L 31.00 72.00 L 128.00 16.00 L 225.00 72.00 L 225.00 105.00 L 200.75 119.00 L 200.75 86.00 L 128.00 44.00 L 55.25 86.00 L 55.25 119.00 Z'
          }
          fill="#06B6D4"
        />
        {/* Lower-Right Orbital Event Horizon Arm (#10B981 NebulaX Emerald) */}
        <path
          className="sg-piece sg-piece-2"
          d={
            useSmallOpticalCut
              ? 'M 225.00 123.00 L 225.00 184.00 L 128.00 240.00 L 31.00 184.00 L 31.00 155.00 L 58.72 139.00 L 58.72 168.00 L 128.00 208.00 L 197.28 168.00 L 197.28 139.00 Z'
              : 'M 225.00 123.00 L 225.00 184.00 L 128.00 240.00 L 31.00 184.00 L 31.00 151.00 L 55.25 137.00 L 55.25 170.00 L 128.00 212.00 L 200.75 170.00 L 200.75 137.00 Z'
          }
          fill="#10B981"
        />
        {/* Voxel Crown Facet (#38BDF8 Horizon Sky Cyan) */}
        <path
          className="sg-piece sg-piece-3"
          d="M 128.00 67.00 L 176.50 95.00 L 146.19 112.50 L 128.00 102.00 L 109.81 112.50 L 79.50 95.00 Z"
          fill="#38BDF8"
        />
        {/* Voxel Left Facet (#06B6D4 Singularity Cyber Cyan) */}
        <path
          className="sg-piece sg-piece-4"
          d="M 75.17 102.50 L 105.48 120.00 L 105.48 141.00 L 123.67 151.50 L 123.67 186.50 L 75.17 158.50 Z"
          fill="#06B6D4"
        />
        {/* Voxel Right Facet (#10B981 NebulaX Emerald) */}
        <path
          className="sg-piece sg-piece-5"
          d="M 180.83 102.50 L 180.83 158.50 L 132.33 186.50 L 132.33 151.50 L 150.52 141.00 L 150.52 120.00 Z"
          fill="#10B981"
        />
        {/* Central Singularity Quantum Core (#38BDF8 Horizon Sky Cyan) */}
        <path
          className="sg-core"
          d={
            useSmallOpticalCut
              ? 'M 128.00 112.50 L 141.42 120.25 L 141.42 135.75 L 128.00 143.50 L 114.58 135.75 L 114.58 120.25 Z'
              : 'M 128.00 113.50 L 140.56 120.75 L 140.56 135.25 L 128.00 142.50 L 115.44 135.25 L 115.44 120.75 Z'
          }
          fill="#38BDF8"
        />
      </g>
    </svg>
  );

  if (variant === 'symbol') {
    return svgElement;
  }

  const badgeElement = (
    <div
      className={`${cfg.box} bg-nebula-950 border border-nebula-750 hover:border-nebula-cyber/50 flex items-center justify-center shadow-md shadow-black/50 ring-1 ring-inset ring-nebula-sky/10 transition-all shrink-0 ${
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
            className={`${cfg.sub} font-mono font-semibold tracking-[0.18em] text-nebula-cyber uppercase mt-1 truncate`}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};
