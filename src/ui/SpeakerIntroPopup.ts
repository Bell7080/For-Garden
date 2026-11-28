import Phaser from "phaser";
import { t } from "../i18n";
import { getRelic } from "../data/relics";
import { logError } from "../managers/ErrorReporter";
import { portraitAssetFor, spawnPuppet } from "../puppets/assets";
import { addPopupBackgroundImage, BACKGROUND } from "./backgrounds";
import { Button } from "./Button";
import { dialogueSpeakerTitle } from "./dialogueSpeakerTitle";
import { addFactionMark } from "./FactionMark";
import { chipPoints, drawFrameVignette, drawGlassFade, drawLayer, drawShapeOutline } from "./holo";
import type { IconIntroPage } from "./IconIntroPopup";
import type { PopupLayer } from "./PopupLayer";
import { popupArtShape, popupBodyShapeMask } from "./popupArt";
import { infoPortraitPlacement } from "./portraitPlacement";
import { fitTextToBox, shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/**
 * 인물이 건네는 첫 방문 안내 — 아이콘 쪽지(`IconIntroPopup`)의 `speaker` 쪽만 모인 안내가 이 판으로 선다.
 *
 * 작은 얼굴 액자 위에 문장을 가운데 맞춤으로 늘어놓던 때는 시스템 안내문처럼 읽혀 「그 인물이 말한다」가 서지 않았다
 * (응태 지적, 2026-11-28 — 내려가는 지도에서 코마가 짚어 주는 말). 그래서 대사 화면의 문법을 판 하나에 줄여 담는다:
 * 그 길의 원화를 깐 무대에 전신이 상반신으로 서고, 아래 대사판이 몸을 덮으며 이름 아래 소속·직책 한 줄과 대사를 싣는다.
 * 판의 머리글은 「안내」가 아니라 말하는 사람의 이름이다. 넘기기·확인은 아이콘 쪽지와 같은 버튼 둘이다.
 */
export const SPEAKER_INTRO_LAYOUT = {
  width: 980,
  height: 1000,
  /** 머리글 — 말하는 사람의 이름이라 보통 판 제목보다 한 뼘 크다. */
  titleSize: 42,
  /** 전신 — 판 가운데에서 조금 왼쪽에, 눈높이가 판 위쪽 삼분의 일에 오도록 크게 선다. */
  portrait: { x: -150, coreY: -96, height: 1320 },
  /** 대사판 — 판 아래를 가로질러 몸을 허리께에서 덮는다. 좌표는 판 가운데 0 기준. */
  panel: { top: 52, bottom: 470, inset: 34, tail: 30, tailX: -150, cut: 40 },
  /** 대사판 윗변 위로 깔리는 어둠 — 전신의 아랫단이 판 경계에서 칼같이 잘리지 않게 녹인다. */
  fade: { height: 240 },
  title: { y: 104, emblem: 40, gap: 12, size: 26 },
  headingY: 168,
  headingSize: 52,
  body: { top: 222, height: 160, size: 36 },
  dots: { x: -330, y: 418, size: 16, gap: 30 },
  button: { x: 260, y: 418, width: 300, height: 88, gap: 24 },
} as const;

export function openSpeakerIntro(scene: Phaser.Scene, popups: PopupLayer, pages: readonly IconIntroPage[], onClose?: () => void): void {
  const first = pages[0];
  if (!first?.speaker) return;
  const L = SPEAKER_INTRO_LAYOUT;
  const def = getRelic(first.speaker);
  popups.open({ width: L.width, height: L.height, title: def.name, titleSize: L.titleSize, dim: true, onClose }, (body, close) => {
    const shape = popupArtShape(L.width, L.height);
    // 무대 — 그 길의 원화를 판 실루엣대로 깔고 정보창과 같은 검은 면·가장자리 누르기로 가라앉힌다.
    addPopupBackgroundImage(scene, body, first.backdrop ?? BACKGROUND.info, { x: 0, y: 0, width: L.width, height: L.height, maskShape: shape, overlayStrength: 0.7 });
    body.add(scene.add.rectangle(0, 0, L.width, L.height, COLOR.void, 0.42).setMask(popupBodyShapeMask(scene, body, shape)));
    body.add(drawFrameVignette(scene, 0, 0, L.width, L.height, { strength: 0.6, spread: 0.18 }).setMask(popupBodyShapeMask(scene, body, shape)));

    // 전신은 비동기로 도착한다 — 대사판보다 먼저 세운 층에 넣어야 늦게 와도 판 아래에 선다.
    const figure = scene.add.container(0, 0);
    body.add(figure);
    const asset = portraitAssetFor(def.portraitAssetId);
    // 전신은 대사판 윗변 바로 아래에서 끊는다 — 판 실루엣만으로 자르면 대사판 밑으로 남는 띠에 다리가 비친다.
    const figureShape = shape.map((value, index) => (index % 2 === 1 ? Math.min(value, L.panel.top + L.panel.cut) : value));
    const mask = popupBodyShapeMask(scene, body, figureShape);
    void spawnPuppet(scene, asset, { ...infoPortraitPlacement(asset, { x: L.portrait.x, y: L.portrait.coreY, height: L.portrait.height }), depth: 0 })
      .then((puppet) => {
        if (!figure.active) { puppet.destroy(); return; }
        puppet.disableInteractive();
        puppet.setMask(mask);
        puppet.setAlpha(0);
        figure.add(puppet);
        scene.tweens.add({ targets: puppet, alpha: 1, duration: 240 });
      })
      .catch((error) => logError("puppet.display", "인물 안내 전신 표시 실패", error));

    const P = L.panel;
    body.add(drawGlassFade(scene, 0, P.top - L.fade.height / 2, L.width, L.fade.height, { topAlpha: 0, bottomAlpha: 0.85 }).setMask(popupBodyShapeMask(scene, body, shape)));
    // 대사판 — 대사 화면의 판처럼 짙은 유리에 윗변 강조선, 위로 솟은 꼬리가 말하는 사람을 가리킨다.
    const panelWidth = L.width - P.inset * 2;
    const panelHeight = P.bottom - P.top;
    const panelY = P.top + panelHeight / 2;
    const bevel = panelHeight * 0.14;
    const panel = drawLayer(scene, 0, panelY, chipPoints(panelWidth, panelHeight, { bevel: { topLeft: bevel, bottomRight: bevel } }), {
      fill: 0x0a0d12, alpha: 0.92, edge: COLOR.accent, edgeAlpha: 0.9, shadow: { x: 0, y: 10 },
    });
    body.add(panel);
    const tail = scene.add.graphics().fillStyle(0x0a0d12, 0.92).fillPoints([
      new Phaser.Math.Vector2(P.tailX - P.tail, P.top + 1),
      new Phaser.Math.Vector2(P.tailX + P.tail * 0.4, P.top + 1),
      new Phaser.Math.Vector2(P.tailX - P.tail * 0.2, P.top - P.tail),
    ], true);
    body.add(tail);
    body.add(drawShapeOutline(scene, 0, 0, shape, { color: COLOR.void, alpha: 0.92, width: 7 }));

    // 이름 아래 한 줄 — 누구 편이고 어느 자리인가(대사 화면과 같은 표).
    const rank = dialogueSpeakerTitle(first.speaker);
    if (rank) {
      const left = -panelWidth / 2 + 56;
      const mark = rank.squad ? addFactionMark(scene, left + L.title.emblem / 2, L.title.y, rank.squad, { size: L.title.emblem }) : undefined;
      if (mark) body.add(mark);
      body.add(scene.add.text(mark ? left + L.title.emblem + L.title.gap : left, L.title.y, rank.text, textStyle({ role: "emphasis", size: L.title.size, color: COLOR.inkDim }))
        .setOrigin(0, 0.5));
    }

    const content = scene.add.container(0, 0);
    body.add(content);
    const dots = scene.add.container(L.dots.x, L.dots.y);
    body.add(dots);
    const prev = new Button(scene, 0, L.button.y, {
      width: L.button.width, height: L.button.height, label: t("intro.prev"), onClick: () => go(-1),
    });
    const next = new Button(scene, L.button.x, L.button.y, {
      width: L.button.width, height: L.button.height, label: t("intro.next"), variant: "primary", onClick: () => go(1),
    });
    body.add([prev, next]);

    let page = 0;
    const textWidth = panelWidth - 112;
    const paint = (): void => {
      content.removeAll(true);
      const spec = pages[page];
      const heading = scene.add.text(-panelWidth / 2 + 56, L.headingY, t(spec.headingKey), textStyle({ role: "display", size: L.headingSize, color: COLOR.accentText }))
        .setOrigin(0, 0.5);
      shrinkTextToWidth(heading, textWidth);
      const text = scene.add.text(-panelWidth / 2 + 56, L.body.top, t(spec.bodyKey), textStyle({ role: "body", size: L.body.size, color: COLOR.ink }))
        .setOrigin(0, 0)
        .setLineSpacing(10);
      fitTextToBox(text, { width: textWidth, height: L.body.height });
      content.add([heading, text]);
      content.setAlpha(0);
      content.setX(18);
      scene.tweens.add({ targets: content, alpha: 1, x: 0, duration: 200, ease: "Quad.Out" });

      dots.removeAll(true);
      const total = pages.length;
      if (total > 1) {
        for (let index = 0; index < total; index += 1) {
          const on = index === page;
          const size = on ? L.dots.size * 1.3 : L.dots.size;
          dots.add(drawLayer(scene, index * L.dots.gap, 0, chipPoints(size, size, { bevel: { topLeft: size * 0.3, bottomRight: size * 0.3 } }), {
            fill: on ? COLOR.accent : 0xffffff, alpha: on ? 1 : 0.28, shadow: false,
          }));
        }
      }
      const last = page === total - 1;
      prev.setVisible(page > 0);
      prev.setX(L.button.x - L.button.width - L.button.gap);
      next.setLabel(t(last ? "intro.confirm" : "intro.next"));
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
