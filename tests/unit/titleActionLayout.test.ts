import { describe, expect, it } from "vitest";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import { TITLE_ACTION_ROW, TITLE_LOADING_LAYOUT, TITLE_LOGIN_LAYOUT, titleActionSlots, titleLoginSlots } from "../../src/ui/titleActionLayout";

describe("타이틀 하단 버튼 줄", () => {
  it("1~3개 모두 가운데 정렬이고 화면 안에서 서로 겹치지 않는다", () => {
    for (const n of [1, 2, 3]) {
      const slots = titleActionSlots(n);
      expect(slots).toHaveLength(n);
      const mid = slots.reduce((sum, s) => sum + s.x, 0) / n;
      expect(mid).toBeCloseTo(BASE_WIDTH / 2, 5);
      slots.forEach((s, i) => {
        expect(s.x - s.width / 2).toBeGreaterThanOrEqual(0);
        expect(s.x + s.width / 2).toBeLessThanOrEqual(BASE_WIDTH);
        if (i > 0) expect(s.x - s.width / 2).toBeGreaterThan(slots[i - 1].x + slots[i - 1].width / 2);
      });
    }
  });

  it("상한을 넘기는 버튼은 세우지 않는다", () => {
    expect(titleActionSlots(9)).toHaveLength(TITLE_ACTION_ROW.maxButtons);
    expect(titleActionSlots(0)).toHaveLength(0);
  });

  it("로딩 칸 아래, 화면 안에 선다", () => {
    const top = TITLE_ACTION_ROW.centerY - TITLE_ACTION_ROW.height / 2;
    const { diamondsY, diamondRadius, buttonGap, promptY } = TITLE_LOADING_LAYOUT;
    expect(top - (diamondsY + diamondRadius)).toBeGreaterThanOrEqual(buttonGap);
    expect(promptY).toBeLessThan(diamondsY - diamondRadius);
    expect(TITLE_ACTION_ROW.centerY + TITLE_ACTION_ROW.height / 2).toBeLessThanOrEqual(BASE_HEIGHT);
  });

  it("왼쪽 아래 버전 표기(x≈48~220)와 겹치지 않는다", () => {
    const left = titleActionSlots(TITLE_ACTION_ROW.maxButtons)[0];
    expect(left.x - left.width / 2).toBeGreaterThan(220);
  });
});

describe("첫 실행 로그인 버튼 줄", () => {
  it("하단 버튼 줄 위에 서로 겹치지 않고 화면 안에 선다", () => {
    const { height, gap, bottomGap, maxButtons } = TITLE_LOGIN_LAYOUT;
    for (const n of [1, 2, 4, maxButtons]) {
      const ys = titleLoginSlots(n);
      expect(ys).toHaveLength(n);
      expect(ys[0] - height / 2).toBeGreaterThan(0);
      expect(ys[n - 1] + height / 2).toBeCloseTo(TITLE_ACTION_ROW.centerY - TITLE_ACTION_ROW.height / 2 - bottomGap, 5);
      ys.forEach((y, i) => { if (i > 0) expect(y - ys[i - 1]).toBeCloseTo(height + gap, 5); });
    }
  });

  it("로고가 서는 위쪽 절반을 침범하지 않는다", () => {
    const ys = titleLoginSlots(TITLE_LOGIN_LAYOUT.maxButtons);
    expect(ys[0] - TITLE_LOGIN_LAYOUT.height / 2).toBeGreaterThan(BASE_HEIGHT * 0.45);
  });

  it("상한을 넘기는 버튼은 세우지 않는다", () => {
    expect(titleLoginSlots(99)).toHaveLength(TITLE_LOGIN_LAYOUT.maxButtons);
    expect(titleLoginSlots(0)).toHaveLength(0);
  });
});
