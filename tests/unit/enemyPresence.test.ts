import { describe, expect, it } from "vitest";
import {
  ENEMY_PRESENCE, SWARM_MINIMUM_COUNT, applyEnemyPresence, enemyPresenceBodyScale, enemyPresenceFor,
} from "../../src/data/enemyPresence";
import { getStageEnemies, getStage, stageEnemyPresence } from "../../src/data/stages";
import { cakeOperationPresence, CAKE_OPERATION_TIERS } from "../../src/data/cakeOperation";
import { getRelic } from "../../src/data/relics";

const GROWTH_KEYS = ["hp", "def", "res", "atk", "ap"] as const;

describe("무리 유형", () => {
  it("은 눈에 보이는 것만 바꾼다", () => {
    // 관문의 무게를 조이는 손잡이는 레벨과 야성 단계뿐이다 — 여기서 세기가 움직이면 화면에
    // 선 `LV.n`과 실제로 맞는 수치가 갈린다.
    const base = getRelic("toby").stats;
    for (const presence of ["normal", "elite", "swarm", "raid"] as const) {
      const shaped = applyEnemyPresence(base, presence);
      for (const key of GROWTH_KEYS) expect(shaped[key], `${presence}.${key}`).toBe(base[key]);
      for (const key of ["critChance", "critDamage", "energyGain", "lifeSteal"] as const) {
        expect(shaped[key], `${presence}.${key}`).toBe(base[key]);
      }
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

  it("에서 정예만 걸음이 빨라지고 레이드만 느려진다", () => {
    // 정예는 잘 훈련된 병사라는 인상이고, 레이드는 거대한 것을 마주한다는 인상이다.
    expect(ENEMY_PRESENCE.elite.attackSpeedPercent).toBeGreaterThan(0);
    expect(ENEMY_PRESENCE.elite.moveSpeedPercent).toBeGreaterThan(0);
    expect(ENEMY_PRESENCE.raid.attackSpeedPercent).toBeLessThan(0);
    expect(ENEMY_PRESENCE.raid.moveSpeedPercent).toBeLessThan(0);
    // 무리의 값은 빠르기가 아니라 머릿수다.
    expect(ENEMY_PRESENCE.swarm.attackSpeedPercent).toBe(0);
    expect(ENEMY_PRESENCE.swarm.moveSpeedPercent).toBe(0);
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

  it("이 정예 관문의 걸음에 실제로 얹힌다", () => {
    const stage = getStage("1-5");
    if (stage.kind !== "battle") throw new Error("전투 관문이 아니다");
    const [enemy] = getStageEnemies(stage);
    const base = getRelic(stage.enemies[0].relicId).stats;
    expect(enemy.stats.moveSpeed).toBe(Math.round(base.moveSpeed * (1 + ENEMY_PRESENCE.elite.moveSpeedPercent / 100)));
  });
});
