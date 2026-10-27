/**
 * 쿠폰 등록창의 자리. 위에 토리카와 말풍선, 가운데 코드 칸, 아래 등록 버튼과 홈페이지 길이 선다.
 * 말풍선은 SD 머리 옆에서 시작해 판 오른쪽 끝 안쪽에서 끝난다.
 */
export const COUPON_POPUP = {
  width: 900, height: 960,
  sd: { x: -250, groundY: -150, height: 240, shadowWidth: 140 },
  bubble: { x: 95, y: -280, width: 500, height: 170, tail: 34 },
  ticket: { x: -150, y: -330, size: 74 },
  fieldLabelY: -70, fieldY: 6,
  field: { width: 740, height: 96 },
  errorY: 84, noticeY: 140,
  submitY: 250, submit: { width: 680, height: 96 },
  webY: 360, webHit: { width: 520, height: 80 },
} as const;
