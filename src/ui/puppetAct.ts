import Phaser from "phaser";
import type { DialogueAct } from "../core/dialogue";
import type { PuppetCreature } from "../puppets/assets";
import { audioManager } from "../managers/AudioManager";
import { DIALOGUE_ACTS, DIALOGUE_ACT_FILL, DIALOGUE_ACT_GLOW, actGlowSteps } from "./dialogueStageLayout";

/**
 * 몸 전체를 옮기는 **몸짓** 한 번(통통·뽀용·띠용·부들부들).
 *
 * 대사 화면의 스탠딩이 먼저 쓰던 것을 로비의 애착 렐릭도 함께 쓴다 — 같은 「통통」이 화면마다
 * 다른 높이·다른 박자로 뛰면 같은 몸짓으로 읽히지 않는다. 걸음 표는 `DIALOGUE_ACTS` 하나가 갖는다.
 *
 * **제자리에서 시작해 제자리로 끝난다.** 앞 몸짓이 남아 있으면 부르는 쪽이 `stop`으로 끊고 다시
 * 부른다. 몸짓 동안 idle은 멈춘다 — 몸이 뛰는 동안 팔다리가 따로 흔들리면 한 동작으로 읽히지 않는다.
 */
export interface PuppetActRest {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  /**
   * 눌리고 늘어날 때 **그대로 둘 바닥까지의 거리**(월드 px, 개체의 기준점 아래). 0이면 기준점에서
   * 눌린다 — 허리 아래가 잠긴 대사 스탠딩은 0이고, 발끝까지 서 있는 로비 전신은 발이 들리지 않게 준다.
   */
  readonly floorOffset?: number;
  /**
   * 눌림·늘어남을 얼마나 살릴지(기본 1). 상반신만 보이는 대사 스탠딩 기준의 표라, 발끝까지 화면을 채운 로비
   * 전신에 그대로 먹이면 0.7배 눌림이 키의 삼분의 일을 꺼뜨려 머리가 화면 가운데까지 내려앉는다.
   */
  readonly scaleAmount?: number;
}

export interface PuppetActHandle {
  /** 도는 몸짓을 끊는다. 멈춘 idle·눌린 배율·덮인 색을 되돌린다(자리는 다음 몸짓이나 부르는 쪽이 맞춘다). */
  stop(): void;
}

/**
 * 몸짓을 튼다. `factor`는 움직임 줄이기 배율이다 — 위치와 배율의 변화폭을 함께 줄이고, 색은 움직임이
 * 아니라 남긴다. 끝나면 `onComplete`가 한 번 돈다(끊겼을 때는 돌지 않는다).
 */
export function playPuppetAct(
  scene: Phaser.Scene,
  creature: PuppetCreature,
  rest: PuppetActRest,
  act: DialogueAct,
  factor: number,
  onComplete?: () => void,
): PuppetActHandle {
  creature.setPosition(rest.x, rest.y);
  creature.setAnimationFrozen(true);
  const steps = DIALOGUE_ACTS[act];
  const floor = rest.floorOffset ?? 0;
  const squish = factor * (rest.scaleAmount ?? 1);
  // 통통 뛰는 몸짓만 소리를 낸다 — 끄덕·부들까지 울리면 몸짓마다 소리가 붙어 시끄럽다.
  if (act === "hop" || act === "hopTwice") audioManager?.playSfx("story.hop");
  let running = true;
  const motion = scene.tweens.chain({
    targets: creature,
    tweens: steps.map((step) => {
      const sy = 1 + ((step.sy ?? 1) - 1) * squish;
      return {
        x: rest.x + step.dx * factor,
        // 세로로 눌린 만큼 바닥을 그 자리에 붙잡는다.
        y: rest.y + step.dy * factor + floor * (1 - sy),
        scaleX: rest.scale * (1 + ((step.sx ?? 1) - 1) * squish),
        scaleY: rest.scale * sy,
        duration: step.ms,
        ease: step.ease,
      };
    }),
    onComplete: () => {
      running = false;
      if (!creature.active) return;
      creature.setPosition(rest.x, rest.y).setScale(rest.scale).setAnimationFrozen(false);
      onComplete?.();
    },
  });
  const color = DIALOGUE_ACT_FILL[act];
  let fill: Phaser.Tweens.TweenChain | undefined;
  if (color !== undefined) {
    const proxy = { amount: 0 };
    fill = scene.tweens.chain({
      targets: proxy,
      tweens: steps.map((step) => ({
        amount: step.fill ?? 0,
        duration: step.ms,
        ease: step.ease === "Back.Out" ? "Quad.Out" : step.ease,
        onUpdate: () => { if (creature.active) paintActGlow(creature, color, proxy.amount); },
      })),
      onComplete: () => {
        fill = undefined;
        if (creature.active) paintActGlow(creature, color, 0);
      },
    });
  }
  return {
    stop: () => {
      const interrupted = running || fill !== undefined;
      motion.stop();
      fill?.stop();
      fill = undefined;
      running = false;
      if (!creature.active) return;
      creature.setAnimationFrozen(false);
      if (!interrupted) return;
      creature.setScale(rest.scale);
      creature.setBodyFill(0xffffff, 0);
      creature.setAfterimages([]);
    },
  };
}

/** 감정 몸짓의 색 — 몸에는 옅게만 덮고 둘레에 빛을 번지게 한다. */
function paintActGlow(creature: PuppetCreature, color: number, amount: number): void {
  creature.setBodyFill(color, amount * DIALOGUE_ACT_GLOW.bodyShare);
  creature.setAfterimages(actGlowSteps(color, amount));
}
