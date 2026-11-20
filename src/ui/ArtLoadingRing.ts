import Phaser from "phaser";
import { BUSY_OVERLAY } from "../core/busyOverlay";
import { addBusyRing, spinBusyRing } from "./BusyOverlay";

export interface ArtLoadingRing {
  /** 원화가 섰다(또는 실패했다). 고리가 떠 있었으면 옅어지며 걷힌다. 몇 번 불러도 된다. */
  done(): void;
}

export interface ArtLoadingRingOptions {
  depth: number;
  /** 고리 크기(기다림 막의 고리가 1). 칸 안에 서는 고리는 작게 둔다. */
  scale?: number;
  /** 고리가 붙어 다닐 부모(스크롤 목록 등). 없으면 씬에 바로 선다. */
  parent?: Phaser.GameObjects.Container;
}

/**
 * 원화가 아직 도착하지 않은 **그 자리에만** 서는 로딩 고리.
 *
 * 화면은 원화를 기다리지 않고 먼저 선다(판·목록·조작은 바로 쓸 수 있다). 다만 느린 망에서는 원화
 * 자리가 몇 초씩 비어 「덜 그려진 화면」으로 읽혔다 — 교류의 도시 원화, 상점의 점원이 그랬다.
 * 그래서 화면 전체를 막는 기다림 막(`withBusy`) 대신, 같은 마름모 고리를 그 자리에 작게 띄운다.
 * 손을 막지 않고, 막과 같은 시간(`BUSY_OVERLAY.showDelayMs`) 안에 도착하면 아예 서지 않는다.
 */
export function showArtLoadingRing(scene: Phaser.Scene, x: number, y: number, options: ArtLoadingRingOptions): ArtLoadingRing {
  let finished = false;
  let ring: Phaser.GameObjects.Container | undefined;
  let spin: Phaser.Tweens.Tween | undefined;
  const dispose = (): void => { spin?.stop(); ring?.destroy(true); ring = undefined; };
  // 씬 타이머는 프레임이 돌아야 깨어나므로 실제 시계로 잰다(기다림 막과 같은 이유).
  const timer = setTimeout(() => {
    if (finished || !scene.sys.isActive() || options.parent?.active === false) return;
    ring = addBusyRing(scene, x, y, options.scale ?? 0.6).setDepth(options.depth).setAlpha(0);
    options.parent?.add(ring);
    spin = spinBusyRing(scene, ring);
    scene.tweens.add({ targets: ring, alpha: 1, duration: BUSY_OVERLAY.fadeMs });
  }, BUSY_OVERLAY.showDelayMs);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { finished = true; clearTimeout(timer); dispose(); });
  return {
    done: () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const shown = ring;
      if (!shown || !shown.active) { dispose(); return; }
      scene.tweens.add({ targets: shown, alpha: 0, duration: BUSY_OVERLAY.fadeMs, onComplete: dispose });
    },
  };
}
