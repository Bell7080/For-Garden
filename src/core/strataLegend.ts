/**
 * 안개 색이 무엇을 기울이는가 — 판 옆 범례의 순수 계산이다.
 *
 * 탐사는 확률을 숫자로 적지 않는다. 그래도 색이 「어느 쪽으로 기우는가」는 알려 주어야 색을
 * 보고 고르는 일이 판단이 된다. 그래서 색마다 **그 색에서 유난히 잘 나오는 것**만 골라 그림으로
 * 보여 준다 — 어느 색에서나 흔한 것(소량의 골드·원석)은 색을 가르는 정보가 아니다.
 */

import { STRATA_REWARD_DISPLAY, type StrataLayerDefinition, type StrataRewardKind, type StrataZoneTone } from "../data/strataLayers";

/** 범례 한 줄이 보여 줄 것의 최대 수다. */
export const STRATA_LEGEND_MAX_KINDS = 3;

/** 평균보다 이만큼은 더 나와야 그 색의 특징으로 친다. */
const LIFT_THRESHOLD = 1.25;

export interface StrataLegendRow {
  tone: StrataZoneTone;
  /** 이 색에서 잘 나오는 것. 강한 기울기부터 정렬한다. */
  kinds: StrataRewardKind[];
}

/** 같은 종류의 여러 줄(소량 골드와 보통 골드)을 한 종류로 합친 그 색의 몫이다. */
function shareOf(layer: StrataLayerDefinition, tone: StrataZoneTone): Map<StrataRewardKind, number> {
  const total = layer.rewards.reduce((sum, row) => sum + Math.max(0, row.weight[tone]), 0);
  const shares = new Map<StrataRewardKind, number>();
  if (total <= 0) return shares;
  for (const row of layer.rewards) shares.set(row.kind, (shares.get(row.kind) ?? 0) + Math.max(0, row.weight[tone]) / total);
  return shares;
}

/**
 * 판에 실제로 깔린 색마다 범례 한 줄을 만든다.
 *
 * 기울기 = (그 색에서의 몫) ÷ (판 전체 평균 몫). 평균은 색이 뽑히는 가중치로 잰다.
 * 특징이 없는 색(흙빛)은 가장 흔한 것을 보여 준다.
 */
export function strataLegend(layer: StrataLayerDefinition, tones: readonly StrataZoneTone[]): StrataLegendRow[] {
  const all = Object.keys(layer.toneWeight) as StrataZoneTone[];
  const toneTotal = all.reduce((sum, tone) => sum + Math.max(0, layer.toneWeight[tone]), 0);
  const perTone = new Map(all.map((tone) => [tone, shareOf(layer, tone)] as const));
  const average = (kind: StrataRewardKind): number => toneTotal <= 0 ? 0
    : all.reduce((sum, tone) => sum + Math.max(0, layer.toneWeight[tone]) * (perTone.get(tone)?.get(kind) ?? 0), 0) / toneTotal;
  const order: StrataZoneTone[] = ["soil", "teal", "gold", "deep"];
  return order.filter((tone) => tones.includes(tone)).map((tone) => {
    const shares = perTone.get(tone) ?? new Map<StrataRewardKind, number>();
    const candidates = [...shares.entries()]
      .filter(([kind, share]) => kind !== "empty" && STRATA_REWARD_DISPLAY[kind].reveal && share > 0)
      .map(([kind, share]) => ({ kind, share, lift: average(kind) > 0 ? share / average(kind) : 0 }));
    const featured = candidates.filter(({ lift, share }) => lift >= LIFT_THRESHOLD && share >= 0.02).sort((a, b) => b.lift - a.lift);
    const chosen = featured.length > 0 ? featured : candidates.sort((a, b) => b.share - a.share);
    return { tone, kinds: chosen.slice(0, STRATA_LEGEND_MAX_KINDS).map(({ kind }) => kind) };
  });
}
