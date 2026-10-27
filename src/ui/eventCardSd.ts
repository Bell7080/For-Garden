import Phaser from "phaser";
import { powerSavingPolicy } from "../core/settings";
import { session } from "../state/session";
import { sdAssetFor, spawnPuppet } from "../puppets/assets";
import { sortieEntrySdSpot } from "./ExpeditionEntryButton";
import { shapesClipMask } from "./popupArt";

export type EventCardPuppet = Awaited<ReturnType<typeof spawnPuppet>>;

/**
 * 이벤트 카드 칸에 SD 한 기를 세운다. 출격판과 같은 자리 규칙(`sortieEntrySdSpot`)이고, 몸은 칸 안에 갇히며 머리만
 * 윗변 밖 띠로 빠져나온다. 장식이라 입력을 받지 않는다 — 그래서 마스크를 거는 일을 카드(입력면을 가진 쪽)와 갈라 둔다.
 */
export function spawnEventCardSd(
  scene: Phaser.Scene,
  owner: Phaser.GameObjects.Container,
  relicId: string,
  side: "left" | "right",
  card: { width: number; height: number; shape: number[]; bevel: number; scale: number; inset?: number },
): Promise<EventCardPuppet> {
  const spot = sortieEntrySdSpot(card.width, card.height, side, card.inset);
  // 띠는 윗변 아래로 깎인 모서리 깊이만큼 더 내려간다 — 그러지 않으면 `/`로 잘린 모서리가 머리 옆을 벤다.
  const top = -card.height / 2;
  const bandBottom = top + card.bevel;
  const band = [
    spot.x - spot.bandWidth / 2, top - spot.overhang, spot.x + spot.bandWidth / 2, top - spot.overhang,
    spot.x + spot.bandWidth / 2, bandBottom, spot.x - spot.bandWidth / 2, bandBottom,
  ];
  const mask = shapesClipMask(scene, owner, [card.shape, band]);
  return spawnPuppet(scene, sdAssetFor(relicId), { x: spot.x, groundY: spot.groundY, height: Math.round(spot.height * card.scale), depth: 0, flipX: side === "right" })
    .then((puppet) => {
      puppet.disableInteractive();
      puppet.setDecorativeUpdateFactor(powerSavingPolicy(session.settings).idlePuppetUpdateFactor);
      puppet.setMask(mask);
      return puppet;
    });
}
