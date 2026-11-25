import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

WIDTH, HEIGHT = 1280, 720

SCENES = [
    ("whitefield-plot", (135, 190, 235), (118, 168, 84), "residential"),
    ("devanahalli-farm", (160, 205, 240), (96, 150, 60), "agricultural"),
    ("hosur-road-commercial", (190, 210, 230), (150, 160, 110), "commercial"),
    ("kanakapura-acreage", (125, 180, 230), (104, 158, 70), "agricultural"),
    ("sarjapur-plot", (150, 195, 235), (128, 172, 92), "residential"),
    ("bidadi-industrial", (180, 200, 215), (140, 150, 105), "industrial"),
]


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def draw_scene(name, sky, ground, kind, seed):
    rng = random.Random(seed)
    image = Image.new("RGB", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(image)
    horizon = int(HEIGHT * rng.uniform(0.36, 0.46))

    for y in range(horizon):
        draw.line([(0, y), (WIDTH, y)], fill=lerp((250, 250, 255), sky, 1 - y / horizon))

    for layer in range(3):
        color = lerp((150, 175, 185), ground, 0.3 + layer * 0.2)
        points = [(0, horizon)]
        for x in range(0, WIDTH + 80, 80):
            points.append((x, horizon - rng.randint(10, 45) + layer * 12))
        points += [(WIDTH, horizon + 20), (0, horizon + 20)]
        draw.polygon(points, fill=color)

    for y in range(horizon, HEIGHT):
        t = (y - horizon) / (HEIGHT - horizon)
        draw.line([(0, y), (WIDTH, y)], fill=lerp(lerp(ground, (200, 210, 160), 0.25), lerp(ground, (60, 90, 40), 0.35), t))

    if kind == "agricultural":
        for row in range(14):
            y = horizon + 30 + row * (HEIGHT - horizon) / 14
            draw.line([(WIDTH * 0.5 - 40 - row * 70, y), (WIDTH * 0.5 + 40 + row * 70, y)], fill=lerp(ground, (70, 110, 40), 0.5), width=3)
    else:
        left, right = WIDTH * 0.22, WIDTH * 0.78
        top, bottom = horizon + 40, HEIGHT - 40
        plot = [(left + 120, top), (right - 120, top), (right, bottom), (left, bottom)]
        draw.polygon(plot, fill=lerp(ground, (190, 170, 120), 0.45))
        for corner in plot:
            draw.rectangle([corner[0] - 6, corner[1] - 22, corner[0] + 6, corner[1]], fill=(240, 240, 235))
        draw.line(plot + [plot[0]], fill=(245, 245, 240), width=4)
        draw.line([(0, HEIGHT - 18), (WIDTH, HEIGHT - 18)], fill=(90, 90, 95), width=26)

    if kind in ("commercial", "industrial"):
        for i in range(rng.randint(3, 6)):
            x = rng.randint(40, WIDTH - 140)
            w, h = rng.randint(60, 140), rng.randint(60, 180)
            draw.rectangle([x, horizon - h, x + w, horizon], fill=lerp((170, 175, 185), sky, 0.35))

    for _ in range(rng.randint(8, 16)):
        x = rng.choice([rng.randint(0, int(WIDTH * 0.2)), rng.randint(int(WIDTH * 0.8), WIDTH)])
        y = rng.randint(horizon - 5, horizon + 60)
        r = rng.randint(18, 42)
        draw.rectangle([x - 3, y, x + 3, y + r], fill=(95, 70, 45))
        draw.ellipse([x - r, y - r * 1.4, x + r, y + r * 0.4], fill=lerp(ground, (40, 85, 35), rng.uniform(0.4, 0.8)))

    image = image.filter(ImageFilter.GaussianBlur(0.6))
    return image


def main(output_dir):
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    for index, (name, sky, ground, kind) in enumerate(SCENES):
        for variant in range(2):
            draw_scene(name, sky, ground, kind, index * 10 + variant).save(output / f"{name}-{variant + 1}.jpg", quality=82)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "seed-images")
