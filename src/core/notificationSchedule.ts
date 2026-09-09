/** HH:mm 설정을 예약 기준 날짜의 로컬 시각으로 투영한다. */
function clockOnDate(reference: Date, clock: string): Date {
  const [hour, minute] = clock.split(":").map(Number);
  const result = new Date(reference);
  result.setHours(hour, minute, 0, 0);
  return result;
}

/** 야간 제한 안의 시각을 제한 종료로 미루며, 시작=종료는 빈 구간으로 취급한다. */
export function adjustForQuietHours(target: Date, enabled: boolean, start: string, end: string): Date {
  const copy = new Date(target);
  if (!enabled || start === end || !Number.isFinite(copy.getTime())) return copy;
  const startAt = clockOnDate(copy, start); const endAt = clockOnDate(copy, end);
  const crossesMidnight = startAt.getTime() > endAt.getTime();
  if (!crossesMidnight && copy >= startAt && copy < endAt) return endAt;
  if (crossesMidnight && copy >= startAt) { endAt.setDate(endAt.getDate() + 1); return endAt; }
  if (crossesMidnight && copy < endAt) return endAt;
  return copy;
}

/** 서버 UTC 일일 경계의 다음 시각을 클라이언트가 추측하지 않도록 한곳에서 만든다. */
export function nextUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}
