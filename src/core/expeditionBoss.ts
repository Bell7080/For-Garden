import { EXPEDITION_BOSS_BALANCE } from "../data/expedition";

/** 클라이언트가 제출할 수 있는 것은 시각과 동작뿐이며 피해 숫자는 필드로 존재하지 않는다. */
export interface ExpeditionBossAction { elapsedMs: number; actorId: string; kind: "basic" | "ultimate"; }
/** 서버가 편성과 성장 상태에서 만든 전투원 스냅샷이다. */
export interface ExpeditionBossAlly { id: string; attack: number; maxHp: number; initialHp?: number; }
/** 전멸한 정상 종료만 확정하며 totalDamage는 경감 후 실제 적용 피해 점수다. */
export interface ExpeditionBossResult { totalDamage: number; endedAtMs: number; allAlliesDead: true; bossDefeated: false; remainingHpByAlly: Record<string, number>; }

/** 해당 시각에 활성인 마지막 보스 단계를 찾는다. */
export function expeditionBossPhaseAt(elapsedMs: number) {
  return [...EXPEDITION_BOSS_BALANCE.phases].reverse().find((phase) => elapsedMs >= phase.startsAtMs) ?? EXPEDITION_BOSS_BALANCE.phases[0];
}

/** 월요일 00:00 UTC를 주간 기록의 불변 키로 정규화한다. */
export function expeditionWeekKey(now: Date): string {
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

/** 입력 순서·쿨다운·생존을 검증하고 불사 보스가 받은 피해만 누적한다. */
export function resolveExpeditionBossBattle(allies: readonly ExpeditionBossAlly[], actions: readonly ExpeditionBossAction[]): ExpeditionBossResult {
  if (!allies.length || actions.length > EXPEDITION_BOSS_BALANCE.maximumActions) throw new Error("INVALID_BOSS_BATTLE_INPUT");
  // 원정 도중 깎인 HP도 서버 재현의 시작점으로 사용하며 범위를 벗어난 스냅샷은 거부한다.
  if (allies.some((ally) => !Number.isFinite(ally.initialHp ?? ally.maxHp) || (ally.initialHp ?? ally.maxHp) < 0 || (ally.initialHp ?? ally.maxHp) > ally.maxHp)) throw new Error("INVALID_BOSS_BATTLE_INPUT");
  const hp = Object.fromEntries(allies.map((ally) => [ally.id, ally.initialHp ?? ally.maxHp]));
  const byId = new Map(allies.map((ally) => [ally.id, ally])); const lastAction = new Map<string, number>();
  let actionIndex = 0; let totalDamage = 0;
  // 1초 서버 틱마다 그 이전 입력을 적용한 뒤 현재 단계의 광역 공격을 확정한다.
  for (let elapsedMs = 0; elapsedMs <= EXPEDITION_BOSS_BALANCE.maximumDurationMs; elapsedMs += 1_000) {
    while (actionIndex < actions.length && actions[actionIndex].elapsedMs <= elapsedMs) {
      const action = actions[actionIndex++]; const ally = byId.get(action.actorId);
      if (!ally || !Number.isInteger(action.elapsedMs) || action.elapsedMs < 0 || action.elapsedMs > EXPEDITION_BOSS_BALANCE.maximumDurationMs || hp[action.actorId] <= 0) throw new Error("INVALID_BOSS_BATTLE_INPUT");
      const key = `${action.actorId}:${action.kind}`; const previous = lastAction.get(key) ?? -Infinity;
      if (action.elapsedMs < previous + EXPEDITION_BOSS_BALANCE.actionCooldownMs[action.kind]) throw new Error("INVALID_BOSS_BATTLE_INPUT");
      // 서버가 재현한 공격력·스킬 계수는 해당 행동의 모든 경감을 마친 실제 적용량이며 클라이언트도 같은 기준만 누적한다.
      lastAction.set(key, action.elapsedMs); totalDamage += Math.max(1, Math.round(ally.attack * EXPEDITION_BOSS_BALANCE.actionPower[action.kind]));
    }
    if (elapsedMs > 0) for (const ally of allies) if (hp[ally.id] > 0) hp[ally.id] = Math.max(0, hp[ally.id] - expeditionBossPhaseAt(elapsedMs).attackPerSecond);
    if (allies.every((ally) => hp[ally.id] <= 0)) return { totalDamage, endedAtMs: elapsedMs, allAlliesDead: true, bossDefeated: false, remainingHpByAlly: hp };
  }
  // 정적 종말 단계가 바뀌어 전멸 보장이 깨지면 점수를 만들지 않고 구성 오류로 실패한다.
  throw new Error("BOSS_BATTLE_DID_NOT_END_IN_WIPE");
}
