import { describe, expect, it } from "vitest";
import { applyPull, canPull, pull, pullCost, spend, type Banner, type Wallet } from "../../src/core/gacha";
import { BANNERS } from "../../src/data/banners";

const banner: Banner = {
  id: "test",
  name: "시험 발굴",
  desc: "",
  // 대표 렐릭은 확률 계산과 무관하지만 실제 Banner 계약을 그대로 검증한다.
  featuredRelicId: "a",
  currency: "fossil",
  costOne: 100,
  costTen: 900,
  pool: ["a", "b", "c"],
};

/** 0, 0.5, 0.99를 되풀이하는 가짜 난수. */
function fakeRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("뽑기 비용", () => {
  it("10회는 낱개 열 번보다 싸다", () => {
    expect(pullCost(banner, 1)).toBe(100);
    expect(pullCost(banner, 10)).toBe(900);
    expect(pullCost(banner, 10)).toBeLessThan(pullCost(banner, 1) * 10);
  });

  it("재화가 모자라면 뽑을 수 없다", () => {
    expect(canPull({ fossil: 100, amber: 0 }, banner, 1)).toBe(true);
    expect(canPull({ fossil: 99, amber: 0 }, banner, 1)).toBe(false);
    expect(canPull({ fossil: 899, amber: 999 }, banner, 10)).toBe(false);
  });
});

describe("배너 대표 렐릭", () => {
  it("모든 운영 배너는 실제 추첨 풀 안의 픽업 렐릭을 대표로 노출한다", () => {
    // 데이터 오타로 배너 원화와 실제 추첨 대상이 어긋나는 회귀를 막는다.
    for (const candidate of BANNERS) expect(candidate.pool).toContain(candidate.featuredRelicId);
  });
});

describe("뽑기", () => {
  it("는 요청한 수만큼 풀 안에서 뽑는다", () => {
    const results = pull(banner, 10, fakeRng([0, 0.5, 0.99]));
    expect(results).toHaveLength(10);
    for (const id of results) expect(banner.pool).toContain(id);
  });

  it("는 같은 난수열이면 같은 결과가 나온다", () => {
    const a = pull(banner, 5, fakeRng([0.1, 0.9, 0.4]));
    const b = pull(banner, 5, fakeRng([0.1, 0.9, 0.4]));
    expect(a).toEqual(b);
  });

  it("난수가 1에 가까워도 풀을 벗어나지 않는다", () => {
    expect(pull(banner, 3, () => 0.999999)).toEqual(["c", "c", "c"]);
  });
});

describe("재화 차감", () => {
  it("은 뽑은 만큼만 줄인다", () => {
    const wallet: Wallet = { fossil: 1000, amber: 5 };
    expect(spend(wallet, banner, 1)).toEqual({ fossil: 900, amber: 5 });
    // 원래 지갑은 그대로다.
    expect(wallet.fossil).toBe(1000);
  });

  it("모자라면 아무것도 쓰지 않는다", () => {
    const wallet: Wallet = { fossil: 50, amber: 0 };
    expect(spend(wallet, banner, 1)).toBe(wallet);
  });
});

describe("보유 반영", () => {
  it("은 처음 얻은 것과 중복을 갈라 준다", () => {
    const owned = new Set(["a"]);
    const outcome = applyPull(owned, ["a", "b", "b"]);

    expect(outcome.fresh).toEqual(["b"]);
    expect(outcome.duplicates).toEqual(["a", "b"]);
    expect([...owned].sort()).toEqual(["a", "b"]);
  });
});

describe("실제 배너", () => {
  it("는 모두 뽑을 수 있는 렐릭만 담고 있다", () => {
    for (const b of BANNERS) {
      expect(b.pool.length).toBeGreaterThan(0);
      expect(b.costTen).toBeLessThan(b.costOne * 10);
    }
  });
});
