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
ARGS = [value for value in sys.argv[1:] if not value.startswith("--")]
SOURCE = Path(ARGS[0]) if ARGS else PUBLIC

# 원본 이름 머리말과 렐릭 id. Puppet 묶음(char_00N.zip · enemy_00N.zip)과 같은 번호를 쓴다.
RELICS = {
    "char001": "anky",
    "char002": "rex",
    "char003": "spino",
    "char004": "luka",
    "char005": "dodo",
    "char006": "mette",
    "char007": "stella",
    "char008": "tia",
    "char009": "meron",
    "char010": "pachi",
    "char011": "maki",
    "char012": "keris",
    "char013": "delopi",
    "char014": "nodonia",
    "char015": "ella",
    "char016": "deina",
    # 적도 같은 파이프라인을 쓴다. 원본 이름의 머리말만 다르고(enemy00N) 나머지 규칙은 같다.
    "enemy001": "toby",
    "enemy002": "amo",
    "enemy003": "ripa",
    # 원정 최종층 단독 보스는 번호 대신 렐릭 id를 그대로 원본 이름 머리말로 쓴다.
    "pontos": "pontos",
}

# 적 정보창의 **역할** 아이콘. 원본 이름은 `:{번호}.png`이고 번호는 잡졸부터 불사까지의 순서다.
# 스킬 일러스트와 같은 흰 실루엣이라 같은 규칙으로 굽고, 색은 화면이 역할 뱃지의 tint로 입힌다.
# 이름은 `src/ui/encounterRolePresentation.ts`의 `ENCOUNTER_ROLE_ICON_ASSETS`와 같아야 한다.
ENCOUNTER_ROLES = {1: "normal", 2: "swarm", 3: "elite", 4: "boss", 5: "endless"}

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


# 그림의 **테두리 고리**가 차 있는지 보는 값.
#
# 고리는 캔버스 변이 아니라 **그림이 실제로 차지한 상자**(alpha 경계)의 가장 바깥 두 줄이다 —
# 굽는 단계가 그림을 잘라 가운데에 앉히므로 캔버스 변에는 어느 아이콘이든 빈 여백이 남고,
# 거기서 재면 모두 0이 되어 아무것도 드러나지 않는다.
#
# 가운데로 모인 모티프는 이 고리에 **몇 점만 닿는다**(0.4~19.4). 사방이 꽉 찬 그림만 크게
# 나오고, 그런 그림은 액자 안에서 그림이 아니라 **네모난 판**으로 읽힌다 — 실제로 케리스
# 궁극기가 81.2로 혼자 네 배 높았고, 다른 아이콘이 전부 자유로운 실루엣인 사이에서 그 칸만
# 사각 블록으로 보였다.
RING = 2
RING_LIMIT = 40


def edge_load(icon: Image.Image) -> float:
    """그림 상자의 가장 바깥 두 줄 평균 알파. 값이 크면 그림의 윤곽이 곧 그 사각형이라는 뜻이다."""
    alpha = icon.split()[3]
    box = alpha.getbbox()
    if box is None:
        return 0.0
    left, top, right, bottom = box
    pieces = [
        alpha.crop((left, top, right, top + RING)),
        alpha.crop((left, bottom - RING, right, bottom)),
        alpha.crop((left, top + RING, left + RING, bottom - RING)),
        alpha.crop((right - RING, top + RING, right, bottom - RING)),
    ]
    values = [value for piece in pieces for value in piece.getdata()]
    return sum(values) / len(values) if values else 0.0


def audit() -> int:
    """
    이미 구운 아이콘이 **한 식구로 읽히는지** 검수한다.

        python3 scripts/prepare_skill_icons.py --audit

    원본이 저장소에 남지 않으므로 잘못 그려진 그림은 구운 뒤에야 드러난다. 여기서 재는 것은
    하나뿐이다 — **그림의 윤곽이 곧 사각형인가.** 다른 아이콘은 가운데로 모인 모티프라 상자
    테두리에 몇 점만 닿는데, 사방이 찬 그림은 네모난 판으로 읽혀 혼자 양식이 다르다.
    고치는 방법은 이 스크립트가 아니라 **원본을 사방 여백이 있게 다시 그려 다시 굽는 것**이다 —
    여기서 기계로 가장자리를 흐리면 그 그림만 바깥 내용이 함께 지워진다.
    """
    bad: list[str] = []
    for path in sorted((PUBLIC / "sprites" / "skills").glob("*/*.webp")):
        load = edge_load(Image.open(path).convert("RGBA"))
        name = f"{path.parent.name}/{path.stem}"
        if load > RING_LIMIT:
            bad.append(name)
        print(f"{name:20} 테두리 {load:6.1f}{'  ← 윤곽이 사각형이다' if load > RING_LIMIT else ''}")
    print("\n" + (f"다시 그려야 하는 그림: {', '.join(bad)}" if bad else "모두 가운데로 모인 모티프다."))
    return 1 if bad else 0


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


def bake_encounter_roles() -> None:
    """역할 아이콘을 굽는다. 원본은 구운 뒤 저장소에서 지우므로, 없으면 조용히 건너뛴다."""
    for number, role in ENCOUNTER_ROLES.items():
        source = SOURCE / f":{number}.png"
        if not source.exists():
            continue
        target = PUBLIC / "sprites" / "encounter-roles" / f"{role}.webp"
        target.parent.mkdir(parents=True, exist_ok=True)
        framed(silhouette(Image.open(source).convert("RGB"))).save(target, "WEBP", quality=92, method=6)
        print(f"{source.name} -> {target.relative_to(PUBLIC)}")


def main() -> None:
    if "--audit" in sys.argv[1:]:
        raise SystemExit(audit())
    bake_encounter_roles()
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
