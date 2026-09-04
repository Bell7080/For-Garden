import type { DamagePreview } from "../core/damage";
import type { KeywordDef } from "../data/keywords";
import type { KeywordTextOptions } from "../managers/KeywordManager";
import type { BasicAttack, CombatStatusEffect, FerocityTrait, Passive, Skill, Ultimate } from "../core/types";

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
  if (targeting === "battlefieldEnemies") return "전장의 모든 적";
  if (targeting === "targetedCircle") return "지정한 원 안의 모든 적과 생존 아군";
  if (targeting === "chargeLine") return "[[charge|돌진]]해 뚫고 지나간 길의 모든 적";
  return undefined;
}

/** 상태 효과 계약을 팝업과 테스트가 함께 쓰는 짧은 문구로 바꾼다. */
export function statusEffectLabel(effect?: CombatStatusEffect): string | undefined {
  if (effect?.kind === "stun") return `[[stun|기절]] ${effect.seconds}초`;
  // 경직은 항상 0.1초인 용어 규칙을 키워드 설명이 담당하므로 요약줄에서 시간을 중복하지 않는다.
  if (effect?.kind === "stagger") return "[[stagger|경직]]";
  if (effect?.kind === "bleed") return `[[bleed|출혈]] ${effect.seconds}초 · 매초 최대 체력 ${effect.maxHpPercentPerSecond}%`;
  return undefined;
}

/** 지속 회복 수치는 특정 캐릭터를 사전에 하드코딩하지 않고 현재 정의에서 만든다. */
export function recoveryLabel(percent?: number): string | undefined {
  return percent === undefined ? undefined : `매초 최대 체력의 ${percent}% 회복`;
}

/** 어느 캐릭터나 같은 양식으로 피해 수치의 능력치 출처와 적용 배율을 열어 볼 수 있게 한다. */
export function damageKeyword(preview?: DamagePreview): KeywordDef | undefined {
  if (preview?.kind !== "scaling") return undefined;
  return {
    id: "damage-value",
    term: String(preview.amount),
    kind: "규칙",
    description: `현재 ${preview.stat}에서 ${preview.power}%를 받아 계산한 피해 수치다.`,
  };
}

/** 요약과 본문이 같은 동적 키워드 사전을 쓰도록 순수 레이아웃 옵션을 한 경계에서 결합한다. */
export function skillKeywordLayoutOptions(
  skill: { contextualKeywords?: readonly KeywordDef[] },
  options: Omit<KeywordTextOptions, "contextualKeywords">,
): KeywordTextOptions {
  return { ...options, contextualKeywords: skill.contextualKeywords };
}

/** 폭주 설명의 모든 수치를 실제 전투 계약에서 만들어 밸런스 조정 후 문구가 남지 않게 한다. */
export function ferocityTraitDescription(trait: FerocityTrait, stats?: { attack: number; defense: number }): string {
  if (trait.effectId === "attackIntervalReduction") return `공격 간격이 ${trait.reductionPercent}% 짧아진다.`;
  if (trait.effectId === "damageReduction") return `받는 피해가 ${trait.reductionPercent}% 줄어든다.`;
  // 덧셈형 확률도 플레이어에게는 일반적인 퍼센트 기호로 보여 주고 내부 산술 단위는 노출하지 않는다.
  if (trait.effectId === "teamMoveSpeedBonus") return `생존 아군 전체의 이동 속도가 ${trait.bonusPercent}% 빨라진다.`;
  if (trait.effectId === "rexBattleQueen") return `치명타 확률과 모든 피해 흡혈이 각각 ${trait.criticalChancePoints}%, ${trait.allDamageLifeStealPoints}% 증가한다.`;
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
  if (trait.effectId === "butcherFeast") return `[[butcher|손질]]이 터진 피해의 ${trait.healPercent}%만큼 생존 아군 전체를 회복시킨다.`;
  // 몇 번 튕기는지도 몇 초인지도 적지 않는다. 날아가는 그림이 곧 그 답이고, 그 수가 플레이어의
  // 다음 조작을 바꾸지 않는다 — 태그가 "날아가는 동안 움직이지도 때리지도 못한다"까지 말한다.
  if (trait.effectId === "knockbackSlam") return `[[concussion|뇌진탕]]이 확정 치명타가 되고, 그 적을 [[knockback|날려버린다]]. 날려버린 뒤에는 가장 가까운 적을 표적으로 다시 지정한다.`;
  // 광란은 시간이 스킬마다 다르므로(궁극 4초 · 폭주 2초) 태그가 아니라 본문이 초를 적는다.
  if (trait.effectId === "frenzyGaze") return `폭주 중 [[basic-attack|기본 공격]]에 적중한 적을 ${trait.seconds}초 동안 [[frenzy|광란]]시킨다. 전이된 타격으로는 발동하지 않는다.`;

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
 * 치명타 확률을 올리는 패시브의 공통 절.
 *
 * 렉시아처럼 그 사실을 이미 제 문장에서 말하는 종류는 뺀다 — 같은 말을 두 번 하게 된다.
 */
function passiveCriticalClause(passive: Passive): string {
  if (passive.criticalChancePercent === undefined || passive.kind === "battleMaidMastery") return "";
  return `치명타 확률이 ${passive.criticalChancePercent}% 오른다.`;
}

function passiveHead(passive: Passive, atk?: number): string {
  if (passive.kind === "followHighestAttackAllyTarget") return `전투 시작 시 아군 중 공격력이 가장 높은 렐릭이 표적으로 삼은 적을 함께 표적으로 삼는다.`;
  if (passive.kind === "basicHitAttackSpeedStack") return `[[basic-attack|기본 공격]]이 실제 적중할 때마다 이번 전투 동안 [[attack-speed|공격 속도]]가 ${passive.value} 증가한다.`;
  if (passive.kind === "adagioWeight") {
    const shield = passiveShieldKeyword(passive, atk);
    const shieldText = shield === undefined ? `공격력 ${passive.cleanseShieldAttackPercent}%` : `[[shield-value|${shield.term}]]`;
    return `생존 중 아군 [[attack-speed|공격 속도]]를 ${passive.teamAttackSpeedPercent}% 높인다. 아군이 [[crowd-control|군중제어]]에 걸리면 즉시 정화하고 ${shieldText} 보호막을 부여한다.`;
  }
  if (passive.kind === "abyssalPressure") return `완전히 경과한 매초 기본 [[ap|주문력]]의 ${passive.apPercentPerSecond}%가 복리로 누적된다. 현재 체력이 최대 체력의 100%에서 ${passive.maxReductionAtHpPercent}%로 낮아질수록 받는 모든 피해 감소가 ${passive.baseDamageReductionPercent}%에서 ${passive.maxDamageReductionPercent}%까지 선형으로 증가하며, 그 이하에서는 최대치로 제한된다. 최종 받는 피해가 ${passive.ignoreDamageAtOrBelow} 이하인 공격은 무효화한다.`;
  if (passive.kind === "gourmetHunt") return `전투를 시작할 때 현재 체력이 가장 낮은 적을 표적으로 삼고 그 자리로 [[teleport|순간이동]]한다. 적을 처치하면 즉시, 그 밖에는 ${passive.huntCooldownSeconds}초마다 다시 고른다.`;
  if (passive.kind === "cursedInsight") return `[[curse|저주]]에 걸린 적에게 [[basic-attack|기본 공격]]을 직접 적중시킬 때마다 이번 전투 동안 [[ap|주문력]]이 ${passive.value}% 증가한다. 최대 ${passive.maxStacks}회까지 쌓이며, [[transfer|전이]]된 타격으로는 발동하지 않는다.`;
  if (passive.kind === "impactCap") return `한 번에 받는 피해가 최대 체력의 ${passive.impactCapMaxHpPercent}%를 넘지 않는다.`;
  if (passive.kind === "overpaintSiphon") return `모든 아군이 [[overpaint|덧칠]]된 적을 맞히면 그 피해의 ${passive.value}%만큼 자신의 체력을 회복한다. 표적의 [[overpaint|덧칠]]이 최대로 쌓이면 다른 적으로 표적을 옮긴다.`;
  if (passive.kind === "lowHpVanish") return `전투당 한 번, 체력이 절반 이하가 되면 ${passive.durationSeconds}초 동안 [[stealth|은신]]해 표적에서 벗어난다.`;
  if (passive.kind === "shimmerMark") return `적을 타격하면 반짝이는 표식을 남긴다. 표식이 없는 적을 타격하면 표식이 그 적에게 옮겨가며 [[ap|주문력]]의 ${passive.value}% [[magical-damage|마법 피해]]를 추가로 입힌다.`;
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
  skill: Skill | BasicAttack | Ultimate,
  stats: SkillDescriptionStats = {},
): string {
  // 순수 회복기는 때리는 대상이 없어 "대상 → 피해"로 시작할 수 없다. 회복 계약에서 바로 짓는다.
  if (skill.damageType === undefined || skill.power === undefined) {
    if ("healing" in skill && skill.healing?.kind === "teamMissingHpPercent") {
      return `모든 생존 아군이 각자 [[missing-hp|잃은 체력]]의 ${skill.healing.percent}%를 회복한다.`;
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
function skillEffectClauses(skill: Skill | BasicAttack | Ultimate, stats: SkillDescriptionStats): SkillEffectClause[] {
  const clauses: SkillEffectClause[] = [];
  const combo = "combo" in skill ? skill.combo : undefined;
  if (combo) {
    clauses.push({ text: `${combo.chancePercent}% 확률로 [[combo|연격]]하여 총 ${combo.hitCount}회 적중한다`, joinWithComma: true });
    clauses.push({ text: `매 적중 뒤 [[missing-hp|잃은 체력]]의 ${combo.missingHpHealingPercentPerHit}%를 회복한다` });
  }
  if ("damageHealingPercent" in skill && skill.damageHealingPercent !== undefined) {
    clauses.push({ text: `입힌 피해의 ${skill.damageHealingPercent}%만큼 체력을 회복한다`, joinWithComma: true });
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
function statusClauses(skill: Skill | BasicAttack | Ultimate): SkillEffectClause[] {
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
  if (texts.length === 0) return [];
  const every = "statusEffectEvery" in skill ? skill.statusEffectEvery : undefined;
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
  // 겹 상한과 터지는 위력은 태그가 말하므로 본문은 겹이 쌓인다는 사실만 적는다.
  if (effect.kind === "butcher") return `[[butcher|손질]]을 한 겹 쌓는다`;
  if (effect.kind === "stagger") return `[[stagger|경직]]시킨다`;
  if (effect.kind === "bleed") return `${effect.seconds}초 동안 [[bleed|출혈]]시켜 매초 최대 체력의 ${effect.maxHpPercentPerSecond}%를 잃게 한다`;
  // 겹 상한·감소율·유지 시간은 저주 태그가 말한다(쓰는 개체가 하나뿐이라 태그가 수치를 가진다).
  if (effect.kind === "curse") return `[[curse|저주]]를 한 겹 씌운다`;
  // 반대로 광란의 시간은 스킬마다 다르므로 본문이 적는다 — 출혈이 그런 것과 같은 이유다.
  if (effect.kind === "frenzy") return `${effect.seconds}초 동안 [[frenzy|광란]]시킨다`;
  return undefined;
}

/**
 * 문장을 여는 대상.
 *
 * 전투 엔진이 읽는 대상 계약(`targeting`)에서 그대로 만든다 — 설명문이 대상을 따로 적으면
 * 실제로 맞는 범위와 갈린다. 지정 원은 아군도 함께 판정하지만 **피해를 받는 것은 적뿐**이라
 * 요약줄(`targetingLabel`)과 달리 여기서는 적만 말한다.
 */
function skillTargetPhrase(skill: Skill | BasicAttack | Ultimate): string {
  const targeting = "targeting" in skill ? skill.targeting : undefined;
  if (targeting === "nearbyEnemies") return "자신의 주위 모든 적에게";
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
function skillDamagePhrase(skill: Skill | BasicAttack | Ultimate, stats: SkillDescriptionStats): string {
  const damageTag = skill.damageType === "physical" ? "[[physical-damage|물리 피해]]" : "[[magical-damage|마법 피해]]";
  // 위력과 현재 공격 속도를 하나의 배율로 합쳐 쓰는 스킬(스피나 궁극기)만 두 축을 합친다.
  if ("attackSpeedPower" in skill && skill.attackSpeedPower !== undefined) {
    const composite = attackSpeedCompositeDamageKeyword(skill, stats.atk?.atk, stats.atk?.attackSpeed);
    return composite === undefined
      ? `공격력의 ${skill.power}%와 현재 [[attack-speed|공격 속도]]의 ${skill.attackSpeedPower}%를 합친 ${damageTag}`
      : `[[damage-value|${composite.term}]]의 ${damageTag}`;
  }
  if (stats.damage !== undefined) return `[[damage-value|${stats.damage}]]의 ${damageTag}`;
  const stat = skill.scalingStat === "def" ? "방어력"
    : skill.scalingStat === "ap" || (skill.scalingStat === undefined && skill.damageType === "magical") ? "주문력"
      : "공격력";
  return `${stat}의 ${skill.power}% ${damageTag}`;
}

/** 스킬별 피해 회복은 최대 체력 회복과 다른 계약이므로 실제 피해 기준임을 명시한다. */
export function damageHealingLabel(percent?: number): string | undefined {
  return percent === undefined ? undefined : `실제 피해의 ${percent}% 회복`;
}
