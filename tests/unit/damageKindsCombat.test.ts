import { describe, expect, it } from "vitest";
import { RELICS } from "../../src/data/relics";
import { createSkirmish, fireUltimate, stepSkirmish, type Arena } from "../../src/core/skirmish";
import { characterDamageKinds, type DamageKind } from "../../src/ui/damageKinds";

/*
 * 스킬 칩·해시태그의 피해 종류(`damageKinds.ts` — 데이터 모양으로 판정)가 **실제 전투가 내는 피해**와
 * 맞는지 본다. 개체마다 혼자 세워 체력이 끝없는 표적 셋을 때리게 하고, 그 개체가 낸 피해 사건의
 * 종류를 모은다. 폭주는 끄고(폭주 특성은 태그가 세지 않는다) 궁극기는 앞 20초 동안 2초마다 쏘고 뒤 20초는 쉰다(은신 궁극기가 일반 공격을 늘 고정 피해로 바꾸지 않게).
 *
 * 실제로 낸 종류는 반드시 태그에 있어야 한다. 거꾸로 태그에 있는데 이 모의에서 나지 않는 종류는
 * 조건이 맞아야만 터지는 것들뿐이라 아래 표에 이유와 함께 적는다.
 */
const ARENA: Arena = { left: 0, right: 1000, top: 0, bottom: 1600 };

/** 혼자 선 모의로는 조건이 서지 않아 나지 않는 피해. */
const NOT_TRIGGERED_ALONE: Readonly<Record<string, readonly DamageKind[]>> = {
  anka: ["magical"], // 졸음 → 수면이 깨는 피해 — 적이 안카가 아닌 아군을 노려야 쌓인다
  ark: ["physical"], // 위압이 공포를 걸어 표적이 달아나는 동안 이 모의에서는 닿지 않는다
};

function observedKinds(defId: string): Set<DamageKind> {
  const def = RELICS.find((relic) => relic.id === defId)!;
  const dummy = RELICS.find((relic) => relic.id === "torika")!;
  const state = createSkirmish([def], [dummy, dummy, dummy], ARENA);
  const me = state.fighters.find((fighter) => fighter.side === "player")!;
  for (const fighter of state.fighters) if (fighter.side === "enemy") { fighter.maxHp = 1e9; fighter.hp = 1e9; }
  const kinds = new Set<DamageKind>();
  for (let tick = 0; tick < 800; tick += 1) {
    me.ferocity = 0; me.ferocityFever = false; me.hp = me.maxHp;
    let events = stepSkirmish(state, 0.05);
    if (tick % 40 === 0 && tick < 400) { me.energy = 9999; events = events.concat(fireUltimate(state, me.id)); }
    for (const event of events) {
      if (event.kind === "concussion" && "attackerId" in event && event.attackerId === me.id) kinds.add("fixed");
      if (event.kind !== "attack" || event.attackerId !== me.id) continue;
      kinds.add(event.damageType === "true" ? "fixed" : event.damageType === "magical" ? "magical" : "physical");
    }
  }
  return kinds;
}

describe("피해 종류 태그 ↔ 실제 전투", () => {
  for (const def of RELICS) {
    it(`${def.id}`, () => {
      const tagged = characterDamageKinds(def);
      const observed = observedKinds(def.id);
      for (const kind of observed) expect(tagged.has(kind), `${def.id}: 전투가 ${kind} 피해를 내는데 태그에 없다`).toBe(true);
      const allowed = new Set<DamageKind>(NOT_TRIGGERED_ALONE[def.id] ?? []);
      for (const kind of tagged) {
        if (kind === "fixed") continue; // 고정은 은신·관측 등 조건부가 많아 위 방향만 본다
        if (allowed.has(kind)) continue;
        expect(observed.has(kind), `${def.id}: 태그는 ${kind} 피해라는데 전투가 그 피해를 내지 않는다`).toBe(true);
      }
    });
  }
});
