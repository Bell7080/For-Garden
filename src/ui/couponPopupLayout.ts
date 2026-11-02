/**
 * 쿠폰 등록창의 자리. 위는 토리카가 선 **무대**(금빛 기운·반짝임·떠다니는 쿠폰), 가운데는 코드를
 * 적는 **쿠폰 한 장**(왼쪽 귀퉁이 + 점선 절취선 + 코드 칸), 아래는 등록 버튼과 홈페이지 길이다.
 * 닫기는 판 밖 우하단 공용 뒤로가기라 오른쪽 위 X를 두지 않는다.
 */
export const COUPON_POPUP = {
  width: 900, height: 1010,
  /** 토리카 뒤에 은은하게 번지는 금빛 기운. */
  stage: { x: -230, y: -270, size: 460, color: 0xffc95a, alpha: 0.22 },
  sd: { x: -230, groundY: -150, height: 270, shadowWidth: 150 },
  name: { y: -112 },
  /** 크림빛 말풍선 — 꼬리가 토리카 얼굴 쪽으로 내민다. */
  bubble: { x: 120, y: -300, width: 470, height: 170, tail: 30, fill: 0xfff4dc, ink: "#3b2a12", bob: 6 },
  /** 무대에 떠다니는 쿠폰 세 장(x·y·크기·기울기·박자). */
  tickets: [
    { x: -400, y: -400, size: 64, angle: -16, delay: 0 },
    { x: -70, y: -410, size: 52, angle: 14, delay: 420 },
    { x: 340, y: -170, size: 58, angle: -8, delay: 820 },
  ],
  /** 네 갈래 반짝임(x·y·크기·색·박자). 난수 없이 자리를 정한다. */
  sparkles: [
    { x: -360, y: -230, size: 34, color: 0xffe08a, delay: 0 },
    { x: -100, y: -300, size: 26, color: 0xffb3d9, delay: 500 },
    { x: -320, y: -440, size: 22, color: 0x9fe4ff, delay: 900 },
    { x: 330, y: -420, size: 30, color: 0xffe08a, delay: 300 },
    { x: 200, y: -175, size: 22, color: 0xffb3d9, delay: 1200 },
    { x: -150, y: -180, size: 20, color: 0x9fe4ff, delay: 700 },
  ],
  /** 코드를 적는 쿠폰 한 장. 왼쪽 귀퉁이(`stub`)와 본판 사이를 점선 절취선이 가른다. */
  card: { y: 30, width: 800, height: 240, fill: 0x2b2110, stub: 170, accent: 0xffc95a },
  stubTicket: { size: 96, angle: -14 },
  labelY: -60,
  field: { width: 560, height: 96 },
  fieldY: 26,
  errorY: 182, noticeY: 230,
  submitY: 330, submit: { width: 680, height: 104, fill: 0x5a3b0c },
  webY: 432, webHit: { width: 520, height: 80 },
} as const;

/** 쿠폰 본판(귀퉁이를 뺀 쪽)의 가운데 x. 코드 칸과 이름표가 이 줄에 선다. */
export function couponCardMainX(): number {
  const { card } = COUPON_POPUP;
  return card.stub / 2;
}
