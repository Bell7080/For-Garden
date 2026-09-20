import Phaser from "phaser";
import { motionPolicy } from "../core/settings";
import { sceneHandoffDelay, transitionTiming, type TransitionMotion } from "../core/screenTransition";
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
 * 나가는 연출이 다 끝나기 전에 다음 씬을 시작한다(`sceneHandoffDelay`) — 완전히 사라진 뒤에
 * 갈아 끼우면 그 사이 검은 화면이 한 프레임 보이고, 다음 씬이 무거우면 그 준비 시간이 전환
 * 뒤에 **더해진다.**
 *
 * **이 씬이 이미 나가는 중이면 두 번째 부름은 버린다.** 전환 중에 같은 버튼이 다시 눌리면
 * `scene.start`가 두 번 돌아 `create`가 겹쳐 실행된다.
 */
export function startScene(scene: Phaser.Scene, key: string, data?: object): void {
  if (LEAVING.has(scene)) return;
  const motion = currentMotion();
  const timing = transitionTiming("sceneOut", motion);
  const begin = (): void => { LEAVING.delete(scene); scene.scene.start(key, data); };
  if (timing.duration === 0) { begin(); return; }
  LEAVING.add(scene);
  // **떠나다 만 씬을 그대로 두지 않는다.** 연출이 도는 사이에 다른 길로 화면이 갈리면 예약해 둔
  // `begin`은 씬과 함께 지워지는데, 표식만 남으면 그 씬은 **다시 들어와도 영영 나가지 못한다**
  // (다음 `startScene`이 맨 앞에서 되돌아간다). 씬이 내려가는 순간 표식도 함께 뗀다.
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => LEAVING.delete(scene));
  const camera = scene.cameras.main;
  scene.tweens.add({ targets: camera, alpha: timing.alpha, duration: timing.duration, ease: "Sine.easeIn" });
  scene.tweens.add({ targets: camera, scrollY: camera.scrollY + timing.distance, duration: timing.duration, ease: "Cubic.easeIn" });
  scene.time.delayedCall(sceneHandoffDelay(motion), begin);
}

/**
 * 지금 나가는 중인 씬들.
 *
 * 씬 인스턴스는 재시작해도 **같은 객체**라, 나가는 중인지를 필드에 두면 다음 진입까지 살아남는다.
 * 약한 참조로 들고 있다가 실제로 갈아 끼우는 순간 지운다.
 */
const LEAVING = new WeakSet<Phaser.Scene>();

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
