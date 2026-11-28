import Phaser from "phaser";
import { t } from "../i18n";
import type { StageFirstClearReward } from "../core/stageRewards";
import { chipPoints, drawHairline, drawLayer } from "./holo";
import { COLOR, textStyle } from "./theme";
import { anchorEnemyPreview, NODE_ENEMY_PREVIEW, NODE_PREVIEW_GLASS_ALPHA, STORY_PREVIEW, storyPreviewRewardColumns, subStoryPreviewLayout } from "./nodeEnemyPreviewLayout";
import { addNodePreviewArt } from "./nodePreviewArt";
import { addStageRewardFrame, addStageRewardTag } from "./stageRewardFrame";

export interface NodeStoryPreviewOptions {
  title: string;
  /** 줄거리 한두 문장. 이 판은 접지 않는다 — 읽을 것이 이것뿐이다. */
  summary: string;
  /** 이미 읽은 서브는 제목 오른쪽에 「읽음」이 서고 보상 액자에 받은 표시가 선다. */
  read: boolean;
  /** 처음 읽으면 받는 보상(서브는 젬 50). 비우면 보상 줄을 세우지 않는다. */
  rewards?: readonly StageFirstClearReward[];
  /** 판 안에 옅게 비치는 원화 — 전투 판과 같은 결이다(`addNodePreviewArt`). */
  art?: string;
  top: number;
  bottom: number;
}

/**
 * 서브 노드(SUB)를 눌렀을 때 노드에 붙는 줄거리 판.
 *
 * **전투 관문 판(`NodeEnemyPreview`의 칸 판)과 한 벌이다** — 같은 폭·깎임·제목 크기·구분선, 같은 「줄거리」 머리줄,
 * 같은 초회 보상 이름표·액자 줄이고 적 칸만 없다(응태 2026-11-28 — 「글 미리보기도 전투 미리보기처럼 일관되게」).
 * 자리는 `subStoryPreviewLayout`이 글 높이에서 거꾸로 구한다.
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

  showAt(nodeY: number, options: Partial<Pick<NodeStoryPreviewOptions, "title" | "summary" | "read" | "art" | "rewards">>): void {
    this.options = { ...this.options, rewards: undefined, ...options };
    this.removeAll(true);
    const spec = STORY_PREVIEW;
    const width = NODE_ENEMY_PREVIEW.width;
    const textWidth = width - spec.storyText.inset * 2;
    const body = this.scene.add.text(0, 0, this.options.summary, textStyle({ role: "body", size: spec.storyText.size + 2, color: COLOR.ink, wrap: textWidth })).setOrigin(0, 0);
    const rewards = this.options.rewards ?? [];
    const layout = subStoryPreviewLayout({ storyTextHeight: body.height, rewardCount: rewards.length });
    const height = layout.height;
    this.panelHeight = height;
    const top = -height / 2;
    const { y, above } = anchorEnemyPreview(nodeY, this.options.top, this.options.bottom, height);
    this.setY(y);
    const bevel = spec.bevel;
    const shape = chipPoints(width, height, { bevel: { topLeft: bevel, bottomRight: bevel } });
    this.add(drawLayer(this.scene, 0, 0, shape, { fill: 0x0b0f15, alpha: NODE_PREVIEW_GLASS_ALPHA, edge: COLOR.accent, edgeAlpha: 0.6 }));
    addNodePreviewArt(this.scene, this, this.options.art, width, height, shape);
    this.tail = this.scene.add.graphics(); this.add(this.tail); this.drawTail(above);
    const left = -width / 2 + Math.max(56, bevel * 0.7);
    const right = width / 2 - 40;
    this.add(this.scene.add.text(left, top + layout.titleY, this.options.title, textStyle({ role: "display", size: spec.titleSize })).setOrigin(0, 0));
    if (this.options.read) this.add(this.scene.add.text(right, top + layout.titleY + 6, t("stageMap.subRead"), textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(1, 0));
    for (const divider of layout.dividers) this.add(drawHairline(this.scene, 0, top + divider, width - 60, { color: COLOR.accent, alpha: 0.3 }));
    this.add(this.scene.add.text(left, top + layout.storyHeaderY!, t("enemyPreview.story"), textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(0, 0.5));
    body.setPosition(left, top + layout.storyTextY!); this.add(body);
    if (layout.rewardLabelY !== undefined && layout.rewardRowY !== undefined) {
      addStageRewardTag(this.scene, this, left, top + layout.rewardLabelY + spec.reward.tag.height / 2, t("stageComplete.firstClear"), "first");
      const columns = storyPreviewRewardColumns(rewards.length, width);
      rewards.forEach((reward, index) => addStageRewardFrame(this.scene, this, columns[index], top + layout.rewardRowY!, spec.reward.frame, reward, { claimed: this.options.read }));
    }
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
