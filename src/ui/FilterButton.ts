import Phaser from "phaser";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawLayer, slantedRect, toPoints } from "./holo";
import { pressIn, pressOut } from "./pressFeedback";
import { CONTROL_BAR as BAR } from "./SortControl";
import { COLOR, textStyle } from "./theme";

export interface FilterButton {
  readonly container: Phaser.GameObjects.Container;
  /** 걸린 조건 수를 다시 적는다. 0이면 표식 자체가 사라진다. */
  setCount(count: number): void;
}

/**
 * 목록 조작 줄 왼쪽 끝의 필터 칩 — 깔때기 그림 하나와 걸린 조건 수의 붉은 표식.
 *
 * 편성 목록(`RosterControls`)과 룬 목록(`RuneListControls`)이 같은 한 장을 쓴다. 무엇이 걸렸는지는
 * 표식이 아니라 눌러서 여는 판이 말한다. 누르는 면은 보이는 칩보다 한 뼘 넓다 — 엄지가 칩 가장자리를
 * 빗나가지 않게.
 */
export function addFilterButton(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  spot: { x: number; y: number; width: number; height: number },
  onClick: () => void,
): FilterButton {
  const { width, height } = spot;
  const filter = scene.add.container(spot.x, spot.y);
  const shape = chipPoints(width, height, { bevel: { topLeft: height * 0.26, topRight: 0, bottomRight: height * 0.26, bottomLeft: 0 } });
  filter.add(drawLayer(scene, 0, 0, shape, { fill: BAR.fill, alpha: BAR.alpha }));
  filter.add(drawGlyph(scene, "filter", 0, 2, Math.round(height * 0.54), COLOR.accent, 0.95, 3));
  const badge = scene.add.container(width / 2 - 10, -height / 2 + 10);
  const plate = scene.add.graphics();
  plate.fillStyle(0xe23a46, 1);
  plate.fillPoints(toPoints(slantedRect(28, 24, 6)), true);
  const badgeText = scene.add.text(0, 0, "", textStyle({ role: "display", size: 17, color: COLOR.ink })).setOrigin(0.5);
  badge.add([plate, badgeText]);
  filter.add(badge);
  const hit = scene.add.rectangle(0, 0, width + 16, height + 16, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => pressIn(filter));
  hit.on("pointerout", () => pressOut(filter, "normal", { pop: false }));
  hit.on("pointerup", () => { pressOut(filter); onClick(); });
  filter.add(hit);
  parent.add(filter);
  const setCount = (count: number): void => {
    badge.setVisible(count > 0);
    badgeText.setText(String(count));
  };
  setCount(0);
  return { container: filter, setCount };
}
