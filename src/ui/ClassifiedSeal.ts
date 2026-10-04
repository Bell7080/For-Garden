import Phaser from "phaser";
import { COLOR, textStyle } from "./theme";
import { addPadlock } from "./Padlock";
import { chainLinks, type ChainLink } from "./chainLayout";

/** 기밀 칸의 높이 — 자물쇠와 글자가 서고 사슬이 그 뒤를 가로지를 만큼이다. */
export const CLASSIFIED_SEAL_HEIGHT = 250;

const LINK = { long: 30, short: 16, wide: 15, narrow: 8, line: 3 } as const;

function linkCorners(link: ChainLink): Phaser.Math.Vector2[] {
  const w = link.long ? LINK.long : LINK.short;
  const h = link.long ? LINK.wide : LINK.narrow;
  const cos = Math.cos(link.angle);
  const sin = Math.sin(link.angle);
  // 모서리를 깎아 둥글지 않게 한다 — 이 화면의 도형은 전부 각진 결이다.
  const cut = Math.min(w, h) * 0.3;
  const local: [number, number][] = [
    [-w / 2 + cut, -h / 2], [w / 2, -h / 2], [w / 2, h / 2 - cut], [w / 2 - cut, h / 2], [-w / 2, h / 2], [-w / 2, -h / 2 + cut],
  ];
  return local.map(([px, py]) => new Phaser.Math.Vector2(link.x + px * cos - py * sin, link.y + px * sin + py * cos));
}

/**
 * 열람이 막힌 기록 자리에 서는 「기밀」 표식 — 사슬 두 줄이 칸을 가로질러 교차하고 그 한가운데에 자물쇠와 낱말이 선다.
 * 판을 받치지 않는다: 사슬과 자물쇠의 검은 그림자만으로 밝은 원화 위에서도 떠오른다.
 */
export function addClassifiedSeal(scene: Phaser.Scene, width: number, label: string): Phaser.GameObjects.Container {
  const box = scene.add.container(0, 0);
  const halfW = width / 2 - 24;
  const halfH = CLASSIFIED_SEAL_HEIGHT / 2 - 18;
  const chains = scene.add.graphics();
  for (const [x1, y1, x2, y2] of [[-halfW, -halfH, halfW, halfH], [-halfW, halfH, halfW, -halfH]] as const) {
    for (const link of chainLinks(x1, y1, x2, y2)) {
      const corners = linkCorners(link);
      // 검은 복제를 한 겹 비껴 깔고 그 위에 사슬 색을 긋는다.
      chains.lineStyle(LINK.line + 2, 0x05070a, 0.55).strokePoints(corners.map((p) => new Phaser.Math.Vector2(p.x + 2, p.y + 3)), true);
      chains.lineStyle(LINK.line, COLOR.inkDimHex, 0.7).strokePoints(corners, true);
    }
  }
  box.add(chains);
  box.add(addPadlock(scene, 0, -34, 104, { color: COLOR.inkHex, shadow: true }));
  box.add(scene.add.text(0, 52, label, textStyle({ role: "display", size: 38, color: COLOR.ink, align: "center" })).setOrigin(0.5, 0.5));
  return box;
}
