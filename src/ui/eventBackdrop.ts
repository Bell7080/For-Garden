import type Phaser from "phaser";
import { addPopupBackgroundImage } from "./backgrounds";
import { popupArtShape } from "./popupArt";

/** 중앙 여백을 밝게 유지하고 장식은 가장자리에 남긴다. */
export function addEventPopupBackdrop(scene: Phaser.Scene, body: Phaser.GameObjects.Container, texture: string, width: number, height: number): void {
  const backdrop = addPopupBackgroundImage(scene, body, texture, {
    x: 0, y: 0, width, height, maskShape: popupArtShape(width, height), overlayStrength: 0,
  });
  body.once("destroy", backdrop.destroy);
}
