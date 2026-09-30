import Phaser from "phaser";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { chipPoints, drawLayer } from "./holo";
import { COLOR } from "./theme";
import { STRATA_REWARD_GLOW, STRATA_REWARD_POP, type StrataRewardTier } from "./strataRewardPopStyle";

export interface StrataRewardPopSpec {
  /** 캔 칸의 화면 중심이다. */
  x: number;
  y: number;
  /** 떠오른 보상 액자의 한 변. */
  size: number;
  tier: StrataRewardTier;
  /** 액자 한 장을 원점(0, 0)에 세워 돌려준다. 크기는 `size`를 따른다. */
  buildFrame: (size: number) => Phaser.GameObjects.Container;
  /** 날아가 닿을 전리품 칸의 화면 중심과 한 변이다. */
  target: () => { x: number; y: number; size: number };
  /** 전리품에 닿는 순간. 줄이 이 순간에 자란다. */
  onLand: () => void;
}

/**
 * 캔 보상이 칸 안쪽에 박혀 잠깐 머물다가 반짝이며 전리품으로 들어가는 한 벌의 연출이다.
 *
 * **보상이 판에 그대로 남아 있으면서 전리품에도 쌓이면 어디에 있는 것인지 애매했다.** 그래서
 * 캔 칸에는 보상을 남기지 않고, 여기서 잠깐(1초) 보여 준 뒤 **한 곳으로만** 옮긴다. 판과 갈라
 * 보이도록 액자 뒤에 짙은 후광과 아래로 떨어지는 그림자를 깐다.
 *
 * 화려함(`tier`)은 화석·호박석·귀한 룬에서 커진다 — 조각은 마름모(네 갈래 별)이고 위로 뜨며,
 * 섬광은 옅다. 난수를 쓰지 않는다. 씬이 죽거나 `destroy`가 불리면 약속도 함께 끝낸다.
 */
export class StrataRewardPop {
  private readonly root: Phaser.GameObjects.Container;
  private readonly tweens = new Set<Phaser.Tweens.Tween>();
  private readonly timers = new Set<Phaser.Time.TimerEvent>();
  private disposed = false;
  private finish: () => void = () => undefined;
  readonly done: Promise<void>;

  constructor(private readonly scene: Phaser.Scene, private readonly spec: StrataRewardPopSpec) {
    this.done = new Promise<void>((resolve) => { this.finish = resolve; });
    this.root = scene.add.container(spec.x, spec.y).setDepth(1400);
  }

  /** 떠오르기 → 머물기 → 반짝이며 전리품으로. 끝나면 스스로 사라진다. */
  play(): Promise<void> {
    const { spec, scene } = this;
    const reduced = session.settings.accessibility.reduceMotion;
    const cfg = STRATA_REWARD_POP;
    const tier = cfg.tier[spec.tier];
    const glow = STRATA_REWARD_GLOW[spec.tier];
    const size = spec.size;

    // 판과 갈라 주는 층: 넓고 짙은 후광 한 겹 + 아래로 깔리는 그림자. 액자보다 먼저 깐다.
    const halo = scene.add.graphics();
    halo.fillStyle(COLOR.void, 0.34).fillPoints(this.diamond(size * 1.25, size * 0.95), true);
    halo.fillStyle(COLOR.void, 0.4).fillPoints(this.diamond(size * 1.05, size * 0.8), true);
    // 액자와 같은 모양의 그림자를 바닥 쪽으로 어긋나게 깔아, 액자가 판에서 떠 있는 것으로 읽히게 한다.
    // 마름모를 따로 그리면 액자와 무관한 검은 조각이 판 위에 남는다.
    const cardShape = chipPoints(size, size, { bevel: { topLeft: size * 0.22, topRight: 0, bottomRight: size * 0.22, bottomLeft: 0 } });
    const shadow = scene.add.container(size * 0.035, size * 0.05);
    shadow.add(drawLayer(scene, size * 0.03, size * 0.05, cardShape, { fill: 0x000000, alpha: 0.32 }).setScale(1.1));
    shadow.add(drawLayer(scene, 0, 0, cardShape, { fill: 0x000000, alpha: 0.65 }));
    const frame = spec.buildFrame(size);
    const body = scene.add.container(0, 0, [frame]);
    this.root.add([halo, shadow, body]);
    halo.setAlpha(0);
    shadow.setAlpha(0).setScale(0.4);
    body.setScale(reduced ? 1 : 0.3).setAlpha(reduced ? 1 : 0);

    // 등장: 튀어 오르며 커진다. 그림자는 떠오른 만큼 작고 옅어진다.
    this.tween({ targets: body, scale: 1, alpha: 1, y: 0, duration: reduced ? 1 : cfg.appearMs, ease: "Back.Out" });
    this.tween({ targets: halo, alpha: 1, duration: cfg.appearMs, ease: "Quad.Out" });
    this.tween({ targets: shadow, alpha: 1, scale: 1, duration: cfg.appearMs, ease: "Quad.Out" });
    if (spec.tier !== "common") this.celebrate(tier, glow, reduced);

    // 머무는 동안 살짝 떠 있다. 반복이 꺼진 설정에서는 가만히 선다.
    if (!reduced && motionPolicy(session.settings).nonEssentialRepeatFactor > 0) {
      this.timer(cfg.appearMs, () => this.tween({ targets: body, y: -size * 0.025, duration: 700, yoyo: true, repeat: -1, ease: "Sine.InOut" }));
    }
    this.timer(reduced ? cfg.holdReducedMs : cfg.holdMs, () => this.leave(body, halo, shadow, glow, reduced));
    return this.done;
  }

  /**
   * 액자를 떠난 빛: 섬광 + 사방으로 갈라지는 네 갈래 별 + 뻗는 빛살 + 액자 테두리를 따라 번지는 파문.
   *
   * 화석·호박석·귀한 룬이 나온 순간이 「이 판의 하이라이트」로 읽혀야 하므로 일반 보상보다 훨씬 크다.
   * 그래도 섬광은 옅게(상한 0.6) 두고, 화면 전체를 하얗게 덮는 번쩍임은 호박석급(`legend`)에서만 한
   * 번 — 번쩍임 줄이기를 켠 사람에게는 넣지 않는다.
   */
  private celebrate(tier: (typeof STRATA_REWARD_POP.tier)[StrataRewardTier], glow: number, reduced: boolean): void {
    const size = this.spec.size;
    const lift = 0;
    const flash = this.scene.add.rectangle(0, lift, size * 1.6, size * 0.8, glow, tier.flash * (reduced ? 0.5 : 1))
      .setRotation(Math.PI / 4).setBlendMode(Phaser.BlendModes.ADD);
    this.root.addAt(flash, 0);
    this.tween({ targets: flash, alpha: 0, scale: reduced ? 1.2 : 1.9, duration: 620, ease: "Cubic.Out" });
    const sparks = reduced ? Math.ceil(tier.sparks / 3) : tier.sparks;
    for (let index = 0; index < sparks; index += 1) {
      const ratio = index / sparks;
      // 위쪽이 넓은 부채꼴이 아니라 사방이다 — 터졌다는 것이 읽혀야 한다. 흔들림은 번호에서 나온다.
      const angle = ratio * Math.PI * 2 + (((index * 29) % 7) - 3) / 20;
      const reach = size * (0.85 + (index % 4) * 0.2);
      this.spark(0, lift, size * (0.12 + (index % 3) * 0.04), glow,
        Math.cos(angle) * reach, Math.sin(angle) * reach - size * 0.12, 700 + (index % 4) * 90);
    }
    if (reduced) return;
    // 액자 테두리를 따라 밖으로 번지는 파문 — 납작한 마름모가 아니라 액자와 같은 모양이라 「이 액자가 빛난다」로 읽힌다.
    const rimShape = chipPoints(size, size, { bevel: { topLeft: size * 0.22, topRight: 0, bottomRight: size * 0.22, bottomLeft: 0 } });
    for (let wave = 0; wave < 2; wave += 1) {
      const rim = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setPosition(0, lift).setAlpha(0);
      rim.lineStyle(6, glow, 0.9);
      rim.strokePoints(this.toPoints(rimShape), true);
      this.root.addAt(rim, 1);
      this.timer(wave * 180, () => {
        rim.setAlpha(1).setScale(1);
        this.tween({ targets: rim, scale: 1.55, alpha: 0, duration: 640, ease: "Cubic.Out" });
      });
    }
    for (let index = 0; index < tier.rays; index += 1) {
      const angle = (index / tier.rays) * Math.PI * 2 + 0.2;
      const ray = this.scene.add.rectangle(0, lift, size * 0.07, size * (0.95 + (index % 3) * 0.25), glow, 0.5)
        .setRotation(angle + Math.PI / 2).setBlendMode(Phaser.BlendModes.ADD).setOrigin(0.5, 1);
      this.root.addAt(ray, 1);
      ray.setScale(1, 0.1);
      this.tween({ targets: ray, scaleY: 1, alpha: 0, duration: 620, ease: "Cubic.Out" });
    }
    // 머무는 동안 계속 반짝이는 별. 번호에서 자리와 박자를 정한다.
    for (let index = 0; index < tier.twinkles; index += 1) {
      const angle = (index / tier.twinkles) * Math.PI * 2 + 0.5;
      const x = Math.cos(angle) * size * 0.66; const y = lift + Math.sin(angle) * size * 0.6;
      const star = this.scene.add.star(x, y, 4, size * 0.03, size * 0.13, glow, 0.95).setBlendMode(Phaser.BlendModes.ADD).setScale(0);
      this.root.add(star);
      this.timer(280 + index * 170, () => this.tween({ targets: star, scale: 1, alpha: 0.15, duration: 360, yoyo: true, repeat: -1, ease: "Sine.InOut" }));
    }
    // 호박석급은 화면 전체가 한 번 옅게 번쩍인다. 번쩍임 줄이기를 켠 사람에게는 넣지 않는다.
    if (this.spec.tier === "legend" && !session.settings.accessibility.reduceFlashes) {
      this.scene.cameras.main.flash(160, 255, 226, 170, true);
    }
  }

  private toPoints(flat: readonly number[]): Phaser.Geom.Point[] {
    const points: Phaser.Geom.Point[] = [];
    for (let index = 0; index + 1 < flat.length; index += 2) points.push(new Phaser.Geom.Point(flat[index], flat[index + 1]));
    return points;
  }

  /** 네 갈래 별 하나가 한 점에서 터져 나가며 옅어진다. */
  private spark(x: number, y: number, outer: number, color: number, dx: number, dy: number, duration: number): void {
    const star = this.scene.add.star(x, y, 4, outer * 0.24, outer, color, 0.95).setBlendMode(Phaser.BlendModes.ADD);
    this.root.add(star);
    this.tween({ targets: star, x: x + dx, y: y + dy, alpha: 0, angle: 90, scale: 0.35, duration, ease: "Cubic.Out" });
  }

  /** 반짝 하고 전리품 칸으로 날아 들어간다. */
  private leave(body: Phaser.GameObjects.Container, halo: Phaser.GameObjects.Graphics, shadow: Phaser.GameObjects.Container, glow: number, reduced: boolean): void {
    const target = this.spec.target();
    const size = this.spec.size;
    // 떠나기 직전의 반짝: 액자 위에서 한 번 크게 터진다.
    this.spark(0, body.y, size * 0.34, glow === 0xffffff ? COLOR.accent : glow, 0, 0, reduced ? 160 : 300);
    this.tweens.forEach((tween) => { if (tween.targets?.includes(body)) tween.stop(); });
    this.tween({ targets: [halo, shadow], alpha: 0, duration: reduced ? 60 : 200, ease: "Quad.In" });
    const fly = reduced ? 80 : STRATA_REWARD_POP.flyMs;
    this.tween({ targets: body, x: target.x - this.spec.x, y: target.y - this.spec.y, scale: target.size / size, duration: fly, ease: "Cubic.In",
      onComplete: () => {
        this.spec.onLand();
        // 닿은 자리에서 작게 한 번 반짝이고 액자는 줄 쪽 실물에 자리를 넘긴다.
        this.root.setPosition(target.x, target.y);
        body.setVisible(false); halo.setVisible(false); shadow.setVisible(false);
        this.spark(0, 0, target.size * 0.5, glow === 0xffffff ? COLOR.accent : glow, 0, 0, reduced ? 120 : 260);
        this.timer(reduced ? 140 : 300, () => this.destroy());
      } });
  }

  private diamond(width: number, height: number): Phaser.Geom.Point[] {
    return [
      new Phaser.Geom.Point(-width / 2, 0), new Phaser.Geom.Point(-width * 0.12, -height / 2),
      new Phaser.Geom.Point(width / 2, -height * 0.04), new Phaser.Geom.Point(width * 0.1, height / 2),
    ];
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): void {
    let tween: Phaser.Tweens.Tween;
    const complete = config.onComplete;
    tween = this.scene.tweens.add({ ...config, onComplete: () => { this.tweens.delete(tween); (complete as (() => void) | undefined)?.(); } });
    this.tweens.add(tween);
  }

  private timer(delay: number, callback: () => void): void {
    let timer: Phaser.Time.TimerEvent;
    timer = this.scene.time.delayedCall(delay, () => { this.timers.delete(timer); if (!this.disposed) callback(); });
    this.timers.add(timer);
  }

  /** 진행 중인 모든 것을 걷고 약속을 푼다. 씬을 떠날 때도 이 길을 지난다. */
  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.tweens.forEach((tween) => tween.stop());
    this.timers.forEach((timer) => timer.remove(false));
    this.tweens.clear(); this.timers.clear();
    this.root.destroy(true);
    this.finish();
  }
}
