import Phaser from "phaser";
import { t } from "../i18n";
import { runeRarityLabel, type RuneRarity } from "../core/runes";
import { RUNE_SYNTHESIS_RULES, runeSynthesisRarityOdds } from "../core/runeSynthesis";
import { RUNE_TRAIT_GRADES, type RuneTraitGrade } from "../core/runeTraits";
import { KeywordManager } from "../managers/KeywordManager";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { chipPoints, drawHairline, drawLayer, HOLO } from "./holo";
import { addOddsTip, drawTipUnderline, type OddsTip } from "./oddsTip";
import type { PopupLayer } from "./PopupLayer";
import { POPUP_TITLE_SIZE } from "./popupGeometry";
import { RUNE_ACCENT, runeAccentCss } from "./runeIcons";
import { addSectionTitle } from "./SectionTitle";
import { shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/**
 * 룬 합성 확률표 — 등급별 결과 확률·골드, 그리고 넣은 룬의 최고 특성에 따른 결과 특성 확률.
 *
 * **표는 줄 판 위에 선다.** 글자만 격자로 늘어놓던 때는 어느 수가 어느 줄·칸의 것인지 눈으로 따라가야
 * 했다(응태 2026-11-23). 등급표는 줄마다 유리 판 한 장에 등급 칩 · 같은 등급 · 한 등급 위 · 골드가 서고
 * 밑변의 갈린 막대가 두 확률의 몫을 그림으로 말한다. 특성표는 칸마다 결과 등급 색으로 물든 타일이고
 * 확률이 클수록 짙다 — 한눈에 어느 쪽으로 기우는지가 읽힌다.
 *
 * **머리글·칸을 누르면 그 칸의 뜻 쪽지가 뜬다**(`addOddsTip` — 규칙어 태그와 같은 용어 쪽지). 머리글의
 * 점선 밑줄이 「눌러 볼 수 있다」를 말한다.
 *
 * 숫자는 전부 `RUNE_SYNTHESIS_RULES`에서 그대로 읽는다. 창 높이는 쌓인 줄에서 거꾸로 구한다.
 */
const ODDS = {
  width: 960,
  padding: 40,
  top: 96,
  headHeight: 50,
  rowHeight: 76,
  rowStep: 84,
  sectionGap: 92,
  matrixHead: 58,
  matrixRow: 66,
  matrixStep: 72,
  /** 등급표 칸 — 등급 칩 폭, 두 확률 칸의 가운데, 골드는 오른쪽 끝에 붙는다. */
  chipWidth: 168,
  chipHeight: 48,
  sameX: 330,
  upX: 545,
  /** 특성표 첫 칸(줄 머리)의 폭. */
  headColumn: 190,
  headSize: 22,
  cellSize: 27,
  noteSize: 21,
  bottomPad: 44,
} as const;
const RARITIES: readonly RuneRarity[] = ["uncommon", "rare", "epic", "legendary"];
type TraitKey = "none" | RuneTraitGrade;
const TRAIT_KEYS: readonly TraitKey[] = ["none", ...RUNE_TRAIT_GRADES];
const NONE_TONE = 0x9aa3ad;

function traitTone(key: TraitKey): number { return key === "none" ? NONE_TONE : RUNE_ACCENT[key]; }
function traitLabel(key: TraitKey): string { return key === "none" ? t("archaeology.synth.traitNone") : runeRarityLabel(key); }

export function openRuneSynthesisOdds(options: { scene: Phaser.Scene; popups: PopupLayer }): void {
  const { scene, popups } = options;
  const keywords = new KeywordManager(scene, popups);
  const inner = ODDS.width - ODDS.padding * 2;
  // 풀이 글은 판을 열기 전에 세워 높이를 잰다 — 언어마다 줄 수가 다르다.
  const note = scene.add.text(0, 0, t("archaeology.synth.oddsNote", { shift: RUNE_SYNTHESIS_RULES.extraTraitShiftPercent }),
    textStyle({ role: "body", size: ODDS.noteSize, color: COLOR.inkDim, align: "center", wrap: inner - 20 })).setOrigin(0.5, 0);
  const rarityBlock = ODDS.headHeight + 12 + RARITIES.length * ODDS.rowStep;
  const traitBlock = ODDS.matrixHead + 10 + TRAIT_KEYS.length * ODDS.matrixStep;
  const height = ODDS.top + rarityBlock + ODDS.sectionGap + traitBlock + 34 + note.height + ODDS.bottomPad;

  popups.open({ width: ODDS.width, height, title: t("archaeology.synth.oddsTitle"), titleSize: POPUP_TITLE_SIZE.workboard, dim: true, backButton: true }, (body) => {
    const left = -ODDS.width / 2 + ODDS.padding;
    let y = -height / 2 + ODDS.top;

    // ── 결과 등급 ─────────────────────────────────────────────
    addSectionTitle(scene, left, y - 38, t("archaeology.synth.oddsRarity"), { parent: body, size: 28 });
    const goldRight = left + inner - 24;
    paintHeadStrip(scene, body, left, y, inner, ODDS.headHeight);
    const headY = y + ODDS.headHeight / 2;
    addHead(scene, body, keywords, left + 24 + ODDS.chipWidth / 2, headY, t("archaeology.synth.oddsInput"), t("archaeology.synth.tip.input"));
    addHead(scene, body, keywords, left + ODDS.sameX, headY, t("archaeology.synth.oddsSame"), t("archaeology.synth.tip.same"));
    addHead(scene, body, keywords, left + ODDS.upX, headY, t("archaeology.synth.oddsUp"), t("archaeology.synth.tip.up"));
    addHead(scene, body, keywords, goldRight - 70, headY, t("archaeology.synth.oddsGold"), t("archaeology.synth.tip.gold"));
    y += ODDS.headHeight + 12;

    RARITIES.forEach((rarity, index) => {
      paintRarityRow(scene, body, keywords, left, y, inner, rarity, index);
      y += ODDS.rowStep;
    });

    // ── 결과 특성 ─────────────────────────────────────────────
    y += ODDS.sectionGap - (ODDS.rowStep - ODDS.rowHeight);
    addSectionTitle(scene, left, y - 38, t("archaeology.synth.oddsTrait"), { parent: body, size: 28 });
    const cellStep = (inner - ODDS.headColumn) / TRAIT_KEYS.length;
    const cellX = (index: number): number => left + ODDS.headColumn + cellStep * (index + 0.5);
    paintHeadStrip(scene, body, left, y, inner, ODDS.matrixHead);
    const mHead = y + ODDS.matrixHead / 2;
    addHead(scene, body, keywords, left + ODDS.headColumn / 2, mHead, t("archaeology.synth.oddsBest"), t("archaeology.synth.tip.best"));
    TRAIT_KEYS.forEach((key, index) => {
      addHead(scene, body, keywords, cellX(index), mHead, traitLabel(key), t("archaeology.synth.tip.result"), traitTone(key), cellStep - 8);
    });
    y += ODDS.matrixHead + 10;

    TRAIT_KEYS.forEach((best) => {
      const rowY = y + ODDS.matrixRow / 2;
      // 줄 머리 — 최고 특성 등급 칩.
      const head = scene.add.container(left + ODDS.headColumn / 2 - 6, rowY);
      body.add(head);
      paintGradeChip(scene, head, ODDS.headColumn - 28, ODDS.chipHeight, traitLabel(best), traitTone(best));
      addOddsTip(scene, head, ODDS.headColumn - 28, ODDS.chipHeight, keywords, {
        term: traitLabel(best), description: t("archaeology.synth.tip.bestRow", { best: traitLabel(best) }),
      });
      RUNE_SYNTHESIS_RULES.traitPercent[best].forEach((percent, column) => {
        const result = TRAIT_KEYS[column];
        const cell = scene.add.container(cellX(column), rowY);
        body.add(cell);
        const w = cellStep - 10;
        const shape = chipPoints(w, ODDS.matrixRow, { bevel: { topLeft: 10, bottomRight: 10 } });
        // 확률이 클수록 짙다 — 표 전체가 어느 쪽으로 기우는지가 색의 짙기로 읽힌다.
        cell.add(drawLayer(scene, 0, 0, shape, {
          fill: percent > 0 ? traitTone(result) : 0x0d131b, alpha: percent > 0 ? 0.1 + (percent / 100) * 0.62 : 0.55,
          shadow: false, edge: percent > 0 ? traitTone(result) : undefined, edgeAlpha: 0.55,
        }));
        cell.add(scene.add.text(0, 0, percent > 0 ? `${percent}%` : "—",
          textStyle({ role: "display", size: ODDS.cellSize, color: percent > 0 ? COLOR.ink : COLOR.inkDim }))
          .setOrigin(0.5).setShadow(0, 3, "#000000", 4, false, true));
        addOddsTip(scene, cell, w, ODDS.matrixRow, keywords, {
          term: `${traitLabel(best)} → ${traitLabel(result)}`,
          description: percent > 0
            ? t("archaeology.synth.tip.traitCell", { best: traitLabel(best), result: traitLabel(result), percent })
            : t("archaeology.synth.tip.traitNever", { best: traitLabel(best), result: traitLabel(result) }),
        });
      });
      y += ODDS.matrixStep;
    });

    y += 34 - (ODDS.matrixStep - ODDS.matrixRow);
    body.add(drawHairline(scene, 0, y - 16, inner - 80, { color: COLOR.accent, alpha: 0.28 }));
    note.setPosition(0, y);
    body.add(note);
  });
}

/** 표 머리 띠 — 짙은 유리에 윗변 강조선 한 줄. */
function paintHeadStrip(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, left: number, top: number, width: number, height: number): void {
  const shape = chipPoints(width, height, { bevel: { topLeft: 14, bottomRight: 14 } });
  parent.add(drawLayer(scene, left + width / 2, top + height / 2, shape, { fill: 0x0a1017, alpha: 0.92, shadow: false, edge: COLOR.accent, edgeAlpha: 0.7 }));
}

/** 누를 수 있는 머리글 하나 — 글자 + 점선 밑줄. */
function addHead(
  scene: Phaser.Scene, parent: Phaser.GameObjects.Container, keywords: KeywordManager,
  x: number, y: number, label: string, description: string, tone?: number, maxWidth = 200,
): void {
  const holder = scene.add.container(x, y);
  parent.add(holder);
  const text = scene.add.text(0, -2, label, textStyle({ role: "emphasis", size: ODDS.headSize, color: tone === undefined ? COLOR.inkDim : `#${tone.toString(16).padStart(6, "0")}` })).setOrigin(0.5);
  shrinkTextToWidth(text, maxWidth);
  holder.add(text);
  holder.add(drawTipUnderline(scene, -text.displayWidth / 2, 12, text.displayWidth, tone ?? 0xa9b4bf, 0.55));
  const tip: OddsTip = { term: label, description };
  addOddsTip(scene, holder, Math.max(110, text.displayWidth + 30), ODDS.headHeight - 6, keywords, tip);
}

/** 등급 칩 — 짙은 유리에 등급색 윤곽과 글자. 룬 액자와 같은 방향으로 깎는다. */
function paintGradeChip(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, width: number, height: number, label: string, tone: number): void {
  const shape = chipPoints(width, height, { bevel: { topLeft: 12, bottomRight: 12 } });
  parent.add(drawLayer(scene, 0, 0, shape, { fill: 0x0b1118, alpha: 0.95, shadow: { x: 3, y: 4 }, edge: tone, edgeAlpha: 0.95 }));
  const text = scene.add.text(0, 0, label, textStyle({ role: "display", size: 25, color: `#${tone.toString(16).padStart(6, "0")}` })).setOrigin(0.5);
  shrinkTextToWidth(text, width - 24);
  parent.add(text);
}

/** 등급표 한 줄 — 줄 판 · 등급 칩 · 같은 등급 · 한 등급 위 · 골드 · 밑변의 갈린 막대. */
function paintRarityRow(
  scene: Phaser.Scene, parent: Phaser.GameObjects.Container, keywords: KeywordManager,
  left: number, top: number, width: number, rarity: RuneRarity, index: number,
): void {
  const odds = runeSynthesisRarityOdds(rarity);
  const tone = RUNE_ACCENT[rarity];
  const gold = RUNE_SYNTHESIS_RULES.goldCost[rarity].toLocaleString("en-US");
  const grade = runeRarityLabel(rarity);
  const rowY = top + ODDS.rowHeight / 2;
  const shape = chipPoints(width, ODDS.rowHeight, { bevel: { topLeft: 16, bottomRight: 16 } });
  parent.add(drawLayer(scene, left + width / 2, rowY, shape, { fill: index % 2 === 0 ? 0x121a24 : 0x16202c, alpha: HOLO.glass + 0.22, shadow: { x: 4, y: 5 } }));

  // 등급 칩 — 그 줄의 요약 쪽지를 연다.
  const chip = scene.add.container(left + 24 + ODDS.chipWidth / 2, rowY - 4);
  parent.add(chip);
  paintGradeChip(scene, chip, ODDS.chipWidth, ODDS.chipHeight, grade, tone);
  addOddsTip(scene, chip, ODDS.chipWidth, ODDS.chipHeight, keywords, {
    term: t("archaeology.synth.tip.rowTerm", { grade }),
    description: odds.next
      ? t("archaeology.synth.tip.row", { grade, gold, same: odds.same, up: odds.up })
      : t("archaeology.synth.tip.rowTop", { grade, gold }),
  });

  const cell = (x: number, label: string, color: string, tip: OddsTip, cellWidth = 190): void => {
    const holder = scene.add.container(x, rowY - 4);
    parent.add(holder);
    holder.add(scene.add.text(0, 0, label, textStyle({ role: "display", size: ODDS.cellSize, color })).setOrigin(0.5).setShadow(0, 3, "#000000", 4, false, true));
    addOddsTip(scene, holder, cellWidth, ODDS.rowHeight - 14, keywords, tip);
  };
  cell(left + ODDS.sameX, `${odds.same}%`, COLOR.ink, {
    term: `${grade} → ${grade}`, description: t("archaeology.synth.tip.rarityCell", { input: grade, result: grade, percent: odds.same }),
  });
  if (odds.next) {
    const next = runeRarityLabel(odds.next);
    cell(left + ODDS.upX, `${next} ${odds.up}%`, runeAccentCss(odds.next), {
      term: `${grade} → ${next}`, description: t("archaeology.synth.tip.rarityCell", { input: grade, result: next, percent: odds.up }),
    });
  } else {
    cell(left + ODDS.upX, "—", COLOR.inkDim, { term: t("archaeology.synth.oddsUp"), description: t("archaeology.synth.tip.noUp", { grade }) });
  }

  // 골드 — 그림 + 수를 바짝 붙여 오른쪽 끝에 세운다.
  const goldHolder = scene.add.container(left + width - 24 - 90, rowY - 4);
  parent.add(goldHolder);
  const amount = scene.add.text(90, 0, gold, textStyle({ role: "display", size: 26, color: COLOR.accentText })).setOrigin(1, 0.5).setShadow(0, 3, "#000000", 4, false, true);
  goldHolder.add(scene.add.image(90 - amount.width - 22, 0, CURRENCY_ICON_BY_WALLET.gold).setDisplaySize(36, 36));
  goldHolder.add(amount);
  addOddsTip(scene, goldHolder, 200, ODDS.rowHeight - 14, keywords, {
    term: t("archaeology.synth.oddsGold"), description: t("archaeology.synth.tip.goldCell", { grade, gold }),
  });

  // 밑변의 갈린 막대 — 같은 등급(그 등급색, 옅게)과 한 등급 위(다음 등급색) 몫.
  const barLeft = left + ODDS.chipWidth + 60;
  const barWidth = ODDS.upX - ODDS.chipWidth - 60 + 110;
  const barY = rowY + ODDS.rowHeight / 2 - 13;
  const bar = scene.add.graphics();
  bar.fillStyle(0x000000, 0.55);
  bar.fillRect(barLeft, barY, barWidth, 6);
  const sameWidth = barWidth * (odds.same / 100);
  bar.fillStyle(tone, 0.6);
  bar.fillRect(barLeft, barY, sameWidth, 6);
  if (odds.next) {
    bar.fillStyle(RUNE_ACCENT[odds.next], 1);
    bar.fillRect(barLeft + sameWidth, barY, barWidth - sameWidth, 6);
  }
  parent.add(bar);
}
