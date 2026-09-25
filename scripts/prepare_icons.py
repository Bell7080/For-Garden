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
    # 치즈케이크는 v0.177.0에 더 귀여운 원화로 바꿨다. 급여 버튼·가방·보상이 모두 이 한 장을 읽는다.
    "sprites/currency/cake.webp": ("새 치즈케이크.webp", None),
    # 화석·호박석은 v0.174.8에 원화를 새로 받았다. 새 원화는 둘이 이미 푸른 결정과 붉은 호박으로
    # 갈려 있어 **색을 밀지 않는다** — 예전 원화에 쓰던 채도 빼기·노란 쪽 밀기는 누런빛끼리
    # 섞이던 옛 그림의 몫이었다. 대신 캔버스를 거의 꽉 채워 그려져 있어 여백을 되돌린다(RECENTER).
    "sprites/currency/amber.webp": ("호박석.webp", None),
    "sprites/currency/fossil.webp": ("화석.webp", None),
    # DNA 조각은 원화 크기(1254) 그대로 올라와 있었다 — 같은 규격(256)으로 굽는다.
    "sprites/currency/dna.webp": ("DNA조각.webp", None),
    "sprites/currency/heart.webp": ("Photoroom_20260822_113309.png", None),
    # 고고학의 원석. 화석은 채도를 덜어 낸 회갈색이라 같은 돌빛에 머물면 상단 재화 줄에서
    # 두 칸이 같은 그림으로 보인다 — 원석은 **청록 쪽으로** 조금 밀어 갈라 놓는다.
    "sprites/currency/orestone.webp": ("원석.png", (0.92, 1.02, 1.08)),
    # 지층 탐사의 남은 횟수를 말하는 곡괭이. 재화가 아니라 조작 횟수라 색을 밀지 않는다 —
    # 상단 재화 줄의 칸들과 같은 결로 보이면 지갑에 있는 것으로 읽힌다.
    "sprites/ui/pickaxe.webp": ("발굴기회아이콘.png", None),
    "sprites/currency/energy.webp": ("Photoroom_20260822_113612.png", (0.44, 1.04, 0.52)),
    # 전리품 상점의 두 증표. 색을 밀지 않는다 — 레이드와 원정이 저마다 다른 그림이라 이미
    # 갈려 있고, 지갑의 다른 칸과 달리 상단 줄에 함께 서는 일이 전리품 상점 하나뿐이다.
    # 스테미나 소비품 둘. 재화가 아니라 **가방에 서는 아이템**이지만 같은 액자를 쓰므로
    # 같은 규격으로 굽는다 — 화면마다 다른 크기로 서면 액자 규칙이 갈린다.
    "sprites/items/stamina-tonic.webp": ("에너지드링크60회복.png", None),
    "sprites/items/stamina-tonic-large.webp": ("에너지드링크+(120회복).png", None),
    "sprites/currency/raid-sigil.webp": ("토벌증표.webp", None),
    "sprites/currency/salvage-record.webp": ("인양기록.webp", None),
    # 토벌권 둘. 가방의 재료지만 레이드 목록 머리에 액자로 서므로 같은 규격으로 굽는다.
    "sprites/items/raid-ticket.webp": ("토벌권.webp", None),
    "sprites/items/raid-select-ticket.webp": ("선택 토벌권.webp", None),
    # 룬 특성 재료 셋. 임시 글리프(두루마리)로 서 있던 자리다.
    "sprites/items/ancient-core.webp": ("미지의 고대핵.png", None),
    "sprites/items/refined-core.webp": ("정제된 고대핵.webp", None),
    "sprites/items/restoration-crystal.webp": ("완전 복원 결정.webp", None),
}

# 그림이 캔버스 가운데에 있지 않은 원본.
#
# 액자(`addFramedIcon`)는 텍스처를 **캔버스 기준**으로 가운데에 놓으므로, 원본이 한쪽으로
# 쏠려 그려져 있으면 액자 안에서도 그만큼 쏠려 앉는다. 원석 원본이 그랬다 — 오른쪽과 위
# 변에 그림이 닿아 있어(여백 L232 R0 T0 B158) 그대로 넣으면 잘린 것처럼 보인다.
# 알파 경계로 잘라 낸 뒤 **긴 변이 캔버스의 이만큼**이 되도록 다시 가운데에 앉힌다 —
# 화석·호박석 같은 기존 재화 아이콘의 여백(한 변의 12~20%)과 같은 결이 된다.
RECENTER: dict[str, float] = {
    "sprites/currency/orestone.webp": 0.8,
    "sprites/ui/pickaxe.webp": 0.86,
    # 두 증표 원본은 캔버스를 0.97까지 채워 그대로 넣으면 액자 안에서 혼자 커 보인다 —
    # 기존 재화 아이콘이 0.64~0.82에 들어 있어 그 띠로 되돌린다.
    "sprites/items/stamina-tonic.webp": 0.78,
    "sprites/items/stamina-tonic-large.webp": 0.78,
    "sprites/currency/raid-sigil.webp": 0.8,
    "sprites/currency/salvage-record.webp": 0.8,
    # 토벌권은 가로로 긴 표라 긴 변을 조금 더 채운다 — 0.8이면 세로가 얇아 액자 안에서 작아 보인다.
    "sprites/items/raid-ticket.webp": 0.86,
    "sprites/items/raid-select-ticket.webp": 0.86,
    # 새 화석·호박석은 캔버스의 0.9 넘게 채워, 그대로 넣으면 상단 재화 줄에서 둘만 혼자 컸다 —
    # 기존 재화(0.64~0.82)의 띠로 되돌린다. 둘은 네모진 덩어리라 알파 상자를 거의 꽉 채워, 같은
    # 비율이면 동전·보석보다 무겁게 보인다 — 그만큼 조금 더 작게 앉힌다.
    "sprites/currency/fossil.webp": 0.74,
    "sprites/currency/amber.webp": 0.74,
    "sprites/currency/dna.webp": 0.72,
    # 치즈케이크는 접시에 놓인 조각이라 옆으로 길고 낮다 — 긴 변을 조금 더 채워야 다른 재화와 같은 무게로 읽힌다.
    "sprites/currency/cake.webp": 0.78,
    "sprites/items/ancient-core.webp": 0.82,
    "sprites/items/refined-core.webp": 0.82,
    "sprites/items/restoration-crystal.webp": 0.82,
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
#
# 희귀는 하늘빛, 영웅은 분홍에 가까운 보라다. 둘이 같은 남보라 계열이면 가방에 나란히
# 놓였을 때 등급이 갈리지 않는다. 그리고 넷 다 **어두운 곳을 띄우고 중간을 밝게** 잡는다 —
# 그림자를 검정까지 내리면 보석이 아니라 칙칙한 돌이 된다. 스스로 빛나는 쪽이 등급 신호로도
# 훨씬 잘 읽힌다.
RUNE_TINTS: dict[str, tuple[str, str, str]] = {
    "uncommon": ("#0d2a14", "#4fd66a", "#e8ffee"),
    "rare": ("#0a3350", "#5fd4ff", "#f2fdff"),
    "epic": ("#33124a", "#e070f5", "#ffe8ff"),
    "legendary": ("#3a0a10", "#ff4a54", "#ffe6e6"),
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


# 그림의 경계를 정할 때 무시하는 알파.
#
# 원석 원본에는 **거의 보이지 않는 후광**(알파 1~7)이 캔버스 오른쪽·위 변까지 번져 있었다.
# 그대로 재면 경계가 캔버스 전체가 되어 가운데 맞추기가 아무 일도 하지 않는다 — 눈에 보이는
# 획만 세도록 문턱을 둔다.
TRIM_ALPHA = 8


def recenter(image: Image.Image, fill: float) -> Image.Image:
    """눈에 보이는 알파 경계로 잘라 낸 뒤 정사각 캔버스 가운데에 다시 앉힌다."""
    box = image.getchannel("A").point(lambda value: 255 if value >= TRIM_ALPHA else 0).getbbox()
    if box is None:
        return image
    art = image.crop(box)
    side = round(max(art.size) / fill)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(art, ((side - art.width) // 2, (side - art.height) // 2))
    return canvas


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


def load(source: str) -> Image.Image | None:
    """원본이 없으면 건너뛴다.

    **없는 것이 정상이다** — 이 스크립트의 규칙이 「원본은 저장소에 남기지 않는다」라, 한 번
    구운 그림의 원본은 곧 사라지고 표만 남는다. 없다고 멈추면 **새 아이콘 한 장을 굽기 위해
    이미 구운 것들의 원본을 전부 다시 모아야** 하고, 그 비용 때문에 아무도 표에 더하지 않는다.
    건너뛴 것은 이름을 찍어 조용히 지나가지 않게 한다.
    """
    path = SOURCE / source
    if not path.exists():
        print(f"건너뜀 — 원본 없음: {source}")
        return None
    return Image.open(path).convert("RGBA")


def main() -> None:
    for out, (source, color) in FLAT.items():
        art = load(source)
        if art is not None:
            save(recolor(art, color), PUBLIC / out)
    # 룬 하트: 등급별 색 넷 × 조각 셋, 그리고 조각 모양 그대로의 빈 자리.
    heart = load("Photoroom_20260822_113309.png")
    if heart is not None:
        for rarity, tones in RUNE_TINTS.items():
            for index, piece in enumerate(rune_pieces(colorize(heart, tones), SIZE)):
                save_exact(piece, PUBLIC / f"sprites/runes/{rarity}-{index}.webp")
        for index, piece in enumerate(rune_pieces(heart, SIZE)):
            save_exact(socket(piece), PUBLIC / f"sprites/runes/empty-{index}.webp")

    for out, entry in ART.items():
        source, factor = entry[0], entry[1]
        art = load(source)
        if art is None:
            continue
        if factor:
            art = shift(art, factor)
        if len(entry) == 3:
            art = desaturate(art, entry[2])
        if out in RECENTER:
            art = recenter(art, RECENTER[out])
        save(art, PUBLIC / out)


if __name__ == "__main__":
    main()
