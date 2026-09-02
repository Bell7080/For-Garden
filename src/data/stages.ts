import { applyLevelGrowth } from "../core/relicProgression";
import type { ChapterDef, RelicDef, StageDef } from "../core/types";
import { getRelic } from "./relics";

/** 임시 고정 편성: 1번 토비 · 2번 아모 · 3번 리파 순서로 모든 스테이지에 등장한다. */
export const FIXED_STAGE_ENEMIES: [string, string, string] = ["husk-raptor", "husk-shell", "husk-wing"];

/**
 * 스테이지. 지도에서 아래에서 위로 올라가는 순서 그대로다.
 * 적은 언제나 3명으로 구성된다.
 */
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
    return {
      kind: "battle",
      id: `${chapter}-${chapterOrder}`, name, chapter, chapterOrder,
      // 첫 노드는 이전 챕터 끝을, 나머지는 같은 챕터의 직전 노드를 선행 조건으로 삼는다.
      prerequisiteStageIds: chapterOrder === 1 ? (prerequisiteStageId ? [prerequisiteStageId] : []) : [`${chapter}-${chapterOrder - 1}`],
      // 임시 편성도 챕터별 순환을 주어 이후 적 데이터 교체 지점을 명확히 남긴다.
      enemies: [...FIXED_STAGE_ENEMIES.slice(chapterIndex), ...FIXED_STAGE_ENEMIES.slice(0, chapterIndex)] as [string, string, string],
      enemyLevel: globalOrder + 1,
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

/** 기존 레벨당 +2% 성장 규칙을 적용하되 원본 적 데이터는 바꾸지 않는다. */
export function getStageEnemies(stage: Extract<StageDef, { kind: "battle" }>): [RelicDef, RelicDef, RelicDef] {
  return stage.enemies.map((id) => {
    const base = getRelic(id);
    return { ...base, stats: applyLevelGrowth(base.stats, stage.enemyLevel, base.rarity) };
  }) as [RelicDef, RelicDef, RelicDef];
}
