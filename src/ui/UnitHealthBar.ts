import Phaser from "phaser";
import { battleUiMotionFactor, type BattleUiMotion } from "../core/settings";
import { slantedRect, toPoints } from "./holo";
import { BATTLE_STATUS_LAYOUT } from "./battleStatusLayout";
import { COLOR } from "./theme";
import {
  createUnitHealthBarState,
  HEALTH_BAR_MOTION,
  setUnitHealthValue,
  stepUnitHealthBar,
  type HealthValueInput,
  type UnitHealthBarState,
} from "./unitHealthBarState";

/**
 * 전장의 SD 머리 위에 뜨는 체력 바.
 *
 * 배경 원화가 밝고 복잡해서 얇은 사각형 두 장으로는 바닥에 묻힌다. 그래서 ① 아래로 한 겹
 * 복제해 깔고, ② 몸통을 `/`로 깎고, ③ 흰 선으로 칸을 나누고, ④ 왼쪽 끝에 두꺼운 빗금을
 * 하나 세운다. 네 겹이 함께 있어야 배경에서 떨어져 나온 물건처럼 보인다.
 *
 * 값은 **스르륵** 따라온다. 깎이는 순간이 보이지 않으면 얼마나 아팠는지 알 수 없어서다.
 */
const BAR = {
  /** 머리 위 상태 칩 줄이 이 폭의 왼쪽 끝부터 붙으므로 폭은 배치표 한 곳이 갖는다. */
  width: BATTLE_STATUS_LAYOUT.hpBarWidth,
  height: 11,
  /** `/` 기울기. 몸통·복제·칸 나눔이 모두 같은 각을 쓴다. */
  slant: 7,
  /**
   * 왼쪽 끝 빗금.
   *
   * 몸통보다 **크고 훨씬 짙다.** 같은 색·같은 높이로 두면 체력 바가 거기서 잘린 것처럼 보여
   * 조각 둘이 아니라 끊긴 하나로 읽힌다. 색과 크기를 함께 갈라야 "따로 박힌 못"이 된다.
   */
  cap: { width: 9, gap: 6, height: 1.34, darken: 0.55 },
  /** 칸을 나누는 흰 선의 개수(칸 수는 이보다 하나 많다). */
  ticks: 3,
  /** 피격 강도별 확대 상한. 외부 컨테이너가 아니라 내부 그래픽에만 적용한다. */
  reactionScale: [1, 1.025, 1.05, 1.075],
  /** 피격 강도별 좌우 흔들림 상한(px). 연타에도 기준 위치가 밀리지 않는다. */
  reactionShake: [0, 1.5, 3, 4.5],
} as const;

/** 색을 눌러 짙게 만든다. 끝 빗금이 몸통과 같은 색이면 잘린 조각처럼 보인다. */
function darken(color: number, amount: number): number {
  const keep = 1 - amount;
  return (Math.round(((color >> 16) & 0xff) * keep) << 16)
    | (Math.round(((color >> 8) & 0xff) * keep) << 8)
    | Math.round((color & 0xff) * keep);
}

export class UnitHealthBar extends Phaser.GameObjects.Container {
  private readonly graph: Phaser.GameObjects.Graphics;
  /** shown(현재 채움)·damageTrail(붉은 잔상)·target(최종 HP)을 분리한 순수 상태다. */
  private health: UnitHealthBarState = createUnitHealthBarState();

  private readonly capColor: number;

  constructor(scene: Phaser.Scene, private readonly color: number, motion: BattleUiMotion = "default") {
    super(scene, 0, 0);
    this.capColor = darken(color, BAR.cap.darken);
    this.motionFactor = battleUiMotionFactor(motion);
    this.graph = scene.add.graphics();
    this.add(this.graph);
    scene.add.existing(this);
    this.paint();
  }

  /** 같은 저장 선택이 보간·확대·흔들림에 쓰이도록 생성 시 고정한 공용 배율이다. */
  private readonly motionFactor: number;

  /** 비율 동기화 또는 HP·피해 원인을 받는다. 회복/동기화 입력은 피격 반응을 만들지 않는다. */
  setValue(value: number | HealthValueInput): this {
    this.health = setUnitHealthValue(this.health, value);
    return this;
  }

  /** 지금 값을 목표로 즉시 맞춘다. 전투 시작처럼 이어 보일 필요가 없는 순간에만 쓴다. */
  snap(ratio: number): this {
    this.health = createUnitHealthBarState(ratio);
    this.paint();
    return this;
  }

  /** 매 프레임 조금씩 목표에 다가간다. `delta`는 밀리초다. */
  step(delta: number): void {
    this.health = stepUnitHealthBar(this.health, delta, this.motionFactor);
    // syncViews가 부모 위치를 매 프레임 덮으므로 흔들림·확대는 전용 내부 그래픽에만 건다.
    const progress = this.health.reactionLeft / HEALTH_BAR_MOTION.reactionSeconds;
    const level = this.health.reactionLevel;
    const shake = BAR.reactionShake[level] * progress * this.motionFactor;
    this.graph.setPosition(Math.sin(this.health.reactionLeft * 105) * shake, 0);
    this.graph.setScale(1 + (BAR.reactionScale[level] - 1) * progress * this.motionFactor);
    this.paint();
  }

  private paint(): void {
    const { width, height, slant, cap, ticks } = BAR;
    const body = toPoints(slantedRect(width, height, slant));
    this.graph.clear();
    // 복제 그림자. 몸통과 같은 모양을 아래로 밀어 깔면 바가 배경에서 한 겹 떠오른다.
    this.graph.fillStyle(0x05070a, 0.8);
    this.graph.fillPoints(body.map((point) => new Phaser.Geom.Point(point.x + 2, point.y + 4)), true);
    this.graph.fillStyle(0x0b1018, 0.92);
    this.graph.fillPoints(body, true);
    // 채움은 왼쪽 끝에서 자란다. 같은 기울기로 잘라야 몸통과 한 조각으로 보인다.
    // 붉은 잔상을 현재 체력 아래에 먼저 칠한다. 색은 홀로그램 공용 danger 토큰만 사용한다.
    const trailFilled = width * this.health.damageTrail;
    if (trailFilled > 0.5) this.paintFill(trailFilled, COLOR.danger, 0.95);
    const filled = width * this.health.shown;
    if (filled > 0.5) {
      this.paintFill(filled, this.color, 1);
    }
    // 칸을 나누는 흰 선. 얼마나 깎였는지를 눈금으로 셈할 수 있게 한다.
    this.graph.lineStyle(2, 0xffffff, 0.5);
    for (let i = 1; i <= ticks; i += 1) {
      const x = -width / 2 + (width * i) / (ticks + 1);
      this.graph.lineBetween(x + slant / 2, -height / 2, x - slant / 2, height / 2);
    }
    // 최대치를 두르는 흰 테두리. 채움이 줄어도 "여기까지가 이 바"가 남아 배경과 갈린다.
    this.graph.lineStyle(2, 0xffffff, 0.72);
    this.graph.strokePoints(body, true);
    // 왼쪽 끝의 두꺼운 빗금. 바가 어디서 시작하는지 못을 박아 준다.
    const capShape = toPoints(slantedRect(cap.width, height * cap.height, slant));
    this.graph.fillStyle(0x05070a, 0.85);
    this.graph.fillPoints(capShape.map((point) =>
      new Phaser.Geom.Point(point.x - width / 2 - cap.gap + 2, point.y + 4)), true);
    this.graph.fillStyle(this.capColor, 1);
    this.graph.fillPoints(capShape.map((point) =>
      new Phaser.Geom.Point(point.x - width / 2 - cap.gap, point.y)), true);
  }

  /** 홈과 같은 기울기 규칙으로 한 채움층을 그린다. 호출 순서가 곧 레이어 순서다. */
  private paintFill(filled: number, color: number, alpha: number): void {
    const left = -BAR.width / 2;
    const s = BAR.slant / 2;
    this.graph.fillStyle(color, alpha);
    this.graph.fillPoints([
      new Phaser.Geom.Point(left + s, -BAR.height / 2),
      new Phaser.Geom.Point(left + filled + s, -BAR.height / 2),
      new Phaser.Geom.Point(left + filled - s, BAR.height / 2),
      new Phaser.Geom.Point(left - s, BAR.height / 2),
    ], true);
  }
}
