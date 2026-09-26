/**
 * 확인 창의 자리 — Phaser를 모르는 순수 배치표.
 *
 * 되돌릴 수 없는 조작 앞에서 한 번 묻는 창(젬 쓰기·원정 포기·저장 초기화…)은 모두 이 한 벌을 쓴다.
 * 창 높이는 손으로 적지 않고 **문장 높이 · 값 줄 · 보유 줄에서 거꾸로 구한다** — 문장이 두 줄이 되거나
 * 언어가 바뀌어도 버튼이 판 밖으로 나가지 않는다(`tests/unit/confirmDialog.test.ts`).
 */
export const CONFIRM_DIALOG = {
  width: 860,
  /** 판 윗변에서 안쪽 판까지. 머리글이 윗변에 걸터앉으므로 그만큼 내린다. */
  topRoom: 74,
  /** 안쪽 판(문장·값을 담는 유리면)이 몸판 가장자리에서 들어가는 폭. */
  plateInset: 44,
  /** 안쪽 판 위아래 여백. */
  platePadY: 38,
  messageSize: 30,
  messageLineSpacing: 12,
  /** 값 줄 — 치를 것들이 액자로 선다. */
  costGap: 30,
  costIcon: 104,
  costSpacing: 40,
  /**
   * 보유 줄 — `보유 [그림] 5,000 → 2,300`. 곁말처럼 흐린 한 줄로 두면 정작 얼마가 남는지가 읽히지
   * 않아, **재화 그림과 두 수를 값 글자 크기로** 세운다. 이름표(「보유」)만 작고 흐리다.
   */
  balanceGap: 26,
  balanceHeight: 56,
  balanceLabelSize: 24,
  balanceIcon: 46,
  balanceValueSize: 32,
  /** 안쪽 판 아랫변에서 버튼 가운데까지. */
  buttonRoom: 96,
  button: { width: 320, height: 104, gap: 40, fontSize: 34 },
  /** 확정 판의 면 — 강조색·붉은색을 어둡게 누른 색이라 글자는 그대로 흰색으로 읽힌다. */
  confirmFill: 0x3a2e14,
  destructiveFill: 0x3a1616,
  /** 뒤 화면을 누르는 세기. 되돌릴 수 없는 조작을 묻는 창이라 쪽지보다 한 뼘 짙다. */
  dimAlpha: 0.72,
  /** 버튼 아래에서 몸판 아랫변까지. */
  bottomPad: 68,
} as const;

export interface ConfirmDialogContent {
  /** 문장이 실제로 차지하는 높이(글꼴과 언어가 정하므로 화면이 잰 값을 받는다). */
  messageHeight: number;
  /** 값 줄이 서는가. */
  costs: boolean;
  /** 보유 줄이 서는가. */
  balance: boolean;
}

/** 안쪽 판의 높이. */
export function confirmPlateHeight(content: ConfirmDialogContent): number {
  const L = CONFIRM_DIALOG;
  return L.platePadY * 2 + content.messageHeight
    + (content.costs ? L.costGap + L.costIcon : 0)
    + (content.balance ? L.balanceGap + L.balanceHeight : 0);
}

/** 창 높이. */
export function confirmDialogHeight(content: ConfirmDialogContent): number {
  const L = CONFIRM_DIALOG;
  return L.topRoom + confirmPlateHeight(content) + L.buttonRoom + L.button.height / 2 + L.bottomPad;
}

/** 버튼 가운데 x — 둘이면 좌(취소)·우(확정), 하나면 가운데. 둘을 합친 폭은 안쪽 판을 넘지 않는다. */
export function confirmButtonXs(count: 1 | 2): number[] {
  const L = CONFIRM_DIALOG;
  if (count === 1) return [0];
  const offset = (L.button.width + L.button.gap) / 2;
  return [-offset, offset];
}
