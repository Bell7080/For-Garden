import Phaser from "phaser";
import { BATTLE_STATUS_LAYOUT as L, unitStatusChipOffsets } from "./battleStatusLayout";
import { chipPoints, drawInnerVignette, drawLayer, drawShapeOutline } from "./holo";
import { STATUS_GLYPHS, type StatusGlyph } from "./statusGlyphShapes";
import type { UnitStatusView } from "./unitStatusModel";
import { COLOR, textStyle } from "./theme";

/** 칩 한 장이 소유하는 표시 객체. 상태가 바뀔 때만 다시 만들고 평소에는 값만 갈아 끼운다. */
interface ChipView {
  container: Phaser.GameObjects.Container;
  id: string;
  gauge: Phaser.GameObjects.Graphics;
  stacks: Phaser.GameObjects.Text;
  plate: Phaser.GameObjects.Graphics;
  color: number;
  gaugeRatio?: number;
}

/** 색을 검정 쪽으로 눌러 칩 바탕을 만든다. 같은 계열이되 흰 그림이 올라앉을 만큼 어둡다. */
function shade(color: number, keep: number): number {
  return (Math.round(((color >> 16) & 0xff) * keep) << 16) | (Math.round(((color >> 8) & 0xff) * keep) << 8) | Math.round((color & 0xff) * keep);
}

/**
 * SD 머리 위, 체력 바 **위**에 서는 상태 칩 한 줄.
 *
 * - **색이 계열을, 그림이 상태를 말한다.** 바탕은 상태 색을 짙게 누른 면이고 그 위에 상태마다 다른
 *   흰 그림(`STATUS_GLYPHS`)이 검은 잉크 외곽을 두르고 선다 — 모든 칩이 같은 마름모에 색만 다르던 때는
 *   물빛·보랏빛 계열끼리 무엇이 걸렸는지 눌러 보기 전에는 몰랐다.
 * - **겹치는 상태**는 칩 우상단 모서리에 걸터앉은 검은 판 위 흰 숫자가 몇 겹인지 말한다.
 * - **시간이 도는 상태**는 칩 밑변 아래 가는 막대가 남은 시간만큼 상태 색으로 차 있다. 그림 위를 덮지 않는다.
 * - 손질처럼 시간이 없는 상태는 막대를 그리지 않는다 — 없는 시계를 그리면 곧 사라질 것처럼 읽힌다.
 * - **모든 상태가 같은 한 장이다.** 시약만 체력 바 아래 세 칸 게이지로 따로 서던 때는 같은 "겹이 쌓인
 *   디버프"가 혼자 다른 물건으로 읽혔다.
 */
/**
 * 칩 한 장의 도형.
 *
 * 액자와 **덮는 시계가 같은 폴리곤을 읽어야** 한다 — 따로 만들면 시계가 깎인 모서리를 넘어
 * 흘러내리고, 그 조각이 바로 아래 체력 바를 가린다.
 */
function chipShape(): number[] {
  const size = L.chipSize;
  return chipPoints(size, size, { bevel: { topLeft: L.chipBevel, topRight: 0, bottomRight: L.chipBevel, bottomLeft: 0 } });
}

export class UnitStatusChips extends Phaser.GameObjects.Container {
  private readonly chips = new Map<string, ChipView>();

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    scene.add.existing(this);
  }

  /** 지금 걸린 상태 목록으로 한 줄을 다시 세운다. 없어진 상태의 칩만 버린다. */
  update(views: readonly UnitStatusView[]): void {
    if (views.length === 0 && this.chips.size === 0) return;
    const alive = new Set(views.map((view) => view.key ?? view.id));
    for (const [id, chip] of this.chips) {
      if (!alive.has(id)) { chip.container.destroy(true); this.chips.delete(id); }
    }
    const offsets = unitStatusChipOffsets(views.length);
    views.forEach((view, index) => {
      const key = view.key ?? view.id;
      const chip = this.chips.get(key) ?? this.createChip(view, key);
      chip.container.setPosition(offsets[index], 0);
      // 겹은 있을 때만 적는다. 0을 남겨 두면 사라진 상태가 아직 걸린 것처럼 보인다.
      const hasStacks = view.stacks !== undefined && view.stacks > 0;
      chip.plate.setVisible(hasStacks);
      chip.stacks.setVisible(hasStacks).setText(hasStacks ? String(view.stacks) : "");
      this.drawGauge(chip, view);
    });
  }

  private createChip(view: UnitStatusView, key: string): ChipView {
    const scene = this.scene;
    const size = L.chipSize;
    const container = scene.add.container(0, 0);
    const shape = chipShape();
    // 그림자는 칩 크기에 맞춘다 — 판때기 기준 그림자는 이 칩에서 칩 절반만큼 튀어나간다.
    container.add(drawLayer(scene, 0, 0, shape, { fill: shade(view.color, 0.34), alpha: 0.96, shadow: L.chipShadow }));
    container.add(drawInnerVignette(scene, 0, 0, shape, { strength: 0.45 }));
    container.add(this.drawGlyph(STATUS_GLYPHS[view.id], size * 0.38));
    container.add(drawShapeOutline(scene, 0, 0, shape, { color: view.color, alpha: 1, width: 2 }));
    const gauge = scene.add.graphics();
    container.add(gauge);
    const count = L.stackCount;
    // 겹 수 판은 우상단 모서리에 걸터앉는 작은 네모다 — 그림을 덮지 않는다.
    const plate = scene.add.graphics().fillStyle(COLOR.void, 0.95)
      .fillRect(count.offsetX - count.plateRadius, count.offsetY - count.plateRadius, count.plateRadius * 2, count.plateRadius * 2)
      .lineStyle(1.5, view.color, 1)
      .strokeRect(count.offsetX - count.plateRadius, count.offsetY - count.plateRadius, count.plateRadius * 2, count.plateRadius * 2);
    const stacks = scene.add.text(count.offsetX, count.offsetY + 0.5, "", textStyle({ role: "display", size: count.size, color: "#ffffff" }))
      .setOrigin(0.5).setStroke("#000000", 3);
    container.add([plate, stacks]);
    this.add(container);
    const chip: ChipView = { container, id: key, gauge, stacks, plate, color: view.color };
    this.chips.set(key, chip);
    return chip;
  }

  /**
   * 상태 그림 한 장. 같은 모양을 **검게 두껍게 한 번 깐 뒤 흰색으로** 다시 그린다 — 잉크 외곽이
   * 있어야 밝은 상태 색 바탕 위에서도, 칩이 작아져도 실루엣이 끊기지 않는다.
   */
  private drawGlyph(glyph: StatusGlyph, scale: number): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    const toPoints = (points: readonly (readonly [number, number])[]) => points.map(([x, y]) => new Phaser.Geom.Point(x * scale, y * scale));
    const pass = (color: number, lineWidth: number, outline: number): void => {
      for (const part of glyph) {
        const points = toPoints(part.points);
        if (part.kind === "fill") {
          g.fillStyle(color, 1).fillPoints(points, true);
          if (outline > 0) g.lineStyle(outline, color, 1).strokePoints(points, true, true);
        } else {
          g.lineStyle(lineWidth, color, 1).strokePoints(points, part.closed ?? false, part.closed ?? false);
        }
      }
    };
    pass(0x000000, 5, 3.2);
    pass(0xffffff, 2.4, 0);
    return g;
  }

  /**
   * 남은 시간을 칩 밑변 아래 가는 막대로 그린다. 왼쪽부터 줄어들어 다 비는 순간이 곧 풀리는 순간이다.
   * 그림 위를 덮지 않으므로 무엇이 걸렸는지와 얼마나 남았는지가 서로를 가리지 않는다.
   */
  private drawGauge(chip: ChipView, view: UnitStatusView): void {
    const ratio = view.remaining === undefined || !view.total ? -1 : Math.max(0, Math.min(1, view.remaining / view.total));
    // 픽셀 단위로만 다시 그린다 — 매 프레임 같은 막대를 다시 칠하지 않는다.
    const quantized = ratio < 0 ? -1 : Math.round(ratio * L.chipSize) / L.chipSize;
    if (quantized === chip.gaugeRatio) return;
    chip.gaugeRatio = quantized;
    chip.gauge.clear();
    if (quantized < 0) return;
    const { gap, height, trackAlpha } = L.timeGauge;
    const width = L.chipSize;
    const top = L.chipSize / 2 + gap;
    chip.gauge.fillStyle(0x000000, trackAlpha).fillRect(-width / 2 - 1, top - 1, width + 2, height + 2);
    if (quantized > 0) chip.gauge.fillStyle(chip.color, 1).fillRect(-width / 2, top, width * quantized, height);
  }
}
