import Phaser from "phaser";
import { motionPolicy } from "../core/settings";
import { transitionTiming, type TransitionMotion } from "../core/screenTransition";
import { session } from "../state/session";

/**
 * 화면이 갈리는 **한 가지 방법**.
 *
 * 도감은 카드가 촤르륵 깔리고 상점은 전시대가 올라오는데, 나머지 화면은 `scene.start`가 그냥
 * 툭 갈아 끼웠다 — 같은 손짓으로 들어가는데 어디는 연출이 있고 어디는 없으면, 있는 쪽이
 * 특별한 것이 아니라 **없는 쪽이 덜 만든 것으로** 읽힌다. 시간과 거리는 순수 규칙
 * (`core/screenTransition.ts`)이 갖고 여기서는 카메라에 먹이기만 한다.
 *
 * **조각마다 트윈을 걸지 않고 카메라 하나를 움직인다.** 화면에 선 것이 수십 개인데 그 전부에
 * 트윈을 걸면 화면이 늘 때마다 새로 만든 조각을 빠뜨리게 되고, 기하 마스크를 쓰는 것들은
 * (카드·목록) 자리를 옮기는 동안 마스크가 따라오지 못해 어긋난다. 카메라는 그 전부를 한 번에
 * 옮기고 마스크도 함께 지나간다.
 */

/** 지금 저장된 움직임 설정. 화면이 `reduceMotion`을 직접 읽지 않게 한다. */
function currentMotion(): TransitionMotion {
  return { factor: motionPolicy(session.settings).nonEssentialDistanceFactor };
}

/**
 * 씬이 들어오는 몫. `create`의 **맨 끝**에서 부른다.
 *
 * 먼저 부르면 그 뒤에 세운 것들이 이미 끝난 트윈 밖에 남아, 화면 절반만 떠오른다.
 */
export function playSceneEntrance(scene: Phaser.Scene): void {
  const timing = transitionTiming("sceneIn", currentMotion());
  const camera = scene.cameras.main;
  if (timing.duration === 0) { camera.setAlpha(1); camera.setScroll(camera.scrollX, 0); return; }
  camera.setAlpha(timing.alpha);
  // 음수 scrollY는 카메라가 그만큼 위를 보는 것이라, 화면의 내용은 그만큼 **아래에서** 시작한다.
  camera.setScroll(camera.scrollX, -timing.distance);
  scene.tweens.add({ targets: camera, alpha: 1, duration: timing.duration, ease: "Sine.easeOut" });
  scene.tweens.add({ targets: camera, scrollY: 0, duration: timing.duration, ease: "Cubic.easeOut" });
}

/**
 * 씬을 바꾼다. **`scene.start`를 직접 부르는 자리를 이것으로 바꾼다.**
 *
 * 지금 하는 일은 곧바로 갈아 끼우는 것뿐이고, 연출은 **들어오는 쪽**(`playSceneEntrance`)만
 * 맡는다 — 나가는 연출을 두려면 `scene.start`를 미뤄야 하는데 그 미룸이 화면 전환에 상한 없는
 * 기다림을 얹는다(이유는 `core/screenTransition.ts`의 `TRANSITION` 머리에 적어 두었다).
 *
 * 그래도 이 함수를 지나게 하는 이유는, 화면이 갈리는 자리가 **한 곳으로 모여 있어야** 다음에
 * 전환을 손볼 때 쉰다섯 곳을 다시 찾아다니지 않기 때문이다.
 */
export function startScene(scene: Phaser.Scene, key: string, data?: object): void {
  scene.scene.start(key, data);
}

/** 팝업 한 장이 열리는 몫. 판은 부풀어 오르고 층 전체가 밝아진다. */
export function playPopupOpen(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  body: Phaser.GameObjects.Container,
): void {
  const timing = transitionTiming("popupIn", currentMotion());
  if (timing.duration === 0) { layer.setAlpha(1); body.setScale(1); return; }
  layer.setAlpha(timing.alpha);
  // 판은 제 기울기를 갖고 있으므로 배율만 만진다 — `setScale`은 회전을 건드리지 않는다.
  body.setScale(timing.scale);
  scene.tweens.add({ targets: layer, alpha: 1, duration: Math.round(timing.duration * 0.76) });
  scene.tweens.add({ targets: body, scale: 1, duration: timing.duration, ease: "Back.easeOut", easeParams: [1.3] });
}

/**
 * 팝업 한 장이 닫히는 몫. **연출이 끝나면 `done`이 정확히 한 번 돈다.**
 *
 * 닫는 동안 판이 입력을 계속 받으면 사라지는 중인 버튼이 눌린다 — 트윈을 걸기 전에 그 층의
 * 입력을 통째로 끈다. 씬이 내려가는 중이라 트윈을 걸 수 없으면 기다리지 않고 곧바로 끝낸다.
 */
export function playPopupClose(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  body: Phaser.GameObjects.Container,
  done: () => void,
): void {
  const timing = transitionTiming("popupOut", currentMotion());
  if (timing.duration === 0 || !scene.sys.isActive() || !layer.active) { done(); return; }
  disableInput(layer);
  scene.tweens.add({ targets: layer, alpha: 0, duration: timing.duration, ease: "Sine.easeIn" });
  scene.tweens.add({
    targets: body, scale: timing.scale, duration: timing.duration, ease: "Quad.easeIn",
    onComplete: done,
  });
}

/**
 * 층 안의 입력을 전부 끈다.
 *
 * `Container.disableInteractive`는 **자기 자신만** 끄고 자식은 그대로 두므로, 판 위의 버튼은
 * 사라지는 동안에도 눌린다. 자식을 훑어 내려가며 끈다.
 */
function disableInput(object: Phaser.GameObjects.GameObject): void {
  if (object.input) object.disableInteractive();
  const container = object as Phaser.GameObjects.Container;
  if (Array.isArray(container.list)) for (const child of container.list) disableInput(child);
}
