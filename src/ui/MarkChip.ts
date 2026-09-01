import Phaser from "phaser";
import { drawGlyph, type GlyphName } from "./glyphs";
import { chipPoints, drawLayer, HOLO } from "./holo";

/**
 * 켜고 끄는 작은 표식 칩.
 *
 * 즐겨찾기·애착·잠금처럼 "골라 두었나"만 말하는 표식은 글자 없이 칩 한 장으로 선다. 켜짐은
 * 저마다의 색, 꺼짐은 회색이고 누르면 커진다 — 색만으로 눌린 상태를 알리지 않는 화면 규칙을
 * 그대로 따른다. 화면마다 제 나름의 칩을 만들면 같은 표식이 어디서는 사각형, 어디서는
 * 아이콘 하나로 갈라진다.
 */
export const MARK_CHIP_OFF = 0x8b8f96;

/** 칩 하나를 다시 칠하는 손잡이. */
export interface MarkChipHandle {
  paint(on: boolean, enabled?: boolean): void;
  setVisible(visible: boolean): void;
}

export interface MarkChipOptions {
  glyph: GlyphName;
  /** 켜졌을 때의 색. 표식마다 다르다. */
  onColor: number;
  /** 칩 한 변. 정보창 헤더는 76, 쪽지 안의 작은 표식은 46 정도다. */
  size?: number;
  onToggle: () => void;
}

/** 칩 한 장을 만들어 부모에 붙인다. 초기 상태는 부르는 쪽이 `paint`로 정한다. */
export function addMarkChip(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, options: MarkChipOptions): MarkChipHandle {
  const size = options.size ?? 76;
  const container = scene.add.container(x, y);
  container.add(drawLayer(scene, 0, 0, chipPoints(size, size, {
    bevel: { topLeft: size * 0.3, topRight: 0, bottomRight: size * 0.3, bottomLeft: 0 },
  }), { fill: 0x121820, alpha: HOLO.glass }));
  let mark = drawGlyph(scene, options.glyph, 0, 0, size * 0.5, MARK_CHIP_OFF);
  container.add(mark);
  const hit = scene.add.rectangle(0, 0, size + 12, size + 12, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => container.setScale(1.12));
  hit.on("pointerout", () => container.setScale(1));
  hit.on("pointerup", () => { container.setScale(1); options.onToggle(); });
  container.add(hit);
  parent.add(container);
  return {
    paint: (on, enabled = true) => {
      mark.destroy();
      mark = drawGlyph(scene, options.glyph, 0, 0, size * 0.5, on ? options.onColor : MARK_CHIP_OFF);
      container.addAt(mark, 1);
      container.setAlpha(enabled ? 1 : 0.35);
      hit.setVisible(enabled);
    },
    setVisible: (visible) => container.setVisible(visible),
  };
}
