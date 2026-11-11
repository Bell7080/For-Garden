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
  hint: { y: -668, size: 23 },
  stage: { top: -630, height: 770 },
  /** 무대 양옆의 넘김 꺾쇠. */
  arrow: { inset: 54, width: 64, height: 110 },
  /** 무대 위 왼쪽의 등급·속성·직군, 오른쪽의 정보 칩. */
  badge: { inset: 60, top: 64, element: 58, role: 46 },
  info: { size: 78 },
  name: { y: 198, size: 46 },
  state: { y: 252, size: 26 },
  strip: { y: 398, card: 148, gap: 20, padX: 40, dragSlop: 16 },
  holdHint: { y: 506, size: 21 },
  action: { y: 606, width: 460, height: 90 },
  /** 무대를 이만큼 밀면 옆 렐릭으로 넘어간다. */
  swipe: 70,
} as const;

export interface RelicSelectRect { left: number; top: number; right: number; bottom: number }

export function relicSelectStageRect(): RelicSelectRect {
  const { width, pad, stage } = RELIC_SELECT;
  return { left: -width / 2 + pad, right: width / 2 - pad, top: stage.top, bottom: stage.top + stage.height };
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
