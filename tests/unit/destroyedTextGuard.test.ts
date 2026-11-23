import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ default: { GameObjects: { Text: class {} } } }));

import { installDestroyedTextGuard } from "../../src/ui/destroyedTextGuard";

describe("부서진 글자 보호", () => {
  it("캔버스를 놓은 글자는 다시 그리지 않고, 살아 있는 글자는 그대로 그린다", () => {
    const calls: string[] = [];
    class FakeText {
      canvas: unknown = {};
      context: unknown = {};
      updateText(): this { calls.push("draw"); return this; }
    }
    installDestroyedTextGuard(FakeText as never);
    installDestroyedTextGuard(FakeText as never); // 두 번 걸어도 한 겹이다.
    const alive = new FakeText();
    alive.updateText();
    const dead = new FakeText();
    dead.canvas = null; dead.context = null;
    expect(() => dead.updateText()).not.toThrow();
    expect(dead.updateText()).toBe(dead);
    expect(calls).toEqual(["draw"]);
  });
});
