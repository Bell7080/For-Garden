import Phaser from "phaser";
import type { PurchaseThemeId } from "../core/purchaseTheme";
import { popupArtShape, popupBodyShapeMask } from "./popupArt";
import { PURCHASE_THEME_STYLE, type PurchaseThemeStyle } from "./purchaseThemeStyle";

/** 상품 줄 뒤에 조명이 모이는 중심(판 국소 좌표). */
const STAGE_Y = -150;

/** 납작한 마름모 꼭짓점 — 이 화면 전체가 동그라미 대신 쓰는 도형이다. */
function diamond(cx: number, cy: number, w: number, h: number): Phaser.Geom.Point[] {
  return [new Phaser.Geom.Point(cx, cy - h / 2), new Phaser.Geom.Point(cx + w / 2, cy), new Phaser.Geom.Point(cx, cy + h / 2), new Phaser.Geom.Point(cx - w / 2, cy)];
}

/**
 * 결제 팝업의 뒷배경 한 장. 팝업 몸판과 같은 실루엣으로 잘리고, 장식 코드는 테마의 `decor` 값 하나로 갈린다.
 *
 * 판에는 새 이미지를 쓰지 않는다 — 어두운 바탕 + 위에서 내려오는 조명 + 장식 한 종류가 전부다.
 * 난수는 쓰지 않고 번호에서 자리를 정해 같은 상품이 늘 같은 그림을 그린다.
 */
export function addPurchaseBackdrop(scene: Phaser.Scene, body: Phaser.GameObjects.Container, width: number, height: number, themeId: PurchaseThemeId): Phaser.GameObjects.Container {
  const style = PURCHASE_THEME_STYLE[themeId];
  const layer = scene.add.container(0, 0);
  const hw = width / 2; const hh = height / 2;
  const g = scene.add.graphics();
  layer.add(g);

  g.fillStyle(style.deep, 1).fillRect(-hw, -hh, width, height);
  paintLight(g, style, width, height);
  paintDecor(g, style, width, height);

  layer.setMask(popupBodyShapeMask(scene, body, popupArtShape(width, height)));
  return layer;
}

/** 위에서 내려와 상품 줄에서 가장 밝은 조명 — 좁은 사다리꼴 여러 겹을 포개 가장자리를 푼다. */
function paintLight(g: Phaser.GameObjects.Graphics, style: PurchaseThemeStyle, width: number, height: number): void {
  const hh = height / 2;
  for (let i = 0; i < 7; i += 1) {
    const spread = 150 + i * 70;
    g.fillStyle(style.light, 0.035);
    g.fillPoints([new Phaser.Geom.Point(-40 - i * 8, -hh), new Phaser.Geom.Point(40 + i * 8, -hh), new Phaser.Geom.Point(spread, STAGE_Y + 190), new Phaser.Geom.Point(-spread, STAGE_Y + 190)], true);
  }
  // 상품 줄 아래로 어둠이 깔리게 눌러 가격·버튼이 먼저 읽히게 한다.
  g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.55, 0.55);
  g.fillRect(-width / 2, STAGE_Y + 60, width, hh - STAGE_Y - 60);
}

function paintDecor(g: Phaser.GameObjects.Graphics, style: PurchaseThemeStyle, width: number, height: number): void {
  const hw = width / 2; const hh = height / 2;
  switch (style.decor) {
    case "strata": {
      // 지층 띠 — 아래로 갈수록 짙고 두꺼운 비스듬한 줄.
      for (let i = 0; i < 6; i += 1) {
        const top = hh - 40 - i * 34;
        g.fillStyle(i % 2 === 0 ? style.warm : style.accent, 0.10 + (5 - i) * 0.025);
        g.fillPoints([new Phaser.Geom.Point(-hw, top + 18), new Phaser.Geom.Point(hw, top - 18), new Phaser.Geom.Point(hw, top + 8), new Phaser.Geom.Point(-hw, top + 44)], true);
      }
      for (let i = 0; i < 9; i += 1) g.fillStyle(style.accent, 0.16).fillPoints(diamond(-hw + 90 + i * 112, STAGE_Y - 175 + (i % 3) * 20, 10, 16), true);
      break;
    }
    case "rays": {
      for (let i = 0; i < 16; i += 1) {
        const a = (i / 16) * Math.PI * 2; const b = a + 0.07;
        g.fillStyle(style.light, i % 2 === 0 ? 0.07 : 0.04);
        g.fillPoints([new Phaser.Geom.Point(0, STAGE_Y), new Phaser.Geom.Point(Math.cos(a) * 900, STAGE_Y + Math.sin(a) * 900), new Phaser.Geom.Point(Math.cos(b) * 900, STAGE_Y + Math.sin(b) * 900)], true);
      }
      for (let i = 0; i < 12; i += 1) {
        const x = -hw + 70 + ((i * 197) % (width - 140)); const y = -hh + 90 + ((i * 131) % (height - 300));
        g.fillStyle(style.light, 0.28).fillPoints(diamond(x, y, 10 + (i % 3) * 5, 26 + (i % 3) * 8), true);
        g.fillStyle(style.light, 0.28).fillPoints(diamond(x, y, 26 + (i % 3) * 8, 10 + (i % 3) * 5), true);
      }
      break;
    }
    case "coins": {
      // 바닥 양쪽에 납작한 마름모 더미가 쌓인 모양.
      for (const side of [-1, 1]) {
        for (let row = 0; row < 4; row += 1) {
          for (let col = 0; col < 5 - row; col += 1) {
            const x = side * (hw - 90 - col * 54 - row * 27);
            const y = hh - 30 - row * 20;
            g.fillStyle(row % 2 === 0 ? style.accent : style.warm, 0.34).fillPoints(diamond(x, y, 56, 24), true);
          }
        }
      }
      for (let i = 0; i < 10; i += 1) g.fillStyle(style.light, 0.25).fillPoints(diamond(-hw + 80 + ((i * 173) % (width - 160)), -hh + 120 + ((i * 89) % 260), 9, 18), true);
      break;
    }
    case "ribbons": {
      for (let i = 0; i < 2; i += 1) {
        const y0 = -hh + 160 + i * 380;
        g.fillStyle(i === 0 ? style.accent : style.warm, i === 0 ? 0.11 : 0.18);
        g.fillPoints([new Phaser.Geom.Point(-hw, y0 + 120), new Phaser.Geom.Point(hw, y0 - 120), new Phaser.Geom.Point(hw, y0 - 40), new Phaser.Geom.Point(-hw, y0 + 200)], true);
      }
      for (let i = 0; i < 8; i += 1) {
        const x = -hw + 80 + i * 118; const y = hh - 80 - (i % 2) * 18;
        g.lineStyle(4, style.accent, 0.3).strokePoints([new Phaser.Geom.Point(x - 16, y - 14), new Phaser.Geom.Point(x, y), new Phaser.Geom.Point(x - 16, y + 14)], false);
      }
      break;
    }
    case "brackets": {
      const arm = 70; const inset = 34;
      g.lineStyle(4, style.accent, 0.45);
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        const x = sx * (hw - inset); const y = sy * (hh - inset);
        g.strokePoints([new Phaser.Geom.Point(x - sx * arm, y), new Phaser.Geom.Point(x, y), new Phaser.Geom.Point(x, y - sy * arm)], false);
      }
      for (let i = 0; i < 7; i += 1) g.fillStyle(style.light, 0.14).fillPoints(diamond(-hw + 100 + i * 130, STAGE_Y - 165, 8, 14), true);
      break;
    }
  }
}
