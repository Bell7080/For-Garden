"""배경 원화를 화면에 쓰는 WebP로 굽는다.

원본 PNG는 한 장에 10MB에 가까워 그대로 올리면 첫 로딩이 통째로 그만큼 늘어난다. 크기는
건드리지 않고(화면이 cover로 맞춘다) 압축만 바꾼다. 구운 뒤 원본은 저장소에서 지운다 —
`public/`에 남겨 두면 빌드 결과에 원본까지 그대로 실린다.

    python3 scripts/prepare_backgrounds.py

이름 규칙만 지키면 표를 고칠 일이 없다: `public/background_00N.png` → 같은 번호의 WebP.

화면 배경이 아닌 콘텐츠 원화(`public/ContentN_00M.png` — 출격 진입 버튼 일러스트 등)도 같은
이유로 여기서 굽는다. 이쪽은 `sprites/background`가 아니라 `public/` 바로 아래에 같은 이름의
WebP로 남는다. 로딩 표(`scenes/loadingSteps.ts`)가 그 경로를 그대로 읽기 때문이다.
"""
from pathlib import Path
import sys

from PIL import Image

PUBLIC = Path(__file__).resolve().parent.parent / "public"
TARGET = PUBLIC / "sprites" / "background"
QUALITY = 84


def bake(source: Path, target: Path) -> None:
    """크기는 그대로 두고 압축만 바꾼 뒤 원본을 지운다."""
    target.parent.mkdir(parents=True, exist_ok=True)
    Image.open(source).convert("RGB").save(target, "WEBP", quality=QUALITY, method=6)
    print(f"{source.name} -> {target.relative_to(PUBLIC)} ({target.stat().st_size // 1024}KB)")
    source.unlink()


def main() -> None:
    backgrounds = sorted(PUBLIC.glob("background_*.png"))
    contents = sorted(PUBLIC.glob("Content*.png"))
    if not backgrounds and not contents:
        print("구울 원본이 없다. public/background_00N.png 또는 public/ContentN_00M.png를 올린 뒤 다시 실행한다.")
        return
    for source in backgrounds:
        bake(source, TARGET / f"{source.stem}.webp")
    for source in contents:
        bake(source, PUBLIC / f"{source.stem}.webp")


if __name__ == "__main__":
    sys.exit(main())
