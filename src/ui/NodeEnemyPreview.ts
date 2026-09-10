import Phaser from "phaser";
import type { RelicDef, StageEnemyDef } from "../core/types";
import { setDebugEnemyPreview } from "../debug";
import { battleAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { chipPoints, drawHairline, drawLayer } from "./holo";
import { COLOR, textStyle } from "./theme";
import { AffinityBadge } from "./AffinityBadge";
import { ELEMENT_ICON, ROLE_ICON } from "./affinityIcons";
import { addStarMark } from "./rarityMark";
import { combatPower } from "../core/combatPower";

import { anchorEnemyPreview, enemyPreviewColumns, enemyPreviewSlotHalfWidth, NODE_ENEMY_PREVIEW, NODE_ENEMY_SLOT } from "./nodeEnemyPreviewLayout";

export interface NodeEnemyPreviewOptions {
  title: string;
  /** 렌더된 적과 같은 슬롯 순서의 공개 성장 상태다. */
  growth: readonly Pick<StageEnemyDef, "level" | "breakthrough">[];
  enemies: readonly RelicDef[];
  top: number;
  bottom: number;
  depth?: number;
  onEnemyClick: (enemy: RelicDef) => void;
}

/** 스토리와 원정 지도가 공유하는 노드 부착형 적 SD 편성 프리팹이다. */
export class NodeEnemyPreview extends Phaser.GameObjects.Container {
  private readonly puppets = new Set<PuppetCreature>();
  /** 꼬리는 추적 중 위/아래 방향이 바뀔 때 같은 Graphics를 다시 그린다. */
  private tail?: Phaser.GameObjects.Graphics;
  private generation = 0;
  private shown = false;
  /** 첫 출현 확대가 끝나기 전에는 컨테이너 밖 SD도 따로 감춘다. */
  private revealed = false;
  private options: NodeEnemyPreviewOptions;

  constructor(scene: Phaser.Scene, options: NodeEnemyPreviewOptions) {
    super(scene, scene.scale.width / 2, 0);
    this.options = options;
    scene.add.existing(this);
    this.setDepth(options.depth ?? 60).setVisible(false);
    // 씬 종료와 선택 변경은 같은 폐기 경로를 사용해 늦은 비동기 로드도 채택되지 않게 한다.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    this.once(Phaser.GameObjects.Events.DESTROY, () => { this.clearPuppets(); setDebugEnemyPreview(undefined); });
  }

  /** 새 노드의 제목·레벨·편성을 원자적으로 갈아 끼우고 노드에 꼬리를 붙인다. */
  showAt(nodeY: number, options: Partial<Pick<NodeEnemyPreviewOptions, "title" | "growth" | "enemies" | "onEnemyClick">> = {}): void {
    this.options = { ...this.options, ...options };
    this.removeAll(true); this.clearPuppets();
    const generation = ++this.generation;
    const { y, above } = anchorEnemyPreview(nodeY, this.options.top, this.options.bottom);
    this.setY(y);
    const bevel = Math.min(NODE_ENEMY_PREVIEW.width, NODE_ENEMY_PREVIEW.height) * 0.16;
    this.add(drawLayer(this.scene, 0, 0, chipPoints(NODE_ENEMY_PREVIEW.width, NODE_ENEMY_PREVIEW.height, { bevel: { topLeft: bevel, bottomRight: bevel } }), { fill: 0x0b0f15, alpha: 0.92, edge: COLOR.accent, edgeAlpha: 0.55 }));
    this.tail = this.scene.add.graphics(); this.add(this.tail); this.drawTail(above);
    this.add(this.scene.add.text(-NODE_ENEMY_PREVIEW.width / 2 + bevel * 0.7, NODE_ENEMY_SLOT.dividerY - 50, this.options.title, textStyle({ role: "display", size: 32 })).setOrigin(0, 0));
    this.add(this.scene.add.text(NODE_ENEMY_PREVIEW.width / 2 - 30, NODE_ENEMY_SLOT.dividerY - 46, "적 편성", textStyle({ role: "emphasis", size: 22, color: COLOR.dangerText })).setOrigin(1, 0));
    this.add(drawHairline(this.scene, 0, NODE_ENEMY_SLOT.dividerY, NODE_ENEMY_PREVIEW.width - 60, { color: COLOR.accent, alpha: 0.35 }));
    const columns = enemyPreviewColumns(this.options.enemies.length);
    const compact = columns.length > 3;
    const half = enemyPreviewSlotHalfWidth(this.options.enemies.length);
    const ground = NODE_ENEMY_SLOT.ground;
    this.options.enemies.forEach((enemy, index) => {
      const growth = this.options.growth[index] ?? { level: 1, breakthrough: 0 };
      const x = columns[index];
      this.add(this.scene.add.ellipse(x, ground + 4, compact ? 112 : 150, 26, COLOR.void, 0.5));
      // **카드 그리드와 같은 양식을 쓰되 칸이 아니라 SD로 세운다.** 속성·직군은 왼쪽 위에
      // 아이콘으로, 돌파는 오른쪽 위에 로마자로 — 화면마다 다른 글로 적으면 같은 값이 어디서는
      // 표식, 어디서는 문장이 된다.
      const badgeSize = compact ? 40 : 52;
      const badgeX = x - half + badgeSize * 0.62;
      const badgeTop = NODE_ENEMY_SLOT.dividerY + 46;
      this.add(new AffinityBadge(this.scene, badgeX, badgeTop, ELEMENT_ICON[enemy.element], badgeSize, 0.62));
      this.add(new AffinityBadge(this.scene, badgeX, badgeTop + badgeSize * 0.94, ROLE_ICON[enemy.role], badgeSize * 0.74, 0.62));
      addStarMark(this.scene, this, x + half - 20, badgeTop - 4, compact ? 34 : 42, growth.breakthrough + 1);
      // 레벨과 이름은 카드의 이름줄과 같은 무게다 — 둘 다 강조색으로 크게 세우고 검은 획으로
      // 배경에서 떼어 놓는다. 흐린 회색으로 적으면 SD 아래에서 읽히지 않는다.
      const nameLine = this.scene.add
        .text(x, NODE_ENEMY_SLOT.nameY, `LV.${growth.level}  ${enemy.name}`, textStyle({ role: "display", size: compact ? 24 : 30, color: COLOR.accentText }))
        .setOrigin(0.5, 0);
      nameLine.setStroke("#05070a", 4).setShadow(0, 2, "#05070a", 3, true, true);
      this.add(nameLine);
      this.add(this.scene.add.text(x, NODE_ENEMY_SLOT.statsY, `HP ${enemy.stats.hp.toLocaleString()}`, textStyle({ role: "emphasis", size: compact ? 18 : 21, color: COLOR.ink })).setOrigin(0.5, 0));
      const hit = this.scene.add.rectangle(x, ground - 70, compact ? 145 : 230, 300, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerup", () => this.options.onEnemyClick(enemy)); this.add(hit);
      void this.spawnEnemy(enemy.id, x, ground, compact ? 158 : NODE_ENEMY_PREVIEW.sdHeight, generation);
    });
    // **판 아래는 이 편성이 얼마나 센가 한 줄이다.** 개체별 수치를 다 읽지 않고도 붙어 볼지
    // 말지를 정할 수 있어야 한다. 전투력은 표시·정렬 전용이라 전투 계산에는 들어가지 않는다.
    const power = this.options.enemies.reduce((sum, enemy) => sum + combatPower(enemy.stats), 0);
    this.add(drawHairline(this.scene, 0, NODE_ENEMY_SLOT.footerDividerY, NODE_ENEMY_PREVIEW.width - 60, { color: COLOR.accent, alpha: 0.28 }));
    this.add(this.scene.add
      .text(0, NODE_ENEMY_SLOT.powerY, `예상 종합 전투력 ${power.toLocaleString()}`, textStyle({ role: "display", size: 28, color: COLOR.dangerText }))
      .setOrigin(0.5, 0)
      .setShadow(0, 3, "#05070a", 4, false, true));
    // 상세 진입 E2E는 고정 숫자를 복제하지 않고 실제 적 입력 중심을 사용한다.
    setDebugEnemyPreview({ top: this.options.top, bottom: this.options.bottom, panelTop: y - NODE_ENEMY_PREVIEW.height / 2, panelBottom: y + NODE_ENEMY_PREVIEW.height / 2, above, enemyTargets: columns.map((x) => ({ x: this.x + x, y: y + ground })) });
    if (!this.shown) {
      this.shown = true; this.setVisible(true).setAlpha(0).setScale(0.94);
      this.scene.tweens.add({ targets: this, alpha: 1, scale: 1, duration: 260, ease: "Cubic.Out", onComplete: () => {
        this.revealed = true; for (const puppet of this.puppets) puppet.setVisible(true);
      } });
    } else { this.revealed = true; this.setVisible(true).setAlpha(1).setScale(1); }
  }

  /** 지도 스크롤을 따라 판과 컨테이너 밖 Puppet을 함께 옮기고 노드가 마스크 밖이면 감춘다. */
  trackNode(nodeY: number, nodeVisible: boolean): void {
    if (!this.shown) return;
    const previousY = this.y;
    const { y, above } = anchorEnemyPreview(nodeY, this.options.top, this.options.bottom);
    this.setY(y); this.drawTail(above);
    for (const puppet of this.puppets) puppet.setY(puppet.y + y - previousY);
    this.setVisible(nodeVisible);
    for (const puppet of this.puppets) puppet.setVisible(nodeVisible && this.revealed);
    if (!nodeVisible) { setDebugEnemyPreview(undefined); return; }
    const columns = enemyPreviewColumns(this.options.enemies.length); const ground = NODE_ENEMY_SLOT.ground;
    setDebugEnemyPreview({ top: this.options.top, bottom: this.options.bottom, panelTop: y - NODE_ENEMY_PREVIEW.height / 2, panelBottom: y + NODE_ENEMY_PREVIEW.height / 2, above, enemyTargets: columns.map((x) => ({ x: this.x + x, y: y + ground })) });
  }

  /** 노드 또는 판 밖 탭은 선택과 비동기 요청을 함께 취소해 다음 선택이 새로 출현하게 한다. */
  dismiss(): void {
    if (!this.shown) return;
    this.scene.tweens.killTweensOf(this); this.removeAll(true); this.clearPuppets();
    this.tail = undefined; this.shown = false; this.revealed = false; this.setVisible(false);
    setDebugEnemyPreview(undefined);
  }

  /** 씬이 지도 밖 입력을 판 내부 입력과 구분할 때 쓰는 화면 좌표 판정이다. */
  containsScreenPoint(x: number, y: number): boolean {
    return this.visible && x >= this.x - NODE_ENEMY_PREVIEW.width / 2 && x <= this.x + NODE_ENEMY_PREVIEW.width / 2
      && y >= this.y - NODE_ENEMY_PREVIEW.height / 2 && y <= this.y + NODE_ENEMY_PREVIEW.height / 2;
  }

  /** 컨테이너를 뒤집지 않고 꼬리만 현재 노드 방향으로 다시 그린다. */
  private drawTail(above: boolean): void {
    if (!this.tail) return;
    const edge = above ? NODE_ENEMY_PREVIEW.height / 2 : -NODE_ENEMY_PREVIEW.height / 2;
    this.tail.clear().lineStyle(3, COLOR.accent, 0.55).lineBetween(0, edge, 0, edge + (above ? 52 : -52));
  }

  /** Puppet은 화면 좌표에 직접 세우며 세대가 바뀐 로드 결과는 즉시 폐기한다. */
  private async spawnEnemy(id: string, x: number, ground: number, height: number, generation: number): Promise<void> {
    const puppet = await spawnPuppet(this.scene, battleAssetFor(id), { x: this.x + x, groundY: this.y + ground, height, flipX: true, tint: 0xffffff, depth: this.depth + 1 });
    if (!this.active || generation !== this.generation || !this.scene.scene.isActive()) { puppet.destroy(); return; }
    puppet.setVisible(this.revealed); this.puppets.add(puppet);
  }

  /** 현재 세대를 무효화한 뒤 컨테이너 밖 GPU 개체까지 명시적으로 정리한다. */
  private clearPuppets(): void {
    this.generation += 1;
    for (const puppet of this.puppets) puppet.destroy();
    this.puppets.clear();
  }
}
