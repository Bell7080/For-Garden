import { describe, expect, it } from "vitest";
import { findLobbyEvent, LOBBY_EVENTS, type LobbyEventDef } from "../../src/data/lobbyEvents";
import { activeLobbyEvents, lobbyEventListLayout, lobbyEventRemaining } from "../../src/ui/lobbyEventModel";

const at = (iso: string) => Date.parse(iso);
const sample = (id: string, startsAt: string, endsAt: string): LobbyEventDef => ({ id, titleKey: "event.title", subtitleKey: "event.title", startsAt, endsAt });

describe("로비 이벤트", () => {
  it("는 ID가 겹치지 않고 기간이 앞뒤로 맞는다", () => {
    expect(new Set(LOBBY_EVENTS.map(({ id }) => id)).size).toBe(LOBBY_EVENTS.length);
    for (const event of LOBBY_EVENTS) expect(Date.parse(event.startsAt), event.id).toBeLessThan(Date.parse(event.endsAt));
  });

  it("는 열린 것만 정의 순서대로 세운다", () => {
    const events = [
      sample("ended", "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z"),
      sample("open", "2026-01-01T00:00:00Z", "2026-12-01T00:00:00Z"),
      sample("soon", "2026-11-01T00:00:00Z", "2026-12-01T00:00:00Z"),
    ];
    expect(activeLobbyEvents(at("2026-06-01T00:00:00Z"), events).map(({ id }) => id)).toEqual(["open"]);
  });

  it("는 남은 기간을 올려서 한 단위로 센다", () => {
    const end = "2026-06-10T00:00:00Z";
    expect(lobbyEventRemaining(end, at("2026-06-01T00:00:00Z"))).toEqual({ unit: "days", value: 9 });
    expect(lobbyEventRemaining(end, at("2026-06-09T12:00:00Z"))).toEqual({ unit: "hours", value: 12 });
    expect(lobbyEventRemaining(end, at("2026-06-09T23:30:00Z"))).toEqual({ unit: "minutes", value: 30 });
    expect(lobbyEventRemaining(end, at("2026-06-11T00:00:00Z"))).toEqual({ unit: "minutes", value: 1 });
  });

  it("는 모르는 ID를 찾지 않는다", () => {
    expect(findLobbyEvent("wolf-cafe")?.id).toBe("wolf-cafe");
    expect(findLobbyEvent("nope")).toBeUndefined();
    expect(findLobbyEvent(undefined)).toBeUndefined();
  });

  it("판은 카드가 판 안에 들고, 적게 열리면 가운데로 모인다", () => {
    const full = lobbyEventListLayout(3, 3);
    const half = full.height / 2;
    for (const center of full.centers) {
      expect(center - full.cardHeight / 2).toBeGreaterThan(-half + 100);
      expect(center + full.cardHeight / 2).toBeLessThan(half - 80);
    }
    const one = lobbyEventListLayout(1, 3);
    expect(one.height).toBe(full.height);
    expect(one.centers[0]).toBeCloseTo(full.centers[1]);
  });
});
