import Phaser from "phaser";
import { t } from "../i18n";
import type { ItemDefinition } from "../data/items";
import { drawLayer, HoloBar, slantedRect } from "./holo";
import { addItemFrame, ITEM_FRAME } from "./itemFrame";
import { addItemDefinitionIcon } from "./itemDefinitionIcon";
import { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { ITEM_GUIDE, itemGuideHeight } from "./itemGuideLayout";
import { pressIn, pressOut } from "./pressFeedback";

export interface ItemGuideOptions {
  readonly definition: ItemDefinition;
  readonly quantity: number;
  /** 소비품만 온다 — 오면 창 밑동에 「사용하기」가 선다. 한 개를 쓰고 창을 닫는다. */
  readonly onUse?: () => void;
}

/**
 * 재료·소비품 안내창 — **재화 안내창과 같은 한 벌**이다(`CurrencyGuidePopup`).
 *
 * 위 판에 액자와 보유 수, 그 아래 「효과」 제목표 줄과 설명. 재료를 누르면 작은 쪽지 하나에 설명과
 * 보유를 한 문단으로 적던 때는, 같은 가방 안에서 재화를 누르면 넓은 창이 뜨고 재료를 누르면 작은
 * 쪽지가 떠 같은 손짓이 두 양식이었다. 소비품은 밑동의 「사용하기」로 곧바로 쓴다 — 확인 창을 한 번
 * 더 띄우던 때는 이 창이 이미 무엇을 쓰는지 말하고 있는데 같은 질문을 되물었다.
 */
export class ItemGuidePopup {
  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer) {}

  open(options: ItemGuideOptions): void {
    const { definition, quantity, onUse } = options;
    const height = itemGuideHeight(onUse !== undefined);
    const top = -height / 2;
    this.popups.open({ width: ITEM_GUIDE.width, height, title: definition.name, dim: true, dimAlpha: 0.34 }, (body, close) => {
      const { hero } = ITEM_GUIDE;
      const heroY = top + hero.top + hero.height / 2;
      body.add(drawLayer(this.scene, 0, heroY, slantedRect(hero.width, hero.height, 22), { fill: 0x101720, alpha: 0.9, edge: COLOR.accent, edgeAlpha: 0.35 }));
      const iconX = -hero.width / 2 + 48 + hero.frameSize / 2;
      body.add(addItemFrame(this.scene, iconX, heroY, hero.frameSize));
      const iconSize = hero.frameSize * ITEM_FRAME.icon;
      body.add(addItemDefinitionIcon(this.scene, definition.icon, iconX + ITEM_FRAME.shadow.offsetX, heroY + ITEM_FRAME.shadow.offsetY, iconSize, { shadow: true }));
      body.add(addItemDefinitionIcon(this.scene, definition.icon, iconX, heroY, iconSize));
      body.add(this.scene.add.text(hero.width / 2 - 40, heroY - 28, t("inventory.guide.held"), textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(1, 0.5));
      body.add(this.scene.add.text(hero.width / 2 - 40, heroY + 18, quantity.toLocaleString(), textStyle({ role: "display", size: 52, color: "#ffe9a3" }))
        .setOrigin(1, 0.5).setShadow(2, 6, "#05070a", 7, false, true));

      const { section } = ITEM_GUIDE;
      const sectionY = top + section.top;
      body.add(this.scene.add.text(-section.width / 2, sectionY, t("inventory.guide.effect"), textStyle({ role: "display", size: 27, color: COLOR.accentText })).setOrigin(0, 0.5));
      new HoloBar(this.scene, 0, sectionY + 32, section.width, 5, { color: COLOR.accent, trackAlpha: 0.5 }).addTo(body).setValue(1);
      body.add(this.scene.add.text(-section.width / 2 + 15, sectionY + 60, definition.description, textStyle({ role: "body", size: 24, color: COLOR.ink, wrap: section.width - 30 })).setOrigin(0, 0));

      if (!onUse) return;
      const { use } = ITEM_GUIDE;
      const enabled = quantity > 0;
      const button = this.scene.add.container(0, height / 2 - use.bottom - use.height / 2).setAlpha(enabled ? 1 : 0.45);
      button.add(drawLayer(this.scene, 0, 0, slantedRect(use.width, use.height, 18), { fill: 0x273646, alpha: 0.98, edge: COLOR.accent, edgeAlpha: 0.8 }));
      button.add(this.scene.add.text(0, 0, t("inventory.useButton"), textStyle({ role: "display", size: 30, color: COLOR.accentText })).setOrigin(0.5));
      body.add(button);
      if (!enabled) return;
      const hit = this.scene.add.rectangle(0, 0, use.width, use.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => pressIn(button));
      hit.on("pointerout", () => pressOut(button, "normal", { pop: false }));
      hit.on("pointerup", () => { pressOut(button); close(); onUse(); });
      button.add(hit);
    });
  }
}
