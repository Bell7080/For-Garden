import { afterEach, describe, expect, it } from "vitest";
import { ancientDayKey, ancientResetWarningDue, ancientSeasonEndsAt, ancientSeasonIndex, ancientSeasonKey, rollAncientSeason } from "../../src/core/ancientStrata";
import { getAncientStrataFloor, setActiveAncientSeason } from "../../src/core/ancientStrataBattle";
import { ANCIENT_MONTHLY_RANK_REWARDS, rankRewardGems } from "../../src/data/competitiveRewards";

afterEach(() => setActiveAncientSeason(""));

describe("고대 지층 월간 시즌", () => {
  it("달 키는 UTC로 끊고 다음 달 1일 00:00에 끝난다", () => {
    expect(ancientSeasonKey(new Date(Date.UTC(2026, 9, 31, 23, 59)))).toBe("2026-10");
    expect(ancientSeasonKey(new Date(Date.UTC(2026, 10, 1)))).toBe("2026-11");
    expect(ancientSeasonEndsAt("2026-10").toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(ancientSeasonEndsAt("2026-12").toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(ancientSeasonIndex("2026-11") - ancientSeasonIndex("2026-10")).toBe(1);
    expect(ancientSeasonIndex("")).toBe(0);
  });

  it("달이 바뀌면 지층 기록만 지우고, 키가 없던 예전 저장은 지우지 않는다", () => {
    const cleared = new Set(["1-10", "ancient:1", "ancient:2", "normal:2-10"]);
    const now = new Date(Date.UTC(2026, 10, 2));
    expect(rollAncientSeason("2026-11", cleared, now)).toBeNull();
    expect(rollAncientSeason("2026-10", cleared, now)).toEqual({ season: "2026-11", cleared: new Set(["1-10", "normal:2-10"]) });
    expect(rollAncientSeason("", cleared, now)).toEqual({ season: "2026-11", cleared });
  });

  it("같은 층도 달마다 시련과 명단이 바뀌고 조우의 종류는 그대로다", () => {
    const a = Array.from({ length: 10 }, (_, i) => getAncientStrataFloor(i + 1, "2026-10"));
    const b = Array.from({ length: 10 }, (_, i) => getAncientStrataFloor(i + 1, "2026-11"));
    expect(a.map((f) => f.encounterKind)).toEqual(b.map((f) => f.encounterKind));
    expect(a.map((f) => f.trialId)).not.toEqual(b.map((f) => f.trialId));
    expect(a.map((f) => f.enemies.map((e) => e.id).join())).not.toEqual(b.map((f) => f.enemies.map((e) => e.id).join()));
    // 활성 시즌이 기본값이다 — 서버와 화면이 같은 달을 읽는다.
    setActiveAncientSeason("2026-11");
    expect(getAncientStrataFloor(3).enemies.map((e) => e.stats)).toEqual(b[2].enemies.map((e) => e.stats));
  });
});

describe("지층 초기화 예고", () => {
  it("초기화 사흘 안에서만, 하루 한 번 뜬다", () => {
    const at = (day: number, hour = 12) => new Date(Date.UTC(2026, 9, day, hour));
    expect(ancientResetWarningDue("2026-10", at(28, 23), "")).toBe(false);
    expect(ancientResetWarningDue("2026-10", at(29, 1), "")).toBe(true);
    expect(ancientResetWarningDue("2026-10", at(31), "")).toBe(true);
    expect(ancientResetWarningDue("2026-10", at(31), ancientDayKey(at(31)))).toBe(false);
    expect(ancientResetWarningDue("2026-10", at(31), ancientDayKey(at(30)))).toBe(true);
    // 달 키가 없는 저장은 이번 달로 본다.
    expect(ancientResetWarningDue("", at(30), "")).toBe(true);
  });
});

describe("월간 순위 보상표", () => {
  it("1,000위까지는 순위, 그 밖은 백분율, 나머지는 참여 보상이다", () => {
    const t = ANCIENT_MONTHLY_RANK_REWARDS;
    expect(rankRewardGems(t, 1, 50)).toBe(3000);
    expect(rankRewardGems(t, 10, 50)).toBe(1500);
    expect(rankRewardGems(t, 1000, 100_000)).toBe(600);
    expect(rankRewardGems(t, 1001, 100_000)).toBe(500);
    expect(rankRewardGems(t, 10_000, 100_000)).toBe(500);
    expect(rankRewardGems(t, 20_000, 100_000)).toBe(400);
    expect(rankRewardGems(t, 50_000, 100_000)).toBe(300);
    expect(rankRewardGems(t, 90_000, 100_000)).toBe(200);
  });

  it("어느 순위도 0이 아니고, 순위가 내려가면 보상이 늘지 않는다", () => {
    let previous = Infinity;
    for (const rank of [1, 2, 3, 4, 11, 51, 101, 301, 1001, 5000, 20_000, 40_000, 80_000]) {
      const gems = rankRewardGems(ANCIENT_MONTHLY_RANK_REWARDS, rank, 100_000);
      expect(gems).toBeGreaterThan(0);
      expect(gems).toBeLessThanOrEqual(previous);
      previous = gems;
    }
  });
});
