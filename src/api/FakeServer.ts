import { canPull, pull, resolveAcquisitions, spend } from "../core/gacha";
import { BANNERS } from "../data/banners";
import { RELICS } from "../data/relics";
import { AD_REWARD_SLOTS, findAdRewardSlot, type AdReward } from "../data/adRewards";
import { consumeRestorationEntry, normalizeDailyContent } from "../core/dailyContent";
import { bountyEntriesRemaining, consumeBountyEntry, isBountyTierUnlocked, markBountyTierCleared, normalizeBounty } from "../core/bountyRun";
import { BOUNTY, getBountyTier } from "../data/bounty";
import { BREAKTHROUGH_CAP, breakthroughFragmentCost, canBreakThrough, canFeedRelic, feedRelic as calculateFeed, FEED_UNIT, nextBreakthrough, relicLevelCap, BREAKTHROUGH_GRADE_CAP, breakthroughGrade } from "../core/relicProgression";
import { BOND_XP_REWARD, grantBondXp, grantDailyLobbyBondXp } from "../core/bond";
import { MAX_RESEARCH_POINTS, MISSIONS, RESEARCH_REWARD_STAGES, addResearchPoints, applyMissionEvent, claimResearchStages, claimableMissionIds, normalizeMissions, researchPointsForClaim, researchStageClaimId, type MissionPeriod } from "../core/missions";
import { DAILY_RESTORATION, getStage } from "../data/stages";
import { CONTENT_STAMINA_COSTS } from "../data/contentCosts";
import { createEmptyRaidState, createInitialRelicProgress, replaceSession, session, type Session } from "../state/session";
import { saveManager } from "../state/SaveManager";
import { INTERACTION_CITIES, findInteractionCity } from "../data/interactionCities";
import { interactionDurationMs, interactionRewardWeights, isInteractionCityUnlocked, isInteractionDispatchComplete, validateInteractionFormation, type InteractionMemberTraits } from "../core/interactionDispatch";
import type {
  PurchaseRelicSkinRequest, PurchaseRelicSkinResponse, ClaimInteractionDispatchRequest, ClaimInteractionDispatchResponse, InteractionCitiesResponse, InteractionDispatchResponse, StartInteractionDispatchRequest } from "./contracts";
import { ProfileModifierManager } from "../managers/ProfileModifierManager";
import { GameApiError, persistenceFailed, type AdOperationsConfigResponse, type BreakThroughResponse, type ClaimMissionRewardsResponse, type CompleteStageResponse, type EnterDailyRestorationResponse, type EnterBountyRequest, type EnterBountyResponse, type CompleteBountyRequest, type CompleteBountyResponse, type BountyStatusResponse, type FeedRelicResponse, type GameApi, type LobbyInteractionResponse, type MissionListResponse, type PlayerStateDto, type ClaimAdRewardRequest, type ClaimAdRewardResponse, type PullRequest, type PullResponse, type RechargeStaminaRequest, type RechargeStaminaResponse } from "./contracts";
import type { ProductDefinition } from "../data/shopCatalog";
import { PRODUCTS } from "../data/shopCatalog";
import type { ProductListResponse, PurchaseProductRequest, PurchaseProductResponse } from "./contracts";
import { totalGrantAmount } from "../core/purchase";
import type { ExchangeDnaRequest, ExchangeDnaResponse } from "./contracts";
import { getRelicSkin } from "../data/relicSkins";
import { DNA_EXCHANGE_OFFERS, WALLET_CAPS } from "../data/economy";
import { EVENTS, findEventByProductId, findEventByStageId } from "../data/events";
import type { EventDefinition } from "../data/events/types";
import type { EnterEventStageResponse, EventListResponse } from "./contracts";
import { assertValidRuneInstance, canEngraveRune, canEnhanceRune, generateRune, runePartLabel, type RunePart, engraveRune as applyRuneEngraving, enhanceRune as applyRuneEnhancement, runeEnhancementAttempts, runeEnhancementIncrease, type RuneInstance, type RuneRarity } from "../core/runes";
import { runeEnhancementGoldCost, runeSellValue } from "../data/runes";
import { canUpgradeRuneTraitGrade, grantRuneTrait as rollRuneTrait, rerollRuneTrait as rollRuneTraitReroll, RUNE_TRAIT_RULES, upgradeRuneTraitGrade, type RuneTrait } from "../core/runeTraits";
import { RUNE_TRAIT_IDS, RUNE_TRAIT_ITEMS } from "../data/runeTraits";
import { beginStrataSiteCooldown, canDigStrataTile, createStrataBoard, digStrataTile as digTile, nextStrataChargeAt, settleStrataCharges, strataBoardView, strataSiteCooldownUntil } from "../core/strataDig";
import { findStrataLayer, STRATA_CHARGE } from "../data/strataLayers";
import { ARCHAEOLOGY_SITES, findArchaeologySite } from "../data/archaeologySites";
import { archaeologySiteAvailability } from "../core/archaeologyMap";
import type { AbandonStrataRunRequest, ArchaeologyStateResponse, DigStrataTileRequest, DigStrataTileResponse, GrantRuneTraitRequest, GrantRuneTraitResponse, RerollRuneTraitRequest, RerollRuneTraitResponse, ResolveRuneTraitRerollRequest, ResolveRuneTraitRerollResponse, StartStrataRunRequest, UpgradeRuneTraitRequest, UpgradeRuneTraitResponse } from "./contracts";
import { findItem } from "../data/items";
import { RAID_BOSS_BALANCE, RAID_CONTRIBUTION_REWARD_STAGES, RAID_DAILY_ATTEMPTS, RAID_DEFEAT_REWARD, RAID_SEASON_BOSS, RAID_SEASON_TOTAL_HP } from "../data/raid";
import { mockRaidContributions, raidBossDef, raidContributionBoard, raidEarnedContributionStageIds, raidSeasonElapsedDays, raidSeasonKey, raidSeasonProgress } from "../core/raid";
import { staminaCurrencyRecharge } from "../data/staminaRecharge";
import { settleStamina, staminaMaxForPlayer, staminaTiming } from "../core/stamina";
import { InventoryManager } from "../managers/InventoryManager";
import type { EngraveRuneRequest, EngraveRuneResponse, EnhanceRuneRequest, EnhanceRuneResponse, EquipRuneRequest, EquipRuneResponse, MarkRuneRequest, MarkRuneResponse, RenameRuneRequest, RenameRuneResponse, RuneInventoryDto, UnequipRuneRequest, UnequipRuneResponse, SellRunesRequest, SellRunesResponse } from "./contracts";
import type { ActivatePassRequest, ActivatePassResponse, ClaimInstantAdRewardRequest, ClaimInstantAdRewardResponse, PassEntitlementDto, VerifyPurchaseReceiptRequest, VerifyPurchaseReceiptResponse } from "./contracts";
import { excavationHarvestStatus, excavationProductionDisplayModel, excavationStorageLimitSeconds, harvestIdleExcavation, settleIdleExcavation, validateExcavationFormation } from "../core/idleExcavation";
import type { HarvestExcavationRequest, HarvestExcavationResponse, IdleExcavationResponse, SaveExcavationFormationRequest, InventoryResponse, UseConsumableRequest, UseConsumableResponse } from "./contracts";
import type { ClaimRaidRewardRequest, ClaimRaidRewardResponse, RaidSeasonResponse, SubmitRaidDamageRequest, SubmitRaidDamageResponse } from "./contracts";
import type { ClaimExpeditionRewardRequest, ClaimExpeditionRewardResponse, CompleteExpeditionNodeRequest, CompleteExpeditionNodeResponse, ExpeditionLeaderboardResponse, ExpeditionWeeklyBestResponse, SettleExpeditionRunRequest, SettleExpeditionRunResponse, SubmitExpeditionBossScoreRequest, SubmitExpeditionBossScoreResponse, SweepExpeditionRequest, SweepExpeditionResponse } from "./contracts";
import type { EnterStageRequest, EnterStageResponse } from "./contracts";
import type { CakeOperationCompleteRequest, CakeOperationCompleteResponse, CakeOperationEnterResponse, CakeOperationRunRequest, CakeOperationSweepResponse } from "./contracts";
import { cakeOperationRunCost, cakeOperationTierIndex, getCakeOperationTier, isCakeTierUnlocked } from "../data/cakeOperation";
import { applyDungeonMultiplier, isMultiplierUnlocked, normalizeMultiplier } from "../core/dungeonShortcut";
import type { ClaimMailRewardsRequest, ClaimMailRewardsResponse, MailDto, MailListResponse, MailRewardDto, MarkMailsReadRequest } from "./contracts";
import { expeditionWeekKey, resolveExpeditionBossBattle } from "../core/expeditionBoss";
import { EXPEDITION_BOSS_BALANCE, EXPEDITION_CUMULATIVE_REWARD_STAGES, EXPEDITION_NODE_REWARD_BALANCE, EXPEDITION_SWEEP_POLICY, EXPEDITION_WEEKLY_POLICY, QUICK_EXPEDITION_POLICY } from "../data/expedition";
import { calculateExpeditionNodeRewards, calculateExpeditionRunScore } from "../core/expeditionRewards";
import { calculateExpeditionNodeScore, expeditionBossDamageScore } from "../core/expeditionScore";
import { RelicProgressionManager } from "../managers/RelicProgressionManager";
import { expeditionBattleEffects } from "../core/expeditionBattle";
import { settingsManager } from "../managers/SettingsManager";
import { nextUtcDay } from "../core/notificationSchedule";
import { t } from "../i18n";

/** 사용자 룬 이름의 서버 정책이다. UI 글자 수와 무관하게 API 경계가 최종 권한을 가진다. */
export const MAX_RUNE_NAME_LENGTH = 20;

/** FakeServer의 지연과 난수원을 테스트에서 결정적으로 바꾸기 위한 선택 설정이다. */
export interface FakeServerOptions {
  latencyMs?: number;
  random?: () => number;
  /** 실제 서버 시각 대신 테스트에서 UTC 경계를 주입하는 날짜 공급자다. */
  now?: () => Date;
  /** 실제 백엔드에서는 광고 사업자 SSV에 위임하는 완료 토큰 검증기다. */
  verifyAdToken?: (token: string, slotId: string) => boolean | Promise<boolean>;
  /** 실제 백엔드에서는 Apple/Google 서버 검증으로 대체되는 테스트용 영수증 검증기다. */
  verifyPurchaseReceipt?: (receipt: string, productId: string) => string | null | Promise<string | null>;
  /** 저장 성공/실패를 결정적으로 재현하는 테스트용 어댑터이며, 생략하면 공유 세션만 SaveManager에 저장한다. */
  persistSession?: (next: Session) => void;
  /** 콘텐츠 시각의 소유 경계가 플랫폼 예약을 갱신하도록 주입하는 좁은 알림 계약이다. */
  notificationScheduler?: Pick<typeof settingsManager, "scheduleNotification" | "cancelNotification">;
}

/** 백엔드가 생기기 전까지 메모리 상태를 서버처럼 독점 변경하는 임시 어댑터다. */
export class FakeServer implements GameApi {
  /** 완료 수령 requestId의 최초 응답을 보존해 네트워크 재시도와 연타를 같은 영수증으로 묶는다. */
  private readonly interactionClaimResults = new Map<string, ClaimInteractionDispatchResponse>();
  /** 같은 밀리초에 출발한 파견끼리도 id가 갈리게 하는 증가 번호다. */
  private interactionSequence = 0;
  /** 실제 서버의 고유 requestId 영수증과 기간별 사용량 테이블을 흉내 낸다. */
  /** 임시 서버에는 결투장 백엔드가 없으므로 티어를 합성하지 않고 명시적으로 미제공한다. */
  async getAsyncArenaServerState(): Promise<null> { return null; }
  private readonly latencyMs: number;
  private readonly random: () => number;
  private readonly now: () => Date;
  private readonly verifyAdToken: (token: string, slotId: string) => boolean | Promise<boolean>;
  private readonly verifyReceipt: (receipt: string, productId: string) => string | null | Promise<string | null>;
  /** 테스트가 브라우저 저장소 없이 커밋 실패를 주입할 수 있는 선택 저장 경계다. */
  private readonly persistSession?: (next: Session) => void;
  private readonly notificationScheduler?: Pick<typeof settingsManager, "scheduleNotification" | "cancelNotification">;
  /** 아래 저장소들은 실제 서버의 고유 제약조건/트랜잭션을 흉내 내는 FakeServer 전용 멱등 기록이다. */
  private readonly receiptResults = new Map<string, VerifyPurchaseReceiptResponse>();
  private readonly verifiedTransactions = new Map<string, VerifyPurchaseReceiptResponse>();
  private readonly activationResults = new Map<string, ActivatePassResponse>();
  private readonly entitlements = new Map<string, PassEntitlementDto>();
  /** 물량형 던전의 멱등 저장소. 입장·결과·소탕이 각자의 요청 ID로 한 번만 확정된다. */
  private readonly cakeAdmissionResults = new Map<string, CakeOperationEnterResponse>();
  private readonly cakeCompletionResults = new Map<string, CakeOperationCompleteResponse>();
  private readonly cakeSweepResults = new Map<string, CakeOperationSweepResponse>();
  private readonly pendingCakeAdmissions = new Map<string, Set<string>>();
  private readonly instantClaimResults = new Map<string, ClaimInstantAdRewardResponse>();
  private readonly bonusClaimDates = new Map<string, string>();
  /** 실제 서버의 멱등 테이블을 흉내 내며 성공한 발굴 변경 응답만 보관한다. */
  private readonly excavationFormationResults = new Map<string, IdleExcavationResponse>();
  private readonly excavationHarvestResults = new Map<string, HarvestExcavationResponse>();
  /** 개발용 결정론적 메모리 기록이다. 운영 서버가 점수·순위·보상 수령을 최종 소유해야 한다. */
  private bossWeek = { weekKey: "", bestScore: 0, cumulativeScore: 0, achievedAt: "", claimedStageIds: [] as string[] };
  private readonly bossSubmissionResults = new Map<string, SubmitExpeditionBossScoreResponse>();
  private readonly bossRewardResults = new Map<string, ClaimExpeditionRewardResponse>();
  // 레이드도 원정과 같은 멱등 영수증을 쓴다 — 같은 요청 ID가 다시 오면 저장을 건드리지 않는다.
  private readonly raidSubmissionResults = new Map<string, SubmitRaidDamageResponse>();
  private readonly raidRewardResults = new Map<string, ClaimRaidRewardResponse>();
  /** 운영 DB의 런 ID/정산 ID 고유 제약과 빠른 원정 주간 카운터를 흉내 낸다. */
  private readonly expeditionSettlementResults = new Map<string, SettleExpeditionRunResponse>();
  /** 운영 DB의 requestId 고유 제약을 흉내 내 동일 노드 재요청을 같은 응답으로 돌린다. */
  private readonly expeditionNodeResults = new Map<string, CompleteExpeditionNodeResponse>();
  /** 소탕도 정산과 같은 멱등 계약을 흉내 낸다. */
  private readonly expeditionSweepResults = new Map<string, SweepExpeditionResponse>();
  private previousBossBest = 0;
  private quickWeek = { weekKey: "", claims: 0 };
  /** 같은 밀리초 안의 연속 발급도 구분하는 서버 인스턴스 로컬 순번이다. */
  private runeIssueSequence = 0;
  /** 개발 서버 재시작마다 같은 우편 원본에서 시작하되 읽음·수령 상태는 인스턴스 안에서만 변한다. */
  private readonly mails: MailDto[];
  /** 네트워크 재전송은 최초 영수증을 그대로 돌려줘 첨부물이 두 번 지급되지 않게 한다. */
  private readonly mailClaimResults = new Map<string, ClaimMailRewardsResponse>();
  /** 운영 DB의 requestId 고유 제약을 흉내 내 판매 재전송에 최초 확정 영수증을 돌려준다. */
  private readonly runeSaleResults = new Map<string, SellRunesResponse>();
  /** 일반 스테이지 입장 재전송이 중복 승리 대기 건을 만들지 않게 하는 서버 영수증 표다. */
  private readonly stageAdmissionResults = new Map<string, EnterStageResponse>();
  /** 입장 때 커밋한 요청을 보관하고 완료 정산이 해당 전투의 대기 건 하나만 소비하게 한다. */
  private readonly pendingStageAdmissions = new Map<string, Set<string>>();
  /** 현상수배 입장 재전송이 스테미나를 두 번 깎지 않게 하는 서버 영수증 표다. */
  private readonly bountyAdmissionResults = new Map<string, EnterBountyResponse>();
  /** 입장한 판의 등급. 정산이 영수증 없이 보상을 만들지 못하게 한다. */
  private readonly pendingBountyRuns = new Map<string, string>();

  constructor(
    private readonly state: Session = session,
    options: FakeServerOptions = {},
  ) {
    this.latencyMs = options.latencyMs ?? 180;
    this.random = options.random ?? Math.random;
    this.now = options.now ?? (() => new Date());
    // FakeServer 기본값은 테스트용 서명 형식이며 프로덕션 HTTP 서버는 반드시 SSV 검증기를 주입한다.
    this.verifyAdToken = options.verifyAdToken ?? ((token, slotId) => token === `verified:${slotId}`);
    this.verifyReceipt = options.verifyPurchaseReceipt ?? ((receipt, productId) => receipt.startsWith(`verified-receipt:${productId}:`) ? receipt.slice(`verified-receipt:${productId}:`.length) : null);
    this.persistSession = options.persistSession;
    // 독립 상태 테스트는 공유 세션의 알림 저장을 건드리지 않고, 실제 공유 API만 기본 manager를 쓴다.
    this.notificationScheduler = options.notificationScheduler ?? (state === session ? settingsManager : undefined);
    // 절대 시각을 고정해 테스트와 개발 빌드에서 내용·순서가 언제나 같게 한다.
    this.mails = [
      { id: "welcome-supply", title: t("mail.welcome.title"), sender: t("mail.welcome.sender"), body: t("mail.welcome.body"), sentAt: "2026-08-29T00:00:00.000Z", expiresAt: "2099-12-31T23:59:59.000Z", read: false, claimed: false, rewards: [{ kind: "currency", currency: "gold", amount: 1200 }] },
      { id: "field-notice", title: t("mail.notice.title"), sender: t("mail.notice.sender"), body: t("mail.notice.body"), sentAt: "2026-08-28T00:00:00.000Z", expiresAt: null, read: false, claimed: false, rewards: [] },
      { id: "archive-gift", title: t("mail.archive.title"), sender: t("mail.archive.sender"), body: t("mail.archive.body"), sentAt: "2026-08-27T00:00:00.000Z", expiresAt: null, read: true, claimed: true, rewards: [{ kind: "currency", currency: "gems", amount: 10 }] },
      { id: "expired-supply", title: t("mail.expired.title"), sender: t("mail.expired.sender"), body: t("mail.expired.body"), sentAt: "2026-08-01T00:00:00.000Z", expiresAt: "2026-08-10T00:00:00.000Z", read: true, claimed: false, rewards: [{ kind: "currency", currency: "fossil", amount: 50 }] },
    ];
  }

  /** 이름 대신 렐릭 정적 태그만 파견 규칙 입력으로 투영한다. */
  private interactionTraits(ids: readonly string[]): InteractionMemberTraits[] {
    return ids.map(id => { const relic = RELICS.find(candidate => candidate.id === id)!; return { id, element: relic.element, squad: relic.squad, tags: relic.squad === "gear" ? ["night-gear"] : [] }; });
  }

  async getInteractionCities(): Promise<InteractionCitiesResponse> { await this.delay(); return { cities: INTERACTION_CITIES.map(city => ({ ...city, unlocked: isInteractionCityUnlocked(city, this.state.cleared) })), serverTime: this.now().toISOString() }; }

  async getInteractionDispatch(): Promise<InteractionDispatchResponse> { await this.delay(); return this.interactionDispatchResponse(); }

  /** 세션의 슬롯 배열에서 살아 있는 파견만 추려 같은 모양으로 돌려준다. */
  private interactionDispatchResponse(): InteractionDispatchResponse {
    return { dispatches: this.state.interaction.slots.filter((slot): slot is NonNullable<typeof slot> => slot !== null).map((slot) => structuredClone(slot)), serverTime: this.now().toISOString() };
  }

  /** 출발 순간 서버가 편성·seed·결과와 절대 종료 시각을 함께 확정한다. */
  async startInteractionDispatch(request: StartInteractionDispatchRequest): Promise<InteractionDispatchResponse> {
    await this.delay(); const city = findInteractionCity(request.cityId);
    if (!city || !isInteractionCityUnlocked(city, this.state.cleared)) throw new GameApiError("INVALID_STATE", "개방되지 않은 교류 도시입니다.");
    // 도시마다 한 팀씩 나간다. 같은 도시에 두 팀을 겹쳐 보내면 어느 쪽 보상인지 화면이 말할 수 없다.
    if (this.state.interaction.slots.some((slot) => slot && slot.cityId === city.id && !slot.claimed)) throw new GameApiError("INVALID_STATE", "이미 이 도시에 파견 중입니다.");
    // 나가 있는 팀은 다른 도시에도 함께 나갈 수 없다.
    const away = new Set(this.state.interaction.slots.flatMap((slot) => slot && !slot.claimed ? slot.party : []));
    if (request.party.some((id) => away.has(id))) throw new GameApiError("INVALID_STATE", "이미 파견 중인 렐릭입니다.");
    const error = validateInteractionFormation(request.party, this.state.owned); if (error) throw new GameApiError("INVALID_STATE", `교류 편성이 올바르지 않습니다: ${error}`);
    const now = this.now(); const traits = this.interactionTraits(request.party); const weights = interactionRewardWeights(city.rewards, traits); const roll = this.random() * weights.reduce((a, b) => a + b, 0);
    let cursor = 0; const rewardIndex = Math.max(0, weights.findIndex(weight => (cursor += weight) > roll)); const reward = city.rewards[rewardIndex];
    // **같은 시각에 두 곳으로 나가도 id가 겹치지 않아야 한다.** 시각과 난수만으로 만들면 시계가
    // 멈춘 테스트나 같은 밀리초의 연속 출발에서 같은 id가 나오고, 그러면 수령이 엉뚱한 파견을
    // 집는다. 계정 안에서 증가하는 번호를 함께 넣는다.
    const sequence = `${now.getTime()}-${Math.floor(this.random() * 1e9)}-${(this.interactionSequence += 1)}`;
    const dispatch = { dispatchId: `interaction-${sequence}`, cityId: city.id, startedAt: now.toISOString(), completesAt: new Date(now.getTime() + interactionDurationMs(city, traits)).toISOString(), party: [...request.party], rewardSeed: sequence, reward: { currency: reward.currency, amount: reward.amount }, claimed: false };
    // 수령이 끝난 자리를 먼저 재사용하고, 없으면 새 자리를 잇는다.
    const free = this.state.interaction.slots.findIndex((slot) => slot === null || slot.claimed);
    if (free >= 0) this.state.interaction.slots[free] = dispatch; else this.state.interaction.slots.push(dispatch);
    saveManager.save(this.state); return this.interactionDispatchResponse();
  }

  /** 완료·ID를 다시 검사하고 지급/claimed/멱등 기록을 한 저장 처리로 확정한다. */
  async claimInteractionDispatch(request: ClaimInteractionDispatchRequest): Promise<ClaimInteractionDispatchResponse> {
    await this.delay(); const cached = this.interactionClaimResults.get(request.requestId); if (cached) return structuredClone(cached);
    if (!request.requestId) throw new GameApiError("INVALID_STATE", "교류 수령 요청 ID가 필요합니다.");
    const now = this.now(); const dispatch = this.state.interaction.slots.find((slot) => slot?.dispatchId === request.dispatchId) ?? null;
    if (!dispatch || dispatch.dispatchId !== request.dispatchId || !isInteractionDispatchComplete(dispatch.completesAt, now.getTime())) throw new GameApiError("INVALID_STATE", "완료된 교류 파견이 아닙니다.");
    const alreadyClaimed = dispatch.claimed; if (!alreadyClaimed) { this.state.wallet[dispatch.reward.currency] += dispatch.reward.amount; dispatch.claimed = true; this.state.interaction.claimedRequestIds.push(request.requestId); }
    const response = { ...this.interactionDispatchResponse(), serverTime: now.toISOString(), granted: alreadyClaimed ? { ...dispatch.reward, amount: 0 } : { ...dispatch.reward }, alreadyClaimed, wallet: { ...this.state.wallet } };
    this.interactionClaimResults.set(request.requestId, structuredClone(response)); saveManager.save(this.state); return response;
  }

  /** 읽음·수령·만료를 현재 서버 시각으로 집계한 복제본만 외부에 제공한다. */
  async getMails(): Promise<MailListResponse> { await this.delay(); return this.mailListDto(); }

  /** 존재·만료·기수령을 모두 검증한 뒤 지급과 상태 변경을 한 처리로 확정한다. */
  async claimMailRewards(request: ClaimMailRewardsRequest): Promise<ClaimMailRewardsResponse> {
    await this.delay(); const cached = this.mailClaimResults.get(request.requestId); if (cached) return structuredClone(cached);
    if (!request.requestId) throw new GameApiError("INVALID_STATE", "우편 수령 요청 ID가 필요합니다.");
    const ids = [...new Set(request.mailIds)]; const nowMs = this.now().getTime(); const targets = ids.map((id) => this.mails.find((mail) => mail.id === id));
    if (targets.some((mail) => !mail)) throw new GameApiError("INVALID_STATE", "존재하지 않는 우편입니다.");
    const claimable = (targets as MailDto[]).filter((mail) => mail.rewards.length > 0 && !mail.claimed && (!mail.expiresAt || Date.parse(mail.expiresAt) > nowMs));
    const granted: MailRewardDto[] = [];
    for (const mail of claimable) for (const reward of mail.rewards) {
      if (!Number.isInteger(reward.amount) || reward.amount <= 0) throw new GameApiError("INVALID_STATE", "올바르지 않은 우편 보상입니다.");
      if (reward.kind === "currency") this.state.wallet[reward.currency] = Math.min(WALLET_CAPS[reward.currency], this.state.wallet[reward.currency] + reward.amount);
      else { const definition = findItem(reward.itemId); if (!definition || definition.category === "rune" || definition.category === "currency") throw new GameApiError("INVALID_STATE", "올바르지 않은 우편 아이템입니다."); const stack = this.state.itemInventory.find(({ itemId }) => itemId === reward.itemId); if (stack) stack.quantity += reward.amount; else this.state.itemInventory.push({ itemId: reward.itemId, quantity: reward.amount }); }
      granted.push({ ...reward });
    }
    claimable.forEach((mail) => { mail.claimed = true; mail.read = true; }); this.persist(this.state);
    const list = this.mailListDto(); const response = { ...list, claimedMailIds: claimable.map(({ id }) => id), granted, wallet: { ...this.state.wallet }, items: (await this.getInventory()).items };
    this.mailClaimResults.set(request.requestId, structuredClone(response)); return response;
  }

  /** 안내 우편도 열람 즉시 점에서 빠지도록 읽음 상태만 안전하게 변경한다. */
  async markMailsRead(request: MarkMailsReadRequest): Promise<MailListResponse> { await this.delay(); const ids = new Set(request.mailIds); this.mails.forEach((mail) => { if (ids.has(mail.id)) mail.read = true; }); return this.mailListDto(); }

  /** 모든 우편 응답이 동일한 만료·집계 규칙을 공유한다. */
  private mailListDto(): MailListResponse { const serverTime = this.now().toISOString(); const nowMs = Date.parse(serverTime); const mails = structuredClone(this.mails); return { mails, serverTime, unreadCount: mails.filter((mail) => !mail.read && (!mail.expiresAt || Date.parse(mail.expiresAt) > nowMs)).length, claimableCount: mails.filter((mail) => !mail.claimed && mail.rewards.length > 0 && (!mail.expiresAt || Date.parse(mail.expiresAt) > nowMs)).length }; }

  /** 실제 통신처럼 다음 비동기 구간을 거친 뒤 직렬화 가능한 복사본을 돌려준다. */
  async getPlayerState(): Promise<PlayerStateDto> {
    await this.delay();
    return this.snapshot();
  }

  /** FakeServer도 서버 UTC 월요일 경계에서만 주간 기록을 초기화한다. */
  async getExpeditionWeeklyBest(): Promise<ExpeditionWeeklyBestResponse> {
    await this.delay(); const now = this.now(); this.normalizeBossWeek(now); const reset = new Date(`${this.bossWeek.weekKey}T00:00:00.000Z`); reset.setUTCDate(reset.getUTCDate() + 7);
    return { weekKey: this.bossWeek.weekKey, bestScore: this.bossWeek.bestScore, cumulativeScore: this.bossWeek.cumulativeScore, resetsAt: reset.toISOString(), rewardStages: EXPEDITION_CUMULATIVE_REWARD_STAGES.map((stage) => ({ ...stage, reward: { ...stage.reward }, claimed: this.bossWeek.claimedStageIds.includes(stage.id) })) };
  }

  /** 제출된 피해 숫자를 신뢰하지 않고 서버 편성의 정적 전투력으로 동작열을 완전히 재생한다. */
  async submitExpeditionBossScore(request: SubmitExpeditionBossScoreRequest): Promise<SubmitExpeditionBossScoreResponse> {
    await this.delay(); const cached = this.bossSubmissionResults.get(request.requestId); if (cached) return { ...cached };
    if (!request.requestId) throw new GameApiError("EXPEDITION_SCORE_REJECTED", "점수 제출 요청 ID가 필요합니다.");
    const now = this.now();
    const run = request.runId ? this.state.expedition.run : null;
    let result: ReturnType<typeof resolveExpeditionBossBattle>;
    let runScore: ReturnType<typeof calculateExpeditionRunScore>;
    try {
      // 이 좁은 경계는 행동 재현·서버 편성·최대 점수처럼 실제 제출 거절 사유만 변환한다.
      // 아래 저장 및 상태 반영 오류는 이 블록 밖에서 PERSISTENCE_FAILED로 전파한다.
      if (request.runId && (!run || run.runId !== request.runId || !run.nodes.some(({ id, type }) => id === request.nodeId && type === "boss"))) throw new Error("INVALID_RUN");
      const roster = run?.relics ?? this.state.party.map((relicId) => ({ relicId, currentHp: 100, alive: true }));
      const effects = expeditionBattleEffects(run?.selectedAugments ?? []);
      const progression = new RelicProgressionManager(this.state);
      const allies = roster.map(({ relicId: id }) => {
        const relic = RELICS.find((entry) => entry.id === id);
        if (!relic || !this.state.owned.has(id)) throw new Error("INVALID_PARTY");
        // 스킬 계약은 정적 정의에서, 계정별 수치만 서버 성장 스냅샷에서 가져온다.
        return { ...relic, stats: progression.getFinalStats(id) };
      });
      const boss = RELICS.find(({ id }) => id === "pontos");
      if (!boss) throw new Error("INVALID_BOSS_DEFINITION");
      result = resolveExpeditionBossBattle({
        allies, boss,
        initialHpPercentByRelic: Object.fromEntries(roster.map(({ relicId, currentHp }) => [relicId, currentHp])),
        augmentEffects: effects,
        // 서버와 BattleScene이 공유하는 논리 전장 크기다.
        arena: { left: 130, right: 950, top: 600, bottom: 1360 },
      }, request.actions);
      if (result.totalDamage > EXPEDITION_BOSS_BALANCE.maximumAcceptedScore) throw new Error("ABNORMAL_SCORE");
      runScore = calculateExpeditionRunScore({ normalNodeScoreTotal: run?.normalNodeScoreTotal ?? 0, bossDamageScore: expeditionBossDamageScore(result.totalDamage) });
    } catch (error) {
      // 검증 세부 원인은 공격자가 규칙을 역산하지 못하게 공용 거절 코드로만 노출한다.
      throw new GameApiError("EXPEDITION_SCORE_REJECTED", "검증할 수 없거나 비정상적으로 큰 보스 점수입니다.", { cause: error });
    }

    // 주차 정규화도 아직 공유 캐시에 쓰지 않는다. 저장 실패가 이번 제출의 누적 점수를 남겨서는 안 된다.
    const weekKey = expeditionWeekKey(now);
    const currentBossWeek = this.bossWeek.weekKey === weekKey
      ? this.bossWeek
      : { weekKey, bestScore: 0, cumulativeScore: 0, achievedAt: "", claimedStageIds: [] as string[] };
    const improved = runScore.runScore > currentBossWeek.bestScore;
    const nextBossWeek = { ...currentBossWeek, cumulativeScore: currentBossWeek.cumulativeScore + runScore.bossDamageScore };
    if (improved) { nextBossWeek.bestScore = runScore.runScore; nextBossWeek.achievedAt = now.toISOString(); }
    // 공유 run을 건드리지 않는 완전한 후보 상태에 피해·런 점수·역대 최고점을 모두 먼저 확정한다.
    const nextState = structuredClone(this.state);
    if (nextState.expedition.run) {
      nextState.expedition.run.bossDamage = runScore.bossDamageScore;
      nextState.expedition.run.bossDamageScore = runScore.bossDamageScore;
      nextState.expedition.run.runScore = runScore.runScore;
      nextState.expedition.run.bestScore = runScore.runScore;
    }
    nextState.expedition.allTimeBestScore = Math.max(nextState.expedition.allTimeBestScore, runScore.runScore);
    try {
      // 검증 성공 뒤의 저장만 공용 저장 실패로 바꾸며, 원래 Storage/SaveManager 오류는 cause에 보존한다.
      this.persist(nextState);
    } catch (error) {
      throw persistenceFailed(error, "error.persist.expeditionScore");
    }
    // 단 한 번의 저장이 성공한 뒤 루트 세션 정체성을 보존해 후보를 적용하고, 캐시와 영수증도 그 뒤 확정한다.
    if (this.state === session) replaceSession(nextState);
    else Object.assign(this.state, nextState);
    if (currentBossWeek !== this.bossWeek) this.previousBossBest = this.bossWeek.bestScore;
    this.bossWeek = nextBossWeek;
    const response = { weekKey: nextBossWeek.weekKey, score: runScore.runScore, normalNodeScoreTotal: runScore.normalNodeScoreTotal, bossDamageScore: runScore.bossDamageScore, runScore: runScore.runScore, bestScore: nextBossWeek.bestScore, cumulativeScore: nextBossWeek.cumulativeScore, improved, endedAtMs: result.endedAtMs, rankBefore: this.previousBossBest > 0 ? 1 : null, rankAfter: 1 };
    this.previousBossBest = nextBossWeek.bestScore;
    this.bossSubmissionResults.set(request.requestId, response);
    return { ...response };
  }

  /** 단계 ID와 누적 점수를 다시 확인하며 같은 요청과 다른 요청 모두 중복 지급하지 않는다. */
  async claimExpeditionReward(request: ClaimExpeditionRewardRequest): Promise<ClaimExpeditionRewardResponse> {
    await this.delay(); const cached = this.bossRewardResults.get(request.requestId); if (cached) return { ...cached, claimedStageIds: [...cached.claimedStageIds] };
    if (!request.requestId) throw new GameApiError("INVALID_STATE", "보상 수령 요청 ID가 필요합니다.");
    this.normalizeBossWeek(this.now()); const stage = EXPEDITION_CUMULATIVE_REWARD_STAGES.find(({ id }) => id === request.stageId);
    if (!stage) throw new GameApiError("EXPEDITION_REWARD_NOT_FOUND", "존재하지 않는 누적 보상 단계입니다.");
    if (this.bossWeek.cumulativeScore < stage.threshold) throw new GameApiError("EXPEDITION_REWARD_NOT_EARNED", "아직 달성하지 않은 누적 보상입니다.");
    const alreadyClaimed = this.bossWeek.claimedStageIds.includes(stage.id);
    if (!alreadyClaimed) { this.bossWeek.claimedStageIds.push(stage.id); this.state.wallet[stage.reward.currency] += stage.reward.amount; this.persist(this.state); }
    const response = { weekKey: this.bossWeek.weekKey, stageId: stage.id, claimedStageIds: [...this.bossWeek.claimedStageIds], reward: { ...stage.reward }, alreadyClaimed, wallet: { ...this.state.wallet } };
    this.bossRewardResults.set(request.requestId, response); return response;
  }

  /** 단일 개발 계정도 운영과 같은 점수 내림차순/최초 달성 오름차순 정책을 명시한다. */
  async getExpeditionLeaderboard(limit = 100): Promise<ExpeditionLeaderboardResponse> {
    await this.delay(); this.normalizeBossWeek(this.now()); const entries = this.bossWeek.bestScore > 0 ? [{ rank: 1, playerId: "local-player", displayName: t("profile.defaultName"), score: this.bossWeek.bestScore, achievedAt: this.bossWeek.achievedAt, isMe: true, favoriteRelicId: this.state.favorite }] : [];
    return { weekKey: this.bossWeek.weekKey, tieBreakPolicy: "earliest-achieved-at", entries: entries.slice(0, Math.max(0, limit)) };
  }


  /**
   * 시즌 경계와 일일 도전 횟수를 **읽기 전에** 정규화한다.
   *
   * 주차가 바뀌면 내 몫과 수령 기록이 함께 사라진다 — 시즌이 갖는 값이라 다음 시즌으로
   * 넘기면 새 보스를 열자마자 보상이 열려 있다. 도전 횟수는 UTC 날짜가 경계다.
   */
  private normalizeRaid(now: Date): void {
    const seasonKey = raidSeasonKey(now);
    const utcDate = now.toISOString().slice(0, 10);
    const raid = this.state.raid;
    const nextSeason = raid.seasonKey === seasonKey
      ? raid
      : { ...createEmptyRaidState(), seasonKey, attemptsUsed: raid.attemptsDate === utcDate ? raid.attemptsUsed : 0, attemptsDate: utcDate };
    const normalized = nextSeason.attemptsDate === utcDate ? nextSeason : { ...nextSeason, attemptsUsed: 0, attemptsDate: utcDate };
    if (normalized !== raid) { this.state.raid = normalized; this.persist(this.state); }
  }

  /**
   * 시즌 한 번의 전부를 한 응답으로 만든다.
   *
   * **함께 민 몫은 저장에서 읽지 않고 시즌 키에서 되풀이 계산한다**(`mockRaidContributions`).
   * 백엔드가 없어 지금은 그것이 다른 참가자를 대신하며, 실서버가 붙으면 이 한 줄이 서버
   * 집계로 바뀐다 — 그때 화면은 아무것도 고치지 않는다.
   */
  private raidSeasonDto(now: Date, limit = 100): RaidSeasonResponse {
    const seasonKey = raidSeasonKey(now);
    const raid = this.state.raid;
    const others = mockRaidContributions(seasonKey, raidSeasonElapsedDays(now));
    const mine = { playerId: "local-player", displayName: t("profile.defaultName"), damage: raid.myDamage, isMe: true, favoriteRelicId: this.state.favorite };
    const progress = raidSeasonProgress(others.reduce((sum, { damage }) => sum + damage, 0) + raid.myDamage, RAID_SEASON_TOTAL_HP);
    const earned = raidEarnedContributionStageIds(raid.myDamage);
    // 주차 경계는 원정과 같은 월요일 00:00 UTC라 다음 시즌 시작이 곧 이번 시즌의 초기화 시각이다.
    const resetsAt = new Date(Date.parse(`${seasonKey}T00:00:00.000Z`) + 7 * 86_400_000).toISOString();
    return {
      seasonKey,
      bossRelicId: RAID_SEASON_BOSS.relicId,
      bossLevel: RAID_SEASON_BOSS.level,
      bossFerocityLevel: RAID_SEASON_BOSS.ferocityLevel,
      bossBreakthrough: RAID_SEASON_BOSS.breakthrough,
      totalHp: progress.totalHp,
      dealtDamage: progress.dealtDamage,
      remainingHp: progress.remainingHp,
      defeated: progress.defeated,
      myDamage: raid.myDamage,
      attemptsUsed: raid.attemptsUsed,
      attemptsLimit: RAID_DAILY_ATTEMPTS,
      resetsAt,
      rewardStages: RAID_CONTRIBUTION_REWARD_STAGES.map((stage) => ({
        id: stage.id, threshold: stage.threshold,
        reward: { itemId: stage.reward.itemId, itemName: findItem(stage.reward.itemId)?.name ?? stage.reward.itemId, amount: stage.reward.amount },
        claimed: raid.claimedStageIds.includes(stage.id),
      })).filter((stage) => earned.includes(stage.id) || !stage.claimed),
      // 처치 보상은 실제로 눕힌 뒤에만 열리고, 시즌마다 한 번이다.
      defeatRewardClaimable: progress.defeated && !raid.defeatRewardClaimed,
      defeatRewardClaimed: raid.defeatRewardClaimed,
      entries: raidContributionBoard([...others, mine], limit),
    };
  }

  /** 화면은 이 응답만 읽고 남은 체력이나 기여 순서를 다시 계산하지 않는다. */
  async getRaidSeason(limit = 100): Promise<RaidSeasonResponse> {
    await this.delay(); this.normalizeRaid(this.now());
    return this.raidSeasonDto(this.now(), limit);
  }

  /**
   * 원정 보스와 **같은 재현기**로 한 판을 다시 돌리고 그 피해만 시즌 체력에서 깎는다.
   *
   * 클라이언트가 보낸 피해 숫자는 받지 않는다 — 계약에 아예 없다. 다른 것은 제한 시간과 단계
   * 이름뿐이라 재현 규칙을 하나 더 만들지 않고 `balance`만 레이드 표로 넘긴다.
   */
  async submitRaidDamage(request: SubmitRaidDamageRequest): Promise<SubmitRaidDamageResponse> {
    await this.delay();
    const cached = this.raidSubmissionResults.get(request.requestId);
    if (cached) return structuredClone(cached);
    if (!request.requestId) throw new GameApiError("RAID_SCORE_REJECTED", "피해 제출 요청 ID가 필요합니다.");
    const now = this.now();
    this.normalizeRaid(now);
    if (this.state.raid.attemptsUsed >= RAID_DAILY_ATTEMPTS) throw new GameApiError("RAID_DAILY_LIMIT", "오늘 도전 횟수를 모두 사용했습니다.");
    // 이미 누운 보스에는 더 밀 것이 없다. 다음 시즌이 열릴 때까지 도전 자체를 막는다.
    if (this.raidSeasonDto(now).defeated) throw new GameApiError("RAID_SEASON_DEFEATED", "이번 시즌 보스는 이미 토벌되었습니다.");

    let result: ReturnType<typeof resolveExpeditionBossBattle>;
    try {
      const progression = new RelicProgressionManager(this.state);
      const allies = this.state.party.map((id) => {
        const relic = RELICS.find((entry) => entry.id === id);
        if (!relic || !this.state.owned.has(id)) throw new Error("INVALID_PARTY");
        return { ...relic, stats: progression.getFinalStats(id) };
      });
      const base = RELICS.find(({ id }) => id === RAID_SEASON_BOSS.relicId);
      if (!base) throw new Error("INVALID_BOSS_DEFINITION");
      // 성장은 화면과 **같은 함수**를 지난다. 서버만 따로 계산하면 보여 준 레벨과 갈린다.
      const boss = raidBossDef(base);
      result = resolveExpeditionBossBattle({
        allies, boss, balance: RAID_BOSS_BALANCE,
        arena: { left: 130, right: 950, top: 600, bottom: 1360 },
      }, request.actions);
      if (result.totalDamage > RAID_BOSS_BALANCE.maximumAcceptedScore) throw new Error("ABNORMAL_SCORE");
    } catch (error) {
      // 검증 세부 원인은 공격자가 규칙을 역산하지 못하게 공용 거절 코드로만 노출한다.
      throw new GameApiError("RAID_SCORE_REJECTED", "검증할 수 없거나 비정상적으로 큰 레이드 피해입니다.", { cause: error });
    }

    const runDamage = Math.max(0, Math.floor(result.totalDamage));
    const nextState = structuredClone(this.state);
    nextState.raid.myDamage += runDamage;
    nextState.raid.attemptsUsed += 1;
    try {
      this.persist(nextState);
    } catch (error) {
      throw persistenceFailed(error, "error.persist.expeditionScore");
    }
    if (this.state === session) replaceSession(nextState);
    else Object.assign(this.state, nextState);
    const response: SubmitRaidDamageResponse = { season: this.raidSeasonDto(now), runDamage, endedAtMs: result.endedAtMs };
    this.raidSubmissionResults.set(request.requestId, response);
    return structuredClone(response);
  }

  /**
   * 기여 단계와 처치 보상을 한 처리 단위로 확정한다.
   *
   * 달성 여부와 중복 수령을 **서버가 다시 검사한다** — 화면이 보낸 단계 ID만 믿으면 아직 넘기지
   * 않은 문턱도 수령된다.
   */
  async claimRaidReward(request: ClaimRaidRewardRequest): Promise<ClaimRaidRewardResponse> {
    await this.delay();
    const cached = this.raidRewardResults.get(request.requestId);
    if (cached) return structuredClone(cached);
    const now = this.now();
    this.normalizeRaid(now);
    const season = this.raidSeasonDto(now);
    const isDefeat = request.stageId === "defeat";
    const stage = isDefeat ? undefined : RAID_CONTRIBUTION_REWARD_STAGES.find(({ id }) => id === request.stageId);
    if (!isDefeat && !stage) throw new GameApiError("RAID_REWARD_NOT_FOUND", "존재하지 않는 레이드 보상 단계입니다.");
    if (isDefeat && !season.defeated) throw new GameApiError("RAID_REWARD_NOT_EARNED", "아직 토벌하지 못한 보스입니다.");
    if (stage && this.state.raid.myDamage < stage.threshold) throw new GameApiError("RAID_REWARD_NOT_EARNED", "아직 달성하지 못한 기여 단계입니다.");

    const reward = isDefeat ? RAID_DEFEAT_REWARD : stage!.reward;
    const alreadyClaimed = isDefeat ? this.state.raid.defeatRewardClaimed : this.state.raid.claimedStageIds.includes(stage!.id);
    if (!alreadyClaimed) {
      const nextState = structuredClone(this.state);
      if (isDefeat) nextState.raid.defeatRewardClaimed = true;
      else nextState.raid.claimedStageIds = [...nextState.raid.claimedStageIds, stage!.id];
      const stack = nextState.itemInventory.find(({ itemId }) => itemId === reward.itemId);
      const cap = findItem(reward.itemId)?.maxStack ?? 9_999;
      if (stack) stack.quantity = Math.min(cap, stack.quantity + reward.amount);
      else nextState.itemInventory = [...nextState.itemInventory, { itemId: reward.itemId, quantity: Math.min(cap, reward.amount) }];
      this.persist(nextState);
      if (this.state === session) replaceSession(nextState);
      else Object.assign(this.state, nextState);
    }
    const response: ClaimRaidRewardResponse = {
      ...this.snapshot(), stageId: request.stageId, alreadyClaimed,
      reward: { itemId: reward.itemId, itemName: findItem(reward.itemId)?.name ?? reward.itemId, amount: reward.amount },
      season: this.raidSeasonDto(now),
    };
    this.raidRewardResults.set(request.requestId, response);
    return structuredClone(response);
  }

  /** 정상 종료와 포기를 같은 트랜잭션으로 처리하며 런당 최초 정산만 지갑에 반영한다. */
  async settleExpeditionRun(request: SettleExpeditionRunRequest): Promise<SettleExpeditionRunResponse> {
    await this.delay();
    const cached = this.expeditionSettlementResults.get(request.settlementId);
    if (cached) return structuredClone(cached);
    const run = this.state.expedition.run;
    if (!request.settlementId || !run || run.runId !== request.runId) throw new GameApiError("EXPEDITION_RUN_NOT_FOUND", "정산할 원정 런이 없습니다.");
    if (run.settled || run.settlementId) throw new GameApiError("EXPEDITION_ALREADY_SETTLED", "이미 정산한 원정 런입니다.");
    const wallet = { ...this.state.wallet }; const granted: Record<string, number> = {};
    // 임시 보상은 계정 지갑 상한까지의 정수만 이전하고 초과분은 지급하지 않는다.
    for (const [currency, raw] of Object.entries(run.pendingRewards)) {
      if (!(currency in WALLET_CAPS)) continue;
      const key = currency as keyof Session["wallet"]; const amount = Math.max(0, Math.floor(raw));
      const applied = Math.min(amount, WALLET_CAPS[key] - wallet[key]); wallet[key] += applied; granted[currency] = applied;
    }
    // 완료 런은 활성 슬롯에서 즉시 제거한다. 멱등 재응답은 아래 정산 결과 캐시가 소유하므로
    // settled 표식을 활성 run에 남겨 다음 진입을 가로막지 않는다.
    // 최고점은 정상 완료한 한 판 점수로 갱신한다. 주간 누적은 일반 노드와 보스 제출 시점에
    // 각각 한 번 반영했으므로 정산에서는 다시 더하지 않는다.
    const expedition = {
      ...this.state.expedition,
      playsThisWeek: this.state.expedition.playsThisWeek + 1,
      bestScore: request.outcome === "completed" ? Math.max(this.state.expedition.bestScore, calculateExpeditionRunScore(run).runScore) : this.state.expedition.bestScore,
      run: null,
    };
    this.persist({ ...this.state, wallet, expedition }); this.state.wallet = wallet; this.state.expedition = expedition;
    const response = { ...this.snapshot(), runId: run.runId, settlementId: request.settlementId, outcome: request.outcome, granted };
    this.expeditionSettlementResults.set(request.settlementId, response); return structuredClone(response);
  }

  /** 도달성과 HP를 검증한 뒤 서버 난수로 보상과 방문을 한 번에 저장한다. */
  async completeExpeditionNode(request: CompleteExpeditionNodeRequest): Promise<CompleteExpeditionNodeResponse> {
    await this.delay();
    const cached = this.expeditionNodeResults.get(request.requestId);
    if (cached) return structuredClone(cached);
    const run = this.state.expedition.run;
    const node = run?.nodes.find(({ id }) => id === request.nodeId);
    const predecessor = run?.currentNodeId ? run.nodes.find(({ id }) => id === run.currentNodeId) : null;
    if (!request.requestId || !run || run.runId !== request.runId || !node || run.settled || run.visitedNodeIds.includes(node.id)
      || (!predecessor && node.floor !== 1) || (predecessor && !predecessor.successorIds.includes(node.id)) || request.relicHp.length !== 3
      // HP는 전투 계약의 퍼센트 범위여야 하며 100 초과 값으로 생존 점수를 부풀릴 수 없다.
      || request.relicHp.some((hp) => !Number.isFinite(hp) || hp < 0 || hp > 100)) throw new GameApiError("EXPEDITION_RUN_NOT_FOUND", "완료할 수 없는 원정 노드입니다.");
    // 전멸은 노드 종료만 기록하고 승리 재화는 생성하지 않는다.
    const rewards = request.relicHp.every((hp) => hp === 0) ? {} : calculateExpeditionNodeRewards({ nodeType: node.type, accumulated: run.pendingRewards, random: this.random });
    // 전리품 수량은 점수가 아니다. 서버가 검증한 층과 종료 HP로 일반 노드 점수를 별도 확정한다.
    const scoreBearingNode = node.type === "normal" || node.type === "elite" || node.type === "horde";
    const cleared = scoreBearingNode && request.relicHp.some((hp) => hp > 0);
    // 요청 배열은 3인 편성 계약으로 검증됐으므로 서버가 평균 잔여 HP를 하나의 점수 입력으로 축약한다.
    const remainingHpPercent = request.relicHp.reduce((sum, hp) => sum + hp, 0) / request.relicHp.length;
    const nodeScore = calculateExpeditionNodeScore({ floor: node.floor, nodeType: node.type, remainingHpPercent, cleared });
    if (nodeScore > 0) { this.normalizeBossWeek(this.now()); this.bossWeek.cumulativeScore += nodeScore; }
    const next = structuredClone(run);
    next.currentNodeId = node.id; next.visitedNodeIds.push(node.id);
    next.normalNodeScoreTotal += nodeScore;
    const score = calculateExpeditionRunScore(next);
    next.runScore = score.runScore; next.bestScore = score.runScore;
    next.relics.forEach((relic, index) => { relic.currentHp = request.relicHp[index]; relic.alive = relic.currentHp > 0; });
    for (const [currency, amount] of Object.entries(rewards)) next.pendingRewards[currency] = (next.pendingRewards[currency] ?? 0) + amount;
    const cappedCurrencies = Object.keys(EXPEDITION_NODE_REWARD_BALANCE).filter((currency) => (next.pendingRewards[currency] ?? 0) >= EXPEDITION_NODE_REWARD_BALANCE[currency as keyof typeof EXPEDITION_NODE_REWARD_BALANCE].runCap);
    next.lastNodeRewards = { nodeId: node.id, nodeScore, rewards, cappedCurrencies };
    const expedition = { ...this.state.expedition, run: next };
    this.persist({ ...this.state, expedition }); this.state.expedition = expedition;
    const response = { runId: run.runId, nodeId: node.id, nodeScore, rewards, pendingRewards: { ...next.pendingRewards }, cappedCurrencies, alreadyCompleted: false };
    this.expeditionNodeResults.set(request.requestId, response);
    return structuredClone(response);
  }

  /**
   * 소탕: 직접 플레이하지 않고 역대 최고 점수의 일부와 절반의 노드 클리어 전리품만 즉시 정산한다.
   *
   * 진행 중인 런이 있으면 그 편성을 침범하지 않도록 거부하고, 이번 주 원정 기회를 이미 모두
   * 썼다면(소탕도 한 판으로 센다) 거부한다. 참조할 역대 최고점이 없는 신규 계정도 거부한다.
   */
  async sweepExpedition(request: SweepExpeditionRequest): Promise<SweepExpeditionResponse> {
    await this.delay();
    const cached = this.expeditionSweepResults.get(request.requestId);
    if (cached) return structuredClone(cached);
    if (!request.requestId) throw new GameApiError("INVALID_STATE", "소탕 요청 ID가 필요합니다.");
    if (this.state.expedition.run) throw new GameApiError("EXPEDITION_ALREADY_ACTIVE", "진행 중인 원정이 있어 소탕할 수 없습니다.");
    const now = this.now();
    const weekKey = expeditionWeekKey(now);
    if (this.state.expedition.weekKey !== weekKey) this.state.expedition = { ...this.state.expedition, weekKey, playsThisWeek: 0, bestScore: 0 };
    if (this.state.expedition.playsThisWeek >= EXPEDITION_WEEKLY_POLICY.maxPlaysPerWeek) throw new GameApiError("EXPEDITION_WEEKLY_LIMIT", "이번 주 원정 기회를 모두 사용했습니다.");
    const reference = this.state.expedition.allTimeBestScore;
    if (reference <= 0) throw new GameApiError("EXPEDITION_SCORE_REQUIRED", "소탕할 기준 점수가 없습니다.");

    this.normalizeBossWeek(now);
    const scoreGain = Math.floor(reference * EXPEDITION_SWEEP_POLICY.allTimeBestScoreRatio);
    this.bossWeek.cumulativeScore += scoreGain;
    if (scoreGain > this.bossWeek.bestScore) { this.bossWeek.bestScore = scoreGain; this.bossWeek.achievedAt = now.toISOString(); }

    const wallet = { ...this.state.wallet }; const granted: Record<string, number> = {};
    for (const [currency, balance] of Object.entries(EXPEDITION_NODE_REWARD_BALANCE)) {
      const key = currency as keyof Session["wallet"];
      if (!(key in WALLET_CAPS)) continue;
      const amount = Math.floor(balance.runCap * EXPEDITION_SWEEP_POLICY.lootRatio);
      const applied = Math.min(amount, WALLET_CAPS[key] - wallet[key]); wallet[key] += applied; granted[currency] = applied;
    }
    const expedition = { ...this.state.expedition, playsThisWeek: this.state.expedition.playsThisWeek + 1 };
    this.persist({ ...this.state, wallet, expedition }); this.state.wallet = wallet; this.state.expedition = expedition;
    const response = { ...this.snapshot(), weekKey: this.bossWeek.weekKey, scoreGain, bestScore: this.bossWeek.bestScore, cumulativeScore: this.bossWeek.cumulativeScore, granted, playsThisWeek: expedition.playsThisWeek };
    this.expeditionSweepResults.set(request.requestId, response);
    return structuredClone(response);
  }

  /** Fake 운영 서버도 번들의 표시 fallback 없이 인증된 설정 DTO를 명시적으로 제공한다. */
  async getAdOperationsConfig(): Promise<AdOperationsConfigResponse> {
    await this.delay(); const now = this.now();
    this.normalizeBossWeek(now); const quickScore = this.bossWeek.bestScore || this.previousBossBest;
    const weekKey = expeditionWeekKey(now); if (this.quickWeek.weekKey !== weekKey) this.quickWeek = { weekKey, claims: 0 };
    return { configVersion: "fake-2026-08-25", serverTime: now.toISOString(), expiresAt: new Date(now.getTime() + 300_000).toISOString(), slots: AD_REWARD_SLOTS.map((slot) => ({ slotId: slot.id, enabled: slot.placement !== "quick_expedition" || quickScore > 0, dailyLimitUtc: slot.dailyLimitUtc, displayText: slot.displayText, reward: slot.reward, ...("weeklyLimitUtc" in slot ? { weeklyLimitUtc: slot.weeklyLimitUtc, weeklyClaims: this.quickWeek.claims, referenceScore: quickScore } : {}) })) };
  }

  /** 세 저장 소유자를 읽기 전용 DTO로만 합성한다. */
  async getInventory(): Promise<InventoryResponse> {
    await this.delay();
    const manager = new InventoryManager(this.state);
    // DTO는 상태 식별자만 운반하고 표시 이름·아이콘은 클라이언트 manager가 로컬 카탈로그로 정규화한다.
    return { items: (["rune", "currency", "consumable", "material"] as const).flatMap((category) => manager.list(category).map((item) => ({ id: item.id, definitionId: item.definition.id, category: item.category, quantity: item.quantity, ...(item.kind === "rune" ? { rune: this.cloneRune(item.rune) } : {}) }))) };
  }

  /** 보유량과 상한을 복제 상태에서 검증한 뒤 차감·효과·저장을 한 번에 확정한다. */
  async useConsumable(request: UseConsumableRequest): Promise<UseConsumableResponse> {
    await this.delay();
    // 토닉 검증 전에 오프라인 자연 충전을 서버 시각까지 먼저 확정한다.
    this.settleStaminaNow();
    const definition = findItem(request.itemId);
    if (!definition) throw new GameApiError("ITEM_NOT_FOUND", "존재하지 않는 아이템입니다.");
    if (definition.category !== "consumable" || definition.useEffect.kind === "none") throw new GameApiError("ITEM_NOT_USABLE", "사용할 수 없는 아이템입니다.");
    if (!Number.isInteger(request.quantity) || request.quantity <= 0) throw new GameApiError("INVALID_ITEM_QUANTITY", "사용 수량이 올바르지 않습니다.");
    const stack = this.state.itemInventory.find(({ itemId }) => itemId === request.itemId);
    if (!stack || stack.quantity < request.quantity) throw new GameApiError("INSUFFICIENT_ITEMS", "아이템 수량이 부족합니다.");
    if (definition.useEffect.kind === "restore_stamina" && this.state.wallet.stamina >= staminaMaxForPlayer(this.state)) throw new GameApiError("STAMINA_FULL", "스테미나가 이미 가득 찼습니다.");
    const requested = definition.useEffect.amount * request.quantity;
    const appliedAmount = Math.min(requested, staminaMaxForPlayer(this.state) - this.state.wallet.stamina);
    const nextWallet = { ...this.state.wallet, stamina: this.state.wallet.stamina + appliedAmount };
    const left = stack.quantity - request.quantity;
    const nextItems = this.state.itemInventory.flatMap((entry) => entry.itemId === request.itemId ? (left > 0 ? [{ ...entry, quantity: left }] : []) : [{ ...entry }]);
    this.persist({ ...this.state, wallet: nextWallet, itemInventory: nextItems });
    this.state.wallet = nextWallet; this.state.itemInventory = nextItems;
    const inventory = await this.getInventory();
    return { ...inventory, itemId: request.itemId, quantityUsed: request.quantity, effect: definition.useEffect, appliedAmount, overflowAmount: requested - appliedAmount, wallet: { ...nextWallet }, stamina: this.staminaDto(this.now()) };
  }

  /**
   * 렐릭 추가 외형을 값으로 산다.
   *
   * **값은 화면이 아니라 콘텐츠 표가 갖는다**(`RELIC_SKINS`의 `price`). 전시관은 어떤 외형을
   * 사겠다는 것만 보내고, 여기서 그 표를 읽어 지갑과 대조한 뒤 차감과 지급을 한 처리로
   * 확정한다 — 화면이 값을 들고 있으면 그 값을 고친 날 전시대와 실제 차감이 갈린다.
   *
   * **이미 가진 외형은 멱등 성공이다.** 같은 요청이 두 번 와도(재전송·두 번 누름) 두 번
   * 치르지 않는다. 값이 없는 외형(보상·이벤트로만 오는 것)과 아직 열리지 않은 외형은
   * 살 수 있는 것이 아니므로 거절한다.
   */
  async purchaseRelicSkin(request: PurchaseRelicSkinRequest): Promise<PurchaseRelicSkinResponse> {
    await this.delay();
    const skin = getRelicSkin(request.skinId);
    if (!skin || skin.relicId !== request.relicId) throw new GameApiError("ITEM_NOT_FOUND", "존재하지 않는 외형입니다.");
    if (!this.state.owned.has(request.relicId)) throw new GameApiError("RELIC_NOT_FOUND", "보유하지 않은 렐릭입니다.");
    if (skin.comingSoon || !skin.price) throw new GameApiError("ITEM_NOT_USABLE", "살 수 있는 외형이 아닙니다.");
    const { currency, amount } = skin.price;
    if (this.state.ownedRelicSkinIds.has(request.skinId)) {
      return { ...this.snapshot(), skinId: request.skinId, spent: { currency, amount: 0 } };
    }
    if ((this.state.wallet[currency] ?? 0) < amount) throw new GameApiError("INSUFFICIENT_CURRENCY", "재화가 부족합니다.");
    const nextWallet = { ...this.state.wallet, [currency]: this.state.wallet[currency] - amount };
    const nextSkins = new Set(this.state.ownedRelicSkinIds);
    nextSkins.add(request.skinId);
    this.persist({ ...this.state, wallet: nextWallet, ownedRelicSkinIds: nextSkins });
    this.state.wallet = nextWallet; this.state.ownedRelicSkinIds = nextSkins;
    return { ...this.snapshot(), skinId: request.skinId, spent: { currency, amount } };
  }

  /**
   * 재화로 스테미나를 채운다.
   *
   * 화면은 값도 회복량도 계산하지 않는다 — 수단 ID만 보내고 서버가 표(`STAMINA_RECHARGE_SOURCES`)에서
   * 값을 읽어 차감과 회복을 한 처리 단위로 확정한다. 상한을 넘는 몫은 버리되 값은 그대로 받으므로,
   * 이미 가득 찬 상태에서는 아예 거절해 헛돈을 쓰지 않게 한다.
   */
  async rechargeStamina(request: RechargeStaminaRequest): Promise<RechargeStaminaResponse> {
    await this.delay();
    // 값을 치르기 전에 오프라인 자연 충전을 서버 시각까지 먼저 확정한다.
    this.settleStaminaNow();
    const source = staminaCurrencyRecharge(request.sourceId);
    if (!source) throw new GameApiError("INVALID_EXCHANGE_TARGET", "존재하지 않는 충전 수단입니다.");
    const maximum = staminaMaxForPlayer(this.state);
    if (this.state.wallet.stamina >= maximum) throw new GameApiError("STAMINA_FULL", "스테미나가 이미 가득 찼습니다.");
    if (this.state.wallet[source.currency] < source.cost) throw new GameApiError("INSUFFICIENT_CURRENCY", "재화가 부족합니다.");
    const appliedAmount = Math.min(source.amount, maximum - this.state.wallet.stamina);
    const nextWallet = {
      ...this.state.wallet,
      [source.currency]: this.state.wallet[source.currency] - source.cost,
      stamina: this.state.wallet.stamina + appliedAmount,
    };
    this.persist({ ...this.state, wallet: nextWallet });
    this.state.wallet = nextWallet;
    return {
      ...this.snapshot(),
      sourceId: source.id,
      spent: { currency: source.currency, amount: source.cost },
      appliedAmount,
      overflowAmount: source.amount - appliedAmount,
      stamina: this.staminaDto(this.now()),
    };
  }

  /** 서버의 단일 now 값을 캡처해 조회 정산과 응답 시각이 어긋나지 않게 한다. */
  async getIdleExcavation(): Promise<IdleExcavationResponse> {
    await this.delay(); const now = this.now();
    const next = settleIdleExcavation(this.state.idleExcavation, now, RELICS, this.state.relicProgress);
    this.persist({ ...this.state, idleExcavation: next }); this.state.idleExcavation = next;
    return this.idleExcavationResponse(next, now);
  }

  /** 기존 편성의 생산을 먼저 정산한 뒤 새 세 칸을 같은 저장 처리로 확정한다. */
  async saveExcavationFormation(request: SaveExcavationFormationRequest): Promise<IdleExcavationResponse> {
    await this.delay(); const cached = this.excavationFormationResults.get(request.requestId);
    if (cached) return { ...cached, excavation: this.cloneExcavation(cached.excavation) };
    const validation = validateExcavationFormation(request.assignedRelicIds, this.state.owned);
    // 요청 ID와 순수 모델의 보유/중복 검증을 모두 통과한 편성만 저장한다.
    if (!request.requestId || !validation.valid) throw new GameApiError("INVALID_STATE", "발굴 편성이 올바르지 않습니다.");
    const now = this.now(); const settled = settleIdleExcavation(this.state.idleExcavation, now, RELICS, this.state.relicProgress);
    const next = { ...settled, assignedRelicIds: [...request.assignedRelicIds] as [string | null, string | null, string | null] };
    this.persist({ ...this.state, idleExcavation: next }); this.state.idleExcavation = next;
    const response = this.idleExcavationResponse(next, now);
    this.excavationFormationResults.set(request.requestId, response); return response;
  }

  /** 정산·정수화·지갑 상한·미수확 차감을 한 번 저장한 뒤에만 성공 응답을 캐시한다. */
  async harvestExcavation(request: HarvestExcavationRequest): Promise<HarvestExcavationResponse> {
    await this.delay(); const cached = this.excavationHarvestResults.get(request.requestId);
    if (cached) return { ...cached, excavation: this.cloneExcavation(cached.excavation), wallet: { ...cached.wallet }, granted: { ...cached.granted }, discarded: { ...cached.discarded }, remaining: { ...cached.remaining } };
    if (!request.requestId) throw new GameApiError("INVALID_STATE", "수확 요청 ID가 필요합니다.");
    const now = this.now(); const settled = settleIdleExcavation(this.state.idleExcavation, now, RELICS, this.state.relicProgress);
    const result = harvestIdleExcavation(settled, this.state.wallet); const nextState = { ...this.state, idleExcavation: result.state, wallet: result.wallet };
    this.persist(nextState); this.state.idleExcavation = result.state; this.state.wallet = result.wallet;
    // 응답의 기준 시각·잔량·지갑은 같은 persist가 성공한 바로 그 트랜잭션 스냅샷이다.
    const response = { ...this.idleExcavationResponse(result.state, now), wallet: { ...result.wallet }, granted: { ...result.granted }, discarded: { ...result.discarded }, remaining: { ...result.state.unclaimed } };
    this.excavationHarvestResults.set(request.requestId, response); return response;
  }

  /** 응답마다 동일한 순수 판정으로 비율과 정수 수확 알림을 함께 확정한다. */
  private idleExcavationResponse(excavation: IdleExcavationResponse["excavation"], now: Date): IdleExcavationResponse {
    const rate = excavationProductionDisplayModel(excavation.assignedRelicIds, RELICS, this.state.relicProgress).totalsPerHour;
    const notice = excavationHarvestStatus(excavation.unclaimed, rate, excavationStorageLimitSeconds(excavation, now), excavation.pendingHarvestMultiplier ?? 1);
    return { excavation: this.cloneExcavation(excavation), serverTime: now.toISOString(), ...notice };
  }

  /** 광고 완료, 멱등 키, UTC 일일 제한을 검사한 뒤 지급과 저장을 한 번에 확정한다. */
  async claimAdReward(request: ClaimAdRewardRequest): Promise<ClaimAdRewardResponse> {
    await this.delay();
    const slot = findAdRewardSlot(request.slotId);
    if (!slot) throw new GameApiError("AD_SLOT_NOT_FOUND", "존재하지 않는 광고 슬롯입니다.");
    if (!request.requestId || this.state.dailyAdRewards.requestIds.includes(request.requestId)) throw new GameApiError("AD_REQUEST_DUPLICATE", "이미 처리한 광고 요청입니다.");
    if (!request.verificationToken || !(await this.verifyAdToken(request.verificationToken, slot.id))) throw new GameApiError("AD_TOKEN_INVALID", "광고 완료를 확인할 수 없습니다.");

    // 앱 재실행이 아니라 서버 UTC 키 변경에만 카운터와 멱등 목록을 초기화한다.
    const now = this.now(); const date = now.toISOString().slice(0, 10);
    const current = this.state.dailyAdRewards.date === date ? this.state.dailyAdRewards : { date, claimsBySlot: {}, requestIds: [] };
    const dailyClaims = current.claimsBySlot[slot.id] ?? 0;
    if (dailyClaims >= slot.dailyLimitUtc) throw new GameApiError("AD_DAILY_LIMIT", "오늘 받을 수 있는 광고 보상을 모두 받았습니다.");
    if (slot.reward.kind === "quick_expedition") {
      const weekKey = expeditionWeekKey(now); if (this.quickWeek.weekKey !== weekKey) this.quickWeek = { weekKey, claims: 0 };
      if (this.quickWeek.claims >= QUICK_EXPEDITION_POLICY.weeklyLimitUtc) throw new GameApiError("AD_WEEKLY_LIMIT", "이번 주 빠른 원정 횟수를 모두 사용했습니다.");
      if (!(this.bossWeek.bestScore || this.previousBossBest)) throw new GameApiError("EXPEDITION_SCORE_REQUIRED", "빠른 원정의 기준 점수가 없습니다.");
    }

    const nextClaims = dailyClaims + 1;
    const nextAds = { date, claimsBySlot: { ...current.claimsBySlot, [slot.id]: nextClaims }, requestIds: [...current.requestIds, request.requestId] };
    const walletBefore = { ...this.state.wallet };
    const applied = this.applyAdReward(slot.reward, now);
    const nextState = { ...this.state, wallet: applied.wallet, idleExcavation: applied.excavation, dailyAdRewards: nextAds };
    // 상한 검증과 영속화가 성공하기 전에는 메모리 세션을 변경하지 않는다.
    this.persist(nextState);
    this.state.wallet = applied.wallet; this.state.idleExcavation = applied.excavation; this.state.dailyAdRewards = nextAds;
    if (slot.reward.kind === "quick_expedition") this.quickWeek.claims += 1;
    // 실제 지갑 증가분과 주간 잔량은 저장 성공 뒤의 서버 스냅샷에서만 만든다.
    const granted: Partial<Record<keyof Session["wallet"], number>> = {};
    for (const key of Object.keys(applied.wallet) as (keyof Session["wallet"])[]) {
      const amount = applied.wallet[key] - walletBefore[key]; if (amount > 0) granted[key] = amount;
    }
    const weeklyRemaining = slot.weeklyLimitUtc === undefined ? undefined : Math.max(0, slot.weeklyLimitUtc - this.quickWeek.claims);
    return { ...this.snapshot(), slotId: slot.id, reward: slot.reward, dailyClaims: nextClaims, dailyRemaining: slot.dailyLimitUtc - nextClaims, granted, weeklyRemaining, excavation: this.cloneExcavation(applied.excavation), serverTime: now.toISOString() };
  }

  /** 요청 ID와 플랫폼 거래 ID를 모두 고유 키로 취급해 같은 영수증 검증을 반복 실행하지 않는다. */
  async verifyPurchaseReceipt(request: VerifyPurchaseReceiptRequest): Promise<VerifyPurchaseReceiptResponse> {
    await this.delay();
    const cached = this.receiptResults.get(request.requestId);
    if (cached) return { ...cached };
    const product = PRODUCTS.find(({ id }) => id === request.productId);
    if (!request.requestId || !product?.passBenefit || product.acquisition.kind !== "platform_payment") throw new GameApiError("RECEIPT_INVALID", "후원 패스 영수증이 올바르지 않습니다.");
    const transactionId = await this.verifyReceipt(request.receipt, product.id);
    if (!transactionId) throw new GameApiError("RECEIPT_INVALID", "플랫폼 영수증을 검증할 수 없습니다.");
    const previous = this.verifiedTransactions.get(transactionId);
    const result = previous ?? { verificationId: `verification-${transactionId}`, productId: product.id, transactionId, verified: true as const, serverTime: this.now().toISOString() };
    this.verifiedTransactions.set(transactionId, result); this.receiptResults.set(request.requestId, result);
    return { ...result };
  }

  /** 검증 거래당 권리를 하나만 만들며, 기간 계산은 활성화 순간의 서버 UTC 시각만 사용한다. */
  async activatePass(request: ActivatePassRequest): Promise<ActivatePassResponse> {
    await this.delay();
    const cached = this.activationResults.get(request.requestId);
    if (cached) return { entitlement: { ...cached.entitlement }, grants: cached.grants };
    const verification = [...this.verifiedTransactions.values()].find(({ verificationId }) => verificationId === request.verificationId);
    const product = verification && PRODUCTS.find(({ id }) => id === verification.productId);
    if (!request.requestId || !verification || !product?.passBenefit) throw new GameApiError("RECEIPT_INVALID", "검증된 후원 패스 거래가 아닙니다.");
    const entitlementId = `entitlement-${verification.transactionId}`;
    const existing = this.entitlements.get(entitlementId);
    const now = this.now();
    const expiresAt = product.passBenefit.durationDays === null ? null : new Date(now.getTime() + product.passBenefit.durationDays * 86_400_000).toISOString();
    const entitlement = existing ?? { entitlementId, productId: product.id, activatedAt: now.toISOString(), expiresAt, active: true, serverTime: now.toISOString() };
    if (!existing) {
      // 거래당 최초 활성화에서만 즉시 재화를 지급해 다른 요청 ID로 재시도해도 중복 지급되지 않는다.
      const nextWallet = { ...this.state.wallet };
      for (const grant of product.grants) if (grant.kind === "currency") nextWallet[grant.currency] += grant.amount;
      this.persist({ ...this.state, wallet: nextWallet });
      this.state.wallet = nextWallet;
    }
    this.entitlements.set(entitlementId, entitlement);
    const result = { entitlement, grants: product.grants };
    this.activationResults.set(request.requestId, result);
    return { entitlement: { ...entitlement }, grants: result.grants };
  }

  /** 광고 시청 경로와 같은 슬롯 정의·UTC 카운터를 사용하되 활성 패스만 토큰 없이 통과시킨다. */
  async claimInstantAdReward(request: ClaimInstantAdRewardRequest): Promise<ClaimInstantAdRewardResponse> {
    await this.delay();
    const cached = this.instantClaimResults.get(request.requestId);
    if (cached) return { ...cached, entitlement: { ...cached.entitlement }, wallet: { ...cached.wallet } };
    const stored = this.entitlements.get(request.entitlementId);
    const now = this.now();
    if (!stored) throw new GameApiError("PASS_NOT_FOUND", "활성화된 연구 후원 권리가 없습니다.");
    if (stored.expiresAt !== null && now.getTime() >= new Date(stored.expiresAt).getTime()) throw new GameApiError("PASS_EXPIRED", "연구 후원 유효 기간이 만료되었습니다.");
    const slot = findAdRewardSlot(request.slotId);
    if (!slot) throw new GameApiError("AD_SLOT_NOT_FOUND", "존재하지 않는 광고 슬롯입니다.");
    const product = PRODUCTS.find(({ id }) => id === stored.productId);
    if (!request.requestId || !product?.passBenefit) throw new GameApiError("PASS_NOT_FOUND", "후원 상품 정책을 찾을 수 없습니다.");
    const date = now.toISOString().slice(0, 10);
    const current = this.state.dailyAdRewards.date === date ? this.state.dailyAdRewards : { date, claimsBySlot: {}, requestIds: [] };
    const dailyClaims = current.claimsBySlot[slot.id] ?? 0;
    if (dailyClaims >= slot.dailyLimitUtc) throw new GameApiError("AD_DAILY_LIMIT", "오늘 받을 수 있는 광고 보상을 모두 받았습니다.");
    const bonus = this.bonusClaimDates.get(stored.entitlementId) === date ? undefined : product.passBenefit.dailyBonus;
    const walletBefore = { ...this.state.wallet };
    const applied = this.applyAdReward(slot.reward, now); const nextWallet = applied.wallet;
    if (bonus) nextWallet.gems += bonus.amount;
    const nextClaims = dailyClaims + 1;
    const nextAds = { date, claimsBySlot: { ...current.claimsBySlot, [slot.id]: nextClaims }, requestIds: [...current.requestIds, request.requestId] };
    this.persist({ ...this.state, wallet: nextWallet, idleExcavation: applied.excavation, dailyAdRewards: nextAds });
    this.state.wallet = nextWallet; this.state.idleExcavation = applied.excavation; this.state.dailyAdRewards = nextAds;
    if (bonus) this.bonusClaimDates.set(stored.entitlementId, date);
    const entitlement = { ...stored, active: true, serverTime: now.toISOString() };
    const granted: Partial<Record<keyof Session["wallet"], number>> = {};
    for (const key of Object.keys(nextWallet) as (keyof Session["wallet"])[]) { const amount = nextWallet[key] - walletBefore[key]; if (amount > 0) granted[key] = amount; }
    const result: ClaimInstantAdRewardResponse = { ...this.snapshot(), slotId: slot.id, reward: slot.reward, dailyClaims: nextClaims, dailyRemaining: slot.dailyLimitUtc - nextClaims, granted, entitlement, dailyBonus: bonus ? { ...bonus } : undefined, excavation: this.cloneExcavation(applied.excavation), serverTime: now.toISOString() };
    this.instantClaimResults.set(request.requestId, result);
    return result;
  }

  /** 비용 검사, 재화 차감, 난수 결과, 보유 반영을 모두 서버 경계 안에서 원자적으로 처리한다. */
  async pullRelics(request: PullRequest): Promise<PullResponse> {
    await this.delay();
    if (request.count !== 1 && request.count !== 10) {
      throw new GameApiError("INVALID_PULL_COUNT", "연구 횟수는 1회 또는 10회여야 합니다.");
    }

    const banner = BANNERS.find((candidate) => candidate.id === request.bannerId);
    if (!banner) throw new GameApiError("BANNER_NOT_FOUND", "존재하지 않는 배너입니다.");
    if (!canPull(this.state.wallet, banner, request.count)) {
      throw new GameApiError("INSUFFICIENT_CURRENCY", "재화가 부족합니다.");
    }

    // 원본을 전혀 건드리지 않은 복제 상태에서 비용·천장·보유 결과를 모두 먼저 계산한다.
    const pulled = pull(banner, request.count, this.state.gachaPityByGroup[banner.pityGroupId] ?? { pullsSinceSsr: 0, pickupGuaranteed: false }, this.random);
    const breakthroughGradeById = Object.fromEntries(Object.entries(this.state.relicProgress).map(([id, value]) => [id, breakthroughGrade(value.breakthrough)]));
    const relicSlots = pulled.slots.filter((slot) => slot.kind === "relic");
    const outcome = resolveAcquisitions(this.state.owned, this.state.relicFragments, relicSlots.map((slot) => slot.relicId), breakthroughGradeById, BREAKTHROUGH_GRADE_CAP);
    // 최초 획득은 반드시 기본 성장 레코드를 만들고, 중복 변화도 같은 복제본에 반영한다.
    const nextProgress = Object.fromEntries(Object.entries(this.state.relicProgress).map(([id, value]) => [id, { ...value, heartGemSlots: [...value.heartGemSlots] as typeof value.heartGemSlots }]));
    for (const result of outcome.slots) {
      // 최초 획득만 유대 경험치를 지급한다. 중복은 파편(또는 DNA)으로만 남고 성장 레코드를
      // 건드리지 않는다 — 별은 플레이어가 파편을 써서 스스로 올린다.
      if (!nextProgress[result.relicId]) nextProgress[result.relicId] = grantBondXp(createInitialRelicProgress(), BOND_XP_REWARD.firstAcquisition).progress;
    }
    const nextWallet = { ...spend(this.state.wallet, banner, request.count), dnaFragments: this.state.wallet.dnaFragments + outcome.overflowFragments };
    // 비용 차감 뒤 회색 보상을 순서대로 더하며 계정 상한에서 버려지는 양은 저장하지 않는다.
    for (const slot of pulled.slots) if (slot.kind === "currency") {
      nextWallet[slot.currency] = Math.min(WALLET_CAPS[slot.currency], nextWallet[slot.currency] + slot.amount);
    }
    const nextPity = { ...this.state.gachaPityByGroup, [banner.pityGroupId]: pulled.pity };
    // 연구소의 캐릭터 연구 성공만 임무로 환산하며 방치 발굴 수확과 섞지 않는다.
    const nextMissions = applyMissionEvent(this.state.missions, { type: "relic_research_completed", count: request.count }, this.now());
    const nextState: Session = { ...this.state, wallet: nextWallet, owned: outcome.ownedRelicIds, relicProgress: nextProgress, relicFragments: outcome.fragmentsById, gachaPityByGroup: nextPity, missions: nextMissions };

    // 저장 실패도 원본 메모리에 부분 반영되지 않도록 저장을 먼저 성공시킨 뒤 필드를 일괄 교체한다.
    this.persist(nextState);
    this.state.wallet = nextWallet;
    this.state.owned = outcome.ownedRelicIds;
    this.state.relicProgress = nextProgress;
    this.state.relicFragments = outcome.fragmentsById;
    this.state.gachaPityByGroup = nextPity;
    this.state.missions = nextMissions;
    return {
      ...this.snapshot(),
      // 렐릭 획득 결과를 원래 추첨 위치에 다시 끼워 혼합 10연의 슬롯 순서를 보존한다.
      results: (() => { let relicIndex = 0; return pulled.slots.map((slot) => slot.kind === "currency"
        ? { type: "currency" as const, currency: slot.currency, amount: slot.amount, grade: slot.grade }
        : { type: "relic" as const, ...outcome.slots[relicIndex++] }); })(),
      newRelicIds: outcome.newRelicIds,
      duplicateRelicIds: outcome.duplicateRelicIds,
    };
  }

  /** 서버가 보유·상한·치즈케이크를 검증하고 차감과 성장 반영을 한 저장 단위로 확정한다. */
  async feedRelic(relicId: string, feeds = 1): Promise<FeedRelicResponse> {
    await this.delay();
    const current = this.state.relicProgress[relicId];
    if (!this.state.owned.has(relicId) || !current) throw new GameApiError("RELIC_NOT_FOUND", "보유하지 않은 렐릭입니다.");
    if (current.level >= relicLevelCap(current.breakthrough)) throw new GameApiError("RELIC_MAX_LEVEL", "이미 최대 레벨입니다.");
    if (!canFeedRelic(current, this.state.wallet.cheesecake)) throw new GameApiError("INSUFFICIENT_CURRENCY", "치즈케이크가 부족합니다.");
    const result = calculateFeed(current, this.state.wallet.cheesecake, feeds);
    const nextProgress = { ...this.state.relicProgress, [relicId]: result.progress };
    const nextWallet = { ...this.state.wallet, cheesecake: result.cheesecake };
    const nextMissions = applyMissionEvent(this.state.missions, { type: "salary_given", count: result.feeds }, this.now());
    this.persist({ ...this.state, relicProgress: nextProgress, wallet: nextWallet, missions: nextMissions });
    this.state.relicProgress = nextProgress; this.state.wallet = nextWallet; this.state.missions = nextMissions;
    return { ...this.snapshot(), relicId, feeds: result.feeds, cheesecakeSpent: result.feeds * FEED_UNIT.cheesecake, levelsGained: result.levelsGained };
  }

  /**
   * 돌파.
   *
   * 재료 검사와 차감, 단계 확정을 한 처리 단위로 끝낸다. 화면은 결과만 받아 다시 그린다.
   */
  async breakThroughRelic(relicId: string): Promise<BreakThroughResponse> {
    await this.delay();
    const current = this.state.relicProgress[relicId];
    if (!this.state.owned.has(relicId) || !current) throw new GameApiError("RELIC_NOT_FOUND", "보유하지 않은 렐릭입니다.");
    const step = nextBreakthrough(current.breakthrough);
    if (!step) throw new GameApiError("RELIC_MAX_LEVEL", "더 뚫을 천장이 없습니다.");
    if (current.level < relicLevelCap(current.breakthrough)) throw new GameApiError("RELIC_MAX_LEVEL", "레벨을 상한까지 올려야 돌파할 수 있습니다.");
    const held = this.state.relicFragments[relicId] ?? 0;
    // 파편 수는 **등급**이 정한다(`BREAKTHROUGH_FRAGMENTS`) — SSR은 한 장으로 한 단계지만
    // R은 다섯 장을 모아야 한다. 등급을 모르는 채로는 검사도 차감도 할 수 없다.
    const rarity = RELICS.find(({ id }) => id === relicId)?.rarity ?? "R";
    const fragmentCost = breakthroughFragmentCost(rarity, current.breakthrough);
    if (!canBreakThrough(rarity, current, held, this.state.wallet.cheesecake)) throw new GameApiError("INSUFFICIENT_CURRENCY", "돌파 재료가 부족합니다.");
    const breakthrough = current.breakthrough + 1;
    const nextProgress = { ...this.state.relicProgress, [relicId]: { ...current, breakthrough } };
    // 파편은 그 개체의 것만 줄어든다. 공용 재화가 아니므로 다른 개체의 진행에 영향이 없다.
    const nextFragments = { ...this.state.relicFragments, [relicId]: held - fragmentCost };
    const nextWallet = { ...this.state.wallet, cheesecake: this.state.wallet.cheesecake - step.cheesecake };
    this.persist({ ...this.state, relicProgress: nextProgress, relicFragments: nextFragments, wallet: nextWallet });
    this.state.relicProgress = nextProgress; this.state.relicFragments = nextFragments; this.state.wallet = nextWallet;
    return { ...this.snapshot(), relicId, breakthrough, levelCap: relicLevelCap(breakthrough), breakthroughGrade: breakthroughGrade(breakthrough), fragments: nextFragments[relicId] };
  }

  /** 입장 허가와 비용 차감을 한 처리로 묶고 requestId 재전송에는 최초 영수증을 반환한다. */
  async enterStage(request: EnterStageRequest): Promise<EnterStageResponse> {
    await this.delay();
    const cached = this.stageAdmissionResults.get(request.requestId);
    if (cached) return structuredClone(cached);
    if (!request.requestId) throw new GameApiError("INVALID_STATE", "입장 요청 ID가 필요합니다.");
    let stage; try { stage = getStage(request.stageId); } catch { throw new GameApiError("STAGE_NOT_FOUND", "존재하지 않는 스테이지입니다."); }
    if (stage.kind !== "battle") throw new GameApiError("STAGE_NOT_FOUND", "전투 스테이지가 아닙니다.");
    this.settleStaminaNow();
    const cost = CONTENT_STAMINA_COSTS.normalStage;
    if (this.state.wallet.stamina < cost) throw new GameApiError("INSUFFICIENT_STAMINA", "스테미나가 부족합니다.");
    const nextWallet = { ...this.state.wallet, stamina: this.state.wallet.stamina - cost };
    // 가챠·성장 API처럼 다음 상태를 먼저 저장해야 저장 실패 시 공유 메모리 지갑이 호출 전 값으로 보존된다.
    this.persist({ ...this.state, wallet: nextWallet });
    // 영속화가 성공한 뒤에만 공유 참조를 교체해 응답 스냅샷도 실제로 확정된 잔액을 기준으로 만든다.
    this.state.wallet = nextWallet;
    const pending = this.pendingStageAdmissions.get(request.stageId) ?? new Set<string>();
    pending.add(request.requestId);
    this.pendingStageAdmissions.set(request.stageId, pending);
    const response = { ...this.snapshot(), stageId: request.stageId, requestId: request.requestId, staminaSpent: cost, refundPolicy: "no-refund-after-admission" as const };
    this.stageAdmissionResults.set(request.requestId, structuredClone(response));
    return response;
  }

  /** 승리 결과 확인 시 최초/반복 보상을 판정하고 클리어와 지갑을 함께 저장한다. */
  async completeStage(stageId: string, victory = true): Promise<CompleteStageResponse> {
    await this.delay();
    let stage;
    const owningEvent = findEventByStageId(stageId);
    // 입장 뒤 시간이 넘어간 우회 요청도 결과 확정 경계에서 다시 차단한다.
    if (owningEvent) this.assertEventActive(owningEvent, this.now());
    try { stage = owningEvent?.stages.find(({ id }) => id === stageId) ?? getStage(stageId); } catch { throw new GameApiError("STAGE_NOT_FOUND", "존재하지 않는 스테이지입니다."); }
    // 완료 API는 전투 보상만 정산하며 스토리 완료는 StoryManager가 독점한다.
    if (stage.kind !== "battle") throw new GameApiError("STAGE_NOT_FOUND", "전투 스테이지가 아닙니다.");
    const firstClear = victory && !this.state.cleared.has(stageId);
    const cheesecakeEarned = victory ? (firstClear ? stage.rewards.firstClearCheesecake : stage.rewards.repeatClearCheesecake) : 0;
    const nextCleared = victory ? new Set(this.state.cleared).add(stageId) : new Set(this.state.cleared);
    const pending = this.pendingStageAdmissions.get(stageId);
    const admissionId = pending?.values().next().value as string | undefined;
    // 스테미나는 입장 커밋에서 이미 차감됐으므로 완료에서는 전투 보상만 다음 지갑에 반영한다.
    const nextWallet = { ...this.state.wallet, cheesecake: this.state.wallet.cheesecake + cheesecakeEarned };
    // 승리한 전투에 실제 편성된 세 렐릭에게만 유대 경험치를 지급한다.
    const nextProgress = Object.fromEntries(Object.entries(this.state.relicProgress).map(([id, progress]) => [id,
      victory && this.state.party.includes(id) ? grantBondXp(progress, BOND_XP_REWARD.partyVictory).progress : progress]));
    const nextMissions = applyMissionEvent(this.state.missions, { type: "battle_completed", victory }, this.now());
    this.persist({ ...this.state, cleared: nextCleared, wallet: nextWallet, relicProgress: nextProgress, missions: nextMissions });
    this.state.cleared = nextCleared; this.state.wallet = nextWallet; this.state.relicProgress = nextProgress; this.state.missions = nextMissions;
    if (admissionId) pending?.delete(admissionId);
    if (pending?.size === 0) this.pendingStageAdmissions.delete(stageId);
    return { ...this.snapshot(), stageId, firstClear, cheesecakeEarned };
  }

  /* ── 치즈케이크 대작전 ────────────────────────────────────────────────────── */

  /**
   * 출격·소탕이 **함께 지나는 검문소**.
   *
   * 해금·배율·스테미나를 세 메서드가 저마다 확인하면 한 곳만 규칙이 뒤처져도 그 길로 새어
   * 나간다. 여기서 한 번 확인하고, 통과한 것만 실제 차감으로 넘어간다.
   */
  private assertCakeRun(request: CakeOperationRunRequest, now: Date): { tier: ReturnType<typeof getCakeOperationTier>; multiplier: ReturnType<typeof normalizeMultiplier>; staminaCost: number; rewards: Record<string, number> } {
    if (!request.requestId) throw new GameApiError("INVALID_STATE", "입장 요청 ID가 필요합니다.");
    let tier; try { tier = getCakeOperationTier(request.tierId); } catch { throw new GameApiError("CAKE_TIER_NOT_FOUND", "존재하지 않는 작전 단계입니다."); }
    if (!isCakeTierUnlocked(tier.id, this.state.cakeOperation.clearedIndex)) throw new GameApiError("CAKE_TIER_LOCKED", "아직 열리지 않은 작전 단계입니다.");
    // 표에 없는 배율은 x1로 좁힌다 — 임의의 수를 그대로 곱하면 한 번의 요청이 상한까지 턴다.
    const multiplier = normalizeMultiplier(request.multiplier);
    if (!isMultiplierUnlocked(multiplier, this.hasAdFreeMembership(now))) throw new GameApiError("CAKE_MULTIPLIER_LOCKED", "광고 제거 멤버십이 필요한 배율입니다.");
    const settlement = applyDungeonMultiplier(cakeOperationRunCost(tier), multiplier);
    this.settleStaminaNow(now);
    if (this.state.wallet.stamina < settlement.staminaCost) throw new GameApiError("INSUFFICIENT_STAMINA", "스테미나가 부족합니다.");
    return { tier, multiplier, staminaCost: settlement.staminaCost, rewards: settlement.rewards };
  }

  /** 지갑 상한을 넘기지 않고 지급하며, 실제로 늘어난 몫만 돌려준다. */
  private grantCakeRewards(wallet: Session["wallet"], rewards: Record<string, number>): Partial<Record<keyof Session["wallet"], number>> {
    const granted: Partial<Record<keyof Session["wallet"], number>> = {};
    for (const [currency, amount] of Object.entries(rewards)) {
      const key = currency as keyof Session["wallet"];
      if (!(key in WALLET_CAPS)) continue;
      const applied = Math.min(amount, WALLET_CAPS[key] - wallet[key]);
      if (applied <= 0) continue;
      wallet[key] += applied;
      granted[key] = applied;
    }
    return granted;
  }

  /** 입장. 배율만큼의 스테미나를 여기서 한 번만 빼고, 보상은 결과 확정이 얹는다. */
  async enterCakeOperation(request: CakeOperationRunRequest): Promise<CakeOperationEnterResponse> {
    await this.delay();
    const cached = this.cakeAdmissionResults.get(request.requestId);
    if (cached) return structuredClone(cached);
    const now = this.now();
    const run = this.assertCakeRun(request, now);
    const nextWallet = { ...this.state.wallet, stamina: this.state.wallet.stamina - run.staminaCost };
    // 다른 API와 같이 저장이 성공한 뒤에만 공유 지갑을 교체해, 저장 실패가 잔액을 지우지 않게 한다.
    this.persist({ ...this.state, wallet: nextWallet });
    this.state.wallet = nextWallet;
    const pending = this.pendingCakeAdmissions.get(run.tier.id) ?? new Set<string>();
    pending.add(request.requestId);
    this.pendingCakeAdmissions.set(run.tier.id, pending);
    const response: CakeOperationEnterResponse = {
      ...this.snapshot(), tierId: run.tier.id, requestId: request.requestId, multiplier: run.multiplier,
      staminaSpent: run.staminaCost, refundPolicy: "no-refund-after-admission",
    };
    this.cakeAdmissionResults.set(request.requestId, structuredClone(response));
    return response;
  }

  /**
   * 결과 확정. **스테미나는 이미 입장에서 빠졌으므로** 여기서는 보상과 해금만 얹는다.
   *
   * 배율은 요청이 들고 오지만 실제로 곱하는 값은 입장 때 확인한 것과 같아야 한다 — 그래서
   * 입장 영수증에 적힌 배율을 우선으로 읽고, 영수증이 없으면(소탕을 거치지 않은 직접 호출)
   * 요청 값을 같은 경계로 좁힌다.
   */
  async completeCakeOperation(request: CakeOperationCompleteRequest): Promise<CakeOperationCompleteResponse> {
    await this.delay();
    const cached = this.cakeCompletionResults.get(request.requestId);
    if (cached) return structuredClone(cached);
    let tier; try { tier = getCakeOperationTier(request.tierId); } catch { throw new GameApiError("CAKE_TIER_NOT_FOUND", "존재하지 않는 작전 단계입니다."); }
    const admission = this.cakeAdmissionResults.get(request.requestId);
    const multiplier = normalizeMultiplier(admission?.multiplier ?? request.multiplier);
    const settlement = applyDungeonMultiplier(cakeOperationRunCost(tier), multiplier);
    const nextWallet = { ...this.state.wallet };
    const granted = request.victory ? this.grantCakeRewards(nextWallet, settlement.rewards) : {};
    const index = cakeOperationTierIndex(tier.id);
    const unlockedNextTier = request.victory && index > this.state.cakeOperation.clearedIndex;
    const nextCake = unlockedNextTier ? { clearedIndex: index } : { ...this.state.cakeOperation };
    // 승리한 전투에 실제 편성된 렐릭에게만 유대 경험치를 지급한다 — 스토리 전투와 같은 규칙이다.
    const nextProgress = Object.fromEntries(Object.entries(this.state.relicProgress).map(([id, progress]) => [id,
      request.victory && this.state.party.includes(id) ? grantBondXp(progress, BOND_XP_REWARD.partyVictory).progress : progress]));
    const nextMissions = applyMissionEvent(this.state.missions, { type: "battle_completed", victory: request.victory }, this.now());
    this.persist({ ...this.state, wallet: nextWallet, cakeOperation: nextCake, relicProgress: nextProgress, missions: nextMissions });
    this.state.wallet = nextWallet; this.state.cakeOperation = nextCake; this.state.relicProgress = nextProgress; this.state.missions = nextMissions;
    const pending = this.pendingCakeAdmissions.get(tier.id);
    pending?.delete(request.requestId);
    if (pending?.size === 0) this.pendingCakeAdmissions.delete(tier.id);
    const response: CakeOperationCompleteResponse = {
      ...this.snapshot(), tierId: tier.id, victory: request.victory, multiplier, granted, unlockedNextTier,
    };
    this.cakeCompletionResults.set(request.requestId, structuredClone(response));
    return response;
  }

  /**
   * 소탕. 전투를 건너뛰는 것이지 **이긴 셈 쳐 주는 것이 아니다** — 이미 이긴 단계만 통과한다.
   *
   * 차감과 지급이 한 처리라 입장 영수증을 만들지 않는다. 중간에 끊겨도 스테미나만 빠지고
   * 보상은 안 들어오는 상태가 생기지 않는다.
   */
  async sweepCakeOperation(request: CakeOperationRunRequest): Promise<CakeOperationSweepResponse> {
    await this.delay();
    const cached = this.cakeSweepResults.get(request.requestId);
    if (cached) return structuredClone(cached);
    const now = this.now();
    const run = this.assertCakeRun(request, now);
    // 해금은 "직전 단계까지 이겼나"이고 소탕은 "이 단계를 이겼나"다. 한 칸 차이라 따로 묻는다.
    if (cakeOperationTierIndex(run.tier.id) > this.state.cakeOperation.clearedIndex) throw new GameApiError("CAKE_TIER_LOCKED", "아직 한 번도 이기지 않은 단계는 소탕할 수 없습니다.");
    const nextWallet = { ...this.state.wallet, stamina: this.state.wallet.stamina - run.staminaCost };
    const granted = this.grantCakeRewards(nextWallet, run.rewards);
    const nextMissions = applyMissionEvent(this.state.missions, { type: "battle_completed", victory: true }, now);
    this.persist({ ...this.state, wallet: nextWallet, missions: nextMissions });
    this.state.wallet = nextWallet; this.state.missions = nextMissions;
    const response: CakeOperationSweepResponse = {
      ...this.snapshot(), tierId: run.tier.id, multiplier: run.multiplier, staminaSpent: run.staminaCost, granted,
    };
    this.cakeSweepResults.set(request.requestId, structuredClone(response));
    return response;
  }

  /** 서버 UTC 날짜를 기준으로 해당 렐릭의 하루 첫 로비 상호작용만 보상한다. */
  async interactInLobby(relicId: string): Promise<LobbyInteractionResponse> {
    await this.delay();
    const current = this.state.relicProgress[relicId];
    if (!this.state.owned.has(relicId) || !current) throw new GameApiError("RELIC_NOT_FOUND", "보유하지 않은 렐릭입니다.");
    const utcDate = this.now().toISOString().slice(0, 10);
    const result = grantDailyLobbyBondXp(current, utcDate);
    const nextProgress = { ...this.state.relicProgress, [relicId]: result.progress };
    const nextMissions = applyMissionEvent(this.state.missions, { type: "lobby_interaction" }, this.now());
    this.persist({ ...this.state, relicProgress: nextProgress, missions: nextMissions });
    this.state.relicProgress = nextProgress; this.state.missions = nextMissions;
    return { ...this.snapshot(), relicId, bondXpEarned: result.xpGained, bondLevelsGained: result.levelsGained };
  }

  /** UTC 날짜를 서버에서 정규화한 뒤 하루 3회 제한과 보상을 원자적으로 반영한다. */
  async enterDailyRestoration(): Promise<EnterDailyRestorationResponse> {
    await this.delay();
    let nextDaily;
    try { nextDaily = consumeRestorationEntry(this.state.dailyContent, this.now()); }
    catch { throw new GameApiError("DAILY_ENTRY_LIMIT", "오늘의 입장 횟수를 모두 사용했습니다."); }
    const nextWallet = { ...this.state.wallet, cheesecake: this.state.wallet.cheesecake + DAILY_RESTORATION.rewardCheesecake };
    this.persist({ ...this.state, dailyContent: nextDaily, wallet: nextWallet });
    this.state.dailyContent = nextDaily; this.state.wallet = nextWallet;
    return { ...this.snapshot(), entriesRemaining: DAILY_RESTORATION.maxEntriesPerUtcDay - nextDaily.restorationEntries, cheesecakeEarned: DAILY_RESTORATION.rewardCheesecake };
  }


  /* ── 현상수배 ─────────────────────────────────────────────────────────────── */

  /** 등급 줄과 오늘 남은 입장 횟수를 서버 날짜 하나로 정규화해 돌려준다. */
  async getBountyStatus(): Promise<BountyStatusResponse> {
    await this.delay();
    const now = this.now();
    const normalized = normalizeBounty(this.state.bounty, now);
    // 날짜가 넘어간 몫은 조회에서도 확정해 두 화면이 서로 다른 잔여 횟수를 읽지 않게 한다.
    this.persist({ ...this.state, bounty: normalized });
    this.state.bounty = normalized;
    return { clearedTierIds: [...normalized.clearedTierIds], entriesRemaining: bountyEntriesRemaining(normalized, now), serverTime: now.toISOString() };
  }

  /**
   * 세 라운드를 여는 한 번의 입장.
   *
   * 스테미나와 일일 횟수는 **여기서만** 나간다. 라운드마다 깎으면 2라운드에서 진 사람이 1.5판
   * 값을 치른 것이 되고, 화면이 그 차이를 설명할 방법이 없다.
   */
  async enterBounty(request: EnterBountyRequest): Promise<EnterBountyResponse> {
    await this.delay();
    const cached = this.bountyAdmissionResults.get(request.requestId);
    if (cached) return structuredClone(cached);
    if (!request.requestId) throw new GameApiError("INVALID_STATE", "입장 요청 ID가 필요합니다.");
    let tier; try { tier = getBountyTier(request.tierId); } catch { throw new GameApiError("BOUNTY_TIER_NOT_FOUND", "존재하지 않는 현상수배 등급입니다."); }
    const now = this.now();
    const normalized = normalizeBounty(this.state.bounty, now);
    // 해금은 화면 표시가 아니라 서버가 지키는 값이다 — 직접 진입도 같은 경계에서 막힌다.
    if (!isBountyTierUnlocked(tier, normalized.clearedTierIds)) throw new GameApiError("BOUNTY_TIER_LOCKED", "아직 열리지 않은 현상수배 등급입니다.");
    let nextBounty;
    try { nextBounty = consumeBountyEntry(normalized, now); }
    catch { throw new GameApiError("BOUNTY_DAILY_LIMIT", "오늘의 현상수배 입장 횟수를 모두 사용했습니다."); }
    this.settleStaminaNow();
    const cost = BOUNTY.staminaCost;
    if (this.state.wallet.stamina < cost) throw new GameApiError("INSUFFICIENT_STAMINA", "스테미나가 부족합니다.");
    const nextWallet = { ...this.state.wallet, stamina: this.state.wallet.stamina - cost };
    // 저장이 성공한 뒤에만 공유 참조를 바꿔, 실패해도 지갑이 호출 전 값으로 남게 한다.
    this.persist({ ...this.state, wallet: nextWallet, bounty: nextBounty });
    this.state.wallet = nextWallet; this.state.bounty = nextBounty;
    this.pendingBountyRuns.set(request.requestId, tier.id);
    const response = { ...this.snapshot(), tierId: tier.id, requestId: request.requestId, staminaSpent: cost, entriesRemaining: bountyEntriesRemaining(nextBounty, now), refundPolicy: "no-refund-after-admission" as const };
    this.bountyAdmissionResults.set(request.requestId, structuredClone(response));
    return response;
  }

  /**
   * 세 라운드의 결과 확정.
   *
   * **한 번이라도 진 판은 보상이 없다.** 그 판단은 코어(`nextBountyStep`)가 이미 했고 여기서는
   * 그 결과만 받는다. 진 판도 정산을 지나야 영수증이 소비되어, 같은 입장으로 두 번 보상받지
   * 못한다.
   */
  async completeBounty(request: CompleteBountyRequest): Promise<CompleteBountyResponse> {
    await this.delay();
    const admittedTierId = this.pendingBountyRuns.get(request.requestId);
    if (admittedTierId === undefined || admittedTierId !== request.tierId) throw new GameApiError("BOUNTY_ADMISSION_NOT_FOUND", "입장하지 않은 현상수배입니다.");
    const tier = getBountyTier(request.tierId);
    const now = this.now();
    const victory = request.victory && request.clearedRounds >= BOUNTY.roundCount;
    const firstClear = victory && !this.state.bounty.clearedTierIds.includes(tier.id);
    const goldEarned = victory ? tier.rewardGold : 0;
    const nextWallet = { ...this.state.wallet, gold: this.state.wallet.gold + goldEarned };
    const nextBounty = victory ? markBountyTierCleared(this.state.bounty, tier.id, now) : normalizeBounty(this.state.bounty, now);
    const nextMissions = applyMissionEvent(this.state.missions, { type: "battle_completed", victory }, now);
    this.persist({ ...this.state, wallet: nextWallet, bounty: nextBounty, missions: nextMissions });
    this.state.wallet = nextWallet; this.state.bounty = nextBounty; this.state.missions = nextMissions;
    this.pendingBountyRuns.delete(request.requestId);
    return { ...this.snapshot(), tierId: tier.id, victory, clearedRounds: request.clearedRounds, goldEarned, firstClear, clearedTierIds: [...nextBounty.clearedTierIds] };
  }

  /** 정적 이벤트에 서버가 판정한 상태를 결합해 클라이언트 시계 의존을 없앤다. */
  async getEvents(): Promise<EventListResponse> {
    await this.delay();
    const now = this.now();
    return { events: EVENTS.map((event) => ({ ...event, status: this.eventStatus(event, now) })), serverTime: now.toISOString() };
  }

  /** 이벤트·스테이지 소유 관계와 기간을 확인한 뒤에만 전투 정의를 내준다. */
  async enterEventStage(eventId: string, stageId: string): Promise<EnterEventStageResponse> {
    await this.delay();
    const now = this.now();
    const event = EVENTS.find(({ id }) => id === eventId);
    if (!event) throw new GameApiError("EVENT_NOT_FOUND", "존재하지 않는 이벤트입니다.");
    this.assertEventActive(event, now);
    const stage = event.stages.find(({ id }) => id === stageId);
    if (!stage) throw new GameApiError("STAGE_NOT_FOUND", "이 이벤트에 속하지 않은 스테이지입니다.");
    // 중첩 값도 복제해 응답 소비자가 정적 운영 데이터를 바꾸지 못하게 한다.
    return { eventId, stage: { ...stage, enemies: [...stage.enemies], rewards: { ...stage.rewards } }, serverTime: now.toISOString() };
  }

  /** 현재 UTC 기간으로 정규화한 임무와 로비용 미수령 개수를 조회한다. */
  async getMissions(): Promise<MissionListResponse> {
    await this.delay();
    const normalized = normalizeMissions(this.state.missions, this.now());
    // 기간 전환 자체도 재실행 뒤 되살아나지 않도록 서버 상태에 확정한다.
    this.persist({ ...this.state, missions: normalized });
    this.state.missions = normalized;
    const resetAt = nextUtcDay(this.now());
    // 임무 기간을 실제로 정규화하는 API 경계에서 다음 UTC 갱신도 함께 예약한다.
    void this.notificationScheduler?.scheduleNotification({ id: `daily-mission:${resetAt.toISOString()}`, kind: "dailyMission", title: t("mail.daily.title"), body: t("mail.daily.body"), expiresAt: resetAt });
    return this.missionListDto(normalized);
  }

  /** 우편의 실제 읽음 상태를 공용 알림 신호에 합성한다. */
  async getNotificationSignals() {
    await this.delay();
    return { pendingFriendRequestCount: 0, unseenEventCount: 0, unreadMailCount: this.mailListDto().unreadCount };
  }

  /** 검증·보상 지급·수령 표시를 하나의 저장으로 확정해 재요청 중복 지급을 막는다. */
  async claimMissionRewards(missionIds?: string[], researchPeriod?: MissionPeriod, researchStageIds?: string[]): Promise<ClaimMissionRewardsResponse> {
    await this.delay();
    const normalized = normalizeMissions(this.state.missions, this.now());
    const ids = missionIds ?? claimableMissionIds(normalized);
    const uniqueIds = [...new Set(ids)];
    for (const id of uniqueIds) {
      const mission = MISSIONS.find((candidate) => candidate.id === id);
      if (!mission) throw new GameApiError("MISSION_NOT_FOUND", "존재하지 않는 임무입니다.");
      if (normalized.claimedIds.includes(id)) throw new GameApiError("MISSION_ALREADY_CLAIMED", "이미 수령한 임무입니다.");
      if ((normalized.progress[id] ?? 0) < mission.target) throw new GameApiError("MISSION_NOT_COMPLETE", "완료하지 않은 임무입니다.");
    }
    const missionCheesecake = uniqueIds.reduce((sum, id) => sum + (MISSIONS.find((mission) => mission.id === id)?.rewardCheesecake ?? 0), 0);
    // **연구도는 수령이 올린다.** 완료하는 순간 저 혼자 차오르면 보상을 받는 손에는 아무 일도
    // 일어나지 않아 두 값이 따로 논다. 그래서 이 자리에서 먼저 더한 뒤, 그 오른 값으로 단계
    // 보상을 판정한다 — 일괄 수령이 게이지를 채우고 그 단계 보상까지 한 번에 주게 하려는 것이다.
    let nextMissions = addResearchPoints({ ...normalized, claimedIds: [...normalized.claimedIds, ...uniqueIds] }, researchPointsForClaim(uniqueIds));
    const periods = researchPeriod ? [researchPeriod] : [...new Set(uniqueIds.map((id) => MISSIONS.find((mission) => mission.id === id)?.period).filter((period): period is MissionPeriod => period !== undefined))];
    const claimedResearchStageIds: string[] = [];
    let researchCheesecake = 0;
    for (const period of periods) {
      const result = claimResearchStages(nextMissions, period, researchPeriod === period ? researchStageIds : undefined);
      nextMissions = result.state; researchCheesecake += result.cheesecakeEarned;
      claimedResearchStageIds.push(...result.claimedStageIds.map((id) => researchStageClaimId(period, id)));
    }
    const cheesecakeEarned = missionCheesecake + researchCheesecake;
    const nextWallet = { ...this.state.wallet, cheesecake: this.state.wallet.cheesecake + cheesecakeEarned };
    // 임무/업적 보상과 그 조건으로 열린 수식어를 같은 nextState와 단 한 번의 persist로 확정한다.
    const nextState = ProfileModifierManager.applyRewardReceipt({ ...this.state, missions: nextMissions, wallet: nextWallet }, { claimedIds: uniqueIds, claimedResearchStageIds });
    this.persist(nextState);
    this.state.missions = nextMissions; this.state.wallet = nextWallet; this.state.earnedProfileModifierIds = nextState.earnedProfileModifierIds;
    return { ...this.snapshot(), claimedIds: uniqueIds, claimedResearchStageIds, rewards: { missionCheesecake, researchCheesecake, cheesecake: cheesecakeEarned }, cheesecakeEarned };
  }

  /** 서버 시각의 노출 기간과 현재 제한 주기를 반영해 공용 카탈로그를 조회한다. */
  async getProducts(storefront: ProductDefinition["storefront"]): Promise<ProductListResponse> {
    await this.delay();
    const now = this.now();
    // 목록 단계부터 요청 화면과 일치하는 상품만 반환해 화면별 모델이 섞인 카탈로그를 받지 않는다.
    const products = PRODUCTS.filter((product) => product.storefront === storefront && this.isVisible(product, now)).map((product) => {
      const remaining = this.remaining(product, now);
      const premium = product.acquisition.kind === "platform_payment";
      return { ...product, remaining, purchasable: !premium && remaining > 0, disabledReason: premium ? t("error.purchase.unverified") : remaining <= 0 ? t("error.purchase.limit") : undefined };
    });
    return { products, serverTime: now.toISOString() };
  }

  /** 가격 검증부터 제한 갱신까지 복제 상태에서 끝내고 마지막에 한 번만 확정한다. */
  async purchaseProduct(request: PurchaseProductRequest): Promise<PurchaseProductResponse> {
    await this.delay();
    const now = this.now();
    const { storefront, productId, quantity } = request;
    // 수량은 가격과 제한을 곱하기 전에 엄격히 검사해 음수 차감이나 소수 지급을 차단한다.
    if (!Number.isSafeInteger(quantity) || quantity < 1) throw new GameApiError("INVALID_PURCHASE_QUANTITY", "구매 수량이 올바르지 않습니다.");
    const product = PRODUCTS.find((candidate) => candidate.id === productId);
    if (!product) throw new GameApiError("PRODUCT_NOT_FOUND", "존재하지 않는 상품입니다.");
    // 상품 ID를 알아도 요청 storefront가 다르면 구매할 수 없어 화면 간 ID 주입을 차단한다.
    if (product.storefront !== storefront) throw new GameApiError("PRODUCT_STOREFRONT_MISMATCH", "요청한 상점의 상품이 아닙니다.");
    const owningEvent = findEventByProductId(productId);
    // 상품 노출 기간과 별개로 이벤트 기간도 검사해 운영 데이터 불일치 시 구매를 막는다.
    if (owningEvent) this.assertEventActive(owningEvent, now);
    if (!this.isVisible(product, now)) throw new GameApiError("PRODUCT_NOT_VISIBLE", "현재 노출 기간이 아닌 상품입니다.");
    // FakeServer는 플랫폼 성공이나 영수증을 만들지 않는다. 유료 지급은 실제 검증 서버의 책임이다.
    if (product.acquisition.kind !== "currency" && product.acquisition.kind !== "item") throw new GameApiError("ACQUISITION_FLOW_REQUIRED", "상품 획득 방식의 전용 확정 절차가 필요합니다.");
    const remaining = this.remaining(product, now);
    if (quantity > remaining) throw new GameApiError("PURCHASE_LIMIT_REACHED", "남은 구매 제한을 초과했습니다.");
    const totalPrice = totalGrantAmount(product.acquisition.amount, quantity);
    if (!Number.isSafeInteger(totalPrice)) throw new GameApiError("INVALID_PURCHASE_QUANTITY", "구매 수량이 올바르지 않습니다.");
    // 값은 지갑에서 나가거나 재고에서 나간다. 두 갈래 모두 **지급 전에** 모자람을 먼저 거절해
    // 부분 차감을 남기지 않는다.
    const itemCost = product.acquisition.kind === "item" ? product.acquisition : undefined;
    if (itemCost && (this.state.itemInventory.find(({ itemId }) => itemId === itemCost.itemId)?.quantity ?? 0) < totalPrice) throw new GameApiError("INSUFFICIENT_ITEMS", "아이템 수량이 부족합니다.");
    if (product.acquisition.kind === "currency" && this.state.wallet[product.acquisition.currency] < totalPrice) throw new GameApiError("INSUFFICIENT_CURRENCY", "재화가 부족합니다.");

    const currencyCost = product.acquisition.kind === "currency" ? product.acquisition : undefined;
    const nextWallet = currencyCost
      ? { ...this.state.wallet, [currencyCost.currency]: this.state.wallet[currencyCost.currency] - totalPrice }
      : { ...this.state.wallet };
    // 아이템 값은 교류 교환소와 같은 재고 경계를 지난다 — 다 쓴 칸은 남기지 않고 지운다.
    let nextItems = itemCost
      ? this.state.itemInventory.flatMap((entry) => entry.itemId === itemCost.itemId ? (entry.quantity > totalPrice ? [{ ...entry, quantity: entry.quantity - totalPrice }] : []) : [{ ...entry }])
      : this.state.itemInventory.map((entry) => ({ ...entry }));
    const nextRunes = [...this.state.runeInventory];
    const grantedRunes: RuneInstance[] = [];
    const granted: ProductDefinition["grants"][number][] = [];
    // 상점은 현재 재화만 지급하며, 룬 생성은 DNA의 명시적인 인스턴스 발급 계약으로 분리한다.
    for (const grant of product.grants) {
      // 프로필 장식은 실제 계정 서버 전용 지급품이며 인게임 재화 구매 경로에서는 재화만 반영한다.
      if (grant.kind === "currency") {
        const totalGrant = totalGrantAmount(grant.amount, quantity);
        // 총 지급량과 지갑 상한까지 복제 지갑에서 검증한 뒤에만 값을 써서 부분 지급을 남기지 않는다.
        if (!Number.isSafeInteger(totalGrant) || nextWallet[grant.currency] + totalGrant > WALLET_CAPS[grant.currency]) throw new GameApiError("CURRENCY_LIMIT_EXCEEDED", "지급 후 재화 상한을 초과합니다.");
        nextWallet[grant.currency] += totalGrant;
        // 응답에는 단위 상품 정의가 아니라 실제 구매 수량이 반영된 확정 총량만 싣는다.
        granted.push({ ...grant, amount: totalGrant });
      }
      // 아이템 지급도 같은 복제본에서 상한까지 검증한 뒤에만 쓴다. 룬은 여전히 DNA의 명시적
      // 인스턴스 발급 계약이 맡으므로 여기서 만들지 않는다.
      if (grant.kind === "item") {
        const totalGrant = totalGrantAmount(grant.amount, quantity);
        const cap = findItem(grant.itemId)?.maxStack ?? 9_999;
        const stack = nextItems.find(({ itemId }) => itemId === grant.itemId);
        if (!Number.isSafeInteger(totalGrant) || (stack?.quantity ?? 0) + totalGrant > cap) throw new GameApiError("CURRENCY_LIMIT_EXCEEDED", "지급 후 아이템 상한을 초과합니다.");
        if (stack) stack.quantity += totalGrant;
        else nextItems = [...nextItems, { itemId: grant.itemId, quantity: totalGrant }];
        granted.push({ ...grant, amount: totalGrant });
      }
    }
    const periodKey = this.productPeriodKey(product, now);
    const current = this.state.productPurchases[product.id];
    const count = (current?.periodKey === periodKey ? current.count : 0) + quantity;
    const nextPurchases = { ...this.state.productPurchases, [product.id]: { periodKey, count } };
    this.persist({ ...this.state, wallet: nextWallet, runeInventory: nextRunes, itemInventory: nextItems, productPurchases: nextPurchases });
    this.state.wallet = nextWallet; this.state.runeInventory = nextRunes; this.state.itemInventory = nextItems; this.state.productPurchases = nextPurchases;
    return { ...this.snapshot(), productId, quantity, granted, grantedRunes: grantedRunes.map((rune) => this.cloneRune(rune)), remaining: Math.max(0, product.purchaseLimit - count) };
  }

  /** DNA 조각을 무작위 결과가 아닌 명시적으로 고른 렐릭·제작 재료·과거 재화로 교환한다. */
  async exchangeDna(request: ExchangeDnaRequest): Promise<ExchangeDnaResponse> {
    await this.delay();
    const offer = DNA_EXCHANGE_OFFERS.find((candidate) => candidate.id === request.offerId);
    if (!offer) throw new GameApiError("DNA_OFFER_NOT_FOUND", "존재하지 않는 DNA 교환품입니다.");
    if (this.state.wallet.dnaFragments < offer.dnaCost) throw new GameApiError("INSUFFICIENT_CURRENCY", "DNA 조각이 부족합니다.");

    const nextWallet = { ...this.state.wallet, dnaFragments: this.state.wallet.dnaFragments - offer.dnaCost };
    const nextProgress = { ...this.state.relicProgress };
    const nextFragments = { ...this.state.relicFragments };
    const nextRunes = [...this.state.runeInventory];
    let grantedRune: RuneInstance | undefined;
    if (offer.kind === "relic_fragment") {
      const target = request.relicId ? this.state.relicProgress[request.relicId] : undefined;
      if (!request.relicId || !this.state.owned.has(request.relicId) || !target) {
        throw new GameApiError("INVALID_EXCHANGE_TARGET", "보유한 렐릭을 선택해야 합니다.");
      }
      // 마일리지는 파편으로 돌아온다. 별을 올릴지는 플레이어가 정보창에서 정한다.
      nextFragments[request.relicId] = (nextFragments[request.relicId] ?? 0) + 1;
    } else if (offer.kind === "rune") {
      grantedRune = this.createGrantedRune(offer.rarity, nextRunes);
      nextRunes.push(grantedRune);
    } else {
      nextWallet.fossil += offer.fossilAmount;
    }

    const nextState = { ...this.state, wallet: nextWallet, relicProgress: nextProgress, relicFragments: nextFragments, runeInventory: nextRunes };
    this.persist(nextState);
    this.state.wallet = nextWallet; this.state.relicProgress = nextProgress; this.state.relicFragments = nextFragments; this.state.runeInventory = nextRunes;
    return { ...this.snapshot(), offerId: offer.id, rewardKind: offer.kind, relicId: offer.kind === "relic_fragment" ? request.relicId : undefined, grantedRune: grantedRune ? this.cloneRune(grantedRune) : undefined };
  }

  /** 검증 뒤 서버 난수로 한 번 판정하고 골드·룬을 새 상태에 함께 저장한다. */
  async enhanceRune(request: EnhanceRuneRequest): Promise<EnhanceRuneResponse> {
    await this.delay();
    const current = this.ownedRune(request.runeInstanceId);
    const optionExists = [...current.mainStats, ...current.subStats].some(({ key }) => key === request.statId);
    if (!optionExists) throw new GameApiError("RUNE_STAT_EXHAUSTED", "룬에 존재하지 않는 능력치입니다.");
    if (current.enhancementComplete) throw new GameApiError("RUNE_ENHANCEMENT_COMPLETE", "모든 일반 강화를 완료한 룬입니다.");
    if (!canEnhanceRune(current, request.statId)) throw new GameApiError("RUNE_STAT_EXHAUSTED", "이 능력치의 강화 횟수를 모두 사용했습니다.");
    const goldSpent = runeEnhancementGoldCost(current.rarity, runeEnhancementAttempts(current));
    if (this.state.wallet.gold < goldSpent) throw new GameApiError("INSUFFICIENT_GOLD", "룬 강화에 필요한 골드가 부족합니다.");

    // 성공 여부와 등급별 고정 증가량은 모두 서버 규칙이 소유하며 요청은 선택만 전달한다.
    const rune = applyRuneEnhancement(current, request.statId, runeEnhancementIncrease(current.rarity, request.statId), this.random());
    const nextRunes = this.state.runeInventory.map((candidate) => candidate.instanceId === rune.instanceId ? rune : candidate);
    const nextWallet = { ...this.state.wallet, gold: this.state.wallet.gold - goldSpent };
    const nextState = { ...this.state, wallet: nextWallet, runeInventory: nextRunes };
    this.persist(nextState);
    this.state.wallet = nextWallet;
    this.state.runeInventory = nextRunes;
    const latest = rune.enhancementHistory[request.statId]?.at(-1);
    return { succeeded: latest?.succeeded === true, goldSpent, nextSuccessChance: rune.currentSuccessChance, rune: this.cloneRune(rune), inventory: this.runeInventoryDto() };
  }

  /** 일반 강화 완료와 미각인 상태를 확인하고 대상 옵션에 각인 결과 하나만 추가한다. */
  async engraveRune(request: EngraveRuneRequest): Promise<EngraveRuneResponse> {
    await this.delay();
    const current = this.ownedRune(request.runeInstanceId);
    if (!canEngraveRune(current)) throw new GameApiError("RUNE_ENGRAVING_NOT_ALLOWED", "모든 일반 강화 완료 후 각인 전 룬만 각인할 수 있습니다.");
    if (![...current.mainStats, ...current.subStats].some(({ key }) => key === request.statId)) throw new GameApiError("RUNE_ENGRAVING_NOT_ALLOWED", "룬에 존재하지 않는 능력치입니다.");
    // 각인은 한 번뿐인 확정 마무리다. 등급을 난수로 굴리지 않고 **세공 성공 한 번과 같은 값**을
    // 더한다 — 되돌릴 수 없는 마지막 조작의 결과가 운에 갈리면 무엇을 고를지 정할 수 없다.
    const rune = applyRuneEngraving(current, { statKey: request.statId, valueAdded: runeEnhancementIncrease(current.rarity, request.statId) });
    const nextRunes = this.state.runeInventory.map((candidate) => candidate.instanceId === rune.instanceId ? rune : candidate);
    const nextState = { ...this.state, runeInventory: nextRunes };
    this.persist(nextState);
    this.state.runeInventory = nextRunes;
    return { rune: this.cloneRune(rune), inventory: this.runeInventoryDto() };
  }

  /** 이름을 trim한 뒤 빈 값·길이·제어문자를 서버 경계에서 거부한다. */
  async renameRune(request: RenameRuneRequest): Promise<RenameRuneResponse> {
    await this.delay();
    const current = this.ownedRune(request.runeInstanceId);
    const name = request.name.trim();
    if (!name || [...name].length > MAX_RUNE_NAME_LENGTH || /[\u0000-\u001F\u007F-\u009F]/u.test(name)) throw new GameApiError("INVALID_RUNE_NAME", `룬 이름은 제어문자 없이 1~${MAX_RUNE_NAME_LENGTH}글자여야 합니다.`);
    const rune = { ...current, customName: name };
    assertValidRuneInstance(rune);
    const nextRunes = this.state.runeInventory.map((candidate) => candidate.instanceId === rune.instanceId ? rune : candidate);
    const nextState = { ...this.state, runeInventory: nextRunes };
    this.persist(nextState);
    this.state.runeInventory = nextRunes;
    return { rune: this.cloneRune(rune), inventory: this.runeInventoryDto() };
  }

  /**
   * 잠금·즐겨찾기 표시를 바꾼다.
   *
   * 주지 않은 값은 건드리지 않는다 — 별을 켜는 요청이 자물쇠까지 끄면 두 표시가 한 스위치가
   * 된다. 자물쇠는 판매를 실제로 막는 값이라 화면이 아니라 이 경계에 남는다.
   */
  async markRune(request: MarkRuneRequest): Promise<MarkRuneResponse> {
    await this.delay();
    const current = this.ownedRune(request.runeInstanceId);
    const rune: RuneInstance = {
      ...current,
      locked: request.locked ?? current.locked ?? false,
      bookmarked: request.bookmarked ?? current.bookmarked ?? false,
    };
    assertValidRuneInstance(rune);
    const nextRunes = this.state.runeInventory.map((candidate) => candidate.instanceId === rune.instanceId ? rune : candidate);
    this.persist({ ...this.state, runeInventory: nextRunes });
    this.state.runeInventory = nextRunes;
    return { rune: this.cloneRune(rune), inventory: this.runeInventoryDto() };
  }

  /** 존재·중복·장착·상한을 모두 복제 상태에서 검증한 뒤 제거와 골드 지급을 한 번만 저장한다. */
  async sellRunes(request: SellRunesRequest): Promise<SellRunesResponse> {
    await this.delay();
    const cached = this.runeSaleResults.get(request.requestId);
    if (cached) return structuredClone(cached);
    if (!request.requestId || request.instanceIds.length === 0 || new Set(request.instanceIds).size !== request.instanceIds.length) throw new GameApiError("INVALID_RUNE_SALE", "판매 요청 ID와 중복 없는 룬이 필요합니다.");
    const selected = request.instanceIds.map((id) => this.ownedRune(id));
    const equipped = new Set(Object.values(this.state.relicProgress).flatMap(({ heartGemSlots }) => heartGemSlots.filter((id): id is string => id !== null)));
    if (selected.some(({ instanceId }) => equipped.has(instanceId))) throw new GameApiError("RUNE_EQUIPPED", "장착 중인 룬은 판매할 수 없습니다.");
    // 자물쇠는 화면이 버튼을 감추는 것으로 끝내지 않는다. 실수로 판 것은 되돌릴 수 없다.
    if (selected.some(({ locked }) => locked)) throw new GameApiError("RUNE_LOCKED", "잠근 룬은 판매할 수 없습니다.");
    const goldAwarded = selected.reduce((sum, rune) => sum + runeSellValue(rune), 0);
    if (this.state.wallet.gold + goldAwarded > WALLET_CAPS.gold) throw new GameApiError("CURRENCY_LIMIT_EXCEEDED", "골드 상한을 초과해 판매할 수 없습니다.");
    const sold = new Set(request.instanceIds);
    const nextRunes = this.state.runeInventory.filter(({ instanceId }) => !sold.has(instanceId));
    const nextWallet = { ...this.state.wallet, gold: this.state.wallet.gold + goldAwarded };
    this.persist({ ...this.state, runeInventory: nextRunes, wallet: nextWallet });
    this.state.runeInventory = nextRunes; this.state.wallet = nextWallet;
    const response = { inventory: this.runeInventoryDto(), wallet: { ...nextWallet }, goldAwarded };
    this.runeSaleResults.set(request.requestId, structuredClone(response));
    return response;
  }

  /** 전체 렐릭 슬롯을 조회해 다른 슬롯에 이미 장착된 룬을 거부한다. */
  async equipRune(request: EquipRuneRequest): Promise<EquipRuneResponse> {
    await this.delay();
    this.ownedRune(request.runeInstanceId);
    if (!this.state.owned.has(request.relicId)) throw new GameApiError("RELIC_NOT_FOUND", "보유하지 않은 렐릭입니다.");
    this.assertRuneSlot(request.slotIndex);
    // 룬은 제 자리에만 들어간다. 화면이 이미 걸러 주지만, 자리 불변식은 서버가 지킨다.
    if (this.ownedRune(request.runeInstanceId).part !== request.slotIndex) throw new GameApiError("RUNE_SLOT_MISMATCH", "이 룬은 다른 칸의 조각입니다.");
    if (Object.values(this.state.relicProgress).some(({ heartGemSlots }) => heartGemSlots.includes(request.runeInstanceId))) throw new GameApiError("RUNE_ALREADY_EQUIPPED", "이미 다른 렐릭 또는 슬롯에 장착된 룬입니다.");
    const target = this.state.relicProgress[request.relicId];
    const slots = [...target.heartGemSlots] as [string | null, string | null, string | null];
    slots[request.slotIndex] = request.runeInstanceId;
    const nextProgress = { ...this.state.relicProgress, [request.relicId]: { ...target, heartGemSlots: slots } };
    const nextState = { ...this.state, relicProgress: nextProgress };
    this.persist(nextState);
    this.state.relicProgress = nextProgress;
    return { inventory: this.runeInventoryDto() };
  }

  /** 인스턴스 역참조 없이 지정한 렐릭 슬롯을 단일 장착표에서 비운다. */
  async unequipRune(request: UnequipRuneRequest): Promise<UnequipRuneResponse> {
    await this.delay();
    if (!this.state.owned.has(request.relicId)) throw new GameApiError("RELIC_NOT_FOUND", "보유하지 않은 렐릭입니다.");
    this.assertRuneSlot(request.slotIndex);
    const target = this.state.relicProgress[request.relicId];
    const slots = [...target.heartGemSlots] as [string | null, string | null, string | null];
    if (slots[request.slotIndex] === null) throw new GameApiError("RUNE_SLOT_EMPTY", "이미 비어 있는 룬 슬롯입니다.");
    slots[request.slotIndex] = null;
    const nextProgress = { ...this.state.relicProgress, [request.relicId]: { ...target, heartGemSlots: slots } };
    const nextState = { ...this.state, relicProgress: nextProgress };
    this.persist(nextState);
    this.state.relicProgress = nextProgress;
    return { inventory: this.runeInventoryDto() };
  }

  /** 노출 판정은 클라이언트 시간이 아니라 주입 가능한 서버 시간만 사용한다. */
  private isVisible(product: ProductDefinition, now: Date): boolean { return now >= new Date(product.visibleFrom) && now < new Date(product.visibleUntil); }

  /** 시작 포함·종료 제외 규칙을 주입된 서버 시각 한 곳에서 계산한다. */
  private eventStatus(event: EventDefinition, now: Date): "upcoming" | "active" | "ended" {
    if (now < new Date(event.startsAt)) return "upcoming";
    return now < new Date(event.endsAt) ? "active" : "ended";
  }

  /** 이벤트 전투와 구매가 공유하는 기간 가드다. */
  private assertEventActive(event: EventDefinition, now: Date): void {
    if (this.eventStatus(event, now) !== "active") throw new GameApiError("EVENT_NOT_ACTIVE", "현재 진행 중인 이벤트가 아닙니다.");
  }

  /** 일/주/계정 단위 제한을 비교할 안정적인 키로 바꾼다. */
  private productPeriodKey(product: ProductDefinition, now: Date): string {
    const day = now.toISOString().slice(0, 10);
    if (product.refresh === "daily") return day;
    if (product.refresh === "weekly") {
      const date = new Date(`${day}T00:00:00Z`); date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
      return date.toISOString().slice(0, 10);
    }
    // 월간은 UTC 달 하나가 곧 주기다. 달 길이가 달라도 키가 바뀌는 자리는 한 번뿐이다.
    if (product.refresh === "monthly") return day.slice(0, 7);
    return product.refresh === "once" ? "account" : "permanent";
  }

  /** 기간 키가 바뀐 구매 기록은 0회로 간주한다. */
  private remaining(product: ProductDefinition, now: Date): number {
    const record = this.state.productPurchases[product.id];
    const count = record?.periodKey === this.productPeriodKey(product, now) ? record.count : 0;
    return Math.max(0, product.purchaseLimit - count);
  }

  /** 모든 스테미나 요청이 공유하는 서버 정산 경계다. */
  private settleStaminaNow(now = this.now()): void {
    const maximum = staminaMaxForPlayer(this.state);
    const settled = settleStamina(this.state.wallet.stamina, maximum, this.state.staminaUpdatedAt, now);
    this.state.wallet.stamina = settled.amount;
    this.state.staminaUpdatedAt = settled.updatedAt;
    const fullAt = staminaTiming(settled.amount, maximum, settled.updatedAt).fullAt;
    // 정산 경계가 완충 시각을 소유하므로 화면이 DTO를 해석해 예약하지 않는다.
    if (fullAt) void this.notificationScheduler?.scheduleNotification({ id: `stamina-full:${fullAt}`, kind: "staminaFull", title: t("mail.stamina.title"), body: t("mail.stamina.body"), expiresAt: new Date(fullAt) });
    else void this.notificationScheduler?.cancelNotification("staminaFull");
  }

  /** 정산된 현재량과 이후 시각을 클라이언트 표시용 DTO로 묶는다. */
  private staminaDto(now: Date) {
    const maximum = staminaMaxForPlayer(this.state);
    const timing = staminaTiming(this.state.wallet.stamina, maximum, this.state.staminaUpdatedAt);
    return { current: this.state.wallet.stamina, maximum, serverTime: now.toISOString(), updatedAt: this.state.staminaUpdatedAt, ...timing };
  }

  private snapshot(): PlayerStateDto {
    const serverNow = this.now();
    this.settleStaminaNow(serverNow);
    // 중첩 슬롯까지 복사해 응답 변경이 서버 역할의 세션을 오염시키지 않게 한다.
    const relicProgress = Object.fromEntries(
      Object.entries(this.state.relicProgress).map(([id, progress]) => [id, { ...progress, heartGemSlots: [...progress.heartGemSlots] as typeof progress.heartGemSlots }]),
    );
    return {
      // 프로필 씬이 공식을 재계산하지 않도록 서버 역할의 확정 연구 진행을 그대로 복사한다.
      playerResearch: { ...this.state.playerResearch },
      wallet: { ...this.state.wallet },
      stamina: this.staminaDto(serverNow),
      gachaPityByGroup: Object.fromEntries(Object.entries(this.state.gachaPityByGroup).map(([id, pity]) => [id, { ...pity }])),
      ownedRelicIds: [...this.state.owned],
      relicProgress,
      relicFragments: { ...this.state.relicFragments },
      party: [...this.state.party],
      favorite: this.state.favorite,
      clearedStageIds: [...this.state.cleared],
      dailyContent: { date: normalizeDailyContent(this.state.dailyContent, this.now()).date, restorationEntries: normalizeDailyContent(this.state.dailyContent, this.now()).restorationEntries },
      missions: this.missionDtos(),
      runeInventory: this.runeInventoryDto(),
      dailyAdRewards: { date: this.state.dailyAdRewards.date, claimsBySlot: { ...this.state.dailyAdRewards.claimsBySlot } },
      adFreeMembership: this.hasAdFreeMembership(serverNow),
      cakeOperation: { ...this.state.cakeOperation },
    };
  }

  /**
   * 광고 제거 멤버십이 지금 살아 있는가.
   *
   * **만료는 서버 시각으로만 잰다.** 화면이 만료 시각을 받아 스스로 셈하면 기기 시계를 돌려
   * 잠긴 배율을 여는 길이 생기므로, 화면에는 이 불리언 하나만 내보낸다.
   */
  private hasAdFreeMembership(now: Date): boolean {
    return [...this.entitlements.values()].some((entitlement) => {
      const product = PRODUCTS.find(({ id }) => id === entitlement.productId);
      if (product?.passBenefit?.adFree !== true) return false;
      return entitlement.expiresAt === null || now.getTime() < new Date(entitlement.expiresAt).getTime();
    });
  }


  /* ── 고고학 ───────────────────────────────────────────────────────────────── */

  /**
   * 탐사 횟수를 서버 시각까지 정산한다.
   *
   * **모든 고고학 응답이 이 한 곳을 지난다** — 조회와 조작이 저마다 정산하면 판을 여는 순간의
   * 횟수와 화면이 방금 읽은 횟수가 갈린다.
   */
  private settleStrataChargesNow(): void {
    const settled = settleStrataCharges(this.state.archaeology.charges, this.state.archaeology.chargesUpdatedAt, this.now());
    this.state.archaeology.charges = settled.charges;
    this.state.archaeology.chargesUpdatedAt = settled.updatedAt;
  }

  /** 고고학 응답의 공통 몸통이다. 판은 연 칸만 담아 내려보낸다. */
  private archaeologyDto(): ArchaeologyStateResponse {
    const { charges, chargesUpdatedAt, board } = this.state.archaeology;
    return {
      charges,
      chargesMax: STRATA_CHARGE.max,
      nextChargeAt: chargesUpdatedAt ? nextStrataChargeAt(charges, chargesUpdatedAt) : null,
      board: board ? strataBoardView(board) : null,
      sites: ARCHAEOLOGY_SITES.map((site) => {
        const availability = archaeologySiteAvailability(site, this.state.playerResearch.level);
        return {
          siteId: site.id,
          unlocked: this.state.archaeology.unlockedSiteIds.includes(site.id) || availability.available,
          completed: this.state.archaeology.completedSiteIds.includes(site.id),
          missingLevel: availability.missingLevel,
          // 재사용 대기는 해금과 다른 축이다 — 열려 있지만 지금은 못 들어가는 자리를 화면이
          // 「잠김」과 같은 말로 부르면 레벨을 올리면 열리는 줄 안다.
          cooldownUntil: strataSiteCooldownUntil(this.state.archaeology.siteCooldowns, site.id, this.now()),
        };
      }),
      serverTime: this.now().toISOString(),
    };
  }

  async archaeologyState(): Promise<ArchaeologyStateResponse> {
    await this.delay();
    this.settleStrataChargesNow();
    this.persist(this.state);
    return this.archaeologyDto();
  }

  async startStrataRun(request: StartStrataRunRequest): Promise<ArchaeologyStateResponse> {
    await this.delay();
    this.settleStrataChargesNow();
    const site = request.siteId ? findArchaeologySite(request.siteId) : undefined;
    const layerId = site?.layerId ?? request.layerId;
    if (!layerId || findStrataLayer(layerId) === undefined) throw new GameApiError("STRATA_RUN_NOT_FOUND", "존재하지 않는 지층입니다.");
    if (request.siteId && !site) throw new GameApiError("STRATA_RUN_NOT_FOUND", "존재하지 않는 유적입니다.");
    if (site) {
      // 클라이언트의 unlocked 표시를 신뢰하지 않고 서버가 가진 연구 레벨로 다시 검증한다.
      const availability = archaeologySiteAvailability(site, this.state.playerResearch.level);
      if (!availability.available && !this.state.archaeology.unlockedSiteIds.includes(site.id)) throw new GameApiError("STRATA_SITE_LOCKED", "아직 탐사할 수 없는 유적입니다.");
    }
    // 진행 중인 판이 있으면 새로 열지 않는다 — 횟수를 이미 치른 판이라 덮으면 그 한 번이 사라진다.
    if (this.state.archaeology.board !== null) throw new GameApiError("STRATA_RUN_ACTIVE", "아직 끝나지 않은 탐사가 있습니다.");
    if (this.state.archaeology.charges <= 0) throw new GameApiError("STRATA_NO_CHARGE", "탐사 횟수가 부족합니다.");
    // 같은 자리를 연달아 파는 것만 막는다. 대기 중인 유적은 해금 상태와 무관하게 거절한다.
    if (site && strataSiteCooldownUntil(this.state.archaeology.siteCooldowns, site.id, this.now()) !== null) {
      throw new GameApiError("STRATA_SITE_COOLING", "아직 다시 탐사할 수 없는 유적입니다.");
    }
    this.state.archaeology.charges -= 1;
    // 가득 찬 상태에서 하나를 쓰는 순간이 곧 다음 충전이 시작되는 시각이다.
    this.state.archaeology.chargesUpdatedAt = this.now().toISOString();
    this.state.archaeology.board = createStrataBoard({ layerId, siteId: site?.id, random: this.random });
    this.persist(this.state);
    return this.archaeologyDto();
  }

  /**
   * 판을 치우고 그 유적에 재사용 대기를 건다.
   *
   * **다 판 판과 중간에 끝낸 판이 같은 자리를 지난다** — 끝내는 방식마다 따로 적으면 한쪽만
   * 고쳐도 다른 쪽이 옛 규칙으로 남는다. 완료 이력에도 함께 올린다: 판을 여는 데 이미 횟수를
   * 한 번 치렀으므로, 중간에 그만둔 것이 선행 조건을 영영 막는 함정이 되면 안 된다.
   */
  private closeStrataBoard(siteId: string | undefined): void {
    if (siteId) {
      if (!this.state.archaeology.completedSiteIds.includes(siteId)) this.state.archaeology.completedSiteIds.push(siteId);
      this.state.archaeology.siteCooldowns = beginStrataSiteCooldown(this.state.archaeology.siteCooldowns, siteId, this.now());
    }
    this.state.archaeology.board = null;
  }

  /**
   * 남은 횟수를 버리고 판을 닫는다.
   *
   * **아무것도 지급하지 않는다** — 캔 것은 칸을 팔 때 이미 지갑에 들어갔다. 여기서 한 번 더
   * 주면 같은 보상이 두 번 들어가고, 화면의 영수증은 그 사실을 말할 방법이 없다.
   */
  async abandonStrataRun(_request: AbandonStrataRunRequest): Promise<ArchaeologyStateResponse> {
    await this.delay();
    this.settleStrataChargesNow();
    const board = this.state.archaeology.board;
    if (board === null) throw new GameApiError("STRATA_RUN_NOT_FOUND", "진행 중인 탐사가 없습니다.");
    this.closeStrataBoard(board.siteId);
    this.persist(this.state);
    return this.archaeologyDto();
  }

  async digStrataTile(request: DigStrataTileRequest): Promise<DigStrataTileResponse> {
    await this.delay();
    this.settleStrataChargesNow();
    const board = this.state.archaeology.board;
    if (board === null) throw new GameApiError("STRATA_RUN_NOT_FOUND", "진행 중인 탐사가 없습니다.");
    if (!canDigStrataTile(board, request.tileIndex)) throw new GameApiError("STRATA_TILE_UNAVAILABLE", "이미 열었거나 팔 수 없는 칸입니다.");
    const result = digTile(board, request.tileIndex);
    this.state.archaeology.board = result.board;
    const tile = result.tile;
    let grantedRune: RuneInstance | undefined;
    let grantedItemId: string | undefined;
    if (tile.kind === "rune") {
      // 희귀도도 서버가 정한다. 어느 룬이 나올지는 발굴의 일부라 요청이 주장하지 못한다.
      const roll = this.random();
      const rarity: RuneRarity = roll < 0.55 ? "uncommon" : roll < 0.85 ? "rare" : roll < 0.97 ? "epic" : "legendary";
      grantedRune = this.createGrantedRune(rarity, this.state.runeInventory);
      this.state.runeInventory = [...this.state.runeInventory, grantedRune];
    } else if (tile.kind === "researchItem") {
      // 상위 아이템은 아주 드물다. 무한 과금 없이도 모이되, 흔하면 특성 연구가 리롤을 거친다.
      const roll = this.random();
      grantedItemId = roll < 0.78 ? RUNE_TRAIT_ITEMS.grant.itemId : roll < 0.96 ? RUNE_TRAIT_ITEMS.grantHigh.itemId : RUNE_TRAIT_ITEMS.upgrade.itemId;
      const stack = this.state.itemInventory.find(({ itemId }) => itemId === grantedItemId);
      if (stack) stack.quantity += tile.amount;
      else this.state.itemInventory = [...this.state.itemInventory, { itemId: grantedItemId, quantity: tile.amount }];
    } else if (tile.kind !== "empty") {
      this.state.wallet[tile.kind] = Math.min(WALLET_CAPS[tile.kind], this.state.wallet[tile.kind] + tile.amount);
    }
    // 판을 다 판 순간 치운다 — 남겨 두면 다음에 들어온 사람이 아무것도 팔 수 없는 판을 본다.
    if (this.state.archaeology.board && this.state.archaeology.board.digsLeft <= 0) {
      this.closeStrataBoard(this.state.archaeology.board.siteId);
    }
    this.persist(this.state);
    const inventory = await this.getInventory();
    return {
      ...this.archaeologyDto(),
      tile: { index: tile.index, kind: tile.kind, amount: tile.amount },
      wallet: { ...this.state.wallet },
      items: inventory.items,
      ...(grantedRune ? { grantedRune: this.cloneRune(grantedRune) } : {}),
      ...(grantedItemId ? { grantedItemId } : {}),
    };
  }

  /** 아이템 한 개를 차감한다. 모자라면 아무것도 바꾸지 않는다. */
  private consumeTraitItem(itemId: string): void {
    const stack = this.state.itemInventory.find((entry) => entry.itemId === itemId);
    if (!stack || stack.quantity < 1) throw new GameApiError("INSUFFICIENT_ITEMS", "아이템 수량이 부족합니다.");
    this.state.itemInventory = this.state.itemInventory.flatMap((entry) =>
      entry.itemId === itemId ? (entry.quantity > 1 ? [{ ...entry, quantity: entry.quantity - 1 }] : []) : [{ ...entry }]);
  }

  /** 룬 하나를 새 값으로 갈아 끼운 인벤토리를 만든다. */
  private replaceRune(rune: RuneInstance): void {
    this.state.runeInventory = this.state.runeInventory.map((candidate) => candidate.instanceId === rune.instanceId ? rune : candidate);
  }

  async grantRuneTrait(request: GrantRuneTraitRequest): Promise<GrantRuneTraitResponse> {
    await this.delay();
    const current = this.ownedRune(request.runeInstanceId);
    const entry = [RUNE_TRAIT_ITEMS.grant, RUNE_TRAIT_ITEMS.grantHigh].find(({ itemId }) => itemId === request.itemId);
    if (!entry) throw new GameApiError("RUNE_TRAIT_ITEM_INVALID", "특성을 부여할 수 있는 아이템이 아닙니다.");
    this.consumeTraitItem(entry.itemId);
    const trait = rollRuneTrait({ traitIds: RUNE_TRAIT_IDS, minimumGrade: entry.minimumGrade, random: this.random });
    const rune: RuneInstance = { ...current, trait };
    assertValidRuneInstance(rune);
    this.replaceRune(rune);
    // 부여로 특성이 바뀌면 들고 있던 재해석 후보는 그 특성의 것이 아니다.
    if (this.state.archaeology.pendingReroll?.runeInstanceId === rune.instanceId) this.state.archaeology.pendingReroll = null;
    this.persist(this.state);
    const inventory = await this.getInventory();
    return { rune: this.cloneRune(rune), items: inventory.items };
  }

  async rerollRuneTrait(request: RerollRuneTraitRequest): Promise<RerollRuneTraitResponse> {
    await this.delay();
    const current = this.ownedRune(request.runeInstanceId);
    if (current.trait === undefined) throw new GameApiError("RUNE_TRAIT_NOT_FOUND", "재해석할 특성이 없습니다.");
    // 아직 고르지 않은 후보가 있으면 새로 굴리지 않는다 — 새로 굴리면 먼저 뽑힌 것이 조용히 사라진다.
    if (this.state.archaeology.pendingReroll !== null) throw new GameApiError("RUNE_TRAIT_REROLL_PENDING", "아직 고르지 않은 재해석 결과가 있습니다.");
    const cost = RUNE_TRAIT_RULES.rerollCost[current.trait.grade];
    if (this.state.wallet.rawStone < cost) throw new GameApiError("INSUFFICIENT_CURRENCY", "재해석에 필요한 원석이 부족합니다.");
    const outcome = rollRuneTraitReroll({ trait: current.trait, traitIds: RUNE_TRAIT_IDS, random: this.random });
    this.state.wallet = { ...this.state.wallet, rawStone: this.state.wallet.rawStone - cost };
    this.state.archaeology.pendingReroll = { runeInstanceId: current.instanceId, candidate: outcome.candidate };
    this.persist(this.state);
    return {
      runeInstanceId: current.instanceId,
      current: { ...current.trait },
      candidate: { ...outcome.candidate },
      upgraded: outcome.upgraded,
      byPity: outcome.byPity,
      rawStoneSpent: cost,
      wallet: { ...this.state.wallet },
    };
  }

  async resolveRuneTraitReroll(request: ResolveRuneTraitRerollRequest): Promise<ResolveRuneTraitRerollResponse> {
    await this.delay();
    const current = this.ownedRune(request.runeInstanceId);
    const pending = this.state.archaeology.pendingReroll;
    if (!pending || pending.runeInstanceId !== current.instanceId) throw new GameApiError("RUNE_TRAIT_NOT_FOUND", "고를 재해석 결과가 없습니다.");
    // **버려도 실패 횟수는 남는다** — 천장이 「후보를 받아들인 횟수」가 되면 버리기만 해서
    // 천장을 피해 갈 수 있고, 그러면 천장이 아무것도 보장하지 않는다.
    const kept: RuneTrait = request.keepCandidate
      ? pending.candidate
      : { ...(current.trait ?? pending.candidate), upgradeMisses: pending.candidate.upgradeMisses };
    const rune: RuneInstance = { ...current, trait: kept };
    assertValidRuneInstance(rune);
    this.replaceRune(rune);
    this.state.archaeology.pendingReroll = null;
    this.persist(this.state);
    return { rune: this.cloneRune(rune) };
  }

  async upgradeRuneTrait(request: UpgradeRuneTraitRequest): Promise<UpgradeRuneTraitResponse> {
    await this.delay();
    const current = this.ownedRune(request.runeInstanceId);
    if (request.itemId !== RUNE_TRAIT_ITEMS.upgrade.itemId) throw new GameApiError("RUNE_TRAIT_ITEM_INVALID", "등급을 올릴 수 있는 아이템이 아닙니다.");
    if (current.trait === undefined) throw new GameApiError("RUNE_TRAIT_NOT_FOUND", "등급을 올릴 특성이 없습니다.");
    if (!canUpgradeRuneTraitGrade(current.trait)) throw new GameApiError("RUNE_TRAIT_MAX_GRADE", "전설 특성은 더 올릴 수 없습니다.");
    this.consumeTraitItem(request.itemId);
    const rune: RuneInstance = { ...current, trait: upgradeRuneTraitGrade(current.trait) };
    assertValidRuneInstance(rune);
    this.replaceRune(rune);
    this.persist(this.state);
    const inventory = await this.getInventory();
    return { rune: this.cloneRune(rune), items: inventory.items };
  }

  /** 희귀도 계약만 받아 옵션과 고유 ID를 서버가 소유하는 새 룬 인스턴스로 발급한다. */
  private createGrantedRune(rarity: RuneRarity, inventory: readonly RuneInstance[]): RuneInstance {
    const occupied = new Set(inventory.map(({ instanceId }) => instanceId));
    let instanceId: string;
    // 저장 데이터에 같은 시각 기반 ID가 있어도 순번을 전진시키며 실제 미사용 ID를 고른다.
    do { instanceId = `rune-${this.now().getTime()}-${this.runeIssueSequence++}`; } while (occupied.has(instanceId));
    // 자리도 서버가 정한다. 어느 칸의 룬이 나올지는 획득의 일부다.
    const part = Math.min(2, Math.floor(this.random() * 3)) as RunePart;
    return { ...generateRune({ instanceId, baseName: t("rune.baseName", { part: runePartLabel(part) }), rarity, part, random: this.random }), sequence: this.now().getTime() * 1000 + this.runeIssueSequence };
  }

  /** 보유 인벤토리에서만 룬을 찾아 존재 여부와 소유권을 한 번에 확정한다. */
  private ownedRune(instanceId: string): RuneInstance {
    const rune = this.state.runeInventory.find((candidate) => candidate.instanceId === instanceId);
    if (!rune) throw new GameApiError("RUNE_NOT_FOUND", "보유하지 않거나 존재하지 않는 룬입니다.");
    return rune;
  }

  /** 광고 효과를 복제 상태에 계산해 카운터·지갑·발굴 상태를 한 persist로 커밋하게 한다. */
  private applyAdReward(reward: AdReward, now: Date): { wallet: Session["wallet"]; excavation: Session["idleExcavation"] } {
    const wallet = { ...this.state.wallet };
    let excavation = this.cloneExcavation(this.state.idleExcavation);
    if (reward.kind === "currency") {
      wallet[reward.currency] += reward.amount;
      return { wallet, excavation };
    }
    if (reward.kind === "quick_expedition") {
      // 기준 점수와 비율은 모두 서버 소유이며 클라이언트 요청에는 어느 값도 없다.
      const referenceScore = this.bossWeek.bestScore || this.previousBossBest;
      wallet.gold = Math.min(WALLET_CAPS.gold, wallet.gold + Math.floor(referenceScore * reward.scoreRatio));
      return { wallet, excavation };
    }
    // 효과 적용 직전까지를 먼저 정산해야 새 배율이 과거 생산에 소급되지 않는다.
    excavation = settleIdleExcavation(excavation, now, RELICS, this.state.relicProgress);
    const effect = reward.effect;
    if (effect.kind === "harvest_multiplier") excavation.pendingHarvestMultiplier = effect.multiplier;
    if (effect.kind === "storage_extension") excavation.storageExtensionExpiresAt = new Date(now.getTime() + effect.maxStorageSeconds * 1000).toISOString();
    if (effect.kind === "production_speed") {
      excavation.activeProductionMultiplier = effect.multiplier;
      // 중첩 곱셈이나 남은 시간 가산 없이 수령 시점 기준 만료로 갱신한다.
      excavation.productionMultiplierExpiresAt = new Date(now.getTime() + effect.durationSeconds * 1000).toISOString();
    }
    return { wallet, excavation };
  }

  /** 슬롯 번호 검증을 장착과 해제에서 공유한다. */
  private assertRuneSlot(slotIndex: number): void {
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= 3) throw new GameApiError("INVALID_RUNE_SLOT", "룬 슬롯은 0~2의 정수여야 합니다.");
  }

  /** 외부가 서버 상태를 바꾸지 못하도록 룬의 모든 중첩 배열을 복사한다. */
  private cloneRune(rune: RuneInstance): RuneInstance {
    return {
      ...rune,
      mainStats: [{ ...rune.mainStats[0] }, { ...rune.mainStats[1] }],
      subStats: rune.subStats.map((stat) => ({ ...stat })),
      enhancementHistory: Object.fromEntries(Object.entries(rune.enhancementHistory).map(([key, history]) => [key, history?.map((record) => ({ ...record }))])),
      engravings: rune.engravings.map((engraving) => ({ ...engraving })),
    };
  }

  /** 응답 호출자가 서버의 슬롯·미수확 객체를 직접 바꾸지 못하도록 복사한다. */
  private cloneExcavation(value: Session["idleExcavation"]): Session["idleExcavation"] {
    return { ...value, assignedRelicIds: [...value.assignedRelicIds], unclaimed: { ...value.unclaimed } };
  }

  /** 룬에 역참조를 넣지 않고 렐릭 슬롯 맵을 전송용 행 배열로 바꾼다. */
  private runeInventoryDto(): RuneInventoryDto {
    return {
      runes: this.state.runeInventory.map((rune) => this.cloneRune(rune)),
      equipment: Object.entries(this.state.relicProgress).map(([relicId, progress]) => ({ relicId, slots: [...progress.heartGemSlots] as [string | null, string | null, string | null] })),
    };
  }

  /** 정적 정의와 저장 진행을 결합한 전송 전용 복사본을 만든다. */
  private missionDtos() {
    const normalized = normalizeMissions(this.state.missions, this.now());
    return MISSIONS.map((mission) => ({ ...mission, progress: normalized.progress[mission.id] ?? 0, claimed: normalized.claimedIds.includes(mission.id) }))
      .map(({ event: _event, ...dto }) => dto);
  }

  /** 두 탭이 같은 스냅샷을 그리도록 기간별 연구도와 마디 상태를 한 응답에 묶는다. */
  private missionListDto(normalized = normalizeMissions(this.state.missions, this.now())): MissionListResponse {
    const research = Object.fromEntries((["daily", "weekly"] as const).map((period) => [period, {
      points: normalized.researchPoints[period], maxPoints: MAX_RESEARCH_POINTS,
      stages: RESEARCH_REWARD_STAGES.map((stage) => ({ ...stage, achieved: normalized.researchPoints[period] >= stage.threshold, claimed: normalized.claimedResearchStageIds.includes(researchStageClaimId(period, stage.id)) })),
    }])) as MissionListResponse["research"];
    const stageClaimable = Object.values(research).reduce((sum, value) => sum + value.stages.filter((stage) => stage.achieved && !stage.claimed).length, 0);
    return { missions: this.missionDtos(), claimableCount: claimableMissionIds(normalized).length + stageClaimable, research };
  }

  /** 주차가 달라지면 점수·누적·수령 단계를 함께 버려 지난주 보상이 새 주에 새지 않게 한다. */
  private normalizeBossWeek(now: Date): void {
    const weekKey = expeditionWeekKey(now);
    if (this.bossWeek.weekKey !== weekKey) { this.previousBossBest = this.bossWeek.bestScore; this.bossWeek = { weekKey, bestScore: 0, cumulativeScore: 0, achievedAt: "", claimedStageIds: [] }; }
  }

  /** 주입 어댑터를 우선 사용하고, 없으면 공유 세션만 브라우저에 저장해 독립 테스트 부작용을 막는다. */
  private persist(next: Session): void {
    // 모든 쓰기 API가 공유하는 마지막 경계에서 음수·상한·중복을 저장 전에 차단한다.
    this.validateState(next);
    // validateState의 도메인 오류는 그대로 두고 실제 저장 장치 오류만 공용 API 실패로 분류한다.
    try {
      if (this.persistSession) this.persistSession(next);
      else if (this.state === session) saveManager.save(next);
    } catch (error) {
      throw persistenceFailed(error);
    }
  }

  /** 실제 HTTP 서버로 옮겨도 그대로 적용할 API 응답 직전 불변식 검사다. */
  private validateState(next: Session): void {
    for (const [currency, cap] of Object.entries(WALLET_CAPS) as [keyof typeof WALLET_CAPS, number][]) {
      const amount = next.wallet[currency];
      if (!Number.isInteger(amount) || amount < 0) throw new GameApiError("INVALID_STATE", `${currency} 재화는 음수가 아닌 정수여야 합니다.`);
      if (amount > cap) throw new GameApiError("CURRENCY_LIMIT_EXCEEDED", `${currency} 재화 상한을 초과했습니다.`);
    }
    const runeIds = next.runeInventory.map((rune) => { try { assertValidRuneInstance(rune); } catch { throw new GameApiError("INVALID_STATE", "손상된 룬 인스턴스가 있습니다."); } return rune.instanceId; });
    if (new Set(runeIds).size !== runeIds.length) throw new GameApiError("INVALID_STATE", "룬 인스턴스 ID가 중복되었습니다.");
    // 성장 레코드의 세 슬롯만 장착 기준으로 사용해 별도 장착표와의 불일치를 없앤다.
    const equipped = Object.values(next.relicProgress).flatMap(({ heartGemSlots }) => heartGemSlots.filter((id): id is string => id !== null));
    if (equipped.some((id) => !runeIds.includes(id)) || new Set(equipped).size !== equipped.length) throw new GameApiError("INVALID_STATE", "룬 장착 소유권 또는 중복이 올바르지 않습니다.");
    if (Object.values(next.relicProgress).some((progress) => progress.breakthrough < 0 || progress.breakthrough > BREAKTHROUGH_CAP)) throw new GameApiError("INVALID_STATE", "렐릭 한계 돌파 상한을 벗어났습니다.");
  }

  private delay(): Promise<void> {
    // globalThis를 써서 브라우저와 Vitest(Node) 양쪽에서 같은 구현을 사용한다.
    return new Promise((resolve) => globalThis.setTimeout(resolve, this.latencyMs));
  }
}

/** 씬이 공유하는 임시 API 구현체다. 나중에는 이 한 줄을 HTTP 구현으로 교체한다. */
export const gameApi: GameApi = new FakeServer();
