import { sameJsonShape } from "./jsonShape";

/**
 * 연구(뽑기) 기록 — 서버가 연구를 확정하는 그 저장에 함께 남기는 영수증 줄.
 *
 * **한 번의 연구 요청이 한 묶음이다**(단일 1칸 · 10연 10칸). 묶음은 언제·어느 배너·몇 회·무엇을 치렀고
 * 그 직후 천장이 몇이었는지를, 칸은 추첨 순서대로 무엇이 나왔는지를 든다.
 *
 * **지우는 길이 없다.** 확률형 상품의 결과 기록이라 플레이어가 지우거나 고칠 수 없고, 쓰는 일은
 * `pullRelics` 한 곳만 한다. 저장을 무한히 키우지 않도록 **최근 칸 수**(`GACHA_HISTORY_SLOT_LIMIT`)를 넘는
 * 가장 오래된 묶음만 걷는다 — 걷는 단위가 묶음이라 10연 하나가 반쯤 잘려 남지 않는다.
 */
export const GACHA_HISTORY_SLOT_LIMIT = 100;

export type GachaHistorySlot =
  | { kind: "relic"; relicId: string; isNew?: true }
  | { kind: "currency"; currency: "gold" | "cheesecake"; amount: number };

export interface GachaHistoryEntry {
  /** 서버가 확정한 시각(ISO). */
  at: string;
  bannerId: string;
  count: 1 | 10;
  /** 이번 연구에 치른 값 — 지갑 키마다 쓴 양(화석·호박석·모자란 몫을 채운 젬). */
  cost: Record<string, number>;
  /** 연구 직후 그 천장 그룹의 SSR 이후 누적 횟수. */
  pity: number;
  slots: GachaHistorySlot[];
}

export interface GachaHistoryState {
  /** 오래된 것부터 쌓인다. 화면은 뒤집어 최신부터 보인다. */
  entries: GachaHistoryEntry[];
}

export function createEmptyGachaHistory(): GachaHistoryState {
  return { entries: [] };
}

function normalizeSlot(value: unknown): GachaHistorySlot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const slot = value as Record<string, unknown>;
  if (slot.kind === "relic" && typeof slot.relicId === "string" && slot.relicId) {
    return slot.isNew === true ? { kind: "relic", relicId: slot.relicId, isNew: true } : { kind: "relic", relicId: slot.relicId };
  }
  if (slot.kind === "currency" && (slot.currency === "gold" || slot.currency === "cheesecake") && Number.isInteger(slot.amount) && (slot.amount as number) >= 0) {
    return { kind: "currency", currency: slot.currency, amount: slot.amount as number };
  }
  return undefined;
}

function normalizeEntry(value: unknown): GachaHistoryEntry | undefined {
  if (!value || typeof value !== "object") return undefined;
  const entry = value as Record<string, unknown>;
  if (typeof entry.at !== "string" || Number.isNaN(Date.parse(entry.at))) return undefined;
  if (typeof entry.bannerId !== "string" || !entry.bannerId) return undefined;
  if (entry.count !== 1 && entry.count !== 10) return undefined;
  if (!Array.isArray(entry.slots)) return undefined;
  const slots = entry.slots.map(normalizeSlot);
  if (slots.length === 0 || slots.some((slot) => slot === undefined)) return undefined;
  const cost: Record<string, number> = {};
  if (entry.cost && typeof entry.cost === "object" && !Array.isArray(entry.cost)) {
    for (const [key, amount] of Object.entries(entry.cost as Record<string, unknown>)) {
      if (Number.isInteger(amount) && (amount as number) > 0) cost[key] = amount as number;
    }
  }
  const pity = Number.isInteger(entry.pity) && (entry.pity as number) >= 0 ? entry.pity as number : 0;
  return { at: entry.at, bannerId: entry.bannerId, count: entry.count, cost, pity, slots: slots as GachaHistorySlot[] };
}

/** 최근 칸 수를 넘는 가장 오래된 묶음을 걷는다. */
function trim(entries: GachaHistoryEntry[]): GachaHistoryEntry[] {
  let total = entries.reduce((sum, entry) => sum + entry.slots.length, 0);
  let start = 0;
  while (total > GACHA_HISTORY_SLOT_LIMIT && start < entries.length - 1) {
    total -= entries[start].slots.length;
    start += 1;
  }
  return entries.slice(start);
}

export function normalizeGachaHistory(value: unknown): GachaHistoryState {
  if (!value || typeof value !== "object" || !Array.isArray((value as GachaHistoryState).entries)) return createEmptyGachaHistory();
  const entries = (value as GachaHistoryState).entries.map(normalizeEntry).filter((entry): entry is GachaHistoryEntry => entry !== undefined);
  return { entries: trim(entries) };
}

/** 도입 전 저장에는 없다(`undefined`). 있으면 정규화한 값과 모양이 같아야 한다. */
export function isValidGachaHistory(value: unknown): boolean {
  if (value === undefined) return true;
  return !!value && typeof value === "object" && sameJsonShape(normalizeGachaHistory(value), value);
}

/** 한 묶음을 더한 다음 값. 원본을 건드리지 않는다. */
export function appendGachaHistory(state: GachaHistoryState | undefined, entry: GachaHistoryEntry): GachaHistoryState {
  const current = normalizeGachaHistory(state);
  // 더하는 묶음도 같은 정규화를 지난다 — 저장 검증이 모양을 다시 맞춰 보므로, 여기서 어긋나면 그 계정이 열리지 않는다.
  const normalized = normalizeEntry(entry);
  return { entries: trim(normalized ? [...current.entries, normalized] : current.entries) };
}

/** 화면이 읽는 줄 — 최신 묶음부터, 묶음 안은 추첨 순서다. */
export function gachaHistoryNewestFirst(state: GachaHistoryState | undefined): GachaHistoryEntry[] {
  return [...normalizeGachaHistory(state).entries].reverse();
}

/** 기록에 남는 칸 수(창 머리의 `최근 N건`). */
export function gachaHistorySlotCount(state: GachaHistoryState | undefined): number {
  return normalizeGachaHistory(state).entries.reduce((sum, entry) => sum + entry.slots.length, 0);
}
