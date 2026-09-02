import { describe, expect, it } from "vitest";
import { staminaTimerLine } from "../../src/ui/staminaDisplay";
import { STAMINA_RECHARGE_SOURCES, staminaConsumable } from "../../src/data/staminaRecharge";
import { STAMINA_REGEN_INTERVAL_MS } from "../../src/core/stamina";

describe("스테미나 창의 순수 규칙", () => {
  it("은 가득 찼을 때 아무 줄도 만들지 않는다", () => {
    // "가득 참" 같은 문구는 같은 창의 두 수가 이미 말하고 있고 조작을 바꾸지 않는다.
    expect(staminaTimerLine(120, 120, new Date().toISOString(), Date.now())).toBeUndefined();
    expect(staminaTimerLine(121, 120, new Date().toISOString(), Date.now())).toBeUndefined();
  });

  it("은 남은 시간을 분:초로 적고 다음 한 칸까지만 센다", () => {
    const now = Date.parse("2026-09-02T00:00:00Z");
    // 방금 회복한 직후라면 한 구간(5분)이 통째로 남는다.
    expect(staminaTimerLine(10, 120, "2026-09-02T00:00:00Z", now)).toBe("다음 회복까지 5:00");
    // 구간의 절반이 지나면 남은 절반만 센다.
    expect(staminaTimerLine(10, 120, "2026-09-02T00:00:00Z", now + STAMINA_REGEN_INTERVAL_MS / 2)).toBe("다음 회복까지 2:30");
    // 기준 시각이 없는 신규 저장도 창을 비우지 않고 한 구간을 그대로 보여 준다.
    expect(staminaTimerLine(10, 120, "", now)).toBe("다음 회복까지 5:00");
  });

  it("은 실제로 쓸 수 있는 충전 수단만 표에 둔다", () => {
    // 경계가 없는 젬 충전·광고 보급을 표에 넣으면 눌러도 아무 일이 없는 줄이 선다.
    expect(STAMINA_RECHARGE_SOURCES.length).toBeGreaterThan(0);
    for (const source of STAMINA_RECHARGE_SOURCES) {
      const item = staminaConsumable(source.itemId);
      expect(item, source.itemId).toBeDefined();
      expect(item!.amount).toBeGreaterThan(0);
    }
  });
});
