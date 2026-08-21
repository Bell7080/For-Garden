import Phaser from "phaser";
import type { Stats } from "../core/types";
import { STAT_RADAR_MAX } from "../config/statRadar";
import { COLOR, textStyle } from "./theme";

/** 레이더에 표시하는 축은 항상 같은 순서와 상한을 사용한다. */
const AXES = [
  ["hp", "체력"], ["def", "방어"], ["res", "저항"], ["atk", "공격"], ["ap", "주문"],
] as const;

/** 정규화된 오각형 능력치 레이더 그래프 Phaser prefab이다. */
export class StatRadar extends Phaser.GameObjects.Container {
  private readonly graph: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, radius = 112) {
    super(scene, x, y);
    scene.add.existing(this);
    this.graph = scene.add.graphics();
    this.add(this.graph);

    // 축 라벨은 그래프 밖으로 일정하게 밀어 최대 자릿수 숫자와 겹치지 않게 한다.
    AXES.forEach(([, label], index) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / AXES.length;
      this.add(scene.add.text(Math.cos(angle) * (radius + 31), Math.sin(angle) * (radius + 25), label,
        textStyle({ role: "body", size: 17, color: COLOR.inkDim })).setOrigin(0.5));
    });
    this.draw({ hp: 0, def: 0, res: 0, atk: 0, ap: 0 } as Stats, radius);
  }

  /** 각 수치를 공용 상한으로 제한·정규화한 뒤 비교 가능한 면을 그린다. */
  draw(stats: Stats, radius = 112): void {
    this.graph.clear();
    const point = (index: number, scale: number) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / AXES.length;
      return new Phaser.Math.Vector2(Math.cos(angle) * radius * scale, Math.sin(angle) * radius * scale);
    };
    for (const scale of [1, 0.5]) {
      const ring = AXES.map((_, index) => point(index, scale));
      this.graph.lineStyle(2, COLOR.panelEdge, 0.65).strokePoints(ring, true);
    }
    AXES.forEach((_, index) => this.graph.lineBetween(0, 0, point(index, 1).x, point(index, 1).y));
    const values = AXES.map(([key], index) => point(index, Math.min(1, Math.max(0, stats[key] / STAT_RADAR_MAX[key]))));
    this.graph.fillStyle(COLOR.accent, 0.24).fillPoints(values, true);
    this.graph.lineStyle(3, COLOR.accent, 0.95).strokePoints(values, true);
    values.forEach(({ x, y }) => this.graph.fillStyle(COLOR.accent, 1).fillCircle(x, y, 4));
  }
}
