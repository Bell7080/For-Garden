import Phaser from "phaser";
import { t } from "../i18n";
import { chipPoints, drawHairline, drawLayer } from "./holo";
import { COLOR, textStyle } from "./theme";
import { anchorEnemyPreview, NODE_ENEMY_PREVIEW } from "./nodeEnemyPreviewLayout";

/** 서브 노드 판의 배치 — 전투 판의 제목·줄거리 칸에서 캐릭터를 뺀 모양이다. */
export const NODE_STORY_PREVIEW = { titleY: 34, titleSize: 32, dividerGap: 18, labelSize: 22, textSize: 26, textGap: 16, bottom: 36, bevel: 30, inset: 56 } as const;

export interface NodeStoryPreviewOptions {
  title: string;
  /** 줄거리 한두 문장. 이 판은 전투 판처럼 접지 않는다 — 읽을 것이 이것뿐이다. */
  summary: string;
  /** 이미 읽은 서브는 제목 오른쪽에 「읽음」이 선다. */
  read: boolean;
  top: number;
  bottom: number;
}

/**
 * 서브 노드(SUB)를 눌렀을 때 노드에 붙는 줄거리 판.
 *
 * 전투 노드의 `NodeEnemyPreview`와 같은 폭·깎임·꼬리·등장 연출을 쓰되 적 칸과 보상 줄이 없다. 판 높이는 줄거리 글의
 * 높이에서 거꾸로 구한다 — 글이 길어지거나 언어가 바뀌어도 아래 여백이 어긋나지 않는다.
 */
export class NodeStoryPreview extends Phaser.GameObjects.Container {
  private options: NodeStoryPreviewOptions;
  private panelHeight: number = NODE_ENEMY_PREVIEW.height;
  private tail?: Phaser.GameObjects.Graphics;
  private shown = false;

  constructor(scene: Phaser.Scene, options: NodeStoryPreviewOptions) {
    super(scene, scene.scale.width / 2, 0);
    this.options = options;
    scene.add.existing(this);
    this.setDepth(60).setVisible(false);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  showAt(nodeY: number, options: Partial<Pick<NodeStoryPreviewOptions, "title" | "summary" | "read">>): void {
    this.options = { ...this.options, ...options };
    this.removeAll(true);
    const spec = NODE_STORY_PREVIEW;
    const width = NODE_ENEMY_PREVIEW.width;
    const left = -width / 2 + spec.inset;
    const textWidth = width - spec.inset * 2 - 24;
    const body = this.scene.add.text(left, 0, this.options.summary, textStyle({ role: "body", size: spec.textSize, color: COLOR.ink, wrap: textWidth })).setOrigin(0, 0);
    const dividerY = spec.titleY + spec.titleSize + spec.dividerGap;
    const labelY = dividerY + 22;
    const textY = labelY + spec.labelSize + spec.textGap;
    const height = textY + body.height + spec.bottom;
    this.panelHeight = height;
    const top = -height / 2;
    const { y, above } = anchorEnemyPreview(nodeY, this.options.top, this.options.bottom, height);
    this.setY(y);
    this.add(drawLayer(this.scene, 0, 0, chipPoints(width, height, { bevel: { topLeft: spec.bevel, bottomRight: spec.bevel } }), { fill: 0x0b0f15, alpha: 0.92, edge: COLOR.accent, edgeAlpha: 0.55 }));
    this.tail = this.scene.add.graphics(); this.add(this.tail); this.drawTail(above);
    this.add(this.scene.add.text(left, top + spec.titleY, this.options.title, textStyle({ role: "display", size: spec.titleSize })).setOrigin(0, 0));
    if (this.options.read) this.add(this.scene.add.text(width / 2 - 40, top + spec.titleY + 6, t("stageMap.subRead"), textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(1, 0));
    this.add(drawHairline(this.scene, 0, top + dividerY, width - 60, { color: COLOR.accent, alpha: 0.3 }));
    this.add(this.scene.add.text(left, top + labelY, t("enemyPreview.story"), textStyle({ role: "emphasis", size: spec.labelSize, color: COLOR.inkDim })).setOrigin(0, 0));
    body.setPosition(left, top + textY); this.add(body);
    if (!this.shown) {
      this.shown = true; this.setVisible(true).setAlpha(0).setScale(0.94);
      this.scene.tweens.add({ targets: this, alpha: 1, scale: 1, duration: 260, ease: "Cubic.Out" });
    } else this.setVisible(true).setAlpha(1).setScale(1);
  }

  /** 지도 스크롤을 따라 판을 옮기고, 노드가 마스크 밖이면 감춘다. */
  trackNode(nodeY: number, nodeVisible: boolean): void {
    if (!this.shown) return;
    const { y, above } = anchorEnemyPreview(nodeY, this.options.top, this.options.bottom, this.panelHeight);
    this.setY(y); this.drawTail(above); this.setVisible(nodeVisible);
  }

  dismiss(): void {
    if (!this.shown) return;
    this.scene.tweens.killTweensOf(this); this.removeAll(true);
    this.tail = undefined; this.shown = false; this.setVisible(false);
  }

  containsScreenPoint(x: number, y: number): boolean {
    return this.visible && x >= this.x - NODE_ENEMY_PREVIEW.width / 2 && x <= this.x + NODE_ENEMY_PREVIEW.width / 2
      && y >= this.y - this.panelHeight / 2 && y <= this.y + this.panelHeight / 2;
  }

  private drawTail(above: boolean): void {
    if (!this.tail) return;
    const edge = above ? this.panelHeight / 2 : -this.panelHeight / 2;
    this.tail.clear().lineStyle(3, COLOR.accent, 0.55).lineBetween(0, edge, 0, edge + (above ? 52 : -52));
  }
}
