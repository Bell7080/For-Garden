"""정보창 하트에 끼운 룬 조각의 **이음매 없는** 판을 굽는다.

`prepare_icons.py`는 하트를 셋으로 가르며 자른 면을 서로 `RUNE_GAP_DEGREES`(1.6°)씩 물려 둔다 —
가방·액자에서 조각 하나가 「조각」으로 읽히게 하려는 틈이다. 그런데 정보창에서 세 칸을 다 채우면
그 틈이 그대로 남아 하트 위에 가는 검은 금 세 줄로 보였다(응태, 2026-11-16).

원본 하트는 저장소에 없으므로(구운 뒤 지운다) 이미 구운 조각에서 거꾸로 메운다:
조각을 가운데 점 둘레로 ±(틈 + 겹침)만큼 돌린 사본을 아래에 깔아 틈을 제 색으로 채우고,
하트 실루엣 밖으로 삐져나온 몫은 잘라 낸다. 이웃 조각과 `OVERLAP_DEGREES`만큼 겹쳐 이음매에
반투명 경계가 남지 않는다. 결과는 `{등급}-{번호}-seat.webp`이고 정보창의 끼운 칸만 쓴다.

조각(`prepare_icons.py`)을 다시 구우면 이 스크립트도 다시 돌린다.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops

PUBLIC = Path(__file__).resolve().parent.parent / "public"
RUNES = PUBLIC / "sprites/runes"
RARITIES = ("uncommon", "rare", "epic", "legendary")
# `prepare_icons.py`와 같은 값이어야 한다.
RUNE_CENTER_Y = 0.44
GAP_DEGREES = 1.6
# 이웃 조각을 넘어 겹치는 각도. 0이면 경계의 반투명 픽셀 둘이 포개져 가는 선이 남는다.
OVERLAP_DEGREES = 0.5
# 빈 자리 조각은 알파를 이만큼 눌러 구웠다(`socket`).
SOCKET_ALPHA = 0.62


def rotate(image: Image.Image, degrees: float) -> Image.Image:
    size = image.width
    return image.rotate(degrees, resample=Image.BICUBIC, center=(size / 2, size * RUNE_CENTER_Y))


def main() -> None:
    # 조각은 제 틈(1.6°)을 건너 이웃 쪽으로 겹침만큼 더 나간다.
    turn = GAP_DEGREES + OVERLAP_DEGREES
    # 실루엣: 세 조각의 합. 틈은 양쪽으로 돌린 합의 **교집합**으로만 메워 바깥 윤곽은 늘리지 않는다.
    union = Image.new("L", (1, 1))
    for index in range(3):
        alpha = Image.open(RUNES / f"empty-{index}.webp").convert("RGBA").getchannel("A")
        union = alpha if index == 0 else ImageChops.lighter(union, alpha)
    # 틈 전체(1.6° × 2)를 넘게 돌려야 두 사본이 틈 안에서 함께 겹친다.
    close = GAP_DEGREES * 2 + OVERLAP_DEGREES
    closed = ImageChops.lighter(union, ImageChops.darker(rotate(union, close), rotate(union, -close)))
    silhouette = closed.point(lambda value: min(255, round(value / SOCKET_ALPHA)))
    for rarity in RARITIES:
        for index in range(3):
            piece = Image.open(RUNES / f"{rarity}-{index}.webp").convert("RGBA")
            seat = Image.new("RGBA", piece.size, (0, 0, 0, 0))
            seat.alpha_composite(rotate(piece, turn))
            seat.alpha_composite(rotate(piece, -turn))
            seat.alpha_composite(piece)
            seat.putalpha(ImageChops.darker(seat.getchannel("A"), silhouette))
            target = RUNES / f"{rarity}-{index}-seat.webp"
            seat.save(target, "WEBP", quality=92, method=6)
            print(f"{target.relative_to(PUBLIC)}  {target.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
