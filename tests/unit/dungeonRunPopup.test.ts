import { describe, expect, it } from "vitest";
import {
  DUNGEON_RUN_CELL, DUNGEON_RUN_POPUP, DUNGEON_RUN_TONE, dungeonRunInnerWidth, dungeonRunPopupHeight, dungeonRunRechargeCells,
  dungeonRunSliderSpan, runSliderRatio, runSliderValue,
} from "../../src/ui/dungeonRunPopupLayout";
import { insidePopupBody } from "../../src/ui/staminaPopupLayout";

describe("던전 횟수 창 배치표", () => {
  const L = DUNGEON_RUN_POPUP;
  const height = dungeonRunPopupHeight();
  /** 판 윗변 기준 y를 가운데가 0인 좌표로. */
  const centered = (top: number, h: number) => ({ y: top + h / 2 - height / 2, width: dungeonRunInnerWidth(), height: h });

  it("위에서부터 횟수 판 → 충전 칸 → 갈래 줄 → 예상 → 확정 버튼으로 겹치지 않고 쌓인다", () => {
    expect(L.tierY).toBeLessThan(L.count.top);
    expect(L.count.top + L.count.height).toBeLessThan(L.recharge.titleY - 12);
    expect(L.recharge.top + L.recharge.height).toBeLessThan(L.branch.y - L.branch.height / 2 + 4);
    expect(L.branch.y + L.branch.adHeight / 2).toBeLessThanOrEqual(L.summary.top);
    expect(L.summary.top + L.summary.height).toBeLessThan(L.notice.y - L.notice.size);
    expect(L.notice.y + L.notice.size).toBeLessThan(L.confirm.y - L.confirm.height / 2);
    expect(height).toBe(L.confirm.y + L.confirm.height / 2 + L.bottomPad);
  });

  it("안쪽 판은 몸판의 깎인 모서리 안에 든다", () => {
    const popup = { width: L.width, height };
    expect(insidePopupBody(popup, centered(L.count.top, L.count.height))).toBe(true);
    expect(insidePopupBody(popup, centered(L.recharge.top, L.recharge.height))).toBe(true);
    expect(insidePopupBody(popup, centered(L.summary.top, L.summary.height))).toBe(true);
  });

  it("− 막대 + 는 겹치지 않고 판 안에 들며, 큰 수 양옆의 MIN·MAX도 판 안에 든다", () => {
    const span = dungeonRunSliderSpan();
    const half = dungeonRunInnerWidth() / 2;
    const step = L.count.stepSize / 2;
    expect(span.minus - step).toBeGreaterThan(-half);
    expect(span.plus + step).toBeLessThan(half);
    expect(span.trackLeft).toBeGreaterThan(span.minus + step);
    expect(span.trackLeft + span.trackWidth).toBeLessThan(span.plus - step);
    const sideCenter = L.count.plateWidth / 2 + L.count.sideGap + L.count.sideWidth / 2;
    expect(sideCenter + L.count.sideWidth / 2).toBeLessThan(half);
  });

  it("충전 칸 셋은 같은 폭으로 판 안에 서고, 칸 안의 버튼도 칸 밖으로 나가지 않는다", () => {
    const cells = dungeonRunRechargeCells();
    const half = dungeonRunInnerWidth() / 2;
    expect(cells.centers[0] - cells.width / 2).toBeCloseTo(-half);
    expect(cells.centers[2] + cells.width / 2).toBeCloseTo(half);
    expect(cells.centers[1]).toBeCloseTo(0);
    expect(DUNGEON_RUN_CELL.buttonY + DUNGEON_RUN_CELL.buttonHeight / 2).toBeLessThanOrEqual(L.recharge.height / 2);
    expect(DUNGEON_RUN_CELL.frameY - DUNGEON_RUN_CELL.frameSize / 2).toBeGreaterThanOrEqual(-L.recharge.height / 2);
  });

  it("막대 위 자리는 가장 가까운 횟수에 붙고, 끝이 하나뿐이면 그 값이다", () => {
    expect(runSliderValue(0, 1, 10)).toBe(1);
    expect(runSliderValue(1, 1, 10)).toBe(10);
    expect(runSliderValue(0.5, 1, 11)).toBe(6);
    expect(runSliderValue(-3, 1, 10)).toBe(1);
    expect(runSliderValue(4, 1, 10)).toBe(10);
    expect(runSliderValue(0.7, 1, 1)).toBe(1);
    expect(runSliderRatio(1, 1, 1)).toBe(1);
    for (let value = 1; value <= 20; value += 1) expect(runSliderValue(runSliderRatio(value, 1, 20), 1, 20)).toBe(value);
  });

  it("자동 전투와 소탕은 색이 갈린다", () => {
    expect(DUNGEON_RUN_TONE.auto.accent).not.toBe(DUNGEON_RUN_TONE.sweep.accent);
  });
});
