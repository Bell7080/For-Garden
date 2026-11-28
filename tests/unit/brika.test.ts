import { describe, expect, it } from "vitest";
import { createSkirmish, fireUltimate, stepSkirmish, type Arena, type SkirmishState } from "../../src/core/skirmish";
import { statTotal } from "../../src/core/combatPower";
import { withinRarityBand } from "../../src/core/rarityScaling";
import { FEROCITY_RULES, ferocityMaxOf } from "../../src/core/ferocity";
import { getRelic } from "../../src/data/relics";
import { breakthroughEffectText, ferocityTraitDescription, passiveDescription, skillDescription } from "../../src/ui/skillPresentation";

/**
 * 브리카 — 풀 SR 중거리 탱커. 앞에 서서 맞는 탱커가 아니라 뒤에 서서 「우듬지 그늘」로 주위 아군의 피해를
 * 나눠 받고, 그 몫의 일부를 제 막으로 바꾼다. 궁극기는 넓은 범위의 피해 절반을 5초 동안 대신 받는다.
 */
const ARENA: Arena = { left: 0, right: 2_000, top: 0, bottom: 2_000 };

function setup(allyIds: string[] = ["torika"], breakthrough = 0): { state: SkirmishState } {
  const state = createSkirmish([getRelic("brika"), ...allyIds.map((id) => getRelic(id))], [getRelic("amo")], ARENA, {}, { brika: breakthrough });
  for (const fighter of state.fighters) { fighter.attackCooldown = 99; fighter.stealthFor = 0; }
  return { state };
}

describe("브리카 — 정체성", () => {
  it("은 풀 SR 중거리 탱커이고 나이트 기어 소속이다", () => {
    const brika = getRelic("brika");
    expect([brika.rarity, brika.element, brika.role, brika.reachTier, brika.squad]).toEqual(["SR", "grass", "tank", "mid", "gear"]);
    expect(brika.researcherTitle).toBe("연구원님");
  });

  it("은 SR 띠 안의 태생 전투력을 갖는다", () => {
    expect(withinRarityBand(statTotal(getRelic("brika").stats), "SR")).toBe(true);
  });

  it("의 그늘은 넓다(응태 2026-11-17 — 360 → 520)", () => {
    expect(getRelic("brika").passive.canopy).toEqual({ radius: 520, sharePercent: 20, shieldFromSharePercent: 25, shieldCapMaxHpPercent: 15 });
  });
});

describe("브리카 — 우듬지 그늘", () => {
  it("은 반경 안 아군의 피해 20%를 대신 받고, 그 몫의 25%를 막으로 두른다", () => {
    const { state } = setup();
    const [brika, ally, foe] = state.fighters;
    brika.x = 1_000; brika.y = 1_400;
    ally.x = 1_000; ally.y = 1_000; // 400 — 반경 안
    foe.x = 1_000; foe.y = 960;
    foe.targetId = ally.id; foe.attackCooldown = 0;
    const events = stepSkirmish(state, 1 / 60);
    const shared = events.filter((event) => event.kind === "damageShared");
    expect(shared).toHaveLength(1);
    expect(brika.hp).toBeLessThan(brika.maxHp);
    expect(brika.shield.amount).toBeGreaterThan(0);
    expect(brika.shield.amount).toBeLessThanOrEqual(brika.maxHp * 0.15 + 1e-6);
  });

  it("은 반경 밖 아군의 피해를 나누지 않는다", () => {
    const { state } = setup();
    const [brika, ally, foe] = state.fighters;
    brika.x = 1_000; brika.y = 1_700;
    ally.x = 1_000; ally.y = 1_000; // 700 — 반경 밖
    foe.x = 1_000; foe.y = 960;
    foe.targetId = ally.id; foe.attackCooldown = 0;
    const events = stepSkirmish(state, 1 / 60);
    expect(events.some((event) => event.kind === "damageShared")).toBe(false);
    expect(brika.hp).toBe(brika.maxHp);
  });

  it("의 막은 최대 체력 15%를 넘게 쌓이지 않는다", () => {
    const { state } = setup();
    const [brika, ally, foe] = state.fighters;
    brika.x = 1_000; brika.y = 1_400;
    ally.x = 1_000; ally.y = 1_000;
    ally.maxHp = 10_000_000; ally.hp = ally.maxHp;
    foe.x = 1_000; foe.y = 960;
    for (let swing = 0; swing < 30; swing += 1) {
      foe.targetId = ally.id; foe.attackCooldown = 0;
      brika.hp = brika.maxHp;
      stepSkirmish(state, 1 / 60);
    }
    expect(brika.shield.amount).toBeLessThanOrEqual(brika.maxHp * 0.15 + 1e-6);
  });
});

describe("브리카 — 우듬지 펼치기", () => {
  it("은 막을 두르고 5초 동안 넓은 반경 안 아군 피해의 절반을 대신 받는다", () => {
    const { state } = setup();
    const [brika, ally, foe] = state.fighters;
    brika.x = 1_000; brika.y = 1_700;
    ally.x = 1_000; ally.y = 1_000; // 700 — 그늘 밖, 궁극기 반경(760) 안
    foe.x = 1_000; foe.y = 960;
    brika.energy = brika.def.ultimate.cost;
    fireUltimate(state, brika.id);
    expect(brika.bulwark).toMatchObject({ percent: 50, radius: 760, total: 5 });
    expect(brika.shield.amount).toBeCloseTo(brika.maxHp * 0.15, 0);
    foe.targetId = ally.id; foe.attackCooldown = 0;
    const shared = stepSkirmish(state, 1 / 60).filter((event) => event.kind === "damageShared");
    expect(shared).toHaveLength(1);
  });
});

describe("브리카 — 폭주", () => {
  it("에 드는 순간 주위 적을 도발한다", () => {
    const { state } = setup();
    const [brika, , foe] = state.fighters;
    brika.x = 1_000; brika.y = 1_000;
    foe.x = 1_000; foe.y = 960;
    brika.ferocity = ferocityMaxOf(brika.def) - FEROCITY_RULES.hitGain;
    foe.targetId = brika.id; foe.attackCooldown = 0;
    stepSkirmish(state, 1 / 60);
    expect(brika.ferocityFever).toBe(true);
    expect(foe.taunted?.sourceId).toBe(brika.id);
  });
});

describe("브리카 — 한계 돌파(응태 2026-11-17)", () => {
  it("은 셋째 사슬 둔화 · 펼칠 때 밀어내기 · 폭주 큰 막 · 되갚는 그늘이다", () => {
    expect(getRelic("brika").breakthroughEffects).toEqual({
      basic: { kind: "chainSnare", slowPercent: 35, seconds: 2.5 },
      ultimate: { kind: "canopySweep", radius: 380, distance: 260 },
      ferocity: { kind: "protectiveGear", shieldMaxHpPercent: 35 },
      passive: { kind: "shadeRetort", storePercent: 150, capMaxHpPercent: 40 },
    });
  });

  it("II — 셋째 「땋은 사슬」이 도발과 함께 둔화를 건다", () => {
    const { state } = setup(["torika"], 4);
    const [brika, ally, foe] = state.fighters;
    ally.x = 200; ally.y = 200;
    brika.x = 1_000; brika.y = 1_100;
    foe.x = 1_000; foe.y = 1_000;
    for (let swing = 0; swing < 3; swing += 1) {
      brika.targetId = foe.id; brika.attackCooldown = 0; foe.hp = foe.maxHp;
      stepSkirmish(state, 1 / 60);
      if (swing < 2) expect(foe.chill).toBeNull();
    }
    expect(foe.chill).toMatchObject({ stacks: 1, speedPercentPerStack: 35 });
  });

  it("III — 「우듬지 펼치기」가 가까운 적을 밀어내고, 열리기 전에는 밀지 않는다", () => {
    for (const [breakthrough, pushed] of [[0, false], [4, true]] as const) {
      const { state } = setup(["torika"], breakthrough);
      const [brika, , foe] = state.fighters;
      brika.x = 1_000; brika.y = 1_000;
      foe.x = 1_000; foe.y = 900;
      brika.energy = brika.def.ultimate.cost;
      fireUltimate(state, brika.id);
      expect(foe.y < 900).toBe(pushed);
      expect(foe.stunnedFor).toBe(0);
    }
  });

  it("IV — 폭주에 드는 순간 제 몸에 큰 막을 두른다", () => {
    const { state } = setup(["torika"], 4);
    const [brika, , foe] = state.fighters;
    brika.x = 1_000; brika.y = 1_000;
    foe.x = 1_000; foe.y = 960;
    brika.ferocity = ferocityMaxOf(brika.def) - FEROCITY_RULES.hitGain;
    foe.targetId = brika.id; foe.attackCooldown = 0;
    stepSkirmish(state, 1 / 60);
    expect(brika.ferocityFever).toBe(true);
    expect(brika.shield.amount).toBeGreaterThan(brika.maxHp * 0.3);
  });

  it("V — 대신 받은 피해가 쌓였다가 다음 일반 공격에 고정 피해로 한꺼번에 얹힌다", () => {
    const { state } = setup(["torika"], 4);
    const [brika, ally, foe] = state.fighters;
    brika.x = 1_000; brika.y = 1_400;
    ally.x = 1_000; ally.y = 1_000;
    foe.x = 1_000; foe.y = 960;
    foe.targetId = ally.id; foe.attackCooldown = 0;
    const shared = stepSkirmish(state, 1 / 60).filter((event) => event.kind === "damageShared");
    expect(shared).toHaveLength(1);
    expect(brika.bt.shadeStored).toBeGreaterThan(0);
    const stored = Math.round(brika.bt.shadeStored);
    foe.attackCooldown = 99;
    brika.x = 1_000; brika.y = 1_100;
    brika.targetId = foe.id; brika.attackCooldown = 0;
    const released = stepSkirmish(state, 1 / 60).filter((event) => event.kind === "attack" && event.attackerId === brika.id && event.damageType === "true");
    expect(released).toHaveLength(1);
    expect(released[0]).toMatchObject({ amount: stored });
    expect(brika.bt.shadeStored).toBe(0);
  });

  it("V — 쌓이는 몫은 최대 체력 40%에서 멈춘다", () => {
    const { state } = setup(["torika"], 4);
    const [brika, ally, foe] = state.fighters;
    brika.x = 1_000; brika.y = 1_400;
    ally.x = 1_000; ally.y = 1_000; ally.maxHp = 10_000_000; ally.hp = ally.maxHp;
    foe.x = 1_000; foe.y = 960;
    for (let swing = 0; swing < 300; swing += 1) {
      foe.targetId = ally.id; foe.attackCooldown = 0; brika.hp = brika.maxHp;
      stepSkirmish(state, 1 / 60);
    }
    expect(brika.bt.shadeStored).toBeCloseTo(brika.maxHp * 0.4, 3);
  });

  it("의 문장은 네 칸 모두 자리 표시 없이 지어진다", () => {
    const brika = getRelic("brika");
    for (const slot of ["basic", "ultimate", "ferocity", "passive"] as const) {
      const text = breakthroughEffectText(brika, slot, brika.stats);
      expect(text).toBeDefined();
      expect(text).not.toMatch(/\{[a-z]+[^}]*\}/i);
    }
  });
});

describe("브리카 — 설명문", () => {
  it("의 패시브·궁극기·폭주 문장은 자리 표시 없이 지어진다", () => {
    const brika = getRelic("brika");
    for (const text of [passiveDescription(brika.passive, brika.stats.atk, { defense: brika.stats.def, resistance: brika.stats.res }, { ap: brika.stats.ap, maxHp: brika.stats.hp }), skillDescription(brika.ultimate, { maxHp: brika.stats.hp } as never), ferocityTraitDescription(brika.ferocityTrait)]) {
      expect(text).not.toMatch(/\{[a-z]+[^}]*\}/i);
      expect(text.length).toBeGreaterThan(10);
    }
  });
});
