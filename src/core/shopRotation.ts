/**
 * 상점의 로테이션 칸 — 어느 기간에 어느 상품이 나오는가.
 *
 * 룬은 늘 진열하지 않고 **가끔** 나온다. 늘 있으면 기다릴 이유도, 들러 볼 이유도 서지 않는다.
 * 결과는 칸 ID와 기간 키(일·주를 나타내는 날짜 문자열)에서만 나오는 **순수 함수**라, 서버와 화면이
 * 같은 답을 읽고 기기 시계나 난수 상태로 갈리지 않는다. 난수는 없다 — 키에서 시드한다.
 */

export type RotationPeriod = "daily" | "weekly";

export interface RotationSlot {
  id: string;
  period: RotationPeriod;
  /** 기간마다 이 칸이 열릴 확률(%). */
  chancePercent: number;
  /** 열린 기간에 서는 후보 상품 ID. 하나가 균등하게 뽑힌다. */
  candidates: readonly string[];
  /** 이 기간 수만큼 연달아 닫혀 있으면 다음 기간은 확정으로 연다(운이 나빠 영영 못 사는 일을 막는다). */
  pityAfterMisses?: number;
}

/** 보정(연속 닫힘)을 세기 시작하는 첫 월요일. 이 이전 기간은 열린 적 없는 것으로 본다. */
export const ROTATION_EPOCH = "2026-01-05";

/** 문자열 → 0 이상 1 미만 값. FNV-1a 32비트라 같은 입력은 어디서나 같은 값을 낸다. */
export function rotationRoll(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  // 마지막 섞기 — 끝만 다른 키(날짜의 마지막 자리)가 비슷한 값으로 몰리지 않게 한다.
  hash ^= hash >>> 15; hash = Math.imul(hash, 0x2c1b3c6d) >>> 0; hash ^= hash >>> 12;
  return (hash >>> 0) / 0x100000000;
}

/** 이 기간에 칸이 **보정 없이** 열리는가. */
function opensNaturally(slot: RotationSlot, periodKey: string): boolean {
  return rotationRoll(`${slot.id}:open:${periodKey}`) * 100 < slot.chancePercent;
}

/** 주간 기간 키(월요일 날짜)의 직전 주 키. */
function previousWeekKey(periodKey: string): string {
  const date = new Date(`${periodKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 7);
  return date.toISOString().slice(0, 10);
}

/** 이 기간까지 연달아 닫혀 있던 주 수. 보정 판정에만 쓴다. */
function consecutiveMisses(slot: RotationSlot, periodKey: string): number {
  // 시작점에서 앞으로 한 번 훑는다 — 보정으로 연 주가 계수를 0으로 되돌리므로 거꾸로 세면 어긋난다.
  const keys: string[] = [];
  for (let key = periodKey; key >= ROTATION_EPOCH; key = previousWeekKey(key)) keys.push(key);
  keys.reverse();
  let misses = 0;
  for (const key of keys.slice(0, -1)) {
    const open = opensNaturally(slot, key) || (slot.pityAfterMisses !== undefined && misses >= slot.pityAfterMisses);
    misses = open ? 0 : misses + 1;
  }
  return misses;
}

/**
 * 이 기간에 칸에 서는 상품 ID. 닫힌 기간이면 `null`.
 *
 * 주간 칸의 `periodKey`는 그 주의 월요일(`YYYY-MM-DD`), 일간 칸은 그 날(`YYYY-MM-DD`)이다 — 서버의
 * 상품 기간 키(`productPeriodKey`)와 같은 값이다.
 */
export function rotationOffer(slot: RotationSlot, periodKey: string): string | null {
  if (slot.candidates.length === 0) return null;
  const forced = slot.period === "weekly" && slot.pityAfterMisses !== undefined && consecutiveMisses(slot, periodKey) >= slot.pityAfterMisses;
  if (!forced && !opensNaturally(slot, periodKey)) return null;
  const pick = Math.floor(rotationRoll(`${slot.id}:pick:${periodKey}`) * slot.candidates.length);
  return slot.candidates[Math.min(slot.candidates.length - 1, pick)] ?? null;
}

/**
 * 그 기간에 룬 칸이 내놓는 룬의 **자리**(0~2).
 *
 * 룬은 상점에 서는 순간부터 자리가 정해져 있다 — 사는 쪽이 자리를 고르게 하면 3번 자리만 필요한 사람이
 * 그 한 칸을 기다려 고르기만 하면 되어 「어느 주에 무엇이 나오는가」가 사라진다. 자리도 칸 ID와 기간 키에서만
 * 시드하므로 서버와 화면이 같은 답을 읽는다.
 */
export function rotationRunePart(slot: Pick<RotationSlot, "id">, periodKey: string): 0 | 1 | 2 {
  return Math.min(2, Math.floor(rotationRoll(`${slot.id}:part:${periodKey}`) * 3)) as 0 | 1 | 2;
}
