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
import { addFrameAmount, addFramedIcon, guideForIcon } from "../ui/itemFrame";
import { chipPoints, drawLayer, drawVignette, slantedRect } from "../ui/holo";
import { paintShowcaseCard, SHOWCASE_TIER_TONE } from "../ui/showcaseCardChrome";
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
import { premiumCategoryOf, premiumFirstBonusGems, premiumGrantTiles, premiumModel, productsForPremiumCategory } from "../ui/premiumModel";
import {
  PREMIUM_CARD, PREMIUM_TAB_ROW, PREMIUM_TITLE, PREMIUM_WIDE,
  premiumCardHeight, premiumCardSpot, premiumCardWidth, premiumGridContentHeight, premiumGridViewport, premiumListKind,
  premiumTabSpot, premiumTitleLeft, premiumTitleY, premiumWideFrameXs, type PremiumListKind,
} from "../ui/premiumLayout";
import { formatCurrency } from "../core/formatCurrency";
import { consumeSceneEntry } from "./sceneEntry";
import { playSceneEntrance, startScene, slideTabPage } from "../ui/screenTransition";
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
    // 상품을 산 뒤에는 지갑이 바뀌었으므로 상단 줄도 함께 맞춘다.
    session.wallet = { ...session.wallet, ...(await gameApi.getPlayerState()).wallet };
    if (!this.scene.isActive()) return;
    this.topBar?.refresh();
    this.renderProducts();
  }

  /** 현재 라벨의 상품만 그 갈래의 모양(가로 한 줄 · 두 칸 격자)으로 다시 조립하고 스크롤 한계를 계산한다. */
  private renderProducts(): void {
    this.content?.removeAll(true);
    const visible = productsForPremiumCategory(this.products, this.selectedCategory);
    const kind = premiumListKind(this.selectedCategory);
    visible.forEach((product, index) => this.addProduct(product, index, kind));
    const view = premiumGridViewport();
    this.minScrollY = Math.min(0, view.bottom - view.top - premiumGridContentHeight(visible.length, kind));
    this.scrollTo(this.content?.y ?? 0);
  }

  /**
   * 상품 한 장. 겉모습은 무역 전시장과 같은 한 벌(`paintShowcaseCard`)이고, 카드 전체가 구매 확인을 연다.
   *
   * **입력면은 카드를 먼저, 액자를 나중에 세운다.** 액자는 제 안내창을 여는 손이 따로 있어야 하므로 카드의
   * 입력면이 그 위를 덮으면 안 된다 — 위에 선 것이 먼저 손을 받는다.
   */
  private addProduct(product: ProductDto, index: number, kind: PremiumListKind): void {
    const width = premiumCardWidth(kind);
    const height = premiumCardHeight(kind);
    const { x, y } = premiumCardSpot(index, kind);
    const card = this.add.container(x, y);
    const action = productActionModel(product.acquisition, { remaining: product.remaining, available: product.purchasable });
    const soldOut = !product.purchasable;
    if (kind === "grid") {
      paintShowcaseCard(this, card, { width, height, accent: soldOut ? COLOR.inkDimHex : COLOR.accent, dim: soldOut, railX: -width / 2 + 34 });
    } else {
      paintShowcaseCard(this, card, { width, height, accent: soldOut ? COLOR.inkDimHex : premiumCardTone(product), dim: soldOut, railX: -width / 2 + PREMIUM_WIDE.pad, tag: premiumCardTag(product) });
    }
    this.addCardHit(card, width, height, () => {
      // 결제 비활성 상품도 상세 팝업 안에서 지급량·가격·사유를 확인한다.
      new PurchasePopup(this, this.popups, gameApi, session.wallet).open(product, async (result) => { this.applyPurchaseResult(result); this.notice(t("shop.premium.purchased")); await this.refresh(); });
    });
    if (kind === "wide") this.paintWideCard(card, product, width, action); else this.paintGridCard(card, product, width, action);
    if (soldOut) card.setAlpha(PREMIUM_SOLD_OUT_ALPHA);
    this.content?.add(card);
  }

  /** 카드 전체를 덮는 입력면. 드래그로 끝난 손과 창 밖의 숨은 칸은 누름으로 치지 않는다. */
  private addCardHit(card: Phaser.GameObjects.Container, width: number, height: number, onTap: () => void): void {
    const hit = this.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => pressIn(card));
    hit.on("pointerout", () => pressOut(card, "normal", { pop: false }));
    hit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      pressOut(card);
      if (!this.isTap(pointer)) return;
      onTap();
    });
    card.add(hit);
  }

  /** 격자 안에서 일어난, 스크롤이 아닌 누름인가. GeometryMask는 그리기만 자르므로 입력도 같은 창 경계로 거른다. */
  private isTap(pointer: Phaser.Input.Pointer): boolean {
    return this.insideViewport(pointer) && this.draggedDistance <= PREMIUM_CARD.dragSlop;
  }

  /**
   * 받는 것 액자 한 칸 — **가방 칸과 같은 양식**(공용 액자 + 가방의 수량 글자)이고, 누르면 그 재화·아이템의
   * 안내창이 열린다. 공용 액자의 안내 입력은 스크롤 중의 손을 가르지 못하므로 같은 일을 여기서 거른다.
   */
  private addGrantFrame(card: Phaser.GameObjects.Container, x: number, y: number, size: number, icon: string, amount: number, options: { color?: number } = {}): Phaser.GameObjects.Container {
    const frame = addFramedIcon(this, card, x, y, size, icon, { plain: true, color: options.color });
    frame.add(addFrameAmount(this, size, formatCurrency(amount)));
    const openGuide = guideForIcon(this, icon);
    if (openGuide) {
      const hit = this.add.rectangle(0, 0, size, size, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => pressIn(frame));
      hit.on("pointerout", () => pressOut(frame, "normal", { pop: false }));
      hit.on("pointerup", (pointer: Phaser.Input.Pointer) => { pressOut(frame); if (this.isTap(pointer)) openGuide(); });
      frame.add(hit);
    }
    return frame;
  }

  /**
   * 가로 카드 — 왼쪽 위에 이름, 가운데에 **받는 것(액자 + 수량)**, 그 아래 가운데에 값.
   *
   * 설명 문장은 없다 — 받는 것이 액자로 서 있다. 정기권이 매일 얹는 몫은 그 액자 왼쪽 위의 「매일」 표식이 말한다.
   */
  private paintWideCard(card: Phaser.GameObjects.Container, product: ProductDto, width: number, action: ReturnType<typeof productActionModel>): void {
    const W = PREMIUM_WIDE;
    const S = W.stack;
    const tiles = premiumGrantTiles(product).slice(0, W.frameCap);
    const left = -width / 2 + W.pad;
    const right = width / 2 - W.pad;
    const name = this.add.text(left, S.nameY, product.name, textStyle({ role: "display", size: W.nameSize })).setOrigin(0, 0.5).setShadow(3, 4, "#04060a", 0, true, true);
    card.add(squeezeTextToWidth(name, right - left, 0.7));
    const xs = premiumWideFrameXs(tiles.length);
    tiles.forEach((tile, i) => {
      const frame = this.addGrantFrame(card, xs[i], S.frameY, W.frame, tile.icon, tile.amount);
      if (tile.daily) {
        // 정기권이 매일 얹는 몫 — 액자 위에 걸친 작은 꼬리표가 「매일」을 말한다.
        const label = this.add.text(0, 0, t("shop.premium.daily"), textStyle({ role: "display", size: 20, color: "#101418" })).setOrigin(0.5);
        const tagWidth = label.width + 22;
        const tag = this.add.container(-W.frame / 2 + tagWidth / 2 - 4, -W.frame / 2 - 2);
        tag.add(drawLayer(this, 0, 0, slantedRect(tagWidth, 32, 10), { fill: COLOR.accent, alpha: 1, shadow: false }));
        tag.add(label);
        frame.add(tag);
      }
    });
    this.paintPriceChip(card, product, 0, S.price.y, S.price.width, S.price.height, S.price.size, action);
    // 값 줄 양 끝 — 왼쪽은 정기권의 기간·권리, 오른쪽은 남은 구매. 값보다 작고 흐리다.
    const sideWidth = S.price.width / 2 + W.priceGap;
    const foot = this.passFootnote(product);
    if (foot) card.add(this.add.text(left, S.price.y, foot, textStyle({ role: "body", size: W.noteSize, color: COLOR.inkDim, wrap: -sideWidth - left })).setOrigin(0, 0.5));
    const remaining = this.add.text(right, S.price.y, action.disabledReason ?? t("shop.premium.remaining", { remaining: product.remaining, limit: product.purchaseLimit }), textStyle({ role: "body", size: W.noteSize, color: product.purchasable ? COLOR.inkDim : COLOR.dangerText, align: "right", wrap: right - sideWidth })).setOrigin(1, 0.5);
    card.add(remaining);
  }

  /**
   * 두 칸 카드(다이아) — 위에 액자, 아래에 값.
   *
   * **첫 구매 보너스가 남았으면 액자가 하나 더 선다** — 기본 액자 + 「+」 + 보너스 액자, 그리고 보너스 액자 위에
   * 「/ 첫 구매 보너스」 제목표. 모서리 글자로 알리던 때는 무엇이 더 들어오는지 셈해야 했다.
   */
  private paintGridCard(card: Phaser.GameObjects.Container, product: ProductDto, width: number, action: ReturnType<typeof productActionModel>): void {
    const C = PREMIUM_CARD;
    const tile = premiumGrantTiles(product)[0];
    const bonus = premiumFirstBonusGems(product);
    if (tile && bonus > 0) {
      const B = C.bonus;
      this.addGrantFrame(card, -B.offsetX, C.frameY, B.frame, tile.icon, tile.amount);
      card.add(this.add.text(0, C.frameY, "+", textStyle({ role: "display", size: B.plusSize, color: COLOR.accentText })).setOrigin(0.5).setStroke("#000000", 6));
      this.addGrantFrame(card, B.offsetX, C.frameY, B.frame, tile.icon, bonus, { color: PREMIUM_BONUS_TONE });
      // 제목표는 보너스 액자의 왼쪽 끝에서 시작해 그 액자 위에 걸터앉는다.
      card.add(addSectionTitle(this, B.offsetX - B.frame / 2 - B.titleSize * 0.4, C.frameY - B.frame / 2 - B.titleGap, t("shop.premium.firstBonusTitle"), { size: B.titleSize }));
    } else if (tile) {
      this.addGrantFrame(card, 0, C.frameY, C.frame, tile.icon, tile.amount);
    }
    const name = this.add.text(0, C.nameY, product.name, textStyle({ role: "display", size: 30 })).setOrigin(0.5).setShadow(3, 4, "#04060a", 0, true, true);
    // 이름 길이는 언어가 정하고 칸 폭은 둘이 나눠 갖는 고정값이라, 넘치면 글자만 가로로 줄인다.
    card.add(squeezeTextToWidth(name, width - 36, 0.7));
    this.paintPriceChip(card, product, 0, C.price.y, width - C.price.inset, C.price.height, C.price.size, action);
    card.add(this.add.text(0, C.remainingY, action.disabledReason ?? t("shop.premium.remaining", { remaining: product.remaining, limit: product.purchaseLimit }), textStyle({ role: "body", size: 19, color: product.purchasable ? COLOR.inkDim : COLOR.dangerText })).setOrigin(0.5));
  }

  /** 값 칸. 재화로 값을 치르는 상품은 값줄, 결제 상품은 카탈로그의 값 문자열을 두껍게 세운다. */
  private paintPriceChip(card: Phaser.GameObjects.Container, product: ProductDto, x: number, y: number, width: number, height: number, size: number, action: ReturnType<typeof productActionModel>): void {
    if (product.acquisition.kind === "currency") {
      addPriceBar(this, card, x, y, width, undefined, product.acquisition.currency, product.acquisition.amount, { height, short: session.wallet[product.acquisition.currency] < product.acquisition.amount });
      return;
    }
    const bar = this.add.container(x, y);
    bar.add(drawLayer(this, 0, 0, chipPoints(width, height, { bevel: { topLeft: 20, topRight: 0, bottomRight: 20, bottomLeft: 0 } }), { fill: 0x0d141c, alpha: 0.96, edge: COLOR.accent, edgeAlpha: 0.7 }));
    const price = this.add.text(0, 0, action.priceText, textStyle({ role: "display", size, color: COLOR.accentText })).setOrigin(0.5).setStroke("#000000", 6).setShadow(2, 4, "#04060a", 0, true, true);
    bar.add(squeezeTextToWidth(price, width - 36, 0.6));
    card.add(bar);
  }

  /** 정기권 카드 값 줄 왼쪽의 한 줄 — 유효 기간 · 권리. 정기권이 아니면 비어 있다. */
  private passFootnote(product: ProductDto): string {
    const parts: string[] = [];
    const pass = product.passBenefit;
    if (pass) {
      parts.push(pass.durationDays === null ? t("shop.premium.forever") : t("shop.premium.duration", { days: pass.durationDays }));
      parts.push(pass.adFree ? t("shop.premium.perk.adFree") : t("shop.premium.perk.instantAds"));
    }
    return parts.join("  ·  ");
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
    const indexOf = (id: PremiumCategory): number => PREMIUM_TABS.findIndex((tab) => tab.id === id);
    const from = indexOf(this.selectedCategory);
    this.selectedCategory = category;
    if (this.content) this.content.y = 0;
    this.createTabs();
    this.renderProducts();
    if (this.content) slideTabPage(this, [this.content], from, indexOf(category));
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

/** 소진된 카드의 진하기 — 무역 전시장과 같은 값이다. */
const PREMIUM_SOLD_OUT_ALPHA = 0.52;
/** 첫 구매 보너스 액자의 선 — 무역의 가치 배지와 같은 뜨거운 색이라 "더 들어온다"가 먼저 걸린다. */
const PREMIUM_BONUS_TONE = 0xe0603a;

/** 카드 색 — 정기권(기간 패스)은 금빛 한정과 같은 무게로, 나머지는 갱신 주기의 색이다. */
function premiumCardTone(product: ProductDto): number {
  return product.passBenefit ? SHOWCASE_TIER_TONE.once : SHOWCASE_TIER_TONE[product.refresh];
}

/** 꼬리표 — 정기권은 「30일 정기권」, 나머지는 무역과 같은 주기 이름이다. */
function premiumCardTag(product: ProductDto): string {
  if (product.passBenefit?.durationDays) return t("shop.premium.tag.membership", { days: product.passBenefit.durationDays });
  return t(`trade.tag.${product.refresh}`);
}

/** 목록 갈래 판정은 화면이 다시 만들지 않고 순수 모델 하나만 쓴다. */
export { premiumCategoryOf };
