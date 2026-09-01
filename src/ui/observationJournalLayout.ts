/**
 * 관찰 일지의 Phaser 비의존 배치 규칙.
 *
 * 세 영역은 ① 표본 메타데이터, ② 복원 전의 회색 발굴 기록, ③ 복원 후의 흰 관찰 기록 순서다.
 * 각 높이는 실제 텍스트를 만든 뒤 전달하며, 이 함수는 아래 여백을 누적해 긴 문단도 다음 영역을
 * 침범하지 않게 한다. 화면보다 길면 판을 더 키우지 않고 `scrollable`로 내부 스크롤을 요구한다.
 */
export const OBSERVATION_JOURNAL_SIZE = {
  popup: { width: 960, minHeight: 1240, maxHeight: 1780, tilt: -1.2, safeInset: 24 },
  body: { width: 820, paddingX: 70, top: 112, bottom: 92 },
  art: { inset: 12 },
  font: { small: 26, question: 27, regular: 28, large: 30, title: 30 },
  spacing: { line: 14, compactLine: 10, section: 48, divider: 28, paragraph: 30, choiceGap: 16 },
  choice: { width: 800, height: 66, bevel: 14 },
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
  observationDividerY: number;
  observationHeadingY: number;
  observationY: number;
  actionY: number;
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
  cursor += spacing.section;
  const observationDividerY = cursor;
  cursor += spacing.divider;
  const observationHeadingY = cursor;
  cursor += heights.observationHeading + spacing.paragraph;
  const observationY = cursor;
  cursor += heights.observation + spacing.section;
  const actionY = cursor;
  cursor += heights.action + body.bottom;
  const contentHeight = cursor;
  const popupHeight = Math.min(popup.maxHeight, Math.max(popup.minHeight, contentHeight));
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
