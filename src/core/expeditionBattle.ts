import type { ExpeditionNodeType } from "./expeditionMap";
import type { RelicDef } from "./types";
import type { ExpeditionAugmentSelection } from "./expeditionRewards";
import { getExpeditionAugment } from "../data/expeditionAugments";
import type { ExpeditionAugmentEffect } from "./expeditionAugments";
import { EXPEDITION_COMBAT_BALANCE } from "../data/expedition";
import { EXPEDITION_BOSS_BALANCE } from "../data/expedition";
import { isRaidDifficulty, RAID_BOSS_BALANCE, type RaidDifficulty } from "../data/raid";
import { ENCOUNTER_ROLE } from "./levelDesign";
import { RAID_BOSS_ROLE } from "./raid";
import type { FighterInitialState, SkirmishBossPhase, SkirmishRelicResult } from "./skirmish";
import type { BountyBattleInputDto } from "./bountyRun";

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
    enemyBodyScale: ENCOUNTER_ROLE.endless.bodyScale,
    boss: {
      phases: EXPEDITION_BOSS_BALANCE.phases.map((phase) => ({ startsAt: phase.startsAtMs / 1_000, damagePerSecond: phase.attackPerSecond, label: phase.label })),
      limitSeconds: EXPEDITION_BOSS_BALANCE.maximumDurationMs / 1_000,
    },
  };
}

/**
 * 레이드도 **같은 불사 보스 계약**을 쓴다 — 다른 것은 제한 시간과 단계 이름뿐이다.
 *
 * 판 안에서 보스를 눕히지 않는 이유는 남은 체력의 주인이 시즌이기 때문이다. 한 판은 90초 동안
 * 민 몫을 재고, 그 뒤 마지막 단계의 처형이 판을 끝낸다.
 */
export function createRaidSkirmishConfig(playerDefs: readonly RelicDef[], boss: RelicDef, percentHpBasis: number): ExpeditionSkirmishConfig & { boss: { phases: SkirmishBossPhase[]; limitSeconds: number; percentHpBasis: number; endsOnKill: boolean } } {
  return {
    playerDefs: [...playerDefs],
    enemyDefs: [{ ...boss, stats: { ...boss.stats } }],
    playerInitialStates: playerDefs.map(({ id }) => ({ relicId: id, currentHp: 100, alive: true })),
    augmentEffects: [],
    enemyBodyScale: ENCOUNTER_ROLE[RAID_BOSS_ROLE].bodyScale,
    boss: {
      phases: RAID_BOSS_BALANCE.phases.map((phase) => ({ startsAt: phase.startsAtMs / 1_000, damagePerSecond: phase.attackPerSecond, label: phase.label })),
      limitSeconds: RAID_BOSS_BALANCE.maximumDurationMs / 1_000,
      // 출혈 같은 비율 피해는 시즌 단위가 아니라 성장 체력에서 잰다(`raidBossPercentHpBasis`).
      percentHpBasis,
      // 레이드의 몸은 공유 게이지의 한 칸이다 — 다 깎으면 그 판은 그 자리에서 끝난다.
      endsOnKill: true,
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
  /**
   * 결과판을 닫은 뒤 돌아갈 곳. 비우면 지도다.
   *
   * 오프닝은 지도를 거치지 않고 곧장 1-1로 들어오므로, 끝난 뒤에도 지도가 아니라 로비로 나간다 —
   * 한 번도 본 적 없는 지도로 떨어지면 오프닝에서 이어지던 흐름이 거기서 끊긴다.
   */
  exitTo?: "lobby";
  /**
   * 이기면 결과판을 닫은 뒤 곧장 이어지는 짧은 이야기. 그 이야기가 끝나면 `exitTo`로 간다.
   * 오프닝에서 들어온 1-1만 쓴다(공멸 삼인조의 퇴각). 지면 이야기 없이 곧장 나간다.
   */
  epilogueStoryId?: string;
}

/**
 * 레이드 진입.
 *
 * 편성은 씬이 `session.party`를 읽으므로 입력이 들고 다닐 것이 없다 — 원정처럼 런 도중의 잔여
 * 체력을 이어받지 않고 늘 온전한 상태로 시작하기 때문이다.
 */
export interface RaidBattleInputDto {
  mode: "raid";
  /** 어느 판의 체력을 깎는가. 월드 폭주든 친구가 연 판이든 같은 입력이다. */
  raidId: string;
  bossRelicId: string;
  difficulty: RaidDifficulty;
}

/** 일반 스테이지 진입과 원정·레이드 진입을 명시적으로 구분하는 전투 씬 입력 계약이다. */
/**
 * 치즈케이크 대작전 입장.
 *
 * 스테미나는 **입장에서 이미 빠졌다** — 그 영수증의 `requestId`를 그대로 들고 다녀야 결과
 * 확정이 같은 판의 것으로 붙는다.
 */
export interface CakeBattleInputDto {
  mode: "cake";
  tierId: string;
  requestId: string;
}

/** 일반 스테이지 진입과 원정·레이드·대작전·현상수배 진입을 명시적으로 구분하는 전투 씬 입력 계약이다. */
export type BattleSceneInputDto = ExpeditionBattleInputDto | ExpeditionBossBattleInputDto | StageBattleInputDto | RaidBattleInputDto | CakeBattleInputDto | BountyBattleInputDto;

/** Phaser가 생략·빈 data 또는 직전 data를 건네도 매 진입의 입력만으로 새 DTO를 만든다. */
export function normalizeBattleSceneInput(input?: unknown): BattleSceneInputDto {
  // 원정 판별값만 보존하고 나머지는 새 객체로 만들어 직전 원정 필드가 스토리에 섞이지 않게 한다.
  if (typeof input === "object" && input !== null && "mode" in input) {
    const candidate = input as BattleSceneInputDto;
    if (candidate.mode === "expedition" || candidate.mode === "expeditionBoss" || candidate.mode === "cake") return candidate;
    // 레이드는 판 ID까지 있어야 한다 — 판별값만 남은 입력은 어느 체력을 깎을지 모른다.
    if (candidate.mode === "raid" && typeof candidate.raidId === "string" && typeof candidate.bossRelicId === "string" && isRaidDifficulty(candidate.difficulty)) return candidate;
    // 현상수배는 라운드 번호까지 있어야 한 판이 이어진다 — 판별값만 남은 입력은 스토리로 돌린다.
    if (candidate.mode === "bounty" && typeof candidate.tierId === "string" && typeof candidate.requestId === "string") return candidate;
    // 스토리는 돌아갈 곳 하나만 이어받는다. 모르는 값은 기본 길(지도)로 수렴시킨다.
    if (candidate.mode === "stage" && candidate.exitTo === "lobby") {
      return typeof candidate.epilogueStoryId === "string"
        ? { mode: "stage", exitTo: "lobby", epilogueStoryId: candidate.epilogueStoryId }
        : { mode: "stage", exitTo: "lobby" };
    }
  }
  return { mode: "stage" };
}

/** 저장 선택을 전투 코어가 소비하는 효과로 바꾸며 비전투 회복 효과는 이 목록에서 제외한다. */
export function expeditionBattleEffects(selections: readonly ExpeditionAugmentSelection[]): ExpeditionAugmentEffect[] {
  return selections.flatMap(({ augmentId, targetRelicId }) => {
    const augment = getExpeditionAugment(augmentId);
    const effect = augment?.effect;
    if (!augment || !effect || effect.kind === "healAfterBattlePercent") return [];
    const scope = targetRelicId ? { kind: "relic" as const, relicId: targetRelicId } : { kind: "all" as const };
    // 수치 효과는 카탈로그 ID로 묶여 가산·상한·최강 단일 정책을 전투 계산까지 보존한다.
    return [{ ...effect, scope, stacking: augment.stacking, stackKey: `${augment.id}:${targetRelicId ?? "party"}` }];
  });
}
