import type { Banner } from "../core/gacha";
import { registerDataText } from "../i18n";
import type { RelicRarity } from "../core/types";
import { PLAYABLE_RELICS } from "./relics";
import { BACKGROUND } from "../ui/backgroundAssets";

/**
 * **한정 렐릭 — 상시 풀(화석 연구)에 서지 않는다.**
 *
 * 픽업으로 세운 개체는 그 픽업에서만 얻는다. 상시에도 함께 두면 픽업은 「확률을 조금 올린 것」일
 * 뿐이라 호박석을 모을 이유가 되지 못한다. 픽업이 끝난 개체도 이 목록에 남아 상시에 섞이지
 * 않으며, **다시 얻는 길은 둘뿐이다** — 복각 배너의 픽업으로 다시 세우거나, 이 목록에서 빼서
 * 상시에 합류시킨다. 픽업 중이 아닌 한정 개체는 다른 픽업 배너의 일반 SSR 칸에도 섞이지 않는다.
 *
 * 간판(렉시아·스피나)은 여기에 넣지 않는다 — 놓친 사람이 게임의 얼굴을 영영 갖지 못한다.
 */
export const LIMITED_RELIC_IDS: ReadonlySet<string> = new Set(["dian"]);

/** 정적 렐릭 희귀도를 기준으로 구성해 등급 결정 후 다른 등급이 섞이지 않게 한다. 한정 개체는 뺀다. */
const STANDARD_POOLS = Object.fromEntries(
  (["R", "SR", "SSR"] satisfies RelicRarity[]).map((rarity) => [
    rarity,
    PLAYABLE_RELICS.filter((relic) => relic.rarity === rarity && !LIMITED_RELIC_IDS.has(relic.id)).map((relic) => relic.id),
  ]),
) as Record<RelicRarity, string[]>;

/** 픽업 배너의 풀: 상시 풀 위에 **이번에 세운** 한정 픽업만 더한다. */
function pickupPools(pickups: Partial<Record<RelicRarity, string[]>>): Record<RelicRarity, string[]> {
  return Object.fromEntries(
    Object.entries(STANDARD_POOLS).map(([rarity, ids]) => [
      rarity,
      [...ids, ...(pickups[rarity as RelicRarity] ?? []).filter((id) => !ids.includes(id))],
    ]),
  ) as Record<RelicRarity, string[]>;
}

const AMBER_PICKUP = { SSR: ["dian"] } as const satisfies Partial<Record<RelicRarity, string[]>>;

/** 교체 배너가 같은 값을 쓰면 천장과 픽업 확정이 이월되는 명시적 운영 그룹이다. */
export const PITY_GROUP = { WELCOME: "welcome", STANDARD: "standard-fossil", LIMITED_PICKUP: "limited-pickup" } as const;

/**
 * 첫 복원 연구의 SSR 풀 — 네 직군이 한 명씩이다.
 *
 * 간판 둘(렉시아·스피나)과 기본 편성(토리카·도디·파루아)에 없는 탱커·지원가를 메우는 둘을
 * 골랐다. 누가 나와도 지금 편성의 한 자리를 곧바로 채운다. 풀 안의 확률은 균등하다 — 간판에
 * 가중치를 주면 "렉시아가 안 나왔다"가 곧 실패로 읽힌다. 한정 개체는 여기 서지 않는다.
 */
export const WELCOME_SSR_POOL = ["rex", "spino", "ella", "mette"] as const;

/** 연구소의 화석 연구 운영값. 천장(100회)은 개별 배너가 아니라 pityGroupId별로 누적된다. */
export const BANNERS: Banner[] = [
  {
    /*
     * **첫 복원 연구** — 계정당 50회, 10연만, 화석 8개(20% 할인), 50회 안에 SSR 한 장 확정.
     *
     * 화석 연구에 덮는 할인이 아니라 따로 선 배너다. 풀(네 종)·천장 그룹·값이 모두 달라 한
     * 화면에 섞으면 무엇의 확률이고 무엇의 천장인지 읽히지 않는다. 천장을 한도와 같은 50으로
     * 두면 "50회 안에 확정"이 되고, 그 전에 SSR이 나오면 천장이 0으로 돌아가 남은 횟수로는 다시
     * 닿지 못하므로 확정은 저절로 한 번뿐이다. 다 쓰면 목록에서 사라진다. 기획은
     * `docs/live-ops-bm.md` §2. 전용 모집 원화는 아직 없어 연구소 설비 원화가 선다.
     */
    id: "welcome", pityGroupId: PITY_GROUP.WELCOME, name: "첫 복원 연구", featuredRelicId: "rex",
    currency: "fossil", costOne: 1, costTen: 8, tenOnly: true, pullLimit: 50,
    // 확률과 회색 보상은 화석 연구와 같다. 다른 것은 풀·값·한도·확정뿐이다.
    slotRates: { R: 0.12, SR: 0.04, SSR: 0.01, GRAY: 0.83 },
    grayRewards: [
      { kind: "gold", min: 1_000, max: 3_000, weight: 3 },
      { kind: "cheesecake", min: 5, max: 15, weight: 1 },
    ],
    relicPools: { ...STANDARD_POOLS, SSR: [...WELCOME_SSR_POOL] },
    pickupRelicIds: {}, pickupRate: 0,
    highestRarityGuarantee: 50,
  },
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
    // **화석 연구는 픽업이 없는 기본 연구다.** 픽업을 세우면 상시 연구가 한정 연구처럼 읽히고,
    // 호박석 연구의 픽업이 무엇이 다른지 말하지 못한다.
    relicPools: STANDARD_POOLS, pickupRelicIds: {}, pickupRate: 0,
    highestRarityGuarantee: 100,
  },
  {
    id: "amber", pityGroupId: PITY_GROUP.LIMITED_PICKUP, name: "호박석 연구", featuredRelicId: "dian",
    // 첫 픽업은 간판(렉시아·스피나)이 아니라 쁘띠 로그의 유일한 SSR 디안이다 — 간판을 픽업에
    // 가두면 놓친 사람이 게임의 얼굴을 영영 못 갖는다. 근거는 docs/live-ops-bm.md.
    artKey: BACKGROUND.recruitDian,
    // 재화의 희소도 같은 설계 메모도 배너 카피로 옮기지 않고 운영 데이터와 주석에만 남긴다.
    // 호박석도 한 개가 한 번이다. 값의 차이는 개수가 아니라 재화가 말한다.
    currency: "amber", costOne: 1, costTen: 10,
    // SSR은 화석 연구와 같은 1%다 — 호박석이 사는 것은 SSR 확률이 아니라 **한정 픽업**(디안은 여기서만
    // 나온다)과 두 배 가까운 SR·R 확률이다. 재화 결과는 여전히 과반이다.
    slotRates: { R: 0.22, SR: 0.08, SSR: 0.01, GRAY: 0.69 },
    grayRewards: [
      { kind: "gold", min: 3_000, max: 8_000, weight: 2 },
      { kind: "cheesecake", min: 15, max: 30, weight: 1 },
    ],
    relicPools: pickupPools(AMBER_PICKUP), pickupRelicIds: { SSR: [...AMBER_PICKUP.SSR] }, pickupRate: 0.5,
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
