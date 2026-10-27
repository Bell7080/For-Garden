/**
 * 누른 손이 탭인가 끌기인가를 가르는 거리(게임 좌표). 공용 버튼과 스크롤 목록 안의 모든 칸이 같은 값을 읽는다 —
 * 화면마다 따로 적으면 같은 손짓이 어디서는 눌리고 어디서는 스크롤이 된다.
 */
export const TAP_DRAG_SLOP = 24;

/** 누른 자리와 뗀 자리 사이 거리가 기준 안이면 탭이다. */
export function isTapDistance(distance: number, slop: number = TAP_DRAG_SLOP): boolean {
  return Number.isFinite(distance) && distance <= slop;
}
