/**
 * 유료 상품의 가격 표기 — 지역 화폐로 보여 준다.
 *
 * **임시 환산이다.** 결제 SDK가 들어오면 스토어가 돌려주는 현지 가격 문자열을 그대로 쓴다(스토어 가격은 나라별 가격표라
 * 환산한 값과 어긋난다). 그 전까지는 원화 기준 가격(`basePriceKrw`)에 아래 표의 비율만 곱해 보여 준다.
 * **환율이 아니라 "한국 가격과 같은 비율"의 자리 표시값**이며, 가격 조사를 거쳐 나라별 가격을 따로 정하면
 * `KRW_PER_UNIT`만 갈아 끼우면 된다 — 화면은 이 파일의 `formatStorePrice` 하나만 부르고 `₩` 같은 기호를 직접 적지 않는다.
 *
 * 지역은 언어 설정이 아니라 기기의 지역(`navigator.languages`의 지역 코드)을 따른다. 언어를 바꿔도 통화는 그대로다.
 */

export type StoreCurrency = "KRW" | "USD" | "JPY" | "EUR" | "GBP" | "CNY" | "TWD" | "THB" | "VND" | "IDR" | "BRL" | "RUB" | "CAD" | "AUD";

/** 임시 비율: 그 통화 한 단위가 원화로 얼마인가. 가격 조사 뒤 이 표만 고친다. */
export const KRW_PER_UNIT: Readonly<Record<StoreCurrency, number>> = {
  KRW: 1, USD: 1400, JPY: 9.3, EUR: 1500, GBP: 1750, CNY: 195, TWD: 44, THB: 42, VND: 0.054, IDR: 0.088, BRL: 255, RUB: 15, CAD: 1020, AUD: 920,
};

/** 소수 자릿수. 나머지는 통화 관례를 따라 둘이다. */
const FRACTION_DIGITS: Partial<Record<StoreCurrency, number>> = { KRW: 0, JPY: 0, VND: 0, IDR: 0, TWD: 0, RUB: 0 };

const EURO_REGIONS = ["DE", "FR", "ES", "IT", "NL", "AT", "BE", "PT", "IE", "FI", "GR", "LU", "SK", "SI", "EE", "LV", "LT", "MT", "CY", "HR"];

/** 지역 → 통화. 표에 없는 지역은 `USD`다. */
export const REGION_CURRENCY: Readonly<Record<string, StoreCurrency>> = {
  KR: "KRW", US: "USD", JP: "JPY", GB: "GBP", CN: "CNY", TW: "TWD", TH: "THB", VN: "VND", ID: "IDR", BR: "BRL", RU: "RUB", CA: "CAD", AU: "AUD",
  ...Object.fromEntries(EURO_REGIONS.map((region) => [region, "EUR" as const])),
};

/** 지역 코드가 없는 언어 태그의 기본 지역. */
const LANGUAGE_REGION: Readonly<Record<string, string>> = {
  ko: "KR", en: "US", ja: "JP", zh: "CN", th: "TH", vi: "VN", id: "ID", es: "ES", pt: "BR", de: "DE", ru: "RU",
};

/** 숫자 서식을 고르는 로케일. 통화마다 그 나라 방식으로 찍는다(`$`·`₩`·`¥`·`1,50 €`). */
const CURRENCY_LOCALE: Readonly<Record<StoreCurrency, string>> = {
  KRW: "ko-KR", USD: "en-US", JPY: "ja-JP", EUR: "de-DE", GBP: "en-GB", CNY: "zh-CN", TWD: "zh-TW", THB: "th-TH", VND: "vi-VN", IDR: "id-ID", BRL: "pt-BR", RUB: "ru-RU", CAD: "en-CA", AUD: "en-AU",
};

/** 언어 태그 목록(`navigator.languages`)에서 지역을 고른다. 지역 코드가 든 첫 태그가 이기고, 없으면 첫 태그의 언어 기본 지역이다. */
export function regionFromLanguageTags(tags: readonly string[]): string | undefined {
  for (const tag of tags) {
    const region = /^[A-Za-z]{2,3}(?:-[A-Za-z]{4})?-([A-Za-z]{2})$/.exec(tag)?.[1];
    if (region) return region.toUpperCase();
  }
  const first = tags[0]?.split("-")[0]?.toLowerCase();
  return first ? LANGUAGE_REGION[first] : undefined;
}

/** 기기의 지역. 알 수 없으면 한국이다(가격 기준 시장). */
export function deviceRegion(): string {
  const tags = typeof navigator === "undefined" ? [] : navigator.languages?.length ? navigator.languages : navigator.language ? [navigator.language] : [];
  return regionFromLanguageTags(tags) ?? "KR";
}

export function currencyForRegion(region: string): StoreCurrency {
  return REGION_CURRENCY[region.toUpperCase()] ?? "USD";
}

/** 원화 기준 가격을 그 지역 화폐의 숫자로 환산한다. */
export function convertStorePrice(basePriceKrw: number, currency: StoreCurrency): number {
  const digits = FRACTION_DIGITS[currency] ?? 2;
  const factor = 10 ** digits;
  return Math.round((basePriceKrw / KRW_PER_UNIT[currency]) * factor) / factor;
}

/** 화면이 그리는 가격 문자열. 화면은 `₩`를 직접 적지 않고 이 함수만 부른다. */
export function formatStorePrice(basePriceKrw: number, region: string = deviceRegion()): string {
  const currency = currencyForRegion(region);
  const digits = FRACTION_DIGITS[currency] ?? 2;
  return new Intl.NumberFormat(CURRENCY_LOCALE[currency], { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(convertStorePrice(basePriceKrw, currency));
}
