/** 씬 사이를 오가는 런타임 상태다. JSON 경계에서는 반드시 SaveData로 변환한다. */

import type { GachaPityState, Wallet } from "../core/gacha";
import type { RelicProgress } from "../core/types";
import { BANNERS } from "../data/banners";
import { STAGES } from "../data/stages";
import { BOND_XP_REWARD, grantBondXp } from "../core/bond";
import type { MissionState } from "../core/missions";
import type { RuneInstance } from "../core/runes";
import { createDefaultSettings } from "../core/settings";
import { createIdleExcavationState, type IdleExcavationState } from "../core/idleExcavation";
import type { ExpeditionMapNode } from "../core/expeditionMap";
import type { ExpeditionAugmentOffer, ExpeditionAugmentSelection } from "../core/expeditionRewards";

/** 로컬에 저장 가능한 사용자 환경설정이다. 계정에는 표시 정보만 두며 인증 비밀은 서버 경계에 남긴다. */
export interface GameSettings {
  sound: { masterVolume: number; musicVolume: number; effectsVolume: number; voiceVolume: number; masterMuted: boolean; musicMuted: boolean; effectsMuted: boolean; voiceMuted: boolean };
  vibration: { enabled: boolean; combatHit: boolean; ultimate: boolean; excavationResult: boolean; uiInput: boolean };
  notifications: { enabled: boolean; staminaFull: boolean; freeRecruit: boolean; dailyMission: boolean; event: boolean; mail: boolean; quietHours: boolean; quietHoursStart: string; quietHoursEnd: string; lastScheduledIds: Partial<Record<"staminaFull" | "freeRecruit" | "dailyMission", string>> };
  presentation: { ultimateCutIn: boolean; screenShake: boolean; damageNumbers: boolean; shortenExcavation: boolean; lowSpecMode: boolean };
  /** 읽기 편의 옵션은 장면 좌표가 아니라 공용 텍스트/연출 계층에서 소비한다. */
  accessibility: { textScale: 1 | 1.15 | 1.3; reduceMotion: boolean; reduceFlashes: boolean; colorAssist: boolean; subtitles: boolean };
  game: { battleSpeed: 1 | 1.5 | 2; autoUltimate: boolean; textSpeed: 0.5 | 1 | 2; language: "ko" | "en" | "ja" };
  account: { provider: "guest" | "google" | "apple"; displayId: string };
}

/** 처음 시작할 때 쥐어 주는 렐릭. 셋이면 바로 출격할 수 있다. */
// 전용 원화와 SD 전투 Puppet까지 개발된 첫 세 캐릭터를 초기 체험 풀로 연다.
const STARTER_RELICS = ["anky", "rex", "spino"];

export interface Session {
  /** 룬·지갑과 분리된 중첩 아이템. 0개 행은 저장하지 않는다. */
  itemInventory: ItemStack[];
  /** 서버 정산 전용 방치 발굴 상태다. 씬은 이 객체를 직접 변경하지 않는다. */
  idleExcavation: IdleExcavationState;
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
  /** 서버 UTC 일자·주차에 묶인 직렬화 가능한 임무 진행과 수령 기록이다. */
  missions: MissionState;
  /** 상품별 현재 제한 주기 키와 구매 횟수다. FakeServer만 갱신한다. */
  productPurchases: Record<string, { periodKey: string; count: number }>;
  /** 서버 UTC 날짜에 귀속된 광고 수령 횟수와 멱등 요청 ID만 저장한다. */
  dailyAdRewards: DailyAdRewardState;
  /** 주간 원정의 편성·진행·기록이다. 씬은 ExpeditionManager를 통해서만 변경한다. */
  expedition: ExpeditionState;
}

/** 런 도중 저장되는 렐릭 한 기의 생존 스냅샷이다. */
export interface ExpeditionRelicState { relicId: string; currentHp: number; alive: boolean; }

/** 앱 재실행 뒤에도 한 노드 단위로 그대로 이어갈 수 있는 완전한 원정 런이다. */
export interface ExpeditionRunState {
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
  bossDamage: number;
  bestScore: number;
  settled: boolean;
}

/** 주간 교체와 이어하기를 한 경계에서 판정하기 위한 공개 원정 상태다. */
export interface ExpeditionState {
  weekKey: string;
  playsThisWeek: number;
  bestScore: number;
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
  /** 정적 아이템 ID와 양만 저장하는 JSON 안전 스택이다. */
  itemInventory: ItemStack[];
  /** 서버와 동기화할 수 있는 순수 JSON 발굴 상태다. */
  idleExcavation: IdleExcavationState;
  saveVersion: number;
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
  missions: MissionState;
  productPurchases: Record<string, { periodKey: string; count: number }>;
  dailyAdRewards: DailyAdRewardState;
  expedition: ExpeditionState;
}

/** 개별 옵션이 없는 소비품·재료만 같은 ID끼리 중첩한다. */
export interface ItemStack { itemId: string; quantity: number; }

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
    itemInventory: [{ itemId: "stamina-tonic", quantity: 3 }],
    // 서버 첫 조회가 현재 시각을 기준점으로 확정하며 기본 보관 시간은 4시간이다.
    idleExcavation: createIdleExcavationState(),
    settings,
    completedStoryIds: new Set<string>(),
    observationRecords: [],
    selectedStageId: null,
    party: [...STARTER_RELICS],
    cleared: new Set<string>(),
    owned: new Set(STARTER_RELICS),
    favorite: STARTER_RELICS[0],
    bookmarked: new Set<string>(),
    wallet: { fossil: 1200, amber: 10, gems: 120, gold: 25_400, stamina: 60, dnaFragments: 0, cheesecake: 0 },
    gachaPityByGroup: Object.fromEntries([...new Set(BANNERS.map(({ pityGroupId }) => pityGroupId))].map((id) => [id, { pullsSinceSsr: 0, pickupGuaranteed: false }])),
    relicProgress: Object.fromEntries(STARTER_RELICS.map((id) => [id, createStarterProgress()])),
    relicFragments: {},
    // 신규 계정은 정적 정의 ID가 아니라 서버 지급 계약을 통해 룬 인스턴스를 얻는다.
    runeInventory: [],
    dailyContent: { date: "", restorationEntries: 0, completedIds: [], claimedRewardIds: [] },
    // 기간별 연구도와 단계 수령 기록은 임무 수령 기록과 독립적으로 초기화한다.
    missions: { dailyKey: "", weeklyKey: "", progress: {}, claimedIds: [], researchPoints: { daily: 0, weekly: 0 }, claimedResearchStageIds: [] },
    productPurchases: {},
    // 검증 토큰은 일회성 서버 입력이므로 신규 저장에는 일일 카운터만 둔다.
    dailyAdRewards: { date: "", claimsBySlot: {}, requestIds: [] },
    // 빈 주차 키는 첫 원정 조회에서 서버와 같은 UTC 주차로 정규화된다.
    expedition: { weekKey: "", playsThisWeek: 0, bestScore: 0, run: null },
  };
}

export const session: Session = createDefaultSession();

/** 공유 객체 참조를 유지한 채 부트에서 검증된 상태만 주입한다. */
export function replaceSession(next: Session): void {
  Object.assign(session, next);
}

/** 첫 스테이지와, 직전 스테이지를 깬 스테이지만 들어갈 수 있다. */
export function isStageUnlocked(stageId: string): boolean {
  const index = STAGES.findIndex((s) => s.id === stageId);
  if (index <= 0) return index === 0;
  return session.cleared.has(STAGES[index - 1].id);
}
