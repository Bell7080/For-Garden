import { STAMINA_REGEN_INTERVAL_MS } from "../core/stamina";

/**
 * 다음 한 칸까지 남은 시간 한 줄.
 *
 * 가득 찼으면 아무것도 적지 않는다 — "가득 참" 같은 문구는 같은 창에 선 두 수(현재/최대)가
 * 이미 말하고 있고, 플레이어가 지금 할 일을 바꾸지 않는다. Phaser를 모르는 순수 규칙이라
 * 테스트가 시각을 주입해 그대로 검사한다.
 */
export function staminaTimerLine(amount: number, maximum: number, updatedAt: string, now: number): string | undefined {
  if (amount >= maximum) return undefined;
  const elapsed = updatedAt ? Math.max(0, now - Date.parse(updatedAt)) : 0;
  const seconds = Math.max(0, Math.ceil((STAMINA_REGEN_INTERVAL_MS - elapsed % STAMINA_REGEN_INTERVAL_MS) / 1_000));
  return `다음 회복까지 ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
