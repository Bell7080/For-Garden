/**
 * 남은 밀리초를 `HH:MM:SS`로 적는다.
 *
 * 시는 24에서 되감지 않으며, 아직 남은 1초 미만을 0으로 먼저 보이지 않도록 올림한다.
 * 네트워크에서 잘못된 값이 와도 UI에 `NaN`이나 음수가 새지 않게 0으로 닫는다.
 */
export function formatCountdown(remainingMs: number): string {
  const safeMs = Number.isFinite(remainingMs) && remainingMs > 0 ? remainingMs : 0;
  const totalSeconds = Math.ceil(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

/**
 * 남은 밀리초를 상점 리필 시계와 같은 `D00:HH:MM:SS`로 적는다 — 이벤트·출석의 남은 기간이 이 한 모양을 쓴다.
 * 날수는 두 자리 아래로 내려가지 않고(`D09`) 백 일이 넘으면 그대로 늘어난다.
 */
export function formatDayCountdown(remainingMs: number): string {
  const safeMs = Number.isFinite(remainingMs) && remainingMs > 0 ? remainingMs : 0;
  const totalSeconds = Math.floor(safeMs / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `D${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
