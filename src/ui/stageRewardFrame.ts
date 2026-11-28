import type Phaser from "phaser";
import { formatCurrency } from "../core/formatCurrency";
import type { StageFirstClearReward } from "../core/stageRewards";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawLayer } from "./holo";
import { ITEM_FRAME, addFramedIcon } from "./itemFrame";
import { addRuneFrame } from "./runeIcons";
import { COLOR, textStyle } from "./theme";
import { STORY_PREVIEW } from "./nodeEnemyPreviewLayout";

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
    // 막에는 그림자를 깔지 않는다 — 판때기 기본 그림자(오른쪽 아래로 민 검은 복제)가 막 위에 한 겹 더 서면
    // 액자 밖으로 검은 조각이 튀어나와, 막이 액자 앞에 떠 있는 것처럼 보였다.
    holder.add(drawLayer(scene, 0, 0, shape, { fill: 0x000000, alpha: STAGE_REWARD_CLAIMED.dim, shadow: false }));
    // 체크에도 검은 그림자를 한 겹 — 밝은 재화 그림 위에서도 노란 획이 떨어져 보이게 한다.
    holder.add(drawGlyph(scene, "check", 3, 4, size * STAGE_REWARD_CLAIMED.check, 0x000000, 0.7));
    holder.add(drawGlyph(scene, "check", 0, 0, size * STAGE_REWARD_CLAIMED.check, COLOR.accent));
  }
  return holder;
}

/**
 * 보상 줄의 이름표 칩 — 왼쪽 위·오른쪽 아래만 깎인 판(화면 전체의 실루엣)에 글자를 얹는다. 초회는 강조색으로
 * 채워 판 맨 아래에서도 먼저 읽히고, 반복은 어두운 유리에 흐린 강조선만 둘러 한 단계 가볍다.
 * 전투 관문 판과 서브 이야기 판이 같은 한 장을 쓴다 — 두 판의 보상 줄이 같은 양식으로 읽혀야 한다.
 */
export function addStageRewardTag(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, left: number, centerY: number, label: string, kind: "first" | "repeat"): void {
  const first = kind === "first";
  const spec = STORY_PREVIEW;
  const height = spec.reward.tag.height;
  const style = first
    ? textStyle({ role: "display", size: spec.reward.labelSize, color: "#1a1205" })
    : textStyle({ role: "emphasis", size: spec.reward.labelSize, color: COLOR.ink });
  const text = scene.add.text(0, centerY, label, style).setOrigin(0, 0.5);
  const width = text.width + spec.reward.tag.padX * 2 + (first ? 18 : 0);
  const bevel = spec.reward.tag.bevel;
  parent.add(drawLayer(scene, left + width / 2, centerY, chipPoints(width, height, { bevel: { topLeft: bevel, bottomRight: bevel } }), first
    ? { fill: COLOR.accent, alpha: 0.96, shadow: { x: 3, y: 4 } }
    : { fill: 0x1a222c, alpha: 0.95, edge: COLOR.accent, edgeAlpha: 0.4, shadow: { x: 3, y: 4 } }));
  if (first) {
    // 제목표와 같은 빗금이 이름표 왼쪽에 서서 「보상」이라는 한 덩어리를 판에 묶는다.
    parent.add(scene.add.text(left + spec.reward.tag.padX - 2, centerY, "/", textStyle({ role: "display", size: spec.reward.labelSize + 4, color: "#5a3e0c" })).setOrigin(0, 0.5));
  }
  text.setX(left + spec.reward.tag.padX + (first ? 18 : 0));
  parent.add(text);
}
