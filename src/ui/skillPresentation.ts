import type { DamagePreview } from "../core/damage";
import type { KeywordDef } from "../data/keywords";
import type { KeywordTextOptions } from "../managers/KeywordManager";
import type { BasicAttack, BasicAttackStep, CombatStatusEffect, FerocityTrait, Passive, Skill, Ultimate } from "../core/types";

/**
 * 순수 회복형 궁극기(메테 등)는 damageType/power가 없어 피해 미리보기를 만들 수 없다.
 *
 * 패시브도 항상 제외한다 — 별도 정형 계산을 쓰지 않고 구조화 필드에서 문장을 만든다.
 * 이 판별 없이 회복형 스킬에 미리보기를 시도하면 damage.ts의 `previewSkillDamage`가
 * 던지는 예외로 정보창 스킬 팝업이 그대로 열리지 않는다(메테 궁극기 팝업 버그).
 */
export function canPreviewSkillDamage(skill: Skill | Passive, kindLabel: string): boolean {
  return kindLabel !== "패시브" && "damageType" in skill && skill.damageType !== undefined;
}

/** 전투 좌표 수치 대신 플레이어가 전장에서 찾을 수 있는 대상 범위를 말한다. */
export function targetingLabel(targeting?: Ultimate["targeting"]): string | undefined {
  if (targeting === "single") return "적 한 명";
  if (targeting === "nearbyEnemies") return "자신의 주위 모든 적";
  if (targeting === "splitShot") return "표적과 그 주위의 적";
  if (targeting === "battlefieldEnemies") return "전장의 모든 적";
  if (targeting === "self") return "자신";
  if (targeting === "targetedCircle") return "지정한 원 안의 모든 적과 생존 아군";
  if (targeting === "chargeLine") return "[[charge|돌진]]해 뚫고 지나간 길의 모든 적";
  if (targeting === "duo") return "듀오";
  return undefined;
}

/** 상태 효과 계약을 팝업과 테스트가 함께 쓰는 짧은 문구로 바꾼다. */
export function statusEffectLabel(effect?: CombatStatusEffect): string | undefined {
  if (effect?.kind === "stun") return `[[stun|기절]] ${effect.seconds}초`;
  // 경직은 항상 0.1초인 용어 규칙을 키워드 설명이 담당하므로 요약줄에서 시간을 중복하지 않는다.
  if (effect?.kind === "stagger") return "[[stagger|경직]]";
  if (effect?.kind === "bleed") return `[[bleed|출혈]] ${effect.seconds}초 · 매초 최대 체력 ${effect.maxHpPercentPerSecond}%`;
  if (effect?.kind === "poison") return `[[poison|중독]] ${effect.seconds}초`;
  // 시간이 아니라 듀오의 다음 한 방으로 풀리는 표식이라 초를 적지 않는다.
  if (effect?.kind === "weakpoint") return "[[weakpoint|약점 포착]]";
  // 시간으로 사라지지 않으므로 요약줄에도 초를 적지 않는다. 겹 상한은 태그가 말한다.
  if (effect?.kind === "vandalism") return "[[vandalism|밴덜리즘]]";
  if (effect?.kind === "taunt") return `[[taunt|도발]] ${effect.seconds}초`;
  return undefined;
}

/** 지속 회복 수치는 특정 캐릭터를 사전에 하드코딩하지 않고 현재 정의에서 만든다. */
export function recoveryLabel(percent?: number): string | undefined {
  return percent === undefined ? undefined : `매초 최대 체력의 ${percent}% 회복`;
}

/** 어느 캐릭터나 같은 양식으로 피해 수치의 능력치 출처와 적용 배율을 열어 볼 수 있게 한다. */
export function damageKeyword(preview?: DamagePreview): KeywordDef | undefined {
  if (preview?.kind !== "scaling") return undefined;
  // 두 능력치가 위력을 나눠 갖는 스킬은 두 축을 함께 말한다. 한쪽만 말하면 실제 수치의
  // 절반이 어디서 왔는지 설명되지 않는다.
  const description = preview.secondary === undefined
    ? `현재 ${preview.stat}에서 ${preview.power}%를 받아 계산한 피해 수치다.`
    : `현재 ${preview.stat}의 ${preview.power}%와 ${preview.secondary.stat}의 ${preview.secondary.power}%를 더해 계산한 피해 수치다.`;
  return { id: "damage-value", term: String(preview.amount), kind: "규칙", description };
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
    const label = bonus.stat === "def" ? "방어력" : bonus.stat === "ap" ? "주문력" : "공격력";
    parts.push(`${label}의 ${bonus.power}%에 해당하는 물리 피해를 추가로 주고`);
  }
  for (const effect of skill.statusEffects ?? []) {
    const text = statusEffectClause(effect);
    if (text !== undefined) parts.push(withoutKeywordTags(text));
  }
  return {
    id: `${skill.id}-stack`,
    term: name,
    kind: "규칙",
    description: `기본 공격 한 번마다 한 겹씩 쌓이고 ${every}겹째에 터진다. 터지는 타격은 ${parts.join(" ")}. 터진 뒤 겹은 0으로 돌아간다.`,
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
  const bite = `[[nape|목덜미]]가 들어가 남은 체력의 ${finisher.remainingHpPercent}%만큼 [[fixed-damage|고정 피해]]를 준다`;
  // 문턱이 100이면 조건 자체가 없다. "100% 이하"라고 적으면 없는 조건을 찾게 만든다.
  if (finisher.thresholdPercent >= 100) return ` 이어 체력과 무관하게 ${bite}.`;
  // 문턱이 자라는 것은 주어가 바뀌는 절이라 제 문장으로 세운다.
  const grows = finisher.thresholdPerStack > 0
    ? ` 이 문턱은 [[bloodscent|피 냄새]] 한 겹마다 ${finisher.thresholdPerStack}%씩 오른다.`
    : "";
  return ` 표적의 체력이 ${finisher.thresholdPercent}% 이하면 대신 ${bite}.${grows}`;
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
    ? `치명타 확률과 모든 피해 흡혈이 모두 ${criticalPoints}% 증가한다.`
    : `치명타 확률이 ${criticalPoints}%, 모든 피해 흡혈이 ${lifeStealPoints}% 증가한다.`;
}

/** 폭주 설명의 모든 수치를 실제 전투 계약에서 만들어 밸런스 조정 후 문구가 남지 않게 한다. */
export function ferocityTraitDescription(trait: FerocityTrait, stats?: { attack: number; defense: number; maxHp?: number; abilityPower?: number }): string {
  // 캐릭터 ID가 아니라 도핑 계약의 구조화 수치만 읽어 어떤 정의에도 같은 문장 조립을 제공한다.
  if (trait.effectId === "reagentDoping") return `폭주에 진입하면 모든 생존 적에게 [[reagent|시약]]을 ${trait.stacksOnEntry}겹 부여한다. 폭주 중 [[attack-speed|공격 속도]]가 ${trait.attackSpeedPercent}% 증가한다.`;
  if (trait.effectId === "attackIntervalReduction") return `공격 간격이 ${trait.reductionPercent}% 짧아진다.`;
  if (trait.effectId === "damageReduction") return `받는 피해가 ${trait.reductionPercent}% 줄어든다.`;
  if (trait.effectId === "torikaBulwark") {
    // 방어 수치는 퍼센트로 재해석하지 않고 전투 계약의 실제 증가값을 그대로 노출한다.
    return `매초 최대 체력의 ${trait.maxHpRegenPercentPerSecond}%를 회복하고 방어력이 ${trait.defenseBonus}, 저항력이 ${trait.resistanceBonus} 증가한다.`
      + ` 폭주에 들어가는 순간 주위 모든 적을 ${trait.tauntDurationSeconds}초 동안 [[taunt|도발]]한다.`;
  }
  // 덧셈형 확률도 플레이어에게는 일반적인 퍼센트 기호로 보여 주고 내부 산술 단위는 노출하지 않는다.
  if (trait.effectId === "teamMoveSpeedBonus") return `생존 아군 전체의 이동 속도가 ${trait.bonusPercent}% 빨라진다.`;
  if (trait.effectId === "rexBattleQueen") return `[[bleed|출혈]] 중인 적을 공격하면 치명타가 확정되고, 모든 피해 흡혈이 ${trait.allDamageLifeStealPoints}% 증가한다.`;
  // 내부 효과명은 저장 호환성을 위해 도약으로 유지하지만, 플레이어에게는 실제 좌표 변경 규칙을 정확히 알린다.
  if (trait.effectId === "stealthLeap") return `체력 비율이 가장 낮은 적에게 [[teleport|순간이동]]해 ${trait.durationSeconds}초 동안 [[stealth|은신]]한다.`;
  if (trait.effectId === "selfAttackSpeedMultiplier") return `공격 속도가 ${trait.bonusPercent}% 증가한다.`;
  if (trait.effectId === "packHunt") return `${trait.stealthDurationSeconds}초 동안 [[stealth|은신]]하고 [[pack-hunt|무리 사냥]]을 다시 발동한다. 폭주 중 자신을 포함해 같은 적을 표적으로 삼은 생존 아군의 [[attack-speed|공격 속도]]가 ${trait.sharedTargetAttackSpeedPercent}% 증가한다.`;
  if (trait.effectId === "crescendoStaccato") {
    const converted = stats === undefined ? undefined : Math.round(stats.attack * trait.damagePercent / 100);
    const damage = converted === undefined ? `공격력 ${trait.damagePercent}%의` : `[[damage-value|${converted}]]의`;
    return `폭주 중 아군 기본 공격 적중마다 ${damage} 피해량을 가진 [[mette-staccato|스타카토]]가 추가로 발동한다.`;
  }
  if (trait.effectId === "pontusRage") return `폭주 중 매초 모든 적에게 최대 체력 ${trait.maxHpDamagePercentPerSecond}% 고정 피해를 주고, 모든 회복을 취소한다.`;
  if (trait.effectId === "tailwindRally") return `모든 아군이 공격할 때마다 오르는 [[ferocity|야성]] 게이지와 궁극기 게이지가 각각 ${trait.teamFerocityGain}, ${trait.teamEnergyGain}씩 늘어난다.`;
  if (trait.effectId === "sharedOverpaint") return `폭주 중 모든 아군의 [[basic-attack|기본 공격]]이 [[overpaint|덧칠]]을 함께 쌓는다.`;
  if (trait.effectId === "ichthyoDive") return `이동 속도가 ${trait.moveSpeedPercent}% 증가하고, [[basic-attack|기본 공격]] 이후 표적을 다른 적으로 바꾼다.`;
  if (trait.effectId === "butcherFeast") return `폭주 후 다음 ${trait.instantButcherAttacks}번의 [[basic-attack|기본 공격]]은 [[butcher|손질]]을 즉시 터뜨린다. [[butcher|손질]]이 터진 피해의 ${trait.healPercent}%만큼 생존 아군 전체를 회복시킨다.`;
  // 바르거나 터뜨리거나 한 번에 하나뿐이라는 것이 이 폭주의 전부다. 번갈아 한다고 적지 않는
  // 이유는 실제 규칙이 "지금 걸려 있나"만 보기 때문이다 — 공속이 빨라져도 그 판단은 같다.
  if (trait.effectId === "adamantBody") {
    const shield = stats?.maxHp === undefined ? `최대 체력의 ${trait.shieldMaxHpPercent}%`
      : `[[shield-value|${Math.round(stats.maxHp * trait.shieldMaxHpPercent / 100)}]]`;
    return `${shield}만큼 보호막을 얻는다.`
      + ` 이후 [[basic-attack|기본 공격]] ${trait.hastenedAttacks}회 동안 [[attack-speed|공격 속도]]가 ${trait.attackSpeedPercent}% 오른다.`;
  }
  if (trait.effectId === "venomousEncore") {
    return `공격 속도가 ${trait.attackSpeedBonusPercent}% 증가한다. [[basic-attack|기본 공격]]이 자신의 [[poison|중독]]에 걸리지 않은 적에게는 중독을 부여하고, 이미 걸린 적에게는 그 중독을 [[liquidate|청산]]한다.`;
  }
  // 몇 번 튕기는지도 몇 초인지도 적지 않는다. 날아가는 그림이 곧 그 답이고, 그 수가 플레이어의
  // 다음 조작을 바꾸지 않는다 — 태그가 "날아가는 동안 움직이지도 때리지도 못한다"까지 말한다.
  if (trait.effectId === "knockbackSlam") {
    // 장전은 주기를 건드리는 값이라 본문이 직접 말한다 — 뇌진탕 태그가 말하는 몫이 아니다.
    const loaded = trait.loadsStatusCycleOnEntry ? `폭주에 들어가면 [[concussion|뇌진탕]]이 곧바로 장전된다. ` : "";
    return `${loaded}[[concussion|뇌진탕]]이 확정 치명타가 되고, 그 적을 [[knockback|날려버린다]]. 날려버린 뒤에는 가장 가까운 적을 표적으로 다시 지정한다.`;
  }
  // 광란은 시간이 스킬마다 다르므로(궁극 4초 · 폭주 2초) 태그가 아니라 본문이 초를 적는다.
  if (trait.effectId === "frenzyGaze") return `폭주 중 [[basic-attack|기본 공격]]에 적중한 적을 ${trait.seconds}초 동안 [[frenzy|광란]]시킨다. 전이된 타격으로는 발동하지 않는다.`;
  // 최대 체력이 아니라 **잃은 체력** 비례라는 것이 이 폭주의 전부다 — 앞에 서서 맞는 것이
  // 값인 개체라, 성한 몸일 때 가장 많이 도는 회복이면 성질이 거꾸로 선다.
  if (trait.effectId === "climax") {
    return `매초 자신의 주위 모든 적에게 최대 체력의 ${trait.auraDamageMaxHpPercent}%만큼 [[fixed-damage|고정 피해]]를 준다.`
      + ` 매초 피해를 받은 적을 ${trait.taunt.seconds}초 동안 [[taunt|도발]]한다.`
      + ` [[basic-attack|기본 공격]]마다 [[missing-hp|잃은 체력]]의 ${trait.missingHpPercentPerBasic}%를 회복한다.`;
  }
  // 때리지 않는다는 것을 먼저 말한다 — 이 폭주에서 플레이어가 화면으로 확인할 첫 변화가
  // "평타가 멈췄다"이고, 그래서 도발도 함께 멈춘다. 뒤에 붙는 절이 그 대가로 무엇을 얻는지다.
  if (trait.effectId === "graffitiRun") {
    const converted = stats?.abilityPower === undefined ? undefined : Math.round(stats.abilityPower * trait.auraDamagePercent / 100);
    const damage = converted === undefined ? `주문력의 ${trait.auraDamagePercent}%` : `[[damage-value|${converted}]]`;
    // 도발이 평타가 아니라 이 지속 피해에 붙어 있다는 것이 이 폭주의 전부라, 한 문장에 함께 적는다.
    return `이동 속도가 ${trait.moveSpeedPercent}% 증가하고 [[basic-attack|기본 공격]]을 하지 않는다.`
      + ` 매초 자신의 주위 모든 적에게 ${damage}의 [[magical-damage|마법 피해]]를 주고`
      + ` [[vandalism|밴덜리즘]]을 한 겹 쌓으며 ${trait.taunt.seconds}초 동안 [[taunt|도발]]한다.`;
  }
  if (trait.effectId === "furCoat") {
    return `폭주에 들어가는 순간 자신의 모든 상태이상·디버프를 지우고 최대 체력의 ${trait.shieldMaxHpPercent}% 보호막을 얻는다.`
      + ` 폭주 중에는 방어력과 저항력이 ${trait.defenseResistancePercent}% 오른다.`;
  }
  if (trait.effectId === "shellResolve") {
    return `폭주에 들어가는 순간 자신의 모든 상태이상·디버프를 지우고 [[shell|조가비]]를 ${trait.shellStacksOnEntry}겹 얻는다.`
      + ` 폭주 중 조가비 내부 재사용 대기시간이 ${trait.shellCooldownSecondsDuringFever}초로 줄어든다.`;
  }

  if (trait.effectId === "cautery") {
    // 비율도 상한도 적지 않는다 — 그 수치는 「가봉」이 갖고, 폭주는 **어디로 들어가는지**만
    // 바꾼다. 여기에 값을 다시 적으면 패시브를 조정한 뒤 폭주만 옛 값으로 남는다.
    return `공격 속도가 ${trait.attackSpeedPercent}% 증가하고, 부여하던 보호막이 같은 양의 즉시 회복으로 바뀐다.`;
  }
  if (trait.effectId === "splitVolley") {
    // 순환을 기다리지 않는다는 것과 사거리가 는다는 것 둘만 말한다. 갈래화살이 무엇인지는
    // 태그가 이미 말하므로 여기서 되풀이하지 않는다.
    return `폭주 중 모든 일반 공격이 [[split-arrow|갈래화살]]이 되고 사거리가 ${trait.reachBonus} 증가한다.`;
  }
  if (trait.effectId === "summonPackFrenzy") {
    // 수치를 적지 않는다 — 무엇이 얼마나 오르는지는 폭주하는 몸(늑대) 쪽 특성이 갖는다.
    return "[[summon-kuro|쿠로]]와 [[summon-shiro|시로]]가 함께 폭주해 방어력·저항력·[[attack-speed|공격 속도]]와 치명타 확률·모든 피해 흡혈이 함께 오른다.";
  }
  if (trait.effectId === "packBody") {
    // 방어·저항은 같은 값이 함께 오르므로 한 번만 말하고, 실제로 오르는 양으로 보여 준다.
    // 방어·저항은 퍼센트가 아니라 실제 오르는 값으로 보여 준다. 같은 비율도 개체마다 오르는 양이 다르다.
    const defense = stats === undefined ? undefined : Math.round(stats.defense * trait.defenseResistancePercent / 100);
    const guard = defense === undefined
      ? `방어력과 저항력이 ${trait.defenseResistancePercent}% 오르고`
      : `방어력과 저항력이 ${defense}씩 오르고`;
    return `${guard} [[attack-speed|공격 속도]]가 ${trait.attackSpeedPercent}% 오른다. `
      + critAndLifeStealClause(trait.criticalChancePoints, trait.lifeStealPoints);
  }

  if (trait.effectId === "duoBreakthrough") {
    return "[[duo|듀오]]를 체력이 가장 낮은 적으로 [[charge|돌진]]시킨다."
      + ` 길 위의 적은 듀오의 [[basic-attack|기본 공격]] 피해를 받고 [[knockback|날아간다]].`
      + ` 폭주 동안 듀오가 입힌 피해의 ${trait.allyRegenFromDuoDamagePercent}%만큼 모든 아군이 회복한다.`;
  }

  // 방어력 계수는 토리카처럼 추가 피해가 있는 범위 타격만 노출하고, 일반 전이 특성은 원래 피해 비율만 보여 준다.
  const speed = trait.attackSpeedBonusPercent === undefined ? "" : `공격 속도가 ${trait.attackSpeedBonusPercent}% 증가한다. `;
  const converted = trait.defenseDamagePercent === undefined || stats === undefined
    ? undefined
    : Math.round(stats.defense * trait.defenseDamagePercent / 100);
  const bonus = trait.defenseDamagePercent === undefined
    ? `원래 피해의 ${trait.damagePercent}%`
    : `${converted === undefined ? "추가" : `[[damage-value|${converted}]]만큼 추가`} 물리 피해`;
  const ending = trait.statusEffect?.kind === "stagger"
    ? `${bonus}를 입히고 [[stagger|경직]]시킨다.`
    : `${bonus}를 입힌다.`;
  return `${speed}기본 공격이 대상 주위의 모든 적에게 적중해 ${ending}`;
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
    term: "희열",
    kind: "버프",
    description: `한 겹마다 매초 최대 체력의 ${plan.maxHpRegenPercentPerStack}%를 회복하며 최대 ${plan.maxStacks}겹까지 쌓인다.`
      + ` ${plan.seconds}초 동안 남으며 다시 맞으면 유지 시간이 처음부터 다시 흐른다.`,
  };
}

/** 아다지오의 무게 보호막처럼 패시브가 실제 능력치에서 계산하는 수치를 조회 가능한 태그로 만든다. */
export function passiveShieldKeyword(passive: Passive, atk?: number): KeywordDef | undefined {
  if (passive.kind !== "adagioWeight" || passive.cleanseShieldAttackPercent === undefined || atk === undefined) return undefined;
  const amount = Math.round(atk * passive.cleanseShieldAttackPercent / 100);
  return { id: "shield-value", term: String(amount), kind: "규칙", description: `현재 공격력에서 ${passive.cleanseShieldAttackPercent}%를 받아 계산한 보호막 수치다.` };
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
      ? `치명타 확률과 치명타 피해가 모두 ${chance}% 오른다.`
      : `치명타 확률이 ${chance}%, 치명타 피해가 ${damage}% 오른다.`;
  }
  if (chance !== undefined) return `치명타 확률이 ${chance}% 오른다.`;
  if (damage !== undefined) return `치명타 피해가 ${damage}% 오른다.`;
  return "";
}

function passiveHead(passive: Passive, atk?: number): string {
  if (passive.kind === "reagentReaction" && passive.reagentReaction !== undefined) {
    // 이름이 아니라 공용 계약을 문장화하므로 다른 캐릭터가 같은 메커니즘을 선언해도 그대로 읽힌다.
    const reagent = passive.reagentReaction;
    return `공격이 적중하면 [[reagent|시약]]을 부여한다. [[basic-attack|기본 공격]]은 ${reagent.basicStacks}겹, 궁극기는 ${reagent.ultimateStacks}겹 부여한다.`
      + ` 시약은 최대 ${reagent.maxStacks}겹까지 ${reagent.seconds}초 동안 유지되며, 최대 중첩이 되면 모두 소비해 [[reagent-reaction|시약 반응]]을 일으킨다.`
      + ` 반응한 적을 ${reagent.reactionPoisonSeconds}초 동안 [[poison|중독]]시키고 저항력을 ${reagent.resistanceReductionSeconds}초 동안 ${reagent.resistanceReductionPercent}% 낮춘다.`
      + ` 이어 현재 HP 비율이 가장 낮은 생존 아군 한 명을 그 아군 최대 체력의 ${reagent.lowestHpAllyHealMaxHpPercent}%만큼 회복한다.`;
  }
  if (passive.kind === "summonCommander") {
    const crit = passive.criticalChancePercent;
    const guard = crit === undefined
      ? `[[stealth|은신]]해 단일 표적 공격의 표적에서 빠진다.`
      : `[[stealth|은신]]해 단일 표적 공격의 표적에서 빠지고, 무리 전체의 치명타 확률이 ${crit}% 오른다.`;
    /*
     * **혼자 남는 순간을 본문이 직접 말한다.**
     *
     * 조건절만 읽고 그 반대를 알아서 뒤집으라고 두면 "늑대가 없어도 계속 숨어 있다"로 읽힌다 —
     * 실제로는 그 프레임에 은신이 풀려 지휘자가 그대로 맞는 몸이 되고, 그것이 이 편성이 파는
     * 값이다. 주어가 달라지는 절이라 제 문장으로 세운다.
     */
    const exposed = ` 한 마리라도 쓰러지면 은신이 풀려 다시 표적이 된다.`;
    // 피 냄새의 겹당 수치와 상한은 태그가 말한다. 여기서는 **언제 얻는가**만 적는다.
    const scent = passive.bloodscent === undefined ? "" : ` 표적이 쓰러지거나 [[nape|목덜미]]가 들어갈 때마다 [[bloodscent|피 냄새]]를 한 겹 얻는다.`;
    return `전투 시작 시 [[summon-kuro|쿠로]]와 [[summon-shiro|시로]]를 소환하고, 두 늑대가 확인한 적 중 전투력이 가장 높은 하나를 무리의 첫 표적으로 삼는다.`
      + ` 둘이 모두 살아 있는 동안 ${guard}${exposed}${scent}`;
  }
  if (passive.kind === "followHighestAttackAllyTarget") return `전투 시작 시 아군 중 공격력이 가장 높은 렐릭이 표적으로 삼은 적을 함께 표적으로 삼는다.`;
  if (passive.kind === "basicHitAttackSpeedStack") return `[[basic-attack|기본 공격]]이 실제 적중할 때마다 이번 전투 동안 [[attack-speed|공격 속도]]가 ${passive.value} 증가한다.`;
  if (passive.kind === "farthestFocus") {
    // 겹당 무엇이 얼마나 오르는지는 전부 태그가 말한다 — 쓰는 개체가 하나뿐인 규칙어라
    // 태그가 수치를 갖고, 본문은 그것을 되풀이하지 않는다(출혈이 아니라 덧칠 쪽 규칙이다).
    return `사거리 안에서 가장 먼 적을 노리고, 공격이 적중할 때마다 [[focus|집중]]을 얻는다.`;
  }
  if (passive.kind === "adagioWeight") {
    const shield = passiveShieldKeyword(passive, atk);
    const shieldText = shield === undefined ? `공격력 ${passive.cleanseShieldAttackPercent}%` : `[[shield-value|${shield.term}]]`;
    return `생존 중 아군 [[attack-speed|공격 속도]]를 ${passive.teamAttackSpeedPercent}% 높인다. 아군이 [[crowd-control|군중제어]]에 걸리면 즉시 정화하고 ${shieldText} 보호막을 부여한다.`;
  }
  if (passive.kind === "abyssalPressure") return `완전히 경과한 매초 기본 [[ap|주문력]]의 ${passive.apPercentPerSecond}%가 복리로 누적된다. 현재 체력이 최대 체력의 100%에서 ${passive.maxReductionAtHpPercent}%로 낮아질수록 받는 모든 피해 감소가 ${passive.baseDamageReductionPercent}%에서 ${passive.maxDamageReductionPercent}%까지 선형으로 증가하며, 그 이하에서는 최대치로 제한된다. 최종 받는 피해가 ${passive.ignoreDamageAtOrBelow} 이하인 공격은 무효화한다.`;
  if (passive.kind === "gourmetHunt") return `전투를 시작할 때 현재 체력이 가장 낮은 적을 표적으로 삼고 그 자리로 [[teleport|순간이동]]한다. 적을 처치하면 즉시, 그 밖에는 ${passive.huntCooldownSeconds}초마다 다시 고른다. 적에게 피해를 입으면 ${passive.damageStealthSeconds}초 동안 [[stealth|은신]]한다. 전투당 최대 ${passive.damageStealthMaxTriggers}번 발동한다.`;
  if (passive.kind === "cursedInsight") return `[[curse|저주]]에 걸린 적에게 [[basic-attack|기본 공격]]을 직접 적중시킬 때마다 이번 전투 동안 [[ap|주문력]]이 ${passive.value}% 증가한다. 최대 ${passive.maxStacks}회까지 쌓이며, [[transfer|전이]]된 타격으로는 발동하지 않는다.`;
  if (passive.kind === "impactCap") {
    // 막은 맞은 쪽 최대 체력에서 나오는 값이라 미리 환산할 수 없다 — 명중 시점의 상대값만
    // %로 남긴다는 규칙 그대로다.
    const shield = passive.concussionShieldPercent === undefined ? ""
      : ` [[concussion|뇌진탕]]이 입힌 피해의 ${passive.concussionShieldPercent}%만큼 보호막을 얻는다.`
        + (passive.concussionShieldCapMaxHpPercent === undefined ? ""
          : ` 한 번에 두르는 보호막은 최대 체력의 ${passive.concussionShieldCapMaxHpPercent}%를 넘지 않는다.`);
    return `한 번에 받는 피해가 최대 체력의 ${passive.impactCapMaxHpPercent}%를 넘지 않는다.${shield}`;
  }
  if (passive.kind === "overpaintSiphon") return `모든 아군이 [[overpaint|덧칠]]된 적을 맞히면 그 피해의 ${passive.value}%만큼 자신의 체력을 회복한다. 표적의 [[overpaint|덧칠]]이 최대로 쌓이면 다른 적으로 표적을 옮긴다.`;
  if (passive.kind === "lowHpVanish") return `전투당 한 번, 체력이 절반 이하가 되면 ${passive.durationSeconds}초 동안 [[stealth|은신]]해 표적에서 벗어난다.`;
  if (passive.kind === "openingVanish") return `전투를 시작할 때 ${passive.durationSeconds}초 동안 [[stealth|은신]] 상태로 진입한다.`;
  if (passive.kind === "undyingTalisman") {
    // 무적·행동불가·회복·밀어냄이 한 덩어리로 일어나므로 한 문장에 순서대로 담는다.
    const blast = passive.undyingKnockback === undefined ? "" : ` 이때 주위 적을 [[knockback|날려버린다]].`;
    return `전투당 한 번, 쓰러질 피해를 받으면 죽지 않고 ${passive.durationSeconds}초 동안 [[invulnerable|무적]]이 되는 대신 아무 행동도 하지 못한다. 그동안 최대 체력의 ${passive.value}%를 매초 나누어 회복한다.${blast}`;
  }
  if (passive.kind === "painfulElation" && passive.elation !== undefined) {
    return `적에게 피격당할 때마다 [[nodonia-elation|희열]]이 한 겹 쌓인다.`;
  }
  if (passive.kind === "shellGuard" && passive.shellGuard !== undefined) {
    const shell = passive.shellGuard;
    return `실제 피해를 받고 살아남으면 ${shell.durationSeconds}초 동안 유지되는 [[shell|조가비]]를 한 겹 얻는다.`
      + ` ${shell.maxStacks}겹이 되면 모두 소비해 자신에게 최대 체력의 ${shell.selfShieldMaxHpPercent}%,`
      + ` 자신을 제외한 현재 HP 비율이 가장 낮은 생존 아군에게 그 아군 최대 체력의 ${shell.lowestHpAllyShieldMaxHpPercent}% 보호막을 부여한다.`
      + ` 한 번 발동하면 ${shell.cooldownSeconds}초 동안 다시 발동하지 않는다.`;
  }
  if (passive.kind === "tagAndRun") {
    // 세 절이 각각 다른 일을 한다 — 표적을 돌리고, 멈추지 않고, 달린 만큼 찬다. 한 문장에
    // 이으면 무엇이 이 패시브의 주 규칙인지 읽히지 않으므로 문장을 끊는다.
    const charge = [
      passive.moveEnergyPerSecond === undefined ? undefined : `궁극기 게이지가 ${passive.moveEnergyPerSecond}`,
      passive.moveFerocityPerSecond === undefined ? undefined : `[[ferocity|야성]]이 ${passive.moveFerocityPerSecond}`,
    ].filter(Boolean).join(", ");
    // 유체화는 화면에서 곧바로 보이는 움직임이라 본문이 직접 말한다 — 왜 이 개체만 남을
    // 통과하는지가 설명되지 않으면 버그로 읽힌다.
    const phasing = passive.phasesThroughFighters ? " 다른 전투원을 그대로 지나가고," : "";
    return `[[basic-attack|기본 공격]]을 낼 때마다 아직 때리지 않은 적으로 표적을 바꾼다. 모든 적을 때렸다면 처음부터 다시 돈다.`
      + `${phasing} 타격하는 순간까지 멈추지 않고 움직이며, 움직이는 동안 매초 ${charge}씩 더 찬다.`;
  }
  if (passive.kind === "duoLink" && passive.duoLink !== undefined) {
    // 세 절이 각각 다른 일을 한다 — 짝을 짓고, 숨고, 같은 적을 노린다. 한 문장에 이으면
    // 무엇이 조건이고 무엇이 결과인지 읽히지 않으므로 문장을 끊는다.
    // **짝을 맺는 것이 한 번뿐이라는 말이 맨 앞에 선다.** 그 한 줄이 "쓰러져도 다시 짝을
    // 짓지 않는다"까지 함께 말하므로 뒤에 한 문장을 더 달지 않는다. 누구와 맺는지는 태그의 몫이다.
    return `전투 시작 시 한 번, 아군 한 명과 [[duo|듀오]]를 맺는다. 듀오의 체력이 ${passive.value}% 이상인 동안 [[stealth|은신]]한다.`;
  }
  if (passive.kind === "sutureStitch" && passive.suture !== undefined) {
    // 자신도 후보라는 말을 함께 적는다 — 근거리에서 제일 많이 맞는 몸이 본인이라, 그 한 줄이
    // 없으면 "남만 꿰매 주고 자기는 그냥 맞는 개체"로 읽힌다.
    return `[[basic-attack|기본 공격]]이 적중할 때마다 그 피해의 ${passive.suture.damagePercent}%만큼`
      + ` 자신을 포함해 현재 HP 비율이 가장 낮은 생존 아군에게 보호막을 부여한다.`
      + ` 한 번에 부여하는 보호막은 그 아군 최대 체력의 ${passive.suture.maxHpCapPercent}%를 넘지 않는다.`;
  }
  if (passive.kind === "shimmerMark") return `적을 타격하면 반짝이는 표식을 남긴다. 표식이 없는 적을 타격하면 표식이 그 적에게 옮겨가며 [[ap|주문력]]의 ${passive.value}% [[magical-damage|마법 피해]]를 추가로 입힌다.`;
  if (passive.kind === "frostboundDominion") return `상성 계산에서 물이 아닌 얼음으로 취급된다. 얼음은 풀·물·땅에 유리하고 불에 불리하며 바람과는 무상성이다. 이미 [[chill|둔화]]가 최대 중첩인 적을 때리면 그 겹을 모두 소모해 [[frozen|빙결]]시킨다.`;
  if (passive.kind !== "battleMaidMastery") return passive.desc;
  // 네 능력이 모두 같은 비율로 오르므로 값을 한 번만 말한다. 값이 서로 달라지면 다시 나열해야 한다.
  return `전투 시작 시, 공격 속도·공격력·치명타 확률·치명타 피해가 모두 ${passive.attackSpeedPercent}% 오른다.`;
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
    kind: "규칙",
    description: `현재 공격력의 ${skill.power}%와 공격 속도의 ${skill.attackSpeedPower}%를 하나로 합쳐 계산한 피해 수치다.`,
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
    kind: "규칙",
    description: `[[overpaint|덧칠]]을 상한인 ${maxStacks}겹까지 쌓은 적 하나에게 들어가는 피해다. 겹이 적으면 그만큼 줄어든다.`,
  };
}

/** 아군 전체 회복형 궁극기(도디 등)가 실제 주문력에서 계산하는 회복량을 조회 가능한 태그로 만든다. */
export function allyHealPowerKeyword(percent: number, ap?: number): KeywordDef | undefined {
  if (ap === undefined) return undefined;
  const amount = Math.round(ap * percent / 100);
  return { id: "heal-value", term: String(amount), kind: "규칙", description: `현재 주문력에서 ${percent}%를 받아 계산한 회복 수치다.` };
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

/** 한글 서수. 순환은 길어야 서넛이라 표 하나로 충분하다. */
const ORDINALS = ["첫", "두", "세", "네", "다섯"].map((word) => `${word} 번째`);

/** 대체되는 걸음의 이름. 규칙어로 정의돼 있으면 태그로 걸어 눌러 볼 수 있게 한다. */
function cycleStepKeyword(step: BasicAttackStep): string {
  const id = CYCLE_STEP_KEYWORDS[step.name];
  return id === undefined ? `「${step.name}」` : `[[${id}|${step.name}]]`;
}

/** 걸음 이름과 규칙어를 잇는 표. 이름이 곧 규칙어인 걸음만 여기 둔다. */
const CYCLE_STEP_KEYWORDS: Readonly<Record<string, string>> = { "갈래화살": "split-arrow" };

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
    const physical = stats.atk === undefined ? `공격력의 ${dual.attackPercent}%` : `[[damage-value|${Math.round(stats.atk.atk * dual.attackPercent / 100)}]]`;
    const magical = stats.ap === undefined ? `주문력의 ${dual.abilityPercent}%` : `[[damage-value|${Math.round(stats.ap * dual.abilityPercent / 100)}]]`;
    return `적 한 명에게 ${physical}의 [[physical-damage|물리 피해]]와 ${magical}의 [[magical-damage|마법 피해]]를 동시에 준다.`
      + finisherClause(skill.finisher)
      + ` 두 늑대가 모두 쓰러져 있는 동안에는 두 피해를 각각 ${dual.aloneAlternatePercent}% 위력으로 번갈아 낸다.`;
  }
  // 무리를 통째로 던지는 궁극기. 지휘자 자신은 때리지 않고 늑대의 돌진과 마무리가 전부다.
  if ("packAssault" in skill && skill.packAssault !== undefined) {
    const assault = skill.packAssault;
    return `적 한 명에게 곁에 선 늑대를 모두 [[charge|돌진]]시켜 각자 ${assault.summonPowerPercent}% 위력의 피해를 준다.`
      + ` 쓰러진 늑대는 다시 설 때까지 남은 시간이 ${assault.resummonHasteSeconds}초 앞당겨지고, 그 자리에서 다시 서면 함께 돌진한다.`
      + finisherClause(skill.finisher);
  }
  // 순수 회복기는 때리는 대상이 없어 "대상 → 피해"로 시작할 수 없다. 회복 계약에서 바로 짓는다.
  if (skill.damageType === undefined || skill.power === undefined) {
    if ("healing" in skill && skill.healing?.kind === "teamMissingHpPercent") {
      return `모든 생존 아군이 각자 [[missing-hp|잃은 체력]]의 ${skill.healing.percent}%를 회복한다.`;
    }
    // 앞에 서는 궁극기. 아무도 때리지 않고 아군의 몫을 대신 받는다.
    if ("selfBulwark" in skill && skill.selfBulwark !== undefined) {
      const plan = skill.selfBulwark;
      return `${plan.seconds}초 동안 모든 아군이 받는 피해를 대신 받고, 그동안 매초 최대 체력의 ${plan.maxHpRegenPercentPerSecond}%를 회복한다.`;
    }
    // 버티는 궁극기. 끌어당겨 붙잡아 두고 덜 맞은 만큼을 끝나고 돌려받는다.
    if ("selfGuard" in skill && skill.selfGuard !== undefined) {
      const guard = skill.selfGuard;
      const shield = stats.maxHp === undefined ? `최대 체력의 ${guard.shieldMaxHpPercent}%` : `[[shield-value|${Math.round(stats.maxHp * guard.shieldMaxHpPercent / 100)}]]`;
      const reset = guard.resetShellGuardCooldown === true ? " [[shell|조가비]] 내부 재사용 대기시간을 초기화한다." : "";
      return `주위 모든 적을 [[pull|끌어당겨]] ${guard.tauntSeconds}초 동안 [[taunt|도발]]하고, ${shield}만큼 보호막을 얻는다.${reset}`;
    }
    // 때리지 않고 자리만 잡는 궁극기. 위력을 적지 않는 이유는 그 피해가 이어질 일반 공격의
    // 몫이기 때문이다 — 여기에 수치를 적으면 같은 한 방이 위아래에서 두 수로 보인다.
    if ("selfSetup" in skill && skill.selfSetup !== undefined) {
      const setup = skill.selfSetup;
      // 은신이 언제 풀리는지는 그 한 방을 언제 쓸지 정하는 정보라 본문이 직접 말한다.
      const exposed = setup.stealthBreaksOnBasic ? ` 그 공격과 함께 [[stealth|은신]]이 풀린다.` : "";
      return `${setup.stealthSeconds}초 동안 [[stealth|은신]]하고 체력이 가장 낮은 적에게 [[teleport|순간이동]]한다.`
        + ` 이후 처음 적중하는 [[basic-attack|기본 공격]]이 확정 치명타가 되고 방어력을 무시하는 [[fixed-damage|고정 피해]]로 들어간다.${exposed}`;
    }
    // 때리지 않고 손을 바꾸는 궁극기. 위력을 적지 않는 이유는 selfSetup과 같다 — 그 피해가
    // 이어질 일반 공격의 몫이라, 여기에 수를 적으면 같은 한 방이 위아래에서 두 수로 보인다.
    if ("selfVolley" in skill && skill.selfVolley !== undefined) {
      const volley = skill.selfVolley;
      return `${volley.seconds}초 동안 [[basic-attack|기본 공격]]이 ${volley.hitCount}번 적중하는 [[combo|연격]]이 되고,`
        + ` [[attack-speed|공격 속도]]가 ${volley.attackSpeedPercent}% 오른다.`;
    }
    // 듀오 한 명에게만 거는 지시. 대상이 전장 전체가 아니라는 것부터 말한다.
    if ("teamBuff" in skill && skill.teamBuff?.kind === "order") {
      const buff = skill.teamBuff;
      return `[[duo|듀오]]에게 ${buff.seconds}초 동안 [[attack-speed|공격 속도]] ${buff.attackSpeedPercent}%,`
        + ` 치명타 확률 ${buff.criticalChancePoints}%, 흡혈 ${buff.lifeStealPoints}%를 부여한다.`;
    }
    // 피해도 회복도 없는 지원 궁극기. 무엇을 얼마나 오래 거는지만 말한다.
    if ("teamBuff" in skill && skill.teamBuff?.kind === "tailwind") {
      const buff = skill.teamBuff;
      const head = `모든 생존 아군에게 ${buff.seconds}초 동안 [[tailwind|순풍]]을 부여한다`;
      // 지속 회복은 순풍 태그가 말하지 않는 이 스킬만의 몫이라 본문이 직접 적는다.
      return buff.maxHpRegenPercentPerSecond === undefined
        ? `${head}.`
        : `${head}. [[tailwind|순풍]]이 지속되는 동안 매초 최대 체력의 ${buff.maxHpRegenPercentPerSecond}%를 회복시킨다.`;
    }
    return skill.desc ?? "";
  }
  // 덧칠을 터뜨리는 궁극기는 위력이 총량이 아니라 겹당 값이라 뼈대가 다르다. "적 전체에 얼마"로
  // 적으면 한 겹만 칠한 적과 다섯 겹을 칠한 적이 같은 수를 맞는 것처럼 읽힌다.
  if ("overpaintDetonation" in skill && skill.overpaintDetonation === true) {
    return `${skillTargetPhrase(skill)} 쌓인 [[overpaint|덧칠]]을 터뜨려 한 겹마다 ${skillDamagePhrase(skill, stats)}를 주고, 그 덧칠을 지운다.`;
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
    const tick = `${skillTargetPhrase(skill)} ${channel.seconds}초 동안 매초 ${skillDamagePhrase(skill, stats)}를 주고 ${clauses.join(" ")}.`;
    const rider = (channel.basicStatusEffects ?? []).map((effect) => statusEffectClause(effect)).filter(Boolean);
    // 손이 닿은 적만 받는 몫은 전장 전체가 받는 틱과 주어가 달라 제 문장으로 선다.
    return rider.length === 0 ? tick
      : `${tick} 그동안 [[basic-attack|기본 공격]]에 맞은 적을 ${rider.join(" ")}.`;
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
      return `${body} ${ORDINALS[cycle.length - 1] ?? `${cycle.length}번째`} 공격은 ${cycleStepKeyword(last)}로 대체된다.`;
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
      return `「${step.name}」 ${skillDescription(stepSkill, { ...stats, damage: stats.cycleDamage?.[index] })}`;
    });
    // **걸음마다 줄을 나눈다.** 한 줄로 쭉 이으면 세 문장이 한 덩어리로 뭉쳐 어디서 걸음이
    // 바뀌는지 읽으려면 「」를 눈으로 찾아야 한다.
    return [`다음 ${cycle.length}가지를 차례로 반복한다.`, ...steps].join("\n");
  }
  const sentences: string[] = [];
  const clauses = skillEffectClauses(skill, stats);
  // 첫 절만 "주고"로 이어 붙이고 나머지는 문장을 끊는다. 셋 이상을 한 문장에 이으면 무엇이
  // 이 스킬의 주 효과인지 읽히지 않는다.
  // 주어가 바뀌지 않는 첫 절만 "주고"로 이어 붙인다. 주기 치명타·전이처럼 주어가 다른 절을
  // 이어 붙이면 한 문장 안에서 말하는 대상이 바뀌어 읽다가 걸린다.
  const joined = clauses.find(({ standalone }) => standalone !== true);
  const head = `${skillTargetPhrase(skill)} ${skillDamagePhrase(skill, stats)}를`;
  // "준다"에 "고"를 그대로 붙이면 인용형 어미("~라고")로 읽힌다. 어간에 연결어미를 붙인
  // "주고" 형태로 갈라야 자연스럽다.
  sentences.push(joined === undefined ? `${head} 준다.` : `${head} 주고${joined.joinWithComma ? "," : ""} ${joined.text}.`);
  for (const clause of clauses) if (clause !== joined) sentences.push(`${clause.text}.`);
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
    clauses.push({ text: `[[reagent|시약]]을 ${skill.reagentStacks}겹 부여한다` });
  }
  const combo = "combo" in skill ? skill.combo : undefined;
  if (combo) {
    clauses.push({ text: `${combo.chancePercent}% 확률로 [[combo|연격]]하여 총 ${combo.hitCount}회 적중한다`, joinWithComma: true });
    clauses.push({ text: `매 적중 뒤 [[missing-hp|잃은 체력]]의 ${combo.missingHpHealingPercentPerHit}%를 회복한다` });
  }
  if ("damageHealingPercent" in skill && skill.damageHealingPercent !== undefined) {
    clauses.push({ text: `입힌 피해의 ${skill.damageHealingPercent}%만큼 체력을 회복한다`, joinWithComma: true });
  }
  if ("damageHealingPercentIfFrozen" in skill && skill.damageHealingPercentIfFrozen !== undefined) {
    clauses.push({ text: `[[frozen|빙결]] 상태의 적에게 입힌 피해라면 그중 ${skill.damageHealingPercentIfFrozen}%만큼 체력을 회복한다`, standalone: true });
  }
  if ("shieldFromDamagePercent" in skill && skill.shieldFromDamagePercent !== undefined) {
    clauses.push({ text: `입힌 피해의 ${skill.shieldFromDamagePercent}%만큼 보호막을 얻는다`, joinWithComma: true });
  }
  if ("selfStealthSeconds" in skill && skill.selfStealthSeconds !== undefined) {
    // 몇 초인지는 걸음마다 다를 수 있으므로 본문이 적는다 — 태그는 은신이 무엇인지만 말한다.
    clauses.push({ text: `${skill.selfStealthSeconds}초 동안 [[stealth|은신]]한다`, joinWithComma: true });
  }
  if ("allyShieldFromDamagePercent" in skill && skill.allyShieldFromDamagePercent !== undefined) {
    // 나눠 갖는다는 말이 핵심이다 — 여럿을 함께 벨수록 한 명이 받는 몫이 커지는 것이 아니라
    // 총량이 커지고, 그 총량을 아군 수로 나눈다.
    clauses.push({ text: `입힌 피해의 총합 중 ${skill.allyShieldFromDamagePercent}%를 자신을 포함한 모든 생존 아군이 똑같이 나눠 보호막으로 얻는다`, joinWithComma: true });
  }
  // 몇 초 날아가고 몇 번 튕기는지는 적지 않는다 — 날아가는 그림이 곧 그 답이고, 태그가
  // "날아가는 동안 움직이지도 때리지도 못한다"까지 이미 말한다.
  if ("pull" in skill && skill.pull !== undefined) {
    clauses.push({ text: `[[pull|끌어당긴다]]` });
  }
  if ("lowestHpAllyHealingFromDamagePercent" in skill && skill.lowestHpAllyHealingFromDamagePercent !== undefined) {
    clauses.push({ text: `입힌 피해의 ${skill.lowestHpAllyHealingFromDamagePercent}%만큼 현재 체력이 가장 낮은 생존 아군을 회복한다`, joinWithComma: true });
  }
  if ("allyHealingPower" in skill && skill.allyHealingPower !== undefined) {
    const heal = allyHealPowerKeyword(skill.allyHealingPower, stats.ap);
    const healText = heal === undefined ? `주문력의 ${skill.allyHealingPower}%` : `[[heal-value|${heal.term}]]`;
    clauses.push({ text: `모든 생존 아군의 체력을 ${healText}만큼 회복한다`, joinWithComma: true });
  }
  if (skill.allyEnergyGain !== undefined) {
    clauses.push({ text: `모든 생존 아군의 궁극기 게이지가 ${skill.allyEnergyGain} 오른다`, standalone: true });
  }
  // 아군 전체가 아니라 듀오 한 명에게만 흘러간다. 두 값이 같으면 한 번만 말한다 — 다른
  // 값이 되는 순간 다시 나열해야 한다.
  if (skill.duoCharge !== undefined) {
    const { energy, ferocity } = skill.duoCharge;
    clauses.push({
      text: energy === ferocity
        ? `[[duo|듀오]]의 궁극기 게이지와 [[ferocity|야성]]이 각각 ${energy} 오른다`
        : `[[duo|듀오]]의 궁극기 게이지가 ${energy}, [[ferocity|야성]]이 ${ferocity} 오른다`,
      standalone: true,
    });
  }
  clauses.push(...statusClauses(skill));
  if ("damageTransfer" in skill && skill.damageTransfer) {
    clauses.push({ text: `그 적이 실제로 잃은 최종 HP 피해의 ${skill.damageTransfer.percent}%를 가장 가까운 다른 적에게 [[transfer|전이]]한다`, standalone: true });
  }
  if ("curseTransfer" in skill && skill.curseTransfer) {
    clauses.push({ text: `그 적의 [[curse|저주]]가 이미 최대라면 실제로 잃은 최종 HP 피해의 ${skill.curseTransfer.percent}%를 가장 가까운 다른 적에게 [[transfer|전이]]하고 저주를 씌운다. 전이된 적의 저주도 최대였다면 같은 방식으로 이어진다`, standalone: true });
  }
  if ("energyRefundOnKill" in skill && skill.energyRefundOnKill !== undefined) {
    clauses.push({ text: `이 공격으로 처치하면 궁극기 게이지를 ${skill.energyRefundOnKill} 돌려받는다`, standalone: true });
  }
  if ("periodicCritical" in skill && skill.periodicCritical) {
    clauses.push({ text: `매 ${skill.periodicCritical.every}번째 실제 [[basic-attack|기본 공격]]은 확정 치명타가 된다`, standalone: true });
  }
  // 여울은 **쓰는 개체가 하나뿐인 규칙어**라 반경·시간·둔화·확정 연격을 태그가 갖는다.
  // 본문이 그걸 다시 늘어놓으면 한 문장이 그 규칙 하나로 가득 찬다.
  if ("shallows" in skill && skill.shallows !== undefined) {
    clauses.push({ text: `공격한 자리에 [[shallows|여울]]이 고인다`, standalone: true });
  }
  if ("chargeStartsAtHpPercent" in skill && skill.chargeStartsAtHpPercent !== undefined) {
    clauses.push({ text: `체력이 ${skill.chargeStartsAtHpPercent}% 이하가 되면 충전을 시작한다`, standalone: true });
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
    texts.push(`[[concussion|뇌진탕]]을 입히고 ${stun.seconds}초 동안 [[stun|기절]]시킨다`);
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
  if (stack !== undefined) return [{ text: `[[${stack.id}|${stack.term}]]을 한 겹 쌓는다` }];
  if (texts.length === 0) return [];
  // 주기가 있는 스킬은 상태 절을 피해 문장에 붙이지 않고 제 문장으로 세운다.
  if (every !== undefined) return [{ text: `매 ${every}번째 공격마다 ${texts.join(" ")}`, standalone: true }];
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
  if (effect.kind === "overpaint") return `[[overpaint|덧칠]]을 한 겹 쌓는다`;
  if (effect.kind === "stun") return `${effect.seconds}초 동안 [[stun|기절]]시킨다`;
  // 뇌진탕의 수치와 치명타 배증은 키워드가 말하므로 본문은 걸린다는 사실만 적는다.
  if (effect.kind === "concussion") return `[[concussion|뇌진탕]]을 입힌다`;
  // 터지는 위력과 회복 비율은 태그가 말하므로 본문은 표식을 남긴다는 사실만 적는다.
  if (effect.kind === "weakpoint") return `[[weakpoint|약점 포착]]을 남긴다`;
  // 겹 상한과 터지는 위력은 태그가 말하므로 본문은 겹이 쌓인다는 사실만 적는다.
  if (effect.kind === "butcher") return `[[butcher|손질]]을 한 겹 쌓는다`;
  if (effect.kind === "stagger") return `[[stagger|경직]]시킨다`;
  if (effect.kind === "bleed") return `${effect.seconds}초 동안 [[bleed|출혈]]시켜 매초 최대 체력의 ${effect.maxHpPercentPerSecond}%를 잃게 한다`;
  // 매초 얼마인지는 태그가 말한다(쓰는 개체가 하나뿐이다). 시간만 스킬마다 달라 본문이 적는다.
  if (effect.kind === "poison") return `${effect.seconds}초 동안 [[poison|중독]]시킨다`;
  // 겹 상한·감소율·유지 시간은 저주 태그가 말한다(쓰는 개체가 하나뿐이라 태그가 수치를 가진다).
  if (effect.kind === "curse") return `[[curse|저주]]를 한 겹 씌운다`;
  // 겹당 감소율과 상한은 **스킬마다 다르므로 본문이 적는다** — 매디와 시로가 같은 태그를 쓰는
  // 순간 태그가 수치를 못 박으면 한쪽 설명이 거짓말이 된다(출혈이 그랬다). 최대 중첩에서
  // 빙결로 바뀌는 것은 패시브의 몫이라 여기서 말하지 않는다.
  if (effect.kind === "chill") {
    return `[[chill|둔화]]를 한 겹 쌓아 최대 ${effect.maxStacks}겹까지 겹마다 공격 속도와 이동 속도를 ${effect.speedPercentPerStack}% 낮춘다`;
  }
  // 반대로 광란의 시간은 스킬마다 다르므로 본문이 적는다 — 출혈이 그런 것과 같은 이유다.
  if (effect.kind === "frenzy") return `${effect.seconds}초 동안 [[frenzy|광란]]시킨다`;
  // 겹 상한·감소율·유지 시간·터지는 위력은 밴덜리즘 태그가 말한다(쓰는 개체가 하나뿐이라
  // 태그가 수치를 가진다). 둘째 개체가 이 규칙어를 갖게 되면 출혈처럼 본문으로 옮긴다.
  if (effect.kind === "vandalism") return `[[vandalism|밴덜리즘]]을 한 겹 쌓는다`;
  // 도발은 붙잡아 두는 시간이 곧 스킬마다 다른 값이라 본문이 초를 적는다.
  if (effect.kind === "taunt") return `${effect.seconds}초 동안 [[taunt|도발]]한다`;
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
  if (targeting === "nearbyEnemies") return "자신의 주위 모든 적에게";
  // 걸음 이름이 이미 「갈래화살」이고 몇 명까지 갈라지는지는 태그가 말한다 — 본문은 어디를
  // 중심으로 갈라지는지만 적어, 한 줄에서 같은 말이 두 번 나오지 않게 한다.
  if (targeting === "splitShot") return "표적과 그 주위의 적에게";
  if (targeting === "battlefieldEnemies") return "전장의 모든 적에게";
  if (targeting === "targetedCircle") return "지정한 원 안의 모든 적에게";
  // 돌진은 시전 시점의 자리가 아니라 지나간 길이 대상이라, 원·전장과 다른 말로 적는다.
  if (targeting === "chargeLine") return "[[charge|돌진]]해 뚫고 지나간 길의 모든 적에게";
  return "적 한 명에게";
}

/**
 * 피해 한 덩어리.
 *
 * 실제 수치는 스킬 아이콘 위 라벨이 쓰는 그 값을 그대로 받고(두 곳이 따로 계산하면 같은
 * 스킬의 피해가 위아래에서 다른 수로 보인다), 능력치를 모르는 자리에서만 위력(%)으로
 * 되돌아간다. 그때도 어느 능력치에서 나오는 배율인지 함께 말한다.
 */
function skillDamagePhrase(skill: DescribedSkill, stats: SkillDescriptionStats): string {
  const damageTag = skill.damageType === "physical" ? "[[physical-damage|물리 피해]]" : "[[magical-damage|마법 피해]]";
  // 위력과 현재 공격 속도를 하나의 배율로 합쳐 쓰는 스킬(스피나 궁극기)만 두 축을 합친다.
  if ("attackSpeedPower" in skill && skill.attackSpeedPower !== undefined) {
    const composite = attackSpeedCompositeDamageKeyword(skill, stats.atk?.atk, stats.atk?.attackSpeed);
    return composite === undefined
      ? `공격력의 ${skill.power}%와 현재 [[attack-speed|공격 속도]]의 ${skill.attackSpeedPower}%를 합친 ${damageTag}`
      : `[[damage-value|${composite.term}]]의 ${damageTag}`;
  }
  if (stats.damage !== undefined) return `[[damage-value|${stats.damage}]]의 ${damageTag}`;
  const label = (scaling: "atk" | "ap" | "def" | "hp" | undefined): string => scaling === "def" ? "방어력"
    : scaling === "hp" ? "최대 체력"
      : scaling === "ap" || (scaling === undefined && skill.damageType === "magical") ? "주문력"
        : "공격력";
  const secondary = "secondaryScaling" in skill ? skill.secondaryScaling : undefined;
  // 능력치를 모르는 자리(도감)에서도 두 축을 모두 말한다 — 한쪽만 적으면 실제 피해의 절반만
  // 설명한 문장이 된다.
  if (secondary) return `${label(skill.scalingStat)}의 ${skill.power}%와 ${label(secondary.stat)}의 ${secondary.power}%를 더한 ${damageTag}`;
  return `${label(skill.scalingStat)}의 ${skill.power}% ${damageTag}`;
}

/** 스킬별 피해 회복은 최대 체력 회복과 다른 계약이므로 실제 피해 기준임을 명시한다. */
export function damageHealingLabel(percent?: number): string | undefined {
  return percent === undefined ? undefined : `실제 피해의 ${percent}% 회복`;
}
