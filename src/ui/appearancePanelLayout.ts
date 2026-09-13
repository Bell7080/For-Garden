/**
 * 외형 **전시관**의 자리표. Phaser에 의존하지 않아 화면과 회귀 테스트가 같은 값을 읽는다.
 *
 * **카드 둘을 나란히 세우던 판이 아니다.** 예전에는 기본 외형과 추가 외형을 같은 크기의 카드
 * 두 장으로 세워 놓고 골랐는데, 외형이 셋만 되어도 설 자리가 없었고 무엇보다 **고른 외형을
 * 크게 볼 수 없었다** — 입을지 말지를 정하는 화면인데 정작 그 외형이 카드만 하게 서 있었다.
 *
 * 지금은 위가 **무대**, 아래가 **띠**다. 무대에는 지금 고른 외형 하나가 전신으로 크게 서고,
 * 띠는 옆으로 넘기며 고른다 — 전시관을 한 바퀴 도는 손짓이다.
 */
export const APPEARANCE_PANEL = {
  width: 940,
  height: 1520,
  /** 무대에 선 전신. 발끝을 바닥선에 맞추고 그 높이로 배율이 정해진다. */
  hero: { groundY: 160, height: 660 },
  /** 무대 바닥의 투영 받침 — 전신이 공중에 뜨지 않게 한다. */
  stand: { y: 172, width: 420, height: 84 },
  name: { y: 252, size: 42 },
  state: { y: 306, size: 26 },
  /** 값 줄. `purchasable`인 외형에만 서고 그 밖에는 자리를 비운다. */
  price: { y: 376, width: 420, height: 68 },
  action: { y: 480, width: 460, height: 92 },
  /**
   * 아래 띠.
   *
   * 칸이 창보다 길면 **옆으로 흐른다**. 기하 마스크는 컨테이너 이동을 물려받지 않으므로
   * 화면이 팝업의 월드 행렬로 마스크를 다시 잡는다(가방 격자와 같은 방법).
   */
  strip: { y: 648, cardWidth: 188, cardHeight: 216, gap: 18, padX: 40 },
} as const;

export interface AppearanceRect { left: number; top: number; right: number; bottom: number }

/** 중심 좌표와 크기를 실제 충돌 검사에 쓰는 외곽으로 바꾼다. */
export function appearanceBounds(x: number, y: number, width: number, height: number): AppearanceRect {
  return { left: x - width / 2, top: y - height / 2, right: x + width / 2, bottom: y + height / 2 };
}

/** 변만 맞닿는 것은 허용하고, 실제 면적이 겹칠 때만 true다. */
export function appearanceBoundsOverlap(a: AppearanceRect, b: AppearanceRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/** 띠가 흐르는 창. 마스크와 입력 경계가 같은 값을 읽는다. */
export function appearanceStripViewport(): AppearanceRect {
  const { width, strip } = APPEARANCE_PANEL;
  return {
    left: -width / 2 + strip.padX,
    right: width / 2 - strip.padX,
    top: strip.y - strip.cardHeight / 2,
    bottom: strip.y + strip.cardHeight / 2,
  };
}

/**
 * 띠가 시작하는 x.
 *
 * **칸이 창을 못 채우면 가운데로 모인다.** 왼쪽에 붙여 두었을 때는 외형이 둘뿐인 개체에서
 * 띠가 판 왼쪽 구석에 쏠려, 오른쪽의 빈 자리가 "아직 안 그려진 칸"처럼 보였다.
 */
export function appearanceStripStartX(count: number): number {
  const view = appearanceStripViewport();
  const room = view.right - view.left;
  const content = appearanceStripContentWidth(count);
  return content < room ? view.left + (room - content) / 2 : view.left;
}

/** 스크롤 0일 때 그 칸의 중심 x. 화면은 여기에 컨테이너 이동만 더한다. */
export function appearanceStripCardX(index: number, count: number): number {
  const { strip } = APPEARANCE_PANEL;
  return appearanceStripStartX(count) + strip.cardWidth / 2 + index * (strip.cardWidth + strip.gap);
}

/** 그 수만큼의 칸이 늘어선 폭. 창보다 길면 그 안에서 흐른다. */
export function appearanceStripContentWidth(count: number): number {
  const { strip } = APPEARANCE_PANEL;
  if (count <= 0) return 0;
  return count * strip.cardWidth + (count - 1) * strip.gap;
}

/**
 * 띠가 왼쪽으로 흐를 수 있는 한계.
 *
 * 칸이 창을 못 채우면 흐르지 않는다(0) — 짧은 목록이 헐겁게 밀리면 끝까지 봤는지 알 수 없다.
 */
export function appearanceStripMinX(count: number): number {
  return Math.min(0, appearanceStripViewport().right - appearanceStripViewport().left - appearanceStripContentWidth(count));
}

/** 고른 칸이 창 안에 들어오도록 띠를 미는 양. 띠 밖의 칸을 고르면 그 칸이 따라 들어온다. */
export function appearanceStripOffsetFor(index: number, count: number, current: number): number {
  const view = appearanceStripViewport();
  const { strip } = APPEARANCE_PANEL;
  const left = appearanceStripCardX(index, count) - strip.cardWidth / 2;
  const right = left + strip.cardWidth;
  const min = appearanceStripMinX(count);
  if (left + current < view.left) return Math.min(0, view.left - left);
  if (right + current > view.right) return Math.max(min, view.right - right);
  return Math.max(min, Math.min(0, current));
}

/** 테스트와 프리팹이 같은 배치표로 무대·글줄·조작·띠의 안전 영역을 계산한다. */
export function appearancePanelRegions() {
  const layout = APPEARANCE_PANEL;
  return {
    hero: appearanceBounds(0, layout.hero.groundY - layout.hero.height / 2, 360, layout.hero.height),
    stand: appearanceBounds(0, layout.stand.y, layout.stand.width, layout.stand.height),
    name: appearanceBounds(0, layout.name.y, layout.width - 120, layout.name.size * 1.4),
    state: appearanceBounds(0, layout.state.y, layout.width - 120, layout.state.size * 1.4),
    price: appearanceBounds(0, layout.price.y, layout.price.width, layout.price.height),
    action: appearanceBounds(0, layout.action.y, layout.action.width, layout.action.height),
    strip: appearanceStripViewport(),
  };
}
