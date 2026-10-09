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
import { chipPoints, drawLayer, drawShapeOutline, drawVignette, slantedRect } from "../ui/holo";
import { paintShowcaseCard, SHOWCASE_TIER_TONE, showcaseCardShape } from "../ui/showcaseCardChrome";
import { addAdRewardCard } from "../ui/AdRewardCard";
import { addStatusSticker, forgetStatusStickers } from "../ui/soldOutStamp";
import { premiumStatusOf, type PremiumStatus } from "../ui/premiumStatus";
import { remainingDetail } from "../ui/itemExpiry";
import { openRewardPopup, productGrantsToRewardItems } from "../ui/RewardPopup";
import { motionPolicy } from "../core/settings";
import { adSlotStatus, watchAdSlot } from "./adSlotFlow";
import { COLOR, textStyle } from "../ui/theme";
import { TopBar } from "../ui/TopBar";
import type { PremiumSection } from "./settingsNavigation";
import { PopupLayer } from "../ui/PopupLayer";
import { bindCurrencyGuide, openCurrencyGuide } from "../ui/currencyGuideEntry";
import { PurchasePopup } from "../ui/PurchasePopup";
import { session } from "../state/session";
import { findAdRewardSlot } from "../data/adRewards";
import { productActionModel } from "../core/productAcquisition";
import { addPriceBar } from "../ui/priceTag";
import { squeezeTextToWidth } from "../ui/textFit";
import { premiumCategoryOf, premiumFirstBonusGems, premiumGrantTiles, premiumModel, productsForPremiumCategory } from "../ui/premiumModel";
import {
  PREMIUM_CARD, PREMIUM_TAB_ROW, PREMIUM_TITLE, PREMIUM_WIDE,
  premiumCardHeight, premiumCardSpot, premiumCardWidth, premiumGridContentHeight, premiumGridViewport, premiumListKind,
  PREMIUM_SWIPE, premiumTabScrollFor, premiumTabSpot, premiumTabStep, premiumTabStrip, premiumTitleLeft, premiumTitleY, premiumWideFrameXs, type PremiumListKind,
} from "../ui/premiumLayout";
import { formatCurrency } from "../core/formatCurrency";
import { formatStorePrice } from "../core/storePrice";
import { addListPrice, addPremiumValueBadges } from "../ui/premiumValueBadge";
import { consumeSceneEntry } from "./sceneEntry";
import { playSceneEntrance, startScene, slideTabPage } from "../ui/screenTransition";
import { pressIn, pressOut } from "../ui/pressFeedback";
import { addClippedHit } from "../ui/clippedHit";

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
  private tabMask?: Phaser.GameObjects.Graphics;
  /** 입력 한 번이 가로 쓸기인지 세로 스크롤인지. 14px 안에서 정한다. */
  private pointerAxis: "none" | "x" | "y" = "none";
  private pointerStartX = 0;
  private swipeX = 0;
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
  /** 서버 시각 − 기기 시각. 한정 상품의 남은 시간을 기기 시계에 맡기지 않는다. */
  private serverOffsetMs = 0;
  /** 한정 카드의 붉은 남은 시간 글자 — 초마다 갈아 끼운다. */
  private limitedClocks: { text: Phaser.GameObjects.Text; until: string }[] = [];
  private clockElapsed = 0;
  private claiming = false;

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
      this.tabMask?.destroy(); this.tabMask = undefined;
    });
    // 화면이 한 뼘 아래에서 떠오르며 들어온다. 조각마다 트윈을 걸지 않고 카메라 하나를
    // 움직이므로, 이 뒤에 무엇을 더 세워도 함께 지나간다 — 그래서 `create`의 맨 끝이다.
    playSceneEntrance(this);
  }

  /** 관성은 프레임 시간에 맞춰 감쇠해 고주사율에서도 같은 거리로 멈춘다. */
  update(_time: number, delta: number): void {
    this.clockElapsed += delta;
    if (this.clockElapsed >= 1000) {
      this.clockElapsed = 0;
      for (const clock of this.limitedClocks) if (clock.text.active) clock.text.setText(this.limitedText(clock.until));
    }
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
    this.serverOffsetMs = Date.parse(response.serverTime) - Date.now();
    // 상품을 산 뒤에는 지갑이 바뀌었으므로 상단 줄도 함께 맞춘다.
    session.wallet = { ...session.wallet, ...(await gameApi.getPlayerState()).wallet };
    if (!this.scene.isActive()) return;
    this.topBar?.refresh();
    this.renderProducts();
  }

  /** 현재 라벨의 상품만 그 갈래의 모양(가로 한 줄 · 두 칸 격자)으로 다시 조립하고 스크롤 한계를 계산한다. */
  private renderProducts(): void {
    this.content?.removeAll(true);
    this.limitedClocks = [];
    const visible = productsForPremiumCategory(this.products, this.selectedCategory);
    const kind = premiumListKind(this.selectedCategory);
    // 광고 칸은 젬 탭의 맨 위(1번), 일간 탭에서는 「일일 무료 보급」 바로 아래에 끼어든다.
    const freeDailyIndex = visible.findIndex((product) => product.id === DAILY_FREE_PRODUCT_ID);
    const adAt = this.selectedCategory === "gem" ? 0 : this.selectedCategory === "daily" && freeDailyIndex >= 0 ? freeDailyIndex + 1 : -1;
    visible.forEach((product, index) => this.addProduct(product, adAt >= 0 && index >= adAt ? index + 1 : index, kind));
    const extra = adAt >= 0 ? 1 : 0;
    if (adAt >= 0) { if (this.selectedCategory === "gem") this.addGemAdCard(adAt, kind); else this.addDailyAdCard(adAt, kind); }
    const view = premiumGridViewport();
    this.minScrollY = Math.min(0, view.bottom - view.top - premiumGridContentHeight(visible.length + extra, kind));
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
    const subscribed = product.subscription !== undefined;
    // 이용 중인 구독은 살 수 없지만 소진된 상품이 아니다 — 흐리게 가라앉히지 않고 테두리가 맥동한다.
    const soldOut = !product.purchasable && !subscribed;
    if (kind === "grid") {
      paintShowcaseCard(this, card, { width, height, accent: soldOut ? COLOR.inkDimHex : COLOR.accent, dim: soldOut, railX: -width / 2 + 34 });
    } else {
      paintShowcaseCard(this, card, { width, height, accent: soldOut ? COLOR.inkDimHex : premiumCardTone(product), dim: soldOut, railX: -width / 2 + PREMIUM_WIDE.pad, tag: premiumCardTag(product) });
    }
    this.addCardHit(card, width, height, () => {
      if (product.acquisition.kind === "free") { if (product.purchasable) void this.claimFree(product); else this.notice(t("shop.premium.freeClaimed")); return; }
      if (subscribed) { void this.claimSubscriptionDaily(product); return; }
      // 결제 비활성 상품도 상세 팝업 안에서 지급량·가격·사유를 확인한다.
      new PurchasePopup(this, this.popups, gameApi, session.wallet).open(product, async (result) => { this.applyPurchaseResult(result); this.notice(t("shop.premium.purchased")); await this.refresh(); });
    });
    if (kind === "wide") this.paintWideCard(card, product, width, action); else this.paintGridCard(card, product, width, action);
    if (soldOut) card.setAlpha(PREMIUM_SOLD_OUT_ALPHA);
    if (subscribed) this.addActivePulse(card, width, height);
    this.content?.add(card);
    // 상태 딱지는 흐려진 카드의 알파를 물려받지 않도록 카드 곁에 따로 붙인다.
    const status = premiumStatusOf(product);
    const stickerKey = `${product.id}:${status ?? ""}`;
    if (status && this.content) addStatusSticker(this, this.content, x, y + (kind === "grid" ? -70 : -10), t(`shop.premium.sticker.${status}`), STICKER_TONE[status], stickerKey);
    else forgetStatusStickers(product.id);
  }

  /** 가로 카드의 반높이 — 우상단 배지가 윗변에 붙는 자리. */
  private premiumCardHalfHeight(): number { return premiumCardHeight("wide") / 2; }

  /** 카드 전체를 덮는 입력면. 드래그로 끝난 손과 창 밖의 숨은 칸은 누름으로 치지 않는다. */
  private addCardHit(card: Phaser.GameObjects.Container, width: number, height: number, onTap: () => void): void {
    const hit = addClippedHit(this, card, 0, 0, width, height, premiumGridViewport);
    hit.on("pointerdown", () => pressIn(card));
    hit.on("pointerout", () => pressOut(card, "normal", { pop: false }));
    hit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      pressOut(card);
      if (!this.isTap(pointer)) return;
      onTap();
    });
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
      const hit = addClippedHit(this, frame, 0, 0, size, size, premiumGridViewport);
      hit.on("pointerdown", () => pressIn(frame));
      hit.on("pointerout", () => pressOut(frame, "normal", { pop: false }));
      hit.on("pointerup", (pointer: Phaser.Input.Pointer) => { pressOut(frame); if (this.isTap(pointer)) openGuide(); });
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
      const tagText = tile.daily ? t("shop.premium.daily") : tile.badge ? t(`shop.premium.badge.${tile.badge}`) : undefined;
      if (tagText) {
        // 정기권이 매일 얹는 몫(「매일」)·패스의 즉시 몫(「즉시」)·길의 몫(「패스」) — 액자 위에 걸친 작은 꼬리표가 말한다.
        const label = this.add.text(0, 0, tagText, textStyle({ role: "display", size: 20, color: "#101418" })).setOrigin(0.5);
        const tagWidth = label.width + 22;
        const tag = this.add.container(-W.frame / 2 + tagWidth / 2 - 4, -W.frame / 2 - 2);
        tag.add(drawLayer(this, 0, 0, slantedRect(tagWidth, 32, 10), { fill: COLOR.accent, alpha: 1, shadow: false }));
        tag.add(label);
        frame.add(tag);
      }
    });
    // 즉시 보상과 패스 보상 사이의 「+」.
    const split = tiles.findIndex((tile) => tile.badge === "pass");
    if (split > 0) card.add(this.add.text((xs[split - 1] + xs[split]) / 2, S.frameY, "+", textStyle({ role: "display", size: 44, color: COLOR.accentText })).setOrigin(0.5).setStroke("#000000", 6));
    this.paintPriceChip(card, product, 0, S.price.y, S.price.width, S.price.height, S.price.size, action);
    addPremiumValueBadges(this, card, product, right, -this.premiumCardHalfHeight() + 16);
    // 값 줄 양 끝 — 왼쪽은 정기권의 기간·권리, 오른쪽은 남은 구매. 값보다 작고 흐리다.
    const sideWidth = S.price.width / 2 + W.priceGap;
    const foot = this.passFootnote(product);
    if (product.premiumCategory === "limited" && product.visibleUntil) {
      // 한정 상품의 남은 시간은 붉게 — 놓치면 사라진다.
      const clock = this.add.text(left, S.price.y, this.limitedText(product.visibleUntil), textStyle({ role: "emphasis", size: W.noteSize + 2, color: COLOR.dangerText, wrap: -sideWidth - left })).setOrigin(0, 0.5).setStroke("#05070a", 3);
      card.add(clock);
      this.limitedClocks.push({ text: clock, until: product.visibleUntil });
    } else if (foot) card.add(this.add.text(left, S.price.y, foot, textStyle({ role: "body", size: W.noteSize, color: COLOR.inkDim, wrap: -sideWidth - left })).setOrigin(0, 0.5));
    const subscribed = product.subscription !== undefined;
    const remainingText = subscribed ? t(product.subscription?.dailyBonusClaimed ? "shop.premium.dailyClaimed" : "shop.premium.claimDaily")
      : product.acquisition.kind === "free" && !product.purchasable ? t("shop.premium.freeClaimed")
      : action.disabledReason ?? t("shop.premium.remaining", { remaining: product.remaining, limit: product.purchaseLimit });
    const remaining = this.add.text(right, S.price.y, remainingText, textStyle({ role: "emphasis", size: W.noteSize + 4, color: subscribed ? COLOR.accentText : product.purchasable ? COLOR.ink : COLOR.dangerText, align: "right", wrap: right - sideWidth })).setOrigin(1, 0.5);
    card.add(remaining.setStroke("#05070a", 3));
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
    card.add(this.add.text(0, C.remainingY, action.disabledReason ?? t("shop.premium.remaining", { remaining: product.remaining, limit: product.purchaseLimit }), textStyle({ role: "emphasis", size: 25, color: product.purchasable ? COLOR.ink : COLOR.dangerText })).setOrigin(0.5).setStroke("#05070a", 3));
  }

  /** 값 칸. 재화로 값을 치르는 상품은 값줄, 결제 상품은 카탈로그의 값 문자열을 두껍게 세운다. */
  private paintPriceChip(card: Phaser.GameObjects.Container, product: ProductDto, x: number, y: number, width: number, height: number, size: number, action: ReturnType<typeof productActionModel>): void {
    if (product.acquisition.kind === "currency") {
      addPriceBar(this, card, x, y, width, undefined, product.acquisition.currency, product.acquisition.amount, { height, short: session.wallet[product.acquisition.currency] < product.acquisition.amount });
      return;
    }
    const bar = this.add.container(x, y);
    bar.add(drawLayer(this, 0, 0, chipPoints(width, height, { bevel: { topLeft: 20, topRight: 0, bottomRight: 20, bottomLeft: 0 } }), { fill: 0x0d141c, alpha: 0.96, edge: COLOR.accent, edgeAlpha: 0.7 }));
    const acquisition = product.acquisition;
    const listed = acquisition.kind === "platform_payment" && acquisition.listPriceKrw !== undefined && acquisition.listPriceKrw > acquisition.basePriceKrw ? acquisition.listPriceKrw : undefined;
    const price = this.add.text(listed === undefined ? 0 : width * 0.17, 0, action.priceText, textStyle({ role: "display", size, color: COLOR.accentText })).setOrigin(0.5).setStroke("#000000", 6).setShadow(2, 4, "#04060a", 0, true, true);
    bar.add(squeezeTextToWidth(price, (listed === undefined ? width : width * 0.58) - 36, 0.6));
    // 할인이 걸린 상품은 정가를 긋고 값 왼쪽에 작게 세운다.
    if (listed !== undefined) addListPrice(this, bar, -width * 0.25, 0, formatStorePrice(listed), Math.round(size * 0.55));
    card.add(bar);
  }

  /** 정기권 카드 값 줄 왼쪽의 한 줄 — 유효 기간 · 권리. 정기권이 아니면 비어 있다. */
  private passFootnote(product: ProductDto): string {
    const parts: string[] = [];
    const pass = product.passBenefit;
    if (pass) {
      // 갱신 주기를 먼저 말한다. 이용 중이면 다음 갱신일이, 아니면 권리 한 줄이 그 뒤에 선다.
      parts.push(pass.durationDays === null ? t("shop.premium.forever") : t("shop.premium.renewal", { days: pass.durationDays }));
      const until = product.subscription?.expiresAt;
      if (until) parts.push(t("shop.premium.renewsOn", { date: new Date(until).toLocaleDateString() }));
      else parts.push(pass.adFree ? t("shop.premium.perk.adFree") : t("shop.premium.perk.instantAds"));
    }
    return parts.join("  ·  ");
  }

  /** 한정 상품의 남은 시간 한 줄. 서버 시각을 기준으로 센다. */
  private limitedText(until: string): string {
    return t("shop.premium.limitedLeft", { time: remainingDetail(until, new Date(Date.now() + this.serverOffsetMs)) });
  }

  /** 이용 중인 구독의 활성 표시 — 카드 모양을 따라 도는 테두리가 숨 쉰다. 움직임 줄이기에서는 가만히 선다. */
  private addActivePulse(card: Phaser.GameObjects.Container, width: number, height: number): void {
    const outline = drawShapeOutline(this, 0, 0, showcaseCardShape(width, height, 3), { color: COLOR.accent, alpha: 1, width: 5 });
    card.add(outline);
    if (motionPolicy(session.settings).nonEssentialDistanceFactor === 0) { outline.setAlpha(0.85); return; }
    outline.setAlpha(0.35);
    this.tweens.add({ targets: outline, alpha: 1, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  /** 무료 보급을 주기마다 한 번 받는다. 값이 없어 확인판 없이 곧바로 서버 경계를 지난다. */
  private async claimFree(product: ProductDto): Promise<void> {
    if (this.claiming) return;
    this.claiming = true;
    try {
      const result = await gameApi.purchaseProduct({ storefront: "premium", productId: product.id, quantity: 1 });
      this.applyPurchaseResult(result);
      openRewardPopup(this, this.popups, { items: productGrantsToRewardItems(result.granted) });
      await this.refresh();
    } catch { this.notice(t("shop.premium.adFailed")); } finally { this.claiming = false; }
  }

  /** 이용 중인 구독의 오늘 몫을 받는다. 하루에 한 번이다. */
  private async claimSubscriptionDaily(product: ProductDto): Promise<void> {
    if (this.claiming) return;
    if (product.subscription?.dailyBonusClaimed) { this.notice(t("shop.premium.dailyClaimed")); return; }
    this.claiming = true;
    try {
      const result = await gameApi.claimPassDailyBonus({ productId: product.id, requestId: globalThis.crypto?.randomUUID?.() ?? `daily-${Date.now()}` });
      this.applyPurchaseResult(result);
      openRewardPopup(this, this.popups, { items: productGrantsToRewardItems(result.granted) });
      await this.refresh();
    } catch { this.notice(t("shop.premium.adFailed")); } finally { this.claiming = false; }
  }

  /** 젬 탭 끝의 「광고 보고 젬 받기」 칸. */
  private addGemAdCard(index: number, kind: PremiumListKind): void {
    const slotId = "gem-ad";
    const slot = findAdRewardSlot(slotId);
    if (!slot || slot.reward.kind !== "currency") return;
    const status = adSlotStatus(slotId);
    const { x, y } = premiumCardSpot(index, kind);
    addAdRewardCard(this, this.content!, {
      x, y, width: premiumCardWidth(kind), height: premiumCardHeight(kind), currency: "gems", amount: slot.reward.amount,
      title: t("shop.premium.adTitle"), badge: t("shop.premium.adDeal"), remaining: status.remaining, limit: status.limit,
      clip: premiumGridViewport, isTap: (pointer) => this.isTap(pointer),
      onWatch: () => void this.watchGemAd(),
    });
  }

  private async watchGemAd(): Promise<void> {
    if (this.claiming) return;
    this.claiming = true;
    try {
      if (!(await watchAdSlot("gem-ad"))) { this.notice(t("stamina.adCancelled")); return; }
      this.topBar?.refresh();
      await this.refresh();
    } catch { this.notice(t("shop.premium.adFailed")); } finally { this.claiming = false; }
  }

  /**
   * 일간 탭의 「일일 보급 추가」 — 무료 보급을 받은 뒤 광고를 보고 같은 묶음을 하루 두 번 더 받는다.
   * 받는 것은 서버 슬롯(`daily-bonus-ad`)에서 읽어 액자로 세우고, 무료 보급 전에는 버튼이 잠겨 있다.
   */
  private addDailyAdCard(index: number, kind: PremiumListKind): void {
    const slot = findAdRewardSlot("daily-bonus-ad");
    if (!slot || slot.reward.kind !== "currencies") return;
    const W = PREMIUM_WIDE;
    const S = W.stack;
    const width = premiumCardWidth(kind);
    const height = premiumCardHeight(kind);
    const { x, y } = premiumCardSpot(index, kind);
    const status = adSlotStatus(slot.id);
    const freeClaimed = this.products.some((product) => product.id === DAILY_FREE_PRODUCT_ID && !product.purchasable);
    const done = status.remaining <= 0;
    const open = freeClaimed && !done;
    const card = this.add.container(x, y);
    paintShowcaseCard(this, card, { width, height, accent: SHOWCASE_TIER_TONE.daily, dim: false, railX: -width / 2 + W.pad, tag: t("shop.premium.dailyAdTag") });
    const left = -width / 2 + W.pad;
    const right = width / 2 - W.pad;
    const name = this.add.text(left, S.nameY, t("shop.premium.dailyAdTitle"), textStyle({ role: "display", size: W.nameSize })).setOrigin(0, 0.5).setShadow(3, 4, "#04060a", 0, true, true);
    card.add(squeezeTextToWidth(name, right - left, 0.7));
    const tiles = premiumGrantTiles({
      grants: [
        ...slot.reward.grants.flatMap((grant) => grant.currency === "stamina" ? [] : [{ kind: "currency" as const, currency: grant.currency, amount: grant.amount }]),
        ...(slot.reward.items ?? []).map((item) => ({ kind: "item" as const, itemId: item.itemId, name: item.itemId, amount: item.quantity })),
      ],
    }).slice(0, W.frameCap);
    const xs = premiumWideFrameXs(tiles.length);
    tiles.forEach((tile, i) => this.addGrantFrame(card, xs[i], S.frameY, W.frame, tile.icon, tile.amount));
    const bar = this.add.container(0, S.price.y);
    bar.add(drawLayer(this, 0, 0, chipPoints(S.price.width + 120, S.price.height, { bevel: { topLeft: 20, topRight: 0, bottomRight: 20, bottomLeft: 0 } }), { fill: 0x0d141c, alpha: 0.96, edge: COLOR.accent, edgeAlpha: 0.7 }));
    const label = this.add.text(0, 0, t(freeClaimed ? "shop.premium.dailyAdWatch" : "shop.premium.dailyAdLocked"), textStyle({ role: "display", size: 34, color: open ? COLOR.accentText : COLOR.inkDim })).setOrigin(0.5).setStroke("#000000", 6);
    bar.add(squeezeTextToWidth(label, S.price.width + 120 - 40, 0.6));
    card.add(bar);
    card.add(this.add.text(right, S.price.y, t("shop.premium.adLeft", { remaining: status.remaining, limit: status.limit }), textStyle({ role: "emphasis", size: W.noteSize + 4, color: done ? COLOR.dangerText : COLOR.ink, align: "right" })).setOrigin(1, 0.5).setStroke("#05070a", 3));
    if (!open) card.setAlpha(PREMIUM_SOLD_OUT_ALPHA + 0.2);
    this.addCardHit(card, width, height, () => {
      if (!freeClaimed) { this.notice(t("shop.premium.dailyAdLocked")); return; }
      if (done) { this.notice(t("shop.premium.dailyClaimed")); return; }
      void this.watchDailyAd();
    });
    this.content?.add(card);
  }

  private async watchDailyAd(): Promise<void> {
    if (this.claiming) return;
    this.claiming = true;
    try {
      if (!(await watchAdSlot("daily-bonus-ad"))) { this.notice(t("stamina.adCancelled")); return; }
      this.topBar?.refresh();
      await this.refresh();
    } catch { this.notice(t("shop.premium.adFailed")); } finally { this.claiming = false; }
  }

  /**
   * 하단 목록 교체 줄은 상점·가방과 같은 서류철 라벨 프리팹이다. 여덟을 한 줄에 깔면 칸이 좁아지므로
   * 라벨을 넓게 세운 줄을 옆으로 흘리고, 고른 라벨은 창 가운데로 모인다.
   */
  private createTabs(animateFrom?: number): void {
    this.tabRow?.destroy();
    const row = this.add.container(0, 0).setDepth(9);
    this.tabRow = row;
    if (!this.tabMask) {
      const strip = premiumTabStrip();
      this.tabMask = this.make.graphics();
      this.tabMask.fillStyle(0xffffff, 1).fillRect(strip.left, strip.top, strip.right - strip.left, strip.bottom - strip.top);
    }
    row.setMask(this.tabMask.createGeometryMask());
    PREMIUM_TABS.forEach((tab, index) => {
      const { x, y } = premiumTabSpot(index);
      addCategoryTab(this, row, {
        x, y, width: PREMIUM_TAB_ROW.width, height: PREMIUM_TAB_ROW.height,
        label: tab.label, selected: tab.id === this.selectedCategory,
        onSelect: () => this.selectCategory(tab.id),
      });
    });
    const target = premiumTabScrollFor(this.selectedIndex(), PREMIUM_TABS.length);
    if (animateFrom === undefined || animateFrom === target) { row.x = target; return; }
    row.x = animateFrom;
    this.tweens.add({ targets: row, x: target, duration: 220, ease: "Cubic.easeOut" });
  }

  private selectedIndex(): number { return PREMIUM_TABS.findIndex((tab) => tab.id === this.selectedCategory); }

  /** 라벨을 바꾸면 이전 스크롤을 버리고 그 갈래의 첫 상품부터 다시 보여 준다. */
  private selectCategory(category: PremiumCategory): void {
    if (category === this.selectedCategory) return;
    const indexOf = (id: PremiumCategory): number => PREMIUM_TABS.findIndex((tab) => tab.id === id);
    const from = indexOf(this.selectedCategory);
    const rowFrom = this.tabRow?.x;
    this.selectedCategory = category;
    if (this.content) this.content.y = 0;
    this.createTabs(rowFrom);
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
    this.pointerAxis = "none";
    this.pointerStartX = pointer.x;
    this.swipeX = 0;
    this.pointerY = pointer.y;
    this.draggedDistance = 0;
    this.velocityY = 0;
  };

  private readonly onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (!this.pointerDown || !pointer.isDown) return;
    const delta = pointer.y - this.pointerY;
    this.pointerY = pointer.y;
    const dx = pointer.x - this.pointerStartX;
    if (this.pointerAxis === "none") {
      const total = this.draggedDistance + Math.abs(delta);
      if (Math.abs(dx) > PREMIUM_SWIPE.lock && Math.abs(dx) > total) this.pointerAxis = "x";
      else if (total > PREMIUM_SWIPE.lock) this.pointerAxis = "y";
    }
    if (this.pointerAxis === "x") {
      this.swipeX = dx;
      this.draggedDistance += Math.abs(delta) + 1;
      return;
    }
    this.draggedDistance += Math.abs(delta);
    this.velocityY = delta * 60;
    this.scrollTo((this.content?.y ?? 0) + delta);
  };

  /** 가로로 충분히 쓸었으면 이웃 라벨로 넘긴다 — 왼쪽으로 쓸면 다음 갈래다. */
  private readonly onPointerUp = (): void => {
    const swiped = this.pointerDown && this.pointerAxis === "x" && Math.abs(this.swipeX) >= PREMIUM_SWIPE.distance;
    this.pointerDown = false;
    if (!swiped) return;
    const index = this.selectedIndex();
    const next = premiumTabStep(index, PREMIUM_TABS.length, this.swipeX < 0 ? 1 : -1);
    if (next !== index) this.selectCategory(PREMIUM_TABS[next].id);
  };

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

/** 「일일 무료 보급」 — 추가 광고 칸이 바로 아래에 붙는 무료 수령 상품. */
const DAILY_FREE_PRODUCT_ID = "premium-free-daily";

/** 상태 딱지의 색 — 끝난 것은 붉게, 이용 중·받은 것은 강조색으로. */
const STICKER_TONE: Record<PremiumStatus, { text: string; line: number }> = {
  purchased: { text: COLOR.accentText, line: COLOR.accent },
  claimed: { text: COLOR.accentText, line: COLOR.accent },
  subscribed: { text: COLOR.accentText, line: COLOR.accent },
  soldOut: { text: COLOR.dangerText, line: 0xe07a7a },
};

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
