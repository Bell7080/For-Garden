import Phaser from "phaser";

/** 자동 전투의 연출 단계. 씬은 단계별 실제 규칙과 그림만 처리한다. */
export interface AutoBattleCallbacks {
  isFinished: () => boolean;
  playerAttack: () => void;
  enemyAttack: () => void;
}

/** 공격 우선의 반복 전투를 한 곳에서 관리해 씬에 타이머가 흩어지지 않게 한다. */
export class AutoBattleManager {
  private stopped = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly callbacks: AutoBattleCallbacks,
  ) {}

  /** 짧은 조우 대기 뒤 아군 공격부터 자동 순환을 시작한다. */
  start(): void {
    this.scene.time.delayedCall(650, () => this.runPlayer());
  }

  /** 기본 Puppet idle 위에 얹는 통통 튀는 이동을 캐릭터별 위상차와 함께 관리한다. */
  addBounce(target: Phaser.GameObjects.GameObject, index: number): void {
    this.scene.tweens.add({
      targets: target,
      y: "-=18",
      duration: 360 + index * 55,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
      delay: index * 90,
    });
  }

  /** 씬 종료 뒤 예약 콜백이 상태를 건드리지 않도록 루프를 닫는다. */
  stop(): void {
    this.stopped = true;
  }

  private runPlayer(): void {
    if (this.stopped || this.callbacks.isFinished()) return;
    this.callbacks.playerAttack();
    this.scene.time.delayedCall(900, () => this.runEnemy());
  }

  private runEnemy(): void {
    if (this.stopped || this.callbacks.isFinished()) return;
    this.callbacks.enemyAttack();
    this.scene.time.delayedCall(900, () => this.runPlayer());
  }
}
