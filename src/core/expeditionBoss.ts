import { EXPEDITION_BOSS_BALANCE } from "../data/expedition";
import type { ExpeditionAugmentEffect } from "./expeditionAugments";
import { attackInterval, createSkirmish, isFighterAlive, replayLoggedBossAction, stepSkirmish, type Arena, type Fighter } from "./skirmish";
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
 * 그 개체가 그 시점에 **도달할 수 있었던 가장 짧은** 공격 간격이다.
 *
 * 재현은 점수를 부풀리지 않으려고 치명타도 연격도 굴리지 않는 고정 난수로 돈다. 그래서 재현
 * 속의 공속은 실제 판보다 언제나 느리다 — 연격이 두 번 터진 판은 적중마다 쌓이는 공속 누적을
 * 두 배로 받기 때문이다. 그 느린 값을 재사용 대기의 기준으로 삼으면 규칙대로 싸운 판이
 * 거절되므로(v0.66.1까지 폰토스 정산이 "다시 시도"만 남긴 원인), 검증은 같기를 요구하지 않고
 * **한계**를 잡는다: 지금까지의 평타가 모두 최대 타수로 터지고 폭주도 계속 켜져 있었다고 보고
 * 그때의 간격을 구한다. 그보다 빠른 판은 재현으로 설명되지 않으므로 여전히 거절된다.
 */
function fastestAttackInterval(fighter: Fighter, state: Parameters<typeof attackInterval>[1], basicCount: number): number {
  const stack = fighter.def.passive.kind === "basicHitAttackSpeedStack" ? fighter.def.passive.value : 0;
  const hitCount = fighter.def.basic.combo?.hitCount ?? 1;
  const bonusBefore = fighter.bonusAttackSpeed; const feverBefore = fighter.ferocityFever;
  fighter.bonusAttackSpeed = Math.max(bonusBefore, basicCount * hitCount * stack);
  fighter.ferocityFever = true;
  const interval = attackInterval(fighter, state);
  fighter.bonusAttackSpeed = bonusBefore; fighter.ferocityFever = feverBefore;
  // **아군이 걸어 주는 공속 오라도 한계에 넣는다.** 무리 사냥·아다지오는 제공자가 살아 있고
  // 같은 표적을 볼 때만 켜지는데, 재현은 자리와 표적이 실제 판과 다르므로 그 순간에 꺼져 있을
  // 수 있다. 그러면 편성이 실제로 낼 수 있었던 속도보다 느린 값이 기준이 되어, 규칙대로 싸운
  // 판이 거절된다 — 이동 규칙을 손댈 때마다 이 검증이 흔들리던 이유다. 켜진 것을 한 번 더
  // 세더라도 한계는 느슨해질 뿐이라 재현으로 설명되지 않는 판은 여전히 걸린다.
  return interval / (1 + strongestAllyAttackSpeedPercent(fighter, state) / 100);
}

/** 그 편성이 걸어 줄 수 있었던 가장 강한 아군 공속 오라(%). 제공자의 생사와 표적은 묻지 않는다. */
function strongestAllyAttackSpeedPercent(fighter: Fighter, state: Parameters<typeof attackInterval>[1]): number {
  if (!state) return 0;
  return Math.max(0, ...state.fighters
    .filter((ally) => ally.side === fighter.side)
    .map((ally) => Math.max(
      ally.def.passive.kind === "adagioWeight" ? ally.def.passive.teamAttackSpeedPercent ?? 0 : 0,
      ally.def.ferocityTrait.effectId === "packHunt" ? ally.def.ferocityTrait.sharedTargetAttackSpeedPercent : 0,
    )));
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
  // 같은 행동이 다시 준비되는 시각을 그 행동을 재생한 **그 순간의 상태**로 못 박는다.
  const readyAt = new Map<string, number>(); const basicCount = new Map<string, number>(); let cursorMs = 0;
  for (const action of actions) {
    if (!Number.isInteger(action.elapsedMs) || action.elapsedMs < cursorMs || action.elapsedMs > EXPEDITION_BOSS_BALANCE.maximumDurationMs) throw new Error("INVALID_BOSS_BATTLE_INPUT");
    while (cursorMs < action.elapsedMs && state.phase === "fight") { const slice = Math.min(50, action.elapsedMs - cursorMs); stepSkirmish(state, slice / 1_000, rng); cursorMs += slice; }
    const fighter = state.fighters.find(({ side, def }) => side === "player" && def.id === action.actorId);
    if (!fighter || !isFighterAlive(fighter)) throw new Error("INVALID_BOSS_BATTLE_INPUT");
    const key = `${action.actorId}:${action.kind}`;
    if (action.elapsedMs + 1e-6 < (readyAt.get(key) ?? -Infinity)) throw new Error("INVALID_BOSS_BATTLE_INPUT");
    replayLoggedBossAction(state, action.actorId, action.kind, rng);
    if (action.kind === "basic") basicCount.set(action.actorId, (basicCount.get(action.actorId) ?? 0) + 1);
    // 대기 시간은 **때린 그 순간**의 상태로 잰다. 다음 행동 때 다시 재면 그 사이에 풀린 강화만큼
    // 간격이 길어져, 규칙대로 싸운 판이 거절된다.
    const intervalMs = fastestAttackInterval(fighter, state, basicCount.get(action.actorId) ?? 0) * 1_000;
    readyAt.set(key, action.elapsedMs + (action.kind === "basic" ? intervalMs : fighter.def.ultimate.cost / Math.max(1, fighter.def.stats.energyGain) * intervalMs));
  }
  while (state.phase === "fight" && cursorMs < EXPEDITION_BOSS_BALANCE.maximumDurationMs) { stepSkirmish(state, 0.05, rng); cursorMs += 50; }
  if (state.phase !== "defeat") throw new Error("BOSS_BATTLE_DID_NOT_END_IN_WIPE");
  return { totalDamage: state.boss?.score ?? 0, endedAtMs: Math.round(state.elapsed * 1_000), allAlliesDead: true, bossDefeated: false,
    remainingHpByAlly: Object.fromEntries(state.fighters.filter(({ side }) => side === "player").map(({ def, hp }) => [def.id, hp])) };
}
