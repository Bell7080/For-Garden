import type { OpsNotice } from "../core/opsInbox";
import { t, type TextKey } from "../i18n";

/**
 * 운영팀 조정 안내의 줄을 만든다. 같은 재화의 증감은 합쳐 한 줄로 적고, 우편은 한 줄로 묶는다.
 * 재화 이름은 문구 표에서 고른다(알 수 없는 키는 키 그대로가 아니라 일반 문구로 돌아간다).
 */
export function opsNoticeLines(notices: readonly OpsNotice[]): string[] {
  const totals = new Map<string, number>();
  let mails = 0;
  for (const notice of notices) {
    if (notice.kind === "mail") mails += 1;
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
