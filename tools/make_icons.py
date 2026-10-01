"""Genera los iconos PWA y el favicon de Números Metálicos (espiral áurea)."""
import math
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), "..", "icons")
os.makedirs(OUT, exist_ok=True)

EMERALD_DARK = (6, 78, 59)     # emerald-900
EMERALD = (4, 120, 87)         # emerald-700
AMBER = (245, 158, 11)         # amber-500
AMBER_LIGHT = (251, 191, 36)   # amber-400


def draw_icon(size: int, maskable: bool = False) -> Image.Image:
    img = Image.new("RGB", (size, size), EMERALD)
    d = ImageDraw.Draw(img)

    # Fondo degradado vertical simulado con franjas finas
    for y in range(size):
        t = y / size
        r = int(EMERALD_DARK[0] + (EMERALD[0] - EMERALD_DARK[0]) * t)
        g = int(EMERALD_DARK[1] + (EMERALD[1] - EMERALD_DARK[1]) * t)
        b = int(EMERALD_DARK[2] + (EMERALD[2] - EMERALD_DARK[2]) * t)
        d.line([(0, y), (size, y)], fill=(r, g, b))

    # Zona segura: en maskable el arte queda dentro del 80% central
    pad = 0.12 * size if maskable else 0.07 * size
    cx = cy = size / 2
    max_r = size / 2 - pad

    # Rectángulo áureo inscrito (guía de proporción para la espiral)
    rect_w = 2 * max_r
    rect_h = rect_w / 1.618
    left, top = cx - rect_w / 2, cy - rect_h / 2
    # la espiral circular se ajusta a la altura del rectángulo
    max_r = rect_h / 2

    # Espiral logarítmica áurea: r = a·φ^(2θ/π), trazada como polilínea
    phi = (1 + 5 ** 0.5) / 2
    d2 = ImageDraw.Draw(img)
    line_w = max(2, int(size * 0.030))

    # r=1 corresponde al radio máximo disponible; la espira crece hacia fuera
    points = []
    steps = 400
    theta_max = 3.0 * math.pi  # 1.5 vueltas
    for i in range(steps + 1):
        theta = -theta_max * i / steps  # hacia atrás (espira hacia dentro)
        r = phi ** (2 * theta / math.pi)  # en θ=-3π → r = φ^-6 ≈ 0.055
        px = cx + r * max_r * 0.98 * math.cos(theta + math.pi / 4)
        py = cy + r * max_r * 0.98 * math.sin(theta + math.pi / 4) * 1.0
        points.append((px, py))
    # alinear la espiral dentro del rectángulo áureo: escalar horizontalmente
    points = [(cx + (px - cx), cy + (py - cy)) for (px, py) in points]
    d2.line(points, fill=AMBER_LIGHT, width=line_w, joint="curve")

    # "φ" pequeño en la esquina inferior derecha (no en maskable pequeño)
    if size >= 192 and not maskable:
        try:
            font = ImageFont.truetype("arialbd.ttf", int(size * 0.13))
        except OSError:
            font = ImageFont.load_default()
        d2.text((left + rect_w - size * 0.02, top + rect_h - size * 0.02),
                "φ", font=font, fill=(255, 255, 255), anchor="rb")
    return img


def save(img: Image.Image, name: str):
    path = os.path.join(OUT, name)
    img.save(path)
    print("OK", path)


# Iconos estándar
for s in (192, 512):
    save(draw_icon(s, maskable=False), f"icon-{s}.png")

# Maskable (más padding para la zona segura)
save(draw_icon(512, maskable=True), "icon-512-maskable.png")

# Apple touch icon 180 (fondo opaco, sin transparencia)
save(draw_icon(180, maskable=False), "apple-touch-icon.png")

# Favicons
save(draw_icon(32, maskable=False), "favicon-32.png")
save(draw_icon(16, maskable=False), "favicon-16.png")

ico = draw_icon(48, maskable=False)
ico.save(os.path.join(OUT, "..", "favicon.ico"),
         sizes=[(16, 16), (32, 32), (48, 48)])
print("OK favicon.ico")
