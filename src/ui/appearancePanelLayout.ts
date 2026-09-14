/**
 * 외형 **전시관**의 자리표. Phaser에 의존하지 않아 화면과 회귀 테스트가 같은 값을 읽는다.
 *
 * **한 장을 크게 세우던 무대가 아니다.** 전신 하나를 받침 위에 세워 두었을 때는 그 외형이
 * 무엇인지는 알 수 있어도 **얼굴이 작았고**, 받침 타원이 화면에서 유일하게 둥근 것이라 홀로그램
 * 결에서도 혼자 떠 있었다. 지금 무대는 **웹툰 칸처럼 셋으로 갈린다** — 큰 칸에 전신, 중간 칸에
 * 얼굴, 오른쪽 아래 작은 칸에 SD다. 한 외형을 세 각도에서 한 번에 보여 주므로 칸을 넘겨 가며
 * 확인할 것이 없다.
 *
 * 아래 띠와 글줄도 같은 페이지 위에 앉는다 — 칸만 웹툰이고 나머지가 빈 판이면 위아래가 서로
 * 다른 화면으로 읽힌다.
 */
export const APPEARANCE_PANEL = {
  /** 예전(940×1520)보다 한 뼘 작다. 판이 화면을 거의 다 덮으면 뒤 정보창이 사라진 것처럼 보인다. */
  width: 880,
  height: 1300,
  /** 페이지(무대+글줄+띠)가 판 안쪽에서 남기는 여백. */
  pad: 30,
  /** 칸과 칸 사이. 웹툰의 홈통이라 얇다 — 넓히면 세 칸이 서로 다른 판으로 갈린다. */
  gutter: 14,
  /**
   * 무대 — 세 칸이 들어가는 영역.
   *
   * **아래 조작을 밑동으로 내린 만큼 무대가 길어진다.** 이 창에서 정작 보려는 것은 그 외형이라,
   * 남는 세로는 글줄이 아니라 칸이 갖는다 — 640에서 720으로 늘려 큰 칸이 전신을 발끝까지
   * 온전히 품는다.
   */
  stage: { top: -620, height: 720 },
  /** 왼쪽 큰 칸(전신)이 무대 폭에서 갖는 비율. */
  heroRatio: 0.635,
  /** 오른쪽 위 칸(얼굴)이 무대 높이에서 갖는 비율. */
  faceRatio: 0.594,
  /**
   * 글줄은 **보유 여부 → 이름** 순이다.
   *
   * 이름 아래에 상태를 두었을 때는 큰 글자가 먼저 눈을 잡고 그 아래 작은 글자를 다시 찾아
   * 읽어야 했다 — 지금 이 칸이 내 것인지가 이름보다 먼저 정해지는 판단이라 위에 선다.
   */
  state: { y: 138, size: 26 },
  name: { y: 196, size: 40 },
  /** 값 줄. `purchasable`인 외형에만 서고 그 밖에는 자리를 비운다. */
  price: { y: 268, width: 420, height: 62 },
  /**
   * 아래 띠.
   *
   * 칸이 창보다 길면 **옆으로 흐른다**. 기하 마스크는 컨테이너 이동을 물려받지 않으므로
   * 화면이 팝업의 월드 행렬로 마스크를 다시 잡는다(가방 격자와 같은 방법).
   */
  strip: { y: 414, cardWidth: 168, cardHeight: 200, gap: 16, padX: 34 },
  /** 장착·구매. **판의 맨 밑동**이라 어느 외형을 고르든 손이 가는 자리가 움직이지 않는다. */
  action: { y: 572, width: 440, height: 84 },
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

/** 세 칸이 나눠 쓰는 무대 전체. */
export function appearanceStageRect(): AppearanceRect {
  const { width, pad, stage } = APPEARANCE_PANEL;
  return { left: -width / 2 + pad, right: width / 2 - pad, top: stage.top, bottom: stage.top + stage.height };
}

/**
 * 웹툰 칸 셋.
 *
 * `hero`는 왼쪽을 통째로 쓰는 큰 칸(전신), `face`는 오른쪽 위(얼굴), `sd`는 오른쪽 아래의 가장
 * 작은 칸이다. 크기가 곧 위계라 셋을 같게 두지 않는다 — 같으면 어느 것을 먼저 봐야 하는지
 * 알 수 없다.
 */
export function appearanceFrames(): { hero: AppearanceRect; face: AppearanceRect; sd: AppearanceRect } {
  const stage = appearanceStageRect();
  const { gutter, heroRatio, faceRatio } = APPEARANCE_PANEL;
  const stageWidth = stage.right - stage.left;
  const stageHeight = stage.bottom - stage.top;
  const heroWidth = Math.round((stageWidth - gutter) * heroRatio);
  const columnLeft = stage.left + heroWidth + gutter;
  const faceHeight = Math.round((stageHeight - gutter) * faceRatio);
  return {
    hero: { left: stage.left, right: stage.left + heroWidth, top: stage.top, bottom: stage.bottom },
    face: { left: columnLeft, right: stage.right, top: stage.top, bottom: stage.top + faceHeight },
    sd: { left: columnLeft, right: stage.right, top: stage.top + faceHeight + gutter, bottom: stage.bottom },
  };
}

/** 칸 하나의 가운데와 크기. 그리는 쪽은 외곽이 아니라 이 꼴을 쓴다. */
export function appearanceFrameSpot(rect: AppearanceRect): { x: number; y: number; width: number; height: number } {
  return { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2, width: rect.right - rect.left, height: rect.bottom - rect.top };
}

/**
 * 아래 조작이 앉는 밑동 판.
 *
 * **띠 칸의 허리에서 시작한다**(`strip.y` = 칸 높이의 절반). 무대 바로 밑에서 시작해 글줄까지
 * 다 품던 때는 창의 아래 절반이 통째로 한 장의 어두운 판이 되어, 이름·보유 여부가 배경 원화가
 * 아니라 그 판 위에 적힌 목록처럼 읽혔다. 판이 칸의 허리를 지나가면 아이콘 줄은 반쯤 판 위에
 * 올라선 것으로 보이고, 그 위의 글줄은 창 자체 위에 선다 — 그래서 이름과 보유 여부는 판이
 * 아니라 **제 그림자와 테두리**로 배경에서 떨어져 나온다.
 */
export function appearancePageRect(): AppearanceRect {
  const { width, height, pad, strip } = APPEARANCE_PANEL;
  return { left: -width / 2 + pad, right: width / 2 - pad, top: strip.y, bottom: height / 2 - pad };
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
  const frames = appearanceFrames();
  return {
    hero: frames.hero,
    face: frames.face,
    sd: frames.sd,
    name: appearanceBounds(0, layout.name.y, layout.width - 120, layout.name.size * 1.4),
    state: appearanceBounds(0, layout.state.y, layout.width - 120, layout.state.size * 1.4),
    price: appearanceBounds(0, layout.price.y, layout.price.width, layout.price.height),
    action: appearanceBounds(0, layout.action.y, layout.action.width, layout.action.height),
    strip: appearanceStripViewport(),
    page: appearancePageRect(),
  };
}
