import Phaser from "phaser";
import { t } from "../i18n";
import type { GameApi, ProductDto, PurchaseProductResponse } from "../api/contracts";
import type { Wallet } from "../core/gacha";
import { TRADE_PACKAGES } from "../data/tradePackages";
import { Button } from "./Button";
import { PopupLayer } from "./PopupLayer";
import { PurchasePopup } from "./PurchasePopup";
import { COLOR, textStyle } from "./theme";
import { setDebugStorefrontControls } from "../debug";
import { BACK_SLOT } from "./IconButton";
import { tradePopupFailureModel, TradePopupRequestGate, tradePackageViews, tradePopupModel } from "./tradePopupModel";
import { tradePackageCenters, tradePackageLayout } from "./tradePackageLayout";
import { TradePackageCard } from "./TradePackageCard";

/** 팝업 본문 원점은 화면 중앙이므로 E2E에 넘길 입력 중심만 이 기준으로 절대 좌표로 옮긴다. */
const BASE_CENTER = { x: 540, y: 960 } as const;

/**
 * 무역 — **운영 패키지를 전시해 두는 레이어.**
 *
 * 재화 교환소가 아니다. 한 칸이 묶음 하나이고 칸 자체가 눌리며, 값·받는 것·가치·제한이 그 칸
 * 안에서 함께 읽힌다. 창 크기는 손으로 적지 않고 전시할 카드 수에서 나온다
 * (`tradePackageLayout`) — 예전에는 1420이라 적어 두고 줄을 190씩 내려놓아, 상품이 늘자
 * 마지막 줄이 팝업 판 밖으로 나갔다.
 */
export class TradePopup {
  private closeAction?: () => void;
  private body?: Phaser.GameObjects.Container;
  /** 서버 응답마다 갈아 끼우는 상품 행만 소유해, 팝업 제목 같은 chrome의 수명과 분리한다. */
  private productList?: Phaser.GameObjects.Container;
  private products: ProductDto[] = [];
  private generation = 0;
  /** 재시도 버튼 연타가 동일 카탈로그 요청을 겹치지 않게 한다. */
  private readonly requestGate = new TradePopupRequestGate();
  /**
   * 창 규격. 전시할 수 있는 최대 품목 수(정적 카탈로그)로 한 번 정한다 — 팝업은 열린 뒤 크기를
   * 바꿀 수 없고, 조회는 창을 띄운 다음에 끝나기 때문이다.
   */
  private readonly shell = tradePackageLayout(TRADE_PACKAGES.length);

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly api: GameApi, private readonly wallet: Wallet, private readonly onPurchased: (result: PurchaseProductResponse) => void, private readonly onClosed?: () => void) {}

  /** 연타는 기존 레이어를 유지하며 서버 trade 카탈로그만 조회한다. */
  open(): void {
    if (this.closeAction) return;
    this.popups.open({ width: this.shell.width, height: this.shell.height, title: t("trade.title"), dim: true, closeOnBackdrop: false, hideCloseButton: true, onClose: () => this.dispose() }, (body, close) => {
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
    const generation = this.generation + 1;
    if (!this.requestGate.begin(generation)) return;
    // 잠금을 얻은 요청만 현재 세대로 승격해 무시된 연타가 진행 중 응답을 낡게 만들지 않게 한다.
    this.generation = generation;
    try {
      // API await는 팝업 종료·새 세대 시작과 경합하므로 응답을 적용하기 전에 수명을 다시 확인한다.
      const response = await this.api.getProducts("trade");
      // 닫힌 뒤 또는 다른 세대에 도착한 성공 응답은 파괴된 Phaser 자식층을 만지지 않고 폐기한다.
      if (!this.isCurrent(generation)) return;
      this.products = tradePopupModel(response.products);
      this.render();
    } catch {
      // 거절도 늦게 도착할 수 있으므로 현재 열린 세대일 때만 동적 영역을 실패 조작으로 교체한다.
      if (!this.isCurrent(generation)) return;
      this.renderFailure();
    } finally {
      // 이 요청이 소유한 잠금만 풀어 늦은 finally가 이후 재시도의 중복 방지를 해제하지 않게 한다.
      this.requestGate.finish(generation);
    }
  }

  /** 비동기 결과가 아직 같은 열린 팝업의 살아 있는 동적 영역을 가리키는지 판정한다. */
  private isCurrent(generation: number): boolean {
    return generation === this.generation && Boolean(this.closeAction && this.body?.active && this.productList?.active);
  }

  /** 상품을 비운 자리에 짧은 세계관 상태와 가능한 재시도만 놓고 외곽·뒤로가기는 유지한다. */
  private renderFailure(): void {
    if (!this.productList?.active) return;
    // 서버 응답으로 만든 상품 행만 제거하므로 PopupLayer가 소유한 판과 제목은 그대로 남는다.
    this.productList.removeAll(true);
    this.products = [];
    const failure = tradePopupFailureModel();
    this.productList.add(this.scene.add.text(0, -70, failure.status, textStyle({ role: "emphasis", size: 30, color: COLOR.inkDim })).setOrigin(0.5));
    const retry = new Button(this.scene, 0, 55, { width: 300, height: 82, label: failure.retryLabel, onClick: () => { void this.refresh(); } });
    this.productList.add(retry);
    // E2E에는 실제로 남은 재시도와 공용 닫기 입력 중심만 공개한다.
    setDebugStorefrontControls({ trade: { products: [], retry: { x: BASE_CENTER.x, y: BASE_CENTER.y + 55 }, back: { ...BACK_SLOT } } });
  }

  /** 전시된 카드를 다시 그린다. 카드 한 장이 곧 하나의 입력면이고 따로 버튼을 세우지 않는다. */
  private render(): void {
    if (!this.productList?.active) return;
    // 동적 카드만 비워 팝업 chrome(판·제목)의 수명은 PopupLayer가 끝까지 소유하게 한다.
    this.productList.removeAll(true);
    const views = tradePackageViews(this.products);
    // 서버가 전시 품목을 덜 돌려주면 남은 자리에서 가운데로 모은다. 창 높이는 열 때 이미 정해졌다.
    const centers = tradePackageCenters(views.length, this.shell.height);
    // 카드 입력 중심과 로비 위 돌아가기만 노출해 E2E가 상품 데이터를 디버그 상태로 읽지 않게 한다.
    setDebugStorefrontControls({
      trade: { products: centers.map((y) => ({ x: BASE_CENTER.x, y: BASE_CENTER.y + y })), back: { ...BACK_SLOT } },
    });
    views.forEach((view, index) => {
      const product = this.products.find(({ id }) => id === view.id);
      this.productList?.add(new TradePackageCard(this.scene, 0, centers[index], {
        metrics: this.shell.card,
        view,
        onClick: () => { if (product) this.openPurchase(product); },
      }));
    });
  }

  /** 패키지 구매도 공용 구매 확인판 한 장이 맡는다 — 무역만의 확정 경계를 따로 만들지 않는다. */
  private openPurchase(product: ProductDto): void {
    if (product.acquisition.kind !== "currency") return;
    new PurchasePopup(this.scene, this.popups, this.api, this.wallet).open(product, async (result) => {
      // 생성자에서 받은 지갑 객체도 갱신해 같은 레이어의 다음 quote가 오래된 잔액을 쓰지 않는다.
      Object.assign(this.wallet, result.wallet); this.onPurchased(result); await this.refresh();
    });
  }

  /** 외부 입력면과 늦은 요청을 함께 무효화한다. */
  private dispose(): void { this.generation += 1; this.requestGate.reset(); this.closeAction = undefined; this.body = undefined; this.productList = undefined; this.onClosed?.(); }
}
