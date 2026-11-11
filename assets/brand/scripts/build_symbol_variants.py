"""
Generates the SVG variations for Singularity:
1. singularity-symbol-small.svg (Optical cut for 16-32px)
2. singularity-symbol-white.svg (Pure white with opacity tiers for dark backgrounds)
3. singularity-symbol-black.svg (Solid black with opacity tiers for light backgrounds)
4. singularity-symbol-mono-cyan.svg (Cyber cyan #06B6D4 monochrome)
"""

import sys
from pathlib import Path

BASE_DIR = Path(r"C:\Users\GAMING\Desktop\pismcontroller")
SVG_DIR = BASE_DIR / "assets" / "brand" / "svg"

# 1. OPTICAL SMALL-CUT (Simplified for 16px - 48px)
small_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="Singularity — Small-Size Optical Mark">
  <defs>
    <filter id="sg-small-glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <linearGradient id="sg-sm-plate" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <linearGradient id="sg-sm-top" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e0f2fe" />
      <stop offset="100%" stop-color="#00f0ff" />
    </linearGradient>
    <linearGradient id="sg-sm-left" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f5d0fe" />
      <stop offset="100%" stop-color="#9333ea" />
    </linearGradient>
    <linearGradient id="sg-sm-right" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a7f3d0" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
  </defs>

  <!-- Heavy Outer Armored Hull (6 Thick Plates) -->
  <g id="sm-plates" stroke-linejoin="round">
    <!-- Top Left -->
    <path d="M 244,48 L 76,146 L 76,210 L 116,186 L 116,168 L 244,92 Z" fill="url(#sg-sm-plate)" stroke="#00f0ff" stroke-width="6" />
    <!-- Top Right -->
    <path d="M 268,48 L 268,92 L 396,168 L 396,186 L 436,210 L 436,146 Z" fill="url(#sg-sm-plate)" stroke="#00f0ff" stroke-width="6" />
    <!-- East Flange -->
    <path d="M 450,230 L 406,206 L 406,306 L 450,282 Z" fill="url(#sg-sm-plate)" stroke="#d946ef" stroke-width="6" />
    <!-- Bottom Right -->
    <path d="M 436,302 L 396,326 L 396,344 L 268,420 L 268,464 L 436,366 Z" fill="url(#sg-sm-plate)" stroke="#00ff88" stroke-width="6" />
    <!-- Bottom Left -->
    <path d="M 244,464 L 244,420 L 116,344 L 116,326 L 76,302 L 76,366 Z" fill="url(#sg-sm-plate)" stroke="#00ff88" stroke-width="6" />
    <!-- West Flange -->
    <path d="M 62,230 L 106,206 L 106,306 L 62,282 Z" fill="url(#sg-sm-plate)" stroke="#d946ef" stroke-width="6" />
  </g>

  <!-- Central Quantum Voxel Core (High Optical Clarity) -->
  <g id="sm-voxel-core" stroke-linejoin="round">
    <!-- Top Facet (Diamond) -->
    <polygon points="256,150 348,202 256,256 164,202" fill="url(#sg-sm-top)" stroke="#ffffff" stroke-width="5" />
    <!-- Left Facet (Nether) -->
    <polygon points="164,202 256,256 256,362 164,310" fill="url(#sg-sm-left)" stroke="#f5d0fe" stroke-width="5" />
    <!-- Right Facet (Emerald) -->
    <polygon points="256,256 348,202 348,310 256,362" fill="url(#sg-sm-right)" stroke="#a7f3d0" stroke-width="5" />

    <!-- Center Gravitational Eye -->
    <polygon points="256,224 284,240 284,272 256,288 228,272 228,240" fill="#020617" stroke="#00f0ff" stroke-width="5" />
    <circle cx="256" cy="256" r="14" fill="#ffffff" filter="url(#sg-small-glow)" />
    <circle cx="256" cy="256" r="6" fill="#00f0ff" />
  </g>

  <!-- 6 Large Orbiting Mineral Gems (Scale boosted for 16px/32px recognition) -->
  <g id="sm-minerals" filter="url(#sg-small-glow)">
    <!-- 1. Diamond (Top Right) -->
    <circle cx="416" cy="120" r="18" fill="#00f0ff" stroke="#ffffff" stroke-width="4" />
    <!-- 2. Amethyst (West) -->
    <circle cx="92" cy="170" r="16" fill="#d946ef" stroke="#ffffff" stroke-width="4" />
    <!-- 3. Emerald (Bottom Right) -->
    <circle cx="420" cy="380" r="18" fill="#00ff88" stroke="#ffffff" stroke-width="4" />
    <!-- 4. Gold (Bottom Left) -->
    <circle cx="120" cy="404" r="16" fill="#fbbf24" stroke="#ffffff" stroke-width="4" />
    <!-- 5. Redstone (Top Left) -->
    <circle cx="128" cy="100" r="16" fill="#f43f5e" stroke="#ffffff" stroke-width="4" />
    <!-- 6. Lapis (South) -->
    <circle cx="256" cy="450" r="15" fill="#38bdf8" stroke="#ffffff" stroke-width="4" />
  </g>
</svg>"""

with open(SVG_DIR / "singularity-symbol-small.svg", "w", encoding="utf-8") as f:
    f.write(small_svg)
print("Created singularity-symbol-small.svg")

# 2. MONOCHROME WHITE (Reverse for dark backgrounds)
white_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="Singularity — Monochrome White">
  <!-- Outer Hull -->
  <g fill="#ffffff" stroke="#ffffff" stroke-linejoin="round">
    <path d="M 244,42 L 68,144 C 64,146 61,151 61,156 L 61,212 L 108,185 L 108,164 L 244,85 Z" fill-opacity="0.12" stroke-width="2.5" />
    <path d="M 268,42 L 268,85 L 404,164 L 404,185 L 451,212 L 451,156 C 451,151 448,146 444,144 Z" fill-opacity="0.12" stroke-width="2.5" />
    <path d="M 462,234 L 416,207 L 416,305 L 462,278 C 466,276 469,271 469,266 L 469,246 C 469,241 466,236 462,234 Z" fill-opacity="0.12" stroke-width="2.5" />
    <path d="M 451,300 L 404,327 L 404,348 L 268,427 L 268,470 L 444,368 C 448,366 451,361 451,356 Z" fill-opacity="0.12" stroke-width="2.5" />
    <path d="M 244,470 L 244,427 L 108,348 L 108,327 L 61,300 L 61,356 C 61,361 64,366 68,368 Z" fill-opacity="0.12" stroke-width="2.5" />
    <path d="M 50,234 C 46,236 43,241 43,246 L 43,266 C 43,271 46,276 50,278 L 96,305 L 96,207 Z" fill-opacity="0.12" stroke-width="2.5" />
  </g>

  <!-- Orbital Rings -->
  <g fill="none" stroke="#ffffff" stroke-width="2">
    <ellipse cx="256" cy="256" rx="180" ry="76" stroke-opacity="0.4" stroke-dasharray="24 12" transform="rotate(-30 256 256)" />
    <ellipse cx="256" cy="256" rx="172" ry="68" stroke-opacity="0.3" stroke-dasharray="30 14" transform="rotate(40 256 256)" />
  </g>

  <!-- Central Voxel Core -->
  <g stroke="#ffffff" stroke-linejoin="round">
    <!-- Top Face -->
    <polygon points="256,160 339.14,208 256,256 172.86,208" fill="#ffffff" fill-opacity="0.9" stroke-width="2.5" />
    <!-- Left Face -->
    <polygon points="172.86,208 256,256 256,352 172.86,304" fill="#ffffff" fill-opacity="0.5" stroke-width="2.5" />
    <!-- Right Face -->
    <polygon points="256,256 339.14,208 339.14,304 256,352" fill="#ffffff" fill-opacity="0.3" stroke-width="2.5" />

    <!-- Center Aperture -->
    <polygon points="256,230 278.52,243 278.52,269 256,282 233.48,269 233.48,243" fill="#020617" stroke="#ffffff" stroke-width="2" />
    <circle cx="256" cy="256" r="8" fill="#ffffff" />
    
    <!-- Star Flare -->
    <polygon points="256,238 258.5,256 256,274 253.5,256" fill="#ffffff" />
    <polygon points="238,256 256,258.5 274,256 256,253.5" fill="#ffffff" />
  </g>

  <!-- 6 Orbiting Mineral Voxels -->
  <g fill="#ffffff" stroke="#ffffff">
    <!-- Diamond -->
    <polygon points="404,116 422,126 404,137 386,126" fill-opacity="0.9" />
    <polygon points="386,126 404,137 404,157 386,147" fill-opacity="0.5" />
    <polygon points="404,137 422,126 422,147 404,157" fill-opacity="0.3" />
    <!-- Amethyst -->
    <polygon points="98,163 113,171 98,180 83,171" fill-opacity="0.9" />
    <polygon points="83,171 98,180 98,197 83,188" fill-opacity="0.5" />
    <polygon points="98,180 113,171 113,188 98,197" fill-opacity="0.3" />
    <!-- Emerald -->
    <polygon points="412,346 428,355 412,364 396,355" fill-opacity="0.9" />
    <polygon points="396,355 412,364 412,383 396,373" fill-opacity="0.5" />
    <polygon points="412,364 428,355 428,373 412,383" fill-opacity="0.3" />
    <!-- Gold -->
    <polygon points="132,383 145,390 132,398 119,390" fill-opacity="0.9" />
    <polygon points="119,390 132,398 132,413 119,405" fill-opacity="0.5" />
    <polygon points="132,398 145,390 145,405 132,413" fill-opacity="0.3" />
    <!-- Redstone -->
    <polygon points="138,103 149,109 138,115 127,109" fill-opacity="0.9" />
    <polygon points="127,109 138,115 138,128 127,122" fill-opacity="0.5" />
    <polygon points="138,115 149,109 149,122 138,128" fill-opacity="0.3" />
    <!-- Lapis -->
    <polygon points="256,432 266,437 256,443 246,437" fill-opacity="0.9" />
    <polygon points="246,437 256,443 256,455 246,449" fill-opacity="0.5" />
    <polygon points="256,443 266,437 266,449 256,455" fill-opacity="0.3" />
  </g>
</svg>"""

with open(SVG_DIR / "singularity-symbol-white.svg", "w", encoding="utf-8") as f:
    f.write(white_svg)
print("Created singularity-symbol-white.svg")

# 3. MONOCHROME BLACK (For light backgrounds / print)
black_svg = white_svg.replace("#ffffff", "#0f172a").replace("#020617", "#ffffff").replace("Singularity — Monochrome White", "Singularity — Monochrome Black")
with open(SVG_DIR / "singularity-symbol-black.svg", "w", encoding="utf-8") as f:
    f.write(black_svg)
print("Created singularity-symbol-black.svg")

# 4. MONOCHROME CYAN (Brand #06B6D4)
mono_cyan_svg = white_svg.replace("#ffffff", "#06b6d4").replace("#020617", "#082f49").replace("Singularity — Monochrome White", "Singularity — Monochrome Cyber Cyan")
with open(SVG_DIR / "singularity-symbol-mono-cyan.svg", "w", encoding="utf-8") as f:
    f.write(mono_cyan_svg)
print("Created singularity-symbol-mono-cyan.svg")
