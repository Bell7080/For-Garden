import Phaser from "phaser";
import { session } from "../state/session";
import { UI_ICON } from "./icons";
import { COLOR } from "./theme";

/** 서버 응답과 정확히 맞물릴 수 있도록 충돌과 전체 종료를 따로 공개한다. */
export interface StrataDigPlayback {
  impact: Promise<void>;
  finished: Promise<void>;
}

/** 지층 타격의 단계별 시간표. 축약 모드도 충돌 단계 자체는 없애지 않는다. */
const TIMING = {
  default: { enter: 180, swing: 260, impact: 440, exit: 180 },
  reduced: { enter: 45, swing: 80, impact: 100, exit: 45 },
} as const;

/**
 * 한 칸 위에서만 사는 곡괭이 프리팹이다.
 *
 * 생성한 표시 객체·Tween·Timer를 모두 소유하며 씬 종료나 수동 파기 때 Promise도 함께 끝낸다.
 * 따라서 네트워크 응답이 늦는 동안 씬을 떠나도 이전 연출이 다음 화면에 남지 않는다.
 */
export class StrataDigEffect {
  private readonly layer: Phaser.GameObjects.Container;
  private readonly tweens = new Set<Phaser.Tweens.Tween>();
  private readonly timers = new Set<Phaser.Time.TimerEvent>();
  private disposed = false;
  private impactResolve: () => void = () => undefined;
  private finishResolve: () => void = () => undefined;

  constructor(private readonly scene: Phaser.Scene, x: number, y: number, private readonly cellSize: number) {
    this.layer = scene.add.container(x, y).setDepth(1500);
    // 곡괭이는 상단 횟수 표식과 같은 원화를 쓰고 청록 그림자를 겹쳐 홀로그램 금속감을 만든다.
    const shadow = scene.add.image(4, 5, UI_ICON.pickaxe).setDisplaySize(cellSize * 0.72, cellSize * 0.72)
      .setTint(COLOR.archaeologyOxide).setAlpha(0.42);
    const pickaxe = scene.add.image(0, 0, UI_ICON.pickaxe).setDisplaySize(cellSize * 0.72, cellSize * 0.72)
      .setTint(COLOR.archaeologyMetal);
    this.layer.add([shadow, pickaxe]);
    this.layer.setPosition(x + cellSize * 0.7, y - cellSize * 0.65).setAlpha(0).setAngle(-42);
  }

  /** 진입 → 회전 타격 → 섬광·흙 파편 → 퇴장을 시작하고 두 Promise 이정표를 돌려준다. */
  play(): StrataDigPlayback {
    const reduced = session.settings.accessibility.reduceMotion;
    const timing = reduced ? TIMING.reduced : TIMING.default;
    const impact = new Promise<void>((resolve) => { this.impactResolve = resolve; });
    const finished = new Promise<void>((resolve) => { this.finishResolve = resolve; });
    const pickaxe = this.layer.list[1];

    this.tween({ targets: this.layer, x: this.layer.x - this.cellSize * 0.45, y: this.layer.y + this.cellSize * 0.25,
      alpha: 1, duration: timing.enter, ease: "Cubic.Out" });
    this.timer(timing.enter, () => {
      this.tween({ targets: [this.layer, pickaxe], angle: 54, duration: timing.swing, ease: "Cubic.In",
        onComplete: () => { this.impactResolve(); this.burst(reduced, timing.impact); } });
    });
    this.timer(timing.enter + timing.swing + timing.impact, () => {
      this.tween({ targets: this.layer, x: this.layer.x + (reduced ? 18 : 90), y: this.layer.y - (reduced ? 12 : 70),
        alpha: 0, duration: timing.exit, ease: "Cubic.In", onComplete: () => this.destroy() });
    });
    return { impact, finished };
  }

  /** 충돌 한 프레임은 접근성 모드에서도 보존하되 섬광과 이동량만 짧고 작게 만든다. */
  private burst(reduced: boolean, duration: number): void {
    const flash = this.scene.add.rectangle(0, 0, this.cellSize * 0.7, this.cellSize * 0.35,
      COLOR.archaeologyMetal, reduced ? 0.28 : 0.55).setRotation(Math.PI / 4).setBlendMode(Phaser.BlendModes.ADD);
    this.layer.add(flash);
    this.tween({ targets: flash, alpha: 0, scale: reduced ? 1.15 : 1.8, duration, ease: "Cubic.Out" });
    // 파편은 작은 금속 마름모 표현을 따라 사각 조각을 회전해 쓰며 별도 텍스처를 만들지 않는다.
    const count = reduced ? 3 : 8;
    for (let index = 0; index < count; index += 1) {
      const angle = Math.PI * (1.05 + (index + 0.5) / count * 0.9);
      const shard = this.scene.add.rectangle(0, 0, 8, 13, COLOR.archaeologySoil, 0.9).setRotation(angle);
      this.layer.add(shard);
      const distance = (reduced ? 18 : 48) + (index % 3) * 8;
      this.tween({ targets: shard, x: Math.cos(angle) * distance, y: Math.sin(angle) * distance,
        alpha: 0, angle: 100 + index * 20, duration, ease: "Quad.Out" });
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
