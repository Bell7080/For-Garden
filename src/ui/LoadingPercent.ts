import Phaser from "phaser";
import { COLOR, textStyle } from "./theme";

/** 소수 둘째 자리까지 적는다. 한 칸이 찰 때까지 숫자가 멈춰 보이지 않게 하려는 자리다. */
const DECIMALS = 2;

/**
 * 표시값이 목표를 따라가는 속도(초당 비율).
 *
 * 단계가 끝나는 순간 숫자를 그대로 갈아 끼우면 16%씩 뛰어 어디까지 왔는지 읽히지 않는다.
 * 게이지와 수치가 스르륵 따라오는 전투 HUD의 규칙(`stepMeters`)을 숫자에도 그대로 쓴다.
 */
const FOLLOW_PER_SEC = 2.6;

/**
 * 로딩 진행률 숫자.
 *
 * 칸(`LoadingDiamonds`)은 "몇 개 남았나"를, 이 숫자는 "얼마나 왔나"를 말한다. 판때기를
 * 받치지 않고 같은 글자를 검게 한 겹 복제해 깔아 밝은 배경 영상 위에서도 획이 또렷하다 —
 * 타이틀 제목·부제와 같은 방법이다.
 */
export class LoadingPercent {
  private readonly label: Phaser.GameObjects.Text;
  private readonly shadow: Phaser.GameObjects.Text;
  /** 목표값과 지금 화면에 선 값. 둘 다 0~1이다. */
  private target = 0;
  private shown = 0;
  private readonly follow: (time: number, delta: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, size = 44) {
    const style = textStyle({ role: "display", size, color: COLOR.accentText });
    this.shadow = scene.add
      .text(x + 3, y + 5, "", textStyle({ role: "display", size, color: "#000000" }))
      .setOrigin(0.5)
      // 획 둘레로 번지는 검은 띠가 실제 배경이 되어 대비를 배경 영상에서 떼어 놓는다.
      .setStroke("#000000", Math.round(size * 0.26))
      .setAlpha(0.86);
    this.label = scene.add.text(x, y, "", style).setOrigin(0.5);
    this.render();

    this.follow = (_time, delta) => {
      if (this.shown >= this.target) return;
      // 남은 거리에 비례해 다가간다 — 단계가 끝난 직후에는 빠르게 뛰고 가까워질수록 천천히
      // 붙어, 다음 단계를 기다리는 동안에도 소수 자리가 계속 움직인다.
      const k = 1 - Math.exp((-FOLLOW_PER_SEC * delta) / 1000);
      this.shown = Math.min(this.target, this.shown + (this.target - this.shown) * k);
      this.render();
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.follow);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** 0~1. 뒤로 물러나지 않는다 — 줄어드는 진행률은 무엇을 기다리는지 알려 주지 못한다. */
  setRatio(ratio: number): void {
    this.target = Math.max(this.target, Math.min(1, Math.max(0, ratio)));
  }

  /** 마지막 단계가 끝난 순간에만 부른다. 따라가기를 건너뛰고 정확히 100.00%로 멈춘다. */
  complete(): void {
    this.target = 1;
    this.shown = 1;
    this.render();
  }

  /**
   * 100.00%를 보여 준 채 자리를 진입 문구에 넘긴다.
   *
   * 곧바로 지우면 다 찬 숫자가 한 프레임도 서지 못하고, 그대로 두면 같은 자리에 두 줄이
   * 겹친다. 진입 문구가 들어오는 동안 옅어지며 물러난다.
   */
  handOver(durationMs = 320): void {
    const targets = [this.label, this.shadow];
    this.label.scene.tweens.add({
      targets,
      alpha: 0,
      duration: durationMs,
      onComplete: () => this.destroy(),
    });
  }

  destroy(): void {
    this.label.scene?.events.off(Phaser.Scenes.Events.UPDATE, this.follow);
    this.label.destroy();
    this.shadow.destroy();
  }

  private render(): void {
    const text = `${(this.shown * 100).toFixed(DECIMALS)}%`;
    this.label.setText(text);
    this.shadow.setText(text);
  }
}
