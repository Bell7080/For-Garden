import Phaser from "phaser";
import type { PuppetCreature } from "../puppets/assets";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import type { BattleUnit } from "../core/battle";
import type { RelicDef, Skill } from "../core/types";
import { setDebugInfoOpen } from "../debug";
import { getHeartGem } from "../data/heartGems";
import { relicProgression } from "../managers/RelicProgressionManager";
import { enableHitOnClick, portraitAssetFor, portraitUsesRelicTint, spawnPuppet, tintPuppet } from "../puppets/assets";
import { mixWhite, tintFor } from "../puppets/tints";
import { addSceneBackground, BACKGROUND } from "./backgrounds";
import { StatRadar } from "./StatRadar";
import { COLOR, textStyle } from "./theme";

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
  private readonly detailMeta: Phaser.GameObjects.Text;
  private readonly detailDescription: Phaser.GameObjects.Text;
  private currentDef?: RelicDef;
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
    this.detailTitle = scene.add.text(28, 82, "", textStyle({ size: 32, color: COLOR.accentText, wrap: 350 })).setOrigin(0);
    this.detailMeta = scene.add.text(28, 172, "", textStyle({ size: 21, lineSpacing: 12 })).setOrigin(0);
    this.detailDescription = scene.add.text(28, 292, "", textStyle({ size: 22, wrap: 350, lineSpacing: 9 })).setOrigin(0);
    const back = scene.add.rectangle(207, 555, 358, 88, COLOR.void, 0.7).setInteractive({ useHandCursor: true });
    back.on("pointerup", () => this.closeSkillDetail());
    this.skillDetail.add([this.detailTitle, this.detailMeta, this.detailDescription, back,
      scene.add.text(207, 555, "‹ 캐릭터 상세로", textStyle({ size: 22, color: COLOR.accentText })).setOrigin(0.5)]);
    this.chrome.add(this.skillDetail);
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
  private openCharacter(def: RelicDef, live?: string): void {
    this.currentDef = def;
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
      ["패시브", "◇", def.passive.name, () => this.openSkill("패시브", def.passive.name, def.passive.desc)],
      ["일반 공격", "⚔", def.basic.name, () => this.openSkill("일반 공격", def.basic.name, def.basic.desc, def.basic)],
      ["궁극기", "✦", def.ultimate.name, () => this.openSkill("궁극기", def.ultimate.name, def.ultimate.desc, def.ultimate, def.ultimate.cost)],
    ] as const;
    entries.forEach(([kind, icon, name, handler], index) => {
      const y = 78 + index * 116;
      const hit = this.scene.add.rectangle(58, y + 44, 104, 96, index === 2 ? COLOR.energy : COLOR.void, 0.72).setInteractive({ useHandCursor: true });
      hit.on("pointerup", handler);
      this.skills.add([hit, this.scene.add.text(58, y + 44, icon, textStyle({ size: 39 })).setOrigin(0.5),
        this.scene.add.text(126, y + 9, `${kind}\n${name}`, textStyle({ size: 21, wrap: 225, lineSpacing: 5 })).setOrigin(0)]);
    });
  }

  /** 값이 없는 패시브는 피해량·게이지 행을 애초에 만들지 않는다. */
  private openSkill(kind: string, name: string, desc: string, skill?: Skill, cost?: number): void {
    const rows = [`분류  ${kind}`];
    if (skill) {
      rows.push(`피해 타입  ${skill.damageType === "physical" ? "물리" : "마법"}`);
      const base = skill.damageType === "physical" ? this.currentDef?.stats.atk : this.currentDef?.stats.ap;
      if (base !== undefined && skill.power > 0) rows.push(`예상 피해량  ${Math.round(base * skill.power / 100).toLocaleString()}`);
    }
    if (cost !== undefined) rows.push(`필요 게이지  ${cost}`);
    this.detailTitle.setText(`◆  ${name}`); this.detailMeta.setText(rows.join("\n")); this.detailDescription.setText(desc);
    this.skills.setVisible(false); this.skillDetail.setVisible(true);
  }

  private closeSkillDetail(): void { this.skillDetail.setVisible(false); if (this.root.visible) this.skills.setVisible(true); }
  showRelic(def: RelicDef): void { this.openCharacter(def); }
  showUnit(unit: BattleUnit, isFront: boolean): void { this.openCharacter(unit.def, `HP ${unit.hp.toLocaleString()} / ${unit.maxHp.toLocaleString()}  ·  게이지 ${unit.energy}/${unit.def.ultimate.cost}\n${isFront ? "전방 · 선봉" : "후방"}`); }

  /** 기존 보조 계약은 내부 스킬 카드로 연결한다. */
  showSkill(kind: string, name: string, desc: string, extra?: string): void {
    if (!this.root.visible) return;
    this.openSkill(kind, name, extra ? `${desc}\n\n${extra}` : desc);
  }

  /** 팀 요약은 별도 팝업 없이 첫 유닛의 공용 캐릭터 상세로 진입한다. */
  showEnemyTeam(units: BattleUnit[], order: number[]): void {
    const front = units[order[0]];
    if (front) this.showUnit(front, true);
  }
}
