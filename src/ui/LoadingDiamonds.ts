import Phaser from "phaser";
import { COLOR } from "./theme";

const GAP = 96;
/**
 * 꼭짓점 반지름과 허리 반지름.
 *
 * 허리가 `OUTER / √2`(≈0.707)면 변이 곧은 마름모가 되고, 그보다 작을수록 변이 파여 뾰족해진다.
 * 0.57로 살짝만 파 놓아 마름모로 읽히면서 끝이 서 있게 한다.
 */
const OUTER = 30;
const INNER = 17;

/**
 * 로딩 진행 칸. 마름모 하나가 로딩 단계 하나다.
 *
 * 퍼센트 막대 대신 칸을 쓰는 이유는, 실제로 기다리는 대상이 파일 다섯 무리라서 남은 양보다
 * "몇 개 남았는지"가 정확하기 때문이다. 모양은 하단 탭의 로비 아이콘과 같은 마름모이되, 끝을 살짝 세웠다.
 */
export class LoadingDiamonds extends Phaser.GameObjects.Container {
  private readonly marks: Phaser.GameObjects.Star[] = [];
  private filled = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, count: number) {
    super(scene, x, y);
    const left = -((count - 1) * GAP) / 2;
    for (let i = 0; i < count; i++) {
      const mark = scene.add
        .star(left + i * GAP, 0, 4, INNER, OUTER, COLOR.panel)
        .setStrokeStyle(3, COLOR.panelEdge);
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
