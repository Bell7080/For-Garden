import Phaser from "phaser";
import { t } from "../i18n";
import { currencyGuide, type CurrencyGuideAction } from "../data/currencyGuide";
import type { WalletItemKey } from "../data/items";
import { session } from "../state/session";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { drawLayer, HoloBar, slantedRect } from "./holo";
import { addFramedIcon } from "./itemFrame";
import { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";

/**
 * 보유량을 세우는 위쪽 판.
 *
 * 스테미나 창과 같은 자리·같은 액자·같은 글자 크기다 — 재화를 눌러 여는 창인데 정작 얼마나
 * 가졌는지 없으면, 쓸지 말지를 정하러 온 손이 창을 닫고 상단 줄을 다시 봐야 한다.
 */
const HERO = { y: -290, width: 660, height: 176, frameSize: 124 } as const;
const TONE = { value: "#ffe9a3" } as const;

/** 획득처와 사용처를 같은 홀로그램 문법으로 보여 주는 공용 읽기 전용 안내창이다. */
export class CurrencyGuidePopup {
  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly onAction?: (action: CurrencyGuideAction) => void) {}

  open(key: WalletItemKey): void {
    const guide = currencyGuide(key);
    this.popups.open({ width: 780, height: 1020, title: guide.name, dim: true, dimAlpha: 0.34 }, (body, close) => {
      this.addHolding(body, key);
      // 짧은 세계관 문장은 보유량 아래에만 두고, 실제 판단 정보는 두 구역으로 명확히 가른다.
      body.add(this.scene.add.text(0, -170, guide.lore, textStyle({ role: "body", size: 24, color: COLOR.inkDim, align: "center", wrap: 650 })).setOrigin(0.5));
      this.addSection(body, -30, t("stamina.sources"), guide.sources);
      this.addSection(body, 250, t("stamina.uses"), guide.uses);
      if (guide.action && this.onAction) {
        // 이동은 안내창을 닫은 뒤 로비 콜백에 요청하며 지갑이나 Scene 상태를 여기서 만지지 않는다.
        const button = this.scene.add.container(0, 430);
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

  /**
   * 지금 얼마나 가졌는가.
   *
   * **여기서는 K·M으로 줄이지 않는다.** 상단 줄과 가방 칸이 줄여 적는 것은 칸 폭이 흔들리지
   * 않게 하려는 것이고, 이 창은 그 줄인 수를 확인하러 여는 자리다.
   */
  private addHolding(body: Phaser.GameObjects.Container, key: WalletItemKey): void {
    const amount = session.wallet[key] ?? 0;
    body.add(drawLayer(this.scene, 0, HERO.y, slantedRect(HERO.width, HERO.height, 22), { fill: 0x101720, alpha: 0.9, edge: COLOR.accent, edgeAlpha: 0.35 }));
    const iconX = -HERO.width / 2 + 48 + HERO.frameSize / 2;
    // 액자·그림·그늘은 어디서나 같은 공용 프리팹 한 장이 그린다.
    addFramedIcon(this.scene, body, iconX, HERO.y, HERO.frameSize, CURRENCY_ICON_BY_WALLET[key]);
    body.add(this.scene.add
      .text(HERO.width / 2 - 40, HERO.y, amount.toLocaleString(), textStyle({ role: "display", size: 52, color: TONE.value }))
      .setOrigin(1, 0.5)
      .setShadow(2, 6, "#05070a", 7, false, true));
  }

  /** 공용 HoloBar의 얇은 선과 평면 카드로 목록의 정보 위계를 통일한다. */
  private addSection(body: Phaser.GameObjects.Container, y: number, title: string, rows: readonly string[]): void {
    body.add(this.scene.add.text(-315, y - 80, title, textStyle({ role: "display", size: 27, color: COLOR.accentText })).setOrigin(0, 0.5));
    const divider = new HoloBar(this.scene, 0, y - 48, 630, 5, { color: COLOR.accent, trackAlpha: 0.5 });
    divider.setValue(1); divider.addTo(body);
    rows.forEach((row, index) => body.add(this.scene.add.text(-300, y + index * 49, `◆  ${row}`, textStyle({ role: "body", size: 22, color: COLOR.ink })).setOrigin(0, 0.5)));
  }
}
