import { controlRemaining } from "./expeditionCcPolicy";
import { currentAttackSpeed, fighterReach, moveSpeed, attackInterval, isFighterAlive, stepSkirmish, type Fighter, type SkirmishState } from "./skirmish";
import { bossBattleRandom } from "./bossSimulation";

export type CcKind = "stun" | "stagger" | "frozen" | "sleep" | "fear" | "frenzy" | "knockback" | "taunt" | "retarget";
export interface CcAuditLimits {
  maxContinuousSeconds: number;
  maxControlledRatio: number;
  minFreeGapSeconds: number;
  minimumObservationSeconds: number;
}
export interface CcAuditScenario {
  id: string;
  createState(): SkirmishState;
  durationSeconds: number;
  seed?: string;
  stepSeconds?: number;
  targets?: "enemy" | "player" | "all";
  limits: CcAuditLimits;
  /** QA 접촉 시험 등 명시적으로 주입한 조건만 변경한다. 실제 스테이지는 생략한다. */
  beforeStep?(state: SkirmishState): void;
  metadata?: Record<string, unknown>;
  includeTimeline?: boolean;
}
export interface CcInterval { start: number; end: number; kinds: CcKind[] }
export interface CcUnitAudit {
  fighterId: string; relicId: string; side: string;
  observedSeconds: number; controlledSeconds: number; controlledRatio: number;
  longestContinuousSeconds: number; minFreeGapSeconds: number | null; longestFreeWindowSeconds: number;
  fullLockSeconds: number; targetRestrictionSeconds: number; byKindSeconds: Partial<Record<CcKind, number>>;
  /** 직접 공격이 발생한 프레임 수다. 광역·연격의 같은 프레임 다중 적중은 한 번만 센다. */
  directAttackFrames: number; hostileAttackFrames: number; friendlyFireFrames: number;
  targetChanges: number; targetReversals: number; forcedTargetChanges: number;
  forcedPursuitSeconds: number; firstHostileAttackSeconds: number | null; maxHostileAttackGapSeconds: number;
  hostileAttackTimes?: number[];
  intervals?: CcInterval[];
  violations: string[]; verdict: "pass" | "fail" | "insufficient";
}
export interface CcAuditReport {
  id: string; seed: string; stepSeconds: number; requestedSeconds: number; elapsedSeconds: number;
  phase: string; limits: CcAuditLimits; metadata: Record<string, unknown>;
  verdict: "pass" | "fail" | "insufficient";
  combatants: Array<{ fighterId: string; relicId: string; side: string; attackSpeed: number; moveSpeed: number; reach: number; breakthrough: number; attackIntervalSeconds: number }>;
  triggerActivations?: Array<{ fighterId: string; effectIndex: number; payload: string; trigger: string;
    everyN: number | null; cooldownSeconds: number; maxTriggers: number; times: number[] }>;
  units: CcUnitAudit[];
}

/** 동시에 걸린 제어를 합산하지 않고 상태의 집합으로 읽는다. 광란·공포는 별도로도 집계한다. */
export function currentCcKinds(fighter: Fighter): CcKind[] {
  const kinds: CcKind[] = [];
  if (fighter.stunnedFor > 1e-9) kinds.push("stun");
  if (fighter.staggeredFor > 1e-9) kinds.push("stagger");
  if (fighter.frozen) kinds.push("frozen");
  if (fighter.sleep) kinds.push("sleep");
  if (fighter.taunted) kinds.push("taunt");
  if (fighter.fear) kinds.push("fear");
  if (fighter.frenzy) kinds.push("frenzy");
  if (fighter.knockback) kinds.push("knockback");
  return kinds;
}
export function currentCcRemaining(fighter: Fighter): number {
  return controlRemaining(fighter);
}

interface Tracker {
  fighter: Fighter; observed: number; controlled: number; full: number; restricted: number;
  free: number; longestFree: number; intervals: CcInterval[]; byKind: Partial<Record<CcKind, number>>;
  direct: number; hostile: number; friendly: number;
  previousTarget: string | null; olderTarget: string | null; previousTaunt: boolean; recoveringTaunt: boolean;
  changes: number; reversals: number; forcedChanges: number; pursuit: number; firstAttack: number | null;
  lastAttack: number; maxAttackGap: number; attackTimes: number[];
}
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

/** 실제 전투 엔진을 고정 seed로 진행한다. 임의의 피해·스킬·제어 확률을 따로 재현하지 않는다. */
export function auditCcDensity(scenario: CcAuditScenario): CcAuditReport {
  const step = scenario.stepSeconds ?? 0.02;
  if (!Number.isFinite(step) || step < 0.005 || step > 0.05) throw new RangeError("CC audit step must be 0.005..0.05 seconds");
  if (!Number.isFinite(scenario.durationSeconds) || scenario.durationSeconds <= 0 || scenario.durationSeconds > 600) throw new RangeError("CC audit duration must be 0..600 seconds");
  if (Object.values(scenario.limits).some(value => !Number.isFinite(value) || value < 0)
    || scenario.limits.maxControlledRatio > 1) throw new RangeError("Invalid CC audit limits");
  const state = scenario.createState(), started = state.elapsed;
  const seed = scenario.seed ?? scenario.id, rng = bossBattleRandom(seed);
  const combatants = state.fighters.map(fighter => ({ fighterId: fighter.id, relicId: fighter.def.id, side: fighter.side,
    attackSpeed: currentAttackSpeed(fighter, state), moveSpeed: moveSpeed(fighter, state), reach: fighterReach(fighter), breakthrough: fighter.breakthrough, attackIntervalSeconds: attackInterval(fighter, state) }));
  const activations = new Map<string, NonNullable<CcAuditReport["triggerActivations"]>[number]>();
  const trackers = new Map<string, Tracker>();
  const wanted = (fighter: Fighter) => fighter.summonOwnerId === null && (scenario.targets === "all" || fighter.side === (scenario.targets ?? "enemy"));
  for (const fighter of state.fighters.filter(wanted)) trackers.set(fighter.id, { fighter, observed: 0, controlled: 0, full: 0, restricted: 0,
    free: 0, longestFree: 0, intervals: [], byKind: {}, direct: 0, hostile: 0, friendly: 0, previousTarget: fighter.targetId, olderTarget: null,
    previousTaunt: false, recoveringTaunt: false, changes: 0, reversals: 0, forcedChanges: 0, pursuit: 0,
    firstAttack: null, lastAttack: 0, maxAttackGap: 0, attackTimes: [] });
  while (state.phase === "fight" && state.elapsed - started < scenario.durationSeconds - 1e-8) {
    scenario.beforeStep?.(state);
    const alive = new Set(state.fighters.filter(isFighterAlive).map(fighter => fighter.id));
    const before = state.elapsed - started;
    const events = stepSkirmish(state, Math.min(step, scenario.durationSeconds - before), rng);
    const after = state.elapsed - started, dt = after - before;
    if (dt <= 0) break;
    if (scenario.includeTimeline !== false) for (const fighter of state.fighters) {
      const effects = fighter.side === "player" ? state.augmentEffects : state.enemyAugmentEffects ?? [];
      for (const [key, runtime] of Object.entries(fighter.augmentRuntime)) {
        if (!runtime.triggers || Math.abs(runtime.lastAt - state.elapsed) > 1e-8) continue;
        const effect = effects[Number(key)];
        if (effect?.kind !== "triggered") continue;
        const id = `${fighter.id}:${key}`;
        const row = activations.get(id) ?? { fighterId: fighter.id, effectIndex: Number(key),
          payload: effect.payload.kind === "status" ? effect.payload.status.kind : effect.payload.kind,
          trigger: effect.trigger, everyN: effect.everyN ?? null, cooldownSeconds: effect.limits.cooldownSeconds,
          maxTriggers: effect.limits.maxTriggers, times: [] };
        row.times.push(round(after)); activations.set(id, row);
      }
    }
    for (const tracker of trackers.values()) {
      const fighter = tracker.fighter;
      if (!alive.has(fighter.id)) continue;
      tracker.observed += dt;
      const kinds = currentCcKinds(fighter);
      const attacks = events.filter(event => event.kind === "attack" && event.attackerId === fighter.id && (event.skill === "basic" || event.skill === "ultimate"));
      const hostileAttack = attacks.some(event => event.kind === "attack" && state.fighters.find(target => target.id === event.targetId)?.side !== fighter.side);
      const taunted = fighter.taunted !== null;
      if (taunted && fighter.targetId !== tracker.previousTarget && tracker.previousTarget !== null) tracker.recoveringTaunt = true;
      if (fighter.targetId !== tracker.previousTarget) {
        if (fighter.targetId && tracker.previousTarget) {
          tracker.changes++;
          if (fighter.targetId === tracker.olderTarget) tracker.reversals++;
          if (taunted || tracker.previousTaunt || tracker.recoveringTaunt) tracker.forcedChanges++;
        }
        tracker.olderTarget = tracker.previousTarget; tracker.previousTarget = fighter.targetId;
      }
      // 도발 중이거나 종료 뒤에도 공격 준비가 끝난 채 강제 표적을 쫓느라 못 때리는 시간은 유사 CC다.
      if (tracker.recoveringTaunt && !hostileAttack && fighter.targetId && !fighter.engaged && fighter.attackCooldown <= 0) {
        kinds.push("retarget"); tracker.pursuit += dt;
      }
      if (hostileAttack && !taunted) tracker.recoveringTaunt = false;
      tracker.previousTaunt = taunted;
      if (kinds.length > 0 && isFighterAlive(fighter)) {
        tracker.controlled += dt; tracker.longestFree = Math.max(tracker.longestFree, tracker.free); tracker.free = 0;
        if (kinds.some(kind => kind !== "fear" && kind !== "frenzy" && kind !== "taunt" && kind !== "retarget")) tracker.full += dt;
        if (kinds.some(kind => kind === "fear" || kind === "frenzy" || kind === "taunt" || kind === "retarget")) tracker.restricted += dt;
        for (const kind of kinds) tracker.byKind[kind] = (tracker.byKind[kind] ?? 0) + dt;
        const last = tracker.intervals.at(-1);
        if (last && before - last.end < step / 2) { last.end = after; last.kinds = [...new Set([...last.kinds, ...kinds])]; }
        else tracker.intervals.push({ start: before, end: after, kinds: [...kinds] });
      } else tracker.free += dt;
      if (hostileAttack) {
        tracker.attackTimes.push(round(after));
        tracker.firstAttack ??= after; tracker.maxAttackGap = Math.max(tracker.maxAttackGap, after - tracker.lastAttack); tracker.lastAttack = after;
      }
      if (attacks.length) tracker.direct++;
      if (attacks.some(event => event.kind === "attack" && state.fighters.find(target => target.id === event.targetId)?.side !== fighter.side)) tracker.hostile++;
      if (attacks.some(event => event.kind === "attack" && state.fighters.find(target => target.id === event.targetId)?.side === fighter.side)) tracker.friendly++;
    }
  }
  const units: CcUnitAudit[] = [...trackers.values()].map(tracker => {
    const intervals = tracker.intervals;
    const gaps = intervals.slice(1).map((interval, i) => interval.start - intervals[i].end);
    const longest = Math.max(0, ...intervals.map(interval => interval.end - interval.start));
    const ratio = tracker.observed > 0 ? tracker.controlled / tracker.observed : 0;
    const minimumGap = gaps.length ? Math.min(...gaps) : null;
    const tolerance = step * 2;
    const violations: string[] = [];
    if (longest > scenario.limits.maxContinuousSeconds + tolerance) violations.push("continuous-control");
    if (ratio > scenario.limits.maxControlledRatio + tolerance / Math.max(1, tracker.observed)) violations.push("control-density");
    if (minimumGap !== null && minimumGap < scenario.limits.minFreeGapSeconds - tolerance) violations.push("missing-recovery-window");
    const insufficient = tracker.observed + 1e-8 < scenario.limits.minimumObservationSeconds;
    return { fighterId: tracker.fighter.id, relicId: tracker.fighter.def.id, side: tracker.fighter.side,
      observedSeconds: round(tracker.observed), controlledSeconds: round(tracker.controlled), controlledRatio: round(ratio),
      longestContinuousSeconds: round(longest), minFreeGapSeconds: minimumGap === null ? null : round(minimumGap),
      longestFreeWindowSeconds: round(Math.max(tracker.longestFree, tracker.free)),
      fullLockSeconds: round(tracker.full), targetRestrictionSeconds: round(tracker.restricted),
      byKindSeconds: Object.fromEntries(Object.entries(tracker.byKind).map(([kind, seconds]) => [kind, round(seconds!)])),
      directAttackFrames: tracker.direct, hostileAttackFrames: tracker.hostile, friendlyFireFrames: tracker.friendly,
      targetChanges: tracker.changes, targetReversals: tracker.reversals, forcedTargetChanges: tracker.forcedChanges,
      forcedPursuitSeconds: round(tracker.pursuit), firstHostileAttackSeconds: tracker.firstAttack === null ? null : round(tracker.firstAttack),
      maxHostileAttackGapSeconds: round(Math.max(tracker.maxAttackGap, tracker.observed - tracker.lastAttack)),
      ...(scenario.includeTimeline === false ? {} : { hostileAttackTimes: tracker.attackTimes, intervals: intervals.map(interval => ({ ...interval, start: round(interval.start), end: round(interval.end) })) }),
      violations, verdict: violations.length ? "fail" : insufficient ? "insufficient" : "pass" };
  });
  return { id: scenario.id, seed, stepSeconds: step, requestedSeconds: scenario.durationSeconds, elapsedSeconds: round(state.elapsed - started),
    phase: state.phase, limits: scenario.limits, metadata: scenario.metadata ?? {}, combatants, units,
    ...(scenario.includeTimeline === false ? {} : { triggerActivations: [...activations.values()] }),
    verdict: units.some(unit => unit.verdict === "fail") ? "fail" : !units.length || units.some(unit => unit.verdict === "insufficient") ? "insufficient" : "pass" };
}
