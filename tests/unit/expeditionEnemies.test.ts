import { describe, expect, it } from "vitest";
import { expeditionEnemyLevel, getExpeditionEncounterEnemies, getExpeditionNodeEnemies } from "../../src/data/expeditionEnemies";

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

  it("정보판 편성은 실제 일반·정예·무리 전투 개체 수를 그대로 보여 준다", () => {
    // 미리보기만 세 칸으로 고정돼 실제 전장 수와 달라지는 회귀를 막는다.
    expect(getExpeditionEncounterEnemies("normal", 4)).toHaveLength(3);
    expect(getExpeditionEncounterEnemies("elite", 4)).toHaveLength(1);
    expect(getExpeditionEncounterEnemies("horde", 4)).toHaveLength(5);
  });
});
