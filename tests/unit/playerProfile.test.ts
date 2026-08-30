import { describe, expect, it } from "vitest";
import { createDefaultSession } from "../../src/state/session";
import { playerProfileDisplay, profileAvatarContent } from "../../src/state/playerProfile";

describe("player profile display", () => {
  it("공개 설정과 대표 렐릭만 표시 모델로 모은다", () => {
    const state = createDefaultSession(); state.settings.account.displayId = "PUBLIC-072"; state.favorite = "rex";
    // 프로필은 임시 상수가 아니라 서버 경계를 통해 세션에 확정된 연구 진행을 읽는다.
    state.playerResearch = { level: 7, experience: 45, experienceToNext: 180 };
    expect(playerProfileDisplay(state)).toMatchObject({ displayName: "연구원", level: 7, experience: 45, experienceToNext: 180, displayId: "PUBLIC-072", representativeRelic: "렉시아" });
    // 표시 모델 계약에는 토큰이나 내부 계정 식별자를 추가할 수 없다.
    expect(Object.keys(playerProfileDisplay(state))).not.toContain("token");
  });

  it("아바타가 없을 때만 유니코드 첫 글자를 fallback으로 쓴다", () => {
    const profile = { ...playerProfileDisplay(createDefaultSession()), displayName: "🌿연구원", avatarAssetKey: "avatar-1" };
    expect(profileAvatarContent(profile, () => false)).toEqual({ fallback: "🌿" });
    expect(profileAvatarContent(profile, (key) => key === "avatar-1")).toEqual({ assetKey: "avatar-1", fallback: "🌿" });
  });
});
