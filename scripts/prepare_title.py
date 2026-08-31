"""타이틀 화면 원화(배경·로고)와 5대 스쿼드 엠블럼 원본을 게임이 쓰는 WebP로 굽는다.

    python3 scripts/prepare_title.py

원본은 저장소에 남기지 않는다. 다시 구울 일이 생기면 원본을 public/ 아래에 두고
이 표만 갱신한다.
"""
from pathlib import Path

from PIL import Image

PUBLIC = Path(__file__).resolve().parent.parent / "public"
BACKGROUND_TARGET = PUBLIC / "sprites" / "background"
UI_TARGET = PUBLIC / "sprites" / "ui"
FACTION_TARGET = PUBLIC / "sprites" / "factions"

# 타이틀 배경 원화. background_00N 다음 번호(011)를 그대로 이어 backgrounds.ts 표와 맞춘다.
TITLE_BACKGROUND = PUBLIC / "BF5D7DD8-A449-4002-AC55-67007E11059D.png"
TITLE_BACKGROUND_TARGET = BACKGROUND_TARGET / "background_011.webp"

# 타이틀 로고타입. 흰 실루엣 + 알파라 배경 원화 위에 그대로 얹는다.
TITLE_LOGOTYPE = PUBLIC / "titlename.png"
TITLE_LOGOTYPE_TARGET = UI_TARGET / "titlename.webp"

# docs/factions.md의 "이터널 시티 5대 자치 스쿼드" 순서와 1:1로 대응한다.
FACTIONS = {
    "1.png": "fang",    # 앱솔루트 팽 (Absolute Fang)
    "2.png": "gear",    # 나이트 기어 (Night Gear)
    "3.png": "eye",     # 시그널 아이 (Signal Eye)
    "4.png": "rune",    # 사일런트 룬 (Silent Rune)
    "5.png": "rogue",   # 쁘띠 로그 (Petit Rogue)
}
# 화면에서 쓰는 가장 큰 크기의 두 배로 굽는다. 원본은 얇은 선화라 과하게 줄이지 않는다.
FACTION_SIZE = 512


def bake_background(source: Path, target: Path) -> None:
    """크기는 그대로 두고 압축만 바꾼다(cover 배치는 화면이 맡는다)."""
    target.parent.mkdir(parents=True, exist_ok=True)
    Image.open(source).convert("RGB").save(target, "WEBP", quality=84, method=6)
    print(f"{source.name} -> {target.relative_to(PUBLIC)} ({target.stat().st_size // 1024}KB)")
    source.unlink()


def bake_alpha(source: Path, target: Path, size: int | None = None) -> None:
    """알파를 보존한 채 굽는다. 로고·엠블럼처럼 투명 배경 위에 얹는 그림용이다."""
    target.parent.mkdir(parents=True, exist_ok=True)
    image = Image.open(source).convert("RGBA")
    if size is not None:
        image = image.resize((size, size), Image.LANCZOS)
    image.save(target, "WEBP", quality=92, method=6)
    print(f"{source.name} -> {target.relative_to(PUBLIC)} ({target.stat().st_size // 1024}KB)")
    source.unlink()


def main() -> None:
    if TITLE_BACKGROUND.exists():
        bake_background(TITLE_BACKGROUND, TITLE_BACKGROUND_TARGET)
    if TITLE_LOGOTYPE.exists():
        bake_alpha(TITLE_LOGOTYPE, TITLE_LOGOTYPE_TARGET)
    for name, slug in FACTIONS.items():
        source = PUBLIC / name
        if source.exists():
            bake_alpha(source, FACTION_TARGET / f"{slug}.webp", FACTION_SIZE)


if __name__ == "__main__":
    main()
