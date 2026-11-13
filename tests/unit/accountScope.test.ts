import { describe, expect, it, beforeEach } from "vitest";
import { observeAccountOwner, onAccountSwitch, resetAccountOwnerForTest } from "../../src/core/accountScope";
import { levelUpAnnouncement } from "../../src/core/levelUpAnnouncement";

describe("계정에 묶인 메모리 상태", () => {
  beforeEach(() => resetAccountOwnerForTest());

  it("주인이 바뀐 순간에만 비운다", () => {
    let resets = 0;
    const off = onAccountSwitch(() => { resets += 1; });
    expect(observeAccountOwner("A")).toBe(false);
    expect(observeAccountOwner("A")).toBe(false);
    expect(observeAccountOwner("B")).toBe(true);
    expect(resets).toBe(1);
    off();
  });

  it("빈 UID는 주인이 아니다 — 계정 변경 직후의 기본 세션을 거쳐 같은 계정으로 돌아오면 비우지 않는다", () => {
    let resets = 0;
    const off = onAccountSwitch(() => { resets += 1; });
    observeAccountOwner("A");
    observeAccountOwner("");
    observeAccountOwner("A");
    expect(resets).toBe(0);
    off();
  });

  it("2레벨 계정에서 20레벨 계정으로 바꿔 들어오면 레벨업을 알리지 않는다", () => {
    let announced: number | undefined;
    const off = onAccountSwitch(() => { announced = undefined; });
    observeAccountOwner("A");
    announced = levelUpAnnouncement(announced, 2, false).baseline;
    observeAccountOwner("");
    observeAccountOwner("B");
    const result = levelUpAnnouncement(announced, 20, false);
    expect(result.announce).toBeUndefined();
    expect(result.baseline).toBe(20);
    // 그 계정 안에서 오른 것은 그대로 알린다.
    expect(levelUpAnnouncement(result.baseline, 21, false).announce).toEqual({ from: 20, to: 21 });
    off();
  });
});
