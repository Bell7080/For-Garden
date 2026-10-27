/**
 * 스크롤 목록의 「더 있다」 표식을 켤지 가르는 순수 규칙.
 *
 * 오프셋은 0(맨 앞)에서 시작해 `min`(≤ 0, 맨 끝)까지 내려간다 — 세로는 위로 밀려 오르는 쪽이 음수, 가로는 왼쪽으로 밀리는 쪽이 음수다.
 * 화면이 각자 비교식을 적으면 한계 근처에서 표식이 켜졌다 꺼졌다 하는 기준이 갈리므로 여기 한 곳에서 정한다.
 */
export interface ScrollHintRange { offset: number; min: number; }

export interface ScrollHintSides { before: boolean; after: boolean; }

/** 끝에 이만큼 가까우면 닿은 것으로 본다(게임 좌표). */
export const SCROLL_HINT_EDGE_SLACK = 12;

export function scrollHintSides(range: ScrollHintRange): ScrollHintSides {
  if (!Number.isFinite(range.offset) || !Number.isFinite(range.min) || range.min >= -SCROLL_HINT_EDGE_SLACK) return { before: false, after: false };
  return { before: range.offset < -SCROLL_HINT_EDGE_SLACK, after: range.offset > range.min + SCROLL_HINT_EDGE_SLACK };
}
