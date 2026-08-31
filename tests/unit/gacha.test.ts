import { describe, expect, it } from "vitest";
import { calculateBannerExpectations, canPull, determineGrade, pull, pullCost, resolveAcquisitions, spend, type Banner, type Wallet } from "../../src/core/gacha";
import { BANNERS } from "../../src/data/banners";

/** 모든 분기와 난수 소비 순서를 눈으로 추적할 수 있는 최소 3등급 배너다. */
const banner: Banner = {
  id: "test", pityGroupId: "test-group", name: "시험 발굴", featuredRelicId: "ssr-pick",
  currency: "fossil", costOne: 100, costTen: 900,
  slotRates: { SSR: 0.1, SR: 0.2, R: 0.6, GRAY: 0.1 },
  grayRewards: [{ kind: "gold", min: 10, max: 20, weight: 1 }, { kind: "cheesecake", min: 2, max: 4, weight: 1 }],
  relicPools: { SSR: ["ssr-pick", "ssr-normal"], SR: ["sr-pick", "sr-normal"], R: ["r-a", "r-b"] },
  pickupRelicIds: { SSR: ["ssr-pick"], SR: ["sr-pick"] },
  pickupRate: 0.5, highestRarityGuarantee: 5,
};

function fakeRng(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

describe("뽑기 비용", () => {
  it("10회 할인과 잔액 경계를 계산한다", () => {
    expect(pullCost(banner, 1)).toBe(100);
    expect(pullCost(banner, 10)).toBe(900);
    expect(canPull({ fossil: 100, amber: 0, gems: 0, gold: 0, stamina: 0, dnaFragments: 0, cheesecake: 0 }, banner, 1)).toBe(true);
    expect(canPull({ fossil: 99, amber: 999, gems: 0, gold: 0, stamina: 0, dnaFragments: 0, cheesecake: 0 }, banner, 1)).toBe(false);
  });
});

describe("등급과 픽업 추첨 순서", () => {
  it("누적 확률 경계값은 다음 등급에 포함한다", () => {
    expect(determineGrade(banner, 0)).toBe("SSR");
    expect(determineGrade(banner, 0.099999)).toBe("SSR");
    expect(determineGrade(banner, 0.1)).toBe("SR");
    expect(determineGrade(banner, 0.3)).toBe("R");
    expect(determineGrade(banner, 0.899999)).toBe("R");
    expect(determineGrade(banner, 0.9)).toBe("GRAY");
  });

  it("등급 결정 뒤 픽업 성공과 비픽업 성공을 각각 분리한다", () => {
    expect(pull(banner, 1, { pullsSinceSsr: 0, pickupGuaranteed: false }, fakeRng([0.05, 0.49, 0])).relicIds).toEqual(["ssr-pick"]);
    expect(pull(banner, 1, { pullsSinceSsr: 0, pickupGuaranteed: false }, fakeRng([0.05, 0.5, 0])).relicIds).toEqual(["ssr-normal"]);
  });

  it("같은 난수열과 천장값이면 같은 결과와 다음 천장값을 반환한다", () => {
    const a = pull(banner, 3, { pullsSinceSsr: 0, pickupGuaranteed: false }, fakeRng([0.8, 0, 0.2, 0.1, 0, 0.8, 0]));
    const b = pull(banner, 3, { pullsSinceSsr: 0, pickupGuaranteed: false }, fakeRng([0.8, 0, 0.2, 0.1, 0, 0.8, 0]));
    expect(a).toEqual(b);
  });
});

describe("보장 우선순위와 천장", () => {
  it("10연 마지막 슬롯의 R을 SR로 올린다", () => {
    const result = pull({ ...banner, highestRarityGuarantee: 100 }, 10, { pullsSinceSsr: 0, pickupGuaranteed: false }, () => 0.8);
    expect(result.rarities.slice(0, 9)).toEqual(Array(9).fill("R"));
    expect(result.rarities[9]).toBe("SR");
  });

  it("10연 마지막 회색 슬롯도 보상 난수를 쓰지 않고 SR로 올린다", () => {
    let calls = 0;
    const result = pull({ ...banner, highestRarityGuarantee: 100 }, 10, { pullsSinceSsr: 0, pickupGuaranteed: false }, () => { calls += 1; return 0.95; });
    expect(result.slots[9]).toMatchObject({ kind: "relic", rarity: "SR" });
    // 앞선 회색 9칸은 각 3회, 승격 SR은 등급+픽업 판정+렐릭 선택 3회만 소비한다.
    expect(calls).toBe(30);
  });

  it("회색 수량은 양 끝을 포함하고 비SSR 천장을 증가시킨다", () => {
    const minimum = pull(banner, 1, { pullsSinceSsr: 2, pickupGuaranteed: false }, fakeRng([0.95, 0, 0]));
    const maximum = pull(banner, 1, { pullsSinceSsr: 2, pickupGuaranteed: false }, fakeRng([0.95, 0, 0.999999]));
    const cakeMinimum = pull(banner, 1, { pullsSinceSsr: 0, pickupGuaranteed: false }, fakeRng([0.95, 0.999999, 0]));
    const cakeMaximum = pull(banner, 1, { pullsSinceSsr: 0, pickupGuaranteed: false }, fakeRng([0.95, 0.999999, 0.999999]));
    expect(minimum.slots).toEqual([{ kind: "currency", currency: "gold", amount: 10, grade: "GRAY" }]);
    expect(maximum.slots).toEqual([{ kind: "currency", currency: "gold", amount: 20, grade: "GRAY" }]);
    expect(cakeMinimum.slots).toEqual([{ kind: "currency", currency: "cheesecake", amount: 2, grade: "GRAY" }]);
    expect(cakeMaximum.slots).toEqual([{ kind: "currency", currency: "cheesecake", amount: 4, grade: "GRAY" }]);
    expect(minimum.pity.pullsSinceSsr).toBe(3);
  });

  it("천장 직전 슬롯은 자연 등급이고 도달 슬롯은 SSR로 강제한다", () => {
    const before = pull(banner, 1, { pullsSinceSsr: 3, pickupGuaranteed: false }, () => 0.8);
    expect(before.rarities).toEqual(["R"]);
    expect(before.pity.pullsSinceSsr).toBe(4);
    const reached = pull(banner, 1, before.pity, () => 0.8);
    expect(reached.rarities).toEqual(["SSR"]);
    expect(reached.pity.pullsSinceSsr).toBe(0);
  });

  it("10연 SR 보장 슬롯이어도 천장 도달이면 SSR이 우선한다", () => {
    const result = pull(banner, 10, { pullsSinceSsr: 0, pickupGuaranteed: false }, () => 0.8);
    expect(result.rarities[4]).toBe("SSR");
    expect(result.rarities[9]).toBe("SSR");
    expect(result.pity.pullsSinceSsr).toBe(0);
  });

  it("자연 SSR을 얻은 직후 천장 카운터를 0으로 초기화한다", () => {
    expect(pull(banner, 1, { pullsSinceSsr: 3, pickupGuaranteed: false }, fakeRng([0.05, 0, 0])).pity.pullsSinceSsr).toBe(0);
  });

  it("SSR 픽업 실패는 카운터와 별개로 다음 SSR 픽업 확정을 켠다", () => {
    const failed = pull(banner, 1, { pullsSinceSsr: 0, pickupGuaranteed: false }, fakeRng([0.05, 0.8, 0]));
    expect(failed.relicIds).toEqual(["ssr-normal"]);
    expect(failed.pity).toEqual({ pullsSinceSsr: 0, pickupGuaranteed: true });
    // 확정 상태에서는 픽업 판정 난수 없이 픽업 풀 선택 난수만 소비한다.
    const guaranteed = pull(banner, 1, failed.pity, fakeRng([0.05, 0]));
    expect(guaranteed.relicIds).toEqual(["ssr-pick"]);
    expect(guaranteed.pity.pickupGuaranteed).toBe(false);
  });
});

describe("재화와 보유 반영", () => {
  it("원본 지갑은 바꾸지 않고 비용만 차감한다", () => {
    const wallet: Wallet = { fossil: 1000, amber: 5, gems: 0, gold: 0, stamina: 0, dnaFragments: 2, cheesecake: 0 };
    expect(spend(wallet, banner, 1)).toEqual({ fossil: 900, amber: 5, gems: 0, gold: 0, stamina: 0, dnaFragments: 2, cheesecake: 0 });
    expect(wallet.fossil).toBe(1000);
  });

  it("처음 획득은 파편을 주지 않고 중복만 그 개체의 파편으로 쌓는다", () => {
    const outcome = resolveAcquisitions(new Set(["r-a"]), { "r-a": 4 }, ["r-b", "r-b", "r-a", "r-a"]);
    expect(outcome.slots).toEqual([
      { relicId: "r-b", kind: "new", fragments: 0, overflowFragments: 0 },
      { relicId: "r-b", kind: "fragment", fragments: 1, overflowFragments: 0 },
      { relicId: "r-a", kind: "fragment", fragments: 1, overflowFragments: 0 },
      { relicId: "r-a", kind: "fragment", fragments: 1, overflowFragments: 0 },
    ]);
    expect(outcome.fragmentsById).toEqual({ "r-a": 6, "r-b": 1 });
    expect(outcome.newRelicIds).toEqual(["r-b"]);
    expect(outcome.duplicateRelicIds).toEqual(["r-b", "r-a", "r-a"]);
  });

  it("별 다섯에 닿은 개체의 중복만 공용 DNA 조각으로 바뀐다", () => {
    const outcome = resolveAcquisitions(new Set(["r-a"]), {}, ["r-a", "r-a"], { "r-a": 5 });
    expect(outcome.slots.every(({ kind }) => kind === "overflow")).toBe(true);
    expect(outcome.overflowFragments).toBe(2);
    expect(outcome.fragmentsById["r-a"]).toBeUndefined();
  });
});

describe("운영 배너 데이터", () => {
  it("모든 운영 배너의 SSR 천장은 100회다", () => {
    // 문서와 UI가 같은 정적 운영값을 읽도록 과거 80회 값의 회귀를 막는다.
    expect(BANNERS.every((candidate) => candidate.highestRarityGuarantee === 100)).toBe(true);
  });
  it("픽업과 대표 렐릭이 해당 등급 풀에 있고 확률 합계가 1이다", () => {
    for (const candidate of BANNERS) {
      expect(Object.values(candidate.slotRates).reduce((sum, rate) => sum + rate, 0)).toBe(1);
      for (const reward of candidate.grayRewards) expect(reward.min).toBeLessThanOrEqual(reward.max);
      const allPools = Object.values(candidate.relicPools).flat();
      expect(allPools).toContain(candidate.featuredRelicId);
      for (const ids of Object.values(candidate.pickupRelicIds)) for (const id of ids) expect(allPools).toContain(id);
    }
  });

  it("R 이상 렐릭과 회색 보상의 기대값이 운영 목표 범위 안이다", () => {
    // 범위는 economy-design.md의 독립 슬롯 목표를 허용 오차와 함께 기계적으로 고정한다.
    const targets = {
      fossil: { relicRPlus: [0.849, 0.851], gold: [224, 226], cheesecake: [0.37, 0.38] },
      amber: { relicRPlus: [0.849, 0.851], gold: [549, 551], cheesecake: [1.12, 1.13] },
    } as const;

    for (const candidate of BANNERS) {
      const expected = calculateBannerExpectations(candidate);
      const target = targets[candidate.id as keyof typeof targets];
      // 새 운영 배너는 목표 범위를 먼저 명시해야 검증을 우회할 수 없다.
      expect(target).toBeDefined();
      expect(expected.relicRPlus).toBeGreaterThanOrEqual(target.relicRPlus[0]);
      expect(expected.relicRPlus).toBeLessThanOrEqual(target.relicRPlus[1]);
      expect(expected.gold).toBeGreaterThanOrEqual(target.gold[0]);
      expect(expected.gold).toBeLessThanOrEqual(target.gold[1]);
      expect(expected.cheesecake).toBeGreaterThanOrEqual(target.cheesecake[0]);
      expect(expected.cheesecake).toBeLessThanOrEqual(target.cheesecake[1]);
    }
  });

  it("1회 기대값을 10회 분석 값으로 선형 합산한다", () => {
    for (const candidate of BANNERS) {
      const once = calculateBannerExpectations(candidate, 1);
      const ten = calculateBannerExpectations(candidate, 10);
      expect(ten).toEqual({
        pulls: 10,
        relicRPlus: once.relicRPlus * 10,
        gold: once.gold * 10,
        cheesecake: once.cheesecake * 10,
      });
    }
  });
});
