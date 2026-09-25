import Phaser from "phaser";
import { motionPolicy } from "../core/settings";
import { settingsManager } from "../managers/SettingsManager";
import { PRESS_FEEDBACK, type PressTier } from "./pressFeedbackStyle";

/**
 * **누르는 연출은 여기 한 곳이 소유한다.** 프리팹과 씬은 손이 닿는 순간 `pressIn`, 떼거나
 * 벗어나는 순간 `pressOut`만 부르고 배율·시간을 고르지 않는다(값은 `pressFeedbackStyle.ts`).
 *
 * 제자리 배율은 **처음 눌린 순간의 배율**을 기억한다. 켜진 탭·궁극기 준비 카드처럼 제자리가
 * 1이 아닌 것도 누른 뒤 그 크기로 돌아와야 하기 때문이다 — 1로 되돌리면 켜진 탭이 눌릴 때마다
 * 작아진 채 남는다. 제자리 자체가 바뀌면 `setPressRest`로 알린다.
 */
type Pressable = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform;

interface PressState {
  rest: number;
  pressed: boolean;
  tween?: Phaser.Tweens.Tween | Phaser.Tweens.TweenChain;
}

const STATES = new WeakMap<Pressable, PressState>();

function stateOf(target: Pressable): PressState {
  let state = STATES.get(target);
  if (!state) {
    const created: PressState = { rest: target.scaleX, pressed: false };
    state = created;
    STATES.set(target, created);
    // 판이 닫히는 사이 도는 tween이 죽은 객체를 붙잡지 않게 한다.
    target.once(Phaser.GameObjects.Events.DESTROY, () => { created.tween?.remove(); created.tween = undefined; });
  }
  return state;
}

function reduced(): boolean {
  return motionPolicy(settingsManager.get()).nonEssentialRepeatFactor === 0;
}

function stop(state: PressState): void {
  state.tween?.remove();
  state.tween = undefined;
}

/** 손이 닿았다. 제자리에서 살짝 눌려 들어간다. */
export function pressIn(target: Pressable, tier: PressTier = "normal"): void {
  if (!target.active || !target.scene) return;
  const state = stateOf(target);
  // 튕겨 돌아오는 중이 아니고 눌려 있지도 않을 때만 지금 배율을 제자리로 삼는다.
  if (!state.pressed && !state.tween) state.rest = target.scaleX;
  state.pressed = true;
  stop(state);
  const spec = PRESS_FEEDBACK.tiers[tier];
  state.tween = target.scene.tweens.add({ targets: target, scale: state.rest * spec.down, duration: spec.downMs, ease: "Quad.Out" });
}

/**
 * 손이 떨어졌다. 한 번 튕겼다가 제자리로 돌아온다. 취소(벗어남)는 `pop: false`로 튕김 없이 돌아온다 —
 * 누르지 않은 조작이 눌린 것처럼 튀면 무엇이 일어났는지 헷갈린다.
 */
export function pressOut(target: Pressable, tier: PressTier = "normal", options: { pop?: boolean } = {}): void {
  const state = STATES.get(target);
  if (!state || !state.pressed || !target.active || !target.scene) return;
  state.pressed = false;
  stop(state);
  const spec = PRESS_FEEDBACK.tiers[tier];
  const done = (): void => { if (state.tween) state.tween = undefined; };
  if (options.pop === false || reduced()) {
    state.tween = target.scene.tweens.add({ targets: target, scale: state.rest, duration: PRESS_FEEDBACK.reducedReturnMs, ease: "Quad.Out", onComplete: done });
    return;
  }
  state.tween = target.scene.tweens.chain({
    targets: target,
    tweens: [
      { scale: state.rest * spec.pop, duration: spec.popMs * 0.4, ease: "Quad.Out" },
      { scale: state.rest, duration: spec.popMs * 0.6, ease: "Back.Out" },
    ],
    onComplete: done,
  });
}

/** 제자리 배율이 바뀌었다(켜진 탭·준비된 카드). 눌려 있지 않으면 곧바로 그 크기로 선다. */
export function setPressRest(target: Pressable, scale: number): void {
  const state = stateOf(target);
  state.rest = scale;
  if (!state.pressed) { stop(state); target.setScale(scale); }
}
