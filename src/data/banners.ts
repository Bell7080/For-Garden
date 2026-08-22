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

/** 프로토타입 운영값. 천장(80회)은 개별 배너가 아니라 pityGroupId별로 누적된다. */
export const BANNERS: Banner[] = [
  {
    id: "fossil", pityGroupId: PITY_GROUP.STANDARD, name: "화석 발굴", featuredRelicId: "anky",
    desc: "굳은 화석에서 DNA를 긁어낸다. 토리카 픽업 진행 중.",
    currency: "fossil", costOne: 100, costTen: 900,
    rarityRates: { R: 0.9, SR: 0.09, SSR: 0.01 },
    relicPools: POOLS, pickupRelicIds: { SR: ["anky"] }, pickupRate: 0.5,
    highestRarityGuarantee: 80,
  },
  {
    id: "amber", pityGroupId: PITY_GROUP.LIMITED_PICKUP, name: "호박석 발굴", featuredRelicId: "rex",
    desc: "호박에 갇힌 온전한 DNA. 렉시아 픽업 진행 중.",
    currency: "amber", costOne: 2, costTen: 18,
    rarityRates: { R: 0.8, SR: 0.17, SSR: 0.03 },
    relicPools: POOLS, pickupRelicIds: { SSR: ["rex"] }, pickupRate: 0.5,
    highestRarityGuarantee: 80,
  },
];

export function getBanner(id: string): Banner {
  const found = BANNERS.find((banner) => banner.id === id);
  if (!found) throw new Error(`알 수 없는 배너 id: ${id}`);
  return found;
}
