import { BASE_WIDTH } from "../config/gameConfig";

/**
 * 튜토리얼 「건너뛰기」 칩의 자리. Phaser 없이 계산해 테스트가 같은 값을 읽는다.
 *
 * **상단 재화 줄(y 40~136) 안에 세우지 않는다.** 예전에는 오른쪽 위 y 64에 맨 글자로 서서 스테미나 칸과 설정
 * 아이콘 위에 겹쳤다 — 같은 무게의 글자가 한 자리에 포개져 무엇이 무엇인지 읽히지 않았고, 누르는 자리도
 * 설정 아이콘과 갈리지 않았다. 지금은 줄 아래 빈 띠에 제 판을 가진 칩으로 서고, 가리키는 구멍이 그 자리를
 * 덮으면 반대편(왼쪽)으로 비켜 선다 — 칩이 눌러야 할 자리를 가리면 안 된다.
 */
export const TUTORIAL_SKIP_CHIP = {
  /** 상단 줄 경계선(y 136) 아래로 띄우는 칩 윗변. */
  top: 160,
  height: 64,
  minWidth: 176,
  paddingX: 30,
  /** 화면 가장자리에서 칩까지. */
  margin: 32,
  fontSize: 30,
} as const;

export interface SkipChipSpot { x: number; y: number; width: number; height: number; side: "right" | "left" }

type Rect = { x: number; y: number; width: number; height: number };

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * `labelWidth`는 글자 폭, `avoid`는 칩이 덮으면 안 되는 자리(밝게 남긴 구멍, 안내 글)다. 반환값의 x·y는 칩 가운데다.
 * 양쪽이 다 막히면 오른쪽에 선다 — 구멍을 피하는 것이 먼저라 구멍을 덮지 않는 쪽이 있으면 그쪽을 고른다.
 */
export function tutorialSkipSpot(labelWidth: number, avoid: readonly Rect[]): SkipChipSpot {
  const { top, height, minWidth, paddingX, margin } = TUTORIAL_SKIP_CHIP;
  const width = Math.max(minWidth, Math.ceil(labelWidth + paddingX * 2));
  const y = top + height / 2;
  const at = (side: "right" | "left"): SkipChipSpot => ({
    x: side === "right" ? BASE_WIDTH - margin - width / 2 : margin + width / 2, y, width, height, side,
  });
  const box = (spot: SkipChipSpot): Rect => ({ x: spot.x - width / 2, y: spot.y - height / 2, width, height });
  const clear = (spot: SkipChipSpot, rects: readonly Rect[]): boolean => rects.every((rect) => !overlaps(box(spot), rect));
  const right = at("right");
  const left = at("left");
  if (clear(right, avoid)) return right;
  if (clear(left, avoid)) return left;
  const hole = avoid.slice(0, 1);
  return clear(right, hole) ? right : clear(left, hole) ? left : right;
}
