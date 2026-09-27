import type Phaser from "phaser";
import { formatCurrency } from "../core/formatCurrency";
import type { StageFirstClearReward } from "../core/stageRewards";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawLayer } from "./holo";
import { ITEM_FRAME, addFramedIcon } from "./itemFrame";
import { addRuneFrame } from "./runeIcons";
import { COLOR } from "./theme";

/**
 * 받은 보상 위의 덮개 — **검은 막 한 겹 + 노란 체크 하나**.
 *
 * 액자를 흐리게만 하면 "받을 수 없는 것"과 "이미 받은 것"이 같은 잿빛으로 읽힌다. 체크가 서야
 * 받은 것이라는 말이 된다. 막은 액자와 같은 깎인 칩이라 모서리 밖으로 새지 않는다.
 */
export const STAGE_REWARD_CLAIMED = { dim: 0.62, check: 0.62 } as const;

/**
 * 초회 클리어 보상 한 칸 — 노드 미리보기와 결과판이 같은 한 장을 쓴다.
 *
 * 재화는 공용 액자(`addFramedIcon`), 룬은 등급·자리 조각을 담는 룬 액자(`addRuneFrame`)다 — 룬
 * 조각은 캔버스의 서로 다른 자리를 쓰므로 재화 액자에 그대로 넣으면 한쪽으로 쏠려 작게 앉는다.
 * 수량은 룬에는 적지 않는다(늘 한 장이다).
 */
export function addStageRewardFrame(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  size: number,
  reward: StageFirstClearReward,
  options: { claimed?: boolean } = {},
): Phaser.GameObjects.Container {
  let holder: Phaser.GameObjects.Container;
  if (reward.kind === "rune") {
    holder = addRuneFrame(scene, x, y, size, reward.rarity, reward.part);
    parent.add(holder);
  } else {
    holder = addFramedIcon(scene, parent, x, y, size, CURRENCY_ICON_BY_WALLET[reward.currency], { amount: formatCurrency(reward.amount) });
  }
  if (options.claimed) {
    // 룬 액자는 깎임이 한 뼘 얕다(`addRuneFrame`) — 같은 깎임으로 덮어야 막이 모서리 밖으로 새지 않는다.
    const bevel = size * (reward.kind === "rune" ? 0.2 : ITEM_FRAME.bevel);
    const shape = chipPoints(size, size, { bevel: { topLeft: bevel, topRight: 0, bottomRight: bevel, bottomLeft: 0 } });
    holder.add(drawLayer(scene, 0, 0, shape, { fill: 0x000000, alpha: STAGE_REWARD_CLAIMED.dim }));
    // 체크에도 검은 그림자를 한 겹 — 밝은 재화 그림 위에서도 노란 획이 떨어져 보이게 한다.
    holder.add(drawGlyph(scene, "check", 3, 4, size * STAGE_REWARD_CLAIMED.check, 0x000000, 0.7));
    holder.add(drawGlyph(scene, "check", 0, 0, size * STAGE_REWARD_CLAIMED.check, COLOR.accent));
  }
  return holder;
}
