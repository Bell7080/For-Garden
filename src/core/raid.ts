import { applyEncounterScaling, encounterEnemyLevel } from "./levelDesign";
import { RAID_BOSS_HP_SCALE, RAID_CONTRIBUTION_REWARD_STAGES, RAID_MOCK_PARTICIPANTS, RAID_SEASON_BOSS, RAID_SEASON_TOTAL_HP } from "../data/raid";
import { expeditionWeekKey } from "./expeditionBoss";
import type { RelicDef } from "./types";

/**
 * 레이드 시즌의 순수 규칙 — Phaser도 저장도 읽지 않는다.
 *
 * 화면과 FakeServer가 **같은 함수**를 읽어야 보여 준 남은 체력과 실제로 확정된 값이 갈리지
 * 않는다. 원정이 점수와 순위를 코어에 둔 것과 같은 이유다.
 */

/**
 * 시즌 키는 원정 주차와 **같은 경계**(월요일 00:00 UTC)를 쓴다.
 *
 * 주차를 여기서 다시 계산하지 않는 이유는 두 콘텐츠가 서로 다른 날 초기화되면 "이번 주"라는
 * 말이 화면마다 다른 것을 가리키기 때문이다. 경계를 옮길 일이 생기면 그 한 곳만 고친다.
 */
export const raidSeasonKey = expeditionWeekKey;

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
 * 함께 밀고 있는 사람들의 누적 피해.
 *
 * **백엔드가 생기면 이 함수를 지우고 서버 줄로 갈아 끼운다** — 길드원과 친구가 그 자리에 선다.
 * 지금 이것을 두는 이유는, 협력전의 화면이 말해야 하는 것이 "내 기록"이 아니라 "다 같이 얼마나
 * 밀었나"인데 참가자가 나 하나뿐이면 그 문장이 성립하지 않기 때문이다.
 *
 * 시즌이 하루씩 갈수록 각자의 누적이 자기 `pace`만큼 늘어난다. 하루치 몫에 사람마다 다른
 * 흔들림을 섞어 같은 배율끼리도 순서가 굳지 않게 한다.
 */
export function mockRaidContributions(seasonKey: string, elapsedDays: number, dailyBaseDamage = 60_000): RaidContributionInput[] {
  const days = Math.min(7, Math.max(0, Math.floor(elapsedDays)) + 1);
  return RAID_MOCK_PARTICIPANTS.map(({ id, displayName, favoriteRelicId, pace }) => {
    // 흔들림은 0.78~1.22 사이라 같은 pace를 가진 둘도 시즌마다 앞뒤가 바뀐다.
    const jitter = 0.78 + seedHash(`${seasonKey}:${id}`) * 0.44;
    return { playerId: id, displayName, favoriteRelicId, damage: Math.floor(dailyBaseDamage * pace * jitter * days) };
  });
}

/** 시즌 시작(월요일 00:00 UTC)부터 지난 날수다. 모의 누적이 시간에 따라 자라는 근거다. */
export function raidSeasonElapsedDays(now: Date): number {
  const start = Date.parse(`${raidSeasonKey(now)}T00:00:00.000Z`);
  return Math.max(0, Math.floor((now.getTime() - start) / 86_400_000));
}

/**
 * 시즌 보스의 전투 스냅샷.
 *
 * **서버와 화면이 같은 함수를 지난다.** 재현하는 쪽과 그려 주는 쪽이 저마다 레벨을 구하면,
 * 보여 준 `LV.70`과 실제로 맞는 수치가 갈린다 — 야성 단계에 배율을 먹이는 일은 이 한 줄에서만
 * 돈다(`effectiveEnemyLevel`). 스테이지 정예와 같은 문법이다.
 */
export function raidBossDef(base: RelicDef): RelicDef {
  const level = encounterEnemyLevel(RAID_SEASON_BOSS.level, "endless");
  const scaled = applyEncounterScaling(base.stats, level, "endless");
  /*
   * **최대 체력만 성장이 아니라 시즌 게이지에서 나온다.**
   *
   * 나머지 넷은 유형 표와 레벨이 그대로 정한다 — 세기를 조이는 손잡이는 여전히 레벨 하나다.
   * 체력만 가르는 이유는 그 값이 **세기가 아니라 단위**이기 때문이다: 시즌 줄과 전장의 줄이
   * 같은 자를 쓰지 않으면, 한 판에서 반을 깎아 놓고 돌아와도 시즌 게이지가 미동도 하지 않는다.
   */
  return { ...base, stats: { ...scaled, hp: Math.round(RAID_SEASON_TOTAL_HP / RAID_BOSS_HP_SCALE) } };
}

