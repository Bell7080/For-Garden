import { applyEncounterScaling } from "./levelDesign";
import { RAID_BOSS_HP_SCALE, RAID_CONTRIBUTION_REWARD_STAGES, RAID_MOCK_PARTICIPANTS, RAID_SEASON_BOSS, RAID_SEASON_TOTAL_HP, RAID_WORLD_REWARD_STAGES } from "../data/raid";
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

/** 누적 기여가 넘긴 보상 단계 ID다. 미수령 판정은 서버가 별도로 한다. */
export function raidEarnedContributionStageIds(cumulativeDamage: number): string[] {
  return RAID_CONTRIBUTION_REWARD_STAGES.filter(({ threshold }) => cumulativeDamage >= threshold).map(({ id }) => id);
}

/** 아직 넘기지 못한 다음 단계다. 모두 넘겼으면 undefined를 돌려준다. */
export function raidNextContributionStage(cumulativeDamage: number) {
  return RAID_CONTRIBUTION_REWARD_STAGES.find(({ threshold }) => cumulativeDamage < threshold);
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

/** 서버 전체가 깎은 비율이 넘긴 월드 진행 단계 ID다. 미수령 판정은 서버가 별도로 한다. */
export function raidReachedWorldStageIds(dealtRatio: number): string[] {
  return RAID_WORLD_REWARD_STAGES.filter(({ ratio }) => dealtRatio >= ratio).map(({ id }) => id);
}

/**
 * 시즌 보스의 전투 스냅샷.
 *
 * **서버와 화면이 같은 함수를 지난다.** 재현하는 쪽과 그려 주는 쪽이 저마다 레벨을 구하면,
 * 보여 준 `LV.70`과 실제로 맞는 수치가 갈린다 — 야성 단계에 배율을 먹이는 일은 이 한 줄에서만
 * 돈다(`effectiveEnemyLevel`). 스테이지 정예와 같은 문법이다.
 */
function raidBossScaledStats(base: RelicDef): RelicDef["stats"] {
  return applyEncounterScaling(base.stats, RAID_SEASON_BOSS.level, "endless");
}

/**
 * 최대 체력 비례 피해(출혈·뇌진탕)가 레이드 보스에게서 재는 체력 — **성장으로 얻은 체력**이다.
 *
 * 판 안의 최대 체력은 시즌 게이지의 단위(`RAID_BOSS_HP_SCALE`)라 성장 체력의 여러 배다. 그
 * 값으로 비율을 재던 때는 출혈 한 번이 판 전체의 타격보다 컸다 — 실측으로 렉시아 편성이 한
 * 판에 출혈 98,000 · 타격 8,700을 냈고, 출혈이 없는 편성은 보스 줄을 거의 움직이지 못했다.
 * 비율 피해는 **그 개체가 얼마나 단단한가**를 재야 하므로 세기의 몫(레벨·유형)에서 잰다.
 */
export function raidBossPercentHpBasis(base: RelicDef): number {
  return Math.max(1, Math.round(raidBossScaledStats(base).hp));
}

export function raidBossDef(base: RelicDef): RelicDef {
  const scaled = raidBossScaledStats(base);
  /*
   * **최대 체력만 성장이 아니라 시즌 게이지에서 나온다.**
   *
   * 나머지 넷은 유형 표와 레벨이 그대로 정한다 — 세기를 조이는 손잡이는 여전히 레벨 하나다.
   * 체력만 가르는 이유는 그 값이 **세기가 아니라 단위**이기 때문이다: 시즌 줄과 전장의 줄이
   * 같은 자를 쓰지 않으면, 한 판에서 반을 깎아 놓고 돌아와도 시즌 게이지가 미동도 하지 않는다.
   */
  return { ...base, stats: { ...scaled, hp: Math.round(RAID_SEASON_TOTAL_HP / RAID_BOSS_HP_SCALE) } };
}

