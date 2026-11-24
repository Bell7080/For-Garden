import Phaser from "phaser";
import { t } from "../i18n";
import { getRelic } from "../data/relics";
import { formatRuneOptionValue, runeDisplayName, runeOptionValue, runePartLabel, runeRarityLabel, type RuneInstance, type RuneStatKey } from "../core/runes";
import { Button } from "./Button";
import { showContentToast } from "./ContentToast";
import { addClippedHit } from "./clippedHit";
import { chipPoints, drawHairline, drawLayer, drawShapeOutline } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { POPUP_TITLE_SIZE } from "./popupGeometry";
import { pressIn, pressOut } from "./pressFeedback";
import { mountRunePickerGrid, type RunePickerGridHandle } from "./runePickerGrid";
import { runePickerSize } from "./runePickerLayout";
import { addRuneFrame, RUNE_ACCENT, runeAccentCss } from "./runeIcons";
import { equippedRuneSlot, openRuneInfoPopup, runeStatLabel } from "./RunePopup";
import { addRuneSocket } from "./RuneSocket";
import { RUNE_SELECT, runeSelectFooterXs, runeSelectRows } from "./runeSelectLayout";
import { runeTraitView } from "./runeTraitPresentation";
import { isTap } from "./tapGuard";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/**
 * 룬을 「눌러 보고 → 선택」으로 넣는 고르기 판 — 특성 연구와 합성이 같은 한 장을 쓴다.
 *
 * **카드를 누르기만 해서는 칸에 들어가지 않는다.** 누른 룬은 목록에서 고른 테를 두르고 위 정보 판에
 * 등급·자리·옵션·특성이 선다. 밑동의 「선택」을 눌러야 그 칸에 넣는다 — 룬 정비 창의 「교체 비교 → 적용」과
 * 같은 두 걸음이라, 무엇을 넣는지 보지 않고 손이 먼저 넣는 일이 없다.
 *
 * **칸이 여럿이면(합성) 넣은 뒤 판을 닫지 않고 다음 빈 칸으로 이어진다.** 밑동 왼쪽의 칸 줄이 지금 채우는
 * 칸을 강조색 테로 말하고, 마지막 칸까지 차면 판이 닫힌다. 다음 칸에 넣을 룬이 하나도 없으면 닫고 토스트가 말한다.
 */

export interface RuneSelectSlots {
  /** 칸마다 지금 든 룬(빈 칸은 undefined). 넣을 때마다 다시 읽는다. */
  filled: () => readonly (RuneInstance | undefined)[];
  /** 지금 채우는 칸. */
  target: () => number;
}

export interface RuneSelectOptions {
  scene: Phaser.Scene;
  popups: PopupLayer;
  title: string;
  /** 지금 칸에 넣을 수 있는 룬. 넣을 때마다 다시 읽는다(넣은 룬·등급 조건이 바뀐다). */
  candidates: () => readonly RuneInstance[];
  /** 넣을 룬이 하나도 없을 때의 한 줄. */
  emptyText: string;
  slots?: RuneSelectSlots;
  /** 고른 룬을 넣는다. 참을 돌려주면 판을 연 채로 다음 칸을 고른다. */
  onSelect: (rune: RuneInstance) => boolean;
}

const EMPTY_HEIGHT = 420;

export function openRuneSelectPopup(options: RuneSelectOptions): void {
  const { scene, popups } = options;
  const first = options.candidates();
  if (first.length === 0) {
    const width = runePickerSize(0).width;
    popups.open({ width, height: EMPTY_HEIGHT, title: options.title, titleSize: POPUP_TITLE_SIZE.workboard, dim: true, backButton: true }, (body) => {
      body.add(scene.add.text(0, 10, options.emptyText, textStyle({ role: "body", size: 28, color: COLOR.inkDim, align: "center", wrap: width - 140 })).setOrigin(0.5));
    });
    return;
  }
  const rows = runeSelectRows(first.length);
  let pending: string | null = null;

  popups.open({ width: rows.width, height: rows.height, title: options.title, titleSize: POPUP_TITLE_SIZE.workboard, dim: true, backButton: true }, (body, close) => {
    const infoLayer = scene.add.container(0, 0);
    const footerLayer = scene.add.container(0, 0);
    body.add([infoLayer, footerLayer]);
    const pendingRune = (): RuneInstance | undefined => (pending === null ? undefined : options.candidates().find(({ instanceId }) => instanceId === pending));

    let grid: RunePickerGridHandle | undefined;
    const footer = runeSelectFooterXs(rows.width, options.slots?.filled().length ?? 1);
    const button = new Button(scene, footer.button, rows.footerY, {
      width: RUNE_SELECT.button.width, height: RUNE_SELECT.button.height, fontSize: RUNE_SELECT.button.fontSize,
      label: t("rune.pick.select"), variant: "primary", decorDots: true,
      onClick: () => confirm(),
    });
    body.add(button);

    const refresh = (): void => {
      if (!body.active) return;
      // 고른 룬이 목록에서 사라졌으면(팔림·잠금·다른 칸에 넣음) 고름을 푼다 — 사라진 룬을 넣지 않는다.
      if (pending !== null && pendingRune() === undefined) pending = null;
      grid?.repaint();
      paintInfo(scene, infoLayer, rows, pendingRune(), popups, body, (id) => {
        openRuneInfoPopup(scene, popups, { runeInstanceId: id, onChanged: () => refresh(), onClose: () => refresh() });
      });
      paintSlots(scene, footerLayer, rows.footerY, footer.slots, options.slots);
      button.setEnabled(pendingRune() !== undefined);
    };

    const confirm = (): void => {
      const rune = pendingRune();
      if (!rune || !popups.isTop(body)) return;
      pending = null;
      const keep = options.onSelect(rune);
      if (!keep) { close(); return; }
      // 다음 칸에 넣을 룬이 없으면 판을 닫는다 — 빈 목록을 띄운 채 남겨 두면 고를 수 없는 판이 된다.
      if (options.candidates().length === 0) {
        close();
        showContentToast(scene, options.emptyText, "refused");
        return;
      }
      refresh();
    };

    grid = mountRunePickerGrid(scene, body, {
      popups, runes: options.candidates, sizeFor: first.length, maxRows: RUNE_SELECT.maxRows, top: rows.gridTop,
      isCovered: () => popups.isOpen, isActive: () => popups.isTop(body),
      isSelected: (rune) => rune.instanceId === pending,
      // 누르면 고르기만 한다 — 같은 카드를 다시 누르면 고름을 푼다.
      onPick: (rune) => { pending = pending === rune.instanceId ? null : rune.instanceId; refresh(); },
    });
    refresh();
  });
}

const hex = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;

/**
 * 고른 룬의 정보 판 — 액자(누르면 룬 쪽지) · 등급·자리 · 이름 · 옵션 두 줄 묶음 · 특성 · 장착 중이면 그 렐릭.
 * 고르기 전에는 같은 판에 빈 액자와 한 줄만 선다(판이 사라지면 목록이 오르내린다).
 */
function paintInfo(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  rows: ReturnType<typeof runeSelectRows>,
  rune: RuneInstance | undefined,
  popups: PopupLayer,
  body: Phaser.GameObjects.Container,
  openNote: (id: string) => void,
): void {
  layer.removeAll(true);
  const S = RUNE_SELECT;
  const width = rows.width - 48 * 2 + 24;
  const height = S.infoHeight;
  const cy = rows.infoTop + height / 2;
  const accent = rune ? RUNE_ACCENT[rune.rarity] : COLOR.accent;
  layer.add(drawLayer(scene, 0, cy, chipPoints(width, height, { bevel: { topLeft: height * 0.16, topRight: 0, bottomRight: height * 0.16, bottomLeft: 0 } }),
    { fill: 0x0a0e14, alpha: 0.9, edge: accent, edgeAlpha: rune ? 0.7 : 0.35 }));
  const left = -width / 2 + S.infoPad;
  const iconX = left + S.icon / 2 + 10;
  if (!rune) {
    layer.add(addRuneSocket(scene, iconX, cy, S.icon, COLOR.accent).setAlpha(0.6));
    layer.add(scene.add.text(iconX + S.icon / 2 + 30, cy, t("rune.pick.hint"), textStyle({ role: "emphasis", size: 28, color: COLOR.accentText, wrap: width / 2 + 120 })).setOrigin(0, 0.5));
    return;
  }

  const icon = addRuneFrame(scene, iconX, cy, S.icon, rune.rarity, rune.part, { mainStats: rune.mainStats, engraved: rune.engravings.length > 0 });
  layer.add(icon);
  // 액자를 누르면 그 룬의 쪽지 — 세공·잠금·판매까지 거기서 한다(정비 창의 비교 판 그림과 같은 길).
  const iconHit = addClippedHit(scene, icon, 0, 0, S.icon, S.icon, () => ({ left: -Infinity, right: Infinity, top: -Infinity, bottom: Infinity }));
  iconHit.on("pointerdown", () => pressIn(icon));
  iconHit.on("pointerout", () => pressOut(icon, "normal", { pop: false }));
  iconHit.on("pointerup", (pointer: Phaser.Input.Pointer) => { pressOut(icon); if (isTap(pointer) && popups.isTop(body)) openNote(rune.instanceId); });

  const textX = iconX + S.icon / 2 + 26;
  const right = width / 2 - S.infoPad;
  const room = right - textX;
  const top = rows.infoTop + S.infoPad - 4;
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

  const traitY = rows.infoTop + height - S.infoPad - 6;
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

/** 밑동 왼쪽의 칸 줄 — 넣은 칸은 룬 액자, 빈 칸은 빈 액자, 지금 채우는 칸은 강조색 테. 칸이 하나면 서지 않는다. */
function paintSlots(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, y: number, xs: readonly number[], slots: RuneSelectSlots | undefined): void {
  layer.removeAll(true);
  if (!slots || xs.length === 0) return;
  const size = RUNE_SELECT.slot.size;
  const filled = slots.filled();
  const target = slots.target();
  const tone = filled.find((rune) => rune !== undefined)?.rarity;
  xs.forEach((x, index) => {
    const rune = filled[index];
    if (index === target) {
      const ring = size + 14;
      layer.add(drawShapeOutline(scene, x, y, chipPoints(ring, ring, { bevel: { topLeft: ring * 0.2, topRight: 0, bottomRight: ring * 0.2, bottomLeft: 0 } }), { color: COLOR.accent, alpha: 1, width: 4 }));
    }
    layer.add(rune
      ? addRuneFrame(scene, x, y, size, rune.rarity, rune.part, { mainStats: rune.mainStats, engraved: rune.engravings.length > 0 })
      : addRuneSocket(scene, x, y, size, tone ? RUNE_ACCENT[tone] : COLOR.accent));
  });
}
