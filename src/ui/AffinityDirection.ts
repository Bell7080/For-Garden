import Phaser from "phaser";
import type { AffinityDirection as Direction } from "../core/partyAffinity";

/** 상성 화살표의 상태색. 프리팹이 색과 겹침을 소유해 씬마다 다른 표식을 만들지 않게 한다. */
const DIRECTION_COLOR: Record<Exclude<Direction, "neutral">, number> = {
  up: 0x55d68b,
  down: 0xe15d64,
};

/**
 * SD 위에서도 읽히는 상성 방향 표식.
 *
 * 테마 규칙상 씬은 삼각형을 직접 그리지 않는다. 이 프리팹 안에서만 어두운 그림자, 같은 계열의
 * 약한 발광, 흰 테두리, 색 면을 차례로 겹쳐 밝거나 복잡한 배경에서도 방향을 즉시 구분한다.
 */
export class AffinityDirection extends Phaser.GameObjects.Container {
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly glow: Phaser.GameObjects.Graphics;
  private readonly outline: Phaser.GameObjects.Graphics;
  private readonly face: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly size = 54) {
    super(scene, x, y);
    scene.add.existing(this);
    this.shadow = scene.add.graphics({ x: 3, y: 5 });
    this.glow = scene.add.graphics();
    this.outline = scene.add.graphics();
    this.face = scene.add.graphics();
    this.add([this.shadow, this.glow, this.outline, this.face]);
    this.setVisible(false);
  }

  /** 중립은 아무 라벨도 남기지 않고 컨테이너 전체를 숨긴다. */
  setDirection(direction: Direction): this {
    if (direction === "neutral") return this.setVisible(false);
    const color = DIRECTION_COLOR[direction];
    const sign = direction === "up" ? -1 : 1;
    const points = [
      new Phaser.Geom.Point(0, sign * this.size * 0.5),
      new Phaser.Geom.Point(this.size * 0.48, sign * -this.size * 0.42),
      new Phaser.Geom.Point(-this.size * 0.48, sign * -this.size * 0.42),
    ];
    const paint = (graphics: Phaser.GameObjects.Graphics, fill: number, alpha: number, scale: number): void => {
      graphics.clear().fillStyle(fill, alpha);
      graphics.fillPoints(points.map((point) => new Phaser.Geom.Point(point.x * scale, point.y * scale)), true);
    };
    paint(this.shadow, 0x02040a, 0.82, 1.34);
    paint(this.glow, color, 0.2, 1.28);
    paint(this.outline, 0xffffff, 0.96, 1.13);
    paint(this.face, color, 1, 0.92);
    return this.setVisible(true);
  }
}
