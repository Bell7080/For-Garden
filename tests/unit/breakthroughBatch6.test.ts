import { describe, expect, it } from "vitest";
import { getRelic } from "../../src/data/relics";
import { breakthroughEffectText } from "../../src/ui/skillPresentation";

describe("엘라·데이·모르페 한계 돌파", () => {
  it("돌파 효과 슬롯이 네 칸 모두 채워진다", () => {
    for (const id of ["ella", "deina", "morphe"]) {
      const effects = getRelic(id).breakthroughEffects!;
      for (const slot of ["basic", "ultimate", "ferocity", "passive"] as const) expect(effects[slot]?.kind).not.toBe("none");
    }
  });

  it("문구가 자리 표시 없이 채워진다", () => {
    for (const id of ["ella", "deina", "morphe"]) for (const slot of ["basic", "ultimate", "ferocity", "passive"] as const) {
      const text = breakthroughEffectText(getRelic(id), slot);
      expect(text).toBeTruthy();
      expect(text).not.toMatch(/\{\w+\}/);
    }
  });
});
