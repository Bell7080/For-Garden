import Phaser from "phaser";
import { GREAT_SUCCESS } from "../core/greatSuccess";
import { t } from "../i18n";
import { GREAT_SUCCESS_FX, greatSuccessReduced } from "./greatSuccessFx";
import { chipPoints, drawLayer } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { pressIn, pressOut } from "./pressFeedback";
import { drawSparkle } from "./rouletteWheel";
import { drawGlyph } from "./glyphs";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/**
 * **던전 입구의 「대성공」 딱지** — 이긴 판마다 서버가 굴리는 대성공(`core/greatSuccess.ts`)이 있다는 것을
 * 보상 카드 오른쪽 위에 삐딱하게 붙은 금빛 딱지 한 장이 알린다. 결과판·소탕 영수증에 찍히는 도장과 같은
 * 색·같은 기울기라, 입구에서 본 딱지가 끝난 뒤 쾅 찍히는 그 도장으로 이어 읽힌다.
 *
 * 확률·배율은 화면에 적지 않고 `GREAT_SUCCESS`에서 읽는다 — 값을 고치면 딱지와 쪽지가 함께 움직인다.
 * 누르면 무엇인지 말하는 작은 쪽지가 열린다(판 밖 우하단 뒤로가기 · 판 밖 누르기로 닫힌다).
 */
export const GREAT_SUCCESS_BADGE = {
  width: 168, height: 48, bevel: 12, angle: GREAT_SUCCESS_FX.stamp.angle * 0.6,
  fill: 0xffd75e, ink: GREAT_SUCCESS_FX.stamp.stroke, fontSize: 24,
  /** 딱지가 톡톡 숨 쉬는 박자 — 움직임 줄이기에서는 서 있기만 한다. */
  bob: { scale: 1.07, ms: 620, holdMs: 1700 },
  popup: { width: 700, padX: 52, stampSize: 64, gap: 26, bodySize: 30, top: 78, bottom: 54, tile: { width: 270, height: 132, gap: 24, value: 64, icon: 44 } },
} as const;

/** 확률(%)과 배율 — 딱지와 쪽지가 같은 값을 쓴다. */
export function greatSuccessLabels(): { chance: string; multiplier: string } {
  return {
    chance: String(Math.round(GREAT_SUCCESS.chance * 1000) / 10),
    multiplier: String(GREAT_SUCCESS.multiplier),
  };
}

/** 금빛 딱지를 `(x, y)`에 세운다. 누르면 `onClick`. */
export function addGreatSuccessBadge(scene: Phaser.Scene, x: number, y: number, onClick: (at: { x: number; y: number }) => void): Phaser.GameObjects.Container {
  const B = GREAT_SUCCESS_BADGE;
  const badge = scene.add.container(x, y).setAngle(B.angle);
  const shape = chipPoints(B.width, B.height, { bevel: { topLeft: B.bevel, bottomRight: B.bevel } });
  badge.add(drawLayer(scene, 0, 0, shape, { fill: B.fill, alpha: 1, shadow: { x: 3, y: 5 } }));
  // 숨 쉬는 박자는 안쪽 한 겹(라벨·반짝이)만 탄다 — 누름 손맛이 딱지 배율을, 글자 맞춤이 라벨 가로 배율을 쓴다.
  const inner = scene.add.container(0, 0);
  badge.add(inner);
  const sparkle = scene.add.graphics();
  drawSparkle(sparkle, -B.width / 2 + 22, 0, 11, 0xffffff, 0.95);
  drawSparkle(sparkle, B.width / 2 - 12, -B.height / 2 + 4, 8, 0xfff4c2, 1);
  inner.add(sparkle);
  const label = scene.add.text(10, 1, t("greatSuccess.badge", greatSuccessLabels()), textStyle({ role: "display", size: B.fontSize, color: B.ink })).setOrigin(0.5);
  squeezeTextToWidth(label, B.width - 56);
  inner.add(label);
  badge.setSize(B.width, B.height).setInteractive({ useHandCursor: true });
  badge.on("pointerdown", () => pressIn(badge));
  badge.on("pointerout", () => pressOut(badge, "normal", { pop: false }));
  badge.on("pointerup", () => {
    pressOut(badge);
    const matrix = badge.getWorldTransformMatrix();
    onClick({ x: matrix.tx, y: matrix.ty });
  });
  if (!greatSuccessReduced()) {
    const tween = scene.tweens.add({ targets: inner, scale: B.bob.scale, duration: B.bob.ms / 2, yoyo: true, repeat: -1, repeatDelay: B.bob.holdMs, ease: "Sine.InOut" });
    badge.once(Phaser.GameObjects.Events.DESTROY, () => tween.remove());
  }
  return badge;
}

/**
 * 대성공이 무엇인지 말하는 쪽지 — 금빛 도장 아래 **확률 · 배율** 두 칸이 크게 서고, 풀이는 그 아래 한 문단이다.
 * 수를 문장 속에만 두면 「몇 %에 몇 배」가 글을 다 읽어야 나온다.
 */
export function openGreatSuccessInfo(scene: Phaser.Scene, popups: PopupLayer, anchor?: { x: number; y: number }): void {
  const P = GREAT_SUCCESS_BADGE.popup;
  const T = P.tile;
  const labels = greatSuccessLabels();
  const body = scene.add.text(0, 0, t("greatSuccess.info.body", labels), textStyle({ role: "body", size: P.bodySize, color: COLOR.inkDim, align: "center", lineSpacing: 10, wrap: P.width - P.padX * 2 })).setOrigin(0.5, 0);
  const height = P.top + P.stampSize + P.gap + T.height + P.gap + body.height + P.bottom;
  popups.open({ width: P.width, height, title: t("greatSuccess.info.title"), anchor }, (panel) => {
    const S = GREAT_SUCCESS_FX.stamp;
    const stampY = -height / 2 + P.top + P.stampSize / 2;
    const stamp = scene.add.text(0, stampY, t("greatSuccess.stamp"), textStyle({ role: "display", size: P.stampSize, color: S.color }))
      .setOrigin(0.5).setAngle(S.angle * 0.6).setStroke(S.stroke, 10).setShadow(2, 5, "#000000", 4, false, true);
    squeezeTextToWidth(stamp, P.width - P.padX * 2);
    const sparkle = scene.add.graphics();
    drawSparkle(sparkle, -stamp.displayWidth / 2 - 26, stampY - 10, 14, 0xfff4c2, 1);
    drawSparkle(sparkle, stamp.displayWidth / 2 + 24, stampY + 12, 10, 0xffffff, 0.9);
    panel.add([sparkle, stamp]);
    // 두 칸 — 왼쪽은 나올 확률, 오른쪽은 나왔을 때 곱해지는 보상. 딱지와 같은 금빛 윗선으로 한 벌임을 말한다.
    const tileY = stampY + P.stampSize / 2 + P.gap + T.height / 2;
    const tiles: { x: number; value: string; glyph: "trophy" | "rank-reward" }[] = [
      { x: -(T.width + T.gap) / 2, value: `${labels.chance}%`, glyph: "trophy" },
      { x: (T.width + T.gap) / 2, value: `×${labels.multiplier}`, glyph: "rank-reward" },
    ];
    for (const tile of tiles) {
      panel.add(drawLayer(scene, tile.x, tileY, chipPoints(T.width, T.height, { bevel: { topLeft: 18, bottomRight: 18 } }), { fill: 0x1a1608, alpha: 0.9, edge: GREAT_SUCCESS_BADGE.fill, edgeWidth: 4, glow: { color: GREAT_SUCCESS_BADGE.fill, strength: 0.25 } }));
      const value = scene.add.text(0, tileY, tile.value, textStyle({ role: "display", size: T.value, color: S.color })).setOrigin(0.5).setStroke(S.stroke, 8);
      const total = T.icon + 14 + value.width;
      value.setX(tile.x - total / 2 + T.icon + 14 + value.width / 2);
      panel.add([drawGlyph(scene, tile.glyph, tile.x - total / 2 + T.icon / 2, tileY, T.icon, GREAT_SUCCESS_BADGE.fill), value]);
    }
    panel.add(body.setPosition(0, tileY + T.height / 2 + P.gap));
  });
}
