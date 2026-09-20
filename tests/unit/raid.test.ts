import { describe, expect, it } from "vitest";
import { RAID_BOSS_BALANCE, RAID_CONTRIBUTION_REWARD_STAGES, RAID_DAILY_ATTEMPTS, RAID_MOCK_PARTICIPANTS, RAID_SEASON_BOSS, RAID_SEASON_TOTAL_HP } from "../../src/data/raid";
import { mockRaidContributions, raidBossDef, raidContributionBoard, raidEarnedContributionStageIds, raidNextContributionStage, raidSeasonElapsedDays, raidSeasonKey, raidSeasonProgress } from "../../src/core/raid";
import { getRelic, PLAYABLE_RELICS, RELICS } from "../../src/data/relics";
import { effectiveEnemyLevel } from "../../src/core/types";
import { applyLevelGrowth } from "../../src/core/relicProgression";
import { RAID_ACTIONS, RAID_BOARD, RAID_HP_BAR, raidBoardViewport } from "../../src/ui/raidLayout";
import { RANKING_LIST } from "../../src/ui/expeditionRankingLayout";
import { BASE_HEIGHT } from "../../src/config/gameConfig";
import { findItem } from "../../src/data/items";
import { WALLET_CAPS } from "../../src/data/economy";
import { PRODUCTS } from "../../src/data/shopCatalog";
import { FakeServer } from "../../src/api/FakeServer";
import { createDefaultSession, type Session } from "../../src/state/session";

/**
 * 서버 경계 테스트가 쓸 독립 세션.
 *
 * 공유 `session`을 건드리면 한 편이 바꿔 둔 값이 다음 편으로 샌다 — FakeServer는 생성자로
 * 받은 상태만 쓰므로 편마다 새로 만든다.
 */
function makeRaidSession(): Session {
  return createDefaultSession();
}

describe("레이드 시즌 진행도", () => {
  it("는 남은 체력이 0 아래로 내려가지 않는다", () => {
    const progress = raidSeasonProgress(RAID_SEASON_TOTAL_HP * 2, RAID_SEASON_TOTAL_HP);
    expect(progress.remainingHp).toBe(0);
    expect(progress.remainingRatio).toBe(0);
    expect(progress.defeated).toBe(true);
  });

  it("는 아직 덜 민 시즌을 처치로 보지 않는다", () => {
    const progress = raidSeasonProgress(RAID_SEASON_TOTAL_HP - 1, RAID_SEASON_TOTAL_HP);
    expect(progress.defeated).toBe(false);
    expect(progress.remainingHp).toBe(1);
  });

  it("는 총량이 0이어도 나누기가 깨지지 않는다", () => {
    expect(raidSeasonProgress(10, 0).remainingRatio).toBe(0);
  });
});

describe("기여 목록", () => {
  const entries = [
    { playerId: "b", displayName: "B", damage: 100 },
    { playerId: "a", displayName: "A", damage: 100 },
    { playerId: "c", displayName: "C", damage: 300, isMe: true },
  ];

  it("은 피해 내림차순으로 서고 동점은 안정적인 키로 끊는다", () => {
    const board = raidContributionBoard(entries);
    expect(board.map(({ playerId }) => playerId)).toEqual(["c", "a", "b"]);
    expect(board.map(({ rank }) => rank)).toEqual([1, 2, 3]);
  });

  it("은 아직 아무것도 밀지 않은 줄을 세우지 않는다", () => {
    // 0으로 선 줄은 "참가했다"가 아니라 목록을 채우는 빈 칸으로만 읽힌다.
    expect(raidContributionBoard([{ playerId: "z", displayName: "Z", damage: 0 }])).toEqual([]);
  });

  it("은 내 줄을 그대로 표시한다", () => {
    expect(raidContributionBoard(entries)[0]?.isMe).toBe(true);
  });

  it("은 limit을 넘겨 세우지 않는다", () => {
    expect(raidContributionBoard(entries, 2)).toHaveLength(2);
  });
});

describe("모의 참가자", () => {
  it("는 같은 시즌이면 언제 읽어도 같은 값을 돌려준다", () => {
    // 난수를 쓰면 화면을 다시 열 때마다 1등이 바뀌어 목록이 아무것도 말하지 못한다.
    expect(mockRaidContributions("2026-09-14", 3)).toEqual(mockRaidContributions("2026-09-14", 3));
  });

  it("는 시즌이 다르면 순서가 굳지 않는다", () => {
    const first = raidContributionBoard(mockRaidContributions("2026-09-14", 6)).map(({ playerId }) => playerId);
    const second = raidContributionBoard(mockRaidContributions("2026-10-05", 6)).map(({ playerId }) => playerId);
    expect(first).not.toEqual(second);
  });

  it("는 날이 갈수록 누적이 늘어난다", () => {
    const early = mockRaidContributions("2026-09-14", 0)[0]!.damage;
    const late = mockRaidContributions("2026-09-14", 6)[0]!.damage;
    expect(late).toBeGreaterThan(early);
  });

  it("의 얼굴은 실제로 있는 플레이어블 렐릭이다", () => {
    // 화면이 개체를 지어내지 않도록 얼굴 값은 언제나 정적 정의에서 찾을 수 있어야 한다.
    const playable = new Set(PLAYABLE_RELICS.map(({ id }) => id));
    for (const { favoriteRelicId } of RAID_MOCK_PARTICIPANTS) expect(playable).toContain(favoriteRelicId);
  });

  it("는 한 주 동안 시즌 체력을 눕힐 만큼은 밀되 하루 만에 끝내지 않는다", () => {
    // 너무 낮으면 화요일에 끝나 남은 닷새가 빈 화면이 되고, 너무 높으면 처치 보상이 한 번도
    // 나가지 않는다. 이 둘이 곧 `RAID_SEASON_TOTAL_HP`를 정한 근거다.
    const firstDay = mockRaidContributions("2026-09-14", 0).reduce((sum, { damage }) => sum + damage, 0);
    const fullWeek = mockRaidContributions("2026-09-14", 6).reduce((sum, { damage }) => sum + damage, 0);
    expect(firstDay).toBeLessThan(RAID_SEASON_TOTAL_HP);
    expect(fullWeek).toBeGreaterThan(RAID_SEASON_TOTAL_HP * 0.5);
  });
});

describe("기여 보상 단계", () => {
  it("는 문턱을 넘긴 단계만 돌려준다", () => {
    const [first, second] = RAID_CONTRIBUTION_REWARD_STAGES;
    expect(raidEarnedContributionStageIds(first!.threshold - 1)).toEqual([]);
    expect(raidEarnedContributionStageIds(first!.threshold)).toEqual([first!.id]);
    expect(raidEarnedContributionStageIds(second!.threshold)).toEqual([first!.id, second!.id]);
  });

  it("는 다음 문턱을 알려 주고 다 넘기면 비운다", () => {
    expect(raidNextContributionStage(0)?.id).toBe(RAID_CONTRIBUTION_REWARD_STAGES[0]!.id);
    expect(raidNextContributionStage(Number.MAX_SAFE_INTEGER)).toBeUndefined();
  });

  it("는 문턱이 오름차순이고 보상이 줄어들지 않는다", () => {
    const thresholds = RAID_CONTRIBUTION_REWARD_STAGES.map(({ threshold }) => threshold);
    expect([...thresholds].sort((a, b) => a - b)).toEqual(thresholds);
    const amounts = RAID_CONTRIBUTION_REWARD_STAGES.map(({ reward }) => reward.amount);
    expect([...amounts].sort((a, b) => a - b)).toEqual(amounts);
  });

  it("가 주는 것은 실제로 있는 지갑 재화다", () => {
    // 증표는 재료가 아니라 지갑 재화다 — 상한에 걸려 몇 주치가 버려지면 안 된다.
    for (const { reward } of RAID_CONTRIBUTION_REWARD_STAGES) {
      expect(findItem(reward.currency)?.category).toBe("currency");
      expect(WALLET_CAPS[reward.currency]).toBeGreaterThan(0);
    }
  });
});

describe("시즌 경계", () => {
  it("는 원정과 같은 월요일 00:00 UTC다", () => {
    // 두 콘텐츠가 다른 날 초기화되면 "이번 주"가 화면마다 다른 것을 가리킨다.
    expect(raidSeasonKey(new Date("2026-09-19T12:00:00Z"))).toBe("2026-09-14");
    expect(raidSeasonKey(new Date("2026-09-14T00:00:00Z"))).toBe("2026-09-14");
    expect(raidSeasonKey(new Date("2026-09-13T23:59:59Z"))).toBe("2026-09-07");
  });

  it("의 지난 날수는 시즌 시작에서 잰다", () => {
    expect(raidSeasonElapsedDays(new Date("2026-09-14T00:00:00Z"))).toBe(0);
    expect(raidSeasonElapsedDays(new Date("2026-09-19T12:00:00Z"))).toBe(5);
  });
});

describe("레이드 보스", () => {
  it("는 정적 정의에 실제로 있는 개체다", () => {
    expect(RELICS.find(({ id }) => id === RAID_SEASON_BOSS.relicId)).toBeTruthy();
  });

  it("는 스테이지 정예와 같은 문법으로 자란다", () => {
    // 레이드 전용 배율을 만들지 않는다 — 관문을 조일 손잡이가 둘이 되면 화면에 선 레벨과
    // 실제로 맞는 수치가 갈린다.
    const base = getRelic(RAID_SEASON_BOSS.relicId);
    const level = effectiveEnemyLevel({ level: RAID_SEASON_BOSS.level, ferocityLevel: RAID_SEASON_BOSS.ferocityLevel }, true);
    expect(level).toBe(RAID_SEASON_BOSS.level + RAID_SEASON_BOSS.ferocityLevel * 5);
    expect(raidBossDef(base).stats.hp).toBeGreaterThanOrEqual(applyLevelGrowth(base.stats, level, base.rarity).hp);
  });

  it("는 태생 능력치를 손대지 않는다", () => {
    // 자란 개체는 복사본이라 정적 정의가 그대로 남아야 도감과 스테이지가 같은 수를 읽는다.
    const base = getRelic(RAID_SEASON_BOSS.relicId);
    const before = base.stats.hp;
    raidBossDef(base);
    expect(getRelic(RAID_SEASON_BOSS.relicId).stats.hp).toBe(before);
  });
});

describe("재현 표", () => {
  it("는 마지막 단계가 제한 시간을 전멸로 바꾼다", () => {
    // 보스는 판 안에서 죽지 않으므로(공유 체력은 서버가 갖는다) 판을 끝내는 것은 이 처형뿐이다.
    const last = RAID_BOSS_BALANCE.phases.at(-1)!;
    expect(last.attackPerSecond).toBeGreaterThan(0);
    expect(last.startsAtMs).toBeLessThan(RAID_BOSS_BALANCE.maximumDurationMs);
    expect(RAID_BOSS_BALANCE.phases.slice(0, -1).every(({ attackPerSecond }) => attackPerSecond === 0)).toBe(true);
  });

  it("의 단계는 시간 오름차순으로 선다", () => {
    const starts = RAID_BOSS_BALANCE.phases.map(({ startsAtMs }) => startsAtMs);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it("는 하루 도전 횟수를 한 자리 수로 끊는다", () => {
    expect(RAID_DAILY_ATTEMPTS).toBeGreaterThan(0);
    expect(RAID_DAILY_ATTEMPTS).toBeLessThan(10);
  });
});

describe("전리품 상점", () => {
  const lootProducts = PRODUCTS.filter(({ storefront }) => storefront === "loot");
  /** 탭 하나가 지갑 한 칸을 가리킨다. 그 짝이 이 표다. */
  const TAB_CURRENCY = { raid: "raidSigil", expedition: "salvageRecord" } as const;

  it("의 값은 전부 그 탭의 증표다", () => {
    // 다른 재화로도 살 수 있으면 증표가 무엇을 위한 것인지 말하지 못하고, 탭이 갈린
    // 의미도 사라진다 — 눌러 보기 전에 무엇으로 사는 자리인지 읽혀야 한다.
    expect(lootProducts.length).toBeGreaterThan(0);
    for (const product of lootProducts) {
      expect(product.lootCategory, product.id).toBeTruthy();
      expect(product.acquisition.kind, product.id).toBe("currency");
      if (product.acquisition.kind === "currency") {
        expect(product.acquisition.currency, product.id).toBe(TAB_CURRENCY[product.lootCategory!]);
      }
    }
  });

  it("은 두 탭이 모두 차 있고 같은 물건을 두 증표로 팔지 않는다", () => {
    // 같은 것을 두 증표로 살 수 있으면 싼 쪽만 쓰이고 나머지 탭은 열 이유가 없어진다.
    for (const tab of Object.keys(TAB_CURRENCY) as (keyof typeof TAB_CURRENCY)[]) {
      expect(lootProducts.some((product) => product.lootCategory === tab), tab).toBe(true);
    }
    const grantsOf = (tab: keyof typeof TAB_CURRENCY) => new Set(
      lootProducts.filter((p) => p.lootCategory === tab)
        .flatMap((p) => p.grants.map((g) => (g.kind === "currency" ? g.currency : g.kind === "item" ? g.itemId : g.kind))),
    );
    const raid = grantsOf("raid");
    const shared = [...grantsOf("expedition")].filter((key) => raid.has(key));
    // DNA 조각 하나만 양쪽에 둔다 — 돌파의 공용 재료라 한쪽에만 두면 그 콘텐츠를 돌지
    // 않는 사람의 성장이 통째로 막힌다.
    expect(shared).toEqual(["dnaFragments"]);
  });

  it("이 파는 것과 받는 값이 모두 실제로 있는 것이다", () => {
    for (const product of lootProducts) {
      if (product.acquisition.kind === "currency") expect(findItem(product.acquisition.currency), product.id).toBeTruthy();
      for (const grant of product.grants) if (grant.kind === "item") expect(findItem(grant.itemId)).toBeTruthy();
    }
  });
});

describe("레이드 배치표", () => {
  it("는 기여 목록이 판 안에 들고 하단 조작을 덮지 않는다", () => {
    const viewport = raidBoardViewport();
    expect(viewport.height).toBeGreaterThan(RANKING_LIST.rowHeight * 2);
    expect(RAID_BOARD.viewport.bottom).toBeLessThan(RAID_ACTIONS.y - RAID_ACTIONS.sortie.height / 2);
    expect(RAID_ACTIONS.y + RAID_ACTIONS.sortie.height / 2).toBeLessThan(BASE_HEIGHT);
  });

  it("는 체력 게이지가 목록 제목 위에 선다", () => {
    expect(RAID_HP_BAR.valueY).toBeLessThan(RAID_BOARD.titleY);
    expect(RAID_HP_BAR.labelY).toBeLessThan(RAID_HP_BAR.y);
  });

  it("는 하단 조작이 출격 하나뿐이다", () => {
    // 전리품 상점은 출격판 밖이 맡는다 — 레이드 안에 두면 원정 증표를 쓰러 레이드를 거친다.
    expect(Object.keys(RAID_ACTIONS)).toEqual(["y", "sortie"]);
  });
});

describe("레이드 서버 경계", () => {
  const at = (iso: string) => new Date(iso);

  it("은 시즌 응답에 남은 체력과 내 몫을 함께 싣는다", async () => {
    const server = new FakeServer(makeRaidSession(), { latencyMs: 0, now: () => at("2026-09-16T12:00:00Z") });
    const season = await server.getRaidSeason();
    expect(season.seasonKey).toBe("2026-09-14");
    expect(season.bossRelicId).toBe(RAID_SEASON_BOSS.relicId);
    expect(season.totalHp).toBe(RAID_SEASON_TOTAL_HP);
    expect(season.remainingHp).toBe(season.totalHp - season.dealtDamage);
    expect(season.attemptsLimit).toBe(RAID_DAILY_ATTEMPTS);
  });

  it("은 야성을 얹기 전의 단계를 그대로 싣는다", async () => {
    // 곱한 값을 응답에 담으면 화면이 그 개체가 110레벨만큼 자란 것으로 읽는다.
    const server = new FakeServer(makeRaidSession(), { latencyMs: 0, now: () => at("2026-09-16T12:00:00Z") });
    const season = await server.getRaidSeason();
    expect(season.bossLevel).toBe(RAID_SEASON_BOSS.level);
    expect(season.bossFerocityLevel).toBe(RAID_SEASON_BOSS.ferocityLevel);
  });

  it("은 함께 미는 사람들을 기여 목록에 세운다", async () => {
    const server = new FakeServer(makeRaidSession(), { latencyMs: 0, now: () => at("2026-09-16T12:00:00Z") });
    const season = await server.getRaidSeason();
    expect(season.entries.length).toBeGreaterThan(1);
    expect(season.entries.map(({ damage }) => damage)).toEqual([...season.entries.map(({ damage }) => damage)].sort((a, b) => b - a));
  });

  it("은 주차가 바뀌면 내 몫과 수령 기록을 비운다", async () => {
    const state = makeRaidSession();
    state.raid = { seasonKey: "2026-09-07", myDamage: 500_000, attemptsUsed: 3, attemptsDate: "2026-09-10", claimedStageIds: ["raid-contrib-50k"], defeatRewardClaimed: true };
    const server = new FakeServer(state, { latencyMs: 0, now: () => at("2026-09-16T12:00:00Z") });
    const season = await server.getRaidSeason();
    expect(season.myDamage).toBe(0);
    expect(season.attemptsUsed).toBe(0);
    expect(season.rewardStages.every(({ claimed }) => !claimed)).toBe(true);
    expect(season.defeatRewardClaimed).toBe(false);
  });

  it("은 날이 바뀌면 도전 횟수만 되돌리고 시즌 누적은 지킨다", async () => {
    const state = makeRaidSession();
    state.raid = { seasonKey: "2026-09-14", myDamage: 120_000, attemptsUsed: 3, attemptsDate: "2026-09-15", claimedStageIds: [], defeatRewardClaimed: false };
    const server = new FakeServer(state, { latencyMs: 0, now: () => at("2026-09-16T12:00:00Z") });
    const season = await server.getRaidSeason();
    expect(season.attemptsUsed).toBe(0);
    expect(season.myDamage).toBe(120_000);
  });

  it("은 아직 넘기지 못한 단계의 수령을 거절한다", async () => {
    const server = new FakeServer(makeRaidSession(), { latencyMs: 0, now: () => at("2026-09-16T12:00:00Z") });
    await expect(server.claimRaidReward({ requestId: "r1", stageId: RAID_CONTRIBUTION_REWARD_STAGES[0]!.id }))
      .rejects.toMatchObject({ code: "RAID_REWARD_NOT_EARNED" });
  });

  it("은 없는 단계를 거절한다", async () => {
    const server = new FakeServer(makeRaidSession(), { latencyMs: 0, now: () => at("2026-09-16T12:00:00Z") });
    await expect(server.claimRaidReward({ requestId: "r2", stageId: "raid-contrib-nope" }))
      .rejects.toMatchObject({ code: "RAID_REWARD_NOT_FOUND" });
  });

  it("은 눕히지 못한 보스의 처치 보상을 거절한다", async () => {
    const server = new FakeServer(makeRaidSession(), { latencyMs: 0, now: () => at("2026-09-14T00:00:00Z") });
    await expect(server.claimRaidReward({ requestId: "r3", stageId: "defeat" }))
      .rejects.toMatchObject({ code: "RAID_REWARD_NOT_EARNED" });
  });

  it("은 달성한 단계를 지급하고 같은 요청을 두 번 쌓지 않는다", async () => {
    const state = makeRaidSession();
    const stage = RAID_CONTRIBUTION_REWARD_STAGES[0]!;
    state.raid = { seasonKey: "2026-09-14", myDamage: stage.threshold, attemptsUsed: 0, attemptsDate: "2026-09-16", claimedStageIds: [], defeatRewardClaimed: false };
    const server = new FakeServer(state, { latencyMs: 0, now: () => at("2026-09-16T12:00:00Z") });
    const first = await server.claimRaidReward({ requestId: "r4", stageId: stage.id });
    expect(first.alreadyClaimed).toBe(false);
    expect(state.wallet[stage.reward.currency]).toBe(stage.reward.amount);
    // 같은 요청 ID는 영수증만 돌려주고 재고를 다시 늘리지 않는다.
    await server.claimRaidReward({ requestId: "r4", stageId: stage.id });
    expect(state.wallet[stage.reward.currency]).toBe(stage.reward.amount);
  });

  it("은 도전 횟수를 다 쓴 계정의 제출을 거절한다", async () => {
    const state = makeRaidSession();
    state.raid = { seasonKey: "2026-09-14", myDamage: 0, attemptsUsed: RAID_DAILY_ATTEMPTS, attemptsDate: "2026-09-16", claimedStageIds: [], defeatRewardClaimed: false };
    const server = new FakeServer(state, { latencyMs: 0, now: () => at("2026-09-16T12:00:00Z") });
    await expect(server.submitRaidDamage({ requestId: "s1", actions: [] }))
      .rejects.toMatchObject({ code: "RAID_DAILY_LIMIT" });
  });

  it("은 요청 ID 없는 제출을 거절한다", async () => {
    const server = new FakeServer(makeRaidSession(), { latencyMs: 0, now: () => at("2026-09-16T12:00:00Z") });
    await expect(server.submitRaidDamage({ requestId: "", actions: [] }))
      .rejects.toMatchObject({ code: "RAID_SCORE_REJECTED" });
  });

  it("은 편성이 비면 재현할 수 없으므로 거절한다", async () => {
    // 클라이언트가 보낸 피해 숫자를 받지 않으므로, 재현이 서지 않으면 제출 전체가 거절된다.
    const state = makeRaidSession();
    state.party = [];
    const server = new FakeServer(state, { latencyMs: 0, now: () => at("2026-09-16T12:00:00Z") });
    await expect(server.submitRaidDamage({ requestId: "s2", actions: [] }))
      .rejects.toMatchObject({ code: "RAID_SCORE_REJECTED" });
  });
});
