import Phaser from "phaser";
import { allowBurst, EFFECT_BUDGET, EFFECT_PRESETS, type BurstSpec, type EffectKind } from "../ui/effectPresets";
import { EFFECT_TEXTURE, ensureEffectTextures } from "../ui/effectTextures";
import { damagePopupStyle, type DamagePopupRequest } from "../ui/damageNumbers";
import { COLOR, textStyle } from "../ui/theme";

/**
 * 이펙트의 단일 소유자.
 *
 * 폭주·패시브·일반 공격·궁극기와 회복·보호막·사망·화면 조작까지, 화면에 터지는 모든 것이
 * 이 경계를 지난다. 씬은 "무엇이 일어났는지"만 알리고 파편 수나 색을 직접 고르지 않는다 —
 * 씬마다 값을 정하면 같은 기술이 화면마다 다른 무게로 터진다.
 *
 * 렉이 걸리지 않게 하는 방법은 셋이다.
 * 1. **다시 쓴다.** 파편은 종류마다 emitter 하나를 만들어 계속 재사용하고, 파문과 수치 글자는
 *    풀에서 꺼내 쓴다. 한 방마다 객체를 새로 만들면 난전에서 GC가 프레임을 끊는다.
 * 2. **구운 그림만 쓴다.** 도형을 매 프레임 다시 그리거나 캔버스 그림자로 빛을 번지게 하지
 *    않는다. 흰 그림 한 장에 `tint`만 갈아 끼워 한 배치로 그린다.
 * 3. **예산을 지킨다.** 한 프레임에 여는 수와 살아 있는 파문·글자 수에 상한이 있고, 넘치면
 *    조용히 버린다. 놓친 한 방보다 끊긴 프레임이 훨씬 크게 보인다.
 */

export interface EffectManagerOptions {
  /** 파편과 파문이 서는 깊이. 수치 글자는 그보다 한 겹 위에 선다. */
  depth?: number;
  /** 큰 한 방에 화면을 흔들지 여부. 지도·로비처럼 조작이 이어지는 화면은 끈다. */
  shake?: boolean;
}

export interface BurstOptions {
  /** 파편·파문의 색. 보통 그 캐릭터의 속성·직군 색(`skillArtTint`)을 넘긴다. */
  color?: number;
  /** 파편이 주로 날아가는 방향(도). 주면 그 방향으로 부채꼴로 튄다. */
  direction?: number;
  /** 이펙트 전체 크기 배율. 큰 적을 때릴 때만 키운다. */
  scale?: number;
  /** 수치 글자가 완전히 사라진 뒤 한 번 불린다. 표시 개수를 세는 곳만 쓴다. */
  onDone?: () => void;
}

interface RingSlot {
  graphics: Phaser.GameObjects.Graphics;
  tween?: Phaser.Tweens.Tween;
  openedAt: number;
}

interface NumberSlot {
  label: Phaser.GameObjects.Text;
  tweens: Phaser.Tweens.Tween[];
  openedAt: number;
}

/** 마름모 파문 한 겹. 원이 아니라 각진 네 꼭짓점이라 SD의 각진 UI와 같은 결로 읽힌다. */
function strokeDiamond(
  graphics: Phaser.GameObjects.Graphics,
  radius: number,
  width: number,
  color: number,
  alpha: number,
): void {
  graphics.lineStyle(width, color, alpha);
  // 좌우를 위아래보다 넓게 잡는다. 정사각 마름모는 반듯한 보석처럼 보이고, 납작해야 바닥을
  // 훑고 지나가는 충격파로 읽힌다.
  graphics.strokePoints([
    new Phaser.Geom.Point(0, -radius * 0.72),
    new Phaser.Geom.Point(radius, 0),
    new Phaser.Geom.Point(0, radius * 0.72),
    new Phaser.Geom.Point(-radius, 0),
  ], true);
}

export class EffectManager {
  private readonly scene: Phaser.Scene;
  private readonly depth: number;
  private readonly shakeEnabled: boolean;
  private readonly emitters = new Map<EffectKind, Phaser.GameObjects.Particles.ParticleEmitter>();
  private readonly rings: RingSlot[] = [];
  private readonly numbers: NumberSlot[] = [];
  private readonly lastAt = new Map<EffectKind, number>();
  private frame = -1;
  private openedThisFrame = 0;

  constructor(scene: Phaser.Scene, options: EffectManagerOptions = {}) {
    this.scene = scene;
    this.depth = options.depth ?? 300;
    this.shakeEnabled = options.shake ?? true;
    ensureEffectTextures(scene);
    // 씬이 꺼질 때 emitter·풀을 함께 정리한다. 씬 재진입마다 쌓이면 텍스처는 하나여도
    // 표시 객체가 배로 늘어난다.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** 한 프레임에 여는 수를 세기 위해 프레임이 넘어갈 때마다 예산을 되돌린다. */
  private rollFrame(): number {
    const frame = this.scene.game.loop.frame;
    if (frame !== this.frame) {
      this.frame = frame;
      this.openedThisFrame = 0;
    }
    return this.scene.time.now;
  }

  /** 종류마다 emitter 하나를 만들어 계속 다시 쓴다. 색과 방향만 발동 직전에 갈아 끼운다. */
  private emitterFor(kind: EffectKind, spec: BurstSpec): Phaser.GameObjects.Particles.ParticleEmitter {
    const existing = this.emitters.get(kind);
    if (existing) return existing;
    const emitter = this.scene.add.particles(0, 0, EFFECT_TEXTURE.shard, {
      lifespan: { min: spec.life[0], max: spec.life[1] },
      speed: { min: spec.speed[0], max: spec.speed[1] },
      angle: { min: 0, max: 360 },
      gravityY: spec.gravity,
      // 시작 배율에서 0까지 줄어들며 사라지므로 화면에 잔해가 남지 않는다.
      scale: { start: spec.shardScale, end: 0, ease: "Quad.Out" },
      alpha: { start: 1, end: 0, ease: "Quad.In" },
      // 마름모가 돌면서 폭이 변해 반짝이는 것처럼 보인다.
      rotate: { start: 0, end: spec.spin },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    }).setDepth(this.depth);
    this.emitters.set(kind, emitter);
    return emitter;
  }

  /** 풀에서 파문 한 겹을 꺼낸다. 상한을 넘으면 가장 오래된 것을 즉시 회수한다. */
  private acquireRing(): RingSlot {
    const free = this.rings.find((slot) => !slot.graphics.visible);
    if (free) return free;
    if (this.rings.length >= EFFECT_BUDGET.maxRings) {
      const oldest = this.rings.reduce((old, slot) => (slot.openedAt < old.openedAt ? slot : old));
      oldest.tween?.stop();
      oldest.graphics.clear().setVisible(false);
      return oldest;
    }
    const slot: RingSlot = { graphics: this.scene.add.graphics().setDepth(this.depth).setVisible(false), openedAt: 0 };
    this.rings.push(slot);
    return slot;
  }

  /**
   * 파문 한 겹을 연다.
   *
   * 벌어지면서 **선이 얇아지고 흐려진다** — 굵기를 유지한 채 커지기만 하면 파문이 아니라
   * 커지는 마름모 하나로 보인다.
   */
  private openRing(x: number, y: number, radius: number, ms: number, width: number, color: number, delay = 0): void {
    const slot = this.acquireRing();
    slot.openedAt = this.scene.time.now;
    const graphics = slot.graphics.clear().setPosition(x, y).setAlpha(1).setVisible(true);
    const state = { t: 0 };
    slot.tween = this.scene.tweens.add({
      targets: state,
      t: 1,
      delay,
      duration: ms,
      ease: "Cubic.Out",
      onUpdate: () => {
        const grown = radius * state.t;
        graphics.clear();
        // 진하기는 끝에서만 급히 빠진다. 시작부터 선형으로 옅어지면 벌어지는 동안 이미 사라져
        // 무엇이 지나갔는지 눈에 남지 않는다.
        strokeDiamond(graphics, grown, Math.max(1, width * (1 - state.t * 0.7)), color, 1 - state.t * state.t);
      },
      onComplete: () => {
        graphics.clear().setVisible(false);
        slot.tween = undefined;
      },
    });
  }

  /** 가운데 섬광 한 장. 터지는 순간 가장 밝고 곧바로 꺼진다. */
  private openFlash(x: number, y: number, size: number, ms: number, alpha: number, color: number): void {
    const flash = this.scene.add.image(x, y, EFFECT_TEXTURE.glow)
      .setDisplaySize(size, size * 0.92)
      .setTint(color)
      .setAlpha(alpha)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(this.depth);
    this.scene.tweens.add({
      targets: flash,
      displayWidth: size * 1.6,
      displayHeight: size * 1.5,
      alpha: 0,
      duration: ms,
      ease: "Quad.Out",
      onComplete: () => flash.destroy(),
    });
  }

  /**
   * 이펙트 한 방.
   *
   * 예산을 넘기면 **조용히 아무것도 하지 않는다.** 호출하는 쪽은 성공 여부를 묻지 않으므로
   * 전투 규칙이 표시 사정에 끌려가지 않는다.
   */
  burst(kind: EffectKind, x: number, y: number, options: BurstOptions = {}): void {
    const now = this.rollFrame();
    if (!allowBurst(kind, now, this.lastAt.get(kind), this.openedThisFrame)) return;
    this.lastAt.set(kind, now);
    this.openedThisFrame += 1;

    const spec = EFFECT_PRESETS[kind];
    const color = options.color ?? COLOR.accent;
    const scale = options.scale ?? 1;
    if (spec.shards > 0) {
      const emitter = this.emitterFor(kind, spec);
      emitter.setParticleTint(color);
      // 방향을 준 타격만 부채꼴로 튄다. 주지 않으면 사방으로 고르게 퍼진다.
      emitter.setEmitterAngle(options.direction === undefined
        ? { min: 0, max: 360 }
        : { min: options.direction - 46, max: options.direction + 46 });
      emitter.explode(spec.shards, x, y);
    }
    for (let ring = 0; ring < spec.rings; ring += 1) {
      // 두 겹째는 조금 늦게, 조금 더 크게 벌어져 한 겹이 두 번 밀려나는 것처럼 보인다.
      this.openRing(x, y, spec.ringRadius * scale * (1 + ring * 0.42), spec.ringMs + ring * 90, spec.ringWidth, ring === 0 ? color : 0xffffff, ring * 70);
    }
    if (spec.flash > 0) this.openFlash(x, y, spec.flash * scale, spec.flashMs, spec.flashAlpha, color);
  }

  /**
   * 근미래 홀로그램 장비를 누른 자리.
   *
   * 전장의 파편과 **일부러 다른 결**이다. 조각을 뿌리지 않고 얇은 마름모 파문 한 겹만
   * 지나간다 — 메뉴에서 누를 때마다 불꽃이 튀면 화면이 장비가 아니라 놀이기구가 된다.
   */
  tap(x: number, y: number, kind: "tap" | "tapBattle" = "tap"): void {
    this.burst(kind, x, y, { color: COLOR.accent });
  }

  /** 풀에서 수치 글자 하나를 꺼낸다. 상한을 넘으면 가장 오래된 것을 즉시 회수한다. */
  private acquireNumber(): NumberSlot {
    const free = this.numbers.find((slot) => !slot.label.visible);
    if (free) return free;
    if (this.numbers.length >= EFFECT_BUDGET.maxNumbers) {
      const oldest = this.numbers.reduce((old, slot) => (slot.openedAt < old.openedAt ? slot : old));
      oldest.tweens.forEach((tween) => tween.stop());
      oldest.tweens = [];
      oldest.label.setVisible(false);
      return oldest;
    }
    const slot: NumberSlot = {
      label: this.scene.add.text(0, 0, "", textStyle({ role: "display", size: 34 })).setOrigin(0.5).setDepth(this.depth + 20).setVisible(false),
      tweens: [],
      openedAt: 0,
    };
    this.numbers.push(slot);
    return slot;
  }

  /**
   * 전투 수치 하나를 띄운다.
   *
   * 크기·색·머무는 시간은 전부 `damageNumbers.ts`의 순수 규칙이 정한다. 세기가 클수록 글자가
   * 크고 오래 남아, 숫자를 읽지 않고 크기만 봐도 "세게 맞았다"가 전해진다.
   */
  damage(x: number, y: number, request: DamagePopupRequest, options: BurstOptions = {}): void {
    const style = damagePopupStyle(request);
    const slot = this.acquireNumber();
    slot.openedAt = this.scene.time.now;
    slot.tweens.forEach((tween) => tween.stop());
    const label = slot.label
      .setText(style.text)
      .setStyle(textStyle({ role: "display", size: style.size, color: style.color }))
      .setStroke(style.stroke, style.strokeWidth)
      .setPosition(x + Phaser.Math.Between(-42, 42), y)
      .setAlpha(1)
      .setScale(0.5)
      .setVisible(true);
    slot.tweens = [
      // 제 크기보다 조금 넘게 커졌다 돌아온다. 큰 한 방일수록 더 많이 튄다.
      this.scene.tweens.add({ targets: label, scale: style.punch, duration: 110, ease: "Back.Out",
        onComplete: () => { this.scene.tweens.add({ targets: label, scale: 1, duration: 90, ease: "Quad.Out" }); } }),
      this.scene.tweens.add({
        targets: label,
        y: label.y - style.rise,
        alpha: 0,
        delay: style.holdMs,
        duration: style.riseMs,
        ease: "Quad.Out",
        onComplete: () => { label.setVisible(false); slot.tweens = []; options.onDone?.(); },
      }),
    ];
    if (style.sparks > 0) {
      // 치명타·궁극기만 숫자 뒤로 파편을 뿌린다. 잔타까지 뿌리면 난전이 반짝이로 덮인다.
      const spec = EFFECT_PRESETS.basic;
      const emitter = this.emitterFor("basic", spec);
      emitter.setParticleTint(options.color ?? Phaser.Display.Color.HexStringToColor(style.color).color);
      emitter.setEmitterAngle({ min: 0, max: 360 });
      emitter.explode(style.sparks, x, y);
    }
    if (style.shake > 0 && this.shakeEnabled) {
      const shake = this.scene.cameras.main.shakeEffect;
      // 이미 더 세게 흔들리는 중이면 덧대지 않는다. 겹쳐 걸면 난전 내내 화면이 멎지 않는다.
      if (!shake.isRunning || shake.intensity.x < style.shake) this.scene.cameras.main.shake(150, style.shake);
    }
  }

  /** 씬이 꺼질 때 emitter와 두 풀을 모두 폐기한다. */
  destroy(): void {
    this.emitters.forEach((emitter) => emitter.destroy());
    this.emitters.clear();
    this.rings.forEach((slot) => { slot.tween?.stop(); slot.graphics.destroy(); });
    this.rings.length = 0;
    this.numbers.forEach((slot) => { slot.tweens.forEach((tween) => tween.stop()); slot.label.destroy(); });
    this.numbers.length = 0;
    this.lastAt.clear();
  }
}
