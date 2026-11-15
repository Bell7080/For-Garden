import Phaser from "phaser";
import { attachRoll } from "./RollingValue";
import { t } from "../i18n";
import { currencyGuide } from "../data/currencyGuide";
import type { WalletItemKey } from "../data/items";
import { session } from "../state/session";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { drawLayer, slantedRect } from "./holo";
import { addFramedIcon } from "./itemFrame";
import { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { CURRENCY_GUIDE, currencyGuideLayout } from "./currencyGuideLayout";
import { addGuideRouteList, addGuideSectionHeader } from "./GuideRouteList";
import type { GuideNavigator } from "./guideNavigation";

const TONE = { value: "#ffe9a3" } as const;

/**
 * 재화 안내창 — 보유량, 세계관 한 줄, 그리고 「획득처」·「사용처」.
 *
 * 줄은 손으로 적은 문장이 아니라 ID다(`guideRoutes.ts`) — 수는 그 규칙을 가진 상수에서 채워지고, 갈 곳이
 * 있는 줄은 화살표를 눌러 그 화면으로 곧장 간다(`GuideRouteList`).
 */
export class CurrencyGuidePopup {
  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly navigator: Omit<GuideNavigator, "scene"> = {}) {}

  open(key: WalletItemKey): void {
    const guide = currencyGuide(key);
    const layout = currencyGuideLayout(guide.sources.length, guide.uses.length);
    const top = -layout.height / 2;
    const { section } = CURRENCY_GUIDE;
    this.popups.open({ width: CURRENCY_GUIDE.width, height: layout.height, title: guide.name, dim: true, dimAlpha: 0.34 }, (body, close) => {
      this.addHolding(body, key, top + layout.heroY);
      const { lore } = CURRENCY_GUIDE;
      body.add(this.scene.add.text(0, top + layout.loreY, guide.lore, textStyle({ role: "body", size: lore.size, color: COLOR.inkDim, align: "center", wrap: lore.wrap })).setOrigin(0.5));
      const navigator: GuideNavigator = { scene: this.scene, ...this.navigator };
      const sectionAt = (sectionTop: number, title: string, routes: typeof guide.sources): void => {
        if (routes.length === 0) return;
        addGuideSectionHeader(this.scene, body, top + sectionTop, section.width, title, section.titleSize);
        addGuideRouteList(this.scene, body, { x: 0, y: top + sectionTop + section.header + CURRENCY_GUIDE.row / 2, width: section.width, routes, navigator, close, rowHeight: CURRENCY_GUIDE.row });
      };
      sectionAt(layout.sourcesTop, t("stamina.sources"), guide.sources);
      sectionAt(layout.usesTop, t("stamina.uses"), guide.uses);
    });
  }

  /**
   * 지금 얼마나 가졌는가.
   *
   * **여기서는 K·M으로 줄이지 않는다.** 상단 줄과 가방 칸이 줄여 적는 것은 칸 폭이 흔들리지
   * 않게 하려는 것이고, 이 창은 그 줄인 수를 확인하러 여는 자리다.
   */
  private addHolding(body: Phaser.GameObjects.Container, key: WalletItemKey, y: number): void {
    const { hero } = CURRENCY_GUIDE;
    const amount = session.wallet[key] ?? 0;
    body.add(drawLayer(this.scene, 0, y, slantedRect(hero.width, hero.height, 22), { fill: 0x101720, alpha: 0.9, edge: COLOR.accent, edgeAlpha: 0.35 }));
    const iconX = -hero.width / 2 + 48 + hero.frameSize / 2;
    // 이미 그 재화를 보고 있는 자리라 눌러도 열 창이 없다.
    addFramedIcon(this.scene, body, iconX, y, hero.frameSize, CURRENCY_ICON_BY_WALLET[key], { plain: true });
    body.add(this.scene.add.text(hero.width / 2 - 40, y - 34, t("inventory.guide.held"), textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(1, 0.5));
    body.add(attachRoll(this.scene.add
      .text(hero.width / 2 - 40, y + 16, amount.toLocaleString(), textStyle({ role: "display", size: 56, color: TONE.value }))
      .setOrigin(1, 0.5)
      .setShadow(2, 6, "#05070a", 7, false, true), { memoryKey: `currency-guide:${key}` }));
  }
}
