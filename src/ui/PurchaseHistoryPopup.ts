import Phaser from "phaser";
import type { MailClaimHistoryEntryDto, PurchaseHistoryEntryDto, SentGiftHistoryEntryDto } from "../api/contracts";
import { formatCurrency } from "../core/formatCurrency";
import { PRODUCTS } from "../data/shopCatalog";
import { t } from "../i18n";
import { addCategoryTab } from "./CategoryTab";
import { Button } from "./Button";
import { confirmCancelGift } from "./GiftPopups";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawLayer } from "./holo";
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

/** 결제 → 보낸 선물 → 받은 우편 순이다. 보낸 선물은 결제가 낳는 것이라 결제 바로 옆에 둔다. */
export type PurchaseHistoryTab = "purchase" | "gift" | "mail";
const HISTORY_TABS: readonly PurchaseHistoryTab[] = ["purchase", "gift", "mail"];
const TAB_LABEL = { purchase: "settings.history.tab.purchase", gift: "settings.history.tab.gift", mail: "settings.history.tab.mail" } as const;
const TAB_GLYPH = { purchase: "receipt", gift: "heart", mail: "mail" } as const;
const TAB_EMPTY = { purchase: "settings.history.empty", gift: "settings.history.giftEmpty", mail: "settings.history.mailEmpty" } as const;
const GIFT_STATUS = {
  pending: "settings.history.gift.pending", accepted: "settings.history.gift.accepted",
  returned: "settings.history.gift.returned", revoked: "settings.history.gift.revoked",
} as const;

export interface PurchaseHistoryLists {
  entries: readonly PurchaseHistoryEntryDto[];
  sentGifts: readonly SentGiftHistoryEntryDto[];
  mails: readonly MailClaimHistoryEntryDto[];
  /** 받기 전의 선물을 취소한 뒤 목록을 다시 받아 창을 새로 세운다. 없으면 취소 칸을 세우지 않는다. */
  onGiftCancelled?: () => void;
}

const pad = (value: number): string => String(value).padStart(2, "0");
/** 기기 시각으로 `2026.11.10 17:30`. 시각이 없던 옛 거래는 날짜 자리를 비운다(지어낸 날짜를 적지 않는다). */
function purchasedLabel(at: string | null): string {
  if (!at) return t("settings.history.unknownDate");
  const date = new Date(at);
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface HistoryRow { name: string; meta: string; note?: string; tiles: { icon: string; amount: number }[]; gift?: SentGiftHistoryEntryDto }

const purchaseRow = (entry: PurchaseHistoryEntryDto): HistoryRow => ({
  name: PRODUCTS.find(candidate => candidate.id === entry.productId)?.name ?? entry.productId,
  meta: `${purchasedLabel(entry.purchasedAt)}  ·  ${entry.transactionTail}`,
  note: entry.firstBonusApplied ? t("settings.history.firstBonus") : undefined,
  tiles: grantTiles(entry.granted).map((tile) => ({ icon: tile.icon, amount: tile.amount })),
});

const sentGiftRow = (gift: SentGiftHistoryEntryDto): HistoryRow => {
  const product = PRODUCTS.find(candidate => candidate.id === gift.productId);
  return {
    name: product?.name ?? gift.productId,
    meta: `${purchasedLabel(gift.sentAt)}  ·  ${t("settings.history.gift.to", { name: gift.recipientName })}`,
    note: t(GIFT_STATUS[gift.status]),
    tiles: product ? grantTiles(product.grants).map((tile) => ({ icon: tile.icon, amount: tile.amount })) : [],
    gift,
  };
};

const mailRow = (mail: MailClaimHistoryEntryDto): HistoryRow => ({
  name: mail.title,
  meta: `${purchasedLabel(mail.receivedAt)}  ·  ${mail.sender}`,
  tiles: mail.rewards.map((reward) => ({ icon: rewardDtoTexture(reward), amount: reward.amount })),
});

/**
 * 계정 판의 「결제 기록」이 여는 창 — 「결제 기록」·「선물 기록」·「우편 기록」 세 탭이다.
 *
 * 결제 기록은 지급을 마친 플랫폼 거래만 최근 것부터 한 줄씩 선다 — 상품 이름, 지급 시각과 거래 꼬리표(끝 네 자리),
 * 받은 것의 액자. 값은 스토어 영수증이 말하므로 여기서 다시 적지 않는다. 문의할 때 대조할 수 있으면 된다.
 * 선물 기록은 내가 다른 연구원에게 보낸 선물이다(상품·보낸 시각·받는 이·상태). 선물하기가 열리기 전에는 비어 있다.
 * 우편 기록은 우편으로 받은 보상(운영 선물·쿠폰·순위 보상)이고, 제목·받은 시각·보낸 이·받은 것이 선다.
 * 탭과 쪽은 판을 닫지 않고 목록만 갈아 끼운다(`slideTabPage`).
 */
export function openPurchaseHistoryPopup(
  scene: Phaser.Scene, popups: PopupLayer,
  lists: PurchaseHistoryLists, initialTab: PurchaseHistoryTab = "purchase",
): void {
  const height = HISTORY_HEIGHT;
  const rowsOf = (tab: PurchaseHistoryTab): HistoryRow[] =>
    tab === "gift" ? lists.sentGifts.map(sentGiftRow) : tab === "mail" ? lists.mails.map(mailRow) : lists.entries.map(purchaseRow);
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
        // 빈 탭은 목록 자리 한가운데에 그 탭의 그림과 한 줄이 선다 — 맨 위 한 줄만 남기면 판 전체가 덜 그려진 칸으로 읽힌다.
        const midY = top + (HISTORY.rowsPerPage * HISTORY.rowHeight) / 2 - 40;
        container.add(drawGlyph(scene, TAB_GLYPH[tab], 0, midY - 70, 120, COLOR.inkDimHex, 0.45, 4));
        container.add(scene.add.text(0, midY + 40, t(TAB_EMPTY[tab]), textStyle({ role: "emphasis", size: 30, color: COLOR.inkDim, align: "center", wrap: HISTORY.width - 160 })).setOrigin(0.5));
        return container;
      }
      shown.forEach((row, index) => {
        const y = top + index * HISTORY.rowHeight;
        // 줄마다 유리 판 한 장 — 구분선만으로는 어느 액자가 어느 줄의 것인지 흐리다.
        container.add(drawLayer(scene, 0, y + (HISTORY.rowHeight - 24) / 2, chipPoints(HISTORY.width - 64, HISTORY.rowHeight - 24, { bevel: { topLeft: 18, bottomRight: 18 } }), { fill: 0x0f141b, alpha: 0.7, shadow: false, edge: COLOR.accent, edgeAlpha: 0.35 }));
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
        // 받기 전의 선물만 취소할 수 있다 — 주문 번호가 있는 줄(선물하기가 연 뒤의 주문)에만 선다.
        const gift = row.gift;
        if (gift?.status === "pending" && gift.orderId && lists.onGiftCancelled) {
          const orderId = gift.orderId;
          container.add(new Button(scene, HISTORY.width / 2 - 56 - 100, y + 128, {
            width: 200, height: 48, label: t("gift.cancel.action"), fontSize: 22,
            onClick: () => confirmCancelGift(scene, popups, { orderId, recipientName: gift.recipientName }, () => lists.onGiftCancelled?.()),
          }));
        }
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
          label: t(TAB_LABEL[id]), selected: id === tab,
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
