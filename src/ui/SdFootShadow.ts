import Phaser from "phaser";
import { SD_FOOT_SHADOW } from "./sdFootShadowStyle";

/**
 * SD 발밑 그림자 한 장(`SD_FOOT_SHADOW`). 가운데가 발 자리이고 `width`가 가장 바깥 타원의 폭이다.
 *
 * 컨테이너 하나로 돌려주므로 전장처럼 매 프레임 따라가는 자리는 `setPosition`·`setScale`·`setAlpha`만
 * 부르면 된다. `parent`를 주면 그 안에, 없으면 씬에 곧장 세운다.
 */
export function addSdFootShadow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  parent?: Phaser.GameObjects.Container,
): Phaser.GameObjects.Container {
  const shadow = scene.add.container(x, y);
  for (const layer of SD_FOOT_SHADOW.layers) {
    const w = width * layer.scale;
    shadow.add(scene.add.ellipse(0, 0, w, w * SD_FOOT_SHADOW.heightRatio, SD_FOOT_SHADOW.color, layer.alpha));
  }
  parent?.add(shadow);
  return shadow;
}
