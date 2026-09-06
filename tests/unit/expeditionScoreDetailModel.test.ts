import { describe, expect, it } from "vitest";
import type { SubmitExpeditionBossScoreResponse } from "../../src/api/contracts";
import { expeditionScoreDetailModel } from "../../src/ui/expeditionScoreDetailModel";

/** Phaser 없이 최종 영수증의 구성값 보존과 합계 불변식을 함께 고정한다. */
describe("expedition score detail model", () => {
  it("서버 구성값을 재계산 없이 보존하며 두 구성값의 합이 최종 점수와 일치한다", () => {
    const receipt = {
      weekKey: "2026-08-31", score: 38_000, normalNodeScoreTotal: 25_655,
      bossDamageScore: 12_345, runScore: 38_000, bestScore: 38_000,
      cumulativeScore: 92_000, improved: true, endedAtMs: 90_000,
      rankBefore: 7, rankAfter: 3,
    } satisfies SubmitExpeditionBossScoreResponse;

    const detail = expeditionScoreDetailModel(receipt);

    expect(detail).toEqual({ normalNodeScoreTotal: 25_655, bossDamageScore: 12_345, runScore: 38_000 });
    expect(detail.normalNodeScoreTotal + detail.bossDamageScore).toBe(detail.runScore);
  });
});
