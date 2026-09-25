import Phaser from "phaser";
import { motionPolicy } from "../core/settings";
import { settingsManager } from "../managers/SettingsManager";
import { FEED_TAP, feedArcPoint, feedBurstPath, feedComboVisible } from "./feedTapStyle";
import { textStyle } from "./theme";

/**
 * 급여 버튼 위에서 터지는 손맛. 버튼 컨테이너의 **자식**으로 그려 버튼과 함께 움직이고 함께 사라진다.
 *
 * 조각·반짝임·연속 표시 셋뿐이다. 움직임 줄이기를 켜면 조각은 뜨지 않고 연속 표시만 남는다 —
 * 몇 번 먹였는지는 여전히 말해야 하기 때문이다.
 */
export class FeedTapEffect {
  private live = 0;
  private streak = 0;
  private lastTapAt = -Infinity;
  private readonly combo?: Phaser.GameObjects.Text;

  /** `comboAt`을 주지 않으면 연속 표시 없이 조각만 띄운다(한 번에 여러 레벨을 채우는 쪽지). */
  constructor(private readonly scene: Phaser.Scene, private readonly host: Phaser.GameObjects.Container, private origin: { x: number; y: number }, comboAt?: { x: number; y: number }) {
    if (!comboAt) return;
    this.combo = scene.add
      .text(comboAt.x, comboAt.y, "", textStyle({ role: "display", size: FEED_TAP.combo.size, color: "#ffe08a" }))
      .setOrigin(0.5)
      .setStroke("#2a1a05", 6)
      .setAlpha(0);
    host.add(this.combo);
  }

  /** 조각이 튀어 오르는 자리를 옮긴다. 같은 판 안의 다른 버튼에서 터질 때 쓴다. */
  from(origin: { x: number; y: number }): this {
    this.origin = origin;
    return this;
  }

  /** 한 번 먹였다. 연속 수를 세고 조각 몇 개를 흩뿌린다. */
  tap(): void {
    const now = this.scene.time.now;
    this.streak = now - this.lastTapAt <= FEED_TAP.combo.resetMs ? this.streak + 1 : 1;
    this.lastTapAt = now;
    const calm = this.calm();
    if (!calm) this.burst(FEED_TAP.pieces.tap);
    this.paintCombo(calm);
  }

  /**
   * 한꺼번에 많이 먹였다(1레벨·10레벨). 조각을 물결로 나눠 퐝퐝 흩뿌린다 — 한 번에 다 띄우면
   * 한 덩어리로 뭉쳐 몇 개인지 읽히지 않는다.
   */
  feast(pieces: number): void {
    if (this.calm()) return;
    const { size, gapMs } = FEED_TAP.wave;
    for (let start = 0, wave = 0; start < pieces; start += size, wave += 1) {
      const count = Math.min(size, pieces - start);
      const streak = this.streak + wave;
      if (wave === 0) { this.burst(count, streak); continue; }
      this.scene.time.delayedCall(wave * gapMs, () => { if (this.host.active) this.burst(count, streak); });
    }
  }

  private calm(): boolean {
    return motionPolicy(settingsManager.get()).nonEssentialRepeatFactor === 0;
  }

  /** 조각 `count`개를 부채꼴 포물선으로 띄운다. 떨어지는 자리에서 팡 터진다. */
  private burst(count: number, streak = this.streak): void {
    for (let index = 0; index < count; index += 1) this.launchCake(feedBurstPath(index, count, streak), index);
  }

  private launchCake(path: { dx: number; dy: number; peak: number }, index: number): void {
    if (this.live >= FEED_TAP.maxLiveCakes) return;
    const spec = FEED_TAP.cake;
    const { x: ox, y: oy } = this.origin;
    const cake = this.scene.add.image(ox, oy, "currency-cheesecake").setDisplaySize(spec.size, spec.size);
    const base = cake.scaleX;
    cake.setScale(base * 0.5);
    this.host.add(cake);
    this.live += 1;
    const spin = Math.sign(path.dx || 1) * spec.spin;
    const flight = { t: 0 };
    // 조각마다 조금씩 늦게 떠 한 점에서 한꺼번에 튀어나가지 않는다.
    this.scene.tweens.add({
      targets: flight,
      t: 1,
      delay: index * 18,
      duration: spec.ms,
      ease: "Linear",
      onUpdate: () => {
        const point = feedArcPoint(path, flight.t);
        cake.setPosition(ox + point.x, oy + point.y).setRotation(spin * flight.t).setScale(base * (0.5 + Math.min(1, flight.t * 3) * 0.55));
      },
      onComplete: () => {
        // 떨어진 자리에서 한 번 부풀었다 사라진다 — 그 순간이 "먹였다"의 팡이다.
        this.sparkle(cake.x, cake.y, index);
        this.scene.tweens.add({ targets: cake, scale: base * 1.5, alpha: 0, duration: 150, ease: "Quad.Out", onComplete: () => { cake.destroy(); this.live -= 1; } });
      },
    });
  }

  /** 떨어진 자리에서 작은 마름모 셋이 위로 흩어진다. 방향은 순번으로 돌려 난수를 쓰지 않는다. */
  private sparkle(x: number, y: number, seed: number): void {
    const spec = FEED_TAP.sparkle;
    for (let index = 0; index < spec.count; index += 1) {
      const angle = -Math.PI / 2 + (index - 1) * 0.9 + (seed % 3) * 0.2;
      const size = spec.size * (index === 1 ? 1 : 0.7);
      const gem = this.scene.add.graphics({ x, y }).setBlendMode(Phaser.BlendModes.ADD);
      gem.fillStyle(spec.color, 0.95);
      gem.fillPoints([
        new Phaser.Math.Vector2(0, -size),
        new Phaser.Math.Vector2(size * 0.62, -size * 0.08),
        new Phaser.Math.Vector2(0, size * 0.86),
        new Phaser.Math.Vector2(-size * 0.54, size * 0.1),
      ], true);
      this.host.add(gem);
      this.scene.tweens.add({
        targets: gem,
        x: x + Math.cos(angle) * spec.reach,
        y: y + Math.sin(angle) * spec.reach,
        scale: 0.2,
        alpha: 0,
        duration: spec.ms,
        ease: "Quad.Out",
        onComplete: () => gem.destroy(),
      });
    }
  }

  /** ×N. 누를 때마다 한 박자 부풀었다 돌아오고, 손을 쉬면 스르륵 사라진다. */
  private paintCombo(calm: boolean): void {
    const spec = FEED_TAP.combo;
    if (!this.combo) return;
    this.scene.tweens.killTweensOf(this.combo);
    if (!feedComboVisible(this.streak)) { this.combo.setAlpha(0); return; }
    this.combo.setText(`×${this.streak}`).setAlpha(1).setScale(calm ? 1 : spec.punch);
    if (!calm) this.scene.tweens.add({ targets: this.combo, scale: 1, duration: spec.punchMs, ease: "Back.Out" });
    this.scene.tweens.add({ targets: this.combo, alpha: 0, delay: spec.resetMs, duration: 220 });
  }
}
