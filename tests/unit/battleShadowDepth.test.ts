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

describe("얹는 층의 그림자", () => {
  const read = (path: string): string => readFileSync(new URL(`../../src/ui/${path}`, import.meta.url), "utf8");
  // 이미 그림자를 가진 판 위에 겹쳐 얹는 반투명·테두리 층은 제 그림자를 또 그리면 그 그림자가 아래 판·원화 앞에 깔려 눌러 버린다.
  it.each([
    ["DuelDefensePreviewPopup.ts", /alpha: 0, edge, edgeAlpha: 0\.8, shadow: false/],
    ["DungeonLobby.ts", /edgeWidth: 5, shadow: false/],
    ["ExpeditionMapView.ts", /0\.035, shadow: false/],
    ["PassPopup.ts", /alpha: 0\.16, shadow: false/],
  ])("%s", (file, pattern) => { expect(read(file)).toMatch(pattern); });
});
