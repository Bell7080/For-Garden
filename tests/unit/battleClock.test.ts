import { describe, expect, it } from "vitest";
import { BATTLE_CLOCK_HOUR_SECONDS, BATTLE_DEATH_CLOCK, deathClockClosesBySeconds, deathClockCumulativePercent, deathClockSurvivalMultiplier, deathClockTickPercent, deathClockTicksAt, formatBattleClock, isDeathClockRunning } from "../../src/core/battleClock";

describe("전투 진행 시계", () => {
  it("는 분·초·100분의 1초를 두 자리씩 적는다", () => {
    expect(formatBattleClock(0)).toBe("00:00:00");
    expect(formatBattleClock(9.25)).toBe("00:09:25");
    expect(formatBattleClock(75.5)).toBe("01:15:50");
  });

  it("는 올림하지 않는다", () => {
    // 0.999초를 01초로 적으면 시작하자마자 1초가 지난 것으로 보인다.
    expect(formatBattleClock(0.999)).toBe("00:00:99");
    expect(formatBattleClock(59.999)).toBe("00:59:99");
  });

  it("는 한 시간을 넘기면 시 자리를 하나 더 세운다", () => {
    // 분 자리가 61·183처럼 자라면 그 줄이 갑자기 넓어져 옆의 것을 민다.
    expect(formatBattleClock(BATTLE_CLOCK_HOUR_SECONDS)).toBe("01:00:00:00");
    expect(formatBattleClock(BATTLE_CLOCK_HOUR_SECONDS - 0.01)).toBe("59:59:99");
    expect(formatBattleClock(BATTLE_CLOCK_HOUR_SECONDS * 2 + 61.5)).toBe("02:01:01:50");
  });

  it("는 망가진 값을 화면에 흘리지 않는다", () => {
    for (const broken of [Number.NaN, -1, Number.POSITIVE_INFINITY]) {
      expect(formatBattleClock(broken), String(broken)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    }
  });
});

describe("데스 카운트", () => {
  it("는 시작 시각을 넘기기 전에는 돌지 않는다", () => {
    expect(deathClockTicksAt(0)).toBe(0);
    expect(deathClockTicksAt(BATTLE_DEATH_CLOCK.startsAtSeconds - 0.01)).toBe(0);
    expect(isDeathClockRunning(BATTLE_DEATH_CLOCK.startsAtSeconds - 1)).toBe(false);
    // 시작 시각에 닿는 그 순간 첫 번째가 돈다 — "넘어가면 작동한다"가 화면과 어긋나지 않게.
    expect(deathClockTicksAt(BATTLE_DEATH_CLOCK.startsAtSeconds)).toBe(1);
    expect(isDeathClockRunning(BATTLE_DEATH_CLOCK.startsAtSeconds)).toBe(true);
  });

  it("는 매초 한 번씩 돈다", () => {
    expect(deathClockTicksAt(BATTLE_DEATH_CLOCK.startsAtSeconds + 9.9)).toBe(10);
    expect(deathClockTicksAt(BATTLE_DEATH_CLOCK.startsAtSeconds + 10)).toBe(11);
  });

  it("는 회복과 보호막을 같은 배율로 시들게 한다", () => {
    // 한쪽만 깎으면 남은 쪽으로 버티는 편성이 그대로 살아남는다.
    expect(deathClockSurvivalMultiplier(0)).toBe(1);
    // 첫 번째 1% → 열 번째까지 1 + 1.5 + … + 5.5 = 32.5%.
    expect(deathClockSurvivalMultiplier(BATTLE_DEATH_CLOCK.startsAtSeconds)).toBeCloseTo(0.99, 6);
    expect(deathClockSurvivalMultiplier(BATTLE_DEATH_CLOCK.startsAtSeconds + 9)).toBeCloseTo(0.675, 6);
  });

  it("는 돌수록 세진다 — 끌리는 판일수록 빠르게 닫힌다", () => {
    expect(deathClockTickPercent(0)).toBe(0);
    expect(deathClockTickPercent(1)).toBe(BATTLE_DEATH_CLOCK.firstTickPercent);
    for (let tick = 2; tick < 30; tick += 1) expect(deathClockTickPercent(tick)).toBeGreaterThan(deathClockTickPercent(tick - 1));
    // 누적은 틱 하나하나의 합과 같다(화면·전투가 같은 값을 읽는다).
    let sum = 0;
    for (let tick = 1; tick <= 25; tick += 1) { sum += deathClockTickPercent(tick); expect(deathClockCumulativePercent(tick)).toBeCloseTo(sum, 9); }
    // 고정 2%이던 때(50번 · 2분 20초)보다 훨씬 빨리 닫힌다.
    expect(deathClockClosesBySeconds() - BATTLE_DEATH_CLOCK.startsAtSeconds).toBeLessThanOrEqual(20);
  });

  it("는 반드시 0에 닿고 그 아래로는 내려가지 않는다", () => {
    /*
     * 피해만 얹으면 회복량이 그 피해보다 큰 편성은 여전히 영원히 산다. 버티는 수단이 0이
     * 되는 시각이 있어야 어떤 편성이든 판이 닫힌다.
     */
    const zeroAt = deathClockClosesBySeconds();
    expect(deathClockSurvivalMultiplier(zeroAt)).toBe(0);
    expect(deathClockSurvivalMultiplier(zeroAt + 600)).toBe(0);
  });
});
