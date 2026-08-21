import Phaser from "phaser";
import { COLOR } from "./theme";

const GAP = 96;
/** 정사각형을 45도 돌려 마름모로 쓴다. Polygon과 달리 원점이 정확히 가운데라 줄이 어긋나지 않는다. */
const SIDE = 38;

/**
 * 로딩 진행 칸. 마름모 하나가 로딩 단계 하나다.
 *
 * 퍼센트 막대 대신 칸을 쓰는 이유는, 실제로 기다리는 대상이 파일 다섯 무리라서 남은 양보다
 * "몇 개 남았는지"가 정확하기 때문이다. 모양은 하단 탭의 로비 아이콘과 같은 마름모다.
 */
export class LoadingDiamonds extends Phaser.GameObjects.Container {
  private readonly marks: Phaser.GameObjects.Rectangle[] = [];
  private filled = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, count: number) {
    super(scene, x, y);
    const left = -((count - 1) * GAP) / 2;
    for (let i = 0; i < count; i++) {
      const mark = scene.add
        .rectangle(left + i * GAP, 0, SIDE, SIDE, COLOR.panel)
        .setStrokeStyle(3, COLOR.panelEdge)
        .setRotation(Math.PI / 4);
      this.marks.push(mark);
      this.add(mark);
    }
    scene.add.existing(this);
  }

  /** 채워진 칸 수를 갱신한다. 새로 찬 칸만 한 번 튀어 눈이 진행을 따라간다. */
  setFilled(count: number): void {
    for (let i = this.filled; i < count && i < this.marks.length; i++) {
      const mark = this.marks[i];
      mark.setFillStyle(COLOR.accent).setStrokeStyle(3, COLOR.accent);
      this.scene.tweens.add({ targets: mark, scale: { from: 1.5, to: 1 }, duration: 260, ease: "Back.easeOut" });
    }
    this.filled = Math.min(count, this.marks.length);
  }
}
