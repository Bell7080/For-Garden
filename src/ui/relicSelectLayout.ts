/**
 * 렐릭 선택권 고르기 창의 순수 배치표 — **외형 전시관과 같은 문법**이다(`appearancePanelLayout.ts`).
 *
 * 위 무대에 고른 렐릭 하나가 전신으로 크게 서고, 아래 얼굴 띠를 옆으로 넘기며 고른다. 얼굴만 격자로
 * 늘어놓던 때는 누구를 고르는지가 액자 크기의 얼굴 한 장으로만 읽혀, 무엇을 하는 개체인지 알 수 없었다.
 * 좌표는 팝업 몸판 가운데가 (0, 0)인 국소 좌표다.
 */
export const RELIC_SELECT = {
  width: 880,
  height: 1500,
  pad: 30,
  hint: { y: -686, size: 23 },
  /**
   * 무대 — 외형 전시관처럼 **웹툰 칸 셋**(큰 칸 전신 · 오른쪽 위 얼굴 · 오른쪽 아래 SD)이 나눠 쓴다.
   * 아래 글줄·띠·버튼을 촘촘히 모은 만큼 무대가 길어진다 — 이 창에서 보려는 것은 그 렐릭이다.
   */
  stage: { top: -652, height: 950 },
  gutter: 14,
  /** 왼쪽 큰 칸(전신)이 무대 폭에서 갖는 비율 — 외형 전시관과 같다. */
  heroRatio: 0.635,
  /** 오른쪽 위 칸(얼굴)이 무대 높이에서 갖는 비율. */
  faceRatio: 0.58,
  /** 큰 칸 위 왼쪽의 등급·속성·직군, 오른쪽의 정보 칩. */
  badge: { inset: 56, top: 60, element: 54, role: 44 },
  info: { size: 72 },
  name: { y: 340, size: 42 },
  state: { y: 386, size: 24 },
  /** 띠 — 양옆에 넘김 꺾쇠(`arrow`)가 서므로 창은 그만큼 안쪽에서 끝난다. */
  strip: { y: 496, card: 136, gap: 18, padX: 92, dragSlop: 16 },
  arrow: { inset: 48, width: 48, height: 112 },
  holdHint: { y: 588, size: 20 },
  action: { y: 664, width: 460, height: 84 },
  /** 무대를 이만큼 밀면 옆 렐릭으로 넘어간다. */
  swipe: 70,
} as const;

export interface RelicSelectRect { left: number; top: number; right: number; bottom: number }

export function relicSelectStageRect(): RelicSelectRect {
  const { width, pad, stage } = RELIC_SELECT;
  return { left: -width / 2 + pad, right: width / 2 - pad, top: stage.top, bottom: stage.top + stage.height };
}

/** 웹툰 칸 셋 — `hero`는 왼쪽 큰 칸(전신), `face`는 오른쪽 위(얼굴), `sd`는 오른쪽 아래(SD)다. */
export function relicSelectFrames(): { hero: RelicSelectRect; face: RelicSelectRect; sd: RelicSelectRect } {
  const stage = relicSelectStageRect();
  const { gutter, heroRatio, faceRatio } = RELIC_SELECT;
  const heroWidth = Math.round((stage.right - stage.left - gutter) * heroRatio);
  const columnLeft = stage.left + heroWidth + gutter;
  const faceHeight = Math.round((stage.bottom - stage.top - gutter) * faceRatio);
  return {
    hero: { left: stage.left, right: stage.left + heroWidth, top: stage.top, bottom: stage.bottom },
    face: { left: columnLeft, right: stage.right, top: stage.top, bottom: stage.top + faceHeight },
    sd: { left: columnLeft, right: stage.right, top: stage.top + faceHeight + gutter, bottom: stage.bottom },
  };
}

/** 띠 양옆 꺾쇠의 가운데 x(왼쪽은 음수). */
export function relicSelectArrowX(side: -1 | 1): number {
  return side * (RELIC_SELECT.width / 2 - RELIC_SELECT.arrow.inset);
}

export function relicSelectStripViewport(): RelicSelectRect {
  const { width, strip } = RELIC_SELECT;
  // 고른 칸은 한 뼘 커지므로 위아래로 그만큼 품는다 — 아니면 커진 칸의 위아래가 잘린다.
  const room = strip.card * 0.06;
  return { left: -width / 2 + strip.padX, right: width / 2 - strip.padX, top: strip.y - strip.card / 2 - room, bottom: strip.y + strip.card / 2 + room };
}

export function relicSelectContains(rect: RelicSelectRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function contentWidth(count: number): number {
  const { strip } = RELIC_SELECT;
  return count <= 0 ? 0 : count * strip.card + (count - 1) * strip.gap;
}

/** 띠가 창을 못 채우면 가운데로 모인다 — 왼쪽에 붙이면 오른쪽 빈 자리가 덜 그려진 칸으로 보인다. */
export function relicSelectCardX(index: number, count: number): number {
  const view = relicSelectStripViewport();
  const room = view.right - view.left;
  const content = contentWidth(count);
  const start = content < room ? view.left + (room - content) / 2 : view.left;
  const { strip } = RELIC_SELECT;
  return start + strip.card / 2 + index * (strip.card + strip.gap);
}

export function relicSelectMinOffset(count: number): number {
  const view = relicSelectStripViewport();
  return Math.min(0, view.right - view.left - contentWidth(count));
}

/** 고른 칸이 창 밖이면 그 칸이 창 안으로 들어오는 만큼만 띠를 민다. */
export function relicSelectOffsetFor(index: number, count: number, current: number): number {
  const view = relicSelectStripViewport();
  const { strip } = RELIC_SELECT;
  const left = relicSelectCardX(index, count) - strip.card / 2;
  const right = left + strip.card;
  const min = relicSelectMinOffset(count);
  if (left + current < view.left) return Math.min(0, view.left - left);
  if (right + current > view.right) return Math.max(min, view.right - right);
  return Math.max(min, Math.min(0, current));
}

/** 꺾쇠·밀기의 다음 칸. 끝에서 반대쪽 끝으로 돈다 — 열 명 남짓을 오가는 데 끝에서 막히면 되돌아가야 한다. */
export function relicSelectStep(index: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return ((index + delta) % count + count) % count;
}

/** 무대를 민 거리에서 넘김 방향. 왼쪽으로 밀면 다음 렐릭이다. */
export function relicSelectSwipeDelta(dx: number): -1 | 0 | 1 {
  if (Math.abs(dx) < RELIC_SELECT.swipe) return 0;
  return dx < 0 ? 1 : -1;
}
