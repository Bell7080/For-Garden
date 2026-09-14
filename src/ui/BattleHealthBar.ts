import Phaser from "phaser";
import { battleUiMotionFactor, type BattleUiMotion } from "../core/settings";
import { HoloBar } from "./holo";
import { COLOR } from "./theme";
import {
  createUnitHealthBarState,
  HEALTH_BAR_MOTION,
  unitShieldBand,
  setUnitHealthValue,
  stepUnitHealthBar,
  type HealthValueInput,
  setUnitShield,
  type UnitHealthBarState,
} from "./unitHealthBarState";

/** 공용 HoloBar를 오염시키지 않고 전투에서만 붉은 피해 잔상과 사건 기반 반응을 덧씌운다. */
export class BattleHealthBar {
  public readonly trail: HoloBar;
  /** 체력 위에 덧대는 막. 체력 오른쪽에 이어 붙고, 자리가 없으면 바의 오른쪽 끝을 덮는다. */
  public readonly shield: HoloBar;
  public readonly value: HoloBar;
  /** 최대치 테두리와 눈금만 맡는 층. 채움 둘 위에 얹혀야 채워진 자리에서도 칸이 보인다. */
  private readonly frame: HoloBar;
  private health: UnitHealthBarState;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number, ratio: number, motion: BattleUiMotion = "default") {
    this.health = createUnitHealthBarState(ratio);
    this.motionFactor = battleUiMotionFactor(motion);
    // 아래 HoloBar가 홈·붉은 층을 그리고, 위 바의 테두리·눈금이 두 채움 모두를 또렷하게 덮는다.
    this.trail = new HoloBar(scene, x, y, width, height, { color: COLOR.danger });
    // 막은 체력 **위에** 구간으로 그린다. 아래에 깔면 체력이 가득한 동안에는 덮일 자리가
    // 없어 막이 통째로 보이지 않는다.
    this.value = new HoloBar(scene, x, y, width, height, { color: COLOR.hpFill, trackAlpha: 0 });
    this.shield = new HoloBar(scene, x, y, width, height, { color: COLOR.shieldFill, trackAlpha: 0 });
    // 테두리와 눈금은 맨 위다 — 두 채움 모두를 또렷하게 덮어야 "어디까지가 이 게이지인가"가 선다.
    this.frame = new HoloBar(scene, x, y, width, height, { color: COLOR.hpFill, trackAlpha: 0, outline: true, ticks: 3 });
    this.frame.setValue(0);
    this.paint();
  }

  /** 머리 위 체력 바와 같은 설정을 쓰는 프로필 전용 반응 배율이다. */
  private readonly motionFactor: number;

  get objects(): readonly Phaser.GameObjects.Graphics[] {
    return [...this.trail.objects, ...this.value.objects, ...this.shield.objects, ...this.frame.objects];
  }

  /** 실제 목표 HP와 원인을 함께 받아 보간값만으로 피해/회복을 추측하지 않는다. */
  public setHealth(input: HealthValueInput): void { this.health = setUnitHealthValue(this.health, input); }

  /** 막의 잔량만 갱신한다. 체력 사건과 갈라 두어 새 호출부가 막을 빠뜨릴 수 없게 한다. */
  public setShield(amount: number, maxHp: number): void { this.health = setUnitShield(this.health, amount, maxHp); }

  /** 사망처럼 기다리면 안 되는 상태는 모든 층을 한 프레임에 최종 비율로 정리한다. */
  public snap(ratio: number): void { this.health = createUnitHealthBarState(ratio); this.paint(); }

  /** 프로필 숫자와 별개로 실제 목표를 향해 전투 공용 시간 규칙을 진행한다. */
  public step(deltaMs: number): void {
    this.health = stepUnitHealthBar(this.health, deltaMs, this.motionFactor);
    const progress = this.health.reactionLeft / HEALTH_BAR_MOTION.reactionSeconds;
    // 고정 HUD는 흔들지 않는다. 궁극기 카드 안전 영역을 침범하지 않는 최대 3% 게이지만 확대한다.
    const scale = 1 + this.health.reactionLevel * 0.01 * progress * this.motionFactor;
    this.objects.forEach((object) => object.setScale(scale));
    this.paint();
  }

  public addTo(container: Phaser.GameObjects.Container): this {
    container.add([...this.objects]);
    return this;
  }

  private paint(): void {
    this.trail.setValue(this.health.damageTrail, COLOR.danger);
    this.value.setValue(this.health.shown, COLOR.hpFill);
    const band = unitShieldBand(this.health.shown, this.health.shield);
    this.shield.setRange(band.start, band.end, COLOR.shieldFill);
  }
}
