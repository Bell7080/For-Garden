import { describe, expect, it } from "vitest";
import { createSkirmish, stepSkirmish, type SkirmishEvent, type SkirmishState } from "../../src/core/skirmish";
import { getRelic } from "../../src/data/relics";

const ARENA = { left: 0, right: 600, top: 0, bottom: 1_000 };

/** 결판이 날 때까지 흘린다. 무리가 이어 붙으므로 한 판보다 넉넉히 돈다. */
function runToEnd(state: SkirmishState, seconds = 240): SkirmishEvent[] {
  const events: SkirmishEvent[] = [];
  for (let elapsed = 0; elapsed < seconds && state.phase === "fight"; elapsed += 0.05) {
    events.push(...stepSkirmish(state, 0.05, () => 0.99));
  }
  return events;
}

/**
 * 웨이브 계약 — 물량형 던전은 난전의 편당 다섯 상한을 늘리지 않고 **무리를 이어 붙여** 만든다.
 * 그래서 마지막 무리를 넘기기 전에는 승리가 서지 않고, 아군이 먼저 전멸하면 남은 무리와
 * 무관하게 패배다.
 */
describe("난전 웨이브", () => {
  it("한 무리를 비우면 다음 무리가 서고 마지막 무리에서만 승리가 선다", () => {
    const player = getRelic("rex");
    const state = createSkirmish([player, player, player], [getRelic("raitia")], ARENA, {}, {}, {
      waves: [[getRelic("raitia")], [getRelic("raitia")]],
    });
    expect(state.waves?.total).toBe(3);
    const events = runToEnd(state);
    const starts = events.flatMap((event) => event.kind === "waveStart" ? [event] : []);
    expect(starts.map(({ wave }) => wave)).toEqual([2, 3]);
    expect(starts.every(({ total }) => total === 3)).toBe(true);
    // 뒤 무리의 적도 `enemy-<n>`이 이어져야 배치 스냅샷과 어긋나지 않는다.
    expect(starts.flatMap(({ fighterIds }) => fighterIds)).toEqual(["enemy-1", "enemy-2"]);
    expect(state.phase).toBe("victory");
    // 승리는 마지막 무리를 비운 뒤에 한 번만 선다.
    expect(events.filter((event) => event.kind === "finish")).toHaveLength(1);
  });

  it("아군이 먼저 쓰러지면 남은 무리와 무관하게 패배한다", () => {
    const state = createSkirmish([getRelic("parua")], [getRelic("pontos")], ARENA, {}, {}, {
      waves: [[getRelic("pontos")], [getRelic("pontos")]],
    });
    runToEnd(state);
    expect(state.phase).toBe("defeat");
  });

  it("무리를 주지 않으면 예전처럼 한 무리로 끝난다", () => {
    const state = createSkirmish([getRelic("rex")], [getRelic("raitia")], ARENA);
    expect(state.waves).toBeUndefined();
    const events = runToEnd(state);
    expect(events.some((event) => event.kind === "waveStart")).toBe(false);
    expect(state.phase).toBe("victory");
  });
});
