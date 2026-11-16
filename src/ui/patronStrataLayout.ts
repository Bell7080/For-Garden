/**
 * 후원 지층 창과 프리미엄 화면 칩의 자리 — 화면은 좌표를 손으로 적지 않고 이 표를 읽는다.
 *
 * 창은 위에서부터 **지금 지층(이름 · 기금 · 다음 지층까지 줄)** → **매일 후원 보급** → **승급 기념품 단면도**다.
 * 단면도는 표토가 맨 위, 지핵이 맨 아래인 일곱 띠라 「깊이 내려간다」가 그대로 그림이 된다.
 * 창 높이는 띠 수에서 거꾸로 구한다(`patronPopupHeight`) — 손으로 적으면 띠를 더할 때 아래가 판 밖으로 나간다.
 */
export const PATRON_POPUP = {
  width: 960,
  pad: 48,
  hero: { top: 70, height: 176, nameSize: 46, fundSize: 24, gaugeY: 120, gaugeHeight: 14 },
  daily: { top: 270, frame: 104, gap: 16, frameY: 98, button: { width: 220, height: 84 }, fundSize: 22 },
  rewards: { top: 486, headerHeight: 66, bandHeight: 96, bandGap: 8, frame: 72, nameSize: 30, thresholdSize: 20, button: { width: 170, height: 64 } },
  bottomPad: 40,
} as const;

/** 단면도 띠 수가 정하는 창 높이. */
export function patronPopupHeight(bands: number): number {
  const R = PATRON_POPUP.rewards;
  return R.top + R.headerHeight + bands * R.bandHeight + Math.max(0, bands - 1) * R.bandGap + PATRON_POPUP.bottomPad;
}

/** 띠 하나의 가운데 y(판 윗변 기준). */
export function patronBandY(index: number): number {
  const R = PATRON_POPUP.rewards;
  return R.top + R.headerHeight + index * (R.bandHeight + R.bandGap) + R.bandHeight / 2;
}

/** 프리미엄 화면 오른쪽 위, 「프리미엄」 제목과 마주 보는 칩. 오른쪽 끝을 제목의 왼쪽 여백과 같게 둔다. */
export const PATRON_CHIP = { right: 1080 - 60, y: 214, width: 360, height: 80, emblem: 22, nameSize: 26, fundSize: 19 } as const;
