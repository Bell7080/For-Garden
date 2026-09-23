import { applyEncounterScaling } from "./levelDesign";
import { RAID_BOSS_HP_SCALE, RAID_DIFFICULTY, RAID_MOCK_PARTICIPANTS, RAID_SEASON_TOTAL_HP, RAID_SUMMON_DIFFICULTIES, RAID_BOSS_POOL, type RaidDifficulty } from "../data/raid";
import { PREVIEW_FRIENDS } from "../data/friends";
import { requiredBreakthroughForLevel } from "./levelDesign";
import type { RelicDef } from "./types";

/**
 * 레이드 시즌의 순수 규칙 — Phaser도 저장도 읽지 않는다.
 *
 * 화면과 FakeServer가 **같은 함수**를 읽어야 보여 준 남은 체력과 실제로 확정된 값이 갈리지
 * 않는다. 원정이 점수와 순위를 코어에 둔 것과 같은 이유다.
 */

/**
 * 월드 폭주의 키는 **UTC 날짜**다 — 하루 한 마리이므로 도전 횟수와 같은 경계를 쓴다.
 *
 * 둘을 다른 경계로 두면 "오늘의 보스"와 "오늘의 도전"이 다른 날을 가리킨다.
 */
export function raidSeasonKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** 그날 자정(UTC)부터 지난 비율(0~1). 모의 누적이 하루에 걸쳐 자라는 근거다. */
export function raidDayProgress(now: Date): number {
  const start = Date.parse(`${raidSeasonKey(now)}T00:00:00.000Z`);
  return Math.min(1, Math.max(0, (now.getTime() - start) / 86_400_000));
}

/** 다음 초기화 시각(다음 날 00:00 UTC). */
export function raidResetsAt(now: Date): string {
  return new Date(Date.parse(`${raidSeasonKey(now)}T00:00:00.000Z`) + 86_400_000).toISOString();
}

/** 시즌 보스의 남은 체력과 처치 여부. 화면은 이 결과만 그린다. */
export interface RaidSeasonProgress {
  totalHp: number;
  dealtDamage: number;
  remainingHp: number;
  /** 0~1. 게이지가 읽는 값이며 총량이 0이어도 나누기가 깨지지 않는다. */
  remainingRatio: number;
  defeated: boolean;
}

/** 누적 피해가 총량을 넘겨도 남은 체력은 0에서 멈추고 비율은 0~1을 벗어나지 않는다. */
export function raidSeasonProgress(dealtDamage: number, totalHp: number = RAID_SEASON_TOTAL_HP): RaidSeasonProgress {
  const total = Math.max(0, Math.floor(totalHp));
  const dealt = Math.max(0, Math.floor(dealtDamage));
  const remainingHp = Math.max(0, total - dealt);
  return { totalHp: total, dealtDamage: dealt, remainingHp, remainingRatio: total > 0 ? remainingHp / total : 0, defeated: total > 0 && dealt >= total };
}

/** 기여 목록 한 줄. 순위는 경쟁이 아니라 **얼마나 밀었나**의 정렬 결과다. */
export interface RaidContributionEntry {
  rank: number;
  playerId: string;
  displayName: string;
  damage: number;
  isMe: boolean;
  favoriteRelicId?: string;
}

/** 정렬 입력. 서버가 보내는 줄과 모의 참가자가 같은 모양으로 들어온다. */
export interface RaidContributionInput {
  playerId: string;
  displayName: string;
  damage: number;
  isMe?: boolean;
  favoriteRelicId?: string;
}

/**
 * 피해 내림차순으로 세우고 동점은 **playerId 오름차순**으로 끊는다.
 *
 * 원정이 "최초 달성 시각"으로 끊는 것과 다른 이유는 여기서 겨루는 것이 속도가 아니기 때문이다 —
 * 같은 만큼 밀었으면 누가 먼저 밀었는지는 이 화면이 말할 일이 아니고, 그래도 순서는 새로고칠
 * 때마다 흔들리면 안 되므로 안정적인 키 하나로 끊는다.
 */
export function raidContributionBoard(entries: readonly RaidContributionInput[], limit = 100): RaidContributionEntry[] {
  return [...entries]
    .filter(({ damage }) => Number.isFinite(damage) && damage > 0)
    .sort((a, b) => b.damage - a.damage || a.playerId.localeCompare(b.playerId))
    .slice(0, Math.max(0, limit))
    .map((entry, index) => ({
      rank: index + 1, playerId: entry.playerId, displayName: entry.displayName,
      damage: Math.floor(entry.damage), isMe: entry.isMe === true, favoriteRelicId: entry.favoriteRelicId,
    }));
}

/**
 * 시즌 키와 참가자 ID만으로 같은 값을 돌려주는 32비트 해시다.
 *
 * 난수를 쓰지 않는 이유는 화면을 다시 열 때마다 다른 사람이 1등이 되면 그 목록이 아무것도
 * 말하지 못하기 때문이다. 같은 시즌·같은 사람이면 언제 읽어도 같은 수가 나온다.
 */
function seedHash(seed: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) / 4_294_967_296;
}

/**
 * 기여 목록에 서는 사람들의 **오늘** 피해.
 *
 * **백엔드가 생기면 이 함수를 지우고 서버 줄로 갈아 끼운다.** 하루 두 판을 치므로 인당 몫은
 * 한 판 실측의 두 배 언저리(`twoRunBase`)이고, 하루의 7할쯤이면 대부분 두 판을 다 친다 — 그래서
 * 이른 시각에는 목록이 덜 차 있고 저녁이면 굳는다. 사람마다 다른 흔들림을 섞어 같은 배율끼리도
 * 순서가 날마다 바뀐다.
 */
export function mockRaidContributions(dayKey: string, dayProgress: number, twoRunBase = 30_000): RaidContributionInput[] {
  const played = Math.min(1, Math.max(0.15, dayProgress / 0.7));
  return RAID_MOCK_PARTICIPANTS.map(({ id, displayName, favoriteRelicId, pace }) => {
    // 흔들림은 0.78~1.22 사이라 같은 pace를 가진 둘도 날마다 앞뒤가 바뀐다.
    const jitter = 0.78 + seedHash(`${dayKey}:${id}`) * 0.44;
    return { playerId: id, displayName, favoriteRelicId, damage: Math.floor(twoRunBase * pace * jitter * played) };
  });
}

/**
 * 목록 밖의 **서버 전체**가 오늘 깎은 몫.
 *
 * 기여 목록은 상위 몇 사람만 세우지만 월드 폭주의 줄은 모든 플레이어가 함께 깎는다 — 목록의
 * 합으로 줄을 그리면 스물넷이 레전드급 체력을 미는 셈이라 날마다 수 퍼센트에서 멈춘다. 그래서
 * 줄은 **그날의 도달 비율**(총량의 55~110%, 날마다 다르다)을 하루에 걸쳐 채우는 곡선에서 읽는다.
 * 100%를 넘는 날만 토벌되고, 나머지 날은 깎은 만큼의 보상만 나간다 — 잡지 못해도 되는 보스다.
 */
export function mockRaidWorldDamage(dayKey: string, dayProgress: number, totalHp: number = RAID_SEASON_TOTAL_HP): number {
  const reach = 0.55 + seedHash(`${dayKey}:world`) * 0.55;
  // 초반에 빨리 밀리고 저녁에 느려지는 곡선이다 — 접속이 몰리는 시간을 흉내 낸다.
  const curve = 1 - (1 - Math.min(1, Math.max(0, dayProgress))) ** 2;
  return Math.floor(totalHp * reach * curve);
}

/**
 * 난이도의 레벨과 그 레벨에 닿는 한계 돌파 — 적도 플레이어와 같은 성장 축을 지난다.
 *
 * 난이도가 오를 때마다 돌파가 한 칸씩 열려 보스가 그 칸의 효과를 얻는다(지금은 모두 "없음"이다).
 */
export function raidBossGrowth(difficulty: RaidDifficulty): { level: number; breakthrough: number } {
  const level = RAID_DIFFICULTY[difficulty].level;
  return { level, breakthrough: requiredBreakthroughForLevel(level) };
}

/**
 * 레이드 보스의 전투 스냅샷.
 *
 * **서버와 화면이 같은 함수를 지난다.** 재현하는 쪽과 그려 주는 쪽이 저마다 레벨을 구하면,
 * 보여 준 `LV.n`과 실제로 맞는 수치가 갈린다. 세기의 손잡이는 난이도의 레벨 하나다.
 */
function raidBossScaledStats(base: RelicDef, difficulty: RaidDifficulty): RelicDef["stats"] {
  return applyEncounterScaling(base.stats, raidBossGrowth(difficulty).level, "endless");
}

/**
 * 최대 체력 비례 피해(출혈·뇌진탕)가 레이드 보스에게서 재는 체력 — **성장으로 얻은 체력**이다.
 *
 * 판 안의 최대 체력은 공유 체력의 단위(`RAID_BOSS_HP_SCALE`)라 성장 체력의 여러 배다. 그
 * 값으로 비율을 재던 때는 출혈 한 번이 판 전체의 타격보다 컸다 — 비율 피해는 **그 개체가 얼마나
 * 단단한가**를 재야 하므로 세기의 몫(레벨·유형)에서 잰다.
 */
export function raidBossPercentHpBasis(base: RelicDef, difficulty: RaidDifficulty = "rampage"): number {
  return Math.max(1, Math.round(raidBossScaledStats(base, difficulty).hp));
}

export function raidBossDef(base: RelicDef, difficulty: RaidDifficulty = "rampage"): RelicDef {
  const scaled = raidBossScaledStats(base, difficulty);
  /*
   * **최대 체력만 성장이 아니라 공유 체력의 단위에서 나온다.** 나머지 넷은 유형 표와 레벨이
   * 그대로 정한다. 체력만 가르는 이유는 그 값이 **세기가 아니라 단위**이기 때문이다 — 난이도마다
   * 몸을 바꾸면 쉬움의 몸이 한 번에 비어 머리 위 줄이 뜻을 잃는다.
   */
  return { ...base, stats: { ...scaled, hp: Math.round(RAID_SEASON_TOTAL_HP / RAID_BOSS_HP_SCALE) } };
}

/**
 * 소환 레이드의 **다른 참가자들**이 지금까지 깎은 몫.
 *
 * **백엔드가 생기면 서버 집계로 갈아 끼운다.** 판마다 도달선(총량의 60~130%)이 다르고 수명에
 * 걸쳐 차오르므로, 어떤 판은 수명 안에 토벌되고 어떤 판은 남는다. 난수를 쓰지 않아 같은 판은
 * 언제 읽어도 같은 값이다.
 */
export function mockSummonRaidDamage(raidId: string, elapsedRatio: number, totalHp: number): number {
  const reach = 0.6 + seedHash(`${raidId}:reach`) * 0.7;
  const curve = 1 - (1 - Math.min(1, Math.max(0, elapsedRatio))) ** 2;
  return Math.floor(totalHp * reach * curve);
}

/**
 * 친구가 그날 연 레이드 — 친구 목록 인원끼리 공유하는 판이다.
 *
 * **백엔드가 생기면 서버가 내려 주는 친구 소환 목록으로 갈아 끼운다.** 지금은 표본 친구가 하루에
 * 한 판씩, 날짜와 친구에서 정해지는 난이도로 연다. 연 시각은 친구마다 몇 시간씩 어긋난다.
 */
export interface FriendRaidDefinition {
  id: string;
  friendId: string;
  friendName: string;
  bossRelicId: string;
  difficulty: RaidDifficulty;
  openedAt: string;
}

export function mockFriendRaids(dayKey: string): FriendRaidDefinition[] {
  const start = Date.parse(`${dayKey}T00:00:00.000Z`);
  return PREVIEW_FRIENDS.map((friend, index) => {
    const pick = seedHash(`${dayKey}:${friend.id}:raid`);
    const difficulty = RAID_SUMMON_DIFFICULTIES[Math.floor(pick * RAID_SUMMON_DIFFICULTIES.length) % RAID_SUMMON_DIFFICULTIES.length];
    const bossRelicId = RAID_BOSS_POOL[Math.floor(seedHash(`${dayKey}:${friend.id}:boss`) * RAID_BOSS_POOL.length) % RAID_BOSS_POOL.length];
    return {
      id: `friend-${friend.id}-${dayKey}`, friendId: friend.id, friendName: friend.displayName,
      bossRelicId, difficulty, openedAt: new Date(start + (2 + index * 5) * 3_600_000).toISOString(),
    };
  });
}

/**
 * 소환 레이드의 기여 목록 — 연 사람과 친구들이 다른 참가자의 몫을 나눠 갖는다.
 *
 * 친구 몇 명뿐인 판이라 월드 폭주처럼 스물넷을 세우지 않는다. 나눠 갖는 비율은 판과 사람에서
 * 정해져 같은 판이면 언제 읽어도 같다.
 */
export function mockSummonContributions(raidId: string, othersDamage: number): RaidContributionInput[] {
  const weights = PREVIEW_FRIENDS.map((friend) => 0.5 + seedHash(`${raidId}:${friend.id}`));
  const sum = weights.reduce((total, weight) => total + weight, 0);
  return PREVIEW_FRIENDS.map((friend, index) => ({
    playerId: friend.id, displayName: friend.displayName, favoriteRelicId: friend.favoriteRelic?.relicId,
    damage: Math.floor(othersDamage * weights[index]! / sum),
  }));
}

/**
 * 끝난 판의 정산 — **참여한 사람만** 받는다.
 *
 * 세 몫을 더한다: 내 피해가 목표(`mineTarget`, 두 판의 합)에 닿을수록 차오르는 몫, 판 전체가
 * 깎인 비율만큼의 몫, 토벌된 판에만 붙는 몫. 내가 많이 깎을수록, 판이 많이 깎일수록 커진다.
 * 한 번도 치지 않았으면 아무것도 없다(`undefined`).
 */
export function raidSettlement(difficulty: RaidDifficulty, myDamage: number, dealtRatio: number, defeated: boolean): { raidSigil: number } | undefined {
  if (!(myDamage > 0)) return undefined;
  const spec = RAID_DIFFICULTY[difficulty].settlement;
  const mine = Math.round(spec.mine * Math.min(1, myDamage / spec.mineTarget));
  const total = Math.round(spec.total * Math.min(1, Math.max(0, dealtRatio)));
  return { raidSigil: Math.max(1, mine + total + (defeated ? spec.kill : 0)) };
}

/** 한 판을 치고 곧바로 받는 골드. 그 판의 피해에 비례한다. */
export function raidRunGold(runDamage: number, goldPerDamage: number): number {
  return Math.max(0, Math.floor(runDamage * goldPerDamage));
}
