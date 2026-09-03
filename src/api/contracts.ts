import type { AcquisitionResult, GachaPityState, QuantityRewardKind, Wallet } from "../core/gacha";
import type { RelicProgress, Stats } from "../core/types";
import type { MissionPeriod } from "../core/missions";
import type { PassBenefitDefinition, ProductAcquisition, ProductGrant, ProductRefresh, ProductStorefront, ShopCategory, ShopProductIconKey } from "../data/products";
/** storefront와 상점 카테고리는 클라이언트·서버가 함께 쓰는 공용 계약으로 다시 공개한다. */
export type { ProductStorefront, ShopCategory } from "../data/products";
import type { DnaExchangeKind } from "../data/economy";
import type { StageDef } from "../core/types";
import type { EventDefinition } from "../data/events/types";
import type { RuneInstance, RuneStatKey } from "../core/runes";
import type { ExcavationCurrency, IdleExcavationState } from "../core/idleExcavation";
import type { AdReward } from "../data/adRewards";
import type { ItemCategory, ItemUseEffect } from "../data/items";
import type { ExpeditionBossAction } from "../core/expeditionBoss";
import type { PlayerResearchProgress } from "../state/session";
import type { AsyncArenaProfileApi } from "./asyncArenaContracts";

/** 정적 표시 메타데이터를 중복 전송하지 않고 서버 보유량과 인스턴스만 전달하는 인벤토리 조회 행이다. */
export interface InventoryItemDto { id: string; definitionId: string; category: ItemCategory; quantity: number; rune?: RuneInstance; }
/** 지갑은 조회 순간 표시 행으로만 합성된다. */
export interface InventoryResponse { items: InventoryItemDto[]; }

/** 우편 첨부물은 지갑 재화 또는 중첩 아이템만 허용해 임의 서버 명령이 클라이언트에 들어오지 않게 한다. */
export type MailRewardDto =
  | { kind: "currency"; currency: keyof Wallet; amount: number }
  | { kind: "item"; itemId: string; amount: number };
/** 목록 한 행이 표시와 행동 가능 여부를 모두 판단할 수 있는 서버 확정 우편 스냅샷이다. */
export interface MailDto { id: string; title: string; sender: string; body: string; sentAt: string; expiresAt: string | null; read: boolean; claimed: boolean; rewards: MailRewardDto[]; }
/** 클라이언트 시계 대신 같은 응답의 서버 시각으로 만료를 판단한다. */
export interface MailListResponse { mails: MailDto[]; serverTime: string; unreadCount: number; claimableCount: number; }
/** 단일·일괄 수령은 같은 요청 형태를 사용하고 requestId로 재전송을 멱등 처리한다. */
export interface ClaimMailRewardsRequest { requestId: string; mailIds: string[]; }
/** 서버가 실제 지급한 첨부물과 최종 지갑·아이템을 함께 반환한다. */
export interface ClaimMailRewardsResponse extends MailListResponse { claimedMailIds: string[]; granted: MailRewardDto[]; wallet: Wallet; items: InventoryItemDto[]; }
/** 열람 처리는 보상 수령과 분리하며 여러 행을 한 번에 읽음 처리할 수 있다. */
export interface MarkMailsReadRequest { mailIds: string[]; }
/** 수량은 양의 정수만 허용하며 서버가 보유량과 상한을 다시 검증한다. */
export interface UseConsumableRequest { itemId: string; quantity: number; }
/** 실제 적용량을 반환해 상한에서 버려진 회복을 UI가 추측하지 않게 한다. */
export interface UseConsumableResponse extends InventoryResponse { itemId: string; quantityUsed: number; effect: ItemUseEffect; appliedAmount: number; overflowAmount: number; wallet: Wallet; stamina: StaminaDto; }

/** 로컬 시계로 확정량을 만들지 않도록 서버가 완성해 주는 스테미나 시계다. 세부 명명 규칙은 docs/server-time-dto.md를 따른다. */
/** 재화로 스테미나를 채우는 요청. 수단 ID는 서버 표와 대조하고 재전송은 requestId로 막는다. */
export interface RechargeStaminaRequest { sourceId: string; requestId: string; }
/** 실제 채운 양과 넘친 양을 함께 돌려줘 화면이 상한을 다시 계산하지 않게 한다. */
export interface RechargeStaminaResponse extends PlayerStateDto { sourceId: string; spent: { currency: keyof Wallet; amount: number }; appliedAmount: number; overflowAmount: number; stamina: StaminaDto; }

export interface StaminaDto { current: number; maximum: number; serverTime: string; updatedAt: string; nextRecoveryAt: string | null; fullAt: string | null; }

/** 조회는 서버가 정산한 상태와 동일 기준 시각을 함께 돌려준다. 시각 필드는 docs/server-time-dto.md를 따른다. */
/** 네 발굴 재화 레코드와 서버 정산 시각을 함께 보내 클라이언트 추측 지급을 막는다. */
export interface IdleExcavationResponse {
  excavation: IdleExcavationState;
  serverTime: string;
  /** 같은 응답의 생산량·보관 한도로 계산한 0~1 서버 확정 비율이다. */
  storageFillRatio: number;
  /** 비율이 절반 이상이고 광고 배율까지 적용해 정수 수확량이 있을 때만 true다. */
  harvestNotice: boolean;
}
/** 편성 저장 재시도는 요청 ID로 같은 결과를 받으며 슬롯 위치를 보존한다. */
export interface SaveExcavationFormationRequest { requestId: string; assignedRelicIds: [string | null, string | null, string | null]; }
/** 수확 요청 ID는 네트워크 재전송의 중복 지급을 막는 서버 멱등 키다. */
export interface HarvestExcavationRequest { readonly requestId: string; }
/** 상한 때문에 버린 양과 소수 잔량까지 공개해 화면이 지급량을 추측하지 않게 한다. */
export interface HarvestExcavationResponse extends IdleExcavationResponse {
  /** 서버가 지갑에 실제 반영한 자원별 정수 수량이다. */
  granted: Record<ExcavationCurrency, number>;
  /** 지갑 상한 때문에 지급하지 못하고 소멸한 자원별 정수 수량이다. */
  discarded: Record<ExcavationCurrency, number>;
  /** 수확 뒤 지갑의 서버 확정 스냅샷이다. */
  wallet: Wallet;
  /** 정수 수확 뒤 다음 수확으로 이월한 자원별 소수 누적량이다. */
  remaining: Record<ExcavationCurrency, number>;
}

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
/**
 * 잠금·즐겨찾기 표시 변경이다.
 *
 * 주지 않은 값은 그대로 둔다 — 별을 켜는 요청이 자물쇠를 함께 끄지 않게 한다.
 */
export interface MarkRuneRequest { runeInstanceId: string; locked?: boolean; bookmarked?: boolean; }
/** 표시가 반영된 룬과 갱신된 인벤토리다. */
export interface MarkRuneResponse { rune: RuneInstance; inventory: RuneInventoryDto; }
/** 장착 대상은 보유 룬, 보유 렐릭, 0부터 시작하는 세 슬롯으로 특정한다. */
export interface EquipRuneRequest { runeInstanceId: string; relicId: string; slotIndex: number; }
/** 장착표 변경 뒤의 단일 기준 인벤토리다. */
export interface EquipRuneResponse { inventory: RuneInventoryDto; }
/** 해제는 렐릭 슬롯을 직접 비워 요청 시점의 룬 역참조에 의존하지 않는다. */
export interface UnequipRuneRequest { relicId: string; slotIndex: number; }
/** 해제 뒤의 단일 기준 인벤토리다. */
export interface UnequipRuneResponse { inventory: RuneInventoryDto; }
/** 판매 명령은 재전송 멱등 키와 서버가 제거할 인스턴스 ID만 전달한다. */
export interface SellRunesRequest { requestId: string; instanceIds: string[]; }
/** 서버가 원자 커밋한 룬·장착표·지갑과 실제 지급 골드다. */
export interface SellRunesResponse { inventory: RuneInventoryDto; wallet: Wallet; goldAwarded: number; }

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

/**
 * 자기 프로필과 친구 프로필이 함께 사용하는 공개 헤더 화이트리스트다.
 * 인증/계정 키, 재화, 보유 목록, 편성은 표현할 필드 자체를 두지 않아 소셜 응답에서 유출되지 않게 한다.
 */
export interface PublicProfileHeaderDto {
  displayName: string;
  level: number;
  /** 공개 아바타 리소스 키이며 계정 식별자나 원본 업로드 경로로 사용하지 않는다. */
  avatarAssetKey?: string;
  /** 서버가 획득과 장착을 검증한 공개 수식어만 포함한다. */
  equippedModifiers: PublicProfileModifierDto[];
  /** 애착 렐릭 한 명만 공개하며 보유 렐릭이나 편성은 포함하지 않는다. */
  favoriteRelic: PublicRelicProfileDto;
  /** 사용자가 공개할 수 있는 경쟁 기록만 선택적으로 전달하며 비어 있는 기록은 생략한다. */
  competitiveStats: PublicCompetitiveStatsDto;
}

/** 공개 헤더에서 서버 검증을 마친 수식어의 표시 정보만 전달한다. */
export interface PublicProfileModifierDto {
  id: string;
  displayName: string;
  rarity: "common" | "rare" | "epic" | "legendary";
}

/** 공개 동의를 받은 기록만 존재할 수 있으며 미기록/비공개 항목은 키 자체를 생략한다. */
export interface PublicCompetitiveStatsDto {
  highestStage?: { stageId: string; displayValue: string };
  arenaTier?: { tierId: string; displayName: string };
  expeditionScore?: number;
}

/** 네트워크로 직렬화할 수 있는 플레이어 진행 정보의 최소 규격이다. */
export interface PlayerStateDto {
  /** 서버가 확정한 계정 연구 레벨·현재 경험치·다음 레벨 요구량의 공개 스냅샷이다. */
  playerResearch: PlayerResearchProgress;
  /** 서버가 확정한 현재 재화다. */
  wallet: Wallet;
  /** 현재량과 동적 상한 및 회복 시각을 한 서버 스냅샷으로 제공한다. */
  stamina: StaminaDto;
  /** 서버가 확정한 이월 그룹별 천장과 픽업 확정 상태다. */
  gachaPityByGroup: Record<string, GachaPityState>;
  /** Set 대신 배열을 써서 JSON 응답과 같은 모양을 유지한다. */
  ownedRelicIds: string[];
  /** 렐릭 id별 성장과 Heart Gem 3슬롯 장착 상태다. */
  relicProgress: Record<string, RelicProgress>;
  /** 개체별 파편 보유량. 연구소 중복 획득으로 쌓이고 한계 돌파에 쓴다. */
  relicFragments: Record<string, number>;
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
  /** 서버 UTC 날짜로 정규화된 광고 슬롯별 수령 횟수다. 멱등 ID는 공개하지 않는다. */
  dailyAdRewards: { date: string; claimsBySlot: Record<string, number> };
}

/** 공개 프로필 API가 확정한 업적 획득 목록과 사용자의 장착 선택이며 모두 ID로만 직렬화한다. */
export interface ProfileModifierSelectionDto {
  earnedModifierIds: string[];
  equippedModifierIds: string[];
}

/** 광고 SDK 완료 증명과 요청 재시도 멱등 키를 서버로 전달하는 요청이다. */
export interface ClaimAdRewardRequest { slotId: string; verificationToken: string; requestId: string; }
/** 검증·중복·일일 제한 확인 후 지급과 저장까지 확정된 광고 보상 결과다. */
export interface ClaimAdRewardResponse extends PlayerStateDto { slotId: string; reward: AdReward; dailyClaims: number; dailyRemaining: number; /** 서버 지갑 스냅샷의 전후 차이만 담아 UI가 실제 지급량을 재계산하지 않게 한다. */ granted: Partial<Record<keyof Wallet, number>>; /** 주간 제한 슬롯만 서버가 확정한 잔여 횟수를 돌려준다. */ weeklyRemaining?: number; excavation?: IdleExcavationState; serverTime: string; }

/** 클라이언트는 런/정산 식별자와 종료 사유만 보내며 보상 수치는 보낼 수 없다. */
export interface SettleExpeditionRunRequest { runId: string; settlementId: string; outcome: "completed" | "abandoned"; }
/** 지갑 상한 적용 뒤 실제 이전량을 돌려주는 원자 정산 결과다. */
export interface SettleExpeditionRunResponse extends PlayerStateDto { runId: string; settlementId: string; outcome: "completed" | "abandoned"; granted: Record<string, number>; }
/** 클라이언트는 실제 보상이 아닌 전투 결과만 제출하며, requestId는 재시도를 묶는다. */
export interface CompleteExpeditionNodeRequest { requestId: string; runId: string; nodeId: string; relicHp: number[]; }
/** 서버가 결정한 증가분과 상한 상태를 돌려줘 HUD가 저장 결과를 그대로 그린다. */
export interface CompleteExpeditionNodeResponse { runId: string; nodeId: string; rewards: Record<string, number>; pendingRewards: Record<string, number>; cappedCurrencies: string[]; alreadyCompleted: boolean; }

/** 인증된 서버 응답에서만 내려오는 슬롯별 운영 정책이며 앱 번들의 정적 표를 운영 기준으로 쓰지 않는다. */
export interface AdSlotOperationsDto {
  /** 로그·검증 요청·운영 집계를 연결하는 변경되지 않는 슬롯 식별자다. */
  slotId: string;
  /** false이면 UI는 제안을 숨기되 원래 보상과 콘텐츠 진행은 그대로 제공한다. */
  enabled: boolean;
  /** 서버 UTC 날짜 하나에 검증·지급할 수 있는 최대 완료 횟수다. */
  dailyLimitUtc: number;
  /** 주간 제한이 있는 슬롯은 현재 서버 주차의 한도와 사용량을 함께 내려준다. */
  weeklyLimitUtc?: number;
  weeklyClaims?: number;
  /** 빠른 원정처럼 서버 기록을 환산하는 슬롯만 현재 유효 기준값을 공개한다. */
  referenceScore?: number;
  /** 표시와 실제 지급이 같은 서버 값을 사용하도록 화폐와 수량을 함께 전달한다. */
  /** 허용된 판별 합집합 그대로 내려 UI가 임의 효과를 만들 수 없게 한다. */
  reward: AdReward;
  /** 운영 문구는 번들 기본값이 아니라 서버가 확정해 전달한다. */
  displayText: string;
}

/** 로그인된 API 채널이 전달하는 광고 운영 설정의 버전·유효 기간 포함 계약이다. */
export interface AdOperationsConfigResponse {
  /** 캐시와 지표가 어떤 운영 정책을 사용했는지 감사할 수 있는 불변 버전이다. */
  configVersion: string;
  /** 클라이언트 시계 대신 설정 신선도를 판단할 인증 서버의 UTC 시각이다. */
  serverTime: string;
  /** 만료되거나 조회에 실패한 설정은 광고 비활성으로 처리하고 게임 기본 흐름은 계속한다. */
  expiresAt: string;
  /** 응답에 없는 슬롯도 비활성으로 간주해 오래된 앱이 임의 기본값으로 광고를 켜지 않게 한다. */
  slots: AdSlotOperationsDto[];
}

/** 광고 제공 불가는 결제·재화·콘텐츠 오류 코드와 분리되는 선택 기능의 종료 사유다. */
export type AdUnavailableReason = "sdk_not_initialized" | "network" | "consent" | "no_inventory" | "config_disabled" | "config_unavailable";

/** 광고 어댑터 결과는 실패 시 검증 토큰을 만들지 않으며 호출자는 원래 게임 흐름을 계속한다. */
export type AdPresentationResult =
  | { status: "completed"; verificationToken: string }
  | { status: "unavailable"; reason: AdUnavailableReason }
  | { status: "dismissed" | "failed"; reason?: string };

/** 슬롯별 퍼널과 광고 전후 이탈을 개인 식별 없이 집계할 때 쓰는 사건 이름이다. */
export type AdFunnelMetricName = "offer_shown" | "watch_started" | "watch_completed" | "watch_failed" | "reward_verification_succeeded" | "reward_duplicate_rejected" | "exit_before_ad" | "exit_after_ad";

/** 광고 퍼널 사건은 슬롯·설정 버전만 담고 SDK 토큰이나 사용자 식별자를 담지 않는다. */
export interface AdFunnelMetric {
  name: AdFunnelMetricName;
  slotId: string;
  configVersion: string;
  occurredAt: string;
  /** 실패 분류는 SDK/네트워크/동의/재고 상태를 집계하며 자유 형식 개인정보를 받지 않는다. */
  failureReason?: AdUnavailableReason | "dismissed" | "verification_invalid";
}

/** 광고 이용 여부별 재화 획득량 비교는 사용자 ID 대신 집계 코호트와 획득 출처만 전달한다. */
export interface AdCurrencyEarningMetric {
  name: "currency_earned";
  cohort: "ad_user" | "non_ad_user";
  currency: keyof Wallet;
  amount: number;
  source: "ad_reward" | "gameplay" | "mission" | "purchase" | "other";
  occurredAt: string;
}

/** 동의 경계 밖 기본 전송은 개인·광고 식별자를 표현할 필드 자체를 제공하지 않는다. */
export interface ContextualAdMetricsRequest {
  privacyScope: "contextual";
  events: Array<AdFunnelMetric | AdCurrencyEarningMetric>;
}

/** 플랫폼 추적 동의 뒤에만 광고 식별 연계가 필요한 별도 파이프라인을 명시적으로 선택한다. */
export interface ConsentedAdMetricsRequest {
  privacyScope: "consented_ad_tracking";
  advertisingTrackingConsent: true;
  /** 원본 플랫폼 광고 ID가 아니라 서버가 회전·가명화한 식별자만 허용한다. */
  pseudonymousSubjectId: string;
  events: Array<AdFunnelMetric | AdCurrencyEarningMetric>;
}

/** 호출부가 동의 상태와 맞지 않는 식별 포함 요청을 타입 단계에서 만들지 못하게 하는 합집합이다. */
export type AdMetricsRequest = ContextualAdMetricsRequest | ConsentedAdMetricsRequest;

/** 지표 수집 실패가 게임이나 보상 검증을 막지 않도록 수락 건수만 돌려주는 독립 응답이다. */
export interface AdMetricsResponse { accepted: number; }

/** 서버 계정에 활성화된 연구 후원 권리다. null 만료는 영구이며 판정 기준 시각도 함께 내려간다. */
export interface PassEntitlementDto { entitlementId: string; productId: string; activatedAt: string; expiresAt: string | null; active: boolean; serverTime: string; }
/** 플랫폼 영수증 재시도는 요청 ID로 같은 검증 결과를 돌려받는다. */
export interface VerifyPurchaseReceiptRequest { productId: string; platform: "apple" | "google" | "test"; receipt: string; requestId: string; }
export interface VerifyPurchaseReceiptResponse { verificationId: string; productId: string; transactionId: string; verified: true; serverTime: string; }
/** 검증 결과를 권리로 바꾸는 단계도 별도 멱등 키를 가져 네트워크 재시도 중 이중 활성화를 막는다. */
export interface ActivatePassRequest { verificationId: string; requestId: string; }
export interface ActivatePassResponse { entitlement: PassEntitlementDto; grants: readonly ProductGrant[]; }
/** 패스 즉시 수령은 광고 토큰 없이 권리와 서버 UTC 카운터를 검증한다. */
export interface ClaimInstantAdRewardRequest { entitlementId: string; slotId: string; requestId: string; }
export interface ClaimInstantAdRewardResponse extends ClaimAdRewardResponse { entitlement: PassEntitlementDto; dailyBonus?: { currency: "gems"; amount: number }; }

/** 임무 화면에 필요한 진행·보상·수령 상태를 한 행으로 전달한다. */
export interface MissionDto { id: string; period: MissionPeriod; title: string; progress: number; target: number; rewardCheesecake: number; researchPoints: number; claimed: boolean; }
/** 연구도 마디는 정적 보상과 서버가 확정한 달성·수령 상태를 함께 전달한다. */
export interface ResearchRewardStageDto { id: string; threshold: number; rewardCheesecake: number; achieved: boolean; claimed: boolean; }
export interface PeriodResearchDto { points: number; maxPoints: number; stages: ResearchRewardStageDto[]; }
/** 목록 응답은 로비 배지에서 바로 쓸 미수령 개수를 포함한다. */
export interface MissionListResponse { missions: MissionDto[]; claimableCount: number; research: Record<MissionPeriod, PeriodResearchDto>; }
/** 받은 편지함 데이터가 없는 화면이 상태를 추측하지 않도록 마련한 명시적 서버 계약이다. */
export interface NotificationSignalsResponse { pendingFriendRequestCount: number; unseenEventCount: number; unreadMailCount: number; }
/** 일괄 또는 선택 수령 뒤 지급 총액과 최신 상태를 반환한다. */
export interface ClaimMissionRewardsResponse extends PlayerStateDto { claimedIds: string[]; claimedResearchStageIds: string[]; rewards: { missionCheesecake: number; researchCheesecake: number; cheesecake: number }; cheesecakeEarned: number; }

/** 상품 목록은 정적 정의에 서버가 계산한 현재 구매 가능 횟수를 결합한다. */
export interface ProductDto { id: string; storefront: ProductStorefront; category: ShopCategory; iconKey: ShopProductIconKey; name: string; description: string; acquisition: ProductAcquisition; grants: readonly ProductGrant[]; defaultQuantity: number; passBenefit?: PassBenefitDefinition; purchaseLimit: number; refresh: ProductRefresh; remaining: number; purchasable: boolean; disabledReason?: string; }
/** 상품 조회 응답은 서버 시각 기준으로 노출 중인 상품만 담는다. */
export interface ProductListResponse { products: ProductDto[]; serverTime: string; }
/** 구매 요청은 영속 상품 ID와 사용자가 팝업에서 확정한 묶음 수량을 함께 보낸다. */
export interface PurchaseProductRequest { storefront: ProductStorefront; productId: string; quantity: number; }
/** 인게임 상품의 차감·지급·제한 갱신이 모두 끝난 뒤의 응답이다. */
export interface PurchaseProductResponse extends PlayerStateDto { productId: string; quantity: number; /** 상품 정의가 아니라 이번 처리에서 서버가 확정한 총 지급 결과다. */ granted: readonly ProductGrant[]; remaining: number; /** 이번 구매에서 서버가 생성한 완성 룬들이다. */ grantedRunes: RuneInstance[]; }
/** DNA 교환 요청은 무작위 시드가 아니라 선택한 교환품과 필요할 때 렐릭 대상을 명시한다. */
export interface ExchangeDnaRequest { offerId: string; relicId?: string; }
/** 서버가 확정한 선택 보상과 잔여 DNA를 반환해 UI가 추첨 연출을 만들지 않게 한다. */
export interface ExchangeDnaResponse extends PlayerStateDto { offerId: string; rewardKind: DnaExchangeKind; relicId?: string; /** 교환 결과가 룬일 때 서버가 생성한 완성 인스턴스다. */ grantedRune?: RuneInstance; }

/** 발굴 요청에는 클라이언트가 선택한 배너와 횟수만 보낸다. */
export interface PullRequest {
  bannerId: string;
  count: 1 | 10;
}

/** 네트워크 슬롯은 렐릭 수집 변화와 수량형 재화를 판별자로 안전하게 분리한다. */
export type PullResultDto =
  | ({ type: "relic" } & AcquisitionResult)
  | { type: "currency"; currency: QuantityRewardKind; amount: number; grade: "GRAY" };

/** 서버가 확정한 캐릭터 연구 결과와 그 직후 상태다. */
export interface PullResponse extends PlayerStateDto {
  /** 추첨 순서를 보존하며 각 슬롯의 신규/숙련/상한 변화를 명시한다. */
  results: PullResultDto[];
  newRelicIds: string[];
  duplicateRelicIds: string[];
}

/** UI가 서버 실패 원인을 문구로 바꿀 수 있게 고정한 오류 코드다. */
export type ApiErrorCode = "INSUFFICIENT_STAMINA" | "EXPEDITION_RUN_NOT_FOUND" | "EXPEDITION_ALREADY_SETTLED" | "EXPEDITION_ALREADY_ACTIVE" | "EXPEDITION_WEEKLY_LIMIT" | "EXPEDITION_SCORE_REQUIRED" | "AD_WEEKLY_LIMIT" | "EXPEDITION_SCORE_REJECTED" | "EXPEDITION_REWARD_NOT_FOUND" | "EXPEDITION_REWARD_NOT_EARNED" | "ITEM_NOT_FOUND" | "ITEM_NOT_USABLE" | "INVALID_ITEM_QUANTITY" | "INVALID_PURCHASE_QUANTITY" | "INSUFFICIENT_ITEMS" | "STAMINA_FULL" | "AD_SLOT_NOT_FOUND" | "AD_TOKEN_INVALID" | "AD_REQUEST_DUPLICATE" | "AD_DAILY_LIMIT" | "RECEIPT_INVALID" | "PASS_NOT_FOUND" | "PASS_EXPIRED" | "BANNER_NOT_FOUND" | "INSUFFICIENT_CURRENCY" | "INSUFFICIENT_GOLD" | "INVALID_PULL_COUNT" | "RELIC_NOT_FOUND" | "RELIC_MAX_LEVEL" | "RUNE_NOT_FOUND" | "RUNE_ENHANCEMENT_COMPLETE" | "RUNE_STAT_EXHAUSTED" | "RUNE_ENGRAVING_NOT_ALLOWED" | "INVALID_RUNE_NAME" | "INVALID_RUNE_SLOT" | "RUNE_ALREADY_EQUIPPED" | "RUNE_SLOT_MISMATCH" | "RUNE_SLOT_EMPTY" | "INVALID_RUNE_SALE" | "RUNE_EQUIPPED" | "RUNE_LOCKED" | "STAGE_NOT_FOUND" | "DAILY_ENTRY_LIMIT" | "MISSION_NOT_FOUND" | "MISSION_NOT_COMPLETE" | "MISSION_ALREADY_CLAIMED" | "PRODUCT_NOT_FOUND" | "PRODUCT_STOREFRONT_MISMATCH" | "PRODUCT_NOT_VISIBLE" | "PURCHASE_LIMIT_REACHED" | "PLATFORM_PAYMENT_REQUIRED" | "ACQUISITION_FLOW_REQUIRED" | "DNA_OFFER_NOT_FOUND" | "INVALID_EXCHANGE_TARGET" | "DUPLICATE_GRANT" | "INVALID_STATE" | "CURRENCY_LIMIT_EXCEEDED" | "EVENT_NOT_FOUND" | "EVENT_NOT_ACTIVE";

/**
 * 급여 응답.
 *
 * 요청한 횟수를 다 먹이지 못할 수도 있으므로(치즈케이크 부족·레벨 상한) 실제로 소비한 횟수와
 * 그때 오른 레벨 수를 함께 돌려준다. 화면은 이 값으로만 연출을 정한다.
 */
export interface FeedRelicResponse extends PlayerStateDto { relicId: string; feeds: number; cheesecakeSpent: number; levelsGained: number; }
/** 돌파 결과. 열린 상한을 함께 돌려줘 화면이 표를 다시 뒤지지 않게 한다. */
export interface BreakThroughResponse extends PlayerStateDto { relicId: string; breakthrough: number; levelCap: number; /** 돌파 뒤의 별(1~5). */ stars: number; /** 남은 그 개체의 파편. */ fragments: number; }
/** 전투 확인 시 저장되는 보상으로 최초 여부와 획득 치즈케이크를 결과 UI에 그대로 전달한다. */
export interface CompleteStageResponse extends PlayerStateDto { stageId: string; firstClear: boolean; cheesecakeEarned: number; }
/** 입장 영수증은 재시도에 그대로 반환되며 확정 뒤 클라이언트 로딩 실패는 자동 환불하지 않는다. */
export interface EnterStageRequest { stageId: string; requestId: string; }
export interface EnterStageResponse extends PlayerStateDto { stageId: string; requestId: string; staminaSpent: number; refundPolicy: "no-refund-after-admission"; }
/** 로비 터치 결과는 중복 여부와 대사 UI가 표시할 유대 변화량을 돌려준다. */
export interface LobbyInteractionResponse extends PlayerStateDto { relicId: string; bondXpEarned: number; bondLevelsGained: number; }
/** 일일 입장 소비와 즉시 지급된 프로토타입 보상을 한 응답으로 확정한다. */
export interface EnterDailyRestorationResponse extends PlayerStateDto { entriesRemaining: number; cheesecakeEarned: number; }
/** 클라이언트가 자체 시계를 보지 않도록 서버 시각과 판정 상태를 함께 보낸다. */
export interface EventDto extends EventDefinition { status: "upcoming" | "active" | "ended"; }
export interface EventListResponse { events: EventDto[]; serverTime: string; }
/** 입장 허가 뒤에도 기존 StageDef로 같은 전투 엔진을 사용한다. */
export interface EnterEventStageResponse { eventId: string; stage: StageDef; serverTime: string; }

/** 클라이언트 점수가 아니라 재연산 가능한 동작열만 받는 주간 보스 제출 계약이다. */
export interface SubmitExpeditionBossScoreRequest { requestId: string; runId?: string; nodeId?: string; actions: ExpeditionBossAction[]; }
/** 전멸 순간 서버가 확정한 점수와 최고/누적 기록이다. */
export interface SubmitExpeditionBossScoreResponse { weekKey: string; score: number; bestScore: number; cumulativeScore: number; improved: boolean; endedAtMs: number; rankBefore: number | null; rankAfter: number; }
/** 주간 최고 점수와 월요일 00:00 UTC 초기화 경계를 함께 전달한다. */
/** 운영 보상 수치와 수령 상태는 서버 스냅샷만 화면의 기준으로 삼는다. */
export interface ExpeditionRewardStageDto { id: string; threshold: number; reward: { currency: "gold" | "fossil" | "gems"; amount: number }; claimed: boolean; }
export interface ExpeditionWeeklyBestResponse { weekKey: string; bestScore: number; cumulativeScore: number; resetsAt: string; rewardStages: ExpeditionRewardStageDto[]; }
/** 누적 단계는 정적 표 ID로 요청하고 실제 서버가 달성 및 기존 수령을 다시 검사한다. */
export interface ClaimExpeditionRewardRequest { requestId: string; stageId: string; }
export interface ClaimExpeditionRewardResponse { weekKey: string; stageId: string; claimedStageIds: string[]; reward: { currency: "gold" | "fossil" | "gems"; amount: number }; alreadyClaimed: boolean; wallet: PlayerStateDto["wallet"]; }
/** 동점은 최고 점수 달성 시각이 빠른 이용자를 우선하며 그 뒤 안정적인 playerId 순으로 정렬한다. */
export interface ExpeditionLeaderboardEntry { rank: number; playerId: string; displayName: string; score: number; achievedAt: string; isMe: boolean; }
export interface ExpeditionLeaderboardResponse { weekKey: string; tieBreakPolicy: "earliest-achieved-at"; entries: ExpeditionLeaderboardEntry[]; }
/** 직접 플레이하지 않고 역대 최고 점수 일부와 절반의 노드 클리어 전리품만 즉시 정산하는 소탕 요청이다. */
export interface SweepExpeditionRequest { requestId: string; }
export interface SweepExpeditionResponse extends PlayerStateDto { weekKey: string; scoreGain: number; bestScore: number; cumulativeScore: number; granted: Record<string, number>; playsThisWeek: number; }

/** 실제 HTTP API로 교체할 때도 씬이 의존할 단 하나의 통신 인터페이스다. */
export interface GameApi extends AsyncArenaProfileApi {
  /** 서버 시각 기준의 우편 목록과 알림 집계를 조회한다. */
  getMails(): Promise<MailListResponse>;
  /** 지정한 우편 첨부물을 한 트랜잭션과 멱등 키로 수령한다. */
  claimMailRewards(request: ClaimMailRewardsRequest): Promise<ClaimMailRewardsResponse>;
  /** 열람한 우편을 읽음으로 확정한다. */
  markMailsRead(request: MarkMailsReadRequest): Promise<MailListResponse>;
  /** 서버 UTC 주차의 최고/누적 기록을 조회한다. */
  getExpeditionWeeklyBest(): Promise<ExpeditionWeeklyBestResponse>;
  /** 동작열을 서버 편성으로 재현하고 전멸 결과만 점수로 제출한다. */
  submitExpeditionBossScore(request: SubmitExpeditionBossScoreRequest): Promise<SubmitExpeditionBossScoreResponse>;
  /** 달성한 누적 단계 보상을 서버 멱등 기록으로 수령한다. */
  claimExpeditionReward(request: ClaimExpeditionRewardRequest): Promise<ClaimExpeditionRewardResponse>;
  /** 서버가 소유한 주간 순위표를 동점 정책에 따라 조회한다. */
  getExpeditionLeaderboard(limit?: number): Promise<ExpeditionLeaderboardResponse>;
  /** 룬·지갑·스택을 저장 모델 변경 없이 합성해 조회한다. */
  getInventory(): Promise<InventoryResponse>;
  /** 검증·효과·차감·저장을 하나의 서버 처리로 확정한다. */
  useConsumable(request: UseConsumableRequest): Promise<UseConsumableResponse>;
  /** 재화 차감과 스테미나 회복을 한 처리 단위로 확정한다. 화면은 결과만 다시 읽는다. */
  rechargeStamina(request: RechargeStaminaRequest): Promise<RechargeStaminaResponse>;
  /** 장착 검증과 지갑 상한을 통과한 룬 판매를 서버가 원자 확정한다. */
  sellRunes(request: SellRunesRequest): Promise<SellRunesResponse>;
  /** 조회 자체가 서버 시각까지의 생산분을 원자적으로 정산한다. */
  getIdleExcavation(): Promise<IdleExcavationResponse>;
  saveExcavationFormation(request: SaveExcavationFormationRequest): Promise<IdleExcavationResponse>;
  harvestExcavation(request: HarvestExcavationRequest): Promise<HarvestExcavationResponse>;
  getPlayerState(): Promise<PlayerStateDto>;
  /** 광고 제안은 조회 성공한 서버 운영 설정만 표시 기준으로 사용한다. */
  getAdOperationsConfig(): Promise<AdOperationsConfigResponse>;
  /** 광고 완료 증명을 검증하고 멱등성·UTC 제한·지급·저장을 한 처리로 확정한다. */
  claimAdReward(request: ClaimAdRewardRequest): Promise<ClaimAdRewardResponse>;
  /** 임시 보상 이전과 런 완료 표시를 하나의 원자 저장으로 확정한다. */
  settleExpeditionRun(request: SettleExpeditionRunRequest): Promise<SettleExpeditionRunResponse>;
  /** 모든 노드의 방문·HP·보상을 서버가 한 처리로 확정한다. */
  completeExpeditionNode(request: CompleteExpeditionNodeRequest): Promise<CompleteExpeditionNodeResponse>;
  /** 진행 중인 런이 없을 때만 주간 횟수 하나를 소비해 역대 최고점 일부와 절반의 전리품을 즉시 정산한다. */
  sweepExpedition(request: SweepExpeditionRequest): Promise<SweepExpeditionResponse>;
  /** 실제 결제 서버가 플랫폼 원본 영수증을 검증하며 요청 ID 재시도에는 같은 결과를 반환한다. */
  verifyPurchaseReceipt(request: VerifyPurchaseReceiptRequest): Promise<VerifyPurchaseReceiptResponse>;
  /** 검증된 거래를 기간 권리로 한 번만 활성화한다. */
  activatePass(request: ActivatePassRequest): Promise<ActivatePassResponse>;
  /** 활성 권리로 광고 슬롯의 원래 보상과 원래 UTC 일일 한도를 그대로 즉시 수령한다. */
  claimInstantAdReward(request: ClaimInstantAdRewardRequest): Promise<ClaimInstantAdRewardResponse>;
  pullRelics(request: PullRequest): Promise<PullResponse>;
  /** 급여로 경험치를 올린다. 횟수를 넘기면 한 번에 여러 번 먹인다. */
  feedRelic(relicId: string, feeds?: number): Promise<FeedRelicResponse>;
  /** 레벨 상한을 한 단계 연다. 재료 차감과 단계 확정을 한 처리로 맡는다. */
  breakThroughRelic(relicId: string): Promise<BreakThroughResponse>;
  /** 패배도 서버에 명시해 승리 전용 보상이 새지 않도록 한다. */
  completeStage(stageId: string, victory?: boolean): Promise<CompleteStageResponse>;
  /** 잔량 검증과 단 한 번의 차감을 서버 입장 트랜잭션으로 확정한다. */
  enterStage(request: EnterStageRequest): Promise<EnterStageResponse>;
  interactInLobby(relicId: string): Promise<LobbyInteractionResponse>;
  enterDailyRestoration(): Promise<EnterDailyRestorationResponse>;
  /** 이벤트 목록과 활성 상태는 서버 시각으로만 계산한다. */
  getEvents(): Promise<EventListResponse>;
  /** 종료된 이벤트 전투의 입장을 API 경계에서 차단한다. */
  enterEventStage(eventId: string, stageId: string): Promise<EnterEventStageResponse>;
  getMissions(): Promise<MissionListResponse>;
  /** 친구 요청·새 이벤트·우편의 실제 읽음 상태를 한 번에 조회한다. */
  getNotificationSignals(): Promise<NotificationSignalsResponse>;
  /** ID를 생략하면 현재 완료된 모든 미수령 임무를 한 저장 처리로 받는다. */
  claimMissionRewards(missionIds?: string[], researchPeriod?: MissionPeriod, researchStageIds?: string[]): Promise<ClaimMissionRewardsResponse>;
  /** 서버 시각과 구매 이력을 반영한 공용 카탈로그를 조회한다. */
  getProducts(storefront: ProductStorefront): Promise<ProductListResponse>;
  /** 인게임 재화 상품만 구매한다. 유료 상품은 플랫폼 결제/영수증 검증 경계를 사용해야 한다. */
  purchaseProduct(request: PurchaseProductRequest): Promise<PurchaseProductResponse>;
  /** DNA 조각을 요청에서 고른 보상으로 교환하며 랜덤 발굴 경로를 사용하지 않는다. */
  exchangeDna(request: ExchangeDnaRequest): Promise<ExchangeDnaResponse>;
  /** 룬의 한 옵션을 서버 난수로 한 번 강화한다. */
  enhanceRune(request: EnhanceRuneRequest): Promise<EnhanceRuneResponse>;
  /** 모든 일반 강화를 마친 룬에 서버 판정 각인을 한 번 적용한다. */
  engraveRune(request: EngraveRuneRequest): Promise<EngraveRuneResponse>;
  /** 서버 이름 정책을 통과한 사용자 이름으로 바꾼다. */
  renameRune(request: RenameRuneRequest): Promise<RenameRuneResponse>;
  /** 룬의 잠금·즐겨찾기 표시를 바꾼다. 잠긴 룬은 판매 경계가 직접 거부한다. */
  markRune(request: MarkRuneRequest): Promise<MarkRuneResponse>;
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
