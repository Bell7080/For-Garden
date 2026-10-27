/**
 * 고대 지층 — 끝없이 내려가는 지층 탐사(무한 모드)의 층 규칙.
 *
 * 지도 구간과 배경 규칙. 전투 정의는 ancientStrataBattle.ts, 전용 난이도 표는
 * data/ancientStrataDifficulty.ts가 소유한다. 진행·초회 보상은 공용 stage 서버 검증을 사용한다.
 */

/** 한 구간(한 장의 지도)에 담기는 층 수. */
export const ANCIENT_FLOORS_PER_BLOCK = 10;

export type AncientBackdrop = "entry" | "loopA" | "loopB" | "loopC";

/**
 * 첫 구간은 입구 원화, 그 뒤로는 반복 세 장이 1 → 3 → 2 순으로 돈다.
 * 원화가 장별로 끊겨 있어 이어 붙지 않으므로 같은 그림이 연달아 나오지 않게만 돌린다.
 */
const LOOP_ORDER: readonly AncientBackdrop[] = ["loopA", "loopB", "loopC"];

/** 층(1부터)이 속한 구간 번호(0부터). */
export function ancientBlockOf(floor: number): number {
  return Math.floor((Math.max(1, Math.floor(floor)) - 1) / ANCIENT_FLOORS_PER_BLOCK);
}

/** 구간의 첫 층과 마지막 층. */
export function ancientBlockFloors(block: number): { first: number; last: number } {
  const first = Math.max(0, Math.floor(block)) * ANCIENT_FLOORS_PER_BLOCK + 1;
  return { first, last: first + ANCIENT_FLOORS_PER_BLOCK - 1 };
}

/** 구간이 쓰는 배경. */
export function ancientBlockBackdrop(block: number): AncientBackdrop {
  const index = Math.max(0, Math.floor(block));
  return index === 0 ? "entry" : LOOP_ORDER[(index - 1) % LOOP_ORDER.length];
}

/** 구간의 마지막 층은 관문이다 — 노드가 한 단계 크게 선다. */
export function isAncientGate(floor: number): boolean {
  return floor > 0 && floor % ANCIENT_FLOORS_PER_BLOCK === 0;
}

/** 진행 기록에서 클리어한 가장 깊은 층. 하나도 없으면 0이다. */
export function ancientHighestCleared(cleared: Iterable<string>, maxFloor: number): number {
  let best = 0;
  for (const id of cleared) {
    const match = /^ancient:(\d+)$/.exec(id);
    if (match) best = Math.max(best, Math.min(maxFloor, Number(match[1])));
  }
  return best;
}

/** 지금 도전하는 층 — 가장 깊이 깬 층의 다음 층이고 마지막 층에서 멈춘다. */
export function ancientChallengeFloor(highestCleared: number, maxFloor: number): number {
  return Math.min(maxFloor, Math.max(0, Math.floor(highestCleared)) + 1);
}

/**
 * 넘겨 볼 수 있는 마지막 구간 — 지금 도전하는 구간과 그다음 한 구간까지다.
 * 끝없이 넘기면 아직 닿지도 않은 200층의 적·배율을 미리 다 보게 되어 "다음은 무엇이 오나"가 사라진다.
 */
export function ancientLastBrowsableBlock(challengeFloor: number, maxFloor: number): number {
  const lastBlock = ancientBlockOf(maxFloor);
  return Math.min(lastBlock, ancientBlockOf(challengeFloor) + 1);
}

/**
 * 친구·길드원을 층 노드에 묶는다. 표시는 각자 **도전 중인 층**(가장 깊이 깬 층 + 1)이고, 한 번도 깨지
 * 않은 사람은 지층에 들어오지 않았으므로 세우지 않는다. 같은 층 안의 순서는 들어온 순서를 지킨다.
 */
export function groupAncientPeers<T extends { highestCleared: number }>(peers: readonly T[], maxFloor: number): Map<number, T[]> {
  const byFloor = new Map<number, T[]>();
  for (const peer of peers) {
    if (!(peer.highestCleared > 0)) continue;
    const floor = ancientChallengeFloor(peer.highestCleared, maxFloor);
    byFloor.set(floor, [...(byFloor.get(floor) ?? []), peer]);
  }
  return byFloor;
}

/**
 * 고대 지층의 달 — UTC 기준 `YYYY-MM`. 매달 1일 00:00(UTC)에 진행이 1층으로 돌아가고, 순위도 그 달 한 칸에 쌓인다.
 * 서버의 순위 기간 키(`server_competitive_scores.period`)는 이 값의 첫날(`YYYY-MM-01`)이다.
 */
export function ancientSeasonKey(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 달 키를 0부터 세는 달 번호로 바꾼다. 비었거나 형식이 틀리면 0이다(구성의 기본 회전). */
export function ancientSeasonIndex(season: string): number {
  const match = /^(\d{4})-(\d{2})$/.exec(season);
  return match ? Number(match[1]) * 12 + Number(match[2]) - 1 : 0;
}

/** 다음 달 1일 00:00(UTC) — 이 시각에 지층이 초기화된다. */
export function ancientSeasonEndsAt(season: string): Date {
  const index = ancientSeasonIndex(season) + 1;
  return new Date(Date.UTC(Math.floor(index / 12), index % 12, 1));
}

/**
 * 진행을 이번 달로 넘긴다. 달이 바뀌었으면 지층을 초기화한다 — `ancient:N` 기록만 지우고(초회 보상도 다시 받는다), 나머지 진행은 그대로다.
 * 달 키가 아직 없는 예전 저장은 지우지 않고 이번 달로 받아들인다 — 갱신 직후 진행이 통째로 사라지지 않게.
 */
export function rollAncientSeason(season: string, cleared: ReadonlySet<string>, now: Date): { season: string; cleared: Set<string> } | null {
  const current = ancientSeasonKey(now);
  if (season === current) return null;
  if (!season) return { season: current, cleared: new Set(cleared) };
  return { season: current, cleared: new Set([...cleared].filter((id) => !/^ancient:\d+$/.test(id))) };
}

/** 지층 초기화가 이만큼 남으면 지층에 들어올 때 예고 창을 띄운다(응태 — 마감 3일 전). */
export const ANCIENT_RESET_WARNING_MS = 3 * 86_400_000;

/** 예고 창을 하루 한 번만 띄우려고 기기에 남기는 날짜 키(UTC). */
export const ancientDayKey = (now: Date): string => now.toISOString().slice(0, 10);

/** 지금 예고 창을 띄울 차례인가 — 초기화 3일 전부터, 그날 아직 보지 않았을 때만. */
export function ancientResetWarningDue(season: string, now: Date, seenDay: string): boolean {
  const left = ancientSeasonEndsAt(season || ancientSeasonKey(now)).getTime() - now.getTime();
  return left > 0 && left <= ANCIENT_RESET_WARNING_MS && seenDay !== ancientDayKey(now);
}
