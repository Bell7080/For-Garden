import Phaser from "phaser";
import { addPopupBackgroundImage } from "./backgrounds";
import { drawFrameVignette } from "./holo";
import { popupArtShape, popupBodyShapeMask } from "./popupArt";
import type { StageCompleteTheme } from "./stageCompleteTheme";

/**
 * 결과판 테마의 뒷배경 — 그 콘텐츠의 원화를 몸판 실루엣대로 잘라 옅게 깔고 가장자리를 누른다.
 * 원화는 분위기만 남기고(SD·보상이 먼저 읽혀야 한다) 진하기는 테마 표가 정한다.
 */
export function addStageCompleteBackdrop(
  scene: Phaser.Scene,
  body: Phaser.GameObjects.Container,
  theme: StageCompleteTheme,
  width: number,
  height: number,
): void {
  if (!theme.backdropKey) return;
  const shape = popupArtShape(width, height);
  addPopupBackgroundImage(scene, body, theme.backdropKey, { x: 0, y: 0, width, height, maskShape: shape, imageAlpha: theme.backdropAlpha ?? 0.3, overlayStrength: theme.backdropOverlay ?? 0.7 });
  body.add(drawFrameVignette(scene, 0, 0, width, height, { strength: 0.55, spread: 0.2 }).setMask(popupBodyShapeMask(scene, body, shape)));
}
