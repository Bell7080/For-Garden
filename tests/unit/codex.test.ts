import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import {
  CODEX_GEM_BUDGET, CODEX_MILESTONES, CODEX_RELICS, claimCodexMilestones, codexMaxScore, codexReachedMilestones, codexRecordedIds, codexScore, codexSide, mergeEncountered,
} from "../../src/core/codex";
import { ACHIEVEMENT_GEM_BUDGET } from "../../src/data/achievements";
import { getStage, getStageEnemies } from "../../src/data/stages";
import { createDefaultSession } from "../../src/state/session";
import { CODEX_POPUP_LAYOUT, codexColumnX, codexGridPlan, groupCodexEntries } from "../../src/ui/codexPopupLayout";
import { getRelic } from "../../src/data/relics";
import { SQUADS } from "../../src/data/factions";

const NOW = Date.UTC(2026, 10, 15, 3);
const server = (state = createDefaultSession()) => new FakeServer(state, { latencyMs: 0, now: () => new Date(NOW), random: () => 0.5 });

describe("도감 — 기록 규칙", () => {
  it("귀속 소환수는 칸이 없고, 적 전용 개체만 적 쪽에 선다", () => {
    expect(CODEX_RELICS.some((relic) => relic.summonOnly === true)).toBe(false);
    for (const relic of CODEX_RELICS) expect(codexSide(relic)).toBe(relic.enemyOnly === true ? "enemy" : "ally");
  });

  it("마디 젬 합은 예산(업적의 절반) 안이고 마디는 오르막이며, 한 마디가 젬 200을 넘지 않는다", () => {
    const total = CODEX_MILESTONES.reduce((sum, { reward }) => sum + (reward.currency === "gems" ? reward.amount : 0), 0);
    expect(total).toBeLessThanOrEqual(CODEX_GEM_BUDGET);
    expect(CODEX_GEM_BUDGET).toBeLessThanOrEqual(ACHIEVEMENT_GEM_BUDGET / 2);
    CODEX_MILESTONES.forEach(({ score, reward }, index) => {
      expect(reward.amount).toBeLessThanOrEqual(200);
      if (index > 0) expect(score).toBeGreaterThan(CODEX_MILESTONES[index - 1].score);
    });
    // 지금 개체를 모두 만나면 마지막 마디까지 닿는다 — 닿을 수 없는 마디를 걸어 두지 않는다.
    expect(codexReachedMilestones(codexMaxScore())).toBe(CODEX_MILESTONES.length);
  });

  it("보유한 렐릭은 처음부터 기록되어 있다(도감을 늦게 들여도 이제껏 만난 만큼 선다)", () => {
    const state = createDefaultSession();
    const recorded = codexRecordedIds(state);
    for (const id of state.owned) expect(recorded.has(id)).toBe(true);
  });

  it("닿은 마디를 차례대로 모두 걷고, 다시 걷을 것은 없다", () => {
    const first = claimCodexMilestones(160, 0);
    expect(first.indices).toEqual([0, 1, 2]);
    expect(first.rewards).toEqual([{ currency: "gems", amount: 150 }]);
    expect(claimCodexMilestones(160, first.claimed).indices).toEqual([]);
  });

  it("굳힐 만남은 칸 있는 ID만 도감 순서로 남긴다", () => {
    const ids = CODEX_RELICS.map(({ id }) => id);
    expect(mergeEncountered([ids[3], "nope"], [ids[1], "kuro"])).toEqual([ids[1], ids[3]]);
  });
});

describe("도감 — 서버 경계", () => {
  it("진 판에서 본 적도 기록되고 점수가 오른다", async () => {
    const api = server();
    const before = await api.getCodex();
    const stage = getStage("1-10");
    if (stage.kind !== "battle") throw new Error("1-10은 전투 관문이다");
    const ids = getStageEnemies(stage).map(({ id }) => id);
    await api.completeStage("1-10", false);
    const after = await api.getCodex();
    for (const id of ids) expect(after.entries.find((entry) => entry.id === id)?.recorded).toBe(true);
    expect(after.score).toBeGreaterThanOrEqual(before.score);
  });

  it("닿은 마디를 받으면 젬이 들어오고 같은 마디를 두 번 받지 못한다", async () => {
    const state = createDefaultSession();
    state.achievements = { ...(state.achievements ?? {}), encountered: CODEX_RELICS.slice(0, 20).map(({ id }) => id) } as typeof state.achievements;
    const api = server(state);
    const codex = await api.getCodex();
    expect(codex.score).toBe(codexScore(codexRecordedIds(state)));
    expect(codex.claimableCount).toBeGreaterThan(0);
    const gems = state.wallet.gems;
    const result = await api.claimCodexRewards();
    const granted = result.granted.reduce((sum, { amount }) => sum + amount, 0);
    expect(result.wallet.gems).toBe(gems + granted);
    expect((await api.getCodex()).claimableCount).toBe(0);
    await expect(api.claimCodexRewards()).rejects.toMatchObject({ code: "NOTHING_TO_CLAIM" });
  });
});

describe("도감 창 배치", () => {
  it("한 줄 네 칸의 스탠딩 전시 칸이 격자 폭 안에 든다", () => {
    const { grid } = CODEX_POPUP_LAYOUT;
    expect(codexColumnX(grid.columns - 1) + grid.cardWidth / 2).toBeLessThanOrEqual(grid.width / 2);
    expect(codexColumnX(0) - grid.cardWidth / 2).toBeGreaterThanOrEqual(-grid.width / 2);
    // 세로로 긴 칸이다 — 정수리부터 허벅지께까지 서는 스탠딩 비율.
    expect(grid.cardHeight / grid.cardWidth).toBeGreaterThan(1.6);
  });

  it("등급별은 SSR → SR → R, 소속별은 스쿼드 표 순서로 구역을 가르고 칸을 하나도 빠뜨리지 않는다", () => {
    const entries = CODEX_RELICS.map(({ id }) => { const def = getRelic(id); return { id, rarity: def.rarity, squad: def.squad }; });
    const squads = Object.keys(SQUADS);
    const byRarity = groupCodexEntries(entries, "rarity", squads);
    expect(byRarity.map(({ key }) => key)).toEqual(["SSR", "SR", "R"].filter((key) => entries.some(({ rarity }) => rarity === key)));
    const bySquad = groupCodexEntries(entries, "squad", squads);
    const keys = bySquad.map(({ key }) => squads.indexOf(key!));
    expect([...keys].sort((a, b) => a - b)).toEqual(keys);
    for (const groups of [byRarity, bySquad, groupCodexEntries(entries, "number", squads)]) {
      expect(groups.flatMap(({ entries: inGroup }) => inGroup.map(({ id }) => id)).sort()).toEqual(entries.map(({ id }) => id).sort());
    }
  });

  it("구역 제목과 카드는 겹치지 않고 아래로만 쌓인다", () => {
    const { grid } = CODEX_POPUP_LAYOUT;
    const plan = codexGridPlan([{ key: "SSR", count: 5 }, { key: "SR", count: 3 }]);
    expect(plan.cards).toHaveLength(8);
    const secondHeader = plan.headers[1].y;
    // 첫 구역의 둘째 줄 카드 아래변이 둘째 제목 위에서 끝난다.
    expect(plan.cards[4].y + grid.cardHeight / 2).toBeLessThan(secondHeader - grid.headerHeight / 2);
    expect(plan.cards[5].y - grid.cardHeight / 2).toBeGreaterThan(secondHeader + grid.headerHeight / 2);
    expect(plan.height).toBeGreaterThan(plan.cards[7].y + grid.cardHeight / 2);
  });
});
