import type { RuneTraitGrade } from "../core/runeTraits";

/**
 * 룬 특성의 정적 정의와 검수 장부다.
 *
 * **한 특성이 등급마다 다른 것은 수치 하나뿐이다.** 등급이 효과의 종류까지 바꾸면 같은 이름이
 * 등급마다 다른 것을 하게 되어, 플레이어가 「추격」을 알아도 자기 룬의 추격이 무엇인지는 다시
 * 읽어야 한다.
 *
 * 문구는 여기 두지 않는다 — 이름과 설명은 `src/i18n/<언어>/rune.ts`의 `rune.trait.*`가 갖고,
 * 본문의 수치는 아래 `values`에서 채워진다. 수치를 고치면 화면의 문장이 함께 움직인다.
 */

/** 전투 진행기가 해석하는 특성 메커니즘이다. 데이터가 임의 코드를 실행할 자리는 없다. */
export type RuneTraitEffectSpec =
  /** 전투 시작 시 자신에게 일정 시간 공격 속도. 시간 안에 처치하면 지속이 늘고, 늘림 합계에 상한이 있다. `values`는 증가율(%)이다. */
  | { readonly kind: "hasteOnBattleStart"; readonly seconds: number; readonly extendSeconds: number; readonly extendMaxSeconds: number }
  /** 처치 시 공격 속도·이동 속도. 연달아 쓰러뜨리면 겹이 쌓인다. `values`는 **겹당** 증가율(%)이다. */
  | { readonly kind: "hasteOnKill"; readonly seconds: number; readonly maxStacks: number }
  /** 기본 공격 N번마다 표적의 현재 체력 비율만큼 추가 피해. `values`는 그 비율(%), 공격력 비례 상한이 있다. */
  | { readonly kind: "currentHpStrike"; readonly everyNAttacks: number; readonly attackCapPercent: number }
  /** 같은 적을 연속으로 때릴수록 피해 증가. 처치하면 겹의 절반이 다음 표적으로 이어진다. `values`는 겹당 증가율(%)이다. */
  | { readonly kind: "sameTargetStreak"; readonly maxStacks: number }
  /** 전투 시작 시 체력이 가장 낮은 아군에게 보호막. `values`는 그 아군 최대 체력 비율(%)이다. */
  | { readonly kind: "shieldLowestAllyOnBattleStart" }
  /** 체력이 기준 아래로 떨어진 순간 보호막과 가속. `values`는 보호막(%), `values2`는 공격 속도 증가율(%)이다. */
  | { readonly kind: "shieldAndHasteOnLowHp"; readonly belowHpPercent: number; readonly hasteSeconds: number }
  /** 체력이 기준 아래로 떨어진 순간 즉시 회복하고 같은 양을 더 나눠 회복. `values`는 최대 체력 비율(%)이다. */
  | { readonly kind: "healOverTimeOnLowHp"; readonly belowHpPercent: number; readonly overSeconds: number }
  /** 치명타에 자신에게 보호막. `values`는 최대 체력 비율(%)이다. */
  | { readonly kind: "shieldOnCritical"; readonly cooldownSeconds: number }
  /** 전투 시작 직후 처음 N번의 기본 공격은 반드시 치명타. `values`는 그 N이다. */
  | { readonly kind: "openingCrits" }
  /** 전투 시작 시 궁극기 게이지가 비용의 일부만큼 찬 채로 시작. `values`는 비율(%)이다. */
  | { readonly kind: "openingEnergy" }
  /** 처치 시 야성 게이지를 최대치의 일부만큼 채운다. `values`는 비율(%)이다. */
  | { readonly kind: "ferocityOnKill"; readonly cooldownSeconds: number }
  /** N회 공격마다 출혈. `values`는 그 N이며 **등급이 오를수록 작아진다**. */
  | { readonly kind: "bleedEveryNAttacks" }
  /** 궁극기를 쓰면 자신에게 가속. `values`는 공격 속도 증가율(%)이다. */
  | { readonly kind: "hasteOnUltimate"; readonly seconds: number }
  /** 궁극기를 쓰면 자신에게 보호막. `values`는 최대 체력 비율(%)이다. */
  | { readonly kind: "shieldOnUltimate"; readonly maxTimes: number }
  /** 처치 시 자신을 회복. `values`는 최대 체력 비율(%)이다. */
  | { readonly kind: "healOnKill"; readonly cooldownSeconds: number; readonly maxTimes: number }
  /** 전투 시작 시 아군 전원에게 가속. `values`는 공격 속도 증가율(%)이다. */
  | { readonly kind: "teamHasteOnBattleStart"; readonly seconds: number }
  /** 기본 공격이 적중하면 자신을 회복. `values`는 최대 체력 비율(%)이다. */
  | { readonly kind: "healOnBasicHit"; readonly cooldownSeconds: number; readonly maxTimes: number }
  /** 치명타가 터지면 맞은 적을 경직. `values`는 **재사용 대기(초)**이며 등급이 오를수록 짧아진다. */
  | { readonly kind: "staggerOnCritical"; readonly staggerSeconds: number }
  /** N회 공격마다 저주. `values`는 그 N이며 등급이 오를수록 작아진다. */
  | { readonly kind: "curseEveryNAttacks" }
  /** N번째 기본 공격마다 추가 피해. `values`는 증가율(%)이다. */
  | { readonly kind: "nthBasicBonus"; readonly everyN: number }
  /** 체력이 기준 이하인 적에게 주는 피해 증가. `values`는 증가율(%)이다. */
  | { readonly kind: "damageVsLowHp"; readonly belowHpPercent: number }
  /** 치명타 피해 증가. `values`는 증가율(%)이다. */
  | { readonly kind: "critDamage" }
  /** 보호막이 남아 있는 동안 주는 피해 증가. `values`는 증가율(%)이다. */
  | { readonly kind: "shieldedDamage" }
  /** 시간이 흐를수록 공격 속도가 겹으로 오른다. `values`는 겹당 증가율(%)이다. */
  | { readonly kind: "warmUp"; readonly everySeconds: number; readonly maxStacks: number }
  /** N번마다 반드시 치명타. 같은 룬이 더 있으면 N이 줄어든다. `values`는 룬 하나일 때의 N이다. */
  | { readonly kind: "periodicCrit"; readonly minEvery: number };

/**
 * 같은 특성이 한 렐릭에 여러 개 붙었을 때의 규칙이다. 모든 특성은 이 셋 중 하나이고, 설명문 맨 끝에
 * 고정 문장이 붙는다(`rune.trait.stack.*`).
 *
 * - `sum` — 수치가 합산된다(기본값). 개당 수치는 중첩 계수 0.8을 전제로 잡았다.
 * - `independent` — 룬마다 따로 발동한다. 쿨다운·횟수도 룬마다 따로 센다.
 * - `none` — 중첩되지 않는다. 가장 높은 등급 하나만 적용하고 나머지는 「중복 · 적용 안 됨」이다.
 */
export type RuneTraitStacking = "sum" | "independent" | "none";

/** 특성 한 종류의 정적 정의다. */
export interface RuneTraitDefinition {
  readonly id: string;
  readonly effect: RuneTraitEffectSpec;
  /** 등급별 수치다. 단위는 `effect`의 종류가 정한다. `minGrade` 아래 등급의 값은 나올 일이 없다. */
  readonly values: Readonly<Record<RuneTraitGrade, number>>;
  /** 두 번째 수치(보호막 + 가속처럼 한 문장에 수치가 둘인 특성만)다. */
  readonly values2?: Readonly<Record<RuneTraitGrade, number>>;
  /** 이 등급 이상에서만 풀에 든다. `legendary`면 전설 전용이다. */
  readonly minGrade: RuneTraitGrade;
  readonly stacking: RuneTraitStacking;
  /** 합산 결과의 상한이다. 문장에 「합계 최대」로 적히는 특성만 갖는다. */
  readonly sumCap?: number;
}

/** 동급 4칸 값을 한 줄로 적는 도우미다. */
const v = (uncommon: number, rare: number, epic: number, legendary: number): Readonly<Record<RuneTraitGrade, number>> => ({ uncommon, rare, epic, legendary });

/**
 * 룬 특성 스물다섯 종.
 *
 * **「받는 피해 감소」는 만들지 않는다.** 최종 피해에 곱하는 감쇠는 무엇으로 때리든 똑같이
 * 들어 뚫을 방법이 없고, 화면에 서 있지 않아 왜 안 죽는지를 말해 주지 못한다. 버티기는 **보호막**과
 * **회복**으로 짠다 — 얼마나 남았는지 게이지가 말한다.
 *
 * **순수 능력치 가산(공격력·체력·방어·저항·공속·흡혈 %)은 만들지 않는다.** 룬 옵션과 겹쳐 「공격력
 * 특성이 셋」이 되어 버린다. 수치가 들어가려면 시점·조건·대상 중 하나가 효과의 정체여야 한다.
 *
 * ## 검수 장부
 *
 * 개당 수치는 **중첩 계수 0.8**(한 칸의 값을 1로 볼 때 세 칸이 약 2.4)을 전제로 잡았다. 직선으로
 * 세 배가 되면 한 계열을 몰아 끼우는 것이 정답이 되어 서로 다른 칸의 시너지가 죽는다.
 *
 * - **합산형의 상시 수치는 상한을 문장에 적는다**(예열 60%, 치명 증폭 30%). 몰아 끼워도 닿지 못하는 선이다.
 * - **한 판 한 번 계열(최후의 저항·응급 처치)은 독립 발동**이다 — 룬 셋이면 터지는 순간이 셋일 뿐 한 번의 크기는
 *   그대로다. 생존 계열 세 칸을 모두 채워도 한 판의 보호막과 회복 합계가 최대 체력의 약 45% 안이다.
 * - **팀 전체 효과(고무)와 상태 갱신형(출혈 연구·주술 씨앗·묵직한 한 방)은 중첩되지 않는다.**
 * - **처치 계열(추격·야성 점화·전리품 회수)은 횟수와 겹에 상한이 있다.** 잡졸 물량전에서 맛이 나고 정예 1대1에서는
 *   약한 것이 의도다.
 * - **포식은 현재 체력 비례라 공격력 120% 안에서 막고**, 보스·불사 자리는 비율 피해 저항(`percentHpDamage`와 같은 표)을 받는다.
 */
export const RUNE_TRAIT_DEFS: readonly RuneTraitDefinition[] = [
  // ── 기존 열두 종(ID 유지, 효과 개편) ──
  { id: "vanguard", minGrade: "uncommon", stacking: "sum", effect: { kind: "hasteOnBattleStart", seconds: 6, extendSeconds: 2, extendMaxSeconds: 6 }, values: v(6, 8, 11, 15) },
  { id: "pursuit", minGrade: "uncommon", stacking: "sum", effect: { kind: "hasteOnKill", seconds: 4, maxStacks: 3 }, values: v(1.5, 2, 2.5, 3.5) },
  { id: "predation", minGrade: "uncommon", stacking: "sum", effect: { kind: "currentHpStrike", everyNAttacks: 4, attackCapPercent: 120 }, values: v(1.5, 2.2, 3, 4.5) },
  { id: "tenacity", minGrade: "uncommon", stacking: "sum", effect: { kind: "sameTargetStreak", maxStacks: 5 }, values: v(0.4, 0.6, 0.9, 1.3) },
  { id: "guardian", minGrade: "uncommon", stacking: "sum", effect: { kind: "shieldLowestAllyOnBattleStart" }, values: v(3, 4.5, 6, 8.5) },
  { id: "lastStand", minGrade: "uncommon", stacking: "independent", effect: { kind: "shieldAndHasteOnLowHp", belowHpPercent: 35, hasteSeconds: 4 }, values: v(5, 7, 9, 12), values2: v(6, 8, 10, 14) },
  { id: "firstAid", minGrade: "uncommon", stacking: "independent", effect: { kind: "healOverTimeOnLowHp", belowHpPercent: 35, overSeconds: 5 }, values: v(2.5, 3.5, 5, 7) },
  { id: "focusStudy", minGrade: "uncommon", stacking: "sum", effect: { kind: "openingCrits" }, values: v(1, 1, 1, 2) },
  { id: "awakening", minGrade: "uncommon", stacking: "sum", sumCap: 60, effect: { kind: "openingEnergy" }, values: v(8, 12, 16, 22) },
  { id: "resonance", minGrade: "uncommon", stacking: "sum", effect: { kind: "ferocityOnKill", cooldownSeconds: 1 }, values: v(1.5, 2, 3, 4.5) },
  { id: "hemorrhage", minGrade: "uncommon", stacking: "none", effect: { kind: "bleedEveryNAttacks" }, values: v(7, 6, 5, 4) },
  { id: "riposte", minGrade: "uncommon", stacking: "independent", effect: { kind: "shieldOnCritical", cooldownSeconds: 6 }, values: v(1.5, 2, 2.5, 3.5) },
  // ── 신규 공통 열 종 ──
  { id: "afterglow", minGrade: "uncommon", stacking: "sum", effect: { kind: "hasteOnUltimate", seconds: 5 }, values: v(6, 8, 11, 15) },
  { id: "bulwarkCry", minGrade: "uncommon", stacking: "independent", effect: { kind: "shieldOnUltimate", maxTimes: 2 }, values: v(3, 4.5, 6, 8) },
  { id: "spoils", minGrade: "uncommon", stacking: "independent", effect: { kind: "healOnKill", cooldownSeconds: 1, maxTimes: 5 }, values: v(1.2, 1.8, 2.4, 3.2) },
  { id: "warCry", minGrade: "uncommon", stacking: "none", effect: { kind: "teamHasteOnBattleStart", seconds: 5 }, values: v(4, 6, 8, 11) },
  { id: "steadyBreath", minGrade: "uncommon", stacking: "independent", effect: { kind: "healOnBasicHit", cooldownSeconds: 8, maxTimes: 3 }, values: v(1.2, 1.6, 2, 2.8) },
  { id: "heavyBlow", minGrade: "uncommon", stacking: "none", effect: { kind: "staggerOnCritical", staggerSeconds: 0.1 }, values: v(6, 5, 4, 3) },
  { id: "curseSeed", minGrade: "uncommon", stacking: "none", effect: { kind: "curseEveryNAttacks" }, values: v(8, 6, 5, 4) },
  { id: "rhythm", minGrade: "uncommon", stacking: "sum", effect: { kind: "nthBasicBonus", everyN: 3 }, values: v(7, 10, 14, 20) },
  { id: "executioner", minGrade: "uncommon", stacking: "sum", effect: { kind: "damageVsLowHp", belowHpPercent: 30 }, values: v(1.5, 2.5, 3.5, 5) },
  { id: "deepWound", minGrade: "uncommon", stacking: "sum", sumCap: 30, effect: { kind: "critDamage" }, values: v(5, 7, 10, 14) },
  // ── 영웅 이상 ──
  { id: "overflow", minGrade: "epic", stacking: "sum", effect: { kind: "shieldedDamage" }, values: v(3.5, 3.5, 3.5, 5) },
  { id: "warmUp", minGrade: "epic", stacking: "sum", effect: { kind: "warmUp", everySeconds: 5, maxStacks: 4 }, values: v(1.5, 1.5, 1.5, 2.2) },
  // ── 전설 전용 ──
  { id: "perfectAim", minGrade: "legendary", stacking: "sum", effect: { kind: "periodicCrit", minEvery: 5 }, values: v(7, 7, 7, 7) },
];

/**
 * 전설 등급이 굴러졌을 때 **전설 전용 풀을 먼저 시도하는** 확률이다. 한 상수로 두고 운영하며 조절한다.
 * 확정 상승은 특성 종류를 두고 등급만 올리므로 전설 전용은 직접 굴려야만 나온다.
 */
export const LEGENDARY_EXCLUSIVE_SHARE = 0.35;

/**
 * 특성 연구 아이템의 표다.
 *
 * **어느 아이템이 무엇을 하는지는 여기 한 곳에만 있다** — 화면이 아이템 ID로 분기하면
 * 아이템이 하나 늘 때마다 화면이 길어지고, 서버와 화면이 다른 규칙을 말하게 된다.
 */
export const RUNE_TRAIT_ITEMS = {
  /** 무작위 특성 하나. 이미 특성이 있으면 지우고 다시 부여한다. */
  grant: { itemId: "ancient-core", minimumGrade: "uncommon" },
  /** 영웅 이상 확정. 매우 드물게만 공급한다. 특성이 이미 영웅 이상이면 쓰지 않는다(`canGrantRuneTraitAtLeast`). */
  grantHigh: { itemId: "refined-core", minimumGrade: "epic" },
  /** 특성 종류는 두고 등급을 **전설로** 확정 상승. 이미 전설이면 쓸 수 없다. */
  upgrade: { itemId: "restoration-crystal" },
} as const;

/** 추첨과 저장 검증이 함께 읽는 특성 ID 목록이다. */
export const RUNE_TRAIT_IDS: readonly string[] = RUNE_TRAIT_DEFS.map(({ id }) => id);

/** 추첨이 읽는 풀 표다. 핵심 모듈이 데이터를 import하지 않도록 필요한 두 칸만 옮긴다. */
export const RUNE_TRAIT_POOL: readonly { readonly id: string; readonly minGrade: RuneTraitGrade }[] =
  RUNE_TRAIT_DEFS.map(({ id, minGrade }) => ({ id, minGrade }));

/** 외부 입력 ID는 반드시 정적 카탈로그를 통과한다. */
export function findRuneTrait(id: string): RuneTraitDefinition | undefined {
  return RUNE_TRAIT_DEFS.find((def) => def.id === id);
}

/** 특성의 현재 등급 수치다. 화면과 전투가 같은 값을 읽는다. */
export function runeTraitValue(id: string, grade: RuneTraitGrade): number {
  return findRuneTrait(id)?.values[grade] ?? 0;
}
