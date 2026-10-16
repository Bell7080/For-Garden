import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import {
  BUSY_OVERLAY, beginBusy, busyHideDelay, endBusy, initialBusyState, markBusyHidden, markBusyShown, shouldShowBusy,
  type BusyState,
} from "../core/busyOverlay";
import { COLOR } from "./theme";

/** 팝업 층(2000~)과 토스트보다 위. 기다리는 동안은 어느 층도 손을 받지 않는다. */
const BUSY_DEPTH = 5000;
const SPOKES = 8;
const SPIN_MS = 1000;

/**
 * 화면이 멈추는 동안 세우는 공통 기다림 막: 반투명 검은 막 + 도는 마름모 고리.
 *
 * 글자는 적지 않는다 — 기다리는 이유를 읽어도 플레이어가 할 일은 없다. 고리는 동그라미 대신
 * 납작하지 않은 마름모 여덟을 둘러 세우고 꼬리로 갈수록 옅게 해, 돌아가는 방향이 읽힌다.
 * 막은 화면 전체의 손을 삼켜 기다리는 동안 다른 조작이 끼어들지 못한다.
 *
 * 화면은 직접 세우지 않고 `withBusy`로 요청을 감싼다. 겹친 요청은 하나의 막을 나눠 쓴다.
 */
class BusyOverlay {
  private state: BusyState = initialBusyState;
  private root?: Phaser.GameObjects.Container;
  private spin?: Phaser.Tweens.Tween;
  private showTimer?: ReturnType<typeof setTimeout>;
  private hideTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly scene: Phaser.Scene) {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dispose());
  }

  async wrap<T>(task: Promise<T>): Promise<T> {
    this.begin();
    try {
      return await task;
    } finally {
      this.end();
    }
  }

  private begin(): void {
    this.state = beginBusy(this.state);
    clearTimeout(this.hideTimer);
    this.hideTimer = undefined;
    if (this.state.shownAt !== null || this.showTimer !== undefined) return;
    // 씬 타이머는 프레임이 돌아야 깨어나므로 실제 시계로 잰다.
    this.showTimer = setTimeout(() => {
      this.showTimer = undefined;
      if (shouldShowBusy(this.state) && this.scene.sys.isActive()) this.show();
    }, BUSY_OVERLAY.showDelayMs);
  }

  private end(): void {
    this.state = endBusy(this.state);
    if (this.state.pending > 0) return;
    clearTimeout(this.showTimer);
    this.showTimer = undefined;
    const wait = busyHideDelay(this.state, Date.now());
    if (wait === null) return;
    this.hideTimer = setTimeout(() => { this.hideTimer = undefined; this.hide(); }, wait);
  }

  private show(): void {
    this.state = markBusyShown(this.state, Date.now());
    const scene = this.scene;
    const dim = scene.add.rectangle(0, 0, BASE_WIDTH, BASE_HEIGHT, 0x000000, BUSY_OVERLAY.dimAlpha).setOrigin(0).setInteractive();
    const ring = scene.add.container(BASE_WIDTH / 2, BASE_HEIGHT / 2);
    for (let i = 0; i < SPOKES; i += 1) {
      const angle = (i / SPOKES) * Math.PI * 2 - Math.PI / 2;
      const spoke = scene.add.rectangle(Math.cos(angle) * 54, Math.sin(angle) * 54, 17, 17, COLOR.accent, 0.12 + (i / (SPOKES - 1)) * 0.88)
        .setRotation(angle + Math.PI / 4);
      ring.add(spoke);
    }
    this.root = scene.add.container(0, 0, [dim, ring]).setDepth(BUSY_DEPTH).setScrollFactor(0).setAlpha(0);
    this.spin = scene.tweens.add({ targets: ring, angle: 360, duration: SPIN_MS, repeat: -1, ease: "Linear" });
    scene.tweens.add({ targets: this.root, alpha: 1, duration: BUSY_OVERLAY.fadeMs });
  }

  private hide(): void {
    const root = this.root;
    this.state = markBusyHidden(this.state);
    this.root = undefined;
    if (!root) return;
    this.scene.tweens.add({
      targets: root, alpha: 0, duration: BUSY_OVERLAY.fadeMs,
      onComplete: () => { this.spin?.stop(); root.destroy(true); },
    });
  }

  private dispose(): void {
    clearTimeout(this.showTimer);
    clearTimeout(this.hideTimer);
    this.spin?.stop();
    this.root?.destroy(true);
    this.root = undefined;
    this.state = initialBusyState;
    overlays.delete(this.scene);
  }
}

const overlays = new WeakMap<Phaser.Scene, BusyOverlay>();

/**
 * 시간이 걸리는 요청을 기다림 막으로 감싼다. 짧게 끝나는 요청에는 막이 서지 않는다.
 * 결과와 예외는 그대로 흘려보내므로 부르는 쪽의 오류 처리는 바뀌지 않는다.
 */
export function withBusy<T>(scene: Phaser.Scene, task: Promise<T>): Promise<T> {
  let overlay = overlays.get(scene);
  if (!overlay) { overlay = new BusyOverlay(scene); overlays.set(scene, overlay); }
  return overlay.wrap(task);
}
