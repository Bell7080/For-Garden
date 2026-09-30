import { describe, expect, it } from "vitest";
import { nextBattleStage } from "../../src/core/stageProgress";
import { STAGES } from "../../src/data/stages";

describe("다음 단계", () => {
  it("지금 관문 뒤의 첫 전투 관문 중 열린 것을 고르고, 잠겨 있으면 없다", () => {
    const first = STAGES.find((stage) => stage.kind === "battle")!;
    const next = nextBattleStage(STAGES, first.id, () => true);
    expect(next?.kind).toBe("battle");
    expect(next?.id).not.toBe(first.id);
    expect(nextBattleStage(STAGES, first.id, () => false)).toBeUndefined();
    expect(nextBattleStage(STAGES, "없는-관문", () => true)).toBeUndefined();
  });
});
