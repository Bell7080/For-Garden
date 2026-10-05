/**
 * 로비 패스 창의 자리표(창 중심 기준).
 *
 * 위에서부터 **패스 이름(제목표) → 패스 레벨과 레벨 단위로 끊긴 게이지 → 목록(보상 또는 미션) → 미션·보상 탭과
 * 받기 → 패스 탭** 순이다. 목록은 마디 열다섯 줄이 **창 안에서 아래로 흐른다** — 한 판에 다 넣으려고 줄을 줄이면
 * 액자가 작아져 무엇을 받는지보다 줄 수가 먼저 읽힌다.
 *
 * 보상 줄은 **가운데에 레벨**, 왼쪽에 무료 칸, 오른쪽에 유료(패스) 칸이 선다. 가운데 레벨 열에는 세로 게이지가 줄을
 * 꿰뚫고 내려가, 닿은 레벨까지 한 칸씩 차오른다.
 */
export const PASS_POPUP = {
  width: 1000,
  height: 1600,
  /** 판 안쪽 여백. 줄·게이지·탭이 모두 이 폭 안에 든다. */
  inner: 920,
  header: { levelY: 92, levelSize: 52, progressSize: 26, gaugeY: 160, gaugeHeight: 26 },
  list: {
    top: 214,
    headerHeight: 66,
    rowHeight: 150,
    rowPlate: 134,
    /** 가운데 레벨 칸의 폭. 양옆 칸은 남은 폭을 반씩 나눠 갖는다. */
    levelWidth: 190,
    frame: 108,
    frameGap: 14,
    /** 가운데 레벨 표식(◈) — 바깥 마름모의 대각선, 안쪽 마름모의 대각선, 레벨 수 크기. */
    badge: { outer: 124, inner: 84, size: 34 },
    /** 세로 게이지의 굵기. */
    rail: 14,
    /** 목록 맨 위·아래 여백. 첫 줄의 판이 창 윗변에 붙지 않게 한다. */
    pad: 10,
  },
  /** 받을 수 있는 칸의 노란 맥동 — 임무의 받을 수 있는 액자와 같은 결이다. */
  pulse: { halo: 24, haloAlpha: 0.42, scale: 1.08, ms: 620 },
  /** 손가락이 이만큼 움직이면 누름이 아니라 끌기다. */
  dragSlop: 14,
  /**
   * 목록 아래 한 줄 — 왼쪽에 미션·보상 탭, 오른쪽에 받기. 패스 탭 줄에 바짝 붙이고 얇게 두어 목록 창을 그만큼 넓힌다.
   */
  modeRow: { fromBottom: 176, tabWidth: 190, tabHeight: 60, tabGap: 8, button: { width: 320, height: 66 } },
  /**
   * 맨 아래 패스 탭 줄 — 패스가 늘어도 칸이 줄지 않도록 **고정 폭 칸이 옆으로 흐르는 줄**이다. 오른쪽 끝은 창의 깎인
   * 모서리(오른쪽 아래 빗변)를 따라 잘리고, 그 빗변에서 `edgeInset`만큼 물러난다. 그 물러남은 왼쪽 여백(판 변 → 줄 시작선, `(width - inner) / 2`)과 같아서 줄이 뒷 판과 양쪽에서 같은 간격으로 앉는다 — 14px로 바싹 붙이던 때는 오른쪽 끝이 뒷 판 빗변에 눌려 비율이 맞지 않았다.
   */
  passRow: { fromBottom: 78, tabWidth: 290, tabHeight: 80, tabGap: 8, edgeInset: 40 },
  /**
   * 패스 넘김 화살표 — 창 좌우 가장자리, 목록 창의 세로 가운데에 걸친다. 창 바깥 여백(`(width - inner) / 2` = 40)에 앉고
   * 안쪽 여백으로 조금 넘어오는 몫은 반투명 유리가 받는다.
   */
  arrow: { width: 56, height: 112, stroke: 5, edgeGap: 4, disabledAlpha: 0.28 },
  /**
   * 패스를 열지 않았을 때 창 오른쪽 위에 **떠 있는 패키지 카드** — 무역·프리미엄 전시대의 카드와 같은 겉모습이다.
   * 유료 칸 머리에 버튼으로 세우던 때는 「잠김」이어야 할 자리가 사는 곳이 되어, 받을 수 없는 칸과 사는 곳이 한 줄에
   * 섞였다. 카드는 창 윗변 위로 꼬리표를 내밀어 창 위에 한 장 더 얹힌 물건으로 읽힌다.
   * 이 카드가 서는 동안 머리 줄의 게이지와 진행도는 카드 왼쪽까지만 쓴다.
   */
  offer: {
    width: 400,
    height: 222,
    /** 창 오른쪽 변에서 안쪽으로 물러나는 몫과 창 윗변에서 내려오는 카드 중심. */
    inset: 22,
    centerY: 100,
    /** 게이지와 카드 사이. */
    gap: 28,
    pad: 34,
    nameY: -72,
    nameSize: 30,
    frameY: -10,
    frame: 70,
    frameGap: 10,
    frameCap: 3,
    price: { y: 74, width: 300, height: 52, size: 30 },
    breathMs: 1100,
  },
} as const;

/**
 * 켜진 전환 라벨이 제 중심 위로 뻗는 최대 높이(`CategoryTab`의 솟음·강조선·켜진 배율을 모두 센다).
 * 켜진 패스 탭이 커지며 위의 미션·보상 탭을 가리지 않도록 두 줄의 간격이 이 값을 읽는다.
 */
export function selectedTabReach(tabHeight: number, tab: { lift: number; edgeWidth: number; selectedScale: number }): { up: number; down: number } {
  return { up: (tabHeight / 2 + tab.lift) * tab.selectedScale + tab.edgeWidth / 2, down: (tabHeight / 2) * tab.selectedScale };
}

/** 미션·보상 탭 줄의 아래 끝과 패스 탭 줄의 위 끝 사이 빈 간격(창 아래에서 잰 높이 차). 0보다 커야 서로 가리지 않는다. */
export function modeToPassTabGap(tab: { lift: number; edgeWidth: number; selectedScale: number }): number {
  const { modeRow, passRow } = PASS_POPUP;
  const modeBottom = modeRow.fromBottom - selectedTabReach(modeRow.tabHeight, tab).down;
  const passTop = passRow.fromBottom + selectedTabReach(passRow.tabHeight, tab).up;
  return modeBottom - passTop;
}

/** 줄 판의 세 칸 중심 x — 왼쪽 무료, 가운데 레벨, 오른쪽 유료. */
export function passPopupColumns(): { free: number; level: number; paid: number; sideWidth: number } {
  const { inner, list } = PASS_POPUP;
  const sideWidth = (inner - list.levelWidth) / 2;
  return { free: -inner / 2 + sideWidth / 2, level: 0, paid: inner / 2 - sideWidth / 2, sideWidth };
}

/** 목록 머리(열 이름 줄)의 중심 y. */
export function passPopupListHeaderY(): number {
  return -PASS_POPUP.height / 2 + PASS_POPUP.list.top + PASS_POPUP.list.headerHeight / 2;
}

/** 목록이 흐르는 창(창 중심 기준 y). 머리 줄 아래에서 탭 줄 한 뼘 위까지다. */
export function passPopupViewport(): { top: number; bottom: number; height: number } {
  const top = -PASS_POPUP.height / 2 + PASS_POPUP.list.top + PASS_POPUP.list.headerHeight;
  const bottom = PASS_POPUP.height / 2 - PASS_POPUP.modeRow.fromBottom - PASS_POPUP.modeRow.tabHeight / 2 - 24;
  return { top, bottom, height: bottom - top };
}

/** i번째 줄의 중심 y — 흐르는 목록 안(창 윗변이 0)의 좌표다. */
export function passPopupRowY(index: number): number {
  return PASS_POPUP.list.pad + PASS_POPUP.list.rowHeight * (index + 0.5);
}

/** 줄 `count`개가 쌓인 목록 높이. */
export function passPopupContentHeight(count: number): number {
  return PASS_POPUP.list.pad * 2 + PASS_POPUP.list.rowHeight * count;
}

/** 목록이 올라갈 수 있는 끝(음수). 창보다 짧으면 0이라 흐르지 않는다. */
export function passPopupMinScroll(count: number): number {
  return Math.min(0, passPopupViewport().height - passPopupContentHeight(count));
}

/** 처음 열 때 그 줄이 창 가운데쯤 오도록 하는 스크롤 값. */
export function passPopupScrollFor(index: number, count: number): number {
  const target = passPopupViewport().height / 2 - passPopupRowY(index);
  return Math.max(passPopupMinScroll(count), Math.min(0, target));
}

/**
 * 가운데 세로 게이지가 차오른 끝(목록 안 y). 마디 하나가 한 줄이고, 닿은 레벨의 줄 가운데까지 찬 뒤 다음 줄을
 * 향해 그 사이를 온 만큼 더 내려간다 — 위에서 한 칸씩 아래로 내려가는 느낌이 그대로 길이로 읽힌다.
 */
export function passPopupRailFill(level: number, max: number, partial: number): number {
  if (max <= 0) return 0;
  if (level >= max) return passPopupContentHeight(max);
  const p = Math.max(0, Math.min(1, partial));
  if (level <= 0) return passPopupRowY(0) * p;
  return passPopupRowY(level - 1) + PASS_POPUP.list.rowHeight * p;
}

/** 칸 안 액자 `count`장의 중심 x(칸 중심 기준). */
export function passPopupFrameXs(count: number): number[] {
  const { frame, frameGap } = PASS_POPUP.list;
  const span = count * frame + Math.max(0, count - 1) * frameGap;
  return Array.from({ length: count }, (_, index) => -span / 2 + frame / 2 + index * (frame + frameGap));
}

/** 패스 탭 `count`장의 중심 x(흐르는 줄 안, 줄의 왼쪽 끝이 0)와 폭, 줄 전체 길이. */
export function passPopupPassTabs(count: number): { width: number; xs: number[]; span: number } {
  const { tabWidth: width, tabGap } = PASS_POPUP.passRow;
  return { width, xs: Array.from({ length: count }, (_, index) => width / 2 + index * (width + tabGap)), span: count * width + Math.max(0, count - 1) * tabGap };
}

/**
 * 패스 탭 줄이 보이는 창(창 중심 기준). 왼쪽은 목록과 같은 시작선, 오른쪽은 창의 오른쪽 아래 빗변을 따라 잘린다 —
 * 네모로 자르면 빗변 밖 허공에 탭이 걸친다. `right(y)`는 그 높이에서 보이는 오른쪽 끝이다.
 */
export function passPopupPassStrip(): { left: number; top: number; bottom: number; right: (y: number) => number; polygon: number[] } {
  const { width, height, inner, passRow } = PASS_POPUP;
  const bevel = Math.min(width, height) * 0.14;
  const centerY = height / 2 - passRow.fromBottom;
  const top = centerY - passRow.tabHeight / 2 - 22;
  const bottom = centerY + passRow.tabHeight / 2 + 4;
  const left = -inner / 2;
  // 빗변: (width/2, height/2 - bevel) → (width/2 - bevel, height/2). 그 선에서 edgeInset만큼 안쪽으로 평행하게 민다.
  const right = (y: number): number => Math.min(inner / 2, width / 2 - Math.max(0, y - (height / 2 - bevel)) - passRow.edgeInset * Math.SQRT2);
  return { left, top, bottom, right, polygon: [left, top, right(top), top, right(bottom), bottom, left, bottom] };
}

/** 탭 줄이 왼쪽으로 밀릴 수 있는 끝(음수). 보이는 폭은 탭 가운데 높이에서 잰다. */
export function passPopupPassMinScroll(count: number): number {
  const strip = passPopupPassStrip();
  const visible = strip.right(PASS_POPUP.height / 2 - PASS_POPUP.passRow.fromBottom) - strip.left;
  return Math.min(0, visible - passPopupPassTabs(count).span);
}

/**
 * 로비의 패스 카드 — 홍보 칸 자리(프로필 줄 아래)에 한 장씩 서고, 아래 점 줄이 몇 번째 패스인지 말한다.
 * 일정 간격으로 다음 패스가 오른쪽에서 밀려 들어온다. 모서리는 덜 깎아 가로로 긴 이름표로 읽히게 한다.
 */
export const LOBBY_PASS_CARD = {
  left: 30,
  y: 250,
  width: 380,
  height: 132,
  /**
   * 깎임은 높이의 이 비율. 0.42는 끝이 뭉툭하게 잘려 짧은 쪽지처럼 보였고, 0.2도 왼쪽 빗변이 판 위의 색 띠와 게이지의
   * 결을 비틀어 유리 판과 따로 노는 것처럼 보였다 — 모서리만 살짝 깎는다.
   */
  bevel: 0.08,
  stripe: 10,
  pad: 34,
  nameSize: 30,
  levelSize: 26,
  nameY: -30,
  gauge: { y: 10, height: 12 },
  noteY: 40,
  noteSize: 20,
  dots: { gap: 28, size: 11, y: 94 },
  /** 다음 패스로 넘어가는 간격과 미끄러지는 시간. */
  cycleMs: 4200,
  slideMs: 460,
  /** 넘길 때 글이 미끄러지는 거리. 판 안쪽 여백(`pad`)보다 작아야 판 밖으로 나가지 않는다 — 자르는 마스크가 없다. */
  slideDistance: 22,
} as const;

/** 패스 넘김 화살표의 중심 `{x, y}`(창 중심 기준). `direction`이 -1이면 왼쪽, 1이면 오른쪽이다. */
export function passPopupArrowSpot(direction: -1 | 1): { x: number; y: number } {
  const { width, arrow } = PASS_POPUP;
  const view = passPopupViewport();
  return { x: direction * (width / 2 - arrow.width / 2 - arrow.edgeGap), y: (view.top + view.bottom) / 2 };
}

/** 지금 `index`번째 패스에서 `direction` 쪽으로 넘길 수 있는가 — 순환하지 않으므로 맨 앞·맨 뒤에서는 막힌다. */
export function passPopupCanStep(index: number, count: number, direction: -1 | 1): boolean {
  const next = index + direction;
  return index >= 0 && next >= 0 && next < count;
}

/** 패스 탭 줄에서 탭 가운데 높이에 보이는 폭. */
export function passPopupPassVisibleWidth(): number {
  const strip = passPopupPassStrip();
  return strip.right(PASS_POPUP.height / 2 - PASS_POPUP.passRow.fromBottom) - strip.left;
}

/**
 * `index`번째 탭이 선 뒤 탭 줄이 가야 할 스크롤 — 고른 탭을 보이는 폭의 **가운데로** 모은다(끝에서는 줄의 한계에 멈춘다).
 * 다 보이기만 하면 움직이지 않는 탭이 생겨 줄이 따라 흐르는지 읽히지 않으므로, 한 칸 넘길 때마다 줄이 함께 흐르고
 * 양옆의 이웃 탭이 비쳐 줄이 더 이어진다는 것이 보이게 한다. 결과는 `[passPopupPassMinScroll, 0]` 안이다.
 */
export function passPopupPassFollow(index: number, count: number): number {
  const { xs } = passPopupPassTabs(count);
  const min = passPopupPassMinScroll(count);
  const center = xs[index];
  if (center === undefined) return 0;
  return Math.min(0, Math.max(min, passPopupPassVisibleWidth() / 2 - center));
}
