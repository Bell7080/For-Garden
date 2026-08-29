"""
스킬 일러스트 원본을 게임이 쓰는 WebP로 굽는다.

    python3 scripts/prepare_skill_icons.py [원본 폴더]

원본은 검은 판 위에 흰 실루엣으로 그린 정사각 그림이다. 판때기째 넣으면 화면의 칩 안에
또 하나의 검은 사각형이 앉아 두 겹으로 보이므로, **밝기를 그대로 알파로 옮겨** 실루엣만
남긴다. 색은 넣지 않는다 — 속성·직군을 섞은 은은한 색은 화면이 tint 한 번으로 입히고,
그래야 캐릭터가 늘어도 색 규칙이 코드 한 곳에만 남는다.

원본은 저장소에 남기지 않는다. 다시 구울 일이 생기면 원본을 폴더에 두고 이 스크립트를
그 폴더로 다시 돌린다. 파일 이름 규칙(`char{번호}skill_{자리}`)만 지키면 표를 고칠 일이 없다.
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else PUBLIC

# 원본 이름 머리말과 렐릭 id. Puppet 묶음(char_00N.zip · enemy_00N.zip)과 같은 번호를 쓴다.
RELICS = {
    "char001": "anky",
    "char002": "rex",
    "char003": "spino",
    "char004": "luka",
    "char005": "dodo",
    "char006": "mette",
    # 적도 같은 파이프라인을 쓴다. 원본 이름의 머리말만 다르고(enemy00N) 나머지 규칙은 같다.
    "enemy001": "husk-raptor",
    "enemy002": "husk-shell",
    "enemy003": "husk-wing",
    # 원정 최종층 단독 보스는 번호 대신 렐릭 id를 그대로 원본 이름 머리말로 쓴다.
    "pontos": "pontos",
}

# 원본의 자리 번호와 스킬 칸. 1 패시브 · 2 일반 공격 · 3 궁극기 · 4 폭주(야성 발현) 순이다.
SLOTS = {1: "passive", 2: "basic", 3: "ultimate", 4: "ferocity"}

# 화면에서 쓰는 가장 큰 크기의 두 배로 굽는다. 더 키우면 파일만 커지고 눈에 보이지 않는다.
SIZE = 256

# 그림이 칸을 채우는 비율. 원본은 사방에 여백이 넓어 그대로 줄이면 칩 안에서 혼자 작아 보인다.
FILL = 0.92


def silhouette(image: Image.Image) -> Image.Image:
    """밝기를 알파로 옮겨 흰 실루엣만 남긴다. 가장자리의 흐린 부분이 그대로 반투명이 된다."""
    gray = image.convert("L")
    # 바탕색은 그림마다 조금씩 다르다(28~43). 테두리 네 줄의 **가운뎃값**을 바탕으로 본다 —
    # 그림이 테두리에 닿는 원본이 있어 가장 밝은 값을 쓰면 그림 전체가 바탕으로 지워진다.
    edge = sorted(
        list(gray.crop((0, 0, gray.width, 1)).getdata())
        + list(gray.crop((0, gray.height - 1, gray.width, gray.height)).getdata())
        + list(gray.crop((0, 0, 1, gray.height)).getdata())
        + list(gray.crop((gray.width - 1, 0, gray.width, gray.height)).getdata())
    )
    floor = edge[len(edge) // 2] + 10
    span = max(1, 245 - floor)
    alpha = gray.point(lambda value: 0 if value <= floor else min(255, round((value - floor) * 255 / span)))
    white = Image.new("RGBA", image.size, (255, 255, 255, 255))
    white.putalpha(alpha)
    return white


def framed(art: Image.Image) -> Image.Image:
    """실루엣을 정사각 칸 가운데에 같은 비율로 앉힌다. 그림마다 여백이 다르면 크기가 들쭉날쭉해진다."""
    box = art.getbbox()
    if box is None:
        raise ValueError("빈 그림이다")
    cropped = art.crop(box)
    side = max(cropped.width, cropped.height)
    inner = round(SIZE * FILL)
    scaled = cropped.resize((max(1, round(cropped.width * inner / side)), max(1, round(cropped.height * inner / side))), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 0))
    canvas.paste(scaled, ((SIZE - scaled.width) // 2, (SIZE - scaled.height) // 2))
    return canvas


def exists(stem: str, slot: int) -> bool:
    """굽지 않은 원본이 남아 있는지만 본다."""
    return any((SOURCE / f"{stem}skill_{slot:03d}{suffix}").exists() for suffix in (".png", ".jpeg", ".jpg", ".webp"))


def find(stem: str, slot: int) -> Path:
    """원본 확장자는 올린 사람마다 다르다(png·jpeg). 이름으로만 찾고 확장자는 묻지 않는다."""
    for suffix in (".png", ".jpeg", ".jpg", ".webp"):
        path = SOURCE / f"{stem}skill_{slot:03d}{suffix}"
        if path.exists():
            return path
    raise FileNotFoundError(f"원본을 찾지 못했다: {stem}skill_{slot:03d}")


def main() -> None:
    for stem, relic in RELICS.items():
        # 원본은 구운 뒤 저장소에서 지운다. 그래서 이미 구운 개체는 원본이 없는 것이 정상이고,
        # 그때는 조용히 건너뛴다 — 없다고 멈추면 새로 올린 개체 하나를 굽지 못한다.
        if not any(exists(stem, slot) for slot in SLOTS):
            print(f"{stem}: 원본 없음 — 건너뜀")
            continue
        for slot, name in SLOTS.items():
            source = find(stem, slot)
            target = PUBLIC / "sprites" / "skills" / relic / f"{name}.webp"
            target.parent.mkdir(parents=True, exist_ok=True)
            framed(silhouette(Image.open(source).convert("RGB"))).save(target, "WEBP", quality=92, method=6)
            print(f"{source.name} -> {target.relative_to(PUBLIC)}")


if __name__ == "__main__":
    main()
