import { applyBreakthrough } from "../core/relicProgression";
import { registerDataText } from "../i18n";
import { applyEncounterScaling, encounterEnemyLevel, encounterRoleFor, type EncounterRole } from "../core/levelDesign";
import { type ChapterDef, type RelicDef, type StageDef, type StageEnemyDef } from "../core/types";
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
 * **스토리의 권장 레벨 사다리 — 서른 관문에 하나씩.**
 *
 * 그 관문에 닿은 사람이 대략 몇 레벨인가이고, 적 레벨은 여기에 **유형 차 하나**만 더해서
 * 나온다(`encounterEnemyLevel` — 잡졸 +0, 정예 +3). 예전에는 자란 레벨과 야성 단계 두 표가
 * 있었고 야성이 잡졸 ×3 · 정예 ×5로 얹혀, 화면의 `LV.7 +20`이 실제로는 107레벨이었다.
 *
 * **한계 돌파 사다리 위에 놓는다.** 돌파 0의 상한은 20이고 한 단계마다 30·40·50·60으로
 * 열리므로(`BREAKTHROUGH_STEPS`), 1장은 상한 20 안에서 끝나고 2장 중반부터 1단계, 3장이
 * 2~3단계를 전제한다 — 상한을 넘는 레벨을 권장으로 적으면 그 관문은 "더 키우면 된다"가
 * 아니라 **막힌 문**이 된다.
 *
 * **뒤로 가지 않는다.** 같은 수가 이어지는 구간은 있어도 내려가는 자리는 없다 — 장을 넘는
 * 순간 적이 약해지면 그때까지 쌓은 긴장이 풀린다.
 */
const STORY_RECOMMENDED_LEVELS: readonly number[] = [
  7, 8, 10, 11, 13, 15, 16, 18, 19, 20,
  23, 24, 26, 27, 29, 30, 32, 33, 35, 36,
  36, 37, 38, 39, 40, 41, 42, 43, 44, 45,
];

/**
 * **단일 정예 관문.** 그 자리에는 셋 대신 하나가 선다.
 *
 * 1-5는 방벽을 뜯고 혼자 남은 토비, 1-10은 공멸 선봉 코마다. **혼자 서는 만큼 무겁다** —
 * 셋이 나눠 내던 체력을 하나가 대신하는 몫은 유형 표(`ENCOUNTER_ROLE.elite`)가 갖고, 이
 * 표는 어느 자리가 정예인지만 적는다.
 */
const CHAPTER_ONE_ELITES: Readonly<Record<number, { relicId: string; recommended: number }>> = {
  5: { relicId: "toby", recommended: 16 },
  10: { relicId: "koma", recommended: 14 },
};

/**
 * 1장의 적 편성. 정예 관문만 하나가 서고 나머지는 같은 셋이 같은 자리에 선다.
 *
 * **돌파는 어느 관문에도 없다.** 돌파는 레벨 상한(20)을 채운 뒤에만 뚫리는데 1장의 적은
 * 열 관문 내내 그 절반에도 닿지 않는다 — 그런데도 마지막 셋이 돌파 1로 서 있어, 정보창이
 * `LV.10 / 상한 20`과 돌파 등급 II를 나란히 세웠다. 플레이어가 만들 수 없는 성장을 화면이
 * 가르치는 자리라, 그 축을 걷어 내고 무게는 레벨과 야성 둘로만 낸다.
 */
const CHAPTER_ONE_ENEMIES: readonly (readonly StageEnemyDef[])[] =
  STORY_RECOMMENDED_LEVELS.slice(0, 10).map((recommended, index) => {
    const chapterOrder = index + 1;
    const elite = CHAPTER_ONE_ELITES[chapterOrder];
    // 홀로 서는 정예는 가운데 자리(1)를 쓴다 — 왼쪽 끝에 세우면 빈 두 자리가 편성 실수처럼 보인다.
    if (elite) return [enemyGrowth(elite.relicId, encounterEnemyLevel(elite.recommended, "elite"), 0, 1)];
    return STAGE_ENEMY_FORMATION.map((id, slot) =>
      enemyGrowth(id, encounterEnemyLevel(recommended, "normal"), 0, slot as 0 | 1 | 2));
  });

/**
 * 스테이지. 지도에서 아래에서 위로 올라가는 순서 그대로다.
 * 적은 셋이 기본이고 **정예 관문만 하나**다(`CHAPTER_ONE_ELITES`).
 */

/**
 * 관문 한 줄(`BattleStageDef.situation`).
 *
 * **예고편이 아니라 진행 상황이다.** 1장은 수송 열차 피습 하나가 이어지는 장면이라
 * (`docs/lore.md` §6) 관문마다 독립된 예고를 쓰면 열 편의 단편이 된다. 그래서 각 줄은
 * "이번 화에 이런 일이"가 아니라 **"지금 어디까지 왔는가"**를 적는다.
 *
 * 서사가 아직 정해지지 않은 장은 빈 배열로 둔다 — 없는 줄은 화면이 그리지 않는다.
 */
const CHAPTER_SITUATIONS: readonly (readonly string[])[] = [
  [
    "불타는 객차에서 빠져나왔다. 도시는 아직 멀다.",
    "추격조가 깨진 유리 지붕을 밟고 내려온다.",
    "물에 잠긴 배양조 사이로 발소리가 흩어진다.",
    "부서진 진열장마다 같은 손자국이 남아 있다.",
    "관제탑 문을 뜯어낸 것이 아직 그 앞에 혼자 서 있다.",
    "구조 신호를 보내려면 무너진 안테나부터 되살려야 한다.",
    "폐기된 것들이 일어나 길을 막는다.",
    "코마의 흔적이 배수로 아래로 이어진다.",
    "봉쇄문 너머에서 무언가가 기다리고 있다.",
    "경계문 앞. 코마가 홀로 길을 막고 서 있다.",
  ],
  [],
  [],
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
    /*
     * **돌파는 적지 않는다.** 예전에는 장 번호를 그대로 돌파 단계로 썼는데(2장 1단계·3장 2단계),
     * 그 레벨은 10~18이라 상한 20을 채운 적이 없다 — 플레이어의 손으로는 만들 수 없는 성장이다.
     * 관문의 무게는 레벨과 야성 둘로만 낸다.
     */
    const laterChapterEnemies = laterChapterIds.map((relicId, slot) =>
      enemyGrowth(relicId, encounterEnemyLevel(STORY_RECOMMENDED_LEVELS[globalOrder] ?? 1, "normal"), 0, slot as 0 | 1 | 2));
    const enemies = chapter === 1 ? CHAPTER_ONE_ENEMIES[orderIndex] : laterChapterEnemies;
    return {
      kind: "battle",
      id: `${chapter}-${chapterOrder}`, name, chapter, chapterOrder,
      // 첫 노드는 이전 챕터 끝을, 나머지는 같은 챕터의 직전 노드를 선행 조건으로 삼는다.
      prerequisiteStageIds: chapterOrder === 1 ? (prerequisiteStageId ? [prerequisiteStageId] : []) : [`${chapter}-${chapterOrder - 1}`],
      // 마지막 심층 관문은 원정 최종층과 같은 폰토스를 세워 등록된 보스가 스테이지에서도 고립되지 않게 한다.
      enemies,
      // 혼자 서면 정예다. 화면은 이 표식으로 몸집과 표식만 바꾸고 수치는 건드리지 않는다.
      ...(enemies.length === 1 ? { elite: true as const } : {}),
      rewards: { firstClearCheesecake: 30 + globalOrder * 5, repeatClearCheesecake: 10 + globalOrder * 2 },
      // 아직 서사가 없는 장은 이 값이 비어 있고, 화면은 그 줄을 그리지 않는다.
      situation: CHAPTER_SITUATIONS[chapterIndex]?.[orderIndex],
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

/**
 * 그 관문의 적을 **전투에 서는 자리 순서**로 편다.
 *
 * 정렬을 호출부마다 되풀이하면 한 곳이 빠뜨렸을 때 성장 스냅샷과 능력치 사본이 서로 다른
 * 개체를 가리킨다 — 화면은 아모의 레벨을 리파에게 적어 준다.
 */
export function stageEnemyGrowth(stage: Extract<StageDef, { kind: "battle" }>): readonly StageEnemyDef[] {
  return [...stage.enemies].sort((a, b) => a.formationSlot - b.formationSlot);
}

/**
 * 그 관문의 적이 **어떤 무리로 서는가**.
 *
 * 화면(전투·편성 미리보기·노드 정보창)과 성장이 같은 한 줄을 읽어야 미리 본 크기와 실제로
 * 선 크기가 갈리지 않는다.
 */
export function stageEnemyRole(stage: Extract<StageDef, { kind: "battle" }>): EncounterRole {
  return encounterRoleFor(stage.enemies.length, { elite: stage.elite === true });
}

/** 플레이어와 같은 레벨→돌파 순서로 성장시키며 영구 캐릭터 정의는 변경하지 않는다. */
export function getStageEnemies(stage: Extract<StageDef, { kind: "battle" }>): RelicDef[] {
  const role = stageEnemyRole(stage);
  // 배열을 재정렬해도 실제 전투 배치는 formationSlot이라는 데이터 계약을 따른다.
  return stageEnemyGrowth(stage).map((enemy) => {
    const base = getRelic(enemy.relicId);
    // 레벨로 자라고 유형으로 몫을 받는다. 스테이지 전용 배율은 만들지 않는다.
    return { ...base, stats: applyBreakthrough(applyEncounterScaling(base.stats, enemy.level, role), enemy.breakthrough) };
  });
}

/** 장 제목과 스테이지 이름, 상황 문구를 언어별로 덮어쓸 수 있게 등록한다. */
for (const chapter of CHAPTERS) {
  registerDataText(chapter, "title", `chapter.${chapter.id}.title`);
  registerDataText(chapter, "subtitle", `chapter.${chapter.id}.subtitle`);
  for (const stage of chapter.stages) {
    registerDataText(stage, "name", `stage.${stage.id}.name`);
    registerDataText(stage, "situation", `stage.${stage.id}.situation`);
  }
}

/** 곁가지 스테이지와 일일 복원의 이름도 함께 등록한다. */
registerDataText(SIDE_STORY_STAGE, "name", `stage.${SIDE_STORY_STAGE.id}.name`);
registerDataText(DAILY_RESTORATION, "name", "stage.dailyRestoration.name");
