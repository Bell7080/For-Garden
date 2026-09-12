import Phaser from "phaser";
import { formatCurrency } from "../core/formatCurrency";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { chipPoints, drawFrameVignette, drawHairline, drawLayer, slantedRect } from "./holo";
import { addFramedIcon } from "./itemFrame";
import type { TradePackageCardMetrics } from "./tradePackageLayout";
import type { TradePackageView } from "./tradePopupModel";
import { COLOR, textStyle } from "./theme";

/** 로컬 좌표 도형을 지금의 월드 좌표로 옮긴다. 팝업 안에서 마스크가 엉뚱한 자리에 남지 않게 한다. */
function worldPoints(matrix: Phaser.GameObjects.Components.TransformMatrix, flat: readonly number[]): Phaser.Geom.Point[] {
  const points: Phaser.Geom.Point[] = [];
  for (let index = 0; index < flat.length; index += 2) {
    const point = matrix.transformPoint(flat[index], flat[index + 1]);
    points.push(new Phaser.Geom.Point(point.x, point.y));
  }
  return points;
}

/**
 * 카드 한 장이 쓰는 겹의 값.
 *
 * **패키지는 줄이 아니라 물건이다.** 예전 무역의 교환 줄은 유리면 한 겹에 글자만 얹혀 있어
 * 어디까지가 한 건인지 줄 간격으로 짐작해야 했다. 전시장의 카드는 뒤로 어둠이 두 겹 번지고,
 * 면 위쪽이 강조색으로 물들고, 네 변이 안쪽으로 눌리고, 왼쪽에 두꺼운 빗금이 서고, 값 배지가
 * 제 판을 갖는다 — 겹이 쌓여야 눌러서 살 수 있는 물건으로 읽힌다.
 */
const CARD = {
  /** 모서리 깎임(짧은 변 대비). 팝업 몸판과 같은 결로 왼쪽 위·오른쪽 아래만 깎는다. */
  bevel: 0.13,
  fill: 0x121a25,
  fillAlpha: 0.95,
  /** 뒤로 번지는 어둠. 같은 도형을 조금씩 키워 아래로 밀어 두 겹 깐다. */
  shadow: [{ grow: 14, offsetY: 10, alpha: 0.34 }, { grow: 30, offsetY: 20, alpha: 0.18 }],
  /** 면 위쪽만 물들이는 강조색 발광과 유리 광택. */
  glow: { strength: 0.3, height: 0.62 },
  sheen: 0.05,
  vignette: { strength: 0.58, spread: 0.24 },
  /** 왼쪽 세로 빗금. 카드를 판이 아니라 물건으로 만드는 한 겹이다. */
  rail: { width: 10, inset: 14, alpha: 0.85 },
  /** 가치 배지 판. */
  badge: { width: 176, height: 54, alpha: 0.26 },
  /** 소진된 패키지는 지우지 않고 눌러 둔다 — 다음 갱신에 무엇이 돌아오는지 남아야 한다. */
  soldOutAlpha: 0.52,
  pressScale: 1.03,
} as const;

export interface TradePackageCardOptions {
  metrics: TradePackageCardMetrics;
  view: TradePackageView;
  onClick: () => void;
}

/**
 * 무역 전시장의 패키지 한 장.
 *
 * **카드 자체가 버튼이다.** 옆에 「교환하기」를 세우면 눌러야 하는 것이 줄 오른쪽 끝의 작은
 * 사각형이 되어, 전시된 물건이 아니라 목록의 한 줄이 된다. 누르면 카드가 커지고 구매 확인판이
 * 열린다.
 */
export class TradePackageCard extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, options: TradePackageCardOptions) {
    super(scene, x, y);
    const { metrics, view } = options;
    const { width, height } = metrics;
    const unit = Math.min(width, height);
    const bevel = unit * CARD.bevel;
    const shape = chipPoints(width, height, { bevel: { topLeft: bevel, topRight: 0, bottomRight: bevel, bottomLeft: 0 } });
    const accent = view.soldOut ? COLOR.inkDimHex : COLOR.accent;

    // ① 뒤로 번지는 어둠 두 겹. 도형으로 그림자를 그리면 카드와 무관한 네모가 남으므로 같은
    // 그림을 조금씩 키워 검게 깐다.
    for (const { grow, offsetY, alpha } of CARD.shadow) {
      const spread = chipPoints(width + grow, height + grow, {
        bevel: { topLeft: bevel, topRight: 0, bottomRight: bevel, bottomLeft: 0 },
      });
      this.add(drawLayer(scene, 0, offsetY, spread, { fill: 0x000000, alpha, shadow: false }));
    }
    // ② 몸판. 윗변 한 줄만 긋고 사방 테두리는 두르지 않는다.
    this.add(drawLayer(scene, 0, 0, shape, {
      fill: CARD.fill, alpha: CARD.fillAlpha, sheen: CARD.sheen,
      glow: { color: accent, strength: view.soldOut ? 0.16 : CARD.glow.strength, height: CARD.glow.height },
      edge: accent, edgeAlpha: view.soldOut ? 0.35 : 0.9, edgeWidth: 3,
    }));
    // ③ 네 변 비네팅. 줄여 가며 두르는 옛 비네트는 가로로 긴 카드에서 검은 잔상을 남기므로
    // 쓰지 않고, 칩 밖으로 새지 않도록 카드의 월드 도형으로 마스킹한다.
    const maskGraphics = scene.make.graphics({});
    const syncMask = (): void => {
      if (!this.active || !maskGraphics.active) return;
      maskGraphics.clear().fillStyle(0xffffff, 1).fillPoints(worldPoints(this.getWorldTransformMatrix(), shape), true);
    };
    scene.events.on(Phaser.Scenes.Events.PRE_RENDER, syncMask);
    syncMask();
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.PRE_RENDER, syncMask);
      maskGraphics.destroy();
    });
    this.add(drawFrameVignette(scene, 0, 0, width, height, CARD.vignette).setMask(maskGraphics.createGeometryMask()));
    // ④ 왼쪽 빗금 한 줄. 제목표의 빗금과 같은 결로 카드를 세로로 잡아 준다.
    this.add(drawLayer(scene, metrics.left - CARD.rail.inset, 0, slantedRect(CARD.rail.width, height * 0.62), {
      fill: accent, alpha: CARD.rail.alpha, shadow: false,
    }));

    // 이름은 카드에서 가장 먼저 읽히는 이름표다.
    this.add(scene.add.text(metrics.left, metrics.nameY, view.name, textStyle({ role: "display", size: 34, color: view.soldOut ? COLOR.inkDim : COLOR.ink }))
      .setOrigin(0, 0.5)
      .setShadow(3, 4, "#04060a", 0, true, true));
    // 가치 배지는 제 판을 갖는다 — 이 화면의 존재 이유가 "따로 사는 것보다 더 준다"이기 때문에,
    // 맨 글자로 두면 이름과 같은 무게로 읽힌다.
    if (view.valueLabel) {
      const badgeX = metrics.right - CARD.badge.width / 2;
      this.add(drawLayer(scene, badgeX, metrics.valueY, slantedRect(CARD.badge.width, CARD.badge.height), {
        fill: accent, alpha: CARD.badge.alpha, edge: accent, edgeAlpha: view.soldOut ? 0.4 : 0.95,
      }));
      this.add(scene.add.text(badgeX, metrics.valueY, view.valueLabel, textStyle({ role: "display", size: 28, color: view.soldOut ? COLOR.inkDim : COLOR.accentText }))
        .setOrigin(0.5)
        .setShadow(2, 3, "#04060a", 0, true, true));
    }
    this.add(drawHairline(scene, 0, metrics.hairlineY, width - 56, { color: accent, alpha: view.soldOut ? 0.18 : 0.34 }));

    // 받는 것은 어디서나 같은 공용 액자 한 장이 그린다. 수량도 그 액자의 우하단에 선다.
    const centers = metrics.frameCenters(view.grants.length);
    view.grants.forEach((grant, index) => {
      addFramedIcon(this.scene, this, centers[index], metrics.frameY, metrics.frameSize, CURRENCY_ICON_BY_WALLET[grant.currency], {
        amount: formatCurrency(grant.amount),
        iconAlpha: view.soldOut ? 0.6 : 1,
        color: accent,
      });
    });

    // 비용은 아이콘과 수를 바짝 붙여 한 덩어리로 읽히게 한다.
    if (view.cost) {
      const iconKey = CURRENCY_ICON_BY_WALLET[view.cost.currency];
      let cursor = metrics.left;
      if (scene.textures.exists(iconKey)) {
        this.add(scene.add.image(cursor + 19, metrics.costY, iconKey).setDisplaySize(38, 38).setAlpha(view.soldOut ? 0.6 : 1));
        cursor += 44;
      }
      this.add(scene.add.text(cursor, metrics.costY, formatCurrency(view.cost.amount), textStyle({ role: "display", size: 32, color: view.soldOut ? COLOR.inkDim : COLOR.ink }))
        .setOrigin(0, 0.5)
        .setShadow(3, 4, "#04060a", 0, true, true));
    }
    // 왜 지금 못 사는지는 제한 줄이 그대로 말한다(`소진`). 개발 상태 문구를 따로 적지 않는다.
    this.add(scene.add.text(metrics.right, metrics.limitY, view.limitLabel, textStyle({ role: "emphasis", size: 22, color: view.soldOut ? COLOR.dangerText : COLOR.inkDim }))
      .setOrigin(1, 0.5)
      .setShadow(2, 3, "#04060a", 0, true, true));

    if (view.soldOut) this.setAlpha(CARD.soldOutAlpha);
    // 투명 입력면 하나가 카드를 통째로 확대해 공용 버튼과 같은 눌림을 낸다. 조각마다 배율을
    // 주면 `setDisplaySize`로 세운 아이콘이 제 배율을 잃는다.
    if (!view.soldOut) {
      const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
      this.add(hit);
      hit.on("pointerdown", () => this.setScale(CARD.pressScale));
      hit.on("pointerout", () => this.setScale(1));
      hit.on("pointerup", () => { this.setScale(1); options.onClick(); });
    }
    scene.add.existing(this);
  }
}
