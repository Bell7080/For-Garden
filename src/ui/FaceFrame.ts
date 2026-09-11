import Phaser from "phaser";
import type { PortraitAssetId } from "../core/types";
import { headCardFrame, loadPortraitTexture, portraitAssetFor } from "../puppets/assets";
import { chipPoints, drawInnerVignette, drawLayer, drawShapeOutline } from "./holo";
import { ITEM_FRAME } from "./itemFrame";
import { COLOR, textStyle } from "./theme";

/**
 * 캐릭터 얼굴 액자.
 *
 * **재화·아이템 액자(`addFramedIcon`)와 같은 한 장이다** — 같은 깎임·같은 사방 외곽선·같은
 * 안쪽 비네트·같은 우하단 수량 자리를 `ITEM_FRAME` 한 표에서 읽는다. 담기는 그림이 재화가
 * 아니라 얼굴일 뿐이라, 연구 결과판에서 중복 파편과 재화가 나란히 서도 두 종류의 액자로
 * 보이지 않는다.
 *
 * 카드(`PortraitCard`)처럼 머리가 밖으로 빠져나오는 홈을 두지 않고 사각 안에 얼굴을 그대로
 * 꽉 채운다. 기여도 그래프처럼 이름만으로는 누구인지 한눈에 읽히지 않는 자리에 쓴다.
 */
export class FaceFrame extends Phaser.GameObjects.Container {
  private disposed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, options: {
    portraitAssetId: PortraitAssetId;
    tint?: number;
    size?: number;
    /** 사방 외곽선 색. 비우면 강조색이다. 등급을 알리는 자리만 넘긴다. */
    color?: number;
    /** 액자 우하단에 겹칠 수. 비우면 수를 적지 않는다. */
    amount?: string;
  }) {
    super(scene, x, y);
    scene.add.existing(this);
    const size = options.size ?? 96;
    const shape = chipPoints(size, size, {
      bevel: { topLeft: size * ITEM_FRAME.bevel, topRight: 0, bottomRight: size * ITEM_FRAME.bevel, bottomLeft: 0 },
    });
    this.add(drawLayer(scene, 0, 0, shape, { fill: ITEM_FRAME.fill, alpha: ITEM_FRAME.fillAlpha }));
    void this.loadFace(scene, options, size);
    this.add(drawInnerVignette(scene, 0, 0, shape, { strength: ITEM_FRAME.vignette }));
    this.add(drawShapeOutline(scene, 0, 0, shape, {
      color: options.color ?? COLOR.accent,
      alpha: ITEM_FRAME.outlineAlpha,
      width: ITEM_FRAME.outlineWidth,
    }));
    if (options.amount !== undefined) {
      // 자리·획·크기 모두 재화 액자와 같다. 여기서 옮기면 같은 수가 화면마다 다른 자리에 선다.
      this.add(scene.add
        .text(size / 2 - 8, size / 2 - 6, options.amount, textStyle({ role: "display", size: Math.max(18, Math.round(size * ITEM_FRAME.amountRatio)), color: COLOR.accentText }))
        .setOrigin(1, 1)
        .setStroke("#000000", 6)
        .setShadow(2, 3, "#000000", 2, false, true));
    }
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
