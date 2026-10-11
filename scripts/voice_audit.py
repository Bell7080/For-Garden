#!/usr/bin/env python3
"""
캐릭터 대사 목소리 점검 — 기계로 잡히는 신호만 모아 사람이 읽을 보고서로 낸다.

    python3 scripts/voice_audit.py              # 전 개체
    python3 scripts/voice_audit.py yuti rex     # 개체 지정
    python3 scripts/voice_audit.py --json       # 기계가 읽는 출력

기준과 절차는 `docs/character-voice.md`가 갖는다. 이 스크립트는 그 문서의 점검표 중
**셀 수 있는 것**(소재 반복, 자기 해설체, 다른 개체 의존, 시간선 누수)만 맡고, 어색함·매력처럼
읽어야 아는 것은 보고서를 근거로 사람이나 검수 에이전트가 판단한다. 파일은 읽기만 한다.
"""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STORY_DIR = ROOT / "src/data/relicStories"
STRING = re.compile(r'"(?:[^"\\]|\\.)*"')
ROW = re.compile(r'^\s*\[((?:\s*"(?:[^"\\]|\\.)*",?)+)\s*\],?\s*$', re.M)

# 소재 반복: 한 개체의 클릭 대사 서로 다른 레벨 N곳 이상에서 쓰이면 걸린다.
REPEAT_LEVELS = 4
# 다른 개체 의존: 한 레벨 대사 세 줄 중 둘 이상이 다른 개체 이름을 말하면 걸린다.
CROSS_REF_PER_LEVEL = 2
# 자기 해설체: 자기 성격·상태를 문장 한 줄로 정의하는 어미.
SELF_EXPLAIN = [
    re.compile(r"(저는|나는|난|전)\s[^.!?…]{0,24}(사람|타입|편|아이)(이에요|이야|이다|입니다|인 것 같아요|인가 봐요)"),
    re.compile(r"[^.!?…]{0,20}(제|내)\s(특기|버릇|습관|방식|장점|단점)(이에요|이야|인 것 같아요|인가 봐요|같아요)"),
    re.compile(r"(조금|아주|꽤)?\s?(성장|변)했(어요|다|네)"),
]
# 아직 오지 않은 장의 사건을 말하는 표지 — 레벨 주석(`장 N 이후`)과 비교한다.
CHAPTER_NOTE = re.compile(r"장\s*(\d+)\s*이후")
# 연구원 성별을 가르는 말.
GENDERED = re.compile(r"(그녀|그가|그는|오빠|누나|형님|언니|아저씨|아줌마|아가씨)")

JOSA = "은는이가을를에의도로와과만요랑께서한테에게부터까지처럼보다마다"
STOP = set("거야 속에 들었어 부탁드려 헤헤 앞은 지시 속도 가운 같은 다시 먼저 아직 계속 하나 한번 한테 그런 이런 저는 제가 내가 우리 당신 모두 아마 조금씩 보스 보스".split()) | set("보스 마스터 선배 대장님 연구원님 연구원 담당관 오더 아가 조금 오늘 지금 이제 정말 그냥 아니 근데 그래도 하지만 그리고 그러면 이거 그거 저거 여기 거기 같아요 있어요 없어요 해요 했어요 하는 하고 해서 해도 하면 이에요 에요 어요 아요".split())


def strings(text: str) -> list[str]:
    return [json.loads(s) for s in STRING.findall(text)]


def bond_rows(src: str) -> list[list[str]]:
    i = src.find("bondLines")
    return [strings(m.group(1)) for m in ROW.finditer(src[i:])] if i >= 0 else []


def level_notes(src: str) -> dict[int, int]:
    """레벨 주석에서 `장 N 이후`를 읽는다 — 그 레벨이 이미 지난 장."""
    out, i = {}, src.find("bondLines")
    if i < 0:
        return out
    level = -1
    for line in src[i:].splitlines():
        if ROW.match(line):
            level += 1
            continue
        m = re.match(r"\s*//\s*(\d+)", line)
        n = CHAPTER_NOTE.search(line)
        if m and n:
            out[int(m.group(1))] = int(n.group(1))
    return out


def stem(word: str) -> str:
    while len(word) > 2 and word[-1] in JOSA:
        word = word[:-1]
    return word


def words(line: str) -> set[str]:
    return {stem(w) for w in re.findall(r"[가-힣]{2,}", line)} - STOP


def relic_names() -> dict[str, str]:
    names: dict[str, str] = {}
    ko = ROOT / "src/data/relics.ts"
    text = ko.read_text()
    for m in re.finditer(r'\bid:\s*"([a-z-]+)"[^}]{0,400}?\bname:\s*"([^"]+)"', text, re.S):
        names.setdefault(m.group(1), m.group(2))
    return names


def audit(ids: list[str]) -> dict:
    names = relic_names()
    per: dict[str, list[list[str]]] = {}
    srcs: dict[str, str] = {}
    for p in sorted(STORY_DIR.glob("*.ts")):
        if p.stem in ("index", "registerStory"):
            continue
        srcs[p.stem] = p.read_text()
        per[p.stem] = bond_rows(srcs[p.stem])

    # 전 개체에서 흔한 말은 소재가 아니라 말투이므로 제외한다.
    doc_freq: Counter = Counter()
    for rows in per.values():
        seen = set()
        for r in rows:
            for line in r:
                seen |= words(line)
        doc_freq.update(seen)
    common = {w for w, c in doc_freq.items() if c >= max(4, len(per) * 0.3)}

    report: dict = {}
    for cid in ids or per:
        rows = per[cid]
        notes = level_notes(srcs[cid])
        issues: list[dict] = []
        lv_of: dict[str, set[int]] = defaultdict(set)
        for lv, r in enumerate(rows):
            for line in r:
                for w in words(line) - common:
                    lv_of[w].add(lv)
        for w, lvs in sorted(lv_of.items(), key=lambda x: -len(x[1])):
            if len(lvs) >= REPEAT_LEVELS:
                issues.append({"kind": "소재 반복", "term": w, "levels": sorted(lvs)})
        for lv, r in enumerate(rows):
            others = [n for oid, n in names.items() if oid != cid and n and len(n) >= 2]
            refs = [sum(1 for n in others if n in line) for line in r]
            if sum(1 for c in refs if c) >= CROSS_REF_PER_LEVEL:
                issues.append({"kind": "다른 개체 의존", "level": lv, "lines": [i for i, c in enumerate(refs) if c]})
            for i, line in enumerate(r):
                for rx in SELF_EXPLAIN:
                    if rx.search(line):
                        issues.append({"kind": "자기 해설체", "level": lv, "index": i, "text": line})
                        break
                if GENDERED.search(line):
                    issues.append({"kind": "성별 지정 의심", "level": lv, "index": i, "text": line})
        # 시간선: 레벨 L 대사가 더 높은 레벨의 장 내용을 말하는지는 사람이 읽어야 한다 —
        # 여기서는 주석이 가리키는 장과 레벨의 배치가 단조로운지만 본다.
        last = 0
        for lv in sorted(notes):
            if notes[lv] < last:
                issues.append({"kind": "시간선", "level": lv, "note": f"장 {notes[lv]} 주석이 앞 레벨보다 이르다"})
            last = notes[lv]
        lens = [len(line) for r in rows for line in r]
        report[cid] = {"lines": len(lens), "avgLen": round(sum(lens) / len(lens), 1) if lens else 0, "issues": issues}
    return report


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    report = audit(args)
    if "--json" in sys.argv:
        print(json.dumps(report, ensure_ascii=False, indent=1))
        return
    total = 0
    for cid, r in report.items():
        print(f"\n== {cid}  ({r['lines']}줄, 평균 {r['avgLen']}자)")
        if not r["issues"]:
            print("  걸린 것 없음")
        for it in r["issues"]:
            total += 1
            k = it["kind"]
            if k == "소재 반복":
                print(f"  [소재 반복] '{it['term']}' — 레벨 {it['levels']}")
            elif k == "다른 개체 의존":
                print(f"  [다른 개체 의존] 레벨 {it['level']} 줄 {it['lines']}")
            elif k in ("자기 해설체", "성별 지정 의심"):
                print(f"  [{k}] {it['level']}.{it['index']} {it['text']}")
            else:
                print(f"  [{k}] 레벨 {it['level']}: {it['note']}")
    print(f"\n걸린 신호 {total}개 — 신호는 후보일 뿐이고, 고칠지는 docs/character-voice.md 기준으로 읽고 정한다.")


if __name__ == "__main__":
    main()
