"""배경 원화를 화면에 쓰는 WebP로 굽는다.

원본 PNG는 한 장에 10MB에 가까워 그대로 올리면 첫 로딩이 통째로 그만큼 늘어난다. 크기는
건드리지 않고(화면이 cover로 맞춘다) 압축만 바꾼다. 구운 뒤 원본은 저장소에서 지운다 —
`public/`에 남겨 두면 빌드 결과에 원본까지 그대로 실린다.

    python3 scripts/prepare_backgrounds.py

이름 규칙만 지키면 표를 고칠 일이 없다: `public/background_00N.png` → 같은 번호의 WebP.
"""
from pathlib import Path
import sys

from PIL import Image

PUBLIC = Path(__file__).resolve().parent.parent / "public"
TARGET = PUBLIC / "sprites" / "background"
QUALITY = 84


def main() -> None:
    sources = sorted(PUBLIC.glob("background_*.png"))
    if not sources:
        print("구울 원본이 없다. public/background_00N.png를 올린 뒤 다시 실행한다.")
        return
    TARGET.mkdir(parents=True, exist_ok=True)
    for source in sources:
        target = TARGET / f"{source.stem}.webp"
        Image.open(source).convert("RGB").save(target, "WEBP", quality=QUALITY, method=6)
        print(f"{source.name} -> {target.relative_to(PUBLIC)} ({target.stat().st_size // 1024}KB)")
        source.unlink()


if __name__ == "__main__":
    sys.exit(main())
