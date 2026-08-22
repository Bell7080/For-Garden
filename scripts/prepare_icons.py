"""
올린 아이콘 원본(PNG)을 게임이 쓰는 WebP로 굽는다.

속성·직군 아이콘은 한 가지 색으로 칠한 실루엣이라 색을 코드에서 정한다. 원본 색을 그대로
쓰면 아트를 다시 받을 때마다 화면의 색 규칙이 흔들리므로, 색은 이 표 하나에서만 정하고
모양만 원본에서 가져온다. 재화 아이콘은 여러 색으로 그린 그림이라 손대지 않고 크기만 줄인다.

    python3 scripts/prepare_icons.py

원본은 저장소에 남기지 않는다. 다시 구울 일이 생기면 원본을 public/ 아래에 두고 이 표의
`source`만 갱신한다.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

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

# 그림 그대로 쓰는 재화 아이콘. 색이 이미 맞아 손대지 않는다.
ART = {
    "sprites/currency/gold.webp": "Photoroom_20260822_113125.png",
    "sprites/currency/crystal.webp": "Photoroom_20260822_113155.png",
    "sprites/currency/cake.webp": "Photoroom_20260822_113222.png",
    "sprites/currency/amber.webp": "Photoroom_20260822_113236.png",
    "sprites/currency/fossil.webp": "Photoroom_20260822_113252.png",
    "sprites/currency/heart.webp": "Photoroom_20260822_113309.png",
    "sprites/currency/energy.webp": "Photoroom_20260822_113612.png",
}

# 화면에서 쓰는 가장 큰 크기의 두 배로 굽는다. 더 키우면 파일만 커지고 눈에 보이지 않는다.
SIZE = 256


def recolor(image: Image.Image, color: tuple[int, int, int]) -> Image.Image:
    """알파는 그대로 두고 색만 갈아 끼운다. 원본이 단색 실루엣이라 이것으로 충분하다."""
    alpha = image.getchannel("A")
    flat = Image.new("RGBA", image.size, (*color, 255))
    flat.putalpha(alpha)
    return flat


def save(image: Image.Image, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    image.resize((SIZE, SIZE), Image.LANCZOS).save(target, "WEBP", quality=92, method=6)
    print(f"{target.relative_to(PUBLIC)}  {target.stat().st_size // 1024} KB")


def main() -> None:
    for out, (source, color) in FLAT.items():
        save(recolor(Image.open(PUBLIC / source).convert("RGBA"), color), PUBLIC / out)
    for out, source in ART.items():
        save(Image.open(PUBLIC / source).convert("RGBA"), PUBLIC / out)


if __name__ == "__main__":
    main()
