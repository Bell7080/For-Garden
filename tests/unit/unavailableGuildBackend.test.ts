import { describe, expect, it } from "vitest";
import { createUnavailableGuildBackend } from "../../src/api/UnavailableGuildBackend";

/**
 * 길드 저장소가 없는 서버의 자리는 **모든** 조작을 `UNAVAILABLE`로 거절해야 한다. 한때 문자열 목록이
 * `syncWarStandby`를 빠뜨려, 로비에 들어서기만 해도 `is not a function`이 422로 새었다.
 * 빠짐없음은 타입(`SERVER_ONLY_METHODS`)이 지키고, 여기서는 게임 서버만 부르는 조작이 실제로 거절되는지 본다.
 */
describe("길드 저장소 없는 서버", () => {
  it("게임 서버만 부르는 조작도 함수로 서서 UNAVAILABLE로 거절한다", async () => {
    const backend = createUnavailableGuildBackend() as unknown as Record<string, () => Promise<unknown>>;
    for (const name of ["syncWarStandby", "beginWarAttack", "recordWarAttack", "claimWeeklyRankRewards", "getGuild", "createGuild", "purchase"]) {
      expect(typeof backend[name], name).toBe("function");
      await expect(backend[name]!()).rejects.toMatchObject({ code: "UNAVAILABLE" });
    }
  });
});
