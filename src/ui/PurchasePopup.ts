import { formatStorePrice } from "../core/storePrice";
import Phaser from "phaser";
import { t } from "../i18n";
import type { GameApi, ProductDto, PurchaseProductResponse } from "../api/contracts";
import { formatCurrency } from "../core/formatCurrency";
import { quotePurchase, totalGrantAmount } from "../core/purchase";
import type { Wallet } from "../core/gacha";
import { Button } from "./Button";
import { chipPoints, drawHairline, drawLayer, HOLO } from "./holo";
import { addFramedIcon } from "./itemFrame";
import { addPriceBar } from "./priceTag";
import { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { openRewardPopup, productGrantsToRewardItems } from "./RewardPopup";
import { setDebugStorefrontControls } from "../debug";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { isTradePackage, tradePackageLimitLabel, tradePackageValuePercent } from "../data/tradePackages";
import { runPlatformPurchase } from "../api/platformPurchase";
import type { PlatformPaymentAdapter } from "../api/PlatformPayment";
import { platformPayment } from "../platform/payment";
import { RUNE_MAIN_STAT_KEYS, runePartLabel, type RuneMainStatKey, type RunePart } from "../core/runes";
import { runeShopChoice, toggleMainKey } from "../core/runeShopChoice";
import { premiumDecorationNames, premiumFirstBonusGems, premiumGrantTiles } from "./premiumModel";

/**
 * 패키지 확인판의 자리.
 *
 * 수량 작업판과 한 파일에 있는 이유는 **확정 경계가 같기 때문이다** — 쓰는 재화도, 서버 요청도,
 * 영수증도 하나다. 다른 것은 고를 것이 수량이 아니라 "살까 말까"뿐이라는 점이고, 그래서 ±와
 * 총가격 줄이 없다.
 */
const PACKAGE = { width: 820, height: 820, frame: 150, frameGap: 22, nameY: -310, valueY: -254, frameY: -140, hairlineY: -28, barWidth: 690, priceY: 58, limitY: 150, buyY: 290, statusY: 356 } as const;

/**
 * 결제(플랫폼 결제) 확인판의 자리.
 *
 * 받는 것(액자 최대 넷)·값·제한·결제 버튼뿐이다. 값은 카탈로그의 값 문자열을 **크고 두껍게** 세운다.
 */
const PLATFORM = { width: 820, height: 860, nameY: -330, frame: 150, frameGap: 20, frameY: -190, bonusY: -86, hairlineY: -40, priceY: 50, priceHeight: 112, priceSize: 62, limitY: 154, noteY: 214, buyY: 310, statusY: 380, amountRatio: 0.34 } as const;

/**
 * 수량 작업판의 줄 자리.
 *
 * 값 줄이 글자에서 **액자**로 바뀌면서 한 줄이 그만큼 두꺼워졌다 — 예전 80px 간격에 78px짜리
 * 액자를 얹으면 총가격 액자가 위아래 줄과 맞닿는다. 줄 간격과 판 높이를 함께 벌린다.
 */
const QUANTITY = {
  height: 920,
  /** 상품 얼굴이 서는 판. */
  panelY: -270, panelWidth: 690, panelHeight: 230,
  hairlineY: -110,
  /** 값 줄 넷이 같은 간격으로 쌓인다. 줄마다 판 한 장을 깔아 액자가 줄 **안**에 선 것으로 읽힌다. */
  rowTop: -50, rowStep: 92, rowHeight: 84, rowWidth: 690, rowLeft: -305, rowRight: 305,
  buyY: 360, statusY: 420,
} as const;

/**
 * 룬 확인판의 자리. 위에서부터 얼굴 판 → 자리 칩 → (지정 룬이면) 주 옵션 칩 → 값 → 제한 → 확정이다.
 * 랜덤 룬은 주 옵션 줄이 없어 그 아래가 한 줄만큼 위로 올라온다(`mainBlock`).
 */
const RUNE = {
  width: 820, panelY: -350, panelWidth: 690, panelHeight: 200,
  partLabelY: -210, partY: -150, partChipWidth: 214, partChipGap: 24, chipHeight: 70,
  mainLabelY: -70, mainY: -10, mainChipWidth: 128, mainChipGap: 10,
  /** 주 옵션 줄이 서는 만큼 아래가 밀린다. */
  mainBlock: 150,
  priceY: 100, remainingY: 192, buyY: 316, statusY: 376, baseHeight: 820,
} as const;

/** 값 줄 넷의 자리. `0`이 가격, `1`이 개수, `2`가 총가격, `3`이 남은 제한이다. */
function quantityRowY(index: number): number {
  return QUANTITY.rowTop + index * QUANTITY.rowStep;
}

/** 신규 상점과 무역이 같은 수량·표시·요청 잠금을 쓰는 공용 구매 작업판이다. */
export class PurchasePopup {
  private quantity = 1;
  /** 룬 상품에서 고른 자리·주 옵션. 판을 열 때마다 비운다. */
  private runePart: RunePart | null = null;
  private runeMains: RuneMainStatKey[] = [];
  private pending = false;
  private message = "";
  private repaint?: () => void;
  /** 우하단 공용 슬롯의 돌아가기. 판과 함께 만들고 함께 없앤다. */

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly popups: PopupLayer,
    private readonly api: GameApi,
    private readonly wallet: Wallet,
    /** 결제 SDK 어댑터. 비우면 빌드가 가진 어댑터(`platformPayment()`)를 결제 순간에 읽는다. */
    private readonly payment?: PlatformPaymentAdapter,
  ) {}

  /** 카드는 구매를 실행하지 않고 이 진입점으로 상품 원본을 전달한다. */
  open(product: ProductDto, onPurchased: (result: PurchaseProductResponse) => void | Promise<void>): void {
    // 카탈로그가 제안한 기본 수량도 잔액·제한 quote를 거쳐 실제 가능한 범위로 정규화된다.
    this.quantity = product.defaultQuantity; this.pending = false; this.message = "";
    this.runePart = null; this.runeMains = [];
    const runeKind = runeChoiceKind(product);
    // 확인 창은 아직 아무것도 쓰지 않은 자리라 **판 밖을 눌러도 닫힌다** — 사지 않기로 한
    // 손이 오른쪽 위 X를 찾아 올라가야 할 이유가 없다. 실제 차감은 확정 버튼만 한다.
    // 돌아가기는 모서리 X가 아니라 다른 작업판과 같은 **우하단 공용 슬롯**에 선다. 자리와
    // 층은 팝업 층(`backButton`)이 소유한다 — 창마다 IconButton을 손으로 세우면 아래 화면이
    // 이미 쓰고 있는 같은 자리와의 층 순서를 창마다 다시 정하게 된다.
    const pack = isTradePackage(product);
    const platform = product.acquisition.kind === "platform_payment";
    this.popups.open({ width: PACKAGE.width, height: platform ? PLATFORM.height : pack ? PACKAGE.height : runeKind ? RUNE.baseHeight + (runeKind === "partMain" ? RUNE.mainBlock : 0) : QUANTITY.height, title: pack || platform ? t("shop.purchase.package") : t("shop.purchase.confirm"), dim: true, closeOnBackdrop: true, backButton: true }, (body, close) => {
      const view = this.scene.add.container(0, 0); body.add(view);
      const render = (): void => { view.removeAll(true); if (platform) this.paintPlatform(view, product, close, onPurchased); else if (pack) this.paintPackage(view, product, close, onPurchased); else if (runeKind) this.paintRune(view, product, runeKind, close, onPurchased); else this.paint(view, product, close, onPurchased); };
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
    view.add(drawLayer(this.scene, 0, QUANTITY.panelY, chipPoints(QUANTITY.panelWidth, QUANTITY.panelHeight, { bevel: { topLeft: 38, topRight: 0, bottomRight: 28, bottomLeft: 0 } }), { fill: 0x141b24, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.45 }));
    // **살 것을 얼굴로 먼저 읽게 한다.** 액자를 키우고 그림이 그 안을 거의 채우게 하며, 같은
    // 그림을 검게 한 겹 뒤에 깔아 실루엣을 띄운다. 이번에 실제로 받는 수는 가방·보상 액자와
    // 같은 자리(우하단)에 겹쳐, 글로 적힌 줄을 읽기 전에 그림만 보고도 알 수 있게 한다.
    addFramedIcon(this.scene, view, -240, QUANTITY.panelY, 170, product.iconKey, {
      amount: `×${formatCurrency(totalGrantAmount(unitGrant, quote.quantity))}`,
    });
    view.add(this.scene.add.text(-125, QUANTITY.panelY - 57, product.name, textStyle({ role: "display", size: 32 })).setOrigin(0, 0.5));
    // 이번에 받는 수는 왼쪽 액자의 우하단이 이미 말한다 — 같은 수를 한 창에 두 번 적지 않는다.
    view.add(this.scene.add.text(-125, QUANTITY.panelY + 3, grantLabel, textStyle({ role: "emphasis", size: 27, color: COLOR.accentText })).setOrigin(0, 0.5));
    view.add(this.scene.add.text(-125, QUANTITY.panelY + 58, t("shop.purchase.unitGrant", { amount: formatCurrency(unitGrant) }), textStyle({ role: "body", size: 21, color: COLOR.inkDim })).setOrigin(0, 0.5));

    view.add(drawHairline(this.scene, 0, QUANTITY.hairlineY, QUANTITY.rowWidth, { color: COLOR.accent, alpha: 0.32 }));
    // 값은 글이 아니라 **받는 것과 같은 액자**로 선다. 재화 이름을 적지 않는 이유는 그림이
    // 이미 어느 재화인지 말하기 때문이고, 모자란 값만 그 수가 붉어져 이유를 스스로 말한다.
    // **값 줄만 판을 깐다.** 무역 묶음 확인판과 같은 양식이다 — 이름표와 (재화 그림 + 수)가
    // 판 한 장의 두 끝에서 마주 본다. 개수·남은 제한은 재화가 아니라 그냥 수라, 같은 판을 깔면
    // 네 줄이 모두 값처럼 읽혀 정작 얼마를 치르는지가 묻힌다.
    this.addPriceRow(view, quantityRowY(0), t("shop.purchase.price"), acquisition.currency, acquisition.amount);
    this.addValueRow(view, quantityRowY(1), t("shop.purchase.count"), formatCurrency(quote.quantity));
    this.addPriceRow(view, quantityRowY(2), t("shop.purchase.total"), acquisition.currency, quote.totalPrice, {
      short: balance < quote.totalPrice,
    });
    this.addValueRow(view, quantityRowY(3), t("shop.purchase.remaining"), `${formatCurrency(product.remaining)} / ${formatCurrency(product.purchaseLimit)}`);

    // 수량 조작은 순수 모델이 계산한 실제 구매 가능 상한에서만 활성화한다.
    const minus = new Button(this.scene, 105, quantityRowY(1), { width: 76, height: 58, label: "−", fontSize: 30, onClick: () => this.changeQuantity(product, -1) }).setEnabled(!this.pending && quote.quantity > 1);
    const plus = new Button(this.scene, 205, quantityRowY(1), { width: 76, height: 58, label: "+", fontSize: 30, onClick: () => this.changeQuantity(product, 1) }).setEnabled(!this.pending && quote.quantity < quote.maxQuantity);
    // 팝업 본문 원점은 화면 중앙이므로 사용자 입력 중심만 절대 좌표로 변환해 공개한다.
    setDebugStorefrontControls({ purchase: { minus: { x: BASE_CENTER.x + 105, y: BASE_CENTER.y + quantityRowY(1) }, plus: { x: BASE_CENTER.x + 205, y: BASE_CENTER.y + quantityRowY(1) }, confirm: { x: BASE_CENTER.x, y: BASE_CENTER.y + QUANTITY.buyY } } });
    view.add([minus, plus]);
    const canPurchase = product.purchasable && quote.valid && !this.pending;
    const buy = new Button(this.scene, 0, QUANTITY.buyY, { width: 650, height: 86, label: this.pending ? t("shop.purchase.busy") : t("shop.purchase.buy"), fontSize: 31, variant: "primary", onClick: () => { void this.purchase(product, close, onPurchased); } }).setEnabled(canPurchase);
    view.add(buy);
    const status = this.message || (!product.purchasable ? product.disabledReason ?? t("shop.purchase.blocked") : !quote.valid ? t("shop.purchase.needMore") : "");
    if (status) view.add(this.scene.add.text(0, QUANTITY.statusY, status, textStyle({ role: "body", size: 21, color: COLOR.inkDim })).setOrigin(0.5));
  }

  /**
   * 룬 한 장의 확인판 — 자리(와 지정 룬이면 주 옵션 둘)를 **먼저 고르고** 산다.
   *
   * 룬은 자리마다 하나뿐이라 3번 자리가 필요한 사람에게 1번 자리 룬은 쓸모가 없다. 고르는 값은 서버가
   * 다시 검증하므로 여기서는 고르지 않으면 구매가 꺼지는 것까지만 맡는다. 수량은 늘 1이다.
   */
  private paintRune(view: Phaser.GameObjects.Container, product: ProductDto, kind: "part" | "partMain", close: () => void, onPurchased: (result: PurchaseProductResponse) => void | Promise<void>): void {
    if (product.acquisition.kind !== "currency") return;
    const acquisition = product.acquisition;
    this.quantity = 1;
    const shift = kind === "partMain" ? RUNE.mainBlock : 0;
    view.add(drawLayer(this.scene, 0, RUNE.panelY, chipPoints(RUNE.panelWidth, RUNE.panelHeight, { bevel: { topLeft: 38, topRight: 0, bottomRight: 28, bottomLeft: 0 } }), { fill: 0x141b24, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.45 }));
    addFramedIcon(this.scene, view, -240, RUNE.panelY, 150, product.iconKey, { amount: "×1" });
    view.add(this.scene.add.text(-135, RUNE.panelY - 30, product.name, textStyle({ role: "display", size: 34 })).setOrigin(0, 0.5));
    view.add(this.scene.add.text(-135, RUNE.panelY + 28, product.description, textStyle({ role: "body", size: 22, color: COLOR.inkDim, wrap: 400 })).setOrigin(0, 0.5));

    view.add(this.scene.add.text(RUNE.panelWidth / -2, RUNE.partLabelY, t("shop.rune.part"), textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0, 0.5));
    const partSpan = 3 * RUNE.partChipWidth + 2 * RUNE.partChipGap;
    ([0, 1, 2] as const).forEach((part, index) => {
      const chip = new Button(this.scene, -partSpan / 2 + RUNE.partChipWidth / 2 + index * (RUNE.partChipWidth + RUNE.partChipGap), RUNE.partY, {
        width: RUNE.partChipWidth, height: RUNE.chipHeight, label: runePartLabel(part), fontSize: 26,
        variant: this.runePart === part ? "primary" : "default",
        onClick: () => { if (this.pending) return; this.runePart = part; this.repaint?.(); },
      }).setEnabled(!this.pending);
      view.add(chip);
    });
    if (kind === "partMain") {
      view.add(this.scene.add.text(RUNE.panelWidth / -2, RUNE.mainLabelY, t("shop.rune.main"), textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0, 0.5));
      const mainSpan = 5 * RUNE.mainChipWidth + 4 * RUNE.mainChipGap;
      RUNE_MAIN_STAT_KEYS.forEach((key, index) => {
        const chip = new Button(this.scene, -mainSpan / 2 + RUNE.mainChipWidth / 2 + index * (RUNE.mainChipWidth + RUNE.mainChipGap), RUNE.mainY, {
          width: RUNE.mainChipWidth, height: RUNE.chipHeight, label: t(`stat.${key}`), fontSize: 22,
          variant: this.runeMains.includes(key) ? "primary" : "default",
          onClick: () => { if (this.pending) return; this.runeMains = toggleMainKey(this.runeMains, key); this.repaint?.(); },
        }).setEnabled(!this.pending);
        view.add(chip);
      });
    }
    const balance = this.wallet[acquisition.currency];
    view.add(drawHairline(this.scene, 0, RUNE.priceY + shift - 62, QUANTITY.rowWidth, { color: COLOR.accent, alpha: 0.32 }));
    this.addPriceRow(view, RUNE.priceY + shift, t("shop.purchase.price"), acquisition.currency, acquisition.amount, { short: balance < acquisition.amount });
    this.addValueRow(view, RUNE.remainingY + shift, t("shop.purchase.remaining"), `${formatCurrency(product.remaining)} / ${formatCurrency(product.purchaseLimit)}`);
    const choice = runeShopChoice(kind, this.runePart, this.runeMains);
    const canPurchase = product.purchasable && balance >= acquisition.amount && choice !== null && !this.pending;
    view.add(new Button(this.scene, 0, RUNE.buyY + shift, { width: 650, height: 86, label: this.pending ? t("shop.purchase.busy") : t("shop.purchase.buy"), fontSize: 31, variant: "primary", onClick: () => { void this.purchase(product, close, onPurchased); } }).setEnabled(canPurchase));
    const status = this.message || (!product.purchasable ? product.disabledReason ?? t("shop.purchase.blocked") : choice === null ? t(kind === "partMain" ? "shop.rune.pickMain" : "shop.rune.pickPart") : balance < acquisition.amount ? t("shop.purchase.needMore") : "");
    if (status) view.add(this.scene.add.text(0, RUNE.statusY + shift, status, textStyle({ role: "body", size: 21, color: COLOR.inkDim })).setOrigin(0.5));
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

    view.add(drawLayer(this.scene, 0, -180, chipPoints(690, 330, { bevel: { topLeft: 44, topRight: 0, bottomRight: 34, bottomLeft: 0 } }), { fill: 0x141b24, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.45 }));
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
    // **묶음의 값은 액자가 아니라 가로로 긴 줄이다.** 받는 것이 이미 큰 액자 여럿으로 서 있어,
    // 값까지 작은 네모로 두면 판 오른쪽에 외따로 뜬 조각으로 읽힌다.
    addPriceBar(this.scene, view, 0, PACKAGE.priceY, PACKAGE.barWidth, t("shop.purchase.price"), acquisition.currency, acquisition.amount, {
      short: this.wallet[acquisition.currency] < acquisition.amount,
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

  /**
   * 플랫폼 결제 상품의 확인판.
   *
   * 고를 것이 없다 — 받는 것(액자 + 큰 수량), 값, 제한, 결제 하나뿐이다. 첫 구매 보너스가 남은 다이아 팩은
   * 그 몫을 액자 아래 한 줄이 말한다. 결제 SDK가 없는 빌드는 버튼을 눌러도 결제를 시작하지 않고 그 사실만
   * 알린다(`unsupported`) — 성공을 흉내 내지 않는다.
   */
  private paintPlatform(view: Phaser.GameObjects.Container, product: ProductDto, close: () => void, onPurchased: (result: PurchaseProductResponse) => void | Promise<void>): void {
    if (product.acquisition.kind !== "platform_payment") return;
    this.quantity = 1;
    const tiles = premiumGrantTiles(product).slice(0, 4);
    view.add(drawLayer(this.scene, 0, -150, chipPoints(690, 330, { bevel: { topLeft: 44, topRight: 0, bottomRight: 34, bottomLeft: 0 } }), { fill: 0x141b24, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.45 }));
    view.add(this.scene.add.text(0, PLATFORM.nameY, product.name, textStyle({ role: "display", size: 38 })).setOrigin(0.5).setStroke("#000000", 6));
    const span = tiles.length * PLATFORM.frame + Math.max(0, tiles.length - 1) * PLATFORM.frameGap;
    tiles.forEach((tile, index) => {
      addFramedIcon(this.scene, view, -span / 2 + PLATFORM.frame / 2 + index * (PLATFORM.frame + PLATFORM.frameGap), PLATFORM.frameY, PLATFORM.frame, tile.icon, {
        amount: formatCurrency(tile.amount), amountRatio: PLATFORM.amountRatio, plain: true,
      });
    });
    const bonus = premiumFirstBonusGems(product);
    const extras = [...(bonus > 0 ? [t("shop.premium.firstBonus", { amount: formatCurrency(bonus) })] : []), ...premiumDecorationNames(product)];
    if (extras.length) view.add(this.scene.add.text(0, PLATFORM.bonusY, extras.join("  ·  "), textStyle({ role: "display", size: 28, color: COLOR.accentText, align: "center", wrap: 640 })).setOrigin(0.5).setStroke("#000000", 5));
    view.add(drawHairline(this.scene, 0, PLATFORM.hairlineY, 690, { color: COLOR.accent, alpha: 0.32 }));
    // 값은 카탈로그가 준 문자열 그대로 — 스토어 현지 가격이 들어오면 이 자리 하나만 바뀐다.
    view.add(drawLayer(this.scene, 0, PLATFORM.priceY, chipPoints(690, PLATFORM.priceHeight, { bevel: { topLeft: 26, topRight: 0, bottomRight: 26, bottomLeft: 0 } }), { fill: 0x0d141c, alpha: 0.96, edge: COLOR.accent, edgeAlpha: 0.7 }));
    view.add(this.scene.add.text(0, PLATFORM.priceY, formatStorePrice(product.acquisition.basePriceKrw), textStyle({ role: "display", size: PLATFORM.priceSize, color: COLOR.accentText })).setOrigin(0.5).setStroke("#000000", 8).setShadow(2, 4, "#04060a", 0, true, true));
    this.addValueRow(view, PLATFORM.limitY, t("shop.purchase.limit"), tradePackageLimitLabel(product.refresh, product.purchaseLimit, product.remaining));

    const canPurchase = product.purchasable && product.remaining > 0 && !this.pending;
    const buy = new Button(this.scene, 0, PLATFORM.buyY, { width: 650, height: 92, label: this.pending ? t("shop.purchase.busy") : t("product.action.platform_payment"), fontSize: 36, variant: "primary", onClick: () => { void this.purchase(product, close, onPurchased); } }).setEnabled(canPurchase);
    view.add(buy);
    setDebugStorefrontControls({ purchase: { confirm: { x: BASE_CENTER.x, y: BASE_CENTER.y + PLATFORM.buyY } } });
    const status = this.message || (!product.purchasable ? product.disabledReason ?? t("shop.purchase.blocked") : "");
    if (status) view.add(this.scene.add.text(0, PLATFORM.statusY, status, textStyle({ role: "body", size: 22, color: COLOR.inkDim, align: "center", wrap: 680 })).setOrigin(0.5));
  }

  /** 재화가 아닌 값 한 줄 — **판을 깔지 않고 글자만** 이름표와 마주 세운다. */
  private addValueRow(view: Phaser.GameObjects.Container, y: number, label: string, value: string): void {
    view.add(this.scene.add.text(QUANTITY.rowLeft, y, label, textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5));
    view.add(this.scene.add.text(QUANTITY.rowRight, y, value, textStyle({ role: "emphasis", size: 26, color: COLOR.ink })).setOrigin(1, 0.5));
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
    options: { short?: boolean } = {},
  ): void {
    addPriceBar(this.scene, view, 0, y, QUANTITY.rowWidth, label, currency, amount, { short: options.short });
  }

  /** 버튼 입력도 모델을 다시 통과시켜 렌더링 수치와 요청 수량이 갈리지 않게 한다. */
  private changeQuantity(product: ProductDto, delta: number): void {
    if (this.pending || product.acquisition.kind !== "currency") return;
    this.quantity = quotePurchase({ unitPrice: product.acquisition.amount, remaining: product.remaining, balance: this.wallet[product.acquisition.currency] }, this.quantity + delta).quantity;
    this.repaint?.();
  }

  /** 결제창 → 영수증 검증 → 지급 확정. 어느 단계에서 멈췄는지는 결과 하나가 말하고, 지급은 서버만 한다. */
  private async purchasePlatform(product: ProductDto, close: () => void, onPurchased: (result: PurchaseProductResponse) => void | Promise<void>): Promise<void> {
    if (!product.purchasable) return;
    this.pending = true; this.message = ""; this.repaint?.();
    const outcome = await runPlatformPurchase(this.api, this.payment ?? platformPayment(), product);
    if (outcome.status === "purchased") {
      close();
      openRewardPopup(this.scene, this.popups, {
        title: t("shop.purchase.rewardTitle"),
        items: productGrantsToRewardItems(outcome.result.granted, outcome.result.grantedRunes),
        onConfirm: () => { void onPurchased(outcome.result); },
      });
      return;
    }
    this.message = outcome.status === "cancelled" ? t("shop.premium.cancelled")
      : outcome.status === "unsupported" ? t("shop.premium.unsupported")
      : outcome.message || t("shop.purchase.failed");
    this.pending = false; this.repaint?.();
  }

  /** 서버 응답 전에는 지갑과 카탈로그를 건드리지 않고, 처리 중 모든 수량·구매 입력을 잠근다. */
  private async purchase(product: ProductDto, close: () => void, onPurchased: (result: PurchaseProductResponse) => void | Promise<void>): Promise<void> {
    if (this.pending) return;
    if (product.acquisition.kind === "platform_payment") { await this.purchasePlatform(product, close, onPurchased); return; }
    if (product.acquisition.kind !== "currency") return;
    const quote = quotePurchase({ unitPrice: product.acquisition.amount, remaining: product.remaining, balance: this.wallet[product.acquisition.currency] }, this.quantity);
    if (!product.purchasable || !quote.valid) return;
    // 룬 상품은 고르기 전에는 사지 못한다 — 서버도 같은 이유로 거절하지만 요청을 보내기 전에 막는다.
    const runeKind = runeChoiceKind(product);
    const runeChoice = runeKind ? runeShopChoice(runeKind, this.runePart, this.runeMains) : undefined;
    if (runeKind && !runeChoice) return;
    this.pending = true; this.message = ""; this.repaint?.();
    try {
      const result = await this.api.purchaseProduct({ storefront: product.storefront, productId: product.id, quantity: quote.quantity, ...(runeChoice ? { runeChoice } : {}) });
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

/** 이 상품이 사는 쪽에게 룬의 자리(와 주 옵션)를 고르게 하는가. 아니면 `undefined`. */
function runeChoiceKind(product: ProductDto): "part" | "partMain" | undefined {
  for (const grant of product.grants) if (grant.kind === "rune" && grant.part === undefined) return grant.choose;
  return undefined;
}

/** PurchasePopup은 중앙 고정 작업판이므로 좌표 변환 기준도 한 상수로 둔다. */
const BASE_CENTER = { x: 540, y: 960 } as const;

/** 데이터 키가 화면마다 서로 다른 번역으로 노출되지 않게 한 곳에서 이름을 정한다. */
function currencyName(currency: Extract<ProductDto["acquisition"], { kind: "currency" }>["currency"]): string {
  // 재화 이름은 공용 표에서 읽는다 — 화면마다 다시 적으면 같은 재화가 두 이름으로 보인다.
  return t(({ fossil: "currency.fossil", amber: "currency.amber", cheesecake: "currency.cheesecake", dnaFragments: "currency.dnaFragments", gems: "currency.gems", gold: "currency.gold", rawStone: "currency.rawStone", raidSigil: "currency.raidSigil", salvageRecord: "currency.salvageRecord" } as const)[currency]);
}
