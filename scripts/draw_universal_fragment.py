"""만능 파편의 가운데 문양을 그린다 — `public/sprites/items/universal-fragment.webp`.

파편 액자(`FaceFrame`의 유리 결)는 그대로 두고 **얼굴 자리만** 이 문양으로 바꾼다. 누구의 얼굴도
아닌 **이목구비 없는 렐릭 실루엣**이 "어느 개체에나 쓴다"를, 가슴께를 뚫고 솟는 **두 겹 꺾쇠**가
"한계 돌파 재료"를 말한다. 꺾쇠는 칠하지 않고 **뚫어** 액자 안쪽의 등급색이 그 자리로 비치게 한다.

원화가 없는 기하 도형이라 원본 파일을 두지 않고 이 스크립트가 직접 그린다. 흰 실루엣 한 장만 굽고
색은 화면이 등급색 유리로 입힌다. 둥근 끝을 쓰지 않는 아이콘 규칙대로 머리도 각진 팔각이다.

    python3 scripts/draw_universal_fragment.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "public" / "sprites" / "items" / "universal-fragment.webp"
SIZE = 256
SCALE = 4  # 크게 그린 뒤 줄여 가장자리를 푼다.


def main() -> None:
    big = SIZE * SCALE
    unit = big / 256
    art = Image.new("L", (big, big), 0)
    draw = ImageDraw.Draw(art)

    def pts(*xy: float) -> list[tuple[float, float]]:
        return [(xy[i] * unit, xy[i + 1] * unit) for i in range(0, len(xy), 2)]

    # 머리 — 각진 팔각. 이목구비를 두지 않는다(누구의 얼굴도 아니다).
    cx, cy, r, c = 128, 78, 40, 16
    draw.polygon(pts(cx - r + c, cy - r, cx + r - c, cy - r, cx + r, cy - r + c, cx + r, cy + r - c,
                     cx + r - c, cy + r, cx - r + c, cy + r, cx - r, cy + r - c, cx - r, cy - r + c), fill=255)
    # 어깨 — 왼쪽 위·오른쪽 아래를 깎은 게임 칩의 결을 따른다.
    draw.polygon(pts(78, 130, 178, 130, 212, 164, 222, 230, 34, 230, 44, 156), fill=255)
    # 두 겹 꺾쇠 — 가슴께를 뚫는다. 위 꺾쇠가 머리 아래 목선까지 올라와 "솟는다"를 말한다.
    for top in (138, 178):
        draw.polygon(pts(128, top, 176, top + 40, 152, top + 40, 128, top + 20, 104, top + 40, 80, top + 40), fill=0)

    image = Image.new("RGBA", (big, big), (255, 255, 255, 0))
    image.putalpha(art)
    image = image.resize((SIZE, SIZE), Image.LANCZOS)
    # 재화·아이템 그림 규격(캔버스의 0.64~0.82)에 들도록 가운데에 앉힌다.
    box = image.getbbox()
    crop = image.crop(box)
    fill = 0.8
    ratio = min(SIZE * fill / crop.width, SIZE * fill / crop.height)
    crop = crop.resize((round(crop.width * ratio), round(crop.height * ratio)), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 0))
    canvas.paste(crop, ((SIZE - crop.width) // 2, (SIZE - crop.height) // 2), crop)
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(TARGET, "WEBP", quality=92, method=6)
    print(f"{TARGET.relative_to(ROOT)} {canvas.size}")


if __name__ == "__main__":
    main()
