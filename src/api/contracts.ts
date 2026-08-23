import type { AcquisitionResult, GachaPityState, Wallet } from "../core/gacha";
import type { RelicProgress, Stats } from "../core/types";
import type { MissionPeriod } from "../core/missions";
import type { ProductCurrency, ProductGrant, ProductRefresh } from "../data/products";
import type { DnaExchangeKind } from "../data/economy";
import type { StageDef } from "../core/types";
import type { EventDefinition } from "../data/events/types";
import type { RuneInstance, RuneStatKey } from "../core/runes";

/** 룬 장착 위치다. 슬롯 값은 정적 정의 ID가 아닌 룬 인스턴스 ID다. */
export interface RuneEquipmentDto { relicId: string; slots: [string | null, string | null, string | null]; }

/** 보유 룬과 단일 기준 장착표를 한 번에 전달하는 직렬화 가능한 인벤토리 DTO다. */
export interface RuneInventoryDto { runes: RuneInstance[]; equipment: RuneEquipmentDto[]; }

/** 강화 요청에는 선택 정보만 있으며 성공 여부나 난수는 의도적으로 넣을 수 없다. */
export interface EnhanceRuneRequest { runeInstanceId: string; statId: RuneStatKey; }
/** 서버가 판정하고 저장한 한 번의 강화 결과다. */
export interface EnhanceRuneResponse { succeeded: boolean; goldSpent: number; nextSuccessChance: number; rune: RuneInstance; inventory: RuneInventoryDto; }
/** 각인 요청 역시 대상 룬과 실제 옵션만 고르며 등급과 증가량은 서버가 정한다. */
export interface EngraveRuneRequest { runeInstanceId: string; statId: RuneStatKey; }
/** 각인 뒤 갱신된 룬과 인벤토리를 반환한다. */
export interface EngraveRuneResponse { rune: RuneInstance; inventory: RuneInventoryDto; }
/** 이름 원문은 서버 경계에서 정규화하므로 요청에는 별도 정규화 플래그가 없다. */
export interface RenameRuneRequest { runeInstanceId: string; name: string; }
/** 공백 제거와 검증을 마친 이름이 반영된 룬이다. */
export interface RenameRuneResponse { rune: RuneInstance; inventory: RuneInventoryDto; }
/** 장착 대상은 보유 룬, 보유 렐릭, 0부터 시작하는 세 슬롯으로 특정한다. */
export interface EquipRuneRequest { runeInstanceId: string; relicId: string; slotIndex: number; }
/** 장착표 변경 뒤의 단일 기준 인벤토리다. */
export interface EquipRuneResponse { inventory: RuneInventoryDto; }
/** 해제는 렐릭 슬롯을 직접 비워 요청 시점의 룬 역참조에 의존하지 않는다. */
export interface UnequipRuneRequest { relicId: string; slotIndex: number; }
/** 해제 뒤의 단일 기준 인벤토리다. */
export interface UnequipRuneResponse { inventory: RuneInventoryDto; }

/** 다른 이용자에게 공개해도 되는 렐릭 정보만 담는 소셜 DTO다. */
export interface PublicRelicProfileDto {
  relicId: string;
  level: number;
  /** 성급은 중복 획득/각성 단계와 구분되는 공개 표시 값이다. */
  stars: number;
  /** 서버가 공개 시점에 계산한 대표 능력치라 조회자의 세션을 참조하지 않는다. */
  stats: Stats;
  /** 공개가 허용된 스킬만 id로 전달한다. */
  skillIds: string[];
}

/** 네트워크로 직렬화할 수 있는 플레이어 진행 정보의 최소 규격이다. */
export interface PlayerStateDto {
  /** 서버가 확정한 현재 재화다. */
  wallet: Wallet;
  /** 서버가 확정한 이월 그룹별 천장과 픽업 확정 상태다. */
  gachaPityByGroup: Record<string, GachaPityState>;
  /** Set 대신 배열을 써서 JSON 응답과 같은 모양을 유지한다. */
  ownedRelicIds: string[];
  /** 렐릭 id별 성장과 Heart Gem 3슬롯 장착 상태다. */
  relicProgress: Record<string, RelicProgress>;
  /** 서버 동기화 대상인 편성, 애착, 클리어 진행이다. 로컬 SaveData와 버전 책임은 분리한다. */
  party: string[];
  favorite: string;
  clearedStageIds: string[];
  /** 서버 UTC 키와 일일 복원 소비 횟수다. */
  dailyContent: { date: string; restorationEntries: number };
  /** 서버 기간 정규화가 끝난 임무 목록이다. */
  missions: MissionDto[];
  /** 서버가 소유권과 RelicProgress 슬롯의 장착 중복을 검증한 룬 인벤토리다. */
  runeInventory: RuneInventoryDto;
}

/** 임무 화면에 필요한 진행·보상·수령 상태를 한 행으로 전달한다. */
export interface MissionDto { id: string; period: MissionPeriod; title: string; progress: number; target: number; rewardCheesecake: number; claimed: boolean; }
/** 목록 응답은 로비 배지에서 바로 쓸 미수령 개수를 포함한다. */
export interface MissionListResponse { missions: MissionDto[]; claimableCount: number; }
/** 일괄 또는 선택 수령 뒤 지급 총액과 최신 상태를 반환한다. */
export interface ClaimMissionRewardsResponse extends PlayerStateDto { claimedIds: string[]; cheesecakeEarned: number; }

/** 상품 목록은 정적 정의에 서버가 계산한 현재 구매 가능 횟수를 결합한다. */
export interface ProductDto { id: string; section: "trade" | "premium"; name: string; description: string; price: { currency: ProductCurrency; amount: number; display?: string }; grants: readonly ProductGrant[]; purchaseLimit: number; refresh: ProductRefresh; remaining: number; purchasable: boolean; disabledReason?: string; }
/** 상품 조회 응답은 서버 시각 기준으로 노출 중인 상품만 담는다. */
export interface ProductListResponse { products: ProductDto[]; serverTime: string; }
/** 인게임 상품의 차감·지급·제한 갱신이 모두 끝난 뒤의 응답이다. */
export interface PurchaseProductResponse extends PlayerStateDto { productId: string; grants: readonly ProductGrant[]; remaining: number; /** 이번 구매에서 서버가 생성한 완성 룬들이다. */ grantedRunes: RuneInstance[]; }
/** DNA 교환 요청은 무작위 시드가 아니라 선택한 교환품과 필요할 때 렐릭 대상을 명시한다. */
export interface ExchangeDnaRequest { offerId: string; relicId?: string; }
/** 서버가 확정한 선택 보상과 잔여 DNA를 반환해 UI가 추첨 연출을 만들지 않게 한다. */
export interface ExchangeDnaResponse extends PlayerStateDto { offerId: string; rewardKind: DnaExchangeKind; relicId?: string; /** 교환 결과가 룬일 때 서버가 생성한 완성 인스턴스다. */ grantedRune?: RuneInstance; }

/** 발굴 요청에는 클라이언트가 선택한 배너와 횟수만 보낸다. */
export interface PullRequest {
  bannerId: string;
  count: 1 | 10;
}

/** 서버가 확정한 발굴 결과와 그 직후 상태다. */
export interface PullResponse extends PlayerStateDto {
  /** 추첨 순서를 보존하며 각 슬롯의 신규/숙련/상한 변화를 명시한다. */
  results: AcquisitionResult[];
  newRelicIds: string[];
  duplicateRelicIds: string[];
}

/** UI가 서버 실패 원인을 문구로 바꿀 수 있게 고정한 오류 코드다. */
export type ApiErrorCode = "BANNER_NOT_FOUND" | "INSUFFICIENT_CURRENCY" | "INSUFFICIENT_GOLD" | "INVALID_PULL_COUNT" | "RELIC_NOT_FOUND" | "RELIC_MAX_LEVEL" | "RUNE_NOT_FOUND" | "RUNE_ENHANCEMENT_COMPLETE" | "RUNE_STAT_EXHAUSTED" | "RUNE_ENGRAVING_NOT_ALLOWED" | "INVALID_RUNE_NAME" | "INVALID_RUNE_SLOT" | "RUNE_ALREADY_EQUIPPED" | "RUNE_SLOT_EMPTY" | "STAGE_NOT_FOUND" | "DAILY_ENTRY_LIMIT" | "MISSION_NOT_FOUND" | "MISSION_NOT_COMPLETE" | "MISSION_ALREADY_CLAIMED" | "PRODUCT_NOT_FOUND" | "PRODUCT_NOT_VISIBLE" | "PURCHASE_LIMIT_REACHED" | "PLATFORM_PAYMENT_REQUIRED" | "DNA_OFFER_NOT_FOUND" | "INVALID_EXCHANGE_TARGET" | "DUPLICATE_GRANT" | "INVALID_STATE" | "CURRENCY_LIMIT_EXCEEDED" | "EVENT_NOT_FOUND" | "EVENT_NOT_ACTIVE";

/**
 * 급여 응답.
 *
 * 요청한 횟수를 다 먹이지 못할 수도 있으므로(치즈케이크 부족·레벨 상한) 실제로 소비한 횟수와
 * 그때 오른 레벨 수를 함께 돌려준다. 화면은 이 값으로만 연출을 정한다.
 */
export interface FeedRelicResponse extends PlayerStateDto { relicId: string; feeds: number; cheesecakeSpent: number; levelsGained: number; }
/** 돌파 결과. 열린 상한을 함께 돌려줘 화면이 표를 다시 뒤지지 않게 한다. */
export interface BreakThroughResponse extends PlayerStateDto { relicId: string; breakthrough: number; levelCap: number; }
/** 전투 확인 시 저장되는 보상으로 최초 여부와 획득 치즈케이크를 결과 UI에 그대로 전달한다. */
export interface CompleteStageResponse extends PlayerStateDto { stageId: string; firstClear: boolean; cheesecakeEarned: number; }
/** 로비 터치 결과는 중복 여부와 대사 UI가 표시할 유대 변화량을 돌려준다. */
export interface LobbyInteractionResponse extends PlayerStateDto { relicId: string; bondXpEarned: number; bondLevelsGained: number; }
/** 일일 입장 소비와 즉시 지급된 프로토타입 보상을 한 응답으로 확정한다. */
export interface EnterDailyRestorationResponse extends PlayerStateDto { entriesRemaining: number; cheesecakeEarned: number; }
/** 클라이언트가 자체 시계를 보지 않도록 서버 시각과 판정 상태를 함께 보낸다. */
export interface EventDto extends EventDefinition { status: "upcoming" | "active" | "ended"; }
export interface EventListResponse { events: EventDto[]; serverTime: string; }
/** 입장 허가 뒤에도 기존 StageDef로 같은 전투 엔진을 사용한다. */
export interface EnterEventStageResponse { eventId: string; stage: StageDef; serverTime: string; }

/** 실제 HTTP API로 교체할 때도 씬이 의존할 단 하나의 통신 인터페이스다. */
export interface GameApi {
  getPlayerState(): Promise<PlayerStateDto>;
  pullRelics(request: PullRequest): Promise<PullResponse>;
  /** 급여로 경험치를 올린다. 횟수를 넘기면 한 번에 여러 번 먹인다. */
  feedRelic(relicId: string, feeds?: number): Promise<FeedRelicResponse>;
  /** 레벨 상한을 한 단계 연다. 재료 차감과 단계 확정을 한 처리로 맡는다. */
  breakThroughRelic(relicId: string): Promise<BreakThroughResponse>;
  /** 패배도 서버에 명시해 승리 전용 보상이 새지 않도록 한다. */
  completeStage(stageId: string, victory?: boolean): Promise<CompleteStageResponse>;
  interactInLobby(relicId: string): Promise<LobbyInteractionResponse>;
  enterDailyRestoration(): Promise<EnterDailyRestorationResponse>;
  /** 이벤트 목록과 활성 상태는 서버 시각으로만 계산한다. */
  getEvents(): Promise<EventListResponse>;
  /** 종료된 이벤트 전투의 입장을 API 경계에서 차단한다. */
  enterEventStage(eventId: string, stageId: string): Promise<EnterEventStageResponse>;
  getMissions(): Promise<MissionListResponse>;
  /** ID를 생략하면 현재 완료된 모든 미수령 임무를 한 저장 처리로 받는다. */
  claimMissionRewards(missionIds?: string[]): Promise<ClaimMissionRewardsResponse>;
  /** 서버 시각과 구매 이력을 반영한 공용 카탈로그를 조회한다. */
  getProducts(): Promise<ProductListResponse>;
  /** 인게임 재화 상품만 구매한다. 유료 상품은 플랫폼 결제/영수증 검증 경계를 사용해야 한다. */
  purchaseProduct(productId: string): Promise<PurchaseProductResponse>;
  /** DNA 조각을 요청에서 고른 보상으로 교환하며 랜덤 발굴 경로를 사용하지 않는다. */
  exchangeDna(request: ExchangeDnaRequest): Promise<ExchangeDnaResponse>;
  /** 룬의 한 옵션을 서버 난수로 한 번 강화한다. */
  enhanceRune(request: EnhanceRuneRequest): Promise<EnhanceRuneResponse>;
  /** 모든 일반 강화를 마친 룬에 서버 판정 각인을 한 번 적용한다. */
  engraveRune(request: EngraveRuneRequest): Promise<EngraveRuneResponse>;
  /** 서버 이름 정책을 통과한 사용자 이름으로 바꾼다. */
  renameRune(request: RenameRuneRequest): Promise<RenameRuneResponse>;
  /** 한 룬이 전체 장착표에서 정확히 한 슬롯에만 있도록 장착한다. */
  equipRune(request: EquipRuneRequest): Promise<EquipRuneResponse>;
  /** 렐릭 슬롯을 장착표의 단일 기준에서 해제한다. */
  unequipRune(request: UnequipRuneRequest): Promise<UnequipRuneResponse>;
}

/** 예상 가능한 요청 실패를 일반 네트워크 예외와 구분한다. */
export class GameApiError extends Error {
  constructor(public readonly code: ApiErrorCode, message: string) {
    super(message);
    this.name = "GameApiError";
  }
}
