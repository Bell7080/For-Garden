import Phaser from "phaser";
import { t } from "../i18n";
import { session } from "../state/session";
import { chipPoints, drawLayer } from "./holo";
import { COLOR, textStyle } from "./theme";

/**
 * 남은 구매 횟수를 다 쓴 칸의 매진 표식 — 반투명 검은 막 위에 「매진」 도장이 **쿵** 찍힌다.
 *
 * 칸을 지우지 않고 눌러 둔다: 다음 갱신에 무엇이 돌아오는지 남아야 한다. 막은 칸과 같은 깎인 모양이고(네모로
 * 덮으면 깎인 모서리 밖으로 새어 나간다), 도장은 크게 들어와 제 크기로 박힌다. 움직임 줄이기에서는 곧바로 선다.
 */
export const SOLD_OUT_STAMP = { dim: 0.58, size: 58, tilt: -0.2, startScale: 2.4, durationMs: 170 } as const;

/**
 * 도장이 이미 찍힌 상품의 기억 — 메모리에만 둔다(저장하지 않는다). 탭을 오가거나 선반을 다시 그릴 때마다 쿵 찍히면
 * 새로 팔린 것처럼 읽히므로, 처음 찍은 뒤에는 이미 찍힌 채로 선다. 다시 살 수 있게 되면 잊어 다음 매진에 또 찍힌다.
 */
const stampedProducts = new Set<string>();

export function forgetSoldOutStamp(key: string): void {
  stampedProducts.delete(key);
}

export function addSoldOutStamp(scene: Phaser.Scene, card: Phaser.GameObjects.Container, width: number, height: number, bevel: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number }, key: string): void {
  card.add(drawLayer(scene, 0, 0, chipPoints(width, height, { bevel }), { fill: 0x000000, alpha: SOLD_OUT_STAMP.dim, shadow: false }));
  const stamp = scene.add.container(0, 0);
  const label = scene.add.text(0, 0, t("trade.soldOut"), textStyle({ role: "display", size: SOLD_OUT_STAMP.size, color: COLOR.dangerText })).setOrigin(0.5).setStroke("#1a0606", 6);
  const box = scene.add.graphics();
  box.lineStyle(6, 0xe07a7a, 0.95);
  box.strokeRect(-label.width / 2 - 22, -label.height / 2 - 8, label.width + 44, label.height + 16);
  stamp.add([box, label]);
  stamp.setRotation(SOLD_OUT_STAMP.tilt);
  card.add(stamp);
  const already = stampedProducts.has(key);
  stampedProducts.add(key);
  if (already || session.settings.accessibility.reduceMotion) return;
  stamp.setScale(SOLD_OUT_STAMP.startScale).setAlpha(0);
  scene.tweens.add({ targets: stamp, scale: 1, alpha: 1, duration: SOLD_OUT_STAMP.durationMs, ease: "Quad.In" });
}

/** 남은 구매 횟수 글자 — 얇은 회색이라 묻히던 것을 한 뼘 키우고 밝히며 얇은 검은 획으로 배경에서 뗀다. */
export function styleLimitCount(text: Phaser.GameObjects.Text, soldOut: boolean): Phaser.GameObjects.Text {
  return text.setColor(soldOut ? COLOR.dangerText : COLOR.ink).setStroke("#05070a", 3);
}

/**
 * 상품 상태 딱지 — 「구매 완료」·「구독 중」·「수령 완료」·「매진」을 카드 가운데에 비스듬히 붙인다.
 *
 * 카드 전체를 덮는 도장(`addSoldOutStamp`)과 달리 막을 깔지 않는다: 딱지를 붙이는 쪽이 카드를 흐리게 할지 정한다
 * (이용 중인 구독은 흐리지 않는다). 처음 붙는 순간만 쿵 찍히고, 다시 그릴 때는 이미 붙은 채로 선다.
 */
export const STATUS_STICKER = { size: 54, tilt: -0.12, startScale: 2.2, durationMs: 170, padX: 26, padY: 10 } as const;
const stickedProducts = new Set<string>();

export function addStatusSticker(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, label: string, tone: { text: string; line: number }, key: string): Phaser.GameObjects.Container {
  const sticker = scene.add.container(x, y);
  const text = scene.add.text(0, 0, label, textStyle({ role: "display", size: STATUS_STICKER.size, color: tone.text })).setOrigin(0.5).setStroke("#05070a", 6);
  const w = text.width + STATUS_STICKER.padX * 2;
  const h = text.height + STATUS_STICKER.padY * 2;
  const plate = scene.add.graphics();
  plate.fillStyle(0x05070a, 0.78).fillRect(-w / 2, -h / 2, w, h);
  plate.lineStyle(6, tone.line, 0.95).strokeRect(-w / 2, -h / 2, w, h);
  sticker.add([plate, text]);
  sticker.setRotation(STATUS_STICKER.tilt);
  parent.add(sticker);
  const already = stickedProducts.has(key);
  stickedProducts.add(key);
  if (already || session.settings.accessibility.reduceMotion) return sticker;
  sticker.setScale(STATUS_STICKER.startScale).setAlpha(0);
  scene.tweens.add({ targets: sticker, scale: 1, alpha: 1, duration: STATUS_STICKER.durationMs, ease: "Quad.In" });
  return sticker;
}

/** 상품이 다시 살 수 있게 되면 그 상품의 딱지 기억을 잊어 다음 상태 변화에 또 쿵 찍히게 한다. */
export function forgetStatusStickers(productId: string): void {
  for (const key of [...stickedProducts]) if (key.startsWith(`${productId}:`)) stickedProducts.delete(key);
}
