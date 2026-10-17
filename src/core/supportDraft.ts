/**
 * 문의 접수 입력의 순수 규칙. 길이 상한은 서버(`submit_ticket`)와 같은 값이고, 서버가 마지막으로 검증한다.
 * 화면은 글자를 세어 버튼을 켜고 끌 뿐 판정을 새로 만들지 않는다.
 */

export const TICKET_SUBJECT_MAX = 100;
export const TICKET_BODY_MAX = 4000;
/** 한 번에 보이는 문의 줄 수. 넘치면 쪽을 넘긴다. */
export const TICKET_PAGE_SIZE = 7;
/** 상세에서 한 메시지를 보여 주는 최대 글자 수. 넘치는 글은 줄여 보인다(원문은 서버에 그대로 있다). */
export const TICKET_MESSAGE_CLIP = 420;
/** 상세에 보이는 최근 메시지 수. */
export const TICKET_MESSAGE_VISIBLE = 5;

export const TICKET_CATEGORIES = ["inquiry", "bug", "report", "other"] as const;
export type TicketCategoryId = (typeof TICKET_CATEGORIES)[number];

export type TicketDraftProblem = "subject-empty" | "body-empty";

/** 비어 있지 않은지만 본다(공백만 있는 글은 빈 글). 길이 초과는 입력 칸이 그 자리에서 자른다. */
export function ticketDraftProblem(draft: { subject: string; body: string }): TicketDraftProblem | null {
  if (draft.subject.trim().length === 0) return "subject-empty";
  if (draft.body.trim().length === 0) return "body-empty";
  return null;
}

/** 화면에 서는 글자 수(이모지 하나가 하나로 세어진다). */
export function glyphCount(text: string): number { return Array.from(text).length; }

/** 쪽 번호를 범위 안으로 당기고 그 쪽의 몫을 돌려준다. */
export function paginate<T>(items: readonly T[], page: number, size: number = TICKET_PAGE_SIZE): { page: number; pages: number; slice: T[] } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const clamped = Math.min(Math.max(0, page), pages - 1);
  return { page: clamped, pages, slice: items.slice(clamped * size, (clamped + 1) * size) };
}

/** 긴 글을 줄여 보인다. 글자 수는 화면에 서는 글자로 센다. */
export function clipText(text: string, max: number = TICKET_MESSAGE_CLIP): string {
  const glyphs = Array.from(text);
  return glyphs.length <= max ? text : `${glyphs.slice(0, max).join("").trimEnd()}…`;
}
