import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import type { GameApi } from "../api/contracts";
import { isRuneBulkModeCandidate, runeBulkCraftTotals, type RuneBulkMode } from "../core/runeBulkCraft";
import type { RuneInstance } from "../core/runes";
import { runeBulkCraftGoldCost } from "../data/runes";
import { audioManager } from "../managers/AudioManager";
import { reportError } from "../managers/ErrorReporter";
import { InventoryManager } from "../managers/InventoryManager";
import { session } from "../state/session";
import { withBusy } from "./BusyOverlay";
import { Button } from "./Button";
import { showContentToast } from "./ContentToast";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { PopupLayer, POPUP_TITLE_SIZE } from "./PopupLayer";
import { RUNE_BULK_CRAFT, runeBulkCraftLayout } from "./runeBulkCraftLayout";
import { mountRunePickerGrid } from "./runePickerGrid";
import { COLOR, textStyle } from "./theme";

const MODES: readonly { value: RuneBulkMode; labelKey: TextKey }[] = [
  { value: "craft", labelKey: "rune.bulkCraft.mode.craft" },
  { value: "engrave", labelKey: "rune.bulkCraft.engrave" },
];

const ENGRAVE_TARGETS: readonly { value: 0 | 1; labelKey: TextKey }[] = [
  { value: 0, labelKey: "rune.bulkCraft.engrave.top" },
  { value: 1, labelKey: "rune.bulkCraft.engrave.bottom" },
];

/** 고른 판(세공·각인)은 앱이 켜져 있는 동안 기억한다 — 정리를 이어 하는 손이 매번 다시 고르지 않게. */
let lastMode: RuneBulkMode = "craft";

/**
 * 룬 일괄 세공 판.
 *
 * 위는 장착 가방과 같은 룬 목록(필터·검색·정렬 + 카드)이고, 카드를 누르면 고르고 다시 누르면 뺀다. 그 아래 버튼 둘이
 * **세공 / 각인** 판을 가른다(응태 2026-11-24 — 각인은 세공과 섞지 않는다). 세공 판은 세공이 남은 룬만 받아 남은 세공만
 * 돌리고(필요 골드가 버튼 안에 선다), 각인 판은 세공을 마친 각인 전 룬만 받아 「위 주 옵션 각인」·「아래 주 옵션 각인」
 * 버튼 중 누른 자리에 새기기만 한다. 둘 다 공용 확인 창을 한 번 거친다(골드를 쓰거나 각인은 되돌릴 수 없다).
 * 판정은 서버(`craftRunes`)가 한 번에 한다. 판 밖 우하단 돌아가기와 판 밖 누르기로 닫히고 오른쪽 위 X는 두지 않는다.
 */
export function openRuneBulkCraftPopup(scene: Phaser.Scene, popups: PopupLayer, api: GameApi): void {
  const L = RUNE_BULK_CRAFT;
  // 판 크기는 두 판 중 넣을 수 있는 룬이 많은 쪽으로 잰다 — 판을 바꿀 때 판이 줄었다 늘지 않게.
  const sizeFor = Math.max(...MODES.map(({ value }) => session.runeInventory.filter((rune) => isRuneBulkModeCandidate(rune, value)).length));
  const layout = runeBulkCraftLayout(sizeFor);
  const selected = new Set<string>();
  const candidates = () => session.runeInventory.filter((rune) => isRuneBulkModeCandidate(rune, lastMode));
  const picked = () => candidates().filter((rune) => selected.has(rune.instanceId));

  popups.open({ width: layout.width, height: layout.height, title: t("rune.bulkCraft.title"), titleSize: POPUP_TITLE_SIZE.workboard, dim: true, closeOnBackdrop: true }, (body) => {
    const grid = mountRunePickerGrid(scene, body, {
      popups, runes: candidates, sizeFor, maxRows: L.maxRows, top: layout.top,
      isCovered: () => popups.isOpen && !popups.isTop(body), isActive: () => popups.isTop(body),
      isSelected: (rune) => selected.has(rune.instanceId),
      onPick: (rune) => {
        if (selected.has(rune.instanceId)) selected.delete(rune.instanceId); else selected.add(rune.instanceId);
        grid.repaint();
        paint();
      },
    });

    // 고른 수 · 모두 선택.
    const countText = scene.add.text(layout.left, layout.selectY, "", textStyle({ role: "emphasis", size: 28, color: COLOR.ink })).setOrigin(0, 0.5);
    body.add(countText);
    const selectButton = new Button(scene, layout.right - L.selectButtonWidth / 2, layout.selectY, {
      width: L.selectButtonWidth, height: L.selectHeight, label: t("rune.bulkCraft.selectAll"), fontSize: 24,
      onClick: () => {
        const shown = grid.shown();
        const all = shown.length > 0 && shown.every((rune) => selected.has(rune.instanceId));
        shown.forEach((rune) => { if (all) selected.delete(rune.instanceId); else selected.add(rune.instanceId); });
        grid.repaint();
        paint();
      },
    });
    body.add(selectButton);

    // 세공 / 각인 — 버튼 둘이 판을 가른다. 지금 판이 강조 버튼으로 선다. 바꾸면 넣을 수 있는 룬이 달라지므로 고른 것을 비운다.
    const modeRow = scene.add.container(0, 0);
    body.add(modeRow);
    const paintModes = (): void => {
      modeRow.removeAll(true);
      MODES.forEach((mode, index) => {
        const on = lastMode === mode.value;
        modeRow.add(new Button(scene, layout.modeXs[index], layout.modeY, {
          width: layout.modeWidth, height: L.modeHeight, label: t(mode.labelKey), fontSize: 30, ...(on ? { variant: "primary" as const } : {}),
          onClick: () => {
            if (lastMode === mode.value) return;
            lastMode = mode.value;
            selected.clear();
            paintModes();
            paintActions();
            grid.repaint();
            paint();
          },
        }));
      });
    };

    // 실행 줄 — 세공 판은 골드를 든 세공 버튼 하나, 각인 판은 위·아래 주 옵션 각인 버튼 둘.
    const actionRow = scene.add.container(0, 0);
    body.add(actionRow);
    let craftButton: Button | undefined;
    const engraveButtons: Button[] = [];
    const paintActions = (): void => {
      actionRow.removeAll(true);
      craftButton = undefined;
      engraveButtons.length = 0;
      if (lastMode === "craft") {
        craftButton = new Button(scene, 0, layout.buttonY, {
          width: L.buttonWidth, height: L.buttonHeight, label: t("rune.bulkCraft.title"), fontSize: 32, variant: "primary",
          cost: { icon: "currency-gold", amount: 0, affordable: true, abbreviate: true },
          onClick: () => confirmCraft(),
        });
        actionRow.add(craftButton);
        return;
      }
      ENGRAVE_TARGETS.forEach((target, index) => {
        const button = new Button(scene, layout.engraveXs[index], layout.buttonY, {
          width: layout.engraveWidth, height: L.buttonHeight, label: t("rune.bulkCraft.engraveButton", { target: t(target.labelKey) }), fontSize: 30, variant: "primary",
          onClick: () => confirmEngrave(target.value),
        });
        engraveButtons.push(button);
        actionRow.add(button);
      });
    };
    paintModes();
    paintActions();

    function paint(): void {
      const runes = picked();
      countText.setText(t("rune.bulkCraft.selected", { count: runes.length.toLocaleString(), total: candidates().length.toLocaleString() }));
      const shown = grid.shown();
      const all = shown.length > 0 && shown.every((rune) => selected.has(rune.instanceId));
      selectButton.setLabel(t(all ? "rune.bulkCraft.clearAll" : "rune.bulkCraft.selectAll"));
      selectButton.setEnabled(shown.length > 0);
      if (craftButton) {
        const gold = runeBulkCraftGoldCost(runes);
        craftButton.setLabel(runes.length > 0 ? t("rune.bulkCraft.button", { count: runes.length.toLocaleString() }) : t("rune.bulkCraft.title"));
        craftButton.setCost({ amount: gold, affordable: session.wallet.gold >= gold });
        craftButton.setEnabled(runes.length > 0 && session.wallet.gold >= gold);
      }
      engraveButtons.forEach((button) => button.setEnabled(runes.length > 0));
    }

    /** 서버에 보내고 끝난 룬을 목록에서 걷는다. 세공 판은 각인을 보내지 않고, 각인 판은 세공이 끝난 룬만 보내므로 각인만 된다. */
    function submit(runes: readonly RuneInstance[], engrave: 0 | 1 | null): void {
      const ids = runes.map(({ instanceId }) => instanceId);
      void withBusy(scene, new InventoryManager(session).craftRunes(api, ids, engrave)).then((response) => {
        audioManager?.playUi("rune.success");
        const message = engrave === null
          ? t("rune.bulkCraft.doneCraft", { attempts: response.attempts.toLocaleString(), successes: response.successes.toLocaleString() })
          : t("rune.bulkCraft.doneEngrave", { engraved: response.engraved.toLocaleString() });
        showContentToast(scene, message, "info");
        // 끝난 룬은 목록에서 빠진다(이 판에서 더 할 일이 없다). 고른 표시도 비운다.
        selected.clear();
        if (countText.active) { grid.repaint(); paint(); }
      }).catch((error: unknown) => {
        reportError("rune.bulkCraft", error, { count: ids.length, engrave });
        showContentToast(scene, t("rune.bulkCraft.failed"), "refused");
        if (countText.active) { grid.repaint(); paint(); }
      });
    }

    function confirmCraft(): void {
      const runes = picked();
      if (runes.length === 0) return;
      const gold = runeBulkCraftGoldCost(runes);
      if (session.wallet.gold < gold) return;
      const totals = runeBulkCraftTotals(runes, null);
      popups.confirm({
        title: t("rune.bulkCraft.title"),
        message: t("rune.bulkCraft.confirm", { count: totals.runes.toLocaleString(), attempts: totals.enhancements.toLocaleString() }),
        confirmLabel: t("rune.bulkCraft.mode.craft"),
        ...(gold > 0 ? {
          costs: [{ iconKey: CURRENCY_ICON_BY_WALLET.gold, amount: gold }],
          balance: { iconKey: CURRENCY_ICON_BY_WALLET.gold, before: session.wallet.gold, after: session.wallet.gold - gold },
        } : {}),
      }, () => submit(runes, null));
    }

    function confirmEngrave(target: 0 | 1): void {
      const runes = picked();
      if (runes.length === 0) return;
      popups.confirm({
        title: t("rune.bulkCraft.engrave"),
        message: t("rune.bulkCraft.confirmEngraveOnly", { count: runes.length.toLocaleString(), target: t(target === 0 ? "rune.bulkCraft.engrave.top" : "rune.bulkCraft.engrave.bottom") }),
        confirmLabel: t("rune.bulkCraft.engrave"),
      }, () => submit(runes, target));
    }

    paint();
  });
}
