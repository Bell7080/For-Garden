import Phaser from "phaser";
import { gameApi } from "../api/FakeServer";
import type { ProductDto, PurchaseProductResponse } from "../api/contracts";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { setDebugPremiumSection, setDebugScene } from "../debug";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { BottomNav, NAV_TOP } from "../ui/BottomNav";
import { chipPoints, drawLayer, drawVignette, HOLO } from "../ui/holo";
import { COLOR, textStyle } from "../ui/theme";
import { TopBar } from "../ui/TopBar";
import type { PremiumSection } from "./settingsNavigation";
import { PopupLayer } from "../ui/PopupLayer";
import { PurchasePopup } from "../ui/PurchasePopup";
import { session } from "../state/session";

/** 현금 결제 카탈로그를 인게임 재화 상점과 분리해 소유하는 독립 프리미엄 씬이다. */
export class PremiumScene extends Phaser.Scene {
  private content?: Phaser.GameObjects.Container;
  /** 서버 지갑 스냅샷을 적용한 뒤 현재 화면의 잔액 표시를 즉시 갱신한다. */
  private topBar?: TopBar;
  /** 무역과 동일한 구매 상세 프리팹을 화면 최상단에 여는 계층이다. */
  private readonly popups = new PopupLayer(this, 2600);
  /** 설정 왕복 시 복원할 섹션이며, 지원하지 않는 외부 값은 init에서 제거한다. */
  private activeSection: PremiumSection = "premium";

  constructor() { super("premium"); }

  init(data: { section?: PremiumSection }): void {
    // 설정 화면이나 개발 콘솔이 넘긴 값도 실제 지원하는 섹션으로 제한한다.
    this.activeSection = data?.section === "premium" ? data.section : "premium";
  }

  create(): void {
    setDebugScene("premium", "프리미엄");
    setDebugPremiumSection(this.activeSection);
    // 유료 상품은 기존 흰 쇼케이스를 유지해 무역소의 어두운 작업실과 시각적으로 구분한다.
    addSceneBackground(this, BACKGROUND.premiumShop);
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { depth: -20, strength: 0.72 });
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.5).setDepth(-19);
    this.topBar = new TopBar(this, 40, {
      onSettings: () => this.scene.start("settings", { returnScene: "premium", returnData: { section: this.activeSection } }),
    });
    this.add.text(60, 185, "프리미엄", textStyle({ role: "display", size: 52 })).setOrigin(0, 0);
    // 프리미엄은 핵심 하단 탭의 기존 진입점을 그대로 사용한다.
    new BottomNav(this, "premium");
    void this.refresh();
  }

  /** 서버가 계산한 노출·제한 상태에서 유료 storefront만 골라 다시 그린다. */
  private async refresh(): Promise<void> {
    const response = await gameApi.getProducts("premium");
    this.content?.destroy(true);
    this.content = this.add.container(0, 0);
    response.products.filter((product) => product.storefront === "premium").forEach((product, index) => this.addProduct(product, index));
  }

  /** 유료 카드도 공용 유리 면과 누를 때 확대되는 홀로그램 입력 규칙을 따른다. */
  private addProduct(product: ProductDto, index: number): void {
    const x = BASE_WIDTH / 2;
    const y = Math.min(420 + index * 360, NAV_TOP - 190);
    const width = 900;
    const height = 290;
    const card = this.add.container(x, y);
    card.add(drawLayer(this, 0, 0, chipPoints(width, height, { bevel: { topLeft: 55, topRight: 0, bottomRight: 38, bottomLeft: 0 } }), { fill: 0x161d25, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.62 }));
    card.add(this.add.text(-390, -92, product.name, textStyle({ role: "display", size: 36 })).setOrigin(0, 0));
    // 패스는 구매 전에 수령 방식과 서버의 UTC 제한을 같은 카드에서 확인시킨다.
    const benefitNotice = product.passBenefit
      ? `광고 보상 즉시 수령  ·  ${product.passBenefit.durationDays === null ? "영구" : `유효 기간 ${product.passBenefit.durationDays}일`}\n광고 이용자와 동일한 기본 보상 · 슬롯별 UTC 일일 한도`
      : product.description;
    card.add(this.add.text(-390, -35, benefitNotice, textStyle({ role: "body", size: 24, color: COLOR.inkDim, wrap: 590, lineSpacing: 8 })).setOrigin(0, 0));
    const price = product.price.display ?? `${product.price.amount.toLocaleString()} ${this.currencyLabel(product.price.currency)}`;
    card.add(this.add.text(360, -28, price, textStyle({ role: "emphasis", size: 30, color: COLOR.accentText })).setOrigin(1, 0.5));
    card.add(this.add.text(360, 52, product.price.currency === "real_money" ? "결제 비활성" : `남은 구매 ${product.remaining}/${product.purchaseLimit}`, textStyle({ role: "body", size: 22, color: product.purchasable ? COLOR.ink : COLOR.inkDim })).setOrigin(1, 0));
    const hit = this.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => card.setScale(1.06));
    hit.on("pointerout", () => card.setScale(1));
    hit.on("pointerup", () => {
      card.setScale(1);
      // 결제 비활성 상품도 상세 팝업 안에서 지급량·가격·사유를 확인한다.
      new PurchasePopup(this, this.popups, gameApi, session.wallet).open(product, async (result) => { this.applyPurchaseResult(result); this.notice("구매가 완료되었습니다."); await this.refresh(); });
    });
    card.add(hit);
    this.content?.add(card);
  }

  /** 보상 확인이 끝난 뒤에만 구매 응답의 확정 잔액을 공개하고 최신 목록을 다시 그린다. */
  private applyPurchaseResult(result: PurchaseProductResponse): void {
    session.wallet = { ...result.wallet };
    this.topBar?.refresh();
  }

  /** 결과 안내는 별도 DOM 없이 현재 Phaser 씬 수명에 묶는다. */
  private notice(message: string): void {
    const toast = this.add.text(BASE_WIDTH / 2, 1540, message, textStyle({ role: "emphasis", size: 28, color: COLOR.accentText })).setOrigin(0.5).setDepth(500);
    this.tweens.add({ targets: toast, alpha: 0, delay: 900, duration: 500, onComplete: () => toast.destroy() });
  }

  /** 내부 재화 키를 플레이어가 읽는 짧은 단위로 바꾼다. */
  private currencyLabel(currency: ProductDto["price"]["currency"]): string {
    return ({ fossil: "화석", amber: "호박석", cheesecake: "치즈케이크", dnaFragments: "DNA", real_money: "현금" } as const)[currency];
  }
}
