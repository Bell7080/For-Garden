import { describe, expect, it } from "vitest";
import { portraitCardOverhang, portraitGridContentHeight, portraitGridFirstRowY, portraitGridHeadroom } from "../../src/ui/portraitGrid";

/** 머리가 칩 밖으로 나오는 카드라 그리드 첫 줄은 경계에서 그만큼 떨어져야 한다. */
describe("캐릭터 그리드 안전 영역", () => {
  it.each([[235, 0], [400, 0], [400, 24], [120, 12]])("카드 %i·여백 %i에서 머리가 경계 위로 넘지 않는다", (cardHeight, gap) => {
    const viewportTop = 390;
    const firstRowY = portraitGridFirstRowY(viewportTop, cardHeight, gap);
    const headTop = firstRowY - cardHeight / 2 - portraitCardOverhang(cardHeight);
    expect(headTop).toBeGreaterThanOrEqual(viewportTop);
    expect(headTop).toBe(viewportTop + gap);
  });

  it("돌출 높이는 카드가 납작할수록 작고 54에서 멈춘다", () => {
    expect(portraitGridHeadroom(100)).toBe(26);
    expect(portraitGridHeadroom(400)).toBe(64);
    expect(portraitGridHeadroom(2000)).toBe(64);
  });

  it("그리드 세로 길이는 머리 여유를 포함하고 빈 목록은 0이다", () => {
    expect(portraitGridContentHeight(0, 280, 235)).toBe(0);
    expect(portraitGridContentHeight(1, 280, 235)).toBe(portraitGridHeadroom(235) + 235);
    expect(portraitGridContentHeight(3, 280, 235)).toBe(portraitGridHeadroom(235) + 560 + 235);
  });
});
