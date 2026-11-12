import { EXPEDITION_CC_POLICY, expeditionControlCooldown } from "../core/expeditionCcPolicy";
import { expeditionStatAugmentLabel } from "../data/expeditionStatAugments";
import { expeditionTagTerm, expeditionPayloadTag } from "../data/expeditionTagAugments";
import { type KeywordDef } from "../data/keywords";
import type { ExpeditionAugmentDef } from "../data/expeditionAugments";
import { t } from "../i18n";
import { formatEffectDescription } from "./skillExplanation";


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
    detail = t(DETAIL_KEYS[kind as keyof typeof DETAIL_KEYS], { healingReceivedReductionPercent: 0, ...(values as unknown as Readonly<Record<string, string | number | undefined>>) });
  }
  const limits = t("augment.tag.limits", { max: effect.limits.maxTriggers, cooldown: effect.limits.cooldownSeconds });
  const controlValues = { cap: EXPEDITION_CC_POLICY.maxSeconds, gap: EXPEDITION_CC_POLICY.recoverySeconds };
  const hasControl = expeditionControlCooldown(payload) !== undefined;
  const control = hasControl ? t("augment.tag.controlSummary", controlValues) : "";
  const rule = t(effect.limits.target === "self" && payload.kind !== "shell" ? "augment.tag.selfRule" : effect.trigger === "onDamaged" ? "augment.tag.receivedRule" : "augment.tag.attackRule");
  // 효과는 먼저 읽고, 발동 제한은 별도 칸에서 확인한다. 공격 계산의 예외는
  // 한 겹 더 눌러 읽는다. 공용 스킬 용어 팝업의 칸 배치와 문장 강조를 재사용한다.
  const rulesId = "augment-rules";
  return [{ id: "augment-tag", term: expeditionTagTerm(kind),
    kind: effect.limits.target === "self" ? "buff" : "debuff",
    description: formatEffectDescription([detail, control].filter(Boolean).join(" ")),
    sections: [{ label: t("augment.tag.activation"), name: "", text: `${formatEffectDescription(limits)}\n\n[[${rulesId}|${t("augment.tag.rulesLink")}]]` }],
  }, { id: rulesId, term: t("augment.tag.rules"), kind: "rule",
    description: [rule, hasControl ? t("augment.tag.controlRecovery", controlValues) : ""].filter(Boolean).join(" "),
  }];
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
