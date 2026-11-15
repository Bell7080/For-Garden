/**
 * 아레나 입구의 「지난 판 결과」 알림 — 결과판을 보지 못하고 끝난 랭크전(기권·자리 비움·시간 초과)을
 * 로비에서 한 번 알린다.
 *
 * 기기에 마지막으로 본 내 전적(점수·승·패)을 남기고(`settings.game.arenaSeen`), 입구가 서버 상태를 받을 때
 * 그 값과 견준다. 결과판을 본 판은 결과판이 기록을 맞춰 두므로 다시 알리지 않는다. 기록이 없거나(처음 들어온
 * 기기) 다른 계정의 기록이면 알리지 않고 지금 값으로 시작한다 — 남의 판이나 오래전 판을 지금 일로 알리면 안 된다.
 */
export interface ArenaSeenRecord {
  /** 그 기록을 남긴 계정(플레이어 카드 UID). 계정이 바뀌면 처음부터 잰다. */
  owner: string;
  score: number;
  wins: number;
  losses: number;
}

export interface ArenaUnseenResult {
  outcome: "win" | "loss";
  before: number;
  after: number;
}

const count = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;

export function normalizeArenaSeen(value: unknown): ArenaSeenRecord | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const owner = typeof v.owner === "string" && v.owner.length > 0 && v.owner.length <= 80 ? v.owner : null;
  const score = count(v.score), wins = count(v.wins), losses = count(v.losses);
  return owner === null || score === null || wins === null || losses === null ? null : { owner, score, wins, losses };
}

export function sameArenaSeen(a: ArenaSeenRecord | null, b: ArenaSeenRecord | null): boolean {
  return a === b || (!!a && !!b && a.owner === b.owner && a.score === b.score && a.wins === b.wins && a.losses === b.losses);
}

/** 기록 이후 결과판 없이 끝난 판이 있으면 그 결과. 여러 판이 쌓였으면 마지막에 늘어난 쪽(패배 우선)으로 알린다. */
export function arenaUnseenResult(seen: ArenaSeenRecord | null, now: ArenaSeenRecord): ArenaUnseenResult | null {
  if (!seen || seen.owner !== now.owner) return null;
  const lost = now.losses > seen.losses, won = now.wins > seen.wins;
  if (!lost && !won) return null;
  return { outcome: lost ? "loss" : "win", before: seen.score, after: now.score };
}
