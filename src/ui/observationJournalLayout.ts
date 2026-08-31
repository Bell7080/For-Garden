/**
 * 관찰 일지 전용 크기 표.
 *
 * 모바일에서 22/23/24/26px 본문이 작아 일부만 과거 값으로 돌아가던 문제를 막기 위해 관련
 * 글자를 모두 정확히 4px 키우고, 글자만 버튼에서 잘리지 않도록 판·본문·여백·행 높이도 함께
 * 확장했다. 일지의 시각 밀도를 바꿀 때는 산재한 숫자를 만들지 말고 반드시 이 표를 고친다.
 */
export const OBSERVATION_JOURNAL_SIZE = {
  popup: { width: 960, minHeight: 1240, tilt: -1.2, safeInset: 24 },
  body: { width: 820, paddingX: 70 },
  art: { inset: 12 },
  font: { small: 26, question: 27, regular: 28, large: 30, title: 30 },
  spacing: { line: 14, compactLine: 10, section: 48, choiceGap: 16 },
  choice: { width: 800, height: 66, bevel: 14 },
} as const;
