import { describe, expect, it } from "vitest";
import { findLobbyEvent, LOBBY_EVENTS, type LobbyEventDef } from "../../src/data/lobbyEvents";
import { activeLobbyEvents, lobbyEventListLayout, lobbyEventRemaining, prioritizeLobbyEvents, lobbyEventEntryId } from "../../src/ui/lobbyEventModel";

const at = (iso: string) => Date.parse(iso);
const sample = (id: string, startsAt: string, endsAt: string): LobbyEventDef => ({ id, titleKey: "event.title", subtitleKey: "event.title", backdropKey: "background-lobby", startsAt, endsAt });

describe("로비 이벤트", () => {
  it("미완료 카드를 위로 모으고 완료 후 재조회해도 같은 순서를 유지한다", () => {
    const entries = LOBBY_EVENTS.map(event => ({ kind: "event" as const, event }));
    const ready = new Set(["research-roulette"]);
    expect(prioritizeLobbyEvents(entries, ready).map(lobbyEventEntryId)[0]).toBe("research-roulette");
    const completed = prioritizeLobbyEvents(entries, new Set());
    expect(prioritizeLobbyEvents(completed, new Set())).toEqual(completed);
  });

  it("모든 이벤트 카드가 같은 양식으로 선다 — 원화 뒷배경을 반드시 갖는다", () => {
    for (const event of LOBBY_EVENTS) expect(event.backdropKey, event.id).toMatch(/^background-/);
  });

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

  it("카드가 많아도 판은 1080×1920 화면보다 길어지지 않고 넘치면 판 안에서 흐른다", () => {
    const full = lobbyEventListLayout(6, 6);
    expect(full.height).toBeLessThanOrEqual(1640);
    expect(full.scroll.enabled).toBe(true);
    expect(full.scroll.min).toBeLessThan(0);
    // 맨 위로 둔 첫 카드는 흐르는 영역 안에서 시작하고, 끝까지 밀면 마지막 카드가 영역 안에 든다.
    expect(full.centers[0] - full.cardHeight / 2).toBeGreaterThanOrEqual(full.scroll.top);
    expect(full.centers[5] + full.cardHeight / 2 + full.scroll.min).toBeLessThanOrEqual(full.scroll.bottom);
    // 상한 안에 드는 적은 수는 예전처럼 흐르지 않는다.
    expect(lobbyEventListLayout(3, 3).scroll.enabled).toBe(false);
  });
});

import { retryUrl } from "../../src/core/retryUrl";
describe("로딩 재시도 주소", () => {
  it("실패한 응답이 캐시에서 돌아오지 않도록 retry 표식을 붙인다", () => {
    expect(retryUrl("sprites/a.webp", 1)).toBe("sprites/a.webp?retry=1");
    expect(retryUrl("a.svg?v=3", 2)).toBe("a.svg?v=3&retry=2");
  });
});
