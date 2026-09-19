import { describe, expect, it } from "vitest";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import { BOUNTY_LAYOUT, bountyFormationSlotCenterX, bountyTierListBottom, bountyTierRowCenterY } from "../../src/ui/bountyLayout";
import { BOUNTY_TIERS } from "../../src/data/bounty";
import { BACK_SLOT } from "../../src/ui/popupGeometry";

describe("현상수배 배치표", () => {
  it("은 등급 줄이 서로 겹치지 않는다", () => {
    for (let index = 1; index < BOUNTY_TIERS.length; index += 1) {
      const gap = bountyTierRowCenterY(index) - bountyTierRowCenterY(index - 1) - BOUNTY_LAYOUT.tier.height;
      expect(gap).toBe(BOUNTY_LAYOUT.tier.gap);
    }
  });

  it("은 마지막 등급 줄이 편성 제목을 침범하지 않는다", () => {
    expect(bountyTierListBottom(BOUNTY_TIERS.length)).toBeLessThan(BOUNTY_LAYOUT.formation.titleY);
  });

  it("은 편성 칸과 그 아래 라운드 이름이 출격 버튼을 침범하지 않는다", () => {
    const slotBottom = BOUNTY_LAYOUT.formation.centerY + BOUNTY_LAYOUT.formation.slotHeight / 2;
    // 칸 밑변 아래에 라운드 번호 한 줄이 서므로 그 몫까지 비워 둔다.
    expect(slotBottom + 52).toBeLessThan(BOUNTY_LAYOUT.sortie.y - BOUNTY_LAYOUT.sortie.height / 2);
  });

  it("은 출격 버튼이 우하단 뒤로가기와 겹치지 않는다", () => {
    const right = BOUNTY_LAYOUT.sortie.x + BOUNTY_LAYOUT.sortie.width / 2;
    // 뒤로가기는 화면 어디서나 같은 자리에 서므로, 출격이 그 자리를 덮으면 나갈 길이 막힌다.
    expect(right).toBeLessThan(BACK_SLOT.x - 80);
  });

  it("은 모든 요소가 화면 안에 든다", () => {
    expect(bountyTierRowCenterY(0) - BOUNTY_LAYOUT.tier.height / 2).toBeGreaterThan(BOUNTY_LAYOUT.title.y);
    expect(BOUNTY_LAYOUT.sortie.y + BOUNTY_LAYOUT.sortie.height / 2).toBeLessThan(BASE_HEIGHT);
    expect(BOUNTY_LAYOUT.tier.width).toBeLessThan(BASE_WIDTH);
  });

  it("은 편성 칸 셋이 화면 가운데를 기준으로 고르게 선다", () => {
    const centers = [0, 1, 2].map(bountyFormationSlotCenterX);
    expect(centers[1]).toBe(BASE_WIDTH / 2);
    expect(centers[1] - centers[0]).toBe(centers[2] - centers[1]);
    // 셋을 세우고도 화면 좌우로 넘치지 않아야 한다.
    expect(centers[0] - BOUNTY_LAYOUT.formation.slotWidth / 2).toBeGreaterThan(0);
    expect(centers[2] + BOUNTY_LAYOUT.formation.slotWidth / 2).toBeLessThan(BASE_WIDTH);
  });
});
