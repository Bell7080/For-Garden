import Phaser from "phaser";
import { gameApi } from "../api/FakeServer";
import type { ProductDto } from "../api/contracts";
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

/** 상품 목록이 제목 아래에서 뒤로가기 안전 영역 위까지 흐르는 화면 좌표 경계다. */
const LIST_VIEW = { left: 470, right: BASE_WIDTH - 36, top: 330, bottom: BASE_HEIGHT - 190 } as const;
/** 세로 카드 간격과 드래그 판정을 한곳에 묶어 스크롤 감각을 일정하게 유지한다. */
const LIST_LAYOUT = { cardHeight: 270, gap: 28, dragSlop: 16 } as const;

/** 인게임 재화만 교환하는 독립 무역소 씬이다. */
export class ShopScene extends Phaser.Scene {
  private products: ProductDto[] = [];
  private content?: Phaser.GameObjects.Container;
  private viewportMask?: Phaser.GameObjects.Graphics;
  private pending = false;
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
    this.products.forEach((product, index) => this.addProduct(product, index));
    const contentHeight = this.products.length * (LIST_LAYOUT.cardHeight + LIST_LAYOUT.gap) - LIST_LAYOUT.gap;
    this.minScrollY = Math.min(0, LIST_VIEW.bottom - LIST_VIEW.top - contentHeight);
    this.scrollTo(this.content?.y ?? 0);
  }

  /** 공용 액자와 유리 칩을 조합해 비용·보상·잔여 횟수를 한 카드 안에서 비교하게 한다. */
  private addProduct(product: ProductDto, index: number): void {
    const width = LIST_VIEW.right - LIST_VIEW.left;
    const x = (LIST_VIEW.left + LIST_VIEW.right) / 2;
    const y = LIST_VIEW.top + LIST_LAYOUT.cardHeight / 2 + index * (LIST_LAYOUT.cardHeight + LIST_LAYOUT.gap);
    const card = this.add.container(x, y);
    card.add(drawLayer(this, 0, 0, chipPoints(width, LIST_LAYOUT.cardHeight, { bevel: { topLeft: 44, topRight: 0, bottomRight: 32, bottomLeft: 0 } }), { fill: 0x182029, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.52 }));
    const frame = addItemFrame(this, -width / 2 + 82, 0, 124);
    // 현재 상품 표는 재화 보상만 사용하므로 첫 보상 아이콘을 대표 이미지로 보여 준다.
    const currencyGrant = product.grants.find((grant) => grant.kind === "currency");
    if (currencyGrant) {
      const iconKey = CURRENCY_ICON_BY_WALLET[currencyGrant.currency];
      frame.add(this.add.image(0, 0, iconKey).setDisplaySize(124 * ITEM_FRAME.icon, 124 * ITEM_FRAME.icon));
    }
    card.add(frame);
    card.add(this.add.text(-width / 2 + 168, -88, product.name, textStyle({ role: "emphasis", size: 29 })).setOrigin(0, 0));
    card.add(this.add.text(-width / 2 + 168, -40, product.description, textStyle({ role: "body", size: 22, color: COLOR.inkDim, wrap: width - 210 })).setOrigin(0, 0));
    const price = `${product.price.amount.toLocaleString()} ${this.currencyLabel(product.price.currency)}`;
    card.add(this.add.text(width / 2 - 28, 58, price, textStyle({ role: "emphasis", size: 27, color: COLOR.accentText })).setOrigin(1, 0));
    card.add(this.add.text(-width / 2 + 168, 72, `남은 교환 ${product.remaining}/${product.purchaseLimit}`, textStyle({ role: "body", size: 20, color: product.purchasable ? COLOR.ink : COLOR.inkDim })).setOrigin(0, 0));
    const hit = this.add.rectangle(0, 0, width, LIST_LAYOUT.cardHeight, 0xffffff, 0).setInteractive({ useHandCursor: product.purchasable });
    hit.on("pointerdown", () => card.setScale(1.04));
    hit.on("pointerout", () => card.setScale(1));
    hit.on("pointerup", () => {
      card.setScale(1);
      // 스크롤 드래그가 끝난 손을 구매 탭으로 오인하지 않는다.
      if (this.draggedDistance <= LIST_LAYOUT.dragSlop) {
        if (product.purchasable) void this.purchase(product.id);
        else this.notice(product.disabledReason ?? "교환할 수 없습니다.");
      }
    });
    card.add(hit);
    this.content?.add(card);
  }

  /** 입력을 서버에 한 번만 전달하고 성공한 응답 뒤에 지갑과 목록을 함께 새로 읽는다. */
  private async purchase(productId: string): Promise<void> {
    if (this.pending) return;
    this.pending = true;
    try { await gameApi.purchaseProduct(productId); this.notice("교환이 완료되었습니다."); await this.refresh(); }
    catch (error) { this.notice(error instanceof Error ? error.message : "교환에 실패했습니다."); }
    finally { this.pending = false; }
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

  /** 서버 재화 키를 카드의 짧은 한국어 비용 단위로 바꾼다. */
  private currencyLabel(currency: ProductDto["price"]["currency"]): string {
    return ({ fossil: "화석", amber: "호박석", cheesecake: "치즈케이크", dnaFragments: "DNA", real_money: "현금" } as const)[currency];
  }
}
