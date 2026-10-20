import { describe, expect, it, vi } from "vitest";
import { sourceClass } from "../helpers/sourceClass";

describe("전투 안내 중 소환수 재표시", () => {
  it("다음 코어 갱신 없이 정상 배치·배율을 복구하고 사망 시 정지한 애니메이션을 푼다", () => {
    const creature: any = { scaleX: 1, frozen: true };
    for (const key of ["setAlpha", "setVisible", "setAngle"]) creature[key] = vi.fn(() => creature);
    creature.setAnimationFrozen = vi.fn((value: boolean) => { creature.frozen = value; return creature; });
    const placePuppet = vi.fn((c: any, _asset: unknown, options: any) => { c.scaleX = options.height / 1000; });
    const View = sourceClass("src/scenes/BattleScene.ts", "BattleScene", {
      Phaser: { Scene: class {} }, playMotion: vi.fn(), placePuppet, UNIT_HEIGHT: 210,
      isPupFighter: () => false, PUP_VIEW_ALPHA: .6, renderPose: (f: any) => ({ x: f.x, y: f.y }),
    });
    const chain: any = {}; for (const k of ["setVisible", "snap"]) chain[k] = () => chain;
    const view = { dead: true, creature, asset: {}, fighter: { x: 3, y: 4, hp: 10, maxHp: 20, facing: -1, bodyScale: .8 }, statusChips: { scene: {} }, shadow: chain, statusHit: chain, hpBar: chain };
    const scene = Object.assign(Object.create(View.prototype), { views: new Map([["wolf", view]]), tweens: { killTweensOf: vi.fn() } });
    scene.reviveView("wolf");
    expect(view.dead).toBe(false); expect(creature.frozen).toBe(false);
    expect(placePuppet).toHaveBeenCalledWith(creature, view.asset, { x: 3, groundY: 4, height: 168, flipX: true });
    expect(creature.scaleX).toBe(.168);
  });
});
