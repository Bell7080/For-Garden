import { describe, expect, it } from "vitest";
import { createUnitHealthBarState, setUnitHealthValue, stepUnitHealthBar } from "../../src/ui/unitHealthBarState";

/** Phaser 없이 체력 표시의 시간 규칙만 검증해 렌더러 변경과 전투 규칙을 분리한다. */
describe("unit health bar state", () => {
  it("단일 피해는 직전 폭을 유지한 뒤 현재 체력을 향해 감소한다", () => {
    let state = setUnitHealthValue(createUnitHealthBarState(1), { currentHp: 70, maxHp: 100, damage: 30, cause: "damage" });
    state = stepUnitHealthBar(state, 100);
    expect(state.damageTrail).toBe(1);
    state = stepUnitHealthBar(state, 200);
    expect(state.damageTrail).toBeGreaterThanOrEqual(state.shown);
    expect(state.damageTrail).toBeLessThan(1);
  });

  it("연속 피해는 가장 큰 보이는 잔상을 보존하고 유지 시간을 갱신한다", () => {
    let state = setUnitHealthValue(createUnitHealthBarState(1), { currentHp: 75, maxHp: 100, previousHp: 100, cause: "damage" });
    state = stepUnitHealthBar(state, 250);
    const trail = state.damageTrail;
    state = setUnitHealthValue(state, { currentHp: 50, maxHp: 100, damage: 25, cause: "damage" });
    expect(state.damageTrail).toBeGreaterThanOrEqual(trail);
    expect(state.trailHold).toBeGreaterThan(0);
  });

  it("회복과 초기 동기화는 피격 반응을 만들지 않는다", () => {
    let state = setUnitHealthValue(createUnitHealthBarState(0.4), { currentHp: 60, maxHp: 100, cause: "heal" });
    expect(state.reactionLevel).toBe(0);
    state = setUnitHealthValue(state, { currentHp: 55, maxHp: 100, cause: "sync" });
    expect(state.reactionLevel).toBe(0);
  });

  it("사망 피해는 잔상 타이머를 기다리지 않고 최종 0으로 정리한다", () => {
    const state = setUnitHealthValue(createUnitHealthBarState(0.2), { currentHp: -5, maxHp: 100, damage: 25, cause: "damage" });
    expect(state.target).toBe(0);
    expect(state.shown).toBe(0);
    expect(state.damageTrail).toBe(0);
    expect(state.trailHold).toBe(0);
  });

  it("회복 시 붉은 잔상은 새 목표 체력보다 작아지지 않는다", () => {
    const state = setUnitHealthValue(createUnitHealthBarState(0.3), { currentHp: 80, maxHp: 100, cause: "heal" });
    expect(state.damageTrail).toBeGreaterThanOrEqual(state.target);
    expect(state.reactionLevel).toBe(0);
  });

  it("낮은 프레임률과 반복 진행에서도 잔상이 현재 체력보다 내려가지 않는다", () => {
    let state = setUnitHealthValue(createUnitHealthBarState(1), { currentHp: 10, maxHp: 100, damage: 90, cause: "damage" });
    for (const delta of [500, 1_000, 2_500, 10_000]) {
      state = stepUnitHealthBar(state, delta);
      expect(state.damageTrail).toBeGreaterThanOrEqual(state.shown);
      expect(state.damageTrail).toBeGreaterThanOrEqual(state.target);
    }
  });
});
