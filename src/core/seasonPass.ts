/**
 * 시즌 패스의 시계 — **28일마다 도는 30단계 길**(응태 승인 2026-11-09).
 *
 * 시즌은 2026-11-02(월) 00:00 UTC부터 28일씩 끊는다. 주간 임무 네 바퀴와 맞물리게 월요일에 연다. 키는 `S1`·`S2`…이고,
 * 상품 구매 기록의 주기 키(`refresh: "season"`)와 패스의 진행 칸이 같은 키를 읽는다 — 둘이 갈리면 지난 시즌에 산 패스가
 * 이번 시즌에도 열린 것처럼 읽힌다.
 *
 * 단계는 임무 수령이 올리는 연구도를 그대로 센다(`addSeasonPoints`). 새 카운터를 만들지 않고 임무를 받는 그 처리가 함께 올린다.
 */
export const SEASON_EPOCH_MS = Date.UTC(2026, 10, 2);
export const SEASON_DAYS = 28;
const SEASON_MS = SEASON_DAYS * 86_400_000;
/** 한 단계에 드는 연구도. 매일 일일 임무를 다 받고 주간을 채우면 22~24일째에 30단계에 닿는다. */
export const SEASON_TIER_POINTS = 180;
export const SEASON_TIERS = 30;

export function seasonIndex(now: Date | number): number {
  const at = typeof now === "number" ? now : now.getTime();
  return Math.max(0, Math.floor((at - SEASON_EPOCH_MS) / SEASON_MS));
}

export function seasonKey(now: Date | number): string {
  return `S${seasonIndex(now) + 1}`;
}

export function seasonEndsAt(now: Date | number): string {
  return new Date(SEASON_EPOCH_MS + (seasonIndex(now) + 1) * SEASON_MS).toISOString();
}

export interface SeasonPassProgress { key: string; points: number }

/** 저장된 진행을 지금 시즌으로 맞춘다 — 시즌이 바뀌었으면 0에서 다시 시작한다. */
export function currentSeasonProgress(saved: SeasonPassProgress | undefined, now: Date | number): SeasonPassProgress {
  const key = seasonKey(now);
  return saved?.key === key ? { key, points: saved.points } : { key, points: 0 };
}

/** 임무 수령이 올린 연구도를 이번 시즌 진행에 더한다. 길 끝을 넘는 몫은 쌓지 않는다. */
export function addSeasonPoints(saved: SeasonPassProgress | undefined, points: number, now: Date | number): SeasonPassProgress {
  const current = currentSeasonProgress(saved, now);
  return { key: current.key, points: Math.min(SEASON_TIER_POINTS * SEASON_TIERS, current.points + Math.max(0, Math.floor(points))) };
}

/** 진행 패스 저장 중 시즌 패스가 쓰는 칸. 모양은 `ProgressPassState`와 같다(순환 import를 피해 여기서 다시 적는다). */
interface SeasonalPassState { claimed: Record<string, number[]>; freeClaimed: Record<string, number[]>; season?: SeasonPassProgress }

/**
 * 시즌이 바뀌었으면 시즌 패스의 진행과 받은 칸을 함께 비운다. 진행만 0으로 돌리고 받은 칸을 남기면 지난 시즌에 받은
 * 마디가 이번 시즌에도 받은 것으로 읽히고, 받은 칸만 비우면 지난 시즌의 진행으로 이번 시즌 마디를 받는다.
 */
export function rollSeasonPassState<T extends SeasonalPassState>(passes: T, now: Date | number, passId = "season"): T {
  const key = seasonKey(now);
  if (passes.season?.key === key) return passes;
  const { [passId]: _claimed, ...claimed } = passes.claimed;
  const { [passId]: _free, ...freeClaimed } = passes.freeClaimed;
  return { ...passes, claimed, freeClaimed, season: { key, points: 0 } };
}
