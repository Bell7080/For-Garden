/**
 * 약관 동의창의 자리. 위에서부터 안내 → 체크 줄 셋(약관·처리방침·만 14세) → 미만 안내 → 동의 버튼이다.
 * 체크 줄 하나가 체크 칸·이름·「보기」를 한 줄에 둔다. 몸 가운데가 0이다.
 */
export const LEGAL_CONSENT_POPUP = {
  width: 900, height: 820,
  noteY: -250, noteWidth: 780,
  rowsY: -110, rowStep: 120,
  row: { width: 780, height: 100, box: 52, boxX: -340, labelX: -270, viewX: 290, viewWidth: 150 },
  underAgeY: 210, underAgeWidth: 780,
  submitY: 300, submit: { width: 680, height: 96 },
} as const;

/** `index`번째 체크 줄의 가운데 y. */
export function legalConsentRowY(index: number): number {
  return LEGAL_CONSENT_POPUP.rowsY + index * LEGAL_CONSENT_POPUP.rowStep;
}
