import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GAME_HIDDEN_EVENT, GAME_VISIBLE_EVENT, installBackgroundSleep } from "../../src/ui/backgroundSleep";

describe("앱이 뒤로 가면 게임 루프를 재운다", () => {
  it("숨김에서 sleep, 복귀에서 wake를 부른다", () => {
    const handlers = new Map<string, () => void>();
    const calls: string[] = [];
    installBackgroundSleep({
      events: { on: (event: string, fn: () => void) => handlers.set(event, fn) },
      loop: { sleep: () => calls.push("sleep"), wake: () => calls.push("wake") },
    });
    handlers.get(GAME_HIDDEN_EVENT)!();
    handlers.get(GAME_VISIBLE_EVENT)!();
    expect(calls).toEqual(["sleep", "wake"]);
  });

  it("이벤트 이름이 Phaser의 HIDDEN·VISIBLE과 같다", () => {
    expect(readFileSync("node_modules/phaser/src/core/events/HIDDEN_EVENT.js", "utf8")).toContain(`module.exports = '${GAME_HIDDEN_EVENT}'`);
    expect(readFileSync("node_modules/phaser/src/core/events/VISIBLE_EVENT.js", "utf8")).toContain(`module.exports = '${GAME_VISIBLE_EVENT}'`);
  });

  it("부트가 설치하고, 쓰지 않는 Pre FX 렌더 타깃을 만들지 않는다", () => {
    const main = readFileSync("src/main.ts", "utf8");
    expect(main).toContain("installBackgroundSleep(game)");
    expect(main).toMatch(/disablePreFX:\s*true/);
  });
});
