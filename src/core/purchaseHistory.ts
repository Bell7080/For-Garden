import type { MailClaimHistoryEntryDto, PurchaseHistoryEntryDto } from "../api/contracts";
import type { ProductGrant } from "../data/products";
import type { ServerJournal } from "./serverJournal";

/** 결제 기록 창이 한 번에 받는 최대 줄 수. 거래 영수증은 장부에서 지우지 않으므로 응답 크기를 여기서 묶는다. */
export const PURCHASE_HISTORY_LIMIT = 50;

const TRANSACTION_PREFIX = '["platformTransaction",';
const VERIFICATION_PREFIX = '["platformVerification",';

/** 거래 ID는 끝 네 자리만 남긴다 — 문의할 때 대조할 꼬리표로 충분하고, 원문은 화면에 둘 이유가 없다. */
export function maskTransactionId(id: string): string {
  const tail = id.replace(/[^A-Za-z0-9]/g, "").slice(-4);
  return `••••${tail || "????"}`;
}

const timestamp = (value: unknown): string | null => typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
const grants = (value: unknown): ProductGrant[] => Array.isArray(value)
  ? value.filter((grant): grant is ProductGrant => !!grant && typeof grant === "object" && typeof (grant as { kind?: unknown }).kind === "string" && Number.isFinite((grant as { amount?: unknown }).amount))
  : [];

/**
 * 서버 장부의 플랫폼 거래 영수증을 결제 기록 줄로 옮긴다(최근 것부터).
 *
 * 지급 시각(`purchasedAt`)은 이 기능과 함께 영수증에 새기기 시작했다. 그 전의 거래는 같은 거래를 검증한
 * 영수증의 `serverTime`으로 채우고, 둘 다 없으면 시각 없이 맨 뒤에 둔다 — 지어낸 날짜를 적지 않는다.
 */
export function purchaseHistoryFromJournal(journal: ServerJournal | undefined, limit = PURCHASE_HISTORY_LIMIT): PurchaseHistoryEntryDto[] {
  const receipts = journal?.receipts ?? {};
  const verifiedAt = new Map<string, string>();
  for (const [key, receipt] of Object.entries(receipts)) {
    if (!key.startsWith(VERIFICATION_PREFIX)) continue;
    const { transactionId, serverTime } = receipt.result as { transactionId?: unknown; serverTime?: unknown };
    const at = timestamp(serverTime);
    if (typeof transactionId === "string" && at) verifiedAt.set(transactionId, at);
  }
  const entries: PurchaseHistoryEntryDto[] = [];
  for (const [key, receipt] of Object.entries(receipts)) {
    if (!key.startsWith(TRANSACTION_PREFIX)) continue;
    let transactionId: unknown;
    try { transactionId = (JSON.parse(key) as unknown[])[1]; } catch { continue; }
    if (typeof transactionId !== "string") continue;
    const result = receipt.result as { productId?: unknown; purchasedAt?: unknown; granted?: unknown; firstBonusApplied?: unknown };
    const productId = typeof result.productId === "string" ? result.productId : receipt.identity;
    entries.push({
      productId,
      transactionTail: maskTransactionId(transactionId),
      purchasedAt: timestamp(result.purchasedAt) ?? verifiedAt.get(transactionId) ?? null,
      granted: grants(result.granted),
      firstBonusApplied: result.firstBonusApplied === true,
    });
  }
  const at = (entry: PurchaseHistoryEntryDto): number => entry.purchasedAt ? Date.parse(entry.purchasedAt) : -Infinity;
  return entries.sort((a, b) => at(b) - at(a)).slice(0, Math.max(0, limit));
}

/** 우편 기록이 남기는 최대 줄 수. 넘치면 오래된 것부터 걷는다 — 저장이 끝없이 자라지 않게. */
export const MAIL_LOG_LIMIT = 50;

/** v0.477.0이 `giftLog`라는 이름으로 적은 장부도 같은 우편 기록이다. 새로 적을 때 `mailLog`로 옮긴다. */
const mailLogOf = (journal: ServerJournal | undefined): readonly MailClaimHistoryEntryDto[] => journal?.mailLog ?? journal?.giftLog ?? [];

/** 새로 받은 우편 보상을 장부 앞에 붙인다(최근 것이 앞). 장부를 바꾸지 않고 새 장부를 돌려준다. */
export function appendMailLog(journal: ServerJournal, mails: readonly MailClaimHistoryEntryDto[]): ServerJournal {
  const fresh = mails.map((mail) => ({ ...mail, rewards: mail.rewards.map((reward) => ({ ...reward })) }));
  const { giftLog: _legacy, ...rest } = journal;
  return { ...rest, mailLog: [...fresh.reverse(), ...mailLogOf(journal)].slice(0, MAIL_LOG_LIMIT) };
}

/** 결제 기록 창의 「우편 기록」 탭이 읽는 줄(최근 것부터). */
export function mailHistoryFromJournal(journal: ServerJournal | undefined, limit = MAIL_LOG_LIMIT): MailClaimHistoryEntryDto[] {
  const at = (mail: MailClaimHistoryEntryDto): number => Date.parse(mail.receivedAt);
  return [...mailLogOf(journal)].sort((a, b) => at(b) - at(a)).slice(0, Math.max(0, limit));
}
