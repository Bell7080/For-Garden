import Phaser from "phaser";
import { addClippedHit } from "./clippedHit";
import type { ClipRect } from "./clipRect";
import { drawLayer, drawShapeEdge, slantedRect } from "./holo";
import { pressIn, pressOut } from "./pressFeedback";
import { squeezeTextToWidth } from "./textFit";
import { CONFIRM_DIALOG } from "./confirmDialogLayout";
import { COLOR, textStyle } from "./theme";

/** 조작 줄의 칩 한 장 — 필터·방식·하위 탭이 같은 손짓으로 같은 일(보는 것을 고르기)을 하므로 한 장이다. */
export function addFriendChip(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number, y: number, width: number, height: number,
  label: string, selected: boolean, onTap: () => void,
): Phaser.GameObjects.Container {
  const chip = scene.add.container(x, y);
  const shape = slantedRect(width, height, 14);
  chip.add(drawLayer(scene, 0, 0, shape, { fill: selected ? 0x1b2836 : 0x080d13, alpha: selected ? 0.98 : 0.8 }));
  // 켜진 칩만 윗변에 강조선이 흐른다 — 사방 외곽선을 두르지 않는다.
  if (selected) chip.add(drawShapeEdge(scene, 0, 0, shape, "top", { color: COLOR.accent, alpha: 0.95, width: 3 }));
  const text = scene.add.text(0, 1, label, (selected ? textStyle({ role: "display", size: 28, color: COLOR.accentText }) : textStyle({ role: "emphasis", size: 28, color: COLOR.inkDim }))).setOrigin(0.5);
  chip.add(squeezeTextToWidth(text, width - 24));
  const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => pressIn(chip));
  hit.on("pointerout", () => pressOut(chip, "normal", { pop: false }));
  hit.on("pointerup", () => { pressOut(chip); onTap(); });
  chip.add(hit);
  parent.add(chip);
  return chip;
}

export type RowButtonTone = "accent" | "neutral" | "danger" | "disabled";

const TONE = {
  accent: { fill: 0x2b2a1b, edge: COLOR.accent, edgeAlpha: 0.95, text: COLOR.accentText },
  neutral: { fill: 0x1b2029, edge: COLOR.panelEdge, edgeAlpha: 0.7, text: COLOR.ink },
  danger: { fill: CONFIRM_DIALOG.destructiveFill, edge: COLOR.danger, edgeAlpha: 0.95, text: COLOR.ink },
  disabled: { fill: 0x0d1218, edge: COLOR.panelEdge, edgeAlpha: 0.3, text: COLOR.inkDim },
} as const;

/**
 * 목록 줄 안의 작은 버튼. 목록이 스크롤 창 밖으로 밀려 나가도 창 밖에서는 손을 받지 않도록
 * 입력면을 `addClippedHit`으로 세운다. `canTap`은 끌어서 스크롤한 손이 버튼을 누른 것으로 읽히지 않게 막는다.
 */
export function addRowButton(
  scene: Phaser.Scene,
  row: Phaser.GameObjects.Container,
  x: number, y: number, width: number, height: number,
  label: string, tone: RowButtonTone,
  clip: () => ClipRect, canTap: () => boolean, onTap: () => void,
): Phaser.GameObjects.Container {
  const style = TONE[tone];
  const button = scene.add.container(x, y);
  const shape = slantedRect(width, height, 14);
  button.add(drawLayer(scene, 0, 0, shape, { fill: style.fill, alpha: 0.94 }));
  button.add(drawShapeEdge(scene, 0, 0, shape, "top", { color: style.edge, alpha: style.edgeAlpha, width: 3 }));
  button.add(squeezeTextToWidth(scene.add.text(0, 1, label, textStyle({ role: "display", size: 28, color: style.text })).setOrigin(0.5), width - 20));
  row.add(button);
  if (tone === "disabled") return button;
  const hit = addClippedHit(scene, button, 0, 0, width, height, clip);
  hit.on("pointerdown", () => pressIn(button));
  hit.on("pointerout", () => pressOut(button, "normal", { pop: false }));
  hit.on("pointerup", () => { pressOut(button); if (canTap()) onTap(); });
  return button;
}
