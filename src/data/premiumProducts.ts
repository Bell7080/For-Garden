import type { ProductDefinition, ProductGrant } from "./products";

/**
 * 프리미엄(실결제) 카탈로그 — **무엇을 얼마에 파는가의 유일한 표**.
 *
 * 값은 두 갈래로만 서고 서로 섞이지 않는다.
 * - `acquisition.platformProductId` — 스토어(앱스토어·플레이스토어)에 등록하는 상품 ID. 결제 SDK에는 이것만 넘긴다.
 * - `acquisition.basePriceKrw` — SDK가 현지 가격을 돌려주기 전에 화면이 세우는 원화 기준 가격(지역 화폐로의 환산은 `core/storePrice.ts`가 맡는다).
 * 둘 다 이 파일에만 있으므로, 스토어 콘솔에 상품을 올릴 때 이 표를 그대로 옮기면 되고 결제를 붙인 뒤에도
 * 화면·서버 지급 코드는 손대지 않는다.
 *
 * **지급은 전부 실제 게임 재화다.** 인게임 재화(다이아·골드·화석·호박석·치즈케이크·원석·토벌 증표)와
 * 실제로 쓰이는 가방 아이템(에너지 드링크·고대 핵·발굴권·소탕권·토벌권)만 쓴다. **쓰는 곳이 없는 아이템(룬 가루)과
 * 받을 길이 없는 장식은 넣지 않는다** — 산 사람이 그것으로 할 일이 없다. 지급은 서버(`fulfillPlatformPurchase`)가 영수증을 검증한
 * 뒤에만 일어나며, 결제 SDK가 없는 빌드는 성공을 흉내 내지 않는다.
 *
 * ### 검수 장부 (시세표 `TRADE_GEM_RATE` 기준 다이아 환산)
 * 연구 한 번(화석·호박석 1개) = 다이아 300, **10회 = 3,000**. 가치 배수의 기준은 중형 팩(₩3.25/다이아)이고, 화면의 배지가 같은 식을 읽는다.
 * **재구매가 안 되는 줄(계정당 1회·월 1회)은 2.5~3.3배, 매일·매주 줄은 2.0~2.5배, 다이아 팩은 1.0~1.3배**다 — 다이아만 반복해서 사는 것이
 * 가장 손해이고, 한정 패키지가 가장 이득이어야 사는 이유가 된다. 가격표는 아래 `pay()` 호출의 두 번째 인자에만 있다.
 * - 연구 시작 ₩3,300(정가 9,900)·계정당 1회 — 화석 10 / 표본 확보 ₩9,900·1회 — 다이아 4,000 + 화석 10 + 호박석 10(= 1만 다이아)
 * - 월간 화석·호박석 ₩3,900·월 1회 — 10개씩(2.5배) / 월간 복원 보급 ₩29,900 — 다이아 12,000 + 각 30개(3.3배) / 대량 ₩59,000(2.5배)
 * - 백 번의 복원 ₩39,000·월 1회 — 화석·호박석 50개씩(2.5배) / 대규모 복원 ₩79,000·계정당 1회 — 다이아 3만 + 각 50개 + 원석(2.5배)
 * - 월간 연구 후원 ₩4,900·30일 — 매일 출석해 받는 몫까지 3.6배 / 광고 제거 멤버십 ₩4,900·30일
 * - 신입 연구원 ₩1,900·1회 — 다이아 1,000 + 골드·치즈케이크·드링크(3.3배) · 연구원 성장 ₩3,900·1회(3.0배) · 시즌 표본 상자 ₩6,900·1회(2.8배)
 * - 오늘의 보급 상자 ₩1,100·매일(2.5배) · 주간 연구 특가 ₩2,900·주 1회(2.0배) · 복원 가속 ₩2,500·주 1회(2.0배)
 * - 스토리·레벨 패스 ₩9,900(약 310~320%) · 레이드 패스 ₩6,900(약 250%) · 고고학(임시) ₩7,900 — 유료 칸은 마디마다 **다양한 보상 하나 + 다이아 고정**이다(다이아 합 5,200 · 레이드 4,160). 값은 `progressPasses.ts`
 * - 스태미나 보급 ₩1,900·주 2회(2.0배) · 발굴 장비 ₩2,900·주 2회 · 토벌 지원 ₩3,900·월 1회(2.5배)
 * - 다이아 4종 — **첫 구매 보너스는 같은 수의 다이아**(`firstPurchaseBonus`, 계정에서 그 팩을 처음 살 때 한 번)
 */
const FROM = "2026-01-01T00:00:00Z";
const UNTIL = "2030-01-01T00:00:00Z";

/** 가방 아이템 한 줄. 이름은 아이템 정의와 같게 적는다(화면은 정의에서 읽는다). */
const item = (itemId: string, name: string, amount: number, expiresInDays?: number): ProductGrant =>
  ({ kind: "item", itemId, name, amount, ...(expiresInDays !== undefined ? { expiresInDays } : {}) });
const currency = (key: Extract<ProductGrant, { kind: "currency" }>["currency"], amount: number): ProductGrant => ({ kind: "currency", currency: key, amount });

/** 값은 원화 기준 숫자다. 화면에 서는 표기는 `formatStorePrice`가 기기 지역의 화폐로 만든다. */
const pay = (platformProductId: string, basePriceKrw: number, listPriceKrw?: number) => ({ kind: "platform_payment", platformProductId, basePriceKrw, ...(listPriceKrw !== undefined ? { listPriceKrw } : {}) }) as const;

/** 다이아 한 팩. 같은 모양이 넷이라 표로 찍는다. */
const gemPack = (id: string, name: string, amount: number, price: number): ProductDefinition => ({
  id, storefront: "premium", category: "special", premiumCategory: "gem", iconKey: "shop-product-gems", name,
  description: `다이아 ${amount}개`,
  acquisition: pay(id, price),
  grants: [currency("gems", amount)],
  // 첫 구매에만 같은 수를 한 번 더 — 팩마다 따로 센다.
  firstPurchaseBonus: [currency("gems", amount)],
  defaultQuantity: 1, purchaseLimit: 99, refresh: "none", visibleFrom: FROM, visibleUntil: UNTIL,
});

export const PREMIUM_PRODUCTS: readonly ProductDefinition[] = [
  // ── 계정당 한 번뿐인 파격가 — **맨 위에서 홍보한다.** 3배 안팎의 값어치를 주고 다시 살 수 없어, 첫 구매의 문턱을 낮추는 줄이다. ──
  { id: "premium-starter", storefront: "premium", category: "special", premiumCategory: "package", iconKey: "shop-product-amber", name: "신입 연구원 패키지", description: "", acquisition: pay("premium-starter", 1_900, 3_800), grants: [currency("gems", 1_000), currency("gold", 100_000), currency("cheesecake", 600), item("stamina-tonic", "에너지 드링크", 8)], defaultQuantity: 1, purchaseLimit: 1, refresh: "once", visibleFrom: FROM, visibleUntil: UNTIL },
  { id: "premium-research-start", storefront: "premium", category: "special", premiumCategory: "package", iconKey: "shop-product-fossil", name: "연구 시작 패키지", description: "", acquisition: pay("premium-research-start", 3_300, 9_900), grants: [currency("fossil", 10)], defaultQuantity: 1, purchaseLimit: 1, refresh: "once", visibleFrom: FROM, visibleUntil: UNTIL },
  // ── 정기권 — 맨 위에 선다. 사는 순간보다 **매일 들어와 받는 몫**이 본체라 가장 후하다(30일 다이아 4,800 = 연구 16회).
  //    후원 패스는 광고를 제거하지 않고, 기존 광고 슬롯을 같은 보상·한도의 즉시 수령 슬롯으로 바꾼다. ──
  { id: "premium-monthly", storefront: "premium", category: "special", premiumCategory: "package", iconKey: "shop-product-enhancement", name: "월간 연구 후원", description: "", acquisition: pay("premium-monthly", 4_900), grants: [currency("gems", 300), currency("fossil", 2)], passBenefit: { durationDays: 30, instantAdRewards: true, usesStandardAdRewardPolicy: true, dailyBonus: { currency: "gems", amount: 150 } }, defaultQuantity: 1, purchaseLimit: 1, refresh: "none", visibleFrom: FROM, visibleUntil: UNTIL },
  // **광고 제거 멤버십은 후원 패스와 다른 상품이다.** 후원 패스가 광고 보상을 즉시 받게 해 주는 값이라면,
  // 이쪽은 광고 자체를 걷어 내고 그 대가로 소탕권 없는 소탕을 연다. 하나는 기다림을, 하나는 광고를 없앤다.
  { id: "premium-adfree", storefront: "premium", category: "special", premiumCategory: "package", iconKey: "shop-product-enhancement", name: "광고 제거 멤버십", description: "", acquisition: pay("premium-adfree", 4_900), grants: [currency("gems", 300), item("stamina-tonic", "에너지 드링크", 3)], passBenefit: { durationDays: 30, instantAdRewards: true, usesStandardAdRewardPolicy: true, adFree: true, dailyBonus: { currency: "gems", amount: 100 } }, defaultQuantity: 1, purchaseLimit: 1, refresh: "none", visibleFrom: FROM, visibleUntil: UNTIL },
  // ── 패키지 ───────────────────────────────────────────────────────────────
  // ── 연구 패키지 — **계정당 한 번·한 달에 한 번뿐인 줄은 같은 값 젬 팩의 2.5~3.3배**를 준다. 다시 살 수 없으니 후하게 두어도 인플레가 없고,
  //    반대로 젬 팩은 몇 번이고 살 수 있어 이 줄보다 늘 박하다. 뽑기권은 **10회 단위**(화석·호박석 10개 = 젬 3,000)로만 묶는다. ──
  { id: "premium-research-light", storefront: "premium", category: "special", premiumCategory: "package", iconKey: "shop-product-amber", name: "표본 확보 패키지", description: "", acquisition: pay("premium-research-light", 9_900), grants: [currency("gems", 4_000), currency("fossil", 10), currency("amber", 10)], defaultQuantity: 1, purchaseLimit: 1, refresh: "once", visibleFrom: FROM, visibleUntil: UNTIL },
  { id: "premium-growth", storefront: "premium", category: "special", premiumCategory: "package", iconKey: "shop-product-enhancement", name: "연구원 성장 패키지", description: "", acquisition: pay("premium-growth", 3_900), grants: [currency("gold", 600_000), currency("cheesecake", 3_000), item("ancient-core", "미지의 고대 핵", 3), currency("fossil", 3)], defaultQuantity: 1, purchaseLimit: 1, refresh: "once", visibleFrom: FROM, visibleUntil: UNTIL },
  // ── 진행 패스 — 결제는 길을 **열기만** 한다. 보상은 그 길의 마디(`progressPasses.ts`)에 닿을 때마다 받으므로 지급 목록은 비어 있다. ──
  { id: "premium-story-pass", storefront: "premium", category: "special", premiumCategory: "pass", iconKey: "shop-product-amber", name: "스토리 패스", description: "", acquisition: pay("premium-story-pass", 9_900), grants: [], defaultQuantity: 1, purchaseLimit: 1, refresh: "once", visibleFrom: FROM, visibleUntil: UNTIL },
  { id: "premium-level-pass", storefront: "premium", category: "special", premiumCategory: "pass", iconKey: "shop-product-enhancement", name: "레벨 패스", description: "", acquisition: pay("premium-level-pass", 9_900), grants: [], defaultQuantity: 1, purchaseLimit: 1, refresh: "once", visibleFrom: FROM, visibleUntil: UNTIL },
  { id: "premium-raid-pass", storefront: "premium", category: "special", premiumCategory: "pass", iconKey: "shop-product-supplies", name: "레이드 패스", description: "", acquisition: pay("premium-raid-pass", 6_900), grants: [], defaultQuantity: 1, purchaseLimit: 1, refresh: "once", visibleFrom: FROM, visibleUntil: UNTIL },
  { id: "premium-archaeology-pass", storefront: "premium", category: "special", premiumCategory: "pass", iconKey: "shop-product-supplies", name: "고고학 패스", description: "", acquisition: pay("premium-archaeology-pass", 7_900), grants: [], defaultQuantity: 1, purchaseLimit: 1, refresh: "once", visibleFrom: FROM, visibleUntil: UNTIL },
  // ── 특가 — 주기마다 다시 열리는 묶음. 한정과 다른 점은 다시 열린다는 것뿐이라 `refresh`가 그 차이를 든다. ──
  { id: "premium-daily-deal", storefront: "premium", category: "daily", premiumCategory: "deal", iconKey: "shop-product-supplies", name: "오늘의 보급 상자", description: "", acquisition: pay("premium-daily-deal", 1_100, 2_200), grants: [currency("gold", 100_000), currency("cheesecake", 300), item("stamina-tonic", "에너지 드링크", 4), currency("fossil", 1)], defaultQuantity: 1, purchaseLimit: 1, refresh: "daily", visibleFrom: FROM, visibleUntil: UNTIL },
  { id: "premium-weekly-deal", storefront: "premium", category: "weekly", premiumCategory: "deal", iconKey: "shop-product-fossil", name: "주간 연구 특가", description: "", acquisition: pay("premium-weekly-deal", 2_900), grants: [currency("fossil", 5), currency("cheesecake", 600)], defaultQuantity: 1, purchaseLimit: 1, refresh: "weekly", visibleFrom: FROM, visibleUntil: UNTIL },
  { id: "premium-energy", storefront: "premium", category: "weekly", premiumCategory: "deal", iconKey: "shop-product-supplies", name: "스태미나 보급 번들", description: "", acquisition: pay("premium-energy", 1_900), grants: [item("stamina-tonic", "에너지 드링크", 8), item("stamina-tonic-large", "에너지 드링크+", 8)], defaultQuantity: 1, purchaseLimit: 2, refresh: "weekly", visibleFrom: FROM, visibleUntil: UNTIL },
  { id: "premium-excavation", storefront: "premium", category: "weekly", premiumCategory: "deal", iconKey: "shop-product-rune", name: "발굴 장비 번들", description: "", acquisition: pay("premium-excavation", 2_900), grants: [item("strata-ticket", "발굴권", 5), currency("rawStone", 2_000), item("sweep-ticket", "소탕권", 5), currency("fossil", 2)], defaultQuantity: 1, purchaseLimit: 2, refresh: "weekly", visibleFrom: FROM, visibleUntil: UNTIL },
  { id: "premium-restore-deal", storefront: "premium", category: "weekly", premiumCategory: "deal", iconKey: "shop-product-enhancement", name: "복원 가속 특가", description: "", acquisition: pay("premium-restore-deal", 2_500), grants: [currency("amber", 4), currency("gold", 150_000)], defaultQuantity: 1, purchaseLimit: 1, refresh: "weekly", visibleFrom: FROM, visibleUntil: UNTIL },
  // ── 한정 — 다시 열리지 않거나 한 달에 한 번뿐이다. ──
  { id: "premium-season-crate", storefront: "premium", category: "special", premiumCategory: "limited", iconKey: "shop-product-supplies", name: "시즌 한정 표본 상자", description: "", acquisition: pay("premium-season-crate", 6_900), grants: [currency("amber", 10), currency("gems", 2_500), currency("cheesecake", 800)], defaultQuantity: 1, purchaseLimit: 1, refresh: "once", visibleFrom: FROM, visibleUntil: UNTIL },
  { id: "premium-raid-bundle", storefront: "premium", category: "special", premiumCategory: "limited", iconKey: "shop-product-enhancement", name: "토벌 지원 번들", description: "", acquisition: pay("premium-raid-bundle", 3_900), grants: [item("raid-ticket", "토벌권", 5), item("raid-select-ticket", "선택 토벌권", 2), currency("gems", 1_500), currency("fossil", 5)], defaultQuantity: 1, purchaseLimit: 1, refresh: "monthly", visibleFrom: FROM, visibleUntil: UNTIL },
  { id: "premium-monthly-fossil", storefront: "premium", category: "special", premiumCategory: "limited", iconKey: "shop-product-fossil", name: "월간 화석 패키지", description: "", acquisition: pay("premium-monthly-fossil", 3_900), grants: [currency("fossil", 10)], defaultQuantity: 1, purchaseLimit: 1, refresh: "monthly", visibleFrom: FROM, visibleUntil: UNTIL },
  { id: "premium-monthly-amber", storefront: "premium", category: "special", premiumCategory: "limited", iconKey: "shop-product-amber", name: "월간 호박석 패키지", description: "", acquisition: pay("premium-monthly-amber", 3_900), grants: [currency("amber", 10)], defaultQuantity: 1, purchaseLimit: 1, refresh: "monthly", visibleFrom: FROM, visibleUntil: UNTIL },
  { id: "premium-monthly-mid", storefront: "premium", category: "special", premiumCategory: "limited", iconKey: "shop-product-enhancement", name: "월간 복원 보급 패키지", description: "", acquisition: pay("premium-monthly-mid", 29_900), grants: [currency("gems", 12_000), currency("fossil", 30), currency("amber", 30)], defaultQuantity: 1, purchaseLimit: 1, refresh: "monthly", visibleFrom: FROM, visibleUntil: UNTIL },
  { id: "premium-monthly-heavy", storefront: "premium", category: "special", premiumCategory: "limited", iconKey: "shop-product-enhancement", name: "월간 복원 대량 패키지", description: "", acquisition: pay("premium-monthly-heavy", 59_000), grants: [currency("gems", 22_000), currency("fossil", 40), currency("amber", 40)], defaultQuantity: 1, purchaseLimit: 1, refresh: "monthly", visibleFrom: FROM, visibleUntil: UNTIL },
  { id: "premium-hundred", storefront: "premium", category: "special", premiumCategory: "limited", iconKey: "shop-product-fossil", name: "백 번의 복원 패키지", description: "", acquisition: pay("premium-hundred", 39_000), grants: [currency("fossil", 50), currency("amber", 50)], defaultQuantity: 1, purchaseLimit: 1, refresh: "monthly", visibleFrom: FROM, visibleUntil: UNTIL },
  { id: "premium-research-grand", storefront: "premium", category: "special", premiumCategory: "limited", iconKey: "shop-product-enhancement", name: "대규모 복원 패키지", description: "", acquisition: pay("premium-research-grand", 79_000), grants: [currency("gems", 30_000), currency("fossil", 50), currency("amber", 50), currency("rawStone", 5_000)], defaultQuantity: 1, purchaseLimit: 1, refresh: "once", visibleFrom: FROM, visibleUntil: UNTIL },
  // ── 다이아 — 그 자체를 사는 갈래. 값이 클수록 같은 원 하나가 더 많은 다이아를 준다(규모 할인). ──
  gemPack("premium-gems-small", "다이아 소형 결정", 330, 1_200),
  gemPack("premium-gems-medium", "다이아 중형 결정", 1_200, 3_900),
  gemPack("premium-gems-large", "다이아 대형 결정", 3_600, 9_900),
  gemPack("premium-gems-huge", "다이아 특대 결정", 7_800, 19_900),
];

/**
 * 가치 배수의 기준 — 같은 값으로 살 수 있는 다이아 팩의 효율(₩1당 다이아). 중형 팩을 쓴다.
 * 소형은 늘 가장 박하고 특대는 큰돈이라 사는 사람이 많은 가운데 팩을 기준 삼는다.
 */
export const PREMIUM_GEM_PER_KRW = 1_200 / 3_900;
