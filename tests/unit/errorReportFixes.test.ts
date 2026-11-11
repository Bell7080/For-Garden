import { describe, expect, it } from "vitest";
import { isStaleChunkError, shouldReloadForStaleChunk, STALE_RELOAD_GAP_MS } from "../../src/core/staleBuild";
import { requiredBreakthroughForLevel, shownBreakthroughForLevel } from "../../src/core/levelDesign";
import { BREAKTHROUGH_STEPS } from "../../src/core/relicProgression";
import { normalizeDuelState } from "../../src/core/duelState";
import { SaveManager } from "../../src/state/SaveManager";
import { createDefaultSession } from "../../src/state/session";

describe("오류 보고에서 찾은 문제들", () => {
  it("옛 배포의 사라진 조각 오류만 알아보고, 새로 고침은 한 분 안에 되풀이하지 않는다", () => {
    expect(isStaleChunkError(new TypeError("'text/html' is not a valid JavaScript MIME type."))).toBe(true);
    expect(isStaleChunkError(new TypeError("Failed to fetch dynamically imported module: https://x/assets/a.js"))).toBe(true);
    expect(isStaleChunkError(new Error("이미 수령한 임무입니다."))).toBe(false);
    expect(shouldReloadForStaleChunk(undefined, 1_000)).toBe(true);
    expect(shouldReloadForStaleChunk(1_000, 1_000 + STALE_RELOAD_GAP_MS - 1)).toBe(false);
    expect(shouldReloadForStaleChunk(1_000, 1_000 + STALE_RELOAD_GAP_MS)).toBe(true);
  });

  it("돌파 사다리를 넘는 수호전 웨이브 레벨도 화면 돌파 등급은 던지지 않고 마지막 단계다", () => {
    const top = BREAKTHROUGH_STEPS[BREAKTHROUGH_STEPS.length - 1].requiredLevel + 10;
    expect(() => requiredBreakthroughForLevel(top + 1)).toThrow(RangeError);
    expect(shownBreakthroughForLevel(top + 1)).toBe(BREAKTHROUGH_STEPS.length);
    expect(shownBreakthroughForLevel(200)).toBe(BREAKTHROUGH_STEPS.length);
    expect(shownBreakthroughForLevel(top)).toBe(requiredBreakthroughForLevel(top));
    expect(shownBreakthroughForLevel(5)).toBe(0);
  });

  it("보유가 줄어 결투 덱에 없는 렐릭이 남아도 저장이 막히지 않고 지금 보유로 맞춰진다", () => {
    const state = createDefaultSession();
    const owned = [...state.owned];
    state.duel = { ...normalizeDuelState(undefined, owned), defense: [...owned.slice(0, 2), "not-owned-relic"], attack: ["not-owned-relic"], defenseCustomized: true };
    const saves = new SaveManager(undefined);
    const restored = saves.parse(JSON.parse(JSON.stringify(saves.exportData(state))));
    expect(restored.duel?.defense).not.toContain("not-owned-relic");
    expect(restored.duel?.attack).toEqual([]);
  });
});
