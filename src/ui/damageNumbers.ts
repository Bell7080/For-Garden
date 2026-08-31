import { COLOR } from "./theme";

/**
 * 전투 수치 한 개를 어떻게 그릴지 정하는 **순수 규칙**.
 *
 * 씬은 이 결과만 읽어 글자를 세운다. 색·크기·머무는 시간을 화면에서 눈대중으로 고르면
 * 같은 세기의 타격이 화면마다 다른 무게로 보이고, "얼마나 아팠나"를 크기로 읽을 수 없다.
 *
 * 규칙은 둘이다.
 * 1. **세기는 크기로 말한다.** 대상의 최대 체력 대비 비율로 등급을 매기므로, 성장해서
 *    숫자가 커져도 "한 방에 얼마나 깎였나"가 그대로 크기에 남는다.
 * 2. **종류는 색으로 말한다.** 회복·보호막·출혈·고정·물리·마법·무효가 각자의 색을 갖고,
 *    문장이나 이름표를 덧붙이지 않는다.
 */

/** 수치 한 개의 성격. 색과 표식은 여기서만 갈린다. */
export type DamageFlavor =
  /** 방어력이 막는 피해. */
  | "physical"
  /** 저항이 막는 피해. */
  | "magical"
  /** 방어를 거치지 않는 고정 피해(출혈 전이·심해 압력 등). */
  | "true"
  /** 1초마다 흐르는 출혈 피해. */
  | "bleed"
  | "heal"
  /** 보호막이 대신 받아 낸 양. */
  | "shield"
  /** 경감이 끝까지 막아 낸 무효 타격. */
  | "blocked";

export interface DamagePopupRequest {
  amount: number;
  flavor: DamageFlavor;
  /** 치명타는 한 등급 크게 서고 파편이 함께 튄다. */
  critical?: boolean;
  /** 궁극기 피해는 한 등급 크고 강조색으로 선다. */
  ultimate?: boolean;
  /** 아군이 받은 피해. 색이 위험색으로 바뀐다. */
  incoming?: boolean;
  /** 속성 상성 결과. 중립이면 생략한다. */
  effectiveness?: "advantage" | "disadvantage";
  /** 대상의 경감이 실제로 깎아 낸 타격. 한 등급 작고 옅게 선다. */
  mitigated?: boolean;
  /** 크기 등급의 기준이 되는 대상 최대 체력. 없으면 절대값 표로 되돌아간다. */
  maxHp?: number;
}

/** 씬이 그대로 옮겨 그리는 표시 계약. 여기 없는 값을 화면이 새로 정하지 않는다. */
export interface DamagePopupStyle {
  /** 접두·수·접미를 이미 합친 최종 문자열. */
  text: string;
  /** 0(잔타)~4(한 방). 크기·시간·흔들림이 모두 이 등급에서 나온다. */
  tier: number;
  size: number;
  color: string;
  stroke: string;
  strokeWidth: number;
  /** 떠오르는 거리(px). */
  rise: number;
  /** 등장 순간의 확대 배율. 등급이 높을수록 크게 튄다. */
  punch: number;
  /** 다 커진 뒤 제자리에 머무는 시간(ms). 작은 수도 읽을 틈을 준다. */
  holdMs: number;
  /** 떠오르며 사라지는 시간(ms). */
  riseMs: number;
  /** 카메라 흔들림 세기. 0이면 흔들지 않는다. */
  shake: number;
  /** 숫자 뒤로 튀는 마름모 파편 수. 0이면 글자만 뜬다. */
  sparks: number;
}

/**
 * 등급 경계. 대상 최대 체력의 몇 할을 한 번에 깎았는지로 가른다.
 *
 * 절대 수치로 가르면 레벨이 오를수록 모든 타격이 최대 등급으로 붙어 크기가 뜻을 잃는다.
 */
export const DAMAGE_TIER_RATIOS: readonly number[] = [0.02, 0.05, 0.11, 0.22];
/** 최대 체력을 모르는 수치(발굴 수확 같은 화면 밖 값)를 위한 되돌림 표. */
export const DAMAGE_TIER_ABSOLUTE: readonly number[] = [200, 800, 3_000, 12_000];

/** 등급별 글자 크기. 가장 작은 잔타도 예전 기본값(30)보다 크다. */
export const DAMAGE_TIER_SIZES: readonly number[] = [34, 44, 56, 72, 92];
/** 등급별 머무는 시간. 큰 한 방일수록 오래 남아 눈이 따라간다. */
const TIER_HOLD_MS: readonly number[] = [170, 200, 240, 300, 360];
const TIER_RISE_MS: readonly number[] = [700, 780, 880, 1_000, 1_150];
const TIER_RISE_PX: readonly number[] = [78, 92, 110, 132, 156];
const TIER_PUNCH: readonly number[] = [1.12, 1.18, 1.26, 1.36, 1.5];
const TIER_SPARKS: readonly number[] = [0, 0, 3, 5, 8];

/** 최고 등급의 큰 한 방만 화면을 흔든다. 잔타까지 흔들면 난전 내내 화면이 떨린다. */
const TIER_SHAKE: readonly number[] = [0, 0, 0, 0.004, 0.008];

/**
 * 성격별 색.
 *
 * 물리는 흰빛, 마법은 하늘빛, 고정 피해는 보랏빛, 출혈은 짙은 다크체리다. 회복은 체력과
 * 같은 연두, 보호막은 에너지와 같은 푸른빛이라 게이지에서 본 색이 그대로 이어진다.
 */
export const DAMAGE_FLAVOR_COLOR: Record<DamageFlavor, string> = {
  physical: COLOR.ink,
  magical: "#9fd6f5",
  true: "#c9b6ff",
  bleed: "#e2564f",
  heal: COLOR.hpText,
  shield: "#a9c8ee",
  blocked: COLOR.inkDim,
};

/** 상성 표식. 문장을 쓰지 않고 방향만 알린다. */
const EFFECTIVENESS_MARK = { advantage: "▲", disadvantage: "▼" } as const;

/** 다섯 자리부터는 자릿수를 끊어 준다. 전투 중에 한눈에 자릿수를 세기 위해서다. */
export function formatDamageAmount(amount: number): string {
  const rounded = Math.max(0, Math.round(amount));
  return rounded >= 10_000 ? rounded.toLocaleString("en-US") : String(rounded);
}

/** 비율 표와 절대값 표 중 읽을 수 있는 쪽으로 기본 등급을 정한다. */
function baseTier(amount: number, maxHp: number | undefined): number {
  const table = maxHp && maxHp > 0 ? DAMAGE_TIER_RATIOS : DAMAGE_TIER_ABSOLUTE;
  const measured = maxHp && maxHp > 0 ? amount / maxHp : amount;
  return table.reduce((tier, threshold) => (measured >= threshold ? tier + 1 : tier), 0);
}

/** 전투 수치 한 개의 최종 표시 계약을 만든다. 씬은 이 결과만 그린다. */
export function damagePopupStyle(request: DamagePopupRequest): DamagePopupStyle {
  const { flavor, amount } = request;
  if (flavor === "blocked") {
    // 무효는 세기가 없다. 늘 같은 크기의 흐린 표식 하나로만 알리고 화면을 흔들지 않는다.
    return {
      text: "무효", tier: 0, size: 30, color: DAMAGE_FLAVOR_COLOR.blocked, stroke: "#14171a", strokeWidth: 6,
      rise: 60, punch: 1.1, holdMs: 140, riseMs: 560, shake: 0, sparks: 0,
    };
  }
  const boost = (request.critical ? 1 : 0) + (request.ultimate ? 1 : 0) - (request.mitigated ? 1 : 0);
  const tier = Math.min(4, Math.max(0, baseTier(amount, request.maxHp) + boost));
  // 궁극기는 종류색보다 강조색이 앞선다 — 누가 궁극기를 쐈는지가 먼저 읽혀야 한다.
  // 아군이 받은 피해는 종류와 무관하게 위험색으로 물들여 "지금 내가 맞고 있다"를 먼저 말한다.
  const color = request.ultimate ? COLOR.accentText
    : request.incoming && flavor !== "heal" && flavor !== "shield" ? COLOR.dangerText
      : DAMAGE_FLAVOR_COLOR[flavor];
  const sign = flavor === "heal" || flavor === "shield" ? "+" : "";
  const mark = request.effectiveness ? EFFECTIVENESS_MARK[request.effectiveness] : "";
  return {
    text: `${sign}${formatDamageAmount(amount)}${mark}`,
    tier,
    size: DAMAGE_TIER_SIZES[tier],
    color,
    stroke: "#14171a",
    // 글자가 커질수록 외곽선도 함께 두꺼워져야 배경 원화 위에서 같은 무게로 읽힌다.
    strokeWidth: 6 + tier,
    rise: TIER_RISE_PX[tier],
    punch: TIER_PUNCH[tier],
    holdMs: TIER_HOLD_MS[tier],
    riseMs: TIER_RISE_MS[tier],
    // 아군 피해로 화면이 흔들리면 조작이 어긋나므로 적에게 꽂은 큰 한 방만 흔든다.
    shake: request.incoming ? 0 : TIER_SHAKE[tier],
    sparks: request.critical || request.ultimate ? Math.max(3, TIER_SPARKS[tier]) : TIER_SPARKS[tier],
  };
}
