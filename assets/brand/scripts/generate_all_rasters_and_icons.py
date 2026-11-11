"""
Orchestrates high-resolution raster generation and app icon building.
Uses render_png.py and Pillow to produce:
1. Multi-size transparent PNGs for all marks
2. Web icon kit (favicon.ico, apple-touch, android-chrome, webmanifest)
3. Desktop app icon pack (Windows multi-res ICO, tray-icon, app icon)
4. Documentation assets
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path
from PIL import Image

BASE_DIR = Path(r"C:\Users\GAMING\Desktop\pismcontroller")
BRAND_DIR = BASE_DIR / "assets" / "brand"
SVG_DIR = BRAND_DIR / "svg"
PNG_DIR = BRAND_DIR / "png"
WEB_DIR = BRAND_DIR / "web"
RENDER_SCRIPT = Path(r"C:\Users\GAMING\.gemini\skills\logo-design\scripts\render_png.py")
PYTHON_EXE = sys.executable

def run_render(svg_path, out_path, size=None, width=None, height=None, bg=None, padding=None):
    cmd = [PYTHON_EXE, str(RENDER_SCRIPT), str(svg_path), "-o", str(out_path)]
    if size:
        cmd.extend(["--size", str(size)])
    if width:
        cmd.extend(["--width", str(width)])
    if height:
        cmd.extend(["--height", str(height)])
    if bg:
        cmd.extend(["--bg", str(bg)])
    if padding:
        cmd.extend(["--padding", str(padding)])
    
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Error rendering {svg_path} -> {out_path}: {res.stderr}")
        return False
    return True

print("=== 1. Rendering Master Symbol PNGs ===")
symbol_sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024, 2048]
sym_dir = PNG_DIR / "symbol"
sym_dir.mkdir(parents=True, exist_ok=True)

for sz in symbol_sizes:
    out_file = sym_dir / f"singularity-symbol-{sz}x{sz}.png"
    src_svg = SVG_DIR / ("singularity-symbol-small.svg" if sz <= 48 else "singularity-symbol-color.svg")
    print(f"Rendering symbol {sz}x{sz}...")
    run_render(src_svg, out_file, size=sz)

print("=== 2. Rendering Monochromes PNGs ===")
mono_dir = PNG_DIR / "monochrome"
mono_dir.mkdir(parents=True, exist_ok=True)
for variant in ["white", "black", "mono-cyan"]:
    src_svg = SVG_DIR / f"singularity-symbol-{variant}.svg"
    for sz in [512, 1024]:
        out_file = mono_dir / f"singularity-symbol-{variant}-{sz}x{sz}.png"
        run_render(src_svg, out_file, size=sz)

print("=== 3. Rendering Lockups PNGs ===")
lockup_dir = PNG_DIR / "lockup"
lockup_dir.mkdir(parents=True, exist_ok=True)

# Horizontal lockups
for variant in ["color", "white", "black", "mono"]:
    src_svg = SVG_DIR / f"singularity-lockup-horizontal-{variant}.svg"
    run_render(src_svg, lockup_dir / f"singularity-lockup-horizontal-{variant}-1200x360.png", width=1200, height=360)
    run_render(src_svg, lockup_dir / f"singularity-lockup-horizontal-{variant}-2400x720.png", width=2400, height=720)

# Vertical lockups
for variant in ["color", "white", "black"]:
    src_svg = SVG_DIR / f"singularity-lockup-vertical-{variant}.svg"
    run_render(src_svg, lockup_dir / f"singularity-lockup-vertical-{variant}-600x740.png", width=600, height=740)
    run_render(src_svg, lockup_dir / f"singularity-lockup-vertical-{variant}-1200x1480.png", width=1200, height=1480)

print("=== 4. Generating Web & PWA Icon Kit ===")
# Favicon PNGs
run_render(SVG_DIR / "singularity-symbol-small.svg", WEB_DIR / "favicon-16x16.png", size=16)
run_render(SVG_DIR / "singularity-symbol-small.svg", WEB_DIR / "favicon-32x32.png", size=32)
run_render(SVG_DIR / "singularity-symbol-small.svg", WEB_DIR / "favicon-48x48.png", size=48)

# Apple Touch Icon & Android Chrome on dark tactile tile (#0B0F17)
run_render(SVG_DIR / "singularity-symbol-color.svg", WEB_DIR / "apple-touch-icon.png", size=180, bg="#0B0F17", padding=0.12)
run_render(SVG_DIR / "singularity-symbol-color.svg", WEB_DIR / "android-chrome-192x192.png", size=192, bg="#0B0F17", padding=0.12)
run_render(SVG_DIR / "singularity-symbol-color.svg", WEB_DIR / "android-chrome-512x512.png", size=512, bg="#0B0F17", padding=0.12)

# Copy clean SVG favicon
shutil.copy(SVG_DIR / "singularity-symbol-small.svg", WEB_DIR / "favicon.svg")

# Build standard multi-resolution favicon.ico (16, 32, 48)
img16 = Image.open(WEB_DIR / "favicon-16x16.png")
img32 = Image.open(WEB_DIR / "favicon-32x32.png")
img48 = Image.open(WEB_DIR / "favicon-48x48.png")
favicon_ico_path = WEB_DIR / "favicon.ico"
img48.save(favicon_ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)], append_images=[img32, img16])
print(f"Created {favicon_ico_path} with sizes [16, 32, 48]")

# Build site.webmanifest
webmanifest = {
    "name": "Singularity — Minecraft Orchestrator",
    "short_name": "Singularity",
    "description": "High-performance Minecraft Server Manager & Runtime Engine by NebulaX Studio",
    "icons": [
        {"src": "/android-chrome-192x192.png", "sizes": "192x192", "type": "image/png"},
        {"src": "/android-chrome-512x512.png", "sizes": "512x512", "type": "image/png"}
    ],
    "theme_color": "#00f0ff",
    "background_color": "#0b0f17",
    "display": "standalone"
}
import json
with open(WEB_DIR / "site.webmanifest", "w", encoding="utf-8") as f:
    json.dump(webmanifest, f, indent=2)

# Build head-snippet.html
head_html = """<!-- Singularity Brand Icons -->
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="shortcut icon" href="/favicon.ico">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#00f0ff">
"""
with open(WEB_DIR / "head-snippet.html", "w", encoding="utf-8") as f:
    f.write(head_html)

print("=== 5. Updating Project & Desktop Assets ===")
desktop_assets = BASE_DIR / "src" / "delivery" / "desktop" / "assets"
desktop_assets.mkdir(parents=True, exist_ok=True)

# Generate Windows multi-resolution icon.ico (16, 32, 48, 64, 128, 256)
img_masters = [
    Image.open(sym_dir / f"singularity-symbol-{sz}x{sz}.png")
    for sz in [16, 32, 48, 64, 128, 256]
]
desktop_ico = desktop_assets / "icon.ico"
img_masters[-1].save(desktop_ico, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)], append_images=img_masters[:-1])
print(f"Updated {desktop_ico}")

# Desktop icon.png (512x512)
shutil.copy(sym_dir / "singularity-symbol-512x512.png", desktop_assets / "icon.png")
print("Updated desktop icon.png")

# Tray icon (32x32)
shutil.copy(sym_dir / "singularity-symbol-32x32.png", desktop_assets / "tray-icon.png")
print("Updated desktop tray-icon.png")

# Web dashboard public assets
web_public = BASE_DIR / "src" / "delivery" / "web-dashboard" / "public"
shutil.copy(WEB_DIR / "favicon.svg", web_public / "favicon.svg")
shutil.copy(WEB_DIR / "favicon.ico", web_public / "favicon.ico")
print("Updated web-dashboard favicon.svg & favicon.ico")

# Docs README banner logo.png
docs_assets = BASE_DIR / "docs" / "assets"
docs_assets.mkdir(parents=True, exist_ok=True)
shutil.copy(lockup_dir / "singularity-lockup-horizontal-color-1200x360.png", docs_assets / "logo.png")
print("Updated docs/assets/logo.png")

print("=== All Rasters and System Assets Successfully Generated! ===")
