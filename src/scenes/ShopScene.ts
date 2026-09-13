import Phaser from "phaser";
import { t } from "../i18n";
import { gameApi } from "../api/FakeServer";
import type { ProductDto, PurchaseProductResponse } from "../api/contracts";
import { formatCurrency } from "../core/formatCurrency";
import { RELICS } from "../data/relics";
import { SHOP_TABS, type ShopCategory } from "../data/shopCatalog";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { setDebugScene, setDebugShopView, setDebugStorefrontControls } from "../debug";
import { spawnPuppet } from "../puppets/assets";
import { SHOP_MERCHANT } from "../data/shopPresentation";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { addPriceBar } from "../ui/priceTag";
import { addCategoryTab } from "../ui/CategoryTab";
import { addSectionTitle } from "../ui/SectionTitle";
import { addBackButton } from "../ui/IconButton";
import { addItemFrame, ITEM_FRAME } from "../ui/itemFrame";
import { chipPoints, drawFrameVignette, drawLayer, drawShapeEdge, drawVignette, HOLO, slantedRect } from "../ui/holo";
import { COLOR, textStyle } from "../ui/theme";
import { TopBar } from "../ui/TopBar";
import { PopupLayer } from "../ui/PopupLayer";
import { PurchasePopup } from "../ui/PurchasePopup";
import { session } from "../state/session";
import { productsForShopCategory, shopModel } from "../ui/shopModel";
import {
  SHOP_BOARD, SHOP_CARD, SHOP_SHELF, SHOP_STAGE, SHOP_TAB_ROW, SHOP_TITLE,
  shopBoardSize, shopCardSpot, shopCardWidth, shopGridContentHeight, shopGridViewport,
  shopShelfWidth, shopShelfY, shopTabSpot, shopTitleLeft, shopTitleY,
} from "../ui/shopLayout";

/**
 * 일반 상품과 성장 재화를 취급하는 독립 상점 씬이다.
 *
 * 화면은 넷으로 나뉜다 — **위 한 칸은 무대**(오른쪽에 점원 상반신, 왼쪽에 대사), **아래 세 칸은
 * 상품 판**이고 하단의 서류철 라벨이 목록을 갈아 끼운다. 자리는 전부 `src/ui/shopLayout.ts`가
 * 갖고 이 씬은 좌표를 손으로 적지 않는다.
 */
export class ShopScene extends Phaser.Scene {
  private products: ProductDto[] = [];
  /** 첫 탭은 카탈로그 순서에서 정해 화면과 데이터의 기본값이 갈리지 않게 한다. */
  private selectedCategory: ShopCategory = SHOP_TABS[0].id;
  private tabRow?: Phaser.GameObjects.Container;
  private content?: Phaser.GameObjects.Container;
  /** 구매 응답 지갑을 적용한 직후 화면 가장자리 잔액을 같은 프레임에 갱신한다. */
  private topBar?: TopBar;
  private viewportMask?: Phaser.GameObjects.Graphics;
  /** 점원을 무대 한 칸 안으로 자르는 마스크. Puppet은 컨테이너 변환을 물려받지 않는다. */
  private stageMask?: Phaser.GameObjects.Graphics;
  /** 상품 목록 위에 재사용 구매 작업판을 쌓는 전용 팝업 계층이다. */
  private readonly popups = new PopupLayer(this, 2600);
  private minScrollY = 0;
  private pointerDown = false;
  private pointerY = 0;
  private draggedDistance = 0;
  private velocityY = 0;

  constructor() { super("shop"); }

  create(): void {
    setDebugScene("shop", t("shop.title"));
    // 최종 상점 쇼케이스 배경은 공용 로딩 표에서 먼저 읽혀 씬 진입 중 로더가 튀어나오지 않는다.
    addSceneBackground(this, BACKGROUND.shop);
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { depth: -20, strength: 0.76 });
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.5).setDepth(-19);
    this.topBar = new TopBar(this, 40, { onSettings: () => this.scene.start("settings", { returnScene: "lobby" }) });
    this.add.text(54, 170, t("shop.title"), textStyle({ role: "display", size: 54 })).setOrigin(0, 0);
    // 목록 컨테이너는 비동기 생성되므로 공용 돌아가기를 그보다 높은 고정 계층에 둔다.
    addBackButton(this, () => this.scene.start("lobby")).setDepth(1000);

    this.createStage();
    this.createBoard();
    this.createViewport();
    this.createTabs();
    this.installScrollInput();
    this.publishControls([]);
    // 점원 자산은 별도 표시 데이터에서 고르고 공용 Puppet과 관절 배치 규칙을 그대로 거친다.
    void this.createMerchant();
    void this.refresh();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.removeScrollInput();
      this.stageMask?.destroy(); this.stageMask = undefined;
      this.viewportMask?.destroy(); this.viewportMask = undefined;
    });
  }

  /** 관성은 프레임 시간에 맞춰 감쇠해 고주사율에서도 같은 거리로 멈춘다. */
  update(_time: number, delta: number): void {
    if (!this.pointerDown && Math.abs(this.velocityY) > 4) {
      this.scrollTo((this.content?.y ?? 0) + this.velocityY * Math.min(delta, 34) / 1000);
      this.velocityY *= Math.pow(0.9, delta / 16.67);
    }
  }

  /**
   * 위 한 칸 — 왼쪽의 대사 띠.
   *
   * 로비 대사와 같은 규칙이다: 판을 키우는 대신 **이름줄과 대사줄만 덮는 얇은 띠**를 불투명하게
   * 두고, 경계는 판때기가 아니라 띠의 변을 따라 긋는 선 두 줄이 잡는다.
   */
  private createStage(): void {
    const { centerX, centerY, width, height, nameOffsetY, lineOffsetY } = SHOP_STAGE.dialogue;
    const band = slantedRect(width, height, 18);
    this.add.existing(drawLayer(this, centerX, centerY, band, { fill: 0x05070a, alpha: 0.9, shadow: false }).setDepth(4));
    this.add.existing(drawShapeEdge(this, centerX, centerY, band, "top", { color: COLOR.accent, alpha: 0.8, inset: 6 }).setDepth(4));
    this.add.existing(drawShapeEdge(this, centerX, centerY, band, "bottom", { color: COLOR.accent, alpha: 0.3, inset: 6 }).setDepth(4));
    const left = centerX - width / 2 + 30;
    // 이름 왼쪽의 두꺼운 막대. 누가 말하는지를 한 글자보다 먼저 알린다.
    this.add.rectangle(left, centerY + nameOffsetY, 9, 40, COLOR.accent, 0.95).setOrigin(0, 0.5).setDepth(5);
    const name = RELICS.find((relic) => relic.id === SHOP_MERCHANT.relicId)?.name ?? "";
    this.add.text(left + 22, centerY + nameOffsetY, name, textStyle({ role: "display", size: 32, color: COLOR.accentText })).setOrigin(0, 0.5).setDepth(5);
    this.add.text(left, centerY + lineOffsetY, t("shop.merchant.line"), textStyle({ role: "body", size: 26, color: COLOR.ink, lineSpacing: 6, wrap: width - 60 })).setOrigin(0, 0.5).setDepth(5);
  }

  /**
   * 아래 세 칸을 덮는 상품 판.
   *
   * 판 하나가 점원의 하반신을 가리므로 `drawFrameVignette`으로 네 변을 고르게 눌러 판이 어디서
   * 끝나는지 알린다 — 같은 도형을 줄여 가며 두르는 `drawInnerVignette`은 가로로 긴 판에서
   * 좌우가 더 많이 줄어 검은 줄이 여러 겹 어긋난 잔상으로 남는다.
   */
  private createBoard(): void {
    const { width, height, centerX, centerY } = shopBoardSize();
    // 판이 화면 좌우와 밑동에 닿으므로 깎는 것은 **윗변 두 모서리뿐**이다 — 화면 밖으로 나가는
    // 아래 모서리를 깎으면 그 빗변이 보이지 않는 자리에서만 잘려 아무 말도 하지 않는다.
    const shape = chipPoints(width, height, { bevel: { topLeft: 56, topRight: 0, bottomRight: 0, bottomLeft: 0 } });
    this.add.existing(drawLayer(this, centerX, centerY, shape, { fill: 0x10161d, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.7 }).setDepth(6));
    this.add.existing(drawFrameVignette(this, centerX, centerY, width, height, { strength: 0.45 }).setDepth(6));
    this.createTitle();
  }

  /**
   * 격자 위에 서는 제목표.
   *
   * **뒤에 판을 받치지 않는다.** 창보다 넓은 어두운 살피를 한 겹 깔아 봤는데, 선반이 이미
   * 줄마다 깊이를 만들고 있어 그 위에 판이 하나 더 생기는 것으로만 보였다 — 제목표가 제 판을
   * 이미 갖고 있어 받칠 것도 없다.
   */
  private createTitle(): void {
    addSectionTitle(this, shopTitleLeft(), shopTitleY(), t("shop.exchangeList"), { size: SHOP_TITLE.size }).setDepth(8);
  }

  /**
   * 점원은 **상반신만** 선다.
   *
   * 머리 관절을 무대에 고정해 등신이 다른 원화도 얼굴이 같은 자리에 서게 하고, 남는 몸은 상품
   * 판이 덮는다. 판이 반투명 유리라 그 아래로 몸이 비쳐 격자를 흐리므로 무대 한 칸에서 잘라
   * 둔다 — Puppet은 컨테이너 변환을 물려받지 않으므로 화면 좌표의 기하 마스크를 쓴다.
   */
  private async createMerchant(): Promise<void> {
    const { headX, headY, height } = SHOP_STAGE.merchant;
    const merchant = await spawnPuppet(this, SHOP_MERCHANT.asset, {
      focus: { anchor: "head", x: headX, y: headY }, height, depth: 2,
    });
    // 비동기 로딩 사이 씬이 닫혔으면 새 Mesh를 남기지 않는다.
    if (!this.scene.isActive()) { merchant.destroy(); return; }
    this.stageMask = this.make.graphics({});
    this.stageMask.fillStyle(0xffffff, 1).fillRect(0, SHOP_STAGE.top, BASE_WIDTH, SHOP_BOARD.top - SHOP_STAGE.top);
    merchant.setMask(this.stageMask.createGeometryMask());
  }

  /** 격자 한 계층만 자르는 고정 마스크를 만들어 판 머리글과 탭 입력을 침범하지 않게 한다. */
  private createViewport(): void {
    const view = shopGridViewport();
    this.content = this.add.container(0, 0).setDepth(8);
    this.viewportMask = this.make.graphics();
    this.viewportMask.fillStyle(0xffffff, 1).fillRect(view.left, view.top, view.right - view.left, view.bottom - view.top);
    this.content.setMask(this.viewportMask.createGeometryMask());
  }

  /** 서버의 storefront 경계를 신뢰하되 독립 상점 씬에서는 shop 상품만 렌더링한다. */
  private async refresh(): Promise<void> {
    const response = await gameApi.getProducts("shop");
    if (!this.scene.isActive()) return;
    // storefront 판정은 검증된 모델 하나가 소유한다. 여기서 filter를 다시 쓰면 같은 규칙이
    // 두 곳에 살아, 한쪽만 고쳐도 화면은 조용히 예전 규칙으로 남는다.
    this.products = shopModel(response.products);
    this.renderProducts();
  }

  /** 현재 서버 상태로 두 줄 격자를 재조립하고 실제 높이에서 스크롤 한계를 계산한다. */
  private renderProducts(): void {
    this.content?.removeAll(true);
    const visibleProducts = productsForShopCategory(this.products, this.selectedCategory);
    // 선반을 먼저 깔고 그 위에 칸을 올린다 — 순서가 뒤집히면 선반이 칸을 가로질러 지나간다.
    const rows = Math.ceil(visibleProducts.length / SHOP_CARD.columns);
    for (let row = 0; row < rows; row += 1) this.addShelf(row);
    visibleProducts.forEach((product, index) => this.addProduct(product, index));
    const view = shopGridViewport();
    this.minScrollY = Math.min(0, view.bottom - view.top - shopGridContentHeight(visibleProducts.length));
    this.publishControls(visibleProducts);
    this.scrollTo(this.content?.y ?? 0);
  }

  /** 카드 입력점은 현재 탭에서 실제로 생성한 칸 중심만 공개한다. */
  private publishControls(visibleProducts: readonly ProductDto[]): void {
    const view = shopGridViewport();
    setDebugStorefrontControls({ shop: {
      back: { x: BASE_WIDTH - 106, y: BASE_HEIGHT - 120 },
      tabs: this.tabPoints(),
      cards: visibleProducts.map((_, index) => shopCardSpot(index)),
      drag: { from: { x: (view.left + view.right) / 2, y: view.bottom - 80 }, to: { x: (view.left + view.right) / 2, y: view.top + 80 } },
    } });
  }

  /**
   * 그 줄의 선반 한 장.
   *
   * 칸 밑변 바로 아래를 지나고 좌우로 한 뼘 더 내밀어, 칸이 선반 **위에 놓인 것**으로 읽히게
   * 한다. 윗변 한 줄의 강조선이 곧 선반의 모서리다 — 사방을 두르면 판때기가 하나 더 생긴다.
   */
  private addShelf(row: number): void {
    const shelf = drawLayer(this, (shopGridViewport().left + shopGridViewport().right) / 2, shopShelfY(row), slantedRect(shopShelfWidth(), SHOP_SHELF.height, 10), {
      fill: 0x060a0f, alpha: 0.95, edge: COLOR.accent, edgeAlpha: 0.55,
    });
    this.content?.add(shelf);
  }

  /** 일반 판은 윗선만, 상품 그림 액자만 사방 테두리와 내부 비네트를 사용한다. */
  private addProduct(product: ProductDto, index: number): void {
    const width = shopCardWidth();
    const { x, y } = shopCardSpot(index);
    const card = this.add.container(x, y);
    card.add(drawLayer(this, 0, 0, chipPoints(width, SHOP_CARD.height, { bevel: { topLeft: 36, topRight: 0, bottomRight: 28, bottomLeft: 0 } }), { fill: 0x182029, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.52 }));
    const frame = addItemFrame(this, 0, SHOP_CARD.frameY, SHOP_CARD.frame);
    // iconKey는 카탈로그가 고른 임시 상품 그림이며 최종 원화 교체에도 카드 코드는 유지된다.
    frame.add(this.add.image(0, 0, product.iconKey).setDisplaySize(SHOP_CARD.frame * ITEM_FRAME.icon, SHOP_CARD.frame * ITEM_FRAME.icon));
    const currencyGrant = product.grants.find((grant) => grant.kind === "currency");
    if (currencyGrant) {
      // 지급 수량은 액자 우하단에 공용 축약 표기로 겹쳐 작은 화면에서도 한눈에 읽힌다.
      frame.add(this.add.text(SHOP_CARD.frame / 2 - 10, SHOP_CARD.frame / 2 - 8, formatCurrency(currencyGrant.amount), textStyle({ role: "emphasis", size: 25, color: COLOR.accentText })).setOrigin(1, 1));
    }
    card.add(frame);
    const name = this.add.text(0, SHOP_CARD.nameY, product.name, textStyle({ role: "emphasis", size: 27 })).setOrigin(0.5);
    // 이름 길이는 언어가 정하고 칸 폭은 둘이 나눠 갖는 고정값이라, 넘치면 글자만 가로로 줄인다.
    const room = width - 36;
    if (name.width > room) name.setScale(Math.max(0.7, room / name.width), 1);
    card.add(name);
    card.add(this.add.text(0, SHOP_CARD.remainingY, t("shop.exchangeRemaining", { remaining: formatCurrency(product.remaining), limit: formatCurrency(product.purchaseLimit) }), textStyle({ role: "body", size: 20, color: product.purchasable ? COLOR.inkDim : COLOR.dangerText })).setOrigin(0.5));
    // **값은 액자가 아니라 가로로 긴 줄이다**(무역 카드와 같은 한 장). 칸마다 값이 하나뿐이라
    // 작은 네모로 두면 넓은 칸 구석에 외따로 뜬 조각으로 읽힌다.
    if (product.acquisition.kind === "currency") {
      addPriceBar(this, card, 0, SHOP_CARD.price.y, width - SHOP_CARD.price.inset, undefined, product.acquisition.currency, product.acquisition.amount, {
        height: SHOP_CARD.price.height,
        short: session.wallet[product.acquisition.currency] < product.acquisition.amount,
      });
    }
    const hit = this.add.rectangle(0, 0, width, SHOP_CARD.height, 0xffffff, 0).setInteractive({ useHandCursor: product.purchasable });
    hit.on("pointerdown", () => card.setScale(1.04));
    hit.on("pointerout", () => card.setScale(1));
    hit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      card.setScale(1);
      // GeometryMask는 그리기만 자르므로 격자 밖의 숨은 칸 입력도 같은 창 경계에서 거부한다.
      if (!this.insideViewport(pointer)) return;
      // 스크롤 드래그가 끝난 손을 구매 탭으로 오인하지 않는다.
      if (this.draggedDistance <= SHOP_CARD.dragSlop) {
        // 비활성 상품도 이유와 상세 정보를 읽을 수 있으며 카드 탭 자체는 절대 즉시 구매하지 않는다.
        new PurchasePopup(this, this.popups, gameApi, session.wallet).open(product, async (result) => { this.applyPurchaseResult(result); this.notice(t("shop.exchangeDone")); await this.refresh(); });
      }
    });
    card.add(hit);
    this.content?.add(card);
  }

  /** 격자가 흐르는 창 안의 손인지. 마스크와 같은 값을 읽어 보이는 것과 눌리는 것을 맞춘다. */
  private insideViewport(pointer: Phaser.Input.Pointer): boolean {
    const view = shopGridViewport();
    return pointer.x >= view.left && pointer.x <= view.right && pointer.y >= view.top && pointer.y <= view.bottom;
  }

  /** 보상 팝업이 닫힌 뒤 구매 응답의 지갑·잔여 횟수를 먼저 반영하고 카탈로그도 다시 조회한다. */
  private applyPurchaseResult(result: PurchaseProductResponse): void {
    session.wallet = { ...result.wallet };
    this.products = this.products.map((product) => product.id === result.productId ? { ...product, remaining: result.remaining, purchasable: result.remaining > 0 } : product);
    this.topBar?.refresh();
    this.renderProducts();
  }

  /** 하단 목록 교체 줄은 가방과 **같은 서류철 라벨 프리팹**을 쓴다. */
  private createTabs(): void {
    this.tabRow?.destroy();
    this.tabRow = this.add.container(0, 0).setDepth(9);
    SHOP_TABS.forEach((tab, index) => {
      const { x, y } = shopTabSpot(index);
      addCategoryTab(this, this.tabRow, {
        x, y, width: SHOP_TAB_ROW.width, height: SHOP_TAB_ROW.height,
        label: tab.label, selected: tab.id === this.selectedCategory,
        onSelect: () => this.selectCategory(tab.id),
      });
    });
  }

  /** 런타임 탭 간격과 동일한 계산으로 테스트 입력 중심을 제공한다. */
  private tabPoints(): Record<ShopCategory, { x: number; y: number }> {
    return Object.fromEntries(SHOP_TABS.map((tab, index) => [tab.id, shopTabSpot(index)])) as Record<ShopCategory, { x: number; y: number }>;
  }

  /** 탭을 바꾸면 이전 스크롤을 버리고 해당 분류의 첫 상품부터 다시 보여 준다. */
  private selectCategory(category: ShopCategory): void {
    if (category === this.selectedCategory) return;
    this.selectedCategory = category;
    if (this.content) this.content.y = 0;
    this.createTabs();
    this.renderProducts();
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

  /** 콘텐츠 위치를 첫 줄과 마지막 줄이 각각 창 경계에 닿는 범위로 고정한다. */
  private scrollTo(y: number): void {
    if (this.content) this.content.y = Phaser.Math.Clamp(y, this.minScrollY, 0);
    setDebugShopView({ category: this.selectedCategory, scrollY: this.content?.y ?? 0, minScrollY: this.minScrollY });
  }

  /** 결과 안내는 격자 마스크 밖의 고정 계층에 두어 스크롤과 함께 움직이지 않게 한다. */
  private notice(message: string): void {
    const view = shopGridViewport();
    const toast = this.add.text((view.left + view.right) / 2, view.bottom - 36, message, textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0.5).setDepth(500);
    this.tweens.add({ targets: toast, alpha: 0, delay: 900, duration: 500, onComplete: () => toast.destroy() });
  }
}
