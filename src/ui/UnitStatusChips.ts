import Phaser from "phaser";
import { BATTLE_STATUS_LAYOUT as L, unitStatusChipOffsets } from "./battleStatusLayout";
import { chipPoints, drawInnerVignette, drawLayer, drawShapeOutline } from "./holo";
import { clockWedgeOnShape } from "./clockWedge";
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
    const shape = chipShape();
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

  /**
   * 지나간 시간을 12시에서 시계 방향으로 덮는다.
   *
   * 원형 게이지(고리) 대신 덮는 면을 쓰는 이유는, 이만큼 작은 칩 안에 선을 하나 더 그으면 그 선이
   * 표식과 겹쳐 곧 그림이 되기 때문이다. 덮이는 쪽은 아무것도 더하지 않고 "얼마나 남았나"만
   * 말하고, 다 덮이는 순간이 곧 풀리는 순간이다. 도형은 칩 사각형 안에서 잘라 만든다 —
   * 기하 마스크는 컨테이너 이동을 물려받지 않아 매 프레임 자리를 옮기는 칩에서 어긋난다.
   */
  private drawClock(chip: ChipView, view: UnitStatusView): void {
    chip.clock.clear();
    if (view.remaining === undefined || !view.total) return;
    const elapsed = 1 - Math.max(0, Math.min(1, view.remaining / view.total));
    // 덮는 도형은 칩과 **같은 폴리곤** 안에서 잘라 만든다. 사각형으로 그리면 깎인 모서리를
    // 넘어 흘러내린 검은 조각이 바로 아래 체력 바를 가린다.
    // chipPoints는 좌표를 한 줄로 늘어놓으므로 점 목록으로 다시 묶어 넘긴다.
    const flat = chipShape();
    const outline = Array.from({ length: flat.length / 2 }, (_, index) => ({ x: flat[index * 2], y: flat[index * 2 + 1] }));
    const points = clockWedgeOnShape(outline, elapsed);
    if (points.length < 3) return;
    chip.clock.fillStyle(0x000000, L.clockAlpha);
    chip.clock.fillPoints(points.map(({ x, y }) => new Phaser.Geom.Point(x, y)), true);
  }
}
