"""Build an element-by-element animation from the paper's raster framework.

The paper has no layered source for this figure. Its canonical PNG is copied
into this repository; named crops/masks below reconstruct independent nodes
and connectors, without generating new scientific content. A layered SVG is
exported alongside the GIF so the elements can be inspected and repositioned.
Offline preparation requires Pillow; normal site builds use committed assets.
"""
from pathlib import Path
import base64
import hashlib
import json
import math
from xml.sax.saxutils import escape

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'scripts/assets/method-animation/paper-framework.png'
OUTPUT = ROOT / 'public/embodied-rsi/figures'
SOURCE_DIR = SOURCE.parent
WIDTH, FPS, SECONDS = 1440, 10, 20
PLAYBACK_SPEED = 3.0
# GIF delays use centiseconds; distribute rounding across the whole loop.
def playback_ms(frame_index):
    return round(frame_index * 1000 / FPS / PLAYBACK_SPEED / 10) * 10

paper = Image.open(SOURCE).convert('RGB')
assert paper.size == (1703, 907), 'Layer coordinates refer to the current paper figure.'
SCALE = WIDTH / paper.width
HEIGHT = round(paper.height * SCALE)
INK, ORANGE, BLUE = '#20313b', '#a05b36', '#286c98'

# Coordinates are in the original PNG. Every node and every connector is
# independently addressable. Connector paths wipe in the direction of flow.
LAYERS = [
    dict(id='wordmark', start=0, boxes=[[616, 0, 1088, 74]]),
    dict(id='playground-title', start=0, boxes=[[367, 76, 734, 178], [32, 189, 980, 200]]),
    dict(id='stage-divider', start=0, boxes=[[1003, 86, 1016, 272], [1003, 286, 1016, 894]]),
    dict(id='coding-agent', start=.4, boxes=[[148, 248, 505, 346]]),
    dict(id='edit-code', start=1.2, boxes=[[313, 346, 423, 412]], direction='down'),
    dict(id='playground-python', start=1.7, boxes=[[238, 412, 430, 565]]),
    dict(id='execute-code', start=2.5, boxes=[[311, 570, 465, 644]], direction='down'),
    dict(id='persistent-scene', start=3, boxes=[[149, 644, 507, 832]]),
    dict(id='persistent-state', start=3.2, boxes=[[325, 845, 757, 882]]),
    dict(id='playground-feedback', start=3.8, duration=.9,
         boxes=[[93, 284, 148, 461], [20, 461, 166, 507], [93, 507, 149, 738]],
         route=[[150, 729], [102, 729], [102, 298], [147, 298]], label=[20, 461, 166, 507]),
    dict(id='revise-experience', start=5, boxes=[[505, 240, 644, 302]], direction='right'),
    dict(id='harness-frame', start=5.5, boxes=[[644, 278, 978, 710], [978, 287, 984, 710], [660, 231, 970, 277]],
         covers=[[668, 315, 957, 484], [668, 517, 957, 673]]),
    dict(id='skills', start=6, boxes=[[668, 315, 957, 484]]),
    dict(id='lessons', start=6.8, boxes=[[668, 517, 957, 673]]),
    dict(id='reuse-experience', start=7.6, boxes=[[505, 304, 644, 361]], direction='left'),
    dict(id='test-title', start=9, boxes=[[1194, 78, 1580, 181], [1035, 189, 1671, 200]]),
    dict(id='freeze-experience', start=9.3, duration=.65, boxes=[[978, 240, 1168, 292]], direction='right'),
    dict(id='frozen-skills-lessons', start=10, boxes=[[1170, 210, 1572, 311]]),
    dict(id='inherit-experience', start=10.8, boxes=[[1360, 311, 1385, 347]], direction='down'),
    dict(id='fresh-agent', start=11.2, boxes=[[1199, 347, 1546, 439]]),
    dict(id='adapt-code', start=12, boxes=[[1361, 439, 1485, 484]], direction='down'),
    dict(id='test-python', start=12.5, boxes=[[1284, 484, 1475, 614]]),
    dict(id='test-execute', start=13.2, boxes=[[1363, 615, 1385, 644]], direction='down'),
    dict(id='unseen-scene', start=13.6, boxes=[[1187, 644, 1546, 833]]),
    dict(id='fresh-state', start=13.8, boxes=[[1166, 845, 1595, 882]]),
    dict(id='test-feedback', start=14.5, duration=.9,
         boxes=[[1546, 375, 1601, 542], [1546, 542, 1680, 587], [1546, 587, 1601, 742]],
         route=[[1545, 736], [1593, 736], [1593, 389], [1546, 389]], label=[1546, 542, 1680, 587]),
    dict(id='figure-baseline', start=15.5, boxes=[[33, 891, 1670, 904]]),
]


def coordinates(values):
    return tuple(round(v * SCALE) for v in values)


def fraction(t, layer):
    return max(0, min(1, (t - layer['start']) / layer.get('duration', .4)))


def partial_route(route, progress):
    lengths = [math.dist(a, b) for a, b in zip(route, route[1:])]
    remaining = sum(lengths) * progress
    points = [route[0]]
    for a, b, length in zip(route, route[1:], lengths):
        if remaining < length:
            points.append([a[0] + (b[0] - a[0]) * remaining / length,
                           a[1] + (b[1] - a[1]) * remaining / length])
            break
        points.append(b)
        remaining -= length
    return points


# Prepare independent raster layers once. The original gradient is retained;
# only the temporary empty harness has its two document slots covered.
prepared = []
for layer in LAYERS:
    mask = Image.new('L', paper.size)
    draw = ImageDraw.Draw(mask)
    for x0, y0, x1, y1 in layer['boxes']:
        draw.rectangle((x0, y0, x1 - 1, y1 - 1), fill=255)
    pixels = paper.copy()
    for x0, y0, x1, y1 in layer.get('covers', []):
        ImageDraw.Draw(pixels).rectangle((x0, y0, x1 - 1, y1 - 1), fill='#fbefe6')
    prepared.append((layer, pixels.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS),
                     mask.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)))


def reveal_mask(layer, mask, progress):
    if progress >= 1:
        return mask
    if 'route' in layer:
        wipe = Image.new('L', (WIDTH, HEIGHT))
        draw = ImageDraw.Draw(wipe)
        points = [coordinates(p) for p in partial_route(layer['route'], progress)]
        if len(points) > 1:
            draw.line(points, fill=255, width=round(28 * SCALE), joint='curve')
        if progress > .35:
            draw.rectangle(coordinates(layer['label']), fill=round(255 * min(1, (progress - .35) / .4)))
        from PIL import ImageChops
        return ImageChops.multiply(mask, wipe)
    if direction := layer.get('direction'):
        x0, y0, x1, y1 = coordinates(layer['boxes'][0])
        wipe = Image.new('L', (WIDTH, HEIGHT))
        if direction == 'down':
            y1 = y0 + round((y1 - y0) * progress)
        elif direction == 'right':
            x1 = x0 + round((x1 - x0) * progress)
        elif direction == 'left':
            x0 = x1 - round((x1 - x0) * progress)
        ImageDraw.Draw(wipe).rectangle((x0, y0, x1, y1), fill=255)
        from PIL import ImageChops
        return ImageChops.multiply(mask, wipe)
    # A short opacity fade keeps each independent node's entrance readable.
    return mask.point(lambda alpha: round(alpha * progress))


def flow_dot(frame, route, progress, color):
    x, y = coordinates(partial_route(route, progress)[-1])
    draw = ImageDraw.Draw(frame)
    draw.ellipse((x-7, y-7, x+7, y+7), fill='white', outline=color, width=2)
    draw.ellipse((x-3, y-3, x+3, y+3), fill=color)


def frame_at(t, flow=True):
    frame = Image.new('RGB', (WIDTH, HEIGHT), 'white')
    for layer, pixels, mask in prepared:
        progress = fraction(t, layer) if layer['start'] else 1
        if progress:
            frame.paste(pixels, (0, 0), reveal_mask(layer, mask, progress))
    # Brief pulses show the closed feedback loops after their elements arrive.
    if flow and 8.1 <= t < 9:
        flow_dot(frame, [[644, 319], [507, 319]], (t-8.1)/.9, ORANGE)
    if flow and 15.5 <= t < 17.7:
        flow_dot(frame, LAYERS[25]['route'], (t-15.5)/2.2, BLUE)
    return frame


def write_layered_source():
    """An SVG with named groups/masks, not a claim of an original vector source."""
    encoded = base64.b64encode(SOURCE.read_bytes()).decode()
    pieces = [f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" viewBox="0 0 1703 907" width="1703" height="907">',
              '<title>EmbodiedEvo two-stage framework — reconstructed layers</title>',
              '<desc>Named raster layers reconstructed from the paper PNG. Timing and masks are defined in scripts/render-method-animation.py. This is not an original vector source.</desc>',
              f'<defs><image id="paper-source" width="1703" height="907" href="data:image/png;base64,{encoded}"/>']
    for layer in LAYERS:
        pieces.append(f'<clipPath id="clip-{layer["id"]}">')
        for x0, y0, x1, y1 in layer['boxes']:
            pieces.append(f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}"/>')
        pieces.append('</clipPath>')
    pieces.extend(['</defs>', '<rect width="1703" height="907" fill="white"/>'])
    for layer in LAYERS:
        name = layer['id']
        pieces.append(f'<g id="{name}" inkscape:groupmode="layer" inkscape:label="{escape(name)}" data-start="{layer["start"] / PLAYBACK_SPEED:.4f}"><use href="#paper-source" clip-path="url(#clip-{name})"/>')
        for x0, y0, x1, y1 in layer.get('covers', []):
            pieces.append(f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" fill="#fbefe6"/>')
        pieces.append('</g>')
    pieces.append('</svg>')
    (OUTPUT / 'method-two-stages-layers.svg').write_text('\n'.join(pieces))
    manifest = dict(source='EAHarnessPaper/Figures/embodied-rsi-method.png',
                    sha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
                    source_type='Raster PNG; no layered source for this figure was found in the paper directory.',
                    layers=[dict(layer, start=round(layer['start'] / PLAYBACK_SPEED, 4),
                                 duration=round(layer.get('duration', .4) / PLAYBACK_SPEED, 4))
                            for layer in LAYERS],
                    seconds=playback_ms(SECONDS * FPS) / 1000,
                    playback_speed=PLAYBACK_SPEED, fps=FPS * PLAYBACK_SPEED,
                    output_size=[WIDTH, HEIGHT])
    (SOURCE_DIR / 'layers.json').write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    OUTPUT.mkdir(parents=True, exist_ok=True)
    write_layered_source()
    poster = frame_at(SECONDS, flow=False)
    # One palette keeps the illustration stable throughout fades and wipes.
    palette_source = poster.copy()
    palette_draw = ImageDraw.Draw(palette_source)
    # Reserve useful color coverage for the small robot-scene objects too.
    for i, color in enumerate([BLUE, ORANGE, '#cd473b', '#6198e0', '#edaa7a', '#2a676d']):
        palette_draw.rectangle((i * 45, 0, (i + 1) * 45, 16), fill=color)
    palette = palette_source.quantize(colors=256)
    frames = [frame_at(i / FPS).quantize(palette=palette, dither=Image.Dither.NONE)
              for i in range(SECONDS * FPS)]
    # Use the GIF's exact palette for the fallback too, so its background
    # matches the animation and surrounding card without a visible seam.
    frames[-1].convert('RGB').save(OUTPUT / 'method-two-stages-poster.webp', lossless=True)
    frames[0].save(OUTPUT / 'method-two-stages.gif', save_all=True, append_images=frames[1:],
                   duration=[playback_ms(i + 1) - playback_ms(i) for i in range(len(frames))],
                   loop=0, optimize=True, disposal=1)
    print(f'{len(LAYERS)} layers · {playback_ms(len(frames)) / 1000:g} seconds · {PLAYBACK_SPEED:g}× speed · {WIDTH} × {HEIGHT} · {(OUTPUT / "method-two-stages.gif").stat().st_size / 1e6:.2f} MB')
