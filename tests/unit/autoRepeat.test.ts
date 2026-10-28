import { describe, expect, it } from "vitest";
import { AUTO_REPEAT_MAX_RUNS, DEFAULT_AUTO_REPEAT_OPTIONS, autoRepeatRunCap, nextAutoRepeatStep, normalizeAutoRepeatOptions, pickAutoDrink, type AutoRepeatOptions } from "../../src/core/autoRepeat";

const options = (patch: Partial<AutoRepeatOptions> = {}): AutoRepeatOptions => ({ ...DEFAULT_AUTO_REPEAT_OPTIONS, ...patch });
const drink = { itemId: "stamina-tonic", quantity: 2, amount: 60 };

describe("자동 전투 다음 걸음", () => {
  it("이긴 판이고 스테미나가 있으면 이어 간다", () => {
    expect(nextAutoRepeatStep({ options: options(), completed: 1, won: true, stamina: 30, staminaCost: 10, drinks: [] })).toEqual({ kind: "continue" });
  });

  it("패배 시 중단을 켰으면 진 판에서 멈추고, 끄면 이어 간다", () => {
    expect(nextAutoRepeatStep({ options: options(), completed: 1, won: false, stamina: 30, staminaCost: 10, drinks: [] })).toEqual({ kind: "stop", reason: "defeat" });
    expect(nextAutoRepeatStep({ options: options({ stopOnDefeat: false }), completed: 1, won: false, stamina: 30, staminaCost: 10, drinks: [] })).toEqual({ kind: "continue" });
  });

  it("정한 횟수를 채우면 멈춘다", () => {
    expect(nextAutoRepeatStep({ options: options({ runs: 5 }), completed: 5, won: true, stamina: 99, staminaCost: 10, drinks: [] })).toEqual({ kind: "stop", reason: "done" });
    expect(nextAutoRepeatStep({ options: options({ runs: 5 }), completed: 4, won: true, stamina: 99, staminaCost: 10, drinks: [] })).toEqual({ kind: "continue" });
  });

  it("횟수 막대의 끝은 스테미나(자동 사용을 켜면 병까지)가 정한다", () => {
    expect(autoRepeatRunCap({ stamina: 64, staminaCost: 10, drinkStamina: 120, autoDrink: false })).toBe(6);
    expect(autoRepeatRunCap({ stamina: 64, staminaCost: 10, drinkStamina: 120, autoDrink: true })).toBe(18);
    expect(autoRepeatRunCap({ stamina: 5, staminaCost: 10, drinkStamina: 0, autoDrink: true })).toBe(0);
    expect(autoRepeatRunCap({ stamina: 9999, staminaCost: 10, drinkStamina: 0, autoDrink: false })).toBe(AUTO_REPEAT_MAX_RUNS);
  });

  it("스테미나가 모자라면 자동 사용을 켰을 때만 병을 딴다", () => {
    expect(nextAutoRepeatStep({ options: options({ autoDrink: true }), completed: 1, won: true, stamina: 5, staminaCost: 10, drinks: [drink] })).toEqual({ kind: "drink", itemId: "stamina-tonic" });
    expect(nextAutoRepeatStep({ options: options(), completed: 1, won: true, stamina: 5, staminaCost: 10, drinks: [drink] })).toEqual({ kind: "stop", reason: "stamina" });
    expect(nextAutoRepeatStep({ options: options({ autoDrink: true }), completed: 1, won: true, stamina: 5, staminaCost: 10, drinks: [] })).toEqual({ kind: "stop", reason: "stamina" });
  });

  it("병은 가장 먼저 사라질 것부터, 같으면 작은 것부터 딴다", () => {
    const large = { itemId: "stamina-tonic-large", quantity: 1, amount: 120, expiresAt: 100 };
    const small = { itemId: "stamina-tonic", quantity: 1, amount: 60, expiresAt: 200 };
    expect(pickAutoDrink([small, large])?.itemId).toBe("stamina-tonic-large");
    expect(pickAutoDrink([{ ...large, expiresAt: undefined }, { ...small, expiresAt: undefined }])?.itemId).toBe("stamina-tonic");
    expect(pickAutoDrink([{ ...small, quantity: 0 }])).toBeUndefined();
  });

  it("저장 값은 선택지 안으로 좁힌다", () => {
    expect(normalizeAutoRepeatOptions({ runs: 7, stopOnDefeat: "yes", autoDrink: true })).toEqual({ runs: 7, stopOnDefeat: true, autoDrink: true });
    expect(normalizeAutoRepeatOptions({ runs: 0 }).runs).toBe(10);
    expect(normalizeAutoRepeatOptions({ runs: AUTO_REPEAT_MAX_RUNS + 1 }).runs).toBe(10);
    expect(normalizeAutoRepeatOptions(undefined)).toEqual(DEFAULT_AUTO_REPEAT_OPTIONS);
  });
});
