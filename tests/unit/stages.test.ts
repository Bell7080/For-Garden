import { describe, expect, it } from "vitest";
import { getRelic } from "../../src/data/relics";
import { DAILY_RESTORATION, FIXED_STAGE_ENEMIES, STAGES, getStageEnemies } from "../../src/data/stages";

/** 임시 스테이지 편성과 레벨 성장 설계가 콘텐츠 수정 중 흐트러지지 않도록 고정한다. */
describe("stage enemy design", () => {
  it("최초/반복 보상과 단일 일일 복원 3회 제한을 정적 데이터로 제공한다", () => {
    expect(STAGES[0].rewards).toEqual({ firstClearWeeds: 30, repeatClearWeeds: 10 });
    expect(DAILY_RESTORATION).toMatchObject({ id: "daily-restoration", maxEntriesPerUtcDay: 3, rewardWeeds: 40 });
  });
  it("모든 스테이지에 토비·아모·리파를 1·2·3번 순서로 고정한다", () => {
    expect(STAGES.every((stage) => stage.enemies.join(",") === FIXED_STAGE_ENEMIES.join(","))).toBe(true);
    expect(FIXED_STAGE_ENEMIES.map((id) => getRelic(id).name)).toEqual(["토비", "아모", "리파"]);
  });

  it("스테이지마다 적 레벨을 1 올리고 원본보다 강한 복사본을 만든다", () => {
    expect(STAGES.map((stage) => stage.enemyLevel)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const finalEnemies = getStageEnemies(STAGES[9]);
    expect(finalEnemies[0].stats.hp).toBeGreaterThan(getRelic(FIXED_STAGE_ENEMIES[0]).stats.hp);
    expect(getRelic(FIXED_STAGE_ENEMIES[0]).stats.hp).toBe(620);
  });
});
