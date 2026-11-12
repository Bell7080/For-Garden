import type { BreakthroughSlot } from "../core/relicProgression";
import type {
  BasicBreakthrough, FerocityBreakthrough, PassiveBreakthrough, RelicDef, UltimateBreakthrough,
} from "../core/types";
import { t } from "../i18n";
import { damageKindTag, healingCutTag, keywordTag, statusTag, type SkillTag } from "./skillTags";

/**
 * 한계 돌파가 그 기술에 **새로 얹는** 칩.
 *
 * 돌파 줄은 문장만으로는 "기절이 붙는다"·"보호막이 생긴다"가 본문 속에 묻혀, 스킬 칩만 훑는 손에는
 * 돌파로 무엇이 늘었는지가 읽히지 않는다. 그래서 돌파 줄에도 스킬 칩과 **같은 모양·같은 색**의 칩을
 * 따로 한 줄 세운다 — 기본 칩 줄에 섞으면 처음부터 있던 효과로 읽히므로 섞지 않는다.
 *
 * 칩은 돌파 효과의 종류(`kind`)가 정한다. 전투(`skirmish.ts`)가 그 효과에서 실제로 거는 상태·내는
 * 피해 종류·주는 막을 옮겨 적은 표이고, 수치나 조건(「출혈 중인 적에게」)은 칩으로 세우지 않는다 —
 * 그 몫은 돌파 문장이 말한다. 피해만 늘리는 효과처럼 새 갈래가 없는 종류는 표에 없다.
 * 기본 칩에 이미 선 칩은 화면이 걸러 낸다(`newBreakthroughTags`).
 */
type AnyBreakthrough = BasicBreakthrough | UltimateBreakthrough | FerocityBreakthrough | PassiveBreakthrough;
type Kind = AnyBreakthrough["kind"];
type Of<K extends Kind> = Extract<AnyBreakthrough, { kind: K }>;

const stun = (seconds: number) => statusTag({ kind: "stun", seconds });
const taunt = (seconds: number) => statusTag({ kind: "taunt", seconds });
const chill = () => keywordTag("chill", "debuff", "tag-debuff");
const shield = () => keywordTag("shield", "shield", "contrib-defense");
const stealth = (seconds: number) => keywordTag("stealth", "buff", "tag-buff", seconds);
const keyword = (id: string, tone: "control" | "debuff" | "mark" | "buff") =>
  keywordTag(id, tone, tone === "control" ? "tag-control" : tone === "debuff" ? "tag-debuff" : tone === "mark" ? "tag-mark" : "tag-buff");
const stagger = () => keyword("stagger", "control");
const bleed = () => keyword("bleed", "debuff");
const heal = (): SkillTag => ({ tone: "heal", glyph: "contrib-heal", text: t("skill.effect.healing") });
const lifesteal = (percent: number): SkillTag => ({ tone: "heal", glyph: "contrib-heal", text: t("skill.tag.lifesteal", { percent }) });
const bulwark = (): SkillTag => ({ tone: "buff", glyph: "tag-buff", text: t("skill.tag.bulwark") });

const BREAKTHROUGH_TAGS: { readonly [K in Kind]?: (effect: Of<K>) => readonly (SkillTag | undefined)[] } = {
  // 제어
  startledLeap: (effect) => [stun(effect.stunSeconds)],
  chainSwing: (effect) => [damageKindTag("physical"), stun(effect.stunSeconds)],
  shellKnock: (effect) => [stun(effect.seconds)],
  ankleShot: (effect) => [stun(effect.stunSeconds)],
  pressStagger: (effect) => [stun(effect.seconds)],
  staccatoChain: () => [keyword("stun", "control")],
  pinningPlume: () => [stagger()],
  ironBarSweep: () => [stagger()],
  overture: () => [damageKindTag("magical"), stagger()],
  periodicGuard: (effect) => [heal(), taunt(effect.tauntSeconds)],
  feverBulwark: (effect) => [shield(), taunt(effect.tauntSeconds)],
  scoldTaunt: (effect) => [taunt(effect.tauntSeconds)],
  cageIn: (effect) => [taunt(effect.tauntSeconds)],
  chainEntry: () => [keyword("knockback", "control"), keyword("concussion", "debuff")],
  vortexDraw: () => [keyword("pull", "control"), keyword("pressure", "control")],
  roarEntry: () => [keyword("intimidation", "control")],
  lullabyGaze: () => [keyword("drowsy", "control")],
  yawnContagion: () => [keyword("drowsy", "control")],
  deepSink: () => [keyword("pressure", "control")],
  pressureConduct: () => [keyword("pressure", "control")],
  // 약화·표식
  bleedingSmash: () => [bleed()],
  clawBleed: () => [bleed()],
  servingCall: () => [bleed()],
  bloodTaste: () => [bleed(), keyword("butcher", "debuff")],
  sodaPop: () => [chill()],
  coldSnap: () => [chill()],
  snagClaw: () => [chill()],
  chainWrap: () => [chill()],
  dustCloud: () => [chill()],
  helmetBash: () => [damageKindTag("physical"), keyword("concussion", "debuff")],
  dashBack: () => [keyword("concussion", "debuff")],
  readersGather: () => [keyword("curse", "debuff")],
  afterglow: () => [keyword("curse", "debuff")],
  doubleDab: () => [keyword("reagent", "debuff")],
  richBomb: () => [keyword("reagent", "debuff")],
  deepBleed: () => [keyword("deep-bleed", "debuff"), healingCutTag()],
  unhealedMark: () => [healingCutTag()],
  saltedIngredient: () => [healingCutTag()],
  paintSpill: () => [keyword("overpaint", "mark")],
  splashPaint: () => [keyword("overpaint", "mark")],
  paintChain: () => [keyword("overpaint", "mark")],
  // 피해 종류
  heatBurst: () => [damageKindTag("fixed")],
  extraCard: () => [damageKindTag("fixed")],
  releaseShield: () => [damageKindTag("physical")],
  iceShatter: () => [damageKindTag("physical")],
  chainShrapnel: () => [damageKindTag("physical")],
  resonantShield: () => [damageKindTag("magical")],
  wallReflect: () => [damageKindTag("magical")],
  pressureCrack: () => [damageKindTag("magical")],
  // 막·은신·회복·강화
  rescueShield: () => [shield()],
  healingShield: () => [shield()],
  meteorEncore: () => [heal()],
  secondStar: () => [heal()],
  starfallChance: () => [damageKindTag("magical")],
  feverShare: () => [shield()],
  preyScale: () => [shield()],
  reloadSip: () => [shield()],
  richBlend: () => [shield()],
  thickShell: () => [shield()],
  bigShell: () => [shield()],
  cheekShield: () => [shield()],
  salvageShare: () => [shield()],
  shareShield: () => [shield()],
  youngestCare: () => [shield()],
  lightChorus: () => [shield()],
  doubleNeedle: () => [shield()],
  leapVeil: (effect) => [stealth(effect.stealthSeconds)],
  tailHide: (effect) => [stealth(effect.seconds)],
  feverAmbush: (effect) => [stealth(effect.stealthSeconds)],
  feverGale: () => [keyword("tailwind", "buff")],
  starlitCheer: () => [keyword("attack-speed", "buff")],
  longGust: () => [keyword("tailwind", "buff")],
  twinHum: () => [keyword("resonance", "buff")],
  feverGuard: () => [bulwark()],
  sharedRecovery: () => [heal()],
  coolingVent: () => [heal()],
  undyingBulwark: () => [heal()],
  ultimateLifeSteal: (effect) => [lifesteal(effect.damageHealingPercent)],
  bloodFever: (effect) => [lifesteal(effect.lifeStealPoints)],
};

/** 표에 칩을 적어 둔 돌파 종류. 테스트가 표와 데이터를 맞춰 본다. */
export const BREAKTHROUGH_TAG_KINDS: readonly string[] = Object.keys(BREAKTHROUGH_TAGS);

/** 그 슬롯의 돌파 효과가 얹는 칩 전부. 효과가 없거나 새 갈래가 없으면 빈 목록이다. */
export function breakthroughTags(def: Pick<RelicDef, "breakthroughEffects">, slot: BreakthroughSlot): SkillTag[] {
  const effect = def.breakthroughEffects?.[slot] as AnyBreakthrough | undefined;
  if (effect === undefined || effect.kind === "none") return [];
  const build = BREAKTHROUGH_TAGS[effect.kind] as ((effect: AnyBreakthrough) => readonly (SkillTag | undefined)[]) | undefined;
  const seen = new Set<string>();
  return (build?.(effect) ?? []).filter((tag): tag is SkillTag => {
    if (tag === undefined || seen.has(tag.text)) return false;
    seen.add(tag.text);
    return true;
  });
}

/** 기본 칩 줄에 이미 선 것을 뺀 돌파 칩 — 같은 칩이 두 줄에 서면 무엇이 늘었는지 흐려진다. */
export function newBreakthroughTags(tags: readonly SkillTag[], base: readonly SkillTag[]): SkillTag[] {
  // 시간이 붙은 칩(`기절 1초`)도 같은 규칙어면 같은 칩이다 — 규칙어가 있으면 그 ID로, 없으면 글로 견준다.
  const key = (tag: SkillTag) => /^\[\[([^|\]]+)\|/.exec(tag.text)?.[1] ?? tag.text;
  const present = new Set(base.map(key));
  return tags.filter((tag) => !present.has(key(tag)));
}
