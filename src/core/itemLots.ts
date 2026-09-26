/**
 * 기한이 있는 아이템의 **묶음(lot)** — 받은 시각마다 따로 사라지는 몫.
 *
 * 에너지 드링크는 받은 순간부터 정해진 날(1~7일)이 지나면 사라진다. 한 칸에 수량 하나만 두면
 * 어제 받은 세 병과 오늘 받은 한 병이 언제 사라지는지 가를 수 없다 — 그래서 기한이 있는 아이템만
 * 칸 안에 **받은 묶음의 목록**을 함께 들고, 칸의 `quantity`는 늘 그 합이다(다른 화면은 지금처럼
 * `quantity`만 읽으면 된다). 쓸 때는 **가장 먼저 사라질 묶음부터** 덜어 낸다.
 *
 * 순수 규칙이라 서버 경계(`FakeServer`)·저장 검증·화면이 같은 계산을 쓴다. 시각은 인자로 받는다.
 */
export interface ItemLot { quantity: number; expiresAt: string; }
export interface LotStack { itemId: string; quantity: number; lots?: ItemLot[]; }

const DAY_MS = 86_400_000;

/** 기한 날수는 1~7일 사이로만 받는다 — 더 짧으면 받자마자 사라지고, 더 길면 기한이 뜻을 잃는다. */
export const ITEM_EXPIRY_DAYS = { min: 1, max: 7 } as const;

export function clampExpiryDays(days: number): number {
  return Math.max(ITEM_EXPIRY_DAYS.min, Math.min(ITEM_EXPIRY_DAYS.max, Math.floor(days)));
}

export function lotExpiresAt(now: Date, days: number): string {
  return new Date(now.getTime() + clampExpiryDays(days) * DAY_MS).toISOString();
}

/** 묶음을 사라지는 순서로 정렬해 합을 다시 센다. */
function normalizeLots(lots: readonly ItemLot[]): ItemLot[] {
  return lots.filter((lot) => lot.quantity > 0).map((lot) => ({ ...lot })).sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
}

/**
 * 가방에 넣는다. `expiryDays`가 있으면 그 날수의 묶음 하나가 더해지고, 없으면 기한 없는 수량만
 * 늘린다. 쌓을 한도(`cap`)를 넘는 몫은 **깎아서** 준다 — 던지면 가득 찬 계정의 지급 경로가 통째로 막힌다.
 */
export function addItemLot<T extends LotStack>(inventory: readonly T[], itemId: string, quantity: number, options: { cap: number; now: Date; expiryDays?: number }): { inventory: T[]; added: number } {
  const next = inventory.map((stack) => ({ ...stack, ...(stack.lots ? { lots: stack.lots.map((lot) => ({ ...lot })) } : {}) })) as T[];
  const stack = next.find((entry) => entry.itemId === itemId);
  const held = stack?.quantity ?? 0;
  const added = Math.max(0, Math.min(options.cap, held + Math.floor(quantity)) - held);
  if (added <= 0) return { inventory: next, added: 0 };
  const lot = options.expiryDays !== undefined ? { quantity: added, expiresAt: lotExpiresAt(options.now, options.expiryDays) } : undefined;
  if (stack) {
    stack.quantity += added;
    if (lot) stack.lots = normalizeLots([...(stack.lots ?? []), lot]);
  } else {
    next.push({ itemId, quantity: added, ...(lot ? { lots: [lot] } : {}) } as T);
  }
  return { inventory: next, added };
}

/** 덜어 낸다. 모자라면 `undefined` — 부르는 쪽이 거절한다. 기한 있는 칸은 먼저 사라질 묶음부터 쓴다. */
export function removeItemLot<T extends LotStack>(inventory: readonly T[], itemId: string, quantity: number): T[] | undefined {
  const count = Math.floor(quantity);
  const stack = inventory.find((entry) => entry.itemId === itemId);
  if (!stack || count <= 0 || stack.quantity < count) return count <= 0 ? inventory.map((entry) => ({ ...entry })) : undefined;
  return inventory.flatMap((entry) => {
    if (entry.itemId !== itemId) return [{ ...entry }];
    const left = entry.quantity - count;
    if (left <= 0) return [];
    if (!entry.lots) return [{ ...entry, quantity: left }];
    let owed = count;
    const lots = normalizeLots(entry.lots).map((lot) => { const take = Math.min(owed, lot.quantity); owed -= take; return { ...lot, quantity: lot.quantity - take }; });
    return [{ ...entry, quantity: left, lots: normalizeLots(lots) }];
  });
}

/** 기한이 지난 묶음을 걷는다. 걷힌 수량을 함께 돌려준다. */
export function purgeExpiredLots<T extends LotStack>(inventory: readonly T[], now: Date): { inventory: T[]; expired: number } {
  let expired = 0;
  const nowMs = now.getTime();
  const next = inventory.flatMap((entry) => {
    if (!entry.lots) return [{ ...entry }];
    const alive = normalizeLots(entry.lots.filter((lot) => { const dead = Date.parse(lot.expiresAt) <= nowMs; if (dead) expired += lot.quantity; return !dead; }));
    const quantity = alive.reduce((sum, lot) => sum + lot.quantity, 0);
    return quantity > 0 ? [{ ...entry, quantity, lots: alive }] : [];
  });
  return { inventory: next, expired };
}

/** 칸에서 가장 먼저 사라질 묶음. 기한이 없으면 없다. */
export function nextExpiringLot(stack: LotStack | undefined): ItemLot | undefined {
  return stack?.lots ? normalizeLots(stack.lots)[0] : undefined;
}

/**
 * 남은 시간을 `7D` · `24H` · `60M` 한 마디로 — 가방 칸 왼쪽 위의 작은 표식이 이것만 적는다.
 *
 * **올려서 센다.** 받은 병은 막 받았을 때 `7D`로 서야 하고(내려서 세면 받자마자 `6D`), 하루가 안 남으면
 * `24H`부터, 한 시간이 안 남으면 `60M`부터 줄어든다. 자세한 남은 시간은 눌러서 여는 안내창이 말한다.
 */
export function remainingLabel(expiresAt: string, now: Date): string {
  const ms = Math.max(0, Date.parse(expiresAt) - now.getTime());
  if (ms > DAY_MS) return `${Math.ceil(ms / DAY_MS)}D`;
  if (ms > 3_600_000) return `${Math.ceil(ms / 3_600_000)}H`;
  return `${Math.max(1, Math.ceil(ms / 60_000))}M`;
}

/** 남은 시간을 일·시·분·초로 가른다. 안내창의 자세한 한 줄이 쓴다. */
export function remainingParts(expiresAt: string, now: Date): { days: number; hours: number; minutes: number; seconds: number } {
  const total = Math.max(0, Math.floor((Date.parse(expiresAt) - now.getTime()) / 1000));
  return { days: Math.floor(total / 86_400), hours: Math.floor(total / 3_600) % 24, minutes: Math.floor(total / 60) % 60, seconds: total % 60 };
}

/** 저장 검증 — 묶음이 있는 칸은 합이 `quantity`와 같고 각 묶음이 양수·올바른 시각이어야 한다. */
export function isValidLotStack(stack: LotStack): boolean {
  if (stack.lots === undefined) return true;
  if (!Array.isArray(stack.lots) || stack.lots.length === 0) return false;
  return stack.lots.every((lot) => Number.isInteger(lot.quantity) && lot.quantity > 0 && Number.isFinite(Date.parse(lot.expiresAt)))
    && stack.lots.reduce((sum, lot) => sum + lot.quantity, 0) === stack.quantity;
}
