#!/usr/bin/env python3
"""본편·서브 대사 번역 원고를 언어별 덮어쓰기 표(`src/i18n/<언어>/data.ts`)에 합친다.

원고는 `i18n-src/story/*.json` 한 장마다 `{키: {en, ja, zh-Hans, th, vi, id, es, pt-BR, de, ru}}`다.
번체(`zh-Hant`)는 원고에 적지 않고 간체를 OpenCC로 옮긴다(`build_translations.py`와 같은 규칙).

`data.ts`는 다른 원고(`i18n-src/data.*.json`)와 한 파일을 나눠 쓰므로 통째로 다시 쓰지 않는다 — 이미 있는
키는 그 줄만 갈아 끼우고, 없는 키는 표 끝에 덧붙인다.

    python3 scripts/merge_story_translations.py            # 원고 전부
    python3 scripts/merge_story_translations.py ch1 ch2    # 몇 장만
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import opencc

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_translations import to_hant  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "i18n-src" / "story"
WRITTEN = ["en", "ja", "zh-Hans", "th", "vi", "id", "es", "pt-BR", "de", "ru"]
LINE = re.compile(r'^  ("(?:[^"\\]|\\.)*"): ("(?:[^"\\]|\\.)*"),?$')


def load_sources(names: list[str]) -> dict[str, dict[str, str]]:
    files = [SOURCE / f"{name}.json" for name in names] if names else sorted(SOURCE.glob("*.json"))
    merged: dict[str, dict[str, str]] = {}
    for path in files:
        for key, values in json.loads(path.read_text(encoding="utf-8")).items():
            missing = [lang for lang in WRITTEN if not values.get(lang)]
            if missing:
                raise SystemExit(f"{path.name} {key}: 빠진 언어 {missing}")
            if key in merged:
                raise SystemExit(f"{path.name} {key}: 다른 원고에 이미 있다")
            merged[key] = values
    return merged


def merge(lang: str, values: dict[str, str]) -> int:
    path = ROOT / "src" / "i18n" / lang / "data.ts"
    lines = path.read_text(encoding="utf-8").split("\n")
    pending = dict(values)
    for index, line in enumerate(lines):
        match = LINE.match(line)
        if not match:
            continue
        key = json.loads(match.group(1))
        if key in pending:
            lines[index] = f"  {json.dumps(key, ensure_ascii=False)}: {json.dumps(pending.pop(key), ensure_ascii=False)},"
    close = max(index for index, line in enumerate(lines) if line.strip() == "};")
    added = [f"  {json.dumps(key, ensure_ascii=False)}: {json.dumps(value, ensure_ascii=False)}," for key, value in pending.items()]
    lines[close:close] = added
    path.write_text("\n".join(lines), encoding="utf-8")
    return len(values)


def main() -> None:
    sources = load_sources(sys.argv[1:])
    converter = opencc.OpenCC("s2twp")
    for lang in WRITTEN:
        merge(lang, {key: values[lang] for key, values in sources.items()})
    merge("zh-Hant", {key: to_hant(values["zh-Hans"], converter) for key, values in sources.items()})
    print(f"{len(sources)}개 키를 {len(WRITTEN) + 1}개 언어에 합쳤다")


if __name__ == "__main__":
    main()
