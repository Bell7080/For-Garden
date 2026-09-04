import Phaser from "phaser";
import type { InteractionExchangeOfferDto } from "../api/contracts";
import type { InteractionManager } from "../managers/InteractionManager";
import { Button } from "./Button";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";

/** 교류 전용 DTO만 받아 PurchasePopup의 수량 선택·요청 잠금 양식을 재사용한 작업판이다. */
export class InteractionExchangePopup {
  private pending = false;
  private quantities = new Map<string, number>();
  private content?: Phaser.GameObjects.Container;
  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly manager: InteractionManager) {}

  open(): void { this.popups.open({ width: 880, height: 1040, title: "교환소", dim: true, closeOnBackdrop: true }, (body) => { this.content = this.scene.add.container(0, 20); body.add(this.content); void this.refresh(); }); }
  /** TradePopup 회귀처럼 body를 destroy하지 않고 동적 콘텐츠 컨테이너의 자식만 교체한다. */
  private async refresh(result = ""): Promise<void> { const list = await this.manager.exchangeOffers(); const content = this.content; if (!content?.active) return; content.removeAll(true); list.offers.forEach((offer, index) => this.paintRow(content, offer, index, result)); }
  /** 화면에는 의사결정에 필요한 보유량·요구량·결과·남은 횟수만 둔다. */
  private paintRow(content: Phaser.GameObjects.Container, offer: InteractionExchangeOfferDto, index: number, result: string): void { const y = -330 + index * 330; const quantity = Math.min(this.quantities.get(offer.id) ?? 1, Math.max(1, offer.remaining)); this.quantities.set(offer.id, quantity); const reward = offer.grants[0]; const rewardAmount = reward ? reward.amount * quantity : 0;
    content.add(this.scene.add.text(-350, y, `보유 표본  ${offer.cost.owned}`, textStyle({ role: "emphasis", size: 28 })).setOrigin(0, .5));
    content.add(this.scene.add.text(-350, y + 58, `요구량  ${offer.cost.amount * quantity}`, textStyle({ role: "body", size: 25, color: COLOR.inkDim })).setOrigin(0, .5));
    content.add(this.scene.add.text(-350, y + 116, `교환 결과  치즈케이크 ${rewardAmount}`, textStyle({ role: "body", size: 25, color: COLOR.accentText })).setOrigin(0, .5));
    content.add(this.scene.add.text(-350, y + 174, `남은 교환 횟수  ${offer.remaining}`, textStyle({ role: "body", size: 24 })).setOrigin(0, .5));
    const change = (delta: number): void => { if (this.pending) return; this.quantities.set(offer.id, Math.max(1, Math.min(offer.remaining, quantity + delta))); void this.refresh(result); };
    content.add(new Button(this.scene, 115, y + 58, { width: 70, height: 58, label: "−", onClick: () => change(-1) }).setEnabled(!this.pending && quantity > 1)); content.add(new Button(this.scene, 205, y + 58, { width: 70, height: 58, label: "+", onClick: () => change(1) }).setEnabled(!this.pending && quantity < offer.remaining));
    content.add(new Button(this.scene, 230, y + 174, { width: 250, height: 76, label: this.pending ? "처리 중" : "교환", variant: "primary", onClick: () => void this.exchange(offer, quantity) }).setEnabled(!this.pending && offer.unlocked && offer.remaining >= quantity && offer.cost.owned >= offer.cost.amount * quantity));
    if (result) content.add(this.scene.add.text(0, y + 245, result, textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(.5));
  }
  /** 응답 전에는 모든 행 입력을 잠가 연타가 여러 requestId를 만들지 못하게 한다. */
  private async exchange(offer: InteractionExchangeOfferDto, quantity: number): Promise<void> { if (this.pending) return; this.pending = true; await this.refresh(); let result = ""; try { const receipt = await this.manager.exchange(offer.id, quantity, crypto.randomUUID()); result = `치즈케이크 ${receipt.granted[0]?.amount ?? 0} 지급`; } catch (error) { result = error instanceof Error ? error.message : "교환 실패"; } finally { this.pending = false; await this.refresh(result); } }
}
