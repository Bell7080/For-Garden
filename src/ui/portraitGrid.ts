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

/**
 * 카드 본체 위로 실제 원화가 빠져나오는 높이. 목록 배치도 같은 시각 경계를 사용한다.
 *
 * 뿔·모자·묶은 머리까지 담을 만큼은 열어 둔다. 좁게 잡으면 머리가 큰 개체만 정수리가 잘려
 * 카드마다 다른 높이에서 잘린 것처럼 보인다.
 */
export function portraitCardOverhang(height: number): number {
  return Math.round(Math.min(height * 0.26, 64));
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
 * 실제 마스크가 있는 목록은 가장자리 한 줄이 앤티에일리어싱으로 깎이므로
 * `PORTRAIT_GRID_MASK_GAP`을 함께 넘긴다.
 */
export const PORTRAIT_GRID_MASK_GAP = 8;

export function portraitGridFirstRowY(viewportTop: number, cardHeight: number, gap = 0): number {
  return viewportTop + gap + portraitGridHeadroom(cardHeight) + cardHeight / 2;
}

/** 줄 수와 줄 간격으로 그리드가 실제로 차지하는 세로 길이다. 머리 여유를 포함한다. */
export function portraitGridContentHeight(rows: number, rowGap: number, cardHeight: number): number {
  if (rows <= 0) return 0;
  return portraitGridHeadroom(cardHeight) + (rows - 1) * rowGap + cardHeight;
}

/**
 * 머리가 빠져나오는 홈의 모양.
 *
 * 홈은 직사각형이 아니라 **위로 갈수록 벌어지는 사다리꼴**이다. 잘린 모서리(`/`)를 피해야
 * 하는 것은 홈이 칩 윗변과 만나는 **그 한 줄뿐**이고, 그보다 위는 칩이 없어 아무것도 침범하지
 * 않는다. 그래서 아래는 모서리 안쪽에서 좁게 시작하고 위로 올라가며 넓어진다 — 머리가 가장
 * 넓은 자리에서 홈도 가장 넓다.
 *
 * 예전처럼 위아래 같은 폭으로 뚫으면, 모서리를 피하느라 좁아진 폭이 머리 끝까지 그대로 따라
 * 올라가 정수리 옆이 세로로 베인다. 캐릭터마다 `cardHeadEscape`를 실측해 메우던 문제가
 * 대부분 여기서 나왔다.
 */
export interface PortraitCardHeadWindow {
  /** 칩 윗변에서의 홈 폭. 잘린 모서리 안쪽을 침범하지 않는다. */
  width: number;
  /** 칩 윗변에서의 홈 중심이 카드 가운데서 밀린 거리. */
  offsetX: number;
  /** 돌출 꼭대기에서의 홈 폭. 모서리 제약이 없어 더 넓다. */
  topWidth: number;
  /** 돌출 꼭대기에서의 홈 중심이 밀린 거리. */
  topOffsetX: number;
}

/**
 * 홈이 칩 윗변에서 잘린 모서리와 두는 최소 여유.
 *
 * 0으로 두면 홈의 옆 변과 대각선이 한 점에서 만나 도형이 스스로 접힌다(v0.29.10에서 고친
 * 자기 교차 문제). 눈에 보이라고 두는 여백이 아니라 도형이 성립하기 위한 최소값이다.
 */
const NOTCH_BEVEL_CLEARANCE = 4;

/**
 * 돌출 꼭대기에서 홈이 열릴 수 있는 최대 비율(칩 폭 대비).
 *
 * 칩 윗변 위쪽에는 머리밖에 없으므로 거의 다 열어도 어깨가 새지 않는다. 그래도 칩 폭 자체는
 * 넘지 않아, 머리가 카드 몸통보다 넓어 보이지는 않게 둔다.
 */
const HEAD_WINDOW_TOP_RATIO = 0.94;

/**
 * 머리 홈의 아래(칩 윗변)·위(돌출 꼭대기) 폭을 함께 구한다.
 *
 * `ratio`는 칩 윗변에서 열고 싶은 기본 폭이다. 그 폭이 한쪽 모서리의 대각선 안쪽까지 들어오면
 * **그 쪽만** 줄인다 — 위쪽 두 모서리는 서로 다르게 깎이므로(왼쪽이 훨씬 깊다) 둘 중 깊은
 * 쪽에 맞춰 양쪽을 함께 줄이면 얕게 깎인 쪽이 이유 없이 좁아진다.
 *
 * `bias`는 그래도 모자란 원화만 쓰는 미세 조정이다(칩 폭 대비 비율). 모자·깃털·후드가 한쪽으로
 * 쏠려 그려진 원화에서 그 쪽만 더 연다. 사다리꼴 홈이 생긴 뒤로는 대부분 필요 없다.
 */
export function portraitCardHeadWindow(
  chipWidth: number,
  topLeftBevel: number,
  topRightBevel: number,
  ratio = 0.8,
  bias: { left?: number; right?: number } = {},
): PortraitCardHeadWindow {
  const half = chipWidth / 2;
  const wantLeft = (chipWidth * ratio) / 2 + chipWidth * Math.max(0, bias.left ?? 0);
  const wantRight = (chipWidth * ratio) / 2 + chipWidth * Math.max(0, bias.right ?? 0);

  // 칩 윗변에서는 그 쪽 대각선 안쪽을 넘을 수 없다.
  const left = Math.min(wantLeft, Math.max(0, half - topLeftBevel - NOTCH_BEVEL_CLEARANCE));
  const right = Math.min(wantRight, Math.max(0, half - topRightBevel - NOTCH_BEVEL_CLEARANCE));
  // 꼭대기는 칩이 없어 모서리를 신경 쓰지 않는다. 다만 아래보다 좁아지지는 않는다.
  const topLimit = half * HEAD_WINDOW_TOP_RATIO;
  const topLeft = Math.max(left, Math.min(wantLeft, topLimit));
  const topRight = Math.max(right, Math.min(wantRight, topLimit));

  return {
    width: left + right,
    offsetX: (right - left) / 2,
    topWidth: topLeft + topRight,
    topOffsetX: (topRight - topLeft) / 2,
  };
}
