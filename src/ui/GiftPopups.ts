import Phaser from "phaser";
import { gameApi } from "../api/FakeServer";
import type { GiftOptionDto, IncomingGiftDto } from "../api/contracts";
import { GameApiError } from "../api/contracts";
import { runGiftPurchase } from "../api/platformPurchase";
import { GIFTING_ENABLED } from "../core/gifting";
import { formatCurrency } from "../core/formatCurrency";
import { PRODUCTS } from "../data/shopCatalog";
import { t } from "../i18n";
import { logError } from "../managers/ErrorReporter";
import { platformPayment } from "../platform/payment";
import { Button } from "./Button";
import { showContentToast } from "./ContentToast";
import { drawHairline } from "./holo";
import { addFramedIcon } from "./itemFrame";
import type { PopupLayer } from "./PopupLayer";
import { grantTiles } from "./premiumModel";
import { rewardDtoTexture } from "./rewardDtoIcon";
import { shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/**
 * 선물하기의 창 셋 — 친구 카드의 「선물하기」가 여는 고르기 창, 결제 전에 정책을 말하는 확인 창, 받은 선물함.
 *
 * 모두 `GIFTING_ENABLED` 뒤에 선다. 스위치가 꺼진 동안은 어느 입구도 세우지 않고, 서버도 같은 스위치로 거절한다.
 * 자리는 결제 기록 창과 같은 결(한 줄 = 이름·곁말·액자 · 오른쪽 조작)이고, 판 밖 우하단 뒤로가기로 닫는다.
 */
const GIFT_LIST = { width: 900, rowHeight: 168, top: 130, bottom: 120, frame: 72, frameGap: 84, maxFrames: 3, maxRows: 5 } as const;
const listHeight = (rows: number): number => GIFT_LIST.top + Math.max(1, Math.min(rows, GIFT_LIST.maxRows)) * GIFT_LIST.rowHeight + GIFT_LIST.bottom;

const productName = (productId: string): string => PRODUCTS.find(product => product.id === productId)?.name ?? productId;
const productTiles = (productId: string): { icon: string; amount: number }[] => {
  const product = PRODUCTS.find(candidate => candidate.id === productId);
  return product ? grantTiles(product.grants).map(tile => ({ icon: tile.icon, amount: tile.amount })) : [];
};

const errorText = (error: unknown): string => error instanceof GameApiError ? error.message : t("gift.failed");

/** 친구 카드 밑동에 「선물하기」를 세울지 — 스위치 하나가 정한다. */
export const giftEntryOpen = (): boolean => GIFTING_ENABLED;

/** 친구에게 보낼 수 있는 상품을 늘어놓는다. 못 보내는 줄은 버튼 대신 그 이유 한 줄이 선다. */
export async function openGiftPicker(scene: Phaser.Scene, popups: PopupLayer, recipient: { id: string; name: string }): Promise<void> {
  if (!GIFTING_ENABLED) return;
  let options: readonly GiftOptionDto[];
  try {
    options = (await gameApi.getGiftOptions({ recipientId: recipient.id })).options;
  } catch (error) {
    if (scene.sys.isActive()) showContentToast(scene, errorText(error), "refused");
    return;
  }
  if (!scene.sys.isActive()) return;
  const height = listHeight(options.length);
  popups.open({ width: GIFT_LIST.width, height, title: t("gift.picker.title"), dim: true, backButton: true, closeOnBackdrop: true }, (body, close) => {
    const top = -height / 2 + GIFT_LIST.top;
    const left = -GIFT_LIST.width / 2 + 56;
    body.add(scene.add.text(0, top - 44, t("gift.picker.to", { name: recipient.name }), textStyle({ role: "emphasis", size: 26, color: COLOR.inkDim, align: "center" })).setOrigin(0.5));
    if (options.length === 0) {
      body.add(scene.add.text(0, top + GIFT_LIST.rowHeight / 2, t("gift.picker.empty"), textStyle({ role: "body", size: 28, color: COLOR.inkDim, align: "center" })).setOrigin(0.5));
      return;
    }
    options.slice(0, GIFT_LIST.maxRows).forEach((option, index) => {
      const y = top + index * GIFT_LIST.rowHeight;
      const name = scene.add.text(left, y + 30, productName(option.productId), textStyle({ role: "emphasis", size: 30, color: COLOR.ink })).setOrigin(0, 0.5);
      shrinkTextToWidth(name, 420);
      body.add(name);
      productTiles(option.productId).slice(0, GIFT_LIST.maxFrames).forEach((tile, slot) => {
        addFramedIcon(scene, body, left + GIFT_LIST.frame / 2 + slot * GIFT_LIST.frameGap, y + 100, GIFT_LIST.frame, tile.icon, { amount: formatCurrency(tile.amount), plain: true });
      });
      const right = GIFT_LIST.width / 2 - 56;
      if (option.eligible) {
        body.add(new Button(scene, right - 120, y + 66, {
          width: 240, height: 80, label: t("gift.picker.price", { price: option.priceKrw.toLocaleString("ko-KR") }), variant: "primary",
          onClick: () => confirmGift(scene, popups, recipient, option, close),
        }));
      } else if (option.reason) {
        const reason = scene.add.text(right, y + 66, t(`gift.refusal.${option.reason}`), textStyle({ role: "body", size: 22, color: COLOR.inkDim, align: "right", wrap: 330 })).setOrigin(1, 0.5);
        body.add(reason);
      }
      if (index < Math.min(options.length, GIFT_LIST.maxRows) - 1) body.add(drawHairline(scene, 0, y + GIFT_LIST.rowHeight - 14, GIFT_LIST.width - 100, { alpha: 0.14 }));
    });
  });
}

/** 결제 전에 정책 세 줄을 말한다 — 받기 전 취소 · 30일 뒤 반환 · 받은 뒤 환불의 제한. */
function confirmGift(scene: Phaser.Scene, popups: PopupLayer, recipient: { id: string; name: string }, option: GiftOptionDto, closePicker: () => void): void {
  popups.confirm({
    title: t("gift.confirm.title"),
    message: t("gift.confirm.message", { name: recipient.name, product: productName(option.productId) }),
    confirmLabel: t("gift.confirm.pay"),
  }, () => {
    void runGiftPurchase(gameApi, platformPayment(), recipient.id, option.productId).then((outcome) => {
      if (!scene.sys.isActive()) return;
      if (outcome.status === "sent") {
        closePicker();
        showContentToast(scene, t("gift.sent"), "info");
      } else if (outcome.status === "unsupported") {
        showContentToast(scene, t("gift.error.unavailable"), "refused");
      } else if (outcome.status === "failed") {
        showContentToast(scene, outcome.message ?? t("gift.failed"), "refused");
      }
    }, (error: unknown) => {
      logError("gift.send", "[gift] send failed", error);
      if (scene.sys.isActive()) showContentToast(scene, errorText(error), "refused");
    });
  });
}

const pad = (value: number): string => String(value).padStart(2, "0");
const dateLabel = (iso: string): string => {
  const date = new Date(iso);
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
};

/** 받은 선물함 — 줄마다 받기·거절. 받으면 그 자리에서 내 저장에 들어오고, 거절하면 보낸 이에게 돌아간다. */
export async function openGiftInbox(scene: Phaser.Scene, popups: PopupLayer, onChanged?: () => void): Promise<void> {
  if (!GIFTING_ENABLED) return;
  let gifts: readonly IncomingGiftDto[];
  try {
    gifts = (await gameApi.getIncomingGifts()).gifts;
  } catch (error) {
    if (scene.sys.isActive()) showContentToast(scene, errorText(error), "refused");
    return;
  }
  if (!scene.sys.isActive()) return;
  const height = listHeight(gifts.length);
  let busy = false;
  const act = (close: () => void, run: () => Promise<unknown>, done: string): void => {
    if (busy) return;
    busy = true;
    void run().then(() => {
      busy = false;
      if (!scene.sys.isActive()) return;
      close();
      showContentToast(scene, done, "info");
      onChanged?.();
    }, (error: unknown) => {
      busy = false;
      if (!(error instanceof GameApiError)) logError("gift.inbox", "[gift] inbox action failed", error);
      if (scene.sys.isActive()) showContentToast(scene, errorText(error), "refused");
    });
  };
  popups.open({ width: GIFT_LIST.width, height, title: t("gift.inbox.title"), dim: true, backButton: true, closeOnBackdrop: true }, (body, close) => {
    const top = -height / 2 + GIFT_LIST.top;
    const left = -GIFT_LIST.width / 2 + 56;
    if (gifts.length === 0) {
      body.add(scene.add.text(0, top + GIFT_LIST.rowHeight / 2 - 20, t("gift.inbox.empty"), textStyle({ role: "body", size: 28, color: COLOR.inkDim, align: "center" })).setOrigin(0.5));
      return;
    }
    gifts.slice(0, GIFT_LIST.maxRows).forEach((gift, index) => {
      const y = top + index * GIFT_LIST.rowHeight;
      const name = scene.add.text(left, y + 22, productName(gift.productId), textStyle({ role: "emphasis", size: 30, color: COLOR.ink })).setOrigin(0, 0.5);
      shrinkTextToWidth(name, 380);
      const meta = scene.add.text(left, y + 62, `${t("gift.inbox.from", { name: gift.senderName })}  ·  ${t("gift.inbox.expires", { date: dateLabel(gift.expiresAt) })}`, textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0, 0.5);
      shrinkTextToWidth(meta, 420);
      body.add([name, meta]);
      gift.grants.slice(0, GIFT_LIST.maxFrames).forEach((reward, slot) => {
        addFramedIcon(scene, body, left + GIFT_LIST.frame / 2 + slot * GIFT_LIST.frameGap, y + 120, 60, rewardDtoTexture(reward), { amount: formatCurrency(reward.amount), plain: true });
      });
      const right = GIFT_LIST.width / 2 - 56;
      body.add(new Button(scene, right - 90, y + 44, {
        width: 180, height: 68, label: t("gift.inbox.accept"), variant: "primary",
        onClick: () => act(close, () => gameApi.acceptGift({ orderId: gift.orderId, requestId: `gift-accept:${gift.orderId}`.slice(0, 64) }), t("gift.inbox.accepted")),
      }));
      body.add(new Button(scene, right - 90, y + 120, {
        width: 180, height: 56, label: t("gift.inbox.decline"),
        onClick: () => popups.confirm({
          title: t("gift.inbox.declineTitle"), message: t("gift.inbox.declineMessage", { name: gift.senderName }),
          confirmLabel: t("gift.inbox.decline"), destructive: true,
        }, () => act(close, () => gameApi.declineGift({ orderId: gift.orderId, requestId: `gift-decline:${gift.orderId}`.slice(0, 64) }), t("gift.inbox.declined"))),
      }));
      if (index < Math.min(gifts.length, GIFT_LIST.maxRows) - 1) body.add(drawHairline(scene, 0, y + GIFT_LIST.rowHeight - 10, GIFT_LIST.width - 100, { alpha: 0.14 }));
    });
  });
}

/** 결제 기록 창의 선물 줄이 부르는 취소 — 받기 전의 선물만 서고, 서버가 돌려준다. */
export function confirmCancelGift(scene: Phaser.Scene, popups: PopupLayer, gift: { orderId: string; recipientName: string }, onDone: () => void): void {
  popups.confirm({
    title: t("gift.cancel.title"), message: t("gift.cancel.message", { name: gift.recipientName }),
    confirmLabel: t("gift.cancel.action"), destructive: true,
  }, () => {
    void gameApi.cancelGift({ orderId: gift.orderId, requestId: `gift-cancel:${gift.orderId}`.slice(0, 64) }).then(() => {
      if (!scene.sys.isActive()) return;
      showContentToast(scene, t("gift.cancel.done"), "info");
      onDone();
    }, (error: unknown) => {
      if (!(error instanceof GameApiError)) logError("gift.cancel", "[gift] cancel failed", error);
      if (scene.sys.isActive()) showContentToast(scene, errorText(error), "refused");
    });
  });
}
