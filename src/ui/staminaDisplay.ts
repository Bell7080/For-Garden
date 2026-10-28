import { STAMINA_REGEN_AMOUNT, STAMINA_REGEN_INTERVAL_MS } from "../core/stamina";
import { t } from "../i18n";

/**
 * 큰 수치 아래의 회색 시간표 한 줄 — **몇 분마다 얼마씩 차는지**와 다음 한 칸까지 남은 시간.
 *
 * 가득 찼어도 주기는 남긴다 — 쓰고 나면 얼마나 빨리 돌아오는지가 지금 쓸지를 정한다. 남은 시간만
 * 빠진다. Phaser를 모르는 순수 규칙이라 테스트가 시각을 주입해 그대로 검사한다.
 */
export function staminaTimerLine(amount: number, maximum: number, updatedAt: string, now: number): string {
  const minutes = Math.round(STAMINA_REGEN_INTERVAL_MS / 60_000);
  if (amount >= maximum) return t("stamina.regenEvery", { minutes, amount: STAMINA_REGEN_AMOUNT });
  const elapsed = updatedAt ? Math.max(0, now - Date.parse(updatedAt)) : 0;
  const seconds = Math.max(0, Math.ceil((STAMINA_REGEN_INTERVAL_MS - elapsed % STAMINA_REGEN_INTERVAL_MS) / 1_000));
  return t("stamina.nextRecovery", { minutes, amount: STAMINA_REGEN_AMOUNT, time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` });
}
