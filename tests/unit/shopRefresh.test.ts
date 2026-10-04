import { describe, expect, it } from "vitest";
import { formatRefreshCountdown, nextRefreshAt, shortestRefresh } from "../../src/core/shopRefresh";

const at = (iso: string): number => Date.parse(iso);

describe("상점 리필 남은 시간", () => {
  it("일간은 UTC 자정까지를 D00:HH:MM으로 적는다", () => {
    expect(formatRefreshCountdown("daily", at("2026-10-04T00:12:00Z"))).toBe("D00:23:48");
  });

  it("주간은 UTC 월요일 자정까지를 적는다", () => {
    expect(formatRefreshCountdown("weekly", at("2026-10-05T00:12:00Z"))).toBe("D6:23:48");
    expect(nextRefreshAt("weekly", at("2026-10-04T10:00:00Z"))).toBe(at("2026-10-05T00:00:00Z"));
  });

  it("월간은 다음 달 1일 자정까지를 적는다", () => {
    expect(nextRefreshAt("monthly", at("2026-12-31T23:00:00Z"))).toBe(at("2027-01-01T00:00:00Z"));
    expect(formatRefreshCountdown("monthly", at("2026-10-04T00:00:00Z"))).toBe("D28:00:00");
  });

  it("섞인 탭은 가장 짧은 주기를 따르고, 주기가 없으면 비운다", () => {
    expect(shortestRefresh(["weekly", "monthly", "none"])).toBe("weekly");
    expect(shortestRefresh(["none", "once"])).toBeUndefined();
  });
});
