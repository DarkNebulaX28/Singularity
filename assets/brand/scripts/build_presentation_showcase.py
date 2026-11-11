"""
Generates the official High-Resolution Brand Identity Presentation Showcase (1920x1080)
"""

import sys
import os
import subprocess
from pathlib import Path

BASE_DIR = Path(r"C:\Users\GAMING\Desktop\pismcontroller")
BRAND_DIR = BASE_DIR / "assets" / "brand"
PRESENTATION_DIR = BRAND_DIR / "presentation"
RENDER_SCRIPT = Path(r"C:\Users\GAMING\.gemini\skills\logo-design\scripts\render_png.py")
PYTHON_EXE = sys.executable

# Read the SVG files to embed them inline for zero-latency, high-fidelity rendering
with open(BRAND_DIR / "svg" / "singularity-symbol-color.svg", "r", encoding="utf-8") as f:
    sym_color_svg = f.read()

with open(BRAND_DIR / "svg" / "singularity-symbol-small.svg", "r", encoding="utf-8") as f:
    sym_small_svg = f.read()

with open(BRAND_DIR / "svg" / "singularity-symbol-white.svg", "r", encoding="utf-8") as f:
    sym_white_svg = f.read()

with open(BRAND_DIR / "svg" / "singularity-symbol-black.svg", "r", encoding="utf-8") as f:
    sym_black_svg = f.read()

with open(BRAND_DIR / "svg" / "singularity-symbol-mono-cyan.svg", "r", encoding="utf-8") as f:
    sym_mono_svg = f.read()

with open(BRAND_DIR / "svg" / "singularity-lockup-horizontal-color.svg", "r", encoding="utf-8") as f:
    lockup_hz_svg = f.read()

with open(BRAND_DIR / "svg" / "singularity-lockup-vertical-color.svg", "r", encoding="utf-8") as f:
    lockup_vt_svg = f.read()

html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Singularity — Brand Identity Master Showcase</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;800;900&family=Rajdhani:wght@600;700&family=JetBrains+Mono:wght@500;700&display=swap');
    
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      width: 1920px;
      height: 1080px;
      background: radial-gradient(circle at 50% 20%, #0f172a 0%, #050811 70%, #020408 100%);
      font-family: 'Rajdhani', -apple-system, sans-serif;
      color: #f8fafc;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      padding: 36px 48px;
      position: relative;
    }}

    /* Futuristic HUD lines */
    body::before {{
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background-image: 
        linear-gradient(rgba(0, 240, 255, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0, 240, 255, 0.03) 1px, transparent 1px);
      background-size: 40px 40px;
      pointer-events: none;
    }}

    /* Header Bar */
    header {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(0, 240, 255, 0.25);
      padding-bottom: 16px;
      margin-bottom: 24px;
      position: relative;
      z-index: 10;
    }}
    .brand-id {{
      display: flex;
      align-items: baseline;
      gap: 16px;
    }}
    .brand-id h1 {{
      font-family: 'Orbitron', sans-serif;
      font-size: 28px;
      font-weight: 900;
      letter-spacing: 0.15em;
      color: #ffffff;
      text-transform: uppercase;
    }}
    .brand-id span {{
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.25em;
      color: #00f0ff;
      text-transform: uppercase;
    }}
    .meta-tag {{
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      color: #94a3b8;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(56, 189, 248, 0.3);
      padding: 6px 14px;
      border-radius: 6px;
    }}

    /* Main Grid: 2 Large Columns */
    main {{
      display: grid;
      grid-template-columns: 820px 1fr;
      gap: 36px;
      flex: 1;
      position: relative;
      z-index: 10;
    }}

    /* Left Column: Master Mark Showcase */
    .master-card {{
      background: rgba(11, 17, 32, 0.7);
      border: 1px solid rgba(0, 240, 255, 0.2);
      border-radius: 16px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      position: relative;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    }}
    .card-title {{
      font-family: 'Orbitron', sans-serif;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.18em;
      color: #38bdf8;
      text-transform: uppercase;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }}
    .card-title::before {{
      content: '';
      width: 8px;
      height: 8px;
      background: #00f0ff;
      border-radius: 2px;
      box-shadow: 0 0 10px #00f0ff;
    }}
    .symbol-stage {{
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }}
    .symbol-stage svg {{
      width: 480px;
      height: 480px;
      filter: drop-shadow(0 15px 35px rgba(0, 240, 255, 0.25));
    }}

    /* Mineral Badges Callout */
    .mineral-tags {{
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 16px;
    }}
    .mineral-pill {{
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 8px 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.1em;
    }}
    .mineral-dot {{
      width: 8px;
      height: 8px;
      border-radius: 2px;
    }}

    /* Right Column: Lockups, Monochromes, Scale Ladder & Palette */
    .right-col {{
      display: flex;
      flex-direction: column;
      gap: 20px;
    }}

    .lockup-section {{
      background: rgba(11, 17, 32, 0.7);
      border: 1px solid rgba(0, 240, 255, 0.2);
      border-radius: 16px;
      padding: 20px 24px;
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.4);
    }}
    .lockup-display {{
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 10px 0;
    }}
    .lockup-display svg {{
      max-width: 100%;
      height: 140px;
    }}

    /* Bottom Row: 2 Cards (Variants & Ladder / Color Palette) */
    .bottom-cards {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      flex: 1;
    }}

    .sub-card {{
      background: rgba(11, 17, 32, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 14px;
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
    }}

    /* Monochrome variants row */
    .mono-grid {{
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      flex: 1;
      align-items: center;
    }}
    .mono-box {{
      border-radius: 10px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }}
    .mono-box.dark {{
      background: #020617;
      border: 1px solid rgba(255, 255, 255, 0.15);
    }}
    .mono-box.light {{
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      color: #0f172a;
    }}
    .mono-box.cyan {{
      background: #082f49;
      border: 1px solid rgba(6, 182, 212, 0.4);
    }}
    .mono-box svg {{
      width: 72px;
      height: 72px;
    }}
    .mono-box span {{
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }}

    /* Color Swatches Grid */
    .swatch-grid {{
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      flex: 1;
      align-items: center;
    }}
    .swatch-item {{
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }}
    .swatch-color {{
      height: 36px;
      border-radius: 6px;
    }}
    .swatch-name {{
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #e2e8f0;
    }}
    .swatch-hex {{
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #94a3b8;
    }}

    /* Footer Metadata */
    footer {{
      margin-top: 18px;
      padding-top: 14px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: #64748b;
      font-family: 'JetBrains Mono', monospace;
      position: relative;
      z-index: 10;
    }}
  </style>
</head>
<body>
  <!-- Header -->
  <header>
    <div class="brand-id">
      <h1>Singularity</h1>
      <span>NebulaX Studio Brand Identity System</span>
    </div>
    <div class="meta-tag">MASTER ASSET SUITE • PRODUCTION RELEASE v2.0</div>
  </header>

  <!-- Main Content Grid -->
  <main>
    <!-- Left Column: Master Mark Showcase -->
    <div class="master-card">
      <div class="card-title">Ultimate Hexacore Quantum Voxel Mark</div>
      <div class="symbol-stage">
        {sym_color_svg}
      </div>
      
      <!-- 6 Minecraft Minerals Breakdown -->
      <div class="mineral-tags">
        <div class="mineral-pill"><div class="mineral-dot" style="background:#00f0ff; box-shadow:0 0 6px #00f0ff;"></div><span>DIAMOND // CORE</span></div>
        <div class="mineral-pill"><div class="mineral-dot" style="background:#d946ef; box-shadow:0 0 6px #d946ef;"></div><span>AMETHYST // NETHER</span></div>
        <div class="mineral-pill"><div class="mineral-dot" style="background:#00ff88; box-shadow:0 0 6px #00ff88;"></div><span>EMERALD // TELEMETRY</span></div>
        <div class="mineral-pill"><div class="mineral-dot" style="background:#fbbf24; box-shadow:0 0 6px #fbbf24;"></div><span>GOLD // SECURITY</span></div>
        <div class="mineral-pill"><div class="mineral-dot" style="background:#f43f5e; box-shadow:0 0 6px #f43f5e;"></div><span>REDSTONE // TPS CLOCK</span></div>
        <div class="mineral-pill"><div class="mineral-dot" style="background:#38bdf8; box-shadow:0 0 6px #38bdf8;"></div><span>LAPIS // PERSISTENCE</span></div>
      </div>
    </div>

    <!-- Right Column: Lockups & System Specifications -->
    <div class="right-col">
      <!-- Horizontal Master Lockup -->
      <div class="lockup-section">
        <div class="card-title">Master Horizontal Lockup (Pure Vector Typography)</div>
        <div class="lockup-display">
          {lockup_hz_svg}
        </div>
      </div>

      <!-- Bottom Split Cards -->
      <div class="bottom-cards">
        <!-- Monochrome & Optical Cut -->
        <div class="sub-card">
          <div class="card-title">Production Monochromes</div>
          <div class="mono-grid">
            <div class="mono-box dark">
              {sym_white_svg}
              <span>Reverse White</span>
            </div>
            <div class="mono-box light">
              {sym_black_svg}
              <span style="color:#0f172a;">Print Black</span>
            </div>
            <div class="mono-box cyan">
              {sym_mono_svg}
              <span>Cyber Cyan</span>
            </div>
          </div>
        </div>

        <!-- Official Brand Color Palette -->
        <div class="sub-card">
          <div class="card-title">Official Color Palette</div>
          <div class="swatch-grid">
            <div class="swatch-item">
              <div class="swatch-color" style="background:#00f0ff; box-shadow:0 0 10px rgba(0,240,255,0.4);"></div>
              <div class="swatch-name">Cyber Cyan</div>
              <div class="swatch-hex">#00F0FF</div>
            </div>
            <div class="swatch-item">
              <div class="swatch-color" style="background:#d946ef; box-shadow:0 0 10px rgba(217,70,239,0.4);"></div>
              <div class="swatch-name">Arcane Violet</div>
              <div class="swatch-hex">#D946EF</div>
            </div>
            <div class="swatch-item">
              <div class="swatch-color" style="background:#00ff88; box-shadow:0 0 10px rgba(0,255,136,0.4);"></div>
              <div class="swatch-name">Matrix Emerald</div>
              <div class="swatch-hex">#00FF88</div>
            </div>
            <div class="swatch-item">
              <div class="swatch-color" style="background:#020617; border:1px solid #334155;"></div>
              <div class="swatch-name">Deep Obsidian</div>
              <div class="swatch-hex">#020617</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>

  <!-- Footer -->
  <footer>
    <div>SINGULARITY // QUANTUM MINECRAFT RUNTIME & ORCHESTRATOR • NEBULAX STUDIO</div>
    <div>GEOMETRY: 512×512 ISOMETRIC 30°/60° • ZERO LIVE TEXT • WCAG AAA READY</div>
  </footer>
</body>
</html>
"""

html_path = PRESENTATION_DIR / "brand-showcase.html"
with open(html_path, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"Wrote presentation HTML: {html_path}")

out_png = PRESENTATION_DIR / "brand-showcase.png"
cmd = [PYTHON_EXE, str(RENDER_SCRIPT), str(html_path), "-o", str(out_png), "--width", "1920", "--height", "1080"]
res = subprocess.run(cmd, capture_output=True, text=True)
if res.returncode == 0:
    print(f"Successfully generated 1080p presentation board: {out_png}")
else:
    print(f"Error generating showcase board: {res.stderr}")
