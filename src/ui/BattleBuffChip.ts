import Phaser from "phaser";
import type { ActiveCombatBuff } from "../core/skirmish";
import { battleBuffEffectShape, battleBuffProgress, type BattleBuffEffectShape } from "../core/battleBuffPresentation";
import type { BattleUiMotion } from "../core/settings";
import { chipPoints, drawInnerVignette, drawLayer, drawShapeOutline } from "./holo";
import { battleBuffStackSpot } from "./battleStatusLayout";
import { COLOR, textStyle } from "./theme";

/** 전투 프로필에 붙는 작은 버프 액자. 진행 Graphics는 생성 후 지우고 다시 그려 재사용한다. */
export class BattleBuffChip extends Phaser.GameObjects.Container {
  private readonly progress = this.scene.add.graphics();
  private readonly hit: Phaser.GameObjects.Rectangle;
  /** 겹 수 글자. 겹이 오르내릴 때 칩을 다시 만들지 않고 이 글자만 갈아 끼운다. */
  private stacksText?: Phaser.GameObjects.Text;
  private timing: ActiveCombatBuff["timing"];

  constructor(scene: Phaser.Scene, size: number, tint: number, texture: string, buff: ActiveCombatBuff, motion: BattleUiMotion, onPress: () => void) {
    super(scene, 0, 0);
    this.timing = buff.timing;
    const shape = chipPoints(size, size, { bevel: { topLeft: 12, topRight: 0, bottomRight: 12, bottomLeft: 0 } });
    this.add(drawLayer(scene, 0, 0, shape, { fill: tint, alpha: 0.9 }));
    this.add(scene.add.image(0, 0, texture).setDisplaySize(size * 0.72, size * 0.72).setTint(tint));
    // 원화 위의 고대비 실루엣은 색각과 작은 화면에서도 효과 계열을 중복 부호화한다.
    this.add(this.drawEffectShape(size, battleBuffEffectShape(buff)));
    this.add([drawInnerVignette(scene, 0, 0, shape, { strength: 0.55 }), this.progress]);
    // 보이는 56px 액자보다 입력판을 넓혀 최소 64px 터치 영역을 확보한다.
    this.hit = scene.add.rectangle(0, 0, Math.max(64, size), Math.max(64, size), 0xffffff, 0).setInteractive({ useHandCursor: true });
    // 진행 정보는 모든 움직임 설정에서 유지하고, reduced/off는 눌림 장식의 크기만 줄인다.
    const pressedScale = motion === "default" ? 1.1 : motion === "reduced" ? 1.04 : 1;
    this.hit.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); this.setScale(pressedScale); });
    this.hit.on("pointerup", (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); this.setScale(1); onPress(); });
    this.hit.on("pointerout", () => this.setScale(1));
    this.add([drawShapeOutline(scene, 0, 0, shape, { color: tint, alpha: 0.9, width: 2 }), this.hit]);
    // 겹치는 값(주기 타격의 몇 대째)은 칩을 여러 장 세우지 않고 **우하단 숫자 하나**가 말한다.
    // 머리 위 상태 칩과 같은 자리·같은 규칙을 쓴다.
    if (buff.stacks !== undefined) this.add(this.drawStacks(size, tint, buff.stacks));
    this.redraw(size);
    scene.add.existing(this);
  }

  /** 칩 우하단의 겹 수. 작은 판을 깔아 밝은 배경 원화 위에서도 수가 살아남는다. */
  private drawStacks(size: number, _tint: number, stacks: number): Phaser.GameObjects.Container {
    // 자리와 크기는 액자 크기에서 나온다 — 머리 위 칩(22px)의 값을 그대로 쓰면 56px 액자에서
    // 판이 점만큼 작아 숫자가 밖으로 넘친다.
    const spot = battleBuffStackSpot(size);
    const group = this.scene.add.container(0, 0);
    group.add(this.scene.add.circle(spot.x, spot.y, spot.plateRadius, COLOR.void, 0.94));
    // 액자 색을 따르지 않고 **흰 글자에 검은 테두리**다. 파치의 4타처럼 지금 몇 대째인지는
    // 액자 그림보다 먼저 읽혀야 하는 수인데, 액자와 같은 색이면 그림에 묻힌다.
    this.stacksText = this.scene.add
      .text(spot.x, spot.y + 1, String(stacks), textStyle({ role: "display", size: spot.fontSize, color: "#ffffff" }))
      .setOrigin(0.5)
      .setStroke("#05070a", spot.strokeWidth);
    group.add(this.stacksText);
    return group;
  }

  /** 네 가지 각진 문양을 흰색으로 겹쳐 색상 없이도 공격·속도·지원·특수를 구별한다. */
  private drawEffectShape(size: number, shape: BattleBuffEffectShape): Phaser.GameObjects.Graphics {
    const glyph = this.scene.add.graphics().setPosition(size * 0.23, -size * 0.23);
    glyph.lineStyle(3, 0xffffff, 0.96);
    if (shape === "attack") glyph.beginPath().moveTo(-8, 7).lineTo(7, -8).moveTo(1, -8).lineTo(7, -8).lineTo(7, -2).strokePath();
    else if (shape === "speed") glyph.beginPath().moveTo(-9, -6).lineTo(-2, 0).lineTo(-9, 6).moveTo(0, -6).lineTo(7, 0).lineTo(0, 6).strokePath();
    else if (shape === "support") glyph.strokeTriangle(0, -9, 9, 7, -9, 7);
    else glyph.beginPath().moveTo(0, -9).lineTo(3, -3).lineTo(9, 0).lineTo(3, 3).lineTo(0, 9).lineTo(-3, 3).lineTo(-9, 0).lineTo(-3, -3).closePath().strokePath();
    return glyph;
  }

  /** 같은 칩 인스턴스의 Graphics만 다시 칠해 매 프레임 표시 객체를 할당하지 않는다. */
  public setTiming(timing: ActiveCombatBuff["timing"], size: number): this {
    this.timing = timing;
    this.redraw(size);
    return this;
  }

  /** 겹 수만 갈아 끼운다. 칩을 다시 만들면 매 타격마다 액자가 깜빡인다. */
  public setStacks(stacks: number | undefined): this {
    if (this.stacksText && stacks !== undefined) this.stacksText.setText(String(stacks));
    return this;
  }

  private redraw(size: number): void {
    const model = battleBuffProgress(this.timing);
    const radius = size / 2 - 3;
    this.progress.clear();
    if (model.kind === "conditional" || model.kind === "permanent") {
      // 조건부는 이중 링, 영구는 점선 링으로 시간형의 어두운 부채꼴과 형태부터 달리한다.
      this.progress.lineStyle(3, 0xffffff, 0.95);
      if (model.kind === "conditional") this.progress.strokeCircle(0, 0, radius).strokeCircle(0, 0, radius - 5);
      else for (let index = 0; index < 8; index += 1) this.progress.arc(0, 0, radius, index * Math.PI / 4, index * Math.PI / 4 + Math.PI / 8).strokePath();
      return;
    }
    if (model.elapsedTurns <= 0) return;
    // 12시부터 시계 방향으로 어두운 부채꼴을 늘려 남은 영역이 비워지는 과정을 보인다.
    const start = -Math.PI / 2;
    this.progress.fillStyle(0x05070a, 0.72).beginPath().moveTo(0, 0);
    this.progress.arc(0, 0, radius, start, start + Math.PI * 2 * model.elapsedTurns, false).closePath().fillPath();
  }
}
