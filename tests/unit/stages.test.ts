import { describe, expect, it } from "vitest";
import { getRelic } from "../../src/data/relics";
import { CHAPTERS, DAILY_RESTORATION, FIXED_STAGE_ENEMIES, SIDE_STORY_STAGE, STAGES, getStage, getStageEnemies } from "../../src/data/stages";
import { isStageUnlockedByProgress } from "../../src/core/stageProgress";
import { stageChapterNavigationLayout } from "../../src/ui/stageChapterLayout";
import { BREAKTHROUGH_CAP, relicLevelCap } from "../../src/core/relicProgression";

/** 스테이지 편성과 공개 성장 설계가 콘텐츠 수정 중 흐트러지지 않도록 고정한다. */
describe("stage enemy design", () => {
  /** 판별 유니온 테스트에서 전투 데이터만 안전하게 추려낸다. */
  const battles = STAGES.filter((stage) => stage.kind === "battle");
  it("최초/반복 보상과 단일 일일 복원 3회 제한을 정적 데이터로 제공한다", () => {
    expect(battles[0].rewards).toEqual({ firstClearCheesecake: 30, repeatClearCheesecake: 10 });
    expect(DAILY_RESTORATION).toMatchObject({ id: "daily-restoration", maxEntriesPerUtcDay: 3, rewardCheesecake: 40 });
  });
  it("챕터 1의 기본 악당은 토비·아모·리파이며 1-10에서 코마가 한 자리를 교체한다", () => {
    expect(battles.slice(0, 9).every((stage) => new Set(stage.enemies.map(({ relicId }) => relicId)).size === FIXED_STAGE_ENEMIES.length)).toBe(true);
    expect(FIXED_STAGE_ENEMIES.map((id) => getRelic(id).name)).toEqual(["토비", "아모", "리파"]);
    expect(battles[9].enemies.map(({ relicId }) => getRelic(relicId).name)).toEqual(["아모", "코마", "리파"]);
  });

  it("챕터 1의 레벨·돌파 초안을 적별 StageEnemyDef에 정확히 기록한다", () => {
    // 비교표는 캐릭터별 [레벨, 돌파]로 읽어 배열 배치 변경과 독립적으로 검증한다.
    const growthAt = (index: number) => Object.fromEntries(battles[index].enemies.map(({ relicId, level, breakthrough }) => [getRelic(relicId).name, [level, breakthrough]]));
    const ladder = Array.from({ length: 10 }, (_, index) => growthAt(index));
    /*
     * **셋이 같은 레벨·같은 돌파로 선다.** 예전에는 적마다 한두 레벨씩 어긋나 있었는데, 그
     * 미세한 차이는 화면에서 읽히지 않으면서 난이도를 거꾸로 푸는 계산만 어렵게 했다.
     * 값은 `stageBalance.ts`의 성장 곡선에서 풀었다 — 1-10에서 성장 없는 파티가 정확히 막힌다.
     */
    expect(ladder).toEqual([
      { 아모: [6, 0], 토비: [6, 0], 리파: [6, 0] },
      { 아모: [9, 0], 토비: [9, 0], 리파: [9, 0] },
      { 아모: [10, 0], 토비: [10, 0], 리파: [10, 0] },
      { 아모: [11, 0], 토비: [11, 0], 리파: [11, 0] },
      { 아모: [12, 0], 토비: [12, 0], 리파: [12, 0] },
      { 아모: [13, 0], 토비: [13, 0], 리파: [13, 0] },
      { 아모: [14, 0], 토비: [14, 0], 리파: [14, 0] },
      { 아모: [15, 1], 토비: [15, 1], 리파: [15, 1] },
      { 아모: [16, 1], 토비: [16, 1], 리파: [16, 1] },
      { 아모: [17, 1], 코마: [17, 1], 리파: [17, 1] },
    ]);
    /*
     * **레벨은 관문을 따라 내려가지 않는다.** 1-10까지 마지막 관문이 직전보다 쉬운 구간이
     * 있었고(코마만 레벨 1로 남아 있었다) 그때는 이 표만 봐서는 드러나지 않았다.
     * 코마는 토비를 대신하는 다른 개체라 자기 자신끼리만 비교한다.
     */
    for (const name of ["아모", "리파"] as const) {
      const levels = ladder.map((row) => row[name][0]);
      for (let index = 1; index < levels.length; index += 1) {
        expect(levels[index], `${name} ${index + 1}번째 관문`).toBeGreaterThanOrEqual(levels[index - 1]);
      }
    }
    const tobyLevels = ladder.slice(0, 9).map((row) => row["토비"][0]);
    for (let index = 1; index < tobyLevels.length; index += 1) {
      expect(tobyLevels[index], `토비 ${index + 1}번째 관문`).toBeGreaterThanOrEqual(tobyLevels[index - 1]);
    }
    // **중간보스는 호위보다 낮은 레벨로 서지 않는다.** 마지막 관문에서 토비를 대신하는 코마가
    // 레벨 1로 남아 관문이 직전보다 쉬웠던 적이 있다(v0.77.2에서 고쳤다).
    const boss = ladder[9];
    expect(boss["코마"][0]).toBeGreaterThanOrEqual(Math.max(boss["아모"][0], boss["리파"][0]));
    /*
     * 마지막 관문의 **모든** 적이 제 태생값보다 자라 있는지 본다.
     *
     * 예전에는 토비 하나만 집어 비교했는데, 그 관문의 구성이 바뀌면(지금은 아모·폰토스·리파다)
     * 찾지 못한 개체가 `undefined`로 빠져 검사 자체가 사라진다. 구성과 무관한 검사로 바꾼다.
     */
    const finalEnemies = getStageEnemies(battles[29]);
    expect(finalEnemies).toHaveLength(3);
    for (const enemy of finalEnemies) {
      expect(enemy.stats.hp, enemy.name).toBeGreaterThan(getRelic(enemy.id).stats.hp);
    }
    expect(getRelic(FIXED_STAGE_ENEMIES[0]).stats.hp).toBe(1000);
  });

  it("1-1부터 1-10까지 재등장한 캐릭터의 레벨이나 돌파가 메타데이터 없이 역행하지 않는다", () => {
    const previous = new Map<string, { level: number; breakthrough: number; stageId: string }>();
    for (const stage of battles.slice(0, 10)) {
      for (const enemy of stage.enemies) {
        const before = previous.get(enemy.relicId);
        // 회상·분기는 스테이지 전체의 명시적 사유가 있을 때만 의도적인 회귀로 인정한다.
        if (before && stage.growthRegression === undefined) {
          expect(enemy.level, `${stage.id} ${enemy.relicId} level after ${before.stageId}`).toBeGreaterThanOrEqual(before.level);
          expect(enemy.breakthrough, `${stage.id} ${enemy.relicId} breakthrough after ${before.stageId}`).toBeGreaterThanOrEqual(before.breakthrough);
        }
        previous.set(enemy.relicId, { level: enemy.level, breakthrough: enemy.breakthrough, stageId: stage.id });
      }
    }
  });

  it("챕터 1의 연속 스테이지마다 성장·배치·캐릭터 중 관찰 가능한 차이가 있다", () => {
    // 정렬된 직렬화는 배열 작성 순서가 아니라 실제 formationSlot을 비교한다.
    const signature = (index: number) => JSON.stringify([...battles[index].enemies]
      .sort((a, b) => a.formationSlot - b.formationSlot)
      .map(({ relicId, level, breakthrough, formationSlot }) => ({ relicId, level, breakthrough, formationSlot })));
    for (let index = 1; index < 10; index += 1) expect(signature(index)).not.toBe(signature(index - 1));
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
    const allowed = ["relicId", "level", "breakthrough", "formationSlot"];
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

  it("모든 전투는 중복 없는 formationSlot 0·1·2를 가지며 그 순서로 전투 복사본을 만든다", () => {
    for (const stage of battles) {
      expect(stage.enemies.map(({ formationSlot }) => formationSlot).sort()).toEqual([0, 1, 2]);
      const expectedIds = [...stage.enemies].sort((a, b) => a.formationSlot - b.formationSlot).map(({ relicId }) => relicId);
      expect(getStageEnemies(stage).map(({ id }) => id)).toEqual(expectedIds);
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
