import { describe, expect, it, vi } from "vitest";
import { grantPlayerExperience, normalizePlayerLevel, PLAYER_LEVEL_CAP, playerExpForStamina, playerExpToNext } from "../../src/core/playerLevel";
import { CONTENT_UNLOCKS, contentUnlockedBetween, isContentUnlocked, nextContentUnlock } from "../../src/core/contentUnlock";
import { cleanBio, createPlayerUid, isPlayerUid, nicknameProblem, normalizePlayerCard, researchDays } from "../../src/core/playerCard";
import { PROFILE_FRAMES } from "../../src/data/profileFrames";
import { PlayerCardManager } from "../../src/managers/PlayerCardManager";
import { createDefaultSession } from "../../src/state/session";
import { ABSOLUTE_STAMINA_MAX, staminaMaxForResearchLevel } from "../../src/core/stamina";
import { ARCHAEOLOGY_SITES } from "../../src/data/archaeologySites";

describe("연구원 레벨", () => {
  it("요구 경험치는 오르기만 하고, 상한 레벨에서 스테미나 상한이 절대 상한에 닿는다", () => {
    for (let level = 1; level < PLAYER_LEVEL_CAP; level += 1) expect(playerExpToNext(level + 1)).toBeGreaterThan(playerExpToNext(level));
    expect(staminaMaxForResearchLevel(PLAYER_LEVEL_CAP)).toBe(ABSOLUTE_STAMINA_MAX);
    // 초반은 빠르다 — 1 → 2가 스토리 열 판(6 스테미나)을 넘지 않는다.
    expect(playerExpToNext(1)).toBeLessThanOrEqual(60);
  });

  it("고고학이 여는 가장 높은 유적도 몇 주 안에 닿는 레벨이다", () => {
    const highest = Math.max(...ARCHAEOLOGY_SITES.map((site) => site.minimumLevel));
    let total = 0;
    for (let level = 1; level < highest; level += 1) total += playerExpToNext(level);
    // 하루 스테미나 약 300을 쓰는 계정이 한 달 안에 닿는다.
    expect(total).toBeLessThan(300 * 30);
  });

  it("넘친 경험치로 여러 레벨을 한 번에 오르고, 상한에서는 남는 몫을 버린다", () => {
    const start = normalizePlayerLevel({ level: 1, experience: 0 });
    const grant = grantPlayerExperience(start, playerExpToNext(1) + playerExpToNext(2) + 5);
    expect(grant.progress).toEqual({ level: 3, experience: 5, experienceToNext: playerExpToNext(3) });
    expect(grant.levelsGained).toBe(2);
    const capped = grantPlayerExperience({ level: PLAYER_LEVEL_CAP - 1, experience: 0, experienceToNext: 1 }, 10_000_000);
    expect(capped.progress).toEqual({ level: PLAYER_LEVEL_CAP, experience: 0, experienceToNext: playerExpToNext(PLAYER_LEVEL_CAP) });
    expect(grantPlayerExperience(capped.progress, 100).levelsGained).toBe(0);
  });

  it("저장의 요구치는 믿지 않고 공식에서 다시 구한다", () => {
    expect(normalizePlayerLevel({ level: 4, experience: 999, experienceToNext: 150 })).toEqual({ level: 4, experience: playerExpToNext(4) - 1, experienceToNext: playerExpToNext(4) });
    expect(normalizePlayerLevel(undefined)).toEqual({ level: 1, experience: 0, experienceToNext: playerExpToNext(1) });
  });

  it("스테미나 1이 경험치 1이다", () => {
    expect(playerExpForStamina(6)).toBe(6);
    expect(playerExpForStamina(-3)).toBe(0);
  });
});

describe("레벨이 여는 콘텐츠", () => {
  it("한 레벨에 둘을 열지 않고 순서대로 선다", () => {
    const levels = CONTENT_UNLOCKS.map(({ level }) => level);
    expect(new Set(levels).size).toBe(levels.length);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
    expect(Math.max(...levels)).toBeLessThanOrEqual(PLAYER_LEVEL_CAP);
  });

  it("잠금을 켜면 표의 레벨이 효력을 갖고, 끄면 모두 열려 있다", () => {
    expect(isContentUnlocked("raid", 1, false)).toBe(true);
    expect(isContentUnlocked("raid", 19, true)).toBe(false);
    expect(isContentUnlocked("raid", 20, true)).toBe(true);
    expect(nextContentUnlock(1, false)).toBeUndefined();
    expect(nextContentUnlock(4, true)).toEqual({ id: "cakeOperation", level: 5 });
    expect(contentUnlockedBetween(4, 12, true).map(({ id }) => id)).toEqual(["cakeOperation", "archaeology", "interaction", "bounty"]);
  });
});

describe("플레이어 카드", () => {
  it("닉네임은 화면에 서는 글자로 세고 줄바꿈·제어 문자를 받지 않는다", () => {
    expect(nicknameProblem("가")).toBe("tooShort");
    expect(nicknameProblem("가나")).toBeUndefined();
    expect(nicknameProblem("🦖🦕")).toBeUndefined();
    expect(nicknameProblem("가".repeat(13))).toBe("tooLong");
    expect(nicknameProblem("가\u0007나")).toBe("invalidCharacter");
    expect(cleanBio("  첫 줄\n둘째 줄  ")).toBe("첫 줄 둘째 줄");
    expect(Array.from(cleanBio("가".repeat(60))).length).toBe(40);
  });

  it("UID는 아홉 자리이고 첫 자리가 0이 아니다", () => {
    const uid = createPlayerUid(() => 0);
    expect(uid).toBe("100000000");
    expect(isPlayerUid(uid)).toBe(true);
    expect(isPlayerUid("012345678")).toBe(false);
  });

  it("손상된 카드는 기본값으로 강등한다", () => {
    expect(normalizePlayerCard({ uid: "abc", nickname: "가", bio: 3, frameId: "gone", createdAt: "nope" })).toEqual({ uid: "", nickname: "", bio: "", frameId: PROFILE_FRAMES[0].id, avatarRelicId: "", createdAt: "", nicknameChangedAt: "" });
    expect(researchDays("2026-09-01T00:00:00.000Z", new Date("2026-09-03T12:00:00.000Z"))).toBe(3);
  });

  it("매니저는 규칙을 통과한 값만 저장하고 테두리는 레벨이 연 것만 고른다", () => {
    const state = createDefaultSession(); const saves = { save: vi.fn() };
    const manager = new PlayerCardManager(state, saves);
    manager.ensureIdentity(() => 0.5, new Date("2026-09-24T00:00:00.000Z"));
    expect(isPlayerUid(state.playerCard.uid)).toBe(true);
    expect(state.playerCard.createdAt).toBe("2026-09-24T00:00:00.000Z");
    const uid = state.playerCard.uid;
    manager.ensureIdentity(() => 0.1);
    expect(state.playerCard.uid).toBe(uid);
    expect(manager.setNickname("가")).toEqual({ ok: false, reason: "tooShort" });
    expect(manager.setNickname("  화석  사냥꾼 ")).toEqual({ ok: true });
    expect(state.playerCard.nickname).toBe("화석 사냥꾼");
    expect(manager.setFrame("amber")).toEqual({ ok: false, reason: "frameLocked" });
    state.playerResearch = { level: 20, experience: 0, experienceToNext: 1 };
    expect(manager.setFrame("amber")).toEqual({ ok: true });
    expect(state.playerCard.frameId).toBe("amber");
    // 프로필 사진은 보유한 렐릭만.
    expect(manager.setAvatar("pontos")).toEqual({ ok: false, reason: "notOwned" });
    expect(manager.setAvatar("rex")).toEqual({ ok: true });
    expect(state.playerCard.avatarRelicId).toBe("rex");
  });

  it("닉네임은 처음 정하는 것은 자유롭고, 바꾸는 것은 이레에 한 번이다", () => {
    const state = createDefaultSession(); const saves = { save: vi.fn() };
    const manager = new PlayerCardManager(state, saves);
    const day = (offset: number) => new Date(Date.parse("2026-09-24T00:00:00.000Z") + offset * 86_400_000);
    // 처음 정하는 이름은 세지 않는다 — 곧바로 한 번 더 바꿀 수 있다.
    expect(manager.setNickname("화석사냥꾼", day(0))).toEqual({ ok: true });
    expect(state.playerCard.nicknameChangedAt).toBe("");
    expect(manager.nicknameLockedUntil(day(0))).toBeUndefined();
    expect(manager.setNickname("호박석", day(0))).toEqual({ ok: true });
    // 바꾼 뒤로는 이레가 지나야 한다. 같은 이름을 다시 적는 것은 바꾼 것이 아니다.
    expect(manager.nicknameLockedUntil(day(1))?.toISOString()).toBe(day(7).toISOString());
    expect(manager.setNickname("원석", day(6))).toEqual({ ok: false, reason: "nicknameCooldown" });
    expect(manager.setNickname("호박석", day(6))).toEqual({ ok: true });
    expect(state.playerCard.nickname).toBe("호박석");
    expect(manager.setNickname("원석", day(7))).toEqual({ ok: true });
    expect(normalizePlayerCard({ nickname: "원석", nicknameChangedAt: "nope" }).nicknameChangedAt).toBe("");
  });

  it("테두리마다 장식의 생김새가 다르다", () => {
    expect(new Set(PROFILE_FRAMES.map(({ style }) => style)).size).toBe(PROFILE_FRAMES.length);
    const levels = PROFILE_FRAMES.map(({ unlockLevel }) => unlockLevel);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
    expect(levels[0]).toBe(1);
  });
});

describe("프로필 사진·테두리 선택창", () => {
  it("창 높이는 두 탭 중 긴 목록에서 구해 탭을 바꿔도 같다", async () => {
    const { AVATAR_PICKER, avatarPickerHeight, modifierPickerHeight, TEXT_EDITOR } = await import("../../src/ui/playerProfileLayout");
    const height = avatarPickerHeight(22, PROFILE_FRAMES.length);
    expect(height).toBeLessThan(1760);
    // 격자 다섯 칸이 창 폭 안에 든다.
    const photoWidth = AVATAR_PICKER.photos.columns * AVATAR_PICKER.photos.cell + (AVATAR_PICKER.photos.columns - 1) * AVATAR_PICKER.photos.gap;
    expect(photoWidth).toBeLessThan(AVATAR_PICKER.width - 40);
    const frameWidth = AVATAR_PICKER.frames.columns * AVATAR_PICKER.frames.width + (AVATAR_PICKER.frames.columns - 1) * AVATAR_PICKER.frames.gap;
    expect(frameWidth).toBeLessThan(AVATAR_PICKER.width - 40);
    // 미리보기 → 탭 → 목록이 겹치지 않는다(장식이 얼굴보다 한 뼘 크다).
    expect(AVATAR_PICKER.preview.y + AVATAR_PICKER.preview.size * 0.65).toBeLessThan(AVATAR_PICKER.tabs.y - AVATAR_PICKER.tabs.height / 2);
    expect(modifierPickerHeight(4)).toBeGreaterThan(modifierPickerHeight(1));
    expect(TEXT_EDITOR.saveY + TEXT_EDITOR.save.height / 2).toBeLessThan(TEXT_EDITOR.height / 2);
  });
});
