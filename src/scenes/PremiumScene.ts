import Phaser from "phaser";
import { t } from "../i18n";
import { gameApi } from "../api/FakeServer";
import type { ProductDto, PurchaseProductResponse } from "../api/contracts";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { setDebugPremiumSection, setDebugScene } from "../debug";
import { PREMIUM_TABS, type PremiumCategory } from "../data/shopCatalog";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { BottomNav } from "../ui/BottomNav";
import { addCategoryTab } from "../ui/CategoryTab";
import { addSectionTitle } from "../ui/SectionTitle";
import { addItemFrame, ITEM_FRAME } from "../ui/itemFrame";
import { chipPoints, drawLayer, drawVignette, HOLO } from "../ui/holo";
import { COLOR, textStyle } from "../ui/theme";
import { TopBar } from "../ui/TopBar";
import type { PremiumSection } from "./settingsNavigation";
import { PopupLayer } from "../ui/PopupLayer";
import { bindCurrencyGuide, openCurrencyGuide } from "../ui/currencyGuideEntry";
import { PurchasePopup } from "../ui/PurchasePopup";
import { session } from "../state/session";
import { productActionModel } from "../core/productAcquisition";
import { addPriceBar } from "../ui/priceTag";
import { squeezeTextToWidth } from "../ui/textFit";
import { premiumCategoryOf, premiumModel, productsForPremiumCategory } from "../ui/premiumModel";
import {
  PREMIUM_CARD, PREMIUM_TAB_ROW, PREMIUM_TITLE,
  premiumCardSpot, premiumCardWidth, premiumGridContentHeight, premiumGridViewport,
  premiumTabSpot, premiumTitleLeft, premiumTitleY,
} from "../ui/premiumLayout";
import { consumeSceneEntry } from "./sceneEntry";
import { playSceneEntrance, startScene } from "../ui/screenTransition";
import { pressIn, pressOut } from "../ui/pressFeedback";

/**
 * 현금 결제 카탈로그를 인게임 재화 상점과 분리해 소유하는 독립 프리미엄 씬이다.
 *
 * **목록을 갈아 끼우는 방식은 상점·가방과 같다** — 아래의 서류철 라벨 넷이 패키지·특가·한정·젬을
 * 가른다. 예전에는 일반 상점의 분류(일반·강화·룬)를 그대로 써서 후원 패스가 「룬」 탭에 서
 * 있었다: 재화로 사는 보급품을 가르는 기준이라 현금 상품에는 아무 뜻이 없었다.
 * 자리는 전부 `src/ui/premiumLayout.ts`가 갖고 이 씬은 좌표를 손으로 적지 않는다.
 */
export class PremiumScene extends Phaser.Scene {
  /** 흐르는 격자. 스크롤은 이 컨테이너의 y 하나가 갖는다. */
  private content?: Phaser.GameObjects.Container;
  private tabRow?: Phaser.GameObjects.Container;
  private viewportMask?: Phaser.GameObjects.Graphics;
  /** 서버 지갑 스냅샷을 적용한 뒤 현재 화면의 잔액 표시를 즉시 갱신한다. */
  private topBar?: TopBar;
  /** 무역과 동일한 구매 상세 프리팹을 화면 최상단에 여는 계층이다. */
  private readonly popups = new PopupLayer(this, 2600);
  /** 설정 왕복 시 복원할 섹션이며, 지원하지 않는 외부 값은 init에서 제거한다. */
  private activeSection: PremiumSection = "premium";
  /** 첫 라벨은 카탈로그 순서에서 정해 화면과 데이터의 기본값이 갈리지 않게 한다. */
  private selectedCategory: PremiumCategory = PREMIUM_TABS[0].id;
  private products: ProductDto[] = [];
  private minScrollY = 0;
  private pointerDown = false;
  private pointerY = 0;
  private draggedDistance = 0;
  private velocityY = 0;

  constructor() { super("premium"); }

  init(data: { section?: PremiumSection }): void {
    // 설정 화면이나 개발 콘솔이 넘긴 값도 실제 지원하는 섹션으로 제한한다.
    this.activeSection = data?.section === "premium" ? data.section : "premium";
    consumeSceneEntry(this);
  }

  create(): void {
    setDebugScene("premium", t("shop.premium.title"));
    setDebugPremiumSection(this.activeSection);
    // 유료 상품은 기존 흰 쇼케이스를 유지해 무역소의 어두운 작업실과 시각적으로 구분한다.
    addSceneBackground(this, BACKGROUND.premiumShop);
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { depth: -20, strength: 0.72 });
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.5).setDepth(-19);
    bindCurrencyGuide({ scene: this, popups: this.popups });
    this.topBar = new TopBar(this, 40, {
      onSettings: () => startScene(this, "settings", { returnScene: "premium", returnData: { section: this.activeSection } }),
      onCurrency: (currency) => openCurrencyGuide({ scene: this, popups: this.popups }, currency),
    });
    this.add.text(60, 185, t("shop.premium.title"), textStyle({ role: "display", size: 52 })).setOrigin(0, 0);
    addSectionTitle(this, premiumTitleLeft(), premiumTitleY(), t("premium.list"), { size: PREMIUM_TITLE.size }).setDepth(8);
    this.createViewport();
    this.createTabs();
    this.installScrollInput();
    // 프리미엄은 핵심 하단 탭의 기존 진입점을 그대로 사용한다.
    new BottomNav(this, "premium");
    void this.refresh();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.removeScrollInput();
      this.viewportMask?.destroy(); this.viewportMask = undefined;
    });
    // 화면이 한 뼘 아래에서 떠오르며 들어온다. 조각마다 트윈을 걸지 않고 카메라 하나를
    // 움직이므로, 이 뒤에 무엇을 더 세워도 함께 지나간다 — 그래서 `create`의 맨 끝이다.
    playSceneEntrance(this);
  }

  /** 관성은 프레임 시간에 맞춰 감쇠해 고주사율에서도 같은 거리로 멈춘다. */
  update(_time: number, delta: number): void {
    if (!this.pointerDown && Math.abs(this.velocityY) > 4) {
      this.scrollTo((this.content?.y ?? 0) + this.velocityY * Math.min(delta, 34) / 1000);
      this.velocityY *= Math.pow(0.9, delta / 16.67);
    }
  }

  /** 격자 한 계층만 자르는 고정 마스크를 만들어 제목표와 라벨 입력을 침범하지 않게 한다. */
  private createViewport(): void {
    const view = premiumGridViewport();
    this.content = this.add.container(0, 0).setDepth(6);
    this.viewportMask = this.make.graphics();
    this.viewportMask.fillStyle(0xffffff, 1).fillRect(view.left, view.top, view.right - view.left, view.bottom - view.top);
    this.content.setMask(this.viewportMask.createGeometryMask());
  }

  /** 서버가 계산한 노출·제한 상태에서 유료 storefront만 골라 다시 그린다. */
  private async refresh(): Promise<void> {
    const response = await gameApi.getProducts("premium");
    if (!this.scene.isActive()) return;
    // storefront 판정은 검증된 모델 하나가 소유한다. 여기서 filter를 다시 쓰면 같은 규칙이
    // 두 곳에 살아, 한쪽만 고쳐도 화면은 조용히 예전 규칙으로 남는다.
    this.products = premiumModel(response.products);
    this.renderProducts();
  }

  /** 현재 라벨의 상품만 두 줄 격자로 다시 조립하고 실제 높이에서 스크롤 한계를 계산한다. */
  private renderProducts(): void {
    this.content?.removeAll(true);
    const visible = productsForPremiumCategory(this.products, this.selectedCategory);
    visible.forEach((product, index) => this.addProduct(product, index));
    const view = premiumGridViewport();
    this.minScrollY = Math.min(0, view.bottom - view.top - premiumGridContentHeight(visible.length));
    this.scrollTo(this.content?.y ?? 0);
  }

  /** 유료 카드도 공용 유리 면과 누를 때 확대되는 홀로그램 입력 규칙을 따른다. */
  private addProduct(product: ProductDto, index: number): void {
    const width = premiumCardWidth();
    const { x, y } = premiumCardSpot(index);
    const card = this.add.container(x, y);
    card.add(drawLayer(this, 0, 0, chipPoints(width, PREMIUM_CARD.height, { bevel: { topLeft: 40, topRight: 0, bottomRight: 30, bottomLeft: 0 } }), { fill: 0x161d25, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.62 }));
    const frame = addItemFrame(this, 0, PREMIUM_CARD.frameY, PREMIUM_CARD.frame);
    if (this.textures.exists(product.iconKey)) {
      const size = PREMIUM_CARD.frame * ITEM_FRAME.icon;
      frame.add(this.add.image(0, 0, product.iconKey).setDisplaySize(size, size));
    }
    card.add(frame);
    const name = this.add.text(0, PREMIUM_CARD.nameY, product.name, textStyle({ role: "emphasis", size: 27 })).setOrigin(0.5);
    // 이름 길이는 언어가 정하고 칸 폭은 둘이 나눠 갖는 고정값이라, 넘치면 글자만 가로로 줄인다.
    card.add(squeezeTextToWidth(name, width - 36, 0.7));
    const action = productActionModel(product.acquisition, { remaining: product.remaining, available: product.purchasable });
    // 패스는 구매 전에 수령 방식과 서버의 UTC 제한을 같은 카드에서 확인시킨다.
    const note = product.passBenefit
      ? t("shop.premium.passBenefit", { duration: product.passBenefit.durationDays === null ? t("shop.premium.forever") : t("shop.premium.duration", { days: product.passBenefit.durationDays }) })
      : product.description;
    card.add(this.add.text(0, PREMIUM_CARD.noteY, note, textStyle({ role: "body", size: 20, color: COLOR.inkDim, align: "center", wrap: width - 44, lineSpacing: 6 })).setOrigin(0.5, 0));
    if (product.acquisition.kind === "currency") {
      // 재화로 값을 치르는 묶음은 다른 화면과 같은 **가로로 긴 값줄**로 선다.
      addPriceBar(this, card, 0, PREMIUM_CARD.price.y, width - PREMIUM_CARD.price.inset, undefined, product.acquisition.currency, product.acquisition.amount, {
        height: PREMIUM_CARD.price.height,
        short: session.wallet[product.acquisition.currency] < product.acquisition.amount,
      });
    } else {
      // 플랫폼 결제·광고·무료는 그릴 재화 그림이 없으므로 카탈로그가 준 값 문자열이 그 자리에 선다.
      const bar = this.add.container(0, PREMIUM_CARD.price.y);
      bar.add(drawLayer(this, 0, 0, chipPoints(width - PREMIUM_CARD.price.inset, PREMIUM_CARD.price.height, { bevel: { topLeft: 16, topRight: 0, bottomRight: 16, bottomLeft: 0 } }), { fill: 0x0d141c, alpha: 0.94, edge: COLOR.accent, edgeAlpha: 0.4 }));
      bar.add(this.add.text(0, 0, action.priceText, textStyle({ role: "display", size: 30, color: COLOR.accentText })).setOrigin(0.5));
      card.add(bar);
    }
    card.add(this.add.text(0, PREMIUM_CARD.remainingY, action.disabledReason ?? t("shop.premium.remaining", { remaining: product.remaining, limit: product.purchaseLimit }), textStyle({ role: "body", size: 19, color: product.purchasable ? COLOR.inkDim : COLOR.dangerText })).setOrigin(0.5));
    const hit = this.add.rectangle(0, 0, width, PREMIUM_CARD.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => pressIn(card));
    hit.on("pointerout", () => pressOut(card, "normal", { pop: false }));
    hit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      pressOut(card);
      // GeometryMask는 그리기만 자르므로 격자 밖의 숨은 칸 입력도 같은 창 경계에서 거부한다.
      if (!this.insideViewport(pointer)) return;
      // 스크롤 드래그가 끝난 손을 구매 탭으로 오인하지 않는다.
      if (this.draggedDistance > PREMIUM_CARD.dragSlop) return;
      // 결제 비활성 상품도 상세 팝업 안에서 지급량·가격·사유를 확인한다.
      new PurchasePopup(this, this.popups, gameApi, session.wallet).open(product, async (result) => { this.applyPurchaseResult(result); this.notice(t("shop.premium.purchased")); await this.refresh(); });
    });
    card.add(hit);
    this.content?.add(card);
  }

  /** 하단 목록 교체 줄은 상점·가방과 **같은 서류철 라벨 프리팹**을 쓴다. */
  private createTabs(): void {
    this.tabRow?.destroy();
    this.tabRow = this.add.container(0, 0).setDepth(9);
    PREMIUM_TABS.forEach((tab, index) => {
      const { x, y } = premiumTabSpot(index, PREMIUM_TABS.length);
      addCategoryTab(this, this.tabRow, {
        x, y, width: PREMIUM_TAB_ROW.width, height: PREMIUM_TAB_ROW.height,
        label: tab.label, selected: tab.id === this.selectedCategory,
        onSelect: () => this.selectCategory(tab.id),
      });
    });
  }

  /** 라벨을 바꾸면 이전 스크롤을 버리고 그 갈래의 첫 상품부터 다시 보여 준다. */
  private selectCategory(category: PremiumCategory): void {
    if (category === this.selectedCategory) return;
    this.selectedCategory = category;
    if (this.content) this.content.y = 0;
    this.createTabs();
    this.renderProducts();
  }

  /** 격자가 흐르는 창 안의 손인지. 마스크와 같은 값을 읽어 보이는 것과 눌리는 것을 맞춘다. */
  private insideViewport(pointer: Phaser.Input.Pointer): boolean {
    const view = premiumGridViewport();
    return pointer.x >= view.left && pointer.x <= view.right && pointer.y >= view.top && pointer.y <= view.bottom;
  }

  /** 보상 확인이 끝난 뒤에만 구매 응답의 확정 잔액을 공개하고 최신 목록을 다시 그린다. */
  private applyPurchaseResult(result: PurchaseProductResponse): void {
    session.wallet = { ...result.wallet };
    this.topBar?.refresh();
  }

  /** 휠과 포인터 드래그를 같은 세로 위치 경계로 모은다. */
  private installScrollInput(): void {
    this.input.on("pointerdown", this.onPointerDown);
    this.input.on("pointermove", this.onPointerMove);
    this.input.on("pointerup", this.onPointerUp);
    this.input.on("wheel", this.onWheel);
  }

  /** 씬 재시작 시 이전 인스턴스의 입력 핸들러가 중첩되지 않게 모두 해제한다. */
  private removeScrollInput(): void {
    this.input.off("pointerdown", this.onPointerDown);
    this.input.off("pointermove", this.onPointerMove);
    this.input.off("pointerup", this.onPointerUp);
    this.input.off("wheel", this.onWheel);
  }

  private readonly onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (!this.insideViewport(pointer)) return;
    this.pointerDown = true;
    this.pointerY = pointer.y;
    this.draggedDistance = 0;
    this.velocityY = 0;
  };

  private readonly onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (!this.pointerDown || !pointer.isDown) return;
    const delta = pointer.y - this.pointerY;
    this.pointerY = pointer.y;
    this.draggedDistance += Math.abs(delta);
    this.velocityY = delta * 60;
    this.scrollTo((this.content?.y ?? 0) + delta);
  };

  private readonly onPointerUp = (): void => { this.pointerDown = false; };

  private readonly onWheel = (_pointer: Phaser.Input.Pointer, _objects: Phaser.GameObjects.GameObject[], _dx: number, dy: number): void => {
    this.scrollTo((this.content?.y ?? 0) - dy * 0.8);
  };

  /** 콘텐츠 위치를 첫 줄과 마지막 줄이 각각 창 경계에 닿는 범위로 고정한다. */
  private scrollTo(y: number): void {
    if (this.content) this.content.y = Phaser.Math.Clamp(y, this.minScrollY, 0);
  }

  /** 결과 안내는 격자 마스크 밖의 고정 계층에 두어 스크롤과 함께 움직이지 않게 한다. */
  private notice(message: string): void {
    const view = premiumGridViewport();
    const toast = this.add.text((view.left + view.right) / 2, view.bottom - 36, message, textStyle({ role: "emphasis", size: 26, color: COLOR.accentText })).setOrigin(0.5).setDepth(500);
    this.tweens.add({ targets: toast, alpha: 0, delay: 900, duration: 500, onComplete: () => toast.destroy() });
  }
}

/** 목록 갈래 판정은 화면이 다시 만들지 않고 순수 모델 하나만 쓴다. */
export { premiumCategoryOf };
