import { describe, expect, it } from "vitest";
import { expeditionEnemyLevel, getExpeditionNodeEnemies } from "../../src/data/expeditionEnemies";

describe("원정 노드 적 편성", () => {
  it("정보창과 전투가 소비할 노드별 순서와 성장 수치를 함께 만든다", () => {
    const normal = getExpeditionNodeEnemies("normal", 4);
    const elite = getExpeditionNodeEnemies("elite", 4);

    expect(normal.map(({ id }) => id)).toEqual(["husk-raptor", "husk-shell", "husk-wing"]);
    expect(elite.map(({ id }) => id)).toEqual(["husk-shell", "husk-raptor", "husk-wing"]);
    expect(expeditionEnemyLevel("elite", 4)).toBe(7);
    // 같은 원본도 더 높은 조우 레벨에서는 실제 전투 수치가 함께 높아져야 한다.
    expect(elite[1].stats.hp).toBeGreaterThan(normal[0].stats.hp);
  });
});
