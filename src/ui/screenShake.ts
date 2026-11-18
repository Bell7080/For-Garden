import Phaser from "phaser";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";

/**
 * 화면 흔들림의 단일 출입구다.
 *
 * 설정의 「화면 흔들림」·「움직임 줄이기」는 `motionPolicy().cameraShakeFactor` 하나로 접힌다. 흔드는 자리는
 * 이 함수를 부르고 강도를 곱하지 않는다. 그래도 직접 `camera.shake`를 부르는 자리가 생길 수 있으므로,
 * `installScreenShakeGate`가 Phaser 쪽에서 「꺼짐」을 한 번 더 막는다 — 끈 사람에게 흔들림이 새지 않는다.
 */
export function shakeCamera(camera: Phaser.Cameras.Scene2D.Camera, duration: number, intensity: number, force = false): void {
  const factor = motionPolicy(session.settings).cameraShakeFactor;
  if (factor <= 0) return;
  camera.shake(duration, intensity * factor, force);
}

let installed = false;

/** 「화면 흔들림」을 끄면 어떤 길로 부른 흔들림도 시작하지 않는다. 한 번만 건다. */
export function installScreenShakeGate(): void {
  if (installed) return;
  installed = true;
  const proto = Phaser.Cameras.Scene2D.Effects.Shake.prototype as unknown as { start: (...args: unknown[]) => unknown };
  const original = proto.start;
  proto.start = function gatedShake(this: { camera: unknown }, ...args: unknown[]) {
    if (!session.settings.presentation.screenShake) return this.camera;
    return original.apply(this, args);
  };
}
