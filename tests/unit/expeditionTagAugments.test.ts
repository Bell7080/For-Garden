import { describe, expect, it } from "vitest";
import { createSkirmish, stepSkirmish, fireUltimate, applyCombatStatusEffect, type SkirmishState } from "../../src/core/skirmish";
import { expeditionBattleEffects } from "../../src/core/expeditionBattle";
import { getRelic, RELICS } from "../../src/data/relics";
import { EXPEDITION_TAG_AUGMENTS, RETIRED_EXPEDITION_AUGMENTS } from "../../src/data/expeditionTagAugments";
import { generateExpeditionAugmentOffers } from "../../src/core/expeditionRewards";
import { expeditionAugmentKeywords } from "../../src/ui/expeditionAugmentKeywords";
import { expeditionAugmentEffectLabel } from "../../src/ui/expeditionAugmentBadges";
import { parseKeywordText } from "../../src/data/keywords";
import { unitStatusViews } from "../../src/ui/unitStatusModel";
import type { RelicDef } from "../../src/core/types";

function neutral(id: string): RelicDef {
  const base = getRelic("dodo");
  return { ...base, id, stats: { ...base.stats, hp: 1_000_000, atk: 200, ap: 200, def: 100, res: 100, critChance: 0, lifeSteal: 0, energyGain: 0, ferocityGain: 0 },
    passive: { ...base.passive, kind: "emergencyRecovery", value: 0 },
    basic: { ...base.basic, targeting: "single", damageType: "physical", power: 100, statusEffects: undefined, cycle: undefined },
    ultimate: { id: "test-ultimate", name: "test", iconAssetId: "skill-icon-physical", effectType: "physical", targeting: "single", damageType: "physical", power: 100, cost: 100 },
  };
}
function setup(id: string, options: { area?: boolean; combo?: boolean; foes?: number; nativeShell?: boolean; nativeReagent?: boolean } = {}) {
  const owner = options.nativeShell ? { ...getRelic("amo"), id: "owner", stats: { ...neutral("owner").stats } }
    : options.nativeReagent ? { ...getRelic("ripa"), id: "owner", stats: { ...neutral("owner").stats } } : neutral("owner");
  if (options.area) owner.basic = { ...owner.basic, targeting: "nearbyEnemies", radius: 500 };
  if (options.combo) owner.basic = { ...owner.basic, combo: { chancePercent: 100, hitCount: 5 } };
  const state = createSkirmish([owner], Array.from({ length: options.foes ?? 1 }, (_, i) => neutral(`foe-${i}`)), { left: 0, right: 600, top: 0, bottom: 1000 }, {}, {}, {
    augmentEffects: expeditionBattleEffects([{ augmentId: id, targetRelicId: "owner" }]),
  });
  position(state);
  return state;
}
function position(state: SkirmishState) {
  for (const [i, fighter] of state.fighters.entries()) {
    fighter.x = 300 + i; fighter.y = 500; fighter.attackCooldown = 999;
    fighter.ferocity = 0; fighter.ferocityFever = false;
  }
}
function attack(state: SkirmishState, index = 0) {
  position(state);
  state.fighters[index].attackCooldown = 0;
  return stepSkirmish(state, 1 / 60, () => 0.99);
}
function advance(state: SkirmishState, seconds: number) {
  position(state);
  const events = [];
  for (let remaining = seconds; remaining > 1e-8; remaining -= 0.1) events.push(...stepSkirmish(state, Math.min(0.1, remaining), () => 0.99));
  return events;
}

describe("범용 원정 태그 증강", () => {
  it("모든 신규 증강은 연계·치명타·타이밍·전용 후속 스킬을 요구하지 않는다", () => {
    expect(EXPEDITION_TAG_AUGMENTS.length).toBeGreaterThanOrEqual(30);
    for (const def of EXPEDITION_TAG_AUGMENTS) {
      expect(def.effect.kind).toBe("triggered");
      if (def.effect.kind !== "triggered") continue;
      expect(["onBasicHit", "onUltimateHit", "onUltimateCast", "onDamaged"]).toContain(def.effect.trigger);
      expect(def.effect.everyN).toBeGreaterThanOrEqual(1);
      expect(def.maxStacks).toBe(1);
      if (def.effect.trigger === "onBasicHit") expect(def.effect.everyN).toBeGreaterThanOrEqual(3);
    }
    const offers = generateExpeditionAugmentOffers({ rarity: "sr", relics: [{ relicId: "dodo", alive: true, currentHp: 100 }], selections: [], random: () => 0.5, candidateCount: 1000 });
    expect(offers.some(offer => RETIRED_EXPEDITION_AUGMENTS.has(offer.augmentId))).toBe(false);
  });

  it.each(EXPEDITION_TAG_AUGMENTS)("$id: 원본 태그 팝업 대신 실제 증강 수치와 제한을 표시한다", def => {
    const keywords = expeditionAugmentKeywords(def);
    expect(keywords).toHaveLength(1);
    expect(keywords[0].description).not.toMatch(/\{\w+\}|augment\.tag\./);
    const linked = parseKeywordText(expeditionAugmentEffectLabel(def), keywords).filter(segment => segment.keyword);
    expect(linked).toHaveLength(1);
    expect(linked[0].keyword).toBe(keywords[0]);
    expect(keywords[0].description).toContain("전투당 최대");
  });

  it("4타 주기·쿨다운·대상 변경을 실제 전투에서 지킨다", () => {
    const state = setup("tag-concussion-basic", { foes: 2 });
    const events = [];
    for (let i = 0; i < 3; i++) events.push(...attack(state));
    expect(events.filter(event => event.kind === "concussion")).toHaveLength(0);
    state.fighters[0].targetId = state.fighters[2].id;
    events.push(...attack(state));
    expect(events.filter(event => event.kind === "concussion")).toHaveLength(1);
    for (let i = 0; i < 4; i++) events.push(...attack(state));
    expect(events.filter(event => event.kind === "concussion")).toHaveLength(1);
    advance(state, 3);
    for (let i = 0; i < 4; i++) events.push(...attack(state));
    expect(events.filter(event => event.kind === "concussion")).toHaveLength(2);
  });

  it.each([{ area: true, foes: 6 }, { combo: true }])("광역·연격으로 카운터를 즉시 채우지 않는다: %j", options => {
    const state = setup("tag-concussion-basic", options);
    let events = attack(state);
    expect(events.some(event => event.kind === "concussion")).toBe(false);
    expect(state.fighters[0].augmentRuntime["0"].hits).toBe(1);
    for (let i = 0; i < 3; i++) events = attack(state);
    expect(events.filter(event => event.kind === "concussion")).toHaveLength(1);
  });

  it("6번째 직접 피격에 조가비 1겹, 12번째에 소비·보호막을 얻는다", () => {
    const state = setup("tag-shell-received");
    for (let i = 0; i < 5; i++) { attack(state, 1); advance(state, 1); }
    expect(state.fighters[0].augmentShellState).toBeNull();
    attack(state, 1);
    expect(state.fighters[0].augmentShellState?.stacks).toBe(1);
    expect(unitStatusViews(state.fighters[0]).some(view => view.key === "expedition-shell")).toBe(true);
    for (let i = 0; i < 6; i++) { advance(state, 1); attack(state, 1); }
    expect(state.fighters[0].augmentShellState).toBeNull();
    expect(state.fighters[0].shield.amount).toBeCloseTo(state.fighters[0].maxHp * 0.08);
  });

  it("보호막 흡수와 지속 피해는 피격 카운터에 포함하지 않는다", () => {
    const state = setup("tag-shell-received");
    const [owner, enemy] = state.fighters;
    owner.shield.amount = 10_000;
    for (let i = 0; i < 6; i++) attack(state, 1);
    expect(owner.augmentRuntime["0"]).toBeUndefined();
    owner.shield.amount = 0;
    applyCombatStatusEffect(owner, { kind: "poison", seconds: 8, attackPercentPerSecond: 1, abilityPercentPerSecond: 0 }, [], state, enemy.id);
    advance(state, 6);
    expect(owner.augmentRuntime["0"]).toBeUndefined();
  });

  it("조가비·시약 증강은 해당 패시브가 없는 캐릭터에서도 소비·반응한다", () => {
    const shell = setup("tag-shell-basic");
    for (let i = 0; i < 12; i++) { advance(shell, 0.6); attack(shell); }
    expect(shell.fighters[0].shield.amount).toBeGreaterThan(0);
    const reagent = setup("tag-reagent-basic");
    let reacted = false;
    for (let i = 0; i < 9; i++) { advance(reagent, 0.8); reacted ||= attack(reagent).some(event => event.kind === "combatEffect" && event.effect.tag === "reagentReaction"); }
    expect(reacted).toBe(true);
    expect(reagent.fighters[1].poison).not.toBeNull();
  });

  it("궁극기 증강은 평타로 발동하지 않고 광역 궁극기도 한 대상에게 한 번만 적용한다", () => {
    const state = setup("tag-concussion-ultimate", { foes: 6 });
    expect(attack(state).some(event => event.kind === "concussion")).toBe(false);
    const owner = state.fighters[0];
    owner.def = { ...owner.def, ultimate: { ...owner.def.ultimate, targeting: "battlefieldEnemies" } };
    owner.energy = 100;
    const events = fireUltimate(state, owner.id);
    expect(events.filter(event => event.kind === "concussion")).toHaveLength(1);
  });

  it("원본 조가비·시약과 증강의 누적을 분리한다", () => {
    const shell = setup("tag-shell-basic", { nativeShell: true });
    attack(shell, 1);
    expect(shell.fighters[0].shellGuard?.stacks).toBe(1);
    for (let i = 0; i < 4; i++) attack(shell);
    expect(shell.fighters[0].shellGuard?.stacks).toBe(1);
    expect(shell.fighters[0].augmentShellState?.stacks).toBe(1);
    const reagent = setup("tag-reagent-basic", { nativeReagent: true });
    for (let i = 0; i < 3; i++) attack(reagent);
    const keys = Object.keys(reagent.fighters[1].reagents);
    expect(keys.some(key => key.endsWith(":expedition"))).toBe(true);
    expect(reagent.fighters[0].def.passive.reagentReaction).toEqual(getRelic("ripa").passive.reagentReaction);
  });

  it("약한 증강이 기존 스킬의 강한 덧칠을 낮추지 않는다", () => {
    const state = setup("tag-overpaint-basic");
    const [owner, target] = state.fighters;
    applyCombatStatusEffect(target, { kind: "overpaint", seconds: 10, damageTakenPercent: 6, maxStacks: 4 }, [], state, owner.id);
    for (let i = 0; i < 4; i++) attack(state);
    expect(target.overpaint?.percentPerStack).toBe(6);
    expect(target.overpaint?.maxStacks).toBe(4);
  });

  it("불사 보스는 실제 무한 HP 대신 기준 체력과 25% 배율을 쓴다", () => {
    const state = setup("tag-concussion-ultimate");
    const [owner, target] = state.fighters;
    target.immortal = true; target.maxHp = target.hp = Number.MAX_SAFE_INTEGER; target.percentHpBasis = 10000;
    owner.energy = 100;
    const concussion = fireUltimate(state, owner.id).find(event => event.kind === "concussion");
    expect(concussion?.kind === "concussion" && concussion.amount).toBe(20);
  });

  it("여러 제공자의 뇌진탕도 대상별 10% 합산 상한을 공유한다", () => {
    const state = setup("tag-concussion-ultimate");
    const [owner, target] = state.fighters;
    state.augmentEffects = [{ kind: "triggered", trigger: "onUltimateHit", everyN: 1,
      payload: { kind: "status", status: { kind: "concussion", maxHpPercent: 2, criticalMaxHpPercent: 2 } },
      scope: { kind: "all" }, limits: { maxTriggers: 30, cooldownSeconds: 0, maxStacks: 1, target: "hitTarget" } }];
    const events = [];
    for (let i = 0; i < 12; i++) { position(state); owner.energy = 100; events.push(...fireUltimate(state, owner.id)); }
    expect(events.filter(event => event.kind === "concussion")).toHaveLength(5);
    expect(target.augmentFixedDamagePercent).toBe(10);
  });

  it("비공격 궁극기 보유자에게 적중형 증강을 제안하지 않는다", () => {
    const healer = RELICS.find(relic => relic.ultimate.damageType === undefined)!;
    expect(healer).toBeDefined();
    const offers = generateExpeditionAugmentOffers({ rarity: "ssr", relics: [{ relicId: healer.id, currentHp: 100, alive: true }], selections: [], random: () => 0.5, candidateCount: 1000 });
    expect(offers.some(offer => EXPEDITION_TAG_AUGMENTS.some(def => def.id === offer.augmentId && def.effect.kind === "triggered" && def.effect.trigger === "onUltimateHit"))).toBe(false);
  });

  it("회복 궁극기도 사용 후 강화가 발동하고 실패한 시전은 발동하지 않는다", () => {
    const state = setup("tag-tailwind-ultimate");
    const owner = state.fighters[0];
    const healing = RELICS.find(relic => relic.ultimate.healing !== undefined)!;
    owner.def = { ...owner.def, ultimate: healing.ultimate };
    owner.energy = 0;
    fireUltimate(state, owner.id);
    expect(owner.augmentRuntime["0"]).toBeUndefined();
    owner.energy = 100;
    fireUltimate(state, owner.id);
    expect(owner.augmentRuntime["0"].triggers).toBe(1);
    expect(owner.tailwind?.attackSpeedPercent).toBe(30);
    expect(unitStatusViews(owner).some(view => view.id === "tailwind")).toBe(true);
  });

  it("같은 재생 틱을 반복 초기화하거나 원본의 강한 재생을 약하게 덮지 않는다", () => {
    const state = setup("tag-regeneration-ultimate");
    const owner = state.fighters[0];
    owner.regeneration = { remaining: 10, tickIn: 0.4, percentPerTick: 5 };
    owner.energy = 100; fireUltimate(state, owner.id);
    expect(owner.regeneration).toEqual({ remaining: 10, tickIn: 0.4, percentPerTick: 5 });
    advance(state, 6);
    owner.regeneration = { remaining: 10, tickIn: 0.4, percentPerTick: 0.5 };
    owner.energy = 100; fireUltimate(state, owner.id);
    expect(owner.regeneration).toEqual({ remaining: 4, tickIn: 0.4, percentPerTick: 2 });
  });

  it("출혈은 더 강한 원본을 보존하고 증강 비율 피해의 남은 예산만 예약한다", () => {
    const state = setup("tag-bleed-basic");
    const [owner, target] = state.fighters;
    applyCombatStatusEffect(target, { kind: "bleed", seconds: 5, maxHpPercentPerSecond: 0.5 }, [], state, owner.id);
    for (let i = 0; i < 3; i++) attack(state);
    expect(state.fighters[1].bleed?.percent).toBe(0.5);
    expect(target.augmentFixedDamagePercent).toBe(0);
    target.bleed = null; target.augmentFixedDamagePercent = 9.9;
    advance(state, 3);
    for (let i = 0; i < 3; i++) attack(state);
    expect(target.augmentFixedDamagePercent).toBeCloseTo(10);
    expect(state.fighters[1].bleed?.percent).toBeCloseTo(0.05);
  });

  it("기절·광란·날려버림·빙결은 전용 개체 없이 실제 상태를 만든다", () => {
    for (const [id, field] of [["stun", "stunnedFor"], ["frenzy", "frenzy"], ["knockback", "knockback"], ["frozen", "frozen"]] as const) {
      const state = setup(`tag-${id}-ultimate`);
      const [owner, target] = state.fighters;
      owner.energy = 100; fireUltimate(state, owner.id);
      expect(target[field], id).toBeTruthy();
    }
  });

  it("순풍·오더·공명·보호막·은신은 자신의 슬롯에만 적용한다", () => {
    for (const id of ["tailwind", "order", "resonance", "shield", "stealth"] as const) {
      const state = setup(`tag-${id}-ultimate`);
      const [owner, target] = state.fighters;
      owner.energy = 100; fireUltimate(state, owner.id);
      if (id === "shield") { expect(owner.shield.amount).toBeGreaterThan(0); expect(target.shield.amount).toBe(0); }
      else if (id === "stealth") { expect(owner.stealthFor).toBe(1); expect(target.stealthFor).toBe(0); }
      else { expect(owner.tailwind?.kind).toBe(id); expect(target.tailwind).toBeNull(); }
    }
  });

  it("야성 추가 획득은 공용 성장 보정을 따르며 폭주를 무한 연장하지 않는다", () => {
    const enhanced = setup("tag-ferocity-ultimate");
    const plain = setup("tag-ferocity-ultimate"); plain.augmentEffects = [];
    for (const state of [enhanced, plain]) { const owner = state.fighters[0]; owner.energy = 100; fireUltimate(state, owner.id); }
    expect(enhanced.fighters[0].ferocity - plain.fighters[0].ferocity).toBeCloseTo(8);
    const owner = enhanced.fighters[0];
    advance(enhanced, 6); owner.ferocity = 60; owner.ferocityFever = true; owner.energy = 100;
    fireUltimate(enhanced, owner.id);
    expect(owner.ferocity).toBe(60);
  });

  it("피격 정화는 해로운 효과만 지우고 이로운 강화를 유지한다", () => {
    const state = setup("tag-cleanse-basic");
    const [owner, attacker] = state.fighters;
    owner.tailwind = { kind: "tailwind", attackSpeedPercent: 20, moveSpeedPercent: 20, seconds: 8 }; owner.tailwindFor = 8;
    applyCombatStatusEffect(owner, { kind: "stun", seconds: 5 }, [], state, attacker.id);
    applyCombatStatusEffect(owner, { kind: "bleed", seconds: 5, maxHpPercentPerSecond: 0.1 }, [], state, attacker.id);
    for (let i = 0; i < 5; i++) attack(state, 1);
    expect(owner.stunnedFor).toBe(0); expect(owner.bleed).toBeNull();
    expect(owner.tailwind?.kind).toBe("tailwind"); expect(owner.tailwindFor).toBeGreaterThan(0);
    expect(owner.augmentRuntime["0"].triggers).toBe(1);
  });

  it("흉터는 별도 이름으로 표시하고 조가비와 동시에 선택되지 않는다", () => {
    const state = setup("tag-scar-basic");
    for (let i = 0; i < 4; i++) attack(state, 1);
    expect(unitStatusViews(state.fighters[0]).some(view => view.id === "scar")).toBe(true);
    const offers = generateExpeditionAugmentOffers({ rarity: "sr", relics: [{ relicId: "dodo", currentHp: 100, alive: true }], selections: [{ augmentId: "tag-scar-basic", targetRelicId: "dodo" }], random: () => 0.5, candidateCount: 1000 });
    expect(offers.some(offer => offer.augmentId.startsWith("tag-shell-"))).toBe(false);
  });

  it("초고속 공격에서도 뇌진탕 발동 상한과 대상별 합산 상한을 넘지 않는다", () => {
    const state = setup("tag-concussion-ultimate");
    const owner = state.fighters[0];
    const events = [];
    for (let i = 0; i < 20; i++) {
      position(state); owner.energy = 100;
      events.push(...fireUltimate(state, owner.id));
      advance(state, 6);
    }
    expect(events.filter(event => event.kind === "concussion")).toHaveLength(8);
    expect(state.fighters[1].augmentFixedDamagePercent).toBeCloseTo(6.4);
  });
});
