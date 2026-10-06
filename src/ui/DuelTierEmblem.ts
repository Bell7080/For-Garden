import Phaser from "phaser";
import type { DuelTierId } from "../core/duelArena";
import { duelDivisionNumeral } from "../core/duelArena";
import { DUEL_TIER_COLOR } from "./duelLayout";
import { drawLayer } from "./holo";
import { textStyle } from "./theme";

/**
 * 티어 표식 — 마름모 두 겹과 단계 로마자.
 *
 * 전용 문장(紋章) 원화가 오기 전까지 서는 **자리표시**다. 원화가 오면 이 함수 안만 갈아 끼우면 되도록
 * 결투장 화면·티어 안내·순위표가 모두 이 한 함수를 부른다. 동그라미를 쓰지 않는다(화면 규칙).
 */
export function addDuelTierEmblem(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container | undefined,
  x: number,
  y: number,
  size: number,
  tierId: DuelTierId,
  division: number | null = null,
): Phaser.GameObjects.Container {
  const tone = DUEL_TIER_COLOR[tierId];
  const emblem = scene.add.container(x, y);
  const diamond = (scale: number): number[] => {
    const w = (size / 2) * scale; const h = (size / 2) * scale * 1.08;
    return [0, -h, w * 0.92, -h * 0.06, 0, h, -w, h * 0.06];
  };
  emblem.add(drawLayer(scene, 0, 0, diamond(1), { fill: 0x05070a, alpha: 0.86, glow: { color: tone.fill, strength: 0.5 } }));
  emblem.add(drawLayer(scene, 0, 0, diamond(0.78), { fill: tone.fill, alpha: 0.88, shadow: false, sheen: 0.07 }));
  emblem.add(drawLayer(scene, 0, 0, diamond(0.46), { fill: 0x05070a, alpha: 0.55, shadow: false }));
  const numeral = duelDivisionNumeral(division);
  if (numeral) {
    emblem.add(scene.add.text(0, 0, numeral, textStyle({ role: "display", size: Math.round(size * 0.22), color: tone.text }))
      .setOrigin(0.5).setShadow(0, 2, "#05070a", 4, false, true));
  }
  parent?.add(emblem);
  return emblem;
}
