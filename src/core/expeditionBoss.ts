import { EXPEDITION_BOSS_BALANCE } from "../data/expedition";
import type { ExpeditionAugmentEffect } from "./expeditionAugments";
import { attackInterval, createSkirmish, isFighterAlive, replayLoggedBossAction, stepSkirmish, type Arena } from "./skirmish";
import type { RelicDef } from "./types";

/** 클라이언트 제출 계약에는 관측 가능한 시각과 행동만 있으며 피해 숫자는 의도적으로 없다. */
export interface ExpeditionBossAction { elapsedMs: number; actorId: string; kind: "basic" | "ultimate"; }
/** 서버 저장 스냅샷과 폰토스 정적 정의를 공용 난전 규칙에 연결하는 입력이다. */
export interface ExpeditionBossReplayInput {
  allies: readonly RelicDef[];
  boss: RelicDef;
  initialHpPercentByRelic?: Readonly<Record<string, number>>;
  augmentEffects?: readonly ExpeditionAugmentEffect[];
  arena: Arena;
}
/** 전멸한 정상 종료만 확정하며 totalDamage는 서버가 행동 로그로 재계산한 대상 경감 전 기여도다. */
export interface ExpeditionBossResult { totalDamage: number; endedAtMs: number; allAlliesDead: true; bossDefeated: false; remainingHpByAlly: Record<string, number>; }

/** 해당 시각에 활성인 마지막 보스 단계를 찾는다. 일반 단계는 표시만 하고 피해는 폰토스 스킬이 소유한다. */
export function expeditionBossPhaseAt(elapsedMs: number) {
  return [...EXPEDITION_BOSS_BALANCE.phases].reverse().find((phase) => elapsedMs >= phase.startsAtMs) ?? EXPEDITION_BOSS_BALANCE.phases[0];
}

/** 월요일 00:00 UTC를 주간 기록의 불변 키로 정규화한다. */
export function expeditionWeekKey(now: Date): string {
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

/**
 * 행동열을 공용 난전에 재생한다. 서버는 클라이언트 피해를 받지 않으며 렐릭/폰토스 정의, 실제 스킬
 * 계수, 공속 쿨다운, 상태 효과와 증강을 다시 읽는다. rng도 주입되어 클라이언트 교차 검증이 가능하다.
 */
export function resolveExpeditionBossBattle(input: ExpeditionBossReplayInput, actions: readonly ExpeditionBossAction[], rng: () => number = () => 0.999999): ExpeditionBossResult {
  if (!input.allies.length || actions.length > EXPEDITION_BOSS_BALANCE.maximumActions) throw new Error("INVALID_BOSS_BATTLE_INPUT");
  const initialStates = input.allies.map(({ id }) => ({ relicId: id, currentHp: input.initialHpPercentByRelic?.[id] ?? 100, alive: (input.initialHpPercentByRelic?.[id] ?? 100) > 0 }));
  if (initialStates.some(({ currentHp }) => !Number.isFinite(currentHp) || currentHp < 0 || currentHp > 100)) throw new Error("INVALID_BOSS_BATTLE_INPUT");
  const phases = EXPEDITION_BOSS_BALANCE.phases.map(({ startsAtMs, attackPerSecond, label }) => ({ startsAt: startsAtMs / 1_000, damagePerSecond: attackPerSecond, label }));
  const state = createSkirmish([...input.allies], [{ ...input.boss, stats: { ...input.boss.stats, hp: Number.MAX_SAFE_INTEGER } }], input.arena, {}, {}, {
    playerInitialStates: initialStates, augmentEffects: input.augmentEffects, boss: { phases, limitSeconds: EXPEDITION_BOSS_BALANCE.maximumDurationMs / 1_000 },
  });
  // 자동 평타는 제출 로그가 명시적으로 재생하므로 끄고, 폰토스의 AI·폭주·상태 시계만 stepSkirmish로 진행한다.
  for (const fighter of state.fighters) if (fighter.side === "player") fighter.attackCooldown = Number.POSITIVE_INFINITY;
  const lastAction = new Map<string, number>(); let cursorMs = 0;
  for (const action of actions) {
    if (!Number.isInteger(action.elapsedMs) || action.elapsedMs < cursorMs || action.elapsedMs > EXPEDITION_BOSS_BALANCE.maximumDurationMs) throw new Error("INVALID_BOSS_BATTLE_INPUT");
    while (cursorMs < action.elapsedMs && state.phase === "fight") { const slice = Math.min(50, action.elapsedMs - cursorMs); stepSkirmish(state, slice / 1_000, rng); cursorMs += slice; }
    const fighter = state.fighters.find(({ side, def }) => side === "player" && def.id === action.actorId);
    if (!fighter || !isFighterAlive(fighter)) throw new Error("INVALID_BOSS_BATTLE_INPUT");
    const key = `${action.actorId}:${action.kind}`; const previous = lastAction.get(key) ?? -Infinity;
    const cooldownMs = action.kind === "basic" ? attackInterval(fighter, state) * 1_000 : fighter.def.ultimate.cost / Math.max(1, fighter.def.stats.energyGain) * attackInterval(fighter, state) * 1_000;
    if (action.elapsedMs + 1e-6 < previous + cooldownMs) throw new Error("INVALID_BOSS_BATTLE_INPUT");
    lastAction.set(key, action.elapsedMs); replayLoggedBossAction(state, action.actorId, action.kind, rng);
  }
  while (state.phase === "fight" && cursorMs < EXPEDITION_BOSS_BALANCE.maximumDurationMs) { stepSkirmish(state, 0.05, rng); cursorMs += 50; }
  if (state.phase !== "defeat") throw new Error("BOSS_BATTLE_DID_NOT_END_IN_WIPE");
  return { totalDamage: state.boss?.score ?? 0, endedAtMs: Math.round(state.elapsed * 1_000), allAlliesDead: true, bossDefeated: false,
    remainingHpByAlly: Object.fromEntries(state.fighters.filter(({ side }) => side === "player").map(({ def, hp }) => [def.id, hp])) };
}
