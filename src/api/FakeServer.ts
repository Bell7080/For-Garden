import { canPull, pull, resolveAcquisitions, spend } from "../core/gacha";
import { BANNERS } from "../data/banners";
import { RELICS } from "../data/relics";
import { AD_REWARD_SLOTS, findAdRewardSlot, type AdReward } from "../data/adRewards";
import { consumeRestorationEntry, normalizeDailyContent } from "../core/dailyContent";
import { BREAKTHROUGH_CAP, canBreakThrough, canFeedRelic, feedRelic as calculateFeed, FEED_UNIT, nextBreakthrough, relicLevelCap, RELIC_STAR_CAP, relicStars } from "../core/relicProgression";
import { BOND_XP_REWARD, grantBondXp, grantDailyLobbyBondXp } from "../core/bond";
import { MAX_RESEARCH_POINTS, MISSIONS, RESEARCH_REWARD_STAGES, applyMissionEvent, claimResearchStages, claimableMissionIds, normalizeMissions, researchStageClaimId, type MissionPeriod } from "../core/missions";
import { DAILY_RESTORATION, getStage } from "../data/stages";
import { createInitialRelicProgress, session, type Session } from "../state/session";
import { saveManager } from "../state/SaveManager";
import { GameApiError, type AdOperationsConfigResponse, type BreakThroughResponse, type ClaimMissionRewardsResponse, type CompleteStageResponse, type EnterDailyRestorationResponse, type FeedRelicResponse, type GameApi, type LobbyInteractionResponse, type MissionListResponse, type PlayerStateDto, type ClaimAdRewardRequest, type ClaimAdRewardResponse, type PullRequest, type PullResponse } from "./contracts";
import type { ProductDefinition } from "../data/products";
import { PRODUCTS } from "../data/products";
import type { ProductListResponse, PurchaseProductResponse } from "./contracts";
import type { ExchangeDnaRequest, ExchangeDnaResponse } from "./contracts";
import { DNA_EXCHANGE_OFFERS, WALLET_CAPS } from "../data/economy";
import { EVENTS, findEventByProductId, findEventByStageId } from "../data/events";
import type { EventDefinition } from "../data/events/types";
import type { EnterEventStageResponse, EventListResponse } from "./contracts";
import { assertValidRuneInstance, canEngraveRune, canEnhanceRune, generateRune, RUNE_PART_LABELS, type RunePart, engraveRune as applyRuneEngraving, enhanceRune as applyRuneEnhancement, runeEnhancementAttempts, runeEnhancementIncrease, type RuneInstance, type RuneRarity } from "../core/runes";
import { runeEnhancementGoldCost } from "../data/runes";
import { findItem, STAMINA_CAP } from "../data/items";
import { InventoryManager } from "../managers/InventoryManager";
import type { EngraveRuneRequest, EngraveRuneResponse, EnhanceRuneRequest, EnhanceRuneResponse, EquipRuneRequest, EquipRuneResponse, RenameRuneRequest, RenameRuneResponse, RuneInventoryDto, UnequipRuneRequest, UnequipRuneResponse } from "./contracts";
import type { ActivatePassRequest, ActivatePassResponse, ClaimInstantAdRewardRequest, ClaimInstantAdRewardResponse, PassEntitlementDto, VerifyPurchaseReceiptRequest, VerifyPurchaseReceiptResponse } from "./contracts";
import { harvestIdleExcavation, isExcavationStorageFull, settleIdleExcavation, validateExcavationFormation } from "../core/idleExcavation";
import type { HarvestExcavationRequest, HarvestExcavationResponse, IdleExcavationResponse, SaveExcavationFormationRequest, InventoryResponse, UseConsumableRequest, UseConsumableResponse } from "./contracts";
import type { ClaimExpeditionRewardRequest, ClaimExpeditionRewardResponse, CompleteExpeditionNodeRequest, CompleteExpeditionNodeResponse, ExpeditionLeaderboardResponse, ExpeditionWeeklyBestResponse, SettleExpeditionRunRequest, SettleExpeditionRunResponse, SubmitExpeditionBossScoreRequest, SubmitExpeditionBossScoreResponse } from "./contracts";
import { expeditionWeekKey, resolveExpeditionBossBattle } from "../core/expeditionBoss";
import { EXPEDITION_BOSS_BALANCE, EXPEDITION_CUMULATIVE_REWARD_STAGES, EXPEDITION_NODE_REWARD_BALANCE, QUICK_EXPEDITION_POLICY } from "../data/expedition";
import { calculateExpeditionNodeRewards } from "../core/expeditionRewards";
import { RelicProgressionManager } from "../managers/RelicProgressionManager";
import { expeditionBattleEffects } from "../core/expeditionBattle";
import { attackPowerMultiplier } from "../core/expeditionAugments";

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
}

/** 백엔드가 생기기 전까지 메모리 상태를 서버처럼 독점 변경하는 임시 어댑터다. */
export class FakeServer implements GameApi {
  private readonly latencyMs: number;
  private readonly random: () => number;
  private readonly now: () => Date;
  private readonly verifyAdToken: (token: string, slotId: string) => boolean | Promise<boolean>;
  private readonly verifyReceipt: (receipt: string, productId: string) => string | null | Promise<string | null>;
  /** 아래 저장소들은 실제 서버의 고유 제약조건/트랜잭션을 흉내 내는 FakeServer 전용 멱등 기록이다. */
  private readonly receiptResults = new Map<string, VerifyPurchaseReceiptResponse>();
  private readonly verifiedTransactions = new Map<string, VerifyPurchaseReceiptResponse>();
  private readonly activationResults = new Map<string, ActivatePassResponse>();
  private readonly entitlements = new Map<string, PassEntitlementDto>();
  private readonly instantClaimResults = new Map<string, ClaimInstantAdRewardResponse>();
  private readonly bonusClaimDates = new Map<string, string>();
  /** 실제 서버의 멱등 테이블을 흉내 내며 성공한 발굴 변경 응답만 보관한다. */
  private readonly excavationFormationResults = new Map<string, IdleExcavationResponse>();
  private readonly excavationHarvestResults = new Map<string, HarvestExcavationResponse>();
  /** 개발용 결정론적 메모리 기록이다. 운영 서버가 점수·순위·보상 수령을 최종 소유해야 한다. */
  private bossWeek = { weekKey: "", bestScore: 0, cumulativeScore: 0, achievedAt: "", claimedStageIds: [] as string[] };
  private readonly bossSubmissionResults = new Map<string, SubmitExpeditionBossScoreResponse>();
  private readonly bossRewardResults = new Map<string, ClaimExpeditionRewardResponse>();
  /** 운영 DB의 런 ID/정산 ID 고유 제약과 빠른 원정 주간 카운터를 흉내 낸다. */
  private readonly expeditionSettlementResults = new Map<string, SettleExpeditionRunResponse>();
  /** 운영 DB의 requestId 고유 제약을 흉내 내 동일 노드 재요청을 같은 응답으로 돌린다. */
  private readonly expeditionNodeResults = new Map<string, CompleteExpeditionNodeResponse>();
  private previousBossBest = 0;
  private quickWeek = { weekKey: "", claims: 0 };
  /** 같은 밀리초 안의 연속 발급도 구분하는 서버 인스턴스 로컬 순번이다. */
  private runeIssueSequence = 0;

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
  }

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
    const now = this.now(); this.normalizeBossWeek(now);
    try {
      // 런 제출은 현재 파티가 아니라 서버에 저장된 원정 편성·HP·증강을 사용한다. 독립 보스 API
      // 테스트의 레거시 호출만 runId가 없을 때 기존 파티 스냅샷으로 되돌아간다.
      const run = request.runId ? this.state.expedition.run : null;
      if (request.runId && (!run || run.runId !== request.runId || !run.nodes.some(({ id, type }) => id === request.nodeId && type === "boss"))) throw new Error("INVALID_RUN");
      const roster = run?.relics ?? this.state.party.map((relicId) => ({ relicId, currentHp: 100, alive: true }));
      const effects = expeditionBattleEffects(run?.selectedAugments ?? []);
      const progression = new RelicProgressionManager(this.state);
      const allies = roster.map(({ relicId: id, currentHp }) => {
        const relic = RELICS.find((entry) => entry.id === id);
        if (!relic || !this.state.owned.has(id)) throw new Error("INVALID_PARTY");
        const stats = progression.getFinalStats(id);
        return { id, attack: Math.max(stats.atk, stats.ap) * attackPowerMultiplier(effects, id), maxHp: stats.hp, initialHp: stats.hp * currentHp / 100 };
      });
      const result = resolveExpeditionBossBattle(allies, request.actions);
      if (result.totalDamage > EXPEDITION_BOSS_BALANCE.maximumAcceptedScore) throw new Error("ABNORMAL_SCORE");
      const improved = result.totalDamage > this.bossWeek.bestScore;
      this.bossWeek.cumulativeScore += result.totalDamage;
      if (improved) { this.bossWeek.bestScore = result.totalDamage; this.bossWeek.achievedAt = now.toISOString(); }
      // 단일 개발 계정은 기록 전 미등재(null), 제출 뒤 1위다. 운영 구현은 같은 필드에 실제 변화를 넣는다.
      const response = { weekKey: this.bossWeek.weekKey, score: result.totalDamage, bestScore: this.bossWeek.bestScore, cumulativeScore: this.bossWeek.cumulativeScore, improved, endedAtMs: result.endedAtMs, rankBefore: this.previousBossBest > 0 ? 1 : null, rankAfter: 1 };
      this.previousBossBest = this.bossWeek.bestScore;
      this.bossSubmissionResults.set(request.requestId, response); return { ...response };
    } catch { throw new GameApiError("EXPEDITION_SCORE_REJECTED", "검증할 수 없거나 비정상적으로 큰 보스 점수입니다."); }
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
    await this.delay(); this.normalizeBossWeek(this.now()); const entries = this.bossWeek.bestScore > 0 ? [{ rank: 1, playerId: "local-player", displayName: "연구원", score: this.bossWeek.bestScore, achievedAt: this.bossWeek.achievedAt, isMe: true }] : [];
    return { weekKey: this.bossWeek.weekKey, tieBreakPolicy: "earliest-achieved-at", entries: entries.slice(0, Math.max(0, limit)) };
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
    const settledRun = { ...structuredClone(run), pendingRewards: {}, settled: true, settlementId: request.settlementId };
    const expedition = { ...this.state.expedition, playsThisWeek: this.state.expedition.playsThisWeek + 1, bestScore: request.outcome === "completed" ? Math.max(this.state.expedition.bestScore, run.bestScore) : this.state.expedition.bestScore, run: settledRun };
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
      || request.relicHp.some((hp) => !Number.isFinite(hp) || hp < 0)) throw new GameApiError("EXPEDITION_RUN_NOT_FOUND", "완료할 수 없는 원정 노드입니다.");
    // 전멸은 노드 종료만 기록하고 승리 재화는 생성하지 않는다.
    const rewards = request.relicHp.every((hp) => hp === 0) ? {} : calculateExpeditionNodeRewards({ nodeType: node.type, accumulated: run.pendingRewards, random: this.random });
    const next = structuredClone(run);
    next.currentNodeId = node.id; next.visitedNodeIds.push(node.id);
    next.relics.forEach((relic, index) => { relic.currentHp = request.relicHp[index]; relic.alive = relic.currentHp > 0; });
    for (const [currency, amount] of Object.entries(rewards)) next.pendingRewards[currency] = (next.pendingRewards[currency] ?? 0) + amount;
    const cappedCurrencies = Object.keys(EXPEDITION_NODE_REWARD_BALANCE).filter((currency) => (next.pendingRewards[currency] ?? 0) >= EXPEDITION_NODE_REWARD_BALANCE[currency as keyof typeof EXPEDITION_NODE_REWARD_BALANCE].runCap);
    next.lastNodeRewards = { nodeId: node.id, rewards, cappedCurrencies };
    const expedition = { ...this.state.expedition, run: next };
    this.persist({ ...this.state, expedition }); this.state.expedition = expedition;
    const response = { runId: run.runId, nodeId: node.id, rewards, pendingRewards: { ...next.pendingRewards }, cappedCurrencies, alreadyCompleted: false };
    this.expeditionNodeResults.set(request.requestId, response);
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
    return { items: (["rune", "currency", "consumable", "material"] as const).flatMap((category) => manager.list(category).map((item) => ({ id: item.id, definitionId: item.definition.id, category: item.category, quantity: item.quantity, definition: item.definition, ...(item.kind === "rune" ? { rune: this.cloneRune(item.rune) } : {}) }))) };
  }

  /** 보유량과 상한을 복제 상태에서 검증한 뒤 차감·효과·저장을 한 번에 확정한다. */
  async useConsumable(request: UseConsumableRequest): Promise<UseConsumableResponse> {
    await this.delay();
    const definition = findItem(request.itemId);
    if (!definition) throw new GameApiError("ITEM_NOT_FOUND", "존재하지 않는 아이템입니다.");
    if (definition.category !== "consumable" || definition.useEffect.kind === "none") throw new GameApiError("ITEM_NOT_USABLE", "사용할 수 없는 아이템입니다.");
    if (!Number.isInteger(request.quantity) || request.quantity <= 0) throw new GameApiError("INVALID_ITEM_QUANTITY", "사용 수량이 올바르지 않습니다.");
    const stack = this.state.itemInventory.find(({ itemId }) => itemId === request.itemId);
    if (!stack || stack.quantity < request.quantity) throw new GameApiError("INSUFFICIENT_ITEMS", "아이템 수량이 부족합니다.");
    if (definition.useEffect.kind === "restore_stamina" && this.state.wallet.stamina >= STAMINA_CAP) throw new GameApiError("STAMINA_FULL", "스테미나가 이미 가득 찼습니다.");
    const requested = definition.useEffect.amount * request.quantity;
    const appliedAmount = Math.min(requested, STAMINA_CAP - this.state.wallet.stamina);
    const nextWallet = { ...this.state.wallet, stamina: this.state.wallet.stamina + appliedAmount };
    const left = stack.quantity - request.quantity;
    const nextItems = this.state.itemInventory.flatMap((entry) => entry.itemId === request.itemId ? (left > 0 ? [{ ...entry, quantity: left }] : []) : [{ ...entry }]);
    this.persist({ ...this.state, wallet: nextWallet, itemInventory: nextItems });
    this.state.wallet = nextWallet; this.state.itemInventory = nextItems;
    const inventory = await this.getInventory();
    return { ...inventory, itemId: request.itemId, quantityUsed: request.quantity, effect: definition.useEffect, appliedAmount, wallet: { ...nextWallet } };
  }

  /** 서버의 단일 now 값을 캡처해 조회 정산과 응답 시각이 어긋나지 않게 한다. */
  async getIdleExcavation(): Promise<IdleExcavationResponse> {
    await this.delay(); const now = this.now();
    // 정산 뒤에는 기준 시각이 현재로 바뀌므로 상한 도달 여부를 먼저 보존한다.
    const storageFull = isExcavationStorageFull(this.state.idleExcavation, now);
    const next = settleIdleExcavation(this.state.idleExcavation, now, RELICS, this.state.relicProgress);
    this.persist({ ...this.state, idleExcavation: next }); this.state.idleExcavation = next;
    return { excavation: this.cloneExcavation(next), serverTime: now.toISOString(), storageFull };
  }

  /** 기존 편성의 생산을 먼저 정산한 뒤 새 세 칸을 같은 저장 처리로 확정한다. */
  async saveExcavationFormation(request: SaveExcavationFormationRequest): Promise<IdleExcavationResponse> {
    await this.delay(); const cached = this.excavationFormationResults.get(request.requestId);
    if (cached) return { excavation: this.cloneExcavation(cached.excavation), serverTime: cached.serverTime };
    const validation = validateExcavationFormation(request.assignedRelicIds, this.state.owned);
    // 요청 ID와 순수 모델의 보유/중복 검증을 모두 통과한 편성만 저장한다.
    if (!request.requestId || !validation.valid) throw new GameApiError("INVALID_STATE", "발굴 편성이 올바르지 않습니다.");
    const now = this.now(); const settled = settleIdleExcavation(this.state.idleExcavation, now, RELICS, this.state.relicProgress);
    const next = { ...settled, assignedRelicIds: [...request.assignedRelicIds] as [string | null, string | null, string | null] };
    this.persist({ ...this.state, idleExcavation: next }); this.state.idleExcavation = next;
    const response = { excavation: this.cloneExcavation(next), serverTime: now.toISOString() };
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
    const response = { excavation: this.cloneExcavation(result.state), serverTime: now.toISOString(), wallet: { ...result.wallet }, granted: { ...result.granted }, discarded: { ...result.discarded }, remaining: { ...result.state.unclaimed } };
    this.excavationHarvestResults.set(request.requestId, response); return response;
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
    if (!request.requestId || !product?.passBenefit || product.price.currency !== "real_money") throw new GameApiError("RECEIPT_INVALID", "후원 패스 영수증이 올바르지 않습니다.");
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
    const starsById = Object.fromEntries(Object.entries(this.state.relicProgress).map(([id, value]) => [id, relicStars(value.breakthrough)]));
    const outcome = resolveAcquisitions(this.state.owned, this.state.relicFragments, pulled.relicIds, starsById, RELIC_STAR_CAP);
    // 최초 획득은 반드시 기본 성장 레코드를 만들고, 중복 변화도 같은 복제본에 반영한다.
    const nextProgress = Object.fromEntries(Object.entries(this.state.relicProgress).map(([id, value]) => [id, { ...value, heartGemSlots: [...value.heartGemSlots] as typeof value.heartGemSlots }]));
    for (const result of outcome.slots) {
      // 최초 획득만 유대 경험치를 지급한다. 중복은 파편(또는 DNA)으로만 남고 성장 레코드를
      // 건드리지 않는다 — 별은 플레이어가 파편을 써서 스스로 올린다.
      if (!nextProgress[result.relicId]) nextProgress[result.relicId] = grantBondXp(createInitialRelicProgress(), BOND_XP_REWARD.firstAcquisition).progress;
    }
    const nextWallet = { ...spend(this.state.wallet, banner, request.count), dnaFragments: this.state.wallet.dnaFragments + outcome.overflowFragments };
    const nextPity = { ...this.state.gachaPityByGroup, [banner.pityGroupId]: pulled.pity };
    // 연구소의 캐릭터 연구 성공만 임무로 환산하며 방치 발굴 수확과 섞지 않는다.
    const nextMissions = applyMissionEvent(this.state.missions, { type: "relic_research_completed", count: request.count }, this.now());
    const nextState: Session = { ...this.state, wallet: nextWallet, owned: outcome.ownedRelicIds, relicProgress: nextProgress, relicFragments: outcome.fragmentsById, gachaPityByGroup: nextPity, missions: nextMissions };

    // 저장 실패도 원본 메모리에 부분 반영되지 않도록 저장을 먼저 성공시킨 뒤 필드를 일괄 교체한다.
    this.validateState(nextState);
    if (this.state === session) saveManager.save(nextState);
    this.state.wallet = nextWallet;
    this.state.owned = outcome.ownedRelicIds;
    this.state.relicProgress = nextProgress;
    this.state.relicFragments = outcome.fragmentsById;
    this.state.gachaPityByGroup = nextPity;
    this.state.missions = nextMissions;
    return {
      ...this.snapshot(),
      results: outcome.slots,
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
    if (!canBreakThrough(current, held, this.state.wallet.cheesecake)) throw new GameApiError("INSUFFICIENT_CURRENCY", "돌파 재료가 부족합니다.");
    const breakthrough = current.breakthrough + 1;
    const nextProgress = { ...this.state.relicProgress, [relicId]: { ...current, breakthrough } };
    // 파편은 그 개체의 것만 줄어든다. 공용 재화가 아니므로 다른 개체의 진행에 영향이 없다.
    const nextFragments = { ...this.state.relicFragments, [relicId]: held - step.fragments };
    const nextWallet = { ...this.state.wallet, cheesecake: this.state.wallet.cheesecake - step.cheesecake };
    this.persist({ ...this.state, relicProgress: nextProgress, relicFragments: nextFragments, wallet: nextWallet });
    this.state.relicProgress = nextProgress; this.state.relicFragments = nextFragments; this.state.wallet = nextWallet;
    return { ...this.snapshot(), relicId, breakthrough, levelCap: relicLevelCap(breakthrough), stars: relicStars(breakthrough), fragments: nextFragments[relicId] };
  }

  /** 승리 결과 확인 시 최초/반복 보상을 판정하고 클리어와 지갑을 함께 저장한다. */
  async completeStage(stageId: string, victory = true): Promise<CompleteStageResponse> {
    await this.delay();
    let stage;
    const owningEvent = findEventByStageId(stageId);
    // 입장 뒤 시간이 넘어간 우회 요청도 결과 확정 경계에서 다시 차단한다.
    if (owningEvent) this.assertEventActive(owningEvent, this.now());
    try { stage = owningEvent?.stages.find(({ id }) => id === stageId) ?? getStage(stageId); } catch { throw new GameApiError("STAGE_NOT_FOUND", "존재하지 않는 스테이지입니다."); }
    const firstClear = victory && !this.state.cleared.has(stageId);
    const cheesecakeEarned = victory ? (firstClear ? stage.rewards.firstClearCheesecake : stage.rewards.repeatClearCheesecake) : 0;
    const nextCleared = victory ? new Set(this.state.cleared).add(stageId) : new Set(this.state.cleared);
    const nextWallet = { ...this.state.wallet, cheesecake: this.state.wallet.cheesecake + cheesecakeEarned };
    // 승리한 전투에 실제 편성된 세 렐릭에게만 유대 경험치를 지급한다.
    const nextProgress = Object.fromEntries(Object.entries(this.state.relicProgress).map(([id, progress]) => [id,
      victory && this.state.party.includes(id) ? grantBondXp(progress, BOND_XP_REWARD.partyVictory).progress : progress]));
    const nextMissions = applyMissionEvent(this.state.missions, { type: "battle_completed", victory }, this.now());
    this.persist({ ...this.state, cleared: nextCleared, wallet: nextWallet, relicProgress: nextProgress, missions: nextMissions });
    this.state.cleared = nextCleared; this.state.wallet = nextWallet; this.state.relicProgress = nextProgress; this.state.missions = nextMissions;
    return { ...this.snapshot(), stageId, firstClear, cheesecakeEarned };
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
    return this.missionListDto(normalized);
  }

  /** 실제 받은 편지함 저장 모델이 생기기 전에는 계약만 제공하고 임의 알림은 만들지 않는다. */
  async getNotificationSignals() {
    await this.delay();
    return { pendingFriendRequestCount: 0, unseenEventCount: 0, unreadMailCount: 0 };
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
    let nextMissions = { ...normalized, claimedIds: [...normalized.claimedIds, ...uniqueIds] };
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
    this.persist({ ...this.state, missions: nextMissions, wallet: nextWallet });
    this.state.missions = nextMissions; this.state.wallet = nextWallet;
    return { ...this.snapshot(), claimedIds: uniqueIds, claimedResearchStageIds, rewards: { missionCheesecake, researchCheesecake, cheesecake: cheesecakeEarned }, cheesecakeEarned };
  }

  /** 서버 시각의 노출 기간과 현재 제한 주기를 반영해 공용 카탈로그를 조회한다. */
  async getProducts(): Promise<ProductListResponse> {
    await this.delay();
    const now = this.now();
    const products = PRODUCTS.filter((product) => this.isVisible(product, now)).map((product) => {
      const remaining = this.remaining(product, now);
      const premium = product.price.currency === "real_money";
      return { ...product, remaining, purchasable: !premium && remaining > 0, disabledReason: premium ? "서버 영수증 검증 연결 전에는 구매할 수 없습니다." : remaining <= 0 ? "구매 제한에 도달했습니다." : undefined };
    });
    return { products, serverTime: now.toISOString() };
  }

  /** 가격 검증부터 제한 갱신까지 복제 상태에서 끝내고 마지막에 한 번만 확정한다. */
  async purchaseProduct(productId: string): Promise<PurchaseProductResponse> {
    await this.delay();
    const now = this.now();
    const product = PRODUCTS.find((candidate) => candidate.id === productId);
    if (!product) throw new GameApiError("PRODUCT_NOT_FOUND", "존재하지 않는 상품입니다.");
    const owningEvent = findEventByProductId(productId);
    // 상품 노출 기간과 별개로 이벤트 기간도 검사해 운영 데이터 불일치 시 구매를 막는다.
    if (owningEvent) this.assertEventActive(owningEvent, now);
    if (!this.isVisible(product, now)) throw new GameApiError("PRODUCT_NOT_VISIBLE", "현재 노출 기간이 아닌 상품입니다.");
    // FakeServer는 플랫폼 성공이나 영수증을 만들지 않는다. 유료 지급은 실제 검증 서버의 책임이다.
    if (product.price.currency === "real_money") throw new GameApiError("PLATFORM_PAYMENT_REQUIRED", "플랫폼 영수증 검증이 필요한 상품입니다.");
    const remaining = this.remaining(product, now);
    if (remaining <= 0) throw new GameApiError("PURCHASE_LIMIT_REACHED", "구매 제한에 도달했습니다.");
    if (this.state.wallet[product.price.currency] < product.price.amount) throw new GameApiError("INSUFFICIENT_CURRENCY", "재화가 부족합니다.");

    const nextWallet = { ...this.state.wallet, [product.price.currency]: this.state.wallet[product.price.currency] - product.price.amount };
    const nextRunes = [...this.state.runeInventory];
    const grantedRunes: RuneInstance[] = [];
    // 상점은 현재 재화만 지급하며, 룬 생성은 DNA의 명시적인 인스턴스 발급 계약으로 분리한다.
    for (const grant of product.grants) {
      // 프로필 장식은 실제 계정 서버 전용 지급품이며 인게임 재화 구매 경로에서는 재화만 반영한다.
      if (grant.kind === "currency") nextWallet[grant.currency] += grant.amount;
    }
    const periodKey = this.productPeriodKey(product, now);
    const current = this.state.productPurchases[product.id];
    const count = current?.periodKey === periodKey ? current.count + 1 : 1;
    const nextPurchases = { ...this.state.productPurchases, [product.id]: { periodKey, count } };
    this.persist({ ...this.state, wallet: nextWallet, runeInventory: nextRunes, productPurchases: nextPurchases });
    this.state.wallet = nextWallet; this.state.runeInventory = nextRunes; this.state.productPurchases = nextPurchases;
    return { ...this.snapshot(), productId, grants: product.grants, grantedRunes: grantedRunes.map((rune) => this.cloneRune(rune)), remaining: Math.max(0, product.purchaseLimit - count) };
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
    // 서버 난수를 등급과 증가량으로 환산하며 도메인 함수가 각인 스택을 정확히 하나만 추가한다.
    const roll = this.random();
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new GameApiError("INVALID_STATE", "서버 룬 난수가 올바르지 않습니다.");
    const engraving = roll < 0.1 ? { statKey: request.statId, grade: "perfect" as const, valueAdded: 3 } : roll < 0.4 ? { statKey: request.statId, grade: "great" as const, valueAdded: 2 } : { statKey: request.statId, grade: "normal" as const, valueAdded: 1 };
    const rune = applyRuneEngraving(current, engraving);
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
    return product.refresh === "once" ? "account" : "permanent";
  }

  /** 기간 키가 바뀐 구매 기록은 0회로 간주한다. */
  private remaining(product: ProductDefinition, now: Date): number {
    const record = this.state.productPurchases[product.id];
    const count = record?.periodKey === this.productPeriodKey(product, now) ? record.count : 0;
    return Math.max(0, product.purchaseLimit - count);
  }

  private snapshot(): PlayerStateDto {
    // 중첩 슬롯까지 복사해 응답 변경이 서버 역할의 세션을 오염시키지 않게 한다.
    const relicProgress = Object.fromEntries(
      Object.entries(this.state.relicProgress).map(([id, progress]) => [id, { ...progress, heartGemSlots: [...progress.heartGemSlots] as typeof progress.heartGemSlots }]),
    );
    return {
      wallet: { ...this.state.wallet },
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
    };
  }

  /** 희귀도 계약만 받아 옵션과 고유 ID를 서버가 소유하는 새 룬 인스턴스로 발급한다. */
  private createGrantedRune(rarity: RuneRarity, inventory: readonly RuneInstance[]): RuneInstance {
    const occupied = new Set(inventory.map(({ instanceId }) => instanceId));
    let instanceId: string;
    // 저장 데이터에 같은 시각 기반 ID가 있어도 순번을 전진시키며 실제 미사용 ID를 고른다.
    do { instanceId = `rune-${this.now().getTime()}-${this.runeIssueSequence++}`; } while (occupied.has(instanceId));
    // 자리도 서버가 정한다. 어느 칸의 룬이 나올지는 획득의 일부다.
    const part = Math.min(2, Math.floor(this.random() * 3)) as RunePart;
    return generateRune({ instanceId, baseName: `${RUNE_PART_LABELS[part]} 룬`, rarity, part, random: this.random });
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

  /** 공유 세션일 때만 브라우저 저장을 수행해 단위 테스트의 독립 세션에는 부작용을 만들지 않는다. */
  private persist(next: Session): void {
    // 모든 쓰기 API가 공유하는 마지막 경계에서 음수·상한·중복을 저장 전에 차단한다.
    this.validateState(next);
    if (this.state === session) saveManager.save(next);
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
