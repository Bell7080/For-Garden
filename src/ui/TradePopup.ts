import Phaser from "phaser";
import type { GameApi, ProductDto } from "../api/contracts";
import { session } from "../state/session";
import { setDebugTradePopup } from "../debug";
import { Button } from "./Button";
import { chipPoints, drawHairline, drawLayer, HOLO } from "./holo";
import { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { beginTradePurchase, closeTradePopup, finishTradePurchase, initialTradePopupState, loadTradeProducts, openTradePopup, type TradePopupState } from "./tradePopupModel";

/** 로비를 떠나지 않고 서버 카탈로그를 교환하는 전체 크기 무역 프리팹이다. */
export class TradePopup {
  private state: TradePopupState = initialTradePopupState();
  private body?: Phaser.GameObjects.Container;
  private content?: Phaser.GameObjects.Container;
  private closeAction?: () => void;
  private requestGeneration = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly api: GameApi, private readonly onClosed?: () => void) {}

  /** 중복 탭은 기존 입력 차단막을 유지하고 새 PopupLayer 항목을 만들지 않는다. */
  open(): void {
    const next = openTradePopup(this.state);
    if (next === this.state) return;
    this.state = next;
    this.body = this.popups.open({ width: 940, height: 1420, title: "무역", titleSize: 34, dim: true, closeOnBackdrop: false, hideCloseButton: true, onClose: () => this.dispose() }, (body, close) => {
      this.closeAction = close;
      body.setName("trade-popup");
      this.showMessage("상품 목록을 불러오고 있습니다…");
    });
    setDebugTradePopup({ state: "loading", productCount: 0 });
    void this.fetch();
  }

  /** 로비의 공용 BACK_SLOT 아이콘이 이 메서드 하나로 팝업을 닫는다. */
  close(): void { this.closeAction?.(); }

  /** 상품의 노출과 구매 가능 여부는 공용 API 응답만 사용한다. */
  private async fetch(): Promise<void> {
    const generation = ++this.requestGeneration;
    try {
      const response = await this.api.getProducts();
      if (!this.body || generation !== this.requestGeneration) return;
      this.state = loadTradeProducts(this.state, response.products);
      this.render();
    } catch {
      if (this.body && generation === this.requestGeneration) this.showMessage("상품 목록을 불러오지 못했습니다.", true);
    }
  }

  /** 서버 구매 응답의 지갑과 남은 횟수를 그대로 반영한 뒤 같은 카드를 다시 그린다. */
  private async purchase(product: ProductDto): Promise<void> {
    const next = beginTradePurchase(this.state, product.id);
    if (next === this.state || !product.purchasable) return;
    this.state = next; this.render();
    try {
      const result = await this.api.purchaseProduct(product.id);
      if (!this.body) return;
      // 서버 스냅샷을 복사할 뿐 가격 차감이나 지급량 계산은 팝업에서 수행하지 않는다.
      session.wallet = { ...result.wallet };
      this.state = finishTradePurchase(this.state, result);
      this.render("교환이 완료되었습니다.");
    } catch (error) {
      this.state = { ...this.state, pendingProductId: undefined };
      this.render(error instanceof Error ? error.message : "교환에 실패했습니다.");
    }
  }

  /** 기존 팝업의 플랫 유리 카드와 윗변 강조선을 같은 밀도로 반복한다. */
  private render(notice = ""): void {
    const content = this.resetContent();
    if (!content) return;
    content.add(this.scene.add.text(0, -610, `화석 ${session.wallet.fossil.toLocaleString()}  ·  치즈케이크 ${session.wallet.cheesecake.toLocaleString()}  ·  DNA ${session.wallet.dnaFragments.toLocaleString()}`, textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0.5));
    content.add(drawHairline(this.scene, 0, -570, 800, { color: COLOR.accent, alpha: 0.35 }));
    this.state.products.forEach((product, index) => this.addProduct(content, product, index));
    if (notice) content.add(this.scene.add.text(0, 570, notice, textStyle({ role: "body", size: 23, color: COLOR.accentText })).setOrigin(0.5));
    setDebugTradePopup({
      state: this.state.pendingProductId ? "purchasing" : "ready",
      productCount: this.state.products.length,
      remaining: Object.fromEntries(this.state.products.map((product) => [product.id, product.remaining])),
      // E2E에는 실제 카드 입력 중심만 제공하고 가격·보상은 공개하지 않는다.
      productButtons: this.state.products.map((product, index) => ({ id: product.id, x: this.scene.scale.width / 2 + 235, y: this.scene.scale.height / 2 - 348 + index * 310 })),
    });
  }

  /** 한 상품은 설명·가격·남은 횟수와 하나의 명확한 교환 행동만 갖는다. */
  private addProduct(parent: Phaser.GameObjects.Container, product: ProductDto, index: number): void {
    const y = -410 + index * 310;
    const card = this.scene.add.container(0, y);
    card.add(drawLayer(this.scene, 0, 0, chipPoints(800, 260, { bevel: { topLeft: 48, topRight: 0, bottomRight: 36, bottomLeft: 0 } }), { fill: 0x161d25, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.55 }));
    card.add(this.scene.add.text(-350, -78, product.name, textStyle({ role: "display", size: 30 })).setOrigin(0, 0));
    card.add(this.scene.add.text(-350, -22, product.description, textStyle({ role: "body", size: 21, color: COLOR.inkDim, wrap: 470 })).setOrigin(0, 0));
    const price = `${product.price.amount.toLocaleString()} ${this.currencyLabel(product.price.currency)}`;
    card.add(this.scene.add.text(340, -50, price, textStyle({ role: "emphasis", size: 25, color: COLOR.accentText })).setOrigin(1, 0.5));
    const busy = this.state.pendingProductId !== undefined;
    const button = new Button(this.scene, 235, 62, { width: 250, height: 76, label: busy && this.state.pendingProductId === product.id ? "처리 중…" : `교환 ${product.remaining}/${product.purchaseLimit}`, onClick: () => void this.purchase(product) });
    button.setEnabled(product.purchasable && !busy); card.add(button); parent.add(card);
  }

  /** 로딩과 오류도 동일한 팝업 안에 남겨 뒤 화면 입력이 새지 않게 한다. */
  private showMessage(message: string, retry = false): void {
    const content = this.resetContent(); if (!content) return;
    content.add(this.scene.add.text(0, 0, message, textStyle({ role: "body", size: 27, color: COLOR.inkDim })).setOrigin(0.5));
    if (retry) content.add(new Button(this.scene, 0, 90, { width: 260, height: 80, label: "다시 시도", onClick: () => void this.fetch() }));
    setDebugTradePopup({ state: retry ? "error" : "loading", productCount: 0 });
  }

  /** 다시 그릴 때 이전 카드 입력면까지 함께 파괴한다. */
  private resetContent(): Phaser.GameObjects.Container | undefined {
    this.content?.destroy(true); if (!this.body) return undefined;
    this.content = this.scene.add.container(0, 0); this.body.add(this.content); return this.content;
  }

  /** 상품 가격 키를 플레이어가 읽는 인게임 명칭으로만 바꾼다. */
  private currencyLabel(currency: ProductDto["price"]["currency"]): string {
    return ({ fossil: "화석", amber: "호박석", cheesecake: "치즈케이크", dnaFragments: "DNA", real_money: "현금" } as const)[currency];
  }

  /** 늦은 네트워크 응답을 무효화하고 외부 뒤로가기 아이콘 제거를 요청한다. */
  private dispose(): void {
    this.requestGeneration += 1; this.state = closeTradePopup(this.state);
    this.body = undefined; this.content = undefined; this.closeAction = undefined;
    setDebugTradePopup(undefined); this.onClosed?.();
  }
}
