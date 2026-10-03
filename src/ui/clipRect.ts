export interface ClipRect { left: number; right: number; top: number; bottom: number }

/** 점이 창 안에 드는가. 경계는 포함한다. Phaser 없는 순수 규칙이라 테스트가 그대로 읽는다. */
export function pointInClip(clip: ClipRect, x: number, y: number): boolean {
  return x >= clip.left && x <= clip.right && y >= clip.top && y <= clip.bottom;
}
