import Phaser from "phaser";
import type { PuppetCreature } from "../puppets/assets";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { previewSkillDamage, ULTIMATE_ENERGY_MAX, type BattleUnit } from "../core/battle";
import type { EffectType, RelicDef, Skill, SkillIconAssetId } from "../core/types";
import { setDebugInfoOpen } from "../debug";
import { getHeartGem } from "../data/heartGems";
import { relicProgression } from "../managers/RelicProgressionManager";
import {
  battleAssetFor,
  enableHitOnClick,
  portraitAssetFor,
  portraitUsesRelicTint,
  spawnPuppet,
  tintPuppet,
} from "../puppets/assets";
import { mixWhite, tintFor } from "../puppets/tints";
import { addSceneBackground, BACKGROUND } from "./backgrounds";
import { StatRadar } from "./StatRadar";
import { addBackButton, IconButton } from "./IconButton";
import { chipPoints, drawHairline, drawLayer, HOLO } from "./holo";
import { drawGlyph } from "./glyphs";
import { relicCollection } from "../managers/RelicCollectionManager";
import { COLOR, textStyle } from "./theme";
import { UI_ICON } from "./icons";
import { FALLBACK_SKILL_ICON } from "./skillIcons";
import { Button } from "./Button";
import { gameApi } from "../api/FakeServer";
import { canLevelUpRelic, RELIC_LEVEL_CAP, relicLevelUpCost } from "../core/relicProgression";
import { session } from "../state/session";
import { BOND_FEROCITY_MULTIPLIER, BOND_LEVEL_CAP, BOND_TOTAL_XP_BY_LEVEL } from "../core/bond";
import { getRelicCatalogDisclosure } from "../core/relicCatalog";

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

/**
 * 전신 원화의 코어(`중심1`) 관절이 놓이는 자리와 확대 높이.
 *
 * 상자에 맞춰 축소하면 얼굴이 작아지므로, 로비와 같은 방식으로 코어를 기준 삼아 크게 키우고
 * 정수리와 다리 끝은 화면 밖으로 흘려보낸다. 오른쪽 정보 섬들은 반투명이라 원화 위에 겹쳐도
 * 글자가 읽히고, 인물이 화면 전체를 채우는 느낌만 남는다.
 */
const PORTRAIT_FOCUS = { x: 400, y: 1060, height: 1800 } as const;

/** 정보창 구석에 세우는 SD 피규어. 받침 위에서 idle만 재생한다. */
const FIGURE = { x: 790, y: 1806, height: 290 } as const;
export const ROLE_LABEL: Record<string, string> = { attacker: "공격", tank: "방어", support: "지원" };

/** `?` 도움말 배지의 클릭이 아래 카드 입력으로 전파되지 않게 한다. */
export function addHelpBadge(scene: Phaser.Scene, x: number, y: number, onClick: () => void, radius = 26): Phaser.GameObjects.Container {
  const badge = scene.add.container(x, y);
  const circle = scene.add.circle(0, 0, radius, COLOR.void).setStrokeStyle(3, COLOR.accent).setInteractive({ useHandCursor: true });
  badge.add([circle, scene.add.text(0, 0, "?", textStyle({ role: "emphasis", size: Math.round(radius * 1.3), color: COLOR.accentText })).setOrigin(0.5)]);
  circle.on("pointerdown", (_p: unknown, _x: unknown, _y: unknown, event?: Phaser.Types.Input.EventData) => { event?.stopPropagation(); onClick(); });
  return badge;
}

/**
 * 스킬 아이콘 한 칸을 카드 형태로 만든다.
 *
 * 그리드 캐릭터 카드와 같은 규격 — 흰 바탕 · 복제 그림자 · 얇은 테두리 — 을 써서
 * 화면이 달라도 "누를 수 있는 카드"의 생김새가 하나로 읽히게 한다.
 */
function iconCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  size: number,
  texture: string,
  accent: boolean,
): { objects: Phaser.GameObjects.GameObject[]; icon: Phaser.GameObjects.Image } {
  const iconSize = Math.round(size * 0.66);
  const shadow = scene.add.image(x + 5, y + 6, texture).setDisplaySize(iconSize, iconSize).setTint(0x000000).setAlpha(0.35);
  const icon = scene.add.image(x, y, texture).setDisplaySize(iconSize, iconSize);
  return {
    objects: [
      drawLayer(scene, x, y, chipPoints(size, size, {
        bevel: { topLeft: size * 0.26, topRight: 0, bottomRight: size * 0.26, bottomLeft: 0 },
      }), { fill: accent ? 0x2a2418 : 0x1a1f27, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: accent ? 0.8 : 0.3 }),
      shadow,
      icon,
    ],
    icon,
  };
}

/**
 * 정보창의 한 칸.
 *
 * 테두리 대신 모서리를 어긋나게 깎은 유리면과 제목 왼쪽의 짧은 강조 막대로만 구분한다.
 * 칸이 여럿 겹치는 화면이라 사방 외곽선을 두르면 곧바로 격자 그물처럼 보인다.
 */
function floatingLayer(scene: Phaser.Scene, x: number, y: number, width: number, height: number, title: string): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const unit = Math.min(width, height);
  const layer = drawLayer(scene, width / 2, height / 2, chipPoints(width, height, {
    bevel: { topLeft: unit * 0.14, topRight: 0, bottomRight: unit * 0.2, bottomLeft: 0 },
  }), { fill: 0x141920, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.35 });
  container.add(layer);
  container.add(scene.add.rectangle(0, 6, 6, 34, COLOR.accent, 0.9).setOrigin(0));
  container.add(scene.add.text(24, 10, title, textStyle({ role: "emphasis", size: 20, color: COLOR.accentText })).setOrigin(0));
  return container;
}

/** 꺼져 있는 뱃지의 선 색. 글자용 문자열 색과 달리 도형은 숫자 색이 필요하다. */
const BADGE_OFF = 0x8b8f96;

/** 왼쪽 위 상태 뱃지 한 칸. 켜짐 여부는 세션이 쥐고 있고 여기서는 그리기만 한다. */
interface BadgeToggle {
  container: Phaser.GameObjects.Container;
  glyph: Phaser.GameObjects.Graphics;
  glyphName: "bookmark" | "heart";
  size: number;
  isOn: (relicId: string) => boolean;
}

/** Phaser 컨테이너 단위로 헤더·능력치·성장·보석·스킬을 조립하는 공용 정보 화면이다. */
export class InfoManager {
  private readonly root: Phaser.GameObjects.Container;
  private readonly chrome: Phaser.GameObjects.Container;
  private readonly header: Phaser.GameObjects.Container;
  private readonly archive: Phaser.GameObjects.Container;
  private readonly stats: Phaser.GameObjects.Container;
  private readonly growth: Phaser.GameObjects.Container;
  private readonly gems: Phaser.GameObjects.Container;
  private readonly skills: Phaser.GameObjects.Container;
  private readonly skillDetail: Phaser.GameObjects.Container;
  private readonly headerText: Phaser.GameObjects.Text;
  private readonly archiveText: Phaser.GameObjects.Text;
  private readonly dnaText: Phaser.GameObjects.Text;
  private readonly levelText: Phaser.GameObjects.Text;
  private readonly levelButton: Button;
  private readonly statsText: Phaser.GameObjects.Text;
  private readonly radar: StatRadar;
  private readonly gemLabels: Phaser.GameObjects.Text[] = [];
  private readonly detailTitle: Phaser.GameObjects.Text;
  private readonly detailIcon: Phaser.GameObjects.Image;
  private readonly detailMeta: Phaser.GameObjects.Text;
  private readonly detailDescription: Phaser.GameObjects.Text;
  private readonly badges: BadgeToggle[] = [];
  /** 지금 열려 있는 렐릭을 실제로 보유했는지. 미발굴이면 뱃지를 누를 수 없다. */
  private ownedNow = true;
  private currentDef?: RelicDef;
  /** 전투에서 연 정보창일 때 실제 공격자와 피해 대상을 보존한다. */
  private currentUnit?: BattleUnit;
  private previewTarget?: BattleUnit;
  private portrait?: PuppetCreature;
  private portraitWanted = false;
  private portraitRequest = 0;
  private figure?: PuppetCreature;
  private figureRequest = 0;

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
    // 왼쪽은 뱃지 두 칸이 쓰므로 글자는 그만큼 밀어 시작한다.
    this.headerText = scene.add.text(190, 46, "", textStyle({ role: "display", size: 38, wrap: 680, lineSpacing: 5 })).setOrigin(0);
    this.header.add(this.headerText);
    this.chrome.add(this.header);
    this.buildBadges(scene);
    // 닫기는 다른 화면의 뒤로가기와 같은 버튼·같은 자리를 쓴다.
    this.chrome.add(addBackButton(scene, () => this.hide()));

    // 도감 정적 기록은 성장·전투 수치와 분리해 왼쪽 반투명 패널에 고정한다.
    this.archive = floatingLayer(scene, 58, 300, 560, 470, "기록 / ARCHIVE RECORD");
    this.archiveText = scene.add.text(28, 62, "", textStyle({ role: "body", size: 21, wrap: 500, lineSpacing: 9 })).setOrigin(0);
    this.archive.add(this.archiveText);
    this.chrome.add(this.archive);

    this.stats = floatingLayer(scene, 664, 300, 370, 590, "능력치 / STATUS");
    this.radar = new StatRadar(scene, 185, 205, 105);
    this.statsText = scene.add.text(28, 350, "", textStyle({ role: "body", size: 22, lineSpacing: 9 })).setOrigin(0);
    this.stats.add([this.radar, this.statsText]);
    this.chrome.add(this.stats);

    this.growth = floatingLayer(scene, 58, 1420, 560, 255, "성장 / LEVEL & DNA");
    this.levelText = scene.add.text(28, 58, "", textStyle({ role: "body", size: 22, color: COLOR.ink, lineSpacing: 7 })).setOrigin(0);
    this.dnaText = scene.add.text(28, 142, "", textStyle({ role: "emphasis", size: 20, color: COLOR.accentText, lineSpacing: 5 })).setOrigin(0);
    // 기존 IconButton의 황동 테두리·pointerup 입력을 재사용해 상세 화면의 시각 언어를 유지한다.
    this.levelButton = new Button(scene, 455, 108, { width: 160, height: 76, label: "레벨업", fontSize: 22, onClick: () => this.requestLevelUp() });
    this.growth.add([this.levelText, this.dnaText, this.levelButton]);
    this.chrome.add(this.growth);

    this.gems = floatingLayer(scene, 58, 1692, 560, 174, "HEART GEM");
    for (let index = 0; index < 3; index += 1) this.addGemSlot(index);
    this.chrome.add(this.gems);

    this.skills = floatingLayer(scene, 646, 930, 388, 444, "스킬 / SKILLS");
    this.chrome.add(this.skills);
    this.skillDetail = floatingLayer(scene, 620, 905, 414, 610, "스킬 상세").setVisible(false);
    // fallback도 파일 로딩에 실패할 경우를 대비해 런타임 공용 텍스처를 마지막 안전망으로 만든다.
    this.ensureFallbackIcon();
    const detailCard = iconCard(scene, 74, 122, 108, FALLBACK_SKILL_ICON, true);
    this.skillDetail.add(detailCard.objects);
    this.detailIcon = detailCard.icon;
    this.detailTitle = scene.add.text(150, 84, "", textStyle({ role: "display", size: 32, color: COLOR.accentText, wrap: 232 })).setOrigin(0);
    this.detailMeta = scene.add.text(28, 172, "", textStyle({ role: "body", size: 21, lineSpacing: 12 })).setOrigin(0);
    this.detailDescription = scene.add.text(28, 292, "", textStyle({ role: "body", size: 22, wrap: 350, lineSpacing: 9 })).setOrigin(0);
    this.skillDetail.add([this.detailTitle, this.detailMeta, this.detailDescription,
      new IconButton(scene, 74, 545, { icon: UI_ICON.back, size: 84, label: "캐릭터 상세로", onClick: () => this.closeSkillDetail() })]);
    this.chrome.add(this.skillDetail);
    this.buildFigureStand(scene);
  }

  /**
   * 왼쪽 위 뱃지 두 개.
   *
   * 1번은 즐겨찾기(목록을 추리는 표시), 2번은 애착 렐릭(로비에 서는 한 명)이다. 성격이 다른
   * 두 상태라 한 버튼으로 합치지 않고 나란히 둔다. 애착은 한 명뿐이라 켜기만 되고, 이미
   * 애착인 렐릭을 다시 누르면 아무 일도 일어나지 않는다.
   */
  private buildBadges(scene: Phaser.Scene): void {
    const definitions = [
      { glyph: "bookmark" as const, label: "즐겨찾기", toggle: (id: string) => relicCollection.toggleBookmark(id), isOn: (id: string) => relicCollection.isBookmarked(id) },
      { glyph: "heart" as const, label: "애착", toggle: (id: string) => relicCollection.setFavorite(id), isOn: (id: string) => session.favorite === id },
    ];
    definitions.forEach((definition, index) => {
      // 헤더 칸 안쪽 왼편. 칸 사이 빈 자리에 두면 어느 칸에 속한 표시인지 흐려진다.
      const size = 68;
      const x = 108 + index * 80;
      const y = 155;
      const container = scene.add.container(x, y);
      const face = drawLayer(scene, 0, 0, chipPoints(size, size, {
        bevel: { topLeft: size * 0.3, topRight: 0, bottomRight: size * 0.3, bottomLeft: 0 },
      }), { fill: 0x1a1f27, alpha: HOLO.glass });
      const glyph = drawGlyph(scene, definition.glyph, 0, 0, size * 0.5, BADGE_OFF);
      container.add([face, glyph]);
      const hit = scene.add.rectangle(0, 0, size, size, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => container.setScale(1.12));
      hit.on("pointerout", () => container.setScale(1));
      hit.on("pointerup", () => {
        container.setScale(1);
        if (!this.currentDef || !this.ownedNow) return;
        definition.toggle(this.currentDef.id);
        this.refreshBadges();
      });
      container.add(hit);
      this.chrome.add(container);
      this.badges.push({ container, glyph, glyphName: definition.glyph, size, isOn: definition.isOn });
    });
  }

  /** 뱃지의 켜짐/꺼짐을 지금 열려 있는 렐릭 기준으로 다시 칠한다. */
  private refreshBadges(): void {
    for (const badge of this.badges) {
      const on = this.currentDef !== undefined && this.ownedNow && badge.isOn(this.currentDef.id);
      badge.glyph.destroy();
      badge.container.setAlpha(this.ownedNow ? 1 : 0.35);
      const glyph = drawGlyph(this.scene, badge.glyphName, 0, 0, badge.size * 0.5, on ? COLOR.accent : BADGE_OFF);
      badge.container.addAt(glyph, 1);
      badge.glyph = glyph;
    }
  }

  /** SD 피규어가 공중에 뜨지 않도록 받침과 그림자를 함께 깔아 둔다. */
  private buildFigureStand(scene: Phaser.Scene): void {
    this.root.add(scene.add.ellipse(FIGURE.x, FIGURE.y + 6, 236, 62, COLOR.void, 0.55));
    this.root.add(scene.add.ellipse(FIGURE.x, FIGURE.y, 220, 54, 0x141920, 0.92));
    this.root.add(drawHairline(scene, FIGURE.x, FIGURE.y - 22, 200, { color: COLOR.accent, alpha: 0.45 }));
    this.chrome.add(
      scene.add.text(FIGURE.x, FIGURE.y + 40, "IN-GAME SD", textStyle({ role: "body", size: 18, color: COLOR.inkDim })).setOrigin(0.5, 0),
    );
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

  /**
   * 닫힐 때 부르는 콜백.
   *
   * 정보창 안에서 애착·즐겨찾기가 바뀔 수 있으므로, 목록 화면이 다시 그릴 기회를 준다.
   */
  onClose?: () => void;

  /** 상세 카드가 열려 있어도 X만 전체 정보창을 닫는다. */
  hide(): void {
    this.root.setVisible(false); this.chrome.setVisible(false); this.portraitWanted = false;
    this.portrait?.setVisible(false); this.figure?.setVisible(false);
    this.closeSkillDetail(); setDebugInfoOpen(false);
    this.onClose?.();
  }

  /** 하트 실루엣과 텍스트를 함께 써 빈 슬롯과 장착 슬롯을 색·문자로 중복 구분한다. */
  private addGemSlot(index: number): void {
    const x = 100 + index * 170;
    const heart = this.scene.add.graphics().setPosition(x, 92);
    heart.fillStyle(COLOR.panelEdge, 0.85).fillCircle(-21, -10, 29).fillCircle(21, -10, 29)
      .fillTriangle(-49, 0, 49, 0, 0, 62);
    const label = this.scene.add.text(x, 105, "빈 슬롯", textStyle({ role: "body", size: 15, align: "center", wrap: 130 })).setOrigin(0.5, 0);
    this.gemLabels.push(label); this.gems.add([heart, label]);
  }

  private async loadPortrait(def: RelicDef): Promise<void> {
    const request = ++this.portraitRequest;
    const asset = portraitAssetFor(def.portraitAssetId);
    const portrait = await spawnPuppet(this.scene, asset, {
      focus: { anchor: "core", x: PORTRAIT_FOCUS.x, y: PORTRAIT_FOCUS.y },
      height: PORTRAIT_FOCUS.height,
      depth: Math.max(this.portraitDepth, 1001),
    });
    if (request !== this.portraitRequest) { portrait.destroy(); return; }
    this.portrait?.destroy(); this.portrait = portrait; enableHitOnClick(this.scene, portrait);
    if (portraitUsesRelicTint(def.portraitAssetId)) tintPuppet(portrait, mixWhite(tintFor(def.id), 0.55));
    portrait.setVisible(this.portraitWanted && this.root.visible);
  }

  /**
   * 전투용 SD를 정보창 구석에 피규어처럼 세운다.
   *
   * 전신 원화만 있으면 인게임에서 어떤 모습으로 움직이는지 알 수 없어서, 같은 캐릭터의
   * 전투 묶음을 작게 세워 idle만 돌린다. 전용 SD가 없는 캐릭터는 공용 개체 아트를 쓴다.
   */
  private async loadFigure(def: RelicDef): Promise<void> {
    const request = ++this.figureRequest;
    const figure = await spawnPuppet(this.scene, battleAssetFor(def.id), {
      x: FIGURE.x,
      groundY: FIGURE.y,
      height: FIGURE.height,
      depth: Math.max(this.portraitDepth, 1001),
    });
    if (request !== this.figureRequest) { figure.destroy(); return; }
    this.figure?.destroy(); this.figure = figure;
    figure.setVisible(this.portraitWanted && this.root.visible);
  }

  /** 공용 진입점의 캐릭터 화면을 성장 데이터와 함께 채운다. */
  private openCharacter(def: RelicDef, live?: string, unit?: BattleUnit, target?: BattleUnit, owned = true): void {
    this.currentDef = def;
    // 도감 진입 시 이전 전투 대상을 지워 잘못된 확정 피해를 노출하지 않는다.
    this.currentUnit = unit;
    this.previewTarget = target;
    const progress = relicProgression.getProgress(def.id);
    const finalStats = relicProgression.getFinalStats(def.id);
    this.headerText.setText(owned
      ? `NO.${def.specimenNumber}  ${def.rarity}  ${def.name}\nPROJECT ${def.projectName}  |  ${def.origin} · ${ROLE_LABEL[def.role]}`
      : `NO.${def.specimenNumber}  미발굴 개체\nSILHOUETTE RECORD`);
    const disclosure = getRelicCatalogDisclosure(def, owned);
    this.archiveText.setText(disclosure.access === "full"
      ? `프로젝트 네임  ${disclosure.projectName}\n기원  ${disclosure.origin}\n발굴지  ${disclosure.excavationSite}\n\n기록\n${disclosure.record}`
      : `제한 실루엣 정보\n${disclosure.catalogSummary}\n\n상세 기록은 개체 획득 후 해제됩니다.`);
    const maxed = progress.level >= RELIC_LEVEL_CAP;
    const cost = maxed ? 0 : relicLevelUpCost(progress.level);
    // 다음 레벨은 모든 기본 능력치가 누적 +2%p라는 코어 성장 규칙을 사람이 읽는 상승치로 표시한다.
    this.levelText.setText(`현재 LV.${progress.level} / ${RELIC_LEVEL_CAP}\n다음 레벨  모든 능력치 +2%p\n비용  ${maxed ? "MAX" : `잡초 ${cost}`}  · 보유 ${session.wallet.weeds}`);
    this.levelButton.setVisible(owned && !unit).setEnabled(owned && !unit && canLevelUpRelic(progress, session.wallet.weeds));
    const bondMaxed = progress.bondLevel >= BOND_LEVEL_CAP;
    const nextBondXp = BOND_TOTAL_XP_BY_LEVEL[Math.min(BOND_LEVEL_CAP, progress.bondLevel + 1)];
    const ferocityReduction = Math.round((1 - BOND_FEROCITY_MULTIPLIER[progress.bondLevel]) * 100);
    // 애착은 로비 대표 선택, 유대는 개별 누적 관계이므로 상세에서는 유대 효과만 표시한다.
    this.dnaText.setText(`${"★".repeat(progress.dnaMastery)}${"☆".repeat(5 - progress.dnaMastery)}  ${live ?? "DNA 복원 동기화"}\n유대 LV.${progress.bondLevel}/${BOND_LEVEL_CAP}  ${bondMaxed ? "MAX" : `${progress.bondXp}/${nextBondXp} EXP`}  · 야성 증가 -${ferocityReduction}%`);
    this.radar.draw(finalStats);
    // 과거 "야성"으로 불리던 정적 수치는 실제 의미에 맞춰 궁극기 충전량으로 명시한다.
    this.statsText.setText(`체력  ${finalStats.hp.toLocaleString()}\n방어력  ${finalStats.def.toLocaleString()}    저항력  ${finalStats.res.toLocaleString()}\n공격력  ${finalStats.atk.toLocaleString()}    주문력  ${finalStats.ap.toLocaleString()}\n궁극기 충전량  ${finalStats.energyGain}`);
    progress.heartGemSlots.forEach((id, index) => this.gemLabels[index].setText(id ? getHeartGem(id).name.replace(" Heart Gem", "") : "빈 슬롯").setColor(id ? COLOR.accentText : COLOR.inkDim));
    this.buildSkillButtons(def);
    this.skillDetail.setVisible(false); this.skills.setVisible(true);
    // 미보유 개체는 원화·수치·스킬을 노출하지 않고 번호와 실루엣 요약만 남긴다.
    this.stats.setVisible(owned); this.growth.setVisible(owned); this.gems.setVisible(owned); this.skills.setVisible(owned);
    this.ownedNow = owned;
    this.refreshBadges();
    this.portraitWanted = owned;
    this.portrait?.setVisible(false); this.figure?.setVisible(false);
    if (owned) { void this.loadPortrait(def); void this.loadFigure(def); }
    this.root.setVisible(true); this.chrome.setVisible(true); setDebugInfoOpen(true);
  }

  /** 버튼은 API에 요청만 보내며 응답 뒤 같은 공용 상세를 다시 채워 직접 진행 상태를 바꾸지 않는다. */
  private requestLevelUp(): void {
    const def = this.currentDef;
    if (!def || this.currentUnit) return;
    this.levelButton.setEnabled(false);
    void gameApi.levelUpRelic(def.id).then(() => this.openCharacter(def)).catch(() => this.openCharacter(def));
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
      const card = iconCard(this.scene, 60, y + 44, 100, this.resolveIcon(iconAssetId), index === 2);
      // 카드 전체가 터치 영역이다. 아이콘 위에 투명 판을 덮어 88×88 이상을 유지한다.
      const hit = this.scene.add.rectangle(60, y + 44, 104, 104, COLOR.void, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerup", handler);
      this.skills.add([...card.objects, hit,
        this.scene.add.text(126, y + 9, `${kind}\n${name}`, textStyle({ role: "body", size: 21, wrap: 225, lineSpacing: 5 })).setOrigin(0)]);
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
      energy: 0, ferocity: 0, bondLevel: 0, stunTurns: 0, justSwapped: false,
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
  /** 도감은 보유 여부를 전달해 정적 기록과 성장 정보의 잠금을 한곳에서 적용한다. */
  showRelic(def: RelicDef, owned = true): void { this.openCharacter(def, undefined, undefined, undefined, owned); }
  /** target을 함께 넘긴 전투 정보창은 방어력/저항력을 적용한 비치명타 예상값을 표시한다. */
  showUnit(unit: BattleUnit, isFront: boolean, target?: BattleUnit): void {
    // 저장 상한과 현재 궁극기의 소비 비용을 함께 적어 두 수치의 의미를 혼동하지 않게 한다.
    this.openCharacter(unit.def, `HP ${unit.hp.toLocaleString()} / ${unit.maxHp.toLocaleString()}  ·  궁극기 ${unit.energy}/${ULTIMATE_ENERGY_MAX} (비용 ${unit.def.ultimate.cost})  ·  야성 ${unit.ferocity}/100\n${isFront ? "전방 · 선봉" : "후방"}`, unit, target);
  }


  /** 팀 요약은 별도 팝업 없이 첫 유닛의 공용 캐릭터 상세로 진입한다. */
  showEnemyTeam(units: BattleUnit[], order: number[]): void {
    const front = units[order[0]];
    if (front) this.showUnit(front, true);
  }
}
