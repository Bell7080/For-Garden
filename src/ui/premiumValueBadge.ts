import Phaser from "phaser";
import type { ProductDto } from "../api/contracts";
import { PREMIUM_GEM_PER_KRW } from "../data/premiumProducts";
import { premiumDiscountPercent, premiumValueMultiple } from "../core/premiumValue";
import { t } from "../i18n";
import { drawLayer, slantedRect } from "./holo";
import { textStyle } from "./theme";

const BADGE = { height: 44, size: 24, gap: 10, pad: 22, slant: 12 } as const;

/** 가치 배수 문장. 배지와 구매 확인판이 같은 글자를 읽는다. */
export function premiumValueLabel(product: Pick<ProductDto, "acquisition" | "grants" | "passBenefit" | "premiumCategory">): string | undefined {
  const multiple = premiumValueMultiple(product, PREMIUM_GEM_PER_KRW);
  return multiple === undefined ? undefined : t("shop.premium.valueMultiple", { multiple: `${Math.round(multiple * 100)}%` });
}

/**
 * 카드 우상단에 서는 배지 줄 — 오른쪽 끝에 가치 배수(주황), 그 왼쪽에 할인율(붉은색).
 * 둘 다 해당이 없으면 아무것도 세우지 않는다. `right`·`top`은 컨테이너 국소 좌표다.
 */
export function addPremiumValueBadges(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, product: ProductDto, right: number, top: number): void {
  const entries: { text: string; fill: number }[] = [];
  const discount = premiumDiscountPercent(product);
  if (discount !== undefined) entries.push({ text: t("lab.pull.discount", { percent: discount }), fill: 0xc2362f });
  const value = premiumValueLabel(product);
  if (value !== undefined) entries.push({ text: value, fill: 0xe0603a });
  let cursor = right;
  for (const entry of entries.reverse()) {
    const label = scene.add.text(0, 1, entry.text, textStyle({ role: "display", size: BADGE.size, color: "#fff4e0" })).setOrigin(0.5).setShadow(2, 3, "#3a0d00", 0, true, true);
    const width = label.width + BADGE.pad * 2;
    const badge = scene.add.container(cursor - width / 2, top + BADGE.height / 2);
    badge.add(drawLayer(scene, 0, 0, slantedRect(width, BADGE.height, BADGE.slant), { fill: entry.fill, alpha: 0.92, edge: 0xffd9a0, edgeAlpha: 0.9 }));
    badge.add(label);
    parent.add(badge);
    cursor -= width + BADGE.gap;
  }
}

/** 값 칸 안에 정가를 긋고 서는 작은 글자. 값 글자 왼쪽에 놓는다. */
export function addListPrice(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, text: string, size: number): void {
  const label = scene.add.text(x, y, text, textStyle({ role: "emphasis", size, color: "#8a94a0" })).setOrigin(0.5).setStroke("#000000", 4);
  parent.add(label);
  parent.add(scene.add.rectangle(x, y, label.width + 6, 3, 0xd8dde3, 0.9));
}
