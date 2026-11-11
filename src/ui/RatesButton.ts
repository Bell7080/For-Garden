import Phaser from "phaser";
import { drawGlyph, type GlyphName } from "./glyphs";
import { chipPoints, drawLayer } from "./holo";
import { pressIn, pressOut } from "./pressFeedback";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";
import { RATES_BUTTON } from "./ratesButtonLayout";

export { RATES_BUTTON, RATES_SPOT } from "./ratesButtonLayout";

export interface RatesButtonOptions {
  /** `left`면 x가 버튼 왼쪽 끝, `center`면 가운데다. 화면 가장자리에 붙일 때 왼쪽 끝을 맞춘다. */
  anchor?: "left" | "center";
  /** 판 폭의 상한. 넘치는 언어는 글자만 가로로 누른다(`squeezeTextToWidth`). */
  maxWidth?: number;
  /** `%` 대신 표식 칸에 세울 그림. 확률 버튼과 짝을 이루는 정보 버튼(연구 기록)이 같은 한 장을 쓰되 표식만 바꾼다. */
  glyph?: GlyphName;
}

/**
 * 확률 정보 버튼 — 확률형 보상(연구소·고고학·돌림판·랜덤 룬)이 있는 모든 화면이 같은 한 장을 쓴다.
 *
 * 예전에는 **작고 흐린 글줄**(`addRatesLink`)이었다 — 고르는 조작이 아니라 연구 버튼과 같은 무게로 눈을
 * 끌지 않게 하려던 것인데, 배경 원화 위에서 흐린 회색 글자가 통째로 묻혀 어디서 확률을 보는지 찾기
 * 어려웠다. 확률 공개는 반드시 찾을 수 있어야 하는 정보라, **어두운 판 위에 청록 `%` 표식과 흰 글자**로
 * 세운다. 색은 재화·보상의 금빛(상점 칩)과 갈라 놓은 정보의 청록이고, 크기는 주 조작(연구·돌리기)보다
 * 한참 작아 위계는 지킨다.
 */
export function addRatesButton(scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void, options: RatesButtonOptions = {}): Phaser.GameObjects.Container {
  const spec = RATES_BUTTON;
  const maxWidth = options.maxWidth ?? spec.maxWidth;
  const text = scene.add.text(0, 0, label, textStyle({ role: "emphasis", size: spec.font, color: COLOR.ink })).setOrigin(0, 0.5);
  const labelRoom = maxWidth - spec.padX * 2 - spec.icon - spec.gap;
  squeezeTextToWidth(text, labelRoom);
  const width = Math.min(maxWidth, spec.padX * 2 + spec.icon + spec.gap + text.displayWidth);
  const left = options.anchor === "center" ? -width / 2 : 0;
  const cx = left + width / 2;

  const button = scene.add.container(x, y);
  const plate = drawLayer(scene, cx, 0, chipPoints(width, spec.height, { bevel: { topLeft: spec.bevel, bottomRight: spec.bevel } }), {
    fill: spec.fill, alpha: spec.alpha, shadow: { x: 4, y: 6 }, edge: spec.tone, edgeWidth: 3,
    glow: { color: spec.tone, strength: 0.32, height: 0.7 },
  });
  const iconX = left + spec.padX + spec.icon / 2;
  const badge = drawLayer(scene, iconX, 0, chipPoints(spec.icon, spec.icon, { bevel: { topLeft: 8, bottomRight: 8 } }), { fill: spec.tone, alpha: 1, shadow: false });
  const mark = options.glyph
    ? drawGlyph(scene, options.glyph, iconX, 0, spec.icon * 0.66, 0x0b1a22, 1, 4)
    : scene.add.text(iconX, 1, "%", textStyle({ role: "display", size: spec.markFont, color: spec.markInk })).setOrigin(0.5);
  text.setPosition(left + spec.padX + spec.icon + spec.gap, 0);
  text.setStroke("#000000", 4);
  button.add([plate, badge, mark, text]);

  const hit = scene.add.rectangle(cx, 0, width + 16, Math.max(spec.height + 12, 72), 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => pressIn(button));
  hit.on("pointerout", () => pressOut(button, "normal", { pop: false }));
  hit.on("pointerup", () => { pressOut(button); onClick(); });
  button.add(hit);
  button.setSize(width, spec.height);
  return button;
}
