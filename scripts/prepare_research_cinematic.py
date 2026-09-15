#!/usr/bin/env python3
"""연구 시네마틱을 원본 HTML에서 굽는다.

Codex가 만들어 준 `docs/reference/fossil-revival-cinematic.html` 한 장에는 three.js 묶음과
무대·카드 연출이 모두 들어 있다. 그 파일은 **데모**라 임시 제목·뽑기 버튼·횟수 고르기·등급
미리보기가 함께 붙어 있고, 문구도 제 안에 한국어로 박혀 있다.

게임이 쓰는 것은 연출뿐이므로 여기서 다음을 한다.

1. 지운 DOM에 쓰다가 죽지 않도록 `el()`이 붙어 있지 않은 조각을 돌려주게 한다.
2. 등급 띠 색을 게임의 희귀도 색으로 바꾸고, 등급이 오를수록 더 오래·더 격하게 흔들리고
   더 멀리 깨지도록 배수(`Fq`)를 태운다.
3. 결산 격자를 세로 화면에 맞춰 두 칸씩 다섯 줄로 바꾼다.
4. 화면에 서는 낱말(재화)을 게임의 문구 표에서 받도록 바깥으로 뺀다.
5. 데모 부팅을 떼고 클래스만 `window.__RESEARCH_CINEMATIC__`으로 내보낸다.

**원본을 손으로 고치지 않는다.** 원본이 새로 오면 이 스크립트를 다시 돌린다 — 어느 한 군데도
맞지 않으면 조용히 넘어가지 않고 그 자리를 이름으로 말하며 멈춘다.

    python3 scripts/prepare_research_cinematic.py
"""

from __future__ import annotations

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "docs/reference/fossil-revival-cinematic.html"
TARGET = ROOT / "public/cinematic/researchCinematic.js"

# 게임의 희귀도 색(`src/ui/theme.ts`의 RARITY_GEM 가운데 값)과 같은 값을 쓴다.
TIERS_BEFORE = (
    'var ft={GRAY:{color:"#929da9",duration:.8,level:0},R:{color:"#4ba8ff",duration:1.05,level:1},'
    'SR:{color:"#ad72ff",duration:1.65,level:2},SSR:{color:"#ffba45",duration:2.45,level:3}},Dg=i=>'
)
TIERS_AFTER = (
    'var ft={GRAY:{color:"#7d848c",duration:.8,level:0},R:{color:"#5fd4ff",duration:1.05,level:1},'
    'SR:{color:"#e070f5",duration:1.65,level:2},SSR:{color:"#ffc247",duration:2.45,level:3}},'
    'CT={gray:"GRAY"},Fq=i=>1+ft[i].level*.85,Dg=i=>'
)

# (무엇을, 무엇으로, 몇 군데) — 개수가 다르면 원본이 바뀐 것이므로 멈춘다.
PATCHES: list[tuple[str, str, int]] = [
    # 1. 지운 DOM은 붙어 있지 않은 조각으로 받는다.
    (
        'el(e){let t=this.root.querySelector("#"+e);if(!t)throw Error("Missing UI: "+e);return t}',
        'el(e){let t=this.root.querySelector("#"+e);if(!t){this._stubs||(this._stubs=new Map),'
        'this._stubs.has(e)||this._stubs.set(e,document.createElement("div")),t=this._stubs.get(e)}return t}',
        1,
    ),
    # 2. 등급 띠와 폭주 배수.
    (TIERS_BEFORE, TIERS_AFTER, 1),
    # 3. 화면에 서는 낱말은 게임의 문구 표가 갖는다.
    ('"\\uC7AC\\uD654"', "CT.gray", 2),
    # 4. 균열과 폭발이 등급만큼 길어진다.
    (
        'this.phase==="fracture"&&this.phaseTime>1.95*s?',
        'this.phase==="fracture"&&this.phaseTime>1.95*s*(1+ft[this.reward.rarity].level*.29)?',
        1,
    ),
    (
        'this.phase==="burst"&&this.phaseTime>1.05*s?',
        'this.phase==="burst"&&this.phaseTime>1.05*s*(1+ft[this.reward.rarity].level*.14)?',
        1,
    ),
    # 5. 흔들림과 깨짐의 세기도 같은 배수를 탄다.
    (
        'r&&t==="fracture"&&(u.x+=Math.sin(s*91)*a*.045,u.y+=Math.sin(s*113)*a*.025)',
        'r&&t==="fracture"&&(u.x+=Math.sin(s*91)*a*.045*Fq(this.reward.rarity),'
        'u.y+=Math.sin(s*113)*a*.025*Fq(this.reward.rarity))',
        1,
    ),
    (
        'r&&t==="burst"&&(u.x+=Math.sin(s*101)*Math.exp(-o*6)*.13)',
        'r&&t==="burst"&&(u.x+=Math.sin(s*101)*Math.exp(-o*6)*.13*Fq(this.reward.rarity))',
        1,
    ),
    (
        "g.mesh.position.addScaledVector(g.axis,Math.sin(s*65+g.delay*9)*a*.024)",
        "g.mesh.position.addScaledVector(g.axis,Math.sin(s*65+g.delay*9)*a*.024*Fq(this.reward.rarity))",
        1,
    ),
    (
        't==="fracture"?a*.14:t==="burst"?.14+Math.pow(Math.max(0,o-g.delay),.62)*5:0',
        't==="fracture"?a*.14*(1+ft[this.reward.rarity].level*.4):'
        't==="burst"?.14+Math.pow(Math.max(0,o-g.delay),.62)*(5+ft[this.reward.rarity].level*1.9):0',
        1,
    ),
    # 6. 결산 격자는 두 칸씩 다섯 줄이다.
    (
        's.style.setProperty("--col",String(n%5)),s.style.setProperty("--row",String(Math.floor(n/5)))',
        's.style.setProperty("--col",String(n%2)),s.style.setProperty("--row",String(Math.floor(n/2)))',
        1,
    ),
    # 7. 카드 뒷판의 표식은 게임의 낱말을 쓴다.
    ('<div class="back-code">RE:GEN</div>', '<div class="back-code">RELIC</div>', 1),
    ("<span>SEALED GENETIC ARCHIVE</span>", "<span>SEALED GENOME ARCHIVE</span>", 1),
]

# 그래픽 연결이 끊기면 제 안내를 띄우고 새로고침하는 대신 씬에 알린다 — 게임 안에서는
# `location.reload()`가 진행 중인 세션을 통째로 날린다.
CONTEXT_LOST = re.compile(r'this\.renderer\.domElement\.addEventListener\("webglcontextlost",p=>\{.*?\},d\)', re.S)
CONTEXT_LOST_NEW = (
    'this.renderer.domElement.addEventListener("webglcontextlost",p=>{p.preventDefault(),'
    "cancelAnimationFrame(this.raf),this.stopAudio(),this.options.onContextLost?.()},d)"
)

# 데모 부팅이 시작하는 자리. 여기서부터 끝까지를 내보내기 한 줄로 갈아 끼운다.
DEMO_BOOT = ',Ks=document.getElementById("game")'
EXPORT_TAIL = ";window.__RESEARCH_CINEMATIC__={Cinematic:xo,text:CT,tiers:ft};})();"


def main() -> int:
    if not SOURCE.exists():
        print(f"원본이 없다: {SOURCE}", file=sys.stderr)
        return 1
    html = SOURCE.read_text(encoding="utf-8")
    opening = html.rindex("<script>") + len("<script>")
    js = html[opening : html.index("</script>", opening)]

    # 데모 부팅을 **먼저** 뗀다. 그 안에도 화면 낱말이 있어, 남겨 두면 아래 개수 검사가 어긋난다.
    if DEMO_BOOT not in js:
        print("굽기 실패 — 데모 부팅 자리를 찾지 못했다", file=sys.stderr)
        return 1
    js = js[: js.index(DEMO_BOOT)] + EXPORT_TAIL

    for old, new, expected in PATCHES:
        found = js.count(old)
        if found != expected:
            print(f"굽기 실패 — {found}군데 (기대 {expected}): {old[:80]}", file=sys.stderr)
            return 1
        js = js.replace(old, new)

    js, replaced = CONTEXT_LOST.subn(CONTEXT_LOST_NEW.replace("\\", "\\\\"), js)
    if replaced != 1:
        print("굽기 실패 — webglcontextlost 처리부를 찾지 못했다", file=sys.stderr)
        return 1

    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(js, encoding="utf-8")
    print(f"구웠다: {TARGET.relative_to(ROOT)} ({len(js):,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
