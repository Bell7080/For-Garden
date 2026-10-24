import { describe, expect, it } from "vitest";
import { EXPEDITION_AUGMENT_POPUP as P, EXPEDITION_AUGMENT_STATUS as S, expeditionAugmentCardX } from "../../src/ui/expeditionLayout";
import { expeditionAugmentPages } from "../../src/ui/expeditionAugmentBadges";

describe("원정 증강 선택창 배치", () => {
  it("의 카드 세 장은 고른 카드가 커져도 판 안에 든다", () => {
    const half = (P.card.width * P.card.chosenScale) / 2;
    const outer = Math.abs(expeditionAugmentCardX(0, 3)) + half;
    expect(outer).toBeLessThan(P.width / 2 - 16);
  });

  it("의 고른 카드는 위로 단계 줄, 아래로 안내 줄을 넘지 않는다", () => {
    const half = (P.card.height * P.card.chosenScale) / 2;
    const top = P.card.y - P.card.lift - half;
    const bottom = P.card.y - P.card.lift + half;
    expect(top).toBeGreaterThan(P.stepY + 18);
    expect(bottom).toBeLessThan(P.noteY - 14);
  });

  it("의 확정 버튼은 판 밑변 안에 선다", () => {
    expect(P.confirm.y + P.confirm.height / 2).toBeLessThan(P.height / 2);
    expect(P.confirm.y - P.confirm.height / 2).toBeGreaterThan(P.noteY + 14);
  });
});

describe("원정 증강 현황 팝업", () => {
  it("의 목록 창과 줄은 판 폭 안에 들고 넘김 줄과 겹치지 않는다", () => {
    expect(S.row.width).toBeLessThanOrEqual(S.viewport.width);
    expect(S.viewport.width).toBeLessThan(S.width);
    expect(S.viewport.bottom).toBeLessThan(S.pager.y - 40);
    expect(S.pager.y).toBeLessThan(S.height / 2);
  });

  it("의 쪽은 전체 → 1번 → 2번 → 3번 렐릭 순이고 빈 렐릭도 쪽을 지킨다", () => {
    const pages = expeditionAugmentPages(
      [{ augmentId: "apex-signal" }, { augmentId: "blood-edge", targetRelicId: "spino" }],
      ["torika", "rex", "spino"],
    );
    expect(pages.map((page) => (page.kind === "party" ? "party" : page.relicId))).toEqual(["party", "torika", "rex", "spino"]);
    expect(pages[0].badges).toHaveLength(1);
    expect(pages[1].badges).toHaveLength(0);
    expect(pages[3].badges.map(({ augmentId }) => augmentId)).toEqual(["blood-edge"]);
  });
});
