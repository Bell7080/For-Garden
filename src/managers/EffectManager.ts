import Phaser from "phaser";
import { allowBurst, AREA_IMPACT, EFFECT_BUDGET, EFFECT_PRESETS, EFFECT_TAP_COLOR, REACH_STRIKE, SUSTAINED_COMBAT_EFFECT, type BurstSpec, type EffectKind } from "../ui/effectPresets";
import { EFFECT_TEXTURE, ensureEffectTextures } from "../ui/effectTextures";
import { lashPoints } from "../ui/reachStrikeShape";
import { inkBlotPoints, mawTeeth, slashPoints, SIGNATURE_SPECS, type CombatPalette, type SignatureId, type StrokePoint } from "../ui/signatureEffects";
import { damagePopupStyle, risingAlpha, type DamagePopupRequest } from "../ui/damageNumbers";
import { COLOR, textStyle } from "../ui/theme";
import { battleUiMotionFactor, type BattleUiMotion } from "../core/settings";
import type { ActiveCombatDisplayEffect } from "../core/combatEffects";

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
  /** 체력 HUD와 같은 저장 선택으로 카메라 흔들림 세기만 조절한다. */
  battleUiMotion?: BattleUiMotion;
  /**
   * 바닥에 깔리는 범위 표시의 깊이.
   *
   * SD보다 **뒤**여야 한다. 앞에 두면 범위가 캐릭터를 덮어 누가 어디 섰는지 가린다.
   */
  groundDepth?: number;
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

type SustainedTag = ActiveCombatDisplayEffect["tag"];
export interface SustainedEffectTarget {
  fighterId: string; effectId: string; tag: SustainedTag; x: number; y: number;
  aimX?: number; aimY?: number; color: number;
}

/** 코어 활성 목록과 함께 사는 재사용 그래픽이다. 매 프레임 새 객체를 만들지 않아 GC를 피한다. */
interface SustainedSlot { graphics: Phaser.GameObjects.Graphics; tween?: Phaser.Tweens.Tween; tag: SustainedTag }

export type CombatVisualMethod = "heal" | "shieldGain" | "shieldHit" | "shieldBreak" | "stealthEnter" | "stealthExit";

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

/** 바닥에 누운 범위 마름모. 세로를 눌러 위에서 비스듬히 내려다본 원처럼 보이게 한다. */
function groundDiamond(radius: number): Phaser.Geom.Point[] {
  const half = radius * AREA_IMPACT.squash;
  return [
    new Phaser.Geom.Point(0, -half),
    new Phaser.Geom.Point(radius, 0),
    new Phaser.Geom.Point(0, half),
    new Phaser.Geom.Point(-radius, 0),
  ];
}

/** 풀에서 꺼내 쓰는 탄환 한 알. */
interface BulletSlot {
  image: Phaser.GameObjects.Image;
  tween?: Phaser.Tweens.Tween;
  openedAt: number;
}

export class EffectManager {
  private readonly scene: Phaser.Scene;
  private readonly depth: number;
  private readonly shakeEnabled: boolean;
  private readonly shakeFactor: number;
  private readonly groundDepth: number;
  private readonly emitters = new Map<EffectKind, Phaser.GameObjects.Particles.ParticleEmitter>();
  private readonly rings: RingSlot[] = [];
  private readonly numbers: NumberSlot[] = [];
  /** 날아가는 탄환 풀. 파문과 같은 이유로 다시 쓴다 — 평타마다 새로 만들면 GC가 프레임을 끊는다. */
  private readonly bullets: BulletSlot[] = [];
  private readonly lastAt = new Map<EffectKind, number>();
  /** 같은 전투원의 복수 제공자 효과를 보존하는 런타임 Fighter ID + 효과 ID 복합 키다. */
  private readonly sustained = new Map<string, SustainedSlot>();
  private frame = -1;
  private openedThisFrame = 0;

  constructor(scene: Phaser.Scene, options: EffectManagerOptions = {}) {
    this.scene = scene;
    this.depth = options.depth ?? 300;
    this.shakeEnabled = options.shake ?? true;
    this.shakeFactor = battleUiMotionFactor(options.battleUiMotion ?? "default");
    this.groundDepth = options.groundDepth ?? this.depth - 400;
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
    const slot: RingSlot = { graphics: this.scene.add.graphics().setVisible(false), openedAt: 0 };
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
    const graphics = slot.graphics.clear().setPosition(x, y).setAlpha(1).setDepth(this.depth).setVisible(true);
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

  /**
   * 광역이 터진 자리를 **바닥에** 그린다.
   *
   * 숫자만 셋이 한꺼번에 뜨면 왜 함께 맞았는지 읽히지 않는다. 눌린 마름모가 한 번 벌어졌다
   * 꺼지면서 "여기까지가 범위였다"를 한 번에 말한다. SD보다 뒤에 깔려 아무도 가리지 않는다.
   */
  groundArea(x: number, y: number, radius: number, options: { color?: number; ultimate?: boolean } = {}): void {
    const now = this.rollFrame();
    if (this.openedThisFrame >= EFFECT_BUDGET.perFrame) return;
    this.openedThisFrame += 1;
    const color = options.color ?? COLOR.accent;
    const slot = this.acquireRing();
    slot.openedAt = now;
    const graphics = slot.graphics.clear().setPosition(x, y).setAlpha(1).setDepth(this.groundDepth).setVisible(true);
    const state = { t: 0 };
    slot.tween = this.scene.tweens.add({
      targets: state,
      t: 1,
      duration: options.ultimate ? AREA_IMPACT.ultimateMs : AREA_IMPACT.ms,
      ease: "Cubic.Out",
      onUpdate: () => {
        const grown = radius * (AREA_IMPACT.growFrom + (1 - AREA_IMPACT.growFrom) * state.t);
        // 진하기는 끝에서만 급히 빠진다. 처음부터 선형으로 옅어지면 벌어지는 동안 이미 사라진다.
        const fade = 1 - state.t * state.t;
        const shape = groundDiamond(grown);
        graphics.clear();
        graphics.fillStyle(color, AREA_IMPACT.fillAlpha * fade);
        graphics.fillPoints(shape, true);
        graphics.lineStyle(AREA_IMPACT.lineWidth, color, AREA_IMPACT.lineAlpha * fade);
        graphics.strokePoints(shape, true);
      },
      onComplete: () => {
        graphics.clear().setVisible(false);
        slot.tween = undefined;
      },
    });
  }

  /**
   * 멀리서 때린 타격이 지나간 길.
   *
   * 근거리는 몸이 붙어 있어 파편만으로 누가 쳤는지 읽히지만, 떨어져서 때리면 사이를 잇는
   * 것이 없어 **맞은 자리에 숫자만 뜬다.** 씬은 두 자리와 사거리 단계만 넘기고, 무엇을
   * 그릴지는 `REACH_STRIKE` 한 표가 정한다.
   */
  reachStrike(from: { x: number; y: number }, to: { x: number; y: number }, tier: "mid" | "ranged", color: number): void {
    const now = this.rollFrame();
    if (this.openedThisFrame >= EFFECT_BUDGET.perFrame) return;
    this.openedThisFrame += 1;
    if (tier === "mid") this.openLash(from, to, color, now);
    else this.openBullet(from, to, color, now);
  }

  /**
   * 채찍 — 이미 닿아 있는 선이라 **자라나지 않는다.**
   *
   * 처음부터 끝까지 이어진 채로 뻗었다 걷히며, 가운데가 한 번 휘어 곧은 레이저와 갈린다.
   * 뿌리에서 끝으로 갈수록 가늘어져 휘두른 방향이 선 하나에 남는다.
   */
  private openLash(from: { x: number; y: number }, to: { x: number; y: number }, color: number, now: number): void {
    const lash = REACH_STRIKE.lash;
    const slot = this.acquireRing();
    slot.openedAt = now;
    const graphics = slot.graphics.clear().setPosition(0, 0).setAlpha(1).setDepth(this.depth)
      .setBlendMode(Phaser.BlendModes.ADD).setVisible(true);
    // 두 자리를 통째로 잇지 않고 **닿는 쪽 끝**만 그린다. 길 가운데를 비워 그 위로 날아가는
    // 탄환이 보이게 하는 것이 이 시작점의 유일한 목적이다.
    const root = {
      x: from.x + (to.x - from.x) * lash.startAt,
      y: from.y + (to.y - from.y) * lash.startAt,
    };
    const dx = to.x - root.x;
    const dy = to.y - root.y;
    const length = Math.hypot(dx, dy) || 1;
    // 진행 방향의 수직으로 가운데를 밀어 한 번 휜 자국을 만든다.
    const nx = -dy / length;
    const ny = dx / length;
    const bend = length * lash.bend;
    const state = { t: 0 };
    slot.tween = this.scene.tweens.add({
      targets: state,
      t: 1,
      duration: lash.ms,
      ease: "Quad.In",
      onUpdate: () => {
        // 휘는 방향이 시간에 따라 되돌아오며 "쳤다가 걷힌다"가 한 동작으로 읽힌다.
        const swing = Math.sin(Math.PI * (1 - state.t)) * bend;
        const midX = (root.x + to.x) / 2 + nx * swing;
        const midY = (root.y + to.y) / 2 + ny * swing;
        graphics.clear();
        graphics.fillStyle(color, lash.alpha * (1 - state.t * state.t));
        graphics.fillPoints(lashPoints(root, { x: midX, y: midY }, to, lash.rootWidth, lash.tipWidth), true);
      },
      onComplete: () => {
        graphics.clear().setVisible(false).setBlendMode(Phaser.BlendModes.NORMAL);
        slot.tween = undefined;
      },
    });
  }

  /** 풀에서 탄환 한 알을 꺼낸다. 상한을 넘으면 가장 오래된 것을 즉시 회수한다. */
  private acquireBullet(): BulletSlot {
    const free = this.bullets.find((slot) => !slot.image.visible);
    if (free) return free;
    if (this.bullets.length >= REACH_STRIKE.bullet.maxLive) {
      const oldest = this.bullets.reduce((old, slot) => (slot.openedAt < old.openedAt ? slot : old));
      oldest.tween?.stop();
      oldest.image.setVisible(false);
      return oldest;
    }
    const slot: BulletSlot = {
      image: this.scene.add.image(0, 0, EFFECT_TEXTURE.shard).setVisible(false).setBlendMode(Phaser.BlendModes.ADD),
      openedAt: 0,
    };
    this.bullets.push(slot);
    return slot;
  }

  /**
   * 탄환 — 실제로 날아간다.
   *
   * 피해는 이미 확정된 뒤라 연출이 늦으면 숫자가 먼저 뜨고 총알이 나중에 닿는다. 그래서
   * 거리와 무관하게 시간을 고정해 **먼 적일수록 빨라 보이게** 한다.
   */
  private openBullet(from: { x: number; y: number }, to: { x: number; y: number }, color: number, now: number): void {
    const bullet = REACH_STRIKE.bullet;
    const slot = this.acquireBullet();
    slot.openedAt = now;
    const angle = Phaser.Math.RadToDeg(Math.atan2(to.y - from.y, to.x - from.x));
    const image = slot.image
      .setPosition(from.x, from.y)
      .setDisplaySize(bullet.length, bullet.thickness)
      .setAngle(angle)
      .setTint(color)
      .setAlpha(bullet.alpha)
      // 채찍보다 한 겹 위다. 같은 깊이에 두면 나중에 열린 채찍이 탄환을 덮는다.
      .setDepth(this.depth + bullet.depthLift)
      .setVisible(true);
    slot.tween = this.scene.tweens.add({
      targets: image,
      x: to.x,
      y: to.y,
      // 날면서 뒤로 늘어나 지나온 자리가 꼬리로 남는다. 잔상 객체를 따로 만들지 않는 방법이다.
      displayWidth: bullet.length * bullet.trail,
      duration: bullet.ms,
      ease: "Quad.In",
      onComplete: () => {
        image.setVisible(false);
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
    this.burst(kind, x, y, { color: EFFECT_TAP_COLOR });
  }

  /**
   * 전투 태그의 각진 시각 언어. 색은 COLOR 토큰을 받은 값만 쓰며 intensity는 개수 대신 크기에
   * 적용해 궁극기 여부와 메커니즘 종류를 분리한다.
   */
  combat(method: CombatVisualMethod, x: number, y: number, options: { color: number; intensity: number }): void {
    const scale = Math.max(0.7, options.intensity);
    if (method === "heal") {
      // 회복은 위로 뜨는 녹색 조각과 몸 안쪽에서 끝나는 작은 파동이다.
      this.burst("heal", x, y, { color: options.color, scale });
      this.openRing(x, y, 54 * scale, 300, 5, options.color);
      return;
    }
    if (method === "shieldGain") {
      // 새 막은 푸른 각형 막 두 겹이 차례로 형성된다.
      this.openRing(x, y, 104 * scale, 360, 8, options.color);
      this.openRing(x, y, 128 * scale, 420, 4, options.color, 70);
      return;
    }
    if (method === "shieldHit") { this.openRing(x, y, 94 * scale, 180, 7, options.color); return; }
    if (method === "shieldBreak") { this.burst("death", x, y, { color: options.color, scale: scale * 0.8 }); return; }
    // 진입은 윤곽이 밖으로 분해되고 해제는 작은 윤곽부터 커져 역방향으로 재결합한다.
    if (method === "stealthEnter") this.burst("passive", x, y, { color: options.color, scale });
    else {
      this.openRing(x, y, 108 * scale, 320, 6, options.color);
      this.openFlash(x, y, 54 * scale, 260, 0.3, options.color);
    }
  }

  private sustainedKey(fighterId: string, effectId: string): string { return `${fighterId}\u0000${effectId}`; }

  /** 짧은 평행 박자선은 현악기의 빠른 활놀림을 말하며, 낮은 알파라 폭주 필터를 가리지 않는다. */
  private drawMette(graphics: Phaser.GameObjects.Graphics, color: number): void {
    const spec = SUSTAINED_COMBAT_EFFECT.mette;
    graphics.clear().lineStyle(spec.lineWidth, color, spec.alpha);
    for (let row = -1; row <= 1; row += 1) graphics.lineBetween(-spec.halfWidth, row * spec.spacing - 5, spec.halfWidth, row * spec.spacing + 5);
  }

  /** 얇은 질주 궤적은 대상 쪽으로 모이며, 메테의 몸 주변 평행 박자선과 실루엣/방향이 다르다. */
  private drawLuka(graphics: Phaser.GameObjects.Graphics, color: number, aimX?: number, aimY?: number): void {
    const spec = SUSTAINED_COMBAT_EFFECT.luka;
    const angle = Math.atan2((aimY ?? graphics.y) - graphics.y, (aimX ?? graphics.x + 1) - graphics.x);
    graphics.clear().lineStyle(spec.lineWidth, color, spec.alpha).setRotation(angle);
    for (let lane = -1; lane <= 1; lane += 1) {
      const offset = lane * spec.spacing;
      graphics.lineBetween(-spec.length * 0.55, offset, spec.length * 0.45, offset * 0.35);
    }
  }

  /** 활성 목록 전체를 동기화한다. 누락은 사망·표적 변경·폭주 종료를 뜻하므로 즉시 회수한다. */
  syncSustained(targets: readonly SustainedEffectTarget[]): void {
    const seen = new Set<string>();
    for (const target of targets) {
      const key = this.sustainedKey(target.fighterId, target.effectId);
      seen.add(key);
      let slot = this.sustained.get(key);
      if (!slot) {
        const graphics = this.scene.add.graphics().setDepth(this.depth - 1);
        // 모션 감소가 0이면 무한 tween을 만들지 않고 정적인 홀로그램 표식만 유지한다.
        const duration = target.tag === "lukaSharedTargetHasteActive" ? SUSTAINED_COMBAT_EFFECT.luka.travelMs : SUSTAINED_COMBAT_EFFECT.mette.pulseMs;
        const tween = this.shakeFactor > 0 ? this.scene.tweens.add({ targets: graphics, alpha: { from: 0.45, to: 1 }, scaleX: target.tag === "lukaSharedTargetHasteActive" ? { from: 0.7, to: 1 } : 1,
          yoyo: true, repeat: -1, duration: duration / this.shakeFactor }) : undefined;
        slot = { graphics, tween, tag: target.tag };
        this.sustained.set(key, slot);
      }
      slot.graphics.setPosition(target.x, target.y);
      if (target.tag === "stealthActive") {
        slot.graphics.clear().setRotation(0).lineStyle(2, COLOR.inkDimHex, 0.22).strokePoints(groundDiamond(72), true);
      } else if (target.tag === "metteStaccatoActive") {
        slot.graphics.setRotation(0); this.drawMette(slot.graphics, target.color);
      } else this.drawLuka(slot.graphics, target.color, target.aimX, target.aimY);
    }
    for (const key of this.sustained.keys()) if (!seen.has(key)) this.removeSustained(key);
  }

  /** 조건 해제에서 무한 tween과 GPU 객체를 함께 끊는다. */
  private removeSustained(key: string): void {
    const slot = this.sustained.get(key);
    if (!slot) return;
    slot.tween?.stop(); slot.graphics.destroy(); this.sustained.delete(key);
  }

  /** 사망·Puppet 교체는 해당 런타임 전투원의 모든 제공자 효과를 즉시 회수한다. */
  removeSustainedForFighter(fighterId: string): void {
    const prefix = `${fighterId}\u0000`;
    for (const key of [...this.sustained.keys()]) if (key.startsWith(prefix)) this.removeSustained(key);
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
      .setAlpha(style.nearAlpha)
      .setScale(0.5)
      .setVisible(true);
    slot.tweens = [
      // 제 크기보다 조금 넘게 커졌다 돌아온다. 큰 한 방일수록 더 많이 튄다.
      this.scene.tweens.add({ targets: label, scale: style.punch, duration: 110, ease: "Back.Out",
        onComplete: () => { this.scene.tweens.add({ targets: label, scale: 1, duration: 90, ease: "Quad.Out" }); } }),
      this.scene.tweens.add({
        targets: label,
        y: label.y - style.rise,
        delay: style.holdMs,
        duration: style.riseMs,
        ease: "Quad.Out",
        // 진하기는 tween이 아니라 여기서 높이에 따라 정한다. 캐릭터 위에 있는 동안은 거의
        // 비쳐 보이고, 몸에서 떠오를수록 또렷해졌다가 끝에서 사라진다 — 예쁜 SD를 가리는
        // 순간 수치는 정보가 아니라 방해다. 프레임당 곱셈 몇 번이라 부담이 없다.
        onUpdate: (tween) => label.setAlpha(risingAlpha(tween.progress, style.nearAlpha, style.peakAlpha)),
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
    if (style.shake > 0 && this.shakeEnabled && this.shakeFactor > 0) {
      const shake = this.scene.cameras.main.shakeEffect;
      // 이미 더 세게 흔들리는 중이면 덧대지 않는다. 겹쳐 걸면 난전 내내 화면이 멎지 않는다.
      const intensity = style.shake * this.shakeFactor;
      if (!shake.isRunning || shake.intensity.x < intensity) this.scene.cameras.main.shake(150, intensity);
    }
  }

  /**
   * 그 개체를 그 개체답게 만드는 한 순간.
   *
   * 무엇을 그릴지는 `SIGNATURE_SPECS` 한 표가 정하고, 씬은 **누가 누구를 어떤 순간에
   * 쳤는지**만 넘긴다. 공용 파편과 같은 예산을 쓰므로 난전에서 넘치면 조용히 버려진다 —
   * 놓친 한 방보다 끊긴 프레임이 훨씬 크게 보인다.
   */
  signature(
    id: SignatureId,
    at: { x: number; y: number },
    palette: CombatPalette,
    options: { from?: { x: number; y: number }; step?: number; scale?: number } = {},
  ): void {
    const now = this.rollFrame();
    if (this.openedThisFrame >= EFFECT_BUDGET.perFrame) return;
    this.openedThisFrame += 1;
    const scale = options.scale ?? 1;
    if (id === "rexMaw") this.openMaw(at, palette, scale, now);
    else if (id === "spinoDoubleTap") this.openDoubleTap(at, palette, options.from);
    else if (id === "pachiSlam") this.openSlam(at, palette, scale, now);
    else if (id === "nodoniaShare") this.openShareFlow(options.from ?? at, at, palette, now);
    else this.openInkStroke(at, palette, options.step ?? 0, options.from, now);
  }

  /** 풀에서 그래픽 한 장을 꺼내 한 번 그리고 스스로 회수되는 tween을 건다. */
  private openShape(
    x: number, y: number, ms: number, now: number, depth: number,
    additive: boolean,
    draw: (graphics: Phaser.GameObjects.Graphics, t: number) => void,
  ): void {
    const slot = this.acquireRing();
    slot.openedAt = now;
    const graphics = slot.graphics.clear().setPosition(x, y).setAlpha(1).setDepth(depth).setVisible(true);
    if (additive) graphics.setBlendMode(Phaser.BlendModes.ADD);
    const state = { t: 0 };
    slot.tween = this.scene.tweens.add({
      targets: state,
      t: 1,
      duration: ms,
      ease: "Linear",
      onUpdate: () => { graphics.clear(); draw(graphics, state.t); },
      onComplete: () => {
        graphics.clear().setVisible(false).setBlendMode(Phaser.BlendModes.NORMAL);
        slot.tween = undefined;
      },
    });
  }

  /** 렉시아 — 위아래 턱이 맞물렸다 사라진다. 닫히는 동안이 곧 무는 동작이다. */
  private openMaw(at: { x: number; y: number }, palette: CombatPalette, scale: number, now: number): void {
    const spec = SIGNATURE_SPECS.rexMaw;
    const half = spec.halfWidth * scale;
    const depth = spec.depth * scale;
    const upper = mawTeeth(half, depth, spec.teeth, 1);
    const lower = mawTeeth(half, depth, spec.teeth, -1);
    this.openShape(at.x, at.y, spec.ms, now, this.depth, false, (graphics, t) => {
      // 간격이 0으로 좁혀지며 두 줄이 맞물린다. 마지막에 알파가 빠져 이빨이 남지 않는다.
      const gap = spec.gap * scale * (1 - t);
      const fade = 1 - t * t * t;
      for (const [points, side] of [[upper, -1], [lower, 1]] as const) {
        const moved = points.map((point) => ({ x: point.x, y: point.y + gap * side }));
        graphics.fillStyle(palette.main, spec.fillAlpha * fade);
        graphics.fillPoints(moved, true);
        graphics.lineStyle(spec.edgeWidth, palette.sub, fade);
        graphics.strokePoints(moved, true);
      }
    });
    // 맞물린 순간에 섬광 한 장. 턱이 닫히기 전에 터지면 무는 그림이 지워진다.
    this.scene.time.delayedCall(spec.ms, () => this.openFlash(at.x, at.y, spec.flash * scale, spec.flashMs, 0.5, palette.main));
  }

  /** 스피나 — 베인 자국 둘이 박자를 두고 지나간다. 두 번 때렸다는 것이 사이로 읽힌다. */
  private openDoubleTap(at: { x: number; y: number }, palette: CombatPalette, from: { x: number; y: number } | undefined): void {
    const spec = SIGNATURE_SPECS.spinoDoubleTap;
    // 벤 방향은 때린 쪽에서 맞은 쪽을 향한 각의 수직이다. 어디서 왔는지 모르면 비스듬히 긋는다.
    const base = from ? Phaser.Math.RadToDeg(Math.atan2(at.y - from.y, at.x - from.x)) + 90 : -34;
    const cut = (angle: number, length: number, delay: number): void => {
      this.scene.time.delayedCall(delay, () => {
        const points = slashPoints({ x: 0, y: 0 }, angle, length, spec.rootWidth, spec.tipWidth);
        this.openShape(at.x, at.y, spec.ms, this.scene.time.now, this.depth, true, (graphics, t) => {
          graphics.fillStyle(palette.main, spec.alpha * (1 - t * t));
          graphics.fillPoints(points, true);
        });
      });
    };
    cut(base, spec.length, 0);
    // 둘째 타는 각을 틀고 더 길다 — 같은 각·같은 길이면 한 번 그은 것이 깜빡인 것으로 보인다.
    cut(base + spec.angleGap, spec.length * spec.growth, spec.beatMs);
  }

  /** 파치 — 바닥을 친다. 납작한 충격파 한 겹과 갈라진 금. */
  private openSlam(at: { x: number; y: number }, palette: CombatPalette, scale: number, now: number): void {
    const spec = SIGNATURE_SPECS.pachiSlam;
    const radius = spec.radius * scale;
    // 바닥 자국이라 SD보다 뒤에 깐다. 앞에 두면 때린 그림이 캐릭터를 덮는다.
    this.openShape(at.x, at.y, spec.ms, now, this.groundDepth, false, (graphics, t) => {
      const fade = 1 - t * t;
      const grown = radius * (0.45 + 0.55 * t);
      graphics.lineStyle(spec.ringWidth * (1 - t * 0.6), palette.main, spec.alpha * fade);
      graphics.strokePoints([
        { x: 0, y: -grown * spec.squash }, { x: grown, y: 0 },
        { x: 0, y: grown * spec.squash }, { x: -grown, y: 0 },
      ], true);
      graphics.lineStyle(spec.crackWidth, palette.sub, spec.alpha * fade);
      for (let crack = 0; crack < spec.cracks; crack += 1) {
        // 금은 고르게 벌어지지 않는다 — 각을 조금씩 어긋나게 두어야 별이 아니라 균열이 된다.
        const angle = (crack / spec.cracks) * Math.PI * 2 + 0.4 + crack * 0.17;
        const length = spec.crackLength * scale * (0.6 + 0.4 * t);
        graphics.lineBetween(0, 0, Math.cos(angle) * length, Math.sin(angle) * length * spec.squash);
      }
    });
  }

  /** 노도니아 — 아군이 맞은 자리에서 노도니아 쪽으로 한 줄기가 흘러간다. */
  private openShareFlow(from: { x: number; y: number }, to: { x: number; y: number }, palette: CombatPalette, now: number): void {
    const spec = SIGNATURE_SPECS.nodoniaShare;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    this.openShape(0, 0, spec.ms, now, this.depth, true, (graphics, t) => {
      // 길 전체를 잇지 않고 **한 토막이 흘러간다**. 통째로 이으면 두 사람을 묶은 줄이 되어
      // 무엇이 어느 쪽으로 옮겨 갔는지 방향이 사라진다.
      const head = Math.min(1, t + spec.span);
      const tail = Math.max(0, t - spec.span * 0.4);
      const root: StrokePoint = { x: from.x + dx * tail, y: from.y + dy * tail };
      const tip: StrokePoint = { x: from.x + dx * head, y: from.y + dy * head };
      const mid: StrokePoint = { x: (root.x + tip.x) / 2, y: (root.y + tip.y) / 2 };
      graphics.fillStyle(palette.main, spec.alpha * (1 - t * t));
      graphics.fillPoints(lashPoints(root, mid, tip, spec.thickness, spec.thickness * 0.3), true);
    });
    // 도착한 자리에서 한 겹 인다. 흐름이 닿는 시각과 맞춰야 두 사건으로 보이지 않는다.
    this.scene.time.delayedCall(spec.ms * 0.7, () => this.openRing(to.x, to.y, spec.ringRadius, spec.ringMs, spec.ringWidth, palette.sub));
  }

  /**
   * 엘라 — 수묵 한 획.
   *
   * 걸음마다 획의 성질이 다르다. 번지고(점), 갈라지고(화), 끌린다(발). 겹쳐 밝아지는 합성을
   * 쓰지 않는 이유는 먹이 빛이 아니라 얼룩이기 때문이다.
   */
  private openInkStroke(
    at: { x: number; y: number }, palette: CombatPalette, step: number,
    from: { x: number; y: number } | undefined, now: number,
  ): void {
    const spec = SIGNATURE_SPECS.ellaInkStroke;
    const shape = spec.steps[step % spec.steps.length];
    // 끌리는 획(발)은 끌려오는 방향, 곧 엘라 쪽을 향한다. 나머지는 때린 방향을 따른다.
    const toward = from ? Phaser.Math.RadToDeg(Math.atan2(from.y - at.y, from.x - at.x)) : -20;
    const strokes: StrokePoint[][] = step === 0
      ? [inkBlotPoints({ x: 0, y: 0 }, shape.length)]
      : step === 1
        ? [
            slashPoints({ x: 0, y: 0 }, toward + 180 - spec.splitAngle, shape.length, shape.rootWidth, shape.tipWidth),
            slashPoints({ x: 0, y: 0 }, toward + 180 + spec.splitAngle, shape.length, shape.rootWidth, shape.tipWidth),
          ]
        : [slashPoints({ x: shape.length / 2 * Math.cos((toward * Math.PI) / 180), y: shape.length / 2 * Math.sin((toward * Math.PI) / 180) },
            toward, shape.length, shape.rootWidth, shape.tipWidth)];
    this.openShape(at.x, at.y, shape.ms, now, this.depth, false, (graphics, t) => {
      // 획은 그어진 뒤 마르듯 사라진다 — 처음이 가장 진하고 끝에서 급히 빠진다.
      const fade = 1 - t * t;
      for (const points of strokes) {
        graphics.fillStyle(spec.ink, spec.inkAlpha * fade);
        graphics.fillPoints(points, true);
        graphics.lineStyle(spec.edgeWidth, palette.main, spec.edgeAlpha * fade);
        graphics.strokePoints(points, true);
      }
    });
  }

  /** 씬이 꺼질 때 emitter와 두 풀을 모두 폐기한다. */
  destroy(): void {
    for (const key of [...this.sustained.keys()]) this.removeSustained(key);
    this.emitters.forEach((emitter) => emitter.destroy());
    this.emitters.clear();
    this.rings.forEach((slot) => { slot.tween?.stop(); slot.graphics.destroy(); });
    this.rings.length = 0;
    this.numbers.forEach((slot) => { slot.tweens.forEach((tween) => tween.stop()); slot.label.destroy(); });
    this.numbers.length = 0;
    this.bullets.forEach((slot) => { slot.tween?.stop(); slot.image.destroy(); });
    this.bullets.length = 0;
    this.lastAt.clear();
  }
}
