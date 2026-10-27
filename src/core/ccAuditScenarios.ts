import { getRelic } from "../data/relics";
import { getBattleStage, getStageEnemies, stageEnemyGrowth } from "../data/stages";
import { EXPEDITION_BOSS_BALANCE } from "../data/expedition";
import { raidBossDef, raidBossPercentHpBasis, raidBossGrowth } from "./raid";
import { applyLevelGrowth, applyBreakthrough } from "./relicProgression";
import { requiredBreakthroughForLevel } from "./levelDesign";
import { battleArena } from "./battleArena";
import { createRaidSkirmishConfig, expeditionBattleEffects } from "./expeditionBattle";
import type { ExpeditionAugmentSelection } from "./expeditionRewards";
import { createSkirmish } from "./skirmish";
import type { RelicDef } from "./types";
import type { CcAuditLimits, CcAuditScenario } from "./ccDensityAudit";
import { ancientReferenceParty, type AncientEquipment } from "./ancientStrataSimulation";
import { stepAncientStrataBattle, createAncientStrataSkirmish, getAncientStrataFloor } from "./ancientStrataBattle";

export const CC_AUDIT_LIMITS = {
  augment: { maxContinuousSeconds: 0.6, maxControlledRatio: 0.22, minFreeGapSeconds: 2.4, minimumObservationSeconds: 20 },
  stage: { maxContinuousSeconds: 2, maxControlledRatio: 0.4, minFreeGapSeconds: 0.5, minimumObservationSeconds: 10 },
  boss: { maxContinuousSeconds: 1, maxControlledRatio: 0.25, minFreeGapSeconds: 1, minimumObservationSeconds: 20 },
} as const satisfies Record<string, CcAuditLimits>;
export const CC_AUGMENT_FAMILIES = ["stagger", "stun", "frozen", "fear", "frenzy", "knockback", "pressure", "drowsy", "intimidate", "taunt"] as const;

function neutral(id: string, attackSpeed: number): RelicDef {
  const base = getRelic("dodo");
  return { ...base, id, stats: { ...base.stats, hp: 1_000_000, atk: 1, ap: 1, def: 300, res: 300, attackSpeed,
    critChance: 0, lifeSteal: 0, energyGain: 26, ferocityGain: 0 },
    passive: { id: "cc-audit-neutral", name: "CC audit", kind: "summonDerived", value: 0, iconAssetId: "skill-icon-buff", effectType: "buff", desc: "" },
    basic: { id: "cc-audit-basic", name: "CC audit", iconAssetId: "skill-icon-physical", effectType: "physical", damageType: "physical", targeting: "single", power: 1 },
    ultimate: { id: "cc-audit-ultimate", name: "CC audit", iconAssetId: "skill-icon-physical", effectType: "physical", damageType: "physical", targeting: "single", power: 1, cost: 100 },
  };
}

/** 무한 생존 QA 표적은 피해/폭주를 배제하고 세 제공자의 제어·타격 시계만 극단 조건으로 검수한다. */
export function createCcStressScenario(options: {
  ids: readonly string[]; selections?: readonly ExpeditionAugmentSelection[]; speed?: number; durationSeconds?: number; offset?: boolean; contact?: boolean;
  role?: "normal" | "boss" | "endless"; seed?: string;
}): CcAuditScenario {
  const speed = options.speed ?? 400;
  const selections: ExpeditionAugmentSelection[] = options.selections ? [...options.selections] : options.ids.map((augmentId, index) => ({ augmentId, targetRelicId: `cc-${index % 3}` }));
  for (let count = 0; count < 3; count++) selections.push({ augmentId: "overclock-field" });
  const id = `stress:${options.ids.join("+")}:as${speed}:${options.offset ? "offset" : "sync"}:${options.role ?? "normal"}:${options.contact === false ? "natural" : "contact"}`;
  return { id, durationSeconds: options.durationSeconds ?? 30, stepSeconds: 0.02, seed: options.seed ?? id,
    limits: CC_AUDIT_LIMITS.augment,
    metadata: { mode: "augment-stress", selections, nativeEffectsDisabled: true, fixedContact: options.contact !== false, overclockStacks: 3 },
    createState: () => {
      const target = { ...neutral("cc-target", 100), encounterRole: options.role ?? "normal" };
      const state = createSkirmish([0, 1, 2].map(i => neutral(`cc-${i}`, speed)), [target], battleArena("stage"), {}, {}, {
        automaticUltimates: true, augmentEffects: expeditionBattleEffects(selections),
        playerPositions: [0, 1, 2].map(i => ({ x: 400 + i * 8, y: 980 })), enemyPositions: [{ x: 430, y: 980 }],
      });
      state.fighters.forEach((fighter, i) => { fighter.percentHpBasis = 10000; fighter.attackCooldown = options.offset && i < 3 ? i * 0.12 : 0; });
      return state;
    },
    beforeStep: state => {
      state.fighters.forEach((fighter, i) => {
        fighter.ferocity = 0; fighter.ferocityFever = false;
        if (options.contact !== false) { fighter.x = i < 3 ? 400 + i * 8 : 430; fighter.y = 980; }
      });
    },
  };
}

/** 실제 스테이지·레이드·원정 보스의 성장·강인함·전장·자동 시전 경로를 그대로 사용한다. */
export function createCcCombatScenario(options: {
  mode: "stage" | "raid" | "endless" | "ancient"; stageId?: string; bossId?: string; party?: readonly string[];
  floor?: number; equipment?: AncientEquipment;
  level?: number; durationSeconds?: number; seed?: string; selections?: readonly ExpeditionAugmentSelection[];
}): CcAuditScenario {
  if (options.mode === "ancient") {
    const floor = options.floor ?? 100, definition = getAncientStrataFloor(floor);
    if (options.selections?.length) throw new Error("고대 지층에는 원정 증강을 적용하지 않습니다.");
    if (options.equipment && !["bare", "epic", "ceiling"].includes(options.equipment)) throw new Error("Invalid ancient equipment");
    const party = ancientReferenceParty(options.party ?? ["rex", "torika", "mette"], options.equipment ?? "bare", options.level ?? 60);
    const id = `ancient:${floor}:${options.equipment ?? "bare"}:lv${options.level ?? 60}`;
    return { id, seed: options.seed ?? id, durationSeconds: Math.min(options.durationSeconds ?? definition.timeLimitSeconds, definition.timeLimitSeconds),
      limits: CC_AUDIT_LIMITS.stage, metadata: { mode: "ancient", floor, equipment: options.equipment ?? "bare", level: options.level ?? 60, party: party.players.map(p => p.id) },
      step: stepAncientStrataBattle, stepSeconds: .02, createState: () => createAncientStrataSkirmish(floor, party.players, party) };
  }
  const stage = options.mode === "stage" ? getBattleStage(options.stageId ?? "1-10") : undefined;
  const level = options.level ?? (stage ? Math.max(...stageEnemyGrowth(stage).map(enemy => enemy.level)) : 60);
  const breakthrough = requiredBreakthroughForLevel(level);
  const party = (options.party ?? ["pachi", "mosana", "anka"]).map(id => {
    const def = getRelic(id); return { ...def, stats: applyBreakthrough(applyLevelGrowth(def.stats, level, def.rarity), breakthrough) };
  });
  const effects = expeditionBattleEffects(options.selections ?? []);
  const id = `${options.mode}:${stage?.id ?? options.bossId ?? (options.mode === "raid" ? "koma" : "pontos")}:lv${level}`;
  return { id, durationSeconds: options.durationSeconds ?? 30, seed: options.seed ?? id,
    limits: options.mode === "stage" ? CC_AUDIT_LIMITS.stage : CC_AUDIT_LIMITS.boss,
    metadata: { mode: options.mode, level, breakthrough, party: party.map(def => def.id), selections: options.selections ?? [], hypotheticalAugments: effects.length > 0 },
    createState: () => {
      const levels = Object.fromEntries(party.map(def => [def.id, breakthrough]));
      if (stage) return createSkirmish(party, getStageEnemies(stage), battleArena("stage"), {}, levels, { automaticUltimates: true, augmentEffects: effects, enemyBreakthroughs: stageEnemyGrowth(stage).map(enemy => enemy.breakthrough) });
      if (options.mode === "raid") {
        const base = getRelic(options.bossId ?? "koma"), boss = raidBossDef(base, "normal");
        const config = createRaidSkirmishConfig(party, boss, raidBossPercentHpBasis(base, "normal"), 1_000_000);
        return createSkirmish(party, config.enemyDefs, battleArena("raid"), {}, levels, { ...config, automaticUltimates: true, augmentEffects: effects, enemyBreakthroughs: [raidBossGrowth("normal").breakthrough] });
      }
      const base = getRelic(options.bossId ?? "pontos");
      const boss: RelicDef = { ...base, encounterRole: "endless", stats: applyBreakthrough(applyLevelGrowth(base.stats, level, base.rarity), breakthrough) };
      return createSkirmish(party, [boss], battleArena("expeditionBoss"), {}, levels, { automaticUltimates: true, augmentEffects: effects,
        boss: { phases: EXPEDITION_BOSS_BALANCE.phases.map(phase => ({ startsAt: phase.startsAtMs / 1000, damagePerSecond: phase.attackPerSecond, label: phase.label })),
          limitSeconds: EXPEDITION_BOSS_BALANCE.maximumDurationMs / 1000, percentHpBasis: boss.stats.hp } });
    },
  };
}

/** 9개 제어 계열의 모든 3종 조합 × SR/SSR 8패턴 × 공속 2단계 × 시점 2패턴. */
export function createCcMatrixScenarios(options: { durationSeconds?: number; quick?: boolean; seed?: string } = {}): CcAuditScenario[] {
  const triples: number[][] = [];
  if (options.quick) triples.push([0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[1,5,6],[2,3,7],[0,5,7],[1,3,8],[2,4,6]);
  else for (let a = 0; a < CC_AUGMENT_FAMILIES.length - 2; a++) for (let b = a + 1; b < CC_AUGMENT_FAMILIES.length - 1; b++) for (let c = b + 1; c < CC_AUGMENT_FAMILIES.length; c++) triples.push([a,b,c]);
  if (options.quick) for (let i = 0; i < 9; i++) triples.push([i, (i + 1) % 9, 9]);
  const scenarios: CcAuditScenario[] = [];
  const add = (ids: string[], speed: number, offset: boolean, role?: "boss" | "endless", contact = true) => {
    const scenario = createCcStressScenario({ ids, speed, offset, role, contact, durationSeconds: options.durationSeconds ?? 30 });
    scenario.seed = options.seed ? `${options.seed}:${scenario.id}` : scenario.id;
    scenario.includeTimeline = false;
    scenarios.push(scenario);
  };
  for (const triple of triples) for (let mask = 0; mask < 8; mask++) for (const speed of [100,400]) for (const offset of [false,true]) {
    add(triple.map((kind,i) => `tag-${CC_AUGMENT_FAMILIES[kind]}-${mask & (1 << i) ? "ultimate" : "basic"}`), speed, offset);
  }
  for (const variant of ["basic","ultimate","mixed"]) for (const speed of [100,400]) for (const offset of [false,true]) {
    add(CC_AUGMENT_FAMILIES.map((kind,i) => `tag-${kind}-${variant === "mixed" ? i % 2 ? "ultimate" : "basic" : variant}`), speed, offset);
  }
  // 같은 ID를 세 렐릭에게 하나씩 주는 현재 획득 규칙도 검수한다.
  for (const kind of CC_AUGMENT_FAMILIES) for (const variant of ["basic", "ultimate"]) for (const offset of [false, true]) {
    add(Array(3).fill(`tag-${kind}-${variant}`), 400, offset);
  }
  for (const role of ["boss","endless"] as const) add(CC_AUGMENT_FAMILIES.map((kind,i) => `tag-${kind}-${i%2 ? "ultimate" : "basic"}`),400,true,role,false);
  return scenarios;
}

/** 원본 평타·스킬·한계 돌파를 유지하고, 공속/이속/배치에 따른 접촉 시작과 어그로 왕복을 검수한다.
 * HP만 늘린 생존 시험이며 실제 스테이지 승률과 구분한다. 각 조건은 증강 없음/있음이 같은 seed를 쓴다.
 */
export function createCcEngagementScenarios(options: { durationSeconds?: number; quick?: boolean; seed?: string } = {}): CcAuditScenario[] {
  const cases: CcAuditScenario[] = [];
  const parties = [["deina", "torika", "ella"], ["deina", "maddy", "anka"], ["pachi", "mosana", "maddy"]];
  parties.forEach(ids => ids.forEach(id => getRelic(id)));
  for (const ids of parties) for (const speed of options.quick ? [1,4] : [0.6,1,4])
  for (const movement of options.quick ? [0.5] : [0.5,1,2])
  for (const breakthrough of options.quick ? [0,4] : [0,1,2,3,4])
  for (const layout of ["near", "far", "flank"] as const) for (const augmented of [false,true]) {
    const key = `engagement:${ids.join("+")}:as${speed}:ms${movement}:bt${breakthrough}:${layout}`;
    const selections = augmented ? ids.flatMap((targetRelicId, i) => [
      { augmentId: ["tag-taunt-basic", "tag-stagger-basic", "tag-frozen-ultimate"][i], targetRelicId },
    ]) : [];
    cases.push({ id: `${key}:${augmented ? "augmented" : "baseline"}`, seed: options.seed ? `${options.seed}:${key}` : key,
      durationSeconds: options.durationSeconds ?? 30, limits: CC_AUDIT_LIMITS.stage, includeTimeline: false,
      metadata: { mode: "engagement", pairedScenario: key, hpEnduranceMultiplier: 100, originalSkills: true,
        party: ids, attackSpeedMultiplier: speed, moveSpeedMultiplier: movement, breakthrough, layout, selections },
      createState: () => {
        const party = ids.map((id, i) => {
          const def = getRelic(id);
          const stats = applyBreakthrough(applyLevelGrowth(def.stats, 30, def.rarity), breakthrough);
          return { ...def, stats: { ...stats, hp: stats.hp * 100, attackSpeed: stats.attackSpeed * speed * [0.8,1,1.2][i],
            moveSpeed: stats.moveSpeed * movement * [1.2,1,0.8][i] } };
        });
        const target = neutral("cc-target", 100);
        target.stats.moveSpeed = 110; target.stats.energyGain = 0;
        const positions = layout === "near" ? [{x:400,y:900},{x:460,y:1000},{x:520,y:900}]
          : layout === "far" ? [{x:250,y:1250},{x:480,y:1320},{x:720,y:1250}]
          : [{x:150,y:760},{x:900,y:1050},{x:500,y:1320}];
        const state = createSkirmish(party, [target], battleArena("stage"), {}, Object.fromEntries(ids.map(id => [id, breakthrough])), {
          automaticUltimates: true, augmentEffects: expeditionBattleEffects(selections), playerPositions: positions,
          enemyPositions: [{x:500,y:850}],
        });
        state.fighters.find(f => f.side === "enemy")!.percentHpBasis = 10_000;
        return state;
      },
    });
  }
  return cases;
}

/** 긴 사거리의 세 제공자를 넓게 벌려 느린 근접 표적의 도발 왕복을 재현한다. */
export function createCcMobilityScenarios(options: { durationSeconds?: number; seed?: string } = {}): CcAuditScenario[] {
  const cases: CcAuditScenario[] = [];
  for (const speed of [60,100,400]) for (const movement of [40,110,220]) for (const offset of [false,true])
  for (const augmented of [false,true]) {
    const ids = augmented ? Array(3).fill("tag-taunt-basic") : [];
    const scenario = createCcStressScenario({ ids, speed, contact: false, offset, durationSeconds: options.durationSeconds ?? 60 });
    const original = scenario.createState;
    const key = `mobility:as${speed}:ms${movement}:${offset ? "offset" : "sync"}`;
    scenario.id = `${key}:${augmented ? "augmented" : "baseline"}`;
    scenario.seed = options.seed ? `${options.seed}:${key}` : key;
    scenario.limits = CC_AUDIT_LIMITS.stage;
    scenario.includeTimeline = false;
    scenario.metadata = { ...scenario.metadata, pairedScenario: key, mode: "mobility", meleeTargetMoveSpeed: movement, sourceReach: "ranged" };
    scenario.createState = () => {
      const state = original();
      const positions = [{x:150,y:650},{x:930,y:650},{x:540,y:1330},{x:540,y:980}];
      state.fighters.forEach((fighter,i) => {
        fighter.x = positions[i].x; fighter.y = positions[i].y; fighter.engaged = false;
        fighter.def = { ...fighter.def, reachTier: i < 3 ? "ranged" : "melee", stats: { ...fighter.def.stats, moveSpeed: i < 3 ? 160 : movement } };
      });
      return state;
    };
    cases.push(scenario);
  }
  return cases;
}
