import Phaser from "phaser";
import { NOTIFICATION_DOT_STYLE } from "./notificationDotStyle";
export { NOTIFICATION_DOT_STYLE } from "./notificationDotStyle";

export interface NotificationDotOptions {
  /** 대상 컨테이너 원점 기준 앵커만 받으며 색·크기는 화면에서 바꿀 수 없다. */
  x: number;
  y: number;
}

/** 숫자 없이 붉은 원·흰 외곽선·짙은 그림자를 한곳에서 그리는 공용 프리팹이다. */
export class NotificationDot extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, target: Phaser.GameObjects.Container, options: NotificationDotOptions) {
    super(scene, options.x, options.y);
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
  let dot: NotificationDot | undefined;
  const unsubscribe = subscribe((visible) => {
    if (!scene.sys.isActive() || !target.active) return;
    if (visible && !dot) dot = new NotificationDot(scene, target, options);
    if (!visible && dot) { dot.destroy(true); dot = undefined; }
  });
  const dispose = () => { unsubscribe(); dot?.destroy(true); dot = undefined; };
  // 씬 종료 뒤 늦은 API 응답이 파괴된 컨테이너를 만지지 않도록 구독을 먼저 끊는다.
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, dispose);
  return dispose;
}
