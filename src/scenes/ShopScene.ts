import Phaser from "phaser";
import { gameApi } from "../api/FakeServer";
import type { ProductDto } from "../api/contracts";
import { formatCurrency } from "../core/formatCurrency";
import { SHOP_TABS, type ShopCategory } from "../data/shopCatalog";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import { TORIKA_ASSET, spawnPuppet } from "../puppets/assets";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { CURRENCY_ICON_BY_WALLET } from "../ui/currencyIcons";
import { addBackButton } from "../ui/IconButton";
import { addItemFrame, ITEM_FRAME } from "../ui/itemFrame";
import { chipPoints, drawHairline, drawLayer, drawVignette, HOLO } from "../ui/holo";
import { COLOR, textStyle } from "../ui/theme";
import { TopBar } from "../ui/TopBar";
import { PopupLayer } from "../ui/PopupLayer";
import { PurchasePopup } from "../ui/PurchasePopup";
import { session } from "../state/session";

/** 상품 목록이 제목 아래에서 뒤로가기 안전 영역 위까지 흐르는 화면 좌표 경계다. */
const LIST_VIEW = { left: 470, right: BASE_WIDTH - 36, top: 330, bottom: BASE_HEIGHT - 285 } as const;
/** 세로 카드 간격과 드래그 판정을 한곳에 묶어 스크롤 감각을 일정하게 유지한다. */
const LIST_LAYOUT = { cardHeight: 292, gap: 28, dragSlop: 16, frameSize: 164 } as const;

/** 인게임 재화만 교환하는 독립 무역소 씬이다. */
export class ShopScene extends Phaser.Scene {
  private products: ProductDto[] = [];
  /** 첫 탭은 카탈로그 순서에서 정해 화면과 데이터의 기본값이 갈리지 않게 한다. */
  private selectedCategory: ShopCategory = SHOP_TABS[0].id;
  private tabButtons: Phaser.GameObjects.Container[] = [];
  private content?: Phaser.GameObjects.Container;
  private viewportMask?: Phaser.GameObjects.Graphics;
  /** 상품 목록 위에 재사용 구매 작업판을 쌓는 전용 팝업 계층이다. */
  private readonly popups = new PopupLayer(this, 2600);
  private minScrollY = 0;
  private pointerDown = false;
  private pointerY = 0;
  private draggedDistance = 0;
  private velocityY = 0;

  constructor() { super("shop"); }

  create(): void {
    setDebugScene("shop", "무역소");
    // 임시 무역소 배경도 공용 로딩 표에서 먼저 읽혀 씬 진입 중 로더가 튀어나오지 않는다.
    addSceneBackground(this, BACKGROUND.shop);
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { depth: -20, strength: 0.76 });
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.56).setDepth(-19);
    new TopBar(this, 40, { onSettings: () => this.scene.start("settings", { returnScene: "lobby" }) });
    this.add.text(54, 170, "무역소", textStyle({ role: "display", size: 54 })).setOrigin(0, 0);
    this.add.text(LIST_VIEW.left, 246, "교환 목록", textStyle({ role: "emphasis", size: 27, color: COLOR.accentText })).setOrigin(0, 0);
    drawHairline(this, (LIST_VIEW.left + LIST_VIEW.right) / 2, 302, LIST_VIEW.right - LIST_VIEW.left, { color: COLOR.accent, alpha: 0.4 });
    addBackButton(this, () => this.scene.start("lobby"));

    this.createViewport();
    this.createTabs();
    this.installScrollInput();
    // 임시 점원도 정지 이미지 대신 공용 Puppet과 중심1 관절 배치 규칙을 그대로 거친다.
    void this.createMerchant();
    void this.refresh();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.removeScrollInput());
  }

  /** 관성은 프레임 시간에 맞춰 감쇠해 고주사율에서도 같은 거리로 멈춘다. */
  update(_time: number, delta: number): void {
    if (!this.pointerDown && Math.abs(this.velocityY) > 4) {
      this.scrollTo((this.content?.y ?? 0) + this.velocityY * Math.min(delta, 34) / 1000);
      this.velocityY *= Math.pow(0.9, delta / 16.67);
    }
  }

  /** 토리카 임시 점원의 코어 관절을 좌측 무대 중심에 맞춰 전신 비율을 보존한다. */
  private async createMerchant(): Promise<void> {
    const merchant = await spawnPuppet(this, TORIKA_ASSET, {
      focus: { anchor: "core", x: 225, y: 920 }, height: 1280, depth: 2, flipX: true,
    });
    // 비동기 로딩 사이 씬이 닫혔으면 새 Mesh를 남기지 않는다.
    if (!this.scene.isActive()) { merchant.destroy(); return; }
  }

  /** 목록 한 계층만 자르는 고정 마스크를 만들어 제목과 뒤로가기 입력을 침범하지 않게 한다. */
  private createViewport(): void {
    this.content = this.add.container(0, 0);
    this.viewportMask = this.make.graphics();
    this.viewportMask.fillStyle(0xffffff, 1).fillRect(LIST_VIEW.left, LIST_VIEW.top, LIST_VIEW.right - LIST_VIEW.left, LIST_VIEW.bottom - LIST_VIEW.top);
    this.content.setMask(this.viewportMask.createGeometryMask());
  }

  /** 서버의 storefront 경계를 신뢰하되 화면에서는 trade 상품만 렌더링한다. */
  private async refresh(): Promise<void> {
    const response = await gameApi.getProducts();
    if (!this.scene.isActive()) return;
    this.products = response.products.filter((product) => product.storefront === "trade");
    this.renderProducts();
  }

  /** 현재 서버 상태로 세로 상품 카드를 재조립하고 실제 높이에서 스크롤 한계를 계산한다. */
  private renderProducts(): void {
    this.content?.removeAll(true);
    const visibleProducts = this.products.filter(({ category }) => category === this.selectedCategory);
    visibleProducts.forEach((product, index) => this.addProduct(product, index));
    const contentHeight = Math.max(0, visibleProducts.length * (LIST_LAYOUT.cardHeight + LIST_LAYOUT.gap) - LIST_LAYOUT.gap);
    this.minScrollY = Math.min(0, LIST_VIEW.bottom - LIST_VIEW.top - contentHeight);
    this.scrollTo(this.content?.y ?? 0);
  }

  /** 일반 패널은 윗선만, 상품 그림 액자만 사방 테두리와 내부 비네트를 사용한다. */
  private addProduct(product: ProductDto, index: number): void {
    const width = LIST_VIEW.right - LIST_VIEW.left;
    const x = (LIST_VIEW.left + LIST_VIEW.right) / 2;
    const y = LIST_VIEW.top + LIST_LAYOUT.cardHeight / 2 + index * (LIST_LAYOUT.cardHeight + LIST_LAYOUT.gap);
    const card = this.add.container(x, y);
    card.add(drawLayer(this, 0, 0, chipPoints(width, LIST_LAYOUT.cardHeight, { bevel: { topLeft: 44, topRight: 0, bottomRight: 32, bottomLeft: 0 } }), { fill: 0x182029, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.52 }));
    const frameX = -width / 2 + 106;
    const frame = addItemFrame(this, frameX, -28, LIST_LAYOUT.frameSize);
    // iconKey는 카탈로그가 고른 임시 상품 그림이며 최종 원화 교체에도 카드 코드는 유지된다.
    frame.add(this.add.image(0, 0, product.iconKey).setDisplaySize(LIST_LAYOUT.frameSize * ITEM_FRAME.icon, LIST_LAYOUT.frameSize * ITEM_FRAME.icon));
    const currencyGrant = product.grants.find((grant) => grant.kind === "currency");
    if (currencyGrant) {
      // 지급 수량은 액자 우하단에 공용 축약 표기로 겹쳐 작은 화면에서도 한눈에 읽힌다.
      frame.add(this.add.text(LIST_LAYOUT.frameSize / 2 - 10, LIST_LAYOUT.frameSize / 2 - 8, formatCurrency(currencyGrant.amount), textStyle({ role: "emphasis", size: 25, color: COLOR.accentText })).setOrigin(1, 1));
    }
    card.add(frame);
    card.add(this.add.text(-width / 2 + 206, -100, product.name, textStyle({ role: "emphasis", size: 29 })).setOrigin(0, 0));
    card.add(this.add.text(-width / 2 + 206, -48, product.description, textStyle({ role: "body", size: 21, color: COLOR.inkDim, wrap: width - 242 })).setOrigin(0, 0));
    // 가격은 액자 바로 아래에 숫자와 공용 재화 아이콘을 한 행으로 놓는다.
    if (product.price.currency !== "real_money") {
      const priceX = frameX - 12;
      card.add(this.add.image(priceX - 44, 91, CURRENCY_ICON_BY_WALLET[product.price.currency]).setDisplaySize(34, 34));
      card.add(this.add.text(priceX - 20, 91, formatCurrency(product.price.amount), textStyle({ role: "emphasis", size: 25, color: COLOR.accentText })).setOrigin(0, 0.5));
    }
    card.add(this.add.text(-width / 2 + 206, 78, `남은 교환 ${formatCurrency(product.remaining)}/${formatCurrency(product.purchaseLimit)}`, textStyle({ role: "body", size: 20, color: product.purchasable ? COLOR.ink : COLOR.inkDim })).setOrigin(0, 0));
    const hit = this.add.rectangle(0, 0, width, LIST_LAYOUT.cardHeight, 0xffffff, 0).setInteractive({ useHandCursor: product.purchasable });
    hit.on("pointerdown", () => card.setScale(1.04));
    hit.on("pointerout", () => card.setScale(1));
    hit.on("pointerup", () => {
      card.setScale(1);
      // 스크롤 드래그가 끝난 손을 구매 탭으로 오인하지 않는다.
      if (this.draggedDistance <= LIST_LAYOUT.dragSlop) {
        // 비활성 상품도 이유와 상세 정보를 읽을 수 있으며 카드 탭 자체는 절대 즉시 구매하지 않는다.
        new PurchasePopup(this, this.popups, gameApi, session.wallet).open(product, async () => { this.notice("교환이 완료되었습니다."); await this.refresh(); });
      }
    });
    card.add(hit);
    this.content?.add(card);
  }

  /** 하단 탭은 별도 판이나 밑줄 없이 선택 항목의 강조색과 확대 배율만 바꾼다. */
  private createTabs(): void {
    const width = LIST_VIEW.right - LIST_VIEW.left;
    const step = width / SHOP_TABS.length;
    this.tabButtons = SHOP_TABS.map((tab, index) => {
      const x = LIST_VIEW.left + step * (index + 0.5);
      const container = this.add.container(x, BASE_HEIGHT - 218);
      const label = this.add.text(0, 0, tab.label, textStyle({ role: "emphasis", size: 27 })).setOrigin(0.5);
      const hit = this.add.rectangle(0, 0, step, 82, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerup", () => this.selectCategory(tab.id));
      container.add([label, hit]);
      return container;
    });
    this.updateTabStyles();
  }

  /** 탭을 바꾸면 이전 스크롤을 버리고 해당 분류의 첫 상품부터 다시 보여 준다. */
  private selectCategory(category: ShopCategory): void {
    if (category === this.selectedCategory) return;
    this.selectedCategory = category;
    if (this.content) this.content.y = 0;
    this.updateTabStyles();
    this.renderProducts();
  }

  /** 선택 상태는 기존 탭 규칙에 맞춰 글자색과 1.12배 확대만으로 드러낸다. */
  private updateTabStyles(): void {
    this.tabButtons.forEach((button, index) => {
      const selected = SHOP_TABS[index].id === this.selectedCategory;
      button.setScale(selected ? 1.12 : 1);
      (button.first as Phaser.GameObjects.Text).setColor(selected ? COLOR.accentText : COLOR.inkDim);
    });
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
    if (pointer.x < LIST_VIEW.left || pointer.x > LIST_VIEW.right || pointer.y < LIST_VIEW.top || pointer.y > LIST_VIEW.bottom) return;
    // 새 제스처는 이전 드래그 거리를 버려 정상 탭이 다시 구매로 이어지게 한다.
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

  /** 콘텐츠 위치를 첫 행과 마지막 행이 각각 뷰포트 경계에 닿는 범위로 고정한다. */
  private scrollTo(y: number): void {
    if (this.content) this.content.y = Phaser.Math.Clamp(y, this.minScrollY, 0);
  }

  /** 결과 안내는 목록 마스크 밖의 고정 계층에 두어 스크롤과 함께 움직이지 않게 한다. */
  private notice(message: string): void {
    const toast = this.add.text((LIST_VIEW.left + LIST_VIEW.right) / 2, LIST_VIEW.bottom - 36, message, textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0.5).setDepth(500);
    this.tweens.add({ targets: toast, alpha: 0, delay: 900, duration: 500, onComplete: () => toast.destroy() });
  }

}
