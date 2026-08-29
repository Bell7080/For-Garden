import Phaser from "phaser";
import { HOLO } from "./holo";
import type { AffinityDirection as Direction } from "../core/partyAffinity";

/** 상성 화살표의 상태색. 프리팹이 색과 겹침을 소유해 씬마다 다른 표식을 만들지 않게 한다. */
const DIRECTION_COLOR: Record<Exclude<Direction, "neutral">, number> = {
  up: 0x55d68b,
  down: 0xe15d64,
};

/**
 * 꼬리에 V자 홈을 낸 갈래 화살촉의 좌표. 홑겹 삼각형 대신 결기를 나눈 쐐기 모양을 써서 다른
 * 화면의 얇은 선 글리프와 달리 전장 위에서도 하나의 장비 표식처럼 읽힌다. `size`는 한 변의
 * 지름이고, 뾰족한 끝이 항상 위(음의 y)를 향한 좌표를 방향에 맞게 뒤집어 쓴다.
 */
function chevronPoints(size: number): number[] {
  const r = size / 2;
  return [
    0, -r,
    r * 0.62, -r * 0.06,
    r * 0.32, -r * 0.06,
    r * 0.32, r * 0.58,
    0, r * 0.3,
    -r * 0.32, r * 0.58,
    -r * 0.32, -r * 0.06,
    -r * 0.62, -r * 0.06,
  ];
}

/**
 * SD 위에서도 읽히는 상성 방향 표식.
 *
 * 사방을 두르는 흰 테두리 대신 이 화면의 홀로그램 규칙을 그대로 따른다 — 어두운 그림자,
 * 같은 계열의 옅은 발광, 뾰족한 끝(진행 방향의 변)에만 걸리는 얇은 강조선을 겹쳐 밝거나
 * 복잡한 배경에서도 방향을 즉시 구분한다.
 */
export class AffinityDirection extends Phaser.GameObjects.Container {
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly glow: Phaser.GameObjects.Graphics;
  private readonly face: Phaser.GameObjects.Graphics;
  private readonly edge: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly size = 54) {
    super(scene, x, y);
    scene.add.existing(this);
    this.shadow = scene.add.graphics({ x: HOLO.shadow.x * 0.5, y: HOLO.shadow.y * 0.5 });
    this.glow = scene.add.graphics();
    this.face = scene.add.graphics();
    this.edge = scene.add.graphics();
    this.add([this.shadow, this.glow, this.face, this.edge]);
    this.setVisible(false);
  }

  /** 중립은 아무 라벨도 남기지 않고 컨테이너 전체를 숨긴다. */
  setDirection(direction: Direction): this {
    if (direction === "neutral") return this.setVisible(false);
    const color = DIRECTION_COLOR[direction];
    // 기본 좌표는 뾰족한 끝이 위를 향하므로, 아래쪽 방향에서만 y를 뒤집는다.
    const sign = direction === "up" ? 1 : -1;
    const points = chevronPoints(this.size).map((value, i) => (i % 2 === 0 ? value : value * sign));
    const geom = (scale: number): Phaser.Geom.Point[] => {
      const pts: Phaser.Geom.Point[] = [];
      for (let i = 0; i < points.length; i += 2) pts.push(new Phaser.Geom.Point(points[i] * scale, points[i + 1] * scale));
      return pts;
    };

    this.shadow.clear().fillStyle(0x02040a, HOLO.shadow.alpha).fillPoints(geom(1.3), true);

    // 흰 테두리 대신 같은 색을 겹쳐 아래로 옅어지는 발광으로 경계를 만든다.
    this.glow.clear();
    const glowBands = 4;
    for (let i = glowBands; i >= 1; i -= 1) {
      this.glow.fillStyle(color, 0.16 / i);
      this.glow.fillPoints(geom(1.14 + i * 0.05), true);
    }

    this.face.clear().fillStyle(color, 1).fillPoints(geom(1), true);

    // 진행 방향(뾰족한 끝)의 두 변에만 밝은 강조선을 걸어, 사방을 두르지 않고도 끝을 또렷하게 한다.
    const tip = geom(1)[0];
    const shoulders = [geom(1)[1], geom(1)[7]];
    this.edge.clear().lineStyle(2, 0xffffff, 0.85);
    this.edge.lineBetween(shoulders[0].x, shoulders[0].y, tip.x, tip.y);
    this.edge.lineBetween(tip.x, tip.y, shoulders[1].x, shoulders[1].y);

    return this.setVisible(true);
  }
}
