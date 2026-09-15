import { describe, expect, it } from "vitest";
import type { ResearchSlotView } from "../../src/core/researchPresentation";
import { cinematicRewards, isCinematicCount } from "../../src/ui/researchCinematicModel";

const TEXT = {
  relic: (relicId: string) => ({ name: `이름-${relicId}`, project: `PROJECT ${relicId}` }),
  fragment: (name: string) => `${name} 파편`,
  currency: (kind: string) => `재화-${kind}`,
  resourceTitle: "재화",
} as const;

describe("연구 시네마틱 카드 계약", () => {
  it("칸이 정한 등급을 그대로 쓴다 — 중복 파편도 그 개체의 등급으로 선다", () => {
    const views: ResearchSlotView[] = [
      { kind: "relic", relicId: "a", grade: "SSR" },
      { kind: "fragment", relicId: "b", amount: 3, grade: "SR" },
    ];
    const [first, second] = cinematicRewards(views, TEXT);
    expect(first.rarity).toBe("SSR");
    expect(first.name).toBe("이름-a");
    expect(first.title).toBe("PROJECT a");
    // 중복이 회색으로 떨어지면 SSR 중복이 재화와 같은 연출로 서서 무엇이 나왔는지 갈린다.
    expect(second.rarity).toBe("SR");
    expect(second.name).toBe("이름-b 파편");
  });

  it("회색 카드만 수량을 들고, 그 수는 1 이상의 정수다", () => {
    const views: ResearchSlotView[] = [
      { kind: "currency", currency: "gold", amount: 1200, grade: "GRAY" },
      { kind: "dna", amount: 0.4, grade: "GRAY" },
      { kind: "relic", relicId: "a", grade: "R" },
    ];
    const [gold, dna, relic] = cinematicRewards(views, TEXT);
    expect(gold).toMatchObject({ rarity: "GRAY", quantity: 1200, name: "재화-gold", title: "재화" });
    // 에셋 계약이 1 이상의 안전한 정수만 받아들인다 — 0이 넘어가면 연출 자체가 열리지 않는다.
    expect(dna.quantity).toBe(1);
    expect(relic.quantity).toBeUndefined();
  });

  it("칸마다 다른 id를 준다 — 같은 개체가 두 번 나와도 카드가 겹치지 않는다", () => {
    const views: ResearchSlotView[] = [
      { kind: "relic", relicId: "a", grade: "R" },
      { kind: "fragment", relicId: "a", amount: 1, grade: "R" },
    ];
    const ids = cinematicRewards(views, TEXT).map((reward) => reward.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("순서는 추첨 순서 그대로다", () => {
    const views: ResearchSlotView[] = [
      { kind: "currency", currency: "cheesecake", amount: 5, grade: "GRAY" },
      { kind: "relic", relicId: "z", grade: "SSR" },
    ];
    expect(cinematicRewards(views, TEXT).map((reward) => reward.rarity)).toEqual(["GRAY", "SSR"]);
  });

  it("에셋이 받아들이는 장수는 1과 10뿐이다", () => {
    // 다른 장수로 열면 에셋이 검증에서 던져 뽑기 자체가 실패한 것처럼 보인다.
    expect(isCinematicCount(1)).toBe(true);
    expect(isCinematicCount(10)).toBe(true);
    expect(isCinematicCount(0)).toBe(false);
    expect(isCinematicCount(5)).toBe(false);
  });
});
