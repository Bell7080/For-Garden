import { t } from "../i18n";
import { InventoryManager, type InventorySort } from "../managers/InventoryManager";
import { SortControl } from "./SortControl";
import { activeFontFamily } from "./fonts";
import Phaser from "phaser";
import { runeDisplayName, runePartLabel, runeRarityLabel, type RuneInstance } from "../core/runes";
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
    isActive?: () => boolean;
  },
): void {
  const g = RUNE_PICK_GRID;
  const { width, height, perPage } = runePickerSize(options.runes.length);
  const top = -height / 2;
  const firstX = -((g.columns - 1) * g.cellWidth) / 2;
  const grid = scene.add.container(0, 0);
  body.add(grid);
  let page = 0;
  let query = "", rarity = "all", part = "all";
  const sort: InventorySort = { key: "relic", direction: "asc" };
  const inventory = new InventoryManager(session);
  const allowed = new Set(options.runes.map(rune => rune.instanceId));
  const paint = (): void => {
    grid.removeAll(true);
    const view = session.settings.game.runeBag;
    const shown = inventory.displayList("rune", sort).flatMap(item => item.kind === "rune" ? [item.rune] : []).filter(rune =>
      allowed.has(rune.instanceId) && (view.showEquipped || equippedRuneSlot(rune.instanceId) === undefined)
      && (rarity === "all" || rarity === rune.rarity) && (part === "all" || part === String(rune.part))
      && `${runeDisplayName(rune)} ${runePartLabel(rune.part)} ${runeRarityLabel(rune.rarity)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
    grid.add(scene.add.text(width / 2 - g.padX, top + 82, `${shown.length} / ${options.runes.length}`, textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(1, 0.5));
    if (!shown.length) grid.add(scene.add.text(0, top + g.headerHeight, "0", textStyle({ role: "body", size: 30, color: COLOR.inkDim })).setOrigin(0.5));
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
  const refresh = (): void => { page = 0; paint(); };
  const input = document.createElement("input");
  input.type = "search";
  input.placeholder = t("relics.search");
  input.setAttribute("aria-label", t("relics.search"));
  input.style.cssText = `width:410px;height:58px;background:#24282e;color:#f2f0ec;border:1px solid #3a404a;padding:0 14px;box-sizing:border-box;font:24px ${activeFontFamily()}`;
  const dom = scene.add.dom(-190, top + 150, input);
  body.add(dom);
  const syncInput = (): void => {
    const active = options.isActive?.() ?? true;
    dom.setVisible(active);
    if (!active) input.blur();
  };
  scene.events.on(Phaser.Scenes.Events.PRE_UPDATE, syncInput);
  body.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.PRE_UPDATE, syncInput);
    input.blur();
  });
  input.addEventListener("input", () => { query = input.value; refresh(); });
  input.addEventListener("keydown", event => { if (event.key === "Enter") input.blur(); });
  new SortControl(scene, {
    x: 230, y: top + 150, height: 60, sortWidth: 220, dirWidth: 60, gap: 12, fontSize: 24, parent: body,
    sortOptions: [
      { id: "relic", label: t("inventory.sort.relic") }, { id: "acquired", label: t("inventory.sort.acquired") },
      { id: "rarity", label: t("inventory.sort.rarity") }, { id: "part", label: t("inventory.sort.part") },
      { id: "enhancement", label: t("inventory.sort.craft") }, { id: "equipped", label: t("inventory.sort.equipped") },
    ], sortMode: sort.key, descending: false,
    onSort: key => { sort.key = key; refresh(); },
    onDirection: descending => { sort.direction = descending ? "desc" : "asc"; refresh(); },
  });
  const filters = scene.add.container(0, top + 222);
  body.add(filters);
  const paintFilters = (): void => {
    filters.removeAll(true);
    const grades = ["all", "uncommon", "rare", "epic", "legendary"] as const;
    const parts = ["all", "0", "1", "2"] as const;
    filters.add(new Button(scene, -265, 0, { width: 250, height: 58,
      label: `${t("inventory.sort.rarity")}: ${rarity === "all" ? t("friends.filter.all") : runeRarityLabel(grades.find(x => x === rarity && x !== "all") as "uncommon" | "rare" | "epic" | "legendary")}`,
      onClick: () => { rarity = grades[(grades.indexOf(rarity as typeof grades[number]) + 1) % grades.length]; paintFilters(); refresh(); } }));
    filters.add(new Button(scene, 0, 0, { width: 250, height: 58,
      label: `${t("inventory.sort.part")}: ${part === "all" ? t("friends.filter.all") : runePartLabel(Number(part) as 0 | 1 | 2)}`,
      onClick: () => { part = parts[(parts.indexOf(part as typeof parts[number]) + 1) % parts.length]; paintFilters(); refresh(); } }));
    filters.add(new Button(scene, 265, 0, { width: 250, height: 58, label: t("relics.filter.reset"),
      onClick: () => { rarity = part = "all"; query = input.value = ""; paintFilters(); refresh(); } }));
  };
  paintFilters();
  paint();
}
