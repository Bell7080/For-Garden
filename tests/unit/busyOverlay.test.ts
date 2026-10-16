import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BUSY_OVERLAY, beginBusy, busyHideDelay, endBusy, initialBusyState, markBusyHidden, markBusyShown, shouldShowBusy,
} from "../../src/core/busyOverlay";

describe("기다림 오버레이 타이밍", () => {
  it("요청이 없으면 막을 세우지 않고, 있으면 한 번만 세운다", () => {
    expect(shouldShowBusy(initialBusyState)).toBe(false);
    const busy = beginBusy(initialBusyState);
    expect(shouldShowBusy(busy)).toBe(true);
    expect(shouldShowBusy(markBusyShown(busy, 0))).toBe(false);
  });

  it("겹친 요청은 모두 끝나야 내려갈 수 있다", () => {
    let state = markBusyShown(beginBusy(beginBusy(initialBusyState)), 1000);
    state = endBusy(state);
    expect(busyHideDelay(state, 5000)).toBeNull();
    state = endBusy(state);
    expect(busyHideDelay(state, 5000)).toBe(0);
  });

  it("선 막은 최소 시간만큼 머문 뒤 내려가고, 서지 않았으면 기다릴 것이 없다", () => {
    const shown = endBusy(markBusyShown(beginBusy(initialBusyState), 1000));
    expect(busyHideDelay(shown, 1100)).toBe(BUSY_OVERLAY.minVisibleMs - 100);
    expect(busyHideDelay(endBusy(beginBusy(initialBusyState)), 1100)).toBeNull();
    expect(markBusyHidden(shown).shownAt).toBeNull();
  });

  it("요청 수는 음수로 내려가지 않는다", () => {
    expect(endBusy(initialBusyState).pending).toBe(0);
  });

  it("화면은 오버레이를 직접 세우지 않고 withBusy로만 부른다", () => {
    const shop = readFileSync("src/scenes/ShopScene.ts", "utf8");
    expect(shop).toContain("withBusy(this,");
    expect(shop).not.toContain("new BusyOverlay");
  });
});
