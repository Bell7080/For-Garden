import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import type { GameApi } from "../api/contracts";
import {
  DEFAULT_RUNE_BULK_SELL_CRITERIA, planRuneBulkSell, RUNE_CRAFT_STATES, RUNE_TRAIT_PRESENCE, toggleBulkSellValue,
  type RuneBulkSellCriteria, type RuneCraftState, type RuneTraitPresence,
} from "../core/runeBulkSell";
import { runePartLabel, runeRarityLabel, type RunePart, type RuneRarity } from "../core/runes";
import { WALLET_CAPS } from "../data/economy";
import { runeSellValue } from "../data/runes";
import { audioManager } from "../managers/AudioManager";
import { reportError } from "../managers/ErrorReporter";
import { InventoryManager } from "../managers/InventoryManager";
import { session } from "../state/session";
import { withBusy } from "./BusyOverlay";
import { Button, DESTRUCTIVE_BUTTON_STYLE } from "./Button";
import { showContentToast } from "./ContentToast";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { PopupLayer } from "./PopupLayer";
import { addPriceBar } from "./priceTag";
import { addTextChip } from "./RelicFilterPopup";
import { RELIC_FILTER_POPUP, relicFilterChipWidth, relicFilterChipX } from "./relicGridLayout";
import { RUNE_BULK_SELL, runeBulkSellFrameX, runeBulkSellLayout } from "./runeBulkSellLayout";
import { addRuneFrame, RUNE_ACCENT } from "./runeIcons";
import { equippedRuneSlot } from "./RunePopup";
import { COLOR, textStyle } from "./theme";

const RARITIES: readonly RuneRarity[] = ["uncommon", "rare", "epic", "legendary"];
const PARTS: readonly RunePart[] = [0, 1, 2];
const CRAFT_LABEL: Record<RuneCraftState, TextKey> = { fresh: "rune.bulkSell.craft.fresh", crafting: "rune.bulkSell.craft.crafting", engraved: "rune.bulkSell.craft.engraved" };
const TRAIT_LABEL: Record<RuneTraitPresence, TextKey> = { without: "rune.bag.trait.without", with: "rune.bag.trait.with" };
/** 세공 상태·특성 칩의 윗변 색. 손을 댄 쪽일수록 붉게 기울어 「팔기 아까운 쪽」이 먼저 읽힌다. */
const CRAFT_TONE: Record<RuneCraftState, number> = { fresh: COLOR.accent, crafting: 0xf0a35a, engraved: 0xe0536a };
const TRAIT_TONE: Record<RuneTraitPresence, number> = { without: COLOR.accent, with: 0xe0536a };

/** 고른 조건은 앱이 켜져 있는 동안 기억한다 — 정리를 몇 번 이어 하는 손이 매번 다시 고르지 않게. */
let lastCriteria: RuneBulkSellCriteria = DEFAULT_RUNE_BULK_SELL_CRITERIA;

/**
 * 룬 조건별 일괄 판매 판.
 *
 * 위의 칩 네 줄(등급 · 부위 · 세공 · 특성)이 판매 대상을 고르고, 아래 미리보기 · 예상 수령 · 판매 버튼이 고른
 * 결과를 그 자리에서 말한다. 어느 룬이 팔리는지는 `planRuneBulkSell` 한 곳이 정하고, 판매 버튼은 공용 확인 창을
 * 한 번 거친다(되돌릴 수 없다). 판 밖 우하단 돌아가기와 판 밖 누르기로 닫히고 오른쪽 위 X는 두지 않는다.
 */
export function openRuneBulkSellPopup(scene: Phaser.Scene, popups: PopupLayer, api: GameApi): void {
  const layout = runeBulkSellLayout(4);
  const L = RUNE_BULK_SELL;
  popups.open({ width: L.width, height: layout.height, title: t("rune.bulkSell.title"), dim: true, closeOnBackdrop: true }, (body) => {
    const left = -L.width / 2 + RELIC_FILTER_POPUP.padding;
    const label = (y: number, text: string): void => {
      body.add(scene.add.text(left, y, text, textStyle({ role: "display", size: 28, color: COLOR.accentText })).setOrigin(0, 0.5));
    };
    const row = <T>(index: number, title: string, values: readonly T[], name: (value: T) => string, tone: (value: T) => number, read: () => readonly T[], write: (next: T[]) => void): void => {
      const { labelY, chipY } = layout.sections[index];
      label(labelY, title);
      values.forEach((value, at) => {
        addTextChip(scene, body, relicFilterChipX(at, values.length), chipY, relicFilterChipWidth(values.length), name(value), tone(value),
          () => read().includes(value),
          () => { write(toggleBulkSellValue(read(), value, values)); paint(); });
      });
    };
    row(0, t("relics.filter.rarity"), RARITIES, runeRarityLabel, (rarity) => RUNE_ACCENT[rarity], () => lastCriteria.rarities, (rarities) => { lastCriteria = { ...lastCriteria, rarities }; });
    row(1, t("inventory.sort.part"), PARTS, runePartLabel, () => COLOR.accent, () => lastCriteria.parts, (parts) => { lastCriteria = { ...lastCriteria, parts }; });
    row(2, t("rune.craft"), RUNE_CRAFT_STATES, (state) => t(CRAFT_LABEL[state]), (state) => CRAFT_TONE[state], () => lastCriteria.craft, (craft) => { lastCriteria = { ...lastCriteria, craft }; });
    row(3, t("rune.bag.trait.all"), RUNE_TRAIT_PRESENCE, (presence) => t(TRAIT_LABEL[presence]), (presence) => TRAIT_TONE[presence], () => lastCriteria.trait, (trait) => { lastCriteria = { ...lastCriteria, trait }; });

    // 고른 결과가 서는 층 — 칩을 누를 때마다 이 층만 다시 그린다.
    const summary = scene.add.container(0, 0);
    body.add(summary);
    const plan = () => planRuneBulkSell(session.runeInventory, lastCriteria, { isEquipped: (id) => equippedRuneSlot(id) !== undefined, sellValue: runeSellValue });

    const sell = new Button(scene, 0, layout.buttonY, {
      ...DESTRUCTIVE_BUTTON_STYLE, width: L.buttonWidth, height: L.buttonHeight, label: t("rune.sell"), fontSize: 30,
      onClick: () => confirmSale(),
    });
    body.add(sell);

    function paint(): void {
      summary.removeAll(true);
      const current = plan();
      const count = current.runes.length;
      if (count === 0) {
        summary.add(scene.add.text(0, layout.previewY, t("rune.bulkSell.empty"), textStyle({ role: "body", size: 26, color: COLOR.inkDim })).setOrigin(0.5));
      } else {
        const shown = Math.min(count, L.maxFrames);
        const overflow = count > L.maxFrames;
        for (let index = 0; index < shown; index += 1) {
          const x = runeBulkSellFrameX(index, shown);
          if (overflow && index === shown - 1) {
            summary.add(scene.add.text(x, layout.previewY, `+${(count - shown + 1).toLocaleString()}`, textStyle({ role: "display", size: 30, color: COLOR.ink })).setOrigin(0.5));
            continue;
          }
          const rune = current.runes[index];
          summary.add(addRuneFrame(scene, x, layout.previewY, L.frame, rune.rarity, rune.part, { mainStats: rune.mainStats, engraved: rune.engravings.length > 0 }));
        }
      }
      const note = current.protectedCount > 0 ? t("rune.bulkSell.protectedCount", { count: current.protectedCount.toLocaleString() }) : t("rune.bulkSell.protected");
      summary.add(scene.add.text(0, layout.noteY, note, textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0.5));
      summary.add(addPriceBar(scene, undefined, 0, layout.barY, L.width - RELIC_FILTER_POPUP.padding * 2, t("rune.bulkSell.receive"), "rawStone", current.rawStone, { height: L.barHeight }));
      sell.setLabel(count > 0 ? t("rune.bulkSell.sellCount", { count: count.toLocaleString() }) : t("rune.sell"));
      sell.setEnabled(count > 0);
    }

    function confirmSale(): void {
      const current = plan();
      const count = current.runes.length;
      if (count === 0) return;
      const before = session.wallet.rawStone;
      // 원석 상한을 넘으면 서버가 통째로 거부한다 — 묻기 전에 막아 확인 창 뒤에서 실패하지 않게 한다.
      if (before + current.rawStone > WALLET_CAPS.rawStone) { showContentToast(scene, t("rune.bulkSell.capFull"), "refused"); return; }
      popups.confirm({
        title: t("rune.bulkSell.title"),
        message: t("rune.bulkSell.confirm", { count: count.toLocaleString() }),
        balance: { iconKey: CURRENCY_ICON_BY_WALLET.rawStone, before, after: before + current.rawStone },
        confirmLabel: t("rune.sell"),
        destructive: true,
      }, () => {
        const ids = current.runes.map(({ instanceId }) => instanceId);
        void withBusy(scene, new InventoryManager(session).sellRunes(api, ids)).then((response) => {
          audioManager?.playUi("sell.coins");
          showContentToast(scene, t("rune.bulkSell.done", { count: ids.length.toLocaleString(), amount: response.rawStoneAwarded.toLocaleString() }), "info");
          if (summary.active) paint();
        }).catch((error: unknown) => {
          reportError("rune.bulkSell", error, { count: ids.length });
          showContentToast(scene, t("rune.bulkSell.failed"), "refused");
          if (summary.active) paint();
        });
      });
    }

    paint();
  });
}
