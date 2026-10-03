import Phaser from "phaser";
import { formatCurrency } from "../core/formatCurrency";
import { addPriceBar } from "./priceTag";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { drawHairline, drawLayer, slantedRect } from "./holo";
import { paintShowcaseCard, SHOWCASE_TIER_TONE } from "./showcaseCardChrome";
import { addFramedIcon } from "./itemFrame";
import type { TradePackageCardMetrics } from "./tradePackageLayout";
import type { TradePackageView } from "./tradePopupModel";
import { COLOR, textStyle } from "./theme";
import { pressIn, pressOut } from "./pressFeedback";
import { t } from "../i18n";

/**
 * 카드 안쪽 값. 겉모습(그림자·몸판·빛줄기·비네트·빗금·꼬리표)은 프리미엄과 같은 한 벌
 * (`paintShowcaseCard`)이라 여기에는 무역 카드만의 배지·소진 값만 남는다.
 */
const CARD = {
  /** 소진된 패키지는 지우지 않고 눌러 둔다 — 다음 갱신에 무엇이 돌아오는지 남아야 한다. */
  soldOutAlpha: 0.52,
  /** 가치 배지 — 판 위에서 가장 뜨거운 색이라 화면을 연 순간 "얼마나 이득인가"가 먼저 걸린다. */
  hotBadge: { width: 196, height: 62, size: 30, pulse: 1.06 },
} as const;

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
    const accent = view.soldOut ? COLOR.inkDimHex : SHOWCASE_TIER_TONE[view.refresh];
    paintShowcaseCard(scene, this, { width, height, accent, dim: view.soldOut, railX: metrics.left, tag: view.tag });

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
