import Phaser from "phaser";
import { ROULETTE_REWARDS } from "../core/roulette";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import type { EventCardPuppet } from "./eventCardSd";
import { shapeClipMask } from "./popupArt";
import { addCurrencyRain, addRouletteWheel } from "./rouletteWheel";

export interface RouletteCardShowcaseSpec {
  width: number;
  height: number;
  radius: number;
  /** 바퀴 가운데의 x(카드 가운데 기준). 가운데의 y는 늘 카드 밑변이라 바퀴는 위 절반만 솟는다. */
  x: number;
  /** SD가 바퀴를 미는 간격(ms). */
  pushMs: number;
  rain: { count: number; size: number; alpha: number; fallMs: number };
}

/**
 * 이벤트 카드의 행운의 돌림판 장면 — 카드 밑변에서 반쯤 솟은 바퀴와 그 위로 내리는 재화. 모두 카드 실루엣 안에서만
 * 그려진다(기하 마스크는 카드의 월드 자리를 매 프레임 따라간다). 원화·어둠 위, 제목 글 아래 층이다.
 *
 * 메론(SD)이 도착하면 `attachPusher`로 넘겨받아, 가끔 바퀴 쪽으로 기울며 밀고 그때마다 바퀴가 한 칸 넘어간다 —
 * "옆에서 바퀴를 뱅뱅 돌리는" 몸짓이다. 움직임 줄이기에서는 바퀴도 메론도 멈춰 선다.
 */
export function addRouletteCardShowcase(
  scene: Phaser.Scene,
  card: Phaser.GameObjects.Container,
  shape: readonly number[],
  spec: RouletteCardShowcaseSpec,
): { attachPusher: (puppet: EventCardPuppet) => void } {
  const stage = scene.add.container(0, 0);
  card.add(stage);
  stage.setMask(shapeClipMask(scene, card, shape));
  addCurrencyRain(scene, stage, { left: -spec.width / 2 + 20, right: spec.width / 2 - 20, top: -spec.height / 2, bottom: spec.height / 2, ...spec.rain });
  const parts = addRouletteWheel(scene, stage, spec.x, spec.height / 2, { radius: spec.radius, amounts: false, bulbs: 14 });
  card.once(Phaser.GameObjects.Events.DESTROY, () => parts.destroy());
  const step = 360 / ROULETTE_REWARDS.length;
  return {
    attachPusher: (puppet) => {
      if (motionPolicy(session.settings).nonEssentialRepeatFactor <= 0) return;
      const restX = puppet.x;
      const push = scene.time.addEvent({ delay: spec.pushMs, loop: true, callback: () => {
        if (!card.active || !puppet.active) return;
        scene.tweens.add({ targets: puppet, angle: -7, x: restX - 12, duration: 160, yoyo: true, ease: "Sine.InOut" });
        scene.tweens.add({ targets: parts.wheel, angle: parts.wheel.angle + step, duration: 560, delay: 110, ease: "Back.Out", onUpdate: parts.sync });
      } });
      card.once(Phaser.GameObjects.Events.DESTROY, () => push.remove());
    },
  };
}
