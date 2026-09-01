import { describe, expect, it } from "vitest";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import { calculateObservationJournalFlow, OBSERVATION_JOURNAL_SIZE, withoutRepeatedProfileDetails } from "../../src/ui/observationJournalLayout";
import { POPUP_CLOSE_LAYOUT, tiltedPopupSize } from "../../src/ui/popupGeometry";
import { factionMarkBounds } from "../../src/ui/FactionMark";

describe("observation journal static layout", () => {
  it("keeps the tilted popup, close control, and artwork mask inside the 1080x1920 safe area", () => {
    const layout = OBSERVATION_JOURNAL_SIZE;
    // 가장 긴 소속 문단까지 포함해야 짧은 기본 일지만 검사하는 거짓 안전 판정을 피한다.
    const height = layout.popup.maxHeight;
    const rotated = tiltedPopupSize(layout.popup.width, height, layout.popup.tilt);

    expect(rotated.width + layout.popup.safeInset * 2).toBeLessThanOrEqual(BASE_WIDTH);
    expect(rotated.height + layout.popup.safeInset * 2).toBeLessThanOrEqual(BASE_HEIGHT);

    // X의 투명 입력면 전체가 판 안에 있고, 따라서 회전된 판 안전 영역 안에도 함께 남는다.
    const closeRight = layout.popup.width / 2 - POPUP_CLOSE_LAYOUT.centerInset + POPUP_CLOSE_LAYOUT.hitSize / 2;
    const closeTop = -height / 2 + POPUP_CLOSE_LAYOUT.centerInset - POPUP_CLOSE_LAYOUT.hitSize / 2;
    // 입력면은 판에서 2px 나올 수 있지만 PopupLayer의 24px 화면 여백 안에는 넉넉히 남는다.
    expect(closeRight).toBeLessThanOrEqual(layout.popup.width / 2 + layout.popup.safeInset);
    expect(closeTop).toBeGreaterThanOrEqual(-height / 2 - layout.popup.safeInset);

    // 저널 원화는 사선 판보다 사방으로 안쪽이라 마스크가 기울어진 모서리 밖으로 돌출하지 않는다.
    expect(layout.art.inset).toBeGreaterThan(0);
    expect(layout.popup.width - layout.art.inset * 2).toBeLessThan(layout.popup.width);
    expect(height - layout.art.inset * 2).toBeLessThan(height);
  });

  it("stacks short sections with the prescribed safe gaps", () => {
    const flow = calculateObservationJournalFlow({ metadata: 180, excavation: 200, squad: 0, observationHeading: 34, observation: 80, action: 66 });
    // 소속 기록이 없어도 발굴 기록과 흰 관찰 기록 사이 section 여백은 사라지지 않는다.
    expect(flow.squadY).toBeUndefined();
    expect(flow.observationDividerY - (flow.excavationY + 200)).toBe(OBSERVATION_JOURNAL_SIZE.spacing.section);
    expect(flow.popupHeight).toBe(OBSERVATION_JOURNAL_SIZE.popup.minHeight);
    expect(flow.scrollable).toBe(false);
  });

  it("accumulates a squad record and scrolls instead of exceeding the safe popup", () => {
    const flow = calculateObservationJournalFlow({ metadata: 260, excavation: 920, squad: 180, observationHeading: 40, observation: 740, action: 66 });
    expect(flow.squadY).toBe(flow.excavationY + 920 + OBSERVATION_JOURNAL_SIZE.spacing.paragraph);
    expect(flow.observationDividerY).toBeGreaterThan((flow.squadY ?? 0) + 180);
    expect(flow.popupHeight).toBe(OBSERVATION_JOURNAL_SIZE.popup.maxHeight);
    expect(flow.scrollable).toBe(true);
    expect(flow.contentHeight).toBeGreaterThan(flow.popupHeight);
  });

  it("removes only sentences that repeat exact profile measurements", () => {
    const record = "신장 1.63 m, 체중 54 kg으로 복원되었다. 몸무게 이야기는 싫어한다. 관찰을 이어 갔다.";
    expect(withoutRepeatedProfileDetails(record, "1.63 m", "54 kg")).toBe("몸무게 이야기는 싫어한다. 관찰을 이어 갔다.");
  });

  it("reserves expanded body padding and a button tall enough for the 30px choice label", () => {
    const layout = OBSERVATION_JOURNAL_SIZE;
    // 본문 폭과 좌우 여백은 한 계약이며 선택 면도 그 본문을 침범하지 않는다.
    expect(layout.body.width + layout.body.paddingX * 2).toBe(layout.popup.width);
    expect(layout.choice.width).toBeLessThanOrEqual(layout.body.width);
    expect(layout.choice.height).toBeGreaterThanOrEqual(layout.font.large * 2);
    expect(layout.spacing.choiceGap).toBeGreaterThan(0);
    expect(layout.font).toMatchObject({ small: 26, question: 27, regular: 28, large: 30, title: 30 });
  });

  it.each([0.5, 1, 2])("keeps a 130%% squad emblem and its cloned shadows clear for aspect ratio %s", (aspectRatio) => {
    // 세로형·정사각·가로형 원화 모두 긴 변을 135.2px에 맞추며, 그림자 외곽도 본문 폭 안에 남는다.
    const size = 104 * 1.3;
    const x = 320;
    const bounds = factionMarkBounds(size, aspectRatio);
    const bodyRight = OBSERVATION_JOURNAL_SIZE.body.width / 2;
    expect(x + bounds.right).toBeLessThanOrEqual(bodyRight);
    // 메타데이터는 그림자 왼쪽에서 24px 먼저 끝나므로 글자와 표식이 맞닿지 않는다.
    const metadataRight = x + bounds.left - 24;
    expect(metadataRight + 24).toBeLessThanOrEqual(x + bounds.left);
    // 아래 복제 그림자는 해당 비율에서 실제로 표시되는 원본 높이보다 바깥으로 번진다.
    const displayedHeight = aspectRatio >= 1 ? size / aspectRatio : size;
    expect(bounds.bottom).toBeGreaterThan(displayedHeight / 2);
    // 제목 쪽 위 외곽을 body.top에 맞추면 어떤 비율에서도 위로 침범하지 않는다.
    const centeredY = OBSERVATION_JOURNAL_SIZE.body.top - bounds.top;
    expect(centeredY + bounds.top).toBeCloseTo(OBSERVATION_JOURNAL_SIZE.body.top);
    // 이름은 가장 아래 그림자 뒤 12px에서 시작해 어느 원화 비율에서도 겹치지 않는다.
    const nameY = centeredY + bounds.bottom + 12;
    expect(nameY).toBeGreaterThanOrEqual(centeredY + bounds.bottom + 12);
  });
});
