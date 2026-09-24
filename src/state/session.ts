/** 씬 사이를 오가는 런타임 상태다. JSON 경계에서는 반드시 SaveData로 변환한다. */

import type { RaidDifficulty } from "../data/raid";
import type { GachaPityState, Wallet } from "../core/gacha";
import type { RelicProgress, RelicSkinId } from "../core/types";
import type { ExpeditionRelicSnapshot } from "../core/expeditionSnapshot";
import { BANNERS } from "../data/banners";
import { STAGES } from "../data/stages";
import { isStageUnlockedByProgress } from "../core/stageProgress";
import { BOND_XP_REWARD, grantBondXp } from "../core/bond";
import type { MissionState } from "../core/missions";
import type { RuneInstance } from "../core/runes";
import { createDefaultSettings } from "../core/settings";
import type { LanguageId } from "../core/language";
import { createIdleExcavationState, type IdleExcavationState } from "../core/idleExcavation";
import { createArchaeologyState, type ArchaeologyState } from "../core/strataDig";
import type { ExpeditionMapNode } from "../core/expeditionMap";
import type { ExpeditionAugmentOffer, ExpeditionAugmentSelection } from "../core/expeditionRewards";
import { defaultUnlockedRelicSkinIds } from "../data/relicSkins";
import { STARTER_RUNE_TRAIT_KIT } from "../data/runes";

/** 로컬에 저장 가능한 사용자 환경설정이다. 계정에는 표시 정보만 두며 인증 비밀은 서버 경계에 남긴다. */
export interface GameSettings {
  sound: { masterVolume: number; musicVolume: number; effectsVolume: number; voiceVolume: number; masterMuted: boolean; musicMuted: boolean; effectsMuted: boolean; voiceMuted: boolean };
  vibration: { enabled: boolean; combatHit: boolean; ultimate: boolean; excavationResult: boolean; uiInput: boolean };
  notifications: { enabled: boolean; staminaFull: boolean; dailyMission: boolean; quietHours: boolean; quietHoursStart: string; quietHoursEnd: string; lastScheduledIds: Partial<Record<"staminaFull" | "dailyMission", string>> };
  /** 연출 선택이며 전투 시계·판정에는 절대 소비되지 않는다. */
  presentation: {
    screenShake: boolean; damageNumbers: boolean; shortenExcavation: boolean; battleUiMotion: "default" | "reduced" | "off";
    /** 비전투 장식의 갱신 예산만 낮추며 접근성의 움직임 감소 선택과 별도로 저장한다. */
    powerSaving: boolean;
    /** 파티클·후처리·전신 렌더 배율만 결정하며 `presentationPolicy`가 유일한 소비 경계다. */
    graphicsQuality: "high" | "balanced" | "low";
    /** Phaser 런타임 시간 설정에서만 프레임 제한으로 소비하며 코어 dt와 배속은 바꾸지 않는다. */
    frameRateLimit: 30 | 60;
  };
  /** `reduceFlashes`와 `colorAssist`는 공용 효과·의미 표식 경계에서 소비한다. 필수 대사는 숨기지 않는다. */
  accessibility: { textScale: 1 | 1.15 | 1.3; reduceMotion: boolean; reduceFlashes: boolean; colorAssist: boolean };
  /** 전투 중 즉시 바꿀 수 있는 조작은 SettingsManager 저장 경계를 공유한다. */
  game: { battleSpeed: 1 | 2 | 3; autoUltimate: boolean; skipUltimatePresentation: boolean; textSpeed: 0.5 | 1 | 2; language: LanguageId };
  account: { provider: "guest" | "google" | "apple"; displayId: string };
}

/** 처음 시작할 때 쥐어 주는 렐릭. 전용 전신과 SD가 완성된 여섯 명을 기본 도감에 연다. */
const STARTER_RELICS = ["anky", "rex", "spino", "luka", "dodo", "mette"];
/** 보유 인원이 늘어나도 저장 검증 계약인 세 자리 기본 편성은 기존 조합으로 유지한다. */
const STARTER_PARTY = ["anky", "rex", "spino"];

/** 서버가 확정해 저장하고 프로필 UI가 그대로 표시하는 JSON 안전 플레이어 연구 진행이다. */
export interface PlayerResearchProgress {
  /** 계정 전체의 현재 연구 레벨이며 렐릭별 레벨과 구분한다. */
  level: number;
  /** 현재 연구 레벨 안에서 누적된 경험치다. */
  experience: number;
  /** 다음 연구 레벨에 도달하기 위해 현재 구간에서 요구되는 총 경험치다. */
  experienceToNext: number;
}

/** 신규 계정과 구버전 저장 마이그레이션이 공유하는 명시적인 연구 진행 시작점이다. */
export function createInitialPlayerResearchProgress(): PlayerResearchProgress {
  return { level: 1, experience: 0, experienceToNext: 100 };
}

export interface Session {
  /** 획득한 추가 외형이다. 기본 외형은 별도 ID 없이 항상 사용할 수 있다. */
  ownedRelicSkinIds: Set<RelicSkinId>;
  /** 렐릭별 추가 외형 선택이다. 키가 없으면 해당 렐릭의 기본 외형을 사용한다. */
  equippedRelicSkinIds: Partial<Record<string, RelicSkinId>>;
  /** 발견/읽음은 manager만 변경하는 Set이며 SaveManager가 JSON 안전 배열로 변환한다. */
  discoveredInteractionJournalIds: Set<string>;
  readInteractionJournalIds: Set<string>;
  /** 교류 서버 응답을 그대로 복원하는 JSON 안전 슬롯이며 씬은 InteractionManager만 사용한다. */
  interaction: InteractionProgress;
  /** 획득/장착은 표시명이 아닌 안정적인 수식어 ID만 저장하며 manager만 변경한다. */
  earnedProfileModifierIds: string[];
  equippedProfileModifierIds: string[];
  /** 서버 응답으로 확정된 계정 전체 연구 진행이며 씬은 수치를 직접 계산하거나 변경하지 않는다. */
  playerResearch: PlayerResearchProgress;
  /** 룬·지갑과 분리된 중첩 아이템. 0개 행은 저장하지 않는다. */
  itemInventory: ItemStack[];
  /** 서버 정산 전용 방치 발굴 상태다. 씬은 이 객체를 직접 변경하지 않는다. */
  idleExcavation: IdleExcavationState;
  /** 고고학의 탐사 횟수·진행 중인 판·재해석 후보다. 씬은 GameApi를 통해서만 변경한다. */
  archaeology: ArchaeologyState;
  /** 씬은 직접 쓰지 않고 SettingsManager를 거쳐 저장·이벤트와 한 처리로 변경한다. */
  settings: GameSettings;
  /** 완료한 스토리 ID. 첫 실행 진입과 회상 보상 차단에 함께 사용한다. */
  completedStoryIds: Set<string>;
  /** 날짜별 관찰 인터뷰 기록. 답변 태그는 전투 수치와 분리된 작은 성격 단서다. */
  observationRecords: ObservationRecord[];
  /** 지도에서 고른 스테이지 id. */
  selectedStageId: string | null;
  /** 편성한 파티. 렐릭 id 3개, 0번이 전방이다. */
  party: string[];
  /** 클리어한 스테이지 id. */
  cleared: Set<string>;
  /** 보유한 렐릭. 뽑기로 늘어난다. */
  owned: Set<string>;
  /** 로비에 세워 두는 애착 렐릭. 한 명뿐이다. */
  favorite: string;
  /** 즐겨찾기한 렐릭. 애착과 달리 여러 명을 담을 수 있고 목록 위쪽에 모아 보는 데 쓴다. */
  bookmarked: Set<string>;
  wallet: Wallet;
  /** 마지막 자연 충전 정산 기준점. 서버 응답으로만 갱신한다. */
  staminaUpdatedAt: string;
  /** 이월 가능한 배너 그룹별 SSR 카운터와 픽업 확정 상태다. */
  gachaPityByGroup: Record<string, GachaPityState>;
  /** 렐릭 id별 성장/장착 상태다. 객체와 배열만 사용해 그대로 직렬화할 수 있다. */
  relicProgress: Record<string, RelicProgress>;
  /** 개체별 파편. 연구소 중복 획득으로 쌓이고 한계 돌파에 쓴다. 공용 DNA 조각과 섞지 않는다. */
  relicFragments: Record<string, number>;
  /** 보유 룬 인스턴스다. 정적 정의 ID가 아니라 각 개체의 고유 ID로 구분한다. */
  runeInventory: RuneInstance[];
  /** 날짜가 바뀔 때 서버 시간 기준으로 교체할 일일 콘텐츠 진행이다. */
  dailyContent: DailyContentState;
  /** 현상수배의 일일 입장 횟수와 깬 등급이다. 씬은 API 응답으로만 갱신한다. */
  bounty: BountyState;
  /** 서버 UTC 일자·주차에 묶인 직렬화 가능한 임무 진행과 수령 기록이다. */
  missions: MissionState;
  /** 상품별 현재 제한 주기 키와 구매 횟수다. FakeServer만 갱신한다. */
  productPurchases: Record<string, { periodKey: string; count: number }>;
  /** 서버 UTC 날짜에 귀속된 광고 수령 횟수와 멱등 요청 ID만 저장한다. */
  dailyAdRewards: DailyAdRewardState;
  /** 주간 원정의 편성·진행·기록이다. 씬은 ExpeditionManager를 통해서만 변경한다. */
  expedition: ExpeditionState;
  /** 주간 레이드 시즌에서 내가 민 몫과 수령 기록이다. */
  raid: RaidState;
  /** 치즈케이크 대작전에서 지금까지 이긴 가장 높은 단계다. 씬은 GameApi를 통해서만 변경한다. */
  cakeOperation: CakeOperationState;
}

/**
 * 물량형 던전의 진행.
 *
 * 저장에 남는 것은 **어디까지 이겼나** 하나뿐이다 — 해금도 소탕 허용도 전부 그 한 값에서
 * 나오므로, 단계별 클리어 표를 따로 들고 다니면 같은 사실을 두 곳이 말하게 된다.
 */
export interface CakeOperationState {
  /**
   * 이긴 가장 높은 단계의 순번(0부터). 아직 하나도 못 이겼으면 -1이다.
   *
   * 단계 ID가 아니라 순번을 저장하는 이유는 해금이 "직전 단계"를 묻기 때문이다 — ID를 두면
   * 열 때마다 목록에서 자리를 다시 찾아야 하고, 표에서 단계가 하나 사라지면 그 값이 어디도
   * 가리키지 못한다.
   */
  clearedIndex: number;
}

/** 런 도중 저장되는 렐릭 한 기의 생존 스냅샷이다. */
export interface ExpeditionRelicState {
  relicId: string;
  currentHp: number;
  alive: boolean;
  /** 출발 시점의 성장. 이 필드가 생기기 전의 런은 불러올 때 채운다(`ExpeditionManager.status`). */
  snapshot?: ExpeditionRelicSnapshot;
}

/**
 * 내가 들어간 레이드 한 판의 몫.
 *
 * **다른 참가자의 몫은 저장하지 않는다** — 서버가 갖고, 백엔드가 없는 지금은 판의 ID와 시각에서
 * 되풀이 계산되는 값이라 저장에 굳히면 다음에 열 때 두 수가 갈린다. 저장이 갖는 것은 **판을
 * 다시 세우는 데 필요한 정의**(보스·난이도·시각)와 내가 민 몫·도전 횟수·정산 여부뿐이다.
 */
export interface RaidInstanceState {
  id: string;
  kind: "world" | "summon";
  bossRelicId: string;
  difficulty: RaidDifficulty;
  openedAt: string;
  endsAt: string;
  /** 소환 레이드를 연 사람의 이름. 내가 열었으면 비운다(`summonedByMe`). */
  summonerName?: string;
  summonedByMe: boolean;
  /** 이 판에서 내가 민 피해의 합(최대 두 판). 정산이 읽는 값이다. */
  myDamage: number;
  attemptsUsed: number;
  settled: boolean;
}

/** 레이드 진행. 내가 열었거나 들어간 판만 남는다. */
export interface RaidState {
  instances: RaidInstanceState[];
}

/** 신규 계정과 마이그레이션이 같은 빈 모양을 공유한다. */
export function createEmptyRaidState(): RaidState {
  return { instances: [] };
}

/** 앱 재실행 뒤에도 한 노드 단위로 그대로 이어갈 수 있는 완전한 원정 런이다. */
export interface ExpeditionRunState {
  /** 서버가 발급한 런 고유 키다. */
  runId: string;
  weekKey: string;
  mapSeed: string;
  nodes: ExpeditionMapNode[];
  currentNodeId: string | null;
  visitedNodeIds: string[];
  relics: [ExpeditionRelicState, ExpeditionRelicState, ExpeditionRelicState];
  selectedAugmentIds: string[];
  /** 대상까지 포함한 확정 결과다. 같은 ID의 허용 중첩을 배열 항목 수로 보존한다. */
  selectedAugments: ExpeditionAugmentSelection[];
  /** 생성 seed와 후보 자체를 함께 저장해 앱 재실행으로 제안을 다시 뽑지 못하게 한다. */
  pendingAugmentReward: { nodeId: string; seed: string; round: number; totalRounds: number; offers: ExpeditionAugmentOffer[] } | null;
  pendingRewards: Record<string, number>;
  /** 마지막 서버 완료 응답의 증가분·확정 점수·상한을 재접속 후에도 HUD에 보여 준다. */
  lastNodeRewards: { nodeId: string; nodeScore: number; rewards: Record<string, number>; cappedCurrencies: string[] } | null;
  bossDamage: number;
  /** 보스가 아닌 전투 노드가 서버에서 확정될 때 정확히 한 번 더하는 이번 런의 누적 점수다. */
  normalNodeScoreTotal: number;
  /** 폰토스 제출이 멱등 ID로 확정될 때 갱신하며 일반 노드 점수는 포함하지 않는다. */
  bossDamageScore: number;
  /** 폰토스 제출/노드 확정 뒤 갱신하는 최종 한 판 점수로, 일반 노드 누적과 보스 피해를 모두 포함한다. */
  runScore: number;
  /** 이전 저장 호환용 별칭이며 새 코드는 runScore를 점수 기준으로 사용한다. */
  bestScore: number;
  settled: boolean;
  /** 성공한 정산 요청의 고유 키이며 null이면 아직 지갑 이전 전이다. */
  settlementId: string | null;
  /** 보스 제출과 정산 사이 재접속도 같은 서버 멱등 키로 복구한다. */
  bossSubmissionId: string | null;
  bossSettlementId: string | null;
}

/** 주간 교체와 이어하기를 한 경계에서 판정하기 위한 공개 원정 상태다. */
export interface ExpeditionState {
  weekKey: string;
  playsThisWeek: number;
  bestScore: number;
  /** 주간과 무관하게 지금까지 달성한 가장 높은 점수다. 소탕이 이 값의 비율만 참조한다. */
  allTimeBestScore: number;
  /** 마지막으로 성공 출발한 원정 전용 편성이다. 스토리 파티·발굴 배치와 서로 덮어쓰지 않는다. */
  lastParty: string[];
  run: ExpeditionRunState | null;
}

/** 광고 SDK 토큰은 저장하지 않고 지급 재실행 방지에 필요한 값만 담는 일일 상태다. */
export interface DailyAdRewardState {
  date: string;
  claimsBySlot: Record<string, number>;
  requestIds: string[];
}

/** 아직 서버 계정에 귀속되지 않은 브라우저 일일 콘텐츠 스냅샷이다. */
export interface DailyContentState {
  /** 서버가 정한 UTC YYYY-MM-DD 키다. 앱 재실행이 아니라 키 변경만 횟수를 초기화한다. */
  date: string;
  /** 일일 복원에 실제 입장해 소비한 횟수다. */
  restorationEntries: number;
  completedIds: string[];
  claimedRewardIds: string[];
}

/**
 * 현상수배 진행.
 *
 * 입장 횟수는 UTC 키가 바뀌면 되돌아가지만 **깬 등급은 날짜와 무관하게 남는다** — 다음 등급을
 * 여는 값이라 하루가 지났다고 잠기면 어제 깬 관문을 다시 깨야 한다.
 */
export interface BountyState {
  /** 서버가 정한 UTC YYYY-MM-DD 키다. */
  date: string;
  /** 오늘 실제로 입장해 소비한 횟수다. */
  entries: number;
  /** 세 라운드를 모두 이긴 등급 ID다. 다음 등급의 해금 근거다. */
  clearedTierIds: string[];
}

/** 관찰 일지에 그대로 표시할 수 있는, 완료된 인터뷰의 최소 스냅샷이다. */
export interface ObservationRecord {
  date: string;
  relicId: string;
  storyId: string;
  questionId: string;
  question: string;
  choiceId: string;
  answer: string;
  personalityTag: string;
  discoveredHabit: string;
}

/**
 * JSON 직렬화만을 위한 저장 계약이다. Set은 JSON에서 유실되므로 이름을 분리한 배열로 둔다.
 * 계정 연동 시에도 이 형태를 업로드 모델로 오해하지 않고 SaveManager 경계에서만 사용한다.
 */
export interface SaveData {
  /** 런타임 스킨 소유 Set을 JSON 배열로 표현한다. */
  ownedRelicSkinIds: RelicSkinId[];
  /** 렐릭 ID를 키로 하는 JSON 안전 장착 표이며 누락 키는 기본 외형이다. */
  equippedRelicSkinIds: Partial<Record<string, RelicSkinId>>;
  /** 일지 ID Set의 JSON 안전 표현이다. 읽음 목록은 반드시 발견 목록의 부분집합이어야 한다. */
  discoveredInteractionJournalIds: string[];
  readInteractionJournalIds: string[];
  /** 구버전은 빈 슬롯으로 이관되는 교류 진행 스냅샷이다. */
  interaction: InteractionProgress;
  /** 문구 변경과 저장 호환성을 분리하는 수식어 ID 전용 저장 필드다. */
  earnedProfileModifierIds: string[];
  equippedProfileModifierIds: string[];
  /** 서버 확정 연구 진행을 앱 재실행 뒤에도 동일하게 복원하는 JSON 안전 스냅샷이다. */
  playerResearch: PlayerResearchProgress;
  /** 정적 아이템 ID와 양만 저장하는 JSON 안전 스택이다. */
  itemInventory: ItemStack[];
  /** 서버와 동기화할 수 있는 순수 JSON 발굴 상태다. */
  idleExcavation: IdleExcavationState;
  /** 진행 중인 판까지 그대로 담는 JSON 안전 고고학 상태다. */
  archaeology: ArchaeologyState;
  saveVersion: number;
  /** 물량형 던전 진행. 런타임 상태와 같은 모양이라 변환 없이 오간다. */
  cakeOperation: CakeOperationState;
  settings: GameSettings;
  completedStoryIds: string[];
  observationRecords: ObservationRecord[];
  selectedStageId: string | null;
  party: string[];
  clearedStageIds: string[];
  ownedRelicIds: string[];
  favorite: string;
  bookmarkedRelicIds: string[];
  wallet: Wallet;
  /** 서버가 확정한 자연 충전 기준 시각이다. */
  staminaUpdatedAt: string;
  /** 배너 교체에도 유지되는 그룹 ID를 키로 쓰며 개별 배너 ID에는 귀속하지 않는다. */
  gachaPityByGroup: Record<string, GachaPityState>;
  relicProgress: Record<string, RelicProgress>;
  /**
   * 개체별 파편 보유량.
   *
   * 연구소에서 같은 개체를 다시 획득하면 그 개체의 일러스트가 박힌 파편이 쌓이고, 파편으로 한계를
   * 돌파해 별을 올린다. 공용 DNA 조각과 섞지 않는다 — DNA는 별 다섯에 닿은 뒤의 마일리지다.
   */
  relicFragments: Record<string, number>;
  runeInventory: RuneInstance[];
  dailyContent: DailyContentState;
  bounty: BountyState;
  missions: MissionState;
  productPurchases: Record<string, { periodKey: string; count: number }>;
  dailyAdRewards: DailyAdRewardState;
  expedition: ExpeditionState;
  raid: RaidState;
}

/** 개별 옵션이 없는 소비품·재료만 같은 ID끼리 중첩한다. */
export interface ItemStack { itemId: string; quantity: number; }

/** 서버가 확정한 결과는 수령 전 재접속에도 바뀌지 않도록 파견과 함께 저장한다. */
export interface InteractionDispatchSnapshot { dispatchId: string; cityId: string; startedAt: string; completesAt: string; party: string[]; rewardSeed: string; reward: { currency: keyof Wallet; amount: number }; claimed: boolean; }
/** 배열 계약은 이후 파견 슬롯 확장 때 저장 모양을 깨뜨리지 않는다. */
export interface InteractionProgress { slots: Array<InteractionDispatchSnapshot | null>; claimedRequestIds: string[]; }
/** 신규 계정과 마이그레이션이 같은 빈 슬롯 모양을 공유한다. */
export function createEmptyInteractionProgress(): InteractionProgress { return { slots: [null], claimedRequestIds: [] }; }

/** 신규 렐릭에 부여하는 독립 복사 가능한 기본 성장 상태다. */
export function createInitialRelicProgress(): RelicProgress {
  // 유대는 플레이어별 진행 값이며 신규/마이그레이션 계정 모두 0에서 시작한다.
  return { level: 1, exp: 0, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, null, null] };
}

/** 새 계정의 시작 렐릭도 최초 획득 경로를 거친 것으로 동일한 유대 보상을 받는다. */
function createStarterProgress(): RelicProgress { return grantBondXp(createInitialRelicProgress(), BOND_XP_REWARD.firstAcquisition).progress; }

/** 신규 계정과 복구 실패가 공유하는 독립 기본 세션을 만든다. */
export function createDefaultSession(): Session {
  // 순수 설정 팩토리는 지연 require 대신 정적 import로 의존 방향을 core→state 타입에만 제한한다.
  const settings = createDefaultSettings();
  return {
    // 무료 외형 정책은 정적 정의에서 계산해 새 콘텐츠가 상태 모듈의 하드코딩을 요구하지 않게 한다.
    ownedRelicSkinIds: new Set(defaultUnlockedRelicSkinIds()),
    equippedRelicSkinIds: {},
    discoveredInteractionJournalIds: new Set<string>(),
    readInteractionJournalIds: new Set<string>(),
    interaction: createEmptyInteractionProgress(),
    // 신규 계정은 보상 수령을 통해서만 수식어를 획득한다.
    earnedProfileModifierIds: [],
    equippedProfileModifierIds: [],
    // 첫 서버 동기화 전에도 프로필이 명시적인 레벨 1 진행을 표시하도록 한다.
    playerResearch: createInitialPlayerResearchProgress(),
    // 특성 아이템 셋도 임시 지급이다 — 특성이 비어 있는 시작 룬에 부여해 보고, 부여된 특성의
    // 등급을 올려 보는 길이 지층 탐사 없이도 열려 있어야 한다. 정식 수급이 붙으면 함께 지운다.
    // 토벌권은 친구 레이드를 여는 입장권이다. 처음 들어온 사람이 레이드 목록의 소환을 한 번은
    // 눌러 볼 수 있게 몇 장 쥐여 준다 — 그 뒤로는 전리품 상점에서 증표로 바꾼다.
    itemInventory: [
      { itemId: "stamina-tonic", quantity: 3 },
      { itemId: "raid-ticket", quantity: 3 },
      { itemId: "raid-select-ticket", quantity: 1 },
      ...STARTER_RUNE_TRAIT_KIT.items.map((entry) => ({ ...entry })),
    ],
    // 서버 첫 조회가 현재 시각을 기준점으로 확정하며 기본 보관 시간은 서버 상수가 정한다.
    idleExcavation: createIdleExcavationState(),
    archaeology: createArchaeologyState(),
    settings,
    completedStoryIds: new Set<string>(),
    observationRecords: [],
    selectedStageId: null,
    party: [...STARTER_PARTY],
    cleared: new Set<string>(),
    owned: new Set(STARTER_RELICS),
    favorite: STARTER_RELICS[0],
    bookmarked: new Set<string>(),
    // 임시 뽑기 테스트 지급: 화석·호박석 배너를 각각 100회의 10연속 복원까지 확인할 수 있다.
    // 정식 경제 밸런스를 적용할 때는 fossil 12 / amber 5으로 되돌리고 이 주석도 제거한다.
    wallet: { fossil: 900, amber: 450, gems: 120, gold: 25_400, stamina: 60, dnaFragments: 0, cheesecake: 0, rawStone: STARTER_RUNE_TRAIT_KIT.rawStone, raidSigil: 0, salvageRecord: 0 },
    // 첫 FakeServer 요청이 서버 시각으로 안전하게 초기화한다.
    staminaUpdatedAt: "",
    gachaPityByGroup: Object.fromEntries([...new Set(BANNERS.map(({ pityGroupId }) => pityGroupId))].map((id) => [id, { pullsSinceSsr: 0, pickupGuaranteed: false }])),
    relicProgress: Object.fromEntries(STARTER_RELICS.map((id) => [id, createStarterProgress()])),
    relicFragments: {},
    // 신규 계정은 정적 정의 ID가 아니라 서버 지급 계약을 통해 룬 인스턴스를 얻는다.
    runeInventory: [],
    dailyContent: { date: "", restorationEntries: 0, completedIds: [], claimedRewardIds: [] },
    // 첫 단계는 늘 열려 있으므로 아무것도 이기지 않은 상태를 -1로 둔다.
    cakeOperation: { clearedIndex: -1 },
    // 빈 날짜 키는 첫 현상수배 조회에서 서버와 같은 UTC 날짜로 정규화된다.
    bounty: { date: "", entries: 0, clearedTierIds: [] },
    // 기간별 연구도와 단계 수령 기록은 임무 수령 기록과 독립적으로 초기화한다.
    missions: { dailyKey: "", weeklyKey: "", progress: {}, claimedIds: [], researchPoints: { daily: 0, weekly: 0 }, claimedResearchStageIds: [] },
    productPurchases: {},
    // 검증 토큰은 일회성 서버 입력이므로 신규 저장에는 일일 카운터만 둔다.
    dailyAdRewards: { date: "", claimsBySlot: {}, requestIds: [] },
    // 빈 주차 키는 첫 원정 조회에서 서버와 같은 UTC 주차로 정규화된다.
    expedition: { weekKey: "", playsThisWeek: 0, bestScore: 0, allTimeBestScore: 0, lastParty: [], run: null },
    // 빈 시즌 키도 첫 레이드 조회에서 서버와 같은 UTC 주차로 정규화된다.
    raid: createEmptyRaidState(),
  };
}

export const session: Session = createDefaultSession();

/** 공유 객체 참조를 유지한 채 부트에서 검증된 상태만 주입한다. */
export function replaceSession(next: Session): void {
  Object.assign(session, next);
}

/** 첫 스테이지와, 직전 스테이지를 깬 스테이지만 들어갈 수 있다. */
export function isStageUnlocked(stageId: string): boolean {
  // 스토리 완료 ID를 대응 노드 ID로 바꿔 전투/서사 간선도 같은 집합 판정기를 통과시킨다.
  const completedNodeIds = new Set(session.cleared);
  for (const stage of STAGES) if (stage.kind === "story" && session.completedStoryIds.has(stage.storyId)) completedNodeIds.add(stage.id);
  return isStageUnlockedByProgress(STAGES, stageId, completedNodeIds);
}
