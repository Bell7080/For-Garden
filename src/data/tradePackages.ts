import { RESEARCH_TICKET_GEM_PRICE } from "../core/gacha";
import type { ProductAcquisition, ProductCurrency, ProductDefinition, ProductGrant, ProductRefresh, ProductStorefront } from "./products";
import { registerDataText } from "../i18n";

/**
 * 무역 패키지 — **운영이 그때그때 올려 두는 묶음 하나하나를 전시하는 자리.**
 *
 * 예전의 무역은 재화 교환소였다. 치즈케이크를 내고 DNA 조각을 받는 줄이 일곱 개 늘어서 있어서,
 * 어느 줄이 지금 살 만한지 판단하려면 네 재화의 시세를 머릿속에 갖고 있어야 했다. 게다가 그
 * 일은 DNA 교환이 이미 하고 있었다.
 *
 * 이제 무역은 **패키지 전시장**이다. 한 칸이 묶음 하나이고, 값은 젬으로 받으며, 같은 젬으로
 * 따로 사는 것보다 **더 많이 준다** — 그 "더"가 이 화면의 존재 이유라서 화면에 가치 %로 선다.
 * 프리미엄이 아니므로 플랫폼 결제는 여기 오지 않는다(유료 묶음은 `premium` storefront다).
 *
 * **운영 규칙은 제한과 갱신 주기 둘뿐이다.** 계정당 한 번뿐인 것, 주마다 다시 열리는 것,
 * 날마다 다시 열리는 것. 어느 쪽인지는 화면이 문장을 짓지 않고 이 표의 `refresh`·`purchaseLimit`
 * 에서 나온다(`tradePackageLimitLabel`).
 */

/**
 * 값어치를 재는 **단 하나의 시세표** — 젬 1로 살 수 있는 재화의 양.
 *
 * 패키지마다 "몇 % 가치"를 손으로 적으면, 수치를 조정한 뒤 옛 %가 그대로 남아 화면이 거짓말을
 * 한다. 그래서 %는 데이터에 없고 이 표에서 환산한다. 기준은 이미 서 있는 두 경계다 —
 * 스테미나 충전(젬 30 → 60)과 **연구 한 번**이라, 화석 한 개가 젬 100, 호박석 한 개가 젬 300이다. 시세를 고치면 전시 중인 모든 패키지의 %가 함께 움직인다.
 */
export const TRADE_GEM_RATE: Readonly<Record<ProductCurrency, number>> = {
  gems: 1,
  /*
   * **뽑기 한 번이 이 표의 기준점이다.**
   *
   * 화석 한 개도 호박석 한 개도 연구 한 번이고, **둘 다 젬 300이다.** 두 연구는 확률·회색 보상이
   * 똑같고(`banners.ts`의 `STANDARD_SLOT_RATES`) 다른 것은 픽업뿐이라 한 번의 값을 가를 근거가 없다.
   * 확률을 조금이라도 달리하면 이 표를 둘로 나눠 다시 매겨야 한다. 값은 연구 버튼이 모자란 몫을
   * 젬으로 채우는 값(`RESEARCH_TICKET_GEM_PRICE`)과 같은 한 수다.
   *
   *   한 번 = 화석 1 = 호박석 1 = 젬 300 · 열 번 = 젬 3,000
   */
  amber: 1 / RESEARCH_TICKET_GEM_PRICE,
  fossil: 1 / RESEARCH_TICKET_GEM_PRICE,
  /*
   * 원석은 고고학 안에서만 돌고 한 판에서 수십 개가 나온다(`strataLayers`의 원석 칸 6~26,
   * 한 판 8~10회). 뽑기 재화와 같은 자리에 두지 않는 이유가 그것이다 — 파서 모으는 재화라
   * 개수 자체가 자릿수 하나 크다.
   */
  rawStone: 5,
  // 증표 둘은 전시대에 올리지 않는다 — 젬으로 사면 그 증표가 무엇을 위한 것인지 말하지 못한다.
  // 시세만 채워 표를 비우지 않으며, 올릴 때 다시 잰다.
  raidSigil: 60,
  salvageRecord: 60,
  duelEmblem: 60,
  cheesecake: 2,
  gold: 500,
  // 마일리지 1 ≈ 젬 60 — 마일리지 상점의 기준 단위(`mileageShop.ts`)와 같은 값이다. 전시대는 마일리지를 지급하지 않는다.
  dnaFragments: 1 / 60,
};

/** 지급품 묶음 전체를 젬 값으로 환산한다. 재화가 아닌 지급품은 시세가 없으므로 세지 않는다. */
export function tradeGemValue(grants: readonly ProductGrant[]): number {
  return grants.reduce((sum, grant) => grant.kind === "currency" && !isGemUnconvertible(grant.currency) ? sum + grant.amount / TRADE_GEM_RATE[grant.currency] : sum, 0);
}

/**
 * 젬으로 살 수 없는 증표 둘 — 시세표 값은 칸을 채우려는 임시 값이라 비교에 쓰면 터무니없는 배수가 나온다
 * (증표 20개로 치즈케이크 400개를 사면 60,000%). 가치 배지·환산에서 뺀다.
 */
export function isGemUnconvertible(currency: keyof typeof TRADE_GEM_RATE): boolean {
  return currency === "raidSigil" || currency === "salvageRecord" || currency === "duelEmblem";
}

/**
 * 낸 값 대비 받는 값의 비율(%). 200이면 "같은 젬으로 따로 사는 것의 두 배".
 *
 * 재화로 값을 받지 않는 상품은 견줄 기준이 없어 `undefined`다 — 그 자리에 100%를 적으면
 * 환산하지 못한 것과 딱 맞는 것이 같은 숫자로 보인다.
 */
export function tradePackageValuePercent(acquisition: ProductAcquisition, grants: readonly ProductGrant[]): number | undefined {
  if (acquisition.kind !== "currency" || isGemUnconvertible(acquisition.currency)) return undefined;
  const cost = acquisition.amount / TRADE_GEM_RATE[acquisition.currency];
  if (cost <= 0) return undefined;
  return Math.round((tradeGemValue(grants) / cost) * 100);
}

/** 갱신 주기를 말하는 이름표. 같은 말이 카드와 구매 확인에서 갈리지 않게 한 곳에 둔다. */
const REFRESH_LABEL: Readonly<Record<ProductRefresh, string>> = {
  once: "계정당", daily: "매일", weekly: "주간", monthly: "월간", none: "상시", season: "시즌",
};

/**
 * "언제 몇 번까지"와 "지금 몇 번 남았나"를 한 줄로 적는다.
 *
 * 남은 횟수만 적으면 다음에 언제 다시 열리는지 알 수 없고, 주기만 적으면 지금 살 수 있는지
 * 알 수 없다. 둘 다 지금 누를지를 정하는 정보라 함께 선다.
 */
export function tradePackageLimitLabel(refresh: ProductRefresh, purchaseLimit: number, remaining: number): string {
  const period = `${REFRESH_LABEL[refresh]} ${purchaseLimit}회`;
  return remaining > 0 ? `${period} · ${remaining}회 남음` : `${period} · 소진`;
}

/** 무역에 선 상품은 전부 패키지다. 구매 확인판이 수량 작업판과 패키지판을 가르는 기준이다. */
export function isTradePackage(product: { storefront: ProductStorefront }): boolean {
  return product.storefront === "trade";
}

/** 기간 문자열 두 개 — 계정당 한정과 로테이션 상품이 같은 노출 창을 쓴다. 언제 서는지는 로테이션 칸이 정한다. */
const ALWAYS = { visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" } as const;

/** 젬으로 사고 한 번에 하나씩 사는 무역 패키지 한 줄. 표를 짧게 두려는 도우미일 뿐 규칙은 없다. */
function pack(
  id: string, category: ProductDefinition["category"], iconKey: ProductDefinition["iconKey"], name: string, description: string,
  gems: number, grants: ProductGrant[], purchaseLimit: number, refresh: ProductRefresh, rotationSlot?: string,
): ProductDefinition {
  return {
    id, storefront: "trade", category, iconKey, name, description,
    acquisition: { kind: "currency", currency: "gems", amount: gems },
    grants, defaultQuantity: 1, purchaseLimit, refresh, ...ALWAYS,
    ...(rotationSlot ? { rotationSlot } : {}),
  };
}
const cur = (currency: ProductCurrency, amount: number): ProductGrant => ({ kind: "currency", currency, amount });

/**
 * 무역 전시대 — **계정당 한정은 늘 서 있고, 나머지는 그때그때 사라졌다 나온다**(응태 요청 2026-11-23).
 *
 * 로테이션은 상점 룬과 같은 칸(`shopRotation` · 칸 정의 `runeRotation.ts`의 `trade-*`)을 쓴다. 칸마다 후보가 있고
 * 기간 키(주간은 그 주 월요일, 일간은 그 날 — UTC 00:00 = 오전 9시)에서 시드해 하나를 고른다. 서버와 화면이
 * 같은 순수 함수를 읽으므로 기기 시계·난수로 갈리지 않는다. 돌아가는 상품은 노출이 끝나는 시각(`visibleUntil`)을
 * 그 기간의 끝으로 내려받아 카드에 「교체까지」가 선다.
 *
 * 검수 장부(시세표 기준 환산 · 응태 승인 2026-11-23):
 *
 * | 칸 | 상품 | 값 → 받는 것 | 가치 | 횟수 |
 * |---|---|---|---|---|
 * | 계정당 | 발굴 장비 보급함 | 젬 700 → 화석 4 + 호박석 2 (1,800) | 257% | 1 |
 * | 계정당 | 개척 보급함 | 젬 300 → 골드 20만(400) + 치즈케이크 800(400) | 267% | 1 |
 * | 계정당 | 연구 착수 지원 | 젬 750 → 화석 3 + 호박석 3 (1,800) | 240% | 1 |
 * | A 주간 | 치즈케이크 보급 / 대보급 | 젬 150 → 600 (200%, 주 3) / 젬 400 → 1,600 + 골드 5만 (225%, 주 1) | | |
 * | B 주간 | 연구 보조금 / 골드 금고 | 젬 200 → 골드 17.5만 (175%, 주 1) / 젬 100 → 골드 9만 (180%, 주 2) | | |
 * | C 주간 35%·4주 보정 | 화석 상자 / 호박석 상자 | 젬 750 → 3개 (900) | 120% | 주 1 |
 * | D 일간 | 오늘의 특가 / 골드 / 치즈케이크 꾸러미 | 젬 50 → 골드 4만 + 60 / 골드 5.5만 / 220 | 220% | 1 |
 *
 * 주간 기대 공급(다 산다고 칠 때): 치즈케이크 2,220 → 약 2,350(+6%), 골드 45.5만 → 약 42.4만(−7%),
 * 화석·호박석 0 → 평균 약 1.2개(새 반복 수급처 — 할인 폭은 주 평균 젬 60 남짓).
 *
 * **계정당 한정이 늘 가장 후하다**(반복 상품의 최고 225%보다 위). 다시 오지 않는 것이 가장 좋은 값을 가져야 한 번뿐인 값이 선다.
 * 전시 순서는 계정당 → 주간 → 일간이다.
 */
export const TRADE_PACKAGES: readonly ProductDefinition[] = [
  pack("trade-excavation-crate", "special", "shop-product-supplies", "발굴 장비 보급함", "화석 4개와 호박석 2개", 700, [cur("fossil", 4), cur("amber", 2)], 1, "once"),
  pack("trade-pioneer-crate", "special", "shop-product-supplies", "개척 보급함", "골드 200,000과 치즈케이크 800개", 300, [cur("gold", 200_000), cur("cheesecake", 800)], 1, "once"),
  pack("trade-research-kickoff", "special", "shop-product-supplies", "연구 착수 지원", "화석 3개와 호박석 3개", 750, [cur("fossil", 3), cur("amber", 3)], 1, "once"),
  pack("trade-cheesecake-supply", "weekly", "shop-product-supplies", "치즈케이크 보급", "치즈케이크 600개", 150, [cur("cheesecake", 600)], 3, "weekly", "trade-weekly-supply"),
  pack("trade-cheesecake-bulk", "weekly", "shop-product-supplies", "치즈케이크 대보급", "치즈케이크 1,600개와 골드 50,000", 400, [cur("cheesecake", 1_600), cur("gold", 50_000)], 1, "weekly", "trade-weekly-supply"),
  pack("trade-research-grant", "weekly", "shop-product-enhancement", "연구 보조금", "골드 175,000개", 200, [cur("gold", 175_000)], 1, "weekly", "trade-weekly-funds"),
  pack("trade-gold-vault", "weekly", "shop-product-enhancement", "골드 금고", "골드 90,000개", 100, [cur("gold", 90_000)], 2, "weekly", "trade-weekly-funds"),
  pack("trade-fossil-case", "weekly", "shop-product-supplies", "화석 상자", "화석 3개", 750, [cur("fossil", 3)], 1, "weekly", "trade-weekly-research"),
  pack("trade-amber-case", "weekly", "shop-product-supplies", "호박석 상자", "호박석 3개", 750, [cur("amber", 3)], 1, "weekly", "trade-weekly-research"),
  pack("trade-daily-bundle", "daily", "shop-product-supplies", "오늘의 특가 꾸러미", "골드 40,000과 치즈케이크 60개", 50, [cur("gold", 40_000), cur("cheesecake", 60)], 1, "daily", "trade-daily"),
  pack("trade-gold-bundle", "daily", "shop-product-enhancement", "골드 꾸러미", "골드 55,000", 50, [cur("gold", 55_000)], 1, "daily", "trade-daily"),
  pack("trade-cheesecake-bundle", "daily", "shop-product-supplies", "치즈케이크 꾸러미", "치즈케이크 220개", 50, [cur("cheesecake", 220)], 1, "daily", "trade-daily"),
];

/** 한 번에 전시대에 설 수 있는 최대 장수 — 계정당 한정 전부 + 로테이션 칸마다 하나. 창 규격이 이 값으로 정해진다. */
export const TRADE_DISPLAY_MAX = TRADE_PACKAGES.filter(({ rotationSlot }) => !rotationSlot).length
  + new Set(TRADE_PACKAGES.flatMap(({ rotationSlot }) => rotationSlot ? [rotationSlot] : [])).size;

/** 무역 묶음의 이름과 설명을 언어별로 덮어쓸 수 있게 등록한다. */
for (const pkg of TRADE_PACKAGES) {
  registerDataText(pkg, "name", `trade.${pkg.id}.name`);
  registerDataText(pkg, "description", `trade.${pkg.id}.description`);
}

/** 갱신 주기 이름도 함께 등록한다. */
for (const key of Object.keys(REFRESH_LABEL)) registerDataText(REFRESH_LABEL, key, `trade.refresh.${key}`);
