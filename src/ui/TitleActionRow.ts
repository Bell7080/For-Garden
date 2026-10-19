import Phaser from "phaser";
import { chipPoints, drawLayer, HOLO } from "./holo";
import { drawGlyph, type GlyphName } from "./glyphs";
import { COLOR, textStyle } from "./theme";
import { activeFontFamily } from "./fonts";
import { pressIn, pressOut } from "./pressFeedback";
import { squeezeTextToWidth } from "./textFit";
import { TITLE_ACTION_ROW, titleActionSlots, titleActionContent } from "./titleActionLayout";

export interface TitleAction {
  readonly icon: GlyphName;
  /** 언어가 바뀔 때마다 다시 부른다. 고정 문장을 들고 있지 않는다. */
  readonly label: () => string;
  readonly onClick: () => void;
}

/**
 * 타이틀 하단의 버튼 줄. 언어 변경을 시작으로 로그인·계정 전환이 같은 줄에 붙는다.
 *
 * 로비 레일 칩과 같은 어두운 유리 판(깎인 두 모서리 + 윗변 강조선)에 아이콘과 라벨을 올린다.
 * 판때기를 따로 깔지 않으므로 배경 원화는 그대로 비친다.
 */
export class TitleActionRow {
  private readonly labels: Array<{ text: Phaser.GameObjects.Text; read: () => string; width: number }> = [];

  constructor(scene: Phaser.Scene, actions: readonly TitleAction[]) {
    const slots = titleActionSlots(actions.length);
    const { height, centerY } = TITLE_ACTION_ROW;
    actions.slice(0, slots.length).forEach((action, i) => {
      const slot = slots[i];
      const node = scene.add.container(slot.x, centerY);
      node.add(drawLayer(scene, 0, 0, chipPoints(slot.width, height, {
        bevel: { topLeft: height * 0.3, topRight: 0, bottomRight: height * 0.3, bottomLeft: 0 },
      }), { fill: 0x1a1f27, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.55 }));
      const content = titleActionContent(slot.width);
      node.add(drawGlyph(scene, action.icon, content.iconX, 0, 30, COLOR.accent));
      const text = scene.add.text(content.labelX, 0, action.label(), textStyle({ role: "emphasis", size: 26 })).setOrigin(0.5);
      const room = content.labelWidth;
      squeezeTextToWidth(text, room, 0.7);
      node.add(text);
      this.labels.push({ text, read: action.label, width: room });
      const hit = scene.add.rectangle(0, 0, slot.width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => pressIn(node));
      hit.on("pointerout", () => pressOut(node, "normal", { pop: false }));
      hit.on("pointerup", () => {
        pressOut(node);
        action.onClick();
      });
      node.add(hit);
    });
  }

  /** 언어가 바뀐 뒤 라벨과 글꼴을 갈아 끼운다. 버튼은 다시 세우지 않는다. */
  relocalize(): void {
    this.labels.forEach(({ text, read, width }) => {
      text.setScale(1, 1).setFontFamily(activeFontFamily()).setText(read());
      squeezeTextToWidth(text, width, 0.7);
    });
  }
}
