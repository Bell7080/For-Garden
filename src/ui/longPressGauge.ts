/**
 * 꾹 누름의 시간과 게이지 규칙.
 *
 * Phaser를 부르지 않는 순수 모듈이라 화면과 테스트가 같은 값을 읽는다. 배선(입력면에 걸고
 * 게이지를 그리는 일)은 `longPressInfo.ts`가 맡는다.
 */
export const LONG_PRESS = {
  /** 꾹 누름으로 보는 시간(ms). 이보다 짧으면 짧은 탭이다. */
  ms: 420,
  /**
   * 게이지 반지름과 두께. **손가락 위로 띄워 그린다**(`lift`) — 손끝에 그리면 반지름 30짜리 고리는
   * 엄지 하나에 통째로 덮여, 정작 언제 떼야 하는지가 보이지 않았다.
   */
  radius: 64,
  width: 13,
  /** 누른 자리에서 게이지 가운데까지 위로 띄우는 거리(px). 엄지 끝보다 넉넉히 위다. */
  lift: 168,
  /** 고리를 나누는 칸 수. 한 줄짜리 호보다 홀로그램 계기로 읽힌다. */
  segments: 16,
  /** 게이지가 사라지는 시간(ms). 열린 뒤에는 곧바로 걷힌다. */
  fadeMs: 140,
  /** 이만큼 손가락이 밀리면 스크롤로 보고 게이지를 접는다. */
  moveSlop: 18,
  /**
   * 게이지가 뜨기 전에 기다리는 시간(ms). 톡 치는 손에도 고리가 번쩍 섰다 사라져, 짧은 탭이 꾹 누름으로
   * 읽혔다(응태 2026-11-23). 이 시간 안에 떼면 게이지 없이 짧은 탭이고, 넘기면 남은 시간 동안 고리가 찬다.
   * 열리는 시각(`ms`)은 그대로다.
   */
  graceMs: 160,
} as const;

/** 누른 시간이 만든 게이지 진행도(0~1). 화면과 테스트가 같은 값을 읽는다. */
export function longPressProgress(elapsedMs: number, totalMs: number = LONG_PRESS.ms): number {
  if (totalMs <= 0) return 1;
  return Math.max(0, Math.min(1, elapsedMs / totalMs));
}


/**
 * 게이지가 그릴 진행도 — 유예(`graceMs`) 안이면 `null`(아직 세우지 않는다), 넘기면 남은 시간 동안 0→1로 찬다.
 * 다 차는 시각은 꾹 누름이 열리는 시각과 같다.
 */
export function longPressRingProgress(elapsedMs: number, totalMs: number = LONG_PRESS.ms): number | null {
  const grace = Math.min(LONG_PRESS.graceMs, Math.max(0, totalMs - 1));
  if (elapsedMs < grace) return null;
  return longPressProgress(elapsedMs - grace, totalMs - grace);
}

/** 게이지 가운데 자리. 위로 띄우되 화면 위로 넘치면 손가락 옆으로 비킨다. */
export function longPressRingCenter(x: number, y: number, screenWidth: number): { x: number; y: number } {
  const margin = LONG_PRESS.radius + 26;
  const cx = Math.max(margin, Math.min(screenWidth - margin, x));
  if (y - LONG_PRESS.lift >= margin) return { x: cx, y: y - LONG_PRESS.lift };
  // 위가 모자라면 손가락 옆(화면 가운데 쪽)으로 비킨다 — 아래로 내리면 손바닥에 가린다.
  const side = x < screenWidth / 2 ? 1 : -1;
  return { x: Math.max(margin, Math.min(screenWidth - margin, x + side * LONG_PRESS.lift)), y: Math.max(margin, y) };
}
