import Phaser from "phaser";
import type { GiftHistoryEntryDto, PurchaseHistoryEntryDto } from "../api/contracts";
import { formatCurrency } from "../core/formatCurrency";
import { PRODUCTS } from "../data/shopCatalog";
import { t } from "../i18n";
import { addCategoryTab } from "./CategoryTab";
import { drawGlyph } from "./glyphs";
import { drawHairline } from "./holo";
import { addFramedIcon } from "./itemFrame";
import type { PopupLayer } from "./PopupLayer";
import { grantTiles } from "./premiumModel";
import { pressIn, pressOut } from "./pressFeedback";
import { rewardDtoTexture } from "./rewardDtoIcon";
import { slideTabPage } from "./screenTransition";
import { shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/**
 * 결제 기록 창의 자리. 한 쪽에 다섯 줄이고, 넘치면 꺾쇠로 쪽을 넘긴다.
 * 판 높이는 다섯 줄 몫으로 고정한다 — 탭을 갈아 끼울 때 판이 커졌다 줄면 새로 연 창처럼 읽힌다.
 * 탭은 목록 아래 왼쪽(우편함과 같은 자리)이고, 오른쪽 아래 구석은 판 밖 뒤로가기의 자리라 비워 둔다.
 */
const HISTORY = {
  width: 900, rowsPerPage: 5, rowHeight: 168, top: 120, foot: 96, frame: 72, frameGap: 84, maxFrames: 5,
  tab: { width: 230, height: 72, gap: 12, bottom: 64 },
} as const;
const HISTORY_HEIGHT = HISTORY.top + HISTORY.rowsPerPage * HISTORY.rowHeight + HISTORY.foot + HISTORY.tab.height + HISTORY.tab.bottom;

export type PurchaseHistoryTab = "purchase" | "gift";
const HISTORY_TABS: readonly PurchaseHistoryTab[] = ["purchase", "gift"];

const pad = (value: number): string => String(value).padStart(2, "0");
/** 기기 시각으로 `2026.11.10 17:30`. 시각이 없던 옛 거래는 날짜 자리를 비운다(지어낸 날짜를 적지 않는다). */
function purchasedLabel(at: string | null): string {
  if (!at) return t("settings.history.unknownDate");
  const date = new Date(at);
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface HistoryRow { name: string; meta: string; note?: string; tiles: { icon: string; amount: number }[] }

const purchaseRow = (entry: PurchaseHistoryEntryDto): HistoryRow => ({
  name: PRODUCTS.find(candidate => candidate.id === entry.productId)?.name ?? entry.productId,
  meta: `${purchasedLabel(entry.purchasedAt)}  ·  ${entry.transactionTail}`,
  note: entry.firstBonusApplied ? t("settings.history.firstBonus") : undefined,
  tiles: grantTiles(entry.granted).map((tile) => ({ icon: tile.icon, amount: tile.amount })),
});

const giftRow = (gift: GiftHistoryEntryDto): HistoryRow => ({
  name: gift.title,
  meta: `${purchasedLabel(gift.receivedAt)}  ·  ${gift.sender}`,
  tiles: gift.rewards.map((reward) => ({ icon: rewardDtoTexture(reward), amount: reward.amount })),
});

/**
 * 계정 판의 「결제 기록」이 여는 창 — 「결제 기록」·「선물 기록」 두 탭이다.
 *
 * 결제 기록은 지급을 마친 플랫폼 거래만 최근 것부터 한 줄씩 선다 — 상품 이름, 지급 시각과 거래 꼬리표(끝 네 자리),
 * 받은 것의 액자. 값은 스토어 영수증이 말하므로 여기서 다시 적지 않는다. 문의할 때 대조할 수 있으면 된다.
 * 선물 기록은 우편으로 받은 보상(운영 선물·쿠폰·순위 보상)이고, 제목·받은 시각·보낸 이·받은 것이 선다.
 * 탭과 쪽은 판을 닫지 않고 목록만 갈아 끼운다(`slideTabPage`).
 */
export function openPurchaseHistoryPopup(
  scene: Phaser.Scene, popups: PopupLayer,
  entries: readonly PurchaseHistoryEntryDto[], gifts: readonly GiftHistoryEntryDto[] = [], initialTab: PurchaseHistoryTab = "purchase",
): void {
  const height = HISTORY_HEIGHT;
  const rowsOf = (tab: PurchaseHistoryTab): HistoryRow[] => tab === "gift" ? gifts.map(giftRow) : entries.map(purchaseRow);
  popups.open({ width: HISTORY.width, height, title: t("settings.history.title"), dim: true, backButton: true, closeOnBackdrop: true }, (body) => {
    let tab = initialTab;
    let list: Phaser.GameObjects.Container | undefined;
    let tabs: Phaser.GameObjects.Container | undefined;
    const top = -height / 2 + HISTORY.top;
    const left = -HISTORY.width / 2 + 56;
    const footY = top + HISTORY.rowsPerPage * HISTORY.rowHeight + HISTORY.foot / 2 - 24;
    const tabY = height / 2 - HISTORY.tab.bottom - HISTORY.tab.height / 2;

    const drawList = (page: number): Phaser.GameObjects.Container => {
      const rows = rowsOf(tab);
      const pages = Math.max(1, Math.ceil(rows.length / HISTORY.rowsPerPage));
      const current = Phaser.Math.Clamp(page, 0, pages - 1);
      const shown = rows.slice(current * HISTORY.rowsPerPage, (current + 1) * HISTORY.rowsPerPage);
      const container = scene.add.container(0, 0);
      if (shown.length === 0) {
        container.add(scene.add.text(0, top + HISTORY.rowHeight / 2 - 20, t(tab === "gift" ? "settings.history.giftEmpty" : "settings.history.empty"), textStyle({ role: "body", size: 28, color: COLOR.inkDim, align: "center" })).setOrigin(0.5));
        return container;
      }
      shown.forEach((row, index) => {
        const y = top + index * HISTORY.rowHeight;
        const name = scene.add.text(left, y + 22, row.name, textStyle({ role: "emphasis", size: 30, color: COLOR.ink })).setOrigin(0, 0.5);
        shrinkTextToWidth(name, 470);
        const meta = scene.add.text(left, y + 64, row.meta, textStyle({ role: "body", size: 23, color: COLOR.inkDim })).setOrigin(0, 0.5);
        shrinkTextToWidth(meta, 470);
        container.add([name, meta]);
        if (row.note) container.add(scene.add.text(left, y + 102, row.note, textStyle({ role: "emphasis", size: 21, color: COLOR.accentText })).setOrigin(0, 0.5));
        const tiles = row.tiles.slice(0, HISTORY.maxFrames);
        const right = HISTORY.width / 2 - 56 - HISTORY.frame / 2;
        tiles.forEach((tile, slot) => {
          const x = right - (tiles.length - 1 - slot) * HISTORY.frameGap;
          addFramedIcon(scene, container, x, y + 60, HISTORY.frame, tile.icon, { amount: formatCurrency(tile.amount), plain: true });
        });
        if (index < shown.length - 1) container.add(drawHairline(scene, 0, y + HISTORY.rowHeight - 24, HISTORY.width - 100, { alpha: 0.14 }));
      });
      if (pages <= 1) return container;
      container.add(scene.add.text(0, footY, `${current + 1} / ${pages}`, textStyle({ role: "emphasis", size: 26, color: COLOR.inkDim })).setOrigin(0.5));
      const arrow = (direction: -1 | 1): void => {
        const target = current + direction;
        if (target < 0 || target >= pages) return;
        const glyph = drawGlyph(scene, direction < 0 ? "page-prev" : "page-next", direction * 150, footY, 40, COLOR.accent, 1, 6);
        const hit = scene.add.rectangle(direction * 150, footY, 110, 96, 0xffffff, 0).setInteractive({ useHandCursor: true });
        hit.on("pointerdown", () => pressIn(glyph));
        hit.on("pointerout", () => pressOut(glyph, "normal", { pop: false }));
        hit.on("pointerup", () => { pressOut(glyph); show(target, direction); });
        container.add([glyph, hit]);
      };
      arrow(-1); arrow(1);
      return container;
    };

    /** 새 목록을 먼저 세우고 옛 목록을 걷는다. `slide`가 있으면 그 쪽에서 밀려 들어온다. */
    const show = (page: number, slide?: number): void => {
      const next = drawList(page);
      body.add(next);
      list?.destroy();
      list = next;
      if (slide) slideTabPage(scene, [next], 0, slide);
    };

    const drawTabs = (): void => {
      tabs?.destroy();
      tabs = scene.add.container(0, 0);
      HISTORY_TABS.forEach((id, index) => {
        const x = -HISTORY.width / 2 + 40 + HISTORY.tab.width / 2 + index * (HISTORY.tab.width + HISTORY.tab.gap);
        addCategoryTab(scene, tabs, {
          x, y: tabY, width: HISTORY.tab.width, height: HISTORY.tab.height,
          label: t(id === "gift" ? "settings.history.tab.gift" : "settings.history.tab.purchase"), selected: id === tab,
          onSelect: () => {
            if (id === tab) return;
            const from = HISTORY_TABS.indexOf(tab);
            tab = id;
            drawTabs();
            show(0, index - from);
          },
        });
      });
      body.add(tabs);
    };

    drawTabs();
    show(0);
  });
}
