import type { DuelTierId } from "../core/duelArena";

/**
 * 티어 표식의 장식 도형 — **임시(자리표시)**다. 전용 문장 원화가 오면 `DuelTierEmblem`과 함께 걷어 낸다.
 *
 * 마름모 하나만 색을 바꿔 서던 때는 브론즈와 챌린저가 크기도 모양도 같아 색으로만 갈렸다. 티어가 오를수록
 * 장식이 하나씩 붙는다 — 옆 날개 → 위 뾰족 → 두 겹 날개 → 아래 뾰족 → 왕관 → 세 겹 날개 → 뒤 광채. 프로필
 * 테두리가 레벨마다 장식을 더하는 것과 같은 문법이라, 색을 가리지 않고도 "얼마나 높은가"가 실루엣으로 읽힌다.
 *
 * 값은 표식 한 변(`size`)의 절반을 1로 둔 비율이다. Phaser 없이 두어 테스트가 장식이 표식 상자 밖으로
 * 얼마나 나가는지(`DUEL_TIER_EMBLEM_REACH`) 잴 수 있게 한다.
 */

/** 장식이 표식 가운데에서 닿는 끝 — 한 변 절반에 대한 비율. 목록 줄에서 옆 글자를 덮지 않게 이 안에 든다. */
export const DUEL_TIER_EMBLEM_REACH = 1.3;

/** 티어 차례 — 장식이 붙는 순서와 같다. */
export const DUEL_TIER_ORDER: readonly DuelTierId[] = ["bronze", "silver", "gold", "platinum", "diamond", "master", "grandmaster", "challenger"];

export interface TierOrnament {
  /** `rays`는 마름모 뒤, 나머지는 마름모 바깥 겹(검은 판) 뒤에 깔린다. */
  layer: "rays" | "wing" | "crown" | "spike";
  /** [x0, y0, x1, y1, …] — 반지름 1 기준. */
  points: number[];
}

const mirror = (points: number[]): number[] => points.map((value, index) => (index % 2 === 0 ? -value : value));

/** 옆 날개 한 겹. `step`이 클수록 바깥으로 길고 위아래로 비껴 선다. */
function wingPair(step: 0 | 1 | 2): TierOrnament[] {
  const left = [
    [-0.7, -0.26, -1.22, -0.02, -0.7, 0.26],
    [-0.62, -0.5, -1.22, -0.38, -0.86, -0.12],
    [-0.62, 0.3, -1.06, 0.5, -0.66, 0.56],
  ][step];
  return [{ layer: "wing", points: left }, { layer: "wing", points: mirror(left) }];
}

const TOP_SPIKE: TierOrnament = { layer: "spike", points: [-0.22, -0.98, 0, -1.3, 0.22, -0.98] };
const BOTTOM_SPIKE: TierOrnament = { layer: "spike", points: [-0.2, 0.98, 0, 1.3, 0.2, 0.98] };
const CROWN_THREE: TierOrnament = { layer: "crown", points: [-0.46, -0.84, -0.56, -1.2, -0.24, -1.02, 0, -1.3, 0.24, -1.02, 0.56, -1.2, 0.46, -0.84] };
const CROWN_FIVE: TierOrnament = {
  layer: "crown",
  points: [-0.6, -0.78, -0.82, -1.1, -0.42, -1.0, -0.26, -1.22, -0.1, -1.04, 0, -1.3, 0.1, -1.04, 0.26, -1.22, 0.42, -1.0, 0.82, -1.1, 0.6, -0.78],
};

/** 마름모 뒤로 퍼지는 여덟 갈래 빛 — 가장 높은 티어만 갖는다. 동그라미 대신 가는 마름모 날로 세운다. */
function rays(): TierOrnament[] {
  const list: TierOrnament[] = [];
  for (let i = 0; i < 8; i += 1) {
    const angle = Math.PI / 8 + (i * Math.PI) / 4;
    const cos = Math.cos(angle); const sin = Math.sin(angle);
    const tip = 1.28; const base = 0.5; const half = 0.1;
    list.push({ layer: "rays", points: [cos * tip, sin * tip, cos * base - sin * half, sin * base + cos * half, cos * base * 0.7, sin * base * 0.7, cos * base + sin * half, sin * base - cos * half] });
  }
  return list;
}

/** 그 티어가 갖는 장식 전부. 아래 티어의 장식을 버리지 않고 쌓는다(왕관이 위 뾰족을 대신하는 것만 예외다). */
export function duelTierOrnaments(tierId: DuelTierId): TierOrnament[] {
  const rank = DUEL_TIER_ORDER.indexOf(tierId);
  const list: TierOrnament[] = [];
  if (rank >= 7) list.push(...rays());
  if (rank >= 1) list.push(...wingPair(0));
  if (rank >= 3) list.push(...wingPair(1));
  if (rank >= 6) list.push(...wingPair(2));
  if (rank >= 6) list.push(CROWN_FIVE);
  else if (rank >= 5) list.push(CROWN_THREE);
  else if (rank >= 2) list.push(TOP_SPIKE);
  if (rank >= 4) list.push(BOTTOM_SPIKE);
  return list;
}
