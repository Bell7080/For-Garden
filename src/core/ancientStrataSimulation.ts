import { BOND_LEVEL_CAP } from "./bond";
import { getRelic } from "../data/relics";
import { RUNE_STAT_RULES } from "../data/runes";
import { ANCIENT_STRATA_TIME_LIMIT_SECONDS } from "../data/ancientStrataDifficulty";
import { applyHeartGems, applyLevelGrowth } from "./relicProgression";
import { createRuneInstance, enhanceRune, engraveRune, type RuneInstance, type RuneMainStatKey, type RuneStatKey, type RuneSubStatKey } from "./runes";
import { partyRuneTraitEffects } from "./runeTraitEffects";
import { createAncientStrataSkirmish } from "./ancientStrataBattle";
import { createDifficultyRng, type DifficultyControl } from "./stageDifficulty";
import { canFireUltimate, fireUltimate, isFighterAlive, stepSkirmish, type SkirmishEvent } from "./skirmish";

export const ANCIENT_REFERENCE_PARTIES = [
  { id: "requested", relics: ["rex", "torika", "mette"] },
  { id: "requested-tank-first", relics: ["torika", "rex", "mette"] },
  { id: "starter", relics: ["torika", "luka", "meron"] },
  { id: "physical", relics: ["torika", "rex", "meron"] },
  { id: "magic", relics: ["dimo", "ella", "mette"] },
  { id: "combo", relics: ["dimo", "ella", "terisa"] },
  { id: "summon", relics: ["dimo", "dian", "meron"] },
  { id: "cc", relics: ["pachi", "mosana", "anka"] },
  { id: "taunt", relics: ["deina", "rex", "mette"] },
  { id: "double-support", relics: ["torika", "meron", "mette"] },
  { id: "rush", relics: ["rex", "luka", "spino"] },
  { id: "queen-support", relics: ["deina", "dian", "mette"] },
  { id: "sniper", relics: ["torika", "maddy", "mette"] },
  { id: "bleed", relics: ["torika", "rex", "spino"] },
  { id: "r-party", relics: ["dodo", "mosana", "anka"] },
] as const;
export type AncientEquipment = "bare" | "epic" | "ceiling";

/** 합법적인 룬 3개를 생성/강화/각인 API로 구성. ceiling은 전 옵션 3회 성공의 이론 상한이지 평균 랭커가 아니다. */
export function ancientReferenceRunes(relicId: string, equipment: AncientEquipment): RuneInstance[] {
  if (equipment === "bare") return [];
  const def = getRelic(relicId);
  const offense: RuneMainStatKey = def.stats.atk >= def.stats.ap ? "atk" : "ap";
  const mains: [RuneMainStatKey, RuneMainStatKey][] = def.role === "tank"
    ? [["hp", "def"], ["hp", "res"], ["hp", offense]]
    : [[offense, "hp"], [offense, "def"], [offense, "res"]];
  const subs: RuneSubStatKey[] = def.role === "support" ? ["energyGain", "attackSpeed", "moveSpeed"] : ["attackSpeed", "critChance", "lifeSteal"];
  return mains.map((mainKeys, part) => {
    let rune = createRuneInstance({ instanceId: `ancient-${relicId}-${equipment}-${part}`, baseName: "Ancient reference", part: part as 0 | 1 | 2,
      rarity: equipment === "epic" ? "epic" : "legendary", mainKeys, random: () => 0,
      statValues: Object.fromEntries(Object.entries(RUNE_STAT_RULES).map(([key, rule]) => [key, rule.base])) as Record<RuneStatKey, number> });
    rune = { ...rune, subStats: subs.slice(0, equipment === "epic" ? 2 : 3).map(key => ({ key, value: RUNE_STAT_RULES[key].base })) };
    for (const { key } of [...rune.mainStats, ...rune.subStats]) for (let attempt = 0; attempt < 3; attempt++) {
      rune = enhanceRune(rune, key, RUNE_STAT_RULES[key].enhancement, equipment === "epic" && attempt === 2 ? 0.99 : 0);
    }
    if (equipment === "ceiling") rune = engraveRune(rune, { statKey: mainKeys[0], valueAdded: RUNE_STAT_RULES[mainKeys[0]].enhancement, grade: "perfect" });
    const traitIds = def.role === "tank" ? ["guardian", "lastStand", "firstAid"] : def.role === "support" ? ["awakening", "warCry", "afterglow"] : ["rhythm", "deepWound", "hemorrhage"];
    return { ...rune, trait: { id: traitIds[part], grade: equipment === "epic" ? "epic" : "legendary", upgradeMisses: 0 } };
  });
}

export function ancientReferenceParty(ids: readonly string[], equipment: AncientEquipment, level = 60, bondLevel = BOND_LEVEL_CAP) {
  if (ids.length !== 3 || new Set(ids).size !== 3) throw new RangeError("서로 다른 렐릭 세 명이 필요합니다.");
  if (!Number.isInteger(level) || level < 1 || level > 60) throw new RangeError("플레이어 레벨은 1~60입니다.");
  if (!Number.isInteger(bondLevel) || bondLevel < 0 || bondLevel > BOND_LEVEL_CAP) throw new RangeError("유대 레벨은 0~10입니다.");
  const equipped = ids.map(relicId => {
    if (getRelic(relicId).enemyOnly) throw new RangeError(`플레이 불가 렐릭: ${relicId}`);
    return { relicId, runes: ancientReferenceRunes(relicId, equipment) };
  });
  const players = equipped.map(({ relicId, runes }) => {
    const def = getRelic(relicId);
    return { ...def, stats: applyHeartGems(applyLevelGrowth(def.stats, level, def.rarity), runes) };
  });
  const breakthrough = level > 50 ? 4 : level > 40 ? 3 : level > 30 ? 2 : level > 20 ? 1 : 0;
  return { players, equipped, breakthroughs: Object.fromEntries(ids.map(id => [id, breakthrough])),
    // 실제 유대 야성 배율도 코어로 전달한다. 원정 증강은 주입하지 않는다.
    bonds: Object.fromEntries(ids.map(id => [id, bondLevel])), augmentEffects: partyRuneTraitEffects(equipped) };
}

export interface AncientSimulationRun {
  floor: number; seed: number; won: boolean; timedOut: boolean; seconds: number; playerHpRatio: number;
  survivors: number; enemyHpRatio: number; firstPlayerDeathSeconds: number | null; ultimateHitEvents: number;
}

/** 실전과 같은 공속/이속/돌파/룬 효과/사거리/소환수/궁극기를 쓰며 매 층 새 전투로 시작한다. */
export function simulateAncientStrataRun(floor: number, party: ReturnType<typeof ancientReferenceParty>, seed: number, control: DifficultyControl = "auto", step = 1 / 30): AncientSimulationRun {
  if (!Number.isFinite(step) || step < 1 / 120 || step > 1 / 20) throw new RangeError("시뮬레이션 틱은 1/120~1/20초입니다.");
  const state = createAncientStrataSkirmish(floor, party.players, { ...party, automaticUltimates: control === "auto" });
  const rng = createDifficultyRng(seed);
  let firstPlayerDeathSeconds: number | null = null, ultimateHitEvents = 0;
  function observe(events: SkirmishEvent[]) {
    for (const event of events) {
      if (event.kind === "death" && firstPlayerDeathSeconds === null && state.fighters.some(f => f.id === event.fighterId && f.side === "player" && f.summonOwnerId === null)) firstPlayerDeathSeconds = state.elapsed;
      if (event.kind === "attack" && event.skill === "ultimate") ultimateHitEvents++;
    }
  }
  while (state.phase === "fight" && state.elapsed < ANCIENT_STRATA_TIME_LIMIT_SECONDS - 1e-8) {
    observe(stepSkirmish(state, Math.min(step, ANCIENT_STRATA_TIME_LIMIT_SECONDS - state.elapsed), rng));
    if (control === "manualUltimate") {
      const allies = state.fighters.filter(f => f.side === "player" && f.summonOwnerId === null && isFighterAlive(f));
      for (const fighter of allies) {
        const ult = fighter.def.ultimate;
        const supportive = ult.effectType === "healing" || ult.targeting === "battlefieldAllies" || "selfBulwark" in ult;
        if (canFireUltimate(state, fighter) && (!supportive || allies.some(f => f.hp / f.maxHp <= 0.7))) observe(fireUltimate(state, fighter.id, rng));
        if (state.phase !== "fight") break;
      }
    }
  }
  const players = state.fighters.filter(f => f.side === "player" && f.summonOwnerId === null);
  const enemies = state.fighters.filter(f => f.side === "enemy" && f.summonOwnerId === null);
  return { floor, seed, won: state.phase === "victory", timedOut: state.phase === "fight", seconds: state.elapsed,
    playerHpRatio: players.reduce((sum, f) => sum + Math.max(0, f.hp) / f.maxHp, 0) / players.length,
    survivors: players.filter(isFighterAlive).length, enemyHpRatio: enemies.reduce((sum, f) => sum + Math.max(0, f.hp) / f.maxHp, 0) / enemies.length,
    firstPlayerDeathSeconds, ultimateHitEvents };
}
