import { describe, expect, it } from "vitest";
import { healedAmount, shieldTransition, stealthTransition, type ActiveCombatDisplayEffect } from "../../src/core/combatEffects";

/** Phaser 없이 표시 태그의 중복 억제와 실제 변화량 경계를 고정한다. */
describe("전투 표시 태그 전환", () => {
  it("은신 진입·연장·해제를 구분해 연장 중 진입을 중복시키지 않는다", () => {
    expect(stealthTransition(0, 3)).toBe("stealthEnter");
    expect(stealthTransition(2, 3)).toBeUndefined();
    expect(stealthTransition(0.1, 0)).toBe("stealthExit");
  });

  it("보호막 중첩·흡수·파괴를 실제 잔량 경계로 구분한다", () => {
    expect(shieldTransition(10, 30)).toBe("shieldGain");
    expect(shieldTransition(30, 12)).toBe("shieldHit");
    expect(shieldTransition(12, 0)).toBe("shieldBreak");
  });

  it("체력 상한 때문에 실제 회복이 0이면 표시량도 0이다", () => {
    expect(healedAmount(100, 100)).toBe(0);
    expect(healedAmount(80, 100)).toBe(20);
  });
});

describe("유지 전투 표시 태그", () => {
  it("메테 폭주와 루카 동일 표적 오라를 서로 다른 순수 태그로 보존한다", () => {
    // 색·텍스처·Phaser 이름 없이 코어 상태 식별자와 실제 조준 대상만 표현한다.
    const effects: ActiveCombatDisplayEffect[] = [
      { id: "crescendo-staccato:mette-1", tag: "metteStaccatoActive" },
      { id: "luka-passive:luka-1:ally-1", tag: "lukaSharedTargetHasteActive", aimTargetId: "enemy-1" },
    ];
    expect(effects.map((effect) => effect.tag)).toEqual(["metteStaccatoActive", "lukaSharedTargetHasteActive"]);
    expect(effects[1].aimTargetId).toBe("enemy-1");
  });
});
