import Phaser from "phaser";
import { slantedRect, toPoints } from "./holo";

/**
 * 전장의 SD 머리 위에 뜨는 체력 바.
 *
 * 배경 원화가 밝고 복잡해서 얇은 사각형 두 장으로는 바닥에 묻힌다. 그래서 ① 아래로 한 겹
 * 복제해 깔고, ② 몸통을 `/`로 깎고, ③ 흰 선으로 칸을 나누고, ④ 왼쪽 끝에 두꺼운 빗금을
 * 하나 세운다. 네 겹이 함께 있어야 배경에서 떨어져 나온 물건처럼 보인다.
 *
 * 값은 **스르륵** 따라온다. 깎이는 순간이 보이지 않으면 얼마나 아팠는지 알 수 없어서다.
 */
const BAR = {
  width: 96,
  height: 11,
  /** `/` 기울기. 몸통·복제·칸 나눔이 모두 같은 각을 쓴다. */
  slant: 7,
  /** 왼쪽 끝 빗금의 두께와 몸통에서 띄우는 간격. */
  cap: { width: 7, gap: 5 },
  /** 칸을 나누는 흰 선의 개수(칸 수는 이보다 하나 많다). */
  ticks: 3,
  /** 값이 목표를 따라잡는 빠르기(초당 비율). 클수록 빨리 붙는다. */
  ease: 6,
} as const;

export class UnitHealthBar extends Phaser.GameObjects.Container {
  private readonly graph: Phaser.GameObjects.Graphics;
  private target = 1;
  private shown = 1;

  constructor(scene: Phaser.Scene, private readonly color: number) {
    super(scene, 0, 0);
    this.graph = scene.add.graphics();
    this.add(this.graph);
    scene.add.existing(this);
    this.paint();
  }

  /** 목표 비율만 바꾼다. 실제로 그리는 값은 `update`가 따라붙인다. */
  setValue(ratio: number): this {
    this.target = Phaser.Math.Clamp(ratio, 0, 1);
    return this;
  }

  /** 지금 값을 목표로 즉시 맞춘다. 전투 시작처럼 이어 보일 필요가 없는 순간에만 쓴다. */
  snap(ratio: number): this {
    this.target = Phaser.Math.Clamp(ratio, 0, 1);
    this.shown = this.target;
    this.paint();
    return this;
  }

  /** 매 프레임 조금씩 목표에 다가간다. `delta`는 밀리초다. */
  step(delta: number): void {
    if (Math.abs(this.shown - this.target) < 0.0015) {
      if (this.shown === this.target) return;
      this.shown = this.target;
    } else {
      this.shown += (this.target - this.shown) * Math.min(1, (delta / 1000) * BAR.ease);
    }
    this.paint();
  }

  private paint(): void {
    const { width, height, slant, cap, ticks } = BAR;
    const body = toPoints(slantedRect(width, height, slant));
    this.graph.clear();
    // 복제 그림자. 몸통과 같은 모양을 아래로 밀어 깔면 바가 배경에서 한 겹 떠오른다.
    this.graph.fillStyle(0x05070a, 0.8);
    this.graph.fillPoints(body.map((point) => new Phaser.Geom.Point(point.x + 2, point.y + 4)), true);
    this.graph.fillStyle(0x0b1018, 0.92);
    this.graph.fillPoints(body, true);
    // 채움은 왼쪽 끝에서 자란다. 같은 기울기로 잘라야 몸통과 한 조각으로 보인다.
    const filled = width * this.shown;
    if (filled > 0.5) {
      const left = -width / 2;
      const s = slant / 2;
      this.graph.fillStyle(this.color, 1);
      this.graph.fillPoints([
        new Phaser.Geom.Point(left + s, -height / 2),
        new Phaser.Geom.Point(left + filled + s, -height / 2),
        new Phaser.Geom.Point(left + filled - s, height / 2),
        new Phaser.Geom.Point(left - s, height / 2),
      ], true);
    }
    // 칸을 나누는 흰 선. 얼마나 깎였는지를 눈금으로 셈할 수 있게 한다.
    this.graph.lineStyle(2, 0xffffff, 0.5);
    for (let i = 1; i <= ticks; i += 1) {
      const x = -width / 2 + (width * i) / (ticks + 1);
      this.graph.lineBetween(x + slant / 2, -height / 2, x - slant / 2, height / 2);
    }
    // 왼쪽 끝의 두꺼운 빗금. 바가 어디서 시작하는지 못을 박아 준다.
    this.graph.fillStyle(0x05070a, 0.8);
    this.graph.fillPoints(toPoints(slantedRect(cap.width, height, slant)).map((point) =>
      new Phaser.Geom.Point(point.x - width / 2 - cap.gap + 2, point.y + 4)), true);
    this.graph.fillStyle(this.color, 1);
    this.graph.fillPoints(toPoints(slantedRect(cap.width, height, slant)).map((point) =>
      new Phaser.Geom.Point(point.x - width / 2 - cap.gap, point.y)), true);
  }
}
