import { describe, expect, it } from "vitest";
import { generateExpeditionMap, validateExpeditionMap, type ExpeditionNodeType } from "../../src/core/expeditionMap";
import { expeditionNodePosition } from "../../src/ui/expeditionLayout";

/** 저장 seed로 앱 재실행을 흉내 내는 테스트 전용 결정적 RNG다. 제품 코드는 RNG를 주입받는다. */
function seededRandom(seedText: string): () => number {
  let seed = [...seedText].reduce((value, character) => Math.imul(value ^ character.charCodeAt(0), 16777619) >>> 0, 2166136261);
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x100000000);
}

/** 고정 seed 하나로 구조 불변식을 정적 회귀 케이스로 묶는다. */
const makeMap = (seed = "expedition-static-2026") => generateExpeditionMap({ seed, random: seededRandom(seed) });

describe("expedition map", () => {
  it("저장한 동일 seed를 다시 주입하면 같은 맵을 복원한다", () => expect(makeMap()).toEqual(makeMap()));

  it("20층은 모든 19층 경로가 합류하는 단일 보스다", () => {
    const map = makeMap();
    const boss = map.nodes.filter((node) => node.floor === 20);
    expect(boss).toHaveLength(1);
    expect(boss[0].type).toBe("boss");
    expect(boss[0].predecessorIds).toHaveLength(map.nodes.filter((node) => node.floor === 19).length);
  });

  it("모든 노드가 시작점에서 도달 가능하다", () => expect(validateExpeditionMap(makeMap())).toEqual([]));

  it("모든 간선은 정확히 한 층 위로만 향한다", () => {
    const map = makeMap();
    const byId = new Map(map.nodes.map((node) => [node.id, node]));
    for (const node of map.nodes) for (const id of node.successorIds) expect(byId.get(id)?.floor).toBe(node.floor + 1);
  });

  it("정의된 여섯 종류만 사용하고 보스는 마지막 노드에만 둔다", () => {
    const allowed: ExpeditionNodeType[] = ["normal", "elite", "horde", "rest", "treasure", "boss"];
    const map = makeMap();
    expect(map.nodes.every((node) => allowed.includes(node.type))).toBe(true);
    expect(map.nodes.filter((node) => node.type === "boss")).toHaveLength(1);
  });

  it("floor와 column은 1~20층 상승 순서와 좌우 열 순서를 그대로 만든다", () => {
    // 낮은 층은 월드 아래, 큰 column은 오른쪽이라는 렌더 계약을 모든 생성 층에서 검증한다.
    const map = makeMap();
    const floorY = Array.from({ length: 20 }, (_, index) => expeditionNodePosition(index + 1, 0).y);
    expect(floorY.every((y, index) => index === 0 || y < floorY[index - 1])).toBe(true);
    expect(new Set(map.nodes.map((node) => expeditionNodePosition(node.floor, node.column).y))).toHaveLength(20);
    expect(expeditionNodePosition(5, 4).x).toBeGreaterThan(expeditionNodePosition(5, 0).x);
  });
});
