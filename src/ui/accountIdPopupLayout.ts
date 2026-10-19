/**
 * 아이디·비밀번호 계정 창의 자리 — Phaser를 모르는 순수 배치표.
 * 창 높이는 손으로 적지 않고 쌓인 줄에서 거꾸로 구한다. 탭이 없는 창(설정의 게스트 연동)은 탭 자리만큼 낮다.
 */
export const ACCOUNT_ID_POPUP = {
  width: 900,
  field: { width: 760, height: 84 },
  tabs: { width: 300, height: 76, gap: 18 },
  /** 윗변(제목이 걸터앉는다)에서 첫 줄까지. */
  topRoom: 70,
  tabRoom: 100,
  labelRoom: 40,
  fieldRoom: 108,
  noteRoom: 92,
  submit: { width: 360, height: 92 },
  bottomRoom: 150,
} as const;

export type AccountIdPopupMode = "both" | "link";
export type AccountIdPopupTab = "signIn" | "register";

export interface AccountIdPopupRows {
  tabsY: number | null;
  idLabelY: number;
  idFieldY: number;
  passwordLabelY: number;
  passwordFieldY: number;
  confirmLabelY: number;
  confirmFieldY: number;
  noteY: number;
  submitY: number;
  height: number;
}

/** 위에서부터 쌓은 줄의 가운데 y(창 가운데가 0). */
export function accountIdPopupRows(mode: AccountIdPopupMode): AccountIdPopupRows {
  const L = ACCOUNT_ID_POPUP;
  const height = L.topRoom + (mode === "both" ? L.tabRoom : 0) + 3 * (L.labelRoom + L.fieldRoom) + L.noteRoom + L.submit.height + L.bottomRoom - L.submit.height / 2;
  let y = -height / 2 + L.topRoom;
  const tabsY = mode === "both" ? y + L.tabRoom / 2 - 10 : null;
  if (mode === "both") y += L.tabRoom;
  const block = (): { labelY: number; fieldY: number } => {
    const labelY = y + L.labelRoom / 2;
    const fieldY = y + L.labelRoom + L.field.height / 2;
    y += L.labelRoom + L.fieldRoom;
    return { labelY, fieldY };
  };
  const id = block(), pw = block(), confirm = block();
  const noteY = y + L.noteRoom / 2 - 18;
  y += L.noteRoom;
  return {
    tabsY, idLabelY: id.labelY, idFieldY: id.fieldY, passwordLabelY: pw.labelY, passwordFieldY: pw.fieldY,
    confirmLabelY: confirm.labelY, confirmFieldY: confirm.fieldY, noteY, submitY: y + L.submit.height / 2, height,
  };
}
