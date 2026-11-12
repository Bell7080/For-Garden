import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { Button } from "./Button";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { chipPoints, drawLayer } from "./holo";
import { UI_ICON } from "./icons";
import { addFramedIcon } from "./itemFrame";
import type { PopupLayer } from "./PopupLayer";
import { fitTextToBox, shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/**
 * 고고학 발굴 안내 — 처음 들어온 날 한 번 뜨고, 지도 왼쪽의 「발굴 안내」 버튼으로 언제든 다시 연다.
 *
 * 한 줄 쪽지로는 "깊은 유적이 좋다"까지만 읽히고 **낮은 유적을 돌아야 하는 이유**(오래 비운 낮은 유적에 결정이
 * 맺힌다)가 빠졌다. 그래서 쪽 넷을 차례로 넘긴다 — 들어가기 → 안개 읽기 → 깊은 유적 → 낮은 유적. 마지막 쪽이
 * 이 안내가 꼭 남겨야 하는 말이라 맨 끝에 둔다. 수치는 적지 않는다(유적마다 다르고, 노드·미리보기가 이미 말한다).
 */
export interface ArchaeologyGuidePage {
  icon: string;
  headingKey: TextKey;
  bodyKey: TextKey;
}

export const ARCHAEOLOGY_GUIDE_PAGES: readonly ArchaeologyGuidePage[] = [
  { icon: UI_ICON.ticket, headingKey: "archaeology.guide.enter.heading", bodyKey: "archaeology.guide.enter.body" },
  { icon: UI_ICON.pickaxe, headingKey: "archaeology.guide.fog.heading", bodyKey: "archaeology.guide.fog.body" },
  { icon: CURRENCY_ICON_BY_WALLET.amber, headingKey: "archaeology.guide.deep.heading", bodyKey: "archaeology.guide.deep.body" },
  { icon: CURRENCY_ICON_BY_WALLET.rawStone, headingKey: "archaeology.guide.shallow.heading", bodyKey: "archaeology.guide.shallow.body" },
];

export const ARCHAEOLOGY_GUIDE_LAYOUT = {
  width: 900,
  height: 840,
  icon: 190,
  iconY: -240,
  headingY: -92,
  headingSize: 46,
  body: { top: -40, height: 220, size: 34 },
  dotsY: 214,
  dot: 16,
  dotGap: 30,
  buttonY: 314,
  button: { width: 300, height: 92 },
  buttonGap: 30,
} as const;

export function openArchaeologyGuide(scene: Phaser.Scene, popups: PopupLayer, onClose?: () => void): void {
  const L = ARCHAEOLOGY_GUIDE_LAYOUT;
  popups.open({ width: L.width, height: L.height, title: t("archaeology.guide.title"), dim: true, onClose }, (body, close) => {
    let page = 0;
    const content = scene.add.container(0, 0);
    body.add(content);
    const dots = scene.add.container(0, L.dotsY);
    body.add(dots);
    const prev = new Button(scene, 0, L.buttonY, {
      width: L.button.width, height: L.button.height, label: t("archaeology.guide.prev"), onClick: () => go(-1),
    });
    const next = new Button(scene, 0, L.buttonY, {
      width: L.button.width, height: L.button.height, label: t("archaeology.guide.next"), variant: "primary", onClick: () => go(1),
    });
    body.add([prev, next]);

    const paint = (): void => {
      content.removeAll(true);
      const spec = ARCHAEOLOGY_GUIDE_PAGES[page];
      addFramedIcon(scene, content, 0, L.iconY, L.icon, spec.icon, { plain: true });
      const heading = scene.add.text(0, L.headingY, t(spec.headingKey), textStyle({ role: "display", size: L.headingSize, color: COLOR.accentText }))
        .setOrigin(0.5);
      shrinkTextToWidth(heading, L.width - 120);
      const text = scene.add.text(0, L.body.top, t(spec.bodyKey), textStyle({ role: "body", size: L.body.size, color: COLOR.ink, align: "center" }))
        .setOrigin(0.5, 0)
        .setLineSpacing(10);
      fitTextToBox(text, { width: L.width - 140, height: L.body.height });
      content.add([heading, text]);
      content.setAlpha(0);
      scene.tweens.add({ targets: content, alpha: 1, duration: 160 });

      dots.removeAll(true);
      const total = ARCHAEOLOGY_GUIDE_PAGES.length;
      for (let index = 0; index < total; index += 1) {
        const x = (index - (total - 1) / 2) * L.dotGap;
        const on = index === page;
        const size = on ? L.dot * 1.3 : L.dot;
        dots.add(drawLayer(scene, x, 0, chipPoints(size, size, { bevel: { topLeft: size * 0.3, bottomRight: size * 0.3 } }), {
          fill: on ? COLOR.accent : 0xffffff, alpha: on ? 1 : 0.28, shadow: false,
        }));
      }

      const last = page === total - 1;
      prev.setVisible(page > 0);
      next.setLabel(t(last ? "archaeology.guide.done" : "archaeology.guide.next"));
      if (page > 0) {
        prev.setX(-(L.button.width + L.buttonGap) / 2);
        next.setX((L.button.width + L.buttonGap) / 2);
      } else {
        next.setX(0);
      }
    };

    const go = (step: -1 | 1): void => {
      const target = page + step;
      if (target >= ARCHAEOLOGY_GUIDE_PAGES.length) { close(); return; }
      if (target < 0) return;
      page = target;
      paint();
    };

    paint();
  });
}
