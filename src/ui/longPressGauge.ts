/**
 * 꾹 누름의 시간과 게이지 규칙.
 *
 * Phaser를 부르지 않는 순수 모듈이라 화면과 테스트가 같은 값을 읽는다. 배선(입력면에 걸고
 * 게이지를 그리는 일)은 `longPressInfo.ts`가 맡는다.
 */
export const LONG_PRESS = {
  /** 꾹 누름으로 보는 시간(ms). 이보다 짧으면 짧은 탭이다. */
  ms: 420,
  /** 게이지 반지름과 두께. 손가락 밑에 가리지 않을 만큼만 크다. */
  radius: 30,
  width: 5,
  /** 게이지가 사라지는 시간(ms). 열린 뒤에는 곧바로 걷힌다. */
  fadeMs: 140,
  /** 이만큼 손가락이 밀리면 스크롤로 보고 게이지를 접는다. */
  moveSlop: 18,
} as const;

/** 누른 시간이 만든 게이지 진행도(0~1). 화면과 테스트가 같은 값을 읽는다. */
export function longPressProgress(elapsedMs: number, totalMs: number = LONG_PRESS.ms): number {
  if (totalMs <= 0) return 1;
  return Math.max(0, Math.min(1, elapsedMs / totalMs));
}

