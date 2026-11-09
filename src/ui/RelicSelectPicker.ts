import Phaser from "phaser";
import { t } from "../i18n";
import { PLAYABLE_RELICS } from "../data/relics";
import { BREAKTHROUGH_CAP } from "../core/relicProgression";
import { relicFragmentRoom } from "../core/relicResonance";
import { session } from "../state/session";
import { FaceFrame } from "./FaceFrame";
import type { PopupLayer } from "./PopupLayer";
import { pressIn, pressOut } from "./pressFeedback";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/** SR 선택권의 결 — 7일 가이드 마디와 가방의 선택권이 같은 보랏빛을 쓴다. */
export const SR_SELECT_TONE = 0xc89cff;

function hex(color: number): string { return `#${color.toString(16).padStart(6, "0")}`; }

/**
 * 렐릭 선택권의 고르기 창 — 7일 성장 가이드의 SR 마디와 가방의 SR 렐릭 선택권이 같은 한 장을 연다.
 *
 * 고를 수 있는 렐릭이 얼굴 액자로 늘어서고, 하나를 누르면 확인 창이 묻는다. 이미 함께하는 렐릭은 파편 한 장이고
 * 돌파를 끝낸 렐릭은 흐리게만 선다 — 같은 판정을 서버(`assertRelicSelectable`)가 다시 한다.
 */
export function openRelicSelectPicker(scene: Phaser.Scene, popups: PopupLayer, choices: readonly string[], onPick: (relicId: string) => void): void {
  const columns = 4;
  const cell = 176;
  const gapX = 30;
  const rowHeight = cell + 86;
  const rows = Math.ceil(choices.length / columns);
  const width = columns * cell + (columns - 1) * gapX + 140;
  const height = 220 + rows * rowHeight + 60;
  popups.open({ width, height, title: t("newbieGrowth.sr.title"), dim: true, dimAlpha: 0.78, closeOnBackdrop: true, backButton: true }, (body, close) => {
    const hint = scene.add.text(0, -height / 2 + 120, t("newbieGrowth.sr.hint"), textStyle({ role: "body", size: 25, color: COLOR.inkDim, align: "center", wrap: width - 120 })).setOrigin(0.5);
    body.add(hint);
    const top = -height / 2 + 200;
    choices.forEach((relicId, index) => {
      const def = PLAYABLE_RELICS.find((relic) => relic.id === relicId);
      if (!def) return;
      const column = index % columns;
      const rowIndex = Math.floor(index / columns);
      const inRow = Math.min(columns, choices.length - rowIndex * columns);
      const rowWidth = inRow * cell + (inRow - 1) * gapX;
      const x = -rowWidth / 2 + cell / 2 + column * (cell + gapX);
      const y = top + rowIndex * rowHeight + cell / 2;
      const owned = session.owned.has(relicId);
      const progress = session.relicProgress[relicId];
      // 돌파·공명에 쓸 파편을 다 갖춘 렐릭만 막는다 — 서버(`assertRelicSelectable`)와 같은 값이다.
      const maxed = owned && relicFragmentRoom(def.rarity, progress, session.relicFragments[relicId] ?? 0, BREAKTHROUGH_CAP) <= 0;
      const item = scene.add.container(x, y);
      body.add(item);
      const frame = new FaceFrame(scene, 0, 0, { portraitAssetId: def.portraitAssetId, size: cell, color: maxed ? 0x68717d : SR_SELECT_TONE });
      if (maxed) frame.setAlpha(0.4);
      item.add(frame);
      const name = scene.add.text(0, cell / 2 + 26, def.name, textStyle({ role: "display", size: 26, color: maxed ? COLOR.inkDim : COLOR.ink })).setOrigin(0.5);
      squeezeTextToWidth(name, cell + 20);
      item.add(name);
      if (owned) item.add(scene.add.text(0, cell / 2 + 58, t(maxed ? "newbieGrowth.sr.maxed" : "newbieGrowth.sr.owned"), textStyle({ role: "emphasis", size: 19, color: maxed ? COLOR.inkDim : hex(SR_SELECT_TONE) })).setOrigin(0.5));
      if (maxed) return;
      item.setSize(cell, cell).setInteractive({ useHandCursor: true });
      item.on("pointerdown", () => pressIn(item));
      item.on("pointerout", () => pressOut(item, "normal", { pop: false }));
      item.on("pointerup", () => {
        pressOut(item);
        popups.confirm({
          title: t("newbieGrowth.sr.title"),
          message: t(owned ? "newbieGrowth.sr.confirmOwned" : "newbieGrowth.sr.confirm", { name: def.name }),
          confirmLabel: t("newbieGrowth.sr.confirmLabel"),
        }, () => { close(); onPick(relicId); });
      });
    });
  });
}
