import type { ProductDefinition, ProductGrant } from "./products";

/**
 * 프리미엄(실결제) 카탈로그 — **무엇을 얼마에 파는가의 유일한 표**.
 *
 * 값은 두 갈래로만 서고 서로 섞이지 않는다.
 * - `acquisition.platformProductId` — 스토어(앱스토어·플레이스토어)에 등록하는 상품 ID. 결제 SDK에는 이것만 넘긴다.
 * - `acquisition.displayPrice` — SDK가 현지 가격을 돌려주기 전에 화면이 세우는 원화 표기.
 * 둘 다 이 파일에만 있으므로, 스토어 콘솔에 상품을 올릴 때 이 표를 그대로 옮기면 되고 결제를 붙인 뒤에도
 * 화면·서버 지급 코드는 손대지 않는다.
 *
 * **지급은 전부 실제 게임 재화다.** 인게임 재화(다이아·골드·화석·호박석·치즈케이크·DNA 조각·원석)와 가방
 * 아이템(에너지 드링크·룬 가루·발굴권·토벌권)만 쓴다. 지급은 서버(`fulfillPlatformPurchase`)가 영수증을 검증한
 * 뒤에만 일어나며, 결제 SDK가 없는 빌드는 성공을 흉내 내지 않는다.
 *
 * ### 검수 장부 (시세표 `TRADE_GEM_RATE` 기준 다이아 환산)
 * 연구 한 번(화석·호박석 1개) = 다이아 300. 다이아 팩은 소형 40/₩1,000 → 특대 52/₩1,000이다.
 * - 신입 연구원 패키지 ₩4,900 · 계정당 1회 — 호박석 2(600) + 골드 50,000(100) + 치즈케이크 300(150) + 드링크 5(스테미나 300 = 다이아 150) ≈ 1,000
 * - 연구원 성장 패키지 ₩9,900 · 계정당 1회 — 골드 300,000(600) + 치즈케이크 1,500(750) + DNA 30(150) + 룬 가루 100
 * - 오늘의 보급 상자 ₩1,100 · 매일 1회 — 골드 30,000(60) + 치즈케이크 60(30) + 드링크 1(30)
 * - 주간 연구 특가 ₩3,900 · 주 1회 — 화석 3(900) + 치즈케이크 200(100)
 * - 스태미나 보급 번들 ₩5,900 · 주 2회 — 드링크 5 + 드링크+ 5 (스테미나 900 = 다이아 450)
 * - 발굴 장비 번들 ₩6,900 · 주 2회 — 발굴권 5 + 원석 1,000(200) + 룬 가루 60
 * - 복원 가속 특가 ₩9,900 · 주 1회 — 호박석 2(600) + DNA 40(200)
 * - 시즌 한정 표본 상자 ₩19,900 · 계정당 1회 · 토벌 지원 번들 ₩7,900 · 월 1회
 * - 다이아 4종 — **첫 구매 보너스는 같은 수의 다이아**(`firstPurchaseBonus`, 계정에서 그 팩을 처음 살 때 한 번)
 *
 * 반복 구매가 가능한 줄(매일·주간)이 가장 박하고, 계정당 한 번뿐인 줄이 가장 후하다 — 무역 패키지와 같은 규칙이다.
 */
const FROM = "2026-01-01T00:00:00Z";
const UNTIL = "2030-01-01T00:00:00Z";

/** 가방 아이템 한 줄. 이름은 아이템 정의와 같게 적는다(화면은 정의에서 읽는다). */
const item = (itemId: string, name: string, amount: number, expiresInDays?: number): ProductGrant =>
  ({ kind: "item", itemId, name, amount, ...(expiresInDays !== undefined ? { expiresInDays } : {}) });
const currency = (key: Extract<ProductGrant, { kind: "currency" }>["currency"], amount: number): ProductGrant => ({ kind: "currency", currency: key, amount });

const pay = (platformProductId: string, displayPrice: string) => ({ kind: "platform_payment", platformProductId, displayPrice }) as const;

/** 다이아 한 팩. 같은 모양이 넷이라 표로 찍는다. */
const gemPack = (id: string, name: string, amount: number, price: string): ProductDefinition => ({
  id, storefront: "premium", category: "special", premiumCategory: "gem", iconKey: "shop-product-gems", name,
  description: `다이아 ${amount}개`,
  acquisition: pay(id, price),
  grants: [currency("gems", amount)],
  // 첫 구매에만 같은 수를 한 번 더 — 팩마다 따로 센다.
  firstPurchaseBonus: [currency("gems", amount)],
  defaultQuantity: 1, purchaseLimit: 99, refresh: "none", visibleFrom: FROM, visibleUntil: UNTIL,
});

export const PREMIUM_PRODUCTS: readonly ProductDefinition[] = [
  // ── 패키지 ───────────────────────────────────────────────────────────────
  { id: "premium-starter", storefront: "premium", category: "special", premiumCategory: "package", iconKey: "shop-product-amber", name: "신입 연구원 패키지", description: "", acquisition: pay("premium-starter", "₩4,900"), grants: [currency("amber", 2), currency("gold", 50_000), currency("cheesecake", 300), item("stamina-tonic", "에너지 드링크", 5)], defaultQuantity: 1, purchaseLimit: 1, refresh: "once", visibleFrom: FROM, visibleUntil: UNTIL },
  { id: "premium-growth", storefront: "premium", category: "special", premiumCategory: "package", iconKey: "shop-product-enhancement", name: "연구원 성장 패키지", description: "", acquisition: pay("premium-growth", "₩9,900"), grants: [currency("gold", 300_000), currency("cheesecake", 1_500), currency("dnaFragments", 30), item("rune-dust", "룬 가루", 100)], defaultQuantity: 1, purchaseLimit: 1, refresh: "once", visibleFrom: FROM, visibleUntil: UNTIL },
  // 후원 패스는 광고를 제거하지 않고, 기존 광고 슬롯을 같은 보상·한도의 즉시 수령 슬롯으로 바꾼다.
  { id: "premium-monthly", storefront: "premium", category: "special", premiumCategory: "package", iconKey: "shop-product-enhancement", name: "월간 연구 후원", description: "", acquisition: pay("premium-monthly", "₩14,900"), grants: [currency("fossil", 5), { kind: "profile_decoration", decorationId: "patron-monthly", name: "월간 후원자 명찰" }], passBenefit: { durationDays: 30, instantAdRewards: true, usesStandardAdRewardPolicy: true, dailyBonus: { currency: "gems", amount: 5 } }, defaultQuantity: 1, purchaseLimit: 1, refresh: "none", visibleFrom: FROM, visibleUntil: UNTIL },
  // **광고 제거 멤버십은 후원 패스와 다른 상품이다.** 후원 패스가 광고 보상을 즉시 받게 해 주는 값이라면,
  // 이쪽은 광고 자체를 걷어 내고 그 대가로 던전 x3 배율을 연다. 하나는 기다림을, 하나는 광고를 없앤다.
  { id: "premium-adfree", storefront: "premium", category: "special", premiumCategory: "package", iconKey: "shop-product-enhancement", name: "광고 제거 멤버십", description: "", acquisition: pay("premium-adfree", "₩9,900"), grants: [{ kind: "profile_decoration", decorationId: "patron-adfree", name: "광고 제거 멤버 표식" }], passBenefit: { durationDays: 30, instantAdRewards: true, usesStandardAdRewardPolicy: true, adFree: true, dailyBonus: { currency: "gems", amount: 5 } }, defaultQuantity: 1, purchaseLimit: 1, refresh: "none", visibleFrom: FROM, visibleUntil: UNTIL },
  // ── 특가 — 주기마다 다시 열리는 묶음. 한정과 다른 점은 다시 열린다는 것뿐이라 `refresh`가 그 차이를 든다. ──
  { id: "premium-daily-deal", storefront: "premium", category: "daily", premiumCategory: "deal", iconKey: "shop-product-supplies", name: "오늘의 보급 상자", description: "", acquisition: pay("premium-daily-deal", "₩1,100"), grants: [currency("gold", 30_000), currency("cheesecake", 60), item("stamina-tonic", "에너지 드링크", 1)], defaultQuantity: 1, purchaseLimit: 1, refresh: "daily", visibleFrom: FROM, visibleUntil: UNTIL },
  { id: "premium-weekly-deal", storefront: "premium", category: "weekly", premiumCategory: "deal", iconKey: "shop-product-fossil", name: "주간 연구 특가", description: "", acquisition: pay("premium-weekly-deal", "₩3,900"), grants: [currency("fossil", 3), currency("cheesecake", 200)], defaultQuantity: 1, purchaseLimit: 1, refresh: "weekly", visibleFrom: FROM, visibleUntil: UNTIL },
  { id: "premium-energy", storefront: "premium", category: "weekly", premiumCategory: "deal", iconKey: "shop-product-supplies", name: "스태미나 보급 번들", description: "", acquisition: pay("premium-energy", "₩5,900"), grants: [item("stamina-tonic", "에너지 드링크", 5), item("stamina-tonic-large", "에너지 드링크+", 5)], defaultQuantity: 1, purchaseLimit: 2, refresh: "weekly", visibleFrom: FROM, visibleUntil: UNTIL },
  { id: "premium-excavation", storefront: "premium", category: "weekly", premiumCategory: "deal", iconKey: "shop-product-rune", name: "발굴 장비 번들", description: "", acquisition: pay("premium-excavation", "₩6,900"), grants: [item("strata-ticket", "발굴권", 5), currency("rawStone", 1_000), item("rune-dust", "룬 가루", 60)], defaultQuantity: 1, purchaseLimit: 2, refresh: "weekly", visibleFrom: FROM, visibleUntil: UNTIL },
  { id: "premium-restore-deal", storefront: "premium", category: "weekly", premiumCategory: "deal", iconKey: "shop-product-enhancement", name: "복원 가속 특가", description: "", acquisition: pay("premium-restore-deal", "₩9,900"), grants: [currency("amber", 2), currency("dnaFragments", 40)], defaultQuantity: 1, purchaseLimit: 1, refresh: "weekly", visibleFrom: FROM, visibleUntil: UNTIL },
  // ── 한정 — 다시 열리지 않거나 한 달에 한 번뿐이다. ──
  { id: "premium-season-crate", storefront: "premium", category: "special", premiumCategory: "limited", iconKey: "shop-product-supplies", name: "시즌 한정 표본 상자", description: "", acquisition: pay("premium-season-crate", "₩19,900"), grants: [currency("amber", 4), currency("fossil", 5), currency("cheesecake", 400)], defaultQuantity: 1, purchaseLimit: 1, refresh: "once", visibleFrom: FROM, visibleUntil: UNTIL },
  { id: "premium-raid-bundle", storefront: "premium", category: "special", premiumCategory: "limited", iconKey: "shop-product-enhancement", name: "토벌 지원 번들", description: "", acquisition: pay("premium-raid-bundle", "₩7,900"), grants: [item("raid-ticket", "토벌권", 5), item("raid-select-ticket", "선택 토벌권", 2), currency("raidSigil", 100)], defaultQuantity: 1, purchaseLimit: 1, refresh: "monthly", visibleFrom: FROM, visibleUntil: UNTIL },
  // ── 다이아 — 그 자체를 사는 갈래. 값이 클수록 같은 원 하나가 더 많은 다이아를 준다(규모 할인). ──
  gemPack("premium-gems-small", "다이아 소형 결정", 60, "₩1,500"),
  gemPack("premium-gems-medium", "다이아 중형 결정", 330, "₩7,900"),
  gemPack("premium-gems-large", "다이아 대형 결정", 1_200, "₩25,000"),
  gemPack("premium-gems-huge", "다이아 특대 결정", 3_600, "₩69,000"),
];
