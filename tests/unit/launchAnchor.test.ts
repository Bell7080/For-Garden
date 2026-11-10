import { afterEach, describe, expect, it } from "vitest";
import { cycleAnchor, holdsDefinitionEnds, isLaunched, mondayOf, setLaunchAt, setPrelaunchHold } from "../../src/core/launchAnchor";
import { scheduledWindow, windowOpen } from "../../src/core/liveSchedule";
import { SEASON_EPOCH_MS, seasonKey } from "../../src/core/seasonPass";
import { activeRegularEventId, ROTATION_ANCHOR } from "../../src/core/regularEventRotation";
import { duelSeasonNumber } from "../../src/core/duelArena";
import { rouletteStatus } from "../../src/core/roulette";
import { activeLobbyEvents, scheduledLobbyEvent } from "../../src/ui/lobbyEventModel";
import { LOBBY_EVENTS, lobbyEventClockEnd } from "../../src/data/lobbyEvents";

afterEach(() => {
  setLaunchAt(null);
  setPrelaunchHold(false);
});

const LATE = Date.parse("2027-03-01T00:00:00Z");

describe("출시 시각 — 출시 전 유예", () => {
  it("출시 전에는 정의의 끝 날짜로 내리지 않고 시작 날짜는 지킨다", () => {
    setPrelaunchHold(true);
    expect(holdsDefinitionEnds()).toBe(true);
    const window = scheduledWindow("product", "x", { startsAt: "2026-01-01T00:00:00Z", endsAt: "2026-11-01T00:00:00Z" }, []);
    expect(window.endsAt).toBeUndefined();
    expect(windowOpen(window, LATE)).toBe(true);
    expect(windowOpen(scheduledWindow("product", "y", { startsAt: "2030-01-01T00:00:00Z" }, []), LATE)).toBe(false);
  });

  it("운영 일정 줄이 정한 기간은 출시 전에도 그대로 따른다", () => {
    setPrelaunchHold(true);
    const window = scheduledWindow("product", "x", { endsAt: "2030-01-01T00:00:00Z" }, [{ kind: "product", id: "x", startsAt: null, endsAt: "2026-12-01T00:00:00Z", enabled: true }]);
    expect(windowOpen(window, LATE)).toBe(false);
  });

  it("출시 뒤에는 유예가 끝나 끝 날짜가 다시 선다", () => {
    setPrelaunchHold(true);
    setLaunchAt("2027-02-03T09:00:00Z");
    expect(isLaunched()).toBe(true);
    expect(holdsDefinitionEnds()).toBe(false);
    expect(windowOpen(scheduledWindow("product", "x", { endsAt: "2026-11-01T00:00:00Z" }, []), LATE)).toBe(false);
  });

  it("돌림판·디안 픽업 카드가 출시 전에는 기한을 넘겨도 서고 기한 시계가 없다", () => {
    setPrelaunchHold(true);
    const ids = activeLobbyEvents(LATE, LOBBY_EVENTS, false).map(({ id }) => id);
    expect(ids).toEqual(expect.arrayContaining(["wolf-cafe", "research-roulette"]));
    expect(lobbyEventClockEnd(scheduledLobbyEvent(LOBBY_EVENTS.find(({ id }) => id === "wolf-cafe")!), LATE)).toBe("");
    expect(rouletteStatus({ date: "", claimsBySlot: {} }, new Date(LATE)).active).toBe(true);
    setLaunchAt("2027-01-04T00:00:00Z");
    expect(activeLobbyEvents(LATE, LOBBY_EVENTS, false).map(({ id }) => id)).not.toContain("wolf-cafe");
    expect(rouletteStatus({ date: "", claimsBySlot: {} }, new Date(LATE)).active).toBe(false);
  });
});

describe("출시 시각 — 주기 기준점", () => {
  it("출시 전에는 원래 기준점을 쓴다", () => {
    expect(cycleAnchor(SEASON_EPOCH_MS)).toBe(SEASON_EPOCH_MS);
    expect(cycleAnchor(ROTATION_ANCHOR)).toBe(ROTATION_ANCHOR);
  });

  it("월요일 경계는 UTC 00:00이다", () => {
    expect(new Date(mondayOf(Date.parse("2027-02-03T09:00:00Z"))).toISOString()).toBe("2027-02-01T00:00:00.000Z");
    expect(new Date(mondayOf(Date.parse("2027-02-01T00:00:00Z"))).toISOString()).toBe("2027-02-01T00:00:00.000Z");
    expect(new Date(mondayOf(Date.parse("2027-01-31T23:59:59Z"))).toISOString()).toBe("2027-01-25T00:00:00.000Z");
  });

  it("출시 날이 시즌 패스 S1 · 결투 S1 · 교대 첫 칸이다", () => {
    const launch = "2027-02-03T09:00:00Z";
    expect(seasonKey(Date.parse(launch))).not.toBe("S1");
    setLaunchAt(launch);
    expect(seasonKey(Date.parse(launch))).toBe("S1");
    expect(duelSeasonNumber(new Date(launch))).toBe(1);
    expect(activeRegularEventId(Date.parse(launch))).toBe("chest-forge");
    // 출시 주의 월요일부터 28일이 지나면 S2다.
    expect(seasonKey(Date.parse("2027-03-01T00:00:00Z"))).toBe("S2");
    expect(activeRegularEventId(Date.parse("2027-02-08T00:00:00Z"))).toBe("delophy-hunt");
  });
});
