import Phaser from "phaser";
import type { RuneInstance } from "../core/runes";
import { session } from "../state/session";
import { Button } from "./Button";
import { addRuneBagToggles } from "./runeHolderCycle";
import { addRuneCard } from "./runeIcons";
import { equippedRuneSlot } from "./RunePopup";
import { COLOR, textStyle } from "./theme";
import { pressIn, pressOut } from "./pressFeedback";
import { RUNE_PICK_GRID, runePickerSize } from "./runePickerLayout";

export function mountRunePickerGrid(
  scene: Phaser.Scene,
  body: Phaser.GameObjects.Container,
  options: {
    runes: readonly RuneInstance[];
    onPick: (rune: RuneInstance) => void;
    /** 팝업이 떠 있는 동안 손을 뗀 카드가 되돌아가지 않게 하는 검사. */
    isCovered?: () => boolean;
  },
): void {
  const g = RUNE_PICK_GRID;
  const { width, height, perPage } = runePickerSize(options.runes.length);
  const top = -height / 2;
  const firstX = -((g.columns - 1) * g.cellWidth) / 2;
  const grid = scene.add.container(0, 0);
  body.add(grid);
  let page = 0;
  const paint = (): void => {
    grid.removeAll(true);
    const view = session.settings.game.runeBag;
    const shown = view.showEquipped ? options.runes : options.runes.filter((rune) => equippedRuneSlot(rune.instanceId) === undefined);
    const pages = Math.max(1, Math.ceil(shown.length / perPage));
    page = Math.min(page, pages - 1);
    shown.slice(page * perPage, (page + 1) * perPage).forEach((rune, order) => {
      const x = firstX + (order % g.columns) * g.cellWidth;
      const y = top + g.headerHeight + Math.floor(order / g.columns) * g.cellHeight;
      const holder = equippedRuneSlot(rune.instanceId);
      const card = addRuneCard(scene, x, y, g.cardWidth, g.cardHeight, rune, {
        holder: holder && view.showHolder ? { relicId: holder.relicId } : undefined,
      });
      const hit = scene.add.rectangle(0, 0, g.cardWidth, g.cardHeight, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => pressIn(card));
      hit.on("pointerout", () => { if (!options.isCovered?.()) pressOut(card, "normal", { pop: false }); });
      hit.on("pointerup", () => { pressOut(card); options.onPick(rune); });
      card.add(hit);
      grid.add(card);
    });
    if (options.runes.length > perPage) {
      const y = height / 2 - g.footerHeight / 2 - 24;
      const step = (delta: number): void => { page = (page + delta + pages) % pages; paint(); };
      grid.add(new Button(scene, -200, y, { width: 120, height: 72, label: "<", onClick: () => step(-1) }));
      grid.add(new Button(scene, 200, y, { width: 120, height: 72, label: ">", onClick: () => step(1) }));
      grid.add(scene.add.text(0, y, `${page + 1} / ${pages}`, textStyle({ role: "emphasis", size: 30, color: COLOR.ink })).setOrigin(0.5));
    }
  };
  addRuneBagToggles(scene, body, -width / 2 + g.padX, top + g.toggleY, () => { page = 0; paint(); });
  paint();
}
