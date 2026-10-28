import Phaser from "phaser";
import type { ActiveCombatBuff } from "../core/skirmish";
import { battleBuffProgress, type BattleBuffCategory, type BattleBuffVisual } from "../core/battleBuffPresentation";
import type { BattleUiMotion } from "../core/settings";
import { chipPoints, drawInnerVignette, drawLayer, drawShapeOutline } from "./holo";
import { battleBuffStackSpot, BATTLE_PROFILE_LAYOUT } from "./battleStatusLayout";
import { COLOR, textStyle } from "./theme";
import { session } from "../state/session";
import { addColorAssistMark, COLOR_ASSIST_LAYOUT } from "./colorAssist";
import { pressIn, pressOut } from "./pressFeedback";
import { BUFF_GLYPHS } from "./statusGlyphShapes";
import { paintStatusGlyph, shadeColor } from "./statusGlyph";

/**
 * 버프 계열의 색. 칩 바탕(짙게 누른 면)·테두리·시간 막대가 이 한 색을 쓴다.
 *
 * 예전에는 버프를 건 **렐릭의 색** 하나로 칠해, 한 렐릭이 건 가속·지속 회복·연타 강화가 같은 판에
 * 같은 그림으로 섰다. 무엇을 올리는지가 먼저 읽혀야 하므로 계열이 색을 갖는다.
 */
export const BATTLE_BUFF_TONE: Readonly<Record<BattleBuffCategory, number>> = {
  attack: 0xff8a4c,
  speed: 0x5fd4ff,
  defense: 0x7fa6ff,
  heal: COLOR.hpFill,
  special: 0xe8c45a,
};

/** 칩 안의 그림 — 스킬 일러스트(흰 실루엣 텍스처)거나 공용 문양이다. */
export type BattleBuffArt = { kind: "texture"; key: string } | { kind: "glyph"; visual: BattleBuffVisual };

/** 전투 프로필에 붙는 작은 버프 액자. 진행 Graphics는 생성 후 지우고 다시 그려 재사용한다. */
export class BattleBuffChip extends Phaser.GameObjects.Container {
  private readonly gauge = this.scene.add.graphics();
  private gaugeRatio = -2;
  private readonly hit: Phaser.GameObjects.Rectangle;
  /** 겹 수 글자. 겹이 오르내릴 때 칩을 다시 만들지 않고 이 글자만 갈아 끼운다. */
  private stacksText?: Phaser.GameObjects.Text;
  private stacksGroup?: Phaser.GameObjects.Container;
  private timing: ActiveCombatBuff["timing"];
  private readonly color: number;

  constructor(scene: Phaser.Scene, size: number, visual: BattleBuffVisual, art: BattleBuffArt, buff: ActiveCombatBuff, motion: BattleUiMotion, onPress: () => void) {
    super(scene, 0, 0);
    this.timing = buff.timing;
    this.color = BATTLE_BUFF_TONE[visual.category];
    const shape = chipPoints(size, size, { bevel: { topLeft: 12, topRight: 0, bottomRight: 12, bottomLeft: 0 } });
    // 머리 위 상태 칩과 같은 결 — 계열 색을 짙게 누른 면 위에 흰 그림이 잉크 외곽을 두르고 선다.
    this.add(drawLayer(scene, 0, 0, shape, { fill: shadeColor(this.color, 0.34), alpha: 0.96, shadow: BATTLE_PROFILE_LAYOUT.buffShadow }));
    this.add(drawInnerVignette(scene, 0, 0, shape, { strength: 0.45 }));
    if (art.kind === "texture") {
      // 스킬 일러스트는 흰 실루엣이라 그대로 세우고, 검은 복제를 비껴 깔아 바탕에서 떼어 낸다.
      const artSize = size * 0.78;
      this.add(scene.add.image(2, 3, art.key).setDisplaySize(artSize, artSize).setTintFill(0x000000).setAlpha(0.85));
      this.add(scene.add.image(0, 0, art.key).setDisplaySize(artSize, artSize));
    } else {
      this.add(paintStatusGlyph(scene, BUFF_GLYPHS[art.visual.glyph === "skill" ? art.visual.fallback : art.visual.glyph], size * 0.38, 1.6));
    }
    this.add(drawShapeOutline(scene, 0, 0, shape, { color: this.color, alpha: 0.95, width: 2.5 }));
    // 효과 이름을 임의 도형으로 재해석하지 않고 공용 status 정책의 안정 키를 사용한다.
    addColorAssistMark(scene, this, -size / 2 + COLOR_ASSIST_LAYOUT.statusChip.inset, -size / 2 + COLOR_ASSIST_LAYOUT.statusChip.inset, COLOR_ASSIST_LAYOUT.statusChip.size, session.settings.accessibility.colorAssist, "status", "buff");
    // 보이는 56px 액자보다 입력판을 넓혀 최소 64px 터치 영역을 확보한다.
    this.hit = scene.add.rectangle(0, 0, Math.max(64, size), Math.max(64, size), 0xffffff, 0).setInteractive({ useHandCursor: true });
    // 전투 UI 움직임을 끈 사람에게는 눌림 장식도 세우지 않는다. 나머지는 공용 눌림 연출이다.
    const pressable = motion !== "off";
    this.hit.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); if (pressable) pressIn(this); });
    this.hit.on("pointerup", (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); pressOut(this); onPress(); });
    this.hit.on("pointerout", () => pressOut(this, "normal", { pop: false }));
    this.add([this.gauge, this.hit]);
    // 겹치는 값(주기 타격의 몇 대째)은 칩을 여러 장 세우지 않고 **우상단 숫자 하나**가 말한다 —
    // 머리 위 상태 칩과 같은 자리라, 칩 안의 그림을 덮지 않는다.
    if (buff.stacks !== undefined) this.add(this.drawStacks(size, buff.stacks));
    this.redraw(size);
    scene.add.existing(this);
  }

  /** 칩 우상단 모서리에 걸터앉은 겹 수. 계열 색 테를 두른 검은 판 위 흰 글자다. */
  private drawStacks(size: number, stacks: number): Phaser.GameObjects.Container {
    const spot = battleBuffStackSpot(size);
    const group = this.scene.add.container(0, 0);
    const plate = this.scene.add.graphics();
    const r = spot.plateRadius;
    plate.fillStyle(COLOR.void, 0.96).fillRect(spot.x - r, spot.y - r, r * 2, r * 2);
    plate.lineStyle(2, this.color, 1).strokeRect(spot.x - r, spot.y - r, r * 2, r * 2);
    group.add(plate);
    this.stacksText = this.scene.add
      .text(spot.x, spot.y + 1, String(stacks), textStyle({ role: "display", size: spot.fontSize, color: "#ffffff" }))
      .setOrigin(0.5)
      .setStroke("#05070a", spot.strokeWidth);
    group.add(this.stacksText);
    this.stacksGroup = group;
    return group;
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
    this.stacksGroup?.setVisible(stacks !== undefined);
    return this;
  }

  /**
   * 남은 시간은 칩 밑변 아래 막대가 계열 색으로 말한다 — 왼쪽부터 줄어 다 비는 순간이 끝나는 순간이다.
   * 예전처럼 그림 위를 검은 부채꼴로 덮으면 시간이 갈수록 그림이 가려졌다. 조건부·영구 버프는 막대가 없다.
   */
  private redraw(size: number): void {
    const model = battleBuffProgress(this.timing);
    const ratio = model.kind === "countdown" ? Math.round(model.remainingRatio * size) / size : -1;
    if (ratio === this.gaugeRatio) return;
    this.gaugeRatio = ratio;
    this.gauge.clear();
    if (ratio < 0) return;
    const { gap, height } = BATTLE_PROFILE_LAYOUT.buffGauge;
    const top = size / 2 + gap;
    this.gauge.fillStyle(0x000000, 0.85).fillRect(-size / 2 - 1, top - 1, size + 2, height + 2);
    if (ratio > 0) this.gauge.fillStyle(this.color, 1).fillRect(-size / 2, top, size * ratio, height);
  }
}
