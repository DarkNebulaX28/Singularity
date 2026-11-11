"""
Generates the official Lockup SVGs (Horizontal & Vertical)
Uses clean, professionally proportioned typography with Segoe UI / Inter / system-ui:
Zero distortion, crisp metric kerning, high visual hierarchy.
"""

import sys
from pathlib import Path

BASE_DIR = Path(r"C:\Users\GAMING\Desktop\pismcontroller")
SVG_DIR = BASE_DIR / "assets" / "brand" / "svg"

# Read symbol files to nest them cleanly
with open(SVG_DIR / "singularity-symbol-color.svg", "r", encoding="utf-8") as f:
    sym_color = f.read()

with open(SVG_DIR / "singularity-symbol-white.svg", "r", encoding="utf-8") as f:
    sym_white = f.read()

with open(SVG_DIR / "singularity-symbol-black.svg", "r", encoding="utf-8") as f:
    sym_black = f.read()

with open(SVG_DIR / "singularity-symbol-mono-cyan.svg", "r", encoding="utf-8") as f:
    sym_mono = f.read()

def extract_defs_and_body(svg_str):
    defs_content = ""
    defs_start = svg_str.find("<defs>")
    defs_end = svg_str.find("</defs>")
    if defs_start != -1 and defs_end != -1:
        defs_content = svg_str[defs_start + 6:defs_end]
    
    start = svg_str.find(">") + 1
    end = svg_str.rfind("</svg>")
    body = svg_str[start:end]
    if defs_start != -1 and defs_end != -1:
        body = body.replace(svg_str[defs_start:defs_end + 7], "")
    return defs_content, body

defs_color, body_color = extract_defs_and_body(sym_color)
defs_white, body_white = extract_defs_and_body(sym_white)
defs_black, body_black = extract_defs_and_body(sym_black)
defs_mono, body_mono = extract_defs_and_body(sym_mono)

# ==========================================
# 1. HORIZONTAL LOCKUPS (1200 x 360)
# ==========================================
def make_horizontal(defs_content, body_content, title_fill, sub_fill, desc_fill, badge_border, badge_bg, badge_text, name_suffix):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 360" width="1200" height="360" role="img" aria-label="Singularity — Horizontal Lockup ({name_suffix})">
  <title>Singularity — Horizontal Lockup ({name_suffix})</title>
  <defs>
    {defs_content}
  </defs>

  <!-- Left: Symbol Mark (Size 300x300, offset X=40, Y=30) -->
  <g transform="translate(40, 30) scale(0.5859375)">
    {body_content}
  </g>

  <!-- Right: Official Typography Group (X=380) -->
  <g transform="translate(380, 0)">
    <!-- Primary Title: SINGULARITY -->
    <text x="0" y="152" fill="{title_fill}" font-family="'Segoe UI', 'Inter', -apple-system, BlinkMacSystemFont, 'Montserrat', sans-serif" font-size="74" font-weight="900" letter-spacing="0.14em">SINGULARITY</text>
    
    <!-- Version Pill Tag -->
    <g transform="translate(680, 104)">
      <rect x="0" y="0" width="86" height="32" rx="6" fill="{badge_bg}" stroke="{badge_border}" stroke-width="1.5" />
      <text x="43" y="21" fill="{badge_text}" font-family="'Segoe UI', -apple-system, sans-serif" font-size="13" font-weight="800" text-anchor="middle" letter-spacing="0.05em">v2.0 PRO</text>
    </g>

    <!-- Sub-Brand: NEBULAX STUDIO (Crisp, perfectly proportioned) -->
    <text x="4" y="214" fill="{sub_fill}" font-family="'Segoe UI', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif" font-size="24" font-weight="800" letter-spacing="0.36em">NEBULAX STUDIO</text>
    
    <!-- Cyber Accent Divider Line -->
    <line x1="4" y1="242" x2="740" y2="242" stroke="{sub_fill}" stroke-width="2" stroke-opacity="0.35" stroke-dasharray="14 8" />

    <!-- Tagline: QUANTUM MINECRAFT RUNTIME & ORCHESTRATOR -->
    <text x="4" y="278" fill="{desc_fill}" font-family="'Segoe UI', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif" font-size="15" font-weight="600" letter-spacing="0.22em">QUANTUM MINECRAFT RUNTIME &amp; ORCHESTRATOR</text>
  </g>
</svg>"""

with open(SVG_DIR / "singularity-lockup-horizontal-color.svg", "w", encoding="utf-8") as f:
    f.write(make_horizontal(defs_color, body_color, "#f8fafc", "#00f0ff", "#94a3b8", "#00f0ff", "#0f172a", "#00f0ff", "Color"))

with open(SVG_DIR / "singularity-lockup-horizontal-white.svg", "w", encoding="utf-8") as f:
    f.write(make_horizontal(defs_white, body_white, "#ffffff", "#ffffff", "#cbd5e1", "#ffffff", "#020617", "#ffffff", "White"))

with open(SVG_DIR / "singularity-lockup-horizontal-black.svg", "w", encoding="utf-8") as f:
    f.write(make_horizontal(defs_black, body_black, "#0f172a", "#0f172a", "#475569", "#0f172a", "#f1f5f9", "#0f172a", "Black"))

with open(SVG_DIR / "singularity-lockup-horizontal-mono.svg", "w", encoding="utf-8") as f:
    f.write(make_horizontal(defs_mono, body_mono, "#06b6d4", "#06b6d4", "#0891b2", "#06b6d4", "#082f49", "#06b6d4", "Mono-Cyan"))

print("Recreated 4 Horizontal Lockup SVGs with pristine typography")

# ==========================================
# 2. VERTICAL / STACKED LOCKUPS (600 x 740)
# ==========================================
def make_vertical(defs_content, body_content, title_fill, sub_fill, desc_fill, badge_border, badge_bg, badge_text, name_suffix):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 740" width="600" height="740" role="img" aria-label="Singularity — Vertical Stacked Lockup ({name_suffix})">
  <title>Singularity — Vertical Stacked Lockup ({name_suffix})</title>
  <defs>
    {defs_content}
  </defs>

  <!-- Top: Symbol (Scale 380x380, centered at X=110, Y=30) -->
  <g transform="translate(110, 30) scale(0.7421875)">
    {body_content}
  </g>

  <!-- Bottom: Official Wordmark Group Centered -->
  <g transform="translate(300, 480)">
    <!-- Primary Title: SINGULARITY -->
    <text x="0" y="30" fill="{title_fill}" font-family="'Segoe UI', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif" font-size="52" font-weight="900" text-anchor="middle" letter-spacing="0.16em">SINGULARITY</text>
    
    <!-- Sub-Brand: NEBULAX STUDIO -->
    <text x="0" y="85" fill="{sub_fill}" font-family="'Segoe UI', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif" font-size="20" font-weight="800" text-anchor="middle" letter-spacing="0.38em">NEBULAX STUDIO</text>
    
    <!-- Accent Divider Line -->
    <line x1="-160" y1="112" x2="160" y2="112" stroke="{sub_fill}" stroke-width="1.5" stroke-opacity="0.35" stroke-dasharray="10 6" />

    <!-- Tagline: QUANTUM MINECRAFT RUNTIME -->
    <text x="0" y="146" fill="{desc_fill}" font-family="'Segoe UI', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif" font-size="13" font-weight="600" text-anchor="middle" letter-spacing="0.22em">QUANTUM MINECRAFT RUNTIME</text>

    <!-- Version Badge Centered -->
    <g transform="translate(-40, 172)">
      <rect x="0" y="0" width="80" height="28" rx="6" fill="{badge_bg}" stroke="{badge_border}" stroke-width="1.5" />
      <text x="40" y="19" fill="{badge_text}" font-family="'Segoe UI', -apple-system, sans-serif" font-size="12" font-weight="800" text-anchor="middle" letter-spacing="0.05em">v2.0 PRO</text>
    </g>
  </g>
</svg>"""

with open(SVG_DIR / "singularity-lockup-vertical-color.svg", "w", encoding="utf-8") as f:
    f.write(make_vertical(defs_color, body_color, "#f8fafc", "#00f0ff", "#94a3b8", "#00f0ff", "#0f172a", "#00f0ff", "Color"))

with open(SVG_DIR / "singularity-lockup-vertical-white.svg", "w", encoding="utf-8") as f:
    f.write(make_vertical(defs_white, body_white, "#ffffff", "#ffffff", "#cbd5e1", "#ffffff", "#020617", "#ffffff", "White"))

with open(SVG_DIR / "singularity-lockup-vertical-black.svg", "w", encoding="utf-8") as f:
    f.write(make_vertical(defs_black, body_black, "#0f172a", "#0f172a", "#475569", "#0f172a", "#f1f5f9", "#0f172a", "Black"))

print("Recreated 3 Vertical Lockup SVGs with pristine typography")
