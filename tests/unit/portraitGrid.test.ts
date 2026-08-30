import { describe, expect, it } from "vitest";
import { portraitCardHeadWindow, portraitCardOverhang, portraitGridContentHeight, portraitGridFirstRowY, portraitGridHeadroom } from "../../src/ui/portraitGrid";

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

  /**
   * 홈이 잘린 모서리(`/`)에 베이지 않게 하는 규칙. 예전에는 위아래 같은 폭으로 뚫어, 모서리를
   * 피하느라 좁아진 폭이 정수리까지 따라 올라가며 머리 옆을 세로로 베었다.
   */
  describe("머리 홈", () => {
    // 도감 그리드가 실제로 쓰는 값(카드 300×400, 칩 인셋 6, CHIP_BEVEL의 0.18/0.07).
    const chipWidth = 288;
    const topLeftBevel = 288 * 0.18;
    const topRightBevel = 288 * 0.07;

    it("은 칩 윗변에서 양쪽 대각선 안쪽 여유를 지킨다", () => {
      const window = portraitCardHeadWindow(chipWidth, topLeftBevel, topRightBevel, 0.8);
      const clearance = 4;
      expect(window.width / 2 - window.offsetX).toBeLessThanOrEqual(chipWidth / 2 - topLeftBevel - clearance + 1e-9);
      expect(window.width / 2 + window.offsetX).toBeLessThanOrEqual(chipWidth / 2 - topRightBevel - clearance + 1e-9);
    });

    it("은 깊게 깎인 쪽만 줄이고 얕은 쪽은 그대로 둔다", () => {
      // 예전 공식은 깊은 쪽(왼쪽) 깎임을 양쪽에 함께 적용해 오른쪽까지 이유 없이 좁았다.
      const window = portraitCardHeadWindow(chipWidth, topLeftBevel, topRightBevel, 0.8);
      expect(window.width / 2 + window.offsetX).toBeCloseTo((chipWidth * 0.8) / 2, 6);
      expect(window.offsetX).toBeGreaterThan(0);
    });

    it("은 꼭대기가 칩 윗변보다 넓어 위로 벌어진다", () => {
      const window = portraitCardHeadWindow(chipWidth, topLeftBevel, topRightBevel, 0.8);
      expect(window.topWidth).toBeGreaterThan(window.width);
    });

    it("은 모서리가 얕으면 위아래 폭이 같아 굳이 벌어지지 않는다", () => {
      const window = portraitCardHeadWindow(300, 10, 5, 0.8);
      expect(window.width).toBeCloseTo(300 * 0.8, 6);
      expect(window.topWidth).toBeCloseTo(window.width, 6);
      expect(window.offsetX).toBe(0);
    });

    it("은 꼭대기도 칩 폭을 넘지 않는다", () => {
      const window = portraitCardHeadWindow(chipWidth, topLeftBevel, topRightBevel, 0.8, { left: 1, right: 1 });
      expect(window.topWidth).toBeLessThanOrEqual(chipWidth);
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

    it("은 넓혀도 칩 윗변에서 그 쪽 대각선 깎임 안쪽 여유는 넘지 않는다", () => {
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
