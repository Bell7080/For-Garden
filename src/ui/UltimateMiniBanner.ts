import Phaser from "phaser";
import type { RelicDef } from "../core/types";
import { ULTIMATE_MINI_BANNER_TIMING } from "../core/battleControls";
import { ULTIMATE_MINI_BANNER as L, ultimateMiniBannerTop } from "./battleStatusLayout";
import { FaceFrame } from "./FaceFrame";
import { chipPoints, drawLayer } from "./holo";
import { ELEMENT_TINT } from "./skillArt";
import { shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/**
 * **단축 궁극기 연출** — 전신 컷인 대신 화면 위쪽 빈 띠(`ULTIMATE_MINI_BANNER`)에 스치는 작은 알림 한 장.
 *
 * 화면을 덮지 않고 손도 받지 않는다. 전투는 멈추지 않고 그 아래에서 계속 흐르며, 알림은 누가 무엇을
 * 썼는지만 말하고 오른쪽 벽으로 빠져나간다. 오른쪽 벽에서 밀려 들어오는 판 한 장 — 얼굴 액자 ·
 * 개체 이름(작게) · 궁극기 이름(크게, 강조색)과 판 윗변의 속성색 한 줄이 전부다.
 *
 * 시간은 배속을 받지 않는다(`ULTIMATE_MINI_BANNER_TIMING`) — 3배속에서도 이름이 읽혀야 한다.
 * 여럿이 잇달아 쓰면 아래로 한 칸 쌓이고 칸이 다 차면 가장 오래된 것을 밀어낸다(`UltimateMiniBannerStack`).
 */
class UltimateMiniBanner extends Phaser.GameObjects.Container {
  private leaving = false;

  constructor(scene: Phaser.Scene, relic: RelicDef, readonly slot: number, private readonly onGone: (banner: UltimateMiniBanner) => void) {
    super(scene, L.right, ultimateMiniBannerTop(slot) + L.height / 2);
    scene.add.existing(this);
    this.setDepth(L.depth);
    // 판은 오른쪽 벽에 붙고 왼쪽 위·오른쪽 아래만 깎인다(화면 전체의 문법). 오른쪽 아래는 화면 밖이라 보이지 않는다.
    const shape = chipPoints(L.width, L.height, { bevel: { topLeft: L.height * 0.42, bottomRight: L.height * 0.42 } });
    this.add(drawLayer(scene, -L.width / 2, 0, shape, { fill: COLOR.void, alpha: 0.86, edge: ELEMENT_TINT[relic.element] }));
    const faceX = -L.width + L.facePad + L.face / 2;
    this.add(new FaceFrame(scene, faceX, 0, { portraitAssetId: relic.portraitAssetId, size: L.face }));
    const textX = faceX + L.face / 2 + L.textGap;
    const textWidth = -L.textRight - textX;
    const name = scene.add.text(textX, -L.height * 0.2, relic.name, textStyle({ role: "emphasis", size: L.nameSize, color: COLOR.inkDim })).setOrigin(0, 0.5);
    const skill = scene.add.text(textX, L.height * 0.14, relic.ultimate.name, textStyle({ role: "display", size: L.skillSize, color: COLOR.accentText }))
      .setOrigin(0, 0.5).setStroke("#000000", 5);
    shrinkTextToWidth(name, textWidth);
    shrinkTextToWidth(skill, textWidth);
    this.add([name, skill]);
    // 손을 받지 않는다 — 전장을 누르는 손이 그대로 아래로 지나가야 전투가 막히지 않는다.
    this.x = L.right + L.width;
    this.setAlpha(0);
    const { enterMs, holdMs, exitMs } = ULTIMATE_MINI_BANNER_TIMING;
    scene.tweens.add({ targets: this, x: L.right, alpha: 1, duration: enterMs, ease: "Cubic.Out" });
    scene.time.delayedCall(enterMs + holdMs, () => this.leave(exitMs));
  }

  /** 오른쪽 벽으로 빠져나간다. 칸이 다 차 밀려날 때는 짧게 빠진다. */
  leave(duration: number = ULTIMATE_MINI_BANNER_TIMING.exitMs): void {
    if (this.leaving || !this.active) return;
    this.leaving = true;
    this.onGone(this);
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({ targets: this, x: L.right + L.width, alpha: 0, duration, ease: "Cubic.In", onComplete: () => this.destroy() });
  }
}

/** 화면 위쪽에 쌓이는 단축 알림 묶음. 칸 수(`ULTIMATE_MINI_BANNER.slots`)를 넘지 않는다. */
export class UltimateMiniBannerStack {
  private readonly live: UltimateMiniBanner[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  show(relic: RelicDef): void {
    if (this.live.length >= L.slots) this.live[0].leave(120);
    const used = new Set(this.live.map((banner) => banner.slot));
    let slot = 0;
    while (used.has(slot)) slot += 1;
    this.live.push(new UltimateMiniBanner(this.scene, relic, slot, (banner) => {
      const index = this.live.indexOf(banner);
      if (index >= 0) this.live.splice(index, 1);
    }));
  }

  /** 디버그·검수용 — 지금 떠 있는 알림 수. */
  get count(): number {
    return this.live.length;
  }
}
