/**
 * 쿠폰 등록창의 자리 — 이벤트 판(보물상자 대장간)과 같은 밝은 사탕 결이다.
 *
 * 맨 위에 굵은 **COUPON** 글자가 이 창이 무엇인지 그림 없이 말하고, 그 아래 토리카와 말풍선,
 * 가운데에 코드를 적는 말랑한 카드, 아래에 등록 버튼과 홈페이지 길이 선다. 젬·골드·치즈케이크는
 * 판 가장자리에만 흩어져 글과 버튼을 가리지 않는다. 닫기는 판 밖 우하단 공용 뒤로가기다.
 */
export const COUPON_POPUP = {
  width: 900, height: 1150,
  /** 크림 → 분홍으로 흐르는 바탕과 물방울 무늬. */
  backdrop: { top: 0xfff4dc, bottom: 0xffd6e6, dot: 0xffffff, dotAlpha: 0.38, dotGap: 56, dotRadius: 5 },
  /** 굵은 제목 글자. 흐르는 색 + 짙은 자두빛 획 + 아래로 떨어지는 그림자. */
  wordmark: { y: -400, size: 124, angle: -4, gradient: ["#fffbe8", "#ffc247", "#ff6f91"] as const, stroke: 16, shadowY: 10 },
  sd: { x: -250, groundY: -60, height: 230, shadowWidth: 140 },
  name: { y: -28 },
  bubble: { x: 120, y: -160, width: 470, height: 150, radius: 34, tail: 30, rim: 6 },
  /** 코드를 적는 카드. 사탕 결의 굵은 외곽선 + 분홍 테 + 크림 면. */
  card: { y: 120, width: 780, height: 210, radius: 40, rim: 9, outline: 5 },
  labelY: -50,
  field: { width: 680, height: 92 },
  fieldY: 26,
  errorY: 258, noticeY: 304,
  submitY: 400, submit: { width: 640, height: 112, tone: 0xffb36b },
  webY: 528, webHit: { width: 520, height: 76 },
  /** 판 가장자리에 흩어지는 보상 그림(x·y·재화·크기·기울기). 글이 서는 가운데는 비운다. */
  loot: [
    [-395, -470, "gems", 86, -16], [395, -470, "gold", 92, 14], [-405, -270, "gold", 70, 10], [400, -300, "cheesecake", 78, -12],
    [-410, 0, "cheesecake", 74, -8], [410, 20, "gems", 70, 12], [-400, 330, "gems", 80, 14], [405, 330, "gold", 84, -14],
    [-380, 500, "gold", 66, -6], [380, 500, "cheesecake", 72, 8], [-240, -500, "cheesecake", 54, 8], [250, -330, "gems", 52, -10],
  ] as const,
  /** 네 갈래 반짝임(x·y·크기·색·박자). */
  sparkles: [
    { x: -320, y: -440, size: 30, color: 0xffffff, delay: 0 },
    { x: 330, y: -400, size: 26, color: 0xfff3a6, delay: 450 },
    { x: -180, y: -330, size: 18, color: 0xffffff, delay: 900 },
    { x: 220, y: -460, size: 20, color: 0xffffff, delay: 1300 },
    { x: 340, y: -90, size: 22, color: 0xfff3a6, delay: 700 },
    { x: -120, y: -110, size: 18, color: 0xffffff, delay: 1100 },
  ],
} as const;

/** 이 창이 쓰는 사탕 결의 색. 보물상자·돌림판과 같은 짙은 자두빛 외곽선을 쓴다. */
export const COUPON_TONE = {
  ink: 0x4a2337, inkText: "#4a2337", soft: "#8a5a6e",
  rim: 0xff8fb8, cream: 0xfff6e4, accentText: "#e2602a", danger: "#d64545",
  fieldFill: 0xffffff, placeholder: "#c9a6b4", fieldAccent: 0xff8fb8,
} as const;
