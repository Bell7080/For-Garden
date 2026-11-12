/**
 * 레벨 초기화 창의 자리 — Phaser를 모르는 순수 배치표.
 *
 * 공용 확인 창(`confirmDialogLayout.ts`)과 같은 폭·같은 버튼 줄을 쓰되, 위에 그 개체의 SD와 말풍선이 서는
 * **무대**가 한 칸 더 있다 — 「정말 나를 처음으로 되돌릴 거야?」를 문장이 아니라 그 아이가 직접 묻게 한다.
 * 창 높이는 손으로 적지 않고 재화 줄 수(치즈케이크만 / 젬까지)에서 거꾸로 구한다(`tests/unit/relicResetPopup.test.ts`).
 */
import { CONFIRM_DIALOG } from "./confirmDialogLayout";

export const RELIC_RESET_POPUP = {
  width: CONFIRM_DIALOG.width,
  /** 판 윗변에서 무대 윗변까지. 머리글이 윗변에 걸터앉으므로 그만큼 내린다. */
  topRoom: 70,
  /** SD와 말풍선이 서는 칸. */
  stage: {
    height: 330,
    sd: { x: -232, ground: 300, height: 262, shadow: 150 },
    /** 말풍선 — 꼬리는 왼쪽 아래에서 SD 머리 쪽을 가리킨다. */
    bubble: { x: 128, y: 84, width: 480, height: 156, tail: 34, textSize: 30, textWrap: 420 },
    /** 말풍선 아래의 `LV.30 → LV.1` — 이 창이 말하는 핵심이라 크게 세운다(응태 요청). 도착 레벨은 한 뼘 더 크다. */
    levelY: 250,
    levelSize: 64,
    levelTargetSize: 80,
    /** 이마에서 흘러내리는 땀방울. SD 발끝 기준. */
    sweat: { dx: 78, rise: 214, size: 22 },
  },
  /** 보유 재화가 어떻게 바뀌는지 담는 유리 판. */
  wallet: {
    inset: 44,
    padY: 26,
    headerHeight: 40,
    headerSize: 24,
    rowHeight: 64,
    icon: 48,
    valueSize: 34,
    deltaSize: 26,
    /** 칸 — 그림 · 지금 값(오른쪽 맞춤) · 화살표 · 뒤의 값(왼쪽 맞춤) · 증감(오른쪽 맞춤). */
    columns: { icon: -318, before: -54, arrow: 0, after: 54, delta: 340 },
  },
  /** 재화 판 아래 한 줄 — 남는 것(돌파·유대·룬). */
  noteGap: 40,
  noteSize: 24,
  /** 안내 줄 가운데에서 버튼 가운데까지. */
  buttonRoom: 96,
  button: { width: 340, height: 104, gap: 40, fontSize: 32 },
  bottomPad: 64,
  dimAlpha: CONFIRM_DIALOG.dimAlpha,
  /**
   * 판 뒷배경의 색감 — 되돌리는 창은 울먹이는 장밋빛, 먹이는 창은 들뜬 호박빛이다.
   * 위가 그 색으로 물들고 아래로 갈수록 그 색의 짙은 결(`deep`)로 가라앉는다 — 남색으로 꺼뜨리면 아래 절반이 꾸미지 않은
   * 판으로 읽혔다(응태 지적). 무대에는 SD 뒤로 퍼지는 빛살·마름모 점 무늬·떠오르는 반짝임이, 아래에는 밑동에서 피어오르는
   * 점 무늬·확정 버튼 뒤 후광·밑변 반짝이가 같은 색으로 얹힌다. 재화 판도 그 색의 짙은 판(`panel`)이다.
   */
  backdrop: {
    afraid: { wash: 0x6b2a4f, deep: 0x3a1636, panel: 0x22101f, ray: 0xff8fb8, dot: 0xffb3cf, spark: 0xffd0e2 },
    excited: { wash: 0x7a5418, deep: 0x40240c, panel: 0x241509, ray: 0xffd36b, dot: 0xffe39a, spark: 0xfff1b8 },
    /** 위 물들임의 진하기 · 빛살 수와 진하기 · 점 무늬 간격. */
    washAlpha: 0.62,
    rays: 14,
    rayAlpha: 0.11,
    dotStep: 34,
    dotAlpha: 0.2,
    sparks: 9,
  },
} as const;

export type RelicAskMood = "afraid" | "excited";

/** 재화 판의 높이 — 줄이 하나(치즈케이크)면 짧고, 젬이 들면 한 줄 더 선다. */
export function relicResetWalletHeight(rows: number): number {
  const W = RELIC_RESET_POPUP.wallet;
  return W.padY * 2 + W.headerHeight + rows * W.rowHeight;
}

/** 위에서부터 쌓은 각 자리의 y(판 가운데가 0). */
export interface RelicResetPopupSpots {
  height: number;
  stageTop: number;
  walletTop: number;
  walletHeight: number;
  noteY: number;
  buttonY: number;
}

export function relicResetPopupSpots(rows: number): RelicResetPopupSpots {
  const L = RELIC_RESET_POPUP;
  const walletHeight = relicResetWalletHeight(rows);
  const stack = L.topRoom + L.stage.height + walletHeight + L.noteGap + L.buttonRoom + L.button.height / 2 + L.bottomPad;
  const top = -stack / 2;
  const stageTop = top + L.topRoom;
  const walletTop = stageTop + L.stage.height;
  const noteY = walletTop + walletHeight + L.noteGap;
  return { height: stack, stageTop, walletTop, walletHeight, noteY, buttonY: noteY + L.buttonRoom };
}

/** 두 버튼의 x — 취소가 왼쪽, 확정이 오른쪽. */
export function relicResetButtonXs(): readonly [number, number] {
  const B = RELIC_RESET_POPUP.button;
  const half = (B.width + B.gap) / 2;
  return [-half, half];
}
