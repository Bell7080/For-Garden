import { EXPEDITION_CC_POLICY, expeditionControlCooldown } from "../core/expeditionCcPolicy";
import { expeditionStatAugmentLabel } from "../data/expeditionStatAugments";
import { expeditionTagTerm, expeditionPayloadTag } from "../data/expeditionTagAugments";
import { type KeywordDef } from "../data/keywords";
import type { ExpeditionAugmentDef } from "../data/expeditionAugments";
import { t } from "../i18n";


const DETAIL_KEYS = {
  scar: "augment.tag.detail.scar",
  ferocity: "augment.tag.detail.ferocity", cleanse: "augment.tag.detail.cleanse",
  bleed: "augment.tag.detail.bleed", stun: "augment.tag.detail.stagger", frenzy: "augment.tag.detail.frenzy", knockback: "augment.tag.detail.knockback",
  tailwind: "augment.tag.detail.tailwind", order: "augment.tag.detail.order", regeneration: "augment.tag.detail.regeneration", shield: "augment.tag.detail.shield",
  concussion: "augment.tag.detail.concussion", stagger: "augment.tag.detail.stagger", poison: "augment.tag.detail.poison",
  overpaint: "augment.tag.detail.overpaint", curse: "augment.tag.detail.curse", butcher: "augment.tag.detail.butcher",
  frostPlume: "augment.tag.detail.frostPlume", vandalism: "augment.tag.detail.vandalism", pressure: "augment.tag.detail.pressure",
  drowsy: "augment.tag.detail.drowsy", intimidate: "augment.tag.detail.intimidate", chill: "augment.tag.detail.chill",
  taunt: "augment.tag.detail.taunt", fear: "augment.tag.detail.fear", shell: "augment.tag.detail.shell", reagent: "augment.tag.detail.reagent",
} as const;

/** 카드마다 별도 문맥 사전: 약한 증강이 원본 스킬의 강한 수치를 설명하지 않게 한다. */
export function expeditionAugmentKeywords(def: ExpeditionAugmentDef): KeywordDef[] {
  const effect = def.effect;
  if (effect.kind === "flatStat" && effect.stat === "lifeSteal") return [{ id: "augment-tag", term: t("stat.lifeSteal"), kind: "buff", description: t("augment.stat.detail.lifeSteal", { points: effect.points }) }];
  if (effect.kind !== "triggered" || effect.everyN === undefined) return [];
  const payload = effect.payload;
  const kind = expeditionPayloadTag(payload);
  const values = payload.kind === "status" ? payload.status : payload.kind === "shell" || payload.kind === "reagent" ? payload.contract : payload.kind === "teamBuff" ? payload.buff : payload;
  let detail: string;
  if (payload.kind === "frozen") detail = t("status.frozen.detail", { time: t("status.seconds", { value: payload.seconds }), percent: payload.maxHpPercentOnExpire });
  else if (payload.kind === "stealth") detail = t("skill.clause.selfStealth", { seconds: payload.seconds });
  else if (payload.kind === "teamBuff" && payload.buff.kind === "resonance") detail = `${t("augment.percent", { label: t("stat.attackSpeed"), percent: payload.buff.attackSpeedPercent })} · ${t("status.seconds", { value: payload.buff.seconds })}`;
  else {
    if (!(kind in DETAIL_KEYS)) return [];
    detail = t(DETAIL_KEYS[kind as keyof typeof DETAIL_KEYS], { healingReceivedReductionPercent: 0, ...values });
  }
  const limits = t("augment.tag.limits", { max: effect.limits.maxTriggers, cooldown: effect.limits.cooldownSeconds });
  const control = expeditionControlCooldown(payload) === undefined ? "" : `\n${t("augment.tag.controlRecovery", { cap: EXPEDITION_CC_POLICY.maxSeconds, gap: EXPEDITION_CC_POLICY.recoverySeconds })}`;
  const rule = t(effect.limits.target === "self" && payload.kind !== "shell" ? "augment.tag.selfRule" : effect.trigger === "onDamaged" ? "augment.tag.receivedRule" : "augment.tag.attackRule");
  return [{ id: "augment-tag", term: expeditionTagTerm(kind),
    kind: effect.limits.target === "self" ? "buff" : "debuff", description: `${detail}\n${limits}\n${rule}${control}` }];
}

export function expeditionTagAugmentLabel(def: ExpeditionAugmentDef): string | undefined {
  const statLabel = expeditionStatAugmentLabel(def, true);
  if (statLabel) return statLabel;
  const [keyword] = expeditionAugmentKeywords(def);
  if (!keyword || def.effect.kind !== "triggered") return undefined;
  const effect = def.effect;
  const tag = `[[augment-tag|${keyword.term}]]`;
  const stacks = effect.payload.kind === "shell" || effect.payload.kind === "reagent" ? effect.payload.stacks : effect.applications ?? 1;
  const label = t(effect.trigger === "onDamaged" ? (effect.payload.kind === "shell" ? "augment.tag.received" : "augment.tag.selfReceived") : effect.trigger === "onUltimateCast" ? "augment.tag.cast" : effect.trigger === "onUltimateHit" ? "augment.tag.ultimate" : effect.limits.target === "self" && effect.payload.kind !== "shell" ? "augment.tag.selfBasic" : "augment.tag.basic", { every: effect.everyN!, tag, stacks });
  return expeditionControlCooldown(effect.payload) === undefined ? label : `${label}\n${t("augment.tag.controlCooldown", { cooldown: effect.limits.cooldownSeconds })}`;
}
