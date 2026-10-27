import Phaser from "phaser";
import { allowBurst, AREA_IMPACT, INK_AREA, INK_HIT, INK_RESTORE, INK_PROJECTILE, INK_STRIKE, inkStarStyle, lightenColor, projectilePosition, BATTLEFIELD_WASH_HOLD, BATTLEFIELD_WASH_RISE, EFFECT_BUDGET, EFFECT_PRESETS, EFFECT_TAP_COLOR, GROUND_SURFACE, REACH_STRIKE, SUSTAINED_COMBAT_EFFECT, type BurstSpec, type EffectKind } from "../ui/effectPresets";
import { EFFECT_TEXTURE, ensureEffectTextures } from "../ui/effectTextures";
import { ensureInkTextures } from "../ui/inkTextures";
import { INK_STYLE, inkTextureKey, type InkShapeId } from "../ui/inkShapes";
import { FEVER_INK, feverAngerPlacement, feverSirenRings } from "../ui/feverInk";
import { healVisual, SHIELD_AURA_SHAPE, shieldAuraStyle, shieldGainVisual } from "../ui/restoreEffects";
import { lashPoints } from "../ui/reachStrikeShape";
import { flashPolicy, inkBlotPoints, mawTeeth, slashPoints, SIGNATURE_INK_WIDTH, SIGNATURE_SPECS, type CombatPalette, type SignatureId, type StrokePoint } from "../ui/signatureEffects";
import { damagePopupStyle, risingAlpha, shouldShowDamagePopup, type DamagePopupRequest } from "../ui/damageNumbers";
import { battlefieldWashBands, groundAreaStyle, laneAreaPoints, radialAreaPoints, type GroundAreaRequest, type GroundAreaShape, type GroundAreaStyle } from "../ui/groundAreas";
import { COLOR, textStyle } from "../ui/theme";
import { motionPolicy, presentationPolicy, type GraphicsQuality, type MotionPolicy } from "../core/settings";
import type { ActiveCombatDisplayEffect } from "../core/combatEffects";
import type { ProjectileKind, StrikeKind } from "../core/types";

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
  /**
   * 일반·고정·지속 피해량 텍스트를 표시할지 여부다. 회복·보호막·무효처럼 전투 판단에 필요한
   * 별도 텍스트에는 적용하지 않는다. 이 옵션은 매니저 생성 시점의 전투 설정 스냅샷이다.
   *
   * 현재 전투에서는 설정 화면을 열 수 없으므로 변경 이벤트를 구독하지 않는다. 향후 전투 중
   * 설정 왕복을 지원하면 `SettingsManager`를 직접 결합하지 말고 갱신 메서드 또는 구독 해제까지
   * 소유하는 입력을 추가해, 이미 떠 있는 텍스트와 이후 사건 중 어디부터 적용할지도 함께 정한다.
   */
  damageNumbers: boolean;
  /** 파편과 파문이 서는 깊이. 수치 글자는 그보다 한 겹 위에 선다. */
  depth?: number;
  /** 호출 화면에서 확정한 공용 움직임 정책이다. 설정 원본을 받아 매니저가 다시 해석하지 않는다. */
  motion?: MotionPolicy;
  /** 공용 렌더 예산 정책의 입력이며 이펙트별 임의 품질 분기를 금지한다. */
  graphicsQuality?: GraphicsQuality;
  /** 모든 타격·전용 연출 섬광이 공유하는 접근성 입력이다. */
  reduceFlashes?: boolean;
  /**
   * 바닥에 깔리는 범위 표시의 깊이.
   *
   * SD보다 **뒤**여야 한다. 앞에 두면 범위가 캐릭터를 덮어 누가 어디 섰는지 가린다.
   */
  groundDepth?: number;
  /**
   * 몸에 붙어 따라다니는 지속 표시(보호막 원·지속 강화 표식)의 깊이.
   *
   * 한 번 터지고 마는 파편(`depth`)과 달리 **캐릭터의 일부**라 체력 바보다 아래, SD보다 위에 선다.
   * 파편과 같은 깊이에 두었을 때는 화면 옆에 붙는 기여도 판 위로 푸른 원이 떠올랐다.
   */
  bodyDepth?: number;
}

export interface BurstOptions {
  /** 파편·파문의 색. 보통 그 캐릭터의 속성·직군 색(`skillArtTint`)을 넘긴다. */
  color?: number;
  /** 파편이 주로 날아가는 방향(도). 주면 그 방향으로 부채꼴로 튄다. */
  direction?: number;
  /** 이펙트 전체 크기 배율. 큰 적을 때릴 때만 키운다. */
  scale?: number;
  /** 치명타였나. 잉크 별이 노랗게 한 등급 크게 선다. */
  critical?: boolean;
  /** 우리 편이 맞았나. 잉크 별이 붉게 선다(피해 수치와 같은 축). */
  incoming?: boolean;
  /** 수치 글자가 완전히 사라진 뒤 한 번 불린다. 표시 개수를 세는 곳만 쓴다. */
  onDone?: () => void;
}

/** 바닥에 머무는 면 하나. 키가 같으면 같은 도형을 다시 쓴다. */
export interface GroundSurface {
  key: string;
  x: number;
  y: number;
  radius: number;
  color: string;
}

interface SurfaceSlot {
  graphics: Phaser.GameObjects.Graphics;
  /** 0에서 1로 녹아들고, 사라질 때 같은 시간에 걸쳐 되돌아간다. */
  fade: number;
  last?: GroundSurface;
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
interface SustainedSlot { graphics: Phaser.GameObjects.Graphics; tween?: Phaser.Tweens.Tween; tag: SustainedTag; color?: number }

export type CombatVisualMethod = "heal" | "shieldGain" | "shieldHit" | "shieldBreak" | "stealthEnter" | "stealthExit" | "reagentReaction";

/** 마름모 파문 한 겹. 원이 아니라 각진 네 꼭짓점이라 SD의 각진 UI와 같은 결로 읽힌다. */
/** 잉크 조각의 먹색. 굽는 표(`INK_STYLE.ink`)와 같은 값이다. */
const INK_COLOR = Phaser.Display.Color.HexStringToColor(INK_STYLE.ink).color;

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

/**
 * 바닥에 누운 마름모를 Phaser 점으로 옮긴다.
 *
 * 비례는 `groundAreas.ts`가 갖는다 — 눌림 값을 여기서 다시 적으면 같은 바닥면 위의 도형이
 * 범위 표시와 조금씩 다른 각도로 눕는다.
 */
function groundDiamond(radius: number): Phaser.Geom.Point[] {
  return radialAreaPoints(radius).map((point) => new Phaser.Geom.Point(point.x, point.y));
}

/** 풀에서 꺼내 쓰는 탄환 한 알. */
/**
 * 순간 범위 한 겹을 잉크 결로 칠한다 — 색면, 밝힌 안쪽 셀 그늘, 먹선, 그 위의 밝힌 색 선.
 * 값은 `INK_AREA` 한 표에서 온다.
 */
function paintInkArea(
  graphics: Phaser.GameObjects.Graphics,
  outline: Phaser.Geom.Point[],
  core: Phaser.Geom.Point[],
  color: number,
  fade: number,
  spec: typeof INK_AREA,
): void {
  graphics.fillStyle(color, spec.fillAlpha * fade);
  graphics.fillPoints(outline, true);
  graphics.fillStyle(lightenColor(color, spec.coreLighten), spec.coreAlpha * fade);
  graphics.fillPoints(core, true);
  graphics.lineStyle(spec.inkWidth, INK_COLOR, spec.inkAlpha * fade);
  graphics.strokePoints(outline, true);
  graphics.lineStyle(spec.lineWidth, lightenColor(color, spec.lineLighten), fade);
  graphics.strokePoints(outline, true);
}

/** 날아가는 잉크 조각 한 알과 그 꼬리. 풀에서 꺼내 다시 쓴다. */
interface InkPieceSlot { image: Phaser.GameObjects.Image; tween?: Phaser.Tweens.Tween; openedAt: number }

interface ProjectileSlot {
  image: Phaser.GameObjects.Image;
  trail: Phaser.GameObjects.Image;
  tween?: Phaser.Tweens.Tween;
  openedAt: number;
}

export class EffectManager {
  private readonly scene: Phaser.Scene;
  private readonly depth: number;
  private readonly shakeEnabled: boolean;
  private readonly shakeFactor: number;
  private readonly groundDepth: number;
  private readonly bodyDepth: number;
  /** 바닥에 머무는 면들. 키는 그 판을 깔아 둔 개체와 판 번호다. */
  private readonly surfaces = new Map<string, SurfaceSlot>();
  private readonly quality: ReturnType<typeof presentationPolicy>;
  private readonly flashes: ReturnType<typeof flashPolicy>;
  /** 생성 시 받은 설정 스냅샷이며 피해량 텍스트에만 적용한다. */
  private readonly damageNumbers: boolean;
  /** 전장 경계. 가장자리 워시만 쓰며 씬이 `setArena`로 넘긴다. */
  private arena: { left: number; right: number; top: number; bottom: number } | undefined;
  private readonly emitters = new Map<EffectKind, Phaser.GameObjects.Particles.ParticleEmitter>();
  private readonly rings: RingSlot[] = [];
  private readonly numbers: NumberSlot[] = [];
  /** 날아가는 탄환 풀. 파문과 같은 이유로 다시 쓴다 — 평타마다 새로 만들면 GC가 프레임을 끊는다. */
  private readonly projectiles: ProjectileSlot[] = [];
  private readonly inkPieces: InkPieceSlot[] = [];
  private readonly lastAt = new Map<EffectKind, number>();
  /** 같은 전투원의 복수 제공자 효과를 보존하는 런타임 Fighter ID + 효과 ID 복합 키다. */
  private readonly sustained = new Map<string, SustainedSlot>();
  /** 회복 십자 풀. 파문과 같은 이유로 다시 쓴다. */
  private readonly crosses: Phaser.GameObjects.Image[] = [];
  /** 몸을 두른 보호막. 전투원마다 한 장이고 두께 단계가 바뀐 프레임에만 다시 그린다. */
  private lastFocusAt: number | undefined;
  private readonly feverMarks = new Map<string, { siren: Phaser.GameObjects.Graphics; anger: Phaser.GameObjects.Image }>();
  private readonly shieldAuras = new Map<string, { graphics: Phaser.GameObjects.Graphics; key: string }>();
  private frame = -1;
  private openedThisFrame = 0;

  constructor(scene: Phaser.Scene, options: EffectManagerOptions) {
    this.scene = scene;
    this.depth = options.depth ?? 300;
    // 비전투 오버레이의 기본값도 정책 함수로 만들어 모든 흔들림 우선순위를 한 경계에 둔다.
    const motion = options.motion ?? motionPolicy({
      presentation: { screenShake: true, battleUiMotion: "default" },
      accessibility: { reduceMotion: false },
    });
    this.shakeEnabled = motion.cameraShakeFactor > 0;
    this.shakeFactor = motion.cameraShakeFactor;
    this.groundDepth = options.groundDepth ?? this.depth - 400;
    this.bodyDepth = options.bodyDepth ?? this.depth - 1;
    this.quality = presentationPolicy(options.graphicsQuality ?? "high");
    this.flashes = flashPolicy(options.reduceFlashes ?? false);
    this.damageNumbers = options.damageNumbers;
    ensureEffectTextures(scene);
    ensureInkTextures(scene);
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
    // 전장의 잉크 결은 잉크 조각을 보통 합성으로 그린다 — 밝아지는 합성은 밝은 원화 위에서 하얗게
    // 묻혔다. 메뉴의 홀로그램 결만 예전 파편을 밝게 겹친다.
    const ink = spec.ink !== undefined;
    const emitter = this.scene.add.particles(0, 0, ink ? inkTextureKey("shard") : EFFECT_TEXTURE.shard, {
      lifespan: { min: spec.life[0], max: spec.life[1] },
      speed: { min: spec.speed[0], max: spec.speed[1] },
      angle: { min: 0, max: 360 },
      gravityY: spec.gravity,
      // 시작 배율에서 0까지 줄어들며 사라지므로 화면에 잔해가 남지 않는다.
      scale: { start: spec.shardScale * (ink ? INK_HIT.shardScale : 1), end: 0, ease: "Quad.Out" },
      alpha: { start: 1, end: 0, ease: "Quad.In" },
      // 마름모가 돌면서 폭이 변해 반짝이는 것처럼 보인다.
      rotate: { start: 0, end: spec.spin },
      blendMode: ink ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD,
      emitting: false,
      // 풀은 재사용하되 광역 타격·동시 사망으로 끝없이 늘리지 않는다.
      maxParticles: 24,
      maxAliveParticles: 24,
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
  private openRing(x: number, y: number, radius: number, ms: number, width: number, color: number, delay = 0, ink = false): void {
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
        const lineWidth = Math.max(1, width * (1 - state.t * 0.7));
        const alpha = 1 - state.t * state.t;
        // 잉크 결은 색 선 밑에 먹선을 한 겹 깐다 — 밝은 원화 위에서도 파문이 떨어져 나온다.
        if (ink) strokeDiamond(graphics, grown, lineWidth + INK_HIT.ringInkExtra, INK_COLOR, alpha);
        strokeDiamond(graphics, grown, lineWidth, color, alpha);
      },
      onComplete: () => {
        graphics.clear().setVisible(false);
        slot.tween = undefined;
      },
    });
  }

  /**
   * 바닥에 **머무는** 면들을 지금 상태에 맞춘다. 매 프레임 부른다.
   *
   * 여울처럼 자리에 걸린 지속 상태가 쓰는 길이다. 사건으로 알리지 않는 이유는 보호막 잔량과
   * 같다 — 매초 사건을 쏘면 그 순간에만 그려져 실제로 고여 있는 물과 화면이 갈리고, 순간
   * 표시(`groundArea`)의 벌어졌다 꺼지는 연출이 되풀이되어 깜빡임으로 읽힌다.
   *
   * 키로 맞춰 재사용하므로 판이 그대로면 도형을 다시 만들지 않는다. 사라진 키만 녹아 없어진다.
   */
  syncGroundSurfaces(surfaces: readonly GroundSurface[], nowSeconds: number): void {
    const wanted = new Map(surfaces.map((surface) => [surface.key, surface]));
    for (const [key, slot] of this.surfaces) {
      if (!wanted.has(key)) {
        // 물이 마르면 톡 사라지지 않고 같은 시간에 걸쳐 녹아 없어진다.
        slot.fade = Math.max(0, slot.fade - 1 / 60 / GROUND_SURFACE.fadeSeconds);
        if (slot.fade <= 0) { slot.graphics.destroy(); this.surfaces.delete(key); }
      }
    }
    for (const surface of surfaces) {
      let slot = this.surfaces.get(surface.key);
      if (!slot) {
        slot = { graphics: this.scene.add.graphics().setDepth(this.groundDepth), fade: 0 };
        this.surfaces.set(surface.key, slot);
      }
      slot.fade = Math.min(1, slot.fade + 1 / 60 / GROUND_SURFACE.fadeSeconds);
    }
    for (const [key, slot] of this.surfaces) {
      const surface = wanted.get(key);
      if (!surface && slot.fade <= 0) continue;
      const shown = surface ?? slot.last;
      if (!shown) continue;
      slot.last = shown;
      const color = Phaser.Display.Color.HexStringToColor(shown.color).color;
      // 숨은 **진하기로만** 쉰다. 크기를 흔들면 물가의 경계가 움직여 어디까지가 판인지 흐려진다.
      const breath = 1 + GROUND_SURFACE.breathAmplitude
        * Math.sin(nowSeconds / GROUND_SURFACE.breathSeconds * Math.PI * 2);
      const alpha = slot.fade * breath;
      const diamond = (radius: number): Phaser.Geom.Point[] =>
        radialAreaPoints(radius).map((point) => new Phaser.Geom.Point(point.x, point.y));
      const graphics = slot.graphics.clear().setPosition(shown.x, shown.y).setVisible(true);
      const surfaceInk = INK_AREA.surface;
      // 물결은 판보다 먼저 깐다 — 경계의 먹선이 언제나 맨 위에서 판의 끝을 쥔다.
      graphics.fillStyle(color, surfaceInk.fillAlpha * alpha);
      graphics.fillPoints(diamond(shown.radius), true);
      graphics.fillStyle(lightenColor(color, INK_AREA.coreLighten), surfaceInk.coreAlpha * alpha);
      graphics.fillPoints(diamond(shown.radius * INK_AREA.coreScale), true);
      for (let index = 0; index < surfaceInk.ripples; index += 1) {
        const phase = (nowSeconds / surfaceInk.rippleSeconds + index / surfaceInk.ripples) % 1;
        const ripple = diamond(shown.radius * (surfaceInk.rippleFrom + (1 - surfaceInk.rippleFrom) * phase));
        const rippleAlpha = surfaceInk.rippleAlpha * (1 - phase) * slot.fade;
        graphics.lineStyle(surfaceInk.rippleWidth, INK_COLOR, rippleAlpha);
        graphics.strokePoints(ripple, true);
        graphics.lineStyle(surfaceInk.rippleWidth / 2, lightenColor(color, surfaceInk.rippleLighten), rippleAlpha);
        graphics.strokePoints(ripple, true);
      }
      const edge = diamond(shown.radius);
      graphics.lineStyle(surfaceInk.inkWidth, INK_COLOR, surfaceInk.inkAlpha * slot.fade);
      graphics.strokePoints(edge, true);
      graphics.lineStyle(INK_AREA.lineWidth, lightenColor(color, INK_AREA.lineLighten), surfaceInk.lineAlpha * alpha);
      graphics.strokePoints(edge, true);
    }
  }

  /**
   * 광역이 터진 자리를 **바닥에** 그린다.
   *
   * 숫자만 셋이 한꺼번에 뜨면 왜 함께 맞았는지 읽히지 않는다. 반투명한 면 한 겹이 벌어졌다
   * 꺼지면서 "여기까지가 범위였다"를 한 번에 말한다. SD보다 뒤에 깔려 아무도 가리지 않는다.
   *
   * **양식은 하나뿐이다** — 색면과 밝힌 안쪽 한 겹, 먹선과 그 위의 색 선(`INK_AREA`). 무엇에 맞는지와 누가 깔았는지는
   * 무늬가 아니라 **색**이 말하고(`groundAreas.ts`), 순간과 지속은 남아 있는 시간이 가른다.
   * 모양은 판정이 쓴 것을 그대로 받는다 — 돌진을 원으로 그리면 보여 준 범위와 맞은 범위가 갈린다.
   */
  groundArea(shape: GroundAreaShape, request: GroundAreaRequest): void {
    const now = this.rollFrame();
    if (this.openedThisFrame >= EFFECT_BUDGET.perFrame) return;
    this.openedThisFrame += 1;
    const style = groundAreaStyle(request);
    const color = Phaser.Display.Color.HexStringToColor(style.color).color;
    if (shape.shape === "battlefield") { this.battlefieldWash(color, style, now); return; }
    const slot = this.acquireRing();
    slot.openedAt = now;
    // 통로는 월드 좌표 그대로 그린다. 국소 좌표에 그려 두고 컨테이너를 돌리면 바닥으로 누른
    // 세로까지 함께 돌아가 비스듬한 돌진이 바닥에 누운 것으로 보이지 않는다.
    const origin = shape.shape === "radial" ? { x: shape.x, y: shape.y } : { x: 0, y: 0 };
    const graphics = slot.graphics.clear().setPosition(origin.x, origin.y).setAlpha(1).setDepth(this.groundDepth).setVisible(true);
    const state = { t: 0 };
    slot.tween = this.scene.tweens.add({
      targets: state,
      t: 1,
      duration: style.ms,
      ease: "Linear",
      onUpdate: () => {
        // 처음 3할 동안 벌어지고, 6할까지 그대로 머문 뒤 빠진다 — 벌어지는 동안 이미 옅어지면
        // 무엇이 지나갔는지 눈에 남지 않는다.
        const opened = Math.min(1, state.t / INK_AREA.growUntil);
        const grow = AREA_IMPACT.growFrom + (1 - AREA_IMPACT.growFrom) * (1 - (1 - opened) ** 3);
        const fade = state.t < INK_AREA.holdUntil ? 1 : 1 - (state.t - INK_AREA.holdUntil) / (1 - INK_AREA.holdUntil);
        const outline = (scale: number): Phaser.Geom.Point[] => (shape.shape === "radial"
          ? radialAreaPoints(shape.radius * grow * scale)
          : laneAreaPoints(shape.from, shape.to, shape.halfWidth * grow * scale)
        ).map((point) => new Phaser.Geom.Point(point.x, point.y));
        graphics.clear();
        paintInkArea(graphics, outline(1), outline(INK_AREA.coreScale), color, fade, INK_AREA);
      },
      onComplete: () => {
        graphics.clear().setVisible(false);
        slot.tween = undefined;
      },
    });
  }

  /**
   * 전장 전체를 때리는 기술이 켜는 가장자리 워시.
   *
   * 전장 크기의 마름모를 깔면 화면 대부분이 덮여 정작 봐야 할 SD와 체력 바가 그 속에 묻힌다.
   * "어디까지"가 아니라 **"전부"**를 뜻하는 다른 문법이라, 네 변에서 안쪽으로 스며드는 띠
   * 몇 겹만 세운다. 캔버스 그라데이션은 열 때마다 프레임이 튀므로 **띠를 겹쳐** 계단으로
   * 만들고, 한 번만 그린 뒤 진하기만 tween한다.
   */
  private battlefieldWash(color: number, style: GroundAreaStyle, now: number): void {
    const arena = this.arena;
    if (!arena) return;
    const slot = this.acquireRing();
    slot.openedAt = now;
    const graphics = slot.graphics.clear().setPosition(0, 0).setAlpha(0).setDepth(this.groundDepth).setVisible(true);
    const width = arena.right - arena.left;
    const height = arena.bottom - arena.top;
    const short = Math.min(width, height);
    for (const band of battlefieldWashBands()) {
      const inset = short * band.inset;
      graphics.fillStyle(COLOR.void, style.backdropAlpha * band.alpha);
      graphics.fillRect(arena.left, arena.top, width, inset);
      graphics.fillRect(arena.left, arena.bottom - inset, width, inset);
      graphics.fillRect(arena.left, arena.top, inset, height);
      graphics.fillRect(arena.right - inset, arena.top, inset, height);
      graphics.fillStyle(color, style.fillAlpha * band.alpha);
      // 네 변을 각각 한 번씩 채워 모서리에서 두 겹이 겹치게 둔다 — 모서리가 조금 더 진해져
      // 빛이 바깥에서 스며드는 것처럼 보인다.
      graphics.fillRect(arena.left, arena.top, width, inset);
      graphics.fillRect(arena.left, arena.bottom - inset, width, inset);
      graphics.fillRect(arena.left, arena.top, inset, height);
      graphics.fillRect(arena.right - inset, arena.top, inset, height);
    }
    slot.tween = this.scene.tweens.add({
      targets: graphics,
      alpha: { from: 0, to: 1 },
      duration: style.ms * BATTLEFIELD_WASH_RISE,
      yoyo: true,
      hold: style.ms * BATTLEFIELD_WASH_HOLD,
      ease: "Sine.Out",
      onComplete: () => {
        graphics.clear().setVisible(false).setAlpha(1);
        slot.tween = undefined;
      },
    });
  }

  /**
   * 전장 경계를 알려 준다.
   *
   * 가장자리 워시만 쓴다 — 없으면 그릴 자리를 모르므로 조용히 건너뛴다. 전투 화면 밖에서 쓰는
   * `EffectManager`(로비의 누름 반응 등)는 전장이 없으니 그대로 두면 된다.
   */
  setArena(arena: { left: number; right: number; top: number; bottom: number } | undefined): void {
    this.arena = arena;
  }

  /**
   * 멀리서 때린 타격이 지나간 길.
   *
   * 근거리는 몸이 붙어 있어 파편만으로 누가 쳤는지 읽히지만, 떨어져서 때리면 사이를 잇는
   * 것이 없어 **맞은 자리에 숫자만 뜬다.** 씬은 두 자리와 사거리 단계만 넘기고, 무엇을
   * 그릴지는 `REACH_STRIKE` 한 표가 정한다.
   */
  reachStrike(
    from: { x: number; y: number },
    to: { x: number; y: number },
    tier: "mid" | "ranged",
    color: number,
    projectile?: ProjectileKind,
  ): void {
    const now = this.rollFrame();
    if (this.openedThisFrame >= EFFECT_BUDGET.perFrame) return;
    this.openedThisFrame += 1;
    // 중거리는 무엇을 날린다고 적힌 개체(카드·깃털)만 던지고 나머지는 채찍으로 친다.
    if (tier === "mid" && projectile === undefined) {
      this.openLash(from, to, color, now);
      return;
    }
    const kind = projectile ?? "signal";
    if (kind !== "volley") {
      this.openProjectile(from, to, kind, color, now, 0);
      return;
    }
    // 연사는 몇 발이 조금씩 어긋나 나간다 — 한 알이면 산개 사격이 저격처럼 읽힌다.
    const { count, gapMs, spread } = INK_PROJECTILE.volley;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    for (let shot = 0; shot < count; shot += 1) {
      const side = (shot - (count - 1) / 2) * spread;
      const aim = { x: to.x + (-dy / length) * side, y: to.y + (dx / length) * side };
      this.openProjectile(from, aim, kind, color, now, shot * gapMs);
    }
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
    const graphics = slot.graphics.clear().setPosition(0, 0).setAlpha(1).setDepth(this.depth).setVisible(true);
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
        const alpha = lash.alpha * (1 - state.t * state.t);
        const points = lashPoints(root, { x: midX, y: midY }, to, lash.rootWidth, lash.tipWidth);
        graphics.fillStyle(color, alpha);
        graphics.fillPoints(points, true);
        // 잉크 결 — 채찍을 먹선으로 둘러 밝은 원화 위에서도 떨어져 나오게 한다.
        const [thin, thick] = lash.inkWidth;
        graphics.lineStyle(thin + (thick - thin) * (1 - state.t), INK_COLOR, alpha);
        graphics.strokePoints(points, true);
      },
      onComplete: () => {
        graphics.clear().setVisible(false).setBlendMode(Phaser.BlendModes.NORMAL);
        slot.tween = undefined;
      },
    });
  }

  /**
   * 근접 평타의 결 — 베기·발톱·물기·강타(`INK_STRIKE`). 공용 별 위에 한 겹 얹는다.
   *
   * 같은 프레임의 타격 예산을 함께 쓴다 — 별이 버려진 프레임에는 획도 그리지 않는다.
   */
  meleeStrike(
    at: { x: number; y: number },
    feet: { x: number; y: number },
    kind: StrikeKind,
    color: number,
    facing: number,
    scale = 1,
  ): void {
    this.rollFrame();
    if (this.openedThisFrame > EFFECT_BUDGET.perFrame) return;
    const flip = facing < 0 ? -1 : 1;
    if (kind === "smash") {
      const smash = INK_STRIKE.smash;
      this.openRing(feet.x, feet.y, smash.radius * scale, smash.ms, smash.width, lightenColor(color, 0.25), 0, true);
      return;
    }
    if (kind === "slash") {
      const slash = INK_STRIKE.slash;
      this.openInkPiece("blade", color, slash.ms, 0, (image, t) => {
        const grow = Math.min(1, t / slash.growUntil);
        const size = (slash.from + (slash.to - slash.from) * (1 - (1 - grow) ** 3)) * scale;
        image.setPosition(at.x + slash.drift * t * flip, at.y)
          .setRotation((slash.tilt + t * slash.turn) * flip)
          .setScale(size * flip, size * 0.95);
      });
      return;
    }
    if (kind === "claw") {
      const claw = INK_STRIKE.claw;
      for (let mark = 0; mark < claw.count; mark += 1) {
        const offset = (mark - (claw.count - 1) / 2) * claw.gap * scale;
        this.openInkPiece("streak", color, claw.ms, mark * claw.gapMs, (image, t) => {
          const grow = Math.min(1, t / claw.growUntil);
          const length = (claw.from + (claw.to - claw.from) * (1 - (1 - grow) ** 3)) * scale;
          image.setPosition(at.x + (offset * 0.9 - 28 + claw.drift * t) * flip, at.y + offset * 0.45 - 20 + claw.drift * t)
            .setRotation(claw.tilt * flip)
            .setScale(length * flip, scale);
        });
      }
      return;
    }
    // 물기 — 위아래 두 턱이 한 박자에 닫힌다.
    const bite = INK_STRIKE.bite;
    for (const jaw of [-1, 1]) {
      this.openInkPiece("blade", color, bite.ms, 0, (image, t) => {
        const shut = Math.min(1, t / bite.shutAt);
        const gap = bite.open - (bite.open - bite.close) * (1 - (1 - shut) ** 3);
        image.setPosition(at.x, at.y + jaw * gap * scale)
          .setRotation(jaw < 0 ? 0 : Math.PI)
          .setScale(bite.scale * scale * flip, bite.scale * scale);
      });
    }
  }

  /** 잉크 조각 한 장을 수명 동안 `place`로 움직이고, 끝 무렵에만 옅어지게 한다. */
  private openInkPiece(
    shape: InkShapeId,
    color: number,
    ms: number,
    delay: number,
    place: (image: Phaser.GameObjects.Image, t: number) => void,
  ): void {
    let slot = this.inkPieces.find((entry) => entry.tween === undefined);
    if (!slot) {
      if (this.inkPieces.length >= INK_STRIKE.maxLive) {
        slot = this.inkPieces.reduce((oldest, entry) => entry.openedAt < oldest.openedAt ? entry : oldest);
        slot.tween?.stop();
      } else {
        slot = { image: this.scene.add.image(0, 0, inkTextureKey(shape)).setVisible(false), openedAt: 0 };
        this.inkPieces.push(slot);
      }
    }
    const piece = slot;
    piece.openedAt = this.scene.time.now;
    const image = piece.image.setVisible(false).setActive(true).setTexture(inkTextureKey(shape)).setTint(color).setDepth(this.depth).setAlpha(1);
    // Phaser의 onStart와 첫 onUpdate 사이에도 렌더가 돈다. 숨긴 상태에서 위치·크기·회전을 먼저 확정한다.
    place(image, 0);
    const state = { t: 0 };
    piece.tween = this.scene.tweens.add({
      targets: state,
      t: 1,
      delay,
      duration: ms,
      onStart: () => image.setVisible(true),
      onUpdate: () => {
        place(image, state.t);
        image.setAlpha(state.t < INK_STRIKE.fadeFrom ? 1 : 1 - (state.t - INK_STRIKE.fadeFrom) / (1 - INK_STRIKE.fadeFrom));
      },
      onComplete: () => { image.setVisible(false).setActive(false); piece.tween = undefined; },
    });
  }

  /** 풀에서 투사체 한 알을 꺼낸다. 상한을 넘으면 가장 오래된 것을 즉시 회수한다. */
  private acquireProjectile(): ProjectileSlot {
    const free = this.projectiles.find((slot) => !slot.image.visible && slot.tween === undefined);
    if (free) return free;
    if (this.projectiles.length >= INK_PROJECTILE.maxLive) {
      const oldest = this.projectiles.reduce((old, slot) => (slot.openedAt < old.openedAt ? slot : old));
      oldest.tween?.stop();
      oldest.tween = undefined;
      oldest.image.setVisible(false);
      oldest.trail.setVisible(false);
      return oldest;
    }
    const slot: ProjectileSlot = {
      image: this.scene.add.image(0, 0, inkTextureKey("signal")).setVisible(false),
      trail: this.scene.add.image(0, 0, inkTextureKey("trail")).setVisible(false),
      openedAt: 0,
    };
    this.projectiles.push(slot);
    return slot;
  }

  /**
   * 투사체 — 잉크 조각 하나가 **실제로 날아간다**(`INK_PROJECTILE`).
   *
   * 피해는 이미 확정된 뒤라 연출이 늦으면 숫자가 먼저 뜨고 화살이 나중에 닿는다. 그래서 거리와
   * 무관하게 시간을 고정해 **먼 적일수록 빨라 보이게** 한다. 길이는 늘이지 않는다.
   */
  private openProjectile(
    from: { x: number; y: number },
    to: { x: number; y: number },
    kind: ProjectileKind,
    color: number,
    now: number,
    delay: number,
  ): void {
    const spec = INK_PROJECTILE.kinds[kind];
    const slot = this.acquireProjectile();
    slot.openedAt = now;
    // 채찍보다 한 겹 위다. 같은 깊이에 두면 나중에 열린 채찍이 투사체를 덮는다.
    const depth = this.depth + INK_PROJECTILE.depthLift;
    const image = slot.image.setTexture(inkTextureKey(spec.shape)).setTint(color).setScale(spec.scale)
      .setPosition(from.x, from.y).setAlpha(1).setDepth(depth).setVisible(false);
    const trail = slot.trail.setTint(lightenColor(color, INK_PROJECTILE.trail.lighten)).setDepth(depth - 0.5).setVisible(false);
    const state = { t: 0 };
    const paint = (): void => {
      const at = projectilePosition(from, to, kind, state.t);
      const ahead = projectilePosition(from, to, kind, Math.min(1, state.t + 0.02));
      const heading = Math.atan2(ahead.y - at.y, ahead.x - at.x);
      const fade = state.t < INK_PROJECTILE.fadeFrom ? 1 : 1 - (state.t - INK_PROJECTILE.fadeFrom) / (1 - INK_PROJECTILE.fadeFrom);
      image.setPosition(at.x, at.y).setAlpha(fade);
      if (spec.spin) image.setRotation(state.t * INK_PROJECTILE.ms / 1000 * spec.spin);
      else if (kind === "note") image.setRotation(Math.sin(state.t * 9) * 0.3);
      else if (spec.flip) image.setRotation(heading + Math.PI / 2).setScale(spec.scale * Math.cos(state.t * Math.PI * 5), spec.scale);
      else image.setRotation(heading);
      if (spec.trail) {
        const back = INK_PROJECTILE.trail.offset * spec.scale;
        trail.setPosition(at.x - Math.cos(heading) * back, at.y - Math.sin(heading) * back)
          .setRotation(heading)
          .setScale(spec.scale)
          .setAlpha(INK_PROJECTILE.trail.alpha * Math.min(1, state.t / 0.2) * fade);
      }
    };
    // 재사용한 꼬리의 이전 좌표·각도·알파도 표시 전에 초기화한다. 별도 프레임 콜백은 추가하지 않는다.
    paint();
    slot.tween = this.scene.tweens.add({
      targets: state, t: 1, delay, duration: INK_PROJECTILE.ms,
      onStart: () => { image.setVisible(true); trail.setVisible(spec.trail === true); },
      onUpdate: paint,
      onComplete: () => {
        image.setVisible(false);
        trail.setVisible(false);
        slot.tween = undefined;
      },
    });
  }

  /** 가운데 섬광 한 장. 터지는 순간 가장 밝고 곧바로 꺼진다. */
  private openFlash(x: number, y: number, size: number, ms: number, alpha: number, color: number): void {
    // 중심 광채는 판정 표시가 아닌 추가 후처리이므로 low에서만 생성 작업 자체를 생략한다.
    if (!this.quality.postProcessing) return;
    const flash = this.scene.add.image(x, y, EFFECT_TEXTURE.glow)
      .setDisplaySize(size, size * 0.92)
      .setTint(color)
      .setAlpha(alpha * this.flashes.alphaRatio)
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
      emitter.explode(Math.max(1, Math.round(spec.shards * this.quality.particleRatio)), x, y);
    }
    for (let ring = 0; ring < Math.ceil(spec.rings * this.quality.ringRatio); ring += 1) {
      // 두 겹째는 조금 늦게, 조금 더 크게 벌어져 한 겹이 두 번 밀려나는 것처럼 보인다.
      this.openRing(x, y, spec.ringRadius * scale * (1 + ring * 0.42), spec.ringMs + ring * 90, spec.ringWidth, ring === 0 ? color : 0xffffff, ring * 70, spec.ink !== undefined);
    }
    if (spec.ink) {
      if (kind === "ultimate") this.openFocusLines(x, y, now);
      if (spec.ink.star > 0) this.openInkStar(x, y, spec.ink.star * scale, color, options);
    } else if (spec.flash > 0) this.openFlash(x, y, spec.flash * scale, spec.flashMs, spec.flashAlpha, color);
  }

  /**
   * 맞은 자리의 잉크 별 — 작게 서서 팡 벌어졌다가 또렷한 채로 머물고, 끝에서만 옅어진다.
   *
   * 밝아지는 섬광과 달리 겹쳐도 하얗게 뭉개지지 않는다. 별 하나가 "여기 맞았다"를 말하므로
   * 낮은 품질에서도 생략하지 않는다.
   */
  private openInkStar(x: number, y: number, size: number, color: number, options: BurstOptions): void {
    const style = inkStarStyle(color, options);
    const peak = size * style.scale;
    const star = this.scene.add.image(x, y, inkTextureKey("star"))
      .setTint(style.color)
      .setRotation(Phaser.Math.FloatBetween(-0.3, 0.3))
      .setScale(peak * INK_HIT.starFrom)
      .setDepth(this.depth);
    const state = { t: 0 };
    this.scene.tweens.add({
      targets: state,
      t: 1,
      duration: style.ms,
      onUpdate: () => {
        const grow = Math.min(1, state.t / INK_HIT.starPeakAt);
        const eased = 1 - (1 - grow) ** 3;
        star.setScale(peak * (INK_HIT.starFrom + (1 - INK_HIT.starFrom) * eased));
        star.setAlpha(state.t < INK_HIT.starFadeAt ? 1 : 1 - (state.t - INK_HIT.starFadeAt) / (1 - INK_HIT.starFadeAt));
      },
      onComplete: () => star.destroy(),
    });
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
      this.healBurst(x, y, options.intensity, options.color);
      return;
    }
    if (method === "shieldGain") {
      this.shieldPulse(x, y, options.intensity, options.color);
      return;
    }
    if (method === "shieldHit") { this.openRing(x, y, 94 * scale, 180, 7, options.color, 0, true); return; }
    if (method === "shieldBreak") { this.shieldShatter(x, y, scale, options.color); return; }
    if (method === "reagentReaction") {
      // 전용 애니메이션 에셋을 만들지 않고 기존 파문 풀을 크기가 다른 세 수포처럼 벌린다.
      // 한 사건에서만 이 묶음을 열기 때문에 독 시작·회복 사건이 뒤따라도 다시 재생되지 않는다.
      this.openRing(x - 24 * scale, y + 8 * scale, 22 * scale, 260, 3, options.color, 0, true);
      this.openRing(x + 4 * scale, y - 14 * scale, 34 * scale, 330, 3, options.color, 35, true);
      this.openRing(x + 31 * scale, y + 3 * scale, 18 * scale, 240, 2, options.color, 75, true);
      return;
    }
    // 진입은 윤곽이 밖으로 분해되고 해제는 작은 윤곽부터 커져 역방향으로 재결합한다.
    if (method === "stealthEnter") this.burst("passive", x, y, { color: options.color, scale });
    else {
      // 전장의 결이라 밝아지는 섬광 대신 잉크 별 하나가 "여기서 드러났다"를 말한다.
      this.openRing(x, y, 108 * scale, 320, 6, options.color, 0, true);
      this.openInkStar(x, y, 0.7 * scale, options.color, {});
    }
  }

  /**
   * 회복 — 몸에서 은은한 초록 기운이 번지고 굵은 십자가 위로 솟는다. 양이 많을수록 기운이 넓고
   * 진해지며 십자가 여럿 차례로 솟는다(`healVisual`). 매초 도는 재생은 작은 십자 하나뿐이다.
   */
  private healBurst(x: number, y: number, intensity: number, color: number): void {
    const now = this.rollFrame();
    if (!allowBurst("heal", now, this.lastAt.get("heal"), this.openedThisFrame)) return;
    this.lastAt.set("heal", now);
    this.openedThisFrame += 1;
    const visual = healVisual(intensity);
    this.openHealDiamond(x, y + INK_RESTORE.heal.feetOffset, visual.glowSize, visual.lifeMs * 0.7, color);
    const count = Math.max(1, Math.round(visual.crosses * this.quality.particleRatio));
    for (let index = 0; index < count; index += 1) {
      // 난수 없이 몸 둘레에 고르게 벌린다 — 같은 회복이 늘 같은 그림을 그린다.
      const lane = count === 1 ? 0 : (index / (count - 1)) * 2 - 1;
      const size = visual.crossSize * (index % 2 === 0 ? 1 : 0.72);
      this.openCross(x + lane * visual.spread, y + 18 - Math.abs(lane) * 14, size, visual.rise, visual.lifeMs, index * visual.staggerMs, color);
    }
  }

  private openCross(x: number, y: number, size: number, rise: number, ms: number, delay: number, color: number): void {
    let image = this.crosses.find((candidate) => !candidate.visible);
    if (!image) {
      if (this.crosses.length >= EFFECT_BUDGET.maxRings) return;
      image = this.scene.add.image(0, 0, inkTextureKey("cross")).setVisible(false);
      this.crosses.push(image);
    }
    const cross = image.setPosition(x, y).setTint(color).setDepth(this.depth).setAlpha(0).setDisplaySize(size * 0.4, size * 0.4).setVisible(true);
    const { crossPop, crossPopAt } = INK_RESTORE.heal;
    this.scene.tweens.add({
      targets: cross, delay, duration: ms, y: y - rise, ease: "Quad.Out",
      onUpdate: (tween) => {
        const p = tween.progress;
        // 톡 넘쳤다가 제 크기로 돌아온다 — 잉크 조각은 밝아지며 번지지 않으므로 크기가 "솟았다"를 말한다.
        const grow = p < crossPopAt ? 0.4 + (crossPop - 0.4) * (p / crossPopAt) : crossPop - (crossPop - 1) * Math.min(1, (p - crossPopAt) / crossPopAt);
        cross.setDisplaySize(size * grow, size * grow);
        cross.setAlpha(p < 0.15 ? p / 0.15 : p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4);
      },
      onComplete: () => cross.setVisible(false),
    });
  }

  /** 보호막이 덮이는 순간 — 몸을 두르는 푸른 원이 바깥에서 조여 든다. 두꺼운 막일수록 굵고 진하다. */
  private shieldPulse(x: number, y: number, intensity: number, color: number): void {
    const visual = shieldGainVisual(intensity);
    for (let ring = 0; ring < visual.rings; ring += 1) {
      const slot = this.acquireRing();
      slot.openedAt = this.scene.time.now;
      const graphics = slot.graphics.clear().setPosition(x, y).setAlpha(1).setDepth(this.depth).setVisible(true);
      const state = { t: 0 };
      slot.tween = this.scene.tweens.add({
        targets: state, t: 1, delay: ring * 90, duration: 420, ease: "Cubic.Out",
        onUpdate: () => {
          // 크게 벌어진 원이 몸 둘레로 조여 들며 굵어진다 — 막이 몸에 붙는 순간이다.
          const scale = 1.5 - state.t * 0.5;
          graphics.clear();
          const width = visual.width * (0.5 + state.t * 0.5);
          const alpha = visual.alpha * (1 - state.t * 0.6);
          graphics.lineStyle(width + INK_RESTORE.shield.inkExtra, INK_COLOR, alpha);
          graphics.strokeEllipse(0, 0, 150 * scale, 190 * scale);
          graphics.lineStyle(width, color, alpha);
          graphics.strokeEllipse(0, 0, 150 * scale, 190 * scale);
        },
        onComplete: () => { graphics.clear().setVisible(false); slot.tween = undefined; },
      });
    }
  }

  /** 회복 발밑의 초록 마름모 — 먹선이 경계를 쥐고 벌어지며 옅어진다. */
  private openHealDiamond(x: number, y: number, size: number, ms: number, color: number): void {
    const slot = this.acquireRing();
    slot.openedAt = this.scene.time.now;
    const graphics = slot.graphics.clear().setPosition(x, y).setAlpha(1).setDepth(this.groundDepth).setVisible(true);
    const spec = INK_RESTORE.heal;
    const state = { t: 0 };
    slot.tween = this.scene.tweens.add({
      targets: state, t: 1, duration: ms, ease: "Cubic.Out",
      onUpdate: () => {
        const radius = size * (spec.diamond[0] + (spec.diamond[1] - spec.diamond[0]) * state.t);
        const points = radialAreaPoints(radius).map((point) => new Phaser.Geom.Point(point.x, point.y));
        const fade = 1 - state.t;
        graphics.clear();
        graphics.fillStyle(color, spec.fillAlpha * fade);
        graphics.fillPoints(points, true);
        graphics.lineStyle(spec.inkWidth, INK_COLOR, 0.9 * fade);
        graphics.strokePoints(points, true);
      },
      onComplete: () => { graphics.clear().setVisible(false); slot.tween = undefined; },
    });
  }

  /** 보호막이 깨지는 순간 — 막 조각이 몸 둘레에서 바깥으로 흩어지고 붉은 별이 선다. */
  private shieldShatter(x: number, y: number, scale: number, color: number): void {
    const now = this.rollFrame();
    if (this.openedThisFrame >= EFFECT_BUDGET.perFrame) return;
    this.openedThisFrame += 1;
    const spec = INK_RESTORE.shield;
    const count = Math.max(4, Math.round(spec.breakShards * this.quality.particleRatio));
    for (let index = 0; index < count; index += 1) {
      // 난수 없이 고르게 돈다 — 같은 깨짐이 늘 같은 그림을 그린다.
      const angle = (index / count) * Math.PI * 2 + 0.2;
      this.openInkPiece("ringShard", color, spec.breakMs, 0, (image, t) => {
        const distance = (spec.breakRadius + spec.breakTravel * (1 - (1 - t) ** 3)) * scale;
        image.setPosition(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance * 1.08)
          .setRotation(angle + Math.PI / 2 + t * 2)
          .setScale(scale);
      });
    }
    this.openInkStar(x, y, spec.breakStar * scale, color, { incoming: true });
    this.lastAt.set("shield", now);
  }

  /**
   * 궁극기의 집중선 — 맞은 자리를 향해 먹 빗살이 안으로 조여 든다. 광역이 여럿을 함께 때려도
   * 한 번뿐이다.
   */
  private openFocusLines(x: number, y: number, now: number): void {
    const spec = INK_RESTORE.focus;
    if (this.lastFocusAt !== undefined && now - this.lastFocusAt < spec.gapMs) return;
    this.lastFocusAt = now;
    const slot = this.acquireRing();
    slot.openedAt = now;
    const graphics = slot.graphics.clear().setPosition(x, y).setAlpha(1).setDepth(this.depth).setVisible(true);
    const state = { t: 0 };
    slot.tween = this.scene.tweens.add({
      targets: state, t: 1, duration: spec.ms,
      onUpdate: () => {
        const eased = 1 - (1 - state.t) ** 3;
        const inner = spec.inner - spec.travel * eased;
        graphics.clear().fillStyle(INK_COLOR, spec.alpha * (1 - state.t));
        for (let ray = 0; ray < spec.rays; ray += 1) {
          // 홀수 빗살을 조금 비틀어 고른 바큇살로 보이지 않게 한다.
          const angle = (ray / spec.rays) * Math.PI * 2 + (ray % 2) * 0.12;
          const half = spec.widths[ray % spec.widths.length] / 2;
          const outer = inner + spec.length;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          graphics.fillTriangle(
            cos * inner, sin * inner,
            cos * outer - sin * half, sin * outer + cos * half,
            cos * outer + sin * half, sin * outer - cos * half,
          );
        }
      },
      onComplete: () => { graphics.clear().setVisible(false); slot.tween = undefined; },
    });
  }

  /**
   * 몸을 두른 보호막 — 잔량이 있는 동안 늘 서는 푸른 원이다(`shieldAuraStyle`).
   *
   * 사건이 아니라 **잔량**을 따라가므로 매 프레임 목록을 받아 자리만 옮기고, 두께 단계가 바뀐
   * 프레임에만 다시 그린다. 목록에서 빠진 전투원(막이 다 깎였거나 쓰러졌다)은 곧바로 걷는다.
   */
  syncShieldAuras(targets: readonly { id: string; x: number; y: number; height: number; shield: number; maxHp: number; color: number }[]): void {
    const seen = new Set<string>();
    for (const target of targets) {
      const style = shieldAuraStyle(target.shield, target.maxHp);
      if (!style) continue;
      seen.add(target.id);
      let aura = this.shieldAuras.get(target.id);
      if (!aura) {
        aura = { graphics: this.scene.add.graphics().setDepth(this.bodyDepth), key: "" };
        this.shieldAuras.set(target.id, aura);
      }
      const width = target.height * SHIELD_AURA_SHAPE.widthRatio;
      const height = target.height * SHIELD_AURA_SHAPE.heightRatio;
      const key = `${style.level}:${Math.round(width)}:${Math.round(height)}`;
      if (aura.key !== key) {
        aura.key = key;
        aura.graphics.clear();
        aura.graphics.fillStyle(target.color, style.fillAlpha);
        aura.graphics.fillEllipse(0, 0, width, height);
        // 먹선이 바깥을 쥐고 그 위에 막 색이 선다 — 밝은 원화 위에서도 막의 경계가 떨어져 나온다.
        aura.graphics.lineStyle(style.width + INK_RESTORE.shield.inkExtra, INK_COLOR, style.alpha);
        aura.graphics.strokeEllipse(0, 0, width, height);
        aura.graphics.lineStyle(style.width, target.color, style.alpha);
        aura.graphics.strokeEllipse(0, 0, width, height);
        // 안쪽에 가는 밝힌 선 한 줄 — 막의 두께가 선 두 줄 사이의 폭으로 읽힌다.
        aura.graphics.lineStyle(1.5, lightenColor(target.color, INK_RESTORE.shield.innerLighten), style.alpha * 0.7);
        aura.graphics.strokeEllipse(0, 0, width - style.width * 2.4, height - style.width * 2.4);
      }
      aura.graphics.setPosition(target.x, target.y - target.height * 0.5).setVisible(true);
    }
    for (const [id, aura] of this.shieldAuras) {
      if (seen.has(id)) continue;
      aura.graphics.destroy();
      this.shieldAuras.delete(id);
    }
  }

  /**
   * 폭주 중인 개체의 발밑 사이렌과 머리 옆 빠직 표식(💢)을 맞춘다. 매 프레임 부른다.
   *
   * 몸의 테두리는 개체 자신이 그리고(`setAfterimages`), 여기서는 몸 밖의 둘만 맡는다. 목록에서
   * 빠진 개체(폭주가 끝나 다 녹았거나 쓰러졌다)는 곧바로 걷는다.
   */
  syncFeverMarks(targets: readonly { id: string; x: number; feetY: number; headY: number; scale: number; ageMs: number; fade: number }[]): void {
    const seen = new Set<string>();
    for (const target of targets) {
      seen.add(target.id);
      let mark = this.feverMarks.get(target.id);
      if (!mark) {
        mark = {
          siren: this.scene.add.graphics().setDepth(this.groundDepth),
          anger: this.scene.add.image(0, 0, inkTextureKey("anger")).setTint(FEVER_INK.anger.color).setDepth(this.bodyDepth),
        };
        this.feverMarks.set(target.id, mark);
      }
      const siren = FEVER_INK.siren;
      const graphics = mark.siren.clear().setPosition(target.x, target.feetY).setVisible(true);
      for (const ring of feverSirenRings(target.ageMs)) {
        const points = radialAreaPoints(ring.radius * target.scale).map((point) => new Phaser.Geom.Point(point.x, point.y));
        const alpha = target.fade * ring.strength;
        graphics.fillStyle(FEVER_INK.anger.color, siren.fillAlpha * alpha);
        graphics.fillPoints(points, true);
        graphics.lineStyle(siren.inkWidth[0] + (siren.inkWidth[1] - siren.inkWidth[0]) * ring.strength, INK_COLOR, alpha);
        graphics.strokePoints(points, true);
        graphics.lineStyle(siren.lineWidth[0] + (siren.lineWidth[1] - siren.lineWidth[0]) * ring.strength, FEVER_INK.red[1], alpha);
        graphics.strokePoints(points, true);
      }
      const placement = feverAngerPlacement(target.ageMs);
      mark.anger
        .setPosition(target.x + placement.side * FEVER_INK.anger.side * target.scale, target.headY + FEVER_INK.anger.lift * target.scale)
        .setRotation(placement.side * FEVER_INK.anger.tilt)
        .setScale(placement.scale * target.fade * target.scale)
        .setAlpha(target.fade)
        .setVisible(target.fade > 0);
    }
    for (const [id, mark] of this.feverMarks) {
      if (seen.has(id)) continue;
      mark.siren.destroy();
      mark.anger.destroy();
      this.feverMarks.delete(id);
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
  private drawLuka(graphics: Phaser.GameObjects.Graphics, color: number): void {
    const spec = SUSTAINED_COMBAT_EFFECT.luka;
    graphics.clear().lineStyle(spec.lineWidth, color, spec.alpha);
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
      if (slot && slot.tag !== target.tag) { this.removeSustained(key); slot = undefined; }
      if (!slot) {
        const graphics = this.scene.add.graphics().setDepth(this.bodyDepth);
        // 모션 감소가 0이면 무한 tween을 만들지 않고 정적인 홀로그램 표식만 유지한다.
        const duration = target.tag === "lukaSharedTargetHasteActive" ? SUSTAINED_COMBAT_EFFECT.luka.travelMs : SUSTAINED_COMBAT_EFFECT.mette.pulseMs;
        const tween = this.shakeFactor > 0 ? this.scene.tweens.add({ targets: graphics, alpha: { from: 0.45, to: 1 }, scaleX: target.tag === "lukaSharedTargetHasteActive" ? { from: 0.7, to: 1 } : 1,
          yoyo: true, repeat: -1, duration: duration / this.shakeFactor }) : undefined;
        slot = { graphics, tween, tag: target.tag };
        this.sustained.set(key, slot);
      }
      slot.graphics.setPosition(target.x, target.y);
      if (slot.color !== target.color) {
        if (target.tag === "stealthActive") slot.graphics.clear().lineStyle(2, COLOR.inkDimHex, 0.22).strokePoints(groundDiamond(72), true);
        else if (target.tag === "metteStaccatoActive") this.drawMette(slot.graphics, target.color);
        else this.drawLuka(slot.graphics, target.color);
        slot.color = target.color;
      }
      slot.graphics.setRotation(target.tag === "lukaSharedTargetHasteActive"
        ? Math.atan2((target.aimY ?? target.y) - target.y, (target.aimX ?? target.x + 1) - target.x) : 0);
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
    // 정책을 풀 획득보다 먼저 적용해야 꺼진 피해 수치가 Phaser Text 객체조차 만들지 않는다.
    if (!shouldShowDamagePopup(request, this.damageNumbers)) return;
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

  /** Canvas DOM 밖 객체 생성을 E2E가 관찰하는 읽기 전용 진단값이다. 전투 규칙에는 사용하지 않는다. */
  get allocatedNumberCount(): number { return this.numbers.length; }

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
        graphics.lineStyle(SIGNATURE_INK_WIDTH + spec.edgeWidth * 0.5, INK_COLOR, fade);
        graphics.strokePoints(moved, true);
        graphics.lineStyle(spec.edgeWidth * 0.5, palette.sub, fade);
        graphics.strokePoints(moved, true);
      }
    });
    // 맞물린 순간에 잉크 별 한 장. 턱이 닫히기 전에 터지면 무는 그림이 지워진다.
    this.scene.time.delayedCall(spec.ms, () => this.openInkStar(at.x, at.y, (spec.flash / 120) * scale, palette.main, {}));
  }

  /** 스피나 — 베인 자국 둘이 박자를 두고 지나간다. 두 번 때렸다는 것이 사이로 읽힌다. */
  private openDoubleTap(at: { x: number; y: number }, palette: CombatPalette, from: { x: number; y: number } | undefined): void {
    const spec = SIGNATURE_SPECS.spinoDoubleTap;
    // 벤 방향은 때린 쪽에서 맞은 쪽을 향한 각의 수직이다. 어디서 왔는지 모르면 비스듬히 긋는다.
    const base = from ? Phaser.Math.RadToDeg(Math.atan2(at.y - from.y, at.x - from.x)) + 90 : -34;
    const cut = (angle: number, length: number, delay: number): void => {
      this.scene.time.delayedCall(delay, () => {
        const points = slashPoints({ x: 0, y: 0 }, angle, length, spec.rootWidth, spec.tipWidth);
        this.openShape(at.x, at.y, spec.ms, this.scene.time.now, this.depth, false, (graphics, t) => {
          const fade = 1 - t * t;
          graphics.fillStyle(palette.main, spec.alpha * fade);
          graphics.fillPoints(points, true);
          graphics.lineStyle(SIGNATURE_INK_WIDTH * 0.7, INK_COLOR, fade);
          graphics.strokePoints(points, true);
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
      const ringWidth = spec.ringWidth * (1 - t * 0.6);
      const ring = [
        { x: 0, y: -grown * spec.squash }, { x: grown, y: 0 },
        { x: 0, y: grown * spec.squash }, { x: -grown, y: 0 },
      ];
      // 먹선을 먼저 굵게, 그 위에 색 선 — 금도 같은 두 겹이다.
      graphics.lineStyle(ringWidth + SIGNATURE_INK_WIDTH, INK_COLOR, fade);
      graphics.strokePoints(ring, true);
      graphics.lineStyle(ringWidth, palette.main, spec.alpha * fade);
      graphics.strokePoints(ring, true);
      for (const [width, color, alpha] of [[spec.crackWidth + SIGNATURE_INK_WIDTH, INK_COLOR, fade], [spec.crackWidth, palette.sub, spec.alpha * fade]] as const) {
        graphics.lineStyle(width, color, alpha);
        for (let crack = 0; crack < spec.cracks; crack += 1) {
          // 금은 고르게 벌어지지 않는다 — 각을 조금씩 어긋나게 두어야 별이 아니라 균열이 된다.
          const angle = (crack / spec.cracks) * Math.PI * 2 + 0.4 + crack * 0.17;
          const length = spec.crackLength * scale * (0.6 + 0.4 * t);
          graphics.lineBetween(0, 0, Math.cos(angle) * length, Math.sin(angle) * length * spec.squash);
        }
      }
    });
  }

  /** 노도니아 — 아군이 맞은 자리에서 노도니아 쪽으로 한 줄기가 흘러간다. */
  private openShareFlow(from: { x: number; y: number }, to: { x: number; y: number }, palette: CombatPalette, now: number): void {
    const spec = SIGNATURE_SPECS.nodoniaShare;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    this.openShape(0, 0, spec.ms, now, this.depth, false, (graphics, t) => {
      // 길 전체를 잇지 않고 **한 토막이 흘러간다**. 통째로 이으면 두 사람을 묶은 줄이 되어
      // 무엇이 어느 쪽으로 옮겨 갔는지 방향이 사라진다.
      const head = Math.min(1, t + spec.span);
      const tail = Math.max(0, t - spec.span * 0.4);
      const root: StrokePoint = { x: from.x + dx * tail, y: from.y + dy * tail };
      const tip: StrokePoint = { x: from.x + dx * head, y: from.y + dy * head };
      const mid: StrokePoint = { x: (root.x + tip.x) / 2, y: (root.y + tip.y) / 2 };
      const fade = 1 - t * t;
      const points = lashPoints(root, mid, tip, spec.thickness, spec.thickness * 0.3);
      graphics.fillStyle(palette.main, spec.alpha * fade);
      graphics.fillPoints(points, true);
      graphics.lineStyle(SIGNATURE_INK_WIDTH * 0.7, INK_COLOR, fade);
      graphics.strokePoints(points, true);
    });
    // 도착한 자리에서 한 겹 인다. 흐름이 닿는 시각과 맞춰야 두 사건으로 보이지 않는다.
    this.scene.time.delayedCall(spec.ms * 0.7, () => this.openRing(to.x, to.y, spec.ringRadius, spec.ringMs, spec.ringWidth, palette.sub, 0, true));
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
    this.projectiles.forEach((slot) => { slot.tween?.stop(); slot.image.destroy(); slot.trail.destroy(); });
    this.projectiles.length = 0;
    this.inkPieces.forEach((slot) => { slot.tween?.stop(); slot.image.destroy(); });
    this.inkPieces.length = 0;
    this.crosses.forEach((image) => { this.scene.tweens.killTweensOf(image); image.destroy(); });
    this.crosses.length = 0;
    this.feverMarks.forEach((mark) => { mark.siren.destroy(); mark.anger.destroy(); });
    this.feverMarks.clear();
    this.shieldAuras.forEach((aura) => aura.graphics.destroy());
    this.shieldAuras.clear();
    this.lastAt.clear();
  }
}
