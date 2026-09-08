import Phaser from "phaser";
import type { RelicDef } from "../core/types";
import type { RelicSkinDef } from "../data/relicSkins";
import { portraitAssetForSkin, sdAssetForSkin, spawnPuppet } from "../puppets/assets";
import { APPEARANCE_PANEL_LAYOUT } from "./appearancePanelLayout";
import { chipPoints, drawLayer, drawShapeEdge, toPoints, HOLO } from "./holo";
import { portraitCardHeadWindow } from "./portraitGrid";
import { COLOR, textStyle } from "./theme";

export interface AppearanceCardOptions {
  def: RelicDef;
  skin?: RelicSkinDef;
  name: string;
  owned: boolean;
  onChoose: () => void;
}

/**
 * 전신과 같은 외형의 SD를 한 장에 조립하는 재사용 프리팹이다.
 * 전신은 한 번만 렌더링하고, 카드 몸통과 머리 창을 합친 공용 마스크를 쓴다. 따라서 복제 Puppet의
 * idle 시간이 어긋나는 일 없이 몸통은 판 안에, 머리만 판 밖에 남는다.
 */
export class AppearanceCard extends Phaser.GameObjects.Container {
  private readonly idleLayer: Phaser.GameObjects.Graphics;
  private readonly selectedLayer: Phaser.GameObjects.Graphics;
  private readonly selectedEdge: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, options: AppearanceCardOptions) {
    const layout = APPEARANCE_PANEL_LAYOUT.card;
    super(scene, x, layout.y);
    scene.add.existing(this);

    // 왼쪽 변의 상단 약 절반을 `/`로 깊게 자른다. 양쪽을 대칭으로 깎으면 기존 팔각형 칩처럼
    // 보이므로 오른쪽 위는 직각으로 남겨 투영판이 한 방향에서 절삭된 인상을 보존한다.
    const bevel = { topLeft: layout.slashDepth, topRight: 0, bottomRight: 48, bottomLeft: 0 };
    const panelShape = chipPoints(layout.width, layout.height, { bevel });
    this.idleLayer = drawLayer(scene, 0, 0, panelShape, { fill: 0x0b0f15, alpha: HOLO.glass });
    this.selectedLayer = drawLayer(scene, 0, 0, panelShape, { fill: 0x121820, alpha: HOLO.glass });
    this.add([this.idleLayer, this.selectedLayer]);
    // 선택 강조는 기존 규칙대로 크기와 윗선만 쓴다. 깊은 `/` 절단선 자체도 같은 도형의 윗변이다.
    this.add(drawShapeEdge(scene, 0, 0, panelShape, "top", { color: COLOR.accent, alpha: 0.24 }));
    this.selectedEdge = drawShapeEdge(scene, 0, 0, panelShape, "top", { color: COLOR.accent, alpha: 0.95, width: 4 });
    this.add(this.selectedEdge);

    const head = portraitCardHeadWindow(layout.width, layout.slashDepth, 0, 0.68);
    const puppetShape = chipPoints(layout.width, layout.height, {
      bevel,
      openWidth: head.width,
      openOffsetX: head.offsetX,
      openTopWidth: head.topWidth,
      openTopOffsetX: head.topOffsetX,
      openHeight: layout.overhang,
    });
    // GeometryMask의 도형은 카드와 같은 컨테이너에 넣어 팝업 등장/선택 scale을 함께 물려받는다.
    const maskSource = scene.make.graphics({ x: 0, y: 0 });
    maskSource.fillStyle(0xffffff, 1).fillPoints(toPoints(puppetShape), true).setVisible(false);
    // 마스크 원본도 카드 자식이어야 PopupLayer의 이동·등장 scale과 선택 확대가 정확히 일치한다.
    this.add(maskSource);
    const fullBodyMask = maskSource.createGeometryMask();
    const fullAsset = portraitAssetForSkin(options.def.portraitAssetId, options.skin?.id);
    void spawnPuppet(scene, fullAsset, { ...layout.fullBody, depth: 1 }).then((puppet) => {
      if (!this.active) { puppet.destroy(); return; }
      puppet.setAlpha(options.owned ? 1 : 0.28).setMask(fullBodyMask);
      this.addAt(puppet, 2);
    });

    // SD는 반드시 같은 skin id를 resolver에 전달한다. 우하단은 전신의 다리보다 앞, 문구보다
    // 위에 그려 작은 인게임 실루엣을 비교하되 이름/상태의 하단 안전띠는 침범하지 않는다.
    const sdAsset = sdAssetForSkin(options.def.id, options.skin?.id);
    if (sdAsset) void spawnPuppet(scene, sdAsset, { ...layout.sd, depth: 2 }).then((puppet) => {
      if (!this.active) { puppet.destroy(); return; }
      puppet.setAlpha(options.owned ? 1 : 0.28);
      this.add(puppet);
    });

    this.add(scene.add.text(0, layout.nameY, options.name, textStyle({ role: "display", size: 27, color: options.owned ? COLOR.ink : COLOR.inkDim, align: "center", wrap: 320 })).setOrigin(0.5));
    this.add(scene.add.text(0, layout.statusY, options.owned ? "보유" : "미보유 · 잠금", textStyle({ role: "emphasis", size: 21, color: options.owned ? COLOR.accentText : COLOR.inkDim })).setOrigin(0.5));
    const hit = scene.add.rectangle(0, 0, layout.width, layout.height, 0xffffff, 0);
    if (options.owned) hit.setInteractive({ useHandCursor: true }).on("pointerup", options.onChoose);
    this.add(hit);
    this.once(Phaser.GameObjects.Events.DESTROY, () => { fullBodyMask.destroy(); maskSource.destroy(); });
    this.setSelected(false);
  }

  /** 선택은 색상 배지가 아니라 확대와 더 밝고 굵은 윗선으로만 전달한다. */
  setSelected(selected: boolean): void {
    this.setScale(selected ? 1.08 : 1);
    this.idleLayer.setVisible(!selected);
    this.selectedLayer.setVisible(selected);
    this.selectedEdge.setVisible(selected);
  }
}
