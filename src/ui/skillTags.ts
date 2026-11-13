import { findKeyword } from "../data/keywords";
import type { BasicAttack, CombatStatusEffect, EffectType, Passive, Skill, Ultimate } from "../core/types";
import { t, type TextKey } from "../i18n";
import { skillDamageKinds, type DamageKind } from "./damageKinds";
import type { SkillArtSlot } from "./skillArt";

/**
 * 스킬 이름 아래 **요약 칩 줄**의 규격.
 *
 * 예전에는 효과 분류·수치·대상·상태가 `물리 피해 · 피해량 138 · 적 한 명`처럼 한 문장으로 이어
 * 붙어, 기술마다 무엇이 먼저 서는지 갈리고 "광역인가·오래 가는가·무엇을 거는가"를 한눈에 가를 수
 * 없었다. 지금은 같은 다섯 갈래를 **늘 같은 순서**로 칩 하나씩 세운다:
 *
 *   1. 효과 종류 — 물리·마법·고정 피해 / 회복 / 강화. 얼굴과 다른 피해를 함께 내면(강화 패시브의 마법 반격,
 *      물리 평타가 거는 방어 무시 동상) 그 피해 종류가 바로 뒤에 한 칸씩 더 선다(`damageKinds.ts`).
 *   2. 범위 — 단일 · 주위 광역 · 적 전체 · 자신 · 아군 전체 …
 *   3. 시간 — 즉발 · 지속 N초 · 상시(패시브) · 폭주 중
 *   4. 거는 효과 — 제어(기절·도발…) · 약화(출혈·중독…) · 표식(관측…) · 보호막 · 버프
 *   5. 수치 — 피해량처럼 지금 능력치로 환산한 값
 *
 * **칩은 데이터에서만 나온다.** 개체 이름으로 분기하지 않고 전투가 읽는 계약(`targeting`·
 * `statusEffects`·`selfGuard`…)만 읽어, 새 개체가 늘어도 손댈 곳이 없다. 색과 그림은 갈래가
 * 아니라 **성질**(`SkillTagTone`)이 정한다 — 같은 기절은 어느 스킬에서나 같은 칩으로 선다.
 *
 * Phaser를 읽지 않는다 — 테스트가 모든 개체를 훑어 규격을 지킨다(`skillTags.test`).
 */
export type SkillTagTone =
  | "physical" | "magical" | "fixed" | "heal" | "buff"
  | "scope" | "timing"
  | "control" | "debuff" | "mark" | "shield"
  | "value";

export type SkillTagGlyph =
  | "contrib-attack" | "contrib-heal" | "contrib-defense"
  | "tag-buff" | "tag-target" | "tag-area" | "tag-ally" | "tag-self"
  | "tag-instant" | "tag-duration" | "tag-always"
  | "tag-control" | "tag-debuff" | "tag-mark" | "tag-value";

export interface SkillTag {
  tone: SkillTagTone;
  glyph: SkillTagGlyph;
  /** 칩에 서는 글. `[[id|표기]]`가 있으면 칩 전체가 그 용어의 뜻풀이를 연다. */
  text: string;
}

/** 칩의 갈래별 색. 어두운 판 위에서 서로 갈리고 수치(금빛)와 겹치지 않게 고른 값이다. */
export const SKILL_TAG_TONE: Readonly<Record<SkillTagTone, number>> = {
  physical: 0xff8f5a,
  magical: 0x8ea2ff,
  fixed: 0xe0a8ff,
  heal: 0x7fd98a,
  buff: 0xf5d547,
  scope: 0x8fd4ff,
  timing: 0xc4cad4,
  control: 0xff6f86,
  debuff: 0xb07ae0,
  mark: 0x5ccdc0,
  shield: 0x7fb4ec,
  value: 0xd8b978,
};

const EFFECT_TONE: Readonly<Record<EffectType, { tone: SkillTagTone; glyph: SkillTagGlyph }>> = {
  physical: { tone: "physical", glyph: "contrib-attack" },
  magical: { tone: "magical", glyph: "contrib-attack" },
  fixed: { tone: "fixed", glyph: "contrib-attack" },
  healing: { tone: "heal", glyph: "contrib-heal" },
  buff: { tone: "buff", glyph: "tag-buff" },
};

const DAMAGE_ORDER: readonly DamageKind[] = ["physical", "magical", "fixed"];

export type SkillScope = NonNullable<Ultimate["targeting"]>;

const SCOPE_GLYPH: Readonly<Record<SkillScope, SkillTagGlyph>> = {
  single: "tag-target",
  splitShot: "tag-area",
  nearbyEnemies: "tag-area",
  battlefieldEnemies: "tag-area",
  targetedCircle: "tag-area",
  chargeLine: "tag-area",
  battlefieldAllies: "tag-ally",
  duo: "tag-ally",
  self: "tag-self",
};

type StatusKind = CombatStatusEffect["kind"];

/**
 * 상태 효과의 갈래와 그 이름을 여는 규칙어. 이름은 규칙어 사전의 표기(언어별)를 그대로 쓴다 —
 * 칩이 이름을 따로 적으면 본문의 태그와 칩이 다른 낱말로 갈린다.
 */
const STATUS_TAG: Readonly<Record<StatusKind, { tone: "control" | "debuff" | "mark"; keyword?: string; seconds?: true }>> = {
  stun: { tone: "control", keyword: "stun", seconds: true },
  stagger: { tone: "control", keyword: "stagger" },
  knockback: { tone: "control", keyword: "knockback", seconds: true },
  taunt: { tone: "control", keyword: "taunt", seconds: true },
  fear: { tone: "control", keyword: "fear", seconds: true },
  frenzy: { tone: "control", keyword: "frenzy", seconds: true },
  drowsy: { tone: "control", keyword: "drowsy" },
  pressure: { tone: "control", keyword: "pressure" },
  intimidate: { tone: "control", keyword: "intimidation" },
  bleed: { tone: "debuff", keyword: "bleed", seconds: true },
  poison: { tone: "debuff", keyword: "poison", seconds: true },
  curse: { tone: "debuff", keyword: "curse", seconds: true },
  chill: { tone: "debuff", keyword: "chill" },
  butcher: { tone: "debuff", keyword: "butcher" },
  concussion: { tone: "debuff", keyword: "concussion" },
  frostPlume: { tone: "debuff" },
  observation: { tone: "mark", keyword: "observation" },
  weakpoint: { tone: "mark", keyword: "weakpoint" },
  vandalism: { tone: "mark", keyword: "vandalism" },
  overpaint: { tone: "mark", keyword: "overpaint" },
  echo: { tone: "mark", keyword: "echo" },
};

const STATUS_GLYPH: Readonly<Record<"control" | "debuff" | "mark", SkillTagGlyph>> = {
  control: "tag-control", debuff: "tag-debuff", mark: "tag-mark",
};

/** 상태 하나의 칩. 사전에 없는 상태도 빠지지 않도록 전용 문구로 되돌아간다. */
export function statusTag(effect: CombatStatusEffect): SkillTag {
  const spec = STATUS_TAG[effect.kind];
  // 처음부터 깊게 거는 출혈은 깊은 출혈 태그로 선다 — 수치는 그 태그가 말한다.
  if (effect.kind === "bleed" && effect.deep) {
    const deep = findKeyword("deep-bleed");
    if (deep) return { tone: spec.tone, glyph: STATUS_GLYPH[spec.tone], text: `[[${deep.id}|${deep.term}]]` };
  }
  const keyword = spec.keyword === undefined ? undefined : findKeyword(spec.keyword);
  // 서리깃만 전역 사전 밖(개체 전용 규칙어)이라 그 표기를 문구 표에서 읽는다.
  const name = keyword ? `[[${keyword.id}|${keyword.term}]]` : t("skill.keyword.plume.term");
  const seconds = spec.seconds && "seconds" in effect ? effect.seconds : undefined;
  return {
    tone: spec.tone,
    glyph: STATUS_GLYPH[spec.tone],
    text: seconds === undefined ? name : t("skill.tag.withSeconds", { name, seconds }),
  };
}

/** 피해 종류 하나의 칩 — 첫 칸 뒤에 덧붙는 갈래와 같은 모양이다. */
export function damageKindTag(kind: DamageKind): SkillTag {
  return { ...EFFECT_TONE[kind], text: t(`skill.effect.${kind}` as TextKey) };
}

export function keywordTag(id: string, tone: SkillTagTone, glyph: SkillTagGlyph, seconds?: number): SkillTag | undefined {
  const keyword = findKeyword(id);
  if (!keyword) return undefined;
  const name = `[[${keyword.id}|${keyword.term}]]`;
  return { tone, glyph, text: seconds === undefined ? name : t("skill.tag.withSeconds", { name, seconds }) };
}

/** 받는 회복을 깎는 상태인가 — 출혈의 회복 감소와 거듭 걸면 깊어지는 출혈. */
function allyHealTag(): SkillTag { return { tone: "heal", glyph: "contrib-heal", text: t("skill.tag.allyHeal") }; }
function cutsHealing(effect: CombatStatusEffect): boolean {
  return effect.kind === "bleed" && ((effect.healingReceivedReductionPercent ?? 0) > 0 || effect.deepenOnRepeat !== undefined || effect.deep === true);
}

/** 치유 감소 칩. 출처마다 수치가 달라 칩은 수를 갖지 않고, 얼마인지는 본문이 적는다. */
export function healingCutTag(): SkillTag | undefined {
  return keywordTag("healing-cut", "debuff", "tag-debuff");
}

/**
 * `statusEffects` 밖에 **제 이름의 필드**로 상태를 거는 계약. 패시브의 돌진 기절(`openingCharge`)·밀물
 * (`tidalSurge`)·최대 둔화 빙결(`freezeAtMaxChill`)·시약 반응의 중독, 평타의 호령(`rally`)·순환 걸음(`cycle`)·시약
 * (`reagentStacks`), 채널링 궁극기의 평타 상태(`channel.basicStatusEffects`)가 그렇다 — 목록만 읽으면 전투가 거는 상태가 칩에서 빠진다(`skillTagsCombat.test`).
 */
function contractTags(source: Skill | Passive | undefined): { tags: (SkillTag | undefined)[]; after: (SkillTag | undefined)[]; shield: boolean } {
  const tags: (SkillTag | undefined)[] = [];
  const after: (SkillTag | undefined)[] = [];
  let shield = false;
  if (source === undefined) return { tags, after, shield };
  if ("kind" in source) {
    if (source.openingCharge) tags.push(statusTag({ kind: "stun", seconds: source.openingCharge.stunSeconds }));
    if (source.tidalSurge) tags.push(statusTag({ kind: "knockback", ...source.tidalSurge.knockback }));
    if (source.coilSqueeze) tags.push(statusTag({ kind: "stun", seconds: source.coilSqueeze.stunSeconds }));
    if (source.freezeAtMaxChill) tags.push(keywordTag("frozen", "control", "tag-control"));
    if (source.undyingKnockback) tags.push(statusTag({ kind: "knockback", ...source.undyingKnockback }));
    // 시약이 가득 차 터지는 반응이 중독을 건다.
    if (source.reagentReaction) tags.push(keywordTag("poison", "debuff", "tag-debuff", source.reagentReaction.reactionPoisonSeconds));
    // 살아 있는 동안 상대 편 전체의 회복을 깎는 오라(도디).
    if ((source.enemyHealingReceivedReductionPercent ?? 0) > 0) tags.push(healingCutTag());
    // 백색소음(안카)은 주위 적에게 졸음을 쌓고 주위 아군을 채운다.
    if (source.whiteNoise) {
      tags.push(statusTag(source.whiteNoise.drowsy));
      after.push(allyHealTag());
    }
    // 가장 지친 아군을 채우는 반응(리파).
    if ((source.reagentReaction?.lowestHpAllyHealMaxHpPercent ?? 0) > 0) after.push(allyHealTag());
    // 패시브가 두르는 막 — 계약마다 이름이 달라 한곳에서 모은다.
    shield = source.lifeStealShield !== undefined || source.echoLocation !== undefined || source.segmentBarrier !== undefined
      || (source.shellGuard?.selfShieldMaxHpPercent ?? 0) > 0 || (source.shellGuard?.lowestHpAllyShieldMaxHpPercent ?? 0) > 0
      || (source.concussionShieldPercent ?? 0) > 0;
    // 패시브가 거는 은신 — 시작할 때 · 체력이 낮아질 때 · 피해를 줄 때.
    const stealth = source.openingStealthSeconds ?? source.lowHpStealth?.seconds ?? source.damageStealthSeconds;
    if (stealth !== undefined) after.push(keywordTag("stealth", "buff", "tag-buff", stealth));
    // 짝이 건강한 동안(슈테) · 늑대가 살아 있는 동안(디안) 숨는다 — 시간이 아니라 조건이 정한다.
    else if (source.duoLink !== undefined || source.kind === "summonCommander") after.push(keywordTag("stealth", "buff", "tag-buff"));
    return { tags, after, shield };
  }
  const basic = source as Partial<BasicAttack> & { reagentStacks?: number };
  if (basic.rally) {
    tags.push(statusTag({ kind: "taunt", seconds: basic.rally.tauntSeconds }));
    shield = true;
  }
  for (const step of basic.cycle ?? []) {
    for (const effect of step.statusEffects ?? []) tags.push(statusTag(effect));
    if ((step.statusEffects ?? []).some(cutsHealing)) tags.push(healingCutTag());
    if (step.pull) tags.push(keywordTag("pull", "control", "tag-control"));
    if (step.shieldFromDamagePercent !== undefined) shield = true;
    if (step.selfStealthSeconds !== undefined) after.push(keywordTag("stealth", "buff", "tag-buff", step.selfStealthSeconds));
  }
  if (basic.reagentStacks !== undefined) tags.push(keywordTag("reagent", "debuff", "tag-debuff"));
  // 반짝이 터질 때 두르는 막(티아) · 연발의 확정 치명타가 두르는 막(테쿠).
  if ((basic.shimmerBurst?.shieldMaxHpPercent ?? 0) > 0) shield = true;
  if ((("barrage" in source ? (source as { barrage?: { shieldFromCriticalPercent: number } }).barrage?.shieldFromCriticalPercent : undefined) ?? 0) > 0) shield = true;
  // 약점이 터질 때 짝을 채운다(슈테).
  if ([...(basic.statusEffects ?? []), ...(basic.cycle ?? []).flatMap((step) => step.statusEffects ?? [])]
    .some((effect) => effect.kind === "weakpoint" && (effect.duoHealPercent ?? 0) > 0)) after.push(allyHealTag());
  // 채널링 궁극기가 도는 동안 평타가 더 거는 상태(데이나의 기절)도 그 궁극기의 칩이다.
  for (const effect of (source as Partial<Ultimate>).channel?.basicStatusEffects ?? []) tags.push(statusTag(effect));
  return { tags, after, shield };
}

/** 칩을 짓는 데 필요한 것. 정보창의 쪽지 모델과 튜토리얼이 같은 입력을 넘긴다. */
export interface SkillTagInput {
  slot?: SkillArtSlot;
  /** 전투가 읽는 정의. 없으면(역할·폭주 쪽지) 아래 낱값만으로 짓는다. */
  source?: Skill | Passive;
  effectType: EffectType;
  targeting?: SkillScope;
  statusEffects?: readonly CombatStatusEffect[];
  durationSeconds?: number;
  recoveryPercent?: number;
  damageHealingPercent?: number;
  /** 지금 능력치로 환산한 수치 한 줄(`피해량 [[damage-value|138]]`). */
  valueLabel?: string;
  /**
   * 이 칸이 **늘려 주는 대상 수**(폭주 중 갈래가 하나 더 갈라지는 유티의 「깃날비」 등).
   * 범위 칩은 "여럿을 맞힌다"까지만 말하므로, 몇 명이 더 맞는지는 `대상 +N` 칩이 따로 말한다.
   */
  extraTargets?: number;
}

/** 정의가 인원으로 끊는 범위(갈래화살·가까운 N명)면 그 인원. 반경만 있는 광역은 인원이 없다. */
export function skillTargetCount(input: SkillTagInput, scope: SkillScope | undefined): number | undefined {
  if (scope !== "splitShot" && scope !== "nearbyEnemies") return undefined;
  const skill = input.source;
  if (skill === undefined || "kind" in skill) return undefined;
  const count = "maxTargets" in skill ? skill.maxTargets as number | undefined : undefined;
  return count !== undefined && count > 1 ? count : undefined;
}

/** 이 기술이 효과를 거는 자리. 정의가 말하지 않으면 계약의 모양에서 거꾸로 짚는다. */
export function skillScope(input: SkillTagInput): SkillScope | undefined {
  if (input.targeting !== undefined) return input.targeting;
  const skill = input.source;
  if (input.slot === "passive" || input.slot === "ferocity") return undefined;
  // 평타·궁극기는 계약을 몰라도 범위를 말한다 — 대상 계약이 없으면 한 명이다.
  if (skill === undefined) return input.slot === "basic" || input.slot === "ultimate" ? "single" : undefined;
  if ("kind" in skill) return undefined;
  if (skill.teamBuff !== undefined || skill.healing !== undefined) return "battlefieldAllies";
  if (skill.selfGuard !== undefined || skill.selfLullaby !== undefined || skill.selfRoar !== undefined
    || skill.selfSetup !== undefined || skill.selfBulwark !== undefined || skill.selfVolley !== undefined) return "self";
  return "single";
}

/** 효과가 머무는 시간. 계약마다 이름이 다른 지속 시간을 한 값으로 모은다. */
export function skillDuration(input: SkillTagInput): number | undefined {
  if (input.durationSeconds !== undefined) return input.durationSeconds;
  const skill = input.source;
  if (skill === undefined || "kind" in skill) return undefined;
  const ultimate = skill as Ultimate;
  return ultimate.channel?.seconds ?? skill.teamBuff?.seconds ?? skill.selfVolley?.seconds ?? skill.selfBulwark?.seconds;
}

/** 다섯 갈래를 정한 순서로 세운다. 같은 글은 한 번만 선다. */
export function buildSkillTags(input: SkillTagInput): SkillTag[] {
  const tags: (SkillTag | undefined)[] = [];
  const kind = EFFECT_TONE[input.effectType];
  tags.push({ ...kind, text: t(`skill.effect.${input.effectType}` as TextKey) });
  if (input.source !== undefined) {
    const kinds = skillDamageKinds(input.source);
    for (const damage of DAMAGE_ORDER) {
      if (damage !== input.effectType && kinds.has(damage)) tags.push(damageKindTag(damage));
    }
  }

  // 연발(테쿠)은 대상 계약이 한 명이어도 가까운 적부터 한 발씩 나눠 맞히므로 "다중"과 총 발 수로 말한다 —
  // "단일"이면 한 명에게 다 꽂는 것으로, 발 수가 없으면 모두에게 그만큼 꽂는 것으로 읽힌다.
  const barrage = input.source !== undefined && !("kind" in input.source) && "barrage" in input.source ? input.source.barrage : undefined;
  const scope = barrage !== undefined ? "splitShot" : skillScope(input);
  if (scope !== undefined) tags.push({ tone: "scope", glyph: SCOPE_GLYPH[scope], text: t(`skill.tag.scope.${scope}` as TextKey) });
  if (barrage !== undefined) tags.push({ tone: "scope", glyph: "tag-target", text: t("skill.tag.shots", { count: barrage.shots }) });
  // 몇 명을 맞히는지는 범위 칩 바로 뒤에 선다 — "다중"만으로는 둘인지 다섯인지 읽히지 않는다.
  const targetCount = skillTargetCount(input, scope);
  if (targetCount !== undefined) tags.push({ tone: "scope", glyph: "tag-target", text: t("skill.tag.targets", { count: targetCount }) });
  // 대상 수를 늘리는 칸(폭주 등)은 늘어나는 몫을 강화색으로 세운다 — 범위가 아니라 얹히는 효과다.
  if (input.extraTargets !== undefined && input.extraTargets > 0) {
    tags.push({ tone: "buff", glyph: "tag-area", text: t("skill.tag.extraTargets", { count: input.extraTargets }) });
  }

  if (input.slot === "passive") tags.push({ tone: "timing", glyph: "tag-always", text: t("skill.tag.timing.passive") });
  else if (input.slot === "ferocity") tags.push({ tone: "timing", glyph: "tag-duration", text: t("skill.tag.timing.ferocity") });
  else {
    const seconds = skillDuration(input);
    tags.push(seconds === undefined
      ? { tone: "timing", glyph: "tag-instant", text: t("skill.tag.timing.instant") }
      : { tone: "timing", glyph: "tag-duration", text: t("skill.tag.timing.duration", { seconds }) });
  }

  // 거는 효과: 상대에게 거는 것(제어·약화·표식) → 자신·아군이 얻는 것(보호막·은신·버프·회복).
  const skill = input.source && !("kind" in input.source) ? input.source : undefined;
  if (skill?.selfGuard && !skill.selfGuard.pullOnly) tags.push(statusTag({ kind: "taunt", seconds: skill.selfGuard.tauntSeconds }));
  if (skill?.selfLullaby) tags.push(statusTag({ kind: "taunt", seconds: skill.selfLullaby.tauntSeconds }));
  if (skill?.selfRoar) tags.push(statusTag(skill.selfRoar.fear));
  for (const effect of input.statusEffects ?? []) tags.push(statusTag(effect));
  // 회복을 깎는 출혈(받는 회복 감소·깊은 출혈)은 출혈 칩 옆에 치유 감소를 하나 더 세운다.
  if ((input.statusEffects ?? []).some(cutsHealing)) tags.push(healingCutTag());
  const contract = contractTags(input.source);
  tags.push(...contract.tags);
  if (skill?.selfGuard?.shockwave) tags.push(statusTag({ kind: "stun", seconds: skill.selfGuard.shockwave.stunSeconds }));

  const shield = (skill?.selfGuard !== undefined && !skill.selfGuard.pullOnly) || skill?.selfLullaby !== undefined
    || skill?.selfRoar !== undefined || (skill !== undefined && "selfShieldMaxHpPercent" in skill && skill.selfShieldMaxHpPercent !== undefined)
    || (skill !== undefined && "allyShieldFromDamagePercent" in skill && skill.allyShieldFromDamagePercent !== undefined)
    || contract.shield;
  if (shield) tags.push(keywordTag("shield", "shield", "contrib-defense"));
  if (skill?.selfSetup) tags.push(keywordTag("stealth", "buff", "tag-buff", skill.selfSetup.stealthSeconds));
  tags.push(...contract.after);
  if (skill?.teamBuff?.kind === "tailwind") tags.push(keywordTag("tailwind", "buff", "tag-buff"));
  if (skill?.teamBuff?.kind === "resonance") tags.push(keywordTag("resonance", "buff", "tag-buff"));
  if (skill?.selfBulwark) tags.push({ tone: "buff", glyph: "tag-buff", text: t("skill.tag.bulwark") });
  // 피해와 함께 범위 안 아군을 채우는 궁극기(도디)는 회복도 거는 효과로 말한다.
  if (skill !== undefined && "allyHealingPower" in skill && skill.allyHealingPower !== undefined) {
    tags.push({ tone: "heal", glyph: "contrib-heal", text: t("skill.tag.allyHeal") });
  }
  if (input.damageHealingPercent !== undefined) tags.push({ tone: "heal", glyph: "contrib-heal", text: t("skill.tag.lifesteal", { percent: input.damageHealingPercent }) });
  if (input.recoveryPercent !== undefined) tags.push({ tone: "heal", glyph: "contrib-heal", text: t("skill.tag.regen", { percent: input.recoveryPercent }) });

  if (input.valueLabel) tags.push({ tone: "value", glyph: "tag-value", text: input.valueLabel });

  const seen = new Set<string>();
  return tags.filter((tag): tag is SkillTag => {
    if (tag === undefined || seen.has(tag.text)) return false;
    seen.add(tag.text);
    return true;
  });
}

/** 정의 하나에서 바로 칩을 짓는다. 수치를 모르는 자리(튜토리얼)가 쓴다. */
export function skillTagsFromDef(skill: Skill | Passive, slot: SkillArtSlot, valueLabel?: string): SkillTag[] {
  return buildSkillTags({
    slot,
    source: skill,
    effectType: skill.effectType,
    targeting: "targeting" in skill ? skill.targeting as SkillScope | undefined : undefined,
    statusEffects: "statusEffects" in skill ? skill.statusEffects : undefined,
    durationSeconds: "durationSeconds" in skill ? skill.durationSeconds as number | undefined : undefined,
    recoveryPercent: "kind" in skill && skill.kind === "emergencyRecovery" && "value" in skill ? skill.value as number : undefined,
    damageHealingPercent: "damageHealingPercent" in skill ? skill.damageHealingPercent as number | undefined : undefined,
    valueLabel,
  });
}
