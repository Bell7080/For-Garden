import { describe, expect, it } from "vitest";
import { effectiveEnemyLevel, FEROCITY_LEVEL_WEIGHT, ferocityBonusLevels } from "../../src/core/types";
import { getRelic } from "../../src/data/relics";
import { CHAPTERS, DAILY_RESTORATION, FIXED_STAGE_ENEMIES, SIDE_STORY_STAGE, STAGES, getStage, getStageEnemies } from "../../src/data/stages";
import { isStageUnlockedByProgress } from "../../src/core/stageProgress";
import { stageChapterNavigationLayout } from "../../src/ui/stageChapterLayout";
import { BREAKTHROUGH_CAP, isGrowthReachable, relicLevelCap } from "../../src/core/relicProgression";

/** 스테이지 편성과 공개 성장 설계가 콘텐츠 수정 중 흐트러지지 않도록 고정한다. */
describe("stage enemy design", () => {
  /** 판별 유니온 테스트에서 전투 데이터만 안전하게 추려낸다. */
  const battles = STAGES.filter((stage) => stage.kind === "battle");
  it("최초/반복 보상과 단일 일일 복원 3회 제한을 정적 데이터로 제공한다", () => {
    expect(battles[0].rewards).toEqual({ firstClearCheesecake: 30, repeatClearCheesecake: 10 });
    expect(DAILY_RESTORATION).toMatchObject({ id: "daily-restoration", maxEntriesPerUtcDay: 3, rewardCheesecake: 40 });
  });
  it("챕터 1의 기본 악당은 토비·아모·리파이고 1-5·1-10만 단일 정예가 대신 선다", () => {
    // 정예 관문(1-5·1-10)을 뺀 나머지 여덟 관문은 언제나 같은 셋이 선다.
    const squads = battles.slice(0, 10).filter((stage) => stage.kind === "battle" && stage.elite !== true);
    expect(squads).toHaveLength(8);
    expect(squads.every((stage) => new Set(stage.enemies.map(({ relicId }) => relicId)).size === FIXED_STAGE_ENEMIES.length)).toBe(true);
    expect(FIXED_STAGE_ENEMIES.map((id) => getRelic(id).name)).toEqual(["토비", "아모", "리파"]);
    // **정예는 혼자 선다.** 여럿 대신 하나가 나오는 것이 원정 지도의 정예 노드와 같은 문법이다.
    expect(battles[4].enemies.map(({ relicId }) => getRelic(relicId).name)).toEqual(["토비"]);
    expect(battles[9].enemies.map(({ relicId }) => getRelic(relicId).name)).toEqual(["코마"]);
    for (const index of [4, 9]) expect(battles[index].kind === "battle" && battles[index].elite, `${battles[index].id}`).toBe(true);
  });

  it("챕터 1의 레벨·돌파 초안을 적별 StageEnemyDef에 정확히 기록한다", () => {
    // 비교표는 캐릭터별 [레벨, 돌파]로 읽어 배열 배치 변경과 독립적으로 검증한다.
    // 한 줄은 [자란 레벨, 한계 돌파 단계, 야성 추가 레벨]이다 — 관문의 무게가 어느 축에서
    // 오는지 표에서 바로 읽히게 셋을 함께 적는다.
    const growthAt = (index: number) => Object.fromEntries(battles[index].enemies.map(({ relicId, level, breakthrough, ferocityLevel }) => [getRelic(relicId).name, [level, breakthrough, ferocityLevel ?? 0]]));
    const ladder = Array.from({ length: 10 }, (_, index) => growthAt(index));
    /*
     * **셋이 같은 레벨로 선다.** 예전에는 적마다 한두 레벨씩 어긋나 있었는데, 그 미세한 차이는
     * 화면에서 읽히지 않으면서 난이도를 거꾸로 푸는 계산만 어렵게 했다. 값은 `stageBalance.ts`의
     * 성장 곡선에서 풀었다 — 관문마다 바닥 파티의 전멸선에 얼마나 다가서는가로 레벨을 정하고,
     * 그 선은 실제 전투를 돌려 찾는다.
     *
     * **돌파 칸은 열 관문 모두 0이다.** 돌파는 레벨 상한(20)을 채운 뒤에만 뚫리는데 1장의 적은
     * 그 절반에도 닿지 않는다. 예전에는 마지막 셋이 돌파 1로 서서 정보창이 `LV.10 / 상한 20`과
     * 돌파 등급 II를 나란히 세웠다 — 플레이어의 손으로는 만들 수 없는 성장이다.
     *
     * **정예 관문(1-5·1-10)은 한 줄에 하나뿐이고 야성 몫이 훨씬 크다.** 셋이 나눠 내던 몫을
     * 하나가 대신하기 때문이다.
     *
     * **셋째 칸은 야성 단계이고, 능력치에 얹히는 레벨은 그 몇 배다**(`ferocityBonusLevels` —
     * 잡졸 3배, 정예 5배). 화면의 붉은 `+n`도 이 단계 그대로이며, 곱한 값은 데이터에도 화면에도
     * 나타나지 않는다 — 배율은 `getStageEnemies`가 능력치를 구하는 자리에서만 돈다.
     */
    expect(ladder).toEqual([
      { 아모: [4, 0, 1], 토비: [4, 0, 1], 리파: [4, 0, 1] },
      { 아모: [5, 0, 2], 토비: [5, 0, 2], 리파: [5, 0, 2] },
      { 아모: [6, 0, 3], 토비: [6, 0, 3], 리파: [6, 0, 3] },
      { 아모: [7, 0, 4], 토비: [7, 0, 4], 리파: [7, 0, 4] },
      { 토비: [7, 0, 20] },
      { 아모: [8, 0, 4], 토비: [8, 0, 4], 리파: [8, 0, 4] },
      { 아모: [9, 0, 4], 토비: [9, 0, 4], 리파: [9, 0, 4] },
      { 아모: [9, 0, 5], 토비: [9, 0, 5], 리파: [9, 0, 5] },
      { 아모: [10, 0, 5], 토비: [10, 0, 5], 리파: [10, 0, 5] },
      { 코마: [10, 0, 14] },
    ]);
    /*
     * **레벨은 관문을 따라 내려가지 않는다.** 1-10까지 마지막 관문이 직전보다 쉬운 구간이
     * 있었고(코마만 레벨 1로 남아 있었다) 그때는 이 표만 봐서는 드러나지 않았다.
     * 정예 관문은 다른 개체가 홀로 서는 자리라 그 개체끼리만 비교한다.
     */
    for (const name of ["아모", "리파"] as const) {
      const levels = ladder.filter((row) => name in row).map((row) => row[name][0]);
      for (let index = 1; index < levels.length; index += 1) {
        expect(levels[index], `${name} ${index + 1}번째 등장`).toBeGreaterThanOrEqual(levels[index - 1]);
      }
    }
    const tobyLevels = ladder.filter((row) => "토비" in row).map((row) => row["토비"][0]);
    for (let index = 1; index < tobyLevels.length; index += 1) {
      expect(tobyLevels[index], `토비 ${index + 1}번째 등장`).toBeGreaterThanOrEqual(tobyLevels[index - 1]);
    }
    // **정예는 직전 관문의 호위보다 가볍게 서지 않는다.** 마지막 관문의 코마가 레벨 1로 남아
    // 관문이 직전보다 쉬웠던 적이 있다(v0.77.2에서 고쳤다).
    const effectiveOf = (row: Record<string, number[]>) => Math.max(...Object.values(row).map(([level, , ferocity]) => level + ferocity));
    expect(effectiveOf(ladder[4])).toBeGreaterThan(effectiveOf(ladder[3]));
    expect(effectiveOf(ladder[9])).toBeGreaterThan(effectiveOf(ladder[8]));
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
    expect(getRelic(FIXED_STAGE_ENEMIES[0]).stats.hp).toBe(1020);
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
      .map(({ relicId, level, breakthrough, ferocityLevel, formationSlot }) => ({ relicId, level, breakthrough, ferocityLevel, formationSlot })));
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

  it("스테이지 사이에서 허용하는 차이는 레벨·돌파·야성 추가 레벨뿐이다", () => {
    // 태생 능력치나 스킬 보정을 스테이지에 두지 않는다는 계약이다. 야성 추가 레벨도 레벨과
    // 같은 성장 공식을 지나는 정수라 이 목록에 든다(스테이지 전용 배율이 아니다).
    const allowed = ["relicId", "level", "breakthrough", "ferocityLevel", "formationSlot"];
    for (const stage of battles) for (const enemy of stage.enemies) {
      expect(allowed).toEqual(expect.arrayContaining(Object.keys(enemy)));
      expect(Object.keys(enemy)).toEqual(expect.arrayContaining(["relicId", "level", "breakthrough", "formationSlot"]));
    }
  });

  /*
   * **야성 한 단계는 한 레벨이 아니다.** 같은 무게로 두었을 때는 관문을 조이는 손잡이가
   * 사실상 레벨 하나뿐이라 1장 전체가 전원 1레벨로도 밀렸다. 정예는 셋이 나눠 내던 몫을
   * 하나가 대신하는 자리라 그보다 더 크다.
   */
  it("야성 단계는 잡졸 3배·정예 5배로 레벨에 얹힌다", () => {
    expect(FEROCITY_LEVEL_WEIGHT).toEqual({ normal: 3, elite: 5 });
    expect(ferocityBonusLevels(4)).toBe(12);
    expect(ferocityBonusLevels(4, true)).toBe(20);
    // 음수는 얹지 않는다 — 야성이 레벨을 깎는 축이 되면 관문이 거꾸로 가벼워진다.
    expect(ferocityBonusLevels(-3)).toBe(0);
  });

  /*
   * **곱한 결과는 숨기지 않는다.** 스테이지 데이터에 들어가는 `ferocityLevel`이 이미 곱해진
   * 값이라, 화면의 붉은 `+n`과 실제로 자란 몫이 언제나 같은 수다. 단계를 그대로 적어 두고
   * 성장할 때만 곱하면 화면이 보여 준 수와 맞는 수가 갈린다.
   */
  it("스테이지가 들고 다니는 야성 값은 곱하기 전의 단계다", () => {
    const elite = battles.find((stage) => stage.id === "1-10")!;
    expect(elite.elite).toBe(true);
    // 화면의 붉은 `+n`이 읽는 값이라 단계 그대로 서 있어야 한다 — 곱한 값을 여기 적으면
    // `LV.10 +110`이 되어 야성이 레벨과 나란히 읽힌다.
    expect(elite.enemies[0].ferocityLevel).toBe(14);
    expect(effectiveEnemyLevel(elite.enemies[0], true)).toBe(elite.enemies[0].level + 70);
    // 정예 배율은 그 관문에만 든다. 같은 값이라도 잡졸로 세면 세 배다.
    expect(effectiveEnemyLevel(elite.enemies[0])).toBe(elite.enemies[0].level + 42);
    const mob = battles.find((stage) => stage.id === "1-9")!;
    expect(mob.enemies[0].ferocityLevel).toBe(5);
    expect(effectiveEnemyLevel(mob.enemies[0])).toBe(mob.enemies[0].level + 15);
  });

  it("야성 추가 레벨은 0 이상의 정수이고 실효 레벨은 관문 순서를 따라 내려가지 않는다", () => {
    let previous = 0;
    for (const stage of battles) {
      for (const enemy of stage.enemies) {
        const bonus = enemy.ferocityLevel ?? 0;
        expect(Number.isInteger(bonus)).toBe(true);
        expect(bonus).toBeGreaterThanOrEqual(0);
      }
      /*
       * 실효 레벨(자란 레벨 + 야성)이 뒤로 가면 새 구역이 직전 구역보다 약해 곡선이 끊긴다.
       *
       * **정예 관문은 이 사다리 밖이다.** 셋이 나눠 내던 몫을 하나가 대신하므로 그 자리만
       * 야성이 스무 단계씩 솟는데, 그 수를 잡졸의 줄에 끼워 비교하면 다음 관문이 언제나
       * "약해졌다"로 읽힌다. 정예가 직전 관문보다 무거운지는 위의 사다리 표가 따로 지킨다.
       */
      if (stage.kind === "battle" && stage.elite === true) continue;
      const effective = Math.max(...stage.enemies.map((enemy) => effectiveEnemyLevel(enemy, stage.elite === true)));
      expect(effective, stage.id).toBeGreaterThanOrEqual(previous);
      previous = effective;
    }
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

  /*
   * **화면이 만들 수 없는 성장을 가르치지 않는다.**
   *
   * 돌파는 레벨 상한을 채운 뒤에만 뚫린다. 그런데 2장은 돌파 1, 3장은 돌파 2로 서 있었고 그
   * 레벨은 10~18이라 상한 20을 한 번도 채운 적이 없다 — 정보창이 `LV.10 / 상한 20`과 돌파
   * 등급 III를 나란히 세우던 자리다. 어느 관문이 어긋났는지 바로 보이도록 목록으로 비교한다.
   */
  it("적의 레벨과 돌파는 플레이어가 실제로 지날 수 있는 자리에만 선다", () => {
    const unreachable = battles.flatMap((stage) => stage.enemies
      .filter(({ level, breakthrough }) => !isGrowthReachable(level, breakthrough))
      .map(({ relicId, level, breakthrough }) => `${stage.id} ${relicId} LV.${level}/돌파${breakthrough}`));
    expect(unreachable).toEqual([]);
  });

  it("모든 전투는 중복 없는 formationSlot 0·1·2를 가지며 그 순서로 전투 복사본을 만든다", () => {
    for (const stage of battles) {
      const slots = stage.enemies.map(({ formationSlot }) => formationSlot);
      // 셋이 서면 0·1·2를 나눠 갖고, 정예가 홀로 서면 가운데(1) 한 자리만 쓴다.
      expect([...slots].sort(), stage.id).toEqual(stage.enemies.length === 1 ? [1] : [0, 1, 2]);
      expect(new Set(slots).size, stage.id).toBe(slots.length);
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
