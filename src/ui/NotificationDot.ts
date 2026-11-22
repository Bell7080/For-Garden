import Phaser from "phaser";
import { notificationManager } from "../managers/NotificationManager";
import { liveOpsHeld } from "../managers/liveOps";
import { NOTIFICATION_DOT_STYLE, rotatedNotificationAnchor, type NotificationAnchorOptions } from "./notificationDotStyle";
export { NOTIFICATION_DOT_STYLE } from "./notificationDotStyle";

export interface NotificationDotOptions extends NotificationAnchorOptions {
  /** 대상 컨테이너 원점 기준 앵커만 받으며 색·크기는 화면에서 바꿀 수 없다. */
  x: number;
  y: number;
}

const DOT_TEXTURE = "ui-notification-dot";
/** 구울 때의 배율 — 화면에서 다시 줄여 세우므로 확대된 화면에서도 가장자리가 부드럽다. */
const DOT_BAKE_SCALE = 2;

/**
 * 점 한 장을 한 번만 굽는다. 원(`add.circle`)은 둘레를 백 개 남짓의 점으로 나눠 **매 프레임** 삼각형을 다시 만들어
 * 올리는데, 점 하나가 원 두 개(그림자 + 외곽선 두른 몸)라 로비에 점이 열 개만 서도 화면 그리기 자료의 절반이
 * 점이었다(2026-11-23 실측 — 정지 로비 한 프레임 808KB 중 약 400KB). 구운 그림은 네모 하나다.
 */
function ensureDotTexture(scene: Phaser.Scene): { key: string; originX: number; originY: number; width: number; height: number } {
  const style = NOTIFICATION_DOT_STYLE;
  const half = Math.max(style.radius + 2, style.radius + style.outlineWidth / 2) + 1;
  const top = half;
  const bottom = style.shadowOffsetY + style.radius + 2 + 1;
  const width = half * 2;
  const height = top + bottom;
  const result = { key: DOT_TEXTURE, originX: 0.5, originY: top / height, width, height };
  if (scene.textures.exists(DOT_TEXTURE)) return result;
  const k = DOT_BAKE_SCALE;
  const canvas = scene.textures.createCanvas(DOT_TEXTURE, width * k, height * k);
  const ctx = canvas?.getContext();
  if (!canvas || !ctx) return result;
  const css = (color: number, alpha = 1): string => `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${alpha})`;
  ctx.scale(k, k);
  ctx.translate(half, top);
  ctx.fillStyle = css(style.shadow, style.shadowAlpha);
  ctx.beginPath(); ctx.arc(0, style.shadowOffsetY, style.radius + 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = css(style.fill);
  ctx.beginPath(); ctx.arc(0, 0, style.radius, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = css(style.outline);
  ctx.lineWidth = style.outlineWidth;
  ctx.stroke();
  canvas.refresh();
  return result;
}

/** 숫자 없이 붉은 원·흰 외곽선·짙은 그림자를 한곳에서 그리는 공용 프리팹이다. */
export class NotificationDot extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, target: Phaser.GameObjects.Container, options: NotificationDotOptions) {
    // super 호출 전에 this를 만들 수 없으므로 같은 순수 계산의 두 축을 생성자 인자로 바로 넘긴다.
    super(scene, rotatedNotificationAnchor(options).x, rotatedNotificationAnchor(options).y);
    // 그림자를 아래로 분리해 밝고 복잡한 로비 원화에서도 흰 외곽선이 묻히지 않게 한다(한 장으로 구워 둔다).
    const dot = ensureDotTexture(scene);
    this.add(scene.add.image(0, 0, dot.key).setOrigin(dot.originX, dot.originY).setDisplaySize(dot.width, dot.height));
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
  // 잠든·멈춘 씬에서 바뀐 값을 버리면 깨어난 뒤에도 옛 점이 남는다(설정을 겹쳐 연 동안 받은 보상 등).
  // 마지막으로 받은 값을 기억했다가 깨어나는 순간 다시 맞춘다.
  let wanted = false;
  const apply = (): void => {
    // create 도중에 구독하면 첫 값이 곧바로 불리므로 만드는 중인 씬도 받아 준다.
    if ((!scene.sys.isActive() && scene.sys.settings.status !== Phaser.Scenes.CREATING) || !target.active) return;
    if (wanted && !dot) dot = new NotificationDot(scene, target, options);
    if (!wanted && dot) { dot.destroy(true); dot = undefined; }
  };
  const unsubscribe = subscribe((visible) => { wanted = visible; apply(); });
  scene.events.on(Phaser.Scenes.Events.WAKE, apply);
  scene.events.on(Phaser.Scenes.Events.RESUME, apply);
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    unsubscribe(); dot?.destroy(true); dot = undefined;
    scene.events.off(Phaser.Scenes.Events.WAKE, apply);
    scene.events.off(Phaser.Scenes.Events.RESUME, apply);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, dispose);
    target.off(Phaser.GameObjects.Events.DESTROY, dispose);
  };
  // 씬 종료 뒤 늦은 API 응답이 파괴된 컨테이너를 만지지 않도록 구독을 먼저 끊는다.
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, dispose);
  target.once(Phaser.GameObjects.Events.DESTROY, dispose);
  return dispose;
}

/**
 * 서버 시간으로 바뀌는 무료 보급·우편 만료·발굴을 화면 재진입 없이 확인한다. 씬당 한 시계만 둔다.
 *
 * 알림 신호 하나는 실시간 폴링(`liveOps` — 15초)이 이미 묻는다. 이 시계는 임무·발굴까지 세 조회를 함께 묻는
 * 전체 조회라 더 드물게 돈다. 15초로 돌리던 때는 실시간 폴링과 겹쳐 같은 계정의 저장 조회가 15초마다 넷씩
 * 나갔고, 응답이 느린 날 그것이 서로 잠금을 기다리며 쌓였다. 탭이 가려진 동안에는 묻지 않는다.
 */
export const NOTIFICATION_FULL_REFRESH_MS = 60_000;
const notificationClocks = new WeakSet<Phaser.Scene>();
const pageVisible = (): boolean => typeof document === "undefined" || document.visibilityState !== "hidden";
function watchNotificationClock(scene: Phaser.Scene): void {
  if (notificationClocks.has(scene)) return;
  notificationClocks.add(scene);
  const refresh = (): void => { if (scene.sys.isActive() && pageVisible() && !liveOpsHeld()) void notificationManager.refresh().catch(() => undefined); };
  const clock = scene.time.addEvent({ delay: NOTIFICATION_FULL_REFRESH_MS, loop: true, callback: refresh });
  scene.game.events.on(Phaser.Core.Events.FOCUS, refresh);
  scene.events.on(Phaser.Scenes.Events.WAKE, refresh);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    clock.remove();
    scene.game.events.off(Phaser.Core.Events.FOCUS, refresh);
    scene.events.off(Phaser.Scenes.Events.WAKE, refresh);
    notificationClocks.delete(scene);
  });
}
