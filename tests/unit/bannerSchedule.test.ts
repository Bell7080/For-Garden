import { describe, expect, it } from "vitest";
import { BANNERS, PITY_GROUP } from "../../src/data/banners";
import { activeLobbyEvents } from "../../src/ui/lobbyEventModel";
import { currentPickupBannerId, currentPickupWindow } from "../../src/core/pickupRotation";
import { bannerActive } from "../../src/core/gacha";

describe("배너 기간과 천장", () => {
  it("기간이 없으면 늘 열려 있고, 시작 전·종료 뒤에는 닫힌다", () => {
    expect(bannerActive({}, new Date("2030-01-01T00:00:00Z"))).toBe(true);
    const b = { startsAt: "2026-11-10T00:00:00Z", endsAt: "2026-11-24T00:00:00Z" };
    expect(bannerActive(b, new Date("2026-11-09T23:59:59Z"))).toBe(false);
    expect(bannerActive(b, new Date("2026-11-10T00:00:00Z"))).toBe(true);
    expect(bannerActive(b, new Date("2026-11-24T00:00:00Z"))).toBe(false);
  });

  it("한정 픽업은 천장이 이월된다: 픽업 배너가 모두 한 천장 그룹을 쓰고, 할인 이월은 첫 복원 연구뿐이다", () => {
    const pickups = BANNERS.filter((b) => Object.keys(b.pickupRelicIds).length > 0);
    expect(pickups.length).toBeGreaterThan(1);
    expect(new Set(pickups.map((b) => b.pityGroupId))).toEqual(new Set([PITY_GROUP.LIMITED_PICKUP]));
    expect(BANNERS.filter((b) => b.carryoverTo !== undefined).map((b) => b.id)).toEqual(["welcome"]);
  });

  it("한정 픽업은 한 번에 하나만 선다: 지금은 플레샤, 3주 뒤 디안, 다시 3주 뒤 플레샤", () => {
    const at = (iso: string) => new Date(iso);
    const open = (iso: string) => BANNERS.filter((b) => Object.keys(b.pickupRelicIds).length > 0 && bannerActive(b, at(iso), [])).map((b) => b.id);
    expect(open("2026-11-14T00:00:00Z")).toEqual(["moonlit"]);
    expect(open("2026-12-03T23:59:59Z")).toEqual(["moonlit"]);
    expect(open("2026-12-04T00:00:00Z")).toEqual(["amber"]);
    expect(open("2026-12-25T00:00:00Z")).toEqual(["moonlit"]);
    expect(currentPickupWindow(Date.parse("2026-11-20T00:00:00Z"))).toEqual({ startsAt: "2026-11-13T00:00:00.000Z", endsAt: "2026-12-04T00:00:00.000Z" });
    expect(currentPickupBannerId(Date.parse("2026-11-12T00:00:00Z"))).toBe("amber");
    // 교대에 들지 않은 배너(화석 연구)는 막지 않는다.
    expect(bannerActive(BANNERS.find((b) => b.id === "fossil")!, at("2026-11-14T00:00:00Z"), [])).toBe(true);
  });

  it("운영 일정 줄이 덮은 픽업은 교대보다 그 줄을 따른다", () => {
    const amber = BANNERS.find((b) => b.id === "amber")!;
    expect(bannerActive(amber, new Date("2026-11-14T00:00:00Z"), [{ kind: "banner", id: "amber", startsAt: null, endsAt: null, enabled: true }])).toBe(true);
  });

  it("로비 카드도 그 차례의 픽업만 세우고, 차례가 끝나는 시각을 기한으로 단다", () => {
    const now = Date.parse("2026-11-14T00:00:00Z");
    const ids = activeLobbyEvents(now, undefined, false).map(({ id }) => id);
    expect(ids).toContain("moon-picnic");
    expect(ids).not.toContain("wolf-cafe");
    expect(activeLobbyEvents(now, undefined, false).find(({ id }) => id === "moon-picnic")?.endsAt).toBe("2026-12-04T00:00:00.000Z");
  });
});
