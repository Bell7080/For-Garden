"""배경 원화를 화면에 쓰는 WebP로 굽는다.

원본 PNG는 한 장에 10MB에 가까워 그대로 올리면 첫 로딩이 통째로 그만큼 늘어난다. 크기는
건드리지 않고(화면이 cover로 맞춘다) 압축만 바꾼다. 구운 뒤 원본은 저장소에서 지운다 —
`public/`에 남겨 두면 빌드 결과에 원본까지 그대로 실린다.

    python3 scripts/prepare_backgrounds.py

이름 규칙만 지키면 표를 고칠 일이 없다: `public/background_00N.png` → 같은 번호의 WebP.
**원본이 JPEG로 올 때도 같다** — 아트가 어느 형식으로 오는지는 그때그때 다른데, 확장자 하나
때문에 스크립트가 그 그림을 못 보고 지나가면 원본이 저장소에 그대로 남아 빌드에 실린다.

화면 배경이 아닌 콘텐츠 원화(`public/ContentN_00M.png` — 출격 진입 버튼 일러스트 등)도 같은
이유로 여기서 굽는다. 이쪽은 `sprites/background`가 아니라 `sprites/content`에 같은 이름의
WebP로 남는다. 다른 원화 스프라이트처럼 `public/` 바로 아래를 비워 두기 위해서다.

교류 도시 원화(`public/교류 배경00N.png`)는 세로 배경이 아니라 **판 안에 잘려 들어가는 가로
그림**이라 이름만 `interaction_00N.webp`로 바꿔 굽는다. 아트 파일이 한글 이름으로 오므로 그
이름을 그대로 키로 쓰지 않는다 — 경로에 한글이 섞이면 배포 URL 인코딩이 환경마다 갈린다.
"""
from pathlib import Path
import sys

from PIL import Image

PUBLIC = Path(__file__).resolve().parent.parent / "public"
BACKGROUND_TARGET = PUBLIC / "sprites" / "background"
CONTENT_TARGET = PUBLIC / "sprites" / "content"
QUALITY = 84


def bake(source: Path, target: Path) -> None:
    """크기는 그대로 두고 압축만 바꾼 뒤 원본을 지운다."""
    target.parent.mkdir(parents=True, exist_ok=True)
    Image.open(source).convert("RGB").save(target, "WEBP", quality=QUALITY, method=6)
    print(f"{source.name} -> {target.relative_to(PUBLIC)} ({target.stat().st_size // 1024}KB)")
    source.unlink()


def main() -> None:
    # 원본은 `public/` 바로 아래에 올리는 것이 규칙이지만, **구운 결과가 사는 폴더에 그대로
    # 떨어뜨리는 일이 잦다**(아트를 교체할 때 기존 WebP 옆에 새 PNG를 놓는다). 두 자리를 모두
    # 훑어 같은 규칙으로 굽는다 — 한 자리만 보면 PNG가 그대로 저장소에 남고 빌드에 실려 나간다.
    def sources(folder: Path, stem: str) -> set[Path]:
        return {path for suffix in ("png", "jpg", "jpeg") for path in folder.glob(f"{stem}.{suffix}")}

    backgrounds = sorted(sources(PUBLIC, "background_*") | sources(BACKGROUND_TARGET, "*"))
    contents = sorted(sources(PUBLIC, "Content*") | sources(CONTENT_TARGET, "*"))
    interactions = sorted(sources(PUBLIC, "교류 배경*") | sources(BACKGROUND_TARGET, "교류 배경*"))
    strata_base = sorted(sources(PUBLIC, "발굴판 뒷배경") | sources(BACKGROUND_TARGET, "발굴판 뒷배경"))
    # 뒷배경도 "발굴판 *"에 걸리므로 겉장 목록은 **번호로 시작하는 것만** 본다. 함께 구우면
    # 무작위로 뽑히는 겉장이 다섯 장이 되어 아래층이 겉장으로 한 번씩 깔린다.
    strata_layers = sorted(sources(PUBLIC, "발굴판 [0-9]*") | sources(BACKGROUND_TARGET, "발굴판 [0-9]*"))
    if not backgrounds and not contents and not interactions and not strata_base and not strata_layers:
        print("구울 원본이 없다. public/background_00N.png 또는 public/ContentN_00M.png를 올린 뒤 다시 실행한다.")
        return
    for source in backgrounds:
        bake(source, BACKGROUND_TARGET / f"{source.stem}.webp")
    for source in contents:
        bake(source, CONTENT_TARGET / f"{source.stem}.webp")
    for source in interactions:
        number = "".join(ch for ch in source.stem if ch.isdigit()) or "001"
        bake(source, BACKGROUND_TARGET / f"interaction_{number.zfill(3)}.webp")
    for source in strata_base:
        bake(source, BACKGROUND_TARGET / "strata_base.webp")
    for source in strata_layers:
        number = "".join(ch for ch in source.stem if ch.isdigit()) or "1"
        bake(source, BACKGROUND_TARGET / f"strata_layer_{number.zfill(3)}.webp")


if __name__ == "__main__":
    sys.exit(main())
