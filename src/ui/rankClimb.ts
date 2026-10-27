import Phaser from "phaser";
import { motionPolicy } from "../core/settings";
import { rankClimbFrames } from "../core/scoreRanking";
import { session } from "../state/session";

/** 오르는 연출 전체가 걸리는 시간(ms). 순위가 몇이든 이 안에 끝난다 — 길게 끌수록 결과를 보려는 손이 기다린다. */
export const RANK_CLIMB_MS = 1100;

/**
 * 순위 숫자를 `from`에서 `to`까지 **위로 슉슉 올려** 보인다 — 한 칸 넘을 때마다 숫자가 부풀었다 가라앉는다.
 * 숫자 목록은 `rankClimbFrames`가 정하고 여기서는 그리기만 한다. 움직임 줄이기에서는 곧바로 최종 값에 선다.
 * 첫 구간의 기다림은 씬 시계가 아니라 트윈의 `delay`다 — 결과판이 서는 전투 화면에서는 `delayedCall`이 깨어나지 않았다.
 */
export function playRankClimb(scene: Phaser.Scene, text: Phaser.GameObjects.Text, from: number, to: number, format: (rank: number) => string, startDelay = 350): void {
  const frames = rankClimbFrames(from, to);
  text.setText(format(frames[0]));
  if (frames.length <= 1 || motionPolicy(session.settings).nonEssentialDistanceFactor <= 0) { text.setText(format(frames[frames.length - 1])); return; }
  const step = RANK_CLIMB_MS / frames.length;
  frames.forEach((rank, index) => {
    if (index === 0) return;
    const last = index === frames.length - 1;
    scene.tweens.add({
      targets: text, scale: { from: last ? 1.5 : 1.25, to: 1 }, delay: startDelay + index * step, duration: Math.max(120, step * 0.9), ease: "Back.easeOut",
      onStart: () => text.setText(format(rank)),
    });
  });
}
