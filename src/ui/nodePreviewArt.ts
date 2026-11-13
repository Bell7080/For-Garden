import Phaser from "phaser";
import { useBackgroundTexture } from "./backgrounds";
import { drawFrameVignette, drawShapeEdge } from "./holo";
import { shapeClipMask } from "./popupArt";
import { COLOR } from "./theme";
import { NODE_PREVIEW_ART } from "./nodeEnemyPreviewLayout";

/**
 * 노드 미리보기 판의 **결과판 결** — 그 관문이 싸우는 전장 원화를 판 실루엣대로 옅게 깔고 가장자리를 누른다.
 *
 * 결과판(`StageCompletePopup` + `addStageCompleteBackdrop`)이 같은 원화를 판 안에 비치게 깔아 "어디서 싸웠나"를
 * 말하므로, 들어가기 전의 미리보기도 같은 결이어야 두 판이 한 짝으로 읽힌다. 다만 미리보기는 지도 위에 얹히는
 * 쪽지라 판 바탕이 반투명하다(`NODE_PREVIEW_GLASS_ALPHA`) — 원화도 그만큼 옅게 두어 뒤의 노드가 함께 비친다.
 *
 * 판은 지도를 따라 움직이므로 마스크는 매 프레임 다시 그리는 `shapeClipMask`를 쓰고, 그 주인은 이 함수가 세우는
 * 묶음 하나다 — 판이 다시 그려질 때(`removeAll(true)`) 묶음이 죽으며 마스크·원화 붙잡기가 함께 풀린다.
 */
export function addNodePreviewArt(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  key: string | undefined,
  width: number,
  height: number,
  shape: number[],
): void {
  const art = scene.add.container(0, 0);
  parent.add(art);
  const mask = shapeClipMask(scene, art, shape);
  if (key) {
    const ready = scene.textures.exists(key);
    const image = scene.add.image(0, 0, ready ? key : "__DEFAULT").setAlpha(0);
    const fit = (target: Phaser.GameObjects.Image): void => {
      target.setScale(Math.max(width / target.width, height / target.height)).setAlpha(NODE_PREVIEW_ART.imageAlpha);
    };
    useBackgroundTexture(scene, image, key, fit);
    image.setMask(mask);
    art.add(image);
  }
  art.add(drawFrameVignette(scene, 0, 0, width, height, { strength: NODE_PREVIEW_ART.vignette, spread: 0.2 }).setMask(mask));
  // 결과판 몸판과 같은 밑변 안쪽 강조선 — 판의 끝을 한 번 더 쥔다.
  art.add(drawShapeEdge(scene, 0, 0, shape, "bottom", { color: COLOR.accent, alpha: 0.3, inset: 12 }));
}
