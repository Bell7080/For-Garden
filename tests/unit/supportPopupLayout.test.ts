import { describe, expect, it } from "vitest";
import { chipX, composeBottom, detailBottom, listBottom, supportContentWidth, supportPopupHeight, SUPPORT_POPUP } from "../../src/ui/supportPopupLayout";
import { clipText, glyphCount, paginate, ticketDraftProblem, TICKET_BODY_MAX, TICKET_MESSAGE_CLIP } from "../../src/core/supportDraft";

describe("문의 창 자리", () => {
  it("세 화면이 모두 창 안에 들고 위에서 아래로 겹치지 않는다", () => {
    const height = supportPopupHeight();
    for (const bottom of [composeBottom(), listBottom(), detailBottom()]) expect(bottom).toBeLessThan(height);
    const c = SUPPORT_POPUP;
    expect(c.tabs.y + c.tabs.height / 2).toBeLessThan(c.chips.y - c.chips.height / 2);
    expect(c.chips.y + c.chips.height / 2).toBeLessThan(c.subject.labelY);
    expect(c.subject.fieldY + c.subject.height / 2).toBeLessThan(c.body.labelY);
    expect(c.body.fieldY + c.body.height / 2).toBeLessThan(c.counterY);
    expect(c.counterY).toBeLessThan(c.submit.y - c.submit.height / 2);
    expect(c.detail.textTop + c.detail.textHeight).toBeLessThan(c.detail.replyLabelY);
    expect(c.detail.replyFieldY + c.detail.replyHeight / 2).toBeLessThan(c.detail.sendY - c.submit.height / 2);
  });

  it("종류 칩 네 개가 좌우 여백 안에 든다", () => {
    const half = supportContentWidth() / 2;
    for (let i = 0; i < 5; i += 1) expect(Math.abs(chipX(i, 5)) + SUPPORT_POPUP.chips.width / 2).toBeLessThanOrEqual(half);
  });
});

describe("문의 입력 규칙", () => {
  it("공백뿐인 제목·내용은 빈 글이다", () => {
    expect(ticketDraftProblem({ subject: "  ", body: "내용" })).toBe("subject-empty");
    expect(ticketDraftProblem({ subject: "제목", body: "\n \n" })).toBe("body-empty");
    expect(ticketDraftProblem({ subject: "제목", body: "내용" })).toBeNull();
    expect(TICKET_BODY_MAX).toBe(4000);
  });

  it("글자 수는 화면에 서는 글자로 센다", () => {
    expect(glyphCount("가나😀")).toBe(3);
  });

  it("쪽 번호는 범위 안으로 당겨진다", () => {
    const items = Array.from({ length: 15 }, (_, i) => i);
    expect(paginate(items, 0).slice).toHaveLength(7);
    expect(paginate(items, 9)).toMatchObject({ page: 2, pages: 3 });
    expect(paginate(items, 2).slice).toEqual([14]);
    expect(paginate([], 3)).toMatchObject({ page: 0, pages: 1, slice: [] });
  });

  it("긴 글은 줄여 보이고 짧은 글은 그대로다", () => {
    expect(clipText("짧은 글")).toBe("짧은 글");
    const clipped = clipText("가".repeat(TICKET_MESSAGE_CLIP + 50));
    expect(glyphCount(clipped)).toBe(TICKET_MESSAGE_CLIP + 1);
    expect(clipped.endsWith("…")).toBe(true);
  });
});
