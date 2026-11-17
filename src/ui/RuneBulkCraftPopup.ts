import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import type { GameApi } from "../api/contracts";
import { isRuneBulkCraftCandidate, runeBulkCraftTotals, type RuneBulkEngrave } from "../core/runeBulkCraft";
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
import { addTextChip } from "./RelicFilterPopup";
import { RUNE_BULK_CRAFT, runeBulkCraftLayout } from "./runeBulkCraftLayout";
import { mountRunePickerGrid } from "./runePickerGrid";
import { RUNE_ENGRAVE_GOLD } from "./runeIcons";
import { COLOR, textStyle } from "./theme";
import { squeezeTextToWidth } from "./textFit";

const ENGRAVE_CHOICES: readonly { value: RuneBulkEngrave; labelKey: TextKey }[] = [
  { value: null, labelKey: "rune.bulkCraft.engrave.none" },
  { value: 0, labelKey: "rune.bulkCraft.engrave.top" },
  { value: 1, labelKey: "rune.bulkCraft.engrave.bottom" },
];

/** 고른 각인 자리는 앱이 켜져 있는 동안 기억한다 — 정리를 이어 하는 손이 매번 다시 고르지 않게. */
let lastEngrave: RuneBulkEngrave = null;

/**
 * 룬 일괄 세공 판.
 *
 * 위는 장착 가방과 같은 룬 목록(필터·검색·정렬 + 카드)이고, 카드를 누르면 고르고 다시 누르면 뺀다. 아래 각인 칩이
 * 세공을 마친 룬을 어느 주 옵션에 새길지(안 함 · 위 · 아래) 정한다. 세공 버튼이 필요 골드를 안에 들고, 공용 확인 창을
 * 한 번 거친다(골드를 쓰고 각인은 되돌릴 수 없다). 판정은 서버(`craftRunes`)가 한 번에 한다.
 * 판 밖 우하단 돌아가기와 판 밖 누르기로 닫히고 오른쪽 위 X는 두지 않는다.
 */
export function openRuneBulkCraftPopup(scene: Phaser.Scene, popups: PopupLayer, api: GameApi): void {
  const L = RUNE_BULK_CRAFT;
  // 판 크기는 어느 각인 자리를 골라도 넣을 수 있는 룬 수로 잰다 — 칩을 바꿀 때 판이 줄었다 늘지 않게.
  const sizeFor = session.runeInventory.filter((rune) => isRuneBulkCraftCandidate(rune, 0)).length;
  const layout = runeBulkCraftLayout(sizeFor);
  const selected = new Set<string>();
  const candidates = () => session.runeInventory.filter((rune) => isRuneBulkCraftCandidate(rune, lastEngrave));
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

    // 각인 자리 — 셋 중 하나. 바꾸면 넣을 수 있는 룬이 달라진다(세공을 다 마친 룬은 각인을 고른 때만 선다).
    const engraveLabel = scene.add.text(layout.left, layout.engraveY, t("rune.bulkCraft.engrave"), textStyle({ role: "display", size: 28, color: COLOR.accentText })).setOrigin(0, 0.5);
    squeezeTextToWidth(engraveLabel, L.engraveLabelWidth - 16);
    body.add(engraveLabel);
    const chips = scene.add.container(0, 0);
    body.add(chips);
    const paintChips = (): void => {
      chips.removeAll(true);
      ENGRAVE_CHOICES.forEach((choice, index) => {
        addTextChip(scene, chips, layout.chipXs[index], layout.engraveY, layout.chipWidth, t(choice.labelKey), choice.value === null ? COLOR.accent : RUNE_ENGRAVE_GOLD,
          () => lastEngrave === choice.value,
          () => {
            if (lastEngrave === choice.value) return;
            lastEngrave = choice.value;
            paintChips();
            grid.repaint();
            paint();
          });
      });
    };
    paintChips();

    const craftButton = new Button(scene, 0, layout.buttonY, {
      width: L.buttonWidth, height: L.buttonHeight, label: t("rune.bulkCraft.title"), fontSize: 32, variant: "primary",
      cost: { icon: "currency-gold", amount: 0, affordable: true, abbreviate: true },
      onClick: () => confirmCraft(),
    });
    body.add(craftButton);

    function paint(): void {
      const runes = picked();
      const gold = runeBulkCraftGoldCost(runes);
      countText.setText(t("rune.bulkCraft.selected", { count: runes.length.toLocaleString(), total: candidates().length.toLocaleString() }));
      const shown = grid.shown();
      const all = shown.length > 0 && shown.every((rune) => selected.has(rune.instanceId));
      selectButton.setLabel(t(all ? "rune.bulkCraft.clearAll" : "rune.bulkCraft.selectAll"));
      selectButton.setEnabled(shown.length > 0);
      craftButton.setLabel(runes.length > 0 ? t("rune.bulkCraft.button", { count: runes.length.toLocaleString() }) : t("rune.bulkCraft.title"));
      craftButton.setCost({ amount: gold, affordable: session.wallet.gold >= gold });
      craftButton.setEnabled(runes.length > 0 && session.wallet.gold >= gold);
    }

    function confirmCraft(): void {
      const runes = picked();
      if (runes.length === 0) return;
      const gold = runeBulkCraftGoldCost(runes);
      if (session.wallet.gold < gold) return;
      const totals = runeBulkCraftTotals(runes, lastEngrave);
      const engrave = lastEngrave;
      const message = engrave === null || totals.engravings === 0
        ? t("rune.bulkCraft.confirm", { count: totals.runes.toLocaleString(), attempts: totals.enhancements.toLocaleString() })
        : t("rune.bulkCraft.confirmEngrave", {
          count: totals.runes.toLocaleString(), attempts: totals.enhancements.toLocaleString(), engravings: totals.engravings.toLocaleString(),
          target: t(engrave === 0 ? "rune.bulkCraft.engrave.top" : "rune.bulkCraft.engrave.bottom"),
        });
      popups.confirm({
        title: t("rune.bulkCraft.title"),
        message,
        confirmLabel: t("rune.bulkCraft.title"),
        ...(gold > 0 ? {
          costs: [{ iconKey: CURRENCY_ICON_BY_WALLET.gold, amount: gold }],
          balance: { iconKey: CURRENCY_ICON_BY_WALLET.gold, before: session.wallet.gold, after: session.wallet.gold - gold },
        } : {}),
      }, () => {
        const ids = runes.map(({ instanceId }) => instanceId);
        void withBusy(scene, new InventoryManager(session).craftRunes(api, ids, engrave)).then((response) => {
          audioManager?.playUi("rune.success");
          showContentToast(scene, t("rune.bulkCraft.done", {
            attempts: response.attempts.toLocaleString(), successes: response.successes.toLocaleString(), engraved: response.engraved.toLocaleString(),
          }), "info");
          // 끝난 룬은 목록에서 빠진다(더 할 일이 없다). 고른 표시도 비운다.
          selected.clear();
          if (countText.active) { grid.repaint(); paint(); }
        }).catch((error: unknown) => {
          reportError("rune.bulkCraft", error, { count: ids.length });
          showContentToast(scene, t("rune.bulkCraft.failed"), "refused");
          if (countText.active) { grid.repaint(); paint(); }
        });
      });
    }

    paint();
  });
}
