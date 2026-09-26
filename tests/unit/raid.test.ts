import { describe, expect, it } from "vitest";
import { RAID_ATTEMPTS_PER_RAID, RAID_BOSS_BALANCE, RAID_BOSS_POOL, RAID_DIFFICULTY, RAID_MOCK_PARTICIPANTS, RAID_SEASON_BOSS, RAID_SEASON_TOTAL_HP, RAID_SELECT_TICKET_ITEM, RAID_SUMMON_DIFFICULTIES, RAID_TICKET_ITEM, isRaidDifficulty, raidRunStamina } from "../../src/data/raid";
import { mockFriendRaids, mockRaidContributions, mockRaidWorldDamage, mockSummonRaidDamage, raidBossDef, raidBossGrowth, raidBossPercentHpBasis, raidContributionBoard, raidKillProgress, raidKillTicks, raidDayProgress, raidResetsAt, raidRunGold, raidSeasonKey, raidSeasonProgress, raidSettlement, raidWorldBossId, rollRaidSummon } from "../../src/core/raid";
import { getRelic, PLAYABLE_RELICS, RELICS } from "../../src/data/relics";
import { ENCOUNTER_ROLE, applyEncounterScaling } from "../../src/core/levelDesign";

import { RAID_ACTIONS, RAID_BOARD, RAID_HP_BAR, raidBoardViewport, raidSortieBackGap } from "../../src/ui/raidLayout";
import { RANKING_LIST } from "../../src/ui/expeditionRankingLayout";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import { findItem } from "../../src/data/items";
import { PRODUCTS } from "../../src/data/shopCatalog";
import { FakeServer } from "../../src/api/FakeServer";
import { dungeonRunStamina } from "../../src/core/dungeonShortcut";
import { createDefaultSession, type RaidInstanceState, type Session } from "../../src/state/session";

/**
 * 서버 경계 테스트가 쓸 독립 세션.
 *
 * 공유 `session`을 건드리면 한 편이 바꿔 둔 값이 다음 편으로 샌다 — FakeServer는 생성자로
 * 받은 상태만 쓰므로 편마다 새로 만든다.
 */
function makeRaidSession(): Session {
  return createDefaultSession();
}

describe("월드 폭주 진행도", () => {
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
    expect(mockRaidContributions("2026-09-14", 0.4)).toEqual(mockRaidContributions("2026-09-14", 0.4));
  });

  it("는 시즌이 다르면 순서가 굳지 않는다", () => {
    const first = raidContributionBoard(mockRaidContributions("2026-09-14", 1)).map(({ playerId }) => playerId);
    const second = raidContributionBoard(mockRaidContributions("2026-10-05", 1)).map(({ playerId }) => playerId);
    expect(first).not.toEqual(second);
  });

  it("는 하루가 갈수록 오늘 몫이 늘어난다", () => {
    const early = mockRaidContributions("2026-09-14", 0)[0]!.damage;
    const late = mockRaidContributions("2026-09-14", 0.9)[0]!.damage;
    expect(late).toBeGreaterThan(early);
  });

  it("의 얼굴은 실제로 있는 플레이어블 렐릭이다", () => {
    // 화면이 개체를 지어내지 않도록 얼굴 값은 언제나 정적 정의에서 찾을 수 있어야 한다.
    const playable = new Set(PLAYABLE_RELICS.map(({ id }) => id));
    for (const { favoriteRelicId } of RAID_MOCK_PARTICIPANTS) expect(playable).toContain(favoriteRelicId);
  });

  it("의 오늘 몫은 두 판 실측과 같은 자릿수다", () => {
    // 한 판 실측이 0.8만~2.6만이라 하루 두 판의 합이 수십만이면 목록이 거짓말을 한다.
    for (const { damage } of mockRaidContributions("2026-09-14", 1)) {
      expect(damage).toBeGreaterThan(10_000);
      expect(damage).toBeLessThan(60_000);
    }
  });
});

describe("월드 폭주의 서버 전체 몫", () => {
  it("은 하루 동안 자라고 날마다 도달선이 다르다", () => {
    expect(mockRaidWorldDamage("2026-09-14", 0)).toBe(0);
    expect(mockRaidWorldDamage("2026-09-14", 0.8)).toBeGreaterThan(mockRaidWorldDamage("2026-09-14", 0.3));
    const ends = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18"].map((day) => mockRaidWorldDamage(day, 1));
    expect(new Set(ends).size).toBeGreaterThan(1);
  });

  it("은 잡지 못하는 날이 있되 절반은 넘긴다 — 깎은 만큼 보상이 얹힌다", () => {
    // 도달선은 총량의 55~110%라 대부분의 날 월드 진행 보상의 절반 이상이 열린다.
    const days = Array.from({ length: 30 }, (_, index) => `2026-10-${String(index + 1).padStart(2, "0")}`);
    const ratios = days.map((day) => mockRaidWorldDamage(day, 1) / RAID_SEASON_TOTAL_HP);
    expect(Math.min(...ratios)).toBeGreaterThanOrEqual(0.5);
    expect(ratios.some((ratio) => ratio < 1)).toBe(true);
  });

});

describe("정산", () => {
  it("은 참여하지 않은 판에 아무것도 주지 않는다", () => {
    // 월드 폭주도 예외가 아니다 — 보상은 함께 민 사람의 몫이다.
    expect(raidSettlement("rampage", 0, 1, true)).toBeUndefined();
    expect(raidSettlement("easy", 0, 0.5, false)).toBeUndefined();
  });

  it("은 내가 많이 깎을수록, 판이 많이 깎일수록 커진다", () => {
    for (const difficulty of Object.keys(RAID_DIFFICULTY) as (keyof typeof RAID_DIFFICULTY)[]) {
      const target = RAID_DIFFICULTY[difficulty].settlement.mineTarget;
      const low = raidSettlement(difficulty, target * 0.2, 0.5, false)!.raidSigil;
      const mine = raidSettlement(difficulty, target, 0.5, false)!.raidSigil;
      const total = raidSettlement(difficulty, target, 0.9, false)!.raidSigil;
      expect(mine, difficulty).toBeGreaterThan(low);
      expect(total, difficulty).toBeGreaterThan(mine);
      // 토벌된 판에만 붙는 몫이 있다.
      expect(raidSettlement(difficulty, target, 1, true)!.raidSigil).toBeGreaterThan(raidSettlement(difficulty, target, 1, false)!.raidSigil);
    }
  });

  it("의 내 몫은 목표에서 멈춘다", () => {
    // 한 사람이 끝없이 몫을 늘리면 함께 미는 판이 아니라 혼자 미는 판이 된다.
    const target = RAID_DIFFICULTY.normal.settlement.mineTarget;
    expect(raidSettlement("normal", target * 5, 0.5, false)).toEqual(raidSettlement("normal", target, 0.5, false));
  });

  it("은 조금이라도 쳤으면 한 개는 준다", () => {
    expect(raidSettlement("easy", 1, 0, false)!.raidSigil).toBeGreaterThanOrEqual(1);
  });

  it("은 어려운 판일수록 크다", () => {
    const max = (difficulty: keyof typeof RAID_DIFFICULTY) => {
      const spec = RAID_DIFFICULTY[difficulty].settlement;
      return spec.mine + spec.total + spec.kill;
    };
    expect(max("normal")).toBeGreaterThan(max("easy"));
    expect(max("hard")).toBeGreaterThan(max("normal"));
    expect(max("rampage")).toBeGreaterThan(max("hard"));
  });

  it("과 따로, 한 판의 골드는 그 판의 피해에 비례한다", () => {
    expect(raidRunGold(0, 0.2)).toBe(0);
    expect(raidRunGold(20_000, 0.2)).toBe(4_000);
    expect(raidRunGold(40_000, 0.2)).toBe(2 * raidRunGold(20_000, 0.2));
  });
});

describe("난이도", () => {
  it("는 쉬움·보통·어려움이 20·30·40레벨이고 폭주가 만렙이다", () => {
    expect(RAID_SUMMON_DIFFICULTIES.map((difficulty) => RAID_DIFFICULTY[difficulty].level)).toEqual([20, 30, 40]);
    expect(RAID_DIFFICULTY.rampage.level).toBe(60);
    // 폭주는 시스템만 연다.
    expect(RAID_SUMMON_DIFFICULTIES as readonly string[]).not.toContain("rampage");
  });

  it("의 돌파는 그 레벨에 닿을 수 있는 칸이다", () => {
    expect(raidBossGrowth("easy")).toEqual({ level: 20, breakthrough: 0 });
    expect(raidBossGrowth("rampage")).toEqual({ level: 60, breakthrough: 4 });
  });

  it("는 모르는 값을 받아들이지 않는다", () => {
    expect(isRaidDifficulty("hard")).toBe(true);
    expect(isRaidDifficulty("toString")).toBe(false);
    expect(isRaidDifficulty(undefined)).toBe(false);
  });

  it("의 체력은 어려울수록 크다", () => {
    const hp = RAID_SUMMON_DIFFICULTIES.map((difficulty) => RAID_DIFFICULTY[difficulty].totalHp);
    expect([...hp].sort((a, b) => a - b)).toEqual(hp);
    expect(RAID_DIFFICULTY.rampage.totalHp).toBe(RAID_SEASON_TOTAL_HP);
  });

  it("의 토벌권은 보스와 난이도를 모두 굴려 풀 전체에 닿는다", () => {
    expect(rollRaidSummon(0, 0)).toEqual({ bossRelicId: RAID_BOSS_POOL[0], difficulty: RAID_SUMMON_DIFFICULTIES[0] });
    expect(rollRaidSummon(0.9999, 0.9999)).toEqual({ bossRelicId: RAID_BOSS_POOL.at(-1), difficulty: RAID_SUMMON_DIFFICULTIES.at(-1) });
  });

  it("의 월드 폭주는 풀을 하루씩 차례로 돈다", () => {
    const days = ["2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19"].map(raidWorldBossId);
    expect(new Set(days)).toEqual(new Set(RAID_BOSS_POOL));
    expect(days[0]).not.toBe(days[1]);
    expect(days[0]).toBe(days[RAID_BOSS_POOL.length]);
  });

  it("의 보스 풀은 실제로 있는 개체다", () => {
    for (const relicId of RAID_BOSS_POOL) expect(RELICS.find(({ id }) => id === relicId), relicId).toBeTruthy();
  });

  it("의 토벌권 둘은 가방의 재료다", () => {
    expect(findItem(RAID_TICKET_ITEM)?.category).toBe("material");
    expect(findItem(RAID_SELECT_TICKET_ITEM)?.category).toBe("material");
  });
});

describe("친구 레이드", () => {
  it("는 같은 날이면 늘 같은 판이다", () => {
    expect(mockFriendRaids("2026-09-16")).toEqual(mockFriendRaids("2026-09-16"));
    expect(mockFriendRaids("2026-09-16").length).toBeGreaterThan(0);
  });

  it("는 소환할 수 있는 난이도로만 선다", () => {
    for (const raid of mockFriendRaids("2026-09-16")) expect(RAID_SUMMON_DIFFICULTIES as readonly string[]).toContain(raid.difficulty);
  });

  it("의 다른 참가자 몫은 시간이 갈수록 늘고 총량의 1.3배를 넘지 않는다", () => {
    const total = RAID_DIFFICULTY.normal.totalHp;
    expect(mockSummonRaidDamage("r", 0, total)).toBe(0);
    expect(mockSummonRaidDamage("r", 0.8, total)).toBeGreaterThan(mockSummonRaidDamage("r", 0.3, total));
    expect(mockSummonRaidDamage("r", 1, total)).toBeLessThanOrEqual(total * 1.3);
  });
});

describe("월드 폭주의 날짜 경계", () => {
  it("는 UTC 날짜이고 다음 날 00:00에 초기화된다", () => {
    // 하루 한 마리라 도전 횟수와 같은 경계를 쓴다 — 다르면 "오늘의 보스"와 "오늘의 도전"이 갈린다.
    expect(raidSeasonKey(new Date("2026-09-19T12:00:00Z"))).toBe("2026-09-19");
    expect(raidSeasonKey(new Date("2026-09-19T23:59:59Z"))).toBe("2026-09-19");
    expect(raidResetsAt(new Date("2026-09-19T12:00:00Z"))).toBe("2026-09-20T00:00:00.000Z");
  });

  it("의 하루 진행은 0~1이다", () => {
    expect(raidDayProgress(new Date("2026-09-19T00:00:00Z"))).toBe(0);
    expect(raidDayProgress(new Date("2026-09-19T12:00:00Z"))).toBeCloseTo(0.5);
  });

  it("의 보스는 만렙이고 돌파 네 칸이 모두 열린다", () => {
    expect(RAID_SEASON_BOSS.level).toBe(60);
    expect(RAID_SEASON_BOSS.breakthrough).toBe(4);
    expect(RAID_ATTEMPTS_PER_RAID).toBe(2);
  });
});

describe("레이드 보스", () => {
  it("는 정적 정의에 실제로 있는 개체다", () => {
    expect(RELICS.find(({ id }) => id === RAID_SEASON_BOSS.relicId)).toBeTruthy();
  });

  it("는 체력을 뺀 넷을 공용 유형 표로 기른다", () => {
    // 레이드 전용 배율을 만들지 않는다 — 관문을 조일 손잡이가 둘이 되면 화면에 선 레벨과
    // 실제로 맞는 수치가 갈린다.
    const base = getRelic(RAID_SEASON_BOSS.relicId);
    const scaled = applyEncounterScaling(base.stats, RAID_SEASON_BOSS.level, "endless");
    for (const key of ["def", "res", "atk", "ap"] as const) expect(raidBossDef(base).stats[key]).toBe(scaled[key]);
  });

  it("의 최대 체력은 그 난이도의 몸이고, 공유 게이지는 그 몸을 처치 수만큼 쌓은 것이다", () => {
    /*
     * 머리 위 체력 바 한 줄을 비우면 공유 게이지가 정확히 한 칸(`1 / kills`) 줄어야 두 줄이 같은
     * 단위로 읽힌다. 모든 난이도가 같은 몸이던 때는 보통과 어려움의 체력 바가 똑같이 섰다.
     */
    const base = getRelic(RAID_SEASON_BOSS.relicId);
    const order = ["easy", "normal", "hard", "rampage"] as const;
    for (const difficulty of order) {
      const spec = RAID_DIFFICULTY[difficulty];
      expect(raidBossDef(base, difficulty).stats.hp).toBe(spec.bodyHp);
      expect(spec.totalHp).toBe(spec.bodyHp * spec.kills);
    }
    // 난이도가 오를수록 몸도, 잡아야 하는 횟수도 줄지 않는다 — 몸은 적어도 두 배씩 단단해진다.
    for (let index = 1; index < order.length; index++) {
      const lower = RAID_DIFFICULTY[order[index - 1]]; const upper = RAID_DIFFICULTY[order[index]];
      expect(upper.bodyHp).toBeGreaterThanOrEqual(lower.bodyHp * 2);
      expect(upper.kills).toBeGreaterThanOrEqual(lower.kills);
    }
    expect(RAID_SEASON_TOTAL_HP).toBe(RAID_DIFFICULTY.rampage.totalHp);
  });

  it("의 처치 수는 몸 한 줄 단위로 버림해 센다", () => {
    const { bodyHp, kills } = RAID_DIFFICULTY.easy;
    expect(raidKillProgress(0, "easy")).toEqual({ done: 0, kills, bodyHp });
    expect(raidKillProgress(bodyHp - 1, "easy").done).toBe(0);
    expect(raidKillProgress(bodyHp * 2 + 5, "easy").done).toBe(2);
    expect(raidKillProgress(bodyHp * (kills + 3), "easy").done).toBe(kills);
    // 한 칸이 한 번 처치다. 칸이 너무 촘촘하면(월드 폭주) 기본 칸으로 되돌아간다.
    expect(raidKillTicks(6, 7)).toBe(5);
    expect(raidKillTicks(40, 7)).toBe(7);
  });

  it("의 비율 피해는 시즌 단위가 아니라 성장 체력에서 잰다", () => {
    /*
     * 판 안의 몸은 시즌 게이지의 단위라 성장 체력보다 훨씬 크다. 그 값으로 출혈을 재던 때는
     * 출혈 한 번이 판 전체의 타격보다 컸다 — 출혈이 없는 편성은 줄을 거의 움직이지 못했다.
     */
    const base = getRelic(RAID_SEASON_BOSS.relicId);
    const basis = raidBossPercentHpBasis(base);
    const level = RAID_SEASON_BOSS.level;
    expect(basis).toBe(Math.round(applyEncounterScaling(base.stats, level, "endless").hp));
    expect(basis).toBeLessThan(raidBossDef(base).stats.hp);
  });

  it("는 일반 적보다 훨씬 크고, 걸음은 제 태생치가 갖는다", () => {
    /*
     * 셋이 하나를 미는 판이라 보스가 로스터의 걸음으로 움직이면 1대3으로 읽히지 않는다.
     * 다만 그 느린 걸음은 **그 개체의 정체성**이라 제 정의가 갖는다 — 유형이 바꾸는 것은
     * 몸집과 체력·공격의 몫뿐이고 공속·이속은 건드리지 않는다.
     */
    const base = getRelic(RAID_SEASON_BOSS.relicId);
    expect(ENCOUNTER_ROLE.endless.bodyScale).toBeGreaterThan(ENCOUNTER_ROLE.elite.bodyScale);
    expect(base.stats.moveSpeed).toBeLessThan(Math.min(...PLAYABLE_RELICS.map(({ stats }) => stats.moveSpeed)));
    const boss = raidBossDef(base).stats;
    expect(boss.moveSpeed).toBe(base.stats.moveSpeed);
    expect(boss.attackSpeed).toBe(base.stats.attackSpeed);
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

  it("는 판마다 도전 횟수를 한 자리 수로 끊는다", () => {
    expect(RAID_ATTEMPTS_PER_RAID).toBeGreaterThan(0);
    expect(RAID_ATTEMPTS_PER_RAID).toBeLessThan(10);
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

  it("는 하단 줄에 출격 하나만 세운다", () => {
    /*
     * 상점 입구를 여기에도 달아 두었던 때는 같은 전리품 가게로 들어가는 문이 둘이었다 —
     * 로비 출격판 밖 줄이 이미 그 문을 갖고 있어, 증표를 쓰러 가는 길이 화면마다 갈렸다.
     * 그 문이 하나로 돌아오면서 출격이 화면 가운데를 그대로 쓴다.
     */
    expect(Object.keys(RAID_ACTIONS)).toEqual(["y", "sortie"]);
    expect(RAID_ACTIONS.sortie.centerX).toBe(BASE_WIDTH / 2);
    // 목록이 흐르는 창을 덮지 않고, 우하단 공용 뒤로가기 위도 지나지 않는다.
    expect(RAID_BOARD.viewport.bottom).toBeLessThan(RAID_ACTIONS.y - RAID_ACTIONS.sortie.height / 2);
    expect(raidSortieBackGap()).toBeGreaterThan(0);
  });
});

describe("레이드 서버 경계", () => {
  const at = (iso: string) => new Date(iso);
  const serverAt = (state: Session, iso: string) => new FakeServer(state, { latencyMs: 0, now: () => at(iso) });
  const instance = (patch: Partial<RaidInstanceState> & { id: string; openedAt: string; endsAt: string }): RaidInstanceState => ({
    kind: "world", bossRelicId: RAID_SEASON_BOSS.relicId, difficulty: "rampage", summonedByMe: false, myDamage: 0, attemptsUsed: 0, settled: false, ...patch,
  });
  const yesterdayWorld = (myDamage: number) => instance({ id: "world-2026-09-15", openedAt: "2026-09-15T00:00:00.000Z", endsAt: "2026-09-16T00:00:00.000Z", myDamage, attemptsUsed: 2 });

  it("은 오늘의 월드 폭주를 맨 위에, 친구 레이드를 그 아래에 싣는다", async () => {
    const { raids, tickets } = await serverAt(makeRaidSession(), "2026-09-16T12:00:00Z").getRaids();
    const world = raids[0]!;
    expect(world.kind).toBe("world");
    expect(world.id).toBe("world-2026-09-16");
    expect(world.bossLevel).toBe(60);
    expect(world.totalHp).toBe(RAID_SEASON_TOTAL_HP);
    expect(world.remainingHp).toBe(world.totalHp - world.dealtDamage);
    expect(raids.some(({ kind, summonerName }) => kind === "summon" && summonerName)).toBe(true);
    expect(raids.every(({ attemptsLimit }) => attemptsLimit === RAID_ATTEMPTS_PER_RAID)).toBe(true);
    expect(tickets.normal).toBeGreaterThan(0);
  });

  it("은 참여하지 않은 끝난 판을 세우지 않고 정산도 비운다", async () => {
    // 완료 탭은 정산할 곳이다 — 받을 것이 없는 판이 끼면 정작 받을 판이 묻힌다.
    const { raids } = await serverAt(makeRaidSession(), "2026-09-16T12:00:00Z").getRaids();
    expect(raids.filter(({ status }) => status === "completed")).toEqual([]);
    expect(raids.every(({ settlement }) => settlement.length === 0)).toBe(true);
  });

  it("은 함께 미는 사람들을 기여 목록에 세운다", async () => {
    const { raids } = await serverAt(makeRaidSession(), "2026-09-16T12:00:00Z").getRaids();
    const damages = raids[0]!.entries.map(({ damage }) => damage);
    expect(damages.length).toBeGreaterThan(1);
    expect(damages).toEqual([...damages].sort((a, b) => b - a));
  });

  it("은 토벌권 한 장으로 판을 열고 그 장을 뺀다", async () => {
    const server = serverAt(makeRaidSession(), "2026-09-16T12:00:00Z");
    const before = (await server.getRaids()).tickets.normal;
    const result = await server.summonRaid({ requestId: "sum1" });
    expect(result.raid.summonedByMe).toBe(true);
    // 토벌권은 보스와 난이도를 서버가 함께 굴린다 — 무엇이 나왔든 풀과 소환 난이도 안이다.
    expect(RAID_BOSS_POOL as readonly string[]).toContain(result.raid.bossRelicId);
    expect(RAID_SUMMON_DIFFICULTIES as readonly string[]).toContain(result.raid.difficulty);
    expect(result.raid.bossLevel).toBe(RAID_DIFFICULTY[result.raid.difficulty].level);
    expect(result.raid.status).toBe("active");
    expect(result.tickets.normal).toBe(before - 1);
    // 같은 요청은 두 번 열지 않는다.
    await server.summonRaid({ requestId: "sum1" });
    const after = await server.getRaids();
    expect(after.tickets.normal).toBe(before - 1);
    expect(after.raids.some(({ id }) => id === result.raid.id)).toBe(true);
  });

  it("은 선택 토벌권으로 고른 보스를 연다", async () => {
    const server = serverAt(makeRaidSession(), "2026-09-16T12:00:00Z");
    const result = await server.summonRaid({ requestId: "sel1", difficulty: "hard", bossRelicId: RAID_BOSS_POOL[0] });
    expect(result.raid.bossRelicId).toBe(RAID_BOSS_POOL[0]);
    expect(result.tickets.select).toBe(0);
    await expect(server.summonRaid({ requestId: "sel2", difficulty: "hard", bossRelicId: RAID_BOSS_POOL[0] }))
      .rejects.toMatchObject({ code: "RAID_TICKET_SHORTAGE" });
  });

  it("은 폭주와 풀 밖의 보스를 소환하지 않는다", async () => {
    const server = serverAt(makeRaidSession(), "2026-09-16T12:00:00Z");
    await expect(server.summonRaid({ requestId: "x1", bossRelicId: RAID_BOSS_POOL[0], difficulty: "rampage" })).rejects.toMatchObject({ code: "RAID_SUMMON_INVALID" });
    // 토벌권은 아무것도 고르지 않고 선택 토벌권은 둘 다 고른다 — 한쪽만 온 요청은 거절한다.
    await expect(server.summonRaid({ requestId: "x3", difficulty: "easy" })).rejects.toMatchObject({ code: "RAID_SUMMON_INVALID" });
    await expect(server.summonRaid({ requestId: "x4", bossRelicId: RAID_BOSS_POOL[0] })).rejects.toMatchObject({ code: "RAID_SUMMON_INVALID" });
    await expect(server.summonRaid({ requestId: "x2", difficulty: "easy", bossRelicId: "anky" })).rejects.toMatchObject({ code: "RAID_SUMMON_INVALID" });
  });

  it("은 끝나지 않은 판의 정산을 거절한다", async () => {
    const state = makeRaidSession();
    state.raid = { instances: [instance({ id: "world-2026-09-16", openedAt: "2026-09-16T00:00:00.000Z", endsAt: "2026-09-17T00:00:00.000Z", myDamage: 30_000, attemptsUsed: 2 })] };
    await expect(serverAt(state, "2026-09-16T01:00:00Z").settleRaid({ requestId: "st0", raidId: "world-2026-09-16" }))
      .rejects.toMatchObject({ code: "RAID_NOT_ENDED" });
  });

  it("은 끝난 참여 판을 완료로 세우고 정산을 한 번만 지급한다", async () => {
    const state = makeRaidSession();
    state.raid = { instances: [yesterdayWorld(30_000)] };
    const server = serverAt(state, "2026-09-16T12:00:00Z");
    const done = (await server.getRaids()).raids.find(({ id }) => id === "world-2026-09-15")!;
    expect(done.status).toBe("completed");
    const amount = done.settlement[0]!.amount;
    expect(amount).toBeGreaterThan(0);
    const before = state.wallet.raidSigil;
    const first = await server.settleRaid({ requestId: "st1", raidId: done.id });
    expect(first.alreadySettled).toBe(false);
    expect(first.raid.settled).toBe(true);
    expect(state.wallet.raidSigil).toBe(before + amount);
    // 같은 요청은 영수증만, 다른 요청은 지급 없이 그렇다고만 말한다.
    await server.settleRaid({ requestId: "st1", raidId: done.id });
    const again = await server.settleRaid({ requestId: "st2", raidId: done.id });
    expect(again.alreadySettled).toBe(true);
    expect(state.wallet.raidSigil).toBe(before + amount);
  });

  it("은 참여하지 않은 판의 정산을 거절한다", async () => {
    const state = makeRaidSession();
    state.raid = { instances: [yesterdayWorld(0)] };
    await expect(serverAt(state, "2026-09-16T12:00:00Z").settleRaid({ requestId: "st3", raidId: "world-2026-09-15" }))
      .rejects.toMatchObject({ code: "RAID_REWARD_NOT_EARNED" });
  });

  it("은 정산하지 않은 참여 판을 오래 지나도 걷지 않는다", async () => {
    // 며칠 안 들어온 사람의 몫이 조용히 사라지면 안 된다.
    const state = makeRaidSession();
    state.raid = { instances: [instance({ id: "world-2026-09-10", openedAt: "2026-09-10T00:00:00.000Z", endsAt: "2026-09-11T00:00:00.000Z", myDamage: 10_000, attemptsUsed: 1 })] };
    const { raids } = await serverAt(state, "2026-09-16T12:00:00Z").getRaids();
    expect(raids.some(({ id }) => id === "world-2026-09-10")).toBe(true);
  });

  it("은 도전 횟수를 다 쓴 판의 입장을 거절한다", async () => {
    const state = makeRaidSession();
    state.raid = { instances: [instance({ id: "world-2026-09-16", openedAt: "2026-09-16T00:00:00.000Z", endsAt: "2026-09-17T00:00:00.000Z", attemptsUsed: RAID_ATTEMPTS_PER_RAID })] };
    await expect(serverAt(state, "2026-09-16T12:00:00Z").enterRaid({ requestId: "e1", raidId: "world-2026-09-16" }))
      .rejects.toMatchObject({ code: "RAID_DAILY_LIMIT" });
  });

  it("은 입장에서 스테미나와 도전 한 번을 함께 쓰고, 같은 요청은 두 번 빼지 않는다", async () => {
    const state = makeRaidSession();
    state.wallet.stamina = 100; state.staminaUpdatedAt = "2026-09-16T12:00:00.000Z";
    const api = serverAt(state, "2026-09-16T12:00:00Z");
    const cost = raidRunStamina("rampage");
    const entry = await api.enterRaid({ requestId: "e2", raidId: "world-2026-09-16" });
    expect(entry.staminaSpent).toBe(cost);
    expect(entry.raid.attemptsUsed).toBe(1);
    expect(entry.playerExp.granted).toBe(cost);
    expect(state.wallet.stamina).toBe(100 - cost);
    await api.enterRaid({ requestId: "e2", raidId: "world-2026-09-16" });
    expect(state.wallet.stamina).toBe(100 - cost);
  });

  it("은 스테미나가 모자라면 입장하지 않고 도전도 쓰지 않는다", async () => {
    const state = makeRaidSession();
    state.wallet.stamina = raidRunStamina("rampage") - 1; state.staminaUpdatedAt = "2026-09-16T12:00:00.000Z";
    const api = serverAt(state, "2026-09-16T12:00:00Z");
    await expect(api.enterRaid({ requestId: "e3", raidId: "world-2026-09-16" })).rejects.toMatchObject({ code: "INSUFFICIENT_STAMINA" });
    const { raids } = await api.getRaids();
    expect(raids[0]!.attemptsUsed).toBe(0);
  });

  it("은 입장 영수증 없는 제출을 거절한다", async () => {
    await expect(serverAt(makeRaidSession(), "2026-09-16T12:00:00Z").submitRaidDamage({ requestId: "s1", raidId: "world-2026-09-16", actions: [] }))
      .rejects.toMatchObject({ code: "RAID_NOT_ENTERED" });
  });

  it("의 스테미나는 판의 레벨이 던전과 같은 사다리에서 정한다", () => {
    expect(raidRunStamina("easy")).toBe(dungeonRunStamina(RAID_DIFFICULTY.easy.level));
    expect(raidRunStamina("rampage")).toBeGreaterThan(raidRunStamina("hard"));
  });

  it("은 없는 판과 끝난 판의 제출을 거절한다", async () => {
    await expect(serverAt(makeRaidSession(), "2026-09-16T12:00:00Z").submitRaidDamage({ requestId: "s3", raidId: "nope", actions: [] }))
      .rejects.toMatchObject({ code: "RAID_NOT_FOUND" });
    const state = makeRaidSession();
    state.raid = { instances: [yesterdayWorld(1)] };
    await expect(serverAt(state, "2026-09-16T12:00:00Z").submitRaidDamage({ requestId: "s4", raidId: "world-2026-09-15", actions: [] }))
      .rejects.toMatchObject({ code: "RAID_ENDED" });
  });

  it("은 요청 ID 없는 제출을 거절한다", async () => {
    await expect(serverAt(makeRaidSession(), "2026-09-16T12:00:00Z").submitRaidDamage({ requestId: "", raidId: "world-2026-09-16", actions: [] }))
      .rejects.toMatchObject({ code: "RAID_SCORE_REJECTED" });
  });

  it("은 편성이 비면 재현할 수 없으므로 거절한다", async () => {
    // 클라이언트가 보낸 피해 숫자를 받지 않으므로, 재현이 서지 않으면 제출 전체가 거절된다.
    const state = makeRaidSession();
    state.party = [];
    const api = serverAt(state, "2026-09-16T12:00:00Z");
    await api.enterRaid({ requestId: "s2", raidId: "world-2026-09-16" });
    await expect(api.submitRaidDamage({ requestId: "s2", raidId: "world-2026-09-16", actions: [] }))
      .rejects.toMatchObject({ code: "RAID_SCORE_REJECTED" });
  });
});
