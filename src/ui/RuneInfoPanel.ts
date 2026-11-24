import Phaser from "phaser";
import { t } from "../i18n";
import { getRelic } from "../data/relics";
import { formatRuneOptionValue, runeDisplayName, runeOptionValue, runePartLabel, runeRarityLabel, type RuneInstance, type RuneStatKey } from "../core/runes";
import { addClippedHit } from "./clippedHit";
import { chipPoints, drawHairline, drawLayer } from "./holo";
import { pressIn, pressOut } from "./pressFeedback";
import { addRuneFrame, RUNE_ACCENT, runeAccentCss } from "./runeIcons";
import { equippedRuneSlot, runeStatLabel } from "./RunePopup";
import { addRuneSocket } from "./RuneSocket";
import { RUNE_SELECT } from "./runeSelectLayout";
import { runeTraitView } from "./runeTraitPresentation";
import { isTap } from "./tapGuard";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/**
 * 고른 룬의 정보 판 한 장 — 특성 연구·합성의 고르기 판과 가방 룬 탭이 같은 함수를 쓴다.
 *
 * 액자(누르면 룬 쪽지) · 등급·자리 · 장착 중이면 그 렐릭 · 이름 · 주 옵션(왼쪽)·보조 옵션(오른쪽) · 특성.
 * 고르기 전에는 같은 판에 빈 액자와 한 줄만 선다(판이 사라지면 아래 목록이 오르내린다).
 */
export interface RuneInfoPanelOptions {
  /** 판 폭과 윗변(부모 기준). 높이는 `RUNE_SELECT.infoHeight`다. */
  width: number;
  top: number;
  rune: RuneInstance | undefined;
  /** 고르기 전의 한 줄. */
  hint: string;
  /** 액자를 눌러도 되는가(판이 맨 위인가). */
  canOpen: () => boolean;
  openNote: (id: string) => void;
}

const hex = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;

export function paintRuneInfoPanel(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, options: RuneInfoPanelOptions): void {
  layer.removeAll(true);
  const S = RUNE_SELECT;
  const { width, top: panelTop, rune } = options;
  const height = S.infoHeight;
  const cy = panelTop + height / 2;
  const accent = rune ? RUNE_ACCENT[rune.rarity] : COLOR.accent;
  layer.add(drawLayer(scene, 0, cy, chipPoints(width, height, { bevel: { topLeft: height * 0.16, topRight: 0, bottomRight: height * 0.16, bottomLeft: 0 } }),
    { fill: 0x0a0e14, alpha: 0.9, edge: accent, edgeAlpha: rune ? 0.7 : 0.35 }));
  const left = -width / 2 + S.infoPad;
  const iconX = left + S.icon / 2 + 10;
  if (!rune) {
    layer.add(addRuneSocket(scene, iconX, cy, S.icon, COLOR.accent).setAlpha(0.6));
    layer.add(scene.add.text(iconX + S.icon / 2 + 30, cy, options.hint, textStyle({ role: "emphasis", size: 28, color: COLOR.accentText, wrap: width - S.icon - S.infoPad * 2 - 60 })).setOrigin(0, 0.5));
    return;
  }

  const icon = addRuneFrame(scene, iconX, cy, S.icon, rune.rarity, rune.part, { mainStats: rune.mainStats, engraved: rune.engravings.length > 0 });
  layer.add(icon);
  // 액자를 누르면 그 룬의 쪽지 — 세공·잠금·판매까지 거기서 한다(정비 창의 비교 판 그림과 같은 길).
  const iconHit = addClippedHit(scene, icon, 0, 0, S.icon, S.icon, () => ({ left: -Infinity, right: Infinity, top: -Infinity, bottom: Infinity }));
  iconHit.on("pointerdown", () => pressIn(icon));
  iconHit.on("pointerout", () => pressOut(icon, "normal", { pop: false }));
  iconHit.on("pointerup", (pointer: Phaser.Input.Pointer) => { pressOut(icon); if (isTap(pointer) && options.canOpen()) options.openNote(rune.instanceId); });

  const textX = iconX + S.icon / 2 + 26;
  const right = width / 2 - S.infoPad;
  const room = right - textX;
  const top = panelTop + S.infoPad - 4;
  layer.add(scene.add.text(textX, top, `${runeRarityLabel(rune.rarity)}  ·  ${runePartLabel(rune.part)}`,
    textStyle({ role: "emphasis", size: 21, color: hex(accent) })).setOrigin(0, 0));
  const holder = equippedRuneSlot(rune.instanceId);
  if (holder) {
    const equipped = scene.add.text(right, top, t("rune.equippedBy", { name: getRelic(holder.relicId).name }),
      textStyle({ role: "emphasis", size: 20, color: COLOR.shieldText })).setOrigin(1, 0);
    squeezeTextToWidth(equipped, room * 0.5);
    layer.add(equipped);
  }
  const name = scene.add.text(textX, top + 30, runeDisplayName(rune), textStyle({ role: "display", size: 32, color: runeAccentCss(rune.rarity) })).setOrigin(0, 0).setStroke("#05070a", 4);
  squeezeTextToWidth(name, room);
  layer.add(name);
  layer.add(drawHairline(scene, (textX + right) / 2, top + 78, room, { color: accent, alpha: 0.4 }));

  // 옵션은 두 갈래 — 왼쪽이 주 옵션(굵게), 오른쪽이 보조 옵션(흐리게).
  const column = room / 2;
  const statTop = top + 96;
  const line = 31;
  const statLine = (x: number, y: number, key: RuneStatKey, main: boolean): void => {
    const text = scene.add.text(x, y, runeStatLabel(key) + "  " + formatRuneOptionValue(key, runeOptionValue(rune, key)), main
      ? textStyle({ role: "emphasis", size: 22, color: COLOR.ink })
      : textStyle({ role: "body", size: 21, color: COLOR.inkDim })).setOrigin(0, 0);
    squeezeTextToWidth(text, column - 16);
    layer.add(text);
  };
  rune.mainStats.forEach(({ key }, i) => statLine(textX, statTop + i * line, key, true));
  rune.subStats.slice(0, 3).forEach(({ key }, i) => statLine(textX + column, statTop + i * line, key, false));

  const traitY = panelTop + height - S.infoPad - 6;
  if (rune.trait) {
    const view = runeTraitView(rune.trait);
    const grade = scene.add.text(textX, traitY, `[${view.gradeLabel}]`, textStyle({ role: "emphasis", size: 23, color: hex(RUNE_ACCENT[rune.trait.grade]) })).setOrigin(0, 1);
    const traitName = scene.add.text(textX + grade.width + 10, traitY, view.name, textStyle({ role: "display", size: 25, color: COLOR.ink })).setOrigin(0, 1);
    squeezeTextToWidth(traitName, room - grade.width - 10);
    layer.add([grade, traitName]);
  } else {
    layer.add(scene.add.text(textX, traitY, t("rune.trait.none"), textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0, 1));
  }
}
