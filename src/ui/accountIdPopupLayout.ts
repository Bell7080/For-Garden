/**
 * 아이디·비밀번호 계정 창의 자리 — Phaser를 모르는 순수 배치표.
 * 창 높이는 손으로 적지 않고 쌓인 줄에서 거꾸로 구한다. 설정의 게스트 연동도 로그인·회원가입 탭을 항상 함께 둔다.
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
  /** 제출 버튼 아래 여백. 닫기는 판 밖 우하단의 공용 뒤로가기가 맡아 판 안에 취소 줄이 없다. */
  bottomRoom: 96,
} as const;

/**
 * 계정 창(아이디·이메일)의 안내역 자리. 토리카 SD가 판 윗변 오른쪽에 올라서고, 말풍선은 제목표 위로
 * 비켜 판 왼쪽 위에 뜬다 — 판 안의 입력 줄을 하나도 밀어내지 않는다.
 */
export const ACCOUNT_GUIDE = {
  sd: { inset: 150, height: 230, sink: 18, hitWidth: 200, shadow: 150 },
  bubble: { inset: 20, width: 560, lift: 58, bodySize: 28, nameSize: 24, minHeight: 104, holdMs: 600_000 },
  pokeKeys: ["account.guide.poke1", "account.guide.poke2", "account.guide.poke3"],
  pokeReturnMs: 2400,
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
export function accountIdPopupRows(_mode: AccountIdPopupMode): AccountIdPopupRows {
  const L = ACCOUNT_ID_POPUP;
  const height = L.topRoom + L.tabRoom + 3 * (L.labelRoom + L.fieldRoom) + L.noteRoom + L.submit.height + L.bottomRoom - L.submit.height / 2;
  let y = -height / 2 + L.topRoom;
  const tabsY = y + L.tabRoom / 2 - 10;
  y += L.tabRoom;
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
