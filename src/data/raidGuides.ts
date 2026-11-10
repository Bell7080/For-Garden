import { ELEMENT_COUNTERS } from "../core/element";
import type { CombatStatusEffect, Element, RelicDef } from "../core/types";
import { RAID_BOSS_POOL } from "./raid";

/**
 * 레이드 보스 공략법 — 판 화면의 「공략법!」 버튼이 여는 창의 **내용 계약**이다.
 *
 * 공략은 실제로 쓸모가 있어야 한다. 그래서 문장 안의 수(몇 번째 타격, 기절 몇 초, 반경)는 손으로
 * 적지 않고 **보스 정의에서 읽어** 채운다(`values`) — 스킬을 고친 뒤 공략 문장만 옛 수로 남으면
 * 공략이 거짓말을 한다. 속성 상성도 표(`ELEMENT_COUNTERS`)에서 거꾸로 구한다.
 *
 * 문장 자체는 문구 표(`raid.guide.<보스>.*`)가 갖고, 이 파일은 **어느 칸을 말하나 · 무엇으로 채우나 ·
 * 누구를 추천하나**만 고른다.
 */
export type RaidBossId = (typeof RAID_BOSS_POOL)[number];

export type RaidGuideSlot = "passive" | "basic" | "ultimate" | "ferocity";

export interface RaidGuidePattern {
  /** 이 패턴을 내는 스킬 칸. 창은 그 칸의 일러스트와 이름을 함께 세운다. */
  slot: RaidGuideSlot;
  /** 문구의 `{자리}`를 채울 값 — 보스 정의에서 읽는다. */
  values: (def: RelicDef) => Record<string, string | number>;
}

export interface RaidGuide {
  bossId: RaidBossId;
  /** 패턴과 대처, 위험한 순서대로 셋. */
  patterns: readonly RaidGuidePattern[];
  /** 추천 렐릭 하나 — 이유는 `raid.guide.<보스>.reason`이 말한다. 플레이어블이어야 한다. */
  recommendedRelicId: string;
}

const trim = (value: number): string => String(Number(value.toFixed(2)));

function statusOf<K extends CombatStatusEffect["kind"]>(skill: { statusEffects?: readonly CombatStatusEffect[] }, kind: K): Extract<CombatStatusEffect, { kind: K }> | undefined {
  return skill.statusEffects?.find((effect): effect is Extract<CombatStatusEffect, { kind: K }> => effect.kind === kind);
}

const stunSeconds = (skill: { statusEffects?: readonly CombatStatusEffect[] }): string => trim(statusOf(skill, "stun")?.seconds ?? 0);

export const RAID_GUIDES: Readonly<Record<RaidBossId, RaidGuide>> = {
  /*
   * 수쿠스이노 — 느리고 무거운 턱. 맞는 횟수는 적고 한 번이 크다. 네 번째 턱의 출혈이 회복을 깎으니
   * 회복보다 **막으로 받는 앞줄**과, 그 느린 간격을 더 벌리는 **둔화**가 답이다.
   */
  sukusuino: {
    bossId: "sukusuino",
    patterns: [
      { slot: "basic", values: (def) => ({ every: def.basic.statusEffectEvery ?? 4, percent: statusOf(def.basic, "bleed")?.healingReceivedReductionPercent ?? 0 }) },
      { slot: "ultimate", values: (def) => ({ seconds: stunSeconds(def.ultimate) }) },
      { slot: "ferocity", values: (def) => ({ radius: def.ferocityTrait.effectId === "splashDamage" ? def.ferocityTrait.radius : 0 }) },
    ],
    recommendedRelicId: "maddy",
  },
  /*
   * 타보아 — 감은 채로 때릴수록 빨라진다. 공속을 깎는 수압·둔화가 그 오르막을 되돌리고, 후열은 몸에서
   * 떨어져 서야 포옹을 피한다. 폭주 순간의 끌어당김 뒤가 가장 위험하다.
   */
  taboa: {
    bossId: "taboa",
    patterns: [
      { slot: "passive", values: (def) => ({ percent: def.passive.value, max: def.passive.maxStacks ?? 0 }) },
      { slot: "ultimate", values: (def) => ({ seconds: stunSeconds(def.ultimate) }) },
      { slot: "ferocity", values: () => ({}) },
    ],
    recommendedRelicId: "mosana",
  },
  /*
   * 코아틀 — 첫 순간과 한 줄. 열리자마자 급강하로 묶고, 궁극기는 통로 하나를 뚫는다. 첫 표적을 단단한
   * 앞줄이 맡고 같은 줄에 나란히 서지 않으면 절반은 비켜 간다. 방어가 셋 중 가장 얇다.
   */
  quetzalcoatlus: {
    bossId: "quetzalcoatlus",
    patterns: [
      { slot: "passive", values: (def) => ({ seconds: trim(def.passive.openingCharge?.stunSeconds ?? 0) }) },
      { slot: "basic", values: (def) => ({ every: def.basic.statusEffectEvery ?? 3 }) },
      { slot: "ultimate", values: (def) => ({ seconds: stunSeconds(def.ultimate) }) },
    ],
    recommendedRelicId: "pachi",
  },
};

export function isRaidBossId(value: string): value is RaidBossId {
  return (RAID_BOSS_POOL as readonly string[]).includes(value);
}

export function raidGuide(bossId: string): RaidGuide | undefined {
  return isRaidBossId(bossId) ? RAID_GUIDES[bossId] : undefined;
}

/**
 * 보스 속성을 상대로 **유리한 속성**(더 아프게 때리고 덜 아프게 맞는다)과 **불리한 속성**.
 *
 * 상성은 왕복 값이 역수라(`elementMultiplier`) 때리는 쪽에서 유리한 속성이 맞는 쪽에서도 유리하다 —
 * 한 줄로 두 가지를 함께 말할 수 있는 이유다.
 */
export function raidGuideElements(bossElement: Element): { strong: Element[]; weak: Element[] } {
  const strong = (Object.keys(ELEMENT_COUNTERS) as Element[]).filter((element) => ELEMENT_COUNTERS[element].includes(bossElement));
  return { strong, weak: [...ELEMENT_COUNTERS[bossElement]] };
}
