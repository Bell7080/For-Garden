import Phaser from "phaser";
import { toPoints } from "./holo";
import { bakedCenteredImage, bakeKey } from "./bakedGraphics";
import { itemFrameShape } from "./itemFrame";
import { COLOR } from "./theme";

/**
 * 받을 수 있는 보상 액자 뒤에서 숨 쉬는 호박빛 — 임무·업적·도감·성장 가이드·패스가 같은 한 장을 쓴다.
 *
 * 여섯 화면이 저마다 Graphics로 같은 도형을 그리고 있었는데, Graphics는 매 프레임 그 명령을 다시 풀고
 * 받을 것이 많은 목록에서는 그 수만큼 다시 그렸다. 흰 실루엣을 **크기마다 한 번** 굽고 색은 tint로 입힌다.
 * 모양은 액자를 그린 그 함수(`itemFrameShape`)를 `grow`만큼 넓혀 받는다 — 깎인 두 모서리가 액자 선과 어긋나지 않는다.
 */
export interface ClaimHaloOptions {
  /** 액자 한 변. */
  size: number;
  /** 액자 바깥으로 번지는 몫(양쪽 합). */
  spread?: number;
  /** 가장 밝을 때의 진하기. */
  alpha?: number;
  /** 숨 쉴 때 가장 옅어지는 비율(가장 밝을 때 대비). */
  from?: number;
  duration?: number;
  x?: number;
  y?: number;
}

export function addClaimHalo(scene: Phaser.Scene, options: ClaimHaloOptions): { image: Phaser.GameObjects.Image; tween: Phaser.Tweens.Tween } {
  const spread = options.spread ?? 24;
  const peak = options.alpha ?? 0.4;
  const shape = itemFrameShape(options.size, spread / 2);
  const half = options.size / 2 + spread / 2 + 2;
  const key = bakeKey("claim-halo", [options.size, spread]);
  const image = bakedCenteredImage(scene, key, half, (g) => {
    g.fillStyle(0xffffff, 1).fillPoints(toPoints(shape), true);
  });
  image.setPosition(options.x ?? 0, options.y ?? 0).setTint(COLOR.missionClaim).setBlendMode(Phaser.BlendModes.ADD).setAlpha(peak * (options.from ?? 0.3));
  const tween = scene.tweens.add({ targets: image, alpha: { from: peak * (options.from ?? 0.3), to: peak }, duration: options.duration ?? 700, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  // 액자가 다시 그려질 때 이미지만 부서지고 트윈이 남지 않게 함께 걷는다.
  image.once(Phaser.GameObjects.Events.DESTROY, () => tween.remove());
  return { image, tween };
}
