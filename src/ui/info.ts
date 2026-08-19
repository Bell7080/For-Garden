import Phaser from "phaser";
import type { PuppetCreature } from "../puppets/assets";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { previewSkillDamage, ULTIMATE_ENERGY_MAX, type BattleUnit } from "../core/battle";
import type { EffectType, RelicDef, Skill, SkillIconAssetId } from "../core/types";
import { setDebugInfoOpen } from "../debug";
import { getHeartGem } from "../data/heartGems";
import { relicProgression } from "../managers/RelicProgressionManager";
import { enableHitOnClick, portraitAssetFor, portraitUsesRelicTint, spawnPuppet, tintPuppet } from "../puppets/assets";
import { mixWhite, tintFor } from "../puppets/tints";
import { addSceneBackground, BACKGROUND } from "./backgrounds";
import { StatRadar } from "./StatRadar";
import { COLOR, textStyle } from "./theme";
import { FALLBACK_SKILL_ICON } from "./skillIcons";

/** 문자열 순서에 의존하지 않고 스킬 상세의 각 UI 요소를 직접 채우는 계약이다. */
export interface SkillInfoViewModel {
  name: string;
  kindLabel: string;
  iconAssetId: SkillIconAssetId;
  effectLabel: string;
  valueLabel?: string;
  gaugeCost?: number;
  description: string;
}

/** 데이터 효과 분류를 플레이어가 읽는 고정 라벨로 바꾼다. */
const EFFECT_LABEL: Record<EffectType, string> = {
  physical: "물리 피해",
  magical: "마법 피해",
  fixed: "고정 피해",
  healing: "회복",
  buff: "버프",
};

/** 왼쪽 전신의 얼굴·몸통을 비워 두고 정보는 오른쪽 두 섬에만 놓는다. */
const PORTRAIT_BOX = { left: 32, right: 668, top: 280, bottom: 1660 } as const;
export const ROLE_LABEL: Record<string, string> = { attacker: "공격", tank: "방어", support: "지원" };

/** `?` 도움말 배지의 클릭이 아래 카드 입력으로 전파되지 않게 한다. */
export function addHelpBadge(scene: Phaser.Scene, x: number, y: number, onClick: () => void, radius = 26): Phaser.GameObjects.Container {
  const badge = scene.add.container(x, y);
  const circle = scene.add.circle(0, 0, radius, COLOR.void).setStrokeStyle(3, COLOR.accent).setInteractive({ useHandCursor: true });
  badge.add([circle, scene.add.text(0, 0, "?", textStyle({ size: Math.round(radius * 1.3), color: COLOR.accentText })).setOrigin(0.5)]);
  circle.on("pointerdown", (_p: unknown, _x: unknown, _y: unknown, event?: Phaser.Types.Input.EventData) => { event?.stopPropagation(); onClick(); });
  return badge;
}

/** 외곽선 없이 명도 차이와 황동 섹션 바로 구분하는 작은 플로팅 레이어다. */
function floatingLayer(scene: Phaser.Scene, x: number, y: number, width: number, height: number, title: string): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  container.add(scene.add.rectangle(0, 0, width, height, COLOR.panel, 0.72).setOrigin(0));
  container.add(scene.add.rectangle(0, 0, 7, 46, COLOR.accent, 0.9).setOrigin(0));
  container.add(scene.add.text(24, 10, title, textStyle({ size: 20, color: COLOR.accentText })).setOrigin(0));
  return container;
}

/** Phaser 컨테이너 단위로 헤더·능력치·성장·보석·스킬을 조립하는 공용 정보 화면이다. */
export class InfoManager {
  private readonly root: Phaser.GameObjects.Container;
  private readonly chrome: Phaser.GameObjects.Container;
  private readonly header: Phaser.GameObjects.Container;
  private readonly stats: Phaser.GameObjects.Container;
  private readonly growth: Phaser.GameObjects.Container;
  private readonly gems: Phaser.GameObjects.Container;
  private readonly skills: Phaser.GameObjects.Container;
  private readonly skillDetail: Phaser.GameObjects.Container;
  private readonly headerText: Phaser.GameObjects.Text;
  private readonly dnaText: Phaser.GameObjects.Text;
  private readonly statsText: Phaser.GameObjects.Text;
  private readonly radar: StatRadar;
  private readonly gemLabels: Phaser.GameObjects.Text[] = [];
  private readonly detailTitle: Phaser.GameObjects.Text;
  private readonly detailIcon: Phaser.GameObjects.Image;
  private readonly detailMeta: Phaser.GameObjects.Text;
  private readonly detailDescription: Phaser.GameObjects.Text;
  private currentDef?: RelicDef;
  /** 전투에서 연 정보창일 때 실제 공격자와 피해 대상을 보존한다. */
  private currentUnit?: BattleUnit;
  private previewTarget?: BattleUnit;
  private portrait?: PuppetCreature;
  private portraitWanted = false;
  private portraitRequest = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly portraitDepth = 1001) {
    this.root = scene.add.container(0, 0).setDepth(1000).setVisible(false);
    this.chrome = scene.add.container(0, 0).setDepth(1002).setVisible(false);
    this.root.add(addSceneBackground(scene, BACKGROUND.info, 0));
    // 화면 전체 암막은 58%로 두되 우측은 별도의 55~75% 플로팅 레이어만 사용한다.
    this.root.add(scene.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.58).setInteractive());
    const gradient = scene.add.graphics().fillGradientStyle(COLOR.void, COLOR.void, COLOR.panel, COLOR.panel, 0.05, 0.7, 0.05, 0.7);
    gradient.fillRect(420, 0, 660, BASE_HEIGHT);
    this.root.add(gradient);

    this.header = floatingLayer(scene, 58, 54, 930, 202, "RELIC / ARCHIVE");
    this.headerText = scene.add.text(25, 56, "", textStyle({ size: 39, wrap: 820, lineSpacing: 5 })).setOrigin(0);
    this.header.add(this.headerText);
    const close = scene.add.rectangle(878, 52, 88, 88, COLOR.void, 0.7).setInteractive({ useHandCursor: true });
    close.on("pointerup", () => this.hide());
    this.header.add([close, scene.add.text(878, 52, "×", textStyle({ size: 50, bold: false })).setOrigin(0.5)]);
    this.chrome.add(this.header);

    this.stats = floatingLayer(scene, 664, 300, 370, 590, "능력치 / STATUS");
    this.radar = new StatRadar(scene, 185, 205, 105);
    this.statsText = scene.add.text(28, 350, "", textStyle({ size: 22, lineSpacing: 9 })).setOrigin(0);
    this.stats.add([this.radar, this.statsText]);
    this.chrome.add(this.stats);

    this.growth = floatingLayer(scene, 58, 1485, 560, 190, "성장 / DNA");
    this.dnaText = scene.add.text(28, 70, "", textStyle({ size: 27, color: COLOR.accentText, lineSpacing: 12 })).setOrigin(0);
    this.growth.add(this.dnaText);
    this.chrome.add(this.growth);

    this.gems = floatingLayer(scene, 58, 1692, 560, 174, "HEART GEM");
    for (let index = 0; index < 3; index += 1) this.addGemSlot(index);
    this.chrome.add(this.gems);

    this.skills = floatingLayer(scene, 646, 930, 388, 444, "스킬 / SKILLS");
    this.chrome.add(this.skills);
    this.skillDetail = floatingLayer(scene, 620, 905, 414, 610, "스킬 상세").setVisible(false);
    // fallback도 파일 로딩에 실패할 경우를 대비해 런타임 공용 텍스처를 마지막 안전망으로 만든다.
    this.ensureFallbackIcon();
    this.detailIcon = scene.add.image(72, 122, FALLBACK_SKILL_ICON).setDisplaySize(88, 88);
    this.detailTitle = scene.add.text(132, 82, "", textStyle({ size: 32, color: COLOR.accentText, wrap: 245 })).setOrigin(0);
    this.detailMeta = scene.add.text(28, 172, "", textStyle({ size: 21, lineSpacing: 12 })).setOrigin(0);
    this.detailDescription = scene.add.text(28, 292, "", textStyle({ size: 22, wrap: 350, lineSpacing: 9 })).setOrigin(0);
    const back = scene.add.rectangle(207, 555, 358, 88, COLOR.void, 0.7).setInteractive({ useHandCursor: true });
    back.on("pointerup", () => this.closeSkillDetail());
    this.skillDetail.add([this.detailIcon, this.detailTitle, this.detailMeta, this.detailDescription, back,
      scene.add.text(207, 555, "‹ 캐릭터 상세로", textStyle({ size: 22, color: COLOR.accentText })).setOrigin(0.5)]);
    this.chrome.add(this.skillDetail);
  }

  /** 외부 SVG까지 실패해도 정보창 자체는 열리도록 단순 황동 다이아 텍스처를 생성한다. */
  private ensureFallbackIcon(): void {
    if (this.scene.textures.exists(FALLBACK_SKILL_ICON)) return;
    const graphic = this.scene.make.graphics({ x: 0, y: 0 }, false);
    graphic.fillStyle(COLOR.void, 1).fillRect(0, 0, 96, 96);
    graphic.lineStyle(6, COLOR.accent, 1).strokePoints([
      new Phaser.Geom.Point(48, 14), new Phaser.Geom.Point(82, 48),
      new Phaser.Geom.Point(48, 82), new Phaser.Geom.Point(14, 48),
    ], true);
    graphic.generateTexture(FALLBACK_SKILL_ICON, 96, 96);
    graphic.destroy();
  }

  get isOpen(): boolean { return this.root.visible; }

  /** 상세 카드가 열려 있어도 X만 전체 정보창을 닫는다. */
  hide(): void {
    this.root.setVisible(false); this.chrome.setVisible(false); this.portraitWanted = false;
    this.portrait?.setVisible(false); this.closeSkillDetail(); setDebugInfoOpen(false);
  }

  /** 하트 실루엣과 텍스트를 함께 써 빈 슬롯과 장착 슬롯을 색·문자로 중복 구분한다. */
  private addGemSlot(index: number): void {
    const x = 100 + index * 170;
    const heart = this.scene.add.graphics().setPosition(x, 92);
    heart.fillStyle(COLOR.panelEdge, 0.85).fillCircle(-21, -10, 29).fillCircle(21, -10, 29)
      .fillTriangle(-49, 0, 49, 0, 0, 62);
    const label = this.scene.add.text(x, 105, "빈 슬롯", textStyle({ size: 15, align: "center", wrap: 130 })).setOrigin(0.5, 0);
    this.gemLabels.push(label); this.gems.add([heart, label]);
  }

  private async loadPortrait(def: RelicDef): Promise<void> {
    const request = ++this.portraitRequest;
    const asset = portraitAssetFor(def.portraitAssetId);
    const scaleHeight = Math.min(PORTRAIT_BOX.bottom - PORTRAIT_BOX.top,
      ((PORTRAIT_BOX.right - PORTRAIT_BOX.left) * (asset.content.bottom - asset.content.top)) / (asset.content.right - asset.content.left));
    const portrait = await spawnPuppet(this.scene, asset, { x: 330, groundY: PORTRAIT_BOX.bottom, height: scaleHeight, depth: Math.max(this.portraitDepth, 1001) });
    if (request !== this.portraitRequest) { portrait.destroy(); return; }
    this.portrait?.destroy(); this.portrait = portrait; enableHitOnClick(this.scene, portrait);
    if (portraitUsesRelicTint(def.portraitAssetId)) tintPuppet(portrait, mixWhite(tintFor(def.id), 0.55));
    portrait.setVisible(this.portraitWanted && this.root.visible);
  }

  /** 공용 진입점의 캐릭터 화면을 성장 데이터와 함께 채운다. */
  private openCharacter(def: RelicDef, live?: string, unit?: BattleUnit, target?: BattleUnit): void {
    this.currentDef = def;
    // 도감 진입 시 이전 전투 대상을 지워 잘못된 확정 피해를 노출하지 않는다.
    this.currentUnit = unit;
    this.previewTarget = target;
    const progress = relicProgression.getProgress(def.id);
    const finalStats = relicProgression.getFinalStats(def.id);
    this.headerText.setText(`SSR  ${def.name}\nLV.${progress.level} · ${progress.levelTitle}  |  ${def.origin} · ${ROLE_LABEL[def.role]}`);
    this.dnaText.setText(`${"★".repeat(progress.dnaMastery)}${"☆".repeat(5 - progress.dnaMastery)}\n${live ?? "DNA 복원 동기화"}`);
    this.radar.draw(finalStats);
    this.statsText.setText(`체력  ${finalStats.hp.toLocaleString()}\n방어력  ${finalStats.def.toLocaleString()}    저항력  ${finalStats.res.toLocaleString()}\n공격력  ${finalStats.atk.toLocaleString()}    주문력  ${finalStats.ap.toLocaleString()}`);
    progress.heartGemSlots.forEach((id, index) => this.gemLabels[index].setText(id ? getHeartGem(id).name.replace(" Heart Gem", "") : "빈 슬롯").setColor(id ? COLOR.accentText : COLOR.inkDim));
    this.buildSkillButtons(def);
    this.skillDetail.setVisible(false); this.skills.setVisible(true);
    this.portraitWanted = true; this.portrait?.setVisible(false); void this.loadPortrait(def);
    this.root.setVisible(true); this.chrome.setVisible(true); setDebugInfoOpen(true);
  }

  /** 패시브·일반·궁극기 버튼은 각각 88×88 이상의 pointerup 터치 영역을 가진다. */
  private buildSkillButtons(def: RelicDef): void {
    // floatingLayer가 만든 배경·섹션 바·제목 세 개는 유지하고 이전 캐릭터 버튼만 교체한다.
    while (this.skills.length > 3) this.skills.removeAt(3, true);
    const entries = [
      ["패시브", def.passive.iconAssetId, def.passive.name, () => this.showSkill({ name: def.passive.name, kindLabel: "패시브", iconAssetId: def.passive.iconAssetId, effectLabel: EFFECT_LABEL[def.passive.effectType], description: def.passive.desc })],
      ["일반 공격", def.basic.iconAssetId, def.basic.name, () => this.showSkill(this.skillViewModel("일반 공격", def.basic))],
      ["궁극기", def.ultimate.iconAssetId, def.ultimate.name, () => this.showSkill(this.skillViewModel("궁극기", def.ultimate, def.ultimate.cost))],
    ] as const;
    entries.forEach(([kind, iconAssetId, name, handler], index) => {
      const y = 78 + index * 116;
      const hit = this.scene.add.rectangle(58, y + 44, 104, 96, index === 2 ? COLOR.energy : COLOR.void, 0.72).setInteractive({ useHandCursor: true });
      hit.on("pointerup", handler);
      const icon = this.scene.add.image(58, y + 44, this.resolveIcon(iconAssetId)).setDisplaySize(72, 72);
      this.skills.add([hit, icon,
        this.scene.add.text(126, y + 9, `${kind}\n${name}`, textStyle({ size: 21, wrap: 225, lineSpacing: 5 })).setOrigin(0)]);
    });
  }

  /** 로드되지 않은 키는 캐릭터와 무관한 하나의 fallback으로 안전하게 치환한다. */
  private resolveIcon(iconAssetId: SkillIconAssetId): string {
    return this.scene.textures.exists(iconAssetId) ? iconAssetId : FALLBACK_SKILL_ICON;
  }

  /** 현재 화면 문맥에 따라 도감 배율 또는 대상 방어력이 반영된 전투 피해를 만든다. */
  private skillViewModel(kindLabel: string, skill: Skill, gaugeCost?: number): SkillInfoViewModel {
    const attacker = this.currentUnit ?? (this.currentDef && {
      def: this.currentDef, hp: this.currentDef.stats.hp, maxHp: this.currentDef.stats.hp,
      energy: 0, justSwapped: false,
    });
    const preview = attacker ? previewSkillDamage(attacker, skill, this.previewTarget, true) : undefined;
    const valueLabel = preview?.kind === "damage"
      ? `${preview.label}  ${preview.amount.toLocaleString()} (대상 방어 반영)`
      : preview ? `${preview.label}  ${preview.stat} ${preview.power}% (도감 기준)` : undefined;
    return { name: skill.name, kindLabel, iconAssetId: skill.iconAssetId,
      effectLabel: EFFECT_LABEL[skill.effectType], valueLabel, gaugeCost, description: skill.desc };
  }

  /** 구조화된 값의 각 필드를 대응하는 아이콘·텍스트 요소에 직접 바인딩한다. */
  showSkill(viewModel: SkillInfoViewModel): void {
    if (!this.root.visible) return;
    const rows = [`분류  ${viewModel.kindLabel}`, `효과 타입  ${viewModel.effectLabel}`];
    if (viewModel.valueLabel) rows.push(viewModel.valueLabel);
    if (viewModel.gaugeCost !== undefined) rows.push(`필요 게이지  ${viewModel.gaugeCost}`);
    this.detailIcon.setTexture(this.resolveIcon(viewModel.iconAssetId));
    this.detailTitle.setText(viewModel.name); this.detailMeta.setText(rows.join("\n")); this.detailDescription.setText(viewModel.description);
    this.skills.setVisible(false); this.skillDetail.setVisible(true);
  }

  private closeSkillDetail(): void { this.skillDetail.setVisible(false); if (this.root.visible) this.skills.setVisible(true); }
  showRelic(def: RelicDef): void { this.openCharacter(def); }
  /** target을 함께 넘긴 전투 정보창은 방어력/저항력을 적용한 비치명타 예상값을 표시한다. */
  showUnit(unit: BattleUnit, isFront: boolean, target?: BattleUnit): void {
    // 저장 상한과 현재 궁극기의 소비 비용을 함께 적어 두 수치의 의미를 혼동하지 않게 한다.
    this.openCharacter(unit.def, `HP ${unit.hp.toLocaleString()} / ${unit.maxHp.toLocaleString()}  ·  게이지 ${unit.energy}/${ULTIMATE_ENERGY_MAX} (비용 ${unit.def.ultimate.cost})\n${isFront ? "전방 · 선봉" : "후방"}`, unit, target);
  }


  /** 팀 요약은 별도 팝업 없이 첫 유닛의 공용 캐릭터 상세로 진입한다. */
  showEnemyTeam(units: BattleUnit[], order: number[]): void {
    const front = units[order[0]];
    if (front) this.showUnit(front, true);
  }
}
