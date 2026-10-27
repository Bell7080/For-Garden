/** 결과창이 열린 채 충전·자연 회복한 경우에도 현재 조건으로 선택을 판정한다. */
export function pressResultAction(action: {
  disabled?: boolean;
  isBlocked?: () => boolean;
  onBlocked?: () => void;
  onPress: () => void;
}, close: () => void): void {
  if (action.isBlocked?.() ?? action.disabled) { action.onBlocked?.(); return; }
  action.onPress();
  close();
}
