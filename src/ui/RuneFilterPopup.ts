import Phaser from "phaser";
import { t } from "../i18n";
import { toggleFilterValue } from "../core/relicFilter";
import { EMPTY_RUNE_LIST_FILTER, runeListFilterCount, type RuneListFilter } from "../core/runeListFilter";
import { RUNE_MAIN_STAT_KEYS, runePartLabel, runeRarityLabel, type RunePart, type RuneRarity } from "../core/runes";
import { addTextChip } from "./RelicFilterPopup";
import { drawLayer, slantedRect } from "./holo";
import { PopupLayer } from "./PopupLayer";
import { pressIn, pressOut } from "./pressFeedback";
import { RELIC_FILTER_POPUP, relicFilterChipWidth, relicFilterChipX, relicFilterPopupLayout } from "./relicGridLayout";
import { RUNE_ACCENT } from "./runeIcons";
import { runeStatLabel } from "./RunePopup";
import { STAT_TONE } from "./statTones";
import { COLOR, textStyle } from "./theme";

const RARITIES: readonly RuneRarity[] = ["uncommon", "rare", "epic", "legendary"];
const PARTS: readonly RunePart[] = [0, 1, 2];

/**
 * 룬 목록을 좁히는 조건 판 — 등급 · 부위 · 주 옵션.
 *
 * 도감 필터 판과 **같은 판·같은 칩·같은 배치표**(`relicFilterPopupLayout`)를 쓴다 — 같은 깔때기를 눌러 여는
 * 판이 목록마다 다른 모양이면 무엇을 고르는 판인지 다시 읽어야 한다. 고른 것은 곧바로 목록에 반영되고,
 * 부위가 하나로 정해진 목록(장착 가방)은 `parts: false`로 그 줄을 세우지 않는다.
 */
export function openRuneFilterPopup(
  scene: Phaser.Scene,
  popups: PopupLayer,
  anchor: { x: number; y: number },
  current: () => RuneListFilter,
  onChange: (filter: RuneListFilter) => void,
  options: { parts: boolean },
): void {
  const chip = RELIC_FILTER_POPUP.textChipHeight;
  const sections = options.parts ? [{ chipHeight: chip }, { chipHeight: chip }, { chipHeight: chip }] : [{ chipHeight: chip }, { chipHeight: chip }];
  const at = options.parts ? { rarity: 0, part: 1, main: 2 } : { rarity: 0, part: -1, main: 1 };
  const hasCondition = runeListFilterCount(current()) > 0;
  const layout = relicFilterPopupLayout(sections, hasCondition);
  popups.open({ width: RELIC_FILTER_POPUP.width, height: layout.height, title: t("relics.filter"), anchor, closeOnBackdrop: true, hideCloseButton: true }, (body, close) => {
    const left = -RELIC_FILTER_POPUP.width / 2 + RELIC_FILTER_POPUP.padding;
    const label = (y: number, text: string): void => {
      body.add(scene.add.text(left, y, text, textStyle({ role: "display", size: 28, color: COLOR.accentText })).setOrigin(0, 0.5));
    };

    label(layout.sections[at.rarity].labelY, t("relics.filter.rarity"));
    RARITIES.forEach((rarity, index) => {
      addTextChip(scene, body, relicFilterChipX(index, RARITIES.length), layout.sections[at.rarity].chipY, relicFilterChipWidth(RARITIES.length), runeRarityLabel(rarity), RUNE_ACCENT[rarity],
        () => current().rarities.includes(rarity),
        () => onChange({ ...current(), rarities: toggleFilterValue(current().rarities, rarity) }));
    });

    if (options.parts) {
      label(layout.sections[at.part].labelY, t("inventory.sort.part"));
      PARTS.forEach((part, index) => {
        addTextChip(scene, body, relicFilterChipX(index, PARTS.length), layout.sections[at.part].chipY, relicFilterChipWidth(PARTS.length), runePartLabel(part), COLOR.accent,
          () => current().parts.includes(part),
          () => onChange({ ...current(), parts: toggleFilterValue(current().parts, part) }));
      });
    }

    label(layout.sections[at.main].labelY, t("rune.mainOption"));
    RUNE_MAIN_STAT_KEYS.forEach((key, index) => {
      addTextChip(scene, body, relicFilterChipX(index, RUNE_MAIN_STAT_KEYS.length), layout.sections[at.main].chipY, relicFilterChipWidth(RUNE_MAIN_STAT_KEYS.length), runeStatLabel(key), STAT_TONE[key],
        () => current().mainStats.includes(key),
        () => onChange({ ...current(), mainStats: toggleFilterValue(current().mainStats, key) }));
    });

    // 걸린 조건이 없으면 해제 줄을 세우지 않는다(도감 필터와 같다). 검색 글·토글은 제 자리가 지운다.
    if (hasCondition) {
      const reset = scene.add.container(0, layout.resetY);
      const { height } = RELIC_FILTER_POPUP.reset;
      reset.add(drawLayer(scene, 0, 0, slantedRect(300, height, 16), { fill: 0x241a1e, alpha: 0.96, edge: 0xe23a46, edgeAlpha: 0.7 }));
      reset.add(scene.add.text(0, 0, t("relics.filter.reset"), textStyle({ role: "emphasis", size: 25, color: "#f1a3ab" })).setOrigin(0.5));
      const hit = scene.add.rectangle(0, 0, 300, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => pressIn(reset));
      hit.on("pointerout", () => pressOut(reset, "normal", { pop: false }));
      hit.on("pointerup", () => { pressOut(reset); close(); onChange(EMPTY_RUNE_LIST_FILTER); });
      reset.add(hit);
      body.add(reset);
    }
  });
}
