import { describe, expect, it } from "vitest";
import { defaultFriendSortDirection, isOnline, lastActiveAge, matchesUserQuery, normalizeSearchQuery, ONLINE_WINDOW_MS, viewFriends } from "../../src/core/social";

const NOW = 1_000_000_000;
const friends = [
  { id: "a", displayName: "Alpha", level: 10, lastActiveAt: NOW - 3_600_000 },
  { id: "b", displayName: "beta", level: 30, lastActiveAt: NOW - 1_000 },
  { id: "c", displayName: "Gamma", level: 20, lastActiveAt: NOW - 2 * 86_400_000 },
];
const base = { favoriteIds: new Set<string>(), nowMs: NOW };

describe("친구 보기 규칙", () => {
  it("접속 중은 5분 안쪽만이다", () => {
    expect(isOnline(NOW - ONLINE_WINDOW_MS + 1, NOW)).toBe(true);
    expect(isOnline(NOW - ONLINE_WINDOW_MS - 1, NOW)).toBe(false);
  });

  it("마지막 접속을 단위별로 말한다", () => {
    expect(lastActiveAge(NOW - 1000, NOW).unit).toBe("online");
    expect(lastActiveAge(NOW - 10 * 60_000, NOW)).toEqual({ unit: "minute", value: 10 });
    expect(lastActiveAge(NOW - 3 * 3_600_000, NOW)).toEqual({ unit: "hour", value: 3 });
    expect(lastActiveAge(NOW - 2 * 86_400_000, NOW)).toEqual({ unit: "day", value: 2 });
  });

  it("접속순은 최근이 위, 이름순은 오름차순이 기본이다", () => {
    expect(defaultFriendSortDirection("lastActive")).toBe(true);
    expect(defaultFriendSortDirection("name")).toBe(false);
    expect(viewFriends(friends, { ...base, filter: "all", sort: "lastActive", descending: true }).map((f) => f.id)).toEqual(["b", "a", "c"]);
    expect(viewFriends(friends, { ...base, filter: "all", sort: "name", descending: false }).map((f) => f.id)).toEqual(["a", "b", "c"]);
    expect(viewFriends(friends, { ...base, filter: "all", sort: "level", descending: true }).map((f) => f.id)).toEqual(["b", "c", "a"]);
  });

  it("필터는 즐겨찾기·접속 중을 가르고 즐겨찾기는 위로 모인다", () => {
    const favoriteIds = new Set(["c"]);
    expect(viewFriends(friends, { ...base, favoriteIds, filter: "favorite", sort: "name", descending: false }).map((f) => f.id)).toEqual(["c"]);
    expect(viewFriends(friends, { ...base, filter: "online", sort: "name", descending: false }).map((f) => f.id)).toEqual(["b"]);
    expect(viewFriends(friends, { ...base, favoriteIds, filter: "all", sort: "name", descending: false })[0].id).toBe("c");
  });

  it("한 검색어로 이름과 고유 ID를 함께 맞춘다", () => {
    expect(normalizeSearchQuery("  하늘 ")).toBe("하늘");
    const user = { displayName: "하늘정원", uid: "418207735" };
    expect(matchesUserQuery(user, "하늘")).toBe(true);
    expect(matchesUserQuery(user, "")).toBe(false);
    expect(matchesUserQuery(user, "418207735")).toBe(true);
    expect(matchesUserQuery(user, "418-207 735")).toBe(true);
    expect(matchesUserQuery(user, "4182")).toBe(false);
  });
});
