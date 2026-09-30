/**
 * 핵심 화면 다섯의 **차례**.
 *
 * Phaser를 읽지 않는 이유는 다른 순수 표와 같다 — 화면과 회귀 테스트가 같은 값을 읽어야 한다.
 *
 * 다섯은 로비를 가운데 두고 좌우로 균형을 이룬다. 그 차례가 곧 하단 탭이 서는 차례이고,
 * 화면 전환이 어느 쪽에서 들어오는지(`navTabDirection`)도 이 차례에서 나온다.
 *
 * **좌우로 밀어서 화면을 넘기는 손짓은 두지 않는다.** 도감 그리드·연구소 배너·상점·고고학의
 * 세부 탭이 모두 좌우 밀기를 제 조작으로 쓰고 싶어 하는데, 화면 넘김이 그 손을 먼저 가져가면
 * 그 화면들이 조작을 쓸 수 없다. 화면은 하단 버튼으로만 옮긴다(v0.201.0).
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

/** `key`가 다섯 중 몇 번째인가. 없으면 `-1`. */
export function navTabIndex(key: NavKey): number {
  return NAV_TABS.findIndex((tab) => tab.key === key);
}

/** 지금 화면에서 `target`으로 가는 방향. 같은 자리거나 모르는 값이면 `0`. */
export function navTabDirection(from: NavKey, to: NavKey): -1 | 0 | 1 {
  const a = navTabIndex(from);
  const b = navTabIndex(to);
  if (a === -1 || b === -1 || a === b) return 0;
  return b > a ? 1 : -1;
}
