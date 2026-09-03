import Phaser from "phaser";
import { BATTLE_STATUS_LAYOUT as L, unitStatusChipOffsets } from "./battleStatusLayout";
import { chipPoints, drawInnerVignette, drawLayer, drawShapeOutline } from "./holo";
import type { UnitStatusView } from "./unitStatusModel";
import { COLOR, textStyle } from "./theme";

/** 칩 한 장이 소유하는 표시 객체. 상태가 바뀔 때만 다시 만들고 평소에는 값만 갈아 끼운다. */
interface ChipView {
  container: Phaser.GameObjects.Container;
  id: string;
  clock: Phaser.GameObjects.Graphics;
  stacks: Phaser.GameObjects.Text;
  plate: Phaser.GameObjects.Arc;
}

/**
 * SD 머리 위, 체력 바 **위**에 서는 상태 칩 한 줄.
 *
 * 예전에는 작은 마름모가 체력 바 옆에 붙었다 — 상태가 둘만 걸려도 바가 밀려 어디까지가
 * 체력인지 흐려졌고, 겹 수를 적을 자리도 없었다. 지금은 전투 버프 칩과 같은 액자(깎인 네모 +
 * 사방 외곽선 + 안쪽 비네트)를 작게 줄여 쓰고, 한 장이 상태 하나를 맡는다.
 *
 * - **겹치는 상태**는 칩 우하단의 작은 수가 몇 겹인지 말한다.
 * - **시간이 도는 상태**는 칩 둘레를 시계처럼 도는 고리가 남은 시간을 말한다.
 * - 손질처럼 시간이 없는 상태는 고리를 그리지 않는다 — 없는 시계를 그리면 곧 사라질 것처럼 읽힌다.
 */
export class UnitStatusChips extends Phaser.GameObjects.Container {
  private readonly chips = new Map<string, ChipView>();

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    scene.add.existing(this);
  }

  /** 지금 걸린 상태 목록으로 한 줄을 다시 세운다. 없어진 상태의 칩만 버린다. */
  update(views: readonly UnitStatusView[]): void {
    const alive = new Set(views.map(({ id }) => id));
    for (const [id, chip] of this.chips) {
      if (!alive.has(id as UnitStatusView["id"])) { chip.container.destroy(true); this.chips.delete(id); }
    }
    const offsets = unitStatusChipOffsets(views.length);
    views.forEach((view, index) => {
      const chip = this.chips.get(view.id) ?? this.createChip(view);
      chip.container.setPosition(offsets[index], 0);
      // 겹은 있을 때만 적는다. 0을 남겨 두면 사라진 상태가 아직 걸린 것처럼 보인다.
      const hasStacks = view.stacks !== undefined && view.stacks > 0;
      chip.plate.setVisible(hasStacks);
      chip.stacks.setVisible(hasStacks).setText(hasStacks ? String(view.stacks) : "");
      this.drawClock(chip, view);
    });
  }

  private createChip(view: UnitStatusView): ChipView {
    const scene = this.scene;
    const size = L.chipSize;
    const container = scene.add.container(0, 0);
    const shape = chipPoints(size, size, { bevel: { topLeft: 8, topRight: 0, bottomRight: 8, bottomLeft: 0 } });
    container.add(drawLayer(scene, 0, 0, shape, { fill: COLOR.void, alpha: 0.88 }));
    container.add(this.drawMark(view.color, size));
    container.add(drawInnerVignette(scene, 0, 0, shape, { strength: 0.5 }));
    container.add(drawShapeOutline(scene, 0, 0, shape, { color: view.color, alpha: 0.92, width: 2 }));
    const clock = scene.add.graphics();
    container.add(clock);
    const count = L.stackCount;
    const plate = scene.add.circle(count.offsetX, count.offsetY, count.plateRadius, COLOR.void, 0.94);
    const stacks = scene.add.text(count.offsetX, count.offsetY + 1, "", textStyle({ role: "display", size: count.size, color: `#${view.color.toString(16).padStart(6, "0")}` })).setOrigin(0.5);
    container.add([plate, stacks]);
    this.add(container);
    const chip: ChipView = { container, id: view.id, clock, stacks, plate };
    this.chips.set(view.id, chip);
    return chip;
  }

  /** 상태를 알리는 마름모 한 장. 색만으로 갈리지 않도록 예전 뱃지와 같은 모양을 그대로 쓴다. */
  private drawMark(color: number, size: number): Phaser.GameObjects.Graphics {
    const half = size * 0.31;
    return this.scene.add.graphics().fillStyle(color, 0.95).fillPoints([
      new Phaser.Geom.Point(0, -half),
      new Phaser.Geom.Point(half * 0.72, half * 0.18),
      new Phaser.Geom.Point(0, half),
      new Phaser.Geom.Point(-half * 0.72, half * 0.18),
    ], true);
  }

  /** 남은 시간이 있는 상태만 12시에서 시계 방향으로 도는 고리를 그린다. */
  private drawClock(chip: ChipView, view: UnitStatusView): void {
    chip.clock.clear();
    if (view.remaining === undefined || !view.total) return;
    const ratio = Math.max(0, Math.min(1, view.remaining / view.total));
    if (ratio <= 0) return;
    const radius = L.chipSize / 2 - L.clockWidth;
    const start = -Math.PI / 2;
    chip.clock.lineStyle(L.clockWidth, view.color, 0.95);
    chip.clock.beginPath();
    chip.clock.arc(0, 0, radius, start, start + Math.PI * 2 * ratio, false);
    chip.clock.strokePath();
  }
}
