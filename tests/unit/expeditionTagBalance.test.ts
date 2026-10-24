import { afterAll, describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { createSkirmish, stepSkirmish, fireUltimate, attackInterval } from "../../src/core/skirmish";
import { expeditionBattleEffects } from "../../src/core/expeditionBattle";
import { getRelic } from "../../src/data/relics";
import { EXPEDITION_TAG_AUGMENTS } from "../../src/data/expeditionTagAugments";
import type { RelicDef } from "../../src/core/types";

const rows: object[] = [];
function unit(id: string, attackSpeed: number): RelicDef {
  const base = getRelic("dodo");
  return { ...base, id, stats: { ...base.stats, hp: 1_000_000, atk: 200, ap: 200, def: 300, res: 300, attackSpeed, critChance: 0, energyGain: 0, ferocityGain: 0, lifeSteal: 0 },
    passive: { id: "test-passive", name: "test", iconAssetId: "skill-icon-buff", effectType: "buff", kind: "summonDerived", value: 0, desc: "" },
    basic: { id: "test-basic", name: "test", iconAssetId: "skill-icon-physical", effectType: "physical", targeting: "single", damageType: "physical", power: 100 },
    ultimate: { id: "test-ult", name: "test", iconAssetId: "skill-icon-physical", effectType: "physical", targeting: "single", damageType: "physical", power: 100, cost: 100 },
  };
}
function simulate(augmentId: string | undefined, speed: number, form: "single" | "area" | "combo" | "magic", foes: number) {
  const owner = unit("owner", speed);
  if (form === "area") owner.basic = { ...owner.basic, targeting: "nearbyEnemies", radius: 600 };
  if (form === "combo") owner.basic = { ...owner.basic, combo: { chancePercent: 100, hitCount: 5 } };
  if (form === "magic") {
    const magic = { id: "test-magic", name: "test", iconAssetId: "skill-icon-magical" as const, effectType: "magical" as const,
      targeting: "single" as const, damageType: "magical" as const, scalingStat: "ap" as const, power: 100 };
    owner.basic = magic; owner.ultimate = { ...magic, cost: 100 };
  }
  const state = createSkirmish([owner], Array.from({ length: foes }, (_, i) => unit(`foe-${i}`, 100)), { left: 0, right: 600, top: 0, bottom: 1000 }, {}, {}, {
    augmentEffects: augmentId ? expeditionBattleEffects([{ augmentId, targetRelicId: owner.id }]) : [],
  });
  for (const fighter of state.fighters) {
    fighter.x = 300; fighter.y = 500; fighter.percentHpBasis = 10000;
    if (fighter.side === "enemy") { fighter.attackCooldown = 999; fighter.def = { ...fighter.def, stats: { ...fighter.def.stats, atk: 10 } }; }
  }
  const player = state.fighters[0];
  player.maxHp = 2000; player.hp = 2000;
  let ultimates = 0, directHits = 0, controlSeconds = 0, statusEvents = 0;
  for (let frame = 0; frame < 600; frame++) {
    // 접근·이동 시간을 제외한 동일 접촉 조건. 원종의 폭주 효과도 제거한다.
    for (const fighter of state.fighters) { fighter.x = 300; fighter.y = 500; fighter.ferocity = 0; fighter.ferocityFever = false; }
    if (frame > 0 && frame % 180 === 0) { player.energy = 100; fireUltimate(state, player.id, () => 0.99); ultimates++; }
    // 피격형도 검증할 수 있도록 적 한 명에게 1.5초마다 직접 타격 기회를 준다.
    if (frame % 45 === 0) state.fighters[1].attackCooldown = 0;
    const events = stepSkirmish(state, 1 / 30, () => 0.99);
    directHits += events.filter(event => event.kind === "attack" && event.attackerId === player.id && event.skill === "basic").length;
    statusEvents += events.filter(event => event.kind !== "attack").length;
    const target = state.fighters[1];
    if (target.stunnedFor > 0 || target.staggeredFor > 0 || target.fear !== null || target.sleep !== null || target.frozen !== null || target.frenzy !== null || target.knockback !== null) controlSeconds += 1 / 30;
  }
  return { damage: state.fighters.filter(fighter => fighter.side === "enemy").reduce((sum, fighter) => sum + fighter.maxHp - fighter.hp, 0),
    triggers: player.augmentRuntime["0"]?.triggers ?? 0, countedActions: player.augmentRuntime["0"]?.hits ?? 0,
    fixedHpPercent: Math.max(...state.fighters.map(fighter => fighter.augmentFixedDamagePercent)),
    controlSeconds, directHits, statusEvents, ultimates, interval: attackInterval(player, state),
    shield: player.shield.amount, hp: player.hp,
  };
}

describe("원정 태그 실제 전투 밸런스 행렬", () => {
  for (const speed of [60, 100, 200, 400]) for (const form of ["single", "area", "combo", "magic"] as const) for (const foes of [1, 6]) {
    it(`공속 ${speed} / ${form} / 적 ${foes}: ${EXPEDITION_TAG_AUGMENTS.length}종의 발동·고정피해·제어 상한`, () => {
      const baseline = simulate(undefined, speed, form, foes);
      for (const def of EXPEDITION_TAG_AUGMENTS) {
        const result = simulate(def.id, speed, form, foes);
        expect(result.damage, def.id).toBeGreaterThan(0);
        expect(Number.isFinite(result.damage), def.id).toBe(true);
        if (def.effect.kind !== "triggered") continue;
        expect(result.triggers, def.id).toBeLessThanOrEqual(def.effect.limits.maxTriggers);
        expect(result.triggers, def.id).toBeGreaterThan(0);
        expect(result.fixedHpPercent, def.id).toBeLessThanOrEqual(10);
        expect(result.controlSeconds, def.id).toBeLessThan(4);
        // 광역/연격의 적중 수는 늘어도 행동 카운터는 단일 공격의 시간 상한 안에 남는다.
        expect(result.countedActions, def.id).toBeLessThanOrEqual(def.effect.trigger === "onDamaged" ? 14 : def.effect.trigger === "onUltimateHit" || def.effect.trigger === "onUltimateCast" ? 3 : Math.ceil(20 / (1.5 / (speed / 100 * 1.36))) + 5);
        rows.push({ id: def.id, speed, form, foes, ...result, damageGainPercent: Math.round((result.damage / baseline.damage - 1) * 1000) / 10 });
      }
    });
  }
});

afterAll(() => {
  if (process.env.PF_WRITE_TAG_BALANCE === "1") {
    const directory = process.env.PF_TAG_REPORT_DIR ?? "work";
    mkdirSync(directory, { recursive: true });
    writeFileSync(`${directory}/tag-balance.json`, JSON.stringify(rows, null, 2));
  }
});
