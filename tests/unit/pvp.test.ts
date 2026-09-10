import { describe, expect, it } from "vitest";
import { PVP_MODES } from "../../src/data/pvpModes";
import { PVP_RETURN_SCENE } from "../../src/ui/pvpLayout";

/** Phaser를 띄우지 않고 PvP 정적 계약을 고정한다. */
describe("PvP selection contract", () => {
  it("keeps four modes in reading order with unique ids", () => {
    expect(PVP_MODES.map(({ label }) => label)).toEqual(["결투장", "우두머리\n결정전", "대난투", "연습 훈련"]);
    expect(new Set(PVP_MODES.map(({ id }) => id)).size).toBe(4);
  });

  it("returns preview to the lobby, since the mode board is a popup and not a scene", () => {
    // 선택판이 로비 위의 판이라 상세에서 돌아갈 씬은 로비 하나뿐이다. 구형 `pvp` 씬을 되살리지
    // 않도록 이 값을 고정한다.
    expect(PVP_RETURN_SCENE).toEqual({ preview: "lobby" });
  });
});
