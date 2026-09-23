/**
 * 관찰 일지의 Phaser 비의존 배치 규칙.
 *
 * 세 영역은 ① 표본 메타데이터, ② 복원 전의 회색 발굴 기록, ③ 복원 후의 흰 관찰 기록 순서다.
 * 각 높이는 실제 텍스트를 만든 뒤 전달하며, 이 함수는 아래 여백을 누적해 긴 문단도 다음 영역을
 * 침범하지 않게 한다. 화면보다 길면 판을 더 키우지 않고 `scrollable`로 내부 스크롤을 요구한다.
 *
 * **③은 통째로 없을 수 있다.** 적은 복원해 데려온 개체가 아니라 매일의 인터뷰가 없다 — 그때
 * 높이만 0으로 넘기면 구분선과 제목이 그대로 남아 빈 칸이 판 절반을 차지하므로, 세 높이가
 * 모두 0이면 그 영역의 y를 아예 내주지 않는다(`undefined`).
 */
export const OBSERVATION_JOURNAL_SIZE = {
  popup: { width: 960, minHeight: 1240, maxHeight: 1780, tilt: -1.2, safeInset: 24 },
  body: { width: 820, paddingX: 70, top: 112, bottom: 92 },
  art: { inset: 12 },
  /**
   * 글자 크기. **모바일에서 읽히는 크기가 기준이다** — 관찰 일지는 훑는 목록이 아니라 앉아서 읽는
   * 글이라, 26~30으로 두었을 때는 폰 화면에서 문단이 작은 글씨 덩어리로 보였다. 판을 키우지 않고
   * 글자만 키우며, 길어진 만큼은 판 안의 스크롤이 맡는다(`scrollable`).
   */
  font: { small: 30, question: 31, regular: 33, large: 35, title: 36 },
  spacing: { line: 16, compactLine: 12, section: 48, divider: 28, paragraph: 30, choiceGap: 16 },
  choice: { width: 800, height: 76, bevel: 14 },
} as const;

export interface ObservationJournalHeights {
  metadata: number;
  excavation: number;
  squad: number;
  observationHeading: number;
  observation: number;
  action: number;
}

export interface ObservationJournalFlow {
  metadataY: number;
  excavationDividerY: number;
  excavationY: number;
  squadY?: number;
  /** 아래 넷은 복원 후 관찰 기록 영역이 설 때만 있다. 없으면 그 영역을 그리지 않는다. */
  observationDividerY?: number;
  observationHeadingY?: number;
  observationY?: number;
  actionY?: number;
  contentHeight: number;
  popupHeight: number;
  viewportHeight: number;
  scrollable: boolean;
}

/** 실제 렌더 높이와 규정 간격만 누적하는 순수 배치 계산이다. 모든 y는 콘텐츠 상단 기준이다. */
export function calculateObservationJournalFlow(heights: ObservationJournalHeights): ObservationJournalFlow {
  const { popup, body, spacing } = OBSERVATION_JOURNAL_SIZE;
  let cursor = body.top;
  const metadataY = cursor;
  cursor += heights.metadata + spacing.section;
  const excavationDividerY = cursor;
  cursor += spacing.divider;
  const excavationY = cursor;
  cursor += heights.excavation;
  const squadY = heights.squad > 0 ? cursor + spacing.paragraph : undefined;
  if (squadY !== undefined) cursor = squadY + heights.squad;
  // 복원 후 관찰 기록이 통째로 없으면 구분선도 긋지 않는다 — 판 아래 절반이 빈 칸으로 남는다.
  const hasObservation = heights.observationHeading + heights.observation + heights.action > 0;
  let observationDividerY: number | undefined;
  let observationHeadingY: number | undefined;
  let observationY: number | undefined;
  let actionY: number | undefined;
  if (hasObservation) {
    cursor += spacing.section;
    observationDividerY = cursor;
    cursor += spacing.divider;
    observationHeadingY = cursor;
    cursor += heights.observationHeading + spacing.paragraph;
    observationY = cursor;
    cursor += heights.observation + spacing.section;
    actionY = cursor;
    cursor += heights.action;
  }
  cursor += body.bottom;
  const contentHeight = cursor;
  // 최소 높이는 복원 후 관찰 기록이 설 때만 지킨다 — 그 영역이 없는 판(적·미보유)에 걸면 판
  // 아래 절반이 통째로 빈 칸으로 남는다. 그때는 내용이 끝나는 자리에서 끊는다.
  const popupHeight = Math.min(popup.maxHeight, hasObservation ? Math.max(popup.minHeight, contentHeight) : contentHeight);
  return {
    metadataY, excavationDividerY, excavationY, squadY, observationDividerY, observationHeadingY,
    observationY, actionY, contentHeight, popupHeight,
    viewportHeight: popupHeight - body.top - body.bottom,
    scrollable: contentHeight > popupHeight,
  };
}

/** 상단 상세정보에 이미 있는 정확한 신장·체중 수치가 발굴 기록에서 다시 나오지 않게 한다. */
export function withoutRepeatedProfileDetails(text: string, height?: string, weight?: string): string {
  const needles = [height, weight].filter((value): value is string => Boolean(value)).map((value) => value.replace(/\s/g, ""));
  if (!needles.length) return text;
  // 소수점(1.63)을 문장 끝으로 오인하지 않도록 문장부호 뒤 공백/끝까지 함께 확인한다.
  const sentences = text.match(/.*?[.!?。](?=\s|$)|.+$/g) ?? [text];
  const kept = sentences.filter((sentence) => !needles.some((needle) => sentence.replace(/\s/g, "").includes(needle)));
  return kept.join("").trim();
}
