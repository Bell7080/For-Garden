import { describe, expect, it } from "vitest";
import { guildAttendanceRace } from "../../src/core/guildRace";

const m = (userId: string, week: number, isMe = false) => ({ userId, isMe, contributionWeek: week, contributionTotal: week });

describe("출석판 기여도 경쟁 줄", () => {
  it("바로 위 한 사람을 넘으면 자리를 바꾼다", () => {
    const race = guildAttendanceRace([m("a", 50), m("b", 25), m("me", 20, true)], 10)!;
    expect(race.rival?.userId).toBe("b");
    expect(race.meOnTopBefore).toBe(false);
    expect(race.overtook).toBe(true);
    expect(race.meOnTopAfter).toBe(true);
    expect([race.rankBefore, race.rankAfter]).toEqual([3, 2]);
    expect([race.rivalRankBefore, race.rivalRankAfter]).toEqual([2, 3]);
  });
  it("같은 값에 닿기만 하면 앞지른 것이 아니다", () => {
    const race = guildAttendanceRace([m("b", 30), m("me", 20, true)], 10)!;
    expect(race.overtook).toBe(false);
    expect(race.rankAfter).toBe(1);
  });
  it("이미 1위면 나를 위에, 2위를 아래에 둔다", () => {
    const race = guildAttendanceRace([m("me", 40, true), m("b", 10)], 10)!;
    expect(race.rival?.userId).toBe("b");
    expect(race.meOnTopBefore && race.meOnTopAfter).toBe(true);
    expect(race.overtook).toBe(false);
  });
  it("혼자인 길드는 나 혼자 선다", () => {
    const race = guildAttendanceRace([m("me", 0, true)], 10)!;
    expect(race.rival).toBeUndefined();
    expect(race.after).toBe(10);
  });
});
