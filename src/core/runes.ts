/**
 * Phaser와 저장소 구현을 모르는 룬(Heart Gem) 도메인 규칙이다.
 *
 * 난수는 호출자가 주입하며, 생성된 인스턴스는 JSON으로 그대로 직렬화할 수 있다.
 */

/** 룬 희귀도다. 낮은 단계부터 고급·희귀·영웅·전설 순이며 한국어 표기는 `RUNE_RARITY_LABELS`만 소유한다. */
export type RuneRarity = "uncommon" | "rare" | "epic" | "legendary";

/** 희귀도의 한국어 표시명이다. UI가 같은 문자열을 다시 정의하지 않게 하는 단일 매핑이다. */
export const RUNE_RARITY_LABELS: Readonly<Record<RuneRarity, string>> = {
  uncommon: "고급",
  rare: "희귀",
  epic: "영웅",
  legendary: "전설",
};

/** 룬이 올릴 수 있는 전투 수치 키다. 수치의 단위는 모두 백분율(%p 또는 %)이다. */
export type RuneStatKey =
  | "hp" | "atk" | "ap" | "def" | "res"
  | "moveSpeed" | "attackSpeed" | "lifeSteal" | "critChance" | "critDamage"
  | "ferocityGain" | "energyGain";

/** 룬의 주력 능력치 키다. 생성 시 정확히 두 개를 중복 없이 뽑는다. */
export type RuneMainStatKey = "hp" | "atk" | "ap" | "def" | "res";

/** 룬의 보조 능력치 키다. 한 인스턴스 안에서는 주·보조를 통틀어 같은 키를 두 번 쓰지 않는다. */
export type RuneSubStatKey = Exclude<RuneStatKey, RuneMainStatKey>;

/** 룬 옵션 한 줄이다. `value`는 해당 능력치에 더할 백분율 수치이며 유한한 0 이상 값이어야 한다. */
export interface RuneStatOption<K extends RuneStatKey = RuneStatKey> {
  /** 적용할 능력치의 안정적인 키다. */
  key: K;
  /** 적용량(%). 확률 계열은 %p, 나머지는 기존 수치에 대한 % 보정으로 해석한다. */
  value: number;
}

/** 옵션 한 줄의 강화 시도 기록이다. 과거 결과를 수정하지 않고 시간 순서대로 추가한다. */
export interface RuneEnhancementRecord {
  /** 1부터 시작하며 해당 옵션 이력에서 앞 기록보다 정확히 1 커야 하는 시도 번호다. */
  attempt: number;
  /** 시도 직전에 사용한 성공 확률(0~1)이다. */
  successChance: number;
  /** 강화 성공 여부다. */
  succeeded: boolean;
  /** 성공으로 더해진 수치(%). 실패일 때는 반드시 0이다. */
  valueAdded: number;
}

/** 각인으로 옵션에 부여된 최종 결과다. 각 옵션 키에는 최대 하나만 저장한다. */
export interface RuneEngravingResult {
  /** 각인으로 영향을 받은 옵션 키다. 인스턴스에 실제 존재해야 한다. */
  statKey: RuneStatKey;
  /** 각인 등급. 단계 순서를 숫자로 비교하지 않도록 명시적인 문자열을 쓴다. */
  grade: "normal" | "great" | "perfect";
  /** 각인으로 더해진 수치(%). 유한한 0 이상 값이어야 한다. */
  valueAdded: number;
}

/**
 * 플레이어가 보유하는 룬 한 개다.
 *
 * 메인 옵션은 정확히 두 개, 보조 옵션은 희귀도별 0~3개이며 모든 옵션 키는 중복되지 않는다.
 */
export interface RuneInstance {
  /** 저장과 장착에서 사용하는 인스턴스 고유 ID다. 빈 문자열일 수 없다. */
  instanceId: string;
  /** 밸런스/표시 메타데이터를 찾는 원래 이름이다. 빈 문자열일 수 없다. */
  baseName: string;
  /** 플레이어가 정한 이름이다. 이름을 짓지 않았으면 null이다. */
  customName: string | null;
  /** 보조 옵션 개수를 결정하는 희귀도다. */
  rarity: RuneRarity;
  /** 중복되지 않는 정확히 두 개의 주력 옵션이다. */
  mainStats: readonly [RuneStatOption<RuneMainStatKey>, RuneStatOption<RuneMainStatKey>];
  /** 희귀도에 맞는 개수의 중복되지 않는 보조 옵션이다. */
  subStats: readonly RuneStatOption<RuneSubStatKey>[];
  /** 옵션 키별 강화 이력이다. 존재하지 않는 옵션 키를 포함할 수 없다. */
  enhancementHistory: Readonly<Partial<Record<RuneStatKey, readonly RuneEnhancementRecord[]>>>;
  /** 다음 강화 시도에 쓸 확률(0~1)이다. */
  currentSuccessChance: number;
  /** 희귀도별 필수 시도를 모두 마쳤는지 나타내는 파생 상태다. */
  enhancementComplete: boolean;
  /** 완료된 각인 결과다. 룬 하나에 최대 한 번만 각인할 수 있다. */
  engravings: readonly RuneEngravingResult[];
}

/** 룬 옵션을 실제 전투 계산에 넘기는 계약이다. 모든 값의 단위는 백분율이다. */
export interface RuneCombatModifiers {
  /** 피해 후 공격자 체력을 회복할 피해량 비율(%). 현재 `Stats`에 없으므로 피해 확정 단계가 소비한다. */
  lifeStealPercent: number;
  /** 사건별 기본 야성 획득량에 곱해 더할 비율(%). 현재 `Stats`에 없으므로 야성 증가 단계가 소비한다. */
  ferocityGainPercent: number;
}

/** 희귀도별 보조 옵션의 정확한 개수다. 생성과 검증이 함께 참조하는 단일 규칙이다. */
export const RUNE_SUB_STAT_COUNTS: Readonly<Record<RuneRarity, number>> = {
  uncommon: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
};

/** 일반 강화의 모든 확률 및 횟수 밸런스를 소유하는 단일 표다. */
export const RUNE_ENHANCEMENT_RULES = {
  initialSuccessChance: 0.75,
  successChanceDelta: 0.1,
  minimumSuccessChance: 0.25,
  maximumSuccessChance: 0.75,
  attemptsPerOption: 3,
  totalAttempts: { uncommon: 6, rare: 9, epic: 12, legendary: 15 },
} as const satisfies {
  initialSuccessChance: number;
  successChanceDelta: number;
  minimumSuccessChance: number;
  maximumSuccessChance: number;
  attemptsPerOption: number;
  totalAttempts: Readonly<Record<RuneRarity, number>>;
};

/** 룬 생성에 필요한 밸런스 값과 난수 의존성이다. 모든 옵션 값의 단위는 백분율이다. */
export interface CreateRuneInput {
  instanceId: string;
  baseName: string;
  rarity: RuneRarity;
  /** 각 키의 생성 수치(%). 생성 가능한 모든 키가 있어야 한다. */
  statValues: Readonly<Record<RuneStatKey, number>>;
  /** [0, 1) 값을 반환하는 난수 함수다. 테스트와 서버가 결과를 재현할 수 있도록 주입한다. */
  random: () => number;
}

const MAIN_KEYS: readonly RuneMainStatKey[] = ["hp", "atk", "ap", "def", "res"];
const SUB_KEYS: readonly RuneSubStatKey[] = ["moveSpeed", "attackSpeed", "lifeSteal", "critChance", "critDamage", "ferocityGain", "energyGain"];

/** 원본 배열을 바꾸지 않고 중복 없는 키를 뽑는다. 난수가 [0, 1) 밖이면 즉시 거부한다. */
function sampleKeys<K>(keys: readonly K[], count: number, random: () => number): K[] {
  const pool = [...keys];
  const picked: K[] = [];
  while (picked.length < count) {
    const roll = random();
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new RangeError("룬 난수는 0 이상 1 미만이어야 합니다.");
    picked.push(pool.splice(Math.floor(roll * pool.length), 1)[0]);
  }
  return picked;
}

/** 주 옵션 2개와 희귀도별 보조 옵션을 중복 없이 생성하고 완전한 신규 인스턴스를 반환한다. */
export function createRuneInstance(input: CreateRuneInput): RuneInstance {
  const mainStats = sampleKeys(MAIN_KEYS, 2, input.random).map((key) => ({ key, value: input.statValues[key] })) as [RuneStatOption<RuneMainStatKey>, RuneStatOption<RuneMainStatKey>];
  const subStats = sampleKeys(SUB_KEYS, RUNE_SUB_STAT_COUNTS[input.rarity], input.random).map((key) => ({ key, value: input.statValues[key] }));
  const rune: RuneInstance = {
    instanceId: input.instanceId,
    baseName: input.baseName,
    customName: null,
    rarity: input.rarity,
    mainStats,
    subStats,
    enhancementHistory: {},
    currentSuccessChance: RUNE_ENHANCEMENT_RULES.initialSuccessChance,
    enhancementComplete: false,
    engravings: [],
  };
  assertValidRuneInstance(rune);
  return rune;
}

/** 인스턴스의 저장 불변 조건을 검사하며, 유효하면 true를 반환하고 아니면 false를 반환한다. */
export function validateRuneInstance(rune: RuneInstance): boolean {
  try {
    assertValidRuneInstance(rune);
    return true;
  } catch {
    return false;
  }
}

/** 인스턴스의 모든 불변 조건을 검사하고 위반 시 원인을 담은 오류를 던진다. */
export function assertValidRuneInstance(rune: RuneInstance): void {
  if (!rune.instanceId.trim() || !rune.baseName.trim()) throw new Error("룬 ID와 기본 이름은 비어 있을 수 없습니다.");
  if (rune.customName !== null && !rune.customName.trim()) throw new Error("룬 사용자 이름은 빈 문자열일 수 없습니다.");
  if (rune.mainStats.length !== 2) throw new RangeError("룬 메인 옵션은 정확히 2개여야 합니다.");
  if (rune.subStats.length !== RUNE_SUB_STAT_COUNTS[rune.rarity]) throw new RangeError("룬 보조 옵션 수가 희귀도 규칙과 다릅니다.");
  const options: readonly RuneStatOption[] = [...rune.mainStats, ...rune.subStats];
  if (rune.mainStats.some(({ key }) => !MAIN_KEYS.includes(key))) throw new Error("메인 옵션에 주력 능력치가 아닌 키가 있습니다.");
  if (rune.subStats.some(({ key }) => !SUB_KEYS.includes(key))) throw new Error("보조 옵션에 보조 능력치가 아닌 키가 있습니다.");
  if (new Set(options.map(({ key }) => key)).size !== options.length) throw new Error("룬 옵션은 서로 중복될 수 없습니다.");
  if (options.some(({ value }) => !Number.isFinite(value) || value < 0)) throw new RangeError("룬 옵션 수치는 0 이상의 유한한 값이어야 합니다.");
  if (!Number.isFinite(rune.currentSuccessChance) || rune.currentSuccessChance < 0 || rune.currentSuccessChance > 1) throw new RangeError("강화 성공 확률은 0~1이어야 합니다.");
  const optionKeys = new Set(options.map(({ key }) => key));
  for (const [key, history] of Object.entries(rune.enhancementHistory)) {
    if (!optionKeys.has(key as RuneStatKey)) throw new Error("존재하지 않는 옵션의 강화 이력이 있습니다.");
    history?.forEach((record, index) => {
      if (record.attempt !== index + 1 || record.successChance < 0 || record.successChance > 1) throw new Error("강화 이력 순서 또는 확률이 올바르지 않습니다.");
      if (!Number.isFinite(record.valueAdded) || record.valueAdded < 0 || (!record.succeeded && record.valueAdded !== 0)) throw new Error("강화 이력의 증가량이 올바르지 않습니다.");
    });
    if ((history?.length ?? 0) > RUNE_ENHANCEMENT_RULES.attemptsPerOption) throw new Error("한 옵션은 세 번까지만 강화할 수 있습니다.");
  }
  if (rune.engravings.length > 1) throw new Error("각인은 룬 하나에 한 번만 적용할 수 있습니다.");
  if (rune.engravings.some(({ statKey, valueAdded }) => !optionKeys.has(statKey) || !Number.isFinite(valueAdded) || valueAdded < 0)) throw new Error("각인 결과가 올바르지 않습니다.");
  if (rune.enhancementComplete !== (runeEnhancementAttempts(rune) === runeTotalEnhancementAttempts(rune.rarity))) throw new Error("강화 완료 상태가 누적 시도와 다릅니다.");
}

/** 희귀도가 완료되기 위해 요구하는 일반 강화 총횟수를 반환한다. */
export function runeTotalEnhancementAttempts(rarity: RuneRarity): number {
  return RUNE_ENHANCEMENT_RULES.totalAttempts[rarity];
}

/** 성공과 실패를 모두 포함한 룬의 누적 일반 강화 횟수를 계산한다. */
export function runeEnhancementAttempts(rune: RuneInstance): number {
  return Object.values(rune.enhancementHistory).reduce((total, history) => total + (history?.length ?? 0), 0);
}

/** 직전 결과로 다음 성공률을 계산하며 25~75% 경계를 벗어나지 않게 한다. */
export function calculateRuneEnhancementSuccessChance(currentChance: number, succeeded: boolean): number {
  if (!Number.isFinite(currentChance) || currentChance < 0 || currentChance > 1) throw new RangeError("현재 성공 확률은 0~1이어야 합니다.");
  const moved = currentChance + (succeeded ? -RUNE_ENHANCEMENT_RULES.successChanceDelta : RUNE_ENHANCEMENT_RULES.successChanceDelta);
  return Math.min(RUNE_ENHANCEMENT_RULES.maximumSuccessChance, Math.max(RUNE_ENHANCEMENT_RULES.minimumSuccessChance, moved));
}

/** 지정 옵션에 일반 강화를 더 시도할 수 있는지 저장 상태를 바꾸지 않고 판정한다. */
export function canEnhanceRune(rune: RuneInstance, statKey: RuneStatKey): boolean {
  const exists = [...rune.mainStats, ...rune.subStats].some((option) => option.key === statKey);
  return exists && !rune.enhancementComplete && (rune.enhancementHistory[statKey]?.length ?? 0) < RUNE_ENHANCEMENT_RULES.attemptsPerOption;
}

/** 주입된 [0, 1) 난수로 일반 강화 한 회를 판정하고 새 룬 값을 반환한다. */
export function enhanceRune(rune: RuneInstance, statKey: RuneStatKey, valueIncrease: number, random: number): RuneInstance {
  assertValidRuneInstance(rune);
  if (!canEnhanceRune(rune, statKey)) throw new Error("존재하지 않거나 세 번을 마친 옵션은 강화할 수 없습니다.");
  if (!Number.isFinite(random) || random < 0 || random >= 1) throw new RangeError("강화 난수는 0 이상 1 미만이어야 합니다.");
  if (!Number.isFinite(valueIncrease) || valueIncrease < 0) throw new RangeError("강화 증가량은 0 이상의 유한한 값이어야 합니다.");
  const succeeded = random < rune.currentSuccessChance;
  const previous = rune.enhancementHistory[statKey] ?? [];
  const record: RuneEnhancementRecord = { attempt: previous.length + 1, successChance: rune.currentSuccessChance, succeeded, valueAdded: succeeded ? valueIncrease : 0 };
  const update = <K extends RuneStatKey>(option: RuneStatOption<K>): RuneStatOption<K> => option.key === statKey && succeeded ? { ...option, value: option.value + valueIncrease } : option;
  const attempts = runeEnhancementAttempts(rune) + 1;
  const next: RuneInstance = {
    ...rune,
    mainStats: rune.mainStats.map(update) as [RuneStatOption<RuneMainStatKey>, RuneStatOption<RuneMainStatKey>],
    subStats: rune.subStats.map(update) as RuneStatOption<RuneSubStatKey>[],
    enhancementHistory: { ...rune.enhancementHistory, [statKey]: [...previous, record] },
    currentSuccessChance: calculateRuneEnhancementSuccessChance(rune.currentSuccessChance, succeeded),
    enhancementComplete: attempts === runeTotalEnhancementAttempts(rune.rarity),
  };
  assertValidRuneInstance(next);
  return next;
}

/** 모든 일반 강화를 끝내고 아직 각인하지 않은 룬인지 판정한다. */
export function canEngraveRune(rune: RuneInstance): boolean {
  return rune.enhancementComplete && rune.engravings.length === 0;
}

/** 완료된 룬에 한 번뿐인 확정 각인을 적용하고 새 룬 값을 반환한다. */
export function engraveRune(rune: RuneInstance, result: RuneEngravingResult): RuneInstance {
  assertValidRuneInstance(rune);
  if (!canEngraveRune(rune)) throw new Error("모든 강화를 마친 각인 전 룬만 각인할 수 있습니다.");
  if (![...rune.mainStats, ...rune.subStats].some(({ key }) => key === result.statKey)) throw new Error("존재하지 않는 옵션은 각인할 수 없습니다.");
  const next = { ...rune, engravings: [result] } satisfies RuneInstance;
  assertValidRuneInstance(next);
  return next;
}

/** 룬 옵션 합계에서 `Stats` 밖의 흡혈·야성 증가량을 추출해 전투 계층에 전달한다. */
export function runeCombatModifiers(rune: RuneInstance): RuneCombatModifiers {
  assertValidRuneInstance(rune);
  const totals = [...rune.mainStats, ...rune.subStats].reduce<Partial<Record<RuneStatKey, number>>>((sum, option) => {
    sum[option.key] = (sum[option.key] ?? 0) + option.value;
    return sum;
  }, {});
  return { lifeStealPercent: totals.lifeSteal ?? 0, ferocityGainPercent: totals.ferocityGain ?? 0 };
}

/** 확정 피해와 흡혈 비율로 회복 후 체력을 계산한다. 체력·피해 단위는 전투 HP이며 최대 체력을 넘지 않는다. */
export function applyRuneLifeSteal(currentHp: number, maxHp: number, dealtDamage: number, modifiers: RuneCombatModifiers): number {
  if (![currentHp, maxHp, dealtDamage, modifiers.lifeStealPercent].every(Number.isFinite) || maxHp < 0 || dealtDamage < 0 || modifiers.lifeStealPercent < 0) {
    throw new RangeError("흡혈 계산 입력은 0 이상의 유한한 값이어야 합니다.");
  }
  return Math.min(maxHp, Math.max(0, currentHp) + dealtDamage * modifiers.lifeStealPercent / 100);
}

/** 사건별 기본 야성 획득량에 룬 보정을 적용한다. 반환 단위는 야성 게이지 포인트다. */
export function applyRuneFerocityGain(baseGain: number, modifiers: RuneCombatModifiers): number {
  if (!Number.isFinite(baseGain) || baseGain < 0 || !Number.isFinite(modifiers.ferocityGainPercent) || modifiers.ferocityGainPercent < 0) {
    throw new RangeError("야성 획득 계산 입력은 0 이상의 유한한 값이어야 합니다.");
  }
  return baseGain * (1 + modifiers.ferocityGainPercent / 100);
}
