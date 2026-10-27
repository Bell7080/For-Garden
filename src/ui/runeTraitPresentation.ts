/**
 * 룬 특성의 표시 문구를 만드는 유일한 경계다.
 *
 * **화면이 문장을 들고 있지 않는다** — 화면은 어느 특성인가만 고르고, 실제 글자는 문구 표가
 * 갖고, 그 안의 수치는 정적 정의에서 채워진다. 수치를 고치면 열두 종의 문장이 함께 움직인다.
 */

import { t, type TextKey } from "../i18n";
import { runeRarityLabel } from "../core/runes";
import type { RuneTrait } from "../core/runeTraits";
import { findRuneTrait, runeTraitValue, type RuneTraitEffectSpec } from "../data/runeTraits";

/** 쪽지 한 줄이 쓰는 표시 모델이다. */
export interface RuneTraitView {
  /** 특성 이름이다. */
  name: string;
  /** 등급 표기다. 룬 희귀도와 같은 표를 읽는다. */
  gradeLabel: string;
  /** 규칙어 태그(`[[id|표기]]`)를 그대로 담은 본문이다. 그리는 일은 `KeywordManager`가 한다. */
  description: string;
}

/** 특성 이름이다. 이름만 필요한 자리(목록·후보 비교)가 본문까지 만들지 않게 갈라 둔다. */
export function runeTraitName(traitId: string): string {
  // ID는 정적 카탈로그를 지나 저장에 들어오므로(`assertValidRuneTrait`) 이 키는 반드시
  // 문구 표에 있다. 열두 종의 키를 손으로 늘어놓으면 특성이 늘 때마다 두 곳을 고쳐야 한다.
  return t(`rune.trait.${traitId}.name` as TextKey);
}

/** 풀 자격 표기다. 모든 등급에서 나오는 특성에는 없다. */
export function runeTraitPoolLabel(traitId: string): string | undefined {
  const def = findRuneTrait(traitId);
  if (def === undefined || def.minGrade === "uncommon" || def.minGrade === "rare") return undefined;
  return t(def.minGrade === "legendary" ? "rune.trait.pool.legendary" : "rune.trait.pool.epic");
}

/** 효과 정의가 가진 자리 표시 값들을 문구 자리로 옮긴다. 종류가 가진 것만 채운다. */
function effectParams(effect: RuneTraitEffectSpec): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  const raw = effect as unknown as Record<string, unknown>;
  const num = (key: string): number | undefined => typeof raw[key] === "number" ? raw[key] as number : undefined;
  const set = (name: string, ...keys: string[]): void => {
    for (const key of keys) { const value = num(key); if (value !== undefined) { params[name] = value; return; } }
  };
  set("seconds", "seconds", "hasteSeconds", "overSeconds");
  set("threshold", "aboveHpPercent", "belowHpPercent");
  set("stacks", "maxStacks");
  set("cooldown", "cooldownSeconds");
  set("extend", "extendSeconds");
  set("extendMax", "extendMaxSeconds");
  set("times", "maxTimes");
  set("n", "everyNAttacks", "everyN");
  set("cap", "attackCapPercent");
  set("min", "minEvery");
  return params;
}

/**
 * 특성 한 줄의 표시 모델이다.
 *
 * 자리 표시는 **효과의 종류가 정한다** — `{value}`는 늘 그 등급의 수치이고, 나머지는 그 종류가 실제로
 * 가진 것만 채운다. 본문 끝에는 **중첩 방식 고정 문장**이 한 줄 붙어 룬을 열면 바로 읽힌다.
 */
export function runeTraitView(trait: RuneTrait): RuneTraitView {
  const def = findRuneTrait(trait.id);
  const value = runeTraitValue(trait.id, trait.grade);
  const params: Record<string, string | number> = { value };
  if (def !== undefined) {
    Object.assign(params, effectParams(def.effect));
    if (def.values2 !== undefined) params.value2 = def.values2[trait.grade];
    // 합산 상한은 효과가 따로 갖지 않는 특성(예열·치명 증폭)의 「합계 최대」 문장이 읽는다.
    if (def.sumCap !== undefined) params.cap = def.sumCap;
  }
  const stacking = def === undefined ? "sum" : def.stacking;
  const description = `${t(`rune.trait.${trait.id}.desc` as TextKey, params)} ${t(`rune.trait.stack.${stacking}` as TextKey)}`;
  return {
    name: runeTraitName(trait.id),
    gradeLabel: runeRarityLabel(trait.grade),
    description,
  };
}
