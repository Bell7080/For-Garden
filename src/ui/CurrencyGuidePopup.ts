import Phaser from "phaser";
import { currencyGuide, type CurrencyGuideAction } from "../data/currencyGuide";
import type { WalletItemKey } from "../data/items";
import { drawLayer, HoloBar, slantedRect } from "./holo";
import { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";

/** 획득처와 사용처를 같은 홀로그램 문법으로 보여 주는 공용 읽기 전용 안내창이다. */
export class CurrencyGuidePopup {
  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly onAction?: (action: CurrencyGuideAction) => void) {}

  open(key: WalletItemKey): void {
    const guide = currencyGuide(key);
    this.popups.open({ width: 780, height: 900, title: guide.name, dim: true, dimAlpha: 0.34 }, (body, close) => {
      // 짧은 세계관 문장은 제목 아래에만 두고, 실제 판단 정보는 두 구역으로 명확히 가른다.
      body.add(this.scene.add.text(0, -330, guide.lore, textStyle({ role: "body", size: 24, color: COLOR.inkDim, align: "center", wrap: 650 })).setOrigin(0.5));
      this.addSection(body, -180, "획득처", guide.sources);
      this.addSection(body, 120, "사용처", guide.uses);
      if (guide.action && this.onAction) {
        // 이동은 안내창을 닫은 뒤 로비 콜백에 요청하며 지갑이나 Scene 상태를 여기서 만지지 않는다.
        const button = this.scene.add.container(0, 350);
        button.add(drawLayer(this.scene, 0, 0, slantedRect(310, 72, 16), { fill: 0x273646, alpha: 0.98, edge: COLOR.accent, edgeAlpha: 0.8 }));
        button.add(this.scene.add.text(0, 0, guide.action.label, textStyle({ role: "emphasis", size: 25, color: COLOR.accentText })).setOrigin(0.5));
        const hit = this.scene.add.rectangle(0, 0, 310, 72, 0xffffff, 0).setInteractive({ useHandCursor: true });
        hit.on("pointerdown", () => button.setScale(1.1));
        hit.on("pointerout", () => button.setScale(1));
        hit.on("pointerup", () => { button.setScale(1); close(); this.onAction?.(guide.action!); });
        button.add(hit); body.add(button);
      }
    });
  }

  /** 공용 HoloBar의 얇은 선과 평면 카드로 목록의 정보 위계를 통일한다. */
  private addSection(body: Phaser.GameObjects.Container, y: number, title: string, rows: readonly string[]): void {
    body.add(this.scene.add.text(-315, y - 80, title, textStyle({ role: "display", size: 27, color: COLOR.accentText })).setOrigin(0, 0.5));
    const divider = new HoloBar(this.scene, 0, y - 48, 630, 5, { color: COLOR.accent, trackAlpha: 0.5 });
    divider.setValue(1); divider.addTo(body);
    rows.forEach((row, index) => body.add(this.scene.add.text(-300, y + index * 49, `◆  ${row}`, textStyle({ role: "body", size: 22, color: COLOR.ink })).setOrigin(0, 0.5)));
  }
}
