import { applyBreakthrough, applyLevelGrowth } from "../core/relicProgression";
import type { ChapterDef, RelicDef, StageDef, StageEnemyDef } from "../core/types";
import { getRelic } from "./relics";

/** 챕터 1의 기본 악당 셋은 영구 캐릭터 ID만 공유하고 성장 상태는 각 스테이지가 소유한다. */
export const FIXED_STAGE_ENEMIES = ["toby", "amo", "ripa"] as const;

/**
 * 세 적이 서는 **자리 순서**(앞 → 뒤). 모든 챕터가 같은 배치를 쓴다.
 *
 * 아모가 맨 앞이다 — 셋 중 유일한 탱커라 앞을 맡고, 종이 방어의 리파가 맨 뒤에 선다.
 * 예전에는 챕터마다 이 셋을 한 칸씩 회전시켰는데, 그러면 2·3장에서 탱커가 뒷줄로 밀려
 * 레벨을 올려도 난이도가 되지 않았다(적 Lv40에서 1-7은 잔여 2%인데 3-7은 100%였다).
 */
const STAGE_ENEMY_FORMATION = ["amo", "toby", "ripa"] as const;

/** 스테이지 난이도를 캐릭터 수치가 아닌 공개 성장 축과 검증 가능한 배치로만 표현한다. */
function enemyGrowth(relicId: string, level: number, breakthrough: number, formationSlot: 0 | 1 | 2): StageEnemyDef {
  return { relicId, level, breakthrough, formationSlot };
}

/**
 * 1장의 적 사다리. **세 마리가 같은 레벨·같은 돌파로 선다.**
 *
 * 값은 눈대중이 아니라 `src/core/stageBalance.ts`의 성장 곡선에서 거꾸로 풀었다. 스토리
 * 첫 클리어 보상만 받은 **바닥 파티**(토리카·도디·파루아 — SSR을 전제하지 않는다)를
 * 두 갈래로 세우고 —
 * 한 명에게 몰아준 쪽과 셋에게 고르게 나눈 쪽 — 둘 다 전승하는 최고 적 레벨(전멸선)을
 * 찾은 뒤, 관문 순서에 따라 그 선에 35%에서 90%까지 다가서게 했다.
 *
 * 예전 값(2~6)은 그 곡선이 없어서 **1레벨 셋이 조합만 맞추면 2-3까지 밀렸다** — 1장 내내
 * 잔여 체력이 89~96%였고, 관문이 요구하는 힘이 관문을 밀어 얻는 힘보다 느리게 자랐다.
 */
const CHAPTER_ONE_LEVELS: readonly number[] = [6, 9, 10, 11, 12, 13, 14, 15, 16, 17];

/** 1장 후반 셋만 별 둘로 서서 마지막 세 관문의 무게를 레벨이 아닌 축으로도 올린다. */
const CHAPTER_ONE_BREAKTHROUGHS: readonly number[] = [0, 0, 0, 0, 0, 0, 0, 1, 1, 1];

const CHAPTER_ONE_ENEMIES: readonly [StageEnemyDef, StageEnemyDef, StageEnemyDef][] =
  CHAPTER_ONE_LEVELS.map((level, index) => {
    const breakthrough = CHAPTER_ONE_BREAKTHROUGHS[index] ?? 0;
    // 마지막 관문만 중간보스 코마가 토비 자리를 대신한다. 호위보다 낮은 레벨로 서지 않는다.
    const ids = index === CHAPTER_ONE_LEVELS.length - 1 ? ["amo", "husk-koma", "ripa"] : ["amo", "toby", "ripa"];
    return ids.map((id, slot) => enemyGrowth(id, level, breakthrough, slot as 0 | 1 | 2)) as
      [StageEnemyDef, StageEnemyDef, StageEnemyDef];
  });

/**
 * 스테이지. 지도에서 아래에서 위로 올라가는 순서 그대로다.
 * 적은 언제나 3명으로 구성된다.
 */
/**
 * 2·3장의 적 레벨. 1장과 같은 곡선의 이어짐이며 **레벨은 끝까지 뒤로 가지 않는다.**
 *
 * 같은 레벨이 두세 관문씩 이어지는 구간이 있는 것은 그때 단조 하한이 곡선보다 높기 때문이다 —
 * 바닥 파티의 전멸선은 스토리 보상만으로 자라므로 뒤로 갈수록 천천히 오른다. 곡선을 더 크게
 * 그리려면 적 레벨이 아니라 **스토리 보상**을 키워 파티가 더 빨리 자라게 해야 한다.
 *
 * 마지막 3-10만 곡선의 연장(31 → 32)으로 적었다. 그 관문의 폰토스는 원정 최종층 개체라
 * 바닥 파티가 어떤 레벨에서도 이기지 못해 기준점이 될 수 없고, 스토리에서는 추후 뺀다.
 */
const LATER_CHAPTER_LEVELS: readonly number[] = [
  18, 19, 20, 21, 21, 21, 22, 23, 23, 24,
  25, 25, 25, 25, 26, 26, 26, 26, 26, 27,
];

const CHAPTER_CONTENT = [
  { title: "제 1 구역", subtitle: "격리 구역 — 이터널 시티 외곽", names: ["격리 구역", "붕괴한 온실", "침수된 배양실", "표본 보관고", "제1구역 관제탑", "무너진 통신소", "폐기물 처리장", "지하 배수로", "봉쇄된 정거장", "구역 경계문"] },
  { title: "제 2 구역", subtitle: "잔향 지구 — 침묵한 산업 회랑", names: ["잔향 진입로", "녹슨 조립동", "냉각 수로", "동력 중계실", "파손된 승강장", "무인 생산선", "압력 격실", "재처리 용광로", "중앙 운송로", "잔향 지구 관문"] },
  { title: "제 3 구역", subtitle: "심층 정원 — 도시 아래의 뿌리", names: ["심층 하강로", "발광 균사굴", "고대 급수원", "뿌리 관측소", "유전자 저장고", "포자 확산실", "생체 반응로", "심층 연구동", "정원 핵심부", "심층 정원 제어실"] },
] as const;

/** 챕터가 콘텐츠 소유 단위이고, 각 스테이지는 명시적인 선행 ID로 챕터 경계를 잇는다. */
export const CHAPTERS: readonly ChapterDef[] = CHAPTER_CONTENT.map((content, chapterIndex) => {
  const chapter = chapterIndex + 1;
  const prerequisiteStageId = chapter === 1 ? undefined : `${chapter - 1}-10`;
  const stages = content.names.map((name, orderIndex): StageDef => {
    const chapterOrder = orderIndex + 1;
    const globalOrder = chapterIndex * 10 + orderIndex;
    /*
     * **자리를 돌리지 않는다.** 예전에는 챕터마다 같은 셋을 한 칸씩 회전시켰는데, 그러면
     * 탱커(아모)가 뒷줄로 밀리고 종이 방어의 리파가 앞에 선다. 실제로 재 보니 3-7이 같은
     * 적 레벨에서 1-7보다 **쉬웠다** — 적 Lv40에서 1-7은 잔여 2%인데 3-7은 100%였다.
     * 앞이 무너지는 배치는 레벨을 아무리 올려도 난이도가 되지 않으므로 1장의 배치를 이어 쓴다.
     *
     * 3-10의 폰토스는 원정 최종층 개체라 스토리에서는 추후 뺀다. 난이도 기준점으로도 쓰지
     * 않았다 — 바닥 파티가 어떤 레벨에서도 이기지 못해 곡선을 그릴 수 없기 때문이다.
     */
    const laterChapterIds = chapter === 3 && chapterOrder === 10
      ? ["amo", "pontos", "ripa"]
      : [...STAGE_ENEMY_FORMATION];
    const laterChapterEnemies = laterChapterIds.map((relicId, slot) =>
      enemyGrowth(relicId, LATER_CHAPTER_LEVELS[globalOrder - 10] ?? globalOrder + 1, Math.floor(globalOrder / 10), slot as 0 | 1 | 2),
    ) as [StageEnemyDef, StageEnemyDef, StageEnemyDef];
    return {
      kind: "battle",
      id: `${chapter}-${chapterOrder}`, name, chapter, chapterOrder,
      // 첫 노드는 이전 챕터 끝을, 나머지는 같은 챕터의 직전 노드를 선행 조건으로 삼는다.
      prerequisiteStageIds: chapterOrder === 1 ? (prerequisiteStageId ? [prerequisiteStageId] : []) : [`${chapter}-${chapterOrder - 1}`],
      // 마지막 심층 관문은 원정 최종층과 같은 폰토스를 세워 등록된 보스가 스테이지에서도 고립되지 않게 한다.
      enemies: chapter === 1 ? CHAPTER_ONE_ENEMIES[orderIndex] : laterChapterEnemies,
      rewards: { firstClearCheesecake: 30 + globalOrder * 5, repeatClearCheesecake: 10 + globalOrder * 2 },
    };
  });
  return { id: chapter, title: content.title, subtitle: content.subtitle, prerequisiteStageId, stages };
});

/** 저장 검증과 전투 조회가 모든 챕터를 같은 ID 공간에서 찾도록 제공하는 평탄 인덱스다. */
/** 1-5에서 갈라지는 선택 서사는 1-6의 선행 목록에 들어가지 않아 본편을 막지 않는다. */
export const SIDE_STORY_STAGE: StageDef = {
  kind: "story", id: "1-5-side-story", name: "온실의 잔향", chapter: 1, chapterOrder: 5,
  prerequisiteStageIds: ["1-5"], storyId: "stage-1-5-greenhouse-echo",
};

/** 전투와 서브 스토리가 같은 고유 ID 공간에서 저장 검증과 지도 조회를 공유한다. */
export const STAGES: readonly StageDef[] = [...CHAPTERS.flatMap(({ stages }) => stages), SIDE_STORY_STAGE];
const STAGE_BY_ID = new Map(STAGES.map((stage) => [stage.id, stage]));

/** 대규모 던전 대신 하루 세 번만 보상을 받을 수 있는 단일 복원 훈련이다. */
export const DAILY_RESTORATION = {
  id: "daily-restoration",
  name: "일일 복원",
  maxEntriesPerUtcDay: 3,
  rewardCheesecake: 40,
} as const;

export function getStage(id: string): StageDef {
  const found = STAGE_BY_ID.get(id);
  if (!found) throw new Error(`알 수 없는 스테이지 id: ${id}`);
  return found;
}

/** 전투 전용 소비자가 스토리 노드를 실수로 편성에 넘기지 못하게 경계에서 좁힌다. */
export function getBattleStage(id: string): Extract<StageDef, { kind: "battle" }> {
  const stage = getStage(id);
  if (stage.kind !== "battle") throw new Error(`전투 스테이지가 아닌 id: ${id}`);
  return stage;
}

/** 플레이어와 같은 레벨→돌파 순서로 성장시키며 영구 캐릭터 정의는 변경하지 않는다. */
export function getStageEnemies(stage: Extract<StageDef, { kind: "battle" }>): [RelicDef, RelicDef, RelicDef] {
  // 배열을 재정렬해도 실제 전투 배치는 formationSlot이라는 데이터 계약을 따른다.
  return [...stage.enemies].sort((a, b) => a.formationSlot - b.formationSlot).map((enemy) => {
    const base = getRelic(enemy.relicId);
    const leveled = applyLevelGrowth(base.stats, enemy.level, base.rarity);
    return { ...base, stats: applyBreakthrough(leveled, enemy.breakthrough) };
  }) as [RelicDef, RelicDef, RelicDef];
}
