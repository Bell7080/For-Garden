"""
올린 아이콘 원본(PNG)을 게임이 쓰는 WebP로 굽는다.

속성·직군 아이콘은 한 가지 색으로 칠한 실루엣이라 색을 코드에서 정한다. 원본 색을 그대로
쓰면 아트를 다시 받을 때마다 화면의 색 규칙이 흔들리므로, 색은 이 표 하나에서만 정하고
모양만 원본에서 가져온다. 재화 아이콘은 여러 색으로 그린 그림이라 손대지 않고 크기만 줄인다.

    python3 scripts/prepare_icons.py <원본 폴더>

원본은 저장소에 남기지 않는다. 다시 구울 일이 생기면 원본을 public/ 아래에 두고 이 표의
`source`만 갱신한다.
"""
import math
import sys
from pathlib import Path
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
# 원본은 저장소에 남기지 않는다. 다시 구울 때만 원본이 있는 폴더를 인자로 넘긴다.
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else PUBLIC

# 실루엣 아이콘의 색. 속성은 보석처럼 맑게, 직군은 빨강·하늘·연두·보라 넷으로 갈라 둔다.
FLAT = {
    "sprites/elements/fire.webp": ("Photoroom_20260822_095940.png", (0xEF, 0x5B, 0x45)),
    "sprites/elements/water.webp": ("Photoroom_20260822_100006.png", (0x4F, 0xA8, 0xE4)),
    "sprites/elements/grass.webp": ("Photoroom_20260822_100026.png", (0x63, 0xC1, 0x72)),
    "sprites/elements/earth.webp": ("Photoroom_20260822_095914.png", (0xD2, 0x9B, 0x5E)),
    "sprites/elements/wind.webp": ("Photoroom_20260822_100047.png", (0x86, 0xDC, 0xC8)),
    "sprites/roles/warrior.webp": ("Photoroom_20260822_100145.png", (0xE2, 0x5C, 0x54)),
    "sprites/roles/tank.webp": ("Photoroom_20260822_100132.png", (0x5C, 0xB8, 0xEA)),
    "sprites/roles/support.webp": ("Photoroom_20260822_100118.png", (0x9F, 0xD4, 0x5F)),
    "sprites/roles/assassin.webp": ("Photoroom_20260822_100103.png", (0xA8, 0x7C, 0xE6)),
}

# 여러 색으로 그린 재화 아이콘. 모양은 그대로 두고 필요한 것만 색을 민다.
#
# 호박석과 스테미나가 누런빛이라 작은 아이콘에서는 구분되지 않았다. 호박석은 노란 쪽으로,
# 스테미나는 초록 쪽으로 밀어 갈라 놓는다. 채널별 배율만 쓰므로 명암과 질감은 그대로다.
ART: dict[str, tuple[str, tuple[float, float, float] | None] | tuple[str, tuple[float, float, float] | None, float]] = {
    "sprites/currency/gold.webp": ("Photoroom_20260822_113125.png", None),
    "sprites/currency/crystal.webp": ("Photoroom_20260822_113155.png", None),
    "sprites/currency/cake.webp": ("Photoroom_20260822_113222.png", None),
    "sprites/currency/amber.webp": ("Photoroom_20260822_113236.png", (1.06, 0.99, 0.62)),
    # 화석은 채도만 덜어 낸다. 색을 밀면 광물이 아니라 얼음이 되고, 그대로 두면 호박석의
    # 누런빛과 섞인다. 회색 쪽으로 살짝 빼는 정도가 돌빛에 가장 가깝다.
    "sprites/currency/fossil.webp": ("Photoroom_20260822_113252.png", None, 0.55),
    "sprites/currency/heart.webp": ("Photoroom_20260822_113309.png", None),
    "sprites/currency/energy.webp": ("Photoroom_20260822_113612.png", (0.44, 1.04, 0.52)),
}

# 화면에서 쓰는 가장 큰 크기의 두 배로 굽는다. 더 키우면 파일만 커지고 눈에 보이지 않는다.
SIZE = 256


def recolor(image: Image.Image, color: tuple[int, int, int]) -> Image.Image:
    """알파는 그대로 두고 색만 갈아 끼운다. 원본이 단색 실루엣이라 이것으로 충분하다."""
    alpha = image.getchannel("A")
    flat = Image.new("RGBA", image.size, (*color, 255))
    flat.putalpha(alpha)
    return flat


# 룬 하트를 등급별로 칠하는 색. 초록 고급 → 파랑 희귀 → 보라 영웅 → 빨강 전설 순으로 오른다.
#
# 채널 배율로 밀면 원본이 붉은 보석이라 초록·파랑이 어둡게 죽는다. 그래서 명암만 남긴 뒤
# 어두운 곳·중간·밝은 곳 세 색으로 다시 칠한다. 보석의 깎인 면과 반짝임이 그대로 살아난다.
RUNE_TINTS: dict[str, tuple[str, str, str]] = {
    "uncommon": ("#06140a", "#3fbb56", "#dcffe2"),
    "rare": ("#04101e", "#3d90e2", "#d8edff"),
    "epic": ("#150720", "#a24ee0", "#f2ddff"),
    "legendary": ("#1a0406", "#e0343c", "#ffdcdc"),
}

# 하트를 셋으로 가르는 경계(화면 각도, 아래가 +). 위·오른아래·왼아래 세 방향으로 자른다.
RUNE_CUTS = {0: (150, 270), 1: (270, 390), 2: (30, 150)}
# 자른 면을 서로에게서 몇 도 물러나게 할지. 이 각도만큼 사이가 벌어져 세 조각으로 읽힌다.
RUNE_GAP_DEGREES = 1.6
# 조각이 만나는 가운데 점(이미지 높이 대비). 하트의 무게중심보다 살짝 위다.
RUNE_CENTER_Y = 0.44


def colorize(art: Image.Image, tones: tuple[str, str, str]) -> Image.Image:
    """명암만 남기고 등급 색으로 다시 칠한다. 알파는 원본 그대로다."""
    from PIL import ImageOps

    grey = art.convert("L")
    tinted = ImageOps.colorize(grey, black=tones[0], mid=tones[1], white=tones[2], midpoint=128).convert("RGBA")
    tinted.putalpha(art.getchannel("A"))
    return tinted


def wedge_mask(size: int, start: float, end: float) -> Image.Image:
    """가운데에서 뻗어 나가는 부채꼴 하나. 이것으로 원본을 오려 조각을 만든다."""
    from PIL import ImageDraw

    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    center = (size / 2, size * RUNE_CENTER_Y)
    radius = size * 1.5
    points = [center]
    steps = 48
    for i in range(steps + 1):
        angle = math.radians(start + (end - start) * i / steps)
        points.append((center[0] + math.cos(angle) * radius, center[1] + math.sin(angle) * radius))
    draw.polygon(points, fill=255)
    return mask


def rune_pieces(art: Image.Image, size: int) -> list[Image.Image]:
    """원본 하트를 세 조각으로 오린다. 셋을 같은 자리에 겹치면 다시 한 장의 하트가 된다."""
    art = art.resize((size, size), Image.LANCZOS)
    pieces: list[Image.Image] = []
    for index in range(3):
        start, end = RUNE_CUTS[index]
        mask = wedge_mask(size, start + RUNE_GAP_DEGREES, end - RUNE_GAP_DEGREES)
        piece = art.copy()
        piece.putalpha(ImageChops.multiply(art.getchannel("A"), mask))
        pieces.append(piece)
    return pieces


def socket(piece: Image.Image) -> Image.Image:
    """빈 자리. 같은 조각을 검게 눌러 파인 것처럼 보이게 하고 반투명하게 남긴다."""
    black = Image.new("RGBA", piece.size, (2, 4, 10, 255))
    black.putalpha(piece.getchannel("A").point(lambda value: int(value * 0.62)))
    return black


def desaturate(image: Image.Image, keep: float) -> Image.Image:
    """색을 회색 쪽으로 섞는다. `keep`이 1이면 원본, 0이면 완전한 흑백이다."""
    grey = image.convert("L").convert("RGBA")
    grey.putalpha(image.getchannel("A"))
    return Image.blend(grey, image, keep)


def shift(image: Image.Image, factor: tuple[float, float, float]) -> Image.Image:
    """채널별로 밝기를 눌러 색을 민다. 알파와 명암은 그대로라 질감이 살아 있다."""
    r, g, b, a = image.split()
    channels = [channel.point(lambda value, scale=scale: min(255, round(value * scale))) for channel, scale in zip((r, g, b), factor)]
    return Image.merge("RGBA", (*channels, a))


def save(image: Image.Image, target: Path) -> None:
    save_exact(image.resize((SIZE, SIZE), Image.LANCZOS), target)


def save_exact(image: Image.Image, target: Path) -> None:
    """이미 크기를 맞춘 그림을 그대로 굽는다. 조각은 캔버스 자리가 곧 위치라 다시 늘리지 않는다."""
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, "WEBP", quality=92, method=6)
    print(f"{target.relative_to(PUBLIC)}  {target.stat().st_size // 1024} KB")


def main() -> None:
    for out, (source, color) in FLAT.items():
        save(recolor(Image.open(SOURCE / source).convert("RGBA"), color), PUBLIC / out)
    # 룬 하트: 등급별 색 넷 × 조각 셋, 그리고 조각 모양 그대로의 빈 자리.
    heart = Image.open(SOURCE / "Photoroom_20260822_113309.png").convert("RGBA")
    for rarity, tones in RUNE_TINTS.items():
        for index, piece in enumerate(rune_pieces(colorize(heart, tones), SIZE)):
            save_exact(piece, PUBLIC / f"sprites/runes/{rarity}-{index}.webp")
    for index, piece in enumerate(rune_pieces(heart, SIZE)):
        save_exact(socket(piece), PUBLIC / f"sprites/runes/empty-{index}.webp")

    for out, entry in ART.items():
        source, factor = entry[0], entry[1]
        art = Image.open(SOURCE / source).convert("RGBA")
        if factor:
            art = shift(art, factor)
        if len(entry) == 3:
            art = desaturate(art, entry[2])
        save(art, PUBLIC / out)


if __name__ == "__main__":
    main()
