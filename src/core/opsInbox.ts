import type { MailDto, MailRewardDto } from "../api/contracts";
import { WALLET_CAPS } from "../data/economy";
import { findItem } from "../data/items";
import { addItemLot, removeItemLot } from "./itemLots";
import type { Wallet } from "./gacha";
import type { Session } from "../state/session";

/**
 * 운영 도구(어드민)가 DB에 올린 우편·재화 조정을 게임 상태로 옮기는 순수 규칙.
 * 게임의 지갑과 수령 기록은 서버가 소유한 저장(player_saves) 안에 있으므로, 운영 표를 직접 바꾸지 않고
 * 접속 중인 계정의 서버 호출에서 이 규칙으로 저장에 반영한다. DB·HTTP·Phaser를 모른다.
 */

/** 서버 DB가 내려 주는 운영 우편. 첨부는 지갑 키 + 수량이다. */
export interface OpsMailSource { id: string; title: string; body: string; rewards: { asset: string; amount: number }[]; sentAt: string; expiresAt: string | null; }
/** 아직 반영되지 않은 재화 조정. */
export interface OpsAdjustmentSource { id: string; asset: string; delta: number; note?: string | null; createdAt: string; }
export interface OpsInbox { mails: OpsMailSource[]; adjustments: OpsAdjustmentSource[]; }
/** 서버가 확정한 조정의 결과 — DB 원장에 실제 반영량과 잔액이 남는다. */
export interface OpsAppliedAdjustment { id: string; applied: number; balance: number; }

/** 플레이어에게 한 번 알리는 운영 소식. */
export type OpsNotice =
  | { kind: "asset"; asset: keyof Wallet; delta: number; note?: string; at: string }
  | { kind: "item"; itemId: string; delta: number; note?: string; at: string }
  | { kind: "mail"; title: string; at: string };

export interface OpsJournal {
  /** 이미 지갑에 반영한 조정 ID(확정 뒤 DB 표시가 실패해도 두 번 반영되지 않는다). */
  appliedAdjustments: string[];
  readMails: string[];
  announcedMails: string[];
  notices: OpsNotice[];
}

const KEEP = 200;
const NOTICE_KEEP = 20;
export const OPS_MAIL_PREFIX = "ops:";

export const isOpsMailId = (id: string): boolean => id.startsWith(OPS_MAIL_PREFIX);
export const opsMailUuid = (id: string): string => id.slice(OPS_MAIL_PREFIX.length);

const emptyOps = (): OpsJournal => ({ appliedAdjustments: [], readMails: [], announcedMails: [], notices: [] });
const tail = <T>(list: readonly T[]): T[] => list.slice(-KEEP);

export function isValidOpsJournal(value: unknown): value is OpsJournal {
  if (!value || typeof value !== "object") return false;
  const ops = value as OpsJournal;
  const ids = (v: unknown): boolean => Array.isArray(v) && v.every((id) => typeof id === "string");
  return ids(ops.appliedAdjustments) && ids(ops.readMails) && ids(ops.announcedMails) && Array.isArray(ops.notices)
    && ops.notices.every((n) => !!n && typeof n === "object" && ((n.kind === "asset" && typeof n.asset === "string" && Number.isFinite(n.delta)) || (n.kind === "item" && typeof n.itemId === "string" && Number.isFinite(n.delta)) || (n.kind === "mail" && typeof n.title === "string")));
}

/** 저장의 운영 기록을 꺼낸다. 없으면 만들어 붙인다. */
export function opsJournalOf(state: Session): OpsJournal {
  state.serverJournal ??= { receipts: {}, raidAdmissions: {} };
  state.serverJournal.ops ??= emptyOps();
  return state.serverJournal.ops;
}

const walletKeys = new Set<string>(Object.keys(WALLET_CAPS));
export const OPS_ITEM_PREFIX = "item:";
export const isWalletKey = (key: string): key is keyof Wallet => walletKeys.has(key);

/**
 * 재화 조정을 지갑에 반영한다. 이미 반영한 ID는 다시 더하지 않고, 상한/0 아래로는 깎아서 적용한다.
 * 돌려주는 목록은 DB가 처리 표시를 남길 때 쓴다(이미 반영한 것도 포함).
 */
export function applyOpsAdjustments(state: Session, adjustments: readonly OpsAdjustmentSource[], now: Date): OpsAppliedAdjustment[] {
  const journal = opsJournalOf(state);
  const results: OpsAppliedAdjustment[] = [];
  for (const adjustment of adjustments) {
    if (adjustment.asset.startsWith(OPS_ITEM_PREFIX)) { results.push(applyItemAdjustment(state, journal, adjustment, now)); continue; }
    if (!isWalletKey(adjustment.asset) || !Number.isFinite(adjustment.delta) || adjustment.delta === 0) {
      // 알 수 없는 재화는 지갑에 닿지 않는다. 대기함에서 치워 되풀이되지 않게 0으로 확정한다.
      results.push({ id: adjustment.id, applied: 0, balance: 0 });
      continue;
    }
    const key = adjustment.asset;
    if (journal.appliedAdjustments.includes(adjustment.id)) { results.push({ id: adjustment.id, applied: adjustment.delta, balance: state.wallet[key] }); continue; }
    const before = state.wallet[key];
    const after = Math.max(0, Math.min(WALLET_CAPS[key], before + adjustment.delta));
    state.wallet[key] = after;
    journal.appliedAdjustments = tail([...journal.appliedAdjustments, adjustment.id]);
    const applied = after - before;
    results.push({ id: adjustment.id, applied, balance: after });
    if (applied !== 0) journal.notices = [...journal.notices, { kind: "asset" as const, asset: key, delta: applied, ...(adjustment.note ? { note: adjustment.note } : {}), at: now.toISOString() }].slice(-NOTICE_KEEP);
  }
  return results;
}

/** 아이템 조정: 가방에 넣거나 뺀다. 쌓을 한도/보유량을 넘는 몫은 깎아서 적용하고, 알 수 없는 아이템은 0으로 확정해 대기함에서 치운다. */
function applyItemAdjustment(state: Session, journal: OpsJournal, adjustment: OpsAdjustmentSource, now: Date): OpsAppliedAdjustment {
  const itemId = adjustment.asset.slice(OPS_ITEM_PREFIX.length);
  const definition = findItem(itemId);
  const held = (): number => state.itemInventory.find((entry) => entry.itemId === itemId)?.quantity ?? 0;
  if (!definition || !Number.isFinite(adjustment.delta) || adjustment.delta === 0) return { id: adjustment.id, applied: 0, balance: 0 };
  if (journal.appliedAdjustments.includes(adjustment.id)) return { id: adjustment.id, applied: adjustment.delta, balance: held() };
  let applied = 0;
  if (adjustment.delta > 0) {
    const result = addItemLot(state.itemInventory, itemId, adjustment.delta, { cap: definition.maxStack, now, ...(definition.expiresInDays !== undefined ? { expiryDays: definition.expiresInDays } : {}) });
    state.itemInventory = result.inventory;
    applied = result.added;
  } else {
    const take = Math.min(held(), -adjustment.delta);
    const next = take > 0 ? removeItemLot(state.itemInventory, itemId, take) : undefined;
    if (next) { state.itemInventory = next; applied = -take; }
  }
  journal.appliedAdjustments = tail([...journal.appliedAdjustments, adjustment.id]);
  if (applied !== 0) journal.notices = [...journal.notices, { kind: "item" as const, itemId, delta: applied, ...(adjustment.note ? { note: adjustment.note } : {}), at: now.toISOString() }].slice(-NOTICE_KEEP);
  return { id: adjustment.id, applied, balance: held() };
}

/** 운영 우편을 게임의 우편 행으로 바꾼다. 읽음 여부는 저장의 기록에서, 수령 여부는 호출한 쪽이 claimedMailIds로 정한다. */
export function opsMailToDto(source: OpsMailSource, sender: string, readIds: ReadonlySet<string>): MailDto {
  const rewards: MailRewardDto[] = source.rewards
    .filter((reward) => Number.isInteger(reward.amount) && reward.amount > 0
      && (isWalletKey(reward.asset) || (reward.asset.startsWith(OPS_ITEM_PREFIX) && findItem(reward.asset.slice(OPS_ITEM_PREFIX.length)) !== undefined)))
    .map((reward): MailRewardDto => isWalletKey(reward.asset)
      ? { kind: "currency", currency: reward.asset, amount: reward.amount }
      : { kind: "item", itemId: reward.asset.slice(OPS_ITEM_PREFIX.length), amount: reward.amount });
  const id = `${OPS_MAIL_PREFIX}${source.id}`;
  return { id, title: source.title, sender, body: source.body, sentAt: source.sentAt, expiresAt: source.expiresAt, read: readIds.has(id), claimed: false, rewards };
}

/** 읽음 표시를 저장에 남긴다. */
export function markOpsMailsRead(state: Session, ids: readonly string[]): void {
  const journal = opsJournalOf(state);
  const next = ids.filter(isOpsMailId).filter((id) => !journal.readMails.includes(id));
  if (next.length) journal.readMails = tail([...journal.readMails, ...next]);
}

/** 알림 조회가 한 번 내려 준 소식은 비운다. */
export function drainOpsNotices(state: Session): OpsNotice[] {
  const journal = state.serverJournal?.ops;
  if (!journal || journal.notices.length === 0) return [];
  const notices = journal.notices;
  journal.notices = [];
  return notices;
}
