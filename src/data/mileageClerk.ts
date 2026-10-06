import { PLAYABLE_RELICS } from "./relics";
import { BANNERS, LIMITED_RELIC_IDS } from "./banners";
import type { ProductDefinition } from "./products";

const DAY_MS = 86_400_000;
/** 1970-01-05(월)의 UTC 자정. 주 번호는 여기서 센다 — 상점의 주간 주기(`productPeriodKey`)와 같은 월요일 경계다. */
const FIRST_MONDAY_MS = 4 * DAY_MS;

/** 그 시각이 속한 주의 번호. 월요일 00:00 UTC에 하나 오른다. */
export function mileageWeekIndex(now: Date): number {
  return Math.floor((now.getTime() - FIRST_MONDAY_MS) / (7 * DAY_MS));
}

/**
 * 이번 주 마일리지 상점에 서는 SSR 후보.
 *
 * **한정과 지금 픽업 중인 개체는 뺀다** — 픽업은 뽑기가 이미 밀어 주는 개체이고, 마일리지 상점은
 * 그 바깥의 SSR을 파편 한 장씩 닿게 하는 자리다. 순서는 도감 순서를 그대로 쓴다.
 */
export function mileageClerkPool(): string[] {
  const pickups = new Set(BANNERS.flatMap((banner) => banner.pickupRelicIds.SSR ?? []));
  return PLAYABLE_RELICS
    .filter((relic) => relic.rarity === "SSR" && !LIMITED_RELIC_IDS.has(relic.id) && !pickups.has(relic.id))
    .map((relic) => relic.id);
}

/**
 * 이번 주의 점원 겸 주간 SSR 파편의 주인.
 *
 * 서버(구매)와 화면(점원)이 **같은 함수**를 읽는다 — 두 곳이 따로 고르면 눈앞의 점원과 사는 파편이
 * 갈린다. 후보가 비면(한정만 남은 극단적 운영) `undefined`.
 */
export function mileageWeeklyClerkId(now: Date): string | undefined {
  const pool = mileageClerkPool();
  if (pool.length === 0) return undefined;
  return pool[((mileageWeekIndex(now) % pool.length) + pool.length) % pool.length];
}

/**
 * 주간 SR·일간 R 파편의 후보 — 한정과 지금 픽업 중인 개체는 뺀다(SSR 점원과 같은 이유).
 * 도감 순서를 그대로 쓴다.
 */
export function mileageRotationPool(rarity: "SR" | "R"): string[] {
  const pickups = new Set(BANNERS.flatMap((banner) => banner.pickupRelicIds[rarity] ?? []));
  return PLAYABLE_RELICS
    .filter((relic) => relic.rarity === rarity && !LIMITED_RELIC_IDS.has(relic.id) && !pickups.has(relic.id))
    .map((relic) => relic.id);
}

/** 그 시각이 속한 날의 번호. UTC 자정에 하나 오른다 — 일간 상품의 갱신 경계와 같다. */
export function mileageDayIndex(now: Date): number {
  return Math.floor(now.getTime() / DAY_MS);
}

/**
 * 이번 기간의 SR·R 파편 주인.
 *
 * 난수를 클라이언트가 만들지 않는다 — 기간 번호를 섞은 값에서만 나오는 순수 함수라 서버(구매)와
 * 화면(미리보기)이 같은 개체를 읽는다. 등급·주기마다 소금을 달리해 서로 다른 개체가 선다.
 */
export function mileageRotatingFragmentId(rarity: "SR" | "R", period: "weekly" | "daily", now: Date): string | undefined {
  const pool = mileageRotationPool(rarity);
  if (pool.length === 0) return undefined;
  const index = period === "weekly" ? mileageWeekIndex(now) : mileageDayIndex(now);
  const salt = (rarity === "SR" ? 0x9e3779b1 : 0x85ebca6b) ^ (period === "weekly" ? 0x27d4eb2f : 0x165667b1);
  let mixed = Math.imul(index + 1, 0x2545f491) ^ salt;
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x85ebca6b);
  mixed = Math.imul(mixed ^ (mixed >>> 13), 0xc2b2ae35);
  mixed ^= mixed >>> 16;
  return pool[(mixed >>> 0) % pool.length];
}

/** 파편 상품의 지급이 구매 순간에 가리키는 개체. 파편 자리표시가 아닌 지급이면 `undefined`. */
export function mileageFragmentRelicId(grant: ProductDefinition["grants"][number], now: Date): string | undefined {
  if (grant.kind === "weekly_ssr_fragment") return mileageWeeklyClerkId(now);
  if (grant.kind === "rotating_fragment") return mileageRotatingFragmentId(grant.rarity, grant.period, now);
  return undefined;
}

/** 점원이 한 번에 읽는 상태 대사의 수. 개체마다 같아 누르는 대로 한 바퀴 돈다. */
export const MILEAGE_CLERK_LINE_COUNT = 4;
