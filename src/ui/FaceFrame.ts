import Phaser from "phaser";
import type { PortraitAssetId } from "../core/types";
import { headCardFrame, loadPortraitTexture, portraitAssetFor } from "../puppets/assets";
import { chipPoints, drawInnerVignette, drawLayer, drawShapeOutline } from "./holo";
import { COLOR } from "./theme";

/**
 * 캐릭터 얼굴 액자.
 *
 * 스킬 아이콘·룬 조각·보상 액자(`RewardFrame`)와 같은 "액자" 예외 — 불투명 사각 + 사방
 * 테두리 + 안쪽 비네팅 — 를 얼굴에도 적용한다. 카드(`PortraitCard`)처럼 머리가 밖으로
 * 빠져나오는 홈을 두지 않고, 사각 안에 얼굴을 그대로 꽉 채운다. 기여도 그래프처럼 이름이
 * 여럿 늘어서는 목록에서 이름만으로는 누구인지 한눈에 읽히지 않는 자리에 쓴다.
 */
export class FaceFrame extends Phaser.GameObjects.Container {
  private disposed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, options: { portraitAssetId: PortraitAssetId; tint?: number; size?: number }) {
    super(scene, x, y);
    scene.add.existing(this);
    const size = options.size ?? 96;
    const shape = chipPoints(size, size, { bevel: { topLeft: size * 0.2, topRight: 0, bottomRight: size * 0.2, bottomLeft: 0 } });
    this.add(drawLayer(scene, 0, 0, shape, { fill: 0x101722, alpha: 0.98 }));
    void this.loadFace(scene, options, size);
    this.add(drawInnerVignette(scene, 0, 0, shape, { strength: 0.6 }));
    this.add(drawShapeOutline(scene, 0, 0, shape, { color: COLOR.accent, alpha: 0.78, width: 2 }));
    this.once(Phaser.GameObjects.Events.DESTROY, () => { this.disposed = true; });
  }

  private async loadFace(scene: Phaser.Scene, options: { portraitAssetId: PortraitAssetId; tint?: number }, size: number): Promise<void> {
    const asset = portraitAssetFor(options.portraitAssetId);
    const { key, anchors } = await loadPortraitTexture(scene, asset);
    if (this.disposed) return;
    // 카드와 달리 머리 위 여백(overhang)을 추가로 잡지 않는다 — 사각을 그대로 채우는
    // 액자라 얼굴이 칸 가운데 근처에 오도록 headroom을 카드보다 크게 준다.
    const card = headCardFrame(asset, anchors, {
      width: size,
      height: size,
      fillRatio: 0.95 / ((asset.cardZoom ?? 1) * (asset.portraitZoom ?? 1)),
      headroom: 0.4,
    });
    const originX = -size / 2 - card.cropX * card.scale;
    const originY = -size / 2 - card.cropY * card.scale + Math.max(0, asset.portraitOffsetY ?? 0);
    const image = scene.add.image(originX, originY, key).setOrigin(0, 0).setScale(card.scale);
    image.setCrop(card.cropX, card.cropY, card.cropWidth, card.cropHeight);
    if (options.tint) image.setTint(options.tint);
    this.addAt(image, 1);
  }
}
