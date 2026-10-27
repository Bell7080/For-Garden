import { expeditionControlCooldown } from "../core/expeditionCcPolicy";
import { t } from "../i18n";
import type { ExpeditionAugmentDef } from "./expeditionAugments";
import type { CombatStatusEffect, Passive, ReagentReaction } from "../core/types";

const TAG_TERM_KEYS = {
  scar: "status.scar", ferocity: "augment.tag.name.ferocity", cleanse: "augment.tag.name.cleanse",
  bleed: "status.bleed", stun: "status.stun", frenzy: "status.frenzy", frozen: "status.frozen",
  knockback: "augment.tag.name.knockback", tailwind: "augment.tag.name.tailwind", order: "augment.tag.name.order",
  resonance: "augment.tag.name.resonance", regeneration: "augment.tag.name.regeneration", stealth: "augment.tag.name.stealth", shield: "augment.tag.name.shield",
  concussion: "augment.tag.name.concussion", stagger: "augment.tag.name.stagger", frostPlume: "status.plume",
  poison: "status.poison", overpaint: "status.overpaint", curse: "status.curse", butcher: "status.butcher",
  vandalism: "status.vandalism", pressure: "status.pressure", drowsy: "status.drowsy", intimidate: "status.intimidation",
  chill: "status.chill", taunt: "status.taunt", fear: "status.fear", shell: "status.shell", reagent: "status.reagent",
} as const;

/** 전투 코어가 스킬 팝업 사전을 역으로 import하지 않게 용어의 UI 키만 참조한다. */
export function expeditionTagTerm(kind: string): string {
  return t(TAG_TERM_KEYS[kind as keyof typeof TAG_TERM_KEYS] ?? "augment.tag.name.frostPlume");
}

/** 원정 전용 수치. 원본 스킬이나 적 전용 돌파 정의를 변경하지 않는다. */
export const EXPEDITION_SHELL: NonNullable<Passive["shellGuard"]> = {
  maxStacks: 3, durationSeconds: 30, cooldownSeconds: 6,
  selfShieldMaxHpPercent: 8, lowestHpAllyShieldMaxHpPercent: 4,
};
export const EXPEDITION_REAGENT: ReagentReaction = {
  maxStacks: 3, seconds: 16, basicStacks: 0, ultimateStacks: 0,
  reactionPoisonSeconds: 3, lowestHpAllyHealMaxHpPercent: 3,
  resistanceReductionPercent: 8, resistanceReductionSeconds: 4,
};

/** 특수 편성 없이 자체 발동하는 태그만 포함한다. 관측·약점 포착·반향은 전용 후속 스킬이 필요해 제외. */
export const EXPEDITION_TAG_PLANS = [
  { id: "bleed", everyN: 3, cooldown: 3, maxTriggers: 8, status: { kind: "bleed", seconds: 2, maxHpPercentPerSecond: 0.15 } },
  { id: "stun", everyN: 5, cooldown: 5, maxTriggers: 5, status: { kind: "stun", seconds: 0.25 } },
  { id: "frenzy", everyN: 6, cooldown: 8, maxTriggers: 4, status: { kind: "frenzy", seconds: 0.4 } },
  { id: "knockback", everyN: 6, cooldown: 8, maxTriggers: 4, status: { kind: "knockback", seconds: 0.25, speed: 140, bounces: 1 } },
  { id: "concussion", everyN: 4, cooldown: 3, maxTriggers: 8, status: { kind: "concussion", maxHpPercent: 0.5, criticalMaxHpPercent: 0.5 } },
  { id: "stagger", everyN: 4, cooldown: 3, maxTriggers: 8, status: { kind: "stagger", seconds: 0.15 } },
  { id: "poison", everyN: 3, cooldown: 3, maxTriggers: 8, status: { kind: "poison", seconds: 3, attackPercentPerSecond: 8, abilityPercentPerSecond: 8 } },
  { id: "overpaint", everyN: 4, cooldown: 3, maxTriggers: 8, status: { kind: "overpaint", seconds: 8, damageTakenPercent: 3, maxStacks: 3 } },
  { id: "curse", everyN: 3, cooldown: 3, maxTriggers: 8, status: { kind: "curse", seconds: 6, resistancePercent: 4, maxStacks: 3 } },
  { id: "butcher", everyN: 3, cooldown: 2, maxTriggers: 12, status: { kind: "butcher", maxStacks: 3, burstPower: 180 } },
  { id: "frostPlume", everyN: 3, cooldown: 2, maxTriggers: 12, status: { kind: "frostPlume", maxStacks: 3, holdSeconds: 12, burstPower: 60, burstSeconds: 3, slowSeconds: 2, slowPercent: 10 } },
  { id: "vandalism", everyN: 3, cooldown: 2, maxTriggers: 12, status: { kind: "vandalism", offenseShredPercent: 2, maxStacks: 4, burstPower: 180 } },
  { id: "pressure", everyN: 3, cooldown: 2, maxTriggers: 12, status: { kind: "pressure", speedPercentPerStack: 3, maxStacks: 3, seconds: 12, stunSeconds: 0.4, defensePower: 55, resistancePower: 55, lockoutSeconds: 6 } },
  { id: "drowsy", everyN: 3, cooldown: 2, maxTriggers: 12, status: { kind: "drowsy", maxStacks: 3, seconds: 12, sleepSeconds: 0.6, wakeResistancePower: 45, groggySeconds: 2, groggyAttackSpeedPercent: 8 } },
  { id: "intimidate", everyN: 3, cooldown: 2, maxTriggers: 12, status: { kind: "intimidate", maxStacks: 3, seconds: 12, fearSeconds: 0.6, immunitySeconds: 6 } },
  { id: "chill", everyN: 4, cooldown: 3, maxTriggers: 8, status: { kind: "chill", speedPercentPerStack: 3, maxStacks: 3 } },
  { id: "taunt", everyN: 4, cooldown: 4, maxTriggers: 6, status: { kind: "taunt", seconds: 0.6 } },
  { id: "fear", everyN: 4, cooldown: 6, maxTriggers: 5, status: { kind: "fear", seconds: 0.4, immunitySeconds: 6 } },
] as const satisfies readonly { id: string; everyN: number; cooldown: number; maxTriggers: number; status: CombatStatusEffect }[];

/** 실행 payload와 화면 태그의 이름을 한 경계에서 판정한다. 흉터는 조가비의 자기 보호막 변형이다. */
export function expeditionPayloadTag(payload: Extract<ExpeditionAugmentDef["effect"], { kind: "triggered" }>["payload"]): string {
  return payload.kind === "status" ? payload.status.kind : payload.kind === "teamBuff" ? payload.buff.kind
    : payload.kind === "shell" && payload.contract.stackId === "scar" ? "scar" : payload.kind;
}

function tagDef(id: string, rarity: "sr" | "ssr", trigger: "onBasicHit" | "onUltimateHit" | "onUltimateCast" | "onDamaged", everyN: number, payload: Extract<ExpeditionAugmentDef["effect"], { kind: "triggered" }>["payload"], cooldownSeconds: number, maxTriggers: number, group: string): ExpeditionAugmentDef {
  cooldownSeconds = expeditionControlCooldown(payload) ?? cooldownSeconds;
  const beneficial = payload.kind === "ferocity" || payload.kind === "cleanse" || payload.kind === "teamBuff" || payload.kind === "regeneration" || payload.kind === "stealth" || payload.kind === "shield" || payload.kind === "shell";
  const category = payload.kind === "shield" || payload.kind === "shell" ? "shield" : payload.kind === "regeneration" ? "recovery" : "status";
  return { id, get name() {
    const kind = expeditionPayloadTag(payload);
    const tag = expeditionTagTerm(kind);
    if (id.endsWith("-light")) return t("augment.tag.name.light", { tag });
    return t(trigger === "onDamaged" ? (payload.kind === "shell" ? "augment.tag.name.received" : "augment.tag.name.receivedEffect") : trigger === "onUltimateHit" || trigger === "onUltimateCast" ? "augment.tag.name.ultimate" : "augment.tag.name.basic", { tag });
  }, rarity, target: "relic", category, maxStacks: 1,
    stacking: { mode: "strongest" }, exclusiveGroup: group, tags: [category, "relic", "tag", group],
    effect: { kind: "triggered", trigger, everyN, applications: rarity === "ssr" && payload.kind === "status" && "maxStacks" in payload.status ? 2 : 1, payload, limits: { maxTriggers, cooldownSeconds, maxStacks: 1, target: beneficial ? "self" : "hitTarget" } } };
}

function ultimateStatus(status: CombatStatusEffect): CombatStatusEffect {
  if (status.kind === "bleed") return { ...status, seconds: 3, maxHpPercentPerSecond: 0.25, healingReceivedReductionPercent: 15 };
  if (status.kind === "stun") return { ...status, seconds: 0.5 };
  if (status.kind === "frenzy") return { ...status, seconds: 0.6 };
  if (status.kind === "knockback") return { ...status, seconds: 0.4, speed: 180 };
  if (status.kind === "concussion") return { ...status, maxHpPercent: 0.8, criticalMaxHpPercent: 0.8 };
  if (status.kind === "stagger") return { ...status, seconds: 0.3 };
  if (status.kind === "poison") return { ...status, seconds: 4, attackPercentPerSecond: 16, abilityPercentPerSecond: 16 };
  if (status.kind === "curse") return { ...status, seconds: 10, resistancePercent: 6 };
  if (status.kind === "frostPlume") return { ...status, burstPower: 90 };
  if (status.kind === "vandalism") return { ...status, offenseShredPercent: 3, burstPower: 270 };
  if (status.kind === "pressure") return { ...status, defensePower: 80, resistancePower: 80, stunSeconds: 0.6 };
  if (status.kind === "drowsy") return { ...status, sleepSeconds: 0.6, wakeResistancePower: 70, groggyAttackSpeedPercent: 12 };
  if (status.kind === "intimidate") return { ...status, fearSeconds: 0.6 };
  if (status.kind === "fear") return { ...status, seconds: 0.6 };
  if (status.kind === "taunt") return { ...status, seconds: 0.6 };
  return status;
}

/** 아군 강화는 사용 후 발동하므로 회복·지원 궁극기 보유자도 활용할 수 있다. */
const SUPPORT_TAG_PLANS = [
  { id: "ferocity", everyN: 5, cooldown: 6, maxTriggers: 5, basic: { kind: "ferocity", points: 4 }, ultimate: { kind: "ferocity", points: 8 } },
  { id: "cleanse", everyN: 5, cooldown: 8, maxTriggers: 3, basic: { kind: "cleanse" }, ultimate: { kind: "cleanse" } },
  { id: "tailwind", everyN: 4, cooldown: 6, maxTriggers: 6, basic: { kind: "teamBuff", buff: { kind: "tailwind", attackSpeedPercent: 20, moveSpeedPercent: 20, seconds: 2.5 } }, ultimate: { kind: "teamBuff", buff: { kind: "tailwind", attackSpeedPercent: 30, moveSpeedPercent: 30, seconds: 4.5 } } },
  { id: "order", everyN: 5, cooldown: 6, maxTriggers: 6, basic: { kind: "teamBuff", buff: { kind: "order", attackSpeedPercent: 12, criticalChancePoints: 4, lifeStealPoints: 4, seconds: 2.5 } }, ultimate: { kind: "teamBuff", buff: { kind: "order", attackSpeedPercent: 20, criticalChancePoints: 6, lifeStealPoints: 6, seconds: 4.5 } } },
  { id: "resonance", everyN: 4, cooldown: 6, maxTriggers: 6, basic: { kind: "teamBuff", buff: { kind: "resonance", attackSpeedPercent: 24, seconds: 2.5 } }, ultimate: { kind: "teamBuff", buff: { kind: "resonance", attackSpeedPercent: 36, seconds: 4.5 } } },
  { id: "regeneration", everyN: 5, cooldown: 6, maxTriggers: 6, basic: { kind: "regeneration", seconds: 3, maxHpPercentPerSecond: 1.5 }, ultimate: { kind: "regeneration", seconds: 4, maxHpPercentPerSecond: 2 } },
  { id: "stealth", everyN: 6, cooldown: 8, maxTriggers: 3, basic: { kind: "stealth", seconds: 0.6 }, ultimate: { kind: "stealth", seconds: 1 } },
  { id: "shield", everyN: 4, cooldown: 6, maxTriggers: 6, basic: { kind: "shield", maxHpPercent: 2 }, ultimate: { kind: "shield", maxHpPercent: 4 } },
] as const satisfies readonly { id: string; everyN: number; cooldown: number; maxTriggers: number; basic: Extract<ExpeditionAugmentDef["effect"], { kind: "triggered" }>["payload"]; ultimate: Extract<ExpeditionAugmentDef["effect"], { kind: "triggered" }>["payload"] }[];

export const EXPEDITION_TAG_AUGMENTS: readonly ExpeditionAugmentDef[] = [
  tagDef("tag-scar-basic", "sr", "onDamaged", 4, { kind: "shell", stacks: 1, contract: { maxStacks: 2, durationSeconds: 30, cooldownSeconds: 8, selfShieldMaxHpPercent: 10, lowestHpAllyShieldMaxHpPercent: 0, stackId: "scar" } }, 1, 8, "tag-shell"),
  tagDef("tag-scar-ultimate", "ssr", "onUltimateCast", 1, { kind: "shell", stacks: 2, contract: { maxStacks: 2, durationSeconds: 30, cooldownSeconds: 8, selfShieldMaxHpPercent: 10, lowestHpAllyShieldMaxHpPercent: 0, stackId: "scar" } }, 8, 4, "tag-shell"),
  ...SUPPORT_TAG_PLANS.flatMap(plan => [
    tagDef(`tag-${plan.id}-basic`, "sr", plan.id === "stealth" || plan.id === "cleanse" ? "onDamaged" : "onBasicHit", plan.everyN, plan.basic, plan.cooldown, plan.maxTriggers, `tag-${plan.id}`),
    tagDef(`tag-${plan.id}-ultimate`, "ssr", "onUltimateCast", 1, plan.ultimate, plan.cooldown, plan.maxTriggers, `tag-${plan.id}`),
  ]),
  tagDef("tag-frozen-basic", "sr", "onBasicHit", 6, { kind: "frozen", seconds: 0.35, maxHpPercentOnExpire: 0.1 }, 8, 4, "tag-frozen"),
  tagDef("tag-frozen-ultimate", "ssr", "onUltimateHit", 1, { kind: "frozen", seconds: 0.6, maxHpPercentOnExpire: 0.2 }, 8, 4, "tag-frozen"),
  ...EXPEDITION_TAG_PLANS.flatMap(plan => [
    tagDef(`tag-${plan.id}-basic`, "sr", "onBasicHit", plan.everyN, { kind: "status", status: plan.status }, plan.cooldown, plan.maxTriggers, `tag-${plan.id}`),
    tagDef(`tag-${plan.id}-ultimate`, "ssr", "onUltimateHit", 1, { kind: "status", status: ultimateStatus(plan.status) }, Math.max(4, plan.cooldown), plan.maxTriggers, `tag-${plan.id}`),
  ]),
  tagDef("tag-concussion-light", "sr", "onBasicHit", 3, { kind: "status", status: { kind: "concussion", maxHpPercent: 0.3, criticalMaxHpPercent: 0.3 } }, 3, 10, "tag-concussion"),
  tagDef("tag-shell-received", "sr", "onDamaged", 6, { kind: "shell", stacks: 1, contract: { ...EXPEDITION_SHELL, maxStacks: 2 } }, 1, 9, "tag-shell"),
  tagDef("tag-shell-basic", "sr", "onBasicHit", 4, { kind: "shell", stacks: 1, contract: EXPEDITION_SHELL }, 2, 9, "tag-shell"),
  tagDef("tag-shell-ultimate", "ssr", "onUltimateHit", 1, { kind: "shell", stacks: 2, contract: EXPEDITION_SHELL }, 6, 6, "tag-shell"),
  tagDef("tag-reagent-basic", "sr", "onBasicHit", 3, { kind: "reagent", stacks: 1, contract: EXPEDITION_REAGENT }, 2, 12, "tag-reagent"),
  tagDef("tag-reagent-ultimate", "ssr", "onUltimateHit", 1, { kind: "reagent", stacks: 2, contract: EXPEDITION_REAGENT }, 6, 6, "tag-reagent"),
];

/** 구 저장은 계속 해석하지만 새 후보에는 모호한 상태 위력·복합 조건을 제안하지 않는다. */
export const RETIRED_EXPEDITION_AUGMENTS: ReadonlySet<string> = new Set([
  "minor-blood-edge", "blood-edge",
  "reactive-medium", "volatile-atmosphere", "critical-incision", "hex-overload", "stun-breaker",
]);
