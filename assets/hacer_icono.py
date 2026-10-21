#!/usr/bin/env python3
"""Genera el ícono de Carta natal: SVG, PNG y AppIcon.icns.

No hace falta correrlo para usar la app (los archivos ya están hechos). Sirve si querés cambiar
el diseño: editá `artwork()` y ejecutá `python3 assets/hacer_icono.py` (necesita playwright y Pillow).
"""
import io
import math
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
STATIC = ROOT / "static"

# Colores de la interfaz (modo oscuro)
BG_TOP, BG_BOTTOM = "#1D303D", "#0A1218"
INK = "#E8EEF2"
AMBER = "#FFB066"
BLUE = "#78B4FF"
CORAL = "#FF8873"


def pt(r: float, deg: float) -> tuple[float, float]:
    """Punto sobre una circunferencia centrada en (512, 512); 0° = izquierda (Ascendente), antihorario."""
    a = math.radians(180 - deg)
    return 512 + r * math.cos(a), 512 - r * math.sin(a)


def artwork(simple: bool = False) -> str:
    """La rueda, dibujada sobre un lienzo de 1024 × 1024. `simple` quita los detalles finos (tamaños chicos)."""
    s = []
    # anillo exterior (tránsitos) con un planeta
    s.append(f'<circle cx="512" cy="512" r="352" fill="none" stroke="{AMBER}" stroke-width="{34 if simple else 24}"/>')
    ox, oy = pt(352, 128)
    s.append(f'<circle cx="{ox:.1f}" cy="{oy:.1f}" r="{50 if simple else 40}" fill="#10202B" stroke="{AMBER}" stroke-width="{26 if simple else 20}"/>')
    # banda del zodíaco
    sw = 30 if simple else 16
    s.append(f'<circle cx="512" cy="512" r="286" fill="none" stroke="{INK}" stroke-width="{sw}"/>')
    s.append(f'<circle cx="512" cy="512" r="{200 if simple else 206}" fill="none" stroke="{INK}" stroke-width="{26 if simple else 12}"/>')
    if not simple:
        for i in range(12):
            x1, y1 = pt(206, i * 30)
            x2, y2 = pt(286, i * 30)
            s.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{INK}" stroke-opacity=".5" stroke-width="9"/>')
    # horizonte (Ascendente a la izquierda)
    hx1, _ = pt(206, 0)
    hx2, _ = pt(206, 180)
    s.append(f'<line x1="{hx1:.1f}" y1="512" x2="{hx2:.1f}" y2="512" stroke="{INK}" stroke-opacity=".38" stroke-width="{16 if simple else 9}"/>')
    # aspectos: trígono azul y una oposición/cuadratura en coral
    pts = [pt(206, a) for a in (62, 182, 302)]
    tri = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    s.append(f'<polygon points="{tri}" fill="{BLUE}" fill-opacity=".10" stroke="{BLUE}" stroke-width="{22 if simple else 13}" stroke-linejoin="round"/>')
    a, b = pt(206, 62), pt(206, 242)
    s.append(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="{CORAL}" stroke-width="{22 if simple else 13}" stroke-linecap="round"/>')
    # planetas sobre el círculo interior
    for (x, y) in pts + [b]:
        s.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{36 if simple else 27}" fill="{INK}"/>')
    # centro
    s.append(f'<circle cx="512" cy="512" r="{26 if simple else 17}" fill="{AMBER}"/>')
    return "".join(s)


def svg(size: int = 1024, inset: int = 100, radius: int = 186, simple: bool = False, square: bool = False) -> str:
    """Ícono completo. inset/radius describen el cuerpo (macOS usa 824 de 1024 con esquinas redondeadas)."""
    body = 1024 - 2 * inset
    rx = 0 if square else radius
    scale = body / 1024
    off = inset
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 1024 1024">'
        f'<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="{BG_TOP}"/><stop offset="1" stop-color="{BG_BOTTOM}"/></linearGradient></defs>'
        f'<rect x="{off}" y="{off}" width="{body}" height="{body}" rx="{rx}" fill="url(#g)"/>'
        f'<g transform="translate({off} {off}) scale({scale:.5f})">{artwork(simple)}</g>'
        f'</svg>'
    )


# ---------------------------------------------------------------- render ----
def render_png(page, markup: str, px: int) -> bytes:
    page.set_viewport_size({"width": px, "height": px})
    page.set_content(
        "<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:transparent}"
        f"svg{{display:block;width:{px}px;height:{px}px}}</style>" + markup
    )
    return page.screenshot(omit_background=True, clip={"x": 0, "y": 0, "width": px, "height": px})


# ------------------------------------------------------------------ icns ----
# Cada bloque es PNG: (tipo, lado en píxeles)
ICNS_TYPES = [("icp4", 16), ("icp5", 32), ("ic11", 32), ("ic12", 64), ("ic07", 128),
              ("ic13", 256), ("ic08", 256), ("ic14", 512), ("ic09", 512), ("ic10", 1024)]


def build_icns(pngs: dict[int, bytes]) -> bytes:
    chunks = b"".join(t.encode("ascii") + struct.pack(">I", 8 + len(pngs[px])) + pngs[px] for t, px in ICNS_TYPES)
    return b"icns" + struct.pack(">I", 8 + len(chunks)) + chunks


def main() -> int:
    from playwright.sync_api import sync_playwright

    ASSETS.mkdir(exist_ok=True)
    STATIC.mkdir(exist_ok=True)
    mac = {px: svg(px, simple=px <= 64) for px in {t[1] for t in ICNS_TYPES}}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        pngs = {px: render_png(page, markup, px) for px, markup in mac.items()}
        web = {
            "icon-192.png": render_png(page, svg(192, inset=0, radius=44), 192),
            "icon-512.png": render_png(page, svg(512, inset=0, radius=112), 512),
            "apple-touch-icon.png": render_png(page, svg(180, inset=0, square=True), 180),
        }
        browser.close()

    (ASSETS / "AppIcon.icns").write_bytes(build_icns(pngs))
    (ASSETS / "icon-1024.png").write_bytes(pngs[1024])
    (STATIC / "icon.svg").write_text(svg(512, inset=0, radius=112, simple=True), encoding="utf-8")
    for name, data in web.items():
        (STATIC / name).write_bytes(data)

    # comprobación: Pillow tiene que poder abrir el .icns y ver todos los tamaños
    from PIL import Image
    im = Image.open(ASSETS / "AppIcon.icns")
    print("icns:", sorted(im.info.get("sizes", [])) or im.size)
    return 0


if __name__ == "__main__":
    sys.exit(main())
