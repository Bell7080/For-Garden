import { describe, expect, it } from "vitest";
import { grantPlayerExperience, normalizePlayerLevel, PLAYER_LEVEL_CAP, PLAYER_LEVEL_UP_REWARD, playerExpBarSegments, playerExpRatio, type PlayerExpReceipt } from "../../src/core/playerLevel";
import { CONTENT_UNLOCKS } from "../../src/core/contentUnlock";
import { staminaMaxForResearchLevel } from "../../src/core/stamina";
import { PROFILE_FRAMES } from "../../src/data/profileFrames";
import { findItem } from "../../src/data/items";
import { FakeServer } from "../../src/api/FakeServer";
import { CONTENT_STAMINA_COSTS } from "../../src/data/contentCosts";
import { createDefaultSession } from "../../src/state/session";
import { mergePlayerExpReceipts, rememberPlayerExp, takePlayerExp } from "../../src/managers/PlayerExpReceipts";
import { playerLevelMilestones } from "../../src/ui/playerLevelTreeModel";
import { LEVEL_TREE_LEAF, LEVEL_TREE_VIEW, PLAYER_EXP_ROW } from "../../src/ui/playerExpLayout";
import { REWARD_TRACK } from "../../src/ui/expeditionRewardTrack";

const progress = (level: number, experience: number) => normalizePlayerLevel({ level, experience });

describe("결과판의 경험치 줄", () => {
  it("은 레벨이 그대로면 한 구간만 차오른다", () => {
    const before = progress(3, 10);
    const after = grantPlayerExperience(before, 6).progress;
    expect(playerExpBarSegments({ before, after })).toEqual([{ level: 3, from: playerExpRatio(before), to: playerExpRatio(after) }]);
  });

  it("은 레벨이 오를 때마다 끝까지 찼다가 빈 줄에서 다시 찬다", () => {
    const before = progress(1, 40);
    const grant = grantPlayerExperience(before, 200);
    expect(grant.levelsGained).toBeGreaterThanOrEqual(2);
    const segments = playerExpBarSegments({ before, after: grant.progress });
    expect(segments).toHaveLength(grant.levelsGained + 1);
    expect(segments[0]).toMatchObject({ level: 1, to: 1 });
    expect(segments.slice(1, -1).every(({ from, to }) => from === 0 && to === 1)).toBe(true);
    expect(segments.at(-1)).toMatchObject({ level: grant.progress.level, from: 0, to: playerExpRatio(grant.progress) });
  });

  it("은 만렙에서 가득 찬 줄로 멈춘다", () => {
    expect(playerExpRatio(progress(PLAYER_LEVEL_CAP, 0))).toBe(1);
  });

  it("은 판 안에 들고, 레벨업 병 액자가 판 밖으로 나가지 않는다", () => {
    const halfPopup = 940 / 2;
    expect(PLAYER_EXP_ROW.level.x).toBeGreaterThanOrEqual(-halfPopup + 60);
    expect(PLAYER_EXP_ROW.reward.x + PLAYER_EXP_ROW.reward.size / 2).toBeLessThanOrEqual(halfPopup - 60);
    expect(PLAYER_EXP_ROW.bar.left + PLAYER_EXP_ROW.bar.width).toBeLessThan(PLAYER_EXP_ROW.reward.x - PLAYER_EXP_ROW.reward.size / 2);
  });
});

describe("경험치 영수증", () => {
  const receipt = (from: number, to: number, levelsGained: number, bottles: number): PlayerExpReceipt => ({
    before: progress(from, 0), after: progress(to, 0), granted: 10, levelsGained,
    levelUpItems: bottles > 0 ? [{ itemId: PLAYER_LEVEL_UP_REWARD.itemId, quantity: bottles }] : [],
  });

  it("은 결과판이 한 번 꺼내면 비워진다", () => {
    rememberPlayerExp(receipt(1, 1, 0, 0));
    expect(takePlayerExp()).toBeDefined();
    expect(takePlayerExp()).toBeUndefined();
  });

  it("은 보지 못한 앞 영수증을 버리지 않고 이어 붙인다", () => {
    const merged = mergePlayerExpReceipts(receipt(1, 2, 1, 1), receipt(2, 4, 2, 2));
    expect(merged).toMatchObject({ before: { level: 1 }, after: { level: 4 }, granted: 20, levelsGained: 3, levelUpItems: [{ itemId: PLAYER_LEVEL_UP_REWARD.itemId, quantity: 3 }] });
  });
});

describe("레벨업 보상", () => {
  it("은 스테미나를 회복하는 소비품이다", () => {
    expect(findItem(PLAYER_LEVEL_UP_REWARD.itemId)?.useEffect).toMatchObject({ kind: "restore_stamina" });
  });

  it("은 쌓을 한도를 넘기지 않고 깎아서 준다", async () => {
    const cap = findItem(PLAYER_LEVEL_UP_REWARD.itemId)!.maxStack;
    const state = createDefaultSession(); state.wallet.stamina = 60; state.staminaUpdatedAt = "2026-09-01T00:00:00.000Z";
    state.playerResearch = { level: 1, experience: 49, experienceToNext: 50 };
    state.itemInventory = [...state.itemInventory.filter(({ itemId }) => itemId !== PLAYER_LEVEL_UP_REWARD.itemId), { itemId: PLAYER_LEVEL_UP_REWARD.itemId, quantity: cap }];
    const api = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-09-01T00:00:00.000Z") });
    const admission = await api.enterStage({ stageId: "1-1", requestId: "cap-1" });
    expect(admission.playerExp.levelsGained).toBe(1);
    expect(admission.playerExp.levelUpItems).toEqual([]);
    expect(state.itemInventory.find(({ itemId }) => itemId === PLAYER_LEVEL_UP_REWARD.itemId)?.quantity).toBe(cap);
    expect(state.wallet.stamina).toBe(60 - CONTENT_STAMINA_COSTS.normalStage);
  });
});

describe("레벨 가지나무", () => {
  it("는 시작·열 단위·만렙·테두리 레벨마다 마디를 오름차순으로 세운다", () => {
    const levels = playerLevelMilestones(false).map(({ level }) => level);
    expect(levels[0]).toBe(1);
    expect(levels.at(-1)).toBe(PLAYER_LEVEL_CAP);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
    for (const frame of PROFILE_FRAMES) expect(levels).toContain(frame.unlockLevel);
    for (let level = 10; level < PLAYER_LEVEL_CAP; level += 10) expect(levels).toContain(level);
  });

  it("는 잠금이 꺼져 있으면 이미 열린 콘텐츠를 가지에 달지 않는다", () => {
    expect(playerLevelMilestones(false).flatMap(({ unlocks }) => unlocks).some(({ kind }) => kind === "content")).toBe(false);
    const gated = playerLevelMilestones(true);
    for (const entry of CONTENT_UNLOCKS) {
      expect(gated.find(({ level }) => level === entry.level)?.unlocks).toContainEqual({ kind: "content", contentId: entry.id });
    }
  });

  it("는 마디마다 그 레벨의 스테미나 상한을 스테미나 규칙에서 읽는다", () => {
    for (const milestone of playerLevelMilestones()) expect(milestone.staminaMax).toBe(staminaMaxForResearchLevel(milestone.level));
  });

  it("의 잎은 창 밖으로 나가지 않는다", () => {
    expect(REWARD_TRACK.branch + LEVEL_TREE_LEAF.offset + LEVEL_TREE_LEAF.width / 2).toBeLessThanOrEqual(LEVEL_TREE_VIEW.width / 2);
    // 잎이 줄기의 마디 표식을 덮지 않는다 — 안쪽 끝과 줄기 사이로 가지가 보인다.
    expect(REWARD_TRACK.branch + LEVEL_TREE_LEAF.offset - LEVEL_TREE_LEAF.width / 2).toBeGreaterThan(40);
  });
});
