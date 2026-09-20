import Phaser from "phaser";
import { session } from "../state/session";
import { UI_ICON } from "./icons";
import { COLOR } from "./theme";

/** 서버 응답과 정확히 맞물릴 수 있도록 충돌과 전체 종료를 따로 공개한다. */
export interface StrataDigPlayback {
  impact: Promise<void>;
  finished: Promise<void>;
}

/**
 * 지층 타격의 단계별 시간표.
 *
 * **합이 1.06초였던 때는 그 1초가 통째로 손이 멎은 시간이었다.** 곡괭이가 내려찍히고 결과가
 * 이미 판에 섰는데도, 화면 밖으로 날아가는 퇴장(180ms)과 그 앞의 긴 충돌(440ms)이 끝날 때까지
 * 다음 칸을 누를 수 없었다 — 여덟 번을 파는 한 판에서 8초가 기다림이다. 지금은 절반 아래이고,
 * 무엇보다 **입력은 퇴장을 기다리지 않는다**(씬이 충돌 직후에 되돌린다).
 *
 * 축약 모드도 충돌 단계 자체는 없애지 않는다 — 그 한 프레임이 「팠다」를 말한다.
 */
const TIMING = {
  default: { enter: 90, swing: 130, impact: 230, exit: 110 },
  reduced: { enter: 30, swing: 55, impact: 90, exit: 40 },
} as const;

/** 부서진 겉장 조각이 튀어 나가는 부채꼴과 수. 한 자리 수로 끊는다. */
const SHATTER = { shards: 7, arc: 1.9, spread: 0.62, size: 0.15 } as const;

/**
 * 한 칸 위에서만 사는 곡괭이 프리팹이다.
 *
 * 생성한 표시 객체·Tween·Timer를 모두 소유하며 씬 종료나 수동 파기 때 Promise도 함께 끝낸다.
 * 따라서 네트워크 응답이 늦는 동안 씬을 떠나도 이전 연출이 다음 화면에 남지 않는다.
 *
 * **복제 그림자를 깔지 않는다.** 예전에는 같은 곡괭이를 청록으로 물들여 4px 어긋나게 겹쳐
 * 두었는데, 휘두르는 tween이 몸통(`layer`)과 날(`pickaxe`)에만 걸려 그림자는 제 각도에 남았다 —
 * 내려찍는 동안 곡괭이 뒤로 다른 각도의 곡괭이가 하나 더 붙어 다니는 **잔상**이 되었다.
 * 깊이는 그림자가 아니라 **한 벌에 얹은 어두운 외곽**이 만든다.
 */
export class StrataDigEffect {
  private readonly layer: Phaser.GameObjects.Container;
  private readonly pickaxe: Phaser.GameObjects.Image;
  private readonly tweens = new Set<Phaser.Tweens.Tween>();
  private readonly timers = new Set<Phaser.Time.TimerEvent>();
  private disposed = false;
  private impactResolve: () => void = () => undefined;
  private finishResolve: () => void = () => undefined;

  constructor(private readonly scene: Phaser.Scene, x: number, y: number, private readonly cellSize: number) {
    this.layer = scene.add.container(x, y).setDepth(1500);
    this.pickaxe = scene.add.image(0, 0, UI_ICON.pickaxe)
      .setDisplaySize(cellSize * 0.72, cellSize * 0.72).setTint(COLOR.archaeologyMetal);
    this.layer.add(this.pickaxe);
    this.layer.setPosition(x + cellSize * 0.7, y - cellSize * 0.65).setAlpha(0).setAngle(-42);
  }

  /** 진입 → 회전 타격 → 겉장이 터지는 한 순간 → 퇴장을 시작하고 두 Promise 이정표를 돌려준다. */
  play(): StrataDigPlayback {
    const reduced = session.settings.accessibility.reduceMotion;
    const timing = reduced ? TIMING.reduced : TIMING.default;
    const impact = new Promise<void>((resolve) => { this.impactResolve = resolve; });
    const finished = new Promise<void>((resolve) => { this.finishResolve = resolve; });

    this.tween({ targets: this.layer, x: this.layer.x - this.cellSize * 0.45, y: this.layer.y + this.cellSize * 0.25,
      alpha: 1, duration: timing.enter, ease: "Cubic.Out" });
    this.timer(timing.enter, () => {
      // 몸통과 날을 **함께** 돌린다. 한쪽만 돌리면 둘이 서로 다른 각도로 벌어진다.
      this.tween({ targets: [this.layer, this.pickaxe], angle: 54, duration: timing.swing, ease: "Cubic.In",
        onComplete: () => { this.impactResolve(); this.burst(reduced, timing.impact); } });
    });
    this.timer(timing.enter + timing.swing + timing.impact, () => {
      // **퇴장은 날아가지 않고 그 자리에서 잦아든다.** 화면 밖으로 크게 던지면 그 몫만큼
      // 시간이 더 들고, 3배속처럼 빠르게 보는 눈에는 잔상 하나가 옆 칸을 지나간 것으로 보인다.
      this.tween({ targets: this.layer, scale: reduced ? 1 : 1.12, alpha: 0,
        duration: timing.exit, ease: "Quad.In", onComplete: () => this.destroy() });
    });
    return { impact, finished };
  }

  /**
   * 부딪히는 한 순간.
   *
   * **팡 하고 깨진다** — 겉장이 갈라지는 섬광 한 겹, 그 자리를 때리는 납작한 파문, 위로 튀는
   * 껍질 조각들이다. 화면 전체의 규칙을 그대로 지킨다: 파문과 조각은 **동그라미가 아니라
   * 납작한 마름모**이고, 조각은 발밑으로 쏟아지지 않고 **위로** 튀며, 섬광은 옅다(상한 0.6).
   * 난수를 쓰지 않아 같은 타격이 늘 같은 그림을 그린다.
   */
  private burst(reduced: boolean, duration: number): void {
    // 파문은 칸을 때린 자리에 납작하게 눕는다. 위에서 내려다보는 판이라 정원은 앞에 세워 둔
    // 고리처럼 보인다.
    const ring = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    const radius = this.cellSize * 0.34;
    ring.lineStyle(4, COLOR.archaeologyMetal, reduced ? 0.3 : 0.55);
    ring.strokePoints([
      new Phaser.Geom.Point(-radius, 0), new Phaser.Geom.Point(0, -radius * 0.42),
      new Phaser.Geom.Point(radius, 0), new Phaser.Geom.Point(0, radius * 0.42),
    ], true);
    this.layer.add(ring);
    this.tween({ targets: ring, alpha: 0, scale: reduced ? 1.3 : 2.4, duration, ease: "Cubic.Out" });

    const flash = this.scene.add.rectangle(0, 0, this.cellSize * 0.5, this.cellSize * 0.24,
      COLOR.archaeologyMetal, reduced ? 0.24 : 0.46).setRotation(Math.PI / 4).setBlendMode(Phaser.BlendModes.ADD);
    this.layer.add(flash);
    this.tween({ targets: flash, alpha: 0, scale: reduced ? 1.15 : 1.9, duration, ease: "Cubic.Out" });

    const count = reduced ? 3 : SHATTER.shards;
    const size = this.cellSize * SHATTER.size;
    for (let index = 0; index < count; index += 1) {
      const t = index / (count - 1);
      // 위쪽(-90도)을 가운데로 둔 부채꼴이다. 조금씩 어긋나게 흔들어 반듯한 빗살이 되지 않게 한다.
      const angle = -Math.PI / 2 + (t - 0.5) * SHATTER.arc + (((index * 37) % 11) - 5) / 44;
      const shard = this.scene.add.graphics();
      shard.fillStyle(COLOR.archaeologySoil, 0.92);
      // 좌우 꼭짓점 높이를 어긋나게 깎은 마름모다. 반듯한 대칭은 보석처럼 보인다.
      shard.fillPoints([
        new Phaser.Geom.Point(0, -size), new Phaser.Geom.Point(size * 0.62, -size * 0.12),
        new Phaser.Geom.Point(0, size), new Phaser.Geom.Point(-size * 0.62, size * 0.1),
      ], true);
      this.layer.add(shard);
      const distance = this.cellSize * SHATTER.spread * (reduced ? 0.35 : 0.72 + (index % 3) * 0.14);
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
    this.layer.destroy(true);
    this.impactResolve(); this.finishResolve();
  }
}
