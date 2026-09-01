import type { ExpeditionNodeType } from "./expeditionMap";
import type { ExpeditionAugmentSelection } from "./expeditionRewards";
import { getExpeditionAugment } from "../data/expeditionAugments";
import type { ExpeditionAugmentEffect } from "./expeditionAugments";
import { EXPEDITION_COMBAT_BALANCE } from "../data/expedition";
import { EXPEDITION_BOSS_BALANCE } from "../data/expedition";
import type { RelicDef } from "./types";
import type { FighterInitialState, SkirmishBossPhase, SkirmishRelicResult } from "./skirmish";

/** 원정 씬이 전투 씬에 넘기는 직렬화 가능한 입력이다. 전투 씬은 Session 편성을 추측하지 않는다. */
export interface ExpeditionBattleInputDto {
  mode: "expedition";
  runId: string;
  nodeId: string;
  nodeType: Extract<ExpeditionNodeType, "normal" | "elite" | "horde">;
  floor: number;
  relics: readonly FighterInitialState[];
  augments: readonly ExpeditionAugmentSelection[];
}

/** 20층 불사 보스는 일반 난전과 종료 조건이 달라 입력부터 명시적으로 분리한다. */
export interface ExpeditionBossBattleInputDto {
  mode: "expeditionBoss";
  runId: string;
  nodeId: string;
  floor: 20;
  relics: readonly FighterInitialState[];
  augments: readonly ExpeditionAugmentSelection[];
  requestId: string;
  settlementId: string;
}

/** 원정 노드가 기존 난전 표현에 주입하는 순수 전투 스냅샷이다. */
export interface ExpeditionSkirmishConfig {
  playerDefs: RelicDef[];
  enemyDefs: RelicDef[];
  playerInitialStates: FighterInitialState[];
  augmentEffects: ExpeditionAugmentEffect[];
  enemyBodyScale: number;
}

/** 정적 밸런스를 적 스냅샷과 Puppet 배율로 한 번만 해석한다. */
export function createExpeditionSkirmishConfig(input: ExpeditionBattleInputDto, playerDefs: readonly RelicDef[], enemyPool: readonly RelicDef[]): ExpeditionSkirmishConfig {
  if (enemyPool.length === 0) throw new RangeError("원정 적 원본이 비어 있습니다.");
  // 전용 보스 입력은 이 경계에 도달하지 않으므로 세 일반 전투의 표만 읽는다.
  const balance = EXPEDITION_COMBAT_BALANCE[input.nodeType];
  const activeIds = new Set(input.relics.filter(({ alive, currentHp }) => alive && currentHp > 0).map(({ relicId }) => relicId));
  const scaleStats = (def: RelicDef): RelicDef => ({ ...def, stats: Object.fromEntries(Object.entries(def.stats).map(([key, value]) => [key, value * balance.statScale])) as unknown as RelicDef["stats"] });
  return {
    playerDefs: playerDefs.filter(({ id }) => activeIds.has(id)),
    enemyDefs: Array.from({ length: balance.enemyCount }, (_, index) => scaleStats(enemyPool[index % enemyPool.length])),
    playerInitialStates: input.relics.filter(({ relicId }) => activeIds.has(relicId)).map((state) => ({ ...state })),
    augmentEffects: expeditionBattleEffects(input.augments),
    enemyBodyScale: balance.bodyScale,
  };
}

/** 20층도 공용 난전에 넣고, 생존은 수치 센티널이 아닌 `SkirmishState.boss`의 불사 계약에 맡긴다. */
export function createExpeditionBossSkirmishConfig(input: ExpeditionBossBattleInputDto, playerDefs: readonly RelicDef[], enemyPool: readonly RelicDef[]): ExpeditionSkirmishConfig & { boss: { phases: SkirmishBossPhase[]; limitSeconds: number } } {
  if (!enemyPool[0]) throw new RangeError("원정 보스 원본이 비어 있습니다.");
  const activeIds = new Set(input.relics.filter(({ alive, currentHp }) => alive && currentHp > 0).map(({ relicId }) => relicId));
  const boss = enemyPool[0];
  return {
    playerDefs: playerDefs.filter(({ id }) => activeIds.has(id)),
    // 표시/밸런스 정의를 그대로 전투원에 보존해 상세창이나 로그가 센티널 HP를 읽지 않게 한다.
    enemyDefs: [{ ...boss, stats: { ...boss.stats } }],
    playerInitialStates: input.relics.filter(({ relicId }) => activeIds.has(relicId)),
    augmentEffects: expeditionBattleEffects(input.augments),
    enemyBodyScale: 1.25,
    boss: {
      phases: EXPEDITION_BOSS_BALANCE.phases.map((phase) => ({ startsAt: phase.startsAtMs / 1_000, damagePerSecond: phase.attackPerSecond, label: phase.label })),
      limitSeconds: EXPEDITION_BOSS_BALANCE.maximumDurationMs / 1_000,
    },
  };
}

/** 불참한 사망자까지 입력 순서로 복원해 매니저가 검증할 완전한 종료 DTO를 만든다. */
export function expeditionBattleResults(input: ExpeditionBattleInputDto, activeResults: readonly SkirmishRelicResult[]): SkirmishRelicResult[] {
  const byId = new Map(activeResults.map((result) => [result.relicId, result]));
  return input.relics.map((initial) => ({ ...(byId.get(initial.relicId) ?? initial) }));
}

/** 스토리 출격도 판별 필드를 반드시 보내 원정 입력과 같은 명시적 계약을 지킨다. */
export interface StageBattleInputDto {
  mode: "stage";
}

/** 일반 스테이지 진입과 원정 진입을 명시적으로 구분하는 전투 씬 입력 계약이다. */
export type BattleSceneInputDto = ExpeditionBattleInputDto | ExpeditionBossBattleInputDto | StageBattleInputDto;

/** Phaser가 생략·빈 data 또는 직전 data를 건네도 매 진입의 입력만으로 새 DTO를 만든다. */
export function normalizeBattleSceneInput(input?: unknown): BattleSceneInputDto {
  // 원정 판별값만 보존하고 나머지는 새 객체로 만들어 직전 원정 필드가 스토리에 섞이지 않게 한다.
  if (typeof input === "object" && input !== null && "mode" in input) {
    const candidate = input as BattleSceneInputDto;
    if (candidate.mode === "expedition" || candidate.mode === "expeditionBoss") return candidate;
  }
  return { mode: "stage" };
}

/** 모드별 상단 문구를 분리해 원정 화면이 선택된 스토리 이름을 읽지 않게 한다. */
export function battleHeaderText(input: BattleSceneInputDto, stage: { id: string; name: string; enemyLevel: number }): string {
  if (input.mode === "stage") return `${stage.id} · ${stage.name} · 적 LV.${stage.enemyLevel}`;
  if (input.mode === "expeditionBoss") return `원정 ${input.floor}층 · 불사 관측 보스`;
  // 노드 유형은 저장/정산용 영문값 대신 플레이어가 구분할 수 있는 전투 명칭으로 표시한다.
  const nodeLabel: Record<ExpeditionBattleInputDto["nodeType"], string> = { normal: "일반 전투", elite: "정예 전투", horde: "군집 전투" };
  return `원정 ${input.floor}층 · ${nodeLabel[input.nodeType]}`;
}

/** 저장 선택을 전투 코어가 소비하는 효과로 바꾸며 비전투 회복 효과는 이 목록에서 제외한다. */
export function expeditionBattleEffects(selections: readonly ExpeditionAugmentSelection[]): ExpeditionAugmentEffect[] {
  return selections.flatMap(({ augmentId, targetRelicId }) => {
    const effect = getExpeditionAugment(augmentId)?.effect;
    if (!effect || effect.kind === "healAfterBattlePercent") return [];
    const scope = targetRelicId ? { kind: "relic" as const, relicId: targetRelicId } : { kind: "all" as const };
    return [{ ...effect, scope }];
  });
}
