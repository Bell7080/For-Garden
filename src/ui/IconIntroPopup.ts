import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { Button } from "./Button";
import { chipPoints, drawLayer } from "./holo";
import { addFramedIcon } from "./itemFrame";
import type { PopupLayer } from "./PopupLayer";
import { fitTextToBox, shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/**
 * 아이콘 쪽지 — 콘텐츠에 처음 들어왔을 때 그림 한 장과 짧은 글을 몇 쪽 넘겨 보는 안내.
 *
 * 화면을 짚어 줄 만큼 조작이 얽히지 않은 콘텐츠(상점·원정·레이드 등)가 쓴다. 한 줄 쪽지로는 무엇을 하는 곳인지까지만
 * 읽히고 **왜 다시 와야 하는지**가 빠져, 쪽마다 그림 하나와 한두 문장으로 나눴다. 수치는 적지 않는다(화면이 이미 말한다).
 * 쪽 표는 `contentIntroPages.ts` 한 곳이 갖는다.
 */
export interface IconIntroPage {
  /** 액자 안에 설 그림(재화·아이템·직군 텍스처 키). */
  icon: string;
  headingKey: TextKey;
  bodyKey: TextKey;
}

export const ICON_INTRO_LAYOUT = {
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

export function openIconIntro(scene: Phaser.Scene, popups: PopupLayer, pages: readonly IconIntroPage[], onClose?: () => void): void {
  if (pages.length === 0) return;
  const L = ICON_INTRO_LAYOUT;
  popups.open({ width: L.width, height: L.height, title: t("intro.title"), dim: true, onClose }, (body, close) => {
    let page = 0;
    const content = scene.add.container(0, 0);
    body.add(content);
    const dots = scene.add.container(0, L.dotsY);
    body.add(dots);
    const prev = new Button(scene, 0, L.buttonY, {
      width: L.button.width, height: L.button.height, label: t("intro.prev"), onClick: () => go(-1),
    });
    const next = new Button(scene, 0, L.buttonY, {
      width: L.button.width, height: L.button.height, label: t("intro.next"), variant: "primary", onClick: () => go(1),
    });
    body.add([prev, next]);

    const paint = (): void => {
      content.removeAll(true);
      const spec = pages[page];
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

      // 한 쪽뿐이면 점을 세우지 않는다 — 넘길 것이 없는데 점 하나가 서면 무엇을 세는지 읽히지 않는다.
      dots.removeAll(true);
      const total = pages.length;
      if (total > 1) {
        for (let index = 0; index < total; index += 1) {
          const x = (index - (total - 1) / 2) * L.dotGap;
          const on = index === page;
          const size = on ? L.dot * 1.3 : L.dot;
          dots.add(drawLayer(scene, x, 0, chipPoints(size, size, { bevel: { topLeft: size * 0.3, bottomRight: size * 0.3 } }), {
            fill: on ? COLOR.accent : 0xffffff, alpha: on ? 1 : 0.28, shadow: false,
          }));
        }
      }

      const last = page === total - 1;
      prev.setVisible(page > 0);
      next.setLabel(t(last ? "intro.confirm" : "intro.next"));
      if (page > 0) {
        prev.setX(-(L.button.width + L.buttonGap) / 2);
        next.setX((L.button.width + L.buttonGap) / 2);
      } else {
        next.setX(0);
      }
    };

    const go = (step: -1 | 1): void => {
      const target = page + step;
      if (target >= pages.length) { close(); return; }
      if (target < 0) return;
      page = target;
      paint();
    };

    paint();
  });
}
