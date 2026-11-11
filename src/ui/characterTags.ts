import type { Passive, ReachTier, RelicDef, Role, Skill } from "../core/types";
import { t, type TextKey } from "../i18n";
import { skillTagsFromDef, type SkillTag } from "./skillTags";
import { REACH_TONE } from "./statTones";

/**
 * 정보창 이름 아래 **해시태그 한 줄** — 그 개체가 무엇을 하는 몸인지 한눈에 말한다.
 *
 * 속성·직군 뱃지는 그림 하나라, 처음 보는 손에게는 "멀리서 때리는가·여럿을 치는가·누구를 지키는가"가
 * 읽히지 않았다. 그래서 `#원거리 #범위공격 #딜러 #회복`처럼 **늘 같은 순서**로 낱말을 세운다:
 *
 *   1. 사거리 — 근거리 · 중거리 · 원거리 (`reachTier`)
 *   2. 맡은 몫 — 딜러 · 탱커 · 서포터 (`role`)
 *   3. 공격 범위 — 범위공격 · 단일공격 (평타·궁극기의 `targeting`)
 *   4. 특징 — 소환 · 회복 · 도발 · 보호막 · 군중제어 · 지속피해 · 은신 · 아군강화 중 앞의 둘
 *
 * **태그는 데이터에서만 나온다.** 개체 이름으로 분기하지 않고 스킬 요약 칩(`skillTagsFromDef`)이
 * 읽는 같은 계약을 읽으므로, 쪽지의 칩과 이름 아래 태그가 다른 말을 하지 않는다. 적·아군·소환수가
 * 같은 함수를 지난다. Phaser를 읽지 않는다(`characterTags.test`).
 */
export type CharacterTagKind =
  | "melee" | "mid" | "ranged"
  | "dealer" | "tank" | "support"
  | "area" | "single"
  | "summon" | "heal" | "taunt" | "shield" | "control" | "dot" | "stealth" | "teamBuff";

export interface CharacterTag {
  kind: CharacterTagKind;
  /** `#`과 낱말의 색. 사거리는 사거리 표와 같은 색이다. */
  tone: number;
  /** `#` 없이 낱말만. */
  text: string;
}

/** 특징 태그를 고르는 순서. 앞의 것이 그 개체를 더 잘 가른다(누구나 하는 피해보다 드문 일). */
export const CHARACTER_TRAIT_ORDER = ["summon", "heal", "taunt", "shield", "control", "dot", "stealth", "teamBuff"] as const;
export type CharacterTrait = (typeof CHARACTER_TRAIT_ORDER)[number];

/** 특징은 둘까지 — 셋이 넘으면 해시태그가 아니라 스킬 설명이 된다. */
export const CHARACTER_TRAIT_LIMIT = 2;

const DUTY: Readonly<Record<Role, "dealer" | "tank" | "support">> = {
  warrior: "dealer",
  assassin: "dealer",
  tank: "tank",
  support: "support",
};

export const CHARACTER_TAG_TONE: Readonly<Record<Exclude<CharacterTagKind, ReachTier>, number>> = {
  dealer: 0xff8f5a,
  tank: 0x7fb4ec,
  support: 0x7fd98a,
  area: 0x8fd4ff,
  single: 0xc4cad4,
  summon: 0xf5d547,
  heal: 0x7fd98a,
  taunt: 0xff6f86,
  shield: 0x7fb4ec,
  control: 0xff6f86,
  dot: 0xb07ae0,
  stealth: 0x9aa6b8,
  teamBuff: 0xf5d547,
};

const AREA_TARGETING = new Set(["nearbyEnemies", "splitShot", "battlefieldEnemies", "targetedCircle", "chargeLine"]);
const DOT_KEYWORDS = ["bleed", "poison", "curse"];

/** 피해를 주는 기술이 여럿을 치는가. 아군·자신에게만 거는 궁극기는 공격 범위로 세지 않는다. */
export function hitsArea(def: Pick<RelicDef, "basic" | "ultimate">): boolean {
  const basic = def.basic as { targeting?: string };
  if (basic.targeting !== undefined && AREA_TARGETING.has(basic.targeting)) return true;
  const ultimate = def.ultimate as { targeting?: string; effectType: string };
  return ultimate.effectType !== "healing" && ultimate.effectType !== "buff"
    && ultimate.targeting !== undefined && AREA_TARGETING.has(ultimate.targeting);
}

function keywordIn(tags: readonly SkillTag[], id: string): boolean {
  return tags.some((tag) => tag.text.includes(`[[${id}|`));
}

/** 이 개체가 가진 특징 전부. 순서는 `CHARACTER_TRAIT_ORDER`를 따른다. */
export function characterTraits(def: Pick<RelicDef, "basic" | "ultimate" | "passive" | "summons">): CharacterTrait[] {
  const skills: readonly (Skill | Passive)[] = [def.basic as Skill, def.ultimate as Skill, def.passive];
  const tags = [
    ...skillTagsFromDef(def.basic as Skill, "basic"),
    ...skillTagsFromDef(def.ultimate as Skill, "ultimate"),
    ...skillTagsFromDef(def.passive, "passive"),
  ];
  const has: Record<CharacterTrait, boolean> = {
    summon: (def.summons?.length ?? 0) > 0,
    heal: skills.some((skill) => {
      const raw = skill as { effectType: string; healing?: unknown; allyHealingPower?: number; teamBuff?: { maxHpRegenPercentPerSecond?: number } };
      return raw.effectType === "healing" || raw.healing !== undefined || raw.allyHealingPower !== undefined
        || raw.teamBuff?.maxHpRegenPercentPerSecond !== undefined;
    }),
    taunt: keywordIn(tags, "taunt"),
    shield: tags.some((tag) => tag.tone === "shield"),
    control: tags.some((tag) => tag.tone === "control" && !tag.text.includes("[[taunt|")),
    dot: DOT_KEYWORDS.some((id) => keywordIn(tags, id)),
    stealth: keywordIn(tags, "stealth"),
    teamBuff: skills.some((skill) => (skill as { teamBuff?: unknown }).teamBuff !== undefined),
  };
  return CHARACTER_TRAIT_ORDER.filter((trait) => has[trait]);
}

/** 정보창 이름 아래 해시태그 줄. 화면은 넘치는 뒤쪽 태그만 걷는다. */
export function characterTags(def: Pick<RelicDef, "reachTier" | "role" | "basic" | "ultimate" | "passive" | "summons">): CharacterTag[] {
  const duty = DUTY[def.role];
  const scope = hitsArea(def) ? "area" : "single";
  const tags: CharacterTag[] = [
    { kind: def.reachTier, tone: REACH_TONE[def.reachTier], text: t(`info.tag.${def.reachTier}` as TextKey) },
    { kind: duty, tone: CHARACTER_TAG_TONE[duty], text: t(`info.tag.${duty}` as TextKey) },
    { kind: scope, tone: CHARACTER_TAG_TONE[scope], text: t(`info.tag.${scope}` as TextKey) },
  ];
  for (const trait of characterTraits(def).slice(0, CHARACTER_TRAIT_LIMIT)) {
    tags.push({ kind: trait, tone: CHARACTER_TAG_TONE[trait], text: t(`info.tag.${trait}` as TextKey) });
  }
  return tags;
}
