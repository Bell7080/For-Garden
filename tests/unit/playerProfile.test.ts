import { describe, expect, it, vi } from "vitest";
import { createDefaultSession } from "../../src/state/session";
import { playerProfileDisplay, profileAvatarContent } from "../../src/state/playerProfile";
import { validateEquippedProfileModifiers } from "../../src/managers/PlayerProfileManager";
import { compactProfileText, PLAYER_PROFILE_LAYOUT } from "../../src/ui/playerProfileLayout";
import { compactTopBarName, TOP_BAR_LAYOUT } from "../../src/ui/topBarLayout";
import { highestClearedStage } from "../../src/core/stageProgress";
import { STAGES } from "../../src/data/stages";
import { loadPlayerProfileDisplay } from "../../src/managers/PlayerProfileManager";

describe("player profile display", () => {
  it("공개 설정과 대표 렐릭만 표시 모델로 모은다", () => {
    const state = createDefaultSession(); state.settings.account.displayId = "PUBLIC-072"; state.favorite = "rex";
    // 프로필은 임시 상수가 아니라 서버 경계를 통해 세션에 확정된 연구 진행을 읽는다.
    state.playerResearch = { level: 7, experience: 45, experienceToNext: 180 };
    expect(playerProfileDisplay(state)).toMatchObject({ displayName: "연구원", level: 7, experience: 45, experienceToNext: 180, displayId: "PUBLIC-072", representativeRelic: "렉시아" });
    // 표시 모델 계약에는 토큰이나 내부 계정 식별자를 추가할 수 없다.
    expect(Object.keys(playerProfileDisplay(state))).not.toContain("token");
  });

  it("Set 삽입 순서가 아니라 정적 정의 순서로 최고 스테이지를 고른다", () => {
    const cleared = new Set([STAGES[8].id, STAGES[1].id, "removed-stage", STAGES[5].id]);
    expect(highestClearedStage(STAGES, cleared)?.id).toBe(STAGES[8].id);
    expect(highestClearedStage(STAGES, new Set())).toBeUndefined();
  });

  it("애착 초상과 역대 원정 기록을 공개하고 서버 티어가 없으면 항목을 숨긴다", async () => {
    const state = createDefaultSession();
    state.favorite = "rex"; state.cleared = new Set(["1-3", "1-1"]); state.expedition.allTimeBestScore = 4321; state.expedition.bestScore = 9999;
    const hidden = await loadPlayerProfileDisplay(state, { getAsyncArenaServerState: async () => null });
    expect(hidden.competitiveStats).toMatchObject({ favoriteRelic: { relicId: "rex", displayName: "렉시아", portraitAssetId: "lexia" }, highestStage: { stageId: "1-3" }, expedition: { label: "역대 최고", score: 4321 } });
    expect(hidden.competitiveStats.arenaTier).toBeUndefined();
    const ranked = await loadPlayerProfileDisplay(state, { getAsyncArenaServerState: async () => ({ seasonTierId: "amber-2", activeDefenseSnapshotId: null, weekly: { weekId: "w", score: 1, wins: 0, losses: 0, updatedAt: "now" }, dailyAttempts: { utcDate: "today", used: 0, limit: 5 }, seasonReward: { seasonId: "s", finalTier: null, rewards: [], claimStatus: "not_eligible" } }) });
    expect(ranked.competitiveStats.arenaTier).toEqual({ tierId: "amber-2", displayName: "amber-2" });
  });

  it("획득한 공개 수식어만 중복 없이 장착 상한까지 허용한다", () => {
    const catalog = [
      { id: "first", displayName: "최초의 복원", rarity: "rare" },
      { id: "deep", displayName: "심층 원정대", rarity: "epic" },
      { id: "gold", displayName: "황금 기록", rarity: "legendary" },
      { id: "plain", displayName: "관찰자", rarity: "common" },
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

// 수식어 manager는 획득 조건과 장착 저장을 씬 밖의 단일 경계에서 소유한다.
describe("profile modifier manager", () => {
  it("보상 영수증과 수식어 획득을 같은 스냅샷에 합친다", async () => {
    const { ProfileModifierManager } = await import("../../src/managers/ProfileModifierManager");
    const state = createDefaultSession();
    const next = ProfileModifierManager.applyRewardReceipt(state, { claimedIds: ["daily-battle"], claimedResearchStageIds: [] });
    expect(next.earnedProfileModifierIds).toEqual(["field-pioneer"]);
    // 표시명은 저장 상태에 섞이지 않아 정적 문구 변경과 저장 호환성이 분리된다.
    expect(JSON.stringify(next)).not.toContain("현장 개척자");
  });

  it("미획득 장착을 거부하고 유효한 ID 목록만 한 번 저장한다", async () => {
    const { ProfileModifierManager } = await import("../../src/managers/ProfileModifierManager");
    const state = createDefaultSession(); state.earnedProfileModifierIds = ["field-pioneer"];
    const saves = { save: vi.fn() }; const manager = new ProfileModifierManager(state, saves);
    expect(() => manager.equip(["locked"])).toThrow();
    manager.equip(["field-pioneer"]);
    expect(state.equippedProfileModifierIds).toEqual(["field-pioneer"]); expect(saves.save).toHaveBeenCalledOnce();
  });
});
