import { applyBreakthrough } from "../core/relicProgression";
import { registerDataText } from "../i18n";
import { applyEncounterScaling, encounterRoleFor, requiredBreakthroughForLevel, type EncounterRole } from "../core/levelDesign";
import { type BattleStageDef, type ChapterDef, type RelicDef, type StageBonusReward, type StageDef, type StageEnemyDef } from "../core/types";
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
 * 그 관문에 닿은 사람이 대략 몇 레벨인가이고, **적 레벨이 곧 이 수다.** 예전에는 자란 레벨과
 * 야성 단계 두 표가 있었고 야성이 잡졸 ×3 · 정예 ×5로 얹혀, 화면의 `LV.7 +20`이 실제로는
 * 107레벨이었다. 그다음에는 유형마다 레벨을 얹었는데 그것도 같은 병이었다 — 1-5 정예가
 * LV.19인데 1-6 잡졸이 LV.15라, 사다리를 오르는 동안 수가 뒤로 갔다.
 *
 * **한계 돌파 사다리 위에 놓는다.** 돌파 0의 상한은 20이고 한 단계마다 30·40·50·60으로
 * 열리므로(`BREAKTHROUGH_STEPS`), 1장은 상한 20 안에서 끝나고 2장 중반부터 1단계, 3장이
 * 2~3단계를 전제한다 — 상한을 넘는 레벨을 권장으로 적으면 그 관문은 "더 키우면 된다"가
 * 아니라 **막힌 문**이 된다.
 *
 * **뒤로 가지 않는다.** 같은 수가 이어지는 구간은 있어도 내려가는 자리는 없다 — 장을 넘는
 * 순간이든 정예 관문을 지난 순간이든, 적 레벨이 내려가면 그때까지 쌓은 긴장이 풀린다.
 * **정예 관문도 이 한 사다리를 그대로 쓴다**(`CHAPTER_ONE_ELITES`) — 그 자리가 무거운 것은
 * 혼자 서기 때문이고, 그 몫은 레벨이 아니라 유형 배수가 갖는다.
 */
const STORY_RECOMMENDED_LEVELS: readonly number[] = [
  // 1-1은 오프닝에서 곧장 들어오는 첫 전투라 막 시작한 레벨 1 편성이 넘어야 한다 — 7이던 때는
  // 아슬아슬했고 3이던 때는 싸움이 되지 않았다. 5는 1-2(8)와의 턱도 크지 않다.
  // 사다리는 여기서부터 오르기만 한다. 1-3~2-2는 검수를 실제 전장 크기로 옮기며(v0.172.6) 한 뼘씩
  // 올렸다 — 넓은 틀에서 재던 때는 같은 관문이 실제보다 훨씬 어렵게 읽혀 사다리가 낮게 잡혀 있었다.
  5, 8, 11, 13, 17, 17, 18, 19, 20, 20,
  // 2장은 21~30 — 돌파 1단계(상한 30) 안에서 끝난다. 1장 끝(20)에서 한 칸씩 오르는 곡선이다.
  21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
  36, 37, 38, 39, 40, 41, 42, 43, 44, 47,
];

/**
 * **단일 정예 관문.** 그 자리에는 셋 대신 하나가 선다.
 *
 * 1-5는 방벽을 뜯고 혼자 남은 토비, 1-10은 공멸 선봉 코마다. **혼자 서는 만큼 무겁다** —
 * 셋이 나눠 내던 체력을 하나가 대신하는 몫은 유형 표(`ENCOUNTER_ROLE.elite`)가 갖고, 이
 * 표는 **어느 자리에 누가 서는지만** 적는다. 레벨은 위 사다리 그대로다 — 정예에만 제
 * 권장 레벨을 따로 적던 때는 1-5가 LV.19, 바로 다음 1-6이 LV.15로 내려앉았다.
 */
const CHAPTER_ONE_ELITES: Readonly<Record<number, string>> = {
  5: "toby",
  10: "koma",
};

/**
 * **2·3장 후반의 변칙 편성.** 적어 두지 않은 관문은 기본 셋(`STAGE_ENEMY_FORMATION`)이다.
 *
 * - 2-7·2-9는 **정예 둘**이다 — 새 유형을 만들지 않고 같은 정예 자리에 둘이 서며, 체력 몫은 둘이 나눠 갖는다
 *   (`encounterHpShare`). 레벨 사다리는 그대로다.
 * - 3-5는 부부대장 아트라가 혼자 서는 정예, 3-10은 행동대장 이카닉시아가 혼자 서는 장 마감 정예, 3-6~3-9는 회수조 셋이다. 3-6·3-7은 아트라 앞 · 미르 가운데 ·
 *   펄시 뒤의 공격조이고, 3-8부터 네우리가 뒤에 서서 치유와 공명으로 받치며 가운데가 펄시로 바뀐다.
 *   네우리가 일찍 서면 바닥 파티가 3-7을 열었다(여덟 판 중 한 판) — 3장은 완전히 닫혀 있어야 해서 늦췄다.
 * 3-1~3-4(옛 셋)는 그대로다.
 */
const LATE_CHAPTER_FORMATIONS: Readonly<Record<string, readonly (readonly [string, 0 | 1 | 2])[]>> = {
  "2-7": [["amo", 0], ["ripa", 2]],
  "2-9": [["amo", 0], ["toby", 1]],
  "3-5": [["atra", 1]],
  "3-6": [["atra", 0], ["mir", 1], ["pulsi", 2]],
  "3-7": [["atra", 0], ["mir", 1], ["pulsi", 2]],
  "3-8": [["atra", 0], ["pulsi", 1], ["neuri", 2]],
  "3-9": [["atra", 0], ["pulsi", 1], ["neuri", 2]],
  "3-10": [["ikanixia", 1]],
};

/** 정예 둘이 서는 관문. 하나만 서는 정예는 적 수로 가른다. */
const ELITE_DUO_STAGE_IDS: ReadonlySet<string> = new Set(["2-7", "2-9"]);

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
    const eliteId = CHAPTER_ONE_ELITES[chapterOrder];
    // 홀로 서는 정예는 가운데 자리(1)를 쓴다 — 왼쪽 끝에 세우면 빈 두 자리가 편성 실수처럼 보인다.
    if (eliteId) return [enemyGrowth(eliteId, recommended, 0, 1)];
    return STAGE_ENEMY_FORMATION.map((id, slot) => enemyGrowth(id, recommended, 0, slot as 0 | 1 | 2));
  });

/**
 * 스테이지. 지도에서 아래에서 위로 올라가는 순서 그대로다.
 * 적은 셋이 기본이고 **정예 관문만 하나**다(`CHAPTER_ONE_ELITES`).
 */

/**
 * 룬이 나오는 자리 — **장마다 두 번, 고급·희귀만.**
 *
 * **1-5가 처음이다** — 첫 관문부터 룬을 쥐여 주면 급여·편성을 겨우 익히는 동안 세공·장착까지
 * 한꺼번에 밀려온다. 첫 정예를 넘은 상으로 **특성 없는** 고급 룬 하나를 쥐고, 장을 닫는 1-10에서
 * **특성이 확정으로 붙은** 룬을 받아 그때 특성이라는 것을 처음 본다(원석이 2장부터 나오는 이유다).
 * 뒤의 장도 같은 박자(중간 하나 · 장의 끝 하나 + 특성)이고, 조각은 1→2→3번을 돌아 한 벌이 두 장에 걸쳐 찬다.
 *
 * **영웅·전설은 두지 않는다.** 여기는 룬을 알려 주는 자리이지 주 수급처가 아니다 — 고고학·교환이
 * 그 몫이고, 더 높은 등급은 뒤쪽 장(8·9장)에서 연다.
 */
const STORY_RUNE_REWARDS: Readonly<Record<string, Extract<StageBonusReward, { kind: "rune" }>>> = {
  "1-5": { kind: "rune", rarity: "uncommon", part: 0 },
  "1-10": { kind: "rune", rarity: "uncommon", part: 1, trait: true },
  "2-5": { kind: "rune", rarity: "uncommon", part: 2 },
  "2-10": { kind: "rune", rarity: "rare", part: 0, trait: true },
  "3-5": { kind: "rune", rarity: "rare", part: 1 },
  "3-10": { kind: "rune", rarity: "rare", part: 2, trait: true },
};

/**
 * 원석이 나오는 자리 — **맛보기로 가끔, 조금씩.**
 *
 * 원석의 주 수급처는 고고학(지층 탐사 한 판에 수십~백여 개)이다. 스토리는 1-10에서 특성 붙은 룬을
 * 받은 사람에게 "이런 재료가 있다"만 알려 주는 자리라, 장마다 두 번만 한 줌씩 준다 — 첫 줌은 특성을
 * 처음 본 바로 다음 관문(2-1)이다. 관문마다 주면 고고학을 파러 갈 이유가 흐려진다.
 */
const STORY_RAW_STONE: Readonly<Record<string, number>> = {
  "2-1": 30,
  "2-6": 40,
  "3-1": 50,
  "3-6": 60,
};

/**
 * 치즈케이크 밖의 초회 보상.
 *
 * **바탕은 골드·치즈케이크·젬 셋이다.** 나머지는 제 이야기가 시작되는 자리에서만 붙는다.
 * - **골드**는 관문이 깊을수록 늘고, 무거운 자리(정예·장의 끝)는 두 배다.
 * - **젬**은 매 관문 조금, 무거운 자리에서 크게 — 장 하나가 연구 두어 번 몫이다.
 * - **원석**은 2장부터 장마다 두 번만 맛보기로(`STORY_RAW_STONE`). 룬 특성 연구의 재료라 1-10에서
 *   특성을 본 다음에야 뜻이 서고, 주 수급처는 고고학이다.
 * - **화석은 정예 관문에만 한 개**다(`elite`). 스토리 화석은 짜게 두고, 모자란 몫은 스토리 클리어
 *   패스(무료·유료 두 줄)가 채운다 — 관문마다 화석을 주면 패스가 채울 자리가 없다.
 * - **룬**은 `STORY_RUNE_REWARDS`가 자리를 정한다.
 */
function storyFirstClearBonus(id: string, globalOrder: number, chapter: number, chapterOrder: number, elite: boolean): StageBonusReward[] {
  const heavy = elite || chapterOrder === 10;
  const bonus: StageBonusReward[] = [
    { kind: "currency", currency: "gold", amount: (3_000 + globalOrder * 1_000) * (heavy ? 2 : 1) },
    { kind: "currency", currency: "gems", amount: heavy ? [150, 200, 300][chapter - 1] ?? 300 : [30, 40, 50][chapter - 1] ?? 50 },
  ];
  const rawStone = STORY_RAW_STONE[id];
  if (rawStone) bonus.push({ kind: "currency", currency: "rawStone", amount: rawStone });
  if (elite) bonus.push({ kind: "currency", currency: "fossil", amount: 1 });
  const rune = STORY_RUNE_REWARDS[id];
  if (rune) bonus.push(rune);
  return bonus;
}

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
  { title: "제1지부 외곽", subtitle: "검역선 — 도시로 들어가는 마지막 구간", names: ["추락하는 방주", "붕괴한 온실", "침수된 배양실", "표본 보관고", "제1구역 관제탑", "무너진 통신소", "폐기물 처리장", "지하 배수로", "봉쇄된 정거장", "구역 경계문"] },
  { title: "잔향 지구", subtitle: "침묵한 산업 회랑", names: ["잔향 진입로", "녹슨 조립동", "냉각 수로", "동력 중계실", "파손된 승강장", "무인 생산선", "압력 격실", "재처리 용광로", "중앙 운송로", "잔향 지구 관문"] },
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
     */
    const laterChapterIds = [...STAGE_ENEMY_FORMATION];
    const lateFormation = LATE_CHAPTER_FORMATIONS[`${chapter}-${chapterOrder}`];
    /*
     * **돌파는 레벨에서 나온다**(`requiredBreakthroughForLevel`). 2장은 21~30이라 전 관문이 돌파 1단계
     * (상한 30)이고, 화면의 `LV`와 돌파 등급이 맞는다. 1단계가 여는 것은 평타 효과 하나뿐이라
     * "기본기가 한층 강해진다"가 2장의 몫이다. 3장(36~47)도 같은 함수로 2~3단계가 나온다 — 0으로 적어 두었을 때는
     * 정보창이 `LV.40 / 상한 20`을 세웠다. 돌파는 늘 그 레벨이 요구하는 단계 이상이어야 한다.
     */
    const laterChapterLevel = STORY_RECOMMENDED_LEVELS[globalOrder] ?? 1;
    const laterChapterBreakthrough = requiredBreakthroughForLevel(laterChapterLevel);
    const laterChapterEnemies = lateFormation
      ? lateFormation.map(([relicId, slot]) => enemyGrowth(relicId, laterChapterLevel, laterChapterBreakthrough, slot))
      : laterChapterIds.map((relicId, slot) =>
        enemyGrowth(relicId, laterChapterLevel, laterChapterBreakthrough, slot as 0 | 1 | 2));
    const enemies = chapter === 1 ? CHAPTER_ONE_ENEMIES[orderIndex] : laterChapterEnemies;
    const id = `${chapter}-${chapterOrder}`;
    const elite = enemies.length === 1 || ELITE_DUO_STAGE_IDS.has(id);
    return {
      kind: "battle",
      id, name, chapter, chapterOrder,
      // 첫 노드는 이전 챕터 끝을, 나머지는 같은 챕터의 직전 노드를 선행 조건으로 삼는다.
      prerequisiteStageIds: chapterOrder === 1 ? (prerequisiteStageId ? [prerequisiteStageId] : []) : [`${chapter}-${chapterOrder - 1}`],
      // 마지막 심층 관문은 원정 최종층과 같은 폰토스를 세워 등록된 보스가 스테이지에서도 고립되지 않게 한다.
      enemies,
      // 혼자 서면 정예다. 화면은 이 표식으로 몸집과 표식만 바꾸고 수치는 건드리지 않는다.
      ...(elite ? { elite: true as const } : {}),
      rewards: {
        /*
         * 초회 치즈케이크는 **난이도 검수가 딛고 선 값**이라 그대로 둔다. `stageDifficulty.test`가 관문마다
         * "그 자리에 닿은 사람이 스토리로 받은 치즈케이크"로 파티를 키워 1-10·2장의 벽을 재므로, 여기를
         * 올리면 벽이 조용히 낮아진다(1-10의 땅 딜러 조합이 여덟 판 중 한 판 → 여섯 판으로 열렸다).
         * 초회의 몫은 나머지 보상(`firstClearBonus`)이 늘리고, 성장 재화의 숨통은 대작전이 튼다.
         */
        firstClearCheesecake: 30 + globalOrder * 5,
        repeatClearCheesecake: 10 + globalOrder * 2,
        firstClearBonus: storyFirstClearBonus(id, globalOrder, chapter, chapterOrder, enemies.length === 1),
      },
      // 아직 서사가 없는 장은 이 값이 비어 있고, 화면은 그 줄을 그리지 않는다.
      situation: CHAPTER_SITUATIONS[chapterIndex]?.[orderIndex],
    };
  });
  return { id: chapter, title: content.title, subtitle: content.subtitle, prerequisiteStageId, stages };
});

/**
 * 서브 노드(SUB) — 본편 노드 옆에서 갈라지는 선택 서사다. 선행 관문(`anchor`)을 깨면 열리지만 **다음 본편의 선행 목록에는
 * 들지 않아** 본편을 막지 않는다. 지도에서는 칸에 「SUB」만 적고 이름은 칸 아래에 선다.
 *
 * 이야기 SUB는 이 목록(`SUB_STORY_STAGES`)이고, 전투 SUB는 `sub: true`를 단 `BattleStageDef`(`SIDE_BATTLE_STAGE`)다.
 * 전투 SUB는 진행 순위·「다음 단계」에서 빠진다(`stageProgress.ts`).
 */
function subStory(anchor: string, suffix: string, name: string, storyId: string): StageDef {
  const [chapter, order] = anchor.split("-").map(Number);
  return { kind: "story", id: `${anchor}-${suffix}`, name, chapter, chapterOrder: order, prerequisiteStageIds: [anchor], storyId };
}

/** 1-5에서 갈라지는 선택 서사는 1-6의 선행 목록에 들어가지 않아 본편을 막지 않는다. */
export const SIDE_STORY_STAGE: StageDef = subStory("1-5", "side-story", "온실의 호박 소동", "stage-1-5-greenhouse-echo");

/** 지도 순서(아래에서 위로)대로다. 한 본편 노드에는 서브 하나만 단다. */
export const SUB_STORY_STAGES: readonly StageDef[] = [
  SIDE_STORY_STAGE,
  subStory("2-3", "side-story", "떨어진 사원증", "stage-2-3-lost-badge"),
  subStory("2-6", "side-story", "같은 줄", "stage-2-6-same-line"),
  subStory("2-9", "side-story", "두 번째 추격", "stage-2-9-second-chase"),
  subStory("3-5", "side-story", "소매 뒤의 마음", "stage-3-5-behind-sleeve"),
  subStory("3-8", "side-story", "시말서", "stage-3-8-apology"),
];

/**
 * **모든 서브(SUB)의 처음 보상은 젬 50 하나다** — 이야기든 전투든, 어느 장이든 같은 값이다. 서브는 덤이지 수급처가 아니고
 * 장마다 값이 갈리면 어느 서브가 이득인지를 따지게 된다. 서버(`completeStory`·전투 초회)와 화면이 이 상수 하나를 읽는다.
 */
export const SUB_GEM_REWARD = 50;
export const SUB_STORY_GEM_REWARDS: Readonly<Record<string, number>> = Object.fromEntries(
  SUB_STORY_STAGES.flatMap((stage) => stage.kind === "story" ? [[stage.storyId, SUB_GEM_REWARD]] : []),
);

/**
 * 전투 서브 — 1-8 수문 아래에서 아모와 리파가 보급 상자를 두고 길을 막는다. 본편 1-8(LV.19)의 공멸 셋과 달리
 * **둘만 서는 정예 변칙**이고 레벨은 한 칸 낮은 LV.18이다(2-7·2-9 정예 둘과 같은 자리 규칙 — 새 유형을 만들지 않는다).
 * 보상은 젬 50뿐이고 치즈케이크는 주지 않는다 — 난이도 검수가 딛고 선 초회 치즈케이크 곡선(`stageDifficulty.test`)을 건드리지 않는다.
 */
export const SIDE_BATTLE_STAGE: BattleStageDef = {
  kind: "battle", sub: true, elite: true,
  id: "1-8-side-battle", name: "수문 밑 보급전", chapter: 1, chapterOrder: 8,
  prerequisiteStageIds: ["1-8"],
  enemies: [enemyGrowth("amo", 18, 0, 0), enemyGrowth("ripa", 18, 0, 2)],
  rewards: {
    firstClearCheesecake: 0,
    repeatClearCheesecake: 0,
    firstClearBonus: [{ kind: "currency", currency: "gems", amount: SUB_GEM_REWARD }],
  },
};

/** 지도에 서는 서브 전부 — 이야기와 전투를 함께 센다. */
export const SUB_STAGES: readonly StageDef[] = [...SUB_STORY_STAGES, SIDE_BATTLE_STAGE];

/** 전투와 서브가 같은 고유 ID 공간에서 저장 검증과 지도 조회를 공유한다. */
export const STAGES: readonly StageDef[] = [...CHAPTERS.flatMap(({ stages }) => stages), ...SUB_STAGES];
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
    return { ...base, encounterRole: role, stats: applyBreakthrough(applyEncounterScaling(base.stats, enemy.level, role, stage.enemies.length), enemy.breakthrough) };
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
for (const sub of SUB_STAGES) registerDataText(sub, "name", `stage.${sub.id}.name`);
registerDataText(DAILY_RESTORATION, "name", "stage.dailyRestoration.name");
