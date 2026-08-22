/**
 * 재화 표기.
 *
 * 골드처럼 자릿수가 크게 늘어나는 재화는 숫자를 다 적으면 상단 줄을 밀어낸다. 그래서 천
 * 단위부터 K, 백만부터 M으로 줄여 **폭이 일정하게** 유지되도록 한다. 자릿수가 바뀔 때마다
 * 칸 크기가 흔들리면 그 옆의 아이콘까지 함께 움직여 화면이 들썩인다.
 *
 * 반올림이 아니라 버림을 쓴다. 9,999가 "10K"로 보이면 실제보다 많아 보이기 때문이다.
 */
export function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) throw new RangeError("재화 수량이 올바르지 않습니다.");
  const value = Math.trunc(amount);
  if (Math.abs(value) < 10_000) return value.toLocaleString();
  for (const [unit, suffix] of [[1_000_000_000, "B"], [1_000_000, "M"], [1_000, "K"]] as const) {
    if (Math.abs(value) < unit) continue;
    const scaled = Math.trunc((value / unit) * 10) / 10;
    // 소수 첫째 자리가 0이면 굳이 적지 않는다. "25K"가 "25.0K"보다 읽기 쉽다.
    return (Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(1)) + suffix;
  }
  return value.toLocaleString();
}
