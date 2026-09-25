import Phaser from "phaser";
import { motionPolicy } from "../core/settings";
import { settingsManager } from "../managers/SettingsManager";
import { FEED_TAP, feedComboVisible, feedTapDrift } from "./feedTapStyle";
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

  /** 한 번 먹였다. 연속 수를 세고 조각을 띄운다. */
  tap(): void {
    const now = this.scene.time.now;
    this.streak = now - this.lastTapAt <= FEED_TAP.combo.resetMs ? this.streak + 1 : 1;
    this.lastTapAt = now;
    const calm = motionPolicy(settingsManager.get()).nonEssentialRepeatFactor === 0;
    if (!calm) this.launchCake();
    this.paintCombo(calm);
  }

  private launchCake(): void {
    if (this.live >= FEED_TAP.maxLiveCakes) return;
    const spec = FEED_TAP.cake;
    const drift = feedTapDrift(this.streak);
    const cake = this.scene.add.image(this.origin.x, this.origin.y, "currency-cheesecake").setDisplaySize(spec.size, spec.size);
    const base = cake.scaleX;
    cake.setScale(base * 0.4).setRotation(0);
    this.host.add(cake);
    this.live += 1;
    this.scene.tweens.add({
      targets: cake,
      x: this.origin.x + drift,
      y: this.origin.y - spec.rise,
      rotation: Math.sign(drift) * spec.tilt,
      duration: spec.ms,
      ease: "Cubic.Out",
    });
    this.scene.tweens.chain({
      targets: cake,
      tweens: [
        { scale: base * 1.1, duration: spec.ms * 0.28, ease: "Back.Out" },
        { scale: base * 0.7, alpha: 0, duration: spec.ms * 0.72, ease: "Quad.In" },
      ],
      onComplete: () => { cake.destroy(); this.live -= 1; },
    });
    this.sparkle(this.origin.x + drift * 0.5, this.origin.y - spec.rise * 0.45);
  }

  /** 조각이 지나는 자리에 작은 마름모 셋이 위로 흩어진다. 방향은 연속 수로 돌려 난수를 쓰지 않는다. */
  private sparkle(x: number, y: number): void {
    const spec = FEED_TAP.sparkle;
    for (let index = 0; index < spec.count; index += 1) {
      const angle = -Math.PI / 2 + (index - 1) * 0.9 + (this.streak % 3) * 0.2;
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
