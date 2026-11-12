import Phaser from "phaser";
import { t } from "../i18n";
import { managerEvents } from "../managers/ManagerEvents";
import { settingsManager } from "../managers/SettingsManager";
import { tutorialManager } from "../managers/TutorialManager";
import { chipPoints, drawLayer } from "./holo";
import { bindNotificationDot } from "./NotificationDot";
import { COLOR, textStyle } from "./theme";

/**
 * 1-5에서 받은 체험 룬이 아직 남아 있는 동안 가방 버튼에 붉은 점과 작은 말풍선을 단다. 누르게 하지는 않는다 —
 * 가방을 열든 렐릭의 룬 가방을 열든, 들어가는 순간 체험을 권하는 것은 그 화면들(`offerFreeRuneCraft`)이다.
 * 체험이 끝나면(각인·건너뛰기) 인벤토리 신호에 맞춰 둘 다 걷힌다.
 */
export function bindFreeRuneBagHint(scene: Phaser.Scene, button: Phaser.GameObjects.Container, size: number): void {
  let bubble: Phaser.GameObjects.Container | undefined;
  const show = (visible: boolean): void => {
    if (!button.active) return;
    if (visible && !bubble) bubble = addBubble(scene, button, size);
    if (!visible && bubble) { bubble.destroy(true); bubble = undefined; }
  };
  bindNotificationDot(scene, button, { x: 42, y: -42 }, (listener) => {
    const emit = (): void => { const pending = tutorialManager.freeRuneId() !== undefined; listener(pending); show(pending); };
    emit();
    return managerEvents.subscribe("inventory", emit);
  });
  const cleanup = (): void => { bubble?.destroy(true); bubble = undefined; };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
  button.once(Phaser.GameObjects.Events.DESTROY, cleanup);
}

function addBubble(scene: Phaser.Scene, button: Phaser.GameObjects.Container, size: number): Phaser.GameObjects.Container {
  const label = scene.add.text(0, 0, t("tutorial.rune.bag"), textStyle({ role: "emphasis", size: 26, color: "#1a1d21", wrap: 300 })).setOrigin(0.5);
  const width = Math.ceil(label.width) + 40;
  const height = Math.ceil(label.height) + 22;
  // 오른쪽 레일의 버튼이라 말풍선은 왼쪽에 서고 꼬리가 버튼을 가리킨다.
  const x = button.x - size / 2 - 22 - width / 2;
  const container = scene.add.container(x, button.y, []).setDepth(button.depth + 1);
  const plate = drawLayer(scene, 0, 0, chipPoints(width, height, { bevel: { topLeft: 10, topRight: 0, bottomRight: 10, bottomLeft: 0 } }), { fill: COLOR.accent, alpha: 0.96 });
  const tail = scene.add.triangle(width / 2 + 6, 0, 0, -10, 14, 0, 0, 10, COLOR.accent, 0.96);
  container.add([plate, tail, label]);
  if (!settingsManager.get().accessibility.reduceMotion) {
    scene.tweens.add({ targets: container, x: x - 8, duration: 620, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }
  return container;
}
