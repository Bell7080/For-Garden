import { describe, expect, it } from "vitest";
import { DEFAULT_AUTO_REPEAT_OPTIONS, nextAutoRepeatStep, normalizeAutoRepeatOptions, pickAutoDrink, type AutoRepeatOptions } from "../../src/core/autoRepeat";

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

  it("정한 횟수를 채우면 멈추고, 무제한은 멈추지 않는다", () => {
    expect(nextAutoRepeatStep({ options: options({ runs: 5 }), completed: 5, won: true, stamina: 99, staminaCost: 10, drinks: [] })).toEqual({ kind: "stop", reason: "done" });
    expect(nextAutoRepeatStep({ options: options({ runs: 0 }), completed: 500, won: true, stamina: 99, staminaCost: 10, drinks: [] })).toEqual({ kind: "continue" });
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
    expect(normalizeAutoRepeatOptions({ runs: 7, stopOnDefeat: "yes", autoDrink: true })).toEqual({ runs: 10, stopOnDefeat: true, autoDrink: true });
    expect(normalizeAutoRepeatOptions(undefined)).toEqual(DEFAULT_AUTO_REPEAT_OPTIONS);
  });
});
