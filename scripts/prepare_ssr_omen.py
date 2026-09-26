#!/usr/bin/env python3
"""SSR 전조 연출을 원본 HTML에서 굽는다.

Codex가 만든 `docs/reference/ssr-omen-cinematic.html`은 6.4초짜리 **데모**다 — 검은 화석이 네 번
울리며 갈라지고(0.65 · 1.65 · 2.75 · 3.65초), 조각이 터져 나간 뒤 호박빛 섬광(3.86초)이 번지고,
그 뒤로 2.5초 동안 천천히 가라앉는다. 제목·재생 버튼·소리 버튼·진행 막대가 함께 붙어 있다.

게임이 쓰는 것은 **"SSR이다!"를 직감하게 하는 한 순간**뿐이므로 여기서 다음을 한다.

1. 데모 부팅(버튼·제목·진행 막대)을 떼고 클래스만 `window.__SSR_OMEN__`으로 내보낸다.
2. **시간을 휜다**(`OMEN_WARP`). 원본의 이야기 시간은 그대로 두고, 실제 시간이 그 위를 어떻게
   지나가는지만 바꾼다 — 첫 울림 앞의 침묵을 걷어 내고, 울림 사이가 점점 짧아져(0.45 → 0.3 →
   0.2초) 콰지지직 몰아치다가 터지는 순간(팡)에 가장 빠르고, 섬광 뒤 가라앉는 긴 꼬리는
   잘라 낸다. 전체가 2초 남짓이다.
3. 섬광의 정점에서 게임에 알린다(`onReveal`) — 게임은 그 순간 대사 화면으로 넘어간다.
4. 소리는 게임의 효과음 볼륨을 따른다.

**원본을 손으로 고치지 않는다.** 원본이 새로 오면 이 스크립트를 다시 돌린다 — 어느 한 군데도
맞지 않으면 조용히 넘어가지 않고 그 자리를 이름으로 말하며 멈춘다.

    python3 scripts/prepare_ssr_omen.py
"""

from __future__ import annotations

import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "docs/reference/ssr-omen-cinematic.html"
TARGET = ROOT / "public/cinematic/ssrOmen.js"

# (실제 초, 원본 이야기 초). 사이는 곧게 잇는다. 원본의 울림은 0.65 · 1.65 · 2.75 · 3.65,
# 섬광 정점은 3.86이다. 울림 간격이 0.45 → 0.3 → 0.2로 줄어 가속이 붙는다.
OMEN_WARP = [
    (0.0, 0.52),
    (0.14, 0.65),   # 콰 — 첫 울림
    (0.59, 1.65),   # 지
    (0.89, 2.75),   # 지직
    (1.09, 3.65),   # 터진다
    (1.27, 3.86),   # 팡 — 섬광 정점
    (1.75, 4.45),   # 여운은 여기서 자른다
]
OMEN_END = OMEN_WARP[-1][0]
OMEN_REVEAL_STORY = 3.86

PATCHES: list[tuple[str, str, int]] = [
    # 실제 시간 → 이야기 시간. 울림(소리)도 이야기 시간으로 맞춘다.
    (
        "for(this.elapsed+=Math.min((e-this.previous)/1e3,.05);this.hitIndex<yl.length&&this.elapsed>=yl[this.hitIndex];)",
        "for(this.elapsed+=Math.min((e-this.previous)/1e3,.05),this.story=OW(this.elapsed);"
        "this.hitIndex<yl.length&&this.story>=yl[this.hitIndex];)",
        1,
    ),
    (
        "if(this.draw(this.elapsed),this.options.onProgress?.(this.elapsed),this.elapsed>=4.55&&this.reveal()",
        f"if(this.draw(this.story),this.options.onProgress?.(this.elapsed),this.story>={OMEN_REVEAL_STORY}&&this.reveal()",
        1,
    ),
    ("if(this.elapsed>=Gi){this.finish(\"completed\");return}", "if(this.elapsed>=OE){this.finish(\"completed\");return}", 1),
    # 소리는 게임의 효과음 볼륨을 따른다.
    ("this.sound=new Ml,", "this.sound=new Ml,this.sound.volume=t.volume??1,", 1),
    ("this.master.gain.value=.52", "this.master.gain.value=.52*(this.volume??1)", 1),
    # 그래픽 연결이 끊기면 제 안내 문구를 띄우지 않고 끝낸다 — 게임이 대사 화면으로 넘어간다.
    (
        "this.contextLost=!0,this.finish(\"cancelled\"),this.options.onError?.(",
        "this.contextLost=!0,this.finish(\"cancelled\"),void(",
        1,
    ),
]

DEMO_BOOT = 'var Za=document.querySelector("#app")'


def export_tail() -> str:
    points = ",".join(f"[{a},{b}]" for a, b in OMEN_WARP)
    return (
        f"var OP=[{points}],OE={OMEN_END},"
        "OW=function(e){if(e<=OP[0][0])return OP[0][1];for(var i=1;i<OP.length;i++){var a=OP[i-1],b=OP[i];"
        "if(e<=b[0])return a[1]+(b[1]-a[1])*(e-a[0])/(b[0]-a[0])}return OP[OP.length-1][1]};"
        f"window.__SSR_OMEN__={{Omen:Ya,duration:OE}};}})();"
    )


def main() -> int:
    if not SOURCE.exists():
        print(f"원본이 없다: {SOURCE}", file=sys.stderr)
        return 1
    html = SOURCE.read_text(encoding="utf-8")
    opening = html.rindex("<script>") + len("<script>")
    js = html[opening : html.index("</script>", opening)]
    if DEMO_BOOT not in js:
        print("굽기 실패 — 데모 부팅 자리를 찾지 못했다", file=sys.stderr)
        return 1
    js = js[: js.index(DEMO_BOOT)] + export_tail()
    for old, new, expected in PATCHES:
        found = js.count(old)
        if found != expected:
            print(f"굽기 실패 — {found}군데 (기대 {expected}): {old[:80]}", file=sys.stderr)
            return 1
        js = js.replace(old, new)
    TARGET.write_text(js, encoding="utf-8")
    print(f"구움: {TARGET.relative_to(ROOT)} ({len(js) // 1024} KB, {OMEN_END}초)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
