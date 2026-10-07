import { DUEL_DIVISION_SPAN, DUEL_TIERS, duelStanding, type DuelTierId } from "./duelArena";

/**
 * 결투 결과판의 점수 게이지가 **차오르거나 줄어드는 길**.
 *
 * 게이지 한 줄은 단계(IV~I) 하나의 폭이라, 한 판에 단계를 넘으면 한 줄이 끝까지 찼다가(또는 비었다가)
 * 다음 단계의 줄로 넘어간다 — 레벨업 연출(`playerExpBarSegments`)과 같은 문법이다. 로비의 게이지
 * (`DuelScene.paintStanding`)와 같은 칸 나눔을 쓰므로 두 화면이 같은 점수를 같은 줄로 읽는다.
 */
export interface DuelGaugeRange {
  tierId: DuelTierId;
  division: number | null;
  /** 이 줄의 시작·끝 점수. 맨 위 티어는 둘이 같다. */
  floor: number;
  ceil: number;
  /** 더 오를 곳이 없는 맨 위 줄. */
  top: boolean;
}

export function duelGaugeRange(score: number): DuelGaugeRange {
  const standing = duelStanding(score);
  const index = DUEL_TIERS.indexOf(standing.tier);
  const next = DUEL_TIERS[index + 1];
  if (standing.division !== null) {
    const floor = standing.tier.floor + (standing.tier.divisions - standing.division) * DUEL_DIVISION_SPAN;
    return { tierId: standing.tier.id, division: standing.division, floor, ceil: floor + DUEL_DIVISION_SPAN, top: false };
  }
  const ceil = next?.floor ?? standing.tier.floor;
  return { tierId: standing.tier.id, division: null, floor: standing.tier.floor, ceil, top: next === undefined };
}

export interface DuelGaugeStep extends DuelGaugeRange {
  /** 줄 안의 시작·끝 비율(0~1). */
  from: number;
  to: number;
}

const ratioIn = (range: DuelGaugeRange, score: number): number =>
  range.top || range.ceil === range.floor ? 1 : Math.min(1, Math.max(0, (score - range.floor) / (range.ceil - range.floor)));

/** 점수 `before` → `after`로 가는 동안 지나는 줄을 차례로. 점수가 같으면 서 있는 줄 하나다. */
export function duelGaugeSteps(before: number, after: number): DuelGaugeStep[] {
  const start = Math.max(0, Math.floor(before));
  const end = Math.max(0, Math.floor(after));
  const steps: DuelGaugeStep[] = [];
  let range = duelGaugeRange(start);
  let from = ratioIn(range, start);
  // 단계는 여덟 티어 × 네 단계가 전부라 이 안에서 반드시 끝난다.
  for (let guard = 0; guard < 64; guard += 1) {
    if (end >= range.ceil && !range.top && end > start) {
      steps.push({ ...range, from, to: 1 });
      range = duelGaugeRange(range.ceil);
      from = 0;
    } else if (end < range.floor && end < start) {
      steps.push({ ...range, from, to: 0 });
      range = duelGaugeRange(range.floor - 1);
      from = 1;
    } else {
      steps.push({ ...range, from, to: ratioIn(range, end) });
      break;
    }
  }
  return steps;
}
