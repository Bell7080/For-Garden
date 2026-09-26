/**
 * 소탕 창의 자리 — Phaser를 모르는 순수 배치표.
 *
 * 입구(`DungeonLobby`)의 소탕 버튼은 곧바로 소탕하지 않고 이 창을 연다. 위에서부터
 * **단계 이름 → 배율(− ×N + MAX) → 드는 것(스테미나 · 소탕권 또는 멤버십 줄) → 받을 것 → 취소 · 소탕**
 * 순이다. 좌표는 판 윗변 기준(`top` = 0)이고, 판 높이는 마지막 줄에서 거꾸로 구한다.
 */
export const SWEEP_POPUP = {
  width: 880,
  tierY: 104,
  count: { y: 200, height: 88, step: 88, plate: 168, max: 132, gap: 16 },
  cost: { top: 262, height: 150, lineGap: 64, padX: 40, icon: 46, valueSize: 32, labelSize: 24 },
  /** 소탕권 줄 오른쪽의 광고 버튼. 모자라면 강조 판으로 바뀌어 다음에 할 일을 말한다. */
  ad: { width: 236, height: 62 },
  notice: { y: 446, size: 22 },
  reward: { titleY: 506, y: 604, frame: 116, gap: 146 },
  buttons: { y: 752, width: 320, height: 100, gap: 40, fontSize: 34 },
  bottomPad: 60,
} as const;

export function sweepPopupHeight(): number {
  const L = SWEEP_POPUP;
  return L.buttons.y + L.buttons.height / 2 + L.bottomPad;
}

/** 배율 줄 조각의 중심 x(판 가운데 기준) — 가운데에 − · ×N · + 가 서고 MAX가 오른쪽에 붙는다. */
export function sweepCountControlX(): { minus: number; plate: number; plus: number; max: number } {
  const { step, plate, max, gap } = SWEEP_POPUP.count;
  const span = step + gap + plate + gap + step + gap * 2 + max;
  const minus = -span / 2 + step / 2;
  const plateX = minus + step / 2 + gap + plate / 2;
  const plus = plateX + plate / 2 + gap + step / 2;
  const maxX = plus + step / 2 + gap * 2 + max / 2;
  return { minus, plate: plateX, plus, max: maxX };
}
