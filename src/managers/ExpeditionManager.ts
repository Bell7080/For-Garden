import { generateExpeditionMap } from "../core/expeditionMap";
import { applyExpeditionRest } from "../core/expeditionAugments";
import { expeditionRewardRandom, expeditionRewardRule, generateExpeditionAugmentOffers, validateExpeditionAugmentChoice, type ExpeditionAugmentSelection } from "../core/expeditionRewards";
import type { ExpeditionNodeType } from "../core/expeditionMap";
import type { SkirmishRelicResult } from "../core/skirmish";
import { EXPEDITION_AUGMENT_IDS, EXPEDITION_REST_RULES, EXPEDITION_WEEKLY_POLICY } from "../data/expedition";
import { saveManager, type SaveManager } from "../state/SaveManager";
import { session, type ExpeditionRunState, type Session } from "../state/session";

/** UI가 소비하는 원정 요약이며 변경 가능한 Session 참조는 노출하지 않는다. */
export interface ExpeditionStatus {
  weekKey: string;
  playsThisWeek: number;
  bestScore: number;
  /** 주간과 무관한 역대 최고 점수다. 소탕 가능 여부와 예상 지급량을 화면이 미리 보여줄 때 쓴다. */
  allTimeBestScore: number;
  active: { relicIds: [string, string, string]; score: number } | null;
  run: ExpeditionRunState | null;
  quickAvailable: boolean;
  /** 이번 주에 원정을 더 시작할 수 있는지다. 소탕도 같은 횟수를 소비한다. */
  canStartRun: boolean;
}

export type StartExpeditionFailure = "exactlyThree" | "duplicate" | "notOwned" | "alreadyActive" | "weeklyLimitReached";
export type StartExpeditionResult = { ok: true; run: ExpeditionRunState } | { ok: false; reason: StartExpeditionFailure };
export type DevelopmentBossShortcutFailure = StartExpeditionFailure | "developmentOnly";
export type DevelopmentBossShortcutResult = { ok: true; run: ExpeditionRunState } | { ok: false; reason: DevelopmentBossShortcutFailure };

/** FakeServer가 주입하는 UTC 시각에서 월요일 시작 주간 키를 계산한다. */
export function expeditionWeekKey(serverNow: Date): string {
  const date = new Date(Date.UTC(serverNow.getUTCFullYear(), serverNow.getUTCMonth(), serverNow.getUTCDate()));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

/** 문자열 시드만으로 맵을 재현하는 작은 결정적 난수원이다. */
function seededRandom(seed: string): () => number {
  let value = 2166136261;
  for (const character of seed) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return () => { value += 0x6d2b79f5; let next = value; next = Math.imul(next ^ next >>> 15, next | 1); next ^= next + Math.imul(next ^ next >>> 7, next | 61); return ((next ^ next >>> 14) >>> 0) / 4294967296; };
}

/** 원정 생성·노드 완료·포기·최종 정산의 유일한 상태 쓰기 경계다. */
export class ExpeditionManager {
  constructor(
    private readonly state: Session = session,
    private readonly saves: Pick<SaveManager, "save"> = saveManager,
    private readonly serverNow: () => Date = () => new Date(),
    /** 테스트가 production 경계를 검증할 수 있게 주입하되, 실제 빌드는 Vite의 제거 가능한 DEV 플래그만 따른다. */
    private readonly developmentToolsEnabled: boolean = import.meta.env?.DEV === true,
  ) {}

  /** 주차를 서버 UTC에 맞춘 뒤 UI용 독립 사본을 반환한다. */
  status(): ExpeditionStatus {
    this.normalizeWeek();
    // 이전 버전이 성공 정산 뒤 settled 런을 남긴 저장도 활성 진행으로 복구하지 않는다.
    // 정리 저장까지 수행해 다음 앱 실행부터는 새 run 계약만 남긴다.
    if (this.state.expedition.run?.settled) this.commit({ ...this.state.expedition, run: null });
    const run = this.state.expedition.run;
    const copy = run ? structuredClone(run) : null;
    return { ...this.state.expedition, run: copy, active: copy ? { relicIds: copy.relics.map(({ relicId }) => relicId) as [string, string, string], score: copy.bestScore } : null, quickAvailable: this.state.expedition.bestScore > 0 && run === null, canStartRun: this.state.expedition.playsThisWeek < EXPEDITION_WEEKLY_POLICY.maxPlaysPerWeek };
  }

  /** 정확히 세 보유 렐릭을 검증하고 서버 주간 키가 포함된 결정적 맵을 생성한다. */
  start(relicIds: readonly string[]): StartExpeditionResult {
    this.normalizeWeek();
    if (this.state.expedition.run) return { ok: false, reason: "alreadyActive" };
    if (this.state.expedition.playsThisWeek >= EXPEDITION_WEEKLY_POLICY.maxPlaysPerWeek) return { ok: false, reason: "weeklyLimitReached" };
    if (relicIds.length !== 3) return { ok: false, reason: "exactlyThree" };
    if (new Set(relicIds).size !== 3) return { ok: false, reason: "duplicate" };
    if (relicIds.some((id) => !this.state.owned.has(id))) return { ok: false, reason: "notOwned" };
    const weekKey = expeditionWeekKey(this.serverNow());
    const mapSeed = `${weekKey}:${this.state.expedition.playsThisWeek + 1}`;
    const map = generateExpeditionMap({ seed: mapSeed, random: seededRandom(mapSeed) });
    const run: ExpeditionRunState = { runId: `run:${mapSeed}`, weekKey, mapSeed, nodes: map.nodes, currentNodeId: null, visitedNodeIds: [], relics: relicIds.map((relicId) => ({ relicId, currentHp: 100, alive: true })) as ExpeditionRunState["relics"], selectedAugmentIds: [], selectedAugments: [], pendingAugmentReward: null, pendingRewards: {}, lastNodeRewards: null, bossDamage: 0, bestScore: 0, settled: false, settlementId: null, bossSubmissionId: null, bossSettlementId: null };
    this.commit({ ...this.state.expedition, run });
    return { ok: true, run: structuredClone(run) };
  }

  /**
   * 임시 개발 도구: 정식 노드 완료·점수 제출을 흉내 내지 않고 20층 보스 직전의 저장 스냅샷만 원자적으로 만든다.
   * production에서는 직접 호출해도 거부하며, 이후 출격은 일반 보스 DTO/서버 정산 규칙을 그대로 통과한다.
   */
  prepareDevelopmentBossShortcut(relicIds: readonly string[]): DevelopmentBossShortcutResult {
    if (!this.developmentToolsEnabled) return { ok: false, reason: "developmentOnly" };
    this.normalizeWeek();
    if (this.state.expedition.run) return { ok: false, reason: "alreadyActive" };
    if (relicIds.length !== 3) return { ok: false, reason: "exactlyThree" };
    if (new Set(relicIds).size !== 3) return { ok: false, reason: "duplicate" };
    if (relicIds.some((id) => !this.state.owned.has(id))) return { ok: false, reason: "notOwned" };

    const weekKey = expeditionWeekKey(this.serverNow());
    const mapSeed = `${weekKey}:${this.state.expedition.playsThisWeek + 1}:dev-boss`;
    const map = generateExpeditionMap({ seed: mapSeed, random: seededRandom(mapSeed) });
    const boss = map.nodes.find(({ type, floor }) => type === "boss" && floor === 20)!;
    // 보스에서 역으로 한 갈래만 골라 방문 순서를 만들면 지도 전체의 연결은 보존하면서 19층 도달 상태가 된다.
    const route = [boss];
    while (route[0].floor > 1) {
      const predecessor = map.nodes.find(({ id }) => id === route[0].predecessorIds[0]);
      if (!predecessor) throw new Error("개발용 보스 경로를 생성할 수 없습니다.");
      route.unshift(predecessor);
    }
    const reached = route.at(-2)!;
    const runId = `run:${mapSeed}`;
    const run: ExpeditionRunState = {
      runId, weekKey, mapSeed, nodes: map.nodes, currentNodeId: reached.id,
      visitedNodeIds: route.slice(0, -1).map(({ id }) => id),
      relics: relicIds.map((relicId) => ({ relicId, currentHp: 100, alive: true })) as ExpeditionRunState["relics"],
      selectedAugmentIds: [], selectedAugments: [], pendingAugmentReward: null,
      pendingRewards: {}, lastNodeRewards: null, bossDamage: 0, bestScore: 0,
      settled: false, settlementId: null,
      bossSubmissionId: `${runId}:${boss.id}:boss-score`,
      bossSettlementId: `${runId}:boss-completed`,
    };
    // 런·편성·도달점·멱등 ID는 한 번의 저장으로 함께 확정해 중간 상태를 복원할 수 없게 한다.
    this.commit({ ...this.state.expedition, run });
    return { ok: true, run: structuredClone(run) };
  }

  /** 도달한 노드의 결과만 반영하며 씬이 HP·보상·점수를 직접 쓸 필요가 없게 한다. */
  completeNode(nodeId: string, update: { relicHp: readonly number[]; augmentId?: string; bossDamage?: number; score?: number }): boolean {
    const run = this.state.expedition.run;
    const node = run?.nodes.find(({ id }) => id === nodeId);
    if (!run || run.settled || !node || run.visitedNodeIds.includes(nodeId) || (run.currentNodeId !== null && !run.nodes.find(({ id }) => id === run.currentNodeId)?.successorIds.includes(nodeId)) || update.relicHp.length !== 3) return false;
    if (update.augmentId && !EXPEDITION_AUGMENT_IDS.includes(update.augmentId as never)) return false;
    if (update.relicHp.some((hp) => !Number.isFinite(hp) || hp < 0) || [update.bossDamage ?? 0, update.score ?? 0].some((value) => !Number.isFinite(value) || value < 0)) return false;
    const next = structuredClone(run); next.currentNodeId = nodeId; next.visitedNodeIds.push(nodeId);
    next.relics.forEach((relic, index) => { relic.currentHp = update.relicHp[index]; relic.alive = relic.currentHp > 0; });
    if (update.augmentId && !next.selectedAugmentIds.includes(update.augmentId)) next.selectedAugmentIds.push(update.augmentId);
    next.bossDamage += update.bossDamage ?? 0; next.bestScore = Math.max(next.bestScore, update.score ?? 0);
    // 마지막 생존자가 쓰러지면 해당 전투 결과와 함께 런도 즉시 종료 상태로 확정한다.
    // 전멸도 정산 API 호출 전에는 보상 이전이 끝난 상태가 아니므로 런을 열어 둔다.
    this.commit({ ...this.state.expedition, run: next }); return true;
  }

  /** 난전 결과 DTO의 ID 순서를 검증한 뒤 기존 노드 완료 경계로 전달한다. */
  completeBattle(nodeId: string, results: readonly SkirmishRelicResult[]): boolean {
    const run = this.state.expedition.run;
    if (!run || results.length !== run.relics.length || results.some((result, index) => result.relicId !== run.relics[index].relicId || result.alive !== (result.currentHp > 0))) return false;
    const node = run.nodes.find(({ id }) => id === nodeId);
    // 점수는 결과 DTO와 서버 생성 맵의 층만으로 계산해 씬이 임의 점수를 주입하지 못하게 한다.
    const score = node ? node.floor * 1_000 + Math.round(results.reduce((sum, { currentHp }) => sum + currentHp, 0) * 10) : 0;
    return this.completeNode(nodeId, { relicHp: results.map(({ currentHp }) => currentHp), score });
  }

  /** 보스를 누르는 순간 두 멱등 키를 먼저 저장해 어느 비동기 경계에서 종료돼도 복원한다. */
  prepareBossRequests(nodeId: string): { requestId: string; settlementId: string } | null {
    const run = this.state.expedition.run;
    const node = run?.nodes.find(({ id }) => id === nodeId);
    if (!run || node?.type !== "boss" || run.settled) return null;
    const next = structuredClone(run);
    next.bossSubmissionId ??= `${run.runId}:${nodeId}:boss-score`;
    next.bossSettlementId ??= `${run.runId}:boss-completed`;
    this.commit({ ...this.state.expedition, run: next });
    return { requestId: next.bossSubmissionId, settlementId: next.bossSettlementId };
  }

  /** 전투 노드의 첫 제안을 한 번만 만들고 seed와 결과를 같은 저장 트랜잭션에 고정한다. */
  beginAugmentReward(nodeId: string, nodeType: ExpeditionNodeType): ExpeditionRunState["pendingAugmentReward"] {
    const run = this.state.expedition.run;
    const rule = expeditionRewardRule(nodeType);
    // 비전투 노드와 이미 열린 제안은 RNG를 소비하지 않는다.
    if (!run || run.settled || rule.selections === 0 || !rule.rarity) return null;
    if (run.pendingAugmentReward) return structuredClone(run.pendingAugmentReward);
    const seed = `${run.mapSeed}:${nodeId}:augment:1`;
    const offers = generateExpeditionAugmentOffers({ rarity: rule.rarity, relics: run.relics, selections: run.selectedAugments, random: expeditionRewardRandom(seed) });
    const pending = { nodeId, seed, round: 1, totalRounds: rule.selections, offers };
    const next = { ...structuredClone(run), pendingAugmentReward: pending };
    this.commit({ ...this.state.expedition, run: next });
    return structuredClone(pending);
  }

  /** 제안에 포함된 증강만 확정하며 무리 전투는 첫 결과를 저장한 뒤 두 번째 제안을 연속 생성한다. */
  chooseAugment(selection: ExpeditionAugmentSelection): boolean {
    const run = this.state.expedition.run;
    const pending = run?.pendingAugmentReward;
    const offer = pending?.offers.find(({ augmentId }) => augmentId === selection.augmentId);
    if (!run || !pending || !offer || !validateExpeditionAugmentChoice(offer, selection, run.selectedAugments)) return false;
    const next = structuredClone(run);
    next.selectedAugments.push({ ...selection });
    next.selectedAugmentIds.push(selection.augmentId);
    if (pending.round < pending.totalRounds) {
      const nodeType = next.nodes.find(({ id }) => id === pending.nodeId)?.type;
      const rule = nodeType ? expeditionRewardRule(nodeType) : { selections: 0, rarity: null };
      if (!rule.rarity) return false;
      const round = pending.round + 1;
      const seed = `${run.mapSeed}:${pending.nodeId}:augment:${round}`;
      next.pendingAugmentReward = { nodeId: pending.nodeId, seed, round, totalRounds: pending.totalRounds, offers: generateExpeditionAugmentOffers({ rarity: rule.rarity, relics: next.relics, selections: next.selectedAugments, random: expeditionRewardRandom(seed) }) };
    } else next.pendingAugmentReward = null;
    this.commit({ ...this.state.expedition, run: next });
    return true;
  }

  /** 휴식 노드는 전멸하지 않은 런에만 정적 회복/부활 규칙을 적용한다. */
  rest(): boolean {
    const run = this.state.expedition.run;
    if (!run || run.settled || run.relics.every(({ alive }) => !alive)) return false;
    const next = structuredClone(run);
    next.relics = applyExpeditionRest(next.relics, EXPEDITION_REST_RULES.healPercent, EXPEDITION_REST_RULES.revivePercent) as ExpeditionRunState["relics"];
    this.commit({ ...this.state.expedition, run: next });
    return true;
  }

  /** 휴식 효과와 노드 방문 완료를 한 번만 저장한다. 이 메서드가 휴식 재시도의 상태 소유자다. */
  completeRestNode(nodeId: string): boolean {
    const run = this.state.expedition.run;
    const node = run?.nodes.find(({ id }) => id === nodeId);
    if (!run || node?.type !== "rest" || run.settled || run.visitedNodeIds.includes(nodeId)
      || (run.currentNodeId !== null && !run.nodes.find(({ id }) => id === run.currentNodeId)?.successorIds.includes(nodeId))
      || run.relics.every(({ alive }) => !alive)) return false;
    const next = structuredClone(run);
    next.relics = applyExpeditionRest(next.relics, EXPEDITION_REST_RULES.healPercent, EXPEDITION_REST_RULES.revivePercent) as ExpeditionRunState["relics"];
    next.currentNodeId = nodeId;
    next.visitedNodeIds.push(nodeId);
    this.commit({ ...this.state.expedition, run: next });
    return true;
  }

  // 종료와 포기는 로컬 쓰기 메서드를 두지 않는다. 호출자는 GameApi.settleExpeditionRun만 사용해
  // 임시 보상 이전과 완료 표식이 서로 갈라지는 부분 저장을 만들 수 없게 한다.

  private commit(expedition: Session["expedition"]): void { this.state.expedition = expedition; this.saves.save(this.state); }
  private normalizeWeek(): void { const weekKey = expeditionWeekKey(this.serverNow()); if (this.state.expedition.weekKey !== weekKey) this.commit({ ...this.state.expedition, weekKey, playsThisWeek: 0, bestScore: 0 }); }
}

export const expeditionManager = new ExpeditionManager();
