import type { AchievementMetric } from "./achievements";
import { LOBBY, SCENE, type GuideDestination } from "./guideRoutes";
import type { NewbieGrowthMetric } from "./newbieGrowth";
import { MISSIONS, type MissionEvent } from "../core/missions";

/**
 * 임무·업적·성장 가이드 줄 왼쪽의 「바로가기」가 가는 곳 — **한 표**다.
 *
 * 「관찰 질문 1개 답변」처럼 목표 문장만으로는 어디서 해야 하는지 알 수 없는 줄이 있어(관찰 질문은 렐릭 정보창의
 * 관찰 일지 안쪽 쪽에 있다), 줄마다 그 일을 하는 화면으로 곧장 데려간다. 길은 재화 안내창의 화살표와 같은
 * `GuideDestination`이라 잠긴 콘텐츠는 옮기지 않고 개방 조건을 토스트로 말한다(`followGuideDestination`).
 *
 * **갈 화면이 없는 것은 `undefined`로 비워 버튼을 세우지 않는다** — 보유 골드처럼 쌓이기만 하는 값, 로비에서
 * 캐릭터를 누르는 일처럼 화면이 아닌 손짓, 이 판 자신(일일 임무 완료), 알려 주면 재미가 사라지는 숨은 편성 기록.
 */

/** 임무는 그 임무를 올리는 사건이 정한다 — 같은 사건을 세는 일일·주간이 같은 곳으로 간다. */
const MISSION_EVENT_SHORTCUT: Readonly<Record<MissionEvent["type"], GuideDestination | undefined>> = {
  battle_completed: LOBBY("sortie"),
  relic_research_completed: SCENE("lab", "lab"),
  salary_given: SCENE("relics"),
  lobby_interaction: undefined,
  stamina_spent: LOBBY("sortie"),
  excavation_harvested: LOBBY("excavation", "excavation"),
  strata_tile_dug: SCENE("archaeology", "archaeology"),
  interaction_dispatched: SCENE("interaction", "interaction"),
  daily_mission_claimed: undefined,
  duel_won: SCENE("duel", "duel"),
};

/** 업적·성장 가이드가 읽는 값마다 그 값을 올리는 화면. */
const METRIC_SHORTCUT: Readonly<Record<NewbieGrowthMetric, GuideDestination | undefined>> = {
  ancientFloorPeak: SCENE("ancientStrata", "ancient"),
  normalStagesCleared: SCENE("stageMap"),
  hardStagesCleared: SCENE("stageMap"),
  storyStagesCleared: SCENE("stageMap"),
  storiesRead: SCENE("stageMap"),
  enhancedRunes: LOBBY("inventory"),
  runesEngraved: LOBBY("inventory"),
  traitRunes: SCENE("archaeology", "archaeology"),
  legendaryTraits: SCENE("archaeology", "archaeology"),
  runesOwned: SCENE("archaeology", "archaeology"),
  legendaryRunes: SCENE("archaeology", "archaeology"),
  archaeologySitesCompleted: SCENE("archaeology", "archaeology"),
  goldPeak: undefined,
  relicsOwned: SCENE("lab", "lab"),
  ssrOwned: SCENE("lab", "lab"),
  elementsOwned: SCENE("lab", "lab"),
  squadsOwned: SCENE("lab", "lab"),
  researchPulls: SCENE("lab", "lab"),
  maxRelicLevel: SCENE("relics"),
  relicsAtLevelCap: SCENE("relics"),
  relicsMaxBreakthrough: SCENE("relics"),
  relicsBrokenThrough: SCENE("relics"),
  relicsMaxBond: SCENE("relics"),
  perfectRelics: SCENE("relics"),
  fullyRunedRelics: SCENE("relics"),
  feedings: SCENE("relics"),
  favoriteChosen: SCENE("relics"),
  relicChaptersRead: SCENE("relics"),
  observationAnswers: { kind: "observation" },
  playerLevel: LOBBY("sortie"),
  victories: LOBBY("sortie"),
  staminaSpent: LOBBY("sortie"),
  duelWins: SCENE("duel", "duel"),
  duelTierReached: SCENE("duel", "duel"),
  raidRuns: SCENE("raid", "raid"),
  expeditionBest: SCENE("expedition", "expedition"),
  bountyTiersCleared: SCENE("bounty", "bounty"),
  cakeTiersCleared: SCENE("cakeOperation", "cakeOperation"),
  harvests: LOBBY("excavation", "excavation"),
  dispatches: SCENE("interaction", "interaction"),
  journalsRead: SCENE("interaction", "interaction"),
  dailyMissionsClaimed: LOBBY("missions"),
  codexComplete: LOBBY("codex"),
  guildJoined: SCENE("guild", "guild"),
  lobbyGreetings: undefined,
  modifiersEarned: undefined,
  nicknameSet: undefined,
  giftsDelivered: undefined,
  partySameElement: undefined,
  partySquads: undefined,
  partySsr: undefined,
};

/** 임무 ID로 바로가기를 찾는다. 모르는 임무는 버튼을 세우지 않는다. */
export function missionShortcut(missionId: string): GuideDestination | undefined {
  const mission = MISSIONS.find(({ id }) => id === missionId);
  return mission ? MISSION_EVENT_SHORTCUT[mission.event] : undefined;
}

/** 업적·성장 가이드 목표의 값으로 바로가기를 찾는다. */
export function metricShortcut(metric: NewbieGrowthMetric | AchievementMetric): GuideDestination | undefined {
  return METRIC_SHORTCUT[metric];
}
