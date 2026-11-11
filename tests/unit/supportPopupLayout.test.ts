import { describe, expect, it } from "vitest";
import { chipX, contentBottoms, supportActionXs, supportContentWidth, supportPopupHeight, supportTabX, SUPPORT_POPUP } from "../../src/ui/supportPopupLayout";
import { clipText, glyphCount, paginate, ticketDraftProblem, TICKET_BODY_MAX, TICKET_MESSAGE_CLIP } from "../../src/core/supportDraft";

describe("문의 창 자리", () => {
  it("내용은 밑동 구분선 위에서 끝나고, 탭 줄·조작 줄이 그 아래에 차례로 선다", () => {
    const c = SUPPORT_POPUP;
    const f = c.footer;
    for (const bottom of Object.values(contentBottoms())) expect(bottom).toBeLessThan(f.lineY);
    expect(f.lineY).toBeLessThanOrEqual(f.tabY - f.tab.height / 2);
    expect(f.tabY + f.tab.height / 2).toBeLessThan(f.actionY - f.action.height / 2);
    expect(f.actionY + f.action.height / 2).toBeLessThan(supportPopupHeight());
  });

  it("작성 화면의 줄이 위에서 아래로 겹치지 않는다", () => {
    const c = SUPPORT_POPUP;
    expect(c.form.top).toBeLessThan(c.chips.y - c.chips.height / 2);
    expect(c.chips.y + c.chips.height / 2).toBeLessThan(c.subject.labelY);
    expect(c.subject.fieldY + c.subject.height / 2).toBeLessThan(c.body.labelY);
    // 입력 칸은 가운데 기준이라, 칸 윗변이 제 이름표보다 아래여야 이름표와 위 칸을 덮지 않는다.
    expect(c.subject.fieldY - c.subject.height / 2).toBeGreaterThan(c.subject.labelY + 16);
    expect(c.body.fieldY - c.body.height / 2).toBeGreaterThan(c.body.labelY + 16);
    expect(c.body.fieldY + c.body.height / 2).toBeLessThan(c.form.bottom);
    expect(c.detail.headY + c.detail.headHeight / 2).toBeLessThan(c.detail.textTop);
    expect(c.detail.textTop + c.detail.textHeight).toBeLessThan(c.detail.replyLabelY);
    expect(c.detail.replyFieldY - c.detail.replyHeight / 2).toBeGreaterThan(c.detail.replyLabelY + 16);
  });

  it("라벨 탭은 왼쪽부터 붙고, 조작 줄 두 칸은 내용 폭 안에서 좌우로 나뉜다", () => {
    const half = supportContentWidth() / 2;
    const { tab, action } = SUPPORT_POPUP.footer;
    expect(supportTabX(0) - tab.width / 2).toBe(-half);
    // 오른쪽 아래 구석은 판 밖 뒤로가기 자리라 탭 줄이 그쪽 절반으로 넘어가지 않는다.
    expect(supportTabX(1) + tab.width / 2).toBeLessThan(half / 2);
    const [left, right] = supportActionXs(2);
    expect(left + right).toBe(0);
    expect(right + action.width / 2).toBeLessThanOrEqual(half);
    expect(supportActionXs(1)).toEqual([0]);
  });

  it("종류 칩 다섯 개가 좌우 여백 안에 든다", () => {
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
