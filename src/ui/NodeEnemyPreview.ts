import Phaser from "phaser";
import type { RelicDef } from "../core/types";
import { setDebugEnemyPreview } from "../debug";
import { ROLE_LABEL } from "../managers/CharacterInfoManager";
import { battleAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { chipPoints, drawHairline, drawLayer } from "./holo";
import { COLOR, textStyle } from "./theme";

import { anchorEnemyPreview, enemyPreviewColumns, NODE_ENEMY_PREVIEW } from "./nodeEnemyPreviewLayout";

export interface NodeEnemyPreviewOptions {
  title: string;
  level: number;
  enemies: readonly RelicDef[];
  top: number;
  bottom: number;
  depth?: number;
  onEnemyClick: (enemy: RelicDef) => void;
}

/** 스토리와 원정 지도가 공유하는 노드 부착형 적 SD 편성 프리팹이다. */
export class NodeEnemyPreview extends Phaser.GameObjects.Container {
  private readonly puppets = new Set<PuppetCreature>();
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
    const bevel = Math.min(NODE_ENEMY_PREVIEW.width, NODE_ENEMY_PREVIEW.height) * 0.16;
    this.add(drawLayer(scene, 0, 0, chipPoints(NODE_ENEMY_PREVIEW.width, NODE_ENEMY_PREVIEW.height, { bevel: { topLeft: bevel, bottomRight: bevel } }), { fill: 0x0b0f15, alpha: 0.92, edge: COLOR.accent, edgeAlpha: 0.55 }));
    // 씬 종료와 선택 변경은 같은 폐기 경로를 사용해 늦은 비동기 로드도 채택되지 않게 한다.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    this.once(Phaser.GameObjects.Events.DESTROY, () => { this.clearPuppets(); setDebugEnemyPreview(undefined); });
  }

  /** 새 노드의 제목·레벨·편성을 원자적으로 갈아 끼우고 노드에 꼬리를 붙인다. */
  showAt(nodeY: number, options: Partial<Pick<NodeEnemyPreviewOptions, "title" | "level" | "enemies" | "onEnemyClick">> = {}): void {
    this.options = { ...this.options, ...options };
    this.removeAll(true); this.clearPuppets();
    const generation = ++this.generation;
    const { y, above } = anchorEnemyPreview(nodeY, this.options.top, this.options.bottom);
    this.setY(y);
    const bevel = Math.min(NODE_ENEMY_PREVIEW.width, NODE_ENEMY_PREVIEW.height) * 0.16;
    this.add(drawLayer(this.scene, 0, 0, chipPoints(NODE_ENEMY_PREVIEW.width, NODE_ENEMY_PREVIEW.height, { bevel: { topLeft: bevel, bottomRight: bevel } }), { fill: 0x0b0f15, alpha: 0.92, edge: COLOR.accent, edgeAlpha: 0.55 }));
    const tail = this.scene.add.graphics().lineStyle(3, COLOR.accent, 0.55);
    const edge = above ? NODE_ENEMY_PREVIEW.height / 2 : -NODE_ENEMY_PREVIEW.height / 2;
    tail.lineBetween(0, edge, 0, edge + (above ? 52 : -52)); this.add(tail);
    this.add(this.scene.add.text(-NODE_ENEMY_PREVIEW.width / 2 + bevel * 0.7, -136, `${this.options.title}  ·  적 LV.${this.options.level}`, textStyle({ role: "display", size: 32 })).setOrigin(0, 0));
    this.add(this.scene.add.text(NODE_ENEMY_PREVIEW.width / 2 - 30, -132, "적 편성", textStyle({ role: "emphasis", size: 22, color: COLOR.dangerText })).setOrigin(1, 0));
    this.add(drawHairline(this.scene, 0, -86, NODE_ENEMY_PREVIEW.width - 60, { color: COLOR.accent, alpha: 0.35 }));
    const columns = enemyPreviewColumns(this.options.enemies.length);
    const compact = columns.length > 3;
    const ground = 90;
    this.options.enemies.forEach((enemy, index) => {
      const x = columns[index];
      this.add(this.scene.add.ellipse(x, ground + 4, compact ? 112 : 150, 26, COLOR.void, 0.5));
      this.add(this.scene.add.text(x, ground + 14, enemy.name, textStyle({ role: "display", size: compact ? 19 : 24 })).setOrigin(0.5, 0));
      this.add(this.scene.add.text(x, ground + 42, `${ROLE_LABEL[enemy.role]}  HP ${enemy.stats.hp}`, textStyle({ role: "body", size: compact ? 15 : 19, color: COLOR.inkDim })).setOrigin(0.5, 0));
      const hit = this.scene.add.rectangle(x, ground - 70, compact ? 145 : 230, 250, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerup", () => this.options.onEnemyClick(enemy)); this.add(hit);
      void this.spawnEnemy(enemy.id, x, ground, compact ? 132 : NODE_ENEMY_PREVIEW.sdHeight, generation);
    });
    // 상세 진입 E2E는 고정 숫자를 복제하지 않고 실제 적 입력 중심을 사용한다.
    setDebugEnemyPreview({ top: this.options.top, bottom: this.options.bottom, panelTop: y - NODE_ENEMY_PREVIEW.height / 2, panelBottom: y + NODE_ENEMY_PREVIEW.height / 2, above, enemyTargets: columns.map((x) => ({ x: this.x + x, y: y + ground })) });
    if (!this.shown) {
      this.shown = true; this.setVisible(true).setAlpha(0).setScale(0.94);
      this.scene.tweens.add({ targets: this, alpha: 1, scale: 1, duration: 260, ease: "Cubic.Out", onComplete: () => {
        this.revealed = true; for (const puppet of this.puppets) puppet.setVisible(true);
      } });
    } else { this.revealed = true; this.setVisible(true).setAlpha(1).setScale(1); }
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
