import { describe, expect, it } from "vitest";
import { canPull, determineRarity, pull, pullCost, resolveAcquisitions, spend, type Banner, type Wallet } from "../../src/core/gacha";
import { BANNERS } from "../../src/data/banners";

/** 모든 분기와 난수 소비 순서를 눈으로 추적할 수 있는 최소 3등급 배너다. */
const banner: Banner = {
  id: "test", pityGroupId: "test-group", name: "시험 발굴", desc: "", featuredRelicId: "ssr-pick",
  currency: "fossil", costOne: 100, costTen: 900,
  rarityRates: { SSR: 0.1, SR: 0.2, R: 0.7 },
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
    expect(determineRarity(banner, 0)).toBe("SSR");
    expect(determineRarity(banner, 0.099999)).toBe("SSR");
    expect(determineRarity(banner, 0.1)).toBe("SR");
    expect(determineRarity(banner, 0.3)).toBe("R");
    expect(determineRarity(banner, 0.999999)).toBe("R");
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
    const result = pull({ ...banner, highestRarityGuarantee: 100 }, 10, { pullsSinceSsr: 0, pickupGuaranteed: false }, () => 0.99);
    expect(result.rarities.slice(0, 9)).toEqual(Array(9).fill("R"));
    expect(result.rarities[9]).toBe("SR");
  });

  it("천장 직전 슬롯은 자연 등급이고 도달 슬롯은 SSR로 강제한다", () => {
    const before = pull(banner, 1, { pullsSinceSsr: 3, pickupGuaranteed: false }, () => 0.99);
    expect(before.rarities).toEqual(["R"]);
    expect(before.pity.pullsSinceSsr).toBe(4);
    const reached = pull(banner, 1, before.pity, () => 0.99);
    expect(reached.rarities).toEqual(["SSR"]);
    expect(reached.pity.pullsSinceSsr).toBe(0);
  });

  it("10연 SR 보장 슬롯이어도 천장 도달이면 SSR이 우선한다", () => {
    const result = pull(banner, 10, { pullsSinceSsr: 0, pickupGuaranteed: false }, () => 0.99);
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

  it("처음 획득과 중복을 분리한다", () => {
    const outcome = resolveAcquisitions(new Set(["r-a"]), { "r-a": 4 }, ["r-b", "r-b", "r-a", "r-a"]);
    expect(outcome.slots).toEqual([
      { relicId: "r-b", kind: "new", dnaBefore: 0, dnaAfter: 0, overflowFragments: 0 },
      { relicId: "r-b", kind: "mastery", dnaBefore: 0, dnaAfter: 1, overflowFragments: 0 },
      { relicId: "r-a", kind: "mastery", dnaBefore: 4, dnaAfter: 5, overflowFragments: 0 },
      { relicId: "r-a", kind: "overflow", dnaBefore: 5, dnaAfter: 5, overflowFragments: 1 },
    ]);
    expect(outcome.newRelicIds).toEqual(["r-b"]);
    expect(outcome.duplicateRelicIds).toEqual(["r-b", "r-a", "r-a"]);
  });
});

describe("운영 배너 데이터", () => {
  it("모든 운영 배너의 SSR 천장은 100회다", () => {
    // 문서와 UI가 같은 정적 운영값을 읽도록 과거 80회 값의 회귀를 막는다.
    expect(BANNERS.every((candidate) => candidate.highestRarityGuarantee === 100)).toBe(true);
  });
  it("픽업과 대표 렐릭이 해당 등급 풀에 있고 확률 합계가 1이다", () => {
    for (const candidate of BANNERS) {
      expect(Object.values(candidate.rarityRates).reduce((sum, rate) => sum + rate, 0)).toBeCloseTo(1);
      const allPools = Object.values(candidate.relicPools).flat();
      expect(allPools).toContain(candidate.featuredRelicId);
      for (const ids of Object.values(candidate.pickupRelicIds)) for (const id of ids) expect(allPools).toContain(id);
    }
  });
});
