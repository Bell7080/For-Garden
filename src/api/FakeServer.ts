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
    try { stage = getStage(stageId); } catch { throw new GameApiError("STAGE_NOT_FOUND", "존재하지 않는 스테이지입니다."); }
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
  private persist(next: Session): void { if (this.state === session) saveManager.save(next); }

  private delay(): Promise<void> {
    // globalThis를 써서 브라우저와 Vitest(Node) 양쪽에서 같은 구현을 사용한다.
    return new Promise((resolve) => globalThis.setTimeout(resolve, this.latencyMs));
  }
}

/** 씬이 공유하는 임시 API 구현체다. 나중에는 이 한 줄을 HTTP 구현으로 교체한다. */
export const gameApi: GameApi = new FakeServer();
