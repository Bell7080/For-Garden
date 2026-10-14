import type { ExpeditionRelicSnapshot } from "./expeditionSnapshot";
import { isExpeditionRelicSnapshot } from "./expeditionSnapshot";
import type { PassEntitlementDto } from "../api/contracts";

/** 지급 결과와 처리 표식을 같은 저장에 담는다. 공개 계정 스냅샷은 영수증에 중복 저장하지 않는다. */
export interface ServerJournal {
  receipts: Record<string, { identity: string; result: Record<string, unknown> }>;
  raidAdmissions: Record<string, { raidId: string; seasonHp: number; expiresAt: string; relics: { relicId: string; snapshot: ExpeditionRelicSnapshot }[] }>;
  subscriptionEntitlements?: Record<string, PassEntitlementDto>;
  subscriptionBonusDates?: Record<string, string>;
  subscriptionMails?: Record<string, { entitlementId: string; productId: string; sentAt: string; expiresAt: string; itemId: string; amount: number }>;
}

export const emptyServerJournal = (): ServerJournal => ({ receipts: {}, raidAdmissions: {} });

export function isValidServerJournal(value: unknown): value is ServerJournal {
  if (!value || typeof value !== "object") return false;
  const journal = value as ServerJournal;
  const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
  const json = (v: unknown): boolean => v === null || typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))
    || (Array.isArray(v) ? v.every(json) : record(v) && Object.values(v).every(json));
  return (journal.subscriptionEntitlements === undefined || record(journal.subscriptionEntitlements) && Object.entries(journal.subscriptionEntitlements).every(([id, entry]) => record(entry)
    && entry.entitlementId === id && typeof entry.productId === "string" && Number.isFinite(Date.parse(entry.activatedAt))
    && (entry.expiresAt === null || Number.isFinite(Date.parse(entry.expiresAt))) && typeof entry.active === "boolean" && typeof entry.serverTime === "string"))
    && (journal.subscriptionBonusDates === undefined || record(journal.subscriptionBonusDates) && Object.values(journal.subscriptionBonusDates).every((date) => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)))
    && (journal.subscriptionMails === undefined || record(journal.subscriptionMails) && Object.values(journal.subscriptionMails).every((mail) => record(mail)
      && typeof mail.entitlementId === "string" && typeof mail.productId === "string" && typeof mail.itemId === "string"
      && Number.isFinite(Date.parse(mail.sentAt)) && Number.isFinite(Date.parse(mail.expiresAt)) && Number.isInteger(mail.amount) && mail.amount > 0))
    && record(journal.receipts) && record(journal.raidAdmissions)
    && Object.entries(journal.receipts).every(([id, receipt]) => id.length > 0 && record(receipt) && typeof receipt.identity === "string" && record(receipt.result) && json(receipt.result))
    && Object.entries(journal.raidAdmissions).every(([id, admission]) => id.length > 0 && record(admission) && typeof admission.raidId === "string"
      && Number.isFinite(admission.seasonHp) && admission.seasonHp >= 0 && Number.isFinite(Date.parse(admission.expiresAt))
      && Array.isArray(admission.relics) && admission.relics.length === 3 && admission.relics.every((relic) => typeof relic.relicId === "string" && isExpeditionRelicSnapshot(relic.snapshot)));
}
