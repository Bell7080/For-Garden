import { describe, expect, it } from "vitest";
import { portraitCardHeadWindow, portraitCardNotchWidth, portraitCardOverhang, portraitGridContentHeight, portraitGridFirstRowY, portraitGridHeadroom } from "../../src/ui/portraitGrid";

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

  /** 위쪽 두 모서리를 서로 다르게 깎는 카드에서, 노치가 그 대각선 안쪽까지 넓으면 잘린
   * 모서리가 홈 밖으로 나온 머리를 가로질러 애매하게 베어 낸다(출격 팝업 SD 자리와 같은 문제). */
  describe("카드 머리 홈 폭", () => {
    it("은 기본 비율이 대각선 깎임 안쪽으로 들어오면 깎인 깊이만큼 줄어든다", () => {
      // chipWidth 198, topLeft 0.18*198≈35.64에서는 80% 비율(158.4)이 두 대각선을 침범한다.
      const chipWidth = 198;
      const topLeftBevel = 0.18 * chipWidth;
      const topRightBevel = 0.07 * chipWidth;
      const width = portraitCardNotchWidth(chipWidth, topLeftBevel, topRightBevel, 0.8);
      expect(width).toBeLessThan(chipWidth * 0.8);
      expect(width).toBeLessThanOrEqual(chipWidth - 2 * topLeftBevel);
    });

    it("은 모서리가 얕아 기본 비율이 이미 안전하면 그대로 둔다", () => {
      const chipWidth = 300;
      const width = portraitCardNotchWidth(chipWidth, 10, 5, 0.8);
      expect(width).toBe(chipWidth * 0.8);
    });
  });

  /** 모자·깃털·후드가 한쪽으로 쏠린 원화(스피나 오른쪽, 메테 왼쪽)를 위한 비대칭 홈. */
  describe("한쪽으로 넓힌 머리 홈", () => {
    it("은 bias를 준 쪽만 넓히고 중심을 그 쪽으로 민다", () => {
      const chipWidth = 300;
      const window = portraitCardHeadWindow(chipWidth, 20, 10, 0.8, { right: 0.1 });
      const symmetric = portraitCardHeadWindow(chipWidth, 20, 10, 0.8);
      expect(window.width).toBeGreaterThan(symmetric.width);
      expect(window.offsetX).toBeGreaterThan(0);
    });

    it("은 bias가 없으면 대칭이고 offsetX가 0이다", () => {
      const window = portraitCardHeadWindow(300, 20, 10, 0.8);
      expect(window.offsetX).toBe(0);
    });

    it("은 넓혀도 그 쪽 대각선 깎임 안쪽 여유는 넘지 않는다", () => {
      // v0.29.10에서 고친 자기 교차 문제가 bias로 되돌아오지 않아야 한다.
      const chipWidth = 198;
      const topLeftBevel = 0.18 * chipWidth;
      const topRightBevel = 0.07 * chipWidth;
      const window = portraitCardHeadWindow(chipWidth, topLeftBevel, topRightBevel, 0.8, { left: 1, right: 1 });
      const clearance = 4;
      expect(window.width / 2 - window.offsetX).toBeLessThanOrEqual(chipWidth / 2 - topLeftBevel - clearance + 1e-9);
      expect(window.width / 2 + window.offsetX).toBeLessThanOrEqual(chipWidth / 2 - topRightBevel - clearance + 1e-9);
    });
  });
});
