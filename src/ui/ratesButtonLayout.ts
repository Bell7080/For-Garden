/**
 * 확률 정보 버튼(`addRatesButton`)의 결과 자리 — Phaser 없이 읽히도록 따로 둔다(E2E·단위 테스트가 같은 값을 읽는다).
 */
export const RATES_BUTTON = {
  height: 68,
  /** `%` 표식 칸 한 변. */
  icon: 48,
  font: 28,
  markFont: 32,
  padX: 14,
  gap: 12,
  bevel: 12,
  maxWidth: 320,
  /** 정보의 청록 — 재화·보상의 금빛(상점 칩)과 갈린다. */
  tone: 0x5fd0e6,
  markInk: "#0b1a22",
  fill: 0x0c1820,
  alpha: 0.9,
} as const;

/**
 * 화면에 붙는 자리.
 *
 * 연구소·고고학은 **곁 상점 칩(`SIDE_SHOP.screen` — 왼쪽, y 430, 한 변 104) 바로 아래 같은 왼쪽 열**에 선다.
 * 제목 옆 구석에 흐린 글줄로 숨어 있던 때는 배경 원화에 묻혀 찾기 어려웠다 — 두 화면이 같은 자리를 쓰면
 * "확률은 상점 아래"가 한 번에 익는다.
 */
export const RATES_SPOT = {
  screen: { x: 32, y: 552 },
} as const;
