import { nextUtcMidnight, staminaGemDayKey } from "./staminaGemPricing";

/**
 * **하루 한 번 무료 연구**(응태 요청 2026-11-14). 상시 화석 연구(`fossil`)의 1회 한 번을 재화 없이 돌린다 —
 * 확률·천장·마일리지·임무는 유료 1회와 똑같이 센다(무료라고 다른 표를 쓰면 무엇의 확률인지 갈린다).
 * 횟수는 구매 한도와 같은 기록(`productPurchases`)에 UTC 날짜 키로 남고 다른 일일 갱신과 같이 UTC 자정에 돌아온다.
 * 이 키는 상품이 아니라 서버 경계의 이름표다 — 상점 목록에 서지 않는다.
 */
export const FREE_RESEARCH_SOURCE_ID = "research-free-daily";
export const FREE_RESEARCH_BANNER_ID = "fossil";
export const FREE_RESEARCH_DAILY_LIMIT = 1;

export function freeResearchUsedToday(record: { periodKey: string; count: number } | undefined, now: Date): number {
  return record?.periodKey === staminaGemDayKey(now) ? record.count : 0;
}

export function freeResearchAvailable(record: { periodKey: string; count: number } | undefined, now: Date): boolean {
  return freeResearchUsedToday(record, now) < FREE_RESEARCH_DAILY_LIMIT;
}

export function freeResearchSpent(record: { periodKey: string; count: number } | undefined, now: Date): { periodKey: string; count: number } {
  return { periodKey: staminaGemDayKey(now), count: freeResearchUsedToday(record, now) + 1 };
}

export function freeResearchResetsAt(now: Date): Date {
  return nextUtcMidnight(now);
}
