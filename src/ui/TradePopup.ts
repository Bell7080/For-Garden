import Phaser from "phaser";
import { t } from "../i18n";
import type { GameApi, ProductDto, PurchaseProductResponse } from "../api/contracts";
import type { Wallet } from "../core/gacha";
import { TRADE_PACKAGES } from "../data/tradePackages";
import { Button } from "./Button";
import { POPUP_TITLE_SIZE, PopupLayer } from "./PopupLayer";
import { PurchasePopup } from "./PurchasePopup";
import { COLOR, textStyle } from "./theme";
import { setDebugStorefrontControls } from "../debug";
import { BACK_SLOT } from "./IconButton";
import { tradePopupFailureModel, TradePopupRequestGate, tradePackageViews, tradePopupModel } from "./tradePopupModel";
import { tradePackageLayout, tradePackageScroll } from "./tradePackageLayout";
import { attachDragScroll } from "./dragScroll";
import { addScrollHint } from "./ScrollHint";
import { TradePackageCard } from "./TradePackageCard";
import { withBusy } from "./BusyOverlay";


/** 스크롤 꺾쇠를 창 끝선에서 바깥으로 내미는 거리. 공용 꺾쇠의 안쪽 여백(26)을 넘겨 판의 빈 띠에 앉힌다. */
const TRADE_SCROLL_HINT_OUTSET = 30;

/**
 * 무역 — **운영 패키지를 전시해 두는 레이어.**
 *
 * 재화를 재화로 바꾸는 창구가 아니다. 한 칸이 묶음 하나이고 칸 자체가 눌리며, 값·받는 것·가치·제한이 그 칸
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
  /** 판 원점의 화면 좌표. E2E에 넘길 입력 중심만 이 기준으로 절대 좌표로 옮긴다. */
  private readonly origin = { x: 540, y: this.shell.centerY } as const;
  /** 목록이 흐른 거리(≤ 0)와 그 한계. 서버가 돌려준 장수마다 한계를 다시 구한다. */
  private offset = 0;
  private scrollMin = 0;
  /** 목록이 보이는 창의 입력면(판 국소 좌표). 그 밖에서 끝난 손은 카드를 열지 않는다. */
  private viewHit?: Phaser.GameObjects.Rectangle;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly api: GameApi, private readonly wallet: Wallet, private readonly onPurchased: (result: PurchaseProductResponse) => void, private readonly onClosed?: () => void) {}

  /** 연타는 기존 레이어를 유지하며 서버 trade 카탈로그만 조회한다. */
  open(): void {
    if (this.closeAction) return;
    // 암전은 임무·우편 작업판과 같은 세기다. 옅게 두면 판 둘레로 로비의 붉은 점·홍보 칸이 또렷이 비쳐
    // 판을 뚫고 올라온 것처럼 읽혔다.
    this.popups.open({ width: this.shell.width, height: this.shell.height, y: this.shell.centerY, title: t("trade.title"), titleSize: POPUP_TITLE_SIZE.workboard, dim: true, dimAlpha: 0.72, closeOnBackdrop: true, hideCloseButton: true, onClose: () => this.dispose() }, (body, close) => {
      this.closeAction = close;
      this.body = body;
      // PopupLayer가 만든 판·제목은 그대로 두고, 비동기 상품만 안전하게 다시 그릴 자식층을 한 번 만든다.
      this.productList = this.scene.add.container(0, 0);
      body.add(this.productList);
      this.attachScroll(body, this.productList);
    });
    void this.refresh();
  }

  /** 로비 공용 뒤로가기 버튼이 호출하는 단일 종료점이다. */
  close(): void { this.closeAction?.(); }

  /**
   * 카드 줄을 창 안에서 끌어 흐르게 한다(이벤트 목록과 같은 문법).
   *
   * 마스크는 컨테이너 이동을 물려받지 않으므로 판이 떠오르는 동안에도 매 프레임 월드 자리로 맞추고,
   * 판이 **죽을 때** 함께 푼다 — 닫히는 연출 동안에도 판은 아직 그려진다. 더 내려 볼 것이 있으면 창
   * 아래 끝에 옅은 꺾쇠가 서고, 끝까지 내리면 사라진다.
   */
  private attachScroll(body: Phaser.GameObjects.Container, list: Phaser.GameObjects.Container): void {
    const { view, width } = this.shell;
    const viewHeight = view.bottom - view.top;
    const centerY = (view.top + view.bottom) / 2;
    const shape = this.scene.add.rectangle(0, 0, width, viewHeight, 0xffffff).setVisible(false);
    const mask = shape.createGeometryMask();
    list.setMask(mask);
    const sync = (): void => {
      if (!body.active || !shape.active) return;
      const center = body.getWorldTransformMatrix().transformPoint(0, centerY);
      shape.setPosition(center.x, center.y).setSize(width * body.scaleX, viewHeight * body.scaleY);
    };
    this.scene.events.on(Phaser.Scenes.Events.PRE_RENDER, sync);
    sync();
    body.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.scene.events.off(Phaser.Scenes.Events.PRE_RENDER, sync);
      if (list.active) list.clearMask(false);
      mask.destroy();
      shape.destroy();
    });
    // 끌기 면은 카드 **뒤**에 깐다 — 카드 사이 빈 곳을 누른 손도 판의 것이고, 카드 위의 손은 카드가 먼저 받는다.
    const drag = this.scene.add.rectangle(0, centerY, width, viewHeight, 0xffffff, 0).setVisible(false);
    body.addAt(drag, body.getIndex(list));
    this.viewHit = drag;
    attachDragScroll(this.scene, {
      owner: drag, root: body, bounds: () => drag.getBounds(),
      onDelta: (dy) => this.scrollTo(this.offset + dy),
    });
    // 꺾쇠는 카드 위가 아니라 창이 잘리는 선 바로 바깥(판의 빈 띠)에 선다 — 카드의 액자·값 위에 얹으면
    // 밝은 그림에 묻혀 「더 있다」가 읽히지 않았다. 끝까지 내리면 사라지고, 내린 뒤에는 위쪽 꺾쇠가 선다.
    addScrollHint(this.scene, body, { x: 0, y: centerY, width, height: viewHeight + TRADE_SCROLL_HINT_OUTSET * 2, owner: drag, read: () => ({ offset: this.offset, min: this.scrollMin }) });
  }

  /** 오프셋을 한계 안으로 묶어 목록에 옮긴다. */
  private scrollTo(offset: number): void {
    this.offset = Phaser.Math.Clamp(offset, this.scrollMin, 0);
    if (this.productList?.active) this.productList.y = this.offset;
  }

  /** 판 몸 밖의 손인가. 판은 기울지 않으므로 중심과 크기만으로 가른다. */
  private outsideBody(pointer: Phaser.Input.Pointer): boolean {
    const body = this.body;
    if (!body?.active) return false;
    return Math.abs(pointer.x - body.x) > (this.shell.width / 2) * body.scaleX || Math.abs(pointer.y - body.y) > (this.shell.height / 2) * body.scaleY;
  }

  /** 마스크가 가린 자리(창 밖)에서 끝난 손은 카드를 열지 않는다 — 보이지 않는 카드가 판 밖의 손을 가로채지 않게. */
  private insideView(pointer: Phaser.Input.Pointer): boolean {
    return Boolean(this.viewHit?.active && this.viewHit.getBounds().contains(pointer.x, pointer.y));
  }

  /** 늦은 응답은 세대 번호로 폐기해 닫힌 레이어를 다시 만들지 않는다. */
  private async refresh(): Promise<void> {
    const generation = this.generation + 1;
    if (!this.requestGate.begin(generation)) return;
    // 잠금을 얻은 요청만 현재 세대로 승격해 무시된 연타가 진행 중 응답을 낡게 만들지 않게 한다.
    this.generation = generation;
    try {
      // API await는 팝업 종료·새 세대 시작과 경합하므로 응답을 적용하기 전에 수명을 다시 확인한다.
      const response = await withBusy(this.scene, this.api.getProducts("trade"));
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
    this.scrollMin = 0; this.scrollTo(0);
    const failure = tradePopupFailureModel();
    this.productList.add(this.scene.add.text(0, -70, failure.status, textStyle({ role: "emphasis", size: 30, color: COLOR.inkDim })).setOrigin(0.5));
    const retry = new Button(this.scene, 0, 55, { width: 300, height: 82, label: failure.retryLabel, onClick: () => { void this.refresh(); } });
    this.productList.add(retry);
    // E2E에는 실제로 남은 재시도와 공용 닫기 입력 중심만 공개한다.
    setDebugStorefrontControls({ trade: { products: [], retry: { x: this.origin.x, y: this.origin.y + 55 }, back: { ...BACK_SLOT } } });
  }

  /** 전시된 카드를 다시 그린다. 카드 한 장이 곧 하나의 입력면이고 따로 버튼을 세우지 않는다. */
  private render(): void {
    if (!this.productList?.active) return;
    // 동적 카드만 비워 팝업 chrome(판·제목)의 수명은 PopupLayer가 끝까지 소유하게 한다.
    this.productList.removeAll(true);
    const views = tradePackageViews(this.products);
    // 서버가 전시 품목을 덜 돌려주면 남은 자리에서 가운데로 모으고, 더 돌려주면 창 안에서 흐른다.
    // 창 높이는 열 때 이미 정해졌다. 구매 뒤 다시 그릴 때는 보던 자리를 지킨다(한계 안으로만 묶는다).
    const { centers, min } = tradePackageScroll(views.length, this.shell.height);
    this.scrollMin = min;
    this.scrollTo(this.offset);
    // 카드 입력 중심과 로비 위 돌아가기만 노출해 E2E가 상품 데이터를 디버그 상태로 읽지 않게 한다.
    setDebugStorefrontControls({
      trade: { products: centers.map((y) => ({ x: this.origin.x, y: this.origin.y + y + this.offset })), back: { ...BACK_SLOT } },
    });
    views.forEach((view, index) => {
      const product = this.products.find(({ id }) => id === view.id);
      this.productList?.add(new TradePackageCard(this.scene, 0, centers[index], {
        metrics: this.shell.card,
        view,
        onClick: (pointer) => {
          if (this.insideView(pointer)) { if (product) this.openPurchase(product); return; }
          // 판 밖으로 흘러나간(가려진) 카드 위에서 끝난 손은 판 밖을 누른 손이다 — 바깥 누르기와 같이 닫는다.
          if (this.outsideBody(pointer)) this.close();
        },
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
  private dispose(): void { this.generation += 1; this.requestGate.reset(); this.closeAction = undefined; this.body = undefined; this.productList = undefined; this.viewHit = undefined; this.offset = 0; this.scrollMin = 0; this.onClosed?.(); }
}
