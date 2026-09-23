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
  // 같은 화면을 **다시 그린 것**이면 들어오는 연출을 돌리지 않는다(`restartScene`).
  if (pendingRefreshKey !== undefined && pendingRefreshKey === scene.scene.key) {
    pendingRefreshKey = undefined;
    pendingNavDirection = undefined;
    scene.cameras.main.setAlpha(1);
    return;
  }
  // 핵심 화면 다섯 사이를 오간 것이면 그 방향으로 **옆에서** 들어온다.
  const direction = consumeNavDirection();
  const timing = transitionTiming(direction ? "navSwitch" : "sceneIn", currentMotion());
  const camera = scene.cameras.main;
  const baseX = camera.scrollX;
  if (timing.duration === 0) { camera.setAlpha(1); camera.setScroll(baseX, 0); return; }
  camera.setAlpha(timing.alpha);
  if (direction) {
    /*
     * 카메라가 왼쪽을 보면 내용은 그만큼 **오른쪽에서** 시작한다. 오른쪽 탭으로 간 손
     * (`+1`)에게는 새 화면이 오른쪽에서 밀려 들어오는 것이 맞다.
     */
    camera.setScroll(baseX - timing.distance * direction, 0);
    scene.tweens.add({ targets: camera, scrollX: baseX, duration: timing.duration, ease: "Cubic.easeOut" });
  } else {
    // 음수 scrollY는 카메라가 그만큼 위를 보는 것이라, 화면의 내용은 그만큼 **아래에서** 시작한다.
    camera.setScroll(baseX, -timing.distance);
    scene.tweens.add({ targets: camera, scrollY: 0, duration: timing.duration, ease: "Cubic.easeOut" });
  }
  scene.tweens.add({ targets: camera, alpha: 1, duration: timing.duration, ease: "Sine.easeOut" });
}

/**
 * 다음 화면이 **어느 쪽에서** 들어올지.
 *
 * 들어오는 씬은 제가 어디서 왔는지 모른다 — 그 앞의 화면은 이미 죽었고, Phaser의 진입 데이터로
 * 넘기려면 다섯 씬이 저마다 `init`에서 그 값을 받아 `playSceneEntrance`까지 들고 가야 한다.
 * 화면이 갈리는 일을 이 파일 하나가 맡는 이유가 바로 그것이라, 방향도 여기서 들고 있다가
 * **읽는 순간 비운다.** 비우지 않으면 다음에 다른 길로 들어온 화면까지 옆으로 밀려 들어온다.
 */
let pendingNavDirection: -1 | 1 | undefined;

function consumeNavDirection(): -1 | 1 | undefined {
  const direction = pendingNavDirection;
  pendingNavDirection = undefined;
  return direction;
}

/**
 * 핵심 화면 다섯 사이를 오간다. 하단 탭과 좌우로 미는 손이 같은 문을 쓴다.
 *
 * 방향을 함께 받는 이유는 그것이 **연출이 아니라 자리**이기 때문이다 — 오른쪽 탭으로 갔으면
 * 새 화면은 오른쪽에서 들어와야 그 화면이 줄의 어디에 있는지 손이 기억한다.
 */
export function startNavScene(scene: Phaser.Scene, key: string, direction: -1 | 0 | 1): void {
  pendingNavDirection = direction === 0 ? undefined : direction;
  startScene(scene, key);
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
  pendingRefreshKey = undefined;
  scene.scene.start(key, data);
}

/**
 * 같은 화면을 새 데이터로 **다시 그린다** — 탭을 바꾸거나 서버 응답으로 판을 갈아 끼울 때.
 *
 * `scene.restart`를 직접 부르면 `create` 끝의 `playSceneEntrance`가 들어오는 연출을 또 돌려,
 * 탭 하나를 눌렀을 뿐인데 화면이 한 뼘 아래에서 다시 떠오르며 **새로고침된 것처럼** 읽혔다
 * (환경설정 탭·원정 지도가 그랬다). 같은 씬 안에서 **다른 자리로 가는** 것(레이드 목록 → 판)은
 * 화면이 실제로 바뀌므로 `startScene`을 쓰고 연출을 그대로 둔다.
 */
export function restartScene(scene: Phaser.Scene, data?: object): void {
  pendingRefreshKey = scene.scene.key;
  scene.scene.restart(data);
}

/**
 * 다시 그리는 중인 화면의 키. `playSceneEntrance`가 **읽는 순간 비운다** — 비우지 않으면 한참 뒤
 * 다른 길로 그 화면에 들어왔을 때도 연출이 빠진다. 다른 화면으로 가는 `startScene`도 비운다.
 */
let pendingRefreshKey: string | undefined;

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
