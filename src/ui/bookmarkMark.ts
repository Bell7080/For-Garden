import Phaser from "phaser";
import { COLOR } from "./theme";

/** 즐겨찾기 별의 뾰족한 실루엣을 만드는 전용 좌표 함수다. 각인 별과 구현을 공유하지 않는다. */
function bookmarkPoints(radius: number): Phaser.Geom.Point[] {
  const points: Phaser.Geom.Point[] = [];
  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const pointRadius = index % 2 === 0 ? radius : radius * 0.43;
    points.push(new Phaser.Geom.Point(Math.cos(angle) * pointRadius, Math.sin(angle) * pointRadius));
  }
  return points;
}

/**
 * 카드의 즐겨찾기만 나타내는 작은 별을 그린다.
 *
 * 진한 계단형 그림자를 먼저 어긋나게 찍고 홀로그램 강조색 면만 얹는다. 외곽선과 흐린 광택을
 * 쓰지 않아 희귀도 로마자 및 각인용 별과 시각적·구현상 의미가 섞이지 않는다.
 */
export function addBookmarkMark(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, size: number): Phaser.GameObjects.Graphics {
  const mark = scene.add.graphics({ x, y });
  const points = bookmarkPoints(size / 2);
  // 두 번 꺾여 내려가는 불투명 그림자가 기존 홀로그램 칩의 각진 깊이를 잇는다.
  mark.fillStyle(0x05070a, 0.9);
  mark.fillPoints(points.map((point) => new Phaser.Geom.Point(point.x + 6, point.y + 7)), true);
  mark.fillStyle(0x111722, 0.95);
  mark.fillPoints(points.map((point) => new Phaser.Geom.Point(point.x + 3, point.y + 4)), true);
  mark.fillStyle(COLOR.accent, 1);
  mark.fillPoints(points, true);
  parent.add(mark);
  return mark;
}
