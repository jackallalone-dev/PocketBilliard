"""Regenerate committed install icons with Python + Pillow (not needed to build)."""
from pathlib import Path
from math import hypot
from PIL import Image, ImageDraw

size = 1024
image = Image.new("RGB", (size, size))
pixels = image.load()
for y in range(size):
    for x in range(size):
        distance = min(1, hypot(x - size * .35, y - size * .25) / (size * .85))
        pixels[x, y] = tuple(round(a + (b - a) * distance) for a, b in zip((49, 75, 56), (17, 25, 23)))
draw = ImageDraw.Draw(image)
draw.ellipse((156, 178, 868, 890), fill="#101c16")
draw.ellipse((154, 154, 870, 870), fill="#eec478")
for radius in range(350, 0, -1):
    t = radius / 350
    color = tuple(round(a + (b - a) * t) for a, b in zip((62, 72, 65), (7, 13, 10)))
    draw.ellipse((512 - radius, 512 - radius, 512 + radius, 512 + radius), fill=color)
draw.ellipse((300, 253, 431, 297), fill="#68716a")
draw.ellipse((364, 364, 660, 660), fill="#f4edda")
draw.ellipse((456, 414, 568, 522), outline="#18231c", width=24)
draw.ellipse((450, 494, 574, 610), outline="#18231c", width=24)

output = Path(__file__).resolve().parents[1] / "public" / "icons"
output.mkdir(parents=True, exist_ok=True)
for name, dimensions in [("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)]:
    image.resize((dimensions, dimensions), Image.Resampling.LANCZOS).save(output / name, optimize=True)
