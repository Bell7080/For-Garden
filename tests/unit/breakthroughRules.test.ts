import { describe, expect, it } from "vitest";
import type { BreakthroughEffects, RelicDef } from "../../src/core/types";
import { RELICS } from "../../src/data/relics";

/**
 * 한계 돌파 설계 규칙을 **코드로 못 박는다** (`docs/breakthrough-design.md`).
 *
 * 새 효과 종류(`kind`)를 더하면 아래 표가 컴파일 오류로 막는다 — 분류를 적는 순간 직군·주기·생존 규칙과 대조하게 된다.
 * 분류는 그 효과가 **무엇을 건드리는가**이고, 이름이 아니다.
 */

type Slots = NonNullable<BreakthroughEffects>;
type EffectKind = NonNullable<Slots[keyof Slots]>["kind"];

type Category =
  | "none"
  /** 피해량을 직접 올리거나 추가 피해를 만든다. */
  | "damage"
  /** 이동·도약·사거리·자리를 바꾼다. */
  | "mobility"
  /** 치명타를 만든다. */
  | "crit"
  /** 은신. 암살자의 생존 몫은 이것으로만 준다. */
  | "stealth"
  /** 경직·기절 같은 행동 제어를 만들거나 늘린다. */
  | "control"
  /** 회복·보호막·몸 키우기 — 버티는 몫. */
  | "survival"
  /** 팀 전체나 듀오·아군에게 거는 지원. */
  | "support"
  /** 궁극기 게이지·주기를 바꾼다. 기절을 가진 궁극기에서는 영구 기절 체인이 된다. */
  | "cadence";

const CATEGORY: Record<EffectKind, Category> = {
  none: "none",
  // 기본 공격
  periodicGuard: "survival",
  deepBleed: "damage",
  frostBrand: "damage",
  doublePlume: "damage",
  critPlume: "crit",
  stealthStrike: "stealth",
  splitHealing: "survival",
  arrowEcho: "damage",
  leapPuddle: "mobility",
  farPing: "mobility",
  staccatoChain: "control",
  focusFire: "damage",
  // 궁극기
  echo: "damage",
  execution: "cadence",
  healingShield: "survival",
  forestSight: "damage",
  tidalEcho: "damage",
  orderStrike: "damage",
  shrapnel: "damage",
  lightChorus: "cadence",
  // 폭주
  feverBulwark: "survival",
  cleavingBasics: "damage",
  feverShare: "survival",
  feverAmbush: "stealth",
  ambushCrit: "crit",
  pingStorm: "damage",
  crescendoRamp: "damage",
  ankleShot: "control",
  // 패시브
  sharedRecovery: "survival",
  battleMaidAscension: "survival",
  rescueShield: "survival",
  fullFocusCrit: "crit",
  huntChain: "mobility",
  relink: "support",
  adagioSlam: "control",
  highTide: "damage",
  scoldTaunt: "control",
  bulwarkPayback: "damage",
  heatOverflow: "survival",
  sweeterWound: "survival",
  clawBleed: "damage",
  windStep: "support",
  afterimageSlash: "damage",
  gustEnergy: "cadence",
  frenzyClaws: "crit",
  windPull: "cadence",
  huntMark: "crit",
  windEcho: "cadence",
  dreadAegis: "survival",
  quarryMark: "support",
  spreadingDread: "control",
  terrorCarapace: "survival",
  // 탱커 계약(수압·까칠·졸음)을 새 동작으로 보여 주는 효과들
  pressureConduct: "control",
  thornJab: "damage",
  sleepPounce: "damage",
  deepSink: "control",
  wallReflect: "damage",
  lullabyGaze: "control",
  vortexDraw: "control",
  heatChain: "survival",
  yawnContagion: "control",
  salvageShare: "support",
  thornStorm: "damage",
  softBreath: "survival",
  helmetBash: "damage",
  underline: "damage",
  sodaFizz: "control",
  dashBack: "damage",
  contagiousFrenzy: "control",
  coolingVent: "survival",
  chainCollision: "control",
  finalChapter: "control",
  frostCling: "control",
  impactCapTighten: "survival",
  extraChapter: "damage",
  iceShatter: "damage",
  wetMark: "damage",
  paintSpill: "damage",
  tightStitch: "support",
  splashCharge: "cadence",
  splashPaint: "damage",
  bigWave: "damage",
  paintChain: "damage",
  doubleNeedle: "support",
  touchBurst: "damage",
  vitalSketch: "crit",
  stitchedMight: "damage",
  poisonPulse: "damage",
  bleedSettle: "damage",
  extraCard: "damage",
  bleedFeast: "damage",
  rePoison: "damage",
  swiftHands: "damage",
  blightedFoe: "damage",
  landingAmbush: "crit",
  pupLitter: "damage",
  pupRush: "damage",
  pupFrenzy: "damage",
  packStrength: "damage",
  releaseShield: "damage",
  freshSight: "damage",
  speedGraffiti: "damage",
  shareShield: "support",
  jointObservation: "damage",
  signatureBurst: "damage",
  adamantShield: "survival",
  droneOverheat: "damage",
  closeUp: "damage",
  undyingBulwark: "survival",
  manyEyes: "damage",
  muralHide: "survival",
  // 보스(레이드·폰토스) — 회복·보호막·경감·강인함은 더하지 않는다(공유 게이지·자리가 갖는다).
  pressStagger: "control",
  biteMark: "damage",
  coiledTarget: "damage",
  piercingBeak: "damage",
  widenArea: "damage",
  sunkenWeight: "control",
  unhealedMark: "control",
  feverWidenBasic: "damage",
  hungryStride: "mobility",
  longFeast: "control",
  sharpStorm: "crit",
  pressureCrack: "damage",
  scarMight: "damage",
  warmBody: "damage",
  pinningPlume: "control",
};

/** 직군이 받을 수 없는 분류. 암살자·원거리 딜러는 은신이 아닌 생존 유틸과 게이지 조작을 받지 않는다. */
const FORBIDDEN: Partial<Record<RelicDef["role"], readonly Category[]>> = {
  assassin: ["survival", "cadence", "support"],
};

/**
 * 궁극기 게이지·주기를 바꾸는 효과 중 **명시적으로 승인된 것**. 새 항목은 이유와 함께 더한다.
 * - execution: 렉시아(SSR 전사)의 처치 환급. 기절이 없는 궁극기라 체인이 생기지 않는다.
 * - lightChorus: 메테(SSR 지원가)의 게이지 −15. 회복 궁극기라 기절이 없고, 회복량은 잃은 체력 비례다.
 * - splashCharge: 티아(R 전사)의 표식 폭발 환급(+6). 폭발은 표식을 한 번 남기고 한 번 지우는 순환이라 평타 두 번에 한 번뿐이고, 궁극기에 기절이 없어 체인이 생기지 않는다.
 * - gustEnergy·windPull·windEcho: 스테라(SR 지원가)의 「아군에게 에너지를 준다」는 정체성. 스테라의 궁극기는 피해·기절이 없는 순풍이고,
 *   총량은 시전 한 번(+10)·폭주 중 평타 한 번(+5, 한 명)·은신 진입 한 번(+10)으로 묶여 있어 기절 체인이 생기지 않는다.
 */
const CADENCE_APPROVED = new Set<EffectKind>(["execution", "lightChorus", "gustEnergy", "windPull", "windEcho", "splashCharge"]);

function effectsOf(relic: RelicDef): { slot: keyof Slots; kind: EffectKind }[] {
  const effects = relic.breakthroughEffects;
  if (!effects) return [];
  return (Object.keys(effects) as (keyof Slots)[]).map((slot) => ({ slot, kind: effects[slot]!.kind }));
}

describe("한계 돌파 설계 규칙", () => {
  it("은 직군이 받을 수 없는 분류의 효과를 갖지 않는다", () => {
    for (const relic of RELICS) {
      const forbidden = FORBIDDEN[relic.role] ?? [];
      for (const { slot, kind } of effectsOf(relic)) {
        expect(forbidden, `${relic.name}(${relic.role}) ${slot}: ${kind} — ${CATEGORY[kind]}`).not.toContain(CATEGORY[kind]);
      }
    }
  });

  it("은 궁극기 게이지·주기를 바꾸는 효과를 승인된 것만 쓴다", () => {
    for (const relic of RELICS) {
      for (const { slot, kind } of effectsOf(relic)) {
        if (CATEGORY[kind] !== "cadence") continue;
        expect(CADENCE_APPROVED.has(kind), `${relic.name} ${slot}: ${kind}는 승인 목록에 없다`).toBe(true);
      }
    }
  });

  it("은 기절을 거는 궁극기가 주기를 바꾸는 돌파를 가지려면 같은 적에게 다시 걸리는 시간을 제한한다", () => {
    for (const relic of RELICS) {
      const cadence = effectsOf(relic).some(({ kind }) => CATEGORY[kind] === "cadence");
      const stuns = "statusEffects" in relic.ultimate && (relic.ultimate.statusEffects ?? []).some((effect) => effect.kind === "stun");
      if (!cadence || !stuns) continue;
      expect("stunLockoutSeconds" in relic.ultimate && relic.ultimate.stunLockoutSeconds !== undefined, `${relic.name}`).toBe(true);
    }
  });

  it("은 폭주 돌파가 궁극기와 엮이지 않는다", () => {
    // 자동 전투에서 폭주와 궁극기가 겹치는 순간을 따로 잡거나 셈하지 않기 위해서다(docs/breakthrough-design.md §4).
    for (const relic of RELICS) {
      const ferocity = relic.breakthroughEffects?.ferocity;
      if (!ferocity) continue;
      expect(JSON.stringify(ferocity).toLowerCase(), `${relic.name} 폭주 돌파`).not.toContain("ultimate");
    }
  });

  it("은 돌파를 정의한 개체가 네 슬롯을 모두 정의한다", () => {
    for (const relic of RELICS) {
      if (relic.breakthroughEffects === undefined) continue;
      expect(Object.keys(relic.breakthroughEffects).sort(), relic.name).toEqual(["basic", "ferocity", "passive", "ultimate"]);
    }
  });
});
