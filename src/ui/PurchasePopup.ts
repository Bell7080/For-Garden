import Phaser from "phaser";
import { t } from "../i18n";
import type { GameApi, ProductDto, PurchaseProductResponse } from "../api/contracts";
import { formatCurrency } from "../core/formatCurrency";
import { quotePurchase, totalGrantAmount } from "../core/purchase";
import type { Wallet } from "../core/gacha";
import { Button } from "./Button";
import { chipPoints, drawHairline, drawLayer, HOLO } from "./holo";
import { addFramedIcon } from "./itemFrame";
import { addPriceTag, PRICE_TAG, priceTagRightCenter } from "./priceTag";
import { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { openRewardPopup, productGrantsToRewardItems } from "./RewardPopup";
import { setDebugStorefrontControls } from "../debug";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { isTradePackage, tradePackageLimitLabel, tradePackageValuePercent } from "../data/tradePackages";

/**
 * 패키지 확인판의 자리.
 *
 * 수량 작업판과 한 파일에 있는 이유는 **확정 경계가 같기 때문이다** — 쓰는 재화도, 서버 요청도,
 * 영수증도 하나다. 다른 것은 고를 것이 수량이 아니라 "살까 말까"뿐이라는 점이고, 그래서 ±와
 * 총가격 줄이 없다.
 */
const PACKAGE = { width: 820, height: 800, frame: 150, frameGap: 22, nameY: -300, valueY: -244, frameY: -130, hairlineY: -18, priceY: 42, limitY: 128, buyY: 280, statusY: 345 } as const;

/**
 * 수량 작업판의 줄 자리.
 *
 * 값 줄이 글자에서 **액자**로 바뀌면서 한 줄이 그만큼 두꺼워졌다 — 예전 80px 간격에 78px짜리
 * 액자를 얹으면 총가격 액자가 위아래 줄과 맞닿는다. 줄 간격과 판 높이를 함께 벌린다.
 */
const QUANTITY = { height: 880, priceY: -10, countY: 78, totalY: 170, remainingY: 252, buyY: 352, statusY: 412, rowRight: 325 } as const;

/** 신규 상점과 무역이 같은 수량·표시·요청 잠금을 쓰는 공용 구매 작업판이다. */
export class PurchasePopup {
  private quantity = 1;
  private pending = false;
  private message = "";
  private repaint?: () => void;
  /** 우하단 공용 슬롯의 돌아가기. 판과 함께 만들고 함께 없앤다. */

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
    // 확인 창은 아직 아무것도 쓰지 않은 자리라 **판 밖을 눌러도 닫힌다** — 사지 않기로 한
    // 손이 오른쪽 위 X를 찾아 올라가야 할 이유가 없다. 실제 차감은 확정 버튼만 한다.
    // 돌아가기는 모서리 X가 아니라 다른 작업판과 같은 **우하단 공용 슬롯**에 선다. 자리와
    // 층은 팝업 층(`backButton`)이 소유한다 — 창마다 IconButton을 손으로 세우면 아래 화면이
    // 이미 쓰고 있는 같은 자리와의 층 순서를 창마다 다시 정하게 된다.
    const pack = isTradePackage(product);
    this.popups.open({ width: PACKAGE.width, height: pack ? PACKAGE.height : QUANTITY.height, title: pack ? t("shop.purchase.package") : t("shop.purchase.confirm"), dim: true, closeOnBackdrop: true, backButton: true }, (body, close) => {
      const view = this.scene.add.container(0, 0); body.add(view);
      const render = (): void => { view.removeAll(true); if (pack) this.paintPackage(view, product, close, onPurchased); else this.paint(view, product, close, onPurchased); };
      this.repaint = render;
      view.once(Phaser.GameObjects.Events.DESTROY, () => { this.repaint = undefined; });
      render();
    });
  }

  /** 아이콘부터 지급량·가격·수량·총가격·제한·확정 순으로 한눈에 읽히게 배치한다. */
  private paint(view: Phaser.GameObjects.Container, product: ProductDto, close: () => void, onPurchased: (result: PurchaseProductResponse) => void | Promise<void>): void {
    // 이 수량 작업판은 재화 교환만 담당하며 다른 방식은 전용 확정 경계가 연다.
    if (product.acquisition.kind !== "currency") return;
    const acquisition = product.acquisition;
    const balance = this.wallet[acquisition.currency];
    const quote = quotePurchase({ unitPrice: acquisition.amount, remaining: product.remaining, balance }, this.quantity);
    this.quantity = quote.quantity;
    const grant = product.grants[0];
    const unitGrant = grant?.kind === "currency" ? grant.amount : 1;
    const grantLabel = grant?.kind === "currency" ? currencyName(grant.currency) : grant?.name ?? t("shop.purchase.grant");

    // 상품 그림만 사방 액자로 두고 나머지는 홀로그램 면과 구분선만 사용한다.
    view.add(drawLayer(this.scene, 0, -215, chipPoints(690, 230, { bevel: { topLeft: 38, topRight: 0, bottomRight: 28, bottomLeft: 0 } }), { fill: 0x141b24, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.45 }));
    // **살 것을 얼굴로 먼저 읽게 한다.** 액자를 키우고 그림이 그 안을 거의 채우게 하며, 같은
    // 그림을 검게 한 겹 뒤에 깔아 실루엣을 띄운다. 이번에 실제로 받는 수는 가방·보상 액자와
    // 같은 자리(우하단)에 겹쳐, 글로 적힌 줄을 읽기 전에 그림만 보고도 알 수 있게 한다.
    addFramedIcon(this.scene, view, -240, -215, 170, product.iconKey, {
      amount: `×${formatCurrency(totalGrantAmount(unitGrant, quote.quantity))}`,
    });
    view.add(this.scene.add.text(-125, -272, product.name, textStyle({ role: "display", size: 32 })).setOrigin(0, 0.5));
    // 이번에 받는 수는 왼쪽 액자의 우하단이 이미 말한다 — 같은 수를 한 창에 두 번 적지 않는다.
    view.add(this.scene.add.text(-125, -212, grantLabel, textStyle({ role: "emphasis", size: 27, color: COLOR.accentText })).setOrigin(0, 0.5));
    view.add(this.scene.add.text(-125, -157, t("shop.purchase.unitGrant", { amount: formatCurrency(unitGrant) }), textStyle({ role: "body", size: 21, color: COLOR.inkDim })).setOrigin(0, 0.5));

    view.add(drawHairline(this.scene, 0, -55, 690, { color: COLOR.accent, alpha: 0.32 }));
    // 값은 글이 아니라 **받는 것과 같은 액자**로 선다. 재화 이름을 적지 않는 이유는 그림이
    // 이미 어느 재화인지 말하기 때문이고, 모자란 값만 그 수가 붉어져 이유를 스스로 말한다.
    this.addPriceRow(view, QUANTITY.priceY, t("shop.purchase.price"), acquisition.currency, acquisition.amount);
    this.addValueRow(view, QUANTITY.countY, t("shop.purchase.count"), formatCurrency(quote.quantity));
    this.addPriceRow(view, QUANTITY.totalY, t("shop.purchase.total"), acquisition.currency, quote.totalPrice, {
      emphasized: true, short: balance < quote.totalPrice,
    });
    this.addValueRow(view, QUANTITY.remainingY, t("shop.purchase.remaining"), `${formatCurrency(product.remaining)} / ${formatCurrency(product.purchaseLimit)}`);

    // 수량 조작은 순수 모델이 계산한 실제 구매 가능 상한에서만 활성화한다.
    const minus = new Button(this.scene, 105, QUANTITY.countY, { width: 76, height: 58, label: "−", fontSize: 30, onClick: () => this.changeQuantity(product, -1) }).setEnabled(!this.pending && quote.quantity > 1);
    const plus = new Button(this.scene, 205, QUANTITY.countY, { width: 76, height: 58, label: "+", fontSize: 30, onClick: () => this.changeQuantity(product, 1) }).setEnabled(!this.pending && quote.quantity < quote.maxQuantity);
    // 팝업 본문 원점은 화면 중앙이므로 사용자 입력 중심만 절대 좌표로 변환해 공개한다.
    setDebugStorefrontControls({ purchase: { minus: { x: BASE_CENTER.x + 105, y: BASE_CENTER.y + QUANTITY.countY }, plus: { x: BASE_CENTER.x + 205, y: BASE_CENTER.y + QUANTITY.countY }, confirm: { x: BASE_CENTER.x, y: BASE_CENTER.y + QUANTITY.buyY } } });
    view.add([minus, plus]);
    const canPurchase = product.purchasable && quote.valid && !this.pending;
    const buy = new Button(this.scene, 0, QUANTITY.buyY, { width: 650, height: 86, label: this.pending ? t("shop.purchase.busy") : t("shop.purchase.buy"), fontSize: 31, variant: "primary", onClick: () => { void this.purchase(product, close, onPurchased); } }).setEnabled(canPurchase);
    view.add(buy);
    const status = this.message || (!product.purchasable ? product.disabledReason ?? t("shop.purchase.blocked") : !quote.valid ? t("shop.purchase.needMore") : "");
    if (status) view.add(this.scene.add.text(0, QUANTITY.statusY, status, textStyle({ role: "body", size: 21, color: COLOR.inkDim })).setOrigin(0.5));
  }

  /**
   * 패키지 한 장의 확인판.
   *
   * **고를 것이 수량이 아니다.** 무역의 묶음은 정해진 구성 하나를 한 번에 사는 것이라 ±와
   * 총가격 줄이 설 자리가 없다 — 그 줄을 남겨 두면 "몇 개를 살지"가 이 판의 질문처럼 보인다.
   * 남는 것은 받는 것(액자), 가치, 값, 제한, 그리고 확정 하나다.
   */
  private paintPackage(view: Phaser.GameObjects.Container, product: ProductDto, close: () => void, onPurchased: (result: PurchaseProductResponse) => void | Promise<void>): void {
    if (product.acquisition.kind !== "currency") return;
    const acquisition = product.acquisition;
    // 묶음 구성은 서버 카탈로그가 정한 그대로 한 번만 산다.
    this.quantity = 1;
    const grants = product.grants.flatMap((grant) => grant.kind === "currency" ? [grant] : []);
    const percent = tradePackageValuePercent(acquisition, product.grants);

    view.add(drawLayer(this.scene, 0, -170, chipPoints(690, 330, { bevel: { topLeft: 44, topRight: 0, bottomRight: 34, bottomLeft: 0 } }), { fill: 0x141b24, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.45 }));
    view.add(this.scene.add.text(0, PACKAGE.nameY, product.name, textStyle({ role: "display", size: 36 })).setOrigin(0.5));
    if (percent !== undefined) {
      view.add(this.scene.add.text(0, PACKAGE.valueY, t("shop.purchase.value", { percent }), textStyle({ role: "display", size: 27, color: COLOR.accentText })).setOrigin(0.5));
    }
    // 받는 것은 전부 같은 공용 액자다. 카드와 같은 그림·같은 수량 자리를 쓰므로 눌러서 열어도
    // 방금 보고 있던 것과 같은 묶음으로 읽힌다.
    const span = grants.length * PACKAGE.frame + Math.max(0, grants.length - 1) * PACKAGE.frameGap;
    grants.forEach((grant, index) => {
      addFramedIcon(this.scene, view, -span / 2 + PACKAGE.frame / 2 + index * (PACKAGE.frame + PACKAGE.frameGap), PACKAGE.frameY, PACKAGE.frame, CURRENCY_ICON_BY_WALLET[grant.currency], {
        amount: formatCurrency(grant.amount),
      });
    });

    view.add(drawHairline(this.scene, 0, PACKAGE.hairlineY, 690, { color: COLOR.accent, alpha: 0.32 }));
    this.addPriceRow(view, PACKAGE.priceY, t("shop.purchase.price"), acquisition.currency, acquisition.amount, {
      emphasized: true, short: this.wallet[acquisition.currency] < acquisition.amount,
    });
    this.addValueRow(view, PACKAGE.limitY, t("shop.purchase.limit"), tradePackageLimitLabel(product.refresh, product.purchaseLimit, product.remaining));

    const balance = this.wallet[acquisition.currency];
    const canPurchase = product.purchasable && product.remaining > 0 && balance >= acquisition.amount && !this.pending;
    const buy = new Button(this.scene, 0, PACKAGE.buyY, { width: 650, height: 86, label: this.pending ? t("shop.purchase.busy") : t("shop.purchase.buy"), fontSize: 31, variant: "primary", onClick: () => { void this.purchase(product, close, onPurchased); } }).setEnabled(canPurchase);
    view.add(buy);
    // 수량 조작이 없으므로 공개하는 입력 중심도 확정 하나뿐이다.
    setDebugStorefrontControls({ purchase: { confirm: { x: BASE_CENTER.x, y: BASE_CENTER.y + PACKAGE.buyY } } });
    const status = this.message || (!product.purchasable ? product.disabledReason ?? t("shop.purchase.blocked") : balance < acquisition.amount ? t("shop.purchase.needCurrency") : "");
    if (status) view.add(this.scene.add.text(0, PACKAGE.statusY, status, textStyle({ role: "body", size: 21, color: COLOR.inkDim })).setOrigin(0.5));
  }

  /** 이름과 값을 같은 기준선에 놓아 가격 비교 시 시선이 흔들리지 않게 한다. */
  private addValueRow(view: Phaser.GameObjects.Container, y: number, label: string, value: string, emphasized = false): void {
    view.add(this.scene.add.text(-325, y, label, textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5));
    view.add(this.scene.add.text(325, y, value, textStyle({ role: "emphasis", size: emphasized ? 31 : 26, color: emphasized ? COLOR.accentText : COLOR.ink })).setOrigin(1, 0.5));
  }

  /**
   * 값 한 줄 — 이름은 글로, 값은 **액자**로.
   *
   * 받는 것도 드는 것도 같은 공용 액자라 두 줄이 같은 것을 말한다는 게 한눈에 읽힌다.
   */
  private addPriceRow(
    view: Phaser.GameObjects.Container,
    y: number,
    label: string,
    currency: Extract<ProductDto["acquisition"], { kind: "currency" }>["currency"],
    amount: number,
    options: { emphasized?: boolean; short?: boolean } = {},
  ): void {
    view.add(this.scene.add.text(-325, y, label, textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5));
    const size = options.emphasized ? PRICE_TAG.emphasizedSize : PRICE_TAG.size;
    addPriceTag(this.scene, view, priceTagRightCenter(QUANTITY.rowRight, size), y, currency, amount, { size, short: options.short });
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
        title: t("shop.purchase.rewardTitle"),
        items: productGrantsToRewardItems(result.granted, result.grantedRunes),
        onConfirm: () => { void onPurchased(result); },
      });
    } catch (error) {
      // 낙관적 차감이 없으므로 실패 시 되돌릴 로컬 상태도 없고 서버 이전 화면을 그대로 유지한다.
      this.message = error instanceof Error ? error.message : t("shop.purchase.failed");
      this.pending = false; this.repaint?.();
    }
  }
}

/** PurchasePopup은 중앙 고정 작업판이므로 좌표 변환 기준도 한 상수로 둔다. */
const BASE_CENTER = { x: 540, y: 960 } as const;

/** 데이터 키가 화면마다 서로 다른 번역으로 노출되지 않게 한 곳에서 이름을 정한다. */
function currencyName(currency: Extract<ProductDto["acquisition"], { kind: "currency" }>["currency"]): string {
  // 재화 이름은 공용 표에서 읽는다 — 화면마다 다시 적으면 같은 재화가 두 이름으로 보인다.
  return t(({ fossil: "currency.fossil", amber: "currency.amber", cheesecake: "currency.cheesecake", dnaFragments: "currency.dnaFragments", gems: "currency.gems", gold: "currency.gold" } as const)[currency]);
}
