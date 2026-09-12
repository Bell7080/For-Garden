"""
언어별 글꼴 원본을 게임이 쓰는 woff2 서브셋으로 굽는다.

    python3 scripts/prepare_fonts.py <원본 폴더>

원본은 저장소에 남기지 않는다. CJK 원본 한 벌이 60~230MB라 그대로 두면 clone이 그만큼 무거워지고,
어차피 화면에 나오는 글자는 그중 일부뿐이다.

## 왜 서브셋인가

Noto Sans SC 원본은 17MB, LINE Seed TW는 75MB다. 그대로 올리면 그 언어를 고른 사람은 게임을 보기
전에 그만큼을 내려받는다. **실제로 쓰는 글자만** 남기면 보통 수백 KB로 떨어진다.

그래서 이 스크립트는 번역 원문(`src/i18n/<언어>/`)을 읽어 거기 실제로 있는 글자만 남긴다.
번역이 아직 없는 언어는 구울 것이 없으므로 건너뛴다 — 쓰지도 않을 글자를 미리 굽지 않는다.
번역이 늘면 다시 돌린다. 글자가 빠지면 그 글자만 대체 글꼴로 보이므로 **번역을 고칠 때마다 함께
돌려야 한다.**

## 왜 이름을 바꾸는가

LINE Seed TW와 Source Han Sans는 OFL의 예약 폰트 이름(Reserved Font Name)을 선언한다. 서브셋은
개작이므로 원래 이름을 그대로 쓸 수 없다. 그래서 구운 결과에는 `src/ui/fonts.ts`의
`SCRIPT_FONTS`가 부르는 이름을 새로 새긴다. 두 표의 이름이 어긋나면 브라우저가 글꼴을 찾지 못한다.

## 왜 세로 지표를 맞추는가

원본마다 어센더·디센더가 다르다(NEXON Kart 800/-200, LINE Seed 1152/-458, Source Han Sans
1160/-288). 그대로 두면 같은 px로 세운 글줄의 높이가 언어마다 달라져, 세로 좌표를 쌓아 올리는
배치표들이 언어를 바꿀 때마다 밀린다. 그래서 구울 때 공용 글꼴과 같은 값으로 새겨 둔다.

## 라이선스

전부 무료 상업 이용이며, 구운 파일 옆에 `public/fonts/LICENSES.md`로 고지를 남긴다.
"""
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_FONTS = ROOT / "public" / "fonts"
I18N = ROOT / "src" / "i18n"
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else PUBLIC_FONTS

# 공용 글꼴(NEXON Kart)의 세로 지표. 모든 언어 글꼴을 여기에 맞춰 글줄 높이를 하나로 만든다.
# 값을 바꾸면 배치표가 통째로 흔들리므로 NEXON Kart를 교체할 때만 함께 고친다.
COMMON_METRICS = {
    "ascent": 800, "descent": -200, "lineGap": 0,
    "typoAscender": 800, "typoDescender": -200, "typoLineGap": 0,
    # 글자가 잘리지 않도록 잉크 범위(한자 최대 ~930/-120)보다 넉넉하게 둔다.
    "winAscent": 1100, "winDescent": 450,
}

# 역할별 굵기 → src/ui/fonts.ts의 FONT_WEIGHT와 같아야 한다.
WEIGHTS = (500, 700, 800)

# 언어 → (가족 이름, 파일 머리말, 굵기별 원본). 이름·머리말은 `SCRIPT_FONTS`와 정확히 같아야 한다.
#
# 굵기는 이름이 아니라 **획 두께 실측**으로 골랐다. NEXON Kart의 획/대문자높이 비율이
# 0.109 / 0.141 / 0.171이고, 그에 가장 가깝게 맞춘 것이 아래 조합이다. 이름만 보고 Bold끼리
# 맞추면 언어마다 굵기가 어긋난다.
SOURCES = {
    "ja": ("FG Sans JP", "fg-jp", {
        500: "LINESeedJP_TTF_Rg.ttf",   # 획/H 0.115
        700: "LINESeedJP_TTF_Bd.ttf",   # 획/H 0.184
        800: "LINESeedJP_TTF_Eb.ttf",   # 획/H 0.254
    }, "LINE Seed JP — LY Corporation, SIL OFL 1.1"),
    "zh-Hant": ("FG Sans TC", "fg-tc", {
        500: "LINESeedTW_TTF_Rg.ttf",
        700: "LINESeedTW_TTF_Bd.ttf",
        800: "LINESeedTW_TTF_Eb.ttf",
    }, "LINE Seed TW — LY Corporation, SIL OFL 1.1 (예약 이름 'LINE Seed TW')"),
    "zh-Hans": ("FG Sans SC", "fg-sc", {
        500: "SourceHanSansSC-Normal.otf",  # 획/H 0.113
        700: "SourceHanSansSC-Bold.otf",    # 획/H 0.200
        800: "SourceHanSansSC-Heavy.otf",   # 획/H 0.240
    }, "Source Han Sans SC — Adobe, SIL OFL 1.1 (예약 이름 'Source')"),
    "vi": ("FG Sans VI", "fg-vi", {
        500: "BeVietnamPro-Medium.ttf",
        700: "BeVietnamPro-Bold.ttf",
        800: "BeVietnamPro-ExtraBold.ttf",
    }, "Be Vietnam Pro — Be Vietnam Pro Project Authors, SIL OFL 1.1"),
}

# 번역에 없더라도 화면에 늘 나오는 글자. 숫자·기호는 공용 글꼴이 그리지만, 보조 글꼴이 단독으로
# 서는 자리(베트남어)를 위해 함께 남긴다.
ALWAYS = set(
    "0123456789"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    " .,:;!?·—-–—()[]{}/\\%+×÷=<>\"'`@#&*~^|_"
    "…‥「」『』、。・ー〜：；！？（）％"
)


def used_characters(language: str) -> set[str]:
    """그 언어의 번역 원문에 실제로 있는 글자만 모은다."""
    folder = I18N / language
    if not folder.is_dir():
        return set()
    text = "".join(path.read_text(encoding="utf-8") for path in sorted(folder.rglob("*.ts")))
    return set(text)


def bake(language: str, family: str, slug: str, weight: int, source_name: str, charset: set[str]) -> None:
    source = SOURCE / source_name
    if not source.is_file():
        print(f"  건너뜀 {weight}: 원본 없음 ({source_name})")
        return

    font = TTFont(source, fontNumber=0)

    options = subset.Options()
    # 글자 모양만 남기고 세로쓰기·레이아웃 표는 버린다. 가로쓰기 모바일 화면만 쓴다.
    options.layout_features = ["kern", "liga", "ccmp", "mark", "mkmk"]
    options.drop_tables += ["vhea", "vmtx", "VORG"]
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.notdef_outline = True
    options.recalc_bounds = True

    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text="".join(sorted(charset)))
    subsetter.subset(font)

    # 세로 지표를 공용 글꼴에 맞춘다. UPM이 다르면 같은 비율로 환산한다.
    upm = font["head"].unitsPerEm
    scale = upm / 1000.0
    hhea, os2 = font["hhea"], font["OS/2"]
    hhea.ascent = round(COMMON_METRICS["ascent"] * scale)
    hhea.descent = round(COMMON_METRICS["descent"] * scale)
    hhea.lineGap = round(COMMON_METRICS["lineGap"] * scale)
    os2.sTypoAscender = round(COMMON_METRICS["typoAscender"] * scale)
    os2.sTypoDescender = round(COMMON_METRICS["typoDescender"] * scale)
    os2.sTypoLineGap = round(COMMON_METRICS["typoLineGap"] * scale)
    os2.usWinAscent = round(COMMON_METRICS["winAscent"] * scale)
    os2.usWinDescent = round(COMMON_METRICS["winDescent"] * scale)
    # 브라우저가 typo 지표를 쓰도록 USE_TYPO_METRICS(비트 7)를 켠다.
    os2.fsSelection |= 1 << 7
    os2.usWeightClass = weight

    # 예약 폰트 이름을 피하려고 이름을 새로 새긴다. 남은 이름이 원본을 가리키면 OFL 위반이다.
    style = {500: "Medium", 700: "Bold", 800: "ExtraBold"}[weight]
    full = f"{family} {style}"
    records = {1: family, 2: style, 3: f"{full};ForGarden", 4: full, 6: full.replace(" ", "-"), 16: family, 17: style}
    for name_id, value in records.items():
        for record in font["name"].names:
            if record.nameID == name_id:
                record.string = value
    for name_id, value in records.items():
        font["name"].setName(value, name_id, 3, 1, 0x409)

    font.flavor = "woff2"
    out = PUBLIC_FONTS / f"{slug}-{weight}.woff2"
    font.save(out)
    print(f"  {out.name}  {out.stat().st_size / 1024:.0f}KB  ({len(charset)}자)")


def main() -> None:
    PUBLIC_FONTS.mkdir(parents=True, exist_ok=True)
    notices = []
    for language, (family, slug, files, notice) in SOURCES.items():
        charset = used_characters(language) | ALWAYS
        if not (I18N / language).is_dir():
            print(f"{language}: 번역이 아직 없어 건너뛴다 (src/i18n/{language} 없음)")
            continue
        print(f"{language}: {family} — {len(charset)}자")
        for weight in WEIGHTS:
            bake(language, family, slug, weight, files[weight], charset)
        notices.append(f"- **{family}** ({language}) — {notice}")

    if notices:
        (PUBLIC_FONTS / "LICENSES.md").write_text(
            "# 글꼴 고지\n\n"
            "게임에 실린 글꼴과 그 출처다. 서브셋본은 예약 폰트 이름을 피하려고 이름을 바꿔 구웠으며,\n"
            "원본 라이선스 전문은 각 배포처에 있다.\n\n"
            "- **NEXON Kart** (ko·en·th) — NEXON, 무료 상업 이용\n"
            + "\n".join(notices) + "\n",
            encoding="utf-8",
        )
        print(f"\n고지 갱신: {PUBLIC_FONTS / 'LICENSES.md'}")


if __name__ == "__main__":
    main()
