import Phaser from "phaser";
import type { ActiveCombatBuff } from "../core/skirmish";
import { battleBuffProgress } from "../core/battleBuffPresentation";
import type { BattleUiMotion } from "../core/settings";
import { chipPoints, drawInnerVignette, drawLayer, drawShapeOutline } from "./holo";

/** 전투 프로필에 붙는 작은 버프 액자. 진행 Graphics는 생성 후 지우고 다시 그려 재사용한다. */
export class BattleBuffChip extends Phaser.GameObjects.Container {
  private readonly progress = this.scene.add.graphics();
  private readonly hit: Phaser.GameObjects.Rectangle;
  private timing: ActiveCombatBuff["timing"];

  constructor(scene: Phaser.Scene, size: number, tint: number, texture: string, timing: ActiveCombatBuff["timing"], motion: BattleUiMotion, onPress: () => void) {
    super(scene, 0, 0);
    this.timing = timing;
    const shape = chipPoints(size, size, { bevel: { topLeft: 12, topRight: 0, bottomRight: 12, bottomLeft: 0 } });
    this.add(drawLayer(scene, 0, 0, shape, { fill: tint, alpha: 0.9 }));
    this.add(scene.add.image(0, 0, texture).setDisplaySize(size * 0.72, size * 0.72).setTint(tint));
    this.add([drawInnerVignette(scene, 0, 0, shape, { strength: 0.55 }), this.progress]);
    this.hit = scene.add.rectangle(0, 0, size, size, 0xffffff, 0).setInteractive({ useHandCursor: true });
    // 진행 정보는 모든 움직임 설정에서 유지하고, reduced/off는 눌림 장식의 크기만 줄인다.
    const pressedScale = motion === "default" ? 1.1 : motion === "reduced" ? 1.04 : 1;
    this.hit.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); this.setScale(pressedScale); });
    this.hit.on("pointerup", (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); this.setScale(1); onPress(); });
    this.hit.on("pointerout", () => this.setScale(1));
    this.add([drawShapeOutline(scene, 0, 0, shape, { color: tint, alpha: 0.9, width: 2 }), this.hit]);
    this.redraw(size, tint);
    scene.add.existing(this);
  }

  /** 같은 칩 인스턴스의 Graphics만 다시 칠해 매 프레임 표시 객체를 할당하지 않는다. */
  public setTiming(timing: ActiveCombatBuff["timing"], size: number, tint: number): this {
    this.timing = timing;
    this.redraw(size, tint);
    return this;
  }

  private redraw(size: number, tint: number): void {
    const model = battleBuffProgress(this.timing);
    const radius = size / 2 - 3;
    this.progress.clear();
    if (model.kind === "conditional" || model.kind === "permanent") {
      // 종료 시각이 없는 효과는 빈틈 없는 링으로 현재 활성 상태만 표현한다.
      this.progress.lineStyle(4, tint, 1).strokeCircle(0, 0, radius);
      return;
    }
    if (model.elapsedTurns <= 0) return;
    // 12시부터 시계 방향으로 어두운 부채꼴을 늘려 남은 영역이 비워지는 과정을 보인다.
    const start = -Math.PI / 2;
    this.progress.fillStyle(0x05070a, 0.72).beginPath().moveTo(0, 0);
    this.progress.arc(0, 0, radius, start, start + Math.PI * 2 * model.elapsedTurns, false).closePath().fillPath();
  }
}
