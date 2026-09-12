import type { DamagePreview } from "../core/damage";
import type { KeywordDef } from "../data/keywords";
import type { KeywordTextOptions } from "../managers/KeywordManager";
import type { BreakthroughSlot } from "../core/relicProgression";
import type { BasicAttack, BasicAttackStep, CombatStatusEffect, FerocityTrait, Passive, RelicDef, Skill, Stats, Ultimate } from "../core/types";
import type { ScalingStatId } from "../core/damage";
import { t } from "../i18n";

/** 능력치 이름은 스킬 본문·태그·돌파 줄이 모두 같은 표에서 고른다. */
function statName(stat: ScalingStatId | "res"): string {
  return t(`skill.stat.${stat}`);
}

/**
 * 순수 회복형 궁극기(메테 등)는 damageType/power가 없어 피해 미리보기를 만들 수 없다.
 *
 * 패시브도 항상 제외한다 — 별도 정형 계산을 쓰지 않고 구조화 필드에서 문장을 만든다.
 * 이 판별 없이 회복형 스킬에 미리보기를 시도하면 damage.ts의 `previewSkillDamage`가
 * 던지는 예외로 정보창 스킬 팝업이 그대로 열리지 않는다(메테 궁극기 팝업 버그).
 */
export function canPreviewSkillDamage(skill: Skill | Passive): boolean {
  // 화면에 뜨는 종류 이름이 아니라 **정의의 모양**으로 가른다 — 이름으로 가르면 언어를 바꾸는
  // 순간 패시브가 공격 스킬로 읽혀 미리보기 경계가 예외를 던진다.
  return !("kind" in skill) && "damageType" in skill && skill.damageType !== undefined;
}

/** 전투 좌표 수치 대신 플레이어가 전장에서 찾을 수 있는 대상 범위를 말한다. */
export function targetingLabel(targeting?: Ultimate["targeting"]): string | undefined {
  if (targeting === undefined) return undefined;
  return t(`skill.target.${targeting}`);
}

/** 상태 효과 계약을 팝업과 테스트가 함께 쓰는 짧은 문구로 바꾼다. */
export function statusEffectLabel(effect?: CombatStatusEffect): string | undefined {
  if (effect?.kind === "stun") return t("skill.statusLabel.stun", { seconds: effect.seconds });
  // 경직은 항상 0.1초인 용어 규칙을 키워드 설명이 담당하므로 요약줄에서 시간을 중복하지 않는다.
  if (effect?.kind === "stagger") return t("skill.statusLabel.stagger");
  if (effect?.kind === "bleed") return t("skill.statusLabel.bleed", { seconds: effect.seconds, percent: effect.maxHpPercentPerSecond });
  if (effect?.kind === "poison") return t("skill.statusLabel.poison", { seconds: effect.seconds });
  // 시간이 아니라 듀오의 다음 한 방으로 풀리는 표식이라 초를 적지 않는다.
  if (effect?.kind === "weakpoint") return t("skill.statusLabel.weakpoint");
  // 시간으로 사라지지 않으므로 요약줄에도 초를 적지 않는다. 겹 상한은 태그가 말한다.
  if (effect?.kind === "vandalism") return t("skill.statusLabel.vandalism");
  if (effect?.kind === "taunt") return t("skill.statusLabel.taunt", { seconds: effect.seconds });
  return undefined;
}

/** 지속 회복 수치는 특정 캐릭터를 사전에 하드코딩하지 않고 현재 정의에서 만든다. */
export function recoveryLabel(percent?: number): string | undefined {
  return percent === undefined ? undefined : t("skill.label.recovery", { percent });
}

/** 어느 캐릭터나 같은 양식으로 피해 수치의 능력치 출처와 적용 배율을 열어 볼 수 있게 한다. */
export function damageKeyword(preview?: DamagePreview): KeywordDef | undefined {
  if (preview?.kind !== "scaling") return undefined;
  // 두 능력치가 위력을 나눠 갖는 스킬은 두 축을 함께 말한다. 한쪽만 말하면 실제 수치의
  // 절반이 어디서 왔는지 설명되지 않는다.
  const description = preview.secondary === undefined
    ? t("skill.keyword.damage.single", { stat: statName(preview.stat), percent: preview.power })
    : t("skill.keyword.damage.dual", {
      stat: statName(preview.stat), percent: preview.power,
      secondStat: statName(preview.secondary.stat), secondPercent: preview.secondary.power,
    });
  return { id: "damage-value", term: String(preview.amount), kind: "rule", description };
}

/**
 * 이름을 가진 주기 스택(토리카의 「세 개의 뿔」)의 태그 정의.
 *
 * 본문은 "한 겹 쌓는다"까지만 말하고, 몇 타마다 터지는지·무엇이 얹히는지는 눌러서 읽는다.
 * 문장을 손으로 적지 않고 실제 전투가 읽는 필드에서 지으므로, 주기나 수치를 조정하면 태그
 * 본문도 함께 바뀐다.
 *
 * **태그 본문에는 또 다른 태그를 두지 않는다** — 태그 팝업이 여는 설명은 화면의 임시 사전을
 * 물려받지 못해, 그 안의 동적 태그는 눌러도 아무것도 열리지 않는다. 덧칠·손질처럼 낱말만 적는다.
 */
export function periodicStackKeyword(skill: DescribedSkill): KeywordDef | undefined {
  if (!("statusEffectStackName" in skill)) return undefined;
  const name = skill.statusEffectStackName;
  const every = skill.statusEffectEvery;
  if (name === undefined || every === undefined) return undefined;
  const parts: string[] = [];
  const bonus = skill.periodicBonusScaling;
  if (bonus !== undefined) {
    parts.push(t("skill.stack.bonus", { stat: statName(bonus.stat), percent: bonus.power }));
  }
  for (const effect of skill.statusEffects ?? []) {
    const text = statusEffectClause(effect);
    if (text !== undefined) parts.push(withoutKeywordTags(text));
  }
  return {
    id: `${skill.id}-stack`,
    term: name,
    kind: "rule",
    description: t("skill.stack.description", { every, effects: parts.join(" ") }),
  };
}

/** 태그를 벗겨 낱말만 남긴다. 태그 팝업 안에서는 중첩 태그가 열리지 않기 때문이다. */
function withoutKeywordTags(text: string): string {
  return text.replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1");
}

/**
 * 마무리 한 절.
 *
 * 문턱이 겹으로 자라므로 고정 문장을 적을 수 없다 — 지금 값과 겹당 증가를 함께 말한다.
 */
function finisherClause(finisher: BasicAttack["finisher"]): string {
  if (finisher === undefined) return "";
  const bite = t("skill.finisher.bite", { percent: finisher.remainingHpPercent });
  // 문턱이 100이면 조건 자체가 없다. "100% 이하"라고 적으면 없는 조건을 찾게 만든다.
  if (finisher.thresholdPercent >= 100) return ` ${t("skill.finisher.always", { bite })}`;
  // 문턱이 자라는 것은 주어가 바뀌는 절이라 제 문장으로 세운다.
  const grows = finisher.thresholdPerStack > 0
    ? ` ${t("skill.finisher.grows", { percent: finisher.thresholdPerStack })}`
    : "";
  return ` ${t("skill.finisher.threshold", { percent: finisher.thresholdPercent, bite })}${grows}`;
}

/** 요약과 본문이 같은 동적 키워드 사전을 쓰도록 순수 레이아웃 옵션을 한 경계에서 결합한다. */
export function skillKeywordLayoutOptions(
  skill: { contextualKeywords?: readonly KeywordDef[]; keywordActions?: Readonly<Record<string, () => void>> },
  options: Omit<KeywordTextOptions, "contextualKeywords" | "keywordActions">,
): KeywordTextOptions {
  return { ...options, contextualKeywords: skill.contextualKeywords, keywordActions: skill.keywordActions };
}

/**
 * 폭주가 함께 올리는 치명타 확률과 흡혈 한 절.
 *
 * **같은 값이면 한 번만 말한다** — "각각 25%, 25%"는 두 수를 읽게 해 놓고 결국 같은 수다.
 * 값이 서로 달라지는 순간 다시 나열한다.
 */
function critAndLifeStealClause(criticalPoints: number, lifeStealPoints: number): string {
  return criticalPoints === lifeStealPoints
    ? t("skill.ferocity.critLifeSteal.same", { percent: criticalPoints })
    : t("skill.ferocity.critLifeSteal.split", { chance: criticalPoints, lifeSteal: lifeStealPoints });
}

/** 폭주 설명의 모든 수치를 실제 전투 계약에서 만들어 밸런스 조정 후 문구가 남지 않게 한다. */
export function ferocityTraitDescription(trait: FerocityTrait, stats?: { attack: number; defense: number; maxHp?: number; abilityPower?: number }): string {
  // 캐릭터 ID가 아니라 도핑 계약의 구조화 수치만 읽어 어떤 정의에도 같은 문장 조립을 제공한다.
  if (trait.effectId === "reagentDoping") return t("skill.ferocity.reagentDoping", { stacks: trait.stacksOnEntry, percent: trait.attackSpeedPercent });
  if (trait.effectId === "attackIntervalReduction") return t("skill.ferocity.attackIntervalReduction", { percent: trait.reductionPercent });
  if (trait.effectId === "damageReduction") return t("skill.ferocity.damageReduction", { percent: trait.reductionPercent });
  if (trait.effectId === "torikaBulwark") {
    // 방어 수치는 퍼센트로 재해석하지 않고 전투 계약의 실제 증가값을 그대로 노출한다.
    return t("skill.ferocity.torikaBulwark", {
      regen: trait.maxHpRegenPercentPerSecond, defense: trait.defenseBonus,
      resistance: trait.resistanceBonus, seconds: trait.tauntDurationSeconds,
    });
  }
  // 덧셈형 확률도 플레이어에게는 일반적인 퍼센트 기호로 보여 주고 내부 산술 단위는 노출하지 않는다.
  if (trait.effectId === "teamMoveSpeedBonus") return t("skill.ferocity.teamMoveSpeedBonus", { percent: trait.bonusPercent });
  if (trait.effectId === "rexBattleQueen") return t("skill.ferocity.rexBattleQueen", { percent: trait.allDamageLifeStealPoints });
  // 내부 효과명은 저장 호환성을 위해 도약으로 유지하지만, 플레이어에게는 실제 좌표 변경 규칙을 정확히 알린다.
  if (trait.effectId === "stealthLeap") return t("skill.ferocity.stealthLeap", { seconds: trait.durationSeconds });
  if (trait.effectId === "selfAttackSpeedMultiplier") return t("skill.ferocity.selfAttackSpeedMultiplier", { percent: trait.bonusPercent });
  if (trait.effectId === "packHunt") return t("skill.ferocity.packHunt", { seconds: trait.stealthDurationSeconds, percent: trait.sharedTargetAttackSpeedPercent });
  if (trait.effectId === "crescendoStaccato") {
    const converted = stats === undefined ? undefined : Math.round(stats.attack * trait.damagePercent / 100);
    const damage = converted === undefined
      ? t("skill.ferocity.crescendoStaccato.power", { percent: trait.damagePercent })
      : t("skill.ferocity.crescendoStaccato.amount", { amount: converted });
    return t("skill.ferocity.crescendoStaccato", { damage });
  }
  if (trait.effectId === "pontusRage") return t("skill.ferocity.pontusRage", { percent: trait.maxHpDamagePercentPerSecond });
  if (trait.effectId === "tailwindRally") return t("skill.ferocity.tailwindRally", { ferocity: trait.teamFerocityGain, energy: trait.teamEnergyGain });
  if (trait.effectId === "sharedOverpaint") return t("skill.ferocity.sharedOverpaint");
  if (trait.effectId === "ichthyoDive") return t("skill.ferocity.ichthyoDive", { percent: trait.moveSpeedPercent });
  if (trait.effectId === "butcherFeast") return t("skill.ferocity.butcherFeast", { attacks: trait.instantButcherAttacks, percent: trait.healPercent });
  // 바르거나 터뜨리거나 한 번에 하나뿐이라는 것이 이 폭주의 전부다. 번갈아 한다고 적지 않는
  // 이유는 실제 규칙이 "지금 걸려 있나"만 보기 때문이다 — 공속이 빨라져도 그 판단은 같다.
  if (trait.effectId === "adamantBody") {
    const shield = stats?.maxHp === undefined
      ? t("skill.ferocity.adamantBody.shieldPercent", { percent: trait.shieldMaxHpPercent })
      : `[[shield-value|${Math.round(stats.maxHp * trait.shieldMaxHpPercent / 100)}]]`;
    return t("skill.ferocity.adamantBody", { shield, attacks: trait.hastenedAttacks, percent: trait.attackSpeedPercent });
  }
  if (trait.effectId === "venomousEncore") {
    return t("skill.ferocity.venomousEncore", { percent: trait.attackSpeedBonusPercent });
  }
  // 몇 번 튕기는지도 몇 초인지도 적지 않는다. 날아가는 그림이 곧 그 답이고, 그 수가 플레이어의
  // 다음 조작을 바꾸지 않는다 — 태그가 "날아가는 동안 움직이지도 때리지도 못한다"까지 말한다.
  if (trait.effectId === "knockbackSlam") {
    // 장전은 주기를 건드리는 값이라 본문이 직접 말한다 — 뇌진탕 태그가 말하는 몫이 아니다.
    const loaded = trait.loadsStatusCycleOnEntry ? t("skill.ferocity.knockbackSlam.loaded") : "";
    return t("skill.ferocity.knockbackSlam", { loaded });
  }
  // 광란은 시간이 스킬마다 다르므로(궁극 4초 · 폭주 2초) 태그가 아니라 본문이 초를 적는다.
  if (trait.effectId === "frenzyGaze") return t("skill.ferocity.frenzyGaze", { seconds: trait.seconds });
  // 최대 체력이 아니라 **잃은 체력** 비례라는 것이 이 폭주의 전부다 — 앞에 서서 맞는 것이
  // 값인 개체라, 성한 몸일 때 가장 많이 도는 회복이면 성질이 거꾸로 선다.
  if (trait.effectId === "climax") {
    return t("skill.ferocity.climax", {
      percent: trait.auraDamageMaxHpPercent, seconds: trait.taunt.seconds,
      healPercent: trait.missingHpPercentPerBasic,
    });
  }
  // 때리지 않는다는 것을 먼저 말한다 — 이 폭주에서 플레이어가 화면으로 확인할 첫 변화가
  // "평타가 멈췄다"이고, 그래서 도발도 함께 멈춘다. 뒤에 붙는 절이 그 대가로 무엇을 얻는지다.
  if (trait.effectId === "graffitiRun") {
    const converted = stats?.abilityPower === undefined ? undefined : Math.round(stats.abilityPower * trait.auraDamagePercent / 100);
    const damage = converted === undefined
      ? t("skill.value.scaling", { stat: statName("ap"), percent: trait.auraDamagePercent })
      : `[[damage-value|${converted}]]`;
    // 도발이 평타가 아니라 이 지속 피해에 붙어 있다는 것이 이 폭주의 전부라, 한 문장에 함께 적는다.
    return t("skill.ferocity.graffitiRun", { percent: trait.moveSpeedPercent, damage, seconds: trait.taunt.seconds });
  }
  if (trait.effectId === "furCoat") {
    return t("skill.ferocity.furCoat", { percent: trait.shieldMaxHpPercent, guardPercent: trait.defenseResistancePercent });
  }
  if (trait.effectId === "shellResolve") {
    return t("skill.ferocity.shellResolve", { stacks: trait.shellStacksOnEntry, seconds: trait.shellCooldownSecondsDuringFever });
  }

  if (trait.effectId === "cautery") {
    // 비율도 상한도 적지 않는다 — 그 수치는 「가봉」이 갖고, 폭주는 **어디로 들어가는지**만
    // 바꾼다. 여기에 값을 다시 적으면 패시브를 조정한 뒤 폭주만 옛 값으로 남는다.
    return t("skill.ferocity.cautery", { percent: trait.attackSpeedPercent });
  }
  if (trait.effectId === "splitVolley") {
    // 순환을 기다리지 않는다는 것과 사거리가 는다는 것 둘만 말한다. 갈래화살이 무엇인지는
    // 태그가 이미 말하므로 여기서 되풀이하지 않는다.
    return t("skill.ferocity.splitVolley", { reach: trait.reachBonus });
  }
  if (trait.effectId === "summonPackFrenzy") {
    // 수치를 적지 않는다 — 무엇이 얼마나 오르는지는 폭주하는 몸(늑대) 쪽 특성이 갖는다.
    return t("skill.ferocity.summonPackFrenzy");
  }
  if (trait.effectId === "packBody") {
    // 방어·저항은 같은 값이 함께 오르므로 한 번만 말하고, 실제로 오르는 양으로 보여 준다.
    // 방어·저항은 퍼센트가 아니라 실제 오르는 값으로 보여 준다. 같은 비율도 개체마다 오르는 양이 다르다.
    const defense = stats === undefined ? undefined : Math.round(stats.defense * trait.defenseResistancePercent / 100);
    const guard = defense === undefined
      ? t("skill.ferocity.packBody.guardPercent", { percent: trait.defenseResistancePercent })
      : t("skill.ferocity.packBody.guardAmount", { amount: defense });
    return t("skill.ferocity.packBody", {
      guard, percent: trait.attackSpeedPercent,
      crit: critAndLifeStealClause(trait.criticalChancePoints, trait.lifeStealPoints),
    });
  }

  if (trait.effectId === "duoBreakthrough") {
    return t("skill.ferocity.duoBreakthrough", { percent: trait.allyRegenFromDuoDamagePercent });
  }

  // 방어력 계수는 토리카처럼 추가 피해가 있는 범위 타격만 노출하고, 일반 전이 특성은 원래 피해 비율만 보여 준다.
  const speed = trait.attackSpeedBonusPercent === undefined ? ""
    : t("skill.ferocity.splash.speed", { percent: trait.attackSpeedBonusPercent });
  const converted = trait.defenseDamagePercent === undefined || stats === undefined
    ? undefined
    : Math.round(stats.defense * trait.defenseDamagePercent / 100);
  const bonus = trait.defenseDamagePercent === undefined
    ? t("skill.ferocity.splash.bonusRatio", { percent: trait.damagePercent })
    : converted === undefined
      ? t("skill.ferocity.splash.bonusPlain")
      : t("skill.ferocity.splash.bonusAmount", { amount: converted });
  const ending = trait.statusEffect?.kind === "stagger"
    ? t("skill.ferocity.splash.endingStagger", { bonus })
    : t("skill.ferocity.splash.ending", { bonus });
  return t("skill.ferocity.splash", { speed, ending });
}

/**
 * 「희열」 태그. 겹이 무엇을 하는지·얼마나 남는지·언제 터지는지를 한 자리에서 말한다.
 *
 * 개체 전용 규칙어라 전역 사전(`keywords.ts`)이 아니라 이 개체의 스킬을 여는 자리에서만
 * 주입한다 — 메테의 스타카토와 같은 자리다. 문장은 실제 전투가 읽는 필드에서 지으므로
 * 겹 상한이나 비율을 조정하면 팝업도 함께 바뀐다.
 */
export function elationKeyword(passive: Passive): KeywordDef | undefined {
  const plan = passive.elation;
  if (passive.kind !== "painfulElation" || plan === undefined) return undefined;
  return {
    id: "nodonia-elation",
    term: t("skill.keyword.elation.term"),
    kind: "buff",
    description: t("skill.keyword.elation.description", {
      percent: plan.maxHpRegenPercentPerStack, stacks: plan.maxStacks, seconds: plan.seconds,
    }),
  };
}

/** 아다지오의 무게 보호막처럼 패시브가 실제 능력치에서 계산하는 수치를 조회 가능한 태그로 만든다. */
export function passiveShieldKeyword(passive: Passive, atk?: number): KeywordDef | undefined {
  if (passive.kind !== "adagioWeight" || passive.cleanseShieldAttackPercent === undefined || atk === undefined) return undefined;
  const amount = Math.round(atk * passive.cleanseShieldAttackPercent / 100);
  return { id: "shield-value", term: String(amount), kind: "rule", description: t("skill.keyword.shield.fromAttack", { percent: passive.cleanseShieldAttackPercent }) };
}

/**
 * 복합 능력 패시브를 각 구조화 수치에서 문장화해 데이터 변경이 본문에도 즉시 반영되게 한다.
 *
 * 치명타 확률 가산은 종류를 가리지 않고 **적힌 개체마다** 뒤에 한 문장으로 붙는다 — 태생
 * 치명타가 전 개체 공통이라 "이 개체가 왜 치명타형인가"의 답은 늘 패시브에 있고, 그 답을
 * 개체마다 손으로 적으면 수치를 조정한 뒤 옛 문장이 남는다.
 */
export function passiveDescription(passive: Passive, atk?: number): string {
  return [passiveHead(passive, atk), passiveCriticalClause(passive)].filter(Boolean).join(" ");
}

/**
 * 치명타를 올리는 패시브의 공통 절.
 *
 * 렉시아처럼 그 사실을 이미 제 문장에서 말하는 종류는 뺀다 — 같은 말을 두 번 하게 된다.
 * 확률과 피해가 **같은 값이면 한 번만 말한다** — 서로 다른 순간에만 따로 나열한다.
 */
function passiveCriticalClause(passive: Passive): string {
  // 렉시아와 디안은 제 문장에서 이미 치명타를 말한다. 여기서 또 붙이면 같은 값이 두 번 선다.
  if (passive.kind === "battleMaidMastery" || passive.kind === "summonCommander") return "";
  const chance = passive.criticalChancePercent;
  const damage = passive.criticalDamagePercent;
  if (chance !== undefined && damage !== undefined) {
    return chance === damage
      ? t("skill.passive.crit.same", { percent: chance })
      : t("skill.passive.crit.split", { chance, damage });
  }
  if (chance !== undefined) return t("skill.passive.crit.chance", { percent: chance });
  if (damage !== undefined) return t("skill.passive.crit.damage", { percent: damage });
  return "";
}

function passiveHead(passive: Passive, atk?: number): string {
  if (passive.kind === "reagentReaction" && passive.reagentReaction !== undefined) {
    // 이름이 아니라 공용 계약을 문장화하므로 다른 캐릭터가 같은 메커니즘을 선언해도 그대로 읽힌다.
    const reagent = passive.reagentReaction;
    return t("skill.passive.reagentReaction", {
      basic: reagent.basicStacks, ultimate: reagent.ultimateStacks,
      stacks: reagent.maxStacks, seconds: reagent.seconds,
      poisonSeconds: reagent.reactionPoisonSeconds,
      resistanceSeconds: reagent.resistanceReductionSeconds,
      resistancePercent: reagent.resistanceReductionPercent,
      healPercent: reagent.lowestHpAllyHealMaxHpPercent,
    });
  }
  if (passive.kind === "summonCommander") {
    const crit = passive.criticalChancePercent;
    const guard = crit === undefined
      ? t("skill.passive.summonCommander.guard")
      : t("skill.passive.summonCommander.guardCrit", { percent: crit });
    /*
     * **혼자 남는 순간을 본문이 직접 말한다.**
     *
     * 조건절만 읽고 그 반대를 알아서 뒤집으라고 두면 "늑대가 없어도 계속 숨어 있다"로 읽힌다 —
     * 실제로는 그 프레임에 은신이 풀려 지휘자가 그대로 맞는 몸이 되고, 그것이 이 편성이 파는
     * 값이다. 주어가 달라지는 절이라 제 문장으로 세운다.
     */
    const exposed = t("skill.passive.summonCommander.exposed");
    // 피 냄새의 겹당 수치와 상한은 태그가 말한다. 여기서는 **언제 얻는가**만 적는다.
    const scent = passive.bloodscent === undefined ? "" : t("skill.passive.summonCommander.scent");
    return t("skill.passive.summonCommander", { guard, exposed, scent });
  }
  if (passive.kind === "followHighestAttackAllyTarget") return t("skill.passive.followHighestAttackAllyTarget");
  if (passive.kind === "basicHitAttackSpeedStack") return t("skill.passive.basicHitAttackSpeedStack", { value: passive.value });
  if (passive.kind === "farthestFocus") {
    // 겹당 무엇이 얼마나 오르는지는 전부 태그가 말한다 — 쓰는 개체가 하나뿐인 규칙어라
    // 태그가 수치를 갖고, 본문은 그것을 되풀이하지 않는다(출혈이 아니라 덧칠 쪽 규칙이다).
    return t("skill.passive.farthestFocus");
  }
  if (passive.kind === "adagioWeight") {
    const shield = passiveShieldKeyword(passive, atk);
    const shieldText = shield === undefined
      ? t("skill.passive.adagioWeight.shieldPercent", { percent: passive.cleanseShieldAttackPercent })
      : t("skill.passive.adagioWeight.shieldAmount", { amount: shield.term });
    return t("skill.passive.adagioWeight", { percent: passive.teamAttackSpeedPercent, shield: shieldText });
  }
  if (passive.kind === "abyssalPressure") return t("skill.passive.abyssalPressure", {
    percent: passive.apPercentPerSecond, hpPercent: passive.maxReductionAtHpPercent,
    base: passive.baseDamageReductionPercent, max: passive.maxDamageReductionPercent,
    ignore: passive.ignoreDamageAtOrBelow,
  });
  if (passive.kind === "gourmetHunt") return t("skill.passive.gourmetHunt", {
    cooldown: passive.huntCooldownSeconds, seconds: passive.damageStealthSeconds,
    triggers: passive.damageStealthMaxTriggers,
  });
  if (passive.kind === "cursedInsight") return t("skill.passive.cursedInsight", { value: passive.value, stacks: passive.maxStacks });
  if (passive.kind === "impactCap") {
    // 막은 맞은 쪽 최대 체력에서 나오는 값이라 미리 환산할 수 없다 — 명중 시점의 상대값만
    // %로 남긴다는 규칙 그대로다.
    const shield = passive.concussionShieldPercent === undefined ? ""
      : t("skill.passive.impactCap.shield", { percent: passive.concussionShieldPercent })
        + (passive.concussionShieldCapMaxHpPercent === undefined ? ""
          : t("skill.passive.impactCap.shieldCap", { percent: passive.concussionShieldCapMaxHpPercent }));
    return t("skill.passive.impactCap", { percent: passive.impactCapMaxHpPercent, shield });
  }
  if (passive.kind === "overpaintSiphon") return t("skill.passive.overpaintSiphon", { percent: passive.value });
  if (passive.kind === "lowHpVanish") return t("skill.passive.lowHpVanish", { seconds: passive.durationSeconds });
  if (passive.kind === "openingVanish") return t("skill.passive.openingVanish", { seconds: passive.durationSeconds });
  if (passive.kind === "undyingTalisman") {
    // 무적·행동불가·회복·밀어냄이 한 덩어리로 일어나므로 한 문장에 순서대로 담는다.
    const blast = passive.undyingKnockback === undefined ? "" : t("skill.passive.undyingTalisman.blast");
    return t("skill.passive.undyingTalisman", { seconds: passive.durationSeconds, percent: passive.value, blast });
  }
  if (passive.kind === "painfulElation" && passive.elation !== undefined) {
    return t("skill.passive.painfulElation");
  }
  if (passive.kind === "shellGuard" && passive.shellGuard !== undefined) {
    const shell = passive.shellGuard;
    return t("skill.passive.shellGuard", {
      seconds: shell.durationSeconds, stacks: shell.maxStacks,
      selfPercent: shell.selfShieldMaxHpPercent, allyPercent: shell.lowestHpAllyShieldMaxHpPercent,
      cooldown: shell.cooldownSeconds,
    });
  }
  if (passive.kind === "tagAndRun") {
    // 세 절이 각각 다른 일을 한다 — 표적을 돌리고, 멈추지 않고, 달린 만큼 찬다. 한 문장에
    // 이으면 무엇이 이 패시브의 주 규칙인지 읽히지 않으므로 문장을 끊는다.
    const charge = [
      passive.moveEnergyPerSecond === undefined ? undefined : t("skill.passive.tagAndRun.energy", { value: passive.moveEnergyPerSecond }),
      passive.moveFerocityPerSecond === undefined ? undefined : t("skill.passive.tagAndRun.ferocity", { value: passive.moveFerocityPerSecond }),
    ].filter(Boolean).join(", ");
    // 유체화는 화면에서 곧바로 보이는 움직임이라 본문이 직접 말한다 — 왜 이 개체만 남을
    // 통과하는지가 설명되지 않으면 버그로 읽힌다.
    const phasing = passive.phasesThroughFighters ? t("skill.passive.tagAndRun.phasing") : "";
    return t("skill.passive.tagAndRun", { phasing, charge });
  }
  if (passive.kind === "duoLink" && passive.duoLink !== undefined) {
    // 세 절이 각각 다른 일을 한다 — 짝을 짓고, 숨고, 같은 적을 노린다. 한 문장에 이으면
    // 무엇이 조건이고 무엇이 결과인지 읽히지 않으므로 문장을 끊는다.
    // **짝을 맺는 것이 한 번뿐이라는 말이 맨 앞에 선다.** 그 한 줄이 "쓰러져도 다시 짝을
    // 짓지 않는다"까지 함께 말하므로 뒤에 한 문장을 더 달지 않는다. 누구와 맺는지는 태그의 몫이다.
    return t("skill.passive.duoLink", { percent: passive.value });
  }
  if (passive.kind === "sutureStitch" && passive.suture !== undefined) {
    // 자신도 후보라는 말을 함께 적는다 — 근거리에서 제일 많이 맞는 몸이 본인이라, 그 한 줄이
    // 없으면 "남만 꿰매 주고 자기는 그냥 맞는 개체"로 읽힌다.
    return t("skill.passive.sutureStitch", { percent: passive.suture.damagePercent, capPercent: passive.suture.maxHpCapPercent });
  }
  if (passive.kind === "shimmerMark") return t("skill.passive.shimmerMark", { percent: passive.value });
  if (passive.kind === "frostboundDominion") return t("skill.passive.frostboundDominion");
  if (passive.kind !== "battleMaidMastery") return passive.desc;
  // 네 능력이 모두 같은 비율로 오르므로 값을 한 번만 말한다. 값이 서로 달라지면 다시 나열해야 한다.
  return t("skill.passive.battleMaidMastery", { percent: passive.attackSpeedPercent });
}

/**
 * 공격 속도 복합 궁극기(스피나 등)가 실제 능력치에서 계산하는 피해 수치를 조회 가능한 태그로 만든다.
 *
 * 위력(%)과 공격 속도(%) 두 축을 하나의 배율로 합친 뒤 공격력에 적용한다 — 스킬 코어
 * (`src/core/skirmish.ts`의 `strike`)가 궁극기 한 방을 계산하는 것과 같은 식이다. 이 패널의
 * 다른 모든 미리보기와 같은 기준으로 **지금 성장한 대로**만 계산하고, 전투 중에만 붙는 실시간
 * 가산(폭주·아군 버프로 늘어난 공격 속도)은 포함하지 않는다 — 그런 값은 이 정보창의 어떤
 * 수치도 반영하지 않으므로 이 스킬만 예외로 두면 오히려 다른 수치와 기준이 갈린다.
 */
export function attackSpeedCompositeDamageKeyword(
  skill: { power?: number; attackSpeedPower?: number },
  atk?: number,
  attackSpeed?: number,
): KeywordDef | undefined {
  if (skill.power === undefined || skill.attackSpeedPower === undefined || atk === undefined || attackSpeed === undefined) return undefined;
  const compositePower = skill.power + (attackSpeed * skill.attackSpeedPower) / Math.max(1, atk);
  const amount = Math.round((atk * compositePower) / 100);
  return {
    id: "damage-value",
    term: String(amount),
    kind: "rule",
    description: t("skill.keyword.damage.composite", { percent: skill.power, speedPercent: skill.attackSpeedPower }),
  };
}

/**
 * 덧칠을 터뜨리는 궁극기(메론)가 **다 칠했을 때** 뽑는 피해를 조회 가능한 태그로 만든다.
 *
 * 이 궁극기의 위력은 총량이 아니라 겹당 값이라, 다른 스킬과 같은 자리에 겹당 수치를 세우면
 * 혼자만 훨씬 작은 수로 보인다. 상단 라벨은 겹을 다 쌓았을 때의 **예상 최대 피해량**을 말하고,
 * 본문은 한 겹의 값을 말한다 — 라벨이 "얼마나 세게 터지나", 본문이 "무엇에 비례하나"다.
 * 겹 상한은 궁극기가 아니라 그 덧칠을 만드는 기본 공격이 갖고 있으므로 호출부가 넘긴다.
 */
export function overpaintDetonationDamageKeyword(perStackDamage?: number, maxStacks?: number): KeywordDef | undefined {
  if (perStackDamage === undefined || maxStacks === undefined) return undefined;
  const amount = perStackDamage * maxStacks;
  return {
    id: "damage-value",
    term: String(amount),
    kind: "rule",
    description: t("skill.keyword.damage.detonation", { stacks: maxStacks }),
  };
}

/** 아군 전체 회복형 궁극기(도디 등)가 실제 주문력에서 계산하는 회복량을 조회 가능한 태그로 만든다. */
export function allyHealPowerKeyword(percent: number, ap?: number): KeywordDef | undefined {
  if (ap === undefined) return undefined;
  const amount = Math.round(ap * percent / 100);
  return { id: "heal-value", term: String(amount), kind: "rule", description: t("skill.keyword.heal.fromAp", { percent }) };
}

/** 추가 타격 계약을 본문용 키워드 문장으로 바꿔 확률·횟수·회복 수치가 데이터와 함께 바뀌게 한다. */
/**
 * 설명문이 문장을 지을 수 있는 것들.
 *
 * 순환 기본 공격의 **한 걸음**은 그 기본 공격에 걸음의 값을 덮어쓴 모양이라, 걸음에만 있는
 * 필드(보호막 전환)까지 이 유니온이 함께 든다 — 그래야 걸음 하나를 설명할 때도 같은 절
 * 조립기를 그대로 지나간다.
 */
export type DescribedSkill = Skill | BasicAttack | Ultimate | (BasicAttack & Pick<BasicAttackStep, "shieldFromDamagePercent" | "selfStealthSeconds" | "pull">);

export interface SkillDescriptionStats {
  /** 회복량을 실제 값으로 환산할 때 쓴다. */
  ap?: number;
  /** 공격 속도 복합 궁극기(스피나 등)만 쓰는 여벌 통계다. 없으면 옛 %-표기로 되돌아간다. */
  atk?: { atk: number; attackSpeed: number };
  /**
   * 스킬 아이콘 위 라벨과 **같은** 피해 수치.
   *
   * 본문이 스스로 다시 계산하지 않고 그 값을 그대로 받는 이유는, 두 곳이 따로 계산하면
   * 같은 스킬의 피해가 위아래에서 다른 수로 보이기 때문이다.
   */
  damage?: number;
  /**
   * 순환 기본 공격의 **걸음마다** 다른 실제 피해. 순서는 `cycle`과 같다.
   *
   * 걸음마다 위력이 통째로 달라 `damage` 하나로는 말할 수 없다 — 없으면 걸음도 위력(%)으로
   * 되돌아간다.
   */
  cycleDamage?: readonly number[];
  /** 최대 체력 비례 보호막을 실제 값으로 환산할 때 쓴다. 없으면 위력(%)으로 되돌아간다. */
  maxHp?: number;
}

/** 순환 걸음 둘이 같은 일을 하는가. 이름까지 같아야 화면에서도 같은 한 방으로 읽힌다. */
function sameCycleStep(a: BasicAttackStep, b: BasicAttackStep): boolean {
  return a.name === b.name && a.power === b.power && (a.targeting ?? "single") === (b.targeting ?? "single")
    && JSON.stringify(a.statusEffects ?? null) === JSON.stringify(b.statusEffects ?? null);
}

/** 서수. 순환은 길어야 서넛이라 다섯까지만 표에 두고 그 밖은 숫자로 센다. */
function ordinal(index: number): string {
  if (index >= 1 && index <= 5) return t(`skill.ordinal.${index as 1 | 2 | 3 | 4 | 5}`);
  return t("skill.ordinal.n", { count: index });
}

/** 대체되는 걸음의 이름. 규칙어로 정의돼 있으면 태그로 걸어 눌러 볼 수 있게 한다. */
function cycleStepKeyword(step: BasicAttackStep): string {
  // 이름이 아니라 정의가 든 ID로 가른다 — 이름은 언어를 따라 바뀌므로 표의 열쇠가 될 수 없다.
  return step.keywordId === undefined ? t("skill.cycle.stepName", { name: step.name }) : `[[${step.keywordId}|${step.name}]]`;
}

/**
 * 스킬 설명문을 만드는 유일한 자리.
 *
 * **양식은 `대상 → 피해 → 부가 효과` 한 줄이다.** 어느 개체든 같은 순서로 읽히게 하려고
 * 문장을 손으로 적지 않고 구조화 필드에서 조립한다 — 캐릭터마다 문장을 새로 지으면 같은 뜻이
 * 화면마다 다른 무게·다른 단위로 읽히고, 수치를 조정한 뒤 옛 문장이 그대로 남는다.
 *
 * 그래서 `relics.ts`의 공격·회복 스킬에는 **설명문을 적지 않는다**(`desc`는 문장을 만들 수
 * 없는 스킬만 쓰는 선택 필드다). 새 스킬이 새로운 효과를 가지면 문장을 데이터에 적는 대신
 * 이 함수에 그 효과의 절을 더한다.
 */
export function skillDescription(
  skill: DescribedSkill,
  stats: SkillDescriptionStats = {},
): string {
  // 합공은 한 행동에 두 축이 함께 들어간다. 하나로 합친 위력이 없으므로 정형 문장을 따로 짓는다.
  if ("dualStrike" in skill && skill.dualStrike !== undefined) {
    const dual = skill.dualStrike;
    const physical = stats.atk === undefined
      ? t("skill.value.scaling", { stat: statName("atk"), percent: dual.attackPercent })
      : `[[damage-value|${Math.round(stats.atk.atk * dual.attackPercent / 100)}]]`;
    const magical = stats.ap === undefined
      ? t("skill.value.scaling", { stat: statName("ap"), percent: dual.abilityPercent })
      : `[[damage-value|${Math.round(stats.ap * dual.abilityPercent / 100)}]]`;
    return t("skill.sentence.dualStrike", { physical, magical })
      + finisherClause(skill.finisher)
      + ` ${t("skill.sentence.dualStrike.alone", { percent: dual.aloneAlternatePercent })}`;
  }
  // 무리를 통째로 던지는 궁극기. 지휘자 자신은 때리지 않고 늑대의 돌진과 마무리가 전부다.
  if ("packAssault" in skill && skill.packAssault !== undefined) {
    const assault = skill.packAssault;
    return t("skill.sentence.packAssault", { percent: assault.summonPowerPercent })
      + ` ${t("skill.sentence.packAssault.resummon", { seconds: assault.resummonHasteSeconds })}`
      + finisherClause(skill.finisher);
  }
  // 순수 회복기는 때리는 대상이 없어 "대상 → 피해"로 시작할 수 없다. 회복 계약에서 바로 짓는다.
  if (skill.damageType === undefined || skill.power === undefined) {
    if ("healing" in skill && skill.healing?.kind === "teamMissingHpPercent") {
      return t("skill.sentence.teamMissingHpHeal", { percent: skill.healing.percent });
    }
    // 앞에 서는 궁극기. 아무도 때리지 않고 아군의 몫을 대신 받는다.
    if ("selfBulwark" in skill && skill.selfBulwark !== undefined) {
      const plan = skill.selfBulwark;
      return t("skill.sentence.selfBulwark", { seconds: plan.seconds, percent: plan.maxHpRegenPercentPerSecond });
    }
    // 버티는 궁극기. 끌어당겨 붙잡아 두고 덜 맞은 만큼을 끝나고 돌려받는다.
    if ("selfGuard" in skill && skill.selfGuard !== undefined) {
      const guard = skill.selfGuard;
      const shield = stats.maxHp === undefined
        ? t("skill.sentence.selfGuard.shieldPercent", { percent: guard.shieldMaxHpPercent })
        : `[[shield-value|${Math.round(stats.maxHp * guard.shieldMaxHpPercent / 100)}]]`;
      const reset = guard.resetShellGuardCooldown === true ? t("skill.sentence.selfGuard.reset") : "";
      return t("skill.sentence.selfGuard", { seconds: guard.tauntSeconds, shield, reset });
    }
    // 때리지 않고 자리만 잡는 궁극기. 위력을 적지 않는 이유는 그 피해가 이어질 일반 공격의
    // 몫이기 때문이다 — 여기에 수치를 적으면 같은 한 방이 위아래에서 두 수로 보인다.
    if ("selfSetup" in skill && skill.selfSetup !== undefined) {
      const setup = skill.selfSetup;
      // 은신이 언제 풀리는지는 그 한 방을 언제 쓸지 정하는 정보라 본문이 직접 말한다.
      const exposed = setup.stealthBreaksOnBasic ? t("skill.sentence.stealthSetup.exposed") : "";
      return t("skill.sentence.stealthSetup", { seconds: setup.stealthSeconds, exposed });
    }
    // 때리지 않고 손을 바꾸는 궁극기. 위력을 적지 않는 이유는 selfSetup과 같다 — 그 피해가
    // 이어질 일반 공격의 몫이라, 여기에 수를 적으면 같은 한 방이 위아래에서 두 수로 보인다.
    if ("selfVolley" in skill && skill.selfVolley !== undefined) {
      const volley = skill.selfVolley;
      return t("skill.sentence.volley", { seconds: volley.seconds, hits: volley.hitCount, percent: volley.attackSpeedPercent });
    }
    // 듀오 한 명에게만 거는 지시. 대상이 전장 전체가 아니라는 것부터 말한다.
    if ("teamBuff" in skill && skill.teamBuff?.kind === "order") {
      const buff = skill.teamBuff;
      return t("skill.sentence.duoOrder", {
        seconds: buff.seconds, percent: buff.attackSpeedPercent,
        chance: buff.criticalChancePoints, lifeSteal: buff.lifeStealPoints,
      });
    }
    // 피해도 회복도 없는 지원 궁극기. 무엇을 얼마나 오래 거는지만 말한다.
    if ("teamBuff" in skill && skill.teamBuff?.kind === "tailwind") {
      const buff = skill.teamBuff;
      // 지속 회복은 순풍 태그가 말하지 않는 이 스킬만의 몫이라 본문이 직접 적는다.
      return buff.maxHpRegenPercentPerSecond === undefined
        ? t("skill.sentence.tailwind", { seconds: buff.seconds })
        : t("skill.sentence.tailwindRegen", { seconds: buff.seconds, percent: buff.maxHpRegenPercentPerSecond });
    }
    return skill.desc ?? "";
  }
  // 덧칠을 터뜨리는 궁극기는 위력이 총량이 아니라 겹당 값이라 뼈대가 다르다. "적 전체에 얼마"로
  // 적으면 한 겹만 칠한 적과 다섯 겹을 칠한 적이 같은 수를 맞는 것처럼 읽힌다.
  if ("overpaintDetonation" in skill && skill.overpaintDetonation === true) {
    return t("skill.sentence.overpaintDetonation", { target: skillTargetPhrase(skill), damage: skillDamagePhrase(skill, stats) });
  }
  /*
   * 시간을 두고 되풀이되는 궁극기는 위력이 총량이 아니라 **한 틱**의 값이라 뼈대가 다르다.
   * "전장 전체에 얼마"로 적으면 한 번에 다 들어가는 것처럼 읽히고, 총량으로 환산해 적으면
   * 도중에 쓰러진 적이 실제로 받은 몫과 갈린다.
   */
  const channel = "channel" in skill ? skill.channel : undefined;
  if (channel !== undefined) {
    const clauses = statusClauses(skill).map(({ text }) => text);
    // 대상이 먼저다 — 다른 모든 스킬과 같은 뼈대를 지키고, 그 뒤에 "얼마 동안 매초"를 둔다.
    const tick = t("skill.sentence.channel", {
      target: skillTargetPhrase(skill), seconds: channel.seconds,
      damage: skillDamagePhrase(skill, stats), effects: clauses.join(" "),
    });
    const rider = (channel.basicStatusEffects ?? []).map((effect) => statusEffectClause(effect)).filter(Boolean);
    // 손이 닿은 적만 받는 몫은 전장 전체가 받는 틱과 주어가 달라 제 문장으로 선다.
    return rider.length === 0 ? tick
      : t("skill.sentence.channel.rider", { tick, effects: rider.join(" ") });
  }
  // 걸음마다 다른 권을 내는 순환 기본 공격(엘라의 발경)은 한 문장으로 뭉치지 않는다 — 위력도
  // 대상도 부가 효과도 걸음마다 통째로 달라, 하나로 적으면 세 권 중 하나만 설명한 문장이 된다.
  const cycle = "cycle" in skill ? skill.cycle : undefined;
  if (cycle !== undefined && cycle.length > 0) {
    /**
     * **앞 걸음이 전부 같은 순환은 늘어놓지 않는다.**
     *
     * 엘라의 발경은 세 권이 저마다 달라 걸음을 나열해야 하지만, 파루아처럼 같은 한 방을
     * 되풀이하다 마지막에만 갈라지는 순환은 같은 문장을 두 번 읽히게 만든다 — 다른 개체의
     * 평타처럼 한 문장으로 적고, 달라지는 걸음만 한 절로 덧붙인다.
     */
    const head = cycle[0];
    const uniformHead = cycle.length > 1 && cycle.slice(0, -1).every((step) => sameCycleStep(step, head));
    if (uniformHead) {
      const base = { ...skill, cycle: undefined, power: head.power, targeting: head.targeting ?? "single",
        radius: head.radius, statusEffects: head.statusEffects, damageHealingPercent: head.damageHealingPercent } as DescribedSkill;
      const last = cycle[cycle.length - 1];
      const body = skillDescription(base, { ...stats, damage: stats.cycleDamage?.[0] ?? stats.damage });
      // 대체되는 걸음이 무엇을 하는지는 그 이름의 태그가 말한다 — 여기서 되풀이하지 않는다.
      return t("skill.sentence.cycleReplace", { body, ordinal: ordinal(cycle.length), step: cycleStepKeyword(last) });
    }
    const steps = cycle.map((step, index) => {
      // 선언하지 않은 필드는 **비어 있는 것으로 본다** — 기본 공격 쪽 값이 새어 들어오면 어느
      // 걸음이 무엇을 하는지 문장만 보고 알 수 없다. 코어의 `currentBasic`과 같은 규칙이다.
      const stepSkill = {
        ...skill,
        cycle: undefined,
        combo: undefined,
        statusEffectEvery: undefined,
        periodicBonusScaling: undefined,
        power: step.power,
        targeting: step.targeting ?? "single",
        radius: step.radius,
        statusEffects: step.statusEffects,
        damageHealingPercent: step.damageHealingPercent,
        shieldFromDamagePercent: step.shieldFromDamagePercent,
        selfStealthSeconds: step.selfStealthSeconds,
        pull: step.pull,
      } as DescribedSkill;
      return t("skill.sentence.cycleStep", { name: step.name, body: skillDescription(stepSkill, { ...stats, damage: stats.cycleDamage?.[index] }) });
    });
    // **걸음마다 줄을 나눈다.** 한 줄로 쭉 이으면 세 문장이 한 덩어리로 뭉쳐 어디서 걸음이
    // 바뀌는지 읽으려면 「」를 눈으로 찾아야 한다.
    return [t("skill.sentence.cycleHeader", { count: cycle.length }), ...steps].join("\n");
  }
  const sentences: string[] = [];
  const clauses = skillEffectClauses(skill, stats);
  // 첫 절만 "주고"로 이어 붙이고 나머지는 문장을 끊는다. 셋 이상을 한 문장에 이으면 무엇이
  // 이 스킬의 주 효과인지 읽히지 않는다.
  // 주어가 바뀌지 않는 첫 절만 "주고"로 이어 붙인다. 주기 치명타·전이처럼 주어가 다른 절을
  // 이어 붙이면 한 문장 안에서 말하는 대상이 바뀌어 읽다가 걸린다.
  const joined = clauses.find(({ standalone }) => standalone !== true);
  const parts = { target: skillTargetPhrase(skill), damage: skillDamagePhrase(skill, stats) };
  // 이어 붙이는 어미는 언어마다 다르므로 문구 표가 문장을 통째로 갖는다 — 한국어에서 "준다"에
  // "고"를 그대로 붙이면 인용형 어미("~라고")로 읽히는 것도 그 표가 아는 일이다.
  sentences.push(joined === undefined
    ? t("skill.sentence.damage", parts)
    : t(joined.joinWithComma ? "skill.sentence.damageAndComma" : "skill.sentence.damageAnd", { ...parts, effect: joined.text }));
  for (const clause of clauses) if (clause !== joined) sentences.push(t("skill.sentence.clause", { text: clause.text }));
  return sentences.join(" ");
}

/** 문장에 이어 붙일 부가 효과 한 절. */
interface SkillEffectClause {
  text: string;
  /** "주고" 뒤에 쉼표를 두는가. 상태이상은 쉼표 없이 이어야 자연스럽게 읽힌다. */
  joinWithComma?: boolean;
  /** 주어가 이 스킬의 시전자가 아니라 늘 제 문장으로 서는 절인가. */
  standalone?: boolean;
}

/**
 * 부가 효과 절들을 순서대로 모은다.
 *
 * 순서는 **때린 결과에 가까운 것부터**다 — 추가 타격, 그 피해로 생기는 회복, 남는 상태이상,
 * 그 밖의 규칙. 새 효과를 넣을 자리를 이 순서로 정하면 개체가 늘어도 문장 모양이 갈리지 않는다.
 */
function skillEffectClauses(skill: DescribedSkill, stats: SkillDescriptionStats): SkillEffectClause[] {
  const clauses: SkillEffectClause[] = [];
  // 일반 공격과 궁극기 모두 캐릭터 ID 없이 같은 적중 후 데이터 계약을 설명한다.
  if ("reagentStacks" in skill && skill.reagentStacks !== undefined) {
    clauses.push({ text: t("skill.clause.reagent", { stacks: skill.reagentStacks }) });
  }
  const combo = "combo" in skill ? skill.combo : undefined;
  if (combo) {
    clauses.push({ text: t("skill.clause.combo", { percent: combo.chancePercent, hits: combo.hitCount }), joinWithComma: true });
    clauses.push({ text: t("skill.clause.comboHeal", { percent: combo.missingHpHealingPercentPerHit }) });
  }
  if ("damageHealingPercent" in skill && skill.damageHealingPercent !== undefined) {
    clauses.push({ text: t("skill.clause.damageHealing", { percent: skill.damageHealingPercent }), joinWithComma: true });
  }
  if ("damageHealingPercentIfFrozen" in skill && skill.damageHealingPercentIfFrozen !== undefined) {
    clauses.push({ text: t("skill.clause.damageHealingIfFrozen", { percent: skill.damageHealingPercentIfFrozen }), standalone: true });
  }
  if ("shieldFromDamagePercent" in skill && skill.shieldFromDamagePercent !== undefined) {
    clauses.push({ text: t("skill.clause.shieldFromDamage", { percent: skill.shieldFromDamagePercent }), joinWithComma: true });
  }
  if ("selfStealthSeconds" in skill && skill.selfStealthSeconds !== undefined) {
    // 몇 초인지는 걸음마다 다를 수 있으므로 본문이 적는다 — 태그는 은신이 무엇인지만 말한다.
    clauses.push({ text: t("skill.clause.selfStealth", { seconds: skill.selfStealthSeconds }), joinWithComma: true });
  }
  if ("allyShieldFromDamagePercent" in skill && skill.allyShieldFromDamagePercent !== undefined) {
    // 나눠 갖는다는 말이 핵심이다 — 여럿을 함께 벨수록 한 명이 받는 몫이 커지는 것이 아니라
    // 총량이 커지고, 그 총량을 아군 수로 나눈다.
    clauses.push({ text: t("skill.clause.allyShieldFromDamage", { percent: skill.allyShieldFromDamagePercent }), joinWithComma: true });
  }
  // 몇 초 날아가고 몇 번 튕기는지는 적지 않는다 — 날아가는 그림이 곧 그 답이고, 태그가
  // "날아가는 동안 움직이지도 때리지도 못한다"까지 이미 말한다.
  if ("pull" in skill && skill.pull !== undefined) {
    clauses.push({ text: t("skill.clause.pull") });
  }
  if ("lowestHpAllyHealingFromDamagePercent" in skill && skill.lowestHpAllyHealingFromDamagePercent !== undefined) {
    clauses.push({ text: t("skill.clause.lowestHpAllyHealing", { percent: skill.lowestHpAllyHealingFromDamagePercent }), joinWithComma: true });
  }
  if ("allyHealingPower" in skill && skill.allyHealingPower !== undefined) {
    const heal = allyHealPowerKeyword(skill.allyHealingPower, stats.ap);
    const healText = heal === undefined
      ? t("skill.clause.allyHealing.percent", { percent: skill.allyHealingPower })
      : t("skill.clause.allyHealing.amount", { amount: heal.term });
    clauses.push({ text: t("skill.clause.allyHealing", { heal: healText }), joinWithComma: true });
  }
  if (skill.allyEnergyGain !== undefined) {
    clauses.push({ text: t("skill.clause.allyEnergy", { value: skill.allyEnergyGain }), standalone: true });
  }
  // 아군 전체가 아니라 듀오 한 명에게만 흘러간다. 두 값이 같으면 한 번만 말한다 — 다른
  // 값이 되는 순간 다시 나열해야 한다.
  if (skill.duoCharge !== undefined) {
    const { energy, ferocity } = skill.duoCharge;
    clauses.push({
      text: energy === ferocity
        ? t("skill.clause.duoCharge.same", { value: energy })
        : t("skill.clause.duoCharge.split", { energy, ferocity }),
      standalone: true,
    });
  }
  clauses.push(...statusClauses(skill));
  if ("damageTransfer" in skill && skill.damageTransfer) {
    clauses.push({ text: t("skill.clause.damageTransfer", { percent: skill.damageTransfer.percent }), standalone: true });
  }
  if ("curseTransfer" in skill && skill.curseTransfer) {
    clauses.push({ text: t("skill.clause.curseTransfer", { percent: skill.curseTransfer.percent }), standalone: true });
  }
  if ("energyRefundOnKill" in skill && skill.energyRefundOnKill !== undefined) {
    clauses.push({ text: t("skill.clause.energyRefundOnKill", { value: skill.energyRefundOnKill }), standalone: true });
  }
  if ("periodicCritical" in skill && skill.periodicCritical) {
    clauses.push({ text: t("skill.clause.periodicCritical", { every: skill.periodicCritical.every }), standalone: true });
  }
  // 여울은 **쓰는 개체가 하나뿐인 규칙어**라 반경·시간·둔화·확정 연격을 태그가 갖는다.
  // 본문이 그걸 다시 늘어놓으면 한 문장이 그 규칙 하나로 가득 찬다.
  if ("shallows" in skill && skill.shallows !== undefined) {
    clauses.push({ text: t("skill.clause.shallows"), standalone: true });
  }
  if ("chargeStartsAtHpPercent" in skill && skill.chargeStartsAtHpPercent !== undefined) {
    clauses.push({ text: t("skill.clause.chargeStartsAtHp", { percent: skill.chargeStartsAtHpPercent }), standalone: true });
  }
  return clauses;
}

/**
 * 상태 효과 절들.
 *
 * **뇌진탕과 기절처럼 같은 타격에 함께 걸리는 것은 한 문장으로 잇는다** — 문장을 끊으면 서로
 * 다른 순간에 따로 걸리는 것처럼 읽힌다. 주기(`statusEffectEvery`)가 있으면 그 절들을 뒤에서
 * 되짚지 않고 **앞에서 "매 N번째 공격마다"로 묶는다** — "위 상태는"이라고 가리키면 어디까지가
 * 그 상태인지 다시 세어야 한다.
 */
function statusClauses(skill: DescribedSkill): SkillEffectClause[] {
  const effects = skill.statusEffects ?? [];
  const concussion = effects.find((effect) => effect.kind === "concussion");
  const stun = effects.find((effect) => effect.kind === "stun");
  const texts: string[] = [];
  // 뇌진탕이 있으면 기절을 그 뒤에 이어 붙여 한 덩어리로 만든다. 어미를 잘라 붙이지 않고
  // 이어지는 형태를 직접 적는다 — 잘라 붙이면 "입힌고" 같은 어형이 나온다.
  if (concussion && stun && stun.kind === "stun") {
    texts.push(t("skill.status.concussionStun", { seconds: stun.seconds }));
  }
  for (const effect of effects) {
    if (concussion && stun && (effect === concussion || effect === stun)) continue;
    const text = statusEffectClause(effect);
    if (text) texts.push(text);
  }
  const every = "statusEffectEvery" in skill ? skill.statusEffectEvery : undefined;
  // **이름을 가진 주기 스택은 본문에 풀어 적지 않고 태그 한 장으로 접는다.** 셋을 모아야
  // 터지는 규칙은 몇 타마다인지·무엇이 얹히는지·몇 초인지가 함께 붙어 다녀, 본문에 풀면
  // 한 문장이 그 규칙 하나로 가득 찬다. 덧칠·손질과 같은 자리다 — 쓰는 개체가 하나뿐인
  // 규칙어라 수치는 태그가 갖고 본문은 "한 겹 쌓는다"까지만 말한다.
  const stack = periodicStackKeyword(skill);
  if (stack !== undefined) return [{ text: t("skill.clause.periodicStack", { id: stack.id, term: stack.term }) }];
  if (texts.length === 0) return [];
  // 주기가 있는 스킬은 상태 절을 피해 문장에 붙이지 않고 제 문장으로 세운다.
  if (every !== undefined) return [{ text: t("skill.clause.everyNth", { every, effects: texts.join(" ") }), standalone: true }];
  return texts.map((text) => ({ text }));
}

/**
 * 상태이상 한 절.
 *
 * **몇 초인지가 스킬마다 다른 효과만 시간을 적는다.** 경직은 키워드 설명 자체가 "약 0.1초"를
 * 명시하므로 여기서 다시 말하지 않는다.
 */
function statusEffectClause(effect: CombatStatusEffect): string | undefined {
  // 덧칠은 몇 겹까지 쌓이고 한 겹이 얼마인지가 곧 이 스킬의 값이라 키워드가 아니라 본문이 적는다.
  if (effect.kind === "overpaint") return t("skill.status.overpaint");
  if (effect.kind === "stun") return t("skill.status.stun", { seconds: effect.seconds });
  // 뇌진탕의 수치와 치명타 배증은 키워드가 말하므로 본문은 걸린다는 사실만 적는다.
  if (effect.kind === "concussion") return t("skill.status.concussion");
  // 터지는 위력과 회복 비율은 태그가 말하므로 본문은 표식을 남긴다는 사실만 적는다.
  if (effect.kind === "weakpoint") return t("skill.status.weakpoint");
  // 겹 상한과 터지는 위력은 태그가 말하므로 본문은 겹이 쌓인다는 사실만 적는다.
  if (effect.kind === "butcher") return t("skill.status.butcher");
  if (effect.kind === "stagger") return t("skill.status.stagger");
  if (effect.kind === "bleed") return t("skill.status.bleed", { seconds: effect.seconds, percent: effect.maxHpPercentPerSecond });
  // 매초 얼마인지는 태그가 말한다(쓰는 개체가 하나뿐이다). 시간만 스킬마다 달라 본문이 적는다.
  if (effect.kind === "poison") return t("skill.status.poison", { seconds: effect.seconds });
  // 겹 상한·감소율·유지 시간은 저주 태그가 말한다(쓰는 개체가 하나뿐이라 태그가 수치를 가진다).
  if (effect.kind === "curse") return t("skill.status.curse");
  // 겹당 감소율과 상한은 **스킬마다 다르므로 본문이 적는다** — 매디와 시로가 같은 태그를 쓰는
  // 순간 태그가 수치를 못 박으면 한쪽 설명이 거짓말이 된다(출혈이 그랬다). 최대 중첩에서
  // 빙결로 바뀌는 것은 패시브의 몫이라 여기서 말하지 않는다.
  if (effect.kind === "chill") {
    return t("skill.status.chill", { stacks: effect.maxStacks, percent: effect.speedPercentPerStack });
  }
  // 반대로 광란의 시간은 스킬마다 다르므로 본문이 적는다 — 출혈이 그런 것과 같은 이유다.
  if (effect.kind === "frenzy") return t("skill.status.frenzy", { seconds: effect.seconds });
  // 겹 상한·감소율·유지 시간·터지는 위력은 밴덜리즘 태그가 말한다(쓰는 개체가 하나뿐이라
  // 태그가 수치를 가진다). 둘째 개체가 이 규칙어를 갖게 되면 출혈처럼 본문으로 옮긴다.
  if (effect.kind === "vandalism") return t("skill.status.vandalism");
  // 도발은 붙잡아 두는 시간이 곧 스킬마다 다른 값이라 본문이 초를 적는다.
  if (effect.kind === "taunt") return t("skill.status.taunt", { seconds: effect.seconds });
  return undefined;
}

/**
 * 문장을 여는 대상.
 *
 * 전투 엔진이 읽는 대상 계약(`targeting`)에서 그대로 만든다 — 설명문이 대상을 따로 적으면
 * 실제로 맞는 범위와 갈린다. 지정 원은 아군도 함께 판정하지만 **피해를 받는 것은 적뿐**이라
 * 요약줄(`targetingLabel`)과 달리 여기서는 적만 말한다.
 */
function skillTargetPhrase(skill: DescribedSkill): string {
  const targeting = "targeting" in skill ? skill.targeting : undefined;
  if (targeting === "nearbyEnemies") return t("skill.phrase.nearbyEnemies");
  // 걸음 이름이 이미 「갈래화살」이고 몇 명까지 갈라지는지는 태그가 말한다 — 본문은 어디를
  // 중심으로 갈라지는지만 적어, 한 줄에서 같은 말이 두 번 나오지 않게 한다.
  if (targeting === "splitShot") return t("skill.phrase.splitShot");
  if (targeting === "battlefieldEnemies") return t("skill.phrase.battlefieldEnemies");
  if (targeting === "targetedCircle") return t("skill.phrase.targetedCircle");
  // 돌진은 시전 시점의 자리가 아니라 지나간 길이 대상이라, 원·전장과 다른 말로 적는다.
  if (targeting === "chargeLine") return t("skill.phrase.chargeLine");
  return t("skill.phrase.single");
}

/**
 * 피해 한 덩어리.
 *
 * 실제 수치는 스킬 아이콘 위 라벨이 쓰는 그 값을 그대로 받고(두 곳이 따로 계산하면 같은
 * 스킬의 피해가 위아래에서 다른 수로 보인다), 능력치를 모르는 자리에서만 위력(%)으로
 * 되돌아간다. 그때도 어느 능력치에서 나오는 배율인지 함께 말한다.
 */
function skillDamagePhrase(skill: DescribedSkill, stats: SkillDescriptionStats): string {
  const type = t(skill.damageType === "physical" ? "skill.damageType.physical" : "skill.damageType.magical");
  // 위력과 현재 공격 속도를 하나의 배율로 합쳐 쓰는 스킬(스피나 궁극기)만 두 축을 합친다.
  if ("attackSpeedPower" in skill && skill.attackSpeedPower !== undefined) {
    const composite = attackSpeedCompositeDamageKeyword(skill, stats.atk?.atk, stats.atk?.attackSpeed);
    return composite === undefined
      ? t("skill.damage.composite", { percent: skill.power, speedPercent: skill.attackSpeedPower, type })
      : t("skill.damage.value", { amount: composite.term, type });
  }
  if (stats.damage !== undefined) return t("skill.damage.value", { amount: stats.damage, type });
  const label = (scaling: "atk" | "ap" | "def" | "hp" | undefined): string => statName(scaling === "def" ? "def"
    : scaling === "hp" ? "hp"
      : scaling === "ap" || (scaling === undefined && skill.damageType === "magical") ? "ap"
        : "atk");
  const secondary = "secondaryScaling" in skill ? skill.secondaryScaling : undefined;
  // 능력치를 모르는 자리(도감)에서도 두 축을 모두 말한다 — 한쪽만 적으면 실제 피해의 절반만
  // 설명한 문장이 된다.
  if (secondary) return t("skill.damage.dualScaling", {
    stat: label(skill.scalingStat), percent: skill.power,
    secondStat: label(secondary.stat), secondPercent: secondary.power, type,
  });
  return t("skill.damage.scaling", { stat: label(skill.scalingStat), percent: skill.power, type });
}

/** 스킬별 피해 회복은 최대 체력 회복과 다른 계약이므로 실제 피해 기준임을 명시한다. */
export function damageHealingLabel(percent?: number): string | undefined {
  return percent === undefined ? undefined : t("skill.label.damageHealing", { percent });
}

/**
 * 아직 전용 효과를 설계하지 않은 개체가 그 별에서 **무엇이 열리는지**만 말하는 한 줄.
 *
 * "효과 없음"이라고 적지 않는다 — 열리는 자리는 이미 정해져 있고 내용만 아직 없으므로,
 * 없는 규칙을 말하는 대신 어느 기술이 달라질 자리인지를 알린다.
 */
export function breakthroughSlotLabel(slot: BreakthroughSlot): string {
  return t(`skill.breakthrough.${slot}`);
}

/**
 * 한계 돌파가 연 **그 개체만의 효과** 한 줄.
 *
 * 슬롯마다 문장을 적어 두지 않고 계약에서 조립한다 — 수치를 고친 뒤 옛 문장이 그대로 남는 일을
 * 막는 것이 네 슬롯의 설명문과 같은 이유다. 기술 이름도 손으로 적지 않고 그 개체의 정의에서
 * 읽으므로(「세 개의 뿔」·「지각 붕괴」), 이름을 고치면 이 줄도 함께 따라간다.
 *
 * 정의하지 않은 슬롯은 `undefined`다. 화면은 그 줄을 아예 그리지 않는다 — 아직 설계하지 않은
 * 개체에 "효과 없음"이라고 적으면 없는 규칙을 말하는 셈이다.
 */
export function breakthroughEffectText(def: RelicDef, slot: BreakthroughSlot, stats?: Stats): string | undefined {
  const effects = def.breakthroughEffects;
  if (!effects) return undefined;
  if (slot === "basic" && effects.basic) {
    const effect = effects.basic;
    // 주기 이름이 있으면 그것이 이 효과가 얹히는 그 한 방의 이름이다(칩에 뜨는 이름과 같다).
    const trigger = def.basic.statusEffectStackName ?? def.basic.name;
    // **회복량은 계산할 수 있으면 실제 값으로 말한다.** 능력치를 아는 자리(정보창·적 팝업)에서는
    // 지금 성장한 대로의 수를 태그로 세우고, 모르는 자리(도감)에서만 어느 능력치의 몇 %인지로
    // 되돌아간다 — 스킬 본문이 쓰는 것과 같은 규칙이다.
    const heal = breakthroughHealAmount(effect, stats);
    return t(heal === undefined ? "skill.breakthrough.effect.basic" : "skill.breakthrough.effect.basicValue", {
      trigger, stat: statScalingLabel(effect.healScalingStat),
      percent: trim(effect.healPercent), seconds: trim(effect.tauntSeconds),
      heal: `[[${BREAKTHROUGH_HEAL_ID}|${heal}]]`,
    });
  }
  if (slot === "ultimate" && effects.ultimate) {
    const effect = effects.ultimate;
    // 피해량의 몇 %는 **명중 시점의 상대값**이라 실제 수로 바꾸지 않는다(대상마다 달라진다).
    return t("skill.breakthrough.effect.ultimate", {
      percent: trim(effect.powerPercent), name: def.ultimate.name,
      seconds: trim(effect.intervalSeconds), casts: countLabel(effect.casts),
    });
  }
  if (slot === "ferocity" && effects.ferocity) {
    const effect = effects.ferocity;
    return t("skill.breakthrough.effect.ferocity", {
      percent: trim(effect.shieldPercentOfDamageTaken), seconds: trim(effect.tauntSeconds),
    });
  }
  if (slot === "passive" && effects.passive) {
    return t("skill.breakthrough.effect.passive", { name: def.passive.name, percent: trim(effects.passive.percent) });
  }
  return undefined;
}

/** 돌파 회복 태그의 ID. 스킬 본문의 `heal-value`와 갈라 두어 두 수가 한 쪽지에서 섞이지 않는다. */
const BREAKTHROUGH_HEAL_ID = "breakthrough-heal-value";

/** 돌파 회복량. 능력치를 모르면 계산하지 않고 위력 %로 되돌아간다. */
function breakthroughHealAmount(effect: { healScalingStat: keyof Stats; healPercent: number }, stats?: Stats): number | undefined {
  if (!stats) return undefined;
  return Math.round(stats[effect.healScalingStat] * effect.healPercent / 100);
}

/**
 * 돌파 설명문이 쓰는 **문맥 용어**.
 *
 * 실제 값으로 바꾼 수는 그 자리에서 "어디서 나온 수인가"를 물을 수 있어야 한다 — 스킬 본문의
 * 수치가 그러하듯 눌러서 산출 근거를 읽는다. 스킬이 이미 쓰는 `heal-value`와 ID를 갈라 두는
 * 이유는, 한 쪽지에 스킬의 회복과 돌파의 회복이 함께 설 수 있기 때문이다.
 */
export function breakthroughEffectKeywords(def: RelicDef, slot: BreakthroughSlot, stats?: Stats): KeywordDef[] {
  const effect = slot === "basic" ? def.breakthroughEffects?.basic : undefined;
  if (!effect) return [];
  const heal = breakthroughHealAmount(effect, stats);
  if (heal === undefined) return [];
  return [{
    id: BREAKTHROUGH_HEAL_ID, term: String(heal), kind: "rule",
    description: t("skill.keyword.heal.fromStat", { stat: statScalingLabel(effect.healScalingStat), percent: trim(effect.healPercent) }),
  }];
}

/** 회복·피해의 기준이 되는 능력치 이름. 스킬 본문이 쓰는 것과 같은 표를 읽는다. */
function statScalingLabel(stat: string): string {
  if (stat === "def" || stat === "res" || stat === "ap" || stat === "hp") return statName(stat);
  return statName("atk");
}

/** 소수 없는 값은 소수점을 적지 않는다. `1.50초`처럼 읽히면 정밀해 보이지만 뜻은 같다. */
function trim(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

/** 횟수를 세는 우리말. 넷을 넘으면 숫자가 더 빨리 읽힌다. */
function countLabel(count: number): string {
  if (count >= 1 && count <= 4) return t(`skill.count.${count as 1 | 2 | 3 | 4}`);
  return String(count);
}
