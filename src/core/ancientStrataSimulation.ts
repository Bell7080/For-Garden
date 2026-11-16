import { COMBAT_STEP_MS } from "./combatProtocol";
import { deathClockClosesBySeconds } from "./battleClock";
import { BOND_LEVEL_CAP } from "./bond";
import { getRelic } from "../data/relics";
import { applyHeartGems, applyLevelGrowth, referenceBreakthroughAt, RELIC_MAX_LEVEL } from "./relicProgression";
import { generateRune, enhanceRune, engraveRune, runeEnhancementIncrease, runeOptionValue, type RuneInstance, type RuneMainStatKey, type RuneSubStatKey } from "./runes";
import { partyRuneTraitEffects } from "./runeTraitEffects";
import { stepAncientStrataBattle, createAncientStrataSkirmish, getAncientStrataFloor } from "./ancientStrataBattle";
import { createDifficultyRng, type DifficultyControl } from "./stageDifficulty";
import { isFighterAlive, type SkirmishEvent } from "./skirmish";

export const ANCIENT_REFERENCE_PARTIES = [
  { id: "requested", relics: ["rex", "torika", "mette"] },
  { id: "requested-tank-first", relics: ["torika", "rex", "mette"] },
  { id: "starter", relics: ["torika", "luka", "meron"] },
  { id: "physical", relics: ["torika", "rex", "meron"] },
  { id: "magic", relics: ["ella", "morphe", "mette"] },
  { id: "combo", relics: ["ella", "irna", "terisa"] },
  { id: "summon", relics: ["nodonia", "dian", "meron"] },
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
    const rarity = equipment === "epic" ? "epic" : "legendary";
    let rune = generateRune({ instanceId: `ancient-${relicId}-${equipment}-${part}`, baseName: "Ancient reference", part: part as 0 | 1 | 2, rarity, mainKeys, random: () => 0 });
    // 보조 옵션은 역할이 정한 키로 갈아 끼운다. 실제 값은 `runeOptionValue`가 등급표에서 다시 구하므로 저장 사본만 맞춘다.
    rune = { ...rune, subStats: subs.slice(0, equipment === "epic" ? 2 : 3).map(key => ({ key, value: runeOptionValue(rune, key) })) };
    for (const { key } of [...rune.mainStats, ...rune.subStats]) for (let attempt = 0; attempt < 3; attempt++) {
      rune = enhanceRune(rune, key, runeEnhancementIncrease(rarity, key), equipment === "epic" && attempt === 2 ? 0.99 : 0);
    }
    if (equipment === "ceiling") rune = engraveRune(rune, { statKey: mainKeys[0], valueAdded: runeEnhancementIncrease(rarity, mainKeys[0]), grade: "perfect" });
    const traitIds = def.role === "tank" ? ["guardian", "lastStand", "firstAid"] : def.role === "support" ? ["awakening", "warCry", "afterglow"] : ["rhythm", "deepWound", "hemorrhage"];
    return { ...rune, trait: { id: traitIds[part], grade: equipment === "epic" ? "epic" : "legendary", upgradeMisses: 0 } };
  });
}

export function ancientReferenceParty(ids: readonly string[], equipment: AncientEquipment, level = 60, bondLevel = BOND_LEVEL_CAP) {
  if (ids.length !== 3 || new Set(ids).size !== 3) throw new RangeError("서로 다른 렐릭 세 명이 필요합니다.");
  if (!Number.isInteger(level) || level < 1 || level > RELIC_MAX_LEVEL) throw new RangeError(`플레이어 레벨은 1~${RELIC_MAX_LEVEL}입니다.`);
  if (!Number.isInteger(bondLevel) || bondLevel < 0 || bondLevel > BOND_LEVEL_CAP) throw new RangeError("유대 레벨은 0~10입니다.");
  const equipped = ids.map(relicId => {
    if (getRelic(relicId).enemyOnly || getRelic(relicId).summonOnly) throw new RangeError(`플레이 불가 렐릭: ${relicId}`);
    return { relicId, runes: ancientReferenceRunes(relicId, equipment) };
  });
  // 그 레벨의 평범한 계정으로 본다(기준 진행표 20·30·40·50 — 예전 요구 레벨 바로 다음부터 열린 셈).
  const breakthrough = referenceBreakthroughAt(level - 1);
  const players = equipped.map(({ relicId, runes }) => {
    const def = getRelic(relicId);
    return { ...def, stats: applyHeartGems(applyLevelGrowth(def.stats, level, def.rarity, breakthrough), runes) };
  });
  return { players, equipped, breakthroughs: Object.fromEntries(ids.map(id => [id, breakthrough])),
    // 실제 유대 야성 배율도 코어로 전달한다. 원정 증강은 주입하지 않는다.
    bonds: Object.fromEntries(ids.map(id => [id, bondLevel])), augmentEffects: partyRuneTraitEffects(equipped) };
}

export interface AncientSimulationRun {
  floor: number; seed: number; won: boolean; timedOut: boolean; seconds: number; playerHpRatio: number;
  survivors: number; enemyHpRatio: number; firstPlayerDeathSeconds: number | null; ultimateHitEvents: number;
}

/** 실전과 같은 공속/이속/돌파/룬 효과/사거리/소환수/궁극기를 쓰며 매 층 새 전투로 시작한다. */
export function simulateAncientStrataRun(floor: number, party: ReturnType<typeof ancientReferenceParty>, seed: number, control: DifficultyControl = "auto", step = COMBAT_STEP_MS / 1000): AncientSimulationRun {
  if (!Number.isFinite(step) || step < 1 / 120 || step > 1 / 20) throw new RangeError("시뮬레이션 틱은 1/120~1/20초입니다.");
  const state = createAncientStrataSkirmish(floor, party.players, { ...party, automaticUltimates: false });
  // 「초읽기」만 제한 시간을 갖는다 — 나머지 층은 데스 카운트가 닫는 시각까지 돌린다.
  const timeLimit = getAncientStrataFloor(floor).timeLimitSeconds ?? deathClockClosesBySeconds();
  const rng = createDifficultyRng(seed);
  let firstPlayerDeathSeconds: number | null = null, ultimateHitEvents = 0;
  function observe(events: SkirmishEvent[]) {
    for (const event of events) {
      if (event.kind === "death" && firstPlayerDeathSeconds === null && state.fighters.some(f => f.id === event.fighterId && f.side === "player" && f.summonOwnerId === null)) firstPlayerDeathSeconds = state.elapsed;
      if (event.kind === "attack" && event.skill === "ultimate") ultimateHitEvents++;
    }
  }
  while (state.phase === "fight" && state.elapsed < timeLimit - 1e-8) {
    observe(stepAncientStrataBattle(state,Math.min(step,timeLimit-state.elapsed),rng,control));
  }
  const players = state.fighters.filter(f => f.side === "player" && f.summonOwnerId === null);
  const enemies = state.fighters.filter(f => f.side === "enemy" && f.summonOwnerId === null);
  return { floor, seed, won: state.phase === "victory", timedOut: state.timeLimitReached === true || state.phase === "fight", seconds: state.elapsed,
    playerHpRatio: players.reduce((sum, f) => sum + Math.max(0, f.hp) / f.maxHp, 0) / players.length,
    survivors: players.filter(isFighterAlive).length, enemyHpRatio: enemies.reduce((sum, f) => sum + Math.max(0, f.hp) / f.maxHp, 0) / enemies.length,
    firstPlayerDeathSeconds, ultimateHitEvents };
}
