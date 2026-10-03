import type { ProductGrant } from "./products";
import { findItem } from "./items";

/**
 * 진행 패스 — **사는 순간이 아니라 걸어가는 만큼 받는다.**
 *
 * 스토리·레벨·레이드 패스는 결제로 길을 **열고**, 그 길의 마디(스토리 클리어 수 · 연구원 레벨 · 레이드 입장 수)에
 * 닿을 때마다 그 마디의 보상을 받는다. 사자마자 한 번에 쏟아 주는 묶음은 패키지가 이미 하는 일이라, 패스가 같은
 * 일을 하면 패스를 살 이유가 「지금 당장 많이」 하나로 줄어든다. 패스의 값은 **계속 플레이할 이유**다.
 *
 * - 결제 전에도 길 전체와 지금 어디까지 왔는지는 보인다 — 무엇을 사는지 알고 산다.
 * - 이미 지나온 마디는 산 뒤에 한꺼번에 받는다(소급). 늦게 산 사람이 손해 보지 않는다.
 * - 마디마다 **무료 칸(왼쪽)과 유료 칸(오른쪽)** 이 나란히 선다. 무료 칸은 패스를 열지 않아도 받는다 — 열기 전에도
 *   길을 걸을 이유가 있고, 옆의 유료 칸이 무엇을 놓치는지 보여 준다.
 * - 유료 보상은 **후하게** 둔다(검수: 다이아 환산으로 값의 4~6배). 정기권·패스는 수집형에서 가장 효율이 좋은 상품이라는
 *   기대가 있고, 그 효율은 "꾸준히 들어와야 받는다"로 지켜진다.
 *
 * 패스의 이름은 그 길을 여는 상품의 이름이다(두 곳에 적지 않는다). 패스를 여는 상품은 `premiumProducts.ts`의 같은 `productId`이고, 열렸는지는 그 상품의 구매 기록이 말한다 —
 * 패스 소유를 따로 저장하지 않아 결제 기록과 패스 상태가 갈리지 않는다. 받은 마디만 `Session.progressPasses`에 남는다.
 *
 * ### 검수 장부 (연구 1회 = 다이아 300)
 * - 스토리 패스 ₩5,500 — 다이아 3,100 · 화석 10 · 호박석 5 · 그 밖 ≈ 다이아 8,000
 * - 레벨 패스 ₩5,900 — 다이아 2,300 · 화석 10 · 호박석 6 · 그 밖 ≈ 다이아 7,500
 * - 레이드 패스 ₩5,500 — 다이아 1,500 · 토벌권 9 · 선택 토벌권 6 · 토벌 증표 1,100 · 호박석 3 ≈ 다이아 5,000
 */

/** 패스가 재는 진행도. 값은 서버가 세션에서 읽는다 — 화면이 셈하지 않는다. */
export type ProgressPassMetric = "storyClears" | "playerLevel" | "raidRuns";

export interface ProgressPassMilestone {
  /** 이 마디에 닿는 진행도. 길 안에서 오름차순이고 겹치지 않는다. */
  threshold: number;
  /** 누구나 받는 무료 칸(왼쪽 줄). 패스를 열지 않아도 마디에 닿으면 받는다. */
  free: readonly ProductGrant[];
  /** 패스를 연 사람만 받는 유료 칸(오른쪽 줄). */
  rewards: readonly ProductGrant[];
}

export interface ProgressPassDefinition {
  id: "story" | "level" | "raid";
  /** 이 길을 여는 결제 상품. */
  productId: string;
  metric: ProgressPassMetric;
  milestones: readonly ProgressPassMilestone[];
}

export type ProgressPassId = ProgressPassDefinition["id"];

const currency = (key: Extract<ProductGrant, { kind: "currency" }>["currency"], amount: number): ProductGrant => ({ kind: "currency", currency: key, amount });
/** 아이템 이름은 아이템 정의에서 그때그때 읽는다 — 여기 한국어로 적으면 언어를 바꿔도 영수증에 한국어가 남는다. */
const item = (itemId: string, amount: number): ProductGrant => ({
  kind: "item", itemId, amount,
  get name(): string { return findItem(itemId)?.name ?? itemId; },
});
/** 마디 하나 — 무료 칸 하나와 유료 칸들. */
const step = (threshold: number, free: ProductGrant, ...rewards: ProductGrant[]): ProgressPassMilestone => ({ threshold, free: [free], rewards });

export const PROGRESS_PASSES: readonly ProgressPassDefinition[] = [
  {
    id: "story", productId: "premium-story-pass", metric: "storyClears",
    milestones: [
      step(1, currency("gold", 10_000), currency("gems", 200), currency("gold", 30_000)),
      step(3, currency("cheesecake", 60), currency("fossil", 2), currency("cheesecake", 200)),
      step(5, currency("gems", 50), currency("gems", 300), item("stamina-tonic", 3)),
      step(8, currency("gold", 20_000), currency("amber", 1), currency("dnaFragments", 20)),
      step(10, item("stamina-tonic", 1), currency("gems", 500), currency("fossil", 3)),
      step(13, currency("cheesecake", 100), currency("cheesecake", 500), currency("gold", 80_000)),
      step(16, currency("gems", 80), currency("gems", 500), currency("amber", 1)),
      step(20, currency("gold", 30_000), currency("fossil", 5), item("ancient-core", 1)),
      step(25, currency("fossil", 1), currency("gems", 600), currency("dnaFragments", 40)),
      step(30, currency("gems", 150), currency("amber", 3), currency("gems", 1_000)),
    ],
  },
  {
    id: "level", productId: "premium-level-pass", metric: "playerLevel",
    milestones: [
      step(5, currency("gold", 10_000), currency("gems", 200), currency("cheesecake", 200)),
      step(10, currency("cheesecake", 80), currency("fossil", 2), currency("gold", 50_000)),
      step(15, currency("gems", 50), currency("gems", 300), item("stamina-tonic-large", 2)),
      step(20, item("stamina-tonic", 1), currency("amber", 1), currency("dnaFragments", 20)),
      step(25, currency("gold", 30_000), currency("gems", 500), currency("cheesecake", 600)),
      step(30, currency("gems", 80), currency("fossil", 3), item("refined-core", 1)),
      step(35, currency("cheesecake", 150), currency("gems", 500), currency("gold", 150_000)),
      step(40, currency("fossil", 1), currency("amber", 2), currency("dnaFragments", 40)),
      step(50, currency("gold", 50_000), currency("gems", 800), currency("fossil", 5)),
      step(60, currency("gems", 150), currency("amber", 3), item("restoration-crystal", 1)),
    ],
  },
  {
    id: "raid", productId: "premium-raid-pass", metric: "raidRuns",
    milestones: [
      step(1, currency("gold", 10_000), item("raid-ticket", 2), currency("gems", 100)),
      step(3, currency("raidSigil", 20), currency("raidSigil", 100), currency("gold", 30_000)),
      step(5, currency("gems", 50), item("raid-select-ticket", 1), currency("gems", 200)),
      step(8, item("raid-ticket", 1), item("raid-ticket", 3), currency("cheesecake", 300)),
      step(12, currency("raidSigil", 40), currency("raidSigil", 200), currency("gems", 300)),
      step(16, currency("gold", 30_000), item("raid-select-ticket", 2), currency("fossil", 2)),
      step(20, currency("gems", 80), item("raid-ticket", 4), currency("gems", 400)),
      step(25, currency("raidSigil", 60), currency("raidSigil", 300), currency("amber", 1)),
      step(30, item("raid-ticket", 1), item("raid-select-ticket", 3), currency("gems", 500)),
      step(40, currency("gems", 150), currency("amber", 2), currency("raidSigil", 500)),
    ],
  },
];

export function findProgressPass(id: string): ProgressPassDefinition | undefined {
  return PROGRESS_PASSES.find((pass) => pass.id === id);
}

export function progressPassForProduct(productId: string): ProgressPassDefinition | undefined {
  return PROGRESS_PASSES.find((pass) => pass.productId === productId);
}
