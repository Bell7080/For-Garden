import Phaser from "phaser";
import { drawSparkle } from "./rouletteWheel";

/**
 * 델로피의 카드 그림 — 보물 찾기 창과 로비 이벤트 카드가 같은 뒷면을 쓴다(한쪽만 고치면 두 곳이 다른 카드가 된다).
 * 진홍·검정 줄무늬 커튼, 양피지 바탕, 금빛 열쇠와 마름모 카드의 결이다.
 */
export const DELO = { cream: 0xfff3da, ink: 0x2a1530, crimson: 0xb4233f, crimsonDeep: 0x7d1630, gold: 0xffd55e, goldDeep: 0xb07f12, shade: 0x2a1530 } as const;

/** 보물 찾기 전용 이벤트 코인 그림(`currencyIcons`) — 창과 로비 카드의 코인 비가 같은 그림이다. */
export const DELOPHY_COIN_ICON = "currency-delopi-thief-coin";

export const diamond = (cx: number, cy: number, rx: number, ry: number): Phaser.Geom.Point[] =>
  [new Phaser.Geom.Point(cx, cy - ry), new Phaser.Geom.Point(cx + rx, cy), new Phaser.Geom.Point(cx, cy + ry), new Phaser.Geom.Point(cx - rx, cy)];

/**
 * 카드의 뒷면 — 양피지 테두리 안에 진홍·검정 마름모 무늬(커튼·배경 카드와 같은 결), 가운데에 금빛 마름모 문장.
 * 모든 카드가 같아야 정체가 드러나지 않는다.
 */
export function paintBack(scene: Phaser.Scene, holder: Phaser.GameObjects.Container, width: number, height: number): void {
  holder.removeAll(true);
  const g = scene.add.graphics();
  const left = -width / 2, top = -height / 2, radius = Math.max(8, width * 0.06), rim = Math.max(8, width * 0.055);
  g.fillStyle(DELO.shade, 0.28).fillRoundedRect(left + 4, top + 10, width, height, radius);
  g.fillStyle(DELO.ink, 1).fillRoundedRect(left - 3, top - 3, width + 6, height + 6, radius + 3);
  g.fillStyle(DELO.cream, 1).fillRoundedRect(left, top, width, height, radius);
  const ix = left + rim, iy = top + rim, iw = width - rim * 2, ih = height - rim * 2;
  g.fillStyle(DELO.ink, 1).fillRect(ix, iy, iw, ih);
  // 마름모 격자 — 칸 안에 온전히 드는 것만 진홍으로 채운다(가장자리는 검정이 남아 틀이 된다).
  const cell = Math.max(24, Math.round(width * 0.2));
  const columns = Math.floor(iw / cell), rows = Math.floor(ih / cell);
  const offsetX = ix + (iw - columns * cell) / 2, offsetY = iy + (ih - rows * cell) / 2;
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
    g.fillStyle((row + column) % 2 === 0 ? DELO.crimson : DELO.crimsonDeep, 1)
      .fillPoints(diamond(offsetX + (column + 0.5) * cell, offsetY + (row + 0.5) * cell, cell * 0.5, cell * 0.5), true);
  }
  g.lineStyle(2, DELO.gold, 0.9).strokeRect(ix + 5, iy + 5, iw - 10, ih - 10);
  const er = Math.min(iw, ih) * 0.3;
  g.fillStyle(DELO.ink, 1).fillPoints(diamond(0, 0, er * 0.9, er * 1.2), true);
  g.fillStyle(DELO.gold, 1).fillPoints(diamond(0, 0, er * 0.78, er * 1.06), true);
  g.fillStyle(DELO.crimson, 1).fillPoints(diamond(0, 0, er * 0.44, er * 0.6), true);
  drawSparkle(g, 0, 0, er * 0.5, 0xffffff, 1);
  holder.add(g);
}

/**
 * 장식용 앞면 — 금테 양피지 안의 보랏빛 판에 보물 그림 한 장. 로비 카드에서 가끔 한 장이 뒤집혀 「이 안에 보물이 있다」를 말한다.
 * 수량은 적지 않는다(판을 열어야 보인다).
 */
export function paintTreasureFace(scene: Phaser.Scene, holder: Phaser.GameObjects.Container, width: number, height: number, iconKey: string): void {
  holder.removeAll(true);
  const g = scene.add.graphics();
  const left = -width / 2, top = -height / 2, radius = Math.max(8, width * 0.06), rim = Math.max(6, width * 0.055);
  g.fillStyle(DELO.shade, 0.28).fillRoundedRect(left + 4, top + 10, width, height, radius);
  g.fillStyle(DELO.gold, 1).fillRoundedRect(left - 3, top - 3, width + 6, height + 6, radius + 3);
  g.fillStyle(DELO.cream, 1).fillRoundedRect(left, top, width, height, radius);
  const ix = left + rim, iy = top + rim, iw = width - rim * 2, ih = height - rim * 2;
  g.fillStyle(0xd0b8f5, 0.85).fillRect(ix, iy, iw, ih);
  g.fillStyle(0x7a5cb8, 0.2).fillRect(ix, iy + ih * 0.62, iw, ih * 0.38);
  g.fillStyle(DELO.gold, 1).fillRect(ix, iy, iw, Math.max(5, ih * 0.05));
  g.fillStyle(0xffffff, 0.6).fillPoints(diamond(0, 0, iw * 0.46, ih * 0.34), true);
  holder.add(g);
  const size = Math.min(iw, ih) * 0.78;
  holder.add(scene.add.image(0, 0, iconKey).setDisplaySize(size, size));
  const sparkle = scene.add.graphics();
  drawSparkle(sparkle, left + width * 0.2, top + height * 0.22, width * 0.12, 0xffffff, 1);
  drawSparkle(sparkle, width * 0.3, height * 0.28, width * 0.09, 0xffe38a, 1);
  holder.add(sparkle);
}
