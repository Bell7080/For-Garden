/**
 * 관찰 일지 하단 조작과 선택 팝업이 공유하는 정적 배치다.
 *
 * 일지는 질문을 직접 그리지 않고 이 크기의 조작 하나만 둔다. 선택 팝업은 모든 답변을 한 장에
 * 담으며, 실제 일일 1회 검증과 저장은 `ObservationManager.complete`가 계속 소유한다.
 */
export const OBSERVATION_INTERVIEW_LAYOUT = {
  trigger: { y: 462, width: 800, height: 72, bevel: 14 },
  popup: { width: 840, height: 620, tilt: -1.2 },
  question: { x: -350, y: -205, width: 700 },
  choice: { firstY: -40, step: 112, width: 700, height: 82, bevel: 14 },
} as const;

/** 선택판의 열림 여부만 UI가 소유하며, 완료 가능 여부는 manager에서 받은 값만 비춘다. */
export interface ObservationInterviewPanelState {
  readonly open: boolean;
  readonly completedToday: boolean;
}

export type ObservationInterviewPanelAction = "toggle" | "close" | "complete";

/**
 * 닫기·재열기·완료 후 상태를 Phaser 없이 고정하는 작은 상태 전이 경계다.
 * `complete`는 저장 성공 뒤에만 전달하며, 일지 재생성은 호출자가 맡아 다른 성장 UI를 갱신하지 않는다.
 */
export function observationInterviewPanelState(
  state: ObservationInterviewPanelState,
  action: ObservationInterviewPanelAction,
): ObservationInterviewPanelState {
  if (action === "complete") return { open: false, completedToday: true };
  if (action === "close") return { ...state, open: false };
  // 오늘 완료한 인터뷰는 manager의 일일 제한을 UI에서 우회해 다시 열 수 없다.
  if (state.completedToday) return state;
  return { ...state, open: !state.open };
}
