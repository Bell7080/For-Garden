import Phaser from "phaser";
import type { GameApi, ProductDto, PurchaseProductResponse } from "../api/contracts";
import type { Wallet } from "../core/gacha";
import { productActionModel } from "../core/productAcquisition";
import { Button } from "./Button";
import { PopupLayer } from "./PopupLayer";
import { PurchasePopup } from "./PurchasePopup";
import { COLOR, textStyle } from "./theme";
import { setDebugStorefrontControls } from "../debug";
import { BACK_SLOT } from "./IconButton";

/** 무역을 씬 전환 없이 로비 위 패키지 레이어로 여는 공개 프리팹이다. */
export class TradePopup {
  private closeAction?: () => void;
  private body?: Phaser.GameObjects.Container;
  /** 서버 응답마다 갈아 끼우는 상품 행만 소유해, 팝업 제목 같은 chrome의 수명과 분리한다. */
  private productList?: Phaser.GameObjects.Container;
  private products: ProductDto[] = [];
  private generation = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly api: GameApi, private readonly wallet: Wallet, private readonly onPurchased: (result: PurchaseProductResponse) => void, private readonly onClosed?: () => void) {}

  /** 연타는 기존 레이어를 유지하며 서버 trade 카탈로그만 조회한다. */
  open(): void {
    if (this.closeAction) return;
    this.popups.open({ width: 940, height: 1420, title: "무역", dim: true, closeOnBackdrop: false, hideCloseButton: true, onClose: () => this.dispose() }, (body, close) => {
      this.closeAction = close;
      this.body = body;
      // PopupLayer가 만든 판·제목은 그대로 두고, 비동기 상품만 안전하게 다시 그릴 자식층을 한 번 만든다.
      this.productList = this.scene.add.container(0, 0);
      body.add(this.productList);
    });
    void this.refresh();
  }

  /** 로비 공용 뒤로가기 버튼이 호출하는 단일 종료점이다. */
  close(): void { this.closeAction?.(); }

  /** 늦은 응답은 세대 번호로 폐기해 닫힌 레이어를 다시 만들지 않는다. */
  private async refresh(): Promise<void> {
    const generation = ++this.generation;
    const response = await this.api.getProducts("trade");
    // 닫힌 뒤 도착한 응답은 세대와 참조뿐 아니라 Phaser 파괴 상태도 확인해 죽은 자식층을 만지지 않는다.
    if (generation !== this.generation || !this.body?.active || !this.productList?.active) return;
    this.products = response.products.filter(({ storefront }) => storefront === "trade");
    this.render();
  }

  /** 패키지 레이어의 각 행은 획득 방식에서 파생한 라벨과 사유만 표시한다. */
  private render(): void {
    if (!this.productList?.active) return;
    // 동적 행만 비워 팝업 chrome(판·제목)의 수명은 PopupLayer가 끝까지 소유하게 한다.
    this.productList.removeAll(true);
    // 행 버튼과 로비 위 돌아가기만 노출해 E2E가 상품 데이터를 디버그 상태로 읽지 않게 한다.
    setDebugStorefrontControls({ trade: { products: this.products.map((_, index) => ({ x: 540 + 245, y: 960 - 520 + index * 250 + 20 })), back: { ...BACK_SLOT } } });
    this.products.forEach((product, index) => {
      const y = -520 + index * 250;
      const action = productActionModel(product.acquisition, { remaining: product.remaining, available: product.purchasable });
      this.productList?.add(this.scene.add.text(-360, y, product.name, textStyle({ role: "emphasis", size: 29 })).setOrigin(0, 0.5));
      this.productList?.add(this.scene.add.text(-360, y + 48, action.priceText, textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0, 0.5));
      const button = new Button(this.scene, 245, y + 20, { width: 270, height: 76, label: action.label, onClick: () => this.openPurchase(product) });
      button.setEnabled(!action.disabledReason); this.productList?.add(button);
      if (action.disabledReason) this.productList?.add(this.scene.add.text(370, y + 70, action.disabledReason, textStyle({ role: "body", size: 18, color: COLOR.inkDim })).setOrigin(1, 0.5));
    });
  }

  /** 현재 무역 데이터는 재화 교환이며 공용 구매 작업판에서 서버 확정까지 수행한다. */
  private openPurchase(product: ProductDto): void {
    if (product.acquisition.kind !== "currency") return;
    new PurchasePopup(this.scene, this.popups, this.api, this.wallet).open(product, async (result) => {
      // 생성자에서 받은 지갑 객체도 갱신해 같은 레이어의 다음 quote가 오래된 잔액을 쓰지 않는다.
      Object.assign(this.wallet, result.wallet); this.onPurchased(result); await this.refresh();
    });
  }

  /** 외부 입력면과 늦은 요청을 함께 무효화한다. */
  private dispose(): void { this.generation += 1; this.closeAction = undefined; this.body = undefined; this.productList = undefined; this.onClosed?.(); }
}
