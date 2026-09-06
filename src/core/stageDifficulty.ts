import { createSkirmish, fireUltimate, isFighterAlive, stepSkirmish, type Arena, type SkirmishEvent } from "./skirmish";
import type { FighterContribution } from "./battleContribution";
import type { RelicDef } from "./types";

/** 모바일 전장의 비율만 재현하는 검수용 좌표다. Phaser 카메라나 Scene 상태는 필요하지 않다. */
export const STAGE_DIFFICULTY_ARENA: Arena = { left: 90, right: 990, top: 420, bottom: 1_520 };

/** 한 판이 영원히 교착해도 검수 작업이 끝나도록 두는 명시적인 제한이다. */
export const STAGE_DIFFICULTY_LIMIT_SECONDS = 120;

/** 자동 발사와 사람이 게이지를 보고 누르는 경우를 같은 진행기 위에서 비교하는 두 입력 정책이다. */
export type DifficultyControl = "auto" | "manualUltimate";

/** 최초 사망은 승패보다 먼저 편성 붕괴 지점을 알려 주므로 진영과 시각을 함께 보존한다. */
export interface FirstDefeatMetric { fighterId: string; relicId: string; side: "player" | "enemy"; at: number }

/** 적 한 명이 실제 전투에서 만든 피해·회복·흡수량을 런타임 ID와 무관한 렐릭 ID로 기록한다. */
export interface EnemyContributionMetric {
  relicId: string;
  damage: number;
  healing: number;
  damageAbsorbed: number;
}

/** 고정 난수열 한 개로 재생한 판의 직렬화 가능한 결과다. */
export interface StageDifficultyRun {
  seed: number;
  control: DifficultyControl;
  won: boolean;
  timedOut: boolean;
  durationSeconds: number;
  playerHpRatio: number;
  firstDefeat: FirstDefeatMetric | null;
  enemyContributions: EnemyContributionMetric[];
  ultimateUses: number;
}

/** 여러 고정 판을 승률과 범위로 압축하되 원본도 남겨 이상치를 다시 재생할 수 있게 한다. */
export interface StageDifficultySummary {
  control: DifficultyControl;
  winRate: number;
  durationSeconds: { min: number; mean: number; max: number };
  playerHpRatio: { min: number; mean: number; max: number };
  runs: StageDifficultyRun[];
}

/** 자동과 수동 궁극기 사용 결과 및 그 차이를 한 보고서에서 나란히 읽는다. */
export interface StageDifficultyReport {
  auto: StageDifficultySummary;
  manualUltimate: StageDifficultySummary;
  manualDelta: { winRate: number; durationSeconds: number; playerHpRatio: number };
}

/** 수치 이탈 시 허용되는 조정 순서를 보고서 소비자가 임의 배율로 우회하지 못하게 공개한다. */
export const STAGE_DIFFICULTY_ADJUSTMENT_ORDER = [
  "enemyLevel", "enemyBreakthrough", "enemyFormation", "playerRewardTiming", "globalRelicDefinition",
] as const;

/** 1장의 각 구간이 무엇을 가르쳐야 하는지 기계가 읽을 수 있는 일차 검수 계약이다. */
export const CHAPTER_ONE_DIFFICULTY_GOALS = {
  "1-1": { gate: "manualIntroduction", stableAutoWinAllowed: true },
  "1-2": { gate: "autoEscalation", stableAutoWinAllowed: true },
  "1-3": { gate: "autoEscalation", stableAutoWinAllowed: true },
  "1-4": { gate: "formationOrUltimate", stableAutoWinAllowed: true },
  "1-5": { gate: "growthCheck", stableAutoWinAllowed: false },
  "1-6": { gate: "growthAffinityOrPriority", stableAutoWinAllowed: false },
  "1-7": { gate: "growthAffinityOrPriority", stableAutoWinAllowed: false },
  "1-8": { gate: "growthAffinityOrPriority", stableAutoWinAllowed: false },
  "1-9": { gate: "threeEnemyRoles", stableAutoWinAllowed: false },
  "1-10": { gate: "midBoss", stableAutoWinAllowed: false },
} as const;

/** 플랫폼 구현에 의존하지 않는 32비트 LCG로 같은 seed가 언제나 같은 치명타 순서를 만든다. */
export function createDifficultyRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/** R 등급 플레이 가능 목록에서 중복 없는 두 명 조합을 만든다. 이후 R 추가에도 자동으로 확장된다. */
export function selectableRPartyPairs(playableRelics: readonly RelicDef[]): readonly [RelicDef, RelicDef][] {
  const candidates = playableRelics.filter(({ rarity, enemyOnly }) => rarity === "R" && enemyOnly !== true);
  const pairs: [RelicDef, RelicDef][] = [];
  for (let left = 0; left < candidates.length; left += 1) {
    for (let right = left + 1; right < candidates.length; right += 1) pairs.push([candidates[left], candidates[right]]);
  }
  if (pairs.length === 0) throw new RangeError("난이도 검수에는 선택 가능한 R 등급 두 명 이상이 필요합니다.");
  return pairs;
}

/** 현재 체력 비율이 가장 낮은 아군이 충분히 다쳤을 때 회복 궁극기를 쓰는 수동 입력 근사다. */
function shouldManualFire(fighter: Parameters<typeof isFighterAlive>[0], players: readonly Parameters<typeof isFighterAlive>[0][]): boolean {
  const ultimate = fighter.def.ultimate;
  const isSupportUltimate = ultimate.effectType === "healing" || ultimate.targeting === "battlefieldAllies" || "selfBulwark" in ultimate;
  return !isSupportUltimate || players.some((ally) => ally.hp / ally.maxHp <= 0.7);
}

/** 한 프레임의 사망 사건 중 실제 최초 사건만 고정한다. */
function firstDeathFrom(events: readonly SkirmishEvent[], state: ReturnType<typeof createSkirmish>): FirstDefeatMetric | null {
  const death = events.find((event): event is Extract<SkirmishEvent, { kind: "death" }> => event.kind === "death");
  if (!death) return null;
  const fighter = state.fighters.find(({ id }) => id === death.fighterId);
  return fighter ? { fighterId: fighter.id, relicId: fighter.def.id, side: fighter.side, at: state.elapsed } : null;
}

/** skirmish의 누적 장부를 적 관점의 세 핵심 값으로 복사한다. */
function enemyContribution(def: FighterContribution, relicId: string): EnemyContributionMetric {
  return {
    relicId,
    damage: def.attack.attackPower + def.attack.abilityPower,
    healing: def.healing,
    damageAbsorbed: def.defense.armor + def.defense.resistance + def.defense.shield,
  };
}

/** Phaser를 만들지 않고 순수 난전 진행기에 고정 seed와 궁극기 입력만 공급해 한 판을 재생한다. */
export function simulateStageDifficultyRun(
  players: readonly RelicDef[], enemies: readonly RelicDef[], seed: number, control: DifficultyControl,
): StageDifficultyRun {
  const rng = createDifficultyRng(seed);
  const state = createSkirmish([...players], [...enemies], STAGE_DIFFICULTY_ARENA);
  let firstDefeat: FirstDefeatMetric | null = null;
  let ultimateUses = 0;
  // 30Hz는 코어 내부의 작은 적분과 함께 충분히 안정적이며 대량 검수를 빠르게 끝낸다.
  while (state.phase === "fight" && state.elapsed < STAGE_DIFFICULTY_LIMIT_SECONDS) {
    const events = stepSkirmish(state, 1 / 30, rng);
    firstDefeat ??= firstDeathFrom(events, state);
    const alivePlayers = state.fighters.filter((fighter) => fighter.side === "player" && isFighterAlive(fighter));
    // 수동은 지원기를 필요한 순간까지 아끼고, 자동은 UI 설정과 같이 준비된 순서대로 즉시 쓴다.
    for (const fighter of alivePlayers) {
      if (fighter.energy < fighter.def.ultimate.cost || (control === "manualUltimate" && !shouldManualFire(fighter, alivePlayers))) continue;
      const ultimateEvents = fireUltimate(state, fighter.id, rng);
      ultimateUses += 1;
      firstDefeat ??= firstDeathFrom(ultimateEvents, state);
      if (state.phase !== "fight") break;
    }
  }
  const playerFighters = state.fighters.filter(({ side }) => side === "player");
  const hpRatio = playerFighters.reduce((sum, fighter) => sum + Math.max(0, fighter.hp) / fighter.maxHp, 0) / playerFighters.length;
  return {
    seed, control, won: state.phase === "victory", timedOut: state.phase === "fight",
    durationSeconds: state.elapsed, playerHpRatio: hpRatio, firstDefeat,
    enemyContributions: state.fighters.filter(({ side }) => side === "enemy").map((fighter) => enemyContribution(state.contributions[fighter.id], fighter.def.id)),
    ultimateUses,
  };
}

/** 최소·평균·최대를 공통 방식으로 계산해 지표마다 범위 의미가 달라지지 않게 한다. */
function range(values: readonly number[]): { min: number; mean: number; max: number } {
  return { min: Math.min(...values), mean: values.reduce((sum, value) => sum + value, 0) / values.length, max: Math.max(...values) };
}

/** 한 입력 정책을 여러 고정 난수열로 검수한다. 단일 운 좋은 판을 기준 결과로 오인하지 않는다. */
export function summarizeStageDifficulty(
  players: readonly RelicDef[], enemies: readonly RelicDef[], seeds: readonly number[], control: DifficultyControl,
): StageDifficultySummary {
  if (seeds.length === 0) throw new RangeError("난이도 검수 seed는 하나 이상이어야 합니다.");
  const runs = seeds.map((seed) => simulateStageDifficultyRun(players, enemies, seed, control));
  return {
    control, winRate: runs.filter(({ won }) => won).length / runs.length,
    durationSeconds: range(runs.map(({ durationSeconds }) => durationSeconds)),
    playerHpRatio: range(runs.map(({ playerHpRatio }) => playerHpRatio)), runs,
  };
}

/** 같은 난수열의 자동/수동 결과 차이를 만들어 스테이지가 궁극기 판단을 실제로 요구하는지 드러낸다. */
export function inspectStageDifficulty(players: readonly RelicDef[], enemies: readonly RelicDef[], seeds: readonly number[]): StageDifficultyReport {
  const auto = summarizeStageDifficulty(players, enemies, seeds, "auto");
  const manualUltimate = summarizeStageDifficulty(players, enemies, seeds, "manualUltimate");
  return {
    auto, manualUltimate,
    manualDelta: {
      winRate: manualUltimate.winRate - auto.winRate,
      durationSeconds: manualUltimate.durationSeconds.mean - auto.durationSeconds.mean,
      playerHpRatio: manualUltimate.playerHpRatio.mean - auto.playerHpRatio.mean,
    },
  };
}

/** 모든 R 조합을 동일 seed로 비교해 자동 평균 승률→잔여 HP→속도 순으로 유리/불리 기준을 고른다. */
export function selectReferenceParties(
  torika: RelicDef, playableRelics: readonly RelicDef[], enemies: readonly RelicDef[], seeds: readonly number[],
): { favorable: [RelicDef, RelicDef, RelicDef]; unfavorable: [RelicDef, RelicDef, RelicDef] } {
  const scored = selectableRPartyPairs(playableRelics).map(([first, second]) => {
    const party: [RelicDef, RelicDef, RelicDef] = [torika, first, second];
    const result = summarizeStageDifficulty(party, enemies, seeds, "auto");
    const score = result.winRate * 1_000 + result.playerHpRatio.mean * 100 - result.durationSeconds.mean;
    return { party, score };
  }).sort((left, right) => right.score - left.score);
  return { favorable: scored[0].party, unfavorable: scored[scored.length - 1].party };
}

/** 연속 구간의 승률 하락·시간 증가·잔여 HP 감소 중 하나가 허용 오차보다 큰지 판정한다. */
export function hasMeaningfulDifficultyIncrease(before: StageDifficultySummary, after: StageDifficultySummary): boolean {
  return after.winRate <= before.winRate - 0.1
    || after.durationSeconds.mean >= before.durationSeconds.mean + 1
    || after.playerHpRatio.mean <= before.playerHpRatio.mean - 0.05;
}
