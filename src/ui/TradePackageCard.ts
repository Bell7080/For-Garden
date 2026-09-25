import Phaser from "phaser";
import { formatCurrency } from "../core/formatCurrency";
import { addPriceBar } from "./priceTag";
import type { ProductRefresh } from "../data/products";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { chipPoints, drawFrameVignette, drawHairline, drawLayer, slantedRect } from "./holo";
import { addFramedIcon } from "./itemFrame";
import type { TradePackageCardMetrics } from "./tradePackageLayout";
import type { TradePackageView } from "./tradePopupModel";
import { COLOR, textStyle } from "./theme";
import { pressIn, pressOut } from "./pressFeedback";
import { t } from "../i18n";

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
  /** 카드 왼쪽 위에 스티커처럼 걸린 꼬리표 — 이 묶음이 얼마나 드문 기회인지를 먼저 말한다. */
  tag: { height: 46, padX: 26, overhangY: 18, size: 24 },
  /** 가치 배지 — 판 위에서 가장 뜨거운 색이라 화면을 연 순간 "얼마나 이득인가"가 먼저 걸린다. */
  hotBadge: { width: 196, height: 62, size: 30, pulse: 1.06 },
  /** 몸판을 비스듬히 가로지르는 빛줄기 두 가닥 — 포장된 상품의 광택이다. */
  streaks: [{ x: 0.18, width: 46, alpha: 0.06 }, { x: 0.3, width: 16, alpha: 0.05 }],
} as const;

/**
 * **갱신 주기가 카드의 색이다.** 계정당 한 번뿐인 것은 금빛, 주마다 열리는 것은 푸른빛, 매일
 * 열리는 것은 초록빛 — 한 번뿐인 것일수록 따뜻하고 귀한 색이라, 글자를 읽기 전에 어느 카드가
 * 놓치면 안 되는 것인지 보인다.
 */
const TIER_TONE: Readonly<Record<ProductRefresh, number>> = {
  once: 0xe0a83e, weekly: 0x7fb4ec, monthly: 0xb48ce0, daily: 0x6fc47f, none: 0xd8b978,
};
/** 가치 배지의 뜨거운 색. 출격 강조색과 같은 계열이다. */
const HOT = 0xe0603a;

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
    const accent = view.soldOut ? COLOR.inkDimHex : TIER_TONE[view.refresh];

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
    // 비스듬한 빛줄기. 몸판 도형 안에서만 보이도록 아래 비네트와 같은 마스크를 쓴다.
    const streaks = scene.add.graphics();
    for (const streak of CARD.streaks) {
      const x = -width / 2 + width * streak.x;
      streaks.fillStyle(0xffffff, view.soldOut ? streak.alpha / 2 : streak.alpha);
      streaks.fillPoints([
        new Phaser.Geom.Point(x + height * 0.5, -height / 2), new Phaser.Geom.Point(x + height * 0.5 + streak.width, -height / 2),
        new Phaser.Geom.Point(x - height * 0.5 + streak.width, height / 2), new Phaser.Geom.Point(x - height * 0.5, height / 2),
      ], true);
    }
    this.add(streaks);
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
    const cardMask = maskGraphics.createGeometryMask();
    streaks.setMask(cardMask);
    this.add(drawFrameVignette(scene, 0, 0, width, height, CARD.vignette).setMask(cardMask));
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
      const { hotBadge } = CARD;
      const badgeX = metrics.right - hotBadge.width / 2 + 8;
      const badge = scene.add.container(badgeX, metrics.valueY);
      const tone = view.soldOut ? COLOR.inkDimHex : HOT;
      badge.add(drawLayer(scene, 0, 0, slantedRect(hotBadge.width, hotBadge.height, 18), { fill: tone, alpha: view.soldOut ? 0.3 : 0.92, edge: 0xffd9a0, edgeAlpha: view.soldOut ? 0.2 : 0.9 }));
      badge.add(scene.add.text(0, 1, view.valueLabel, textStyle({ role: "display", size: hotBadge.size, color: view.soldOut ? COLOR.inkDim : "#fff4e0" }))
        .setOrigin(0.5)
        .setShadow(2, 3, "#3a0d00", 0, true, true));
      this.add(badge);
      // 살 수 있는 동안만 배지가 느리게 숨 쉰다 — 목록에 서 있는 여러 장 중 무엇이 특가인지 눈이 먼저 간다.
      if (!view.soldOut) scene.tweens.add({ targets: badge, scale: hotBadge.pulse, duration: 760, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }
    // 꼬리표 — 카드 윗변에 걸터앉은 스티커. 윗변 밖으로 한 뼘 올라가 판에 붙인 것처럼 읽힌다.
    {
      const { tag } = CARD;
      const label = scene.add.text(0, 0, view.tag, textStyle({ role: "display", size: tag.size, color: view.soldOut ? COLOR.inkDim : "#101418" })).setOrigin(0.5);
      const tagWidth = label.width + tag.padX * 2;
      const tagX = metrics.left + tagWidth / 2 + 10;
      const tagY = -height / 2 - tag.overhangY;
      this.add(drawLayer(scene, tagX, tagY, slantedRect(tagWidth, tag.height, 14), { fill: accent, alpha: view.soldOut ? 0.45 : 1 }));
      this.add(label.setPosition(tagX, tagY + 1));
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

    // **값은 카드 가운데에 판 한 장으로 선다** — 구매 확인판의 값 줄과 같은 양식이라(`addPriceBar`)
    // 눌러서 열어도 방금 보던 표기가 그대로 이어진다. 이름표는 비운다: 이 줄이 말하는 것이
    // 값 하나뿐이라 그림과 수가 판 가운데로 모인다.
    if (view.cost) {
      addPriceBar(scene, this, 0, metrics.costY, metrics.costWidth, undefined, view.cost.currency, view.cost.amount, {
        height: metrics.costHeight,
        iconAlpha: view.soldOut ? 0.6 : 1,
      });
      // **원가는 그어 지운 채 값 줄 왼쪽에 선다.** 가치 %만으로는 "무엇의 몇 %인가"를 셈해야 하는데,
      // 두 숫자가 나란히 서면 싸다는 것이 계산 없이 보인다.
      if (view.originalCost !== undefined && view.originalCost > view.cost.amount) {
        const original = scene.add.text(-metrics.costWidth / 2 - 26, metrics.costY, formatCurrency(view.originalCost), textStyle({ role: "display", size: 30, color: COLOR.inkDim }))
          .setOrigin(1, 0.5)
          .setShadow(2, 3, "#04060a", 0, true, true);
        const strike = scene.add.graphics();
        strike.lineStyle(4, HOT, view.soldOut ? 0.4 : 0.95);
        strike.lineBetween(original.x - original.width - 6, metrics.costY + 8, original.x + 6, metrics.costY - 8);
        this.add([original, strike]);
      }
    }
    // 왜 지금 못 사는지는 제한 줄이 그대로 말한다(`소진`). 개발 상태 문구를 따로 적지 않는다.
    this.add(scene.add.text(metrics.right, metrics.limitY, view.limitLabel, textStyle({ role: "emphasis", size: 22, color: view.soldOut ? COLOR.dangerText : COLOR.inkDim }))
      .setOrigin(1, 0.5)
      .setShadow(2, 3, "#04060a", 0, true, true));

    if (view.soldOut) {
      this.setAlpha(CARD.soldOutAlpha);
      // 매진은 흐려지는 것만으로 두지 않고 도장을 한 번 찍는다 — 흐린 카드는 "로딩 중"과 구별되지 않는다.
      const stamp = scene.add.container(0, metrics.frameY);
      stamp.add(drawLayer(scene, 0, 0, slantedRect(300, 76, 20), { fill: 0x2a0c0c, alpha: 0.85, edge: COLOR.danger, edgeAlpha: 1 }));
      stamp.add(scene.add.text(0, 1, t("trade.soldOut"), textStyle({ role: "display", size: 40, color: COLOR.dangerText })).setOrigin(0.5));
      stamp.setRotation(-0.12);
      this.add(stamp);
    }
    // 투명 입력면 하나가 카드를 통째로 확대해 공용 버튼과 같은 눌림을 낸다. 조각마다 배율을
    // 주면 `setDisplaySize`로 세운 아이콘이 제 배율을 잃는다.
    if (!view.soldOut) {
      const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
      this.add(hit);
      hit.on("pointerdown", () => pressIn(this));
      hit.on("pointerout", () => pressOut(this, "normal", { pop: false }));
      hit.on("pointerup", () => { pressOut(this); options.onClick(); });
    }
    scene.add.existing(this);
  }
}
