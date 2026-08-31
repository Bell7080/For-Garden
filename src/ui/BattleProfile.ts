import Phaser from "phaser";
import type { RelicDef, SkillIconAssetId } from "../core/types";
import type { ActiveCombatBuff } from "../core/skirmish";
import type { BattleUiMotion } from "../core/settings";
import { COLOR, textStyle } from "./theme";
import { chipPoints, drawInnerVignette, drawLayer, drawShapeOutline, HoloBar } from "./holo";
import { BattleHealthBar } from "./BattleHealthBar";
import type { HealthChangeCause } from "./unitHealthBarState";
import { PortraitCard, relicCardTint } from "./PortraitCard";
import { BATTLE_PROFILE_LAYOUT as L } from "./battleStatusLayout";
import { skillArtFor, skillArtTint, type SkillArtSlot } from "./skillArt";
import { FALLBACK_SKILL_ICON } from "./skillIcons";

/** 씬은 코어 결과에 제공자 정의만 붙이고, 액자 선택·좌표·입력·파괴는 프리팹에 맡긴다. */
export interface BattleBuffRenderModel {
  buff: ActiveCombatBuff;
  sourceRelic: RelicDef;
  /** 향후 공용 버프 아이콘이 늘어날 때도 기존 폴백 레지스트리를 통과하게 하는 선택값이다. */
  fallbackIcon?: SkillIconAssetId;
}

interface BuffChipView { container: Phaser.GameObjects.Container; slot: number }

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
  /** 전투 HUD 움직임만 줄이며 체력 색과 피해 잔상은 그대로 둔다. */
  battleUiMotion?: BattleUiMotion;
}

/** 전투, 원정 지도, 20층 보스가 공유하는 카드와 상태 게이지 프리팹이다. */
export class BattleProfile extends Phaser.GameObjects.Container {
  public readonly card: PortraitCard;
  public readonly glow: Phaser.GameObjects.Rectangle;
  public readonly sweep: Phaser.GameObjects.Rectangle;
  public readonly hpBar: HoloBar;
  /** 공용 HoloBar 두 장에 전투 전용 잔상 상태를 씌우는 래퍼다. */
  private readonly battleHpBar: BattleHealthBar;
  public readonly hpLabel: Phaser.GameObjects.Text;
  public readonly ferocityBar: HoloBar;
  public readonly ferocityLabel: Phaser.GameObjects.Text;
  public readonly charge: Phaser.GameObjects.Graphics;
  /** 버프 액자의 표시 객체를 한곳에 귀속해 프로필 제거 시 함께 정리한다. */
  public readonly buffContainer: Phaser.GameObjects.Container;
  public readonly readOnly: boolean;
  private readonly buffChips = new Map<string, BuffChipView>();

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
    // 궁극기 가림막은 카드 **몸통**(윗변이 닫힌 칩) 모양만 덮는다. 카드를 통째로 BitmapMask로
    // 쓰면 카드 안의 기하 마스크와 겹쳐 가림막이 통째로 사라진다 — 시계 방향 연출이 보이지
    // 않던 원인이다. 몸통 실루엣은 그림이 채워진 자리와 같으므로 결과는 같고 안전하다.
    this.charge = scene.add.graphics();
    this.charge.setMask(this.card.createBodyMask());
    const label = (baselineY: number, color: string) => scene.add.text(-L.barWidth / 2, baselineY, "", textStyle({ role: "display", size: 26, color }))
      .setOrigin(0, 1).setShadow(3, 4, "#05070a", 0, true, true);
    this.hpLabel = label(L.hpTextBaselineY, COLOR.hpText);
    this.battleHpBar = new BattleHealthBar(scene, 0, L.hpBarY, L.barWidth, L.hpBarHeight, options.currentHp / Math.max(1, options.maxHp), options.battleUiMotion);
    // 기존 외부 계약은 실제 초록 채움 HoloBar를 가리키게 유지한다.
    this.hpBar = this.battleHpBar.value;
    this.ferocityLabel = label(L.ferocityTextBaselineY, COLOR.ferocityText);
    this.ferocityBar = new HoloBar(scene, 0, L.ferocityBarY, L.barWidth, L.ferocityBarHeight, { color: COLOR.ferocityLow, outline: true, ticks: 3 });
    this.buffContainer = scene.add.container(0, 0);
    this.add([this.glow, this.sweep, this.card, this.charge, this.hpLabel, this.ferocityLabel, this.buffContainer]);
    // HoloBar는 홈·채움·눈금을 묶는 래퍼이므로 표시 객체 모두를 같은 컨테이너에 귀속한다.
    this.battleHpBar.addTo(this);
    this.ferocityBar.addTo(this);
    scene.add.existing(this);
    this.setActiveState(options.active);
    this.setMeters(options.currentHp, options.maxHp, options.ferocity, Boolean(options.dead));
    this.syncMask();
  }

  /** 사망 표현도 화면별 문구가 아니라 공용 옵션과 같은 갱신 경로를 사용한다. */
  public setMeters(currentHp: number, maxHp: number, ferocity: number, dead = false): this {
    // 이 메서드는 숫자/야성 표시만 갱신한다. HP 애니메이션은 실제 목표와 사건을 받는 훅이 맡는다.
    if (dead) this.battleHpBar.snap(0);
    this.hpLabel.setText(dead ? "전투 불능" : `HP ${Math.round(currentHp)} / ${Math.round(maxHp)}`)
      .setColor(dead ? COLOR.dangerText : COLOR.hpText);
    this.ferocityBar.setValue(ferocity / 100, COLOR.ferocityLow);
    this.ferocityLabel.setText(`야성 ${Math.round(ferocity)} / 100`).setColor(COLOR.ferocityText);
    // 생존 카드의 알파는 궁극기 충전 연출이 소유하므로 사망일 때만 공용 비활성 명도를 강제한다.
    if (dead) this.card.setAlpha(0.45);
    return this;
  }

  /** 전투 코어 사건이 확정한 실제 HP를 전달해 매 프레임 보간값으로 원인을 추측하지 않게 한다. */
  public setHealthTarget(currentHp: number, maxHp: number, cause: HealthChangeCause = "sync", damage?: number): this {
    this.battleHpBar.setHealth({ currentHp, maxHp, cause, damage });
    return this;
  }

  /** 피해 잔상·게이지 확대를 프레임 시간으로 진행하며 카드 위치는 고정한다. */
  public stepHealth(deltaMs: number): this { this.battleHpBar.step(deltaMs); return this; }

  /**
   * 코어가 고른 활성 버프만 받아 액자의 전체 생명주기를 동기화한다.
   * `id + sourceFighterId`가 같은 액자는 그대로 두고 사라진 액자만 파괴해, 주기적 HUD 갱신이
   * 아이콘과 입력 상태를 매번 새로 만들거나 오래된 버프의 슬롯을 흔들지 않게 한다.
   */
  public setBuffs(models: readonly BattleBuffRenderModel[]): this {
    const visible = models.slice(0, L.buffRow.maxVisible);
    const keys = new Set(visible.map(({ buff }) => this.buffKey(buff)));
    for (const [key, view] of this.buffChips) {
      if (!keys.has(key)) { view.container.destroy(true); this.buffChips.delete(key); }
    }
    for (const model of visible) {
      const key = this.buffKey(model.buff);
      if (this.buffChips.has(key)) continue;
      const used = new Set([...this.buffChips.values()].map(({ slot }) => slot));
      const slot = Array.from({ length: L.buffRow.maxVisible }, (_, index) => index).find((index) => !used.has(index));
      if (slot === undefined) continue;
      const container = this.createBuffChip(model, slot);
      this.buffChips.set(key, { container, slot });
      this.buffContainer.add(container);
    }
    return this;
  }

  private buffKey(buff: ActiveCombatBuff): string { return `${buff.id}:${buff.sourceFighterId}`; }

  /** 스킬 그림 한 장을 담는 액자이므로 예외적으로 사방선과 안쪽 비네팅을 함께 쓴다. */
  private createBuffChip(model: BattleBuffRenderModel, slot: number): Phaser.GameObjects.Container {
    const { chipSize, gap, maxVisible, y } = L.buffRow;
    const rowWidth = maxVisible * chipSize + (maxVisible - 1) * gap;
    const x = -rowWidth / 2 + chipSize / 2 + slot * (chipSize + gap);
    const chip = this.scene.add.container(x, y);
    const shape = chipPoints(chipSize, chipSize, { bevel: { topLeft: 12, topRight: 0, bottomRight: 12, bottomLeft: 0 } });
    const tint = skillArtTint(model.sourceRelic.element, model.sourceRelic.role);
    chip.add(drawLayer(this.scene, 0, 0, shape, { fill: tint, alpha: 0.9 }));
    const slotName: SkillArtSlot = model.buff.skillId === "luka-passive" ? "passive" : "ferocity";
    const dedicated = skillArtFor(model.sourceRelic.id, slotName);
    const texture = dedicated && this.scene.textures.exists(dedicated) ? dedicated : (model.fallbackIcon ?? FALLBACK_SKILL_ICON);
    const art = this.scene.add.image(0, 0, texture).setDisplaySize(chipSize * 0.72, chipSize * 0.72).setTint(tint);
    chip.add([art, drawInnerVignette(this.scene, 0, 0, shape, { strength: 0.55 }), drawShapeOutline(this.scene, 0, 0, shape, { color: tint, alpha: 0.9, width: 2 })]);
    const hit = this.scene.add.rectangle(0, 0, chipSize, chipSize, 0xffffff, 0).setInteractive({ useHandCursor: true });
    // 카드가 궁극기 버튼이므로 양쪽 입력 단계에서 전파를 막아 칩 탭이 궁극기로 이어지지 않는다.
    hit.on("pointerdown", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); chip.setScale(1.1); });
    hit.on("pointerup", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); chip.setScale(1); });
    hit.on("pointerout", () => chip.setScale(1));
    chip.add(hit);
    return chip;
  }

  /** 활성 상태는 공용 카드 발광으로만 표현하며 읽기 전용 프로필에는 입력을 열지 않는다. */
  public setActiveState(active: boolean): this {
    this.card.setSelected(active);
    if (!this.readOnly) this.card.hit.setInteractive({ useHandCursor: true });
    else this.card.hit.disableInteractive();
    this.syncMask();
    return this;
  }

  /**
   * 컨테이너 이동이나 전체 배율 뒤 기하 마스크를 즉시 월드 좌표에 다시 맞춘다.
   *
   * Phaser Container 생성자가 내부에서 `setPosition`을 부르므로 이 메서드는 카드가 아직
   * 만들어지기 전에도 한 번 불린다. 그때는 맞출 마스크가 없으므로 조용히 넘어간다.
   */
  public syncMask(): this { this.card?.syncMask(); return this; }

  public override setPosition(x?: number, y?: number, z?: number, w?: number): this {
    super.setPosition(x, y, z, w); this.syncMask(); return this;
  }

  public override setScale(x: number, y?: number): this {
    super.setScale(x, y); this.syncMask(); return this;
  }
}
