import { describe, expect, it } from "vitest";
import { createDefaultSession } from "../../src/state/session";
import { playerProfileDisplay, profileAvatarContent } from "../../src/state/playerProfile";
import { validateEquippedProfileModifiers } from "../../src/managers/PlayerProfileManager";
import { compactProfileText, PLAYER_PROFILE_LAYOUT } from "../../src/ui/playerProfileLayout";
import { compactTopBarName, TOP_BAR_LAYOUT } from "../../src/ui/topBarLayout";

describe("player profile display", () => {
  it("공개 설정과 대표 렐릭만 표시 모델로 모은다", () => {
    const state = createDefaultSession(); state.settings.account.displayId = "PUBLIC-072"; state.favorite = "rex";
    // 프로필은 임시 상수가 아니라 서버 경계를 통해 세션에 확정된 연구 진행을 읽는다.
    state.playerResearch = { level: 7, experience: 45, experienceToNext: 180 };
    expect(playerProfileDisplay(state)).toMatchObject({ displayName: "연구원", level: 7, experience: 45, experienceToNext: 180, displayId: "PUBLIC-072", representativeRelic: "렉시아" });
    // 표시 모델 계약에는 토큰이나 내부 계정 식별자를 추가할 수 없다.
    expect(Object.keys(playerProfileDisplay(state))).not.toContain("token");
  });

  it("획득한 공개 수식어만 중복 없이 장착 상한까지 허용한다", () => {
    const catalog = [
      { id: "first", displayName: "최초의 복원", rarity: "rare", colorRole: "research" },
      { id: "deep", displayName: "심층 원정대", rarity: "epic", colorRole: "expedition" },
      { id: "gold", displayName: "황금 기록", rarity: "legendary", colorRole: "prestige" },
      { id: "plain", displayName: "관찰자", rarity: "common", colorRole: "neutral" },
    ] as const;
    const result = validateEquippedProfileModifiers(catalog, { earnedModifierIds: ["first", "deep", "gold", "plain"], equippedModifierIds: ["first", "locked", "first", "deep", "gold", "plain"] });
    expect(result.map(({ id }) => id)).toEqual(["first", "deep", "gold"]);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("긴 헤더 문자열과 수식어 한 줄의 bounds를 순수 상수로 제한한다", () => {
    expect(compactProfileText("아주긴플레이어이름이팝업을넘지않습니다", 10)).toBe("아주긴플레이어이름…");
    const chipsWidth = PLAYER_PROFILE_LAYOUT.modifiers.width * 3 + PLAYER_PROFILE_LAYOUT.modifiers.gap * 2;
    expect(chipsWidth).toBeLessThan(PLAYER_PROFILE_LAYOUT.popup.width - 100);
    expect(PLAYER_PROFILE_LAYOUT.header.bottom).toBeLessThan(PLAYER_PROFILE_LAYOUT.rows.firstY);
  });

  it("1080px 상단에서 긴 이름을 줄이고 프로필과 세 재화 칸 사이를 띄운다", () => {
    // Phaser bounds 없이도 168px 세 칸과 24px 간격의 실제 왼쪽 끝을 계산해 회귀를 막는다.
    const currencyLeft = 1080 * TOP_BAR_LAYOUT.clusterCenter - (168 * 3 + 24 * 2) / 2;
    expect(currencyLeft - TOP_BAR_LAYOUT.profile.maxRight).toBeGreaterThanOrEqual(24);
    expect(compactTopBarName("아주긴플레이어이름입니다")).toBe("아주긴플레이어이름…");
  });

  it("아바타가 없을 때만 유니코드 첫 글자를 fallback으로 쓴다", () => {
    const profile = { ...playerProfileDisplay(createDefaultSession()), displayName: "🌿연구원", avatarAssetKey: "avatar-1" };
    expect(profileAvatarContent(profile, () => false)).toEqual({ fallback: "🌿" });
    expect(profileAvatarContent(profile, (key) => key === "avatar-1")).toEqual({ assetKey: "avatar-1", fallback: "🌿" });
  });
});
