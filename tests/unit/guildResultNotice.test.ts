import { describe, expect, it } from "vitest";
import { guildResultNoticeDue } from "../../src/core/guildPages";

describe("길드 결과 알림", () => {
  it("수호전 보상은 수호전 탭에서만 뜬다", () => {
    expect(guildResultNoticeDue("guardReward", "war", 10, 9)).toBe(false);
    expect(guildResultNoticeDue("guardReward", "info", 10, 9)).toBe(false);
    expect(guildResultNoticeDue("guardReward", "guard", 10, 9)).toBe(true);
  });
  it("길드전 결과는 길드전 탭에서만 뜬다", () => {
    expect(guildResultNoticeDue("warResult", "guard", 10, 9)).toBe(false);
    expect(guildResultNoticeDue("warResult", "war", 10, 9)).toBe(true);
  });
  it("이미 본 날짜와 결과 없음은 다시 뜨지 않는다", () => {
    expect(guildResultNoticeDue("guardReward", "guard", 10, 10)).toBe(false);
    expect(guildResultNoticeDue("warResult", "war", undefined, 0)).toBe(false);
  });
});
