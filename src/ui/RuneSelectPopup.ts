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
import { emptySlotOrder, RUNE_SELECT, runeSelectFooterXs, runeSelectRows } from "./runeSelectLayout";
import { ControlChip } from "./ControlChip";
import { settingsManager } from "../managers/SettingsManager";
import type { RuneViewScreen } from "../core/listViewMemory";
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
  /**
   * 「한 번에 선택」으로 이미 고른 룬들(`chosen`)과 함께 넣을 수 있는 룬인가 — 합성은 같은 등급만이다.
   * 주지 않으면 무엇이든 함께 고른다.
   */
  accepts?: (chosen: readonly RuneInstance[], rune: RuneInstance) => boolean;
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
  /** 필터·정렬을 기억할 화면(특성 연구 · 합성). */
  memory: RuneViewScreen;
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
  // 칸이 여럿인 판(합성)에만 「한 번에 선택」 토글이 선다 — 칸이 하나면 하나씩 고르는 것과 같다.
  const multiSlots = (options.slots?.filled().length ?? 1) > 1;
  const rows = runeSelectRows(first.length, multiSlots);
  /** 고른 룬들 — 하나씩 고를 때는 많아야 하나, 「한 번에 선택」이면 빈 칸 수까지 고른 차례대로. */
  let pending: string[] = [];
  /** 위 정보 판에 선 룬 — 마지막으로 누른 고른 룬. */
  let focus: string | null = null;
  const multiOn = (): boolean => multiSlots && settingsManager.get().game.runeMultiPick;

  popups.open({ width: rows.width, height: rows.height, title: options.title, titleSize: POPUP_TITLE_SIZE.workboard, dim: true, backButton: true }, (body, close) => {
    const infoLayer = scene.add.container(0, 0);
    const footerLayer = scene.add.container(0, 0);
    body.add([infoLayer, footerLayer]);
    const findRune = (id: string): RuneInstance | undefined => options.candidates().find(({ instanceId }) => instanceId === id);
    const pendingRunes = (): RuneInstance[] => pending.flatMap((id) => { const rune = findRune(id); return rune ? [rune] : []; });
    const emptyCount = (): number => options.slots ? options.slots.filled().filter((rune) => rune === undefined).length : 1;
    // 고른 룬과 함께 넣을 수 없는 룬은 목록에서 내린다(합성은 첫 룬의 등급만) — 하나씩 넣을 때 다음 칸이 좁혀지는 것과 같다.
    const shownRunes = (): readonly RuneInstance[] => {
      const all = options.candidates();
      const accepts = options.slots?.accepts;
      if (!multiOn() || pending.length === 0 || !accepts) return all;
      const chosen = pendingRunes();
      return all.filter((rune) => pending.includes(rune.instanceId) || accepts(chosen, rune));
    };

    let grid: RunePickerGridHandle | undefined;
    const footer = runeSelectFooterXs(rows.width, options.slots?.filled().length ?? 1);
    const button = new Button(scene, footer.button, rows.footerY, {
      width: RUNE_SELECT.button.width, height: RUNE_SELECT.button.height, fontSize: RUNE_SELECT.button.fontSize,
      label: t("rune.pick.select"), variant: "primary", decorDots: true,
      onClick: () => confirm(),
    });
    body.add(button);

    if (multiSlots && rows.toggleY !== undefined) {
      const T = RUNE_SELECT.toggle;
      const right = footer.button + RUNE_SELECT.button.width / 2;
      const toggle = new ControlChip(scene, right - T.width / 2, rows.toggleY, {
        icon: "check", label: t("rune.pick.multi"), width: T.width, height: T.height,
        onClick: () => {
          if (!popups.isTop(body)) return;
          settingsManager.update({ game: { runeMultiPick: !settingsManager.get().game.runeMultiPick } });
          toggle.setActive(multiOn());
          // 끄면 마지막으로 누른 하나만 남긴다 — 하나씩 고르는 판으로 돌아간다.
          if (!multiOn() && pending.length > 1) pending = focus !== null && pending.includes(focus) ? [focus] : pending.slice(-1);
          refresh();
        },
      });
      toggle.setActive(multiOn());
      body.add(toggle);
    }

    const refresh = (): void => {
      if (!body.active) return;
      // 고른 룬이 목록에서 사라졌으면(팔림·잠금·다른 칸에 넣음) 고름을 푼다 — 사라진 룬을 넣지 않는다.
      const live = new Set(shownRunes().map(({ instanceId }) => instanceId));
      pending = pending.filter((id) => live.has(id)).slice(0, multiOn() ? emptyCount() : 1);
      if (focus === null || !pending.includes(focus)) focus = pending.at(-1) ?? null;
      grid?.repaint();
      paintRuneInfoPanel(scene, infoLayer, {
        width: rows.width - 48 * 2 + 24, top: rows.infoTop, rune: focus === null ? undefined : findRune(focus), hint: t("rune.pick.hint"),
        canOpen: () => popups.isTop(body),
        openNote: (id) => openRuneInfoPopup(scene, popups, { runeInstanceId: id, onChanged: () => refresh(), onClose: () => refresh() }),
      });
      paintSlots(scene, footerLayer, rows.footerY, footer.slots, options.slots, multiOn() ? pendingRunes() : []);
      button.setEnabled(pending.length > 0);
    };

    const confirm = (): void => {
      if (!popups.isTop(body)) return;
      const chosen = pendingRunes();
      if (chosen.length === 0) return;
      pending = [];
      focus = null;
      // 고른 차례대로 하나씩 넣는다 — 하나씩 넣을 때와 같은 길(`onSelect`)이라 칸·등급 검사가 갈리지 않는다.
      for (const rune of chosen) {
        if (!options.candidates().some(({ instanceId }) => instanceId === rune.instanceId)) continue;
        if (!options.onSelect(rune)) { close(); return; }
      }
      // 다음 칸에 넣을 룬이 없으면 판을 닫는다 — 빈 목록을 띄운 채 남겨 두면 고를 수 없는 판이 된다.
      if (options.candidates().length === 0) {
        close();
        showContentToast(scene, options.emptyText, "refused");
        return;
      }
      refresh();
    };

    grid = mountRunePickerGrid(scene, body, {
      popups, runes: shownRunes, sizeFor: first.length, maxRows: RUNE_SELECT.maxRows, top: rows.gridTop, memory: options.memory,
      isCovered: () => popups.isOpen, isActive: () => popups.isTop(body),
      isSelected: (rune) => pending.includes(rune.instanceId),
      onPick: (rune) => {
        const id = rune.instanceId;
        if (!multiOn()) {
          // 하나씩 고를 때는 누르면 고르기만 한다 — 같은 카드를 다시 누르면 고름을 푼다.
          pending = pending[0] === id ? [] : [id];
        } else if (pending.includes(id)) {
          pending = pending.filter((other) => other !== id);
        } else if (pending.length < emptyCount()) {
          pending = [...pending, id];
        } else {
          // 빈 칸이 다 찼으면 마지막으로 고른 룬을 갈아 끼운다 — 눌렀는데 아무 일도 없으면 눌렸는지 모른다.
          pending = [...pending.slice(0, -1), id];
        }
        focus = pending.includes(id) ? id : null;
        refresh();
      },
    });
    refresh();
  });
}

/**
 * 밑동 왼쪽의 칸 줄 — 넣은 칸은 룬 액자, 빈 칸은 빈 액자, 지금 채우는 칸은 강조색 테. 칸이 하나면 서지 않는다.
 * 「한 번에 선택」으로 고른 룬(`preview`)은 들어갈 빈 칸에 옅게 미리 서고, 테는 그다음 칸으로 옮겨 간다.
 */
function paintSlots(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, y: number, xs: readonly number[], slots: RuneSelectSlots | undefined, preview: readonly RuneInstance[]): void {
  layer.removeAll(true);
  if (!slots || xs.length === 0) return;
  const size = RUNE_SELECT.slot.size;
  const filled = slots.filled();
  const order = emptySlotOrder(filled.map((rune) => rune !== undefined), slots.target());
  const previewAt = new Map(preview.map((rune, at) => [order[at], rune] as const));
  const target = preview.length > 0 ? (order[preview.length] ?? -1) : slots.target();
  const tone = (filled.find((rune) => rune !== undefined) ?? preview[0])?.rarity;
  xs.forEach((x, index) => {
    const placed = filled[index];
    const ghost = placed === undefined ? previewAt.get(index) : undefined;
    const rune = placed ?? ghost;
    if (index === target) {
      const ring = size + 14;
      layer.add(drawShapeOutline(scene, x, y, chipPoints(ring, ring, { bevel: { topLeft: ring * 0.2, topRight: 0, bottomRight: ring * 0.2, bottomLeft: 0 } }), { color: COLOR.accent, alpha: 1, width: 4 }));
    }
    const frame = rune
      ? addRuneFrame(scene, x, y, size, rune.rarity, rune.part, { mainStats: rune.mainStats, engraved: rune.engravings.length > 0 })
      : addRuneSocket(scene, x, y, size, tone ? RUNE_ACCENT[tone] : COLOR.accent);
    if (ghost) frame.setAlpha(0.6);
    layer.add(frame);
  });
}
