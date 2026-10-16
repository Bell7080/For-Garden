import type { MissionReward } from "../core/missions";

/**
 * 업적 — 기간이 없는, 한 계정이 한 번씩 밟아 가는 기록.
 *
 * 임무가 "오늘·이번 주 무엇을 했나"를 센다면 업적은 **이제껏 무엇을 해 왔나**를 센다. 그래서 초기화가
 * 없고, 한 업적이 여러 단계(`tiers`)로 이어져 점점 어려워진다 — 1만 골드를 모으면 10만, 100만으로
 * 문턱이 올라가고 마지막 단계를 밟으면 그 줄이 끝나며 수식어가 열린다.
 *
 * **젬은 기분 좋은 덤이지 수급처가 아니다.** 다른 수집형 업적표(원신·스타레일)도 한 칸이 5·10·20이고
 * 한 묶음을 다 끝내도 수백 남짓이다. 여기서도 모든 업적을 끝까지 밟았을 때의 젬이 연구 열 번
 * (`ACHIEVEMENT_GEM_BUDGET`) 안에 들게 짰다 — 일일 임무가 매일 주는 몫과 견주면 몇 주치다. 앞 단계는
 * 일찍 열려 처음 들어온 사람에게 작게 자주 주고, 뒤 단계는 드물게 조금 더 준다.
 *
 * **한 단계에는 보상 하나만 둔다** — 임무의 연구도 단계와 같은 이유다(액자 한 장에 둘을 세우면 둘째가
 * 읽히지 않는다).
 */
/**
 * 갈래는 여섯이다. 수집형 업적표는 대개 다섯~열 갈래로 나누는데(스타레일은 아홉 남짓으로 시작했다), 한 갈래에
 * 업적이 서넛뿐이면 탭을 넘기는 손만 늘어 다섯~여덟 줄이 차는 만큼만 갈랐다. **기록**(`feat`)은 단계 없이
 * 한 번 밟으면 끝나는 업적의 자리다 — 도감 완성, 무지개 편성처럼 "해냈다"가 곧 전부인 것들이다.
 */
export type AchievementCategory = "growth" | "battle" | "explore" | "collection" | "daily" | "feat";

export const ACHIEVEMENT_CATEGORIES: readonly AchievementCategory[] = ["growth", "battle", "explore", "collection", "daily", "feat"];

/** 업적이 읽는 값. 상태에서 곧바로 읽는 것과, 도입 뒤로 누적해 센 것이 섞여 있다(`core/achievements.ts`). */
export type AchievementMetric =
  | "goldPeak"
  | "relicsOwned"
  | "maxRelicLevel"
  | "relicsMaxBreakthrough"
  | "relicsMaxBond"
  | "playerLevel"
  | "victories"
  | "storyStagesCleared"
  | "duelWins"
  | "raidRuns"
  | "expeditionBest"
  | "researchPulls"
  | "harvests"
  | "dispatches"
  | "storiesRead"
  | "feedings"
  | "staminaSpent"
  | "dailyMissionsClaimed"
  | "lobbyGreetings"
  | "relicsAtLevelCap"
  | "runesEngraved"
  | "bountyTiersCleared"
  | "cakeTiersCleared"
  | "duelTierReached"
  | "archaeologySitesCompleted"
  | "observationAnswers"
  | "relicChaptersRead"
  | "journalsRead"
  | "ssrOwned"
  | "runesOwned"
  | "legendaryRunes"
  | "modifiersEarned"
  | "codexComplete"
  | "elementsOwned"
  | "squadsOwned"
  | "perfectRelics"
  | "fullyRunedRelics"
  | "partySameElement"
  | "partySquads"
  | "partySsr"
  | "nicknameSet";

export interface AchievementTier {
  target: number;
  reward: MissionReward;
}

export interface AchievementSeries {
  id: string;
  category: AchievementCategory;
  metric: AchievementMetric;
  /** 문턱은 반드시 오름차순이다(테스트가 지킨다). */
  tiers: readonly AchievementTier[];
  /** 마지막 단계를 받는 순간 열리는 수식어(`PROFILE_MODIFIERS`의 `achievement:<id>`). */
  modifierId?: string;
  /**
   * 숨은 업적 — 닿기 전에는 목표를 `???`로 가린다. 편성 장난처럼 **알려 주면 재미가 사라지는** 단발 기록에만 쓴다.
   * 이름은 가리지 않는다(무엇을 찾는지 실마리는 남긴다).
   */
  hidden?: true;
}

const gems = (amount: number): MissionReward => ({ currency: "gems", amount });
const gold = (amount: number): MissionReward => ({ currency: "gold", amount });
const cheesecake = (amount: number): MissionReward => ({ currency: "cheesecake", amount });
const tiers = (targets: readonly number[], rewards: readonly MissionReward[]): AchievementTier[] =>
  targets.map((target, index) => ({ target, reward: rewards[index] ?? rewards.at(-1)! }));

export const ACHIEVEMENT_SERIES: readonly AchievementSeries[] = [
  // ── 성장 ──
  { id: "wealth", category: "growth", metric: "goldPeak", tiers: tiers([10_000, 100_000, 1_000_000, 10_000_000, 100_000_000], [gems(5), gems(10), gems(20), gems(40), gems(80)]), modifierId: "millionaire" },
  { id: "nurture", category: "growth", metric: "maxRelicLevel", tiers: tiers([10, 20, 40, 60], [cheesecake(50), cheesecake(100), cheesecake(200), cheesecake(400)]) },
  { id: "level-cap", category: "growth", metric: "relicsAtLevelCap", tiers: tiers([1, 3, 5, 10], [gems(10), gems(15), gems(20), gems(30)]) },
  { id: "limit-break", category: "growth", metric: "relicsMaxBreakthrough", tiers: tiers([1, 3, 5, 10], [gems(20), gems(30), gems(40), gems(60)]), modifierId: "limit-breaker" },
  { id: "bond", category: "growth", metric: "relicsMaxBond", tiers: tiers([1, 5, 10], [gems(20), gems(30), gems(50)]), modifierId: "kind-researcher" },
  { id: "rune-artisan", category: "growth", metric: "runesEngraved", tiers: tiers([1, 5, 20, 50], [gold(10_000), gold(30_000), gold(60_000), gold(100_000)]) },
  { id: "research-level", category: "growth", metric: "playerLevel", tiers: tiers([10, 20, 30, 40, 50, 60], [gems(10), gems(15), gems(20), gems(25), gems(30), gems(50)]), modifierId: "chief-researcher" },
  // ── 전투 ──
  { id: "victories", category: "battle", metric: "victories", tiers: tiers([10, 50, 200, 500, 1_000, 3_000], [gems(5), gems(10), gems(15), gems(20), gems(30), gems(50)]), modifierId: "veteran" },
  { id: "frontline", category: "battle", metric: "storyStagesCleared", tiers: tiers([10, 20, 30], [gems(20), gems(30), gems(50)]), modifierId: "front-breaker" },
  { id: "bounty-hunter", category: "battle", metric: "bountyTiersCleared", tiers: tiers([1, 2, 3, 4, 5], [gems(5), gems(10), gems(15), gems(20), gems(30)]) },
  { id: "cake-operation", category: "battle", metric: "cakeTiersCleared", tiers: tiers([1, 3, 5, 8], [cheesecake(100), cheesecake(200), cheesecake(300), cheesecake(500)]) },
  { id: "duelist", category: "battle", metric: "duelWins", tiers: tiers([1, 10, 50, 150, 300], [gems(5), gems(10), gems(20), gems(30), gems(50)]), modifierId: "arena-ruler" },
  // 결투장 티어는 0(브론즈)부터 센다 — 실버(1)에서 시작해 챌린저(7)에서 끝난다.
  { id: "duel-tier", category: "battle", metric: "duelTierReached", tiers: tiers([1, 2, 3, 4, 5, 6, 7], [gems(5), gems(5), gems(10), gems(10), gems(15), gems(20), gems(30)]), modifierId: "challenger" },
  { id: "raider", category: "battle", metric: "raidRuns", tiers: tiers([1, 10, 50, 150], [gems(5), gems(15), gems(25), gems(40)]), modifierId: "raid-captain" },
  { id: "salvager", category: "battle", metric: "expeditionBest", tiers: tiers([10_000, 30_000, 65_000, 110_000, 200_000], [gems(10), gems(15), gems(20), gems(30), gems(50)]), modifierId: "deep-salvager" },
  // ── 탐사 ──
  { id: "fossil-lab", category: "explore", metric: "researchPulls", tiers: tiers([10, 50, 100, 300, 1_000], [gems(5), gems(10), gems(15), gems(25), gems(40)]), modifierId: "fossil-appraiser" },
  { id: "archaeologist", category: "explore", metric: "archaeologySitesCompleted", tiers: tiers([1, 3, 5, 8], [gems(10), gems(15), gems(20), gems(30)]), modifierId: "stratum-explorer" },
  { id: "harvest", category: "explore", metric: "harvests", tiers: tiers([10, 50, 200, 500], [gold(10_000), gold(30_000), gold(60_000), gold(100_000)]) },
  { id: "dispatch", category: "explore", metric: "dispatches", tiers: tiers([5, 30, 100, 300], [gems(5), gems(10), gems(20), gems(30)]), modifierId: "city-envoy" },
  { id: "journals", category: "explore", metric: "journalsRead", tiers: tiers([1, 3, 5], [gold(10_000), gold(20_000), gold(40_000)]) },
  { id: "storyteller", category: "explore", metric: "storiesRead", tiers: tiers([5, 15, 25], [gems(10), gems(20), gems(30)]), modifierId: "story-collector" },
  { id: "interviewer", category: "explore", metric: "observationAnswers", tiers: tiers([5, 20, 50, 100], [gems(5), gems(10), gems(15), gems(20)]) },
  { id: "chapter-reader", category: "explore", metric: "relicChaptersRead", tiers: tiers([1, 5, 15, 30], [gems(5), gems(10), gems(15), gems(20)]) },
  // ── 수집 ──
  { id: "collector", category: "collection", metric: "relicsOwned", tiers: tiers([5, 10, 15, 20], [gems(10), gems(15), gems(20), gems(30)]), modifierId: "specimen-curator" },
  { id: "ssr-collector", category: "collection", metric: "ssrOwned", tiers: tiers([1, 3, 6, 9, 12], [gems(10), gems(15), gems(20), gems(30), gems(40)]) },
  { id: "rune-hoarder", category: "collection", metric: "runesOwned", tiers: tiers([10, 50, 150], [gold(10_000), gold(30_000), gold(60_000)]) },
  { id: "legendary-runes", category: "collection", metric: "legendaryRunes", tiers: tiers([1, 5, 10], [gems(10), gems(20), gems(30)]) },
  { id: "modifiers", category: "collection", metric: "modifiersEarned", tiers: tiers([3, 8, 15], [gems(10), gems(20), gems(30)]) },
  // ── 일상 ──
  { id: "feeding", category: "daily", metric: "feedings", tiers: tiers([10, 100, 500, 2_000], [gems(5), gems(10), gems(20), gems(30)]), modifierId: "cheesecake-artisan" },
  { id: "stamina", category: "daily", metric: "staminaSpent", tiers: tiers([1_000, 10_000, 50_000, 200_000], [gems(5), gems(15), gems(30), gems(50)]), modifierId: "tireless" },
  { id: "diligence", category: "daily", metric: "dailyMissionsClaimed", tiers: tiers([20, 100, 500, 2_000], [gems(10), gems(20), gems(30), gems(50)]), modifierId: "diligent-researcher" },
  { id: "greetings", category: "daily", metric: "lobbyGreetings", tiers: tiers([10, 50, 200, 500], [gold(10_000), gold(30_000), gold(50_000), gold(100_000)]) },
  // ── 기록 — 단계 없이 한 번 밟으면 끝난다 ──
  { id: "codex-complete", category: "feat", metric: "codexComplete", tiers: tiers([1], [gems(50)]), modifierId: "walking-codex" },
  { id: "all-elements", category: "feat", metric: "elementsOwned", tiers: tiers([5], [gems(20)]) },
  { id: "all-squads", category: "feat", metric: "squadsOwned", tiers: tiers([5], [gems(20)]) },
  { id: "perfect-relic", category: "feat", metric: "perfectRelics", tiers: tiers([1], [gems(30)]) },
  { id: "rune-set", category: "feat", metric: "fullyRunedRelics", tiers: tiers([1], [gold(30_000)]) },
  { id: "named", category: "feat", metric: "nicknameSet", tiers: tiers([1], [gold(10_000)]) },
  // 숨은 편성 장난 — 신규 계정의 기본 편성(같은 스쿼드 · 속성 셋)으로는 밟지 못하는 것만 둔다.
  { id: "mono-element-party", category: "feat", metric: "partySameElement", tiers: tiers([1], [gems(10)]), hidden: true },
  { id: "allied-party", category: "feat", metric: "partySquads", tiers: tiers([3], [gems(10)]), hidden: true },
  { id: "ssr-party", category: "feat", metric: "partySsr", tiers: tiers([3], [gems(10)]), hidden: true },
];

/**
 * 모든 업적을 끝까지 밟았을 때 받는 젬의 상한. 화석 하나(연구 한 번)가 젬 300이라 3,000이면 연구 열 번이다 —
 * 계정 하나가 몇 달에 걸쳐 밟는 몫이라 일일 임무 몇 주치에 그친다. 늘어난 업적의 몫은 젬보다 골드·치즈케이크가
 * 더 많이 맡는다. 업적을 더하거나 보상을 고치면 `achievements.test`가 이 띠를 다시 잰다.
 */
export const ACHIEVEMENT_GEM_BUDGET = 3_000;

export function findAchievementSeries(id: string): AchievementSeries | undefined {
  return ACHIEVEMENT_SERIES.find((series) => series.id === id);
}
