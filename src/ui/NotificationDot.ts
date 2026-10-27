import Phaser from "phaser";
import { notificationManager } from "../managers/NotificationManager";
import { NOTIFICATION_DOT_STYLE, rotatedNotificationAnchor, type NotificationAnchorOptions } from "./notificationDotStyle";
export { NOTIFICATION_DOT_STYLE } from "./notificationDotStyle";

export interface NotificationDotOptions extends NotificationAnchorOptions {
  /** 대상 컨테이너 원점 기준 앵커만 받으며 색·크기는 화면에서 바꿀 수 없다. */
  x: number;
  y: number;
}

/** 숫자 없이 붉은 원·흰 외곽선·짙은 그림자를 한곳에서 그리는 공용 프리팹이다. */
export class NotificationDot extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, target: Phaser.GameObjects.Container, options: NotificationDotOptions) {
    // super 호출 전에 this를 만들 수 없으므로 같은 순수 계산의 두 축을 생성자 인자로 바로 넘긴다.
    super(scene, rotatedNotificationAnchor(options).x, rotatedNotificationAnchor(options).y);
    const style = NOTIFICATION_DOT_STYLE;
    // 그림자를 아래로 분리해 밝고 복잡한 로비 원화에서도 흰 외곽선이 묻히지 않게 한다.
    this.add(scene.add.circle(0, style.shadowOffsetY, style.radius + 2, style.shadow, style.shadowAlpha));
    this.add(scene.add.circle(0, 0, style.radius, style.fill).setStrokeStyle(style.outlineWidth, style.outline, 1));
    target.add(this);
  }
}

/** 상태가 해소되면 점 자체를 파괴하고 다시 켜질 때만 새 프리팹을 만든다. */
export function bindNotificationDot(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Container,
  options: NotificationDotOptions,
  subscribe: (listener: (visible: boolean) => void) => () => void,
): () => void {
  watchNotificationClock(scene);
  let dot: NotificationDot | undefined;
  const unsubscribe = subscribe((visible) => {
    // create 도중에 구독하면 첫 값이 곧바로 불리므로 만드는 중인 씬도 받아 준다.
    if ((!scene.sys.isActive() && scene.sys.settings.status !== Phaser.Scenes.CREATING) || !target.active) return;
    if (visible && !dot) dot = new NotificationDot(scene, target, options);
    if (!visible && dot) { dot.destroy(true); dot = undefined; }
  });
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    unsubscribe(); dot?.destroy(true); dot = undefined;
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, dispose);
    target.off(Phaser.GameObjects.Events.DESTROY, dispose);
  };
  // 씬 종료 뒤 늦은 API 응답이 파괴된 컨테이너를 만지지 않도록 구독을 먼저 끊는다.
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, dispose);
  target.once(Phaser.GameObjects.Events.DESTROY, dispose);
  return dispose;
}

/** 서버 시간으로 바뀌는 무료 보급·우편 만료·발굴을 화면 재진입 없이 확인한다. 씬당 한 시계만 둔다. */
const notificationClocks = new WeakSet<Phaser.Scene>();
function watchNotificationClock(scene: Phaser.Scene): void {
  if (notificationClocks.has(scene)) return;
  notificationClocks.add(scene);
  const refresh = (): void => { if (scene.sys.isActive()) void notificationManager.refresh().catch(() => undefined); };
  const clock = scene.time.addEvent({ delay: 15_000, loop: true, callback: refresh });
  scene.game.events.on(Phaser.Core.Events.FOCUS, refresh);
  scene.events.on(Phaser.Scenes.Events.WAKE, refresh);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    clock.remove();
    scene.game.events.off(Phaser.Core.Events.FOCUS, refresh);
    scene.events.off(Phaser.Scenes.Events.WAKE, refresh);
    notificationClocks.delete(scene);
  });
}
