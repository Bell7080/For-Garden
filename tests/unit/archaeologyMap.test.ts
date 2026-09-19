import { describe, expect, it } from "vitest";
import { archaeologySiteAvailability, clampArchaeologyCamera, isArchaeologyMapDrag, rewardStarRating, strataRewardProbability } from "../../src/core/archaeologyMap";
import { ARCHAEOLOGY_SITES } from "../../src/data/archaeologySites";
import { findStrataLayer } from "../../src/data/strataLayers";

describe("archaeology map rules", () => {
  it("requires both the minimum level and prerequisite completion", () => {
    const archive = ARCHAEOLOGY_SITES[1];
    expect(archaeologySiteAvailability(archive, 5, []).available).toBe(false);
    expect(archaeologySiteAvailability(archive, 6, []).missingPrerequisiteIds).toEqual(["garden-gate"]);
    expect(archaeologySiteAvailability(archive, 6, ["garden-gate"]).available).toBe(true);
  });

  it("derives preview stars from the layer reward weights", () => {
    const layer = findStrataLayer("surface")!;
    expect(strataRewardProbability(layer, "rawStone")).toBeGreaterThan(strataRewardProbability(layer, "rune"));
    expect(rewardStarRating(layer, "rawStone")).toBeGreaterThan(rewardStarRating(layer, "rune"));
  });

  it("clamps both camera axes to content boundaries", () => {
    expect(clampArchaeologyCamera({ x: 50, y: -900 }, { width: 1080, height: 700 }, { width: 1480, height: 1180 })).toEqual({ x: 0, y: -480 });
  });

  it("distinguishes taps from diagonal drags with cumulative distance", () => {
    expect(isArchaeologyMapDrag({ x: 0, y: 0 }, { x: 5, y: 5 }, 12)).toBe(false);
    expect(isArchaeologyMapDrag({ x: 0, y: 0 }, { x: 10, y: 10 }, 12)).toBe(true);
  });
});
