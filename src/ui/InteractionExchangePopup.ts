import Phaser from "phaser";
import { t } from "../i18n";
import type { InteractionExchangeOfferDto } from "../api/contracts";
import type { InteractionManager } from "../managers/InteractionManager";
import { Button } from "./Button";
import { EXCHANGE, EXCHANGE_ROW, interactionExchangeLayout } from "./interactionExchangeLayout";
import type { PopupLayer } from "./PopupLayer";
import { addItemPriceTag, addPriceTag } from "./priceTag";
import { COLOR, textStyle } from "./theme";

/**
 * 교류 교환소 — 드는 것도 받는 것도 **같은 공용 액자 한 장**으로 선다.
 *
 * 예전에는 `보유 표본 3`·`교환 결과 치즈케이크 100`처럼 네 줄이 전부 글이었다. 같은 치즈케이크가
 * 무역 카드에서는 액자 안에, 여기서는 문장 속에 서서 어느 쪽이 얼마인지 훑어 읽히지 않았다.
 * 지금은 보유 → 요구 → 결과가 액자 셋으로 나란히 서고, 모자란 값만 그 수가 붉어진다.
 */
export class InteractionExchangePopup {
  private pending = false;
  private quantities = new Map<string, number>();
  private content?: Phaser.GameObjects.Container;
  private offers: InteractionExchangeOfferDto[] = [];
  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly manager: InteractionManager) {}

  /** 창 높이가 줄 수에서 나오므로 목록을 먼저 받고 연다. */
  open(): void { void this.openList(); }

  private async openList(): Promise<void> {
    this.offers = await this.manager.exchangeOffers().then((list) => list.offers).catch(() => []);
    const layout = interactionExchangeLayout(this.offers.length);
    this.popups.open({ width: EXCHANGE.width, height: layout.height, title: t("interaction.exchange"), dim: true, closeOnBackdrop: true, backButton: true }, (body) => {
      this.content = this.scene.add.container(0, 0);
      body.add(this.content);
      this.paint("");
    });
  }

  /** 공용 PopupLayer의 chrome을 보존하고 동적 콘텐츠 컨테이너의 자식만 교체한다. */
  private async refresh(result = ""): Promise<void> {
    this.offers = await this.manager.exchangeOffers().then((list) => list.offers).catch(() => this.offers);
    this.paint(result);
  }

  private paint(result: string): void {
    const content = this.content;
    if (!content?.active) return;
    content.removeAll(true);
    const { centers } = interactionExchangeLayout(this.offers.length);
    this.offers.forEach((offer, index) => this.paintRow(content, offer, centers[index] ?? 0, result));
  }

  /** 화면에는 의사결정에 필요한 보유량·요구량·결과·남은 횟수만 둔다. */
  private paintRow(content: Phaser.GameObjects.Container, offer: InteractionExchangeOfferDto, y: number, result: string): void {
    const quantity = Math.min(this.quantities.get(offer.id) ?? 1, Math.max(1, offer.remaining));
    this.quantities.set(offer.id, quantity);
    const reward = offer.grants[0];
    const required = offer.cost.amount * quantity;
    const short = offer.cost.owned < required;

    content.add(this.scene.add.text(EXCHANGE_ROW.left, y + EXCHANGE_ROW.nameY, offer.name, textStyle({ role: "display", size: 30 })).setOrigin(0, 0.5));
    content.add(this.scene.add.text(EXCHANGE_ROW.right, y + EXCHANGE_ROW.nameY, t("interaction.exchange.remaining", { remaining: offer.remaining }), textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(1, 0.5));

    // 액자 위의 작은 이름표가 어느 액자가 무엇인지 말한다 — 액자 안에는 수만 선다.
    const label = (x: number, text: string): void => {
      content.add(this.scene.add.text(x, y + EXCHANGE_ROW.labelY, text, textStyle({ role: "body", size: 20, color: COLOR.inkDim })).setOrigin(0.5));
    };
    label(EXCHANGE_ROW.ownedX, t("interaction.exchange.owned"));
    label(EXCHANGE_ROW.requiredX, t("interaction.exchange.required"));
    label(EXCHANGE_ROW.resultX, t("interaction.exchange.result"));
    addItemPriceTag(this.scene, content, EXCHANGE_ROW.ownedX, y + EXCHANGE_ROW.tagY, offer.cost.itemId, offer.cost.owned, { size: EXCHANGE_ROW.tag });
    addItemPriceTag(this.scene, content, EXCHANGE_ROW.requiredX, y + EXCHANGE_ROW.tagY, offer.cost.itemId, required, { size: EXCHANGE_ROW.tag, short });
    content.add(this.scene.add.text(EXCHANGE_ROW.arrowX, y + EXCHANGE_ROW.tagY, "→", textStyle({ role: "display", size: 34, color: COLOR.accentText })).setOrigin(0.5));
    if (reward?.kind === "currency") {
      addPriceTag(this.scene, content, EXCHANGE_ROW.resultX, y + EXCHANGE_ROW.tagY, reward.currency, reward.amount * quantity, { size: EXCHANGE_ROW.tag });
    } else if (reward?.kind === "item") {
      addItemPriceTag(this.scene, content, EXCHANGE_ROW.resultX, y + EXCHANGE_ROW.tagY, reward.itemId, reward.amount * quantity, { size: EXCHANGE_ROW.tag });
    }

    const change = (delta: number): void => {
      if (this.pending) return;
      this.quantities.set(offer.id, Math.max(1, Math.min(offer.remaining, quantity + delta)));
      this.paint(result);
    };
    const controlsY = y + EXCHANGE_ROW.controlsY;
    content.add(new Button(this.scene, EXCHANGE_ROW.ownedX, controlsY, { width: 70, height: 58, label: "−", onClick: () => change(-1) }).setEnabled(!this.pending && quantity > 1));
    content.add(this.scene.add.text(EXCHANGE_ROW.arrowX - 154, controlsY, String(quantity), textStyle({ role: "display", size: 30 })).setOrigin(0.5));
    content.add(new Button(this.scene, EXCHANGE_ROW.requiredX, controlsY, { width: 70, height: 58, label: "+", onClick: () => change(1) }).setEnabled(!this.pending && quantity < offer.remaining));
    content.add(new Button(this.scene, 230, controlsY, { width: 250, height: 76, label: this.pending ? t("interaction.exchange.busy") : t("interaction.exchange.do"), variant: "primary", onClick: () => void this.exchange(offer, quantity) })
      .setEnabled(!this.pending && offer.unlocked && offer.remaining >= quantity && !short));
    if (result) content.add(this.scene.add.text(0, y + EXCHANGE_ROW.messageY, result, textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0.5));
  }

  /** 응답 전에는 모든 행 입력을 잠가 연타가 여러 requestId를 만들지 못하게 한다. */
  private async exchange(offer: InteractionExchangeOfferDto, quantity: number): Promise<void> {
    if (this.pending) return;
    this.pending = true;
    this.paint("");
    let result = "";
    try {
      const receipt = await this.manager.exchange(offer.id, quantity, crypto.randomUUID());
      result = t("interaction.exchange.granted", { amount: receipt.granted[0]?.amount ?? 0 });
    } catch (error) {
      result = error instanceof Error ? error.message : t("interaction.exchange.failed");
    } finally {
      this.pending = false;
      await this.refresh(result);
    }
  }
}
