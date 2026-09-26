import { describe, expect, it } from "vitest";
import { addItemLot, isValidLotStack, purgeExpiredLots, removeItemLot, remainingLabel, remainingParts, type LotStack } from "../../src/core/itemLots";
import { normalizeExpeditionState, rollExpeditionPeriods } from "../../src/core/expeditionPeriods";
import { PLAYER_LEVEL_UP_REWARD } from "../../src/core/playerLevel";
import { findItem } from "../../src/data/items";
import { EXPEDITION_BEST_SCORE_REWARD_STAGES, EXPEDITION_NODE_REWARD_BALANCE, expeditionRankRewards } from "../../src/data/expedition";
import { RAID_DIFFICULTY, RAID_RUN_STAMINA, raidRunStamina } from "../../src/data/raid";
import { FakeServer } from "../../src/api/FakeServer";
import { createDefaultSession } from "../../src/state/session";

const day = (iso: string) => new Date(iso);

describe("기한 있는 아이템 묶음", () => {
  it("에너지 드링크는 999까지 쌓이고 기본 7일 기한을 갖는다", () => {
    for (const id of ["stamina-tonic", "stamina-tonic-large"]) {
      expect(findItem(id)?.maxStack).toBe(999);
      expect(findItem(id)?.expiresInDays).toBe(7);
    }
  });

  it("레벨업은 기본 에너지 드링크를 7일 기한으로 준다", () => {
    expect(PLAYER_LEVEL_UP_REWARD).toEqual({ itemId: "stamina-tonic", quantity: 1, expiresInDays: 7 });
  });

  it("받은 묶음마다 기한을 따로 세고, 쓸 때는 먼저 사라질 묶음부터 쓴다", () => {
    let inv: LotStack[] = [];
    inv = addItemLot(inv, "stamina-tonic", 3, { cap: 999, now: day("2026-09-01T00:00:00Z"), expiryDays: 7 }).inventory;
    inv = addItemLot(inv, "stamina-tonic", 2, { cap: 999, now: day("2026-09-03T00:00:00Z"), expiryDays: 1 }).inventory;
    expect(inv[0].quantity).toBe(5);
    expect(isValidLotStack(inv[0])).toBe(true);
    // 1일짜리(9/4 소멸)가 먼저 사라지므로 먼저 쓰인다.
    const used = removeItemLot(inv, "stamina-tonic", 2)!;
    expect(used[0].lots).toEqual([{ quantity: 3, expiresAt: "2026-09-08T00:00:00.000Z" }]);
    expect(removeItemLot(inv, "stamina-tonic", 99)).toBeUndefined();
  });

  it("기한이 지난 묶음만 걷고, 다 걷힌 칸은 지운다", () => {
    const inv = addItemLot(addItemLot([] as LotStack[], "stamina-tonic", 3, { cap: 999, now: day("2026-09-01T00:00:00Z"), expiryDays: 1 }).inventory,
      "stamina-tonic", 1, { cap: 999, now: day("2026-09-01T00:00:00Z"), expiryDays: 3 }).inventory;
    const mid = purgeExpiredLots(inv, day("2026-09-02T12:00:00Z"));
    expect(mid.expired).toBe(3); expect(mid.inventory[0].quantity).toBe(1);
    expect(purgeExpiredLots(inv, day("2026-09-05T00:00:00Z")).inventory).toEqual([]);
    expect(remainingLabel("2026-09-04T00:00:00Z", day("2026-09-01T00:00:00Z"))).toBe("3D");
    expect(remainingLabel("2026-09-01T05:00:00Z", day("2026-09-01T00:00:00Z"))).toBe("5H");
    // 올려서 센다 — 막 받은 7일짜리는 7D, 하루 미만은 24H부터, 한 시간 미만은 60M부터.
    expect(remainingLabel("2026-09-08T00:00:00Z", day("2026-09-01T00:00:01Z"))).toBe("7D");
    expect(remainingLabel("2026-09-02T00:00:00Z", day("2026-09-01T00:00:01Z"))).toBe("24H");
    expect(remainingLabel("2026-09-01T01:00:00Z", day("2026-09-01T00:00:01Z"))).toBe("60M");
    expect(remainingLabel("2026-09-01T00:00:30Z", day("2026-09-01T00:00:00Z"))).toBe("1M");
    expect(remainingParts("2026-09-03T05:07:09Z", day("2026-09-01T00:00:00Z"))).toEqual({ days: 2, hours: 5, minutes: 7, seconds: 9 });
  });

  it("기한은 1~7일 밖으로 나가지 않고, 쌓을 한도를 넘는 몫은 깎아서 준다", () => {
    const now = day("2026-09-01T00:00:00Z");
    const given = addItemLot([] as LotStack[], "stamina-tonic", 1200, { cap: 999, now, expiryDays: 30 });
    expect(given.added).toBe(999);
    expect(given.inventory[0].lots![0].expiresAt).toBe("2026-09-08T00:00:00.000Z");
  });

  it("서버는 기한이 지난 병을 걷고, 기한 없던 옛 병에는 지금부터 기본 날수를 새긴다", async () => {
    const state = createDefaultSession();
    state.itemInventory = [{ itemId: "stamina-tonic-large", quantity: 2 }];
    let now = day("2026-09-01T00:00:00Z");
    const server = new FakeServer(state, { latencyMs: 0, now: () => now });
    await server.getInventory();
    expect(state.itemInventory[0].lots).toEqual([{ quantity: 2, expiresAt: "2026-09-08T00:00:00.000Z" }]);
    now = day("2026-09-09T00:00:00Z");
    await server.getInventory();
    expect(state.itemInventory.some(({ itemId }) => itemId === "stamina-tonic-large")).toBe(false);
  });
});

describe("원정 주기", () => {
  const base = normalizeExpeditionState({ weekKey: "2026-08-24", dayKey: "2026-08-25", playsToday: 1, bestScore: 5000, bestAchievedAt: "2026-08-25T01:00:00Z" });

  it("날이 바뀌면 오늘 판 수만 0으로 돌아가고 주간 최고는 남는다", () => {
    const next = rollExpeditionPeriods(base, day("2026-08-26T00:00:01Z"));
    expect(next.playsToday).toBe(0); expect(next.bestScore).toBe(5000); expect(next.pendingRankReward).toBeNull();
  });

  it("주가 바뀌면 최고 기록이 순위 보상 대기로 옮겨 가고, 받지 않은 대기는 덮지 않는다", () => {
    const next = rollExpeditionPeriods(base, day("2026-08-31T00:00:01Z"));
    expect(next).toMatchObject({ bestScore: 0, claimedRewardStageIds: [], pendingRankReward: { weekKey: "2026-08-24", score: 5000 } });
    const later = rollExpeditionPeriods({ ...next, bestScore: 900 }, day("2026-09-07T00:00:01Z"));
    expect(later.pendingRankReward?.weekKey).toBe("2026-08-24");
  });

  it("최고 점수 보상 길은 잘게 쪼개져 있고 인양 기록을 뼈대로 여러 재화가 섞인다", () => {
    const stages = EXPEDITION_BEST_SCORE_REWARD_STAGES;
    expect(stages.length).toBeGreaterThanOrEqual(20);
    expect(stages.map(({ threshold }) => threshold)).toEqual([...stages.map(({ threshold }) => threshold)].sort((a, b) => a - b));
    expect(new Set(stages.map(({ id }) => id)).size).toBe(stages.length);
    expect(stages.filter(({ reward }) => reward.currency === "salvageRecord").length).toBeGreaterThanOrEqual(stages.length / 3);
    expect(new Set(stages.map(({ reward }) => reward.currency)).size).toBeGreaterThanOrEqual(5);
  });

  it("주간 순위 보상은 보석과 인양 기록을 함께 주고 순위가 높을수록 많다", () => {
    expect(expeditionRankRewards(1).gems).toBeGreaterThan(expeditionRankRewards(500).gems!);
    expect(expeditionRankRewards(500).salvageRecord).toBeGreaterThan(0);
  });

  it("노드 클리어마다 인양 기록이 쌓인다", () => {
    expect(EXPEDITION_NODE_REWARD_BALANCE.salvageRecord.perNode.min).toBeGreaterThan(0);
  });
});

describe("레이드 스테미나", () => {
  it("모든 레이드가 한 판에 같은 값을 쓴다", () => {
    const values = new Set((Object.keys(RAID_DIFFICULTY) as (keyof typeof RAID_DIFFICULTY)[]).map((d) => raidRunStamina(d)));
    expect([...values]).toEqual([RAID_RUN_STAMINA]);
  });
});
