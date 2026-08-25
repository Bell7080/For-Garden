import Phaser from "phaser";
import { gameApi } from "../api/FakeServer";
import type { ProductDto } from "../api/contracts";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { BottomNav, NAV_TOP } from "../ui/BottomNav";
import { chipPoints, drawLayer, drawVignette, HOLO } from "../ui/holo";
import { COLOR, textStyle } from "../ui/theme";
import { TopBar } from "../ui/TopBar";

/** 로비 무역과 연구소 BM 전시가 공유하는 진입 데이터다. */
export interface ShopSceneData { section?: "trade" | "premium"; }

/** 정적 카탈로그를 보여 주는 공용 상점. 유료 탭은 영수증 검증 전까지 읽기 전용이다. */
export class ShopScene extends Phaser.Scene {
  private section: "trade" | "premium" = "trade";
  private content?: Phaser.GameObjects.Container;
  private pending = false;

  constructor() { super("shop"); }

  init(data: ShopSceneData): void { this.section = data.section ?? "trade"; }

  create(): void {
    setDebugScene("shop");
    // 유료 상점은 흰 쇼케이스, 인게임 교환소는 연구소 설비 앞이다. 두 탭은 같은 화면이지만
    // 파는 것이 다르므로 서 있는 자리도 다르다.
    addSceneBackground(this, this.section === "premium" ? BACKGROUND.premiumShop : BACKGROUND.lab);
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { depth: -20, strength: 0.72 });
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.5).setDepth(-19);
    new TopBar(this);
    this.add.text(60, 185, this.section === "trade" ? "무  역" : "상  점", textStyle({ role: "display", size: 52 })).setOrigin(0, 0);
    // 제목과 탭이 화면의 용도를 이미 말하므로 구현 의도를 풀이하는 부제는 플레이어에게 노출하지 않는다.
    // 별도 화면을 복제하지 않고 확대·강조색만으로 현재 카탈로그 탭을 구분한다.
    ([{ section: "trade", label: "교환" }, { section: "premium", label: "후원" }] as const).forEach(({ section, label }, index) => {
      const selected = this.section === section;
      const tab = this.add.text(780 + index * 120, 225, label, textStyle({ role: "emphasis", size: 27, color: selected ? COLOR.accentText : COLOR.inkDim })).setOrigin(0.5).setScale(selected ? 1.12 : 1).setInteractive({ useHandCursor: true });
      tab.on("pointerdown", () => tab.setScale(1.16));
      tab.on("pointerout", () => tab.setScale(selected ? 1.12 : 1));
      tab.on("pointerup", () => { if (!selected) this.scene.restart({ section }); });
    });
    // 상점은 더 이상 연구소의 보조 버튼이 아니므로 모든 핵심 화면과 같은 하단 슬롯을 유지한다.
    new BottomNav(this, "shop");
    void this.refresh();
  }

  /** 서버가 계산한 노출/제한 상태만 받아 카드 목록을 다시 그린다. */
  private async refresh(): Promise<void> {
    const response = await gameApi.getProducts();
    this.content?.destroy(true);
    this.content = this.add.container(0, 0);
    response.products.filter((product) => product.section === this.section).forEach((product, index) => this.addProduct(product, index));
  }

  /** 플랫 반투명 면, 윗변 강조선, 확대 선택 상태를 기존 홀로그램 규칙 그대로 쓴다. */
  private addProduct(product: ProductDto, index: number): void {
    // 마지막 카드도 하단 내비게이션의 터치 영역을 침범하지 않도록 콘텐츠 영역 안에 배치한다.
    const x = BASE_WIDTH / 2; const y = Math.min(420 + index * 360, NAV_TOP - 190); const width = 900; const height = 290;
    const card = this.add.container(x, y);
    card.add(drawLayer(this, 0, 0, chipPoints(width, height, { bevel: { topLeft: 55, topRight: 0, bottomRight: 38, bottomLeft: 0 } }), { fill: 0x161d25, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.62 }));
    card.add(this.add.text(-390, -92, product.name, textStyle({ role: "display", size: 36 })).setOrigin(0, 0));
    // 권리 상품은 구매 전에 즉시 수령 방식·유효 기간·기존 광고와 같은 UTC 일일 제한을 별도 줄로 확인시킨다.
    const benefitNotice = product.passBenefit
      ? `광고 보상 즉시 수령  ·  ${product.passBenefit.durationDays === null ? "영구" : `유효 기간 ${product.passBenefit.durationDays}일`}\n광고 이용자와 동일한 기본 보상 · 슬롯별 UTC 일일 한도`
      : product.description;
    card.add(this.add.text(-390, -35, benefitNotice, textStyle({ role: "body", size: 24, color: COLOR.inkDim, wrap: 590, lineSpacing: 8 })).setOrigin(0, 0));
    const price = product.price.display ?? `${product.price.amount.toLocaleString()} ${this.currencyLabel(product.price.currency)}`;
    card.add(this.add.text(360, -28, price, textStyle({ role: "emphasis", size: 30, color: COLOR.accentText })).setOrigin(1, 0.5));
    card.add(this.add.text(360, 52, product.price.currency === "real_money" ? "결제 비활성" : `남은 구매 ${product.remaining}/${product.purchaseLimit}`, textStyle({ role: "body", size: 22, color: product.purchasable ? COLOR.ink : COLOR.inkDim })).setOrigin(1, 0));
    const hit = this.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: product.purchasable });
    hit.on("pointerdown", () => card.setScale(product.purchasable ? 1.06 : 1.02));
    hit.on("pointerout", () => card.setScale(1));
    hit.on("pointerup", () => { card.setScale(1); if (product.purchasable) void this.purchase(product.id); else this.notice(product.disabledReason ?? "구매할 수 없습니다."); });
    card.add(hit); this.content?.add(card);
  }

  /** 연속 입력을 막고 성공한 서버 응답 뒤에만 로컬 TopBar와 카탈로그를 갱신한다. */
  private async purchase(productId: string): Promise<void> {
    if (this.pending) return; this.pending = true;
    try { await gameApi.purchaseProduct(productId); this.notice("교환이 완료되었습니다."); await this.refresh(); }
    catch (error) { this.notice(error instanceof Error ? error.message : "교환에 실패했습니다."); }
    finally { this.pending = false; }
  }

  /** 짧은 결과 안내도 별도 HTML을 만들지 않고 Phaser 텍스트로 표시한다. */
  private notice(message: string): void {
    const toast = this.add.text(BASE_WIDTH / 2, 1540, message, textStyle({ role: "emphasis", size: 28, color: COLOR.accentText })).setOrigin(0.5).setDepth(500);
    this.tweens.add({ targets: toast, alpha: 0, delay: 900, duration: 500, onComplete: () => toast.destroy() });
  }

  /** 내부 재화 키를 플레이어가 읽는 짧은 한국어 단위로 바꾼다. */
  private currencyLabel(currency: ProductDto["price"]["currency"]): string {
    return ({ fossil: "화석", amber: "호박석", cheesecake: "치즈케이크", dnaFragments: "DNA", real_money: "현금" } as const)[currency];
  }
}
