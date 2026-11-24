import Phaser from "phaser";
import { t } from "../i18n";
import type { RuneInstance } from "../core/runes";
import { Button } from "./Button";
import { showContentToast } from "./ContentToast";
import { chipPoints, drawShapeOutline } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { POPUP_TITLE_SIZE } from "./popupGeometry";
import { mountRunePickerGrid, type RunePickerGridHandle } from "./runePickerGrid";
import { runePickerSize } from "./runePickerLayout";
import { addRuneFrame, RUNE_ACCENT } from "./runeIcons";
import { openRuneInfoPopup } from "./RunePopup";
import { paintRuneInfoPanel } from "./RuneInfoPanel";
import { addRuneSocket } from "./RuneSocket";
import { RUNE_SELECT, runeSelectFooterXs, runeSelectRows } from "./runeSelectLayout";
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
      paintRuneInfoPanel(scene, infoLayer, {
        width: rows.width - 48 * 2 + 24, top: rows.infoTop, rune: pendingRune(), hint: t("rune.pick.hint"),
        canOpen: () => popups.isTop(body),
        openNote: (id) => openRuneInfoPopup(scene, popups, { runeInstanceId: id, onChanged: () => refresh(), onClose: () => refresh() }),
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
