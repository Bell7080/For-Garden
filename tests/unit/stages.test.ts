import { describe, expect, it } from "vitest";
import { getRelic } from "../../src/data/relics";
import { CHAPTERS, DAILY_RESTORATION, FIXED_STAGE_ENEMIES, SIDE_STORY_STAGE, STAGES, getStage, getStageEnemies } from "../../src/data/stages";
import { isStageUnlockedByProgress } from "../../src/core/stageProgress";
import { stageChapterNavigationLayout } from "../../src/ui/stageChapterLayout";

/** 임시 스테이지 편성과 레벨 성장 설계가 콘텐츠 수정 중 흐트러지지 않도록 고정한다. */
describe("stage enemy design", () => {
  /** 판별 유니온 테스트에서 전투 데이터만 안전하게 추려낸다. */
  const battles = STAGES.filter((stage) => stage.kind === "battle");
  it("최초/반복 보상과 단일 일일 복원 3회 제한을 정적 데이터로 제공한다", () => {
    expect(battles[0].rewards).toEqual({ firstClearCheesecake: 30, repeatClearCheesecake: 10 });
    expect(DAILY_RESTORATION).toMatchObject({ id: "daily-restoration", maxEntriesPerUtcDay: 3, rewardCheesecake: 40 });
  });
  it("모든 스테이지에 임시 적 세 명을 챕터별 순환 편성한다", () => {
    expect(battles.every((stage) => new Set(stage.enemies).size === FIXED_STAGE_ENEMIES.length)).toBe(true);
    expect(FIXED_STAGE_ENEMIES.map((id) => getRelic(id).name)).toEqual(["토비", "아모", "리파"]);
  });

  it("스테이지마다 적 레벨을 1 올리고 원본보다 강한 복사본을 만든다", () => {
    expect(battles.map((stage) => stage.enemyLevel)).toEqual(Array.from({ length: 30 }, (_, index) => index + 1));
    const finalEnemies = getStageEnemies(battles[29]);
    expect(finalEnemies[0].stats.hp).toBeGreaterThan(getRelic(FIXED_STAGE_ENEMIES[0]).stats.hp);
    expect(getRelic(FIXED_STAGE_ENEMIES[0]).stats.hp).toBe(620);
  });

  it("세 챕터의 본편 ID 30개를 유일한 평탄 인덱스로 제공하고 알 수 없는 ID를 거부한다", () => {
    expect(CHAPTERS.map(({ stages }) => stages.length)).toEqual([10, 10, 10]);
    expect(STAGES).toHaveLength(31);
    expect(new Set(STAGES.map(({ id }) => id)).size).toBe(31);
    expect(getStage("3-10").chapterOrder).toBe(10);
    expect(() => getStage("4-1")).toThrow("알 수 없는 스테이지 id");
  });

  it("1-5 전에는 서브 서사를 잠그고 이후에는 1-6과 함께 독립적으로 연다", () => {
    expect(SIDE_STORY_STAGE).toMatchObject({ kind: "story", prerequisiteStageIds: ["1-5"] });
    expect(isStageUnlockedByProgress(STAGES, SIDE_STORY_STAGE.id, new Set(["1-4"]))).toBe(false);
    expect(isStageUnlockedByProgress(STAGES, SIDE_STORY_STAGE.id, new Set(["1-5"]))).toBe(true);
    // 서브 스토리 미완료여도 1-6은 오직 1-5만 요구한다.
    expect(isStageUnlockedByProgress(STAGES, "1-6", new Set(["1-5"]))).toBe(true);
  });

  it("배열 위치가 아닌 선행 ID로 챕터 경계를 열고 미클리어 챕터를 잠근다", () => {
    expect(isStageUnlockedByProgress(STAGES, "2-1", new Set(["1-10"]))).toBe(true);
    expect(isStageUnlockedByProgress(STAGES, "3-1", new Set(["2-10"]))).toBe(true);
    expect(isStageUnlockedByProgress(STAGES, "2-1", new Set(["1-9"]))).toBe(false);
    expect(isStageUnlockedByProgress(STAGES, "unknown", new Set())).toBe(false);
  });

  it("챕터 버튼은 모바일 하단에서 중앙 출전과 우하단 뒤로가기 영역을 피한다", () => {
    const layout = stageChapterNavigationLayout(1080, 1920);
    expect(layout.previous.x + layout.previous.width / 2).toBeLessThan(370);
    expect(layout.next.x - layout.next.width / 2).toBeGreaterThan(710);
    expect(layout.next.y + layout.next.height / 2).toBeLessThan(1700);
  });
});
