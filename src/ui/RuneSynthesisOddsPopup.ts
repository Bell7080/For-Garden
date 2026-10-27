import Phaser from "phaser";
import { t } from "../i18n";
import { runeRarityLabel, type RuneRarity } from "../core/runes";
import { RUNE_SYNTHESIS_RULES, runeSynthesisRarityOdds } from "../core/runeSynthesis";
import { RUNE_TRAIT_GRADES } from "../core/runeTraits";
import type { PopupLayer } from "./PopupLayer";
import { POPUP_TITLE_SIZE } from "./popupGeometry";
import { runeAccentCss } from "./runeIcons";
import { addSectionTitle } from "./SectionTitle";
import { COLOR, textStyle } from "./theme";

/**
 * 룬 합성 확률표 — 등급별 결과 확률·골드, 그리고 넣은 룬의 최고 특성에 따른 결과 특성 확률.
 *
 * 숫자는 전부 `RUNE_SYNTHESIS_RULES`에서 그대로 읽는다. 창 높이는 쌓인 줄에서 거꾸로 구한다.
 */
const ODDS = { width: 960, padding: 44, rowStep: 58, headSize: 22, cellSize: 25, sectionGap: 96, top: 92 } as const;
const RARITIES: readonly RuneRarity[] = ["uncommon", "rare", "epic", "legendary"];

export function openRuneSynthesisOdds(options: { scene: Phaser.Scene; popups: PopupLayer }): void {
  const { scene, popups } = options;
  const traitKeys = ["none", ...RUNE_TRAIT_GRADES] as const;
  const rarityRows = RARITIES.length + 1;
  const traitRows = traitKeys.length + 1;
  const height = ODDS.top + rarityRows * ODDS.rowStep + ODDS.sectionGap + traitRows * ODDS.rowStep + 70 + ODDS.padding;
  popups.open({ width: ODDS.width, height, title: t("archaeology.synth.oddsTitle"), titleSize: POPUP_TITLE_SIZE.workboard, dim: true, backButton: true }, (body) => {
    const left = -ODDS.width / 2 + ODDS.padding;
    const right = ODDS.width / 2 - ODDS.padding;
    let y = -height / 2 + ODDS.top;
    addSectionTitle(scene, left, y - 34, t("archaeology.synth.oddsRarity"), { parent: body });
    // 등급표: 넣은 등급 | 같은 등급 | 한 등급 위 | 골드
    const cols = [left, left + 230, left + 450, right];
    const head = (x: number, text: string, origin = 0): void => { body.add(scene.add.text(x, y + 20, text, textStyle({ role: "emphasis", size: ODDS.headSize, color: COLOR.inkDim })).setOrigin(origin, 0.5)); };
    head(cols[0], t("archaeology.synth.oddsInput")); head(cols[1], t("archaeology.synth.oddsSame")); head(cols[2], t("archaeology.synth.oddsUp")); head(cols[3], t("archaeology.synth.oddsGold"), 1);
    y += ODDS.rowStep;
    RARITIES.forEach((rarity) => {
      const odds = runeSynthesisRarityOdds(rarity);
      const rowY = y + 20;
      body.add(scene.add.text(cols[0], rowY, runeRarityLabel(rarity), textStyle({ role: "display", size: ODDS.cellSize, color: runeAccentCss(rarity) })).setOrigin(0, 0.5));
      body.add(scene.add.text(cols[1], rowY, `${odds.same}%`, textStyle({ role: "emphasis", size: ODDS.cellSize })).setOrigin(0, 0.5));
      body.add(scene.add.text(cols[2], rowY, odds.next ? `${runeRarityLabel(odds.next)} ${odds.up}%` : "—", textStyle({ role: "emphasis", size: ODDS.cellSize, color: odds.next ? runeAccentCss(odds.next) : COLOR.inkDim })).setOrigin(0, 0.5));
      body.add(scene.add.text(cols[3], rowY, RUNE_SYNTHESIS_RULES.goldCost[rarity].toLocaleString("en-US"), textStyle({ role: "emphasis", size: ODDS.cellSize, color: COLOR.accentText })).setOrigin(1, 0.5));
      y += ODDS.rowStep;
    });

    y += ODDS.sectionGap;
    addSectionTitle(scene, left, y - 34, t("archaeology.synth.oddsTrait"), { parent: body });
    // 특성표: 넣은 룬의 최고 특성 | 없음 · 고급 · 희귀 · 영웅 · 전설
    const firstCol = left + 210;
    const step = (right - firstCol) / 5;
    const gradeLabel = (key: (typeof traitKeys)[number]): string => key === "none" ? t("archaeology.synth.traitNone") : runeRarityLabel(key);
    body.add(scene.add.text(left, y + 20, t("archaeology.synth.oddsBest"), textStyle({ role: "emphasis", size: ODDS.headSize, color: COLOR.inkDim })).setOrigin(0, 0.5));
    traitKeys.forEach((key, index) => {
      body.add(scene.add.text(firstCol + step * (index + 0.5), y + 20, gradeLabel(key), textStyle({ role: "emphasis", size: ODDS.headSize, color: key === "none" ? COLOR.inkDim : runeAccentCss(key) })).setOrigin(0.5));
    });
    y += ODDS.rowStep;
    traitKeys.forEach((key) => {
      const rowY = y + 20;
      body.add(scene.add.text(left, rowY, gradeLabel(key), textStyle({ role: "display", size: ODDS.cellSize, color: key === "none" ? COLOR.ink : runeAccentCss(key) })).setOrigin(0, 0.5));
      RUNE_SYNTHESIS_RULES.traitPercent[key].forEach((percent, index) => {
        body.add(scene.add.text(firstCol + step * (index + 0.5), rowY, percent > 0 ? `${percent}%` : "—",
          textStyle({ role: "body", size: ODDS.cellSize, color: percent > 0 ? COLOR.ink : COLOR.inkDim })).setOrigin(0.5));
      });
      y += ODDS.rowStep;
    });
    body.add(scene.add.text(0, y + 30, t("archaeology.synth.oddsNote", { shift: RUNE_SYNTHESIS_RULES.extraTraitShiftPercent }),
      textStyle({ role: "body", size: 21, color: COLOR.inkDim, align: "center", wrap: ODDS.width - ODDS.padding * 2 })).setOrigin(0.5));
  });
}
