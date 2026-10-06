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
 * 마디는 열다섯이다. **유료 칸은 둘이다 — 첫째는 마디마다 다른 보상 하나(화석·호박석·핵·토벌권·재화), 둘째는 다이아 고정.**
 * 다이아 칸은 길을 밀수록 오르고(100 → 500) 길 끝이 크게 뛴다(1,000). 패스는 플레이어가 직접 밀어야 하는 노동이
 * 가장 많이 드는 상품이라 값어치도 가장 후하다(약 310~320%). 1~15 마디 패스는 이 수준에 두고, 이어지는 패스(16~30 등)가
 * 생기면 그쪽을 더 크게 준다 — 길이 길수록 더 올리기 어려운 것을 뒤 패스가 받는다.
 * - 스토리 패스 ₩9,900 — 다이아 5,200 + 다양한 보상(합계 환산 약 9,800)
 * - 레벨 패스 ₩9,900 — 다이아 5,200 + 다양한 보상(합계 환산 약 9,500)
 * - 레이드 패스 ₩6,900 — 다이아 4,160 + 토벌권·선택 토벌권·증표·화석 등
 * - 고고학 패스(임시) ₩7,900 — 구조만 맞춘 자리표시
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
  id: "story" | "level" | "raid" | "archaeology";
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
    // 스토리 클리어 수가 곧 관문 순서다(본편이 한 줄로 이어진다) — 화면은 문턱을 「1-1 클리어」처럼 관문 이름으로 읽는다.
    id: "story", productId: "premium-story-pass", metric: "storyClears",
    milestones: [
      step(1, currency("gold", 5_000), currency("gold", 50_000), currency("gems", 100)),
      step(2, currency("cheesecake", 40), currency("cheesecake", 300), currency("gems", 150)),
      step(4, currency("gems", 30), currency("fossil", 1), currency("gems", 200)),
      step(6, currency("gold", 10_000), item("stamina-tonic", 3), currency("gems", 200)),
      step(8, item("stamina-tonic", 1), currency("amber", 1), currency("gems", 250)),
      step(10, currency("gems", 50), currency("cheesecake", 500), currency("gems", 250)),
      step(12, currency("cheesecake", 80), currency("gold", 100_000), currency("gems", 300)),
      step(14, currency("gold", 15_000), currency("fossil", 1), currency("gems", 300)),
      step(16, currency("fossil", 1), currency("dnaFragments", 20), currency("gems", 350)),
      step(18, currency("gems", 60), currency("cheesecake", 600), currency("gems", 350)),
      step(20, currency("cheesecake", 100), item("ancient-core", 2), currency("gems", 400)),
      step(22, currency("gold", 20_000), item("stamina-tonic", 5), currency("gems", 400)),
      step(24, currency("gems", 80), currency("amber", 1), currency("gems", 450)),
      step(27, item("stamina-tonic", 1), currency("gold", 100_000), currency("gems", 500)),
      step(30, currency("gems", 150), currency("fossil", 2), currency("gems", 1000)),
    ],
  },
  {
    id: "level", productId: "premium-level-pass", metric: "playerLevel",
    milestones: [
      step(3, currency("gold", 5_000), currency("cheesecake", 300), currency("gems", 100)),
      step(5, currency("cheesecake", 40), currency("fossil", 1), currency("gems", 150)),
      step(8, currency("gems", 30), currency("gold", 50_000), currency("gems", 200)),
      step(10, currency("gold", 10_000), currency("amber", 1), currency("gems", 200)),
      step(13, item("stamina-tonic", 1), item("stamina-tonic-large", 1), currency("gems", 250)),
      step(15, currency("gems", 50), currency("cheesecake", 500), currency("gems", 250)),
      step(18, currency("cheesecake", 80), currency("fossil", 1), currency("gems", 300)),
      step(20, currency("gold", 15_000), currency("dnaFragments", 20), currency("gems", 300)),
      step(25, currency("fossil", 1), item("refined-core", 1), currency("gems", 350)),
      step(30, currency("gems", 60), currency("gold", 100_000), currency("gems", 350)),
      step(35, currency("cheesecake", 120), currency("amber", 1), currency("gems", 400)),
      step(40, currency("gold", 25_000), currency("cheesecake", 600), currency("gems", 400)),
      step(45, currency("gems", 80), item("stamina-tonic-large", 2), currency("gems", 450)),
      step(50, item("stamina-tonic", 1), currency("fossil", 2), currency("gems", 500)),
      step(60, currency("gems", 150), item("restoration-crystal", 1), currency("gems", 1000)),
    ],
  },
  {
    id: "raid", productId: "premium-raid-pass", metric: "raidRuns",
    milestones: [
      step(1, currency("gold", 5_000), item("raid-ticket", 2), currency("gems", 80)),
      step(2, currency("raidSigil", 15), currency("raidSigil", 80), currency("gems", 120)),
      step(3, currency("gems", 30), item("raid-select-ticket", 1), currency("gems", 160)),
      step(5, item("raid-ticket", 1), currency("cheesecake", 300), currency("gems", 160)),
      step(7, currency("gold", 10_000), item("raid-ticket", 2), currency("gems", 200)),
      step(9, currency("raidSigil", 25), currency("fossil", 1), currency("gems", 200)),
      step(12, currency("gems", 50), currency("raidSigil", 120), currency("gems", 240)),
      step(15, currency("raidSigil", 30), item("raid-ticket", 2), currency("gems", 240)),
      step(18, item("raid-ticket", 1), item("raid-select-ticket", 1), currency("gems", 280)),
      step(21, currency("gold", 20_000), currency("amber", 1), currency("gems", 280)),
      step(25, currency("gems", 60), currency("gold", 100_000), currency("gems", 320)),
      step(30, currency("raidSigil", 40), currency("raidSigil", 200), currency("gems", 320)),
      step(35, item("raid-ticket", 1), item("raid-ticket", 3), currency("gems", 360)),
      step(40, currency("gold", 30_000), currency("fossil", 1), currency("gems", 400)),
      step(50, currency("gems", 150), item("raid-select-ticket", 2), currency("gems", 800)),
    ],
  },
  {
    // 임시 — 패스 탭 줄이 네 칸일 때 옆으로 흐르는 스크롤을 확인하려고 더한 항목이다. 진행도는 새로 세지 않고 연구원
    // 레벨을 빌려 쓰며(저장 구조를 건드리지 않는다), 정식 고고학 패스가 정해지면 이 항목째 지우거나 바꾼다.
    id: "archaeology", productId: "premium-archaeology-pass", metric: "playerLevel",
    milestones: [
      step(3, currency("gold", 5_000), item("strata-ticket", 1), currency("gems", 60)),
      step(5, currency("cheesecake", 40), currency("fossil", 1), currency("gems", 90)),
      step(8, currency("gems", 30), item("strata-ticket", 2), currency("gems", 120)),
      step(10, currency("gold", 10_000), currency("amber", 1), currency("gems", 120)),
      step(13, item("stamina-tonic", 1), item("strata-ticket", 2), currency("gems", 150)),
      step(15, currency("gems", 50), currency("fossil", 2), currency("gems", 150)),
      step(18, currency("cheesecake", 80), item("strata-ticket", 3), currency("gems", 180)),
      step(20, currency("gold", 15_000), currency("amber", 1), currency("gems", 180)),
      step(25, currency("fossil", 1), item("strata-ticket", 3), currency("gems", 210)),
      step(30, currency("gems", 60), currency("fossil", 2), currency("gems", 210)),
      step(35, currency("cheesecake", 120), currency("gold", 120_000), currency("gems", 240)),
      step(40, currency("gold", 25_000), currency("amber", 1), currency("gems", 240)),
      step(45, currency("gems", 80), currency("fossil", 2), currency("gems", 270)),
      step(50, item("stamina-tonic", 1), currency("fossil", 3), currency("gems", 300)),
      step(60, currency("gems", 150), currency("amber", 3), currency("gems", 600)),
    ],
  },
];

export function findProgressPass(id: string): ProgressPassDefinition | undefined {
  return PROGRESS_PASSES.find((pass) => pass.id === id);
}

export function progressPassForProduct(productId: string): ProgressPassDefinition | undefined {
  return PROGRESS_PASSES.find((pass) => pass.productId === productId);
}
