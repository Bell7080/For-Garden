import Phaser from "phaser";
import type { PurchaseHistoryEntryDto } from "../api/contracts";
import { formatCurrency } from "../core/formatCurrency";
import { PRODUCTS } from "../data/shopCatalog";
import { t } from "../i18n";
import { drawGlyph } from "./glyphs";
import { drawHairline } from "./holo";
import { addFramedIcon } from "./itemFrame";
import type { PopupLayer } from "./PopupLayer";
import { grantTiles } from "./premiumModel";
import { pressIn, pressOut } from "./pressFeedback";
import { shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/** 결제 기록 창의 자리. 한 쪽에 다섯 줄이고, 넘치면 아래 꺾쇠로 쪽을 넘긴다. */
const HISTORY = { width: 900, rowsPerPage: 5, rowHeight: 168, top: 120, foot: 130, frame: 72, frameGap: 84, maxFrames: 5 } as const;

const pad = (value: number): string => String(value).padStart(2, "0");
/** 기기 시각으로 `2026.11.10 17:30`. 시각이 없던 옛 거래는 날짜 자리를 비운다(지어낸 날짜를 적지 않는다). */
function purchasedLabel(at: string | null): string {
  if (!at) return t("settings.history.unknownDate");
  const date = new Date(at);
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 계정 판의 「결제 기록」이 여는 창.
 *
 * 지급을 마친 플랫폼 거래만 최근 것부터 한 줄씩 선다 — 상품 이름, 지급 시각과 거래 꼬리표(끝 네 자리),
 * 받은 것의 액자. 값은 스토어 영수증이 말하므로 여기서 다시 적지 않는다. 문의할 때 대조할 수 있으면 된다.
 */
export function openPurchaseHistoryPopup(scene: Phaser.Scene, popups: PopupLayer, entries: readonly PurchaseHistoryEntryDto[], page = 0): void {
  const pages = Math.max(1, Math.ceil(entries.length / HISTORY.rowsPerPage));
  const current = Phaser.Math.Clamp(page, 0, pages - 1);
  const shown = entries.slice(current * HISTORY.rowsPerPage, (current + 1) * HISTORY.rowsPerPage);
  const rows = Math.max(1, shown.length);
  const height = HISTORY.top + rows * HISTORY.rowHeight + (pages > 1 ? HISTORY.foot : 40);
  popups.open({ width: HISTORY.width, height, title: t("settings.history.title"), dim: true, backButton: true, closeOnBackdrop: true }, (body, close) => {
    const top = -height / 2 + HISTORY.top;
    const left = -HISTORY.width / 2 + 56;
    if (shown.length === 0) {
      body.add(scene.add.text(0, top + HISTORY.rowHeight / 2 - 20, t("settings.history.empty"), textStyle({ role: "body", size: 28, color: COLOR.inkDim, align: "center" })).setOrigin(0.5));
      return;
    }
    shown.forEach((entry, index) => {
      const y = top + index * HISTORY.rowHeight;
      const product = PRODUCTS.find(candidate => candidate.id === entry.productId);
      const name = scene.add.text(left, y + 22, product?.name ?? entry.productId, textStyle({ role: "emphasis", size: 30, color: COLOR.ink })).setOrigin(0, 0.5);
      shrinkTextToWidth(name, 470);
      const meta = scene.add.text(left, y + 64, `${purchasedLabel(entry.purchasedAt)}  ·  ${entry.transactionTail}`, textStyle({ role: "body", size: 23, color: COLOR.inkDim })).setOrigin(0, 0.5);
      body.add([name, meta]);
      if (entry.firstBonusApplied) body.add(scene.add.text(left, y + 102, t("settings.history.firstBonus"), textStyle({ role: "emphasis", size: 21, color: COLOR.accentText })).setOrigin(0, 0.5));
      const tiles = grantTiles(entry.granted).slice(0, HISTORY.maxFrames);
      const right = HISTORY.width / 2 - 56 - HISTORY.frame / 2;
      tiles.forEach((tile, slot) => {
        const x = right - (tiles.length - 1 - slot) * HISTORY.frameGap;
        addFramedIcon(scene, body, x, y + 60, HISTORY.frame, tile.icon, { amount: formatCurrency(tile.amount), plain: true });
      });
      if (index < shown.length - 1) body.add(drawHairline(scene, 0, y + HISTORY.rowHeight - 24, HISTORY.width - 100, { alpha: 0.14 }));
    });
    if (pages <= 1) return;
    const footY = height / 2 - HISTORY.foot / 2;
    body.add(scene.add.text(0, footY, `${current + 1} / ${pages}`, textStyle({ role: "emphasis", size: 26, color: COLOR.inkDim })).setOrigin(0.5));
    const arrow = (direction: -1 | 1): void => {
      const target = current + direction;
      if (target < 0 || target >= pages) return;
      const glyph = drawGlyph(scene, direction < 0 ? "page-prev" : "page-next", direction * 150, footY, 40, COLOR.accent, 1, 6);
      const hit = scene.add.rectangle(direction * 150, footY, 110, 96, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => pressIn(glyph));
      hit.on("pointerout", () => pressOut(glyph, "normal", { pop: false }));
      // 쪽을 넘길 때는 닫고 같은 제목으로 다시 연다 — 판이 갈아 끼워지므로 등장 연출이 다시 돌지 않는다.
      hit.on("pointerup", () => { pressOut(glyph); close(); openPurchaseHistoryPopup(scene, popups, entries, target); });
      body.add([glyph, hit]);
    };
    arrow(-1); arrow(1);
  });
}
