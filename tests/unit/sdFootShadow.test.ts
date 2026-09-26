import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SD_FOOT_SHADOW, sdFootShadowCoreAlpha } from "../../src/ui/sdFootShadowStyle";

/** SD가 발을 딛는 자리. 여기서 타원을 직접 그리면 한 벌에서 벗어난 것이다. */
const SITES = [
  "src/ui/info.ts",
  "src/ui/NodeEnemyPreview.ts",
  "src/ui/PlayerProfilePopup.ts",
  "src/ui/StageCompletePopup.ts",
  "src/ui/formationSlotChrome.ts",
  "src/scenes/PartyScene.ts",
  "src/scenes/BattleScene.ts",
] as const;

describe("SD 발밑 그림자", () => {
  it("은 판이 아니라 살짝 비치는 그림자다 — 가장자리는 옅고 가운데도 절반을 넘지 않는다", () => {
    expect(SD_FOOT_SHADOW.color).toBe(0x000000);
    const [outer] = SD_FOOT_SHADOW.layers;
    expect(outer.scale).toBe(1);
    expect(outer.alpha).toBeLessThan(0.2);
    expect(sdFootShadowCoreAlpha()).toBeGreaterThan(0.3);
    expect(sdFootShadowCoreAlpha()).toBeLessThan(0.5);
    // 겹은 안쪽으로 갈수록 작아진다 — 크기가 뒤섞이면 가운데가 아니라 엉뚱한 고리가 짙어진다.
    const scales = SD_FOOT_SHADOW.layers.map(({ scale }) => scale);
    expect([...scales].sort((a, b) => b - a)).toEqual(scales);
  });

  it("은 SD가 서는 모든 자리가 같은 프리팹을 부르고 제 타원을 그리지 않는다", () => {
    for (const path of SITES) {
      const source = readFileSync(path, "utf8");
      expect(source, path).toContain("addSdFootShadow(");
    }
    // 정보창 받침에 노란 선(강조색 머리카락 선)과 짙은 원판을 다시 두르지 않는다.
    const info = readFileSync("src/ui/info.ts", "utf8");
    const stand = info.slice(info.indexOf("export function addInfoFigureStand"), info.indexOf("export function addInfoFigureStand") + 600);
    expect(stand).not.toContain("drawHairline");
    expect(stand).not.toContain("ellipse(");
  });
});
