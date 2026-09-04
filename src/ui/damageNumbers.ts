import { COLOR } from "./theme";

/**
 * 전투 수치 한 개를 어떻게 그릴지 정하는 **순수 규칙**.
 *
 * 씬은 이 결과만 읽어 글자를 세운다. 색·크기·머무는 시간을 화면에서 눈대중으로 고르면
 * 같은 세기의 타격이 화면마다 다른 무게로 읽힌다.
 *
 * 규칙은 셋이다.
 * 1. **세기는 크기로 말한다.** 대상의 최대 체력 대비 비율로 등급을 매기므로, 성장해서
 *    숫자가 커져도 "한 방에 얼마나 깎였나"가 그대로 크기에 남는다.
 * 2. **누가 맞았나는 색으로 말한다.** 아군이 받은 피해는 종류를 가리지 않고 **붉은 계열
 *    하나로** 묶고 세기에 따라 옅은 붉은색에서 진한 붉은색으로 짙어진다. 적에게 입힌 피해만
 *    종류별 색을 갖는다. 그래야 "주는 피해"와 "받는 피해"가 한눈에 갈린다.
 * 3. **화면을 가리지 않는다.** 글자는 작고 반투명하며, 캐릭터 위에 머무는 동안 가장 옅고
 *    위로 멀리 떠오르면서 또렷해진다. 예쁜 SD를 가리는 순간 수치는 정보가 아니라 방해다.
 */

/** 수치 한 개의 성격. 색은 여기서만 갈린다. */
export type DamageFlavor =
  /** 방어력·저항이 막는 보통 피해. 물리와 마법을 색으로 가르지 않는다. */
  | "damage"
  /** 방어를 거치지 않는 고정 피해. */
  | "true"
  /** 출혈·중독처럼 지속 상태가 깎는 피해. 색은 그 상태의 색을 따른다. */
  | "debuff"
  | "heal"
  /** 보호막이 새로 덮인 양. */
  | "shield"
  /** 경감이 끝까지 막아 낸 무효 타격. */
  | "blocked";

/**
 * 지속 피해를 주는 상태의 id.
 *
 * **새 디버프는 여기와 아래 색표에만 더한다.** 화면이 상태마다 색을 새로 고르면 같은 계열의
 * 상태가 화면마다 다른 색으로 보인다.
 */
export type DebuffId = "bleed" | "poison" | "concussion" | "butcher" | "curse" | "frenzy";

/**
 * 디버프별 색.
 *
 * 전부 **어둡게 눌러 둔다.** 지속 피해는 잔타로 자주 뜨므로 밝게 두면 정작 봐야 할 큰 한 방과
 * 같은 무게로 읽힌다. 출혈은 다크체리, 중독은 어두운 보랏빛, 뇌진탕은 안전모의 탁한 황토다 —
 * 헬멧이 울린 소리라 붉은 계열에 섞이면 그냥 맞은 것처럼 읽힌다. 손질은 자줏빛 살결이다.
 */
export const DEBUFF_TONE: Record<DebuffId, string> = {
  bleed: "#a8323c",
  poison: "#7a4bab",
  concussion: "#b8862f",
  butcher: "#9a5b7a",
  curse: "#6a4a7a",
  frenzy: "#a8406b",
};

export interface DamagePopupRequest {
  amount: number;
  flavor: DamageFlavor;
  /** `debuff` 성격일 때 색을 고르는 상태 id. */
  debuff?: DebuffId;
  /** 치명타는 한 등급 크게 서고 노란색으로 갈린다. */
  critical?: boolean;
  /** 궁극기 피해는 한 등급 크고 강조색으로 선다. */
  ultimate?: boolean;
  /**
   * 아군이 받은 피해.
   *
   * 물리·마법·고정·치명타가 전부 붉은 계열 하나로 묶인다. 회복·보호막·디버프는 제 색을
   * 지킨다 — 그 셋은 "맞았다"가 아니라 다른 사건이기 때문이다.
   */
  incoming?: boolean;
  /** 대상의 경감이 실제로 깎아 낸 타격. 한 등급 작고 회색으로 갈린다. */
  mitigated?: boolean;
  /** 크기 등급의 기준이 되는 대상 최대 체력. 없으면 절대값 표로 되돌아간다. */
  maxHp?: number;
}

/**
 * 코어의 공격 사건을 화면 효과가 소비할 최소 표현 모델로 옮긴다.
 *
 * `contributionAmount`와 보스 누적 점수는 정산용이고 `maxHp`는 크기 등급용 보조값일 뿐이다.
 * 따라서 화면에 적을 수치인 `amount`는 언제나 사건의 실제 HP 피해에서만 가져온다.
 */
export function attackDamagePopupRequest(
  event: {
    amount: number;
    damageType: "physical" | "magical" | "true";
    skill: "basic" | "ultimate" | "staccato" | "transfer" | "shimmer";
    critical: boolean;
    mitigated?: boolean;
  },
  target: { side: "player" | "enemy"; maxHp: number },
): DamagePopupRequest {
  return {
    amount: event.amount,
    flavor: event.damageType === "true" ? "true" : "damage",
    incoming: target.side === "player",
    maxHp: target.maxHp,
    ultimate: event.skill === "ultimate",
    critical: event.critical,
    mitigated: event.mitigated,
  };
}

/** 씬이 그대로 옮겨 그리는 표시 계약. 여기 없는 값을 화면이 새로 정하지 않는다. */
export interface DamagePopupStyle {
  /** 최종 문자열. 회복·보호막만 `+`가 붙는다. */
  text: string;
  /** 0(잔타)~4(한 방). 크기·시간·흔들림·받는 피해의 붉기가 모두 이 등급에서 나온다. */
  tier: number;
  size: number;
  color: string;
  stroke: string;
  strokeWidth: number;
  /** 떠오르는 거리(px). */
  rise: number;
  /** 등장 순간의 확대 배율. 등급이 높을수록 크게 튄다. */
  punch: number;
  /** 다 커진 뒤 제자리에 머무는 시간(ms). */
  holdMs: number;
  /** 떠오르며 사라지는 시간(ms). */
  riseMs: number;
  /** 캐릭터 위에 머무는 동안의 진하기. 가장 옅어 SD를 가리지 않는다. */
  nearAlpha: number;
  /** 몸에서 충분히 떠오른 뒤의 진하기. */
  peakAlpha: number;
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
/** 최대 체력을 모르는 수치를 위한 되돌림 표. */
export const DAMAGE_TIER_ABSOLUTE: readonly number[] = [200, 800, 3_000, 12_000];

/**
 * 등급별 글자 크기.
 *
 * 전투 중 화면에 여섯이 서 있고 수치는 그 위로 겹쳐 뜨므로, 읽히는 선에서 최대한 작게 잡는다.
 */
export const DAMAGE_TIER_SIZES: readonly number[] = [22, 27, 33, 41, 52];
const TIER_HOLD_MS: readonly number[] = [130, 150, 175, 210, 250];
const TIER_RISE_MS: readonly number[] = [720, 800, 900, 1_020, 1_160];
/** 떠오르는 거리. 캐릭터 키를 넘겨 확실히 몸 밖으로 빠져나가야 얼굴을 가리지 않는다. */
const TIER_RISE_PX: readonly number[] = [170, 190, 215, 245, 280];
const TIER_PUNCH: readonly number[] = [1.1, 1.15, 1.22, 1.3, 1.42];
const TIER_SPARKS: readonly number[] = [0, 0, 3, 4, 6];

/** 최고 등급의 큰 한 방만 화면을 흔든다. */
const TIER_SHAKE: readonly number[] = [0, 0, 0, 0.004, 0.008];

/**
 * 적에게 입힌 피해의 색.
 *
 * 보통 피해는 흰색, 고정 피해는 보랏빛, 치명타는 노란색이다. 셋 다 배경 원화 위에서
 * 또렷하게 갈린다.
 */
export const DAMAGE_FLAVOR_COLOR: Record<Exclude<DamageFlavor, "debuff">, string> = {
  damage: "#f4f2ee",
  true: "#b98cf0",
  heal: COLOR.hpText,
  shield: "#7fb4ec",
  blocked: "#9a9a9a",
};

/** 치명타 전용 노란색. 등급 상승과 함께 "제대로 꽂혔다"를 색으로도 알린다. */
export const CRITICAL_COLOR = "#ffd24a";

/**
 * 경감된 타격의 회색.
 *
 * 종류를 가리지 않고 하나로 통일한다 — "덜 들어갔다"는 무엇으로 때렸는지보다 먼저 읽혀야
 * 하는 정보라 색이 갈리면 오히려 흐려진다.
 */
export const MITIGATED_COLOR = "#9a9a9a";

/**
 * 아군이 받은 피해의 등급별 붉기.
 *
 * 잔타는 옅은 살구빛이고 한 방은 진한 다홍이다. 종류가 아니라 **아픈 정도**를 색이 말하므로,
 * 여섯이 뒤엉킨 난전에서 "지금 누가 크게 맞았나"를 숫자를 읽지 않고도 알 수 있다.
 */
export const INCOMING_DAMAGE_TONE: readonly string[] = ["#ffc4bd", "#ff9e92", "#f9705f", "#ea4334", "#d41f16"];

/** 다섯 자리부터는 자릿수를 끊어 준다. */
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

/**
 * 색 하나를 고른다.
 *
 * 우선순위는 **경감 → 아군 피격 → 치명타 → 궁극기 → 종류**다. 앞의 것이 뒤의 것을 덮는다 —
 * "덜 들어갔다"와 "내가 맞았다"는 무엇으로 맞았는지보다 먼저 알아야 하는 정보이기 때문이다.
 */
function popupColor(request: DamagePopupRequest, tier: number): string {
  const { flavor } = request;
  if (flavor === "blocked") return DAMAGE_FLAVOR_COLOR.blocked;
  // 회복·보호막·디버프는 "맞았다"가 아니라 다른 사건이라 받는 쪽에서도 제 색을 지킨다.
  const isHit = flavor === "damage" || flavor === "true";
  if (isHit && request.mitigated) return MITIGATED_COLOR;
  if (isHit && request.incoming) return INCOMING_DAMAGE_TONE[tier];
  if (isHit && request.critical) return CRITICAL_COLOR;
  if (isHit && request.ultimate) return COLOR.accentText;
  if (flavor === "debuff") return DEBUFF_TONE[request.debuff ?? "bleed"];
  return DAMAGE_FLAVOR_COLOR[flavor];
}

/** 전투 수치 한 개의 최종 표시 계약을 만든다. 씬은 이 결과만 그린다. */
export function damagePopupStyle(request: DamagePopupRequest): DamagePopupStyle {
  const { flavor, amount } = request;
  if (flavor === "blocked") {
    // 무효는 세기가 없다. 늘 같은 크기의 흐린 표식 하나로만 알리고 화면을 흔들지 않는다.
    return {
      text: "무효", tier: 0, size: 22, color: DAMAGE_FLAVOR_COLOR.blocked, stroke: "#14171a", strokeWidth: 4,
      rise: 140, punch: 1.08, holdMs: 120, riseMs: 560, nearAlpha: 0.3, peakAlpha: 0.75, shake: 0, sparks: 0,
    };
  }
  const boost = (request.critical ? 1 : 0) + (request.ultimate ? 1 : 0) - (request.mitigated ? 1 : 0);
  const tier = Math.min(4, Math.max(0, baseTier(amount, request.maxHp) + boost));
  const sign = flavor === "heal" || flavor === "shield" ? "+" : "";
  return {
    // 속성 상성은 표식으로 붙이지 않는다. 유리하면 숫자 자체가 커지므로 화살표는 같은 말을
    // 두 번 하면서 글자 폭만 넓혔다.
    text: `${sign}${formatDamageAmount(amount)}`,
    tier,
    size: DAMAGE_TIER_SIZES[tier],
    color: popupColor(request, tier),
    stroke: "#14171a",
    // 글자가 커질수록 외곽선도 함께 두꺼워져야 배경 원화 위에서 같은 무게로 읽힌다.
    strokeWidth: 4 + tier,
    rise: TIER_RISE_PX[tier],
    punch: TIER_PUNCH[tier],
    holdMs: TIER_HOLD_MS[tier],
    riseMs: TIER_RISE_MS[tier],
    // 몸 위에 있는 동안은 거의 비쳐 보이는 정도로만 둔다. SD를 가리지 않는 것이 먼저다.
    nearAlpha: 0.3,
    peakAlpha: 0.9,
    // 아군 피해로 화면이 흔들리면 조작이 어긋나므로 적에게 꽂은 큰 한 방만 흔든다.
    shake: request.incoming ? 0 : TIER_SHAKE[tier],
    sparks: request.critical || request.ultimate ? Math.max(3, TIER_SPARKS[tier]) : TIER_SPARKS[tier],
  };
}

/**
 * 떠오르는 수치의 진하기.
 *
 * 몸 위(처음 25%)에서는 가장 옅게 깔리고, 벗어나면서 또렷해졌다가 마지막 35%에 사라진다.
 * 캐릭터를 가리는 구간에서만 비쳐 보이므로 수치를 읽을 수는 있어도 SD를 덮지는 않는다.
 */
export function risingAlpha(progress: number, nearAlpha: number, peakAlpha: number): number {
  // 부동소수 오차로 상한을 아주 조금 넘는 값이 나올 수 있어 양 끝을 잘라 계약을 정확히 지킨다.
  const clamp = (value: number): number => Math.min(peakAlpha, Math.max(0, value));
  if (progress <= 0.25) return clamp(nearAlpha + (peakAlpha - nearAlpha) * (progress / 0.25));
  if (progress >= 0.65) return clamp(peakAlpha * (1 - (progress - 0.65) / 0.35));
  return peakAlpha;
}
