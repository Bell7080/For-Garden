import Phaser from "phaser";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { UI_ICON } from "./icons";
import { COLOR } from "./theme";
import { PICKAXE_ORIGIN, pickaxePoses } from "./pickaxeSwing";

/** 서버 응답과 정확히 맞물릴 수 있도록 충돌과 전체 종료를 따로 공개한다. */
export interface StrataDigPlayback {
  impact: Promise<void>;
  finished: Promise<void>;
}

/**
 * 지층 타격의 단계별 시간표.
 *
 * **잔상을 남기는 것은 걷어 냈다.** 예전에는 곡괭이가 옅게 들어와 내려찍고 다시 옅어지며
 * 사라졌고 충격 파문이 번져 나갔다 — 그 두 겹이 「지나간 자국」으로 읽혀 내려찍는 힘이
 * 흐려졌다. 지금은 곡괭이가 **처음부터 또렷하게** 들리고, 짧게 뒤로 젖혔다가, 꽝 하고 내려
 * 꽂히며, 박힌 채 한 박자 멈췄다가 **곧바로** 사라진다. 세기는 흐려지는 시간이 아니라
 * 부딪히는 순간의 섬광·금 가는 선·튀는 조각·화면의 짧은 떨림이 만든다.
 *
 * 입력은 충돌 직후 돌아온다(씬이 `impact`에서 되돌린다). 축약 모드도 충돌 단계 자체는 없애지
 * 않는다 — 그 한 프레임이 「팠다」를 말한다.
 */
const TIMING = {
  default: { windup: 90, swing: 130, hold: 90, burst: 210 },
  reduced: { windup: 20, swing: 45, hold: 40, burst: 90 },
} as const;

/** 부서진 겉장 조각이 튀어 나가는 부채꼴과 수. 한 자리 수로 끊는다. */
const SHATTER = { shards: 8, arc: 2.1, spread: 0.7, size: 0.16 } as const;

/** 충돌에 흔드는 화면의 세기와 시간. 화면 흔들림 설정이 꺼지면 흔들지 않는다. */
const IMPACT_SHAKE = { duration: 110, intensity: 0.0055 } as const;

/**
 * 한 칸 위에서만 사는 곡괭이 프리팹이다.
 *
 * 생성한 표시 객체·Tween·Timer를 모두 소유하며 씬 종료나 수동 파기 때 Promise도 함께 끝낸다.
 * 따라서 네트워크 응답이 늦는 동안 씬을 떠나도 이전 연출이 다음 화면에 남지 않는다.
 *
 * **복제 그림자를 깔지 않는다.** 휘두르는 tween이 몸통과 날에만 걸려 그림자는 제 각도에 남고,
 * 그것이 곧 잔상이 된다. 깊이는 한 벌에 얹은 어두운 외곽이 만든다.
 */
export class StrataDigEffect {
  private readonly layer: Phaser.GameObjects.Container;
  /** 충돌 조각의 자리. 회전하는 곡괭이 몸통과 따로 서야 조각이 위로 튄다. */
  private readonly fx: Phaser.GameObjects.Container;
  private readonly pickaxe: Phaser.GameObjects.Image;
  private readonly tweens = new Set<Phaser.Tweens.Tween>();
  private readonly timers = new Set<Phaser.Time.TimerEvent>();
  private disposed = false;
  private impactResolve: () => void = () => undefined;
  private finishResolve: () => void = () => undefined;

  /** 세 자세. 칸 가운데에 날 끝이 닿도록 손 자리를 거꾸로 구한다. */
  private readonly poses: ReturnType<typeof pickaxePoses>;

  constructor(private readonly scene: Phaser.Scene, x: number, y: number, private readonly cellSize: number) {
    this.layer = scene.add.container(x, y).setDepth(1500);
    this.fx = scene.add.container(x, y).setDepth(1499);
    const display = cellSize * 1.05;
    // 원점이 쥔 곳이라 몸통이 아니라 **손을 축으로** 돌아간다 — 날이 호를 그리며 칸을 후려친다.
    this.pickaxe = scene.add.image(0, 0, UI_ICON.pickaxe).setOrigin(PICKAXE_ORIGIN.x, PICKAXE_ORIGIN.y).setDisplaySize(display, display);
    this.layer.add(this.pickaxe);
    this.poses = pickaxePoses({ x, y }, cellSize, display);
    // 처음부터 또렷하다. 옅게 들어오는 단계가 없으므로 잔상도 없다.
    this.layer.setPosition(this.poses.rest.x, this.poses.rest.y).setAngle(this.poses.rest.angle);
  }

  /** 젖힘 → 후려치기 → 충돌(섬광·금·조각·떨림) → 즉시 퇴장. 두 Promise 이정표를 돌려준다. */
  play(): StrataDigPlayback {
    const reduced = session.settings.accessibility.reduceMotion;
    const timing = reduced ? TIMING.reduced : TIMING.default;
    const impact = new Promise<void>((resolve) => { this.impactResolve = resolve; });
    const finished = new Promise<void>((resolve) => { this.finishResolve = resolve; });
    const { raised, strike } = this.poses;

    // 젖힘: 손이 위·뒤로 물러나며 머리가 뒤로 넘어간다. 힘을 모으는 박자라 감속한다.
    this.tween({ targets: this.layer, x: raised.x, y: raised.y, angle: raised.angle, duration: timing.windup, ease: "Quad.Out" });
    this.timer(timing.windup, () => {
      // 손을 축으로 92도를 한 번에 돌린다. 가속만 있고 감속이 없어 날이 닿는 순간이 가장 빠르다.
      this.tween({ targets: this.layer, x: strike.x, y: strike.y, angle: strike.angle, duration: timing.swing, ease: "Cubic.In",
        onComplete: () => {
          this.impactResolve(); this.burst(reduced, timing.burst);
          // 박히며 튕기는 반동: 손이 살짝 튕겨 오른다.
          this.tween({ targets: this.layer, angle: strike.angle + 7, x: strike.x + this.cellSize * 0.03, y: strike.y - this.cellSize * 0.04,
            duration: Math.min(50, timing.hold), ease: "Quad.Out" });
        } });
    });
    // 박힌 채 한 박자 멈췄다가 곧바로 사라진다 — 흐려지지도 날아가지도 않는다. 조각은 제 수명을 마저 산다.
    this.timer(timing.windup + timing.swing + timing.hold, () => this.layer.setVisible(false));
    this.timer(timing.windup + timing.swing + timing.burst + 40, () => this.destroy());
    return { impact, finished };
  }

  /**
   * 부딪히는 한 순간.
   *
   * **꽝!** — 칸을 가르는 섬광 한 겹, 부딪힌 자리에서 사방으로 갈라지는 금(네 갈래 별), 위로
   * 튀는 조각, 짧은 화면 떨림이다. 화면 전체의 규칙은 그대로다: 조각은 **동그라미가 아니라
   * 납작한 마름모**이고 발밑으로 쏟아지지 않고 **위로** 튀며, 섬광은 옅다(상한 0.6). 난수를
   * 쓰지 않아 같은 타격이 늘 같은 그림을 그린다.
   */
  private burst(reduced: boolean, duration: number): void {
    const shake = motionPolicy(session.settings).cameraShakeFactor;
    if (shake > 0) this.scene.cameras.main.shake(IMPACT_SHAKE.duration, IMPACT_SHAKE.intensity * shake, true);

    // 금: 부딪힌 자리에서 네 갈래로 뻗는 얇은 별. 곡괭이 몸통 위가 아니라 칸에 그려 곡괭이와 함께 사라지지 않는다.
    const crack = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.fx.add(crack);
    const reach = this.cellSize * 0.5;
    crack.fillStyle(0xfff2c9, reduced ? 0.4 : 0.75);
    crack.fillPoints([
      new Phaser.Geom.Point(0, -reach), new Phaser.Geom.Point(reach * 0.09, -reach * 0.09),
      new Phaser.Geom.Point(reach * 0.86, 0), new Phaser.Geom.Point(reach * 0.09, reach * 0.09),
      new Phaser.Geom.Point(0, reach * 0.7), new Phaser.Geom.Point(-reach * 0.09, reach * 0.09),
      new Phaser.Geom.Point(-reach * 0.7, 0), new Phaser.Geom.Point(-reach * 0.09, -reach * 0.09),
    ], true);
    crack.setScale(0.35).setRotation(-0.2);
    this.tween({ targets: crack, scale: reduced ? 0.8 : 1.15, alpha: 0, duration, ease: "Cubic.Out", onComplete: () => crack.setVisible(false) });

    const flash = this.scene.add.rectangle(0, 0, this.cellSize * 0.56, this.cellSize * 0.28,
      COLOR.archaeologyMetal, reduced ? 0.24 : 0.5).setRotation(Math.PI / 4).setBlendMode(Phaser.BlendModes.ADD);
    this.fx.add(flash);
    this.tween({ targets: flash, alpha: 0, scale: reduced ? 1.15 : 1.9, duration: duration * 0.8, ease: "Cubic.Out" });

    const count = reduced ? 3 : SHATTER.shards;
    const size = this.cellSize * SHATTER.size;
    for (let index = 0; index < count; index += 1) {
      const t = index / (count - 1);
      // 위쪽(-90도)을 가운데로 둔 부채꼴이다. 조금씩 어긋나게 흔들어 반듯한 빗살이 되지 않게 한다.
      const angle = -Math.PI / 2 + (t - 0.5) * SHATTER.arc + (((index * 37) % 11) - 5) / 44;
      const shard = this.scene.add.graphics();
      shard.fillStyle(index % 3 === 0 ? 0xf2e6c4 : COLOR.archaeologySoil, 0.95);
      // 좌우 꼭짓점 높이를 어긋나게 깎은 마름모다. 반듯한 대칭은 보석처럼 보인다.
      shard.fillPoints([
        new Phaser.Geom.Point(0, -size), new Phaser.Geom.Point(size * 0.62, -size * 0.12),
        new Phaser.Geom.Point(0, size), new Phaser.Geom.Point(-size * 0.62, size * 0.1),
      ], true);
      this.fx.add(shard);
      const distance = this.cellSize * SHATTER.spread * (reduced ? 0.35 : 0.72 + (index % 3) * 0.16);
      this.tween({ targets: shard, x: Math.cos(angle) * distance, y: Math.sin(angle) * distance,
        alpha: 0, angle: 140 + index * 26, scale: 0.6, duration, ease: "Quad.Out" });
    }
  }

  /** Tween의 중단도 완료로 취급해 수명 주기 중 Promise가 영원히 남지 않게 한다. */
  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): void {
    let tween: Phaser.Tweens.Tween;
    const complete = config.onComplete;
    tween = this.scene.tweens.add({ ...config, onComplete: () => {
      this.tweens.delete(tween);
      // 이 프리팹의 완료 콜백은 인자를 소비하지 않으므로 Phaser의 가변 콜백 인자를 전달하지 않는다.
      (complete as (() => void) | undefined)?.();
    } });
    this.tweens.add(tween);
  }

  /** Phaser timer도 프리팹 소유 목록에 넣어 씬 종료 때 콜백이 뒤늦게 실행되지 않게 한다. */
  private timer(delay: number, callback: () => void): void {
    let timer: Phaser.Time.TimerEvent;
    timer = this.scene.time.delayedCall(delay, () => { this.timers.delete(timer); callback(); });
    this.timers.add(timer);
  }

  /** 진행 중인 모든 객체를 없애고 두 대기자를 안전하게 풀어 준다. */
  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.tweens.forEach((tween) => tween.stop());
    this.timers.forEach((timer) => timer.remove(false));
    this.tweens.clear(); this.timers.clear();
    this.layer.destroy(true); this.fx.destroy(true);
    this.impactResolve(); this.finishResolve();
  }
}
