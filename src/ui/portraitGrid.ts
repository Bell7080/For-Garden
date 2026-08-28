/**
 * 캐릭터 카드 그리드의 안전 영역.
 *
 * `PortraitCard`는 머리를 칩 윗변 밖으로 내보낸다(위쪽 홈이 열려 있다). 그래서 목록의 첫 줄을
 * 마스크나 판 경계에 바로 붙이면 정수리가 잘린다. 몇 픽셀이라 눈에 잘 띄지 않지만 카드마다
 * 다른 높이에서 잘려 목록 전체가 어수선해진다.
 *
 * 화면마다 "대충 조금 내려" 두면 화면이 늘 때마다 기준이 갈라지므로, 돌출 높이와 첫 줄 자리는
 * Phaser를 모르는 이 한 곳에서만 계산하고 도감·발굴·앞으로의 그리드가 함께 쓴다.
 */

/** 카드 본체 위로 실제 원화가 빠져나오는 높이. 목록 배치도 같은 시각 경계를 사용한다. */
export function portraitCardOverhang(height: number): number {
  return Math.round(Math.min(height * 0.22, 54));
}

/**
 * 그리드가 위쪽에 반드시 비워 둬야 하는 여유다.
 *
 * 카드 몸체가 아니라 **머리**가 목록의 실제 윗경계라, 이 값만큼은 카드가 아닌 빈 곳이어야 한다.
 */
export function portraitGridHeadroom(cardHeight: number): number {
  return portraitCardOverhang(cardHeight);
}

/**
 * 첫 줄 카드 **중심**의 y.
 *
 * `viewportTop`은 목록이 잘리는 경계(스크롤 마스크의 윗변, 판의 윗변)다. `gap`은 그 경계와
 * 머리 사이에 더 두고 싶은 숨 쉴 공간이며, 기본은 0 — 머리가 경계에 닿기만 하고 잘리지 않는다.
 */
export function portraitGridFirstRowY(viewportTop: number, cardHeight: number, gap = 0): number {
  return viewportTop + gap + portraitGridHeadroom(cardHeight) + cardHeight / 2;
}

/** 줄 수와 줄 간격으로 그리드가 실제로 차지하는 세로 길이다. 머리 여유를 포함한다. */
export function portraitGridContentHeight(rows: number, rowGap: number, cardHeight: number): number {
  if (rows <= 0) return 0;
  return portraitGridHeadroom(cardHeight) + (rows - 1) * rowGap + cardHeight;
}
