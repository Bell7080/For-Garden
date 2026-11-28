import Phaser from "phaser";
import { t } from "../i18n";
import { drawGlyph } from "./glyphs";
import { drawLayer, slantedRect } from "./holo";
import { pressIn, pressOut } from "./pressFeedback";
import { squeezeTextToWidth } from "./textFit";
import { textStyle } from "./theme";

/**
 * 「초기화」 칩 한 장 — 정보창의 레벨 초기화와 유대 각성 초기화가 같은 생김새를 쓴다(응태 2026-11-28).
 *
 * 유대 각성 칩처럼 제 색(붉은빛)으로 물든 판 + 같은 색 테두리 + 물든 글자다. 회색 판에 흰 글자였을 때는
 * 옆의 각성 칩보다 한 단계 덜 만든 버튼으로 읽혔다. 「무료」 같은 값은 적지 않는다 — 값은 확인 창이 말한다.
 */
export const RESET_CHIP_STYLE = { fill: 0x2a1416, edge: 0xff6b5e, edgeAlpha: 0.75, text: "#ffb8ae", icon: 0xff8a7d } as const;

export interface ResetChipSpec {
  width: number;
  height: number;
  icon: number;
  size: number;
}

export function addResetChip(
  scene: Phaser.Scene,
  x: number, y: number,
  spec: ResetChipSpec,
  onTap: () => void,
): Phaser.GameObjects.Container {
  const S = RESET_CHIP_STYLE;
  const container = scene.add.container(x, y);
  container.add(drawLayer(scene, 0, 0, slantedRect(spec.width, spec.height, 8), { fill: S.fill, alpha: 0.92, edge: S.edge, edgeAlpha: S.edgeAlpha }));
  const label = scene.add.text(0, 0, t("info.reset"), textStyle({ role: "emphasis", size: spec.size, color: S.text })).setOrigin(0, 0.5);
  const icon = drawGlyph(scene, "restore", 0, 0, spec.icon, S.icon, 1, 3);
  squeezeTextToWidth(label, spec.width - 28 - spec.icon - 6);
  const total = spec.icon + 6 + label.displayWidth;
  icon.setX(-total / 2 + spec.icon / 2);
  label.setX(-total / 2 + spec.icon + 6);
  container.add([icon, label]);
  const hit = scene.add.rectangle(0, 0, spec.width + 12, spec.height + 16, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => pressIn(container));
  hit.on("pointerout", () => pressOut(container, "normal", { pop: false }));
  hit.on("pointerup", () => { pressOut(container); onTap(); });
  container.add(hit);
  return container;
}
