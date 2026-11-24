import Phaser from "phaser";
import { bakeKey, bakedCenteredImage } from "./bakedGraphics";
import { chipPoints, drawLayer } from "./holo";
import { COLOR, textStyle } from "./theme";
import { t } from "../i18n";
import { squeezeTextToWidth } from "./textFit";

/**
 * 꾸미기 보상 칸의 그림 — 재화 액자 안에 앉는 **수식어 이름표**와, 이미 가진 꾸미기의 「보유 중」 띠.
 *
 * 수식어는 그림이 없는 이름이라 영수증 밖 글 한 줄로 알리던 때는 재화 칸과 다른 물건으로 읽혔다. 액자 안에
 * 그 등급 색의 이름표를 세우면 「이름 하나를 받았다」가 다른 칸과 같은 문법으로 읽힌다. 이름은 칸 아래
 * 이름 줄이 적는다(칸 안에 적으면 158px 칸에서 글자가 읽히지 않는다).
 */
export const COSMETIC_ICON = {
  /** 이름표 몸통 — 액자 한 변에 대한 비율. */
  tag: { width: 0.66, height: 0.36, bevel: 0.1, angle: -12 },
  /** 「보유 중」 띠 — 액자 밑동에 걸터앉는다. */
  owned: { height: 0.2, size: 0.13, alpha: 0.9 },
} as const;

/** 등급 색 이름표 한 장 — 가운데가 (0, 0)이고 한 번만 구워 다시 쓴다. */
export function addModifierNameTag(scene: Phaser.Scene, size: number, color: number): Phaser.GameObjects.Image {
  const T = COSMETIC_ICON.tag;
  const w = Math.round(size * T.width);
  const h = Math.round(size * T.height);
  const half = Math.ceil(Math.hypot(w, h) / 2) + 8;
  const key = bakeKey("modifier-tag", [w, h, color]);
  const image = bakedCenteredImage(scene, key, half, (g) => {
    const point = h * 0.42;
    const left = -w / 2;
    const right = w / 2;
    const top = -h / 2;
    const bottom = h / 2;
    const bevel = Math.round(size * T.bevel);
    // 왼쪽이 뾰족한 꼬리표 — 꼭짓점 쪽에 끈 구멍이, 몸통에 이름 줄 두 개가 선다.
    const outline = [
      new Phaser.Geom.Point(left, 0),
      new Phaser.Geom.Point(left + point, top),
      new Phaser.Geom.Point(right - bevel, top),
      new Phaser.Geom.Point(right, top + bevel),
      new Phaser.Geom.Point(right, bottom),
      new Phaser.Geom.Point(left + point, bottom),
    ];
    g.fillStyle(0x000000, 0.45).fillPoints(outline.map((p) => new Phaser.Geom.Point(p.x + 3, p.y + 5)), true);
    g.fillStyle(0x0d1219, 1).fillPoints(outline, true);
    g.fillStyle(color, 0.22).fillPoints(outline, true);
    g.lineStyle(3, color, 1).strokePoints(outline, true, true);
    // 끈 구멍은 마름모로 뚫는다 — 원을 쓰지 않는 결이다.
    const holeX = left + point * 0.62;
    const r = Math.max(3, h * 0.11);
    const hole = [new Phaser.Geom.Point(holeX, -r), new Phaser.Geom.Point(holeX + r, 0), new Phaser.Geom.Point(holeX, r), new Phaser.Geom.Point(holeX - r, 0)];
    g.fillStyle(0x05070a, 1).fillPoints(hole, true);
    g.lineStyle(2, color, 0.9).strokePoints(hole, true, true);
    // 이름 줄 — 위는 등급 색으로 길게, 아래는 흰 줄로 짧게.
    const textLeft = left + point + w * 0.06;
    const lineH = Math.max(4, h * 0.13);
    g.fillStyle(color, 1).fillRect(textLeft, -h * 0.2 - lineH / 2, right - textLeft - w * 0.1, lineH);
    g.fillStyle(0xffffff, 0.6).fillRect(textLeft, h * 0.16 - lineH / 2, (right - textLeft) * 0.55, lineH * 0.8);
  });
  return image.setAngle(T.angle);
}

/** 이미 가진 꾸미기 — 액자 밑동에 어두운 띠 하나와 「보유 중」. 칸이 갈리지 않게 수량 자리를 대신한다. */
export function addOwnedCosmeticBand(scene: Phaser.Scene, size: number): Phaser.GameObjects.Container {
  const O = COSMETIC_ICON.owned;
  const band = scene.add.container(0, size / 2 - (size * O.height) / 2);
  const height = Math.round(size * O.height);
  band.add(drawLayer(scene, 0, 0, chipPoints(size * 0.86, height, { bevel: { topLeft: height * 0.4, topRight: 0, bottomRight: height * 0.4, bottomLeft: 0 } }), { fill: 0x05070a, alpha: O.alpha }));
  const label = scene.add.text(0, 0, t("reward.cosmetic.owned"), textStyle({ role: "emphasis", size: Math.round(size * O.size), color: COLOR.inkDim })).setOrigin(0.5);
  band.add(squeezeTextToWidth(label, size * 0.78, 0.6));
  return band;
}
