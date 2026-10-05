/**
 * 젬 충전의 누진 가격 — 한 번에 얼마를 내는가는 **오늘 이미 몇 번 채웠는가**가 정한다.
 *
 * 1~5번째는 기본값, 6~10번째는 기본값 + 한 단계, 11번째부터 한 단계씩 더 오른다. 같은 스테미나
 * (60)를 사는 값이 오르는 것이라 하루에 젬으로 채울 수 있는 양을 값이 스스로 조인다. 카운터는
 * 서버 UTC 자정에 처음으로 돌아가고(`nextUtcMidnight`), 값은 서버가 요청 시점의 횟수로만 정한다 —
 * 화면은 `nextStaminaGemCost`로 같은 값을 미리 보여 줄 뿐이다.
 */
export const STAMINA_GEM_PRICING = { baseCost: 50, step: 50, purchasesPerStep: 5 } as const;

/** 오늘 `purchasedToday`번 채운 사람이 **다음에** 치를 젬. */
export function nextStaminaGemCost(purchasedToday: number): number {
  const done = Math.max(0, Math.floor(Number.isFinite(purchasedToday) ? purchasedToday : 0));
  return STAMINA_GEM_PRICING.baseCost + Math.floor(done / STAMINA_GEM_PRICING.purchasesPerStep) * STAMINA_GEM_PRICING.step;
}

/** 서버 UTC 날짜 키(`YYYY-MM-DD`). 카운터는 이 키가 바뀔 때만 처음으로 돌아간다. */
export function staminaGemDayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** 카운터가 처음으로 돌아가는 시각(다음 UTC 자정). */
export function nextUtcMidnight(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}
