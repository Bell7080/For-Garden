import Phaser from "phaser";
import type { GameApi, ProductDto, PurchaseProductResponse } from "../api/contracts";
import { formatCurrency } from "../core/formatCurrency";
import { quotePurchase, totalGrantAmount } from "../core/purchase";
import type { Wallet } from "../core/gacha";
import { Button } from "./Button";
import { chipPoints, drawHairline, drawLayer, HOLO } from "./holo";
import { addItemFrame, ITEM_FRAME } from "./itemFrame";
import { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { openRewardPopup, productGrantsToRewardItems } from "./RewardPopup";

/** 신규 상점과 무역이 같은 수량·표시·요청 잠금을 쓰는 공용 구매 작업판이다. */
export class PurchasePopup {
  private quantity = 1;
  private pending = false;
  private message = "";
  private repaint?: () => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly popups: PopupLayer,
    private readonly api: GameApi,
    private readonly wallet: Wallet,
  ) {}

  /** 카드는 구매를 실행하지 않고 이 진입점으로 상품 원본을 전달한다. */
  open(product: ProductDto, onPurchased: (result: PurchaseProductResponse) => void | Promise<void>): void {
    // 카탈로그가 제안한 기본 수량도 잔액·제한 quote를 거쳐 실제 가능한 범위로 정규화된다.
    this.quantity = product.defaultQuantity; this.pending = false; this.message = "";
    this.popups.open({ width: 820, height: 850, title: "구매 확인", dim: true, closeOnBackdrop: false }, (body, close) => {
      const view = this.scene.add.container(0, 0); body.add(view);
      const render = (): void => { view.removeAll(true); this.paint(view, product, close, onPurchased); };
      this.repaint = render;
      view.once(Phaser.GameObjects.Events.DESTROY, () => { this.repaint = undefined; });
      render();
    });
  }

  /** 아이콘부터 지급량·단가·수량·총가격·제한·확정 순으로 한눈에 읽히게 배치한다. */
  private paint(view: Phaser.GameObjects.Container, product: ProductDto, close: () => void, onPurchased: (result: PurchaseProductResponse) => void | Promise<void>): void {
    // 이 수량 작업판은 재화 교환만 담당하며 다른 방식은 전용 확정 경계가 연다.
    if (product.acquisition.kind !== "currency") return;
    const acquisition = product.acquisition;
    const balance = this.wallet[acquisition.currency];
    const quote = quotePurchase({ unitPrice: acquisition.amount, remaining: product.remaining, balance }, this.quantity);
    this.quantity = quote.quantity;
    const grant = product.grants[0];
    const unitGrant = grant?.kind === "currency" ? grant.amount : 1;
    const grantLabel = grant?.kind === "currency" ? currencyName(grant.currency) : grant?.name ?? "지급품";

    // 상품 그림만 사방 액자로 두고 나머지는 홀로그램 면과 구분선만 사용한다.
    view.add(drawLayer(this.scene, 0, -215, chipPoints(690, 230, { bevel: { topLeft: 38, topRight: 0, bottomRight: 28, bottomLeft: 0 } }), { fill: 0x141b24, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.45 }));
    view.add(addItemFrame(this.scene, -245, -215, 150));
    view.add(this.scene.add.image(-245, -215, product.iconKey).setDisplaySize(150 * ITEM_FRAME.icon, 150 * ITEM_FRAME.icon));
    view.add(this.scene.add.text(-135, -275, product.name, textStyle({ role: "display", size: 32 })).setOrigin(0, 0.5));
    view.add(this.scene.add.text(-135, -212, `${grantLabel}  × ${formatCurrency(totalGrantAmount(unitGrant, quote.quantity))}`, textStyle({ role: "emphasis", size: 27, color: COLOR.accentText })).setOrigin(0, 0.5));
    view.add(this.scene.add.text(-135, -157, `1개 지급 ${formatCurrency(unitGrant)}`, textStyle({ role: "body", size: 21, color: COLOR.inkDim })).setOrigin(0, 0.5));

    view.add(drawHairline(this.scene, 0, -55, 690, { color: COLOR.accent, alpha: 0.32 }));
    this.addValueRow(view, -5, "단가", priceText(product.acquisition, product.acquisition.amount));
    this.addValueRow(view, 75, "구매 개수", formatCurrency(quote.quantity));
    this.addValueRow(view, 155, "총가격", priceText(product.acquisition, quote.totalPrice), true);
    this.addValueRow(view, 235, "남은 구매 제한", `${formatCurrency(product.remaining)} / ${formatCurrency(product.purchaseLimit)}`);

    // 수량 조작은 순수 모델이 계산한 실제 구매 가능 상한에서만 활성화한다.
    const minus = new Button(this.scene, 105, 75, { width: 76, height: 58, label: "−", fontSize: 30, onClick: () => this.changeQuantity(product, -1) }).setEnabled(!this.pending && quote.quantity > 1);
    const plus = new Button(this.scene, 205, 75, { width: 76, height: 58, label: "+", fontSize: 30, onClick: () => this.changeQuantity(product, 1) }).setEnabled(!this.pending && quote.quantity < quote.maxQuantity);
    view.add([minus, plus]);
    const canPurchase = product.purchasable && quote.valid && !this.pending;
    const buy = new Button(this.scene, 0, 345, { width: 650, height: 86, label: this.pending ? "처리 중" : "구매", fontSize: 31, variant: "primary", onClick: () => { void this.purchase(product, close, onPurchased); } }).setEnabled(canPurchase);
    view.add(buy);
    const status = this.message || (!product.purchasable ? product.disabledReason ?? "구매할 수 없습니다." : !quote.valid ? "잔액 또는 구매 제한이 부족합니다." : "");
    if (status) view.add(this.scene.add.text(0, 410, status, textStyle({ role: "body", size: 21, color: COLOR.inkDim })).setOrigin(0.5));
  }

  /** 이름과 값을 같은 기준선에 놓아 가격 비교 시 시선이 흔들리지 않게 한다. */
  private addValueRow(view: Phaser.GameObjects.Container, y: number, label: string, value: string, emphasized = false): void {
    view.add(this.scene.add.text(-325, y, label, textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5));
    view.add(this.scene.add.text(325, y, value, textStyle({ role: "emphasis", size: emphasized ? 31 : 26, color: emphasized ? COLOR.accentText : COLOR.ink })).setOrigin(1, 0.5));
  }

  /** 버튼 입력도 모델을 다시 통과시켜 렌더링 수치와 요청 수량이 갈리지 않게 한다. */
  private changeQuantity(product: ProductDto, delta: number): void {
    if (this.pending || product.acquisition.kind !== "currency") return;
    this.quantity = quotePurchase({ unitPrice: product.acquisition.amount, remaining: product.remaining, balance: this.wallet[product.acquisition.currency] }, this.quantity + delta).quantity;
    this.repaint?.();
  }

  /** 서버 응답 전에는 지갑과 카탈로그를 건드리지 않고, 처리 중 모든 수량·구매 입력을 잠근다. */
  private async purchase(product: ProductDto, close: () => void, onPurchased: (result: PurchaseProductResponse) => void | Promise<void>): Promise<void> {
    if (this.pending || product.acquisition.kind !== "currency") return;
    const quote = quotePurchase({ unitPrice: product.acquisition.amount, remaining: product.remaining, balance: this.wallet[product.acquisition.currency] }, this.quantity);
    if (!product.purchasable || !quote.valid) return;
    this.pending = true; this.message = ""; this.repaint?.();
    try {
      const result = await this.api.purchaseProduct({ storefront: product.storefront, productId: product.id, quantity: quote.quantity });
      // 작업판을 먼저 없애 입력면이 겹치지 않게 한 뒤, 더 높은 공용 계층에 서버 영수증만 연다.
      close();
      openRewardPopup(this.scene, this.popups, {
        title: "구매 보상",
        items: productGrantsToRewardItems(result.granted, result.grantedRunes),
        onConfirm: () => { void onPurchased(result); },
      });
    } catch (error) {
      // 낙관적 차감이 없으므로 실패 시 되돌릴 로컬 상태도 없고 서버 이전 화면을 그대로 유지한다.
      this.message = error instanceof Error ? error.message : "구매에 실패했습니다.";
      this.pending = false; this.repaint?.();
    }
  }
}

/** 재화 교환 가격은 판별된 acquisition만 받아 다른 방식의 가짜 숫자를 만들지 않는다. */
function priceText(acquisition: Extract<ProductDto["acquisition"], { kind: "currency" }>, amount: number): string {
  return `${formatCurrency(amount)} ${currencyName(acquisition.currency)}`;
}

/** 데이터 키가 화면마다 서로 다른 번역으로 노출되지 않게 한 곳에서 이름을 정한다. */
function currencyName(currency: Extract<ProductDto["acquisition"], { kind: "currency" }>["currency"]): string {
  return ({ fossil: "화석", amber: "호박석", cheesecake: "치즈케이크", dnaFragments: "DNA 조각" } as const)[currency];
}
