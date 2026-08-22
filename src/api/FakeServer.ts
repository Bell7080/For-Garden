import { canPull, pull, resolveAcquisitions, spend } from "../core/gacha";
import { BANNERS } from "../data/banners";
import { consumeRestorationEntry, normalizeDailyContent } from "../core/dailyContent";
import { canBreakThrough, canFeedRelic, feedRelic as calculateFeed, FEED_UNIT, nextBreakthrough, relicLevelCap } from "../core/relicProgression";
import { BOND_XP_REWARD, grantBondXp, grantDailyLobbyBondXp } from "../core/bond";
import { MISSIONS, applyMissionEvent, claimableMissionIds, normalizeMissions } from "../core/missions";
import { DAILY_RESTORATION, getStage } from "../data/stages";
import { createInitialRelicProgress, session, type Session } from "../state/session";
import { saveManager } from "../state/SaveManager";
import { GameApiError, type BreakThroughResponse, type ClaimMissionRewardsResponse, type CompleteStageResponse, type EnterDailyRestorationResponse, type FeedRelicResponse, type GameApi, type LobbyInteractionResponse, type MissionListResponse, type PlayerStateDto, type PullRequest, type PullResponse } from "./contracts";
import type { ProductDefinition } from "../data/products";
import { PRODUCTS } from "../data/products";
import type { ProductListResponse, PurchaseProductResponse } from "./contracts";
import type { ExchangeDnaRequest, ExchangeDnaResponse } from "./contracts";
import { DNA_EXCHANGE_OFFERS, WALLET_CAPS } from "../data/economy";
import { EVENTS, findEventByProductId, findEventByStageId } from "../data/events";
import type { EventDefinition } from "../data/events/types";
import type { EnterEventStageResponse, EventListResponse } from "./contracts";

/** FakeServer의 지연과 난수원을 테스트에서 결정적으로 바꾸기 위한 선택 설정이다. */
export interface FakeServerOptions {
  latencyMs?: number;
  random?: () => number;
  /** 실제 서버 시각 대신 테스트에서 UTC 경계를 주입하는 날짜 공급자다. */
  now?: () => Date;
}

/** 백엔드가 생기기 전까지 메모리 상태를 서버처럼 독점 변경하는 임시 어댑터다. */
export class FakeServer implements GameApi {
  private readonly latencyMs: number;
  private readonly random: () => number;
  private readonly now: () => Date;

  constructor(
    private readonly state: Session = session,
    options: FakeServerOptions = {},
  ) {
    this.latencyMs = options.latencyMs ?? 180;
    this.random = options.random ?? Math.random;
    this.now = options.now ?? (() => new Date());
  }

  /** 실제 통신처럼 다음 비동기 구간을 거친 뒤 직렬화 가능한 복사본을 돌려준다. */
  async getPlayerState(): Promise<PlayerStateDto> {
    await this.delay();
    return this.snapshot();
  }

  /** 비용 검사, 재화 차감, 난수 결과, 보유 반영을 모두 서버 경계 안에서 원자적으로 처리한다. */
  async pullRelics(request: PullRequest): Promise<PullResponse> {
    await this.delay();
    if (request.count !== 1 && request.count !== 10) {
      throw new GameApiError("INVALID_PULL_COUNT", "발굴 횟수는 1회 또는 10회여야 합니다.");
    }

    const banner = BANNERS.find((candidate) => candidate.id === request.bannerId);
    if (!banner) throw new GameApiError("BANNER_NOT_FOUND", "존재하지 않는 배너입니다.");
    if (!canPull(this.state.wallet, banner, request.count)) {
      throw new GameApiError("INSUFFICIENT_CURRENCY", "재화가 부족합니다.");
    }

    // 원본을 전혀 건드리지 않은 복제 상태에서 비용·천장·보유 결과를 모두 먼저 계산한다.
    const pulled = pull(banner, request.count, this.state.gachaPityByGroup[banner.pityGroupId] ?? { pullsSinceSsr: 0, pickupGuaranteed: false }, this.random);
    const masteryById = Object.fromEntries(Object.entries(this.state.relicProgress).map(([id, value]) => [id, value.awakening]));
    const outcome = resolveAcquisitions(this.state.owned, masteryById, pulled.relicIds);
    // 최초 획득은 반드시 기본 성장 레코드를 만들고, 중복 변화도 같은 복제본에 반영한다.
    const nextProgress = Object.fromEntries(Object.entries(this.state.relicProgress).map(([id, value]) => [id, { ...value, heartGemSlots: [...value.heartGemSlots] as typeof value.heartGemSlots }]));
    for (const result of outcome.slots) {
      // 최초 획득만 유대 경험치를 지급하며 중복 획득은 DNA 처리만 수행한다.
      if (!nextProgress[result.relicId]) nextProgress[result.relicId] = grantBondXp(createInitialRelicProgress(), BOND_XP_REWARD.firstAcquisition).progress;
      nextProgress[result.relicId].awakening = result.dnaAfter;
    }
    const nextWallet = { ...spend(this.state.wallet, banner, request.count), dnaFragments: this.state.wallet.dnaFragments + outcome.overflowFragments };
    const nextPity = { ...this.state.gachaPityByGroup, [banner.pityGroupId]: pulled.pity };
    // 발굴 성공 이벤트는 결과 확정 뒤 이 API 경계에서만 임무로 환산한다.
    const nextMissions = applyMissionEvent(this.state.missions, { type: "excavation_completed", count: request.count }, this.now());
    const nextState: Session = { ...this.state, wallet: nextWallet, owned: outcome.ownedRelicIds, relicProgress: nextProgress, gachaPityByGroup: nextPity, missions: nextMissions };

    // 저장 실패도 원본 메모리에 부분 반영되지 않도록 저장을 먼저 성공시킨 뒤 필드를 일괄 교체한다.
    this.validateState(nextState);
    if (this.state === session) saveManager.save(nextState);
    this.state.wallet = nextWallet;
    this.state.owned = outcome.ownedRelicIds;
    this.state.relicProgress = nextProgress;
    this.state.gachaPityByGroup = nextPity;
    this.state.missions = nextMissions;
    return {
      ...this.snapshot(),
      results: outcome.slots,
      newRelicIds: outcome.newRelicIds,
      duplicateRelicIds: outcome.duplicateRelicIds,
    };
  }

  /** 서버가 보유·상한·잡초를 검증하고 차감과 성장 반영을 한 저장 단위로 확정한다. */
  async feedRelic(relicId: string, feeds = 1): Promise<FeedRelicResponse> {
    await this.delay();
    const current = this.state.relicProgress[relicId];
    if (!this.state.owned.has(relicId) || !current) throw new GameApiError("RELIC_NOT_FOUND", "보유하지 않은 렐릭입니다.");
    if (current.level >= relicLevelCap(current.breakthrough)) throw new GameApiError("RELIC_MAX_LEVEL", "이미 최대 레벨입니다.");
    if (!canFeedRelic(current, this.state.wallet.weeds)) throw new GameApiError("INSUFFICIENT_CURRENCY", "잡초가 부족합니다.");
    const result = calculateFeed(current, this.state.wallet.weeds, feeds);
    const nextProgress = { ...this.state.relicProgress, [relicId]: result.progress };
    const nextWallet = { ...this.state.wallet, weeds: result.weeds };
    const nextMissions = applyMissionEvent(this.state.missions, { type: "salary_given", count: result.feeds }, this.now());
    this.persist({ ...this.state, relicProgress: nextProgress, wallet: nextWallet, missions: nextMissions });
    this.state.relicProgress = nextProgress; this.state.wallet = nextWallet; this.state.missions = nextMissions;
    return { ...this.snapshot(), relicId, feeds: result.feeds, weedsSpent: result.feeds * FEED_UNIT.weeds, levelsGained: result.levelsGained };
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
    if (!canBreakThrough(current, this.state.wallet)) throw new GameApiError("INSUFFICIENT_CURRENCY", "돌파 재료가 부족합니다.");
    const breakthrough = current.breakthrough + 1;
    const nextProgress = { ...this.state.relicProgress, [relicId]: { ...current, breakthrough } };
    const nextWallet = {
      ...this.state.wallet,
      dnaFragments: this.state.wallet.dnaFragments - step.dnaFragments,
      weeds: this.state.wallet.weeds - step.weeds,
    };
    this.persist({ ...this.state, relicProgress: nextProgress, wallet: nextWallet });
    this.state.relicProgress = nextProgress; this.state.wallet = nextWallet;
    return { ...this.snapshot(), relicId, breakthrough, levelCap: relicLevelCap(breakthrough) };
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
    const weedsEarned = victory ? (firstClear ? stage.rewards.firstClearWeeds : stage.rewards.repeatClearWeeds) : 0;
    const nextCleared = victory ? new Set(this.state.cleared).add(stageId) : new Set(this.state.cleared);
    const nextWallet = { ...this.state.wallet, weeds: this.state.wallet.weeds + weedsEarned };
    // 승리한 전투에 실제 편성된 세 렐릭에게만 유대 경험치를 지급한다.
    const nextProgress = Object.fromEntries(Object.entries(this.state.relicProgress).map(([id, progress]) => [id,
      victory && this.state.party.includes(id) ? grantBondXp(progress, BOND_XP_REWARD.partyVictory).progress : progress]));
    const nextMissions = applyMissionEvent(this.state.missions, { type: "battle_completed", victory }, this.now());
    this.persist({ ...this.state, cleared: nextCleared, wallet: nextWallet, relicProgress: nextProgress, missions: nextMissions });
    this.state.cleared = nextCleared; this.state.wallet = nextWallet; this.state.relicProgress = nextProgress; this.state.missions = nextMissions;
    return { ...this.snapshot(), stageId, firstClear, weedsEarned };
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
    const nextWallet = { ...this.state.wallet, weeds: this.state.wallet.weeds + DAILY_RESTORATION.rewardWeeds };
    this.persist({ ...this.state, dailyContent: nextDaily, wallet: nextWallet });
    this.state.dailyContent = nextDaily; this.state.wallet = nextWallet;
    return { ...this.snapshot(), entriesRemaining: DAILY_RESTORATION.maxEntriesPerUtcDay - nextDaily.restorationEntries, weedsEarned: DAILY_RESTORATION.rewardWeeds };
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
    return { missions: this.missionDtos(), claimableCount: claimableMissionIds(normalized).length };
  }

  /** 검증·보상 지급·수령 표시를 하나의 저장으로 확정해 재요청 중복 지급을 막는다. */
  async claimMissionRewards(missionIds?: string[]): Promise<ClaimMissionRewardsResponse> {
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
    const weedsEarned = uniqueIds.reduce((sum, id) => sum + (MISSIONS.find((mission) => mission.id === id)?.rewardWeeds ?? 0), 0);
    const nextMissions = { ...normalized, claimedIds: [...normalized.claimedIds, ...uniqueIds] };
    const nextWallet = { ...this.state.wallet, weeds: this.state.wallet.weeds + weedsEarned };
    this.persist({ ...this.state, missions: nextMissions, wallet: nextWallet });
    this.state.missions = nextMissions; this.state.wallet = nextWallet;
    return { ...this.snapshot(), claimedIds: uniqueIds, weedsEarned };
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
    const nextGems = [...this.state.ownedHeartGemIds];
    for (const grant of product.grants) {
      if (grant.kind === "currency") nextWallet[grant.currency] += grant.amount;
      else if (nextGems.includes(grant.itemId)) throw new GameApiError("DUPLICATE_GRANT", "이미 보유한 Heart Gem은 중복 지급할 수 없습니다.");
      else nextGems.push(grant.itemId);
    }
    const periodKey = this.productPeriodKey(product, now);
    const current = this.state.productPurchases[product.id];
    const count = current?.periodKey === periodKey ? current.count + 1 : 1;
    const nextPurchases = { ...this.state.productPurchases, [product.id]: { periodKey, count } };
    this.persist({ ...this.state, wallet: nextWallet, ownedHeartGemIds: nextGems, productPurchases: nextPurchases });
    this.state.wallet = nextWallet; this.state.ownedHeartGemIds = nextGems; this.state.productPurchases = nextPurchases;
    return { ...this.snapshot(), productId, grants: product.grants, remaining: Math.max(0, product.purchaseLimit - count) };
  }

  /** DNA 조각을 무작위 결과가 아닌 명시적으로 고른 렐릭·제작 재료·과거 재화로 교환한다. */
  async exchangeDna(request: ExchangeDnaRequest): Promise<ExchangeDnaResponse> {
    await this.delay();
    const offer = DNA_EXCHANGE_OFFERS.find((candidate) => candidate.id === request.offerId);
    if (!offer) throw new GameApiError("DNA_OFFER_NOT_FOUND", "존재하지 않는 DNA 교환품입니다.");
    if (this.state.wallet.dnaFragments < offer.dnaCost) throw new GameApiError("INSUFFICIENT_CURRENCY", "DNA 조각이 부족합니다.");

    const nextWallet = { ...this.state.wallet, dnaFragments: this.state.wallet.dnaFragments - offer.dnaCost };
    const nextProgress = { ...this.state.relicProgress };
    const nextGems = [...this.state.ownedHeartGemIds];
    if (offer.kind === "relic_awakening") {
      const target = request.relicId ? this.state.relicProgress[request.relicId] : undefined;
      if (!request.relicId || !this.state.owned.has(request.relicId) || !target || target.awakening >= 5) {
        throw new GameApiError("INVALID_EXCHANGE_TARGET", "각성할 수 있는 보유 렐릭을 선택해야 합니다.");
      }
      // 선택한 한 렐릭만 복사해 각성 1단계를 확정하며 다른 렐릭 진행은 건드리지 않는다.
      nextProgress[request.relicId] = { ...target, heartGemSlots: [...target.heartGemSlots] as typeof target.heartGemSlots, awakening: target.awakening + 1 };
    } else if (offer.kind === "heart_gem_material") {
      if (nextGems.includes(offer.heartGemId)) throw new GameApiError("DUPLICATE_GRANT", "이미 보유한 Heart Gem 제작 재료입니다.");
      nextGems.push(offer.heartGemId);
    } else {
      nextWallet.fossil += offer.fossilAmount;
    }

    const nextState = { ...this.state, wallet: nextWallet, relicProgress: nextProgress, ownedHeartGemIds: nextGems };
    this.persist(nextState);
    this.state.wallet = nextWallet; this.state.relicProgress = nextProgress; this.state.ownedHeartGemIds = nextGems;
    return { ...this.snapshot(), offerId: offer.id, rewardKind: offer.kind, relicId: offer.kind === "relic_awakening" ? request.relicId : undefined };
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
      ownedHeartGemIds: [...this.state.ownedHeartGemIds],
      party: [...this.state.party],
      favorite: this.state.favorite,
      clearedStageIds: [...this.state.cleared],
      dailyContent: { date: normalizeDailyContent(this.state.dailyContent, this.now()).date, restorationEntries: normalizeDailyContent(this.state.dailyContent, this.now()).restorationEntries },
      missions: this.missionDtos(),
    };
  }

  /** 정적 정의와 저장 진행을 결합한 전송 전용 복사본을 만든다. */
  private missionDtos() {
    const normalized = normalizeMissions(this.state.missions, this.now());
    return MISSIONS.map((mission) => ({ ...mission, progress: normalized.progress[mission.id] ?? 0, claimed: normalized.claimedIds.includes(mission.id) }))
      .map(({ event: _event, ...dto }) => dto);
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
    if (new Set(next.ownedHeartGemIds).size !== next.ownedHeartGemIds.length) throw new GameApiError("DUPLICATE_GRANT", "Heart Gem 중복 지급이 감지되었습니다.");
    if (Object.values(next.relicProgress).some((progress) => progress.awakening < 0 || progress.awakening > 5)) throw new GameApiError("INVALID_STATE", "렐릭 각성 상한을 벗어났습니다.");
  }

  private delay(): Promise<void> {
    // globalThis를 써서 브라우저와 Vitest(Node) 양쪽에서 같은 구현을 사용한다.
    return new Promise((resolve) => globalThis.setTimeout(resolve, this.latencyMs));
  }
}

/** 씬이 공유하는 임시 API 구현체다. 나중에는 이 한 줄을 HTTP 구현으로 교체한다. */
export const gameApi: GameApi = new FakeServer();
