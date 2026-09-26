import type { Banner, QuantityRewardKind, ResearchGrade } from "./gacha";

/**
 * 연구 확률표 — **등급 네 줄**(SSR·SR·R·잡화)과 그 안의 **개체·재화별 세부 확률**.
 *
 * 등급 확률만 적어 두면 「디안이 몇 %인가」를 사람이 풀 크기와 픽업 비율로 다시 셈해야 한다.
 * 세부 확률은 `pull()`이 실제로 고르는 순서(등급 → 픽업 판정 → 풀 안의 균등 선택, 잡화는
 * 가중치)를 **그대로 곱해** 얻는다 — 화면이 따로 셈하면 배너를 고친 날 표만 옛 값을 말한다.
 *
 * 모든 값은 **1회 연구 기준**이다. 천장·10연 보장·픽업 확정은 이 확률을 바꾸는 조건이라 표에
 * 섞지 않고 화면이 규칙 줄로 따로 적는다.
 */
export type RateTier = ResearchGrade;

export type RateEntry =
  | { kind: "relic"; relicId: string; pickup: boolean; rate: number }
  | { kind: "reward"; reward: QuantityRewardKind; min: number; max: number; rate: number };

export interface RateTierRow {
  tier: RateTier;
  rate: number;
  entries: RateEntry[];
}

/** 화면에 서는 등급 순서. 귀한 것부터다. */
export const RATE_TIERS: readonly RateTier[] = ["SSR", "SR", "R", "GRAY"];

export function gachaRateTable(banner: Banner): RateTierRow[] {
  return RATE_TIERS.map((tier) => {
    const rate = banner.slotRates[tier];
    if (tier === "GRAY") {
      const total = banner.grayRewards.reduce((sum, reward) => sum + reward.weight, 0);
      return {
        tier, rate,
        entries: total > 0 ? banner.grayRewards.map((reward) => ({
          kind: "reward" as const, reward: reward.kind, min: reward.min, max: reward.max, rate: rate * (reward.weight / total),
        })) : [],
      };
    }
    const pool = banner.relicPools[tier];
    const pickups = (banner.pickupRelicIds[tier] ?? []).filter((id) => pool.includes(id));
    const others = pool.filter((id) => !pickups.includes(id));
    // `pull()`과 같다 — 픽업이 있으면 픽업 확률만큼 픽업 묶음에서, 나머지는 그 밖에서 고른다.
    // 픽업 밖이 비면 픽업이 등급 전부를 갖는다.
    const pickupShare = pickups.length === 0 ? 0 : others.length === 0 ? 1 : banner.pickupRate;
    const entries: RateEntry[] = [
      ...pickups.map((relicId) => ({ kind: "relic" as const, relicId, pickup: true, rate: rate * pickupShare / pickups.length })),
      ...others.map((relicId) => ({ kind: "relic" as const, relicId, pickup: false, rate: rate * (1 - pickupShare) / others.length })),
    ];
    return { tier, rate, entries };
  });
}

/**
 * 확률 표기 — **백분율 소수 셋째 자리까지**, 뒤의 0은 지운다(`1`·`0.55`·`7.333`).
 *
 * 자릿수를 고정하면 `1.000%`처럼 읽을 필요 없는 0이 늘어서고, 둘째 자리에서 자르면 풀이 큰
 * 등급의 한 개체(0.1% 안팎)가 0으로 뭉개진다. 0보다 크지만 셋째 자리 아래인 값은 `<0.001`로
 * 적어 「없다」로 읽히지 않게 한다.
 */
export function formatRatePercent(rate: number): string {
  const percent = rate * 100;
  if (percent <= 0) return "0";
  if (percent < 0.001) return "<0.001";
  return String(Number(percent.toFixed(3)));
}
