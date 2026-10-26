import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const battle = readFileSync(new URL("../../src/scenes/BattleScene.ts", import.meta.url), "utf8");

describe("전장 발밑 그림자의 깊이", () => {
  const depth = battle.match(/const DEPTH = \{([^}]*)\}/)?.[1] ?? "";
  const num = (key: string): number => Number(depth.match(new RegExp(`${key}:\\s*(-?\\d+)`))?.[1]);

  it("는 SD의 가장 낮은 깊이(맨 위 줄 y 600)보다도 뒤에 선다", () => {
    // SD 깊이는 `y / 10 + unitBase` — 그림자가 기본 깊이 0에 있으면 맨 위 줄에서 몸을 덮는다.
    expect(num("shadow")).toBeLessThan(600 / 10 + num("unitBase"));
    expect(num("shadow")).toBeGreaterThan(num("ground"));
  });

  it("는 만들 때 그 깊이로 놓인다", () => {
    expect(battle).toMatch(/addSdFootShadow\([^)]*\)\.setDepth\(DEPTH\.shadow\)/);
  });
});
