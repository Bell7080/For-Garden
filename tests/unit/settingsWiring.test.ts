import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { sourceClass } from "../helpers/sourceClass";
import { puppetElapsedMs } from "../../src/puppets/runtimeStep";
import { createSweepBudget } from "../../src/ui/sweepBudget";
import { session } from "../../src/state/session";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith(".ts") ? [path] : [];
  });
}

describe("설정이 실제 경로에 닿는다", () => {
  it("카메라 흔들림은 shakeCamera·EffectManager 두 곳만 직접 부른다(설정 배율을 비껴가지 않게)", () => {
    const offenders = walk("src").filter((file) => !file.endsWith("ui/screenShake.ts") && !file.endsWith("managers/EffectManager.ts"))
      .filter((file) => /cameras?\.main\.shake\(|camera\.shake\(/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("main이 Phaser 흔들림 문을 설치한다(어떤 길로 부른 흔들림도 꺼진 설정을 지난다)", () => {
    expect(readFileSync("src/main.ts", "utf8")).toContain("installScreenShakeGate();");
  });

  it("절전 장식 문은 절반만 그리고, 꺼지면 매 프레임 그린다", () => {
    const saved = session.settings.presentation.powerSaving;
    try {
      session.settings.presentation.powerSaving = true;
      const gate = createSweepBudget();
      expect(Array.from({ length: 10 }, gate).filter(Boolean)).toHaveLength(5);
      session.settings.presentation.powerSaving = false;
      const open = createSweepBudget();
      expect(Array.from({ length: 10 }, open).every(Boolean)).toBe(true);
    } finally { session.settings.presentation.powerSaving = saved; }
  });

  it("절전이 건너뛴 Puppet 프레임의 시간은 다음 갱신이 함께 적분한다(느려지지 않는다)", () => {
    const advance = vi.fn((_puppet: unknown, _seconds: number) => new Float32Array(6));
    const Creature = sourceClass("src/puppets/IndexedPuppetCreature.ts", "IndexedPuppetCreature", {
      Phaser: { GameObjects: { Image: class {} }, Math: { Clamp: (v: number, a: number, b: number) => Math.min(b, Math.max(a, v)) } },
      gpuGeneration: 0, programs: new WeakMap(), watchContextRestore: () => {},
      advancePuppet: advance, puppetElapsedMs, debugPerfEnabled: false,
    });
    const loop = { time: 0, rawDelta: 16 };
    const creature = Object.assign(Object.create(Creature.prototype), {
      active: true, visible: true, alpha: 1, animationFrozen: false, decorativeUpdateCredit: 0, decorativeCarryMs: 0,
      decorativeUpdateFactor: 0.5, lastLoopTime: -1, poseVersion: 0, puppet: {}, scene: { game: { loop } },
    });
    for (let frame = 1; frame <= 4; frame += 1) { loop.time = frame * 16; creature.step(loop.time, 16); }
    const total = advance.mock.calls.reduce((sum, [, seconds]) => sum + seconds, 0);
    expect(advance).toHaveBeenCalledTimes(2);
    expect(total).toBeCloseTo((16 * 4) / 1000, 5);
  });
});
