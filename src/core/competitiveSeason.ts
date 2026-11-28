/**
 * 경쟁 콘텐츠의 월간 시즌(2026-11-28 응태 요청 — 결투장·아레나 순위는 월간, 티어는 주간 우편, 초기화는 월간).
 *
 * **스위치 하나가 새 구조 전체를 켠다**(`COMPETITIVE_MONTHLY_ENABLED`). 켜면 결투 시즌이 달력의 달이 되고
 * (시즌 ID `YYYY-MM`), 결투장 탭의 시즌 보상 받기가 사라지며(티어는 매주 우편으로 온다), 순위 보상표가 새
 * 표로 바뀌고, 게임 서버가 새 정산 함수(`server_competitive_rewards_v3` · `server_arena_rewards_v2`)를 부른다.
 * 그 함수는 마이그레이션 `20261204000000_competitive_monthly.sql`이 만든다 — **마이그레이션을 운영에 적용한 뒤에만
 * 켠다.** 꺼져 있는 동안은 예전 21일 시즌·탭 받기·예전 표 그대로다.
 *
 * **스위치는 시각이다**(2026-11-28 응태 승인 「12월 1일에 켜기」, 마이그레이션은 같은 날 운영 적용). 배포 시각에 기대지 않고
 * `COMPETITIVE_MONTHLY_STARTS_AT`이 지나는 순간 화면·서버가 함께 넘어간다 — 켜 둔 채 넘어가는 앱도 그 시각부터 새 구조를 읽는다.
 */
export const COMPETITIVE_MONTHLY_STARTS_AT = Date.UTC(2026, 11, 1);
export const competitiveMonthlyOn = (now: Date | number = Date.now()): boolean =>
  (typeof now === "number" ? now : now.getTime()) >= COMPETITIVE_MONTHLY_STARTS_AT;

/** 그 시각이 속한 달(UTC) — `2026-11`. */
export function monthPeriodId(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 그 달이 끝나는 시각 — 다음 달 1일 00:00 UTC. */
export function monthPeriodEndsAt(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/** 21일 시즌의 옛 ID(`S12`). 월간으로 넘어갈 때 그 시즌은 초기화 없이 이번 달로 이어진다. */
export const isLegacyDuelSeasonId = (id: string): boolean => /^S\d+$/.test(id);

/**
 * 새 정산 함수가 보기 시작하는 날(`p_rules.since`). 그 앞의 주·달은 예전 규칙이 이미 정산했으므로 겹쳐 주지 않는다.
 * **스위치를 켜는 날로 맞춘다** — 그 주 월요일 이후의 주간 티어, 그 달의 월간 순위부터 새 우편이 간다.
 */
export const COMPETITIVE_MONTHLY_SINCE = "2026-12-01";
