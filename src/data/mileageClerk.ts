import { PLAYABLE_RELICS } from "./relics";
import { BANNERS, LIMITED_RELIC_IDS } from "./banners";

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

/** 점원이 한 번에 읽는 상태 대사의 수. 개체마다 같아 누르는 대로 한 바퀴 돈다. */
export const MILEAGE_CLERK_LINE_COUNT = 4;
