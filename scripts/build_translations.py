"""
번역 원고(`i18n-src/<파일>.json`)에서 언어별 문구 표(`src/i18n/<언어>/<파일>.ts`)를 굽는다.

    python3 scripts/build_translations.py

원고는 영어 표의 키마다 여러 언어의 값을 **한 줄에** 나란히 적는다 — 언어마다 파일을 따로 두면
같은 문장을 고칠 때 아홉 곳을 찾아다녀야 하고, 한 언어만 빠진 키가 보이지 않는다.

    { "lab.rates": ["概率详情", "รายละเอียดอัตรา", ...], ... }

값의 순서는 `LANGS`다. 번체 중국어는 원고에 따로 적지 않고 간체를 OpenCC(`s2twp`, 대만 어휘)로
옮긴 뒤 `ZH_HANT_FIX`로 게임 용어만 바로잡는다 — 같은 번역을 두 번 쓰면 두 표가 조용히 갈린다.

키 순서·머리 주석·상수 이름은 영어 표(`src/i18n/en`)를 따른다. 영어 표에 있는데 원고에 없는 키는
멈추고 이름을 댄다 — 빠진 자리는 한국어로 보이므로 조용히 넘기면 찾을 수 없다.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
I18N = ROOT / "src" / "i18n"
SOURCE = ROOT / "i18n-src"

LANGS = ["zh-Hans", "th", "vi", "id", "es", "pt-BR", "de", "ru"]
SUFFIX = {"zh-Hans": "ZH_HANS", "zh-Hant": "ZH_HANT", "th": "TH", "vi": "VI", "id": "ID", "es": "ES", "pt-BR": "PT_BR", "de": "DE", "ru": "RU"}

# OpenCC가 옮긴 뒤 게임 용어만 대만 표기로 바로잡는다. 사전(`glossary.ts`)의 zh-Hant 표기와 같아야 한다.
ZH_HANT_FIX = [("芝士", "起司")]


def english_file(name: str) -> tuple[str, str, list[str]]:
    text = (I18N / "en" / f"{name}.ts").read_text(encoding="utf-8")
    header = text[: text.index("export ")] if not text.startswith("export") else ""
    const = re.search(r"export const (\w+)_EN = \{", text)
    keys = re.findall(r'^\s*"([^"]+)":', text, re.M)
    return header, const.group(1) if const else "", keys


def to_hant(value: str, converter) -> str:
    # 자리 표시와 용어 태그의 ID는 옮기지 않는다 — `[[id|표기]]`의 id와 `{name}`은 코드가 읽는다.
    parts = re.split(r"(\{[^}]*\}|\[\[[^|\]]*\|)", value)
    out = "".join(part if re.fullmatch(r"\{[^}]*\}|\[\[[^|\]]*\|", part) else converter.convert(part) for part in parts)
    for before, after in ZH_HANT_FIX:
        out = out.replace(before, after)
    return out


def write(language: str, name: str, header: str, const: str, keys: list[str], values: dict[str, str]) -> None:
    folder = I18N / language
    folder.mkdir(exist_ok=True)
    body = "\n".join(f"  {json.dumps(key)}: {json.dumps(values[key], ensure_ascii=False)}," for key in keys)
    if name == "data":
        text = f"{header}export default {{\n{body}\n}};\n"
    else:
        text = f"{header}export const {const}_{SUFFIX[language]} = {{\n{body}\n}} as const;\n"
    (folder / f"{name}.ts").write_text(text, encoding="utf-8")


def write_index(language: str, names: list[str]) -> None:
    text = (I18N / "en" / "index.ts").read_text(encoding="utf-8")
    text = re.sub(r"_EN\b", f"_{SUFFIX[language]}", text)
    text = text.replace("/** English table.", f"/** {language} table.")
    (I18N / language / "index.ts").write_text(text, encoding="utf-8")


def main() -> None:
    import opencc

    converter = opencc.OpenCC("s2twp")
    # 정적 콘텐츠는 1,500줄이 넘어 원고를 `data.<구획>.json` 여럿으로 나눈다. 굽는 것은 한 표다.
    names = sorted({path.stem.split(".")[0] for path in SOURCE.glob("*.json")})
    only = set(sys.argv[1:])
    failed = False
    for name in names:
        if only and name not in only:
            continue
        header, const, keys = english_file(name)
        rows: dict[str, list[str]] = {}
        for part in sorted(SOURCE.glob(f"{name}.json")) + sorted(SOURCE.glob(f"{name}.*.json")):
            rows.update(json.loads(part.read_text(encoding="utf-8")))
        missing = [key for key in keys if key not in rows]
        extra = [key for key in rows if key not in keys]
        short = [key for key, row in rows.items() if len(row) != len(LANGS)]
        if missing or extra or short:
            print(f"{name}: 빠짐 {missing[:8]} 남음 {extra[:8]} 칸 수 {short[:8]}")
            failed = True
            continue
        for index, language in enumerate(LANGS):
            write(language, name, header, const, keys, {key: rows[key][index] for key in keys})
        write("zh-Hant", name, header, const, keys, {key: to_hant(rows[key][0], converter) for key in keys})
        print(f"{name}: {len(keys)}키")
    ui = [path.stem for path in (I18N / "en").glob("*.ts") if path.stem not in ("index", "data")]
    for language in [*LANGS, "zh-Hant"]:
        if all((I18N / language / f"{name}.ts").exists() for name in ui):
            write_index(language, ui)
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
