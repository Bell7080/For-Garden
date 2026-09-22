import { describe, expect, it } from "vitest";
import { ENEMY_PRESENCE, SWARM_MINIMUM_COUNT, enemyPresenceBodyScale, enemyPresenceFor } from "../../src/data/enemyPresence";
import { getStageEnemies, getStage, stageEnemyPresence } from "../../src/data/stages";
import { cakeOperationPresence, CAKE_OPERATION_TIERS } from "../../src/data/cakeOperation";
import { getRelic } from "../../src/data/relics";

describe("무리 유형", () => {
  it("은 몸집 말고는 아무것도 갖지 않는다", () => {
    /*
     * 관문의 무게를 조이는 손잡이는 레벨 축 하나다 — 유형이 수치를 하나라도 만지면 그것이
     * 두 번째 손잡이가 되고, 같은 태그를 단 다음 개체가 저도 모르게 그 몫을 함께 받는다.
     * 정예에 공속·이속 5%를 얹어 봤을 때 1장의 정예 둘이 모든 조합을 막은 것이 그 예다.
     */
    for (const presence of ["normal", "elite", "swarm", "raid"] as const) {
      expect(Object.keys(ENEMY_PRESENCE[presence]), presence).toEqual(["bodyScale"]);
    }
  });

  it("은 넷부터 무리로 센다", () => {
    expect(SWARM_MINIMUM_COUNT).toBe(4);
    expect(enemyPresenceFor(3)).toBe("normal");
    expect(enemyPresenceFor(4)).toBe("swarm");
    // 정예와 레이드는 머릿수가 아니라 자리가 정한다 — 둘 다 혼자 선다.
    expect(enemyPresenceFor(1, { elite: true })).toBe("elite");
    expect(enemyPresenceFor(1, { raid: true })).toBe("raid");
    expect(enemyPresenceFor(6, { raid: true })).toBe("raid");
  });

  it("의 몸집은 무리 < 보통 < 정예 < 레이드 순이다", () => {
    const { swarm, normal, elite, raid } = ENEMY_PRESENCE;
    expect(swarm.bodyScale).toBeLessThan(normal.bodyScale);
    expect(normal.bodyScale).toBeLessThan(elite.bodyScale);
    expect(elite.bodyScale).toBeLessThan(raid.bodyScale);
    expect(enemyPresenceBodyScale("raid")).toBe(raid.bodyScale);
  });

  it("을 관문과 대작전이 같은 규칙으로 고른다", () => {
    const elite = getStage("1-5");
    if (elite.kind !== "battle") throw new Error("전투 관문이 아니다");
    expect(stageEnemyPresence(elite)).toBe("elite");
    const normal = getStage("1-1");
    if (normal.kind !== "battle") throw new Error("전투 관문이 아니다");
    expect(stageEnemyPresence(normal)).toBe("normal");
    // 대작전은 떼로 몰려오는 콘텐츠라 어느 단계든 무리다.
    for (const tier of CAKE_OPERATION_TIERS) expect(cakeOperationPresence(tier), tier.id).toBe("swarm");
  });

  it("이 성장에는 한 글자도 섞이지 않는다", () => {
    // 정예 관문의 적은 자란 레벨 그대로다 — 유형은 그리는 크기만 정한다.
    const stage = getStage("1-5");
    if (stage.kind !== "battle") throw new Error("전투 관문이 아니다");
    const [enemy] = getStageEnemies(stage);
    const base = getRelic(stage.enemies[0].relicId).stats;
    expect(enemy.stats.moveSpeed).toBe(base.moveSpeed);
    expect(enemy.stats.attackSpeed).toBe(base.attackSpeed);
  });
});
