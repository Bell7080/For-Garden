import type Phaser from "phaser";
import { addExpiryDaysTag, addExpiryTag } from "./itemExpiry";
import { rewardItemExpiry, type RewardPopupItem } from "./rewardPopupModel";

/** 가방과 같은 표식을 보상 액자의 왼쪽 위에 올린다. */
export function addRewardExpiryTag(scene: Phaser.Scene, holder: Phaser.GameObjects.Container, size: number, item: RewardPopupItem): void {
  const expiry = rewardItemExpiry(item);
  if (!expiry) return;
  const edge = -size / 2 + 4;
  const tag = "expiresAt" in expiry
    ? addExpiryTag(scene, edge, edge, expiry.expiresAt)
    : addExpiryDaysTag(scene, edge, edge, expiry.days);
  holder.add(tag.setScale(Math.min(1, size / 140)));
}
