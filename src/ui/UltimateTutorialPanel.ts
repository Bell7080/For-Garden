import Phaser from "phaser";
import type { RelicDef } from "../core/types";
import { t, type TextKey } from "../i18n";
import { chipPoints, drawLayer } from "./holo";
import { addSkillIconFrame, skillSlotLabel } from "./SkillIconFrame";
import { shrinkTextToWidth, fitTextToBox } from "./textFit";
import { COLOR, textStyle } from "./theme";

/**
 * 1-1에서 궁극기가 처음 찬 렐릭을 소개하는 쪽지.
 *
 * 글 한 줄("빛나는 카드를 눌러")만 띄우던 때는 **무엇을** 쓰는지가 화면에 없었다 — 셋이 저마다 다른 궁극기를
 * 갖는데 첫 판에서 그 차이를 볼 길이 없었다. 쪽지 한 장이 그 렐릭의 궁극기 그림·이름·한 줄 효과를 크게 세우고,
 * 밑동에서 몇 번째 소개인지 말한다. 판은 어두운 유리 위에 강조색 윗변 한 줄이고 테두리를 두르지 않는다.
 */
export const ULTIMATE_TUTORIAL_PANEL = { width: 940, height: 300, icon: 210, pad: 34 } as const;

/** 오프닝 편성의 한 줄 효과. 이 표에 없는 렐릭은 효과 줄 없이 이름만 선다. */
const ULTIMATE_TUTORIAL_DESC: Readonly<Record<string, TextKey>> = {
  torika: "battle.tutorial.ultimate.desc.torika",
  dodo: "battle.tutorial.ultimate.desc.dodo",
  parua: "battle.tutorial.ultimate.desc.parua",
};

export function ultimateTutorialDescKey(relicId: string): TextKey | undefined { return ULTIMATE_TUTORIAL_DESC[relicId]; }

export interface UltimateTutorialPanelOptions {
  x: number;
  /** 판의 가운데 y. */
  y: number;
  relic: RelicDef;
  /** 첫 소개만 궁극기가 무엇인지 한 줄을 판 위에 더 세운다. */
  intro: boolean;
  step: number;
  total: number;
  depth: number;
  reduceMotion: boolean;
}

export function addUltimateTutorialPanel(scene: Phaser.Scene, options: UltimateTutorialPanelOptions): Phaser.GameObjects.Container {
  const { width, height, icon, pad } = ULTIMATE_TUTORIAL_PANEL;
  const root = scene.add.container(options.x, options.y).setDepth(options.depth);
  const bevel = 30;
  const shape = chipPoints(width, height, { bevel: { topLeft: bevel, topRight: 0, bottomRight: bevel, bottomLeft: 0 } });
  // 판 아래로 강조색이 옅게 번져 어두운 막 위에서 판이 떠오른다.
  root.add(drawLayer(scene, 0, 0, shape, { fill: 0x0a0f17, alpha: 0.95, edge: COLOR.accent, edgeWidth: 5, glow: { color: COLOR.accent, strength: 0.16, height: 0.6 } }));

  const iconX = -width / 2 + pad + icon / 2;
  const frame = addSkillIconFrame(scene, {
    size: icon, slot: "ultimate", relicId: options.relic.id, element: options.relic.element, role: options.relic.role,
    label: skillSlotLabel("ultimate"),
    fallbackIcon: scene.textures.exists(options.relic.ultimate.iconAssetId ?? "") ? options.relic.ultimate.iconAssetId : undefined,
    enhanced: true,
  });
  frame.setPosition(iconX, 0);
  root.add(frame);

  const textLeft = iconX + icon / 2 + 36;
  const room = width / 2 - pad - textLeft;
  const descKey = ultimateTutorialDescKey(options.relic.id);
  const owner = scene.add.text(textLeft, 0, t("battle.tutorial.ultimate.owner", { name: options.relic.name }), textStyle({ role: "emphasis", size: 28, color: COLOR.inkDim }))
    .setOrigin(0, 0.5);
  const name = scene.add.text(textLeft, 0, options.relic.ultimate.name, textStyle({ role: "display", size: 50, color: COLOR.accentText }))
    .setOrigin(0, 0.5).setStroke("#05070a", 8);
  shrinkTextToWidth(name, room);
  const blocks: Phaser.GameObjects.Text[] = [owner, name];
  if (descKey) {
    const desc = scene.add.text(textLeft, 0, t(descKey), textStyle({ role: "body", size: 31, color: COLOR.ink, wrap: room, lineSpacing: 6 }))
      .setOrigin(0, 0.5);
    fitTextToBox(desc, { width: room, height: 112 });
    blocks.push(desc);
  }
  // 세 줄을 한 덩어리로 재서 판의 세로 가운데에 놓는다 — 효과 줄이 없는 렐릭도 쏠리지 않는다.
  const gap = 12;
  const total = blocks.reduce((sum, text) => sum + text.displayHeight, 0) + gap * (blocks.length - 1);
  let cursor = -total / 2;
  for (const text of blocks) {
    text.setY(cursor + text.displayHeight / 2);
    cursor += text.displayHeight + gap;
    root.add(text);
  }

  if (options.intro) {
    const intro = scene.add.text(0, -height / 2 - 62, t("battle.tutorial.ultimate.intro"), textStyle({ role: "display", size: 38, color: COLOR.ink, align: "center", wrap: width - 40 }))
      .setOrigin(0.5).setStroke("#05070a", 8);
    shrinkTextToWidth(intro, width - 40);
    root.add(intro);
  }
  const hint = scene.add.text(0, height / 2 + 52, t("battle.tutorial.ultimate.tap", { step: options.step, total: options.total }), textStyle({ role: "emphasis", size: 32, color: COLOR.accentText }))
    .setOrigin(0.5).setStroke("#05070a", 7);
  shrinkTextToWidth(hint, width);
  root.add(hint);

  if (!options.reduceMotion) {
    root.setAlpha(0).setScale(0.94);
    scene.tweens.add({ targets: root, alpha: 1, scale: 1, duration: 240, ease: "Back.Out" });
    scene.tweens.add({ targets: hint, alpha: 0.55, duration: 700, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  }
  return root;
}
