import { describe, expect, it } from "vitest";
import { CombatEffectPresenter, type CombatEffectTarget } from "../../src/managers/CombatEffectPresenter";
import type { EffectManager, SustainedEffectTarget } from "../../src/managers/EffectManager";

/** Phaser 대신 유지 효과 경계 호출만 기록해 표현 매퍼의 중복·좌표·회수 계약을 고정한다. */
class EffectManagerSpy {
  synced: readonly SustainedEffectTarget[] = [];
  removed: string[] = [];
  syncSustained(targets: readonly SustainedEffectTarget[]): void { this.synced = targets; }
  removeSustainedForFighter(id: string): void { this.removed.push(id); }
}

const target = (overrides: Partial<CombatEffectTarget> = {}): CombatEffectTarget => ({
  id: "ally-1", x: 120, y: 300, height: 100, alive: true, effectTint: 0xaabbcc,
  activeEffects: [{ id: "luka-passive:luka-1:ally-1", tag: "lukaSharedTargetHasteActive", aimTargetId: "enemy-1" }],
  ...overrides,
});

describe("CombatEffectPresenter 유지 효과 매핑", () => {
  it("활성 효과 하나를 한 번만 만들 경계로 보내고 몸통/표적 좌표를 동기화한다", () => {
    const spy = new EffectManagerSpy();
    const presenter = new CombatEffectPresenter(spy as unknown as EffectManager);
    presenter.sync([target(), target({ id: "enemy-1", x: 500, y: 240, height: 80, activeEffects: [] })]);
    expect(spy.synced).toEqual([{
      fighterId: "ally-1", effectId: "luka-passive:luka-1:ally-1", tag: "lukaSharedTargetHasteActive",
      x: 120, y: 250, aimX: 500, aimY: 200, color: 0xaabbcc,
    }]);
  });

  it("조건 해제는 빈 활성 목록으로, 사망은 전투원 단위 즉시 제거로 전달한다", () => {
    const spy = new EffectManagerSpy();
    const presenter = new CombatEffectPresenter(spy as unknown as EffectManager);
    presenter.sync([target({ activeEffects: [] })]);
    expect(spy.synced).toEqual([]);
    presenter.remove("ally-1");
    expect(spy.removed).toEqual(["ally-1"]);
  });
});
