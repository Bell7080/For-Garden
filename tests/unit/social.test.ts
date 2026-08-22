import { describe, expect, it } from "vitest";
import { canUseFriendHelper, DAILY_HELPER_LIMIT, helperRentalAvailability } from "../../src/core/social";
import { FakeSocialServer } from "../../src/api/FakeSocialServer";

describe("친구 조력자 규칙", () => {
  it("일반·반복 콘텐츠만 허용하고 고난도·경쟁·보스에서는 차단한다", () => {
    expect(["story_normal", "resource", "daily_restoration"].every((kind) => canUseFriendHelper(kind as "story_normal"))).toBe(true);
    expect(["story_hard", "ranked", "raid"].some((kind) => canUseFriendHelper(kind as "story_hard"))).toBe(false);
  });

  it("일일 제한을 넘기지 않고 음수 입력도 안전하게 정규화한다", () => {
    expect(helperRentalAvailability(-2)).toEqual({ allowed: true, remaining: DAILY_HELPER_LIMIT });
    expect(helperRentalAvailability(DAILY_HELPER_LIMIT)).toEqual({ allowed: false, remaining: 0 });
  });

  it("대여자와 제공자에게 같은 포인트를 지급하고 네 번째 대여를 거절한다", async () => {
    const server = new FakeSocialServer();
    for (let index = 0; index < DAILY_HELPER_LIMIT; index += 1) {
      await expect(server.rentFavoriteRelic("friend-haneul")).resolves.toMatchObject({ renterPointsEarned: 10, ownerPointsEarned: 10 });
    }
    await expect(server.rentFavoriteRelic("friend-haneul")).rejects.toMatchObject({ code: "DAILY_HELPER_LIMIT" });
  });
});
