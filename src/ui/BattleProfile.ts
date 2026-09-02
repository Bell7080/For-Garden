import Phaser from "phaser";
import type { RelicDef, SkillIconAssetId } from "../core/types";
import type { ActiveCombatBuff } from "../core/skirmish";
import type { BattleUiMotion } from "../core/settings";
import { COLOR, textStyle } from "./theme";
import { HoloBar } from "./holo";
import { BattleHealthBar } from "./BattleHealthBar";
import type { HealthChangeCause } from "./unitHealthBarState";
import { PortraitCard, type PortraitAlphaOverlay } from "./PortraitCard";
import { BATTLE_PROFILE_LAYOUT as L } from "./battleStatusLayout";
import { skillArtFor, skillArtTint, type SkillArtSlot } from "./skillArt";
import { FALLBACK_SKILL_ICON } from "./skillIcons";
import { BattleBuffChip } from "./BattleBuffChip";

/** 카드 전체를 덮고도 가장 먼 모서리까지 닿는 충전 부채꼴 반지름이다. */
const CHARGE_VEIL_RADIUS = 240;
/** 머리 복제의 최종 알파도 `sourcePixelAlpha × CHARGE_VEIL_ALPHA`가 되게 하는 합성 계수다. */
export const CHARGE_VEIL_ALPHA = 0.58;

/** 씬은 코어 결과에 제공자 정의만 붙이고, 액자 선택·좌표·입력·파괴는 프리팹에 맡긴다. */
export interface BattleBuffRenderModel {
  buff: ActiveCombatBuff;
  sourceRelic: RelicDef;
  /** 향후 공용 버프 아이콘이 늘어날 때도 기존 폴백 레지스트리를 통과하게 하는 선택값이다. */
  fallbackIcon?: SkillIconAssetId;
  /** 칩 상세는 씬이 소유한 PopupLayer를 통해 열어야 하므로 프리팹은 입력 의도만 전달한다. */
  onPress?: () => void;
}

interface BuffChipView { container: BattleBuffChip; slot: number }

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
  /** 몸통 기하 면과 원화 알파 머리 복제를 같은 진행률로 묶는 카드 공개 API 결과다. */
  private readonly chargeOverlay: PortraitAlphaOverlay;
  /** 버프 액자의 표시 객체를 한곳에 귀속해 프로필 제거 시 함께 정리한다. */
  public readonly buffContainer: Phaser.GameObjects.Container;
  public readonly readOnly: boolean;
  private readonly buffChips = new Map<string, BuffChipView>();
  private readonly battleUiMotion: BattleUiMotion;
  /** 최대 개수를 넘긴 마지막 집계 칩이 전체 목록 열기 의도를 씬으로 전달한다. */
  private overflowChip?: BattleBuffChip;

  constructor(scene: Phaser.Scene, x: number, y: number, options: BattleProfileOptions) {
    super(scene, x, y);
    this.readOnly = options.readOnly;
    this.battleUiMotion = options.battleUiMotion ?? "default";
    this.glow = scene.add.rectangle(0, 0, L.glowSize, L.glowSize, COLOR.accent, 0);
    this.sweep = scene.add.rectangle(-125, 0, 34, 320, COLOR.accent, 0).setAngle(18).setDepth(2);
    this.card = new PortraitCard(scene, 0, 0, {
      width: L.cardWidth, height: L.cardHeight, portraitAssetId: options.relic.portraitAssetId,
      label: options.relic.name, level: options.level,
      sub: options.sub, rarity: options.relic.rarity, stars: options.stars,
    });
    // 몸통은 닫힌 칩 기하를 쓰고 돌출 머리는 원화 알파 복제를 쓴다. 카드 전체 도형 하나를
    // 칠하면 머리 옆 투명 공간까지 검은 면이 되므로 두 표시를 카드 공개 API에서만 묶는다.
    this.chargeOverlay = this.card.createPortraitAlphaOverlay(0x060a10, CHARGE_VEIL_ALPHA, CHARGE_VEIL_RADIUS);
    this.charge = this.chargeOverlay.body;
    const label = (baselineY: number, color: string) => scene.add.text(-L.barWidth / 2, baselineY, "", textStyle({ role: "display", size: 26, color }))
      .setOrigin(0, 1).setShadow(3, 4, "#05070a", 0, true, true);
    this.hpLabel = label(L.hpTextBaselineY, COLOR.hpText);
    this.battleHpBar = new BattleHealthBar(scene, 0, L.hpBarY, L.barWidth, L.hpBarHeight, options.currentHp / Math.max(1, options.maxHp), options.battleUiMotion);
    // 기존 외부 계약은 실제 초록 채움 HoloBar를 가리키게 유지한다.
    this.hpBar = this.battleHpBar.value;
    this.ferocityLabel = label(L.ferocityTextBaselineY, COLOR.ferocityText);
    this.ferocityBar = new HoloBar(scene, 0, L.ferocityBarY, L.barWidth, L.ferocityBarHeight, { color: COLOR.ferocityLow, outline: true, ticks: 3 });
    this.buffContainer = scene.add.container(0, 0);
    this.add([this.glow, this.sweep, this.card, this.chargeOverlay.display, this.hpLabel, this.ferocityLabel, this.buffContainer]);
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
    // 사망은 카드와 충전 가림막의 조립이 끝난 뒤 전체 알파를 정확히 한 번 적용한다. 잠금 tint,
    // 선택 면, 충전 효과의 개별 알파를 여기서 다시 계산하지 않아 중복 감쇠를 피하고 부활 시 복구한다.
    this.card.setCompositeAlpha(dead ? 0.45 : 1);
    return this;
  }

  /** 전투 코어 사건이 확정한 실제 HP를 전달해 매 프레임 보간값으로 원인을 추측하지 않게 한다. */
  public setHealthTarget(currentHp: number, maxHp: number, cause: HealthChangeCause = "sync", damage?: number): this {
    this.battleHpBar.setHealth({ currentHp, maxHp, cause, damage });
    return this;
  }

  /** 피해 잔상·게이지 확대를 프레임 시간으로 진행하며 카드 위치는 고정한다. */
  public stepHealth(deltaMs: number): this { this.battleHpBar.step(deltaMs); return this; }

  /** 전투 씬이 도형 둘을 따로 칠하지 않도록 몸통·머리의 충전 가림막을 원자적으로 갱신한다. */
  public setChargeRatio(ratio: number): this {
    this.chargeOverlay.setRatio(ratio);
    return this;
  }

  /**
   * 코어가 고른 활성 버프만 받아 액자의 전체 생명주기를 동기화한다.
   * `id + sourceFighterId`가 같은 액자는 그대로 두고 사라진 액자만 파괴해, 주기적 HUD 갱신이
   * 아이콘과 입력 상태를 매번 새로 만들거나 오래된 버프의 슬롯을 흔들지 않게 한다.
   */
  public setBuffs(models: readonly BattleBuffRenderModel[], onOverflowPress?: () => void): this {
    const overflow = Math.max(0, models.length - L.buffRow.maxVisible + 1);
    const visibleCount = overflow > 0 ? L.buffRow.maxVisible - 1 : L.buffRow.maxVisible;
    const visible = models.slice(0, visibleCount);
    const keys = new Set(visible.map(({ buff }) => this.buffKey(buff)));
    for (const [key, view] of this.buffChips) {
      if (!keys.has(key)) { view.container.destroy(true); this.buffChips.delete(key); }
    }
    for (const model of visible) {
      const key = this.buffKey(model.buff);
      const current = this.buffChips.get(key);
      if (current) {
        current.container.setTiming(model.buff.timing, L.buffRow.chipSize);
        continue;
      }
      const used = new Set([...this.buffChips.values()].map(({ slot }) => slot));
      const slot = Array.from({ length: L.buffRow.maxVisible }, (_, index) => index).find((index) => !used.has(index));
      if (slot === undefined) continue;
      const { container } = this.createBuffChip(model, slot);
      this.buffChips.set(key, { container, slot });
      this.buffContainer.add(container);
    }
    // 집계 칩은 실제 버프와 키/슬롯 생명주기를 섞지 않고 마지막 고정 슬롯만 사용한다.
    this.overflowChip?.destroy(true);
    this.overflowChip = undefined;
    if (overflow > 0) {
      const model = models[visibleCount];
      const { container } = this.createBuffChip(model, L.buffRow.maxVisible - 1, `+${overflow}`, onOverflowPress);
      this.overflowChip = container;
      this.buffContainer.add(container);
    }
    return this;
  }

  private buffKey(buff: ActiveCombatBuff): string { return `${buff.id}:${buff.sourceFighterId}`; }

  /** 스킬 그림 한 장을 담는 액자이므로 예외적으로 사방선과 안쪽 비네팅을 함께 쓴다. */
  private createBuffChip(model: BattleBuffRenderModel, slot: number, aggregateLabel?: string, onPress = model.onPress): { container: BattleBuffChip; tint: number } {
    const { chipSize, gap, maxVisible, y } = L.buffRow;
    const rowWidth = maxVisible * chipSize + (maxVisible - 1) * gap;
    const x = -rowWidth / 2 + chipSize / 2 + slot * (chipSize + gap);
    const tint = skillArtTint(model.sourceRelic.element, model.sourceRelic.role);
    const slotName: SkillArtSlot = model.buff.skillId === "luka-passive" ? "passive" : "ferocity";
    const dedicated = skillArtFor(model.sourceRelic.id, slotName);
    const texture = dedicated && this.scene.textures.exists(dedicated) ? dedicated : (model.fallbackIcon ?? FALLBACK_SKILL_ICON);
    const chip = new BattleBuffChip(this.scene, chipSize, tint, texture, model.buff, this.battleUiMotion, () => onPress?.()).setPosition(x, y);
    // +N은 장식 아이콘보다 우선하는 고대비 숫자로 집계 동작임을 명확히 한다.
    if (aggregateLabel) chip.add(this.scene.add.text(0, 0, aggregateLabel, textStyle({ role: "display", size: 25, color: "#ffffff" })).setOrigin(0.5).setShadow(2, 3, "#05070a", 1));
    return { container: chip, tint };
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
