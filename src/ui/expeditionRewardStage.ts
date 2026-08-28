import Phaser from "phaser";
import type { ExpeditionRewardStageDto } from "../api/contracts";
import { RewardFrame } from "./RewardFrame";
import { chipPoints, drawLayer, HoloBar, HOLO } from "./holo";
import { COLOR, textStyle } from "./theme";

/** 누적 보상 한 줄의 고정 규격이다. 기록판과 보상 팝업이 같은 표를 읽는다. */
export const EXPEDITION_REWARD_STAGE = { width: 820, height: 140, barWidth: 500 } as const;

/**
 * 누적 피해 단계 한 줄.
 *
 * 임계값·진행도·보상·수령 상태는 서버가 준 값 그대로 그린다. 화면이 달라도 같은 줄로 읽혀야
 * 하므로 결과 화면의 기록판과 랭킹 화면의 보상 팝업이 이 함수 하나를 공유한다.
 */
export function addExpeditionRewardStage(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  stage: ExpeditionRewardStageDto,
  cumulativeScore: number,
  y: number,
  onClaim?: (stageId: string) => void,
): void {
  const earned = cumulativeScore >= stage.threshold;
  const claimable = earned && !stage.claimed;
  const { width, height, barWidth } = EXPEDITION_REWARD_STAGE;
  const panel = drawLayer(scene, 0, y, chipPoints(width, height), { fill: claimable ? 0x3b2b13 : 0x171d25, alpha: stage.claimed ? 0.5 : HOLO.glass, edge: claimable ? COLOR.sortie : COLOR.accent, edgeAlpha: 0.5 });
  const label = scene.add.text(-370, y - 40, `${stage.threshold.toLocaleString()} 누적 피해`, textStyle({ role: "emphasis", size: 24, color: stage.claimed ? COLOR.inkDim : COLOR.ink })).setOrigin(0, 0.5);
  const bar = new HoloBar(scene, -120, y + 34, barWidth, 16, { color: claimable ? COLOR.sortie : COLOR.accent, trackAlpha: 0.82, outline: true }).addTo(parent);
  bar.setValue(cumulativeScore / Math.max(1, stage.threshold));
  const progress = scene.add.text(-370, y + 34, `${Math.min(cumulativeScore, stage.threshold).toLocaleString()} / ${stage.threshold.toLocaleString()}`, textStyle({ role: "body", size: 18, color: COLOR.inkDim })).setOrigin(0, 0.5);
  const icon = `currency-${stage.reward.currency}` as "currency-gold" | "currency-fossil" | "currency-gems";
  const reward = new RewardFrame(scene, 320, y, { icon, amount: stage.reward.amount, size: 100, state: stage.claimed ? "claimed" : claimable ? "claimable" : "normal", onClick: claimable && onClaim ? () => onClaim(stage.id) : undefined });
  parent.add([panel, label, progress, reward]);
}
