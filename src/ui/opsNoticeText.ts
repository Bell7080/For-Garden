import { findItem } from "../data/items";
import type { OpsNotice } from "../core/opsInbox";
import { t, type TextKey } from "../i18n";
import { currencyRecordToRewardItems, productGrantsToRewardItems, type RewardPopupItem } from "./rewardPopupModel";

/**
 * 운영팀 조정 안내의 줄을 만든다. 같은 재화의 증감은 합쳐 한 줄로 적고, 우편은 한 줄로 묶는다.
 * 재화 이름은 문구 표에서 고른다(알 수 없는 키는 키 그대로가 아니라 일반 문구로 돌아간다).
 */
export function opsNoticeLines(notices: readonly OpsNotice[]): string[] {
  const totals = new Map<string, number>();
  let mails = 0;
  for (const notice of notices) {
    if (notice.kind === "mail") mails += 1;
    else if (notice.kind === "item") continue;
    else totals.set(notice.asset, (totals.get(notice.asset) ?? 0) + notice.delta);
  }
  const lines: string[] = [];
  for (const [asset, delta] of totals) {
    if (delta === 0) continue;
    const name = t(`currency.${asset}` as TextKey);
    const amount = Math.abs(delta).toLocaleString("en-US");
    lines.push(t(delta > 0 ? "ops.notice.gain" : "ops.notice.loss", { name, amount }));
  }
  if (mails > 0) lines.push(t("ops.notice.mail", { count: mails }));
  return lines;
}

/**
 * 운영팀 조정 안내를 영수증으로 나눈다. 받은 몫(재화·아이템)은 보상 팝업의 액자와 수량으로 세우고,
 * 회수된 몫은 글줄로 적는다. 사유는 같은 것끼리 합쳐 한 줄로 아래에 선다.
 */
export function opsNoticeReceipt(notices: readonly OpsNotice[]): { items: RewardPopupItem[]; losses: string[]; reason: string } {
  const gains: Record<string, number> = {};
  const itemGains = new Map<string, number>();
  const net = new Map<string, number>();
  const reasons: string[] = [];
  for (const notice of notices) {
    if (notice.kind === "mail") continue;
    const key = notice.kind === "item" ? `item:${notice.itemId}` : notice.asset;
    net.set(key, (net.get(key) ?? 0) + notice.delta);
    if (notice.note && !reasons.includes(notice.note)) reasons.push(notice.note);
  }
  const losses: string[] = [];
  for (const [key, delta] of net) {
    if (delta > 0) {
      if (key.startsWith("item:")) itemGains.set(key.slice(5), delta);
      else gains[key] = delta;
    } else if (delta < 0) {
      const name = key.startsWith("item:") ? (findItem(key.slice(5))?.name ?? key) : t(`currency.${key}` as TextKey);
      losses.push(t("ops.notice.loss", { name, amount: Math.abs(delta).toLocaleString("en-US") }));
    }
  }
  const items = [...currencyRecordToRewardItems(gains), ...productGrantsToRewardItems([...itemGains].map(([itemId, amount]) => ({ kind: "item" as const, itemId, name: itemId, amount })))];
  return { items, losses, reason: reasons.length ? t("ops.notice.reason", { reason: reasons.join(" / ").slice(0, 40) }) : "" };
}
