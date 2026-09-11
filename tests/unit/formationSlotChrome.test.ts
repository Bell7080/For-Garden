import { describe, expect, it } from "vitest";
import { FORMATION_SLOT_PLATE } from "../../src/ui/formationSlotStyle";

/** Node API 대신 Vite의 glob을 쓴다 — 브라우저 타입만 켜진 typecheck에서도 그대로 통과한다. */
const SOURCES = import.meta.glob("../../src/**/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

/** 같은 세 자리를 고르는 네 화면. 칸의 밑판은 어디서도 제 나름으로 그리지 않는다. */
const FORMATION_SCREENS = [
  "../../src/scenes/PartyScene.ts",
  "../../src/scenes/ExpeditionScene.ts",
  "../../src/ui/IdleExcavationPopup.ts",
  "../../src/ui/InteractionCityPopup.ts",
];

describe("편성 칸의 공용 양식", () => {
  it("은 네 화면이 모두 공용 밑판을 쓰게 한다", () => {
    const missing = FORMATION_SCREENS.filter((path) => !SOURCES[path]?.includes("addFormationSlotPlate("));
    expect(missing).toEqual([]);
  });

  it("은 네 화면이 고른 칸 표시와 빼는 표식도 함께 공유하게 한다", () => {
    const missing = FORMATION_SCREENS.filter((path) => {
      const code = SOURCES[path] ?? "";
      return !code.includes("addFormationSlotSelection(") || !code.includes("addFormationRemoveChip(");
    });
    expect(missing).toEqual([]);
  });

  it("의 밑판 값은 한 표에만 있다", () => {
    // 값이 흩어지면 같은 칸이 화면마다 다른 진하기로 보인다. 여기서 한 번 고정한다.
    expect(FORMATION_SLOT_PLATE.groundWidthRatio).toBeGreaterThan(0.5);
    expect(FORMATION_SLOT_PLATE.groundWidthRatio).toBeLessThan(1);
    expect(FORMATION_SLOT_PLATE.groundAlpha).toBeLessThan(0.3);
    expect(FORMATION_SLOT_PLATE.edgeAlpha).toBeLessThan(1);
  });
});
