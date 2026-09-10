import Phaser from "phaser";
import { COLOR, textStyle } from "./theme";

/**
 * SD 아래에 서는 이름줄 — `LV.n` + 이름.
 *
 * 카드의 이름줄과 같은 규칙이다: **레벨은 강조색, 이름은 흰색.** 둘을 같은 색으로 적으면 한
 * 덩어리로 뭉쳐 어디까지가 수이고 어디부터가 이름인지 읽는 데 한 박자가 든다. 밝은 배경 원화나
 * 전장 위에 서므로 두 글자 모두 검은 획을 둘러 배경에서 떼어 놓는다.
 *
 * 두 글자를 각자 가운데에 맞추지 않고 **한 덩어리로** 가운데에 세운다 — 따로 맞추면 레벨
 * 자릿수가 늘 때 이름이 옆으로 밀린다.
 */
export function addUnitNameplate(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container | undefined,
  x: number,
  y: number,
  level: number,
  name: string,
  size: number,
): void {
  const level0 = scene.add.text(0, y, `LV.${level}`, textStyle({ role: "display", size, color: COLOR.accentText })).setOrigin(0, 0);
  const name0 = scene.add.text(0, y, name, textStyle({ role: "display", size, color: COLOR.ink })).setOrigin(0, 0);
  for (const text of [level0, name0]) text.setStroke("#05070a", 4).setShadow(0, 2, "#05070a", 3, true, true);
  const gap = size * 0.42;
  const startX = x - (level0.width + gap + name0.width) / 2;
  level0.setX(startX);
  name0.setX(startX + level0.width + gap);
  if (parent) parent.add([level0, name0]);
}
