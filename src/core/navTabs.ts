/**
 * 핵심 화면 다섯의 **차례와 넘김 규칙**.
 *
 * Phaser를 읽지 않는 이유는 다른 순수 표와 같다 — 화면과 회귀 테스트가 같은 값을 읽어야 한다.
 *
 * 다섯은 로비를 가운데 두고 좌우로 균형을 이룬다. 그 차례가 곧 하단 탭이 서는 차례이고,
 * **좌우로 미는 손이 가는 차례**이기도 하다. 두 곳이 서로 다른 순서를 들면 눌러서 간 자리와
 * 밀어서 간 자리가 달라진다.
 */

/** 핵심 화면 다섯. 로비를 중심으로 고고학과 프리미엄이 양 끝에서 서로 균형을 이룬다. */
export const NAV_TABS = [
  { key: "archaeology", scene: "archaeology" },
  { key: "relics", scene: "relics" },
  { key: "lobby", scene: "lobby" },
  { key: "lab", scene: "lab" },
  { key: "premium", scene: "premium" },
] as const;

export type NavKey = (typeof NAV_TABS)[number]["key"];

/** 손이 옆 화면으로 넘어가려면 가로로 이만큼은 밀어야 한다(정보창의 값과 같다). */
export const NAV_SWIPE_DISTANCE = 110;

/**
 * 세로로 얼마나 움직이면 넘김으로 보지 않을지.
 *
 * 도감은 세로로 훑는 목록이라 손이 비스듬히 지나가기 쉽다 — 그때마다 화면이 갈리면 목록을
 * 볼 수 없다. 정보창과 같은 기준을 쓴다.
 */
export const NAV_SWIPE_VERTICAL_RATIO = 0.8;

/** `key`가 다섯 중 몇 번째인가. 없으면 `-1`. */
export function navTabIndex(key: NavKey): number {
  return NAV_TABS.findIndex((tab) => tab.key === key);
}

/**
 * 옆 화면. **양 끝에서는 넘어가지 않는다**(`undefined`).
 *
 * 끝에서 반대쪽 끝으로 돌리지 않는 이유는, 그 한 번이 다섯 칸을 건너뛰는 이동이라 어디로
 * 간 것인지 읽히지 않기 때문이다. 줄의 끝은 끝으로 둔다.
 */
export function neighborNavTab(key: NavKey, step: -1 | 1): (typeof NAV_TABS)[number] | undefined {
  const index = navTabIndex(key);
  if (index === -1) return undefined;
  return NAV_TABS[index + step];
}

/**
 * 민 손이 어느 쪽으로 넘기려는 것인가. 넘김이 아니면 `0`이다.
 *
 * **왼쪽으로 밀면 오른쪽 화면으로 간다**(`+1`) — 손가락이 종이를 왼쪽으로 밀어내는 것과 같다.
 */
export function navSwipeStep(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < NAV_SWIPE_DISTANCE) return 0;
  // 세로로 더 많이 움직였으면 목록을 훑던 손이다.
  if (Math.abs(dy) > Math.abs(dx) * NAV_SWIPE_VERTICAL_RATIO) return 0;
  return dx < 0 ? 1 : -1;
}

/** 지금 화면에서 `target`으로 가는 방향. 같은 자리거나 모르는 값이면 `0`. */
export function navTabDirection(from: NavKey, to: NavKey): -1 | 0 | 1 {
  const a = navTabIndex(from);
  const b = navTabIndex(to);
  if (a === -1 || b === -1 || a === b) return 0;
  return b > a ? 1 : -1;
}
