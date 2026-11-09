import { afterEach, describe, expect, it } from "vitest";
import { parseLiveSchedule, scheduledWindow, scheduleOpen, setLiveSchedule } from "../../src/core/liveSchedule";
import { bannerActive } from "../../src/core/gacha";
import { activeLobbyEvents, scheduledLobbyEvent } from "../../src/ui/lobbyEventModel";
import { LOBBY_EVENTS } from "../../src/data/lobbyEvents";

afterEach(() => setLiveSchedule([]));

describe("운영 일정 — 서버가 기간만 덮는다", () => {
  it("줄이 없으면 정의 기간 그대로, 있으면 그 줄이 덮고 null은 그쪽 끝을 연다", () => {
    const def = { startsAt: "2026-11-10T00:00:00Z", endsAt: "2026-11-24T00:00:00Z" };
    expect(scheduledWindow("banner", "amber", def, [])).toEqual({ ...def, enabled: true, overridden: false });
    const entries = parseLiveSchedule([{ kind: "banner", id: "amber", startsAt: null, endsAt: "2026-12-01T00:00:00Z", enabled: true }]);
    expect(scheduledWindow("banner", "amber", def, entries)).toEqual({ endsAt: "2026-12-01T00:00:00.000Z", enabled: true, overridden: true });
    expect(scheduleOpen("banner", "amber", def, Date.parse("2026-11-01T00:00:00Z"), entries)).toBe(true);
    expect(scheduleOpen("banner", "amber", def, Date.parse("2026-12-01T00:00:00Z"), entries)).toBe(false);
  });

  it("꺼 둔 줄은 기간과 상관없이 닫고, 모양이 틀린 줄만 버린다", () => {
    const entries = parseLiveSchedule([
      { kind: "banner", id: "fossil", startsAt: null, endsAt: null, enabled: false },
      { kind: "nope", id: "x" }, { kind: "product", id: "" }, { kind: "event", id: "y", startsAt: "어제" }, null, 3,
    ]);
    expect(entries).toEqual([{ kind: "banner", id: "fossil", startsAt: null, endsAt: null, enabled: false }]);
    expect(parseLiveSchedule("not an array")).toEqual([]);
    expect(bannerActive({ id: "fossil" }, new Date(), entries)).toBe(false);
  });

  it("배너 판정이 프로세스의 일정을 읽는다", () => {
    const now = new Date("2026-11-09T00:00:00Z");
    expect(bannerActive({ id: "amber" }, now)).toBe(true);
    setLiveSchedule([{ kind: "banner", id: "amber", startsAt: "2026-11-10T00:00:00Z", endsAt: null, enabled: true }]);
    expect(bannerActive({ id: "amber" }, now)).toBe(false);
    // id 없이 부르면 정의의 기간만 본다.
    expect(bannerActive({}, now)).toBe(true);
  });

  it("로비 카드는 일정이 덮은 기간으로 서고, 모집으로 가는 카드는 그 배너가 닫히면 함께 내린다", () => {
    const now = Date.parse("2026-11-09T00:00:00Z");
    const wolf = LOBBY_EVENTS.find(({ id }) => id === "wolf-cafe")!;
    expect(activeLobbyEvents(now, LOBBY_EVENTS, false).map(({ id }) => id)).toContain("wolf-cafe");
    setLiveSchedule([{ kind: "lobby", id: "wolf-cafe", startsAt: null, endsAt: "2026-11-20T00:00:00Z", enabled: true }]);
    expect(scheduledLobbyEvent(wolf).endsAt).toBe("2026-11-20T00:00:00.000Z");
    expect(activeLobbyEvents(now, LOBBY_EVENTS, false).find(({ id }) => id === "wolf-cafe")?.endsAt).toBe("2026-11-20T00:00:00.000Z");
    setLiveSchedule([{ kind: "banner", id: "amber", startsAt: null, endsAt: null, enabled: false }]);
    expect(activeLobbyEvents(now, LOBBY_EVENTS, false).map(({ id }) => id)).not.toContain("wolf-cafe");
  });
});
