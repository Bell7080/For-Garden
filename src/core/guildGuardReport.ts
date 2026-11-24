import { guardWaveCount, guardWaveLevel } from "./guildGuard";
import type { GuildGuardOutcome } from "./guildGuardBattle";

/**
 * 수호전 결과판 아래 **성적 블록**의 순수 모델(2026-11-24 응태 요청 — 「점수 · 웨이브 · 처치」 글자 한 줄을 그래프로,
 * 점수 랭킹도 함께).
 *
 * 막대 셋은 저마다 **무엇에 견준 몫인가**가 다르다 — 점수는 오늘 길드원 최고(없으면 내 오늘 최고), 웨이브는 로비 표의
 * 끝(30 · 넘으면 그 웨이브), 처치는 그 웨이브까지 들어온 적의 수다. 화면은 이 값을 그리기만 한다.
 *
 * 순위는 길드 판(`GuildGuardBoard`)을 입장 전·확정 뒤 두 번 읽어 만든다 — 서버 표를 새로 두지 않는다. 판을 못 읽으면
 * 순위 줄만 빠지고 막대는 그대로 선다.
 */

/** 웨이브 막대의 기준 끝. 로비 수호전 표의 마지막 칸(`GUILD_GUARD_LOBBY.waves`의 30)과 같다. */
export const GUARD_REPORT_WAVE_SCALE = 30;
/** 순위 줄 수. 1위와 내 바로 위가 늘 보이도록 셋이다. */
export const GUARD_REPORT_ROWS = 3;

export interface GuardReportMember { rank: number; name: string; score: number; isMe: boolean }
export interface GuardReportBoard { members: readonly GuardReportMember[]; guildRank: number | null }

export interface GuardReportStat {
  key: "score" | "wave" | "kills";
  value: number;
  /** 막대가 찬 몫(0~1). */
  fill: number;
  /** 막대 칸 나눔 수(`HoloBar.ticks`). */
  ticks: number;
}

export interface GuardReportRow extends GuardReportMember {
  /** 1위 점수에 견준 막대 몫(0~1). */
  fill: number;
  /** 이번 판으로 오른 등수(내 줄에만, 오르지 않았으면 0). */
  climbed: number;
}

export interface GuardReport {
  stats: readonly [GuardReportStat, GuardReportStat, GuardReportStat];
  /** 이번 판이 오늘 내 최고를 새로 썼는가(첫 판 포함). */
  newBest: boolean;
  /** 이번 판 전의 오늘 최고(없으면 0). */
  previousBest: number;
  /** 이번 판 뒤의 오늘 최고. */
  best: number;
  /** 마지막 웨이브의 적 레벨. */
  waveLevel: number;
  /** 그 웨이브까지 들어온 적의 수. */
  spawned: number;
  rows: readonly GuardReportRow[];
  guildRank: number | null;
}

/** 1~`waves`웨이브에 들어온 적의 합. 웨이브 번호는 1부터다(`guardWaveCount`). */
export function guardSpawnedThrough(waves: number): number {
  let total = 0;
  for (let index = 1; index <= Math.max(0, Math.floor(waves)); index += 1) total += guardWaveCount(index);
  return total;
}

const clamp01 = (value: number): number => (Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0);

/**
 * 순위 줄 — 내가 셋 안이면 위 셋, 아니면 1위 · 내 바로 위 · 나. 1위는 목표, 바로 위는 다음에 넘을 사람이다.
 */
export function guardReportRows(after: readonly GuardReportMember[], before: readonly GuardReportMember[] | null): GuardReportRow[] {
  const ranked = [...after].sort((a, b) => a.rank - b.rank);
  const top = Math.max(1, ranked[0]?.score ?? 0);
  const me = ranked.find((member) => member.isMe);
  const pick = !me || me.rank <= GUARD_REPORT_ROWS
    ? ranked.slice(0, GUARD_REPORT_ROWS)
    : [ranked[0], ranked.find((member) => member.rank === me.rank - 1), me].filter((member): member is GuardReportMember => member !== undefined);
  const beforeMe = before?.find((member) => member.isMe);
  // 점수가 0이던 판은 아직 오른 적이 없던 자리라 오름을 세지 않는다.
  const beforeRank = beforeMe && beforeMe.score > 0 ? beforeMe.rank : null;
  return pick.map((member) => ({
    ...member,
    fill: clamp01(member.score / top),
    climbed: member.isMe && beforeRank !== null ? Math.max(0, beforeRank - member.rank) : 0,
  }));
}

export function buildGuardReport(input: {
  outcome: Pick<GuildGuardOutcome, "score" | "waves" | "kills">;
  /** 서버가 돌려준 오늘 최고(이번 판 반영 뒤). */
  best: number;
  before: GuardReportBoard | null;
  after: GuardReportBoard | null;
}): GuardReport {
  const { outcome } = input;
  const score = Math.max(0, Math.round(outcome.score));
  const waves = Math.max(0, Math.floor(outcome.waves));
  const kills = Math.max(0, Math.floor(outcome.kills));
  const previousBest = Math.max(0, input.before?.members.find((member) => member.isMe)?.score ?? 0);
  const best = Math.max(score, Math.round(input.best), previousBest);
  const topMember = Math.max(0, ...(input.after?.members ?? []).map((member) => member.score));
  const scoreScale = Math.max(1, score, best, topMember);
  const waveScale = Math.max(GUARD_REPORT_WAVE_SCALE, waves);
  const spawned = Math.max(kills, guardSpawnedThrough(waves));
  return {
    stats: [
      { key: "score", value: score, fill: clamp01(score / scoreScale), ticks: 4 },
      { key: "wave", value: waves, fill: clamp01(waves / waveScale), ticks: Math.round(waveScale / 5) - 1 },
      { key: "kills", value: kills, fill: spawned > 0 ? clamp01(kills / spawned) : 0, ticks: 4 },
    ],
    newBest: score > 0 && score >= best && score > previousBest,
    previousBest,
    best,
    waveLevel: waves > 0 ? guardWaveLevel(waves) : 0,
    spawned,
    rows: input.after ? guardReportRows(input.after.members, input.before?.members ?? null) : [],
    guildRank: input.after?.guildRank ?? null,
  };
}
