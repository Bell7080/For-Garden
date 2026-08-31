import type { Banner } from "../core/gacha";
import type { RelicRarity } from "../core/types";
import { PLAYABLE_RELICS } from "./relics";

/** 정적 렐릭 희귀도를 기준으로 구성해 등급 결정 후 다른 등급이 섞이지 않게 한다. */
const POOLS = Object.fromEntries(
  (["R", "SR", "SSR"] satisfies RelicRarity[]).map((rarity) => [
    rarity,
    PLAYABLE_RELICS.filter((relic) => relic.rarity === rarity).map((relic) => relic.id),
  ]),
) as Record<RelicRarity, string[]>;

/** 교체 배너가 같은 값을 쓰면 천장과 픽업 확정이 이월되는 명시적 운영 그룹이다. */
export const PITY_GROUP = { STANDARD: "standard-fossil", LIMITED_PICKUP: "limited-pickup" } as const;

/** 연구소의 화석 연구 운영값. 천장(100회)은 개별 배너가 아니라 pityGroupId별로 누적된다. */
export const BANNERS: Banner[] = [
  {
    id: "fossil", pityGroupId: PITY_GROUP.STANDARD, name: "화석 연구", featuredRelicId: "anky",
    // 연구 방식과 픽업 대상은 각각 기능명·픽업 표식으로 이미 전달하므로 설명형 문구를 노출하지 않는다.
    currency: "fossil", costOne: 100, costTen: 900,
    // 기존 R 90% 중 15%p를 회색 연구 부산물로 옮겨 네 슬롯 확률의 합을 1로 유지한다.
    slotRates: { R: 0.75, SR: 0.09, SSR: 0.01, GRAY: 0.15 },
    grayRewards: [
      { kind: "gold", min: 1_000, max: 3_000, weight: 3 },
      { kind: "cheesecake", min: 5, max: 15, weight: 1 },
    ],
    relicPools: POOLS, pickupRelicIds: { SR: ["anky"] }, pickupRate: 0.5,
    highestRarityGuarantee: 100,
  },
  {
    id: "amber", pityGroupId: PITY_GROUP.LIMITED_PICKUP, name: "호박석 연구", featuredRelicId: "rex",
    // 재화의 희소도 같은 설계 메모도 배너 카피로 옮기지 않고 운영 데이터와 주석에만 남긴다.
    currency: "amber", costOne: 2, costTen: 18,
    // 호박석도 R에서 같은 15%p를 분리해 배너 간 회색 결과의 의미를 통일한다.
    slotRates: { R: 0.65, SR: 0.17, SSR: 0.03, GRAY: 0.15 },
    grayRewards: [
      { kind: "gold", min: 3_000, max: 8_000, weight: 2 },
      { kind: "cheesecake", min: 15, max: 30, weight: 1 },
    ],
    relicPools: POOLS, pickupRelicIds: { SSR: ["rex"] }, pickupRate: 0.5,
    highestRarityGuarantee: 100,
  },
];

export function getBanner(id: string): Banner {
  const found = BANNERS.find((banner) => banner.id === id);
  if (!found) throw new Error(`알 수 없는 배너 id: ${id}`);
  return found;
}
