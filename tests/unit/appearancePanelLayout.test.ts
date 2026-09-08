import { describe, expect, it } from "vitest";
import { APPEARANCE_PANEL_LAYOUT, appearanceBoundsOverlap, appearancePanelRegions } from "../../src/ui/appearancePanelLayout";

describe("1080×1920 외형 선택 배치", () => {
  it("머리 오버행은 팝업 제목 headroom 아래에 남고 카드와 장착 버튼은 겹치지 않는다", () => {
    const regions = appearancePanelRegions();
    // 제목과 X는 팝업 최상단 150px를 독점한다. 머리가 이 선을 넘으면 닫기 입력까지 가린다.
    for (const overhang of regions.overhangs) expect(appearanceBoundsOverlap(regions.header, overhang)).toBe(false);
    for (const card of regions.cards) expect(appearanceBoundsOverlap(card, regions.action)).toBe(false);
    expect(APPEARANCE_PANEL_LAYOUT.width).toBeLessThanOrEqual(1080);
    expect(APPEARANCE_PANEL_LAYOUT.height).toBeLessThanOrEqual(1920);
  });

  it("우하단 SD는 이름·보유 상태 안전띠와 분리되고 두 선택 카드도 서로 겹치지 않는다", () => {
    const regions = appearancePanelRegions();
    expect(appearanceBoundsOverlap(regions.cards[0], regions.cards[1])).toBe(false);
    regions.sdFigures.forEach((sd, index) => expect(appearanceBoundsOverlap(sd, regions.textBands[index])).toBe(false));
    // `/` 절단이 상단 절반가량이라는 의도가 미세 좌표 수정으로 사라지지 않게 비율을 고정한다.
    expect(APPEARANCE_PANEL_LAYOUT.card.slashDepth / (APPEARANCE_PANEL_LAYOUT.card.height / 2)).toBeCloseTo(0.49, 2);
  });
});
