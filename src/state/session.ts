/** 씬 사이를 오가는 런타임 상태다. JSON 경계에서는 반드시 SaveData로 변환한다. */

import type { GachaPityState, Wallet } from "../core/gacha";
import type { RelicProgress } from "../core/types";
import { BANNERS } from "../data/banners";
import { STAGES } from "../data/stages";
import { BOND_XP_REWARD, grantBondXp } from "../core/bond";
import type { MissionState } from "../core/missions";
import type { RuneInstance } from "../core/runes";

/** 처음 시작할 때 쥐어 주는 렐릭. 셋이면 바로 출격할 수 있다. */
// 전용 원화와 SD 전투 Puppet까지 개발된 첫 세 캐릭터를 초기 체험 풀로 연다.
const STARTER_RELICS = ["anky", "rex", "spino"];

export interface Session {
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
  /** 보유 Heart Gem id 목록이다. 중복 없는 직렬화 가능한 배열로 유지한다. */
  ownedHeartGemIds: string[];
  /** 신규 인스턴스형 룬 인벤토리다. optional은 v12 테스트/호출자의 점진적 이전만 허용한다. */
  runeInventory?: RuneInstance[];
  /** 장착의 단일 기준인 렐릭별 세 슬롯이다. 룬에는 역참조를 저장하지 않는다. */
  runeSlotsByRelicId?: Record<string, [string | null, string | null, string | null]>;
  /** 날짜가 바뀔 때 서버 시간 기준으로 교체할 일일 콘텐츠 진행이다. */
  dailyContent: DailyContentState;
  /** 서버 UTC 일자·주차에 묶인 직렬화 가능한 임무 진행과 수령 기록이다. */
  missions: MissionState;
  /** 상품별 현재 제한 주기 키와 구매 횟수다. FakeServer만 갱신한다. */
  productPurchases: Record<string, { periodKey: string; count: number }>;
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
  saveVersion: number;
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
  ownedHeartGemIds: string[];
  runeInventory: RuneInstance[];
  runeSlotsByRelicId: Record<string, [string | null, string | null, string | null]>;
  dailyContent: DailyContentState;
  missions: MissionState;
  productPurchases: Record<string, { periodKey: string; count: number }>;
}

/** 신규 렐릭에 부여하는 독립 복사 가능한 기본 성장 상태다. */
export function createInitialRelicProgress(): RelicProgress {
  // 유대는 플레이어별 진행 값이며 신규/마이그레이션 계정 모두 0에서 시작한다.
  return { level: 1, exp: 0, awakening: 0, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, null, null] };
}

/** 새 계정의 시작 렐릭도 최초 획득 경로를 거친 것으로 동일한 유대 보상을 받는다. */
function createStarterProgress(): RelicProgress { return grantBondXp(createInitialRelicProgress(), BOND_XP_REWARD.firstAcquisition).progress; }

/** 신규 계정과 복구 실패가 공유하는 독립 기본 세션을 만든다. */
export function createDefaultSession(): Session {
  return {
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
    ownedHeartGemIds: ["vital-seed", "fang-core", "ancient-pulse"],
    runeInventory: [],
    runeSlotsByRelicId: {},
    dailyContent: { date: "", restorationEntries: 0, completedIds: [], claimedRewardIds: [] },
    missions: { dailyKey: "", weeklyKey: "", progress: {}, claimedIds: [] },
    productPurchases: {},
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
