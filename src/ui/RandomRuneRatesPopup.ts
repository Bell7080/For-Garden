import Phaser from "phaser";
import { t } from "../i18n";
import { formatRatePercent } from "../core/gachaRateTable";
import { runeRarityLabel } from "../core/runes";
import { RANDOM_RUNE_RARITY_PERCENT } from "../core/runeSynthesis";
import { GACHA_RATES } from "./gachaRatesLayout";
import { chipPoints, drawLayer, HOLO } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { addRuneFrame, RUNE_ACCENT } from "./runeIcons";
import { COLOR, textStyle } from "./theme";

/** 랜덤 룬 확률표의 줄 — 돌림판 확률표와 같은 크기다. */
const ROWS = { step: 86, height: 74, icon: 64 } as const;
const RARITIES = ["legendary", "epic", "rare", "uncommon"] as const;

/**
 * 랜덤 룬 등급 확률 정보 — 구매창에 펼치지 않고 작은 확률 링크를 눌러 여는 팝업이다.
 * 창 폭·윗변 고정·`{percent}%` 표기는 돌림판·연구 확률표와 같은 한 벌이고, 수는 서버가 굴리는 표
 * (`RANDOM_RUNE_RARITY_PERCENT`)에서 그대로 읽는다. 자리·옵션이 무작위라는 말은 상품 설명이 맡는다.
 */
export function openRandomRuneRates(scene: Phaser.Scene, popups: PopupLayer, note: string): void {
  const L = GACHA_RATES;
  const inner = L.width - L.padding * 2;
  const noteText = scene.add.text(0, 0, note, textStyle({ role: "body", size: L.notesSize, color: COLOR.inkDim, wrap: inner })).setOrigin(0, 0);
  const height = L.topRoom + RARITIES.length * ROWS.step + L.notesGap / 2 + noteText.height + L.bottomPad;

  popups.open({ width: L.width, height, title: t("lab.rates"), y: L.screenTop + height / 2, backButton: true, dim: true, closeOnBackdrop: true }, (body) => {
    let y = -height / 2 + L.topRoom + ROWS.height / 2;
    for (const rarity of RARITIES) {
      const row = scene.add.container(0, y);
      body.add(row);
      const accent = RUNE_ACCENT[rarity];
      row.add(drawLayer(scene, 0, 0, chipPoints(inner, ROWS.height, { bevel: { topLeft: 16, bottomRight: 16 } }), { fill: 0x121821, alpha: HOLO.glass + 0.2, edge: accent, edgeAlpha: 0.8 }));
      row.add(addRuneFrame(scene, -inner / 2 + 22 + ROWS.icon / 2, 0, ROWS.icon, rarity, 2));
      row.add(scene.add.text(-inner / 2 + 22 + ROWS.icon + 22, 0, runeRarityLabel(rarity), textStyle({ role: "emphasis", size: L.entryNameSize, color: `#${accent.toString(16).padStart(6, "0")}` })).setOrigin(0, 0.5));
      row.add(scene.add.text(inner / 2 - 30, 0, t("lab.rates.percent", { percent: formatRatePercent(RANDOM_RUNE_RARITY_PERCENT[rarity] / 100) }), textStyle({ role: "display", size: L.entryPercentSize + 3, color: COLOR.ink })).setOrigin(1, 0.5).setShadow(0, 3, "#000000", 4, false, true));
      y += ROWS.step;
    }
    body.add(noteText.setPosition(-inner / 2, y - ROWS.height / 2 + L.notesGap / 2));
  });
}
