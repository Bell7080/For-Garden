import { describe, expect, it } from "vitest";
import {
  sortTraitBulkResult, TRAIT_BULK_RESULT, traitBulkGradeCounts, traitBulkResultRowAt, traitBulkResultRowY, traitBulkResultSize,
  type TraitBulkResultEntry,
} from "../../src/ui/runeTraitBulkResultLayout";

const entries: TraitBulkResultEntry[] = [
  { instanceId: "a", rarity: "rare", traitGrade: "uncommon", holderId: "torika" },
  { instanceId: "b", rarity: "epic", traitGrade: "legendary" },
  { instanceId: "c", rarity: "legendary", traitGrade: "rare", holderId: "dodi" },
  { instanceId: "d", rarity: "uncommon", traitGrade: "rare", holderId: "torika" },
  { instanceId: "e", rarity: "rare", traitGrade: "epic" },
];
const order = new Map([["torika", 0], ["dodi", 1]]);

describe("특성 일괄 부여 결과 창", () => {
  it("등급순은 특성 등급 → 룬 등급 순이다", () => {
    expect(sortTraitBulkResult(entries, "grade", order).map(({ instanceId }) => instanceId)).toEqual(["b", "e", "c", "d", "a"]);
  });

  it("장착자순은 낀 렐릭끼리 모이고 안 낀 룬은 맨 뒤다", () => {
    expect(sortTraitBulkResult(entries, "holder", order).map(({ instanceId }) => instanceId)).toEqual(["d", "a", "c", "b", "e"]);
  });

  it("방향을 뒤집으면 줄 전체가 거꾸로 선다", () => {
    expect(sortTraitBulkResult(entries, "grade", order, false).map(({ instanceId }) => instanceId)).toEqual(["a", "d", "c", "e", "b"]);
    expect(sortTraitBulkResult(entries, "holder", order, false).map(({ instanceId }) => instanceId)).toEqual(["e", "b", "c", "a", "d"]);
  });

  it("등급 칩은 높은 등급부터, 없는 등급은 빠진다", () => {
    expect(traitBulkGradeCounts(entries)).toEqual([
      { grade: "legendary", count: 1 }, { grade: "epic", count: 1 }, { grade: "rare", count: 2 }, { grade: "uncommon", count: 1 },
    ]);
    expect(traitBulkGradeCounts([{ traitGrade: "rare" }])).toEqual([{ grade: "rare", count: 1 }]);
  });

  it("줄이 상한을 넘으면 창은 멈추고 목록만 흐른다", () => {
    const few = traitBulkResultSize(3);
    const many = traitBulkResultSize(40);
    const cap = traitBulkResultSize(TRAIT_BULK_RESULT.maxRows);
    expect(few.height).toBeLessThan(many.height);
    expect(many.height).toBe(cap.height);
    expect(many.contentHeight).toBeGreaterThan(many.viewHeight);
    expect(few.contentHeight).toBe(few.viewHeight);
    // 정렬 칩은 머리줄에 서고 등급 칩 줄과 겹치지 않는다.
    const L = TRAIT_BULK_RESULT;
    expect(L.headlineY + L.sort.height / 2).toBeLessThan(L.chipsY - L.chip.height / 2);
    expect(many.height).toBe(L.viewportTop + many.viewHeight + L.bottom);
  });

  it("누른 자리에서 줄을 찾는다 — 줄 사이 틈과 목록 밖은 없다", () => {
    expect(traitBulkResultRowAt(traitBulkResultRowY(0), 3)).toBe(0);
    expect(traitBulkResultRowAt(traitBulkResultRowY(2), 3)).toBe(2);
    expect(traitBulkResultRowAt(TRAIT_BULK_RESULT.row.height + TRAIT_BULK_RESULT.row.gap / 2, 3)).toBeUndefined();
    expect(traitBulkResultRowAt(traitBulkResultRowY(3), 3)).toBeUndefined();
    expect(traitBulkResultRowAt(-5, 3)).toBeUndefined();
  });
});
