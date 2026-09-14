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
  /** 전투 시작 시 자신에게 일정 시간 공격 속도. `values`는 공격 속도 증가율(%)이다. */
  | { readonly kind: "hasteOnBattleStart"; readonly seconds: number }
  /** 처치 시 자신에게 일정 시간 공격 속도·이동 속도. `values`는 두 수치 공통 증가율(%)이다. */
  | { readonly kind: "hasteOnKill"; readonly seconds: number; readonly cooldownSeconds: number }
  /** 체력 비율이 기준 이상인 적에게 주는 피해 증가. `values`는 증가율(%)이다. */
  | { readonly kind: "damageVsHighHp"; readonly aboveHpPercent: number }
  /** 같은 적을 연속으로 때릴수록 피해 증가. `values`는 겹당 증가율(%)이다. */
  | { readonly kind: "sameTargetStreak"; readonly maxStacks: number }
  /** 전투 시작 시 체력이 가장 낮은 아군에게 보호막. `values`는 그 아군 최대 체력 비율(%)이다. */
  | { readonly kind: "shieldLowestAllyOnBattleStart" }
  /** 체력이 기준 아래로 떨어진 순간 자신에게 보호막. `values`는 최대 체력 비율(%)이다. */
  | { readonly kind: "shieldOnLowHp"; readonly belowHpPercent: number }
  /** 체력이 기준 아래로 떨어진 순간 자신을 회복. `values`는 최대 체력 비율(%)이다. */
  | { readonly kind: "healOnLowHp"; readonly belowHpPercent: number }
  /** 치명타에 자신에게 보호막. `values`는 최대 체력 비율(%)이다. */
  | { readonly kind: "shieldOnCritical"; readonly cooldownSeconds: number }
  /**
   * 상시 능력치 가산.
   *
   * 셋 다 이미 퍼센트로 세는 수치라 **덧셈**으로 붙인다 — 곱셈과 섞으면 같은 「+10」이
   * 능력치마다 다른 크기가 된다.
   */
  | { readonly kind: "flatStat"; readonly stat: "critChance" | "ferocityGain" | "energyGain" }
  /** N회 공격마다 출혈. `values`는 그 N이며 **등급이 오를수록 작아진다**. */
  | { readonly kind: "bleedEveryNAttacks" };

/** 특성 한 종류의 정적 정의다. */
export interface RuneTraitDefinition {
  readonly id: string;
  readonly effect: RuneTraitEffectSpec;
  /** 등급별 수치다. 단위는 `effect`의 종류가 정한다. */
  readonly values: Readonly<Record<RuneTraitGrade, number>>;
}

/**
 * MVP 열두 종.
 *
 * **「받는 피해 감소」는 만들지 않는다.** 최종 피해에 곱하는 감쇠는 무엇으로 때리든 똑같이
 * 들어 뚫을 방법이 없고, 화면에 서 있지 않아 왜 안 죽는지를 말해 주지 못한다. 기획 초안의
 * 「최후의 저항 — 받는 피해 감소」는 **보호막**으로 옮겼다 — 얼마나 남았는지 게이지가 말한다.
 *
 * ## 검수 장부
 *
 * 기준은 20초 남짓의 대표 전투다. 같은 등급의 특성들이 그 한 판에서 만들어 내는 몫이 서로
 * 두 배 넘게 벌어지지 않도록 잡았다.
 *
 * - **버티기(보호막·회복)는 공격 계열보다 수치가 크다.** 조건(저체력)이 붙어 한 판에 한 번만
 *   터지기 때문이다. 전설 22%는 대표 체력에서 한 대를 더 버티는 몫이다.
 * - **상시 가산(조준 연구·야성 공명·각성 촉진)은 조건이 없어 가장 낮다.** 치명타 확률은
 *   전 개체 공통값(`COMMON_SECONDARY_STATS`)에 얹히는 가산이라, 전설 10도 패시브 한 줄
 *   (렉시아 25)의 절반에 못 미친다.
 * - **포식은 명중마다 들어가지만 조건(적 체력 70% 이상)이 전투 초반에만 맞는다.** 그래서
 *   전설에서도 5%로, 같은 등급의 조준 연구와 기대값이 비슷해진다.
 * - **집념은 표적을 바꾸면 겹이 풀린다.** 최대 겹(5)까지 쌓는 데 시간이 들어 상한 10%가
 *   실제로는 한 판의 절반 아래에서만 유지된다.
 */
export const RUNE_TRAIT_DEFS: readonly RuneTraitDefinition[] = [
  { id: "vanguard", effect: { kind: "hasteOnBattleStart", seconds: 6 }, values: { uncommon: 10, rare: 15, epic: 20, legendary: 28 } },
  { id: "pursuit", effect: { kind: "hasteOnKill", seconds: 4, cooldownSeconds: 0 }, values: { uncommon: 8, rare: 12, epic: 16, legendary: 22 } },
  { id: "predation", effect: { kind: "damageVsHighHp", aboveHpPercent: 70 }, values: { uncommon: 1.5, rare: 2.5, epic: 3.5, legendary: 5 } },
  { id: "tenacity", effect: { kind: "sameTargetStreak", maxStacks: 5 }, values: { uncommon: 0.6, rare: 1, epic: 1.4, legendary: 2 } },
  { id: "guardian", effect: { kind: "shieldLowestAllyOnBattleStart" }, values: { uncommon: 4, rare: 6, epic: 8, legendary: 11 } },
  { id: "lastStand", effect: { kind: "shieldOnLowHp", belowHpPercent: 35 }, values: { uncommon: 8, rare: 12, epic: 16, legendary: 22 } },
  { id: "firstAid", effect: { kind: "healOnLowHp", belowHpPercent: 35 }, values: { uncommon: 6, rare: 9, epic: 12, legendary: 16 } },
  { id: "focusStudy", effect: { kind: "flatStat", stat: "critChance" }, values: { uncommon: 3, rare: 5, epic: 7, legendary: 10 } },
  { id: "awakening", effect: { kind: "flatStat", stat: "energyGain" }, values: { uncommon: 1, rare: 1.5, epic: 2, legendary: 3 } },
  { id: "resonance", effect: { kind: "flatStat", stat: "ferocityGain" }, values: { uncommon: 6, rare: 9, epic: 12, legendary: 17 } },
  { id: "hemorrhage", effect: { kind: "bleedEveryNAttacks" }, values: { uncommon: 8, rare: 6, epic: 5, legendary: 4 } },
  { id: "riposte", effect: { kind: "shieldOnCritical", cooldownSeconds: 6 }, values: { uncommon: 2, rare: 3, epic: 4, legendary: 5.5 } },
];

/**
 * 특성 연구 아이템의 표다.
 *
 * **어느 아이템이 무엇을 하는지는 여기 한 곳에만 있다** — 화면이 아이템 ID로 분기하면
 * 아이템이 하나 늘 때마다 화면이 길어지고, 서버와 화면이 다른 규칙을 말하게 된다.
 */
export const RUNE_TRAIT_ITEMS = {
  /** 무작위 특성 하나. 이미 특성이 있으면 지우고 다시 부여한다. */
  grant: { itemId: "ancient-core", minimumGrade: "uncommon" },
  /** 영웅 이상 확정. 매우 드물게만 공급한다. */
  grantHigh: { itemId: "refined-core", minimumGrade: "epic" },
  /** 등급만 한 단계 확정 상승. 전설에는 쓸 수 없다. */
  upgrade: { itemId: "restoration-crystal" },
} as const;

/** 추첨과 저장 검증이 함께 읽는 특성 ID 목록이다. */
export const RUNE_TRAIT_IDS: readonly string[] = RUNE_TRAIT_DEFS.map(({ id }) => id);

/** 외부 입력 ID는 반드시 정적 카탈로그를 통과한다. */
export function findRuneTrait(id: string): RuneTraitDefinition | undefined {
  return RUNE_TRAIT_DEFS.find((def) => def.id === id);
}

/** 특성의 현재 등급 수치다. 화면과 전투가 같은 값을 읽는다. */
export function runeTraitValue(id: string, grade: RuneTraitGrade): number {
  return findRuneTrait(id)?.values[grade] ?? 0;
}
