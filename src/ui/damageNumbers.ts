import { COLOR } from "./theme";
import { t } from "../i18n";

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
 * 3. **읽히는 자리에 머문다.** 수치는 머리 둘레에서 톡 튀어나와 **제자리에 머물다** 사라진다.
 *    예전에는 몸 위에서 옅게 출발해 SD 키보다 높이 떠오르며 사라졌는데, 읽을 틈이 떠오르는
 *    동안뿐이라 무엇이 떴는지 잘 읽히지 않았다(응태 2026-11-18). 그래서 멀리 날려 보내지 않고,
 *    세기가 클수록 **크고 두껍고 오래** 머문다. 겹침은 높이가 아니라 **자리**(`POPUP_LANES`)로 푼다.
 * 4. **사건의 종류는 박자로 말한다**(`PopupPace`). 꽂힌 한 방·매초 새는 지속 피해·한꺼번에 쏟아지는
 *    연타·채워지는 회복이 서로 다른 움직임으로 서야, 같은 색 계열에서도 무엇이 일어났는지 갈린다.
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
export type DebuffId = "bleed" | "poison" | "concussion" | "butcher" | "curse" | "frenzy" | "vandalism" | "weakpoint" | "observation" | "pressure" | "sleep";

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
  // 낙서가 터진 자리라 스프레이의 형광 분홍을 그대로 쓰되, 다른 디버프와 같은 무게가 되도록
  // 한 단계 눌러 둔다 — 형광 그대로 두면 지속 피해 잔타 중에서 이것만 먼저 읽힌다.
  vandalism: "#b7418f",
  // 표식이 터진 한 방은 지속 피해가 아니라 듀오가 밟은 결과라, 다른 디버프처럼 누르지 않고
  // 관측 신호의 노란빛을 그대로 쓴다 — 머리 위 칩과 같은 색이어야 한 사건으로 읽힌다.
  weakpoint: "#e8c33a",
  // 관측이 발동해 박힌 틱은 잔타로 여럿이 잇따라 뜬다 — 바람 속성의 청록을 어둡게 눌러 큰 한 방과 섞이지 않게 한다.
  observation: "#4fa3a8",
  // 수압이 터진 한 방은 깊은 물빛이다 — 둔화·여울의 하늘빛보다 짙게 눌러 지속 피해 잔타와 같은 무게로 둔다.
  pressure: "#2d6fa8",
  // 잠에서 깨는 피해 — 수면 칩과 같은 라벤더를 어둡게 눌러 둔다.
  sleep: "#5a52b8",
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
  /**
   * 박자를 직접 정할 때만 적는다. 비우면 성격·디버프 표(`DEBUFF_PACE`)가 고른다 —
   * 중독의 남은 몫을 한꺼번에 받은 한 방처럼, 같은 디버프라도 그 순간만 박자가 다를 때 쓴다.
   */
  pace?: PopupPace;
}

/**
 * 저장된 "피해 숫자" 선택이 이 전투 텍스트를 숨기는지 정하는 순수 표시 정책이다.
 *
 * 이름 그대로 HP를 깎는 일반·고정·지속 피해 수치만 선택의 적용 범위다. 회복량, 보호막 획득량,
 * 상태가 일으킨 별도 알림과 완전 방어 표식은 전투 판단 정보이므로 선택이 꺼져도 유지한다.
 */
export function shouldShowDamagePopup(request: DamagePopupRequest, damageNumbers: boolean): boolean {
  const isDamageAmount = request.flavor === "damage" || request.flavor === "true" || request.flavor === "debuff";
  return damageNumbers || !isDamageAmount;
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
    skill: "basic" | "ultimate" | "staccato" | "transfer" | "shimmer" | "weakpoint";
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

/**
 * 수치가 화면에 **어떤 박자로** 서는가.
 *
 * 색이 "무엇이 일어났나"를 말한다면 박자는 "어떤 종류의 사건인가"를 말한다. 같은 숫자라도
 * 한 번 꽂힌 타격과 매초 새는 지속 피해, 한 번에 쏟아지는 연타가 같은 움직임으로 서면 셋이
 * 섞여 무엇이 큰 한 방이었는지 읽히지 않는다.
 *
 * - `hit` — 꽂힌 한 방. 톡 튀어나와 **제자리에 머물다** 살짝 떠오르며 사라진다.
 * - `tick` — 출혈·중독처럼 매초 새는 피해. 몸 옆에 작게 서고, 사라질 때 **아래로 흘러내린다.**
 * - `volley` — 모르페 관측 연타처럼 한 번에 여럿이 쏟아지는 피해. 계단처럼 **자리를 비켜** 선다.
 * - `restore` — 회복·보호막. 톡 튀어나온 뒤 **위로 천천히** 떠오른다(채워지는 쪽이라 위로 간다).
 * - `blocked` — 무효. 세기 없이 늘 같은 흐린 표식이다.
 */
export type PopupPace = "hit" | "tick" | "volley" | "restore" | "blocked";

/**
 * 디버프가 깎는 피해가 어떤 박자로 서는가.
 *
 * **새 디버프는 색표와 이 표에 함께 더한다.** 매초 새는 것만 `tick`이고, 상한에서 터지거나
 * 4타마다 울리는 한 방은 `hit`이다 — 터진 한 방이 흘러내리면 잔타가 우연히 커진 것처럼 읽힌다.
 */
export const DEBUFF_PACE: Record<DebuffId, Exclude<PopupPace, "restore" | "blocked">> = {
  bleed: "tick",
  poison: "tick",
  curse: "tick",
  frenzy: "tick",
  concussion: "hit",
  butcher: "hit",
  vandalism: "hit",
  weakpoint: "hit",
  pressure: "hit",
  sleep: "hit",
  observation: "volley",
};

/** 씬이 그대로 옮겨 그리는 표시 계약. 여기 없는 값을 화면이 새로 정하지 않는다. */
export interface DamagePopupStyle {
  /** 최종 문자열. 회복·보호막만 `+`가 붙는다. */
  text: string;
  /** 0(잔타)~4(한 방). 크기·두께·머무는 시간·흔들림·받는 피해의 붉기가 모두 이 등급에서 나온다. */
  tier: number;
  pace: PopupPace;
  size: number;
  color: string;
  stroke: string;
  strokeWidth: number;
  /** 등장 순간의 확대 배율. 등급이 높을수록 크게 튄다. */
  punch: number;
  /** 튀어나오며 올라서는 높이(px). 작다 — 멀리 떠오르면 읽기 전에 몸에서 멀어진다. */
  hop: number;
  /** 튀어나오는 시간(ms). */
  popMs: number;
  /** 다 선 뒤 제자리에 머무는 시간(ms). 큰 한 방일수록 길다. */
  holdMs: number;
  /** 사라지는 시간(ms). */
  fadeMs: number;
  /** 사라지는 동안 옮겨 가는 거리(px). 음수는 위, 양수는 아래(지속 피해가 흘러내린다). */
  drift: number;
  /** 사라질 때 줄어드는 배율. */
  endScale: number;
  /** 머무는 동안의 진하기. */
  alpha: number;
  /** 카메라 흔들림 세기. 0이면 흔들지 않는다. */
  shake: number;
  /** 숫자 뒤로 튀는 마름모 파편 수. 0이면 글자만 뜬다. */
  sparks: number;
}

/** 수치 하나가 화면에 서 있는 전체 시간(ms). 풀 상한·연타 간격 검사가 같은 값을 읽는다. */
export function popupLifeMs(style: Pick<DamagePopupStyle, "popMs" | "holdMs" | "fadeMs">): number {
  return style.popMs + style.holdMs + style.fadeMs;
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
export const DAMAGE_TIER_SIZES: readonly number[] = [24, 30, 37, 46, 58];
/** 외곽선 두께. 큰 한 방일수록 **두껍게** 서야 같은 크기 안에서도 무게가 갈린다. */
export const DAMAGE_TIER_STROKE: readonly number[] = [4, 5, 6, 8, 10];
/** 머무는 시간(ms). 숫자를 읽을 틈이 곧 세기다 — 한 방은 잔타의 세 배 가까이 머문다. */
export const DAMAGE_TIER_HOLD_MS: readonly number[] = [360, 460, 600, 800, 1_080];
const TIER_FADE_MS: readonly number[] = [200, 220, 250, 290, 340];
const TIER_HOP_PX: readonly number[] = [16, 20, 26, 32, 40];
const TIER_PUNCH: readonly number[] = [1.12, 1.18, 1.26, 1.36, 1.5];
const TIER_SPARKS: readonly number[] = [0, 0, 3, 4, 6];

/** 최고 등급의 큰 한 방만 화면을 흔든다. */
const TIER_SHAKE: readonly number[] = [0, 0, 0, 0.004, 0.008];

/**
 * 박자별 손잡이. 등급 표 위에 얹는 **배율·덮어쓰기**만 적는다 — 박자마다 표를 새로 짜면
 * 같은 등급이 박자에 따라 다른 세기로 읽힌다.
 *
 * - `maxTier`: 그 박자가 오를 수 있는 가장 큰 등급. 잔타가 한 방만큼 커지지 않게 막는다.
 * - `size`·`hold`: 등급 표에 곱하는 배율.
 */
export const POPUP_PACE_SPEC: Record<Exclude<PopupPace, "blocked">, {
  maxTier: number; size: number; hold: number; hopRatio: number; drift: number; endScale: number; alpha: number; popMs: number;
}> = {
  hit: { maxTier: 4, size: 1, hold: 1, hopRatio: 1, drift: -12, endScale: 0.9, alpha: 0.96, popMs: 130 },
  // 매초 새는 피해는 작고 짧게, 흘러내리며 사라진다. 잔타가 한 방과 같은 무게로 서면 안 된다.
  tick: { maxTier: 2, size: 0.86, hold: 0.8, hopRatio: 0.45, drift: 16, endScale: 0.86, alpha: 0.9, popMs: 110 },
  // 연타는 짧게 톡톡 — 여럿이 잇따라 서므로 하나하나는 빨리 비켜 준다.
  volley: { maxTier: 3, size: 0.9, hold: 0.6, hopRatio: 0.5, drift: -8, endScale: 0.88, alpha: 0.94, popMs: 90 },
  // 채워지는 수치는 위로 떠오른다. 피해와 반대 방향이라 무엇이 들어왔는지 움직임으로도 갈린다.
  restore: { maxTier: 3, size: 0.92, hold: 0.85, hopRatio: 0.8, drift: -34, endScale: 0.94, alpha: 0.94, popMs: 130 },
};

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
  shield: COLOR.shieldText,
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

/** 요청에서 박자를 고른다. 명시한 `pace`가 있으면 그것이 앞선다. */
export function popupPace(request: DamagePopupRequest): PopupPace {
  if (request.flavor === "blocked") return "blocked";
  if (request.pace) return request.pace;
  if (request.flavor === "heal" || request.flavor === "shield") return "restore";
  if (request.flavor === "debuff") return DEBUFF_PACE[request.debuff ?? "bleed"];
  return "hit";
}

/** 전투 수치 한 개의 최종 표시 계약을 만든다. 씬은 이 결과만 그린다. */
export function damagePopupStyle(request: DamagePopupRequest): DamagePopupStyle {
  const { flavor, amount } = request;
  if (flavor === "blocked") {
    // 무효는 세기가 없다. 늘 같은 크기의 흐린 표식 하나로만 알리고 화면을 흔들지 않는다.
    return {
      text: t("damage.immune"), tier: 0, pace: "blocked", size: 24, color: DAMAGE_FLAVOR_COLOR.blocked, stroke: "#14171a", strokeWidth: 4,
      punch: 1.08, hop: 12, popMs: 110, holdMs: 320, fadeMs: 200, drift: -8, endScale: 0.9, alpha: 0.8, shake: 0, sparks: 0,
    };
  }
  const pace = popupPace(request) as Exclude<PopupPace, "blocked">;
  const spec = POPUP_PACE_SPEC[pace];
  const boost = (request.critical ? 1 : 0) + (request.ultimate ? 1 : 0) - (request.mitigated ? 1 : 0);
  const tier = Math.min(spec.maxTier, Math.max(0, baseTier(amount, request.maxHp) + boost));
  const sign = flavor === "heal" || flavor === "shield" ? "+" : "";
  return {
    // 속성 상성은 표식으로 붙이지 않는다. 유리하면 숫자 자체가 커지므로 화살표는 같은 말을
    // 두 번 하면서 글자 폭만 넓혔다.
    text: `${sign}${formatDamageAmount(amount)}`,
    tier,
    pace,
    size: Math.round(DAMAGE_TIER_SIZES[tier] * spec.size),
    color: popupColor(request, tier),
    stroke: "#14171a",
    // 글자가 커질수록 외곽선도 함께 두꺼워져야 배경 원화 위에서 같은 무게로 읽힌다.
    strokeWidth: DAMAGE_TIER_STROKE[tier],
    punch: TIER_PUNCH[tier],
    hop: Math.round(TIER_HOP_PX[tier] * spec.hopRatio),
    popMs: spec.popMs,
    holdMs: Math.round(DAMAGE_TIER_HOLD_MS[tier] * spec.hold),
    fadeMs: TIER_FADE_MS[tier],
    drift: spec.drift,
    endScale: spec.endScale,
    alpha: spec.alpha,
    // 아군 피해로 화면이 흔들리면 조작이 어긋나므로 적에게 꽂은 큰 한 방만 흔든다.
    shake: request.incoming || pace !== "hit" ? 0 : TIER_SHAKE[tier],
    sparks: request.critical || request.ultimate ? Math.max(3, TIER_SPARKS[tier]) : pace === "hit" ? TIER_SPARKS[tier] : 0,
  };
}

/**
 * 같은 대상 위에 잇따라 서는 수치의 **자리**.
 *
 * 무작위로 흩으면 두 숫자가 같은 자리에 겹칠 수 있고, 연타는 한 덩어리로 뭉갰다. 대상마다
 * 몇 번째 수치인지(`lane`)를 세어 정해진 자리를 차례로 돈다 — 같은 순서면 늘 같은 그림이다.
 *
 * - `hit`: 가운데 → 오른쪽 위 → 왼쪽 위 → 더 위로 비켜 서는 다섯 자리.
 * - `tick`: 몸 오른쪽 옆 한 줄. 매초 오므로 세 칸이면 겹치지 않는다.
 * - `volley`: 왼쪽 아래에서 오른쪽 위로 오르는 계단 여섯 칸 — 「티디디딕」이 순서대로 읽힌다.
 * - `restore`: 몸 왼쪽 옆. 피해 숫자와 같은 자리에 서면 둘이 겹쳐 무엇이 들어왔는지 흐려진다.
 */
export const POPUP_LANES: Record<PopupPace, readonly { x: number; y: number }[]> = {
  // 네 자리 한 방은 폭이 100px을 넘는다. 비켜 서는 거리가 그보다 좁으면 두 숫자가 포개진다.
  hit: [{ x: 0, y: 0 }, { x: 64, y: -46 }, { x: -64, y: -34 }, { x: 26, y: -88 }, { x: -44, y: -78 }],
  tick: [{ x: 96, y: 18 }, { x: 104, y: -14 }, { x: 92, y: -46 }],
  volley: [{ x: -70, y: 34 }, { x: -42, y: 18 }, { x: -14, y: 2 }, { x: 14, y: -14 }, { x: 42, y: -30 }, { x: 70, y: -46 }],
  restore: [{ x: -98, y: 20 }, { x: -106, y: -12 }, { x: -94, y: -44 }],
  blocked: [{ x: 0, y: -10 }, { x: 40, y: -48 }],
};

/** `lane`번째 수치가 설 자리. 몸집이 큰 대상일수록 넓게 벌린다. */
export function popupLaneOffset(pace: PopupPace, lane: number, bodyScale = 1): { x: number; y: number } {
  const lanes = POPUP_LANES[pace];
  const spot = lanes[((lane % lanes.length) + lanes.length) % lanes.length];
  const spread = Math.max(0.8, Math.min(1.6, bodyScale));
  return { x: spot.x * spread, y: spot.y * spread };
}

/**
 * 한 대상의 자리 순번이 처음으로 돌아가는 쉼(ms). 이만큼 아무것도 뜨지 않았으면 다음 수치는
 * 다시 가운데에서 선다 — 띄엄띄엄 오는 타격이 매번 비켜 선 자리에 서면 안 된다.
 */
export const POPUP_LANE_RESET_MS = 700;

/**
 * 연타 하나하나가 서는 시각(ms).
 *
 * 코어는 틱 전부를 한 프레임에 확정하고, 화면이 창(`windowSeconds`) 안에 흩어 뿌린다. 창을 틱 수로
 * 그대로 나누면 열다섯 겹이 0.6초에 몰려 40ms마다, 3배속에서는 13ms마다 숫자가 서서 한 덩어리로
 * 뭉갰다. **틱 사이는 `VOLLEY_MIN_GAP_MS` 아래로 좁히지 않는다** — 배속이 올라도 하나하나가 읽히는
 * 간격이 먼저다. 다만 전체 길이는 `VOLLEY_MAX_SPAN_MS`에서 멈춰 다음 공격과 너무 멀어지지 않게 한다.
 */
export const VOLLEY_MIN_GAP_MS = 85;
export const VOLLEY_MAX_SPAN_MS = 1_300;
export function volleyTickDelayMs(index: number, count: number, windowSeconds: number, speed = 1): number {
  if (count <= 1 || index <= 0) return 0;
  const natural = (windowSeconds * 1_000) / count / Math.max(1, speed);
  const gap = Math.min(Math.max(natural, VOLLEY_MIN_GAP_MS), VOLLEY_MAX_SPAN_MS / (count - 1));
  return Math.round(index * gap);
}
