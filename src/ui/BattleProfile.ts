import Phaser from "phaser";
import type { RelicDef } from "../core/types";
import { COLOR, textStyle } from "./theme";
import { HoloBar } from "./holo";
import { PortraitCard, relicCardTint } from "./PortraitCard";
import { BATTLE_PROFILE_LAYOUT as L } from "./battleStatusLayout";

/** 씬이 상태만 넘기고 카드와 두 게이지의 시각 규칙은 다시 정의하지 않게 하는 입력 계약이다. */
export interface BattleProfileOptions {
  relic: RelicDef;
  level: number;
  stars: number;
  currentHp: number;
  maxHp: number;
  ferocity: number;
  active: boolean;
  readOnly: boolean;
  dead?: boolean;
  sub?: string;
}

/** 전투, 원정 지도, 20층 보스가 공유하는 카드와 상태 게이지 프리팹이다. */
export class BattleProfile extends Phaser.GameObjects.Container {
  public readonly card: PortraitCard;
  public readonly glow: Phaser.GameObjects.Rectangle;
  public readonly sweep: Phaser.GameObjects.Rectangle;
  public readonly hpBar: HoloBar;
  public readonly hpLabel: Phaser.GameObjects.Text;
  public readonly ferocityBar: HoloBar;
  public readonly ferocityLabel: Phaser.GameObjects.Text;
  public readonly charge: Phaser.GameObjects.Graphics;
  public readonly readOnly: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, options: BattleProfileOptions) {
    super(scene, x, y);
    this.readOnly = options.readOnly;
    this.glow = scene.add.rectangle(0, 0, L.glowSize, L.glowSize, COLOR.accent, 0);
    this.sweep = scene.add.rectangle(-125, 0, 34, 320, COLOR.accent, 0).setAngle(18).setDepth(2);
    this.card = new PortraitCard(scene, 0, 0, {
      width: L.cardWidth, height: L.cardHeight, portraitAssetId: options.relic.portraitAssetId,
      tint: relicCardTint(options.relic), label: options.relic.name, level: options.level,
      sub: options.sub, rarity: options.relic.rarity, stars: options.stars,
    });
    // 궁극기 가림막은 카드의 실제 픽셀만 따라가므로 열린 머리 홈 밖에 검은 조각이 남지 않는다.
    this.charge = scene.add.graphics().setDepth(1);
    this.charge.setMask(new Phaser.Display.Masks.BitmapMask(scene, this.card));
    const label = (baselineY: number, color: string) => scene.add.text(-L.barWidth / 2, baselineY, "", textStyle({ role: "display", size: 26, color }))
      .setOrigin(0, 1).setShadow(3, 4, "#05070a", 0, true, true);
    this.hpLabel = label(L.hpTextBaselineY, COLOR.hpText);
    this.hpBar = new HoloBar(scene, 0, L.hpBarY, L.barWidth, L.hpBarHeight, { color: COLOR.hpFill, outline: true, ticks: 3 });
    this.ferocityLabel = label(L.ferocityTextBaselineY, COLOR.ferocityText);
    this.ferocityBar = new HoloBar(scene, 0, L.ferocityBarY, L.barWidth, L.ferocityBarHeight, { color: COLOR.ferocityLow, outline: true, ticks: 3 });
    this.add([this.glow, this.sweep, this.card, this.charge, this.hpLabel, this.ferocityLabel]);
    // HoloBar는 홈·채움·눈금을 묶는 래퍼이므로 표시 객체 모두를 같은 컨테이너에 귀속한다.
    this.hpBar.addTo(this);
    this.ferocityBar.addTo(this);
    scene.add.existing(this);
    this.setActiveState(options.active);
    this.setMeters(options.currentHp, options.maxHp, options.ferocity, Boolean(options.dead));
    this.syncMask();
  }

  /** 사망 표현도 화면별 문구가 아니라 공용 옵션과 같은 갱신 경로를 사용한다. */
  public setMeters(currentHp: number, maxHp: number, ferocity: number, dead = false): this {
    const safeMax = Math.max(1, maxHp);
    this.hpBar.setValue(dead ? 0 : currentHp / safeMax, dead ? 0x6c7078 : COLOR.hpFill);
    this.hpLabel.setText(dead ? "전투 불능" : `HP ${Math.round(currentHp)} / ${Math.round(maxHp)}`)
      .setColor(dead ? COLOR.dangerText : COLOR.hpText);
    this.ferocityBar.setValue(ferocity / 100, COLOR.ferocityLow);
    this.ferocityLabel.setText(`야성 ${Math.round(ferocity)} / 100`).setColor(COLOR.ferocityText);
    // 생존 카드의 알파는 궁극기 충전 연출이 소유하므로 사망일 때만 공용 비활성 명도를 강제한다.
    if (dead) this.card.setAlpha(0.45);
    return this;
  }

  /** 활성 상태는 공용 카드 발광으로만 표현하며 읽기 전용 프로필에는 입력을 열지 않는다. */
  public setActiveState(active: boolean): this {
    this.card.setSelected(active);
    if (!this.readOnly) this.card.hit.setInteractive({ useHandCursor: true });
    else this.card.hit.disableInteractive();
    this.syncMask();
    return this;
  }

  /** 컨테이너 이동이나 전체 배율 뒤 기하 마스크를 즉시 월드 좌표에 다시 맞춘다. */
  public syncMask(): this { this.card.syncMask(); return this; }

  public override setPosition(x?: number, y?: number, z?: number, w?: number): this {
    super.setPosition(x, y, z, w); this.syncMask(); return this;
  }

  public override setScale(x: number, y?: number): this {
    super.setScale(x, y); this.syncMask(); return this;
  }
}
