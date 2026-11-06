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
/** 어드민이 올린 패치노트. 게임의 우편함에서는 첨부 없는 「패치노트」 탭의 안내 한 통이 된다. */
export interface OpsPatchNoteSource { id: string; version: string; title: string; releasedAt: string; items: { kind: string; text: string }[]; note: string; }
/** 운영자가 건 프로필 강제 초기화(부적절한 닉네임·소개). 다음 서버 호출에서 저장을 비우고 한 번 알린다. */
export interface OpsProfileActionSource { id: string; kind: "nickname_reset" | "bio_reset"; reason?: string | null; createdAt: string; }
/** 기간 안에 접속한 플레이어에게 한 번 띄우는 공지 팝업. 번역은 운영자가 직접 적은 언어만 있다(없으면 원문). */
export interface OpsBannerSource { id: string; title: string; body: string; translations?: Record<string, { title?: string; body?: string }> | null; startsAt: string; endsAt: string; }
export interface OpsInbox { mails: OpsMailSource[]; adjustments: OpsAdjustmentSource[]; patchNotes?: OpsPatchNoteSource[]; profileActions?: OpsProfileActionSource[]; banners?: OpsBannerSource[]; }
/** 서버가 확정한 조정의 결과 — DB 원장에 실제 반영량과 잔액이 남는다. */
export interface OpsAppliedAdjustment { id: string; applied: number; balance: number; }

/** 플레이어에게 한 번 알리는 운영 소식. */
export type OpsNotice =
  | { kind: "asset"; asset: keyof Wallet; delta: number; note?: string; at: string }
  | { kind: "item"; itemId: string; delta: number; note?: string; at: string }
  | { kind: "mail"; title: string; at: string }
  /** 운영자가 닉네임(`nickname`)이나 한 줄 소개(`bio`)를 비웠다. */
  | { kind: "profile"; field: "nickname" | "bio"; note?: string; at: string }
  | { kind: "banner"; id: string; title: string; body: string; translations?: Record<string, { title?: string; body?: string }>; at: string };

export interface OpsJournal {
  /** 이미 지갑에 반영한 조정 ID(확정 뒤 DB 표시가 실패해도 두 번 반영되지 않는다). */
  appliedAdjustments: string[];
  readMails: string[];
  /** 플레이어가 지운 우편 ID(운영 우편이 아닌 것도 포함). */
  deletedMails?: string[];
  announcedMails: string[];
  /** 이미 띄운 공지 배너 ID. */
  seenBanners?: string[];
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
  return ids(ops.appliedAdjustments) && ids(ops.readMails) && (ops.deletedMails === undefined || ids(ops.deletedMails)) && ids(ops.announcedMails)
    && (ops.seenBanners === undefined || ids(ops.seenBanners)) && Array.isArray(ops.notices)
    && ops.notices.every((n) => !!n && typeof n === "object" && ((n.kind === "asset" && typeof n.asset === "string" && Number.isFinite(n.delta)) || (n.kind === "item" && typeof n.itemId === "string" && Number.isFinite(n.delta)) || (n.kind === "mail" && typeof n.title === "string")
      || (n.kind === "profile" && (n.field === "nickname" || n.field === "bio")) || (n.kind === "banner" && typeof n.id === "string" && typeof n.title === "string" && typeof n.body === "string")));
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

/** 패치노트 우편의 ID 접두 — 운영 우편(`ops:`)이라 읽음·삭제 기록이 그대로 남는다. */
export const OPS_PATCH_PREFIX = `${OPS_MAIL_PREFIX}patch:`;

/**
 * 패치노트를 첨부 없는 안내 우편으로 바꾼다. 항목 종류의 표기는 호출한 쪽(문구 표)이 넘긴다 — 이 모듈은 언어를 모른다.
 * 기한이 없고 지울 수 없다(첨부가 없는 안내는 삭제 불가).
 */
export function opsPatchNoteToDto(source: OpsPatchNoteSource, text: { sender: string; title: string; kinds: Readonly<Record<string, string>> }, readIds: ReadonlySet<string>): MailDto {
  const id = `${OPS_PATCH_PREFIX}${source.id}`;
  const lines = source.items.filter((item) => item.text.trim()).map((item) => `${text.kinds[item.kind] ?? text.kinds.etc ?? ""} ${item.text.trim()}`.trim());
  const body = [...lines, ...(source.note.trim() ? ["", source.note.trim()] : [])].join("\n");
  return { id, title: text.title, sender: text.sender, body, sentAt: source.releasedAt, expiresAt: null, read: readIds.has(id), claimed: false, rewards: [] };
}

/**
 * 프로필 강제 초기화를 저장에 반영한다. 닉네임을 비우면 다음 로비에서 이름을 새로 정하는 창이 다시 선다
 * (`nicknameCreationRequired`) — 처음 정하는 이름이라 이레 주기에 걸리지 않는다. 돌려주는 ID는 DB가 처리 표시를 남길 때 쓴다.
 */
export function applyOpsProfileActions(state: Session, actions: readonly OpsProfileActionSource[], now: Date): string[] {
  if (actions.length === 0) return [];
  const journal = opsJournalOf(state);
  const done: string[] = [];
  for (const action of actions) {
    const field: "nickname" | "bio" | undefined = action.kind === "nickname_reset" ? "nickname" : action.kind === "bio_reset" ? "bio" : undefined;
    done.push(action.id);
    if (!field || state.playerCard[field] === "") continue;
    state.playerCard = { ...state.playerCard, [field]: "" };
    journal.notices = [...journal.notices, { kind: "profile" as const, field, ...(action.reason ? { note: action.reason } : {}), at: now.toISOString() }].slice(-NOTICE_KEEP);
  }
  return done;
}

/** 기간 안의 공지 배너 중 아직 띄우지 않은 것을 한 번씩 소식으로 쌓는다. */
export function noticeOpsBanners(state: Session, banners: readonly OpsBannerSource[], now: Date): void {
  if (banners.length === 0) return;
  const journal = opsJournalOf(state);
  const seen = new Set(journal.seenBanners ?? []);
  const at = now.getTime();
  for (const banner of banners) {
    if (seen.has(banner.id) || !(Date.parse(banner.startsAt) <= at && at < Date.parse(banner.endsAt))) continue;
    seen.add(banner.id);
    journal.seenBanners = tail([...(journal.seenBanners ?? []), banner.id]);
    const translations = banner.translations && typeof banner.translations === "object" ? banner.translations : undefined;
    journal.notices = [...journal.notices, { kind: "banner" as const, id: banner.id, title: banner.title, body: banner.body, ...(translations ? { translations } : {}), at: now.toISOString() }].slice(-NOTICE_KEEP);
  }
}

/** 공지 배너의 제목·본문을 지금 언어로 고른다. 그 언어를 운영자가 적지 않았으면 원문이다. */
export function opsBannerText(notice: Extract<OpsNotice, { kind: "banner" }>, language: string): { title: string; body: string } {
  const variant = notice.translations?.[language];
  return { title: variant?.title?.trim() || notice.title, body: variant?.body?.trim() || notice.body };
}

/** 금칙어 검사 — 공백을 지우고 대소문자를 무시한 부분 일치다. 금칙어는 운영 DB(`banned_words`)가 갖는다. */
export function containsBannedWord(value: string, words: readonly string[]): boolean {
  const flat = value.toLowerCase().replace(/\s+/gu, "");
  return words.some((word) => {
    const w = word.toLowerCase().replace(/\s+/gu, "");
    return w.length > 0 && flat.includes(w);
  });
}

/** 읽음 표시를 저장에 남긴다. */
export function markOpsMailsRead(state: Session, ids: readonly string[]): void {
  const journal = opsJournalOf(state);
  const next = ids.filter(isOpsMailId).filter((id) => !journal.readMails.includes(id));
  if (next.length) journal.readMails = tail([...journal.readMails, ...next]);
}

/** 지운 우편을 저장에 남긴다. 운영·구독 우편은 매 호출 다시 만들어지므로 ID로 걸러 낸다. */
export function markMailsDeleted(state: Session, ids: readonly string[]): void {
  const journal = opsJournalOf(state);
  const next = ids.filter((id) => !(journal.deletedMails ?? []).includes(id));
  if (next.length) journal.deletedMails = tail([...(journal.deletedMails ?? []), ...next]);
}

/** 알림 조회가 한 번 내려 준 소식은 비운다. */
export function drainOpsNotices(state: Session): OpsNotice[] {
  const journal = state.serverJournal?.ops;
  if (!journal || journal.notices.length === 0) return [];
  const notices = journal.notices;
  journal.notices = [];
  return notices;
}
