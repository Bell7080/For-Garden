import { describe, expect, it } from "vitest";
import { RELICS } from "../../src/data/relics";
import { createSkirmish, fireUltimate, stepSkirmish, type Arena, type SkirmishEvent } from "../../src/core/skirmish";
import { skillTagsFromDef } from "../../src/ui/skillTags";

/**
 * **스킬 칩이 실제 전투가 거는 상태를 빠뜨리지 않는가.**
 *
 * 칩은 데이터 계약에서 짓는데, 상태를 `statusEffects` 목록이 아니라 제 이름의 필드(돌진 기절·호령·
 * 순환 걸음·시약 반응…)로 거는 계약이 늘 때마다 칩에서 빠졌다. 여기서는 개체 하나를 죽지 않는 적 셋과
 * 싸우게 해(폭주는 끈다 — 폭주 칩은 따로 선다) 적에게 실제로 걸린 상태를 모으고, 그 상태가 그 개체의
 * 패시브·일반 공격·궁극기 칩 어딘가에 규칙어로 서 있는지 본다.
 */
const ARENA: Arena = { left: 0, right: 1000, top: 0, bottom: 1600 };

/** 사건 → 칩의 규칙어 ID. */
const EVENT_KEYWORD: Readonly<Record<string, string>> = {
  stun: "stun", stagger: "stagger", frozen: "frozen", fear: "fear",
  bleed: "bleed", poison: "poison", knockback: "knockback", fellAsleep: "sleep",
  pressureBurst: "pressure", vandalismBurst: "vandalism", butcherBurst: "butcher",
};

/**
 * 칩의 다른 규칙어가 이미 말하는 상태. 개체 이름이 아니라 **어느 규칙어가 그 상태를 데려오는가**로 적는다.
 * 빙결이 풀리는 피해는 뇌진탕 사건을 빌려 쓰므로 그 사건은 세지 않는다.
 */
const IMPLIED_BY: Readonly<Record<string, readonly string[]>> = {
  stun: ["pressure", "sleep", "drowsy"], // 수압 폭발·수면은 기절 슬롯으로 막는다
  sleep: ["drowsy"],
};

/** 개체 몸 밖에서 오는 상태 — 소환수(디안의 늑대)·서리깃의 동상 사건(출혈 사건을 빌린다). */
const OUTSIDE: Readonly<Record<string, readonly string[]>> = {
  dian: ["bleed", "chill"],
  yuti: ["bleed"],
};

function observedStatuses(defId: string): Set<string> {
  const def = RELICS.find((relic) => relic.id === defId)!;
  // 허수아비는 아무것도 걸지 않아야 한다 — 미르의 개미산(중독)을 맞은 쪽이 옮겨 거는 상태까지 세지 않게 평타 효과를 걷는다.
  const mir = RELICS.find((relic) => relic.id === "mir")!;
  const dummy = { ...mir, basic: { ...mir.basic, statusEffects: undefined } };
  const state = createSkirmish([def], [dummy, dummy, dummy], ARENA);
  const me = state.fighters.find((fighter) => fighter.side === "player")!;
  for (const fighter of state.fighters) if (fighter.side === "enemy") { fighter.maxHp = 1e9; fighter.hp = 1e9; }
  const seen = new Set<string>();
  for (let tick = 0; tick < 1200; tick += 1) {
    me.ferocity = 0; me.ferocityFever = false; me.hp = me.maxHp;
    let events: SkirmishEvent[] = stepSkirmish(state, 0.05);
    if (tick % 40 === 0 && tick < 600) { me.energy = 9999; events = events.concat(fireUltimate(state, me.id)); }
    for (const event of events as { kind: string; status?: string; fighterId?: string; targetId?: string }[]) {
      const target = state.fighters.find((fighter) => fighter.id === (event.fighterId ?? event.targetId));
      if (target?.side !== "enemy") continue;
      const key = event.kind === "status" ? event.status : event.kind;
      const keyword = key === undefined ? undefined : EVENT_KEYWORD[key];
      if (keyword) seen.add(keyword);
    }
    for (const fighter of state.fighters) {
      if (fighter.side !== "enemy") continue;
      if (fighter.taunted) seen.add("taunt");
      if ((fighter.chill?.stacks ?? 0) > 0) seen.add("chill");
    }
  }
  return seen;
}

describe("스킬 칩 ↔ 실제 전투 상태", () => {
  it("적에게 실제로 걸린 상태는 그 개체의 칩 어딘가에 선다", () => {
    const missing: string[] = [];
    for (const def of RELICS) {
      if (def.enemyOnly || def.summonOnly) continue;
      const chips = (["passive", "basic", "ultimate"] as const).flatMap((slot) => skillTagsFromDef(def[slot], slot));
      const ids = new Set(chips.flatMap((chip) => [...chip.text.matchAll(/\[\[([a-z-]+)\|/g)].map((match) => match[1])));
      for (const status of observedStatuses(def.id)) {
        if (ids.has(status) || (IMPLIED_BY[status] ?? []).some((id) => ids.has(id))) continue;
        if ((OUTSIDE[def.id] ?? []).includes(status)) continue;
        missing.push(`${def.id}:${status}`);
      }
    }
    expect(missing).toEqual([]);
  }, 120_000);
});
