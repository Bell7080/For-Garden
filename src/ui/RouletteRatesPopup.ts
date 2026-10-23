import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { formatRatePercent } from "../core/gachaRateTable";
import { ROULETTE_REWARDS, rouletteRate, rouletteRateOrder } from "../core/roulette";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { GACHA_RATES } from "./gachaRatesLayout";
import { chipPoints, drawLayer, HOLO } from "./holo";
import { addFramedIcon } from "./itemFrame";
import type { PopupLayer } from "./PopupLayer";
import { ROULETTE_TONE } from "./rouletteWheel";
import { addSectionTitle } from "./SectionTitle";
import { shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/** 돌림판 확률표의 줄 — 연구 확률표의 세부 줄(액자 · 이름 · 확률)과 같은 크기를 쓴다. */
const ROWS = { step: 86, height: 74, icon: 64 } as const;

/**
 * 돌림판 확률 정보 — **연구 확률표와 같은 한 벌**(창 폭·윗변 고정·기준 줄·`{percent}%`·규칙 제목표)이다.
 * 칸이 여덟뿐이라 등급으로 접지 않고 한 줄씩 다 세운다. 수는 전부 `rouletteRate`가 지급표의 가중치에서 셈한 값이다.
 */
export function openRouletteRates(scene: Phaser.Scene, popups: PopupLayer): void {
  const L = GACHA_RATES;
  const inner = L.width - L.padding * 2;
  const notes = scene.add.text(0, 0, [t("roulette.rates.noteSlices"), t("roulette.rates.noteServer"), t("roulette.daily")].map((line) => `· ${line}`).join("\n"),
    textStyle({ role: "body", size: L.notesSize, color: COLOR.inkDim, lineSpacing: 10, wrap: inner })).setOrigin(0, 0);
  const order = rouletteRateOrder();
  const height = Math.min(L.maxHeight, L.topRoom + L.captionRoom + order.length * ROWS.step + L.notesGap + L.notesTitleRoom + notes.height + L.bottomPad - (ROWS.step - ROWS.height));

  popups.open({ width: L.width, height, title: t("lab.rates"), y: L.screenTop + height / 2, backButton: true, dim: true, closeOnBackdrop: true }, (body) => {
    const left = -L.width / 2 + L.padding;
    let y = -height / 2 + L.topRoom;
    body.add(scene.add.text(left, y, t("roulette.rates.basis"), textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5));
    y += L.captionRoom - L.tierHeight / 2 + ROWS.height / 2;
    for (const index of order) {
      addRateRow(scene, body, y, inner, index);
      y += ROWS.step;
    }
    y += L.notesGap - ROWS.step + ROWS.height / 2;
    addSectionTitle(scene, left, y, t("roulette.rates.rules"), { size: 28, parent: body });
    y += L.notesTitleRoom;
    body.add(notes.setPosition(left, y));
  });
}

/** 한 줄 — `[액자] 젬 ×1,000 • • • 0.5%`. 대박 칸만 테가 금빛이다. */
function addRateRow(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, y: number, width: number, index: number): void {
  const reward = ROULETTE_REWARDS[index];
  const holder = scene.add.container(0, y);
  parent.add(holder);
  const jackpot = reward.tier === "jackpot";
  const edge = jackpot ? ROULETTE_TONE.jackpot : reward.tier === "rare" ? ROULETTE_TONE.rim : 0x8a939e;
  holder.add(drawLayer(scene, 0, 0, chipPoints(width, ROWS.height, { bevel: { topLeft: 16, bottomRight: 16 } }),
    { fill: jackpot ? 0x2a2210 : 0x121821, alpha: HOLO.glass + 0.2, edge, edgeAlpha: reward.tier === "common" ? 0.5 : 0.95 }));
  const left = -width / 2 + 22;
  const right = width / 2 - 30;
  addFramedIcon(scene, holder, left + ROWS.icon / 2, 0, ROWS.icon, CURRENCY_ICON_BY_WALLET[reward.currency]);
  const name = scene.add.text(left + ROWS.icon + 22, 0, `${t(`currency.${reward.currency}` as TextKey)} ×${reward.amount.toLocaleString()}`,
    textStyle({ role: "emphasis", size: GACHA_RATES.entryNameSize, color: jackpot ? COLOR.accentText : COLOR.ink })).setOrigin(0, 0.5);
  const percent = scene.add.text(right, 0, t("lab.rates.percent", { percent: formatRatePercent(rouletteRate(index)) }),
    textStyle({ role: "display", size: GACHA_RATES.entryPercentSize + 3, color: jackpot ? COLOR.accentText : COLOR.ink })).setOrigin(1, 0.5).setShadow(0, 3, "#000000", 4, false, true);
  shrinkTextToWidth(name, percent.x - percent.width - name.x - 60);
  holder.add([name, percent]);
  // 이름과 확률을 잇는 점줄 — 연구 확률표의 등급 줄과 같은 결.
  const dots = scene.add.graphics();
  dots.fillStyle(edge, 0.7);
  for (let dx = name.x + name.displayWidth + 24; dx <= percent.x - percent.width - 24; dx += 22) {
    dots.fillPoints([new Phaser.Geom.Point(dx, -4), new Phaser.Geom.Point(dx + 4, 0), new Phaser.Geom.Point(dx, 4), new Phaser.Geom.Point(dx - 4, 0)], true);
  }
  holder.add(dots);
}
