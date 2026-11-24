import Phaser from "phaser";
import { t } from "../i18n";
import type { GameApi } from "../api/contracts";
import { isRuneTraitBulkCandidate, runeTraitBulkSelectable } from "../core/runeTraitBulk";
import { RUNE_TRAIT_ITEMS } from "../data/runeTraits";
import { findItem } from "../data/items";
import { audioManager } from "../managers/AudioManager";
import { reportError } from "../managers/ErrorReporter";
import { session } from "../state/session";
import { withBusy } from "./BusyOverlay";
import { Button } from "./Button";
import { showContentToast } from "./ContentToast";
import { PopupLayer, POPUP_TITLE_SIZE } from "./PopupLayer";
import { openRuneTraitBulkResultPopup } from "./RuneTraitBulkResultPopup";
import { mountRunePickerGrid } from "./runePickerGrid";
import { RUNE_PICK_GRID, runePickerListTop, runePickerSize } from "./runePickerLayout";
import { chipPoints, drawLayer } from "./holo";
import { POPUP_BODY_BEVEL_RATIO } from "./popupGeometry";
import { COLOR, textStyle } from "./theme";

/** 판의 자리. 목록 세 줄 아래로 고른 수 줄과 부여 버튼이 선다 — 높이는 쌓인 줄에서 거꾸로 구한다. */
const TRAIT_BULK = {
  maxRows: 3,
  listGap: 26,
  selectHeight: 60,
  selectButtonWidth: 230,
  /** 소모·보유 판 — 무엇을 몇 개 쓰고 얼마가 남는지를 재화 그림과 값 글자로 마주 세운다. */
  ledgerGap: 22,
  ledgerHeight: 96,
  ledgerLabelSize: 24,
  ledgerIcon: 48,
  ledgerValueSize: 34,
  buttonGap: 30,
  buttonWidth: 460,
  buttonHeight: 88,
  bottom: 40,
} as const;

function ownedCores(): number {
  return session.itemInventory.find((stack) => stack.itemId === RUNE_TRAIT_ITEMS.grant.itemId)?.quantity ?? 0;
}

/**
 * 특성 일괄 부여 판.
 *
 * 위는 장착 가방과 같은 룬 목록(필터·검색·정렬 + 카드)이고 **특성이 없는 룬만** 선다. 처음에는 세공을 많이 한
 * 룬부터 서서 세공을 마친 룬이 맨 앞이다. 카드를 누르면 고르고 다시 누르면 빼며, 가진 미지의 고대 핵보다 많이는
 * 고르지 못한다. 부여 버튼이 공용 확인 창을 한 번 거치고(핵을 쓰고 되돌릴 수 없다), 판정은 서버
 * (`grantRuneTraitsBulk`)가 한 번에 한다. 판 밖 우하단 돌아가기와 판 밖 누르기로 닫히고 오른쪽 위 X는 두지 않는다.
 */
export function openRuneTraitBulkPopup(scene: Phaser.Scene, popups: PopupLayer, api: GameApi, onDone: () => void): void {
  const L = TRAIT_BULK;
  const itemId = RUNE_TRAIT_ITEMS.grant.itemId;
  const icon = findItem(itemId)?.icon;
  const iconKey = icon?.kind === "asset" ? icon.key : "item-ancient-core";
  const sizeFor = session.runeInventory.filter(isRuneTraitBulkCandidate).length;
  const picker = runePickerSize(sizeFor, L.maxRows);
  let cursor = runePickerListTop() + picker.viewHeight + L.listGap;
  const selectTop = cursor; cursor += L.selectHeight + L.ledgerGap;
  const ledgerTop = cursor; cursor += L.ledgerHeight + L.buttonGap;
  const buttonTop = cursor; cursor += L.buttonHeight + L.bottom;
  const width = picker.width;
  const height = cursor;
  const half = height / 2;
  const left = -width / 2 + RUNE_PICK_GRID.padX;
  const right = width / 2 - RUNE_PICK_GRID.padX;

  const selected: string[] = [];
  const candidates = () => session.runeInventory.filter(isRuneTraitBulkCandidate);
  const picked = () => {
    const alive = new Set(candidates().map(({ instanceId }) => instanceId));
    return selected.filter((id) => alive.has(id));
  };
  let granted = false;

  popups.open({
    width, height, title: t("rune.traitBulk.title"), titleSize: POPUP_TITLE_SIZE.workboard, dim: true, closeOnBackdrop: true,
    onClose: () => { if (granted) onDone(); },
  }, (body) => {
    const grid = mountRunePickerGrid(scene, body, {
      popups, runes: candidates, sizeFor, maxRows: L.maxRows, top: -half,
      initialSort: { key: "enhancement", direction: "desc" },
      isCovered: () => popups.isOpen && !popups.isTop(body), isActive: () => popups.isTop(body),
      isSelected: (rune) => selected.includes(rune.instanceId),
      onPick: (rune) => {
        const at = selected.indexOf(rune.instanceId);
        if (at >= 0) selected.splice(at, 1);
        else if (picked().length >= runeTraitBulkSelectable(ownedCores())) { showContentToast(scene, t("rune.traitBulk.lacking"), "refused"); return; }
        else selected.push(rune.instanceId);
        grid.repaint();
        paint();
      },
    });

    const countText = scene.add.text(left, selectTop + L.selectHeight / 2 - half, "", textStyle({ role: "emphasis", size: 28, color: COLOR.ink })).setOrigin(0, 0.5);
    body.add(countText);
    const selectButton = new Button(scene, right - L.selectButtonWidth / 2, selectTop + L.selectHeight / 2 - half, {
      width: L.selectButtonWidth, height: L.selectHeight, label: t("rune.bulkCraft.selectAll"), fontSize: 24,
      onClick: () => {
        const shown = grid.shown();
        const room = runeTraitBulkSelectable(ownedCores());
        const all = shown.length > 0 && shown.slice(0, room).every((rune) => selected.includes(rune.instanceId));
        selected.length = 0;
        // 모두 선택은 **지금 보이는 순서대로** 가진 핵만큼만 고른다 — 정렬이 곧 우선순위다.
        if (!all) shown.slice(0, room).forEach((rune) => selected.push(rune.instanceId));
        grid.repaint();
        paint();
      },
    });
    body.add(selectButton);

    // 소모 | 보유 판. 몸판과 같은 비율로 깎아 판 안에 앉히고, 가운데 세로선이 두 칸을 가른다.
    const ledgerWidth = right - left;
    const ledgerY = ledgerTop + L.ledgerHeight / 2 - half;
    const unit = Math.min(ledgerWidth, L.ledgerHeight) * POPUP_BODY_BEVEL_RATIO;
    body.add(drawLayer(scene, 0, ledgerY, chipPoints(ledgerWidth, L.ledgerHeight, { bevel: { topLeft: unit, topRight: 0, bottomRight: unit, bottomLeft: 0 } }), { fill: 0x121821, alpha: 0.92, edge: COLOR.accent, edgeAlpha: 0.55 }));
    body.add(scene.add.rectangle(0, ledgerY, 2, L.ledgerHeight * 0.56, 0xffffff, 0.18));
    const ledger = scene.add.container(0, ledgerY);
    body.add(ledger);

    /** `이름표 [그림] 값들…`을 한 덩어리로 `centerX`에 세운다. */
    function ledgerGroup(centerX: number, label: string, values: { text: string; color: string }[]): void {
      const gap = 12;
      const parts: Phaser.GameObjects.GameObject[] = [];
      const labelText = scene.add.text(0, 0, label, textStyle({ role: "emphasis", size: L.ledgerLabelSize, color: COLOR.inkDim })).setOrigin(0, 0.5);
      const hasIcon = scene.textures.exists(iconKey);
      const shadow = hasIcon ? scene.add.image(0, 4, iconKey).setDisplaySize(L.ledgerIcon, L.ledgerIcon).setTint(0x05070a).setAlpha(0.55) : undefined;
      const image = hasIcon ? scene.add.image(0, 0, iconKey).setDisplaySize(L.ledgerIcon, L.ledgerIcon) : undefined;
      const texts = values.map((value) => scene.add.text(0, 0, value.text, textStyle({ role: "display", size: L.ledgerValueSize, color: value.color })).setOrigin(0, 0.5));
      const iconWidth = hasIcon ? L.ledgerIcon + gap * 0.6 : 0;
      const total = labelText.width + gap * 1.4 + iconWidth + texts.reduce((sum, text) => sum + text.width, 0) + gap * (texts.length - 1);
      let x = centerX - total / 2;
      labelText.setX(x); x += labelText.width + gap * 1.4;
      if (shadow && image) { shadow.setX(x + L.ledgerIcon / 2 + 3); image.setX(x + L.ledgerIcon / 2); x += iconWidth; parts.push(shadow, image); }
      texts.forEach((text) => { text.setX(x); x += text.width + gap; });
      ledger.add([labelText, ...parts, ...texts]);
    }

    function paintLedger(count: number, cores: number): void {
      ledger.removeAll(true);
      ledgerGroup(-ledgerWidth / 4, t("rune.traitBulk.cost"), [{ text: `×${count.toLocaleString()}`, color: count > cores ? COLOR.dangerText : count > 0 ? COLOR.accentText : COLOR.inkDim }]);
      const after = cores - count;
      ledgerGroup(ledgerWidth / 4, t("popup.balance"), count > 0
        ? [{ text: cores.toLocaleString(), color: COLOR.ink }, { text: "→", color: COLOR.inkDim }, { text: after.toLocaleString(), color: COLOR.dangerText }]
        : [{ text: cores.toLocaleString(), color: COLOR.ink }]);
    }

    const grantButton = new Button(scene, 0, buttonTop + L.buttonHeight / 2 - half, {
      width: L.buttonWidth, height: L.buttonHeight, label: t("rune.traitBulk.title"), fontSize: 32, variant: "primary",
      onClick: () => confirmGrant(),
    });
    body.add(grantButton);

    function paint(): void {
      const count = picked().length;
      const cores = ownedCores();
      countText.setText(t("rune.traitBulk.selected", { count: count.toLocaleString(), total: candidates().length.toLocaleString() }));
      paintLedger(count, cores);
      const shown = grid.shown();
      const room = runeTraitBulkSelectable(cores);
      const all = shown.length > 0 && room > 0 && shown.slice(0, room).every((rune) => selected.includes(rune.instanceId));
      selectButton.setLabel(t(all ? "rune.bulkCraft.clearAll" : "rune.bulkCraft.selectAll"));
      selectButton.setEnabled(shown.length > 0 && room > 0);
      grantButton.setLabel(count > 0 ? t("rune.traitBulk.button", { count: count.toLocaleString() }) : t("rune.traitBulk.title"));
      grantButton.setEnabled(count > 0 && count <= cores);
    }

    function confirmGrant(): void {
      const ids = picked();
      const cores = ownedCores();
      if (ids.length === 0 || ids.length > cores) return;
      popups.confirm({
        title: t("rune.traitBulk.title"),
        message: t("rune.traitBulk.confirm", { count: ids.length.toLocaleString() }),
        confirmLabel: t("rune.traitBulk.title"),
        costs: [{ iconKey, amount: ids.length }],
        balance: { iconKey, before: cores, after: cores - ids.length },
      }, () => {
        void withBusy(scene, api.grantRuneTraitsBulk({ runeInstanceIds: ids, requestId: `trait-bulk-${Date.now()}` })).then((response) => {
          granted = true;
          audioManager?.playUi("rune.success");
          // 무엇이 어떻게 붙었고 누가 끼고 있는지는 결과 창이 한 번에 말한다 — 일괄 부여 판 위에 겹쳐 뜬다.
          openRuneTraitBulkResultPopup(scene, popups, response.runes);
          selected.length = 0;
          if (countText.active) { grid.repaint(); paint(); }
        }).catch((error: unknown) => {
          reportError("rune.traitBulk", error, { count: ids.length });
          showContentToast(scene, t("rune.traitBulk.failed"), "refused");
          if (countText.active) { grid.repaint(); paint(); }
        });
      });
    }

    paint();
  });
}
