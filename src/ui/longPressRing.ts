import Phaser from "phaser";
import { BASE_WIDTH } from "../config/gameConfig";
import { settingsManager } from "../managers/SettingsManager";
import { COLOR } from "./theme";
import { LONG_PRESS, longPressRingCenter } from "./longPressGauge";

/**
 * 꾹 누름 게이지 한 장 — 그리드 카드(`bindLongPress`)와 편성 SD(`bindFormationDrag`)가 함께 쓴다.
 *
 * **손가락 위에 뜬 홀로그램 계기다.** 손끝 자리에는 작은 조준점만 남기고, 게이지는 엄지에 가리지 않게
 * 그 위로 띄운다. 고리는 한 줄 호가 아니라 칸으로 나뉘어 12시부터 시계 방향으로 한 칸씩 켜지고, 앞장선
 * 칸에는 마름모 하나가 붙어 "지금 여기까지"를 말한다. 둘레의 꺾쇠 넷이 천천히 조여 들며 다 차는
 * 순간 고리째 한 번 부풀었다 걷힌다 — 그 순간이 곧 열리는 순간이다.
 */
/** 손끝 게이지는 무엇보다 위에 선다 — 튜토리얼 막(6000) 아래에 깔리면 「꾹 누르세요」 안내 중에 정작 게이지가 어둡게 묻힌다. */
export const LONG_PRESS_RING_DEPTH = 6500;

export class LongPressRing {
  private readonly root: Phaser.GameObjects.Container;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly reticle: Phaser.GameObjects.Graphics;
  private readonly finger: Phaser.GameObjects.Graphics;
  private done = false;

  constructor(private readonly scene: Phaser.Scene, x: number, y: number, depth = LONG_PRESS_RING_DEPTH) {
    const center = longPressRingCenter(x, y, BASE_WIDTH);
    this.finger = scene.add.graphics({ x, y }).setDepth(depth);
    this.root = scene.add.container(center.x, center.y).setDepth(depth + 0.1);
    this.ring = scene.add.graphics();
    this.reticle = scene.add.graphics();
    this.root.add([this.ring, this.reticle]);
    // 손끝과 계기를 잇는 점선 — 떨어져 뜬 게이지가 어느 손의 것인지 말한다.
    this.paintTether(center.x - x, center.y - y);
    this.draw(0);
    if (!settingsManager.get().accessibility.reduceMotion) {
      this.root.setScale(0.6).setAlpha(0);
      scene.tweens.add({ targets: this.root, scale: 1, alpha: 1, duration: 120, ease: "Back.Out" });
    }
  }

  private paintTether(dx: number, dy: number): void {
    const g = this.finger;
    // 손끝 조준점: 납작한 마름모 둘.
    g.lineStyle(3, COLOR.accent, 0.85).strokePoints([new Phaser.Geom.Point(0, -16), new Phaser.Geom.Point(24, 0), new Phaser.Geom.Point(0, 16), new Phaser.Geom.Point(-24, 0)], true);
    const length = Math.hypot(dx, dy);
    const from = 30, to = length - LONG_PRESS.radius - 16;
    if (to <= from) return;
    const ux = dx / length, uy = dy / length;
    for (let d = from; d < to; d += 18) {
      const e = Math.min(to, d + 9);
      g.lineStyle(4, COLOR.void, 0.6).lineBetween(ux * d, uy * d, ux * e, uy * e);
      g.lineStyle(2, COLOR.accent, 0.8).lineBetween(ux * d, uy * d, ux * e, uy * e);
    }
  }

  draw(ratio: number): void {
    if (this.done) return;
    const r = LONG_PRESS.radius;
    const w = LONG_PRESS.width;
    const n = LONG_PRESS.segments;
    const g = this.ring.clear();
    // 받침: 뒤 화면과 떼어 놓는 짙은 원판 + 바깥 그림자 한 겹.
    g.fillStyle(0x000000, 0.28).fillCircle(4, 7, r + w);
    g.fillStyle(COLOR.void, 0.72).fillCircle(0, 0, r + w * 0.9);
    const gap = 0.07;
    const filled = ratio * n;
    for (let i = 0; i < n; i += 1) {
      const a0 = -Math.PI / 2 + (i / n) * Math.PI * 2 + gap;
      const a1 = -Math.PI / 2 + ((i + 1) / n) * Math.PI * 2 - gap;
      // 꺼진 칸은 옅은 홈, 켜진 칸은 강조색. 걸쳐 있는 칸은 켜진 만큼만 칠한다.
      g.lineStyle(w, 0xffffff, 0.12).beginPath().arc(0, 0, r, a0, a1, false).strokePath();
      const part = Math.max(0, Math.min(1, filled - i));
      if (part <= 0) continue;
      g.lineStyle(w + 6, COLOR.accent, 0.22).beginPath().arc(0, 0, r, a0, a0 + (a1 - a0) * part, false).strokePath();
      g.lineStyle(w, COLOR.accent, 1).beginPath().arc(0, 0, r, a0, a0 + (a1 - a0) * part, false).strokePath();
    }
    // 앞장선 마름모.
    if (ratio > 0) {
      const a = -Math.PI / 2 + ratio * Math.PI * 2;
      const hx = Math.cos(a) * r, hy = Math.sin(a) * r;
      const s = w * 0.95;
      g.fillStyle(0xffffff, 1).fillPoints([new Phaser.Geom.Point(hx, hy - s), new Phaser.Geom.Point(hx + s * 0.7, hy), new Phaser.Geom.Point(hx, hy + s), new Phaser.Geom.Point(hx - s * 0.7, hy)], true);
    }
    // 가운데: 차오를수록 커지는 마름모 — 무엇이 열릴지(자세히 보기)를 돋보기 대신 표식으로 말한다.
    const core = 10 + 18 * ratio;
    g.fillStyle(COLOR.accent, 0.25 + 0.6 * ratio).fillPoints([new Phaser.Geom.Point(0, -core), new Phaser.Geom.Point(core * 0.8, 0), new Phaser.Geom.Point(0, core), new Phaser.Geom.Point(-core * 0.8, 0)], true);
    g.lineStyle(3, 0xffffff, 0.7).strokePoints([new Phaser.Geom.Point(0, -core), new Phaser.Geom.Point(core * 0.8, 0), new Phaser.Geom.Point(0, core), new Phaser.Geom.Point(-core * 0.8, 0)], true);
    // 둘레 꺾쇠 넷: 멀리서 조여 든다.
    const q = this.reticle.clear();
    const reach = r + w + 30 - 16 * ratio;
    const arm = 18;
    q.lineStyle(4, COLOR.accent, 0.5 + 0.5 * ratio);
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      const cx = sx * reach * 0.72, cy = sy * reach * 0.72;
      q.beginPath().moveTo(cx, cy - sy * arm).lineTo(cx, cy).lineTo(cx - sx * arm, cy).strokePath();
    }
  }

  /** 다 찼으면 `burst`로 한 번 부풀며 걷히고, 아니면 조용히 옅어진다. */
  destroy(burst = false): void {
    if (this.done) return;
    this.done = true;
    const targets = [this.root, this.finger];
    if (burst && !settingsManager.get().accessibility.reduceMotion) {
      this.scene.tweens.add({ targets: this.root, scale: 1.3, duration: LONG_PRESS.fadeMs + 60, ease: "Quad.Out" });
    }
    this.scene.tweens.add({
      targets, alpha: 0, duration: LONG_PRESS.fadeMs + (burst ? 60 : 0),
      onComplete: () => { this.root.destroy(); this.finger.destroy(); },
    });
  }
}
