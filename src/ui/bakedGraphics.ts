import Phaser from "phaser";

/**
 * 움직이지 않는 도형을 **한 번 구워 이미지 한 장으로** 세운다.
 *
 * Phaser의 Graphics는 그린 결과가 아니라 명령 목록을 들고 있어, 화면을 그릴 때마다 그 목록을 처음부터 다시
 * 실행한다(원·다각형을 매번 삼각형으로 쪼갠다). 판·선 몇 개면 티가 나지 않지만 점 수백 개짜리 무늬는 혼자
 * 한 프레임을 먹는다 — 로비가 가만히 서 있어도 출격 버튼 하나가 그리기 시간의 80%였다(v0.514.0 실측).
 *
 * `draw`는 국소 좌표(`bounds` 기준)로 그리고, 결과 이미지도 같은 국소 좌표에 선다. 같은 `key`는 한 번만 굽고
 * 그 뒤로는 텍스처를 함께 쓴다 — 키는 모양·색·옵션에서 나와야 한다(`bakeKey`).
 */
export interface BakeBounds { left: number; top: number; right: number; bottom: number }

/** 가장자리 원·획이 잘리지 않을 여유. */
const BAKE_PAD = 4;

export function bakedGraphicsImage(
  scene: Phaser.Scene,
  key: string,
  bounds: BakeBounds,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): Phaser.GameObjects.Image {
  const left = Math.floor(bounds.left) - BAKE_PAD;
  const top = Math.floor(bounds.top) - BAKE_PAD;
  const width = Math.max(1, Math.ceil(bounds.right) + BAKE_PAD - left);
  const height = Math.max(1, Math.ceil(bounds.bottom) + BAKE_PAD - top);
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.translateCanvas(-left, -top);
    draw(g);
    g.generateTexture(key, width, height);
    g.destroy();
  }
  return scene.add.image(left, top, key).setOrigin(0, 0);
}

/** 모양·색·옵션을 짧은 텍스처 키로 접는다. 같은 입력은 늘 같은 키다(FNV-1a). */
export function bakeKey(prefix: string, parts: readonly (number | string)[]): string {
  let hash = 0x811c9dc5;
  const text = parts.map((part) => (typeof part === "number" ? part.toFixed(2) : part)).join("|");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${prefix}:${hash.toString(36)}:${text.length}`;
}
