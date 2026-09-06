import { describe, expect, it } from "vitest";
import { getRelic } from "../../src/data/relics";
import { CHAPTERS, DAILY_RESTORATION, FIXED_STAGE_ENEMIES, SIDE_STORY_STAGE, STAGES, getStage, getStageEnemies } from "../../src/data/stages";
import { isStageUnlockedByProgress } from "../../src/core/stageProgress";
import { stageChapterNavigationLayout } from "../../src/ui/stageChapterLayout";
import { BREAKTHROUGH_CAP, relicLevelCap } from "../../src/core/relicProgression";

/** 임시 스테이지 편성과 레벨 성장 설계가 콘텐츠 수정 중 흐트러지지 않도록 고정한다. */
describe("stage enemy design", () => {
  /** 판별 유니온 테스트에서 전투 데이터만 안전하게 추려낸다. */
  const battles = STAGES.filter((stage) => stage.kind === "battle");
  it("최초/반복 보상과 단일 일일 복원 3회 제한을 정적 데이터로 제공한다", () => {
    expect(battles[0].rewards).toEqual({ firstClearCheesecake: 30, repeatClearCheesecake: 10 });
    expect(DAILY_RESTORATION).toMatchObject({ id: "daily-restoration", maxEntriesPerUtcDay: 3, rewardCheesecake: 40 });
  });
  it("모든 스테이지에 임시 적 세 명을 챕터별 순환 편성한다", () => {
    expect(battles.every((stage) => new Set(stage.enemies.map(({ relicId }) => relicId)).size === FIXED_STAGE_ENEMIES.length)).toBe(true);
    expect(FIXED_STAGE_ENEMIES.map((id) => getRelic(id).name)).toEqual(["토비", "아모", "리파"]);
  });

  it("스테이지마다 적별 레벨을 1 올리고 원본보다 강한 복사본을 만든다", () => {
    expect(battles.map((stage) => stage.enemies[0].level)).toEqual(Array.from({ length: 30 }, (_, index) => index + 1));
    const finalEnemies = getStageEnemies(battles[29]);
    expect(finalEnemies[0].stats.hp).toBeGreaterThan(getRelic(FIXED_STAGE_ENEMIES[0]).stats.hp);
    expect(getRelic(FIXED_STAGE_ENEMIES[0]).stats.hp).toBe(620);
  });

  it("같은 ID의 태생 능력치와 스킬은 언제나 영구 정의 한 곳에서 조회한다", () => {
    // 스테이지에는 ID와 허용 성장 상태만 있으므로 같은 ID가 다른 태생 정의를 가질 여지가 없다.
    for (const stage of battles) for (const enemy of stage.enemies) {
      const permanent = getRelic(enemy.relicId);
      expect(getRelic(enemy.relicId).stats).toBe(permanent.stats);
      expect(getRelic(enemy.relicId).basic.id).toBe(permanent.basic.id);
      expect(getRelic(enemy.relicId).ultimate.id).toBe(permanent.ultimate.id);
    }
  });

  it("스테이지 사이에서 허용하는 차이는 레벨과 돌파뿐이다", () => {
    const allowed = ["relicId", "level", "breakthrough"];
    for (const stage of battles) for (const enemy of stage.enemies) expect(Object.keys(enemy).sort()).toEqual([...allowed].sort());
  });

  it("전투 복사본을 만들어도 원본 RelicDef를 변경하지 않는다", () => {
    const base = getRelic(FIXED_STAGE_ENEMIES[0]);
    const before = structuredClone(base);
    const generated = getStageEnemies(battles[29]);
    expect(base).toEqual(before);
    expect(generated.find(({ id }) => id === base.id)).not.toBe(base);
    expect(generated.find(({ id }) => id === base.id)?.stats).not.toBe(base.stats);
  });

  it("모든 적의 레벨과 돌파 단계가 플레이어 성장 범위의 정수다", () => {
    for (const stage of battles) for (const enemy of stage.enemies) {
      expect(Number.isInteger(enemy.level)).toBe(true);
      expect(Number.isInteger(enemy.breakthrough)).toBe(true);
      expect(enemy.breakthrough).toBeGreaterThanOrEqual(0);
      expect(enemy.breakthrough).toBeLessThanOrEqual(BREAKTHROUGH_CAP);
      expect(enemy.level).toBeGreaterThanOrEqual(1);
      expect(enemy.level).toBeLessThanOrEqual(relicLevelCap(enemy.breakthrough));
    }
  });

  it("스테이지 정의에 임의 능력치나 스킬 덮어쓰기 필드가 없다", () => {
    const forbidden = new Set(["stats", "atkMultiplier", "hpMultiplier", "skill", "basic", "ultimate", "cooldown", "moveSpeed"]);
    for (const stage of battles) for (const enemy of stage.enemies) {
      expect(Object.keys(enemy).filter((key) => forbidden.has(key))).toEqual([]);
    }
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
