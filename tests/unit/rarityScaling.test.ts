import { describe, expect, it } from "vitest";
import { combatPower } from "../../src/core/combatPower";
import { applyLevelGrowth, RELIC_LEVEL_CAP } from "../../src/core/relicProgression";
import { COMMON_SECONDARY_STATS, RARITY_LEVEL_GROWTH, RARITY_ORDER, RARITY_STAT_BAND, withinRarityBand } from "../../src/core/rarityScaling";
import { getRelic, PLAYABLE_RELICS, RELICS } from "../../src/data/relics";
import type { RelicDef, Stats } from "../../src/core/types";

/** 상속 없이 각 정체성이 직접 소유해야 하는 전투 정의의 최상위 필드다. */
const REQUIRED_IDENTITY_FIELDS = ["stats", "passive", "ferocityTrait", "basic", "ultimate", "element", "role"] as const;

/** 선택 관계가 있어도 완전한 독립 정의인지 own-property 기준으로 검사한다. */
function expectCompleteIdentity(relic: RelicDef): void {
  for (const field of REQUIRED_IDENTITY_FIELDS) {
    expect(Object.hasOwn(relic, field), `${relic.id} owns ${field}`).toBe(true);
    expect(relic[field], `${relic.id} defines ${field}`).toBeDefined();
  }
}

describe("적 및 강화형 캐릭터 정체성", () => {
  it("은 적 전용 캐릭터도 필수 능력치와 스킬을 완전하게 직접 소유한다", () => {
    const enemies = RELICS.filter((relic) => relic.enemyOnly === true);
    expect(enemies.map(({ id }) => id)).toContain("husk-koma");
    for (const enemy of enemies) expectCompleteIdentity(enemy);
  });

  it("은 baseIdentityId가 있어도 원본 정의를 런타임에서 합성하지 않는다", () => {
    const base = getRelic("amo");
    // 실제 강화형 추가 전에도 계약을 검증하는 완전한 예제다. spread는 작성 편의를 위한 테스트
    // 준비일 뿐이며, own-property 검사 대상 필드는 모두 강화형 객체가 직접 소유한다.
    const enraged: RelicDef = {
      ...base,
      id: "amo-enraged",
      baseIdentityId: base.id,
      name: "분노 아모",
      stats: { ...base.stats, atk: base.stats.atk + 20 },
      passive: { ...base.passive, id: "amo-enraged-passive" },
      ferocityTrait: { ...base.ferocityTrait },
      basic: { ...base.basic, id: "amo-enraged-basic" },
      ultimate: { ...base.ultimate, id: "amo-enraged-ult" },
    };

    expectCompleteIdentity(enraged);
    expect(enraged.baseIdentityId).toBe(base.id);
    expect(enraged.stats).not.toBe(base.stats);
    expect(enraged.basic).not.toBe(base.basic);
    // 관계 필드는 조회 별칭이 아니다. 등록되지 않은 강화형 ID는 원본으로 폴백하지 않는다.
    expect(() => getRelic(enraged.id)).toThrow("알 수 없는 렐릭 id");
  });
});

describe("등급별 태생 능력치", () => {
  it("의 세 띠는 겹치지 않고 R → SR → SSR 순서로 올라간다", () => {
    // 띠가 겹치면 "SSR인데 SR보다 약한" 개체가 규칙을 통과해 버린다.
    for (const [index, rarity] of RARITY_ORDER.entries()) {
      const band = RARITY_STAT_BAND[rarity];
      expect(band.min, rarity).toBeLessThan(band.max);
      const previous = RARITY_ORDER[index - 1];
      if (previous) expect(band.min, rarity).toBeGreaterThan(RARITY_STAT_BAND[previous].max);
    }
  });

  it("의 모든 플레이어블 렐릭은 제 등급 띠 안에 든다", () => {
    // 새 개체를 띠 밖 수치로 넣으면 여기서 걸린다 — 등급이 뽑을 이유를 말하지 못하기 때문이다.
    for (const relic of PLAYABLE_RELICS) {
      const power = combatPower(relic.stats);
      const band = RARITY_STAT_BAND[relic.rarity];
      expect(withinRarityBand(power, relic.rarity), `${relic.name} ${relic.rarity} ${power} (${band.min}~${band.max})`).toBe(true);
    }
  });

  it("은 매디의 SR 강등과 완화된 방어형 전사 능력치를 고정한다", () => {
    // 등급만 낮추거나 수치만 낮추는 반쪽 변경이 다시 들어오지 않도록 두 계약을 함께 검증한다.
    const maddy = getRelic("maddy");
    expect(maddy.rarity).toBe("SR");
    expect(maddy.stats).toMatchObject({ hp: 980, def: 82, res: 82, atk: 136, ap: 64 });
    expect(combatPower(maddy.stats)).toBe(2304);
    expect(withinRarityBand(combatPower(maddy.stats), maddy.rarity)).toBe(true);
  });

  it("의 공멸 신규 3개체도 적 전용 예외 없이 R 띠와 지정 역할을 지킨다", () => {
    // 세 개체는 플레이어블 목록 밖에 있어도 영구 캐릭터이므로 ID별 계약을 명시적으로 고정한다.
    const identities = [
      { id: "toby", element: "fire", role: "warrior" },
      { id: "amo", element: "earth", role: "tank" },
      { id: "ripa", element: "water", role: "support" },
    ] as const;

    for (const identity of identities) {
      const relic = getRelic(identity.id);
      const power = combatPower(relic.stats);
      expect(relic.rarity, identity.id).toBe("R");
      expect(withinRarityBand(power, "R"), `${identity.id} R ${power}`).toBe(true);
      expect(relic.element, identity.id).toBe(identity.element);
      expect(relic.role, identity.id).toBe(identity.role);
    }
  });

  it("의 등급별 최저 태생이 한 단계 아래 등급의 최고 태생보다 높다", () => {
    const best = new Map(RARITY_ORDER.map((rarity) => [rarity, PLAYABLE_RELICS.filter((r) => r.rarity === rarity).map((r) => combatPower(r.stats))] as const));
    for (const [index, rarity] of RARITY_ORDER.entries()) {
      const previous = RARITY_ORDER[index - 1];
      const here = best.get(rarity)!; const below = previous ? best.get(previous)! : [];
      if (here.length === 0 || below.length === 0) continue;
      expect(Math.min(...here), `${previous} 최고 < ${rarity} 최저`).toBeGreaterThan(Math.max(...below));
    }
  });
});

describe("공통 부가 능력치", () => {
  const KEYS = Object.keys(COMMON_SECONDARY_STATS) as (keyof typeof COMMON_SECONDARY_STATS)[];

  it("은 치명타·흡혈·충전량을 모든 개체가 같은 값으로 쓴다", () => {
    // 오각형에 보이지 않는 곳에서 총량이 갈리면 같은 등급끼리도 세기가 어긋난다.
    // 이 수치가 필요한 개체는 렉시아처럼 패시브나 폭주로 끌어다 쓴다.
    for (const relic of PLAYABLE_RELICS) {
      for (const key of KEYS) expect(relic.stats[key], `${relic.name} ${key}`).toBe(COMMON_SECONDARY_STATS[key]);
    }
  });

  it("은 공멸 신규 3개체도 모든 공용 부가 능력치를 정확히 따른다", () => {
    // 적 전용 개체는 PLAYABLE_RELICS 순회에 포함되지 않으므로 신규 ID를 따로 회귀 검증한다.
    for (const id of ["toby", "amo", "ripa"] as const) {
      const relic = getRelic(id);
      for (const key of KEYS) expect(relic.stats[key], `${id} ${key}`).toBe(COMMON_SECONDARY_STATS[key]);
    }
  });

  it("은 공격 속도·이동 속도는 공통 표에 넣지 않고 개체마다 다르게 둔다", () => {
    // 그 둘은 난전에서 눈에 보이는 움직임이라 다르게 섞는 것이 곧 정체성이다.
    expect(Object.keys(COMMON_SECONDARY_STATS)).not.toContain("attackSpeed");
    expect(Object.keys(COMMON_SECONDARY_STATS)).not.toContain("moveSpeed");
    expect(new Set(PLAYABLE_RELICS.map((r) => r.stats.attackSpeed)).size).toBeGreaterThan(3);
    expect(new Set(PLAYABLE_RELICS.map((r) => r.stats.moveSpeed)).size).toBeGreaterThan(3);
  });
});

describe("등급별 레벨 성장", () => {
  it("은 등급이 높을수록 레벨당 더 가파르다", () => {
    for (const [index, rarity] of RARITY_ORDER.entries()) {
      const previous = RARITY_ORDER[index - 1];
      if (previous) expect(RARITY_LEVEL_GROWTH[rarity], rarity).toBeGreaterThan(RARITY_LEVEL_GROWTH[previous]);
    }
  });

  it("은 레벨 1에서는 태생 그대로이고 상한에서 등급 차이가 태생보다 벌어진다", () => {
    const base: Stats = { hp: 1000, def: 100, res: 100, atk: 100, ap: 100, attackSpeed: 100, moveSpeed: 100, critChance: 10, critDamage: 150, energyGain: 26, lifeSteal: 0, ferocityGain: 0 };
    for (const rarity of RARITY_ORDER) expect(applyLevelGrowth(base, 1, rarity)).toEqual(base);
    const r = applyLevelGrowth(base, RELIC_LEVEL_CAP, "R").hp;
    const ssr = applyLevelGrowth(base, RELIC_LEVEL_CAP, "SSR").hp;
    // 태생 차이(약 10%)에 성장 차이가 얹혀 상한에서 한 뼘 더 벌어진다.
    expect(ssr).toBeGreaterThan(r);
    expect(ssr / r).toBeGreaterThan(1.05);
    expect(ssr / r).toBeLessThan(1.10);
  });
});

describe("치명타형 정체성", () => {
  it("은 태생이 아니라 패시브에서 나온다", () => {
    // 태생 치명타는 전 개체 공통이므로, 암살자·전사의 치명타형 성격은 읽히는 스킬이 만든다.
    const sources = PLAYABLE_RELICS.filter((relic) => relic.passive.criticalChancePercent !== undefined);
    expect(sources.map((relic) => [relic.id, relic.passive.criticalChancePercent])).toEqual([
      ["rex", 25], ["spino", 10], ["luka", 15], ["delopi", 5], ["parua", 12],
    ]);
    // 값이 있는 개체는 태생 공통값 위에 그만큼을 더한 확률로 싸운다.
    for (const relic of sources) {
      expect(relic.stats.critChance + relic.passive.criticalChancePercent!, relic.name).toBeGreaterThan(COMMON_SECONDARY_STATS.critChance);
    }
  });
});
