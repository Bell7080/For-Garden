import { describe, expect, it } from "vitest";
import { archaeologySiteAvailability, clampArchaeologyCamera, isArchaeologyMapDrag, resolveArchaeologyFocusSite, rewardExpectationRating, strataRewardExpectedAmount, strataRewardProbability } from "../../src/core/archaeologyMap";
import { ARCHAEOLOGY_SITES } from "../../src/data/archaeologySites";
import { findStrataLayer, STRATA_REWARD_DISPLAY } from "../../src/data/strataLayers";

describe("archaeology map rules", () => {
  it("maps internal rewards to explicit player visibility groups", () => {
    // 빈 흙은 보상처럼 보이지 않고, 내부 연구 아이템은 획득 뒤에만 일반 이름으로 드러난다.
    expect(STRATA_REWARD_DISPLAY.empty).toEqual({ group: null, preview: false, reveal: false });
    expect(STRATA_REWARD_DISPLAY.researchItem).toEqual({ group: "researchMaterial", preview: false, reveal: true });
    expect(STRATA_REWARD_DISPLAY.rawStone.group).toBe("rawStone");
  });

  it("requires both the minimum level and prerequisite completion", () => {
    const archive = ARCHAEOLOGY_SITES.find(({ id }) => id === "sunken-archive")!;
    expect(archaeologySiteAvailability(archive, 5, []).available).toBe(false);
    expect(archaeologySiteAvailability(archive, 6, []).missingPrerequisiteIds).toEqual(["collapsed-greenhouse"]);
    expect(archaeologySiteAvailability(archive, 6, ["collapsed-greenhouse"]).available).toBe(true);
  });

  /**
   * 지도는 **외길이 아니라 그물망**이다.
   *
   * 유적이 늘어도 관문에서 한 줄로만 이어지면 지도가 목록 한 줄이고, 여섯 시간짜리 재사용
   * 대기가 걸리는 순간 갈 곳이 아예 없어진다. 관문이 여러 갈래로 벌어지는지, 선행이 둘
   * 이상인 합류점이 있는지, 그리고 **모든 연결과 선행이 실제 유적을 가리키는지**를 함께 본다.
   */
  it("branches into a web instead of a single chain", () => {
    const ids = new Set(ARCHAEOLOGY_SITES.map(({ id }) => id));
    expect(ids.size).toBe(ARCHAEOLOGY_SITES.length);
    for (const site of ARCHAEOLOGY_SITES) {
      for (const id of [...site.connectionIds, ...site.prerequisiteSiteIds]) expect(ids, `${site.id} → ${id}`).toContain(id);
      // 판 미리보기가 실제로 열리는 판과 어긋나지 않는다 — 칸 수는 지층이 소유한다.
      const layer = findStrataLayer(site.layerId)!;
      expect({ columns: layer.columns, rows: layer.rows }, site.id).toEqual(site.board);
    }
    const gate = ARCHAEOLOGY_SITES.find(({ id }) => id === "garden-gate")!;
    expect(gate.connectionIds.length).toBeGreaterThanOrEqual(3);
    expect(ARCHAEOLOGY_SITES.filter((site) => site.prerequisiteSiteIds.length > 1).length).toBeGreaterThan(0);
    // 같은 판이 나란히 서지 않도록 지층을 섞어 쓴다.
    expect(new Set(ARCHAEOLOGY_SITES.map(({ layerId }) => layerId)).size).toBeGreaterThanOrEqual(4);
  });

  it("derives relative preview gauge fill from weights and quantity ranges", () => {
    const layer = findStrataLayer("surface")!;
    expect(strataRewardProbability(layer, "rawStone")).toBeGreaterThan(strataRewardProbability(layer, "rune"));
    expect(strataRewardExpectedAmount(layer, "rawStone")).toBeGreaterThan(0);
    expect(rewardExpectationRating(layer, "rawStone").state).toBe("rated");
    expect(rewardExpectationRating(findStrataLayer("abyss")!, "rawStone").filled).toBe(5);
  });

  it("does not exaggerate unavailable or sub-one-percent rewards with a minimum filled cell", () => {
    const layer = findStrataLayer("surface")!;
    const unavailable = { ...layer, rewards: layer.rewards.map((row) => row.kind === "rune" ? { ...row, weight: { soil: 0, teal: 0, gold: 0, deep: 0 } } : row) };
    const veryRare = { ...layer, digs: 1, rewards: layer.rewards.map((row) => row.kind === "rune" ? { ...row, weight: { soil: 0.001, teal: 0.001, gold: 0.001, deep: 0.001 } } : row) };
    expect(rewardExpectationRating(unavailable, "rune", [unavailable])).toEqual({ state: "unavailable", filled: 0 });
    expect(rewardExpectationRating(veryRare, "rune", [veryRare])).toEqual({ state: "veryRare", filled: 0 });
  });

  it("clamps both camera axes to content boundaries", () => {
    expect(clampArchaeologyCamera({ x: 50, y: -900 }, { width: 1080, height: 700 }, { width: 1480, height: 1180 })).toEqual({ x: 0, y: -480 });
  });

  it("distinguishes taps from diagonal drags with cumulative distance", () => {
    expect(isArchaeologyMapDrag({ x: 0, y: 0 }, { x: 5, y: 5 }, 12)).toBe(false);
    expect(isArchaeologyMapDrag({ x: 0, y: 0 }, { x: 10, y: 10 }, 12)).toBe(true);
  });

  it("restores active, valid selected, then highest unlocked sites in priority order", () => {
    const unlocked = new Set(["garden-gate", "collapsed-greenhouse", "sunken-archive"]);
    const states = ARCHAEOLOGY_SITES.map(({ id }) => ({ siteId: id, unlocked: unlocked.has(id) }));
    // 진행 판은 잠금 정책이 바뀐 경우에도 이미 지불한 판의 위치를 잃지 않는다.
    expect(resolveArchaeologyFocusSite(ARCHAEOLOGY_SITES, states, "deep-sanctum", "garden-gate")?.id).toBe("deep-sanctum");
    expect(resolveArchaeologyFocusSite(ARCHAEOLOGY_SITES, states, undefined, "garden-gate")?.id).toBe("garden-gate");
    // 삭제된 ID와 다시 잠긴 선택은 현재 가장 높은 해금 유적으로 안전하게 복구한다.
    expect(resolveArchaeologyFocusSite(ARCHAEOLOGY_SITES, states, undefined, "removed-site")?.id).toBe("sunken-archive");
    expect(resolveArchaeologyFocusSite(ARCHAEOLOGY_SITES, states, undefined, "deep-sanctum")?.id).toBe("sunken-archive");
  });
});
