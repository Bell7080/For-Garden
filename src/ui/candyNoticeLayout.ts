/**
 * 사탕 결 안내창 셋(피드백 · 사전예약 · 베타 전 테스트)의 자리. 쿠폰 등록창과 같은 결이라 판 폭이 같고,
 * 맨 위 굵은 제목 글자 → SD와 말풍선 → 가운데 카드 → 버튼 → 글자 링크 순으로 선다.
 * 닫기는 판 밖 우하단 공용 뒤로가기와 판 밖 누르기다(오른쪽 위 X는 두지 않는다).
 */
const SPARKLES = [
  { x: -330, y: 0, size: 28, color: 0xffffff, delay: 0 },
  { x: 340, y: 40, size: 24, color: 0xfff3a6, delay: 450 },
  { x: -190, y: 70, size: 18, color: 0xffffff, delay: 900 },
  { x: 230, y: -30, size: 20, color: 0xffffff, delay: 1300 },
] as const;

const BUBBLE = { radius: 34, rim: 6, tail: 30 } as const;

/** 피드백 창 — 도디가 일지를 들고 기다린다. 첫 피드백만 젬 500(서버가 정한다). */
export const FEEDBACK_POPUP = {
  width: 900, height: 1290,
  backdrop: { top: 0xeafff3, bottom: 0xd6f0ff },
  wordmark: { y: -540, size: 112, angle: -4, gradient: ["#fffbe8", "#7fe0c0", "#3aa7d8"] as const },
  sd: { x: -270, groundY: -250, height: 210, shadowWidth: 130 },
  nameY: -222,
  bubble: { x: 110, y: -395, width: 500, height: 220, ...BUBBLE },
  /** 감사 선물 줄. */
  reward: { y: -140, width: 780, height: 92, gem: 58 },
  card: { y: 85, width: 780, height: 270, radius: 40, rim: 9, outline: 5 },
  field: { width: 700, height: 220 },
  cheerY: 262, errorY: 322,
  submitY: 410, submit: { width: 620, height: 108, tone: 0x7ddbb4 },
  laterY: 532, laterHit: { width: 440, height: 76 },
  maxGlyphs: 1000,
  sparkles: SPARKLES.map((spot) => ({ ...spot, y: spot.y - 560 })),
  loot: [[-400, -470, "gems", 80, -14], [400, -440, "gems", 70, 12], [-410, 420, "gems", 64, 10], [410, 470, "gems", 72, -10]] as const,
} as const;

/** 사전예약 안내 — 토리카가 홈페이지로 이끈다. */
export const HOMEPAGE_POPUP = {
  width: 900, height: 1000,
  backdrop: { top: 0xfff4dc, bottom: 0xffe0c8 },
  wordmark: { y: -395, size: 90, angle: -4, gradient: ["#fffbe8", "#ffc247", "#ff8a5c"] as const },
  sd: { x: -270, groundY: -95, height: 210, shadowWidth: 130 },
  nameY: -67,
  bubble: { x: 110, y: -235, width: 500, height: 210, ...BUBBLE },
  card: { y: 90, width: 780, height: 150, radius: 40, rim: 9, outline: 5 },
  goY: 255, go: { width: 640, height: 112, tone: 0xffb36b },
  laterY: 375, laterHit: { width: 440, height: 76 },
  sparkles: SPARKLES.map((spot) => ({ ...spot, y: spot.y - 420 })),
} as const;

/** 베타 전 테스트 안내 — 첫 닉네임을 정한 뒤 파루아가 조심스레 알린다. */
export const BETA_POPUP = {
  width: 900, height: 1240,
  backdrop: { top: 0xf3ecff, bottom: 0xffdcef },
  wordmark: { y: -520, size: 116, angle: -4, gradient: ["#fffbe8", "#c9a6ff", "#ff7fb6"] as const },
  sd: { x: -270, groundY: -230, height: 210, shadowWidth: 130 },
  nameY: -202,
  bubble: { x: 110, y: -375, width: 500, height: 210, ...BUBBLE },
  /** 안내 줄 카드. 줄 수에서 높이를 구하지 않고 넉넉히 잡는다 — 넘치면 글자만 줄인다(`fitTextToBox`). */
  card: { y: 110, width: 800, height: 440, radius: 40, rim: 9, outline: 5, padX: 46, bullet: 26, lineGap: 18 },
  okY: 440, ok: { width: 600, height: 108, tone: 0xb9a6ff },
  sparkles: SPARKLES.map((spot) => ({ ...spot, y: spot.y - 540 })),
} as const;
