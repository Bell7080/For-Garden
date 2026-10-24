"""만능 파편의 홀로그램 문양을 굽는다 — `public/sprites/items/universal-fragment-{r,sr,ssr}.webp`.

파편 액자(`FaceFrame`의 유리 결)는 그대로 두고 **얼굴 자리만** 이 문양으로 바꾼다. 그림은 세 겹이다.

1. **깎인 결정 조각** — 비대칭으로 깨진 결정 한 조각. 면마다 등급색의 밝기를 달리해 결정이 빛을 받는
   각도로 읽히고, 무지갯빛이 비스듬히 스며 홀로그램 필름처럼 일렁인다.
2. **투영된 실루엣** — 조각 한가운데에 이목구비 없는 렐릭 흉상이 흰 빛으로 떠 있다. 누구의 얼굴도
   아니라는 것이 "어느 개체에나 쓴다"를, 머리 위로 솟는 꺾쇠가 "한계 돌파 재료"를 말한다.
3. **투영 장비의 결** — 가로 주사선, 청록·자홍으로 비껴 선 색수차, 바깥으로 번지는 등급색 발광.

등급은 색으로만 가른다(`RARITY_TONE`과 같은 값). 원화가 없는 기하 도형이라 원본 파일을 두지 않고 이
스크립트가 직접 그린다. 둥근 끝을 쓰지 않는 아이콘 규칙대로 모든 꼭짓점이 각지다.

    python3 scripts/draw_universal_fragment.py
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
TARGET_DIR = ROOT / "public" / "sprites" / "items"
SIZE = 256
SCALE = 4  # 크게 그린 뒤 줄여 가장자리를 푼다.

# `src/ui/rarityMark.ts`의 RARITY_TONE과 같은 계열 — deep(그늘 면) · chip(바탕) · halo(발광) · ink(밝은 면).
TONES = {
    "r": {"deep": (14, 58, 104), "chip": (47, 154, 212), "halo": (95, 212, 255), "ink": (232, 251, 255)},
    "sr": {"deep": (70, 22, 98), "chip": (167, 73, 201), "halo": (224, 112, 245), "ink": (255, 226, 255)},
    "ssr": {"deep": (98, 58, 6), "chip": (199, 138, 28), "halo": (255, 194, 71), "ink": (255, 243, 196)},
}

# 결정 조각의 바깥 꼭짓점(256 기준). 위가 뾰족하고 오른쪽 아래가 깨져 나간 비대칭 조각이다.
SHARD = [(128, 14), (190, 64), (206, 150), (164, 214), (150, 244), (96, 232), (52, 150), (70, 58)]
# 면을 가르는 안쪽 한 점 — 가운데보다 왼쪽 위라 오른쪽 면이 넓게 빛을 받는다.
CORE = (118, 112)
# 면마다의 밝기(0 그늘 ~ 1 빛). 꼭짓점 순서대로 이웃 둘과 CORE가 만드는 삼각형이다.
FACET_LIGHT = [0.62, 0.46, 0.3, 0.14, 0.04, 0.2, 0.36, 0.52]


def mix(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def light_color(tone: dict, t: float) -> tuple[int, int, int]:
    """0이면 그늘 면(deep), 0.5에 바탕(chip), 1이면 밝은 면(ink)."""
    return mix(tone["deep"], tone["chip"], t * 2) if t < 0.5 else mix(tone["chip"], tone["ink"], (t - 0.5) * 2)


def draw_variant(key: str, tone: dict) -> Image.Image:
    big = SIZE * SCALE
    u = big / 256

    def p(x: float, y: float) -> tuple[float, float]:
        return (x * u, y * u)

    shard_pts = [p(*xy) for xy in SHARD]
    shard_mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(shard_mask).polygon(shard_pts, fill=255)

    # 1. 결정 면 — 면마다 다른 밝기로 칠한다.
    body = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(body)
    count = len(SHARD)
    for i in range(count):
        a, b = SHARD[i], SHARD[(i + 1) % count]
        draw.polygon([p(*a), p(*b), p(*CORE)], fill=(*light_color(tone, FACET_LIGHT[i]), 255))

    # 무지갯빛 — 왼쪽 위 청록에서 오른쪽 아래 자홍으로 비스듬히 지나는 필름. 면을 덮지 않고 얇게 스민다.
    iris = Image.new("RGB", (big, big))
    iris_px = iris.load()
    stops = [(0.0, (120, 255, 240)), (0.35, tone["halo"]), (0.7, (255, 140, 230)), (1.0, (150, 170, 255))]
    step = 8
    for y in range(0, big, step):
        for x in range(0, big, step):
            t = min(1.0, max(0.0, (x + y) / (2 * big)))
            for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
                if t <= t1:
                    color = mix(c0, c1, (t - t0) / (t1 - t0))
                    break
            for dy in range(step):
                for dx in range(step):
                    iris_px[x + dx, y + dy] = color
    iris = iris.filter(ImageFilter.GaussianBlur(6 * SCALE))
    body_rgb = body.convert("RGB")
    screened = ImageChops.screen(body_rgb, iris)
    body_rgb = Image.blend(body_rgb, screened, 0.38)

    # 면 사이의 능선 — 밝은 선이 결정의 모서리를 세운다.
    ridge = Image.new("L", (big, big), 0)
    rdraw = ImageDraw.Draw(ridge)
    for xy in SHARD:
        rdraw.line([p(*CORE), p(*xy)], fill=150, width=round(2.2 * u))
    rdraw.line(shard_pts + [shard_pts[0]], fill=255, width=round(5 * u), joint="curve")
    ridge = ImageChops.multiply(ridge, shard_mask)
    body_rgb = Image.composite(Image.new("RGB", (big, big), tone["ink"]), body_rgb, ridge)

    # 2. 투영된 흉상과 솟는 꺾쇠 — 흰 빛.
    figure = Image.new("L", (big, big), 0)
    fdraw = ImageDraw.Draw(figure)
    cx, cy, r, c = 124, 118, 19, 8
    head = [p(cx - r + c, cy - r), p(cx + r - c, cy - r), p(cx + r, cy - r + c), p(cx + r, cy + r - c),
            p(cx + r - c, cy + r), p(cx - r + c, cy + r), p(cx - r, cy + r - c), p(cx - r, cy - r + c)]
    shoulders = [p(100, 146), p(148, 146), p(166, 164), p(170, 200), p(80, 200), p(84, 160)]
    fdraw.polygon(head, fill=255)
    fdraw.polygon(shoulders, fill=255)
    # 흉상은 아래로 갈수록 빛이 옅어진다 — 바닥에서 쏘아 올린 투영처럼 잘린 단면이 없다.
    fade = Image.new("L", (big, big), 0)
    fdraw2 = ImageDraw.Draw(fade)
    for y in range(big):
        v = 1.0 if y < 150 * u else max(0.0, 1 - (y - 150 * u) / (52 * u))
        fdraw2.line([(0, y), (big, y)], fill=round(255 * v))
    figure = ImageChops.multiply(ImageChops.multiply(figure, fade), shard_mask)
    # 속은 반쯤 비치고 테두리만 또렷하다 — 칠한 판이 아니라 빛으로 그린 윤곽.
    inner = figure.filter(ImageFilter.MinFilter(21))
    outline = ImageChops.subtract(figure, inner)
    figure = ImageChops.lighter(ImageChops.multiply(figure, Image.new("L", (big, big), 215)), outline)
    chevron = Image.new("L", (big, big), 0)
    cdraw = ImageDraw.Draw(chevron)
    for top, alpha in ((46, 255), (68, 170)):
        cdraw.polygon([p(124, top), p(152, top + 22), p(141, top + 22), p(124, top + 9), p(107, top + 22), p(96, top + 22)], fill=alpha)
    glyph = ImageChops.lighter(figure, chevron)
    glyph_glow = ImageChops.lighter(figure, chevron).filter(ImageFilter.GaussianBlur(6 * SCALE))
    body_rgb = Image.composite(Image.new("RGB", (big, big), tone["halo"]), body_rgb, ImageChops.multiply(glyph_glow, Image.new("L", (big, big), 230)))
    body_rgb = Image.composite(Image.new("RGB", (big, big), (255, 255, 255)), body_rgb, glyph)

    # 3. 주사선 — 결정 면만 4px마다 한 줄씩 어둡게. 흰 문양은 그대로 둬 떠 보이게 한다.
    scan = Image.new("L", (big, big), 255)
    sdraw = ImageDraw.Draw(scan)
    line = 4 * SCALE
    for y in range(0, big, line):
        sdraw.rectangle([0, y, big, y + SCALE * 1.4], fill=180)
    scan = ImageChops.lighter(scan, chevron)
    body_rgb = ImageChops.multiply(body_rgb, Image.merge("RGB", (scan, scan, scan)))

    # 결정 면은 살짝 비친다(홀로그램) — 흰 문양과 능선만 온전히 선다.
    alpha = ImageChops.multiply(shard_mask, Image.new("L", (big, big), 236))
    alpha = ImageChops.lighter(alpha, ImageChops.multiply(ridge, shard_mask))
    alpha = ImageChops.lighter(alpha, glyph)
    shard = body_rgb.convert("RGBA")
    shard.putalpha(alpha)

    # 색수차 — 청록은 왼쪽 위, 자홍은 오른쪽 아래로 비껴 선 옅은 그림자.
    canvas = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    glow = shard_mask.filter(ImageFilter.GaussianBlur(9 * SCALE))
    canvas.paste(Image.new("RGBA", (big, big), (*tone["halo"], 255)), (0, 0), ImageChops.multiply(glow, Image.new("L", (big, big), 170)))
    shift = round(3.2 * u)
    for color, dx, dy in (((90, 240, 255), -shift, -shift // 2), ((255, 90, 210), shift, shift // 2)):
        ghost = Image.new("L", (big, big), 0)
        ghost.paste(ImageChops.multiply(shard_mask, Image.new("L", (big, big), 150)), (dx, dy))
        canvas.paste(Image.new("RGBA", (big, big), (*color, 255)), (0, 0), ghost)
    canvas = Image.alpha_composite(canvas, shard)

    image = canvas.resize((SIZE, SIZE), Image.LANCZOS)
    # 재화·아이템 그림 규격(캔버스의 0.64~0.82)에 들도록 가운데에 앉힌다. 발광 꼬리는 경계에서 뺀다.
    box = image.split()[3].point(lambda a: 255 if a > 24 else 0).getbbox()
    crop = image.crop(box)
    fill = 0.82
    ratio = min(SIZE * fill / crop.width, SIZE * fill / crop.height)
    crop = crop.resize((round(crop.width * ratio), round(crop.height * ratio)), Image.LANCZOS)
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    out.paste(crop, ((SIZE - crop.width) // 2, (SIZE - crop.height) // 2), crop)
    return out


def main() -> None:
    TARGET_DIR.mkdir(parents=True, exist_ok=True)
    for key, tone in TONES.items():
        target = TARGET_DIR / f"universal-fragment-{key}.webp"
        draw_variant(key, tone).save(target, "WEBP", quality=92, method=6)
        print(f"{target.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
