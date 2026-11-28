/**
 * 귀여운 안내 판의 자리와 색 — Phaser를 모르는 순수 배치표.
 *
 * 튜토리얼·첫 방문 안내가 그림 하나와 맨 글자만 늘어놓던 판(응태 지적 2026-11-28 — 「팝업만 있는 튜토리얼 설명」)을
 * 레벨 초기화·MAX 급여 창과 같은 문법으로 꾸민다: 위 **무대**에 안내하는 아이의 SD가 통통 뛰고 빛살·마름모 점 무늬·
 * 반짝임이 판의 색으로 깔리며, 하얀 **말풍선**이 큰 제목과 본문을 싣는다. 아래에는 덤 칸(받는 지원품·완성한 룬)과
 * 넘김 점·버튼이 선다. 창 높이는 손으로 적지 않고 칸이 있는지·넘길 쪽이 있는지에서 거꾸로 구한다.
 *
 * 이름 설정 창(`NicknamePopup`)도 같은 무대·말풍선을 쓰되 SD 둘이 양옆에 서고 입력 칸을 크게 둔다(`NICKNAME_POPUP`).
 */

/** 판 한 벌의 색 — 무대의 물들임 · 가라앉는 결 · 몸판 · 빛살 · 점 무늬 · 반짝임 · 강조선 · 버튼 · 말풍선 제목. */
export interface CuteGuideTone {
  wash: number;
  deep: number;
  panel: number;
  ray: number;
  dot: number;
  spark: number;
  accent: number;
  button: number;
  heading: string;
}

export type CuteGuideToneId = "pink" | "mint" | "sky" | "amber" | "lilac";

/** 색 다섯 벌 — 모두 사탕빛이고 진하기는 잔잔하게 둔다(SD·말풍선이 무늬보다 먼저 읽혀야 한다). */
export const CUTE_GUIDE_TONES: Readonly<Record<CuteGuideToneId, CuteGuideTone>> = {
  pink: { wash: 0x7a2f63, deep: 0x3a1636, panel: 0x2a1330, ray: 0xff9ad5, dot: 0xffbfe2, spark: 0xffe0f1, accent: 0xff9ad5, button: 0xff5fae, heading: "#d63384" },
  mint: { wash: 0x1f6b57, deep: 0x0f3a33, panel: 0x0f2422, ray: 0x8affd0, dot: 0xb6ffe0, spark: 0xe0fff3, accent: 0x7ef0c4, button: 0x2fc98c, heading: "#138a5c" },
  sky: { wash: 0x24578a, deep: 0x12284a, panel: 0x101c30, ray: 0x9fd8ff, dot: 0xc2e9ff, spark: 0xe6f6ff, accent: 0x8fd0ff, button: 0x3f9fff, heading: "#1f6fc4" },
  amber: { wash: 0x7a5418, deep: 0x40240c, panel: 0x241509, ray: 0xffd36b, dot: 0xffe39a, spark: 0xfff1b8, accent: 0xffd36b, button: 0xff8a26, heading: "#c25a0a" },
  lilac: { wash: 0x553a8a, deep: 0x2a1a4d, panel: 0x1c1430, ray: 0xc9a8ff, dot: 0xdcc6ff, spark: 0xf0e6ff, accent: 0xc9a8ff, button: 0x9a6bff, heading: "#6a3fc4" },
};

export const CUTE_GUIDE = {
  width: 960,
  /** 판 윗변에서 무대 윗변까지 — 머리글이 윗변에 걸터앉는다. */
  topRoom: 74,
  stage: {
    height: 452,
    /** 안내하는 아이 — 무대 왼쪽 아래. 좌표는 무대 윗변 기준. */
    sd: { x: -318, ground: 430, height: 292, shadow: 160 },
    /** 말풍선 — 무대 오른쪽을 크게 차지하고, 꼬리가 왼쪽 아래 SD 머리를 가리킨다. */
    bubble: { x: 112, y: 214, width: 640, height: 340, tail: 40, headingY: -106, headingSize: 46, body: { top: -58, height: 200, size: 34, wrap: 560 } },
    /** 말풍선 왼쪽 위 모서리에 비스듬히 붙는 그림 스티커. */
    sticker: { x: -186, y: 44, size: 124, angle: -10 },
  },
  /** 덤 칸(지원품·완성한 룬) — 있으면 무대 아래에 선다. */
  extraGap: 26,
  dots: { room: 56, size: 18, gap: 34 },
  button: { width: 320, height: 104, gap: 30, fontSize: 34, single: 560 },
  /** 무대(또는 덤·점 줄) 아래에서 버튼 가운데까지. */
  buttonRoom: 96,
  bottomPad: 74,
  dimAlpha: 0.72,
  backdrop: { washAlpha: 0.5, rays: 12, rayAlpha: 0.06, dotStep: 38, dotAlpha: 0.12, sparks: 8, spinMs: 60000 },
} as const;

export interface CuteGuideSpots {
  height: number;
  stageTop: number;
  stageBottom: number;
  /** 덤 칸 가운데 — 칸이 없으면 `undefined`. */
  extraY?: number;
  /** 넘김 점 줄 — 한 쪽뿐이면 `undefined`. */
  dotsY?: number;
  buttonY: number;
}

/** 위에서부터 쌓은 각 자리의 y(판 가운데가 0). */
export function cuteGuideSpots(options: { extraHeight?: number; pages: number }): CuteGuideSpots {
  const L = CUTE_GUIDE;
  const extra = options.extraHeight ? L.extraGap + options.extraHeight : 0;
  const dots = options.pages > 1 ? L.dots.room : 0;
  const stack = L.topRoom + L.stage.height + extra + dots + L.buttonRoom + L.button.height / 2 + L.bottomPad;
  const top = -stack / 2;
  const stageTop = top + L.topRoom;
  const stageBottom = stageTop + L.stage.height;
  const extraY = options.extraHeight ? stageBottom + L.extraGap + options.extraHeight / 2 : undefined;
  const dotsY = options.pages > 1 ? stageBottom + extra + L.dots.room / 2 + 6 : undefined;
  const buttonY = stageBottom + extra + dots + L.buttonRoom;
  return { height: stack, stageTop, stageBottom, ...(extraY !== undefined ? { extraY } : {}), ...(dotsY !== undefined ? { dotsY } : {}), buttonY };
}

/**
 * 이름 설정 창 — 같은 무대에 도디·파루아가 양옆에서 통통 뛰고, 가운데 위 말풍선이 「이름이 무엇인가요?」를 크게 묻는다.
 * 아래 입력 칸·글자 수·조건·주기 안내를 예전보다 한 뼘씩 크게 세운다(응태 요청 — 가시성).
 */
export const NICKNAME_POPUP = {
  width: 940,
  topRoom: 74,
  stage: {
    height: 400,
    sd: { xs: [-300, 300], ground: 358, height: 232, shadow: 140, labelDy: 24, labelSize: 28 },
    bubble: { x: 0, y: 100, width: 520, height: 150, tail: 34, size: 40, wrap: 460 },
  },
  fieldLabelGap: 46, fieldLabelSize: 32,
  help: { size: 64 },
  field: { width: 800, height: 112, fontSize: 40 },
  fieldGap: 88,
  countGap: 50, countSize: 28,
  rulesGap: 34, rulesSize: 28,
  noticeGap: 128, noticeSize: 27,
  saveGap: 120, save: { width: 700, height: 108, fontSize: 36 },
  bottomPad: 74,
} as const;

export interface NicknamePopupSpots {
  height: number;
  stageTop: number;
  stageBottom: number;
  fieldLabelY: number;
  fieldY: number;
  countY: number;
  rulesY: number;
  noticeY: number;
  saveY: number;
}

export function nicknamePopupSpots(): NicknamePopupSpots {
  const L = NICKNAME_POPUP;
  const stack = L.topRoom + L.stage.height + L.fieldLabelGap + L.fieldGap + L.countGap + L.rulesGap + L.noticeGap + L.saveGap + L.save.height / 2 + L.bottomPad;
  const top = -stack / 2;
  const stageTop = top + L.topRoom;
  const stageBottom = stageTop + L.stage.height;
  const fieldLabelY = stageBottom + L.fieldLabelGap;
  const fieldY = fieldLabelY + L.fieldGap;
  const countY = fieldY + L.countGap + L.field.height / 2 - 20;
  const rulesY = countY + L.rulesGap;
  const noticeY = rulesY + L.noticeGap;
  const saveY = noticeY + L.saveGap;
  return { height: stack, stageTop, stageBottom, fieldLabelY, fieldY, countY, rulesY, noticeY, saveY };
}
