"""
이미 구운 언어 글꼴 서브셋에 **빠진 글자만 더해 넣는다.**

    npm pack @fontsource/line-seed-jp && tar xzf fontsource-line-seed-jp-*.tgz
    python3 scripts/patch_font_glyphs.py ja package/files

같은 방법으로 `zh-Hans`(@fontsource/noto-sans-sc)·`zh-Hant`(@fontsource/noto-sans-tc)·
`vi`(@fontsource/be-vietnam-pro)도 굽는다. 구운 파일이 아직 없으면 라틴 조각 하나로 뼈대부터 세운다.

`prepare_fonts.py`는 원본 글꼴(TTF/OTF)로 서브셋을 **처음부터** 다시 굽는다. 그런데 원본은
저장소에 두지 않으므로(CJK 한 벌이 60~230MB) 번역에 새 글자가 들어올 때마다 원본을 구해야
하고, 구하지 못하면 번역을 그 글자를 피해 고쳐 쓰게 된다 — 뜻이 흐려지는 쪽으로.

이 스크립트는 같은 글꼴을 **npm으로 배포되는 판(Fontsource)** 에서 읽어, 지금 서브셋에 없는
글자의 모양만 옮겨 붙인다. 이미 있는 글자는 건드리지 않으므로 화면에 서 있던 글자가 바뀌지
않는다. Fontsource 판은 같은 LINE Seed JP(SIL OFL 1.1)이고, 실측으로 원본과 굵기별 윤곽 경계·
면적이 0.1% 안에서 같다(곡선을 적는 방식만 다르다). 원본을 다시 구하면 `prepare_fonts.py`로
처음부터 굽는 것이 여전히 정식 경로다.

Fontsource는 한 굵기를 유니코드 구간별 조각 수십 개로 나눠 배포하므로, 글자마다 그 글자를
가진 조각을 찾아 거기서 꺼낸다. 이름·세로 지표는 이미 구운 파일의 것을 그대로 둔다.
"""
import sys
from pathlib import Path

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fontTools import subset  # noqa: E402

from prepare_fonts import ALWAYS, PUBLIC_FONTS, SOURCES, stamp, used_characters  # noqa: E402

# 게임의 역할 굵기 → Fontsource 파일 이름의 굵기. `prepare_fonts.py`의 SOURCES와 같은 짝이다
# (500 = LINE Seed JP Regular, 700 = Bold, 800 = ExtraBold).
#
# 중국어 둘은 Source Han Sans의 Normal·Bold·Heavy에 가장 가까운 Noto 굵기(400·700·900)를, 베트남어는
# 이름 그대로의 Medium·Bold·ExtraBold를 쓴다.
FONTSOURCE_WEIGHT = {
    "ja": {500: 400, 700: 700, 800: 800},
    "zh-Hans": {500: 400, 700: 700, 800: 900},
    "zh-Hant": {500: 400, 700: 700, 800: 900},
    "vi": {500: 500, 700: 700, 800: 800},
}

# 조각 파일 이름의 머리말.
FONTSOURCE_PREFIX = {
    "ja": "line-seed-jp",
    "zh-Hans": "noto-sans-sc",
    "zh-Hant": "noto-sans-tc",
    "vi": "be-vietnam-pro",
}


def is_hangul(code: int) -> bool:
    return 0xAC00 <= code <= 0xD7A3 or 0x1100 <= code <= 0x11FF or 0x3130 <= code <= 0x318F


def load_chunks(folder: Path, prefix: str, weight: int) -> list[TTFont]:
    chunks = sorted(folder.glob(f"{prefix}-*-{weight}-normal.woff2"))
    if not chunks:
        raise SystemExit(f"{folder}에 {prefix} {weight} 조각이 없다")
    return [TTFont(path) for path in chunks]


def copy_glyph(source: TTFont, source_name: str) -> tuple:
    """조합 글리프도 풀어 윤곽 하나로 옮긴다 — 조합의 부품 이름은 대상 글꼴에 없을 수 있다."""
    glyph_set = source.getGlyphSet()
    recording = DecomposingRecordingPen(glyph_set)
    glyph_set[source_name].draw(recording)
    pen = TTGlyphPen(None)
    recording.replay(pen)
    return pen.glyph(), source["hmtx"][source_name][0]


def seed(language: str, folder: Path, weight: int, source_weight: int, target_path: Path) -> None:
    """아직 구운 파일이 없는 언어는 라틴 글자를 가진 조각 하나로 빈 뼈대를 세운다.

    원본 글꼴이 손에 없을 때의 첫 굽기다. 뼈대에는 공용 기호만 남기고, 번역에 실제로 있는 글자는
    이어지는 `patch`가 조각마다 찾아 붙인다 — 그래서 이름·세로 지표 규칙은 `prepare_fonts.py`와 같다.
    """
    family, _, _, _ = SOURCES[language]
    chunks = load_chunks(folder, FONTSOURCE_PREFIX[language], source_weight)
    base = next((chunk for chunk in chunks if ord("A") in chunk.getBestCmap()), None)
    if base is None:
        raise SystemExit(f"{folder}: 라틴 글자를 가진 {FONTSOURCE_PREFIX[language]} 조각이 없다")
    options = subset.Options()
    options.layout_features = ["kern", "liga", "ccmp", "mark", "mkmk"]
    options.drop_tables += ["vhea", "vmtx", "VORG", "STAT", "BASE"]
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.notdef_outline = True
    options.recalc_bounds = True
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=[ord(ch) for ch in ALWAYS if ord(ch) in base.getBestCmap()])
    subsetter.subset(base)
    stamp(base, family, weight)
    base.flavor = "woff2"
    base.save(target_path)
    print(f"  {target_path.name}: 뼈대를 세웠다")


def patch(language: str, folder: Path) -> None:
    _, slug, _, _ = SOURCES[language]
    # 한글은 공용 글꼴(NEXON Kart)이 스택 맨 앞에서 그리므로 언어 글꼴에 넣지 않는다 — 번역 표의
    # 주석에 섞인 한글이 여기 걸려 "원본에 없다"로 쏟아지지 않게 걸러 둔다.
    wanted = {ord(ch) for ch in used_characters(language) | ALWAYS if ord(ch) > 0x20 and not is_hangul(ord(ch))}
    for weight, source_weight in FONTSOURCE_WEIGHT[language].items():
        target_path = PUBLIC_FONTS / f"{slug}-{weight}.woff2"
        if not target_path.is_file():
            seed(language, folder, weight, source_weight, target_path)
        target = TTFont(target_path)
        cmap = target.getBestCmap()
        missing = sorted(code for code in wanted if code not in cmap)
        if not missing:
            print(f"  {target_path.name}: 빠진 글자 없음")
            continue
        chunks = load_chunks(folder, FONTSOURCE_PREFIX[language], source_weight)
        order = list(target.getGlyphOrder())
        added: list[str] = []
        for code in missing:
            source = next((chunk for chunk in chunks if code in chunk.getBestCmap()), None)
            if source is None:
                print(f"  {target_path.name}: {chr(code)} (U+{code:04X}) 원본에도 없다 — 대체 글꼴로 선다")
                continue
            glyph, advance = copy_glyph(source, source.getBestCmap()[code])
            name = f"uni{code:04X}"
            while name in target["glyf"].glyphs:
                name += ".add"
            order.append(name)
            target.setGlyphOrder(order)
            target["glyf"].glyphOrder = order
            target["glyf"][name] = glyph
            glyph.recalcBounds(target["glyf"])
            target["hmtx"][name] = (advance, getattr(glyph, "xMin", 0))
            for table in target["cmap"].tables:
                if table.isUnicode():
                    table.cmap[code] = name
            added.append(chr(code))
        target.flavor = "woff2"
        target.save(target_path)
        print(f"  {target_path.name}: +{len(added)}자 {''.join(added)}  ({target_path.stat().st_size / 1024:.0f}KB)")


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    language, folder = sys.argv[1], Path(sys.argv[2])
    if language not in FONTSOURCE_WEIGHT:
        raise SystemExit(f"{language}: Fontsource 짝이 정해지지 않았다 — FONTSOURCE_WEIGHT에 더한다")
    patch(language, folder)


if __name__ == "__main__":
    main()
