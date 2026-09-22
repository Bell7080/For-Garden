import type { Banner } from "../core/gacha";
import { registerDataText } from "../i18n";
import type { RelicRarity } from "../core/types";
import { PLAYABLE_RELICS } from "./relics";
import { BACKGROUND } from "../ui/backgroundAssets";

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
    artKey: BACKGROUND.recruitFossil,
    // 연구 방식과 픽업 대상은 각각 기능명·픽업 표식으로 이미 전달하므로 설명형 문구를 노출하지 않는다.
    /*
     * **한 개가 한 번이고, 묶음 할인을 두지 않는다.**
     *
     * 상단 줄의 수가 곧 「몇 번 뽑을 수 있나」가 되게 하려는 것이다 — 화석 10·호박석 12가
     * 서 있으면 세어 보지 않고도 열 번과 열두 번이 읽힌다. 할인을 두면 한 번씩 뽑는 손이
     * 손해를 보게 되어 사실상 10연 하나만 남는다.
     */
    currency: "fossil", costOne: 1, costTen: 10,
    // 초기의 작은 R 풀을 너무 빨리 소진하지 않도록 대부분을 부산물로 돌린다. 10연 SR 보장은
    // 그대로 남아 있어 한 묶음은 보통 SR 1장 안팎, R 1~2장, 나머지는 재화로 구성된다.
    slotRates: { R: 0.12, SR: 0.04, SSR: 0.01, GRAY: 0.83 },
    grayRewards: [
      { kind: "gold", min: 1_000, max: 3_000, weight: 3 },
      { kind: "cheesecake", min: 5, max: 15, weight: 1 },
    ],
    relicPools: POOLS, pickupRelicIds: { SR: ["anky"] }, pickupRate: 0.5,
    highestRarityGuarantee: 100,
  },
  {
    id: "amber", pityGroupId: PITY_GROUP.LIMITED_PICKUP, name: "호박석 연구", featuredRelicId: "rex",
    // 아직 전용 모집 원화가 없다. 화석 연구의 그림을 돌려 쓰지 않고 비워 두어 연구소 설비
    // 원화가 서게 한다 — 같은 그림을 두 배너가 쓰면 넘겨도 무엇이 바뀌었는지 말하지 못한다.
    // 재화의 희소도 같은 설계 메모도 배너 카피로 옮기지 않고 운영 데이터와 주석에만 남긴다.
    // 호박석도 한 개가 한 번이다. 값의 차이는 개수가 아니라 재화가 말한다.
    currency: "amber", costOne: 1, costTen: 10,
    // 비싼 호박석은 화석보다 렐릭 확률을 거의 두 배로 두되, 재화 결과가 여전히 과반이 되게 한다.
    slotRates: { R: 0.22, SR: 0.08, SSR: 0.03, GRAY: 0.67 },
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

/** 배너 이름을 언어별로 덮어쓸 수 있게 등록한다. */
for (const banner of BANNERS) {
  registerDataText(banner, "name", `banner.${banner.id}.name`);
}
