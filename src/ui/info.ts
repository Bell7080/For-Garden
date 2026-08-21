import Phaser from "phaser";
import type { PuppetCreature } from "../puppets/assets";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { previewSkillDamage, ULTIMATE_ENERGY_MAX, type BattleUnit } from "../core/battle";
import type { RelicDef, Skill, SkillIconAssetId, Stats } from "../core/types";
import { setDebugInfoOpen } from "../debug";
import { getHeartGem, HEART_GEMS } from "../data/heartGems";
import { KeywordManager } from "../managers/KeywordManager";
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
import { addBackButton } from "./IconButton";
import { chipPoints, drawGlassFade, drawHairline, drawLayer, drawShapeEdge, drawVignette, HOLO, perspectiveRect, slantedRect, toPoints } from "./holo";
import { drawGlyph } from "./glyphs";
import { PopupLayer } from "./PopupLayer";
import { openSkillPopup, type SkillInfoViewModel } from "./SkillPopup";
import { relicCollection } from "../managers/RelicCollectionManager";
import { COLOR, textStyle } from "./theme";
import { FALLBACK_SKILL_ICON } from "./skillIcons";
import { gameApi } from "../api/FakeServer";
import { AWAKENING_CAP, canFeedRelic, FEED_UNIT, RELIC_LEVEL_CAP, relicExpToNext } from "../core/relicProgression";
import { session } from "../state/session";
import { BOND_FEROCITY_MULTIPLIER, BOND_LEVEL_CAP, BOND_TOTAL_XP_BY_LEVEL } from "../core/bond";
import { getRelicCatalogDisclosure } from "../core/relicCatalog";

export type { SkillInfoViewModel } from "./SkillPopup";

export const ROLE_LABEL: Record<string, string> = { attacker: "공격", tank: "방어", support: "지원" };

/** 전신 원화의 코어(`중심1`) 관절이 놓이는 자리와 확대 높이. 정보창의 주인공은 캐릭터다. */
const PORTRAIT_FOCUS = { x: 420, y: 1040, height: 1820 } as const;

/** 정보창 구석에 세우는 SD 피규어. 받침 위에서 idle만 재생한다. */
const FIGURE = { x: 806, y: 1786, height: 240 } as const;

/** 오른쪽 정보 기둥. 캐릭터를 덮지 않도록 화면 오른쪽 절반만 쓴다. */
const COLUMN = { x: 818, width: 476 } as const;

/** 판 하나하나가 같은 각도로 기울어 한 벌로 읽힌다. */
const PANEL_TILT = -1.6;

/** 꺼진 뱃지·빈 별의 선 색. 글자용 문자열 색과 달리 도형은 숫자 색이 필요하다. */
const BADGE_OFF = 0x8b8f96;
/** 즐겨찾기는 노랑, 애착은 분홍. 색만으로도 둘이 갈린다. */
const BOOKMARK_ON = 0xf2c744;
const FAVORITE_ON = 0xf2789f;
/** 유대 하트와 급여 버튼의 색. */
const BOND_HEART = 0xf2789f;
const FEED_GREEN = 0x7fc47f;
/** 낀 젬 조각이 내는 빛. */
const GEM_GLOW = 0xf2789f;
const GEM_FILL = 0xc95f8a;
const GEM_EDGE = 0xffc2d8;

/** 능력치 칩에서 쓰는 다섯 축과 색. */
const STAT_CHIPS: readonly { key: keyof Stats; label: string; color: number }[] = [
  { key: "hp", label: "체력", color: 0x6fc47f },
  { key: "atk", label: "공격", color: 0xe07a5f },
  { key: "def", label: "방어", color: 0x6f9bd8 },
  { key: "res", label: "저항", color: 0xb08ad8 },
  { key: "ap", label: "주문", color: 0x59c2c9 },
];

/** 돋보기로만 여는 보조 능력치. 평소에는 다섯 축만 보여 화면을 비운다. */
const EXTRA_STATS: readonly { key: keyof Stats; label: string; suffix?: string }[] = [
  { key: "attackSpeed", label: "공격 속도" },
  { key: "moveSpeed", label: "이동 속도" },
  { key: "critChance", label: "치명타 확률", suffix: "%" },
  { key: "critDamage", label: "치명타 피해", suffix: "%" },
  { key: "energyGain", label: "궁극기 충전량" },
];

const STAT_LABEL: Record<string, string> = {
  hp: "체력", def: "방어력", res: "저항력", atk: "공격력", ap: "주문력",
  attackSpeed: "공격 속도", moveSpeed: "이동 속도", critChance: "치명타 확률", critDamage: "치명타 피해", energyGain: "충전량",
};

/** 뱃지 하나를 다시 칠하는 손잡이. */
interface BadgeHandle {
  paint(on: boolean, enabled: boolean): void;
}

/** 젬 조각 하나를 다시 칠하는 손잡이. */
interface GemSlot {
  paint(gemId: string | null): void;
}

/** `?` 도움말 배지의 클릭이 아래 카드 입력으로 전파되지 않게 한다. */
export function addHelpBadge(scene: Phaser.Scene, x: number, y: number, onClick: () => void, radius = 26): Phaser.GameObjects.Container {
  const badge = scene.add.container(x, y);
  const circle = scene.add.circle(0, 0, radius, COLOR.void).setStrokeStyle(3, COLOR.accent).setInteractive({ useHandCursor: true });
  badge.add([circle, scene.add.text(0, 0, "?", textStyle({ role: "emphasis", size: Math.round(radius * 1.3), color: COLOR.accentText })).setOrigin(0.5)]);
  circle.on("pointerdown", (_p: unknown, _x: unknown, _y: unknown, event?: Phaser.Types.Input.EventData) => { event?.stopPropagation(); onClick(); });
  return badge;
}

/**
 * 캐릭터 정보창.
 *
 * 왼쪽은 캐릭터(원화·이름·스킬·SD), 오른쪽은 수치(성급·레벨·유대·능력치·젬)다. 오른쪽 판은
 * 전부 같은 각도로 기울어 있고 반투명이라 인물을 덮지 않는다. 더 자세한 것은 모두 팝업으로
 * 열린다 — 화면에 늘 떠 있는 정보는 "지금 얼마나 컸는가"까지다.
 */
export class InfoManager {
  private readonly root: Phaser.GameObjects.Container;
  private readonly chrome: Phaser.GameObjects.Container;
  private readonly popups: PopupLayer;
  private readonly keywords: KeywordManager;

  private readonly rarityText: Phaser.GameObjects.Text;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly roleText: Phaser.GameObjects.Text;
  private readonly bookmarkBadge: BadgeHandle;
  private readonly favoriteBadge: BadgeHandle;

  private readonly starRow: Phaser.GameObjects.Container;
  private readonly levelValue: Phaser.GameObjects.Text;
  private readonly levelCap: Phaser.GameObjects.Text;
  private readonly expBar: Gauge;
  private readonly expLabel: Phaser.GameObjects.Text;
  private readonly feedButton: Phaser.GameObjects.Container;
  private readonly feedLabel: Phaser.GameObjects.Text;

  private readonly bondValue: Phaser.GameObjects.Text;
  private readonly bondBar: Gauge;
  private readonly bondLabel: Phaser.GameObjects.Text;

  private readonly statValues: Phaser.GameObjects.Text[] = [];
  private readonly statGains: Phaser.GameObjects.Text[] = [];
  private readonly gemSlots: GemSlot[] = [];
  private readonly skillIcons: Phaser.GameObjects.Container[] = [];

  private currentDef?: RelicDef;
  private ownedNow = true;
  /** 전투에서 연 정보창일 때 실제 공격자와 피해 대상을 보존한다. */
  private currentUnit?: BattleUnit;
  private previewTarget?: BattleUnit;
  private liveLine?: Phaser.GameObjects.Text;
  private portrait?: PuppetCreature;
  private portraitWanted = false;
  private portraitRequest = 0;
  private figure?: PuppetCreature;
  private figureRequest = 0;
  private feedHold?: Phaser.Time.TimerEvent;
  private feeding = false;

  /** 정보창이 닫힐 때 목록 화면이 카드 표시를 다시 맞출 수 있게 알린다. */
  onClose?: () => void;

  constructor(private readonly scene: Phaser.Scene, private readonly portraitDepth = 1001) {
    this.root = scene.add.container(0, 0).setDepth(1000).setVisible(false);
    this.chrome = scene.add.container(0, 0).setDepth(1002).setVisible(false);
    this.popups = new PopupLayer(scene, 2000);
    this.keywords = new KeywordManager(scene, this.popups);

    this.root.add(addSceneBackground(scene, BACKGROUND.info, 0));
    this.root.add(scene.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.52).setInteractive());
    this.root.add(drawVignette(scene, BASE_WIDTH, BASE_HEIGHT, { depth: 0, strength: 0.6 }));

    // 이름줄은 판때기가 아니라 위에서 내려오는 어둠이다. 배경 원화를 자르지 않는다.
    this.chrome.add(drawGlassFade(scene, BASE_WIDTH / 2, 150, BASE_WIDTH, 420, { topAlpha: 0.92, bottomAlpha: 0 }));
    this.rarityText = scene.add.text(46, 56, "", textStyle({ role: "display", size: 44, color: COLOR.accentText })).setOrigin(0, 0);
    this.nameText = scene.add.text(46, 104, "", textStyle({ role: "display", size: 84 })).setOrigin(0, 0);
    this.roleText = scene.add.text(50, 206, "", textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(0, 0);
    this.chrome.add([this.rarityText, this.nameText, this.roleText]);

    this.bookmarkBadge = this.addBadge(84, 300, "bookmark", BOOKMARK_ON, () => this.toggleBookmark());
    this.favoriteBadge = this.addBadge(176, 300, "heart", FAVORITE_ON, () => this.toggleFavorite());
    this.addJournalButton(268, 300);

    this.starRow = scene.add.container(COLUMN.x, 196);
    this.chrome.add(this.starRow);
    this.addMagnifier(COLUMN.x + COLUMN.width / 2 - 40, 196, () => this.openAwakening());

    // 레벨 · 경험치 · 급여.
    this.addPanel(COLUMN.x, 424, COLUMN.width, 320);
    this.chrome.add(scene.add.text(COLUMN.x - COLUMN.width / 2 + 42, 306, "LV", textStyle({ role: "display", size: 30, color: COLOR.accentText })).setOrigin(0, 0));
    this.levelValue = scene.add.text(COLUMN.x - COLUMN.width / 2 + 92, 296, "", textStyle({ role: "display", size: 96 })).setOrigin(0, 0).setScale(1, 1.16);
    this.levelCap = scene.add.text(COLUMN.x + COLUMN.width / 2 - 46, 376, "", textStyle({ role: "body", size: 26, color: COLOR.inkDim })).setOrigin(1, 0);
    this.chrome.add([this.levelValue, this.levelCap]);
    this.expBar = new Gauge(scene, COLUMN.x, 452, COLUMN.width - 88, 16, COLOR.accent);
    this.chrome.add(this.expBar.objects);
    this.expLabel = scene.add.text(COLUMN.x, 470, "", textStyle({ role: "body", size: 20, color: COLOR.inkDim })).setOrigin(0.5, 0);
    this.chrome.add(this.expLabel);
    const feed = this.addFeedButton(COLUMN.x, 540, COLUMN.width - 96, 96);
    this.feedButton = feed.container;
    this.feedLabel = feed.label;

    // 유대.
    this.addPanel(COLUMN.x, 700, COLUMN.width, 150);
    const bondHeart = scene.add.container(COLUMN.x - COLUMN.width / 2 + 78, 700);
    bondHeart.add(drawGlyph(scene, "heart", 0, 0, 92, BOND_HEART));
    this.bondValue = scene.add.text(0, 4, "", textStyle({ role: "display", size: 34 })).setOrigin(0.5);
    bondHeart.add(this.bondValue);
    this.chrome.add(bondHeart);
    this.chrome.add(scene.add.text(COLUMN.x - COLUMN.width / 2 + 146, 652, "유대", textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0, 0));
    this.bondBar = new Gauge(scene, COLUMN.x + 52, 712, COLUMN.width - 216, 14, BOND_HEART);
    this.chrome.add(this.bondBar.objects);
    this.bondLabel = scene.add.text(COLUMN.x - COLUMN.width / 2 + 146, 728, "", textStyle({ role: "body", size: 20, color: COLOR.inkDim })).setOrigin(0, 0);
    this.chrome.add(this.bondLabel);

    // 능력치.
    this.addPanel(COLUMN.x, 1024, COLUMN.width, 420);
    this.chrome.add(scene.add.text(COLUMN.x - COLUMN.width / 2 + 44, 838, "능력치", textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0, 0));
    this.addMagnifier(COLUMN.x + COLUMN.width / 2 - 48, 852, () => this.openExtraStats());
    STAT_CHIPS.forEach((chip, index) => this.addStatChip(chip, index));

    // 하트 젬 — 하트 하나를 셋으로 가른 자리.
    this.addPanel(COLUMN.x, 1370, COLUMN.width, 250);
    this.chrome.add(scene.add.text(COLUMN.x - COLUMN.width / 2 + 44, 1268, "HEART GEM", textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0, 0));
    for (let index = 0; index < 3; index += 1) this.gemSlots.push(this.addGemSlot(index));

    this.buildFigureStand();
    this.addCostumeButton(FIGURE.x + 152, FIGURE.y - 206);
    this.chrome.add(addBackButton(scene, () => this.hide()));
  }

  /** 오른쪽 기둥의 판 하나. 전부 같은 각도로 기울어 한 벌로 읽힌다. */
  private addPanel(x: number, y: number, width: number, height: number): void {
    const panel = this.scene.add.container(x, y).setRotation(Phaser.Math.DegToRad(PANEL_TILT));
    const shape = perspectiveRect(width, height, { tall: "right", taper: 0.06 });
    panel.add(drawLayer(this.scene, 0, 0, shape, { fill: 0x0b0f15, alpha: 0.6, edge: COLOR.accent, edgeAlpha: 0.4 }));
    panel.add(drawShapeEdge(this.scene, 0, 0, shape, "bottom", { color: COLOR.accent, alpha: 0.22, inset: 10 }));
    this.chrome.add(panel);
  }

  /** 즐겨찾기(별)와 애착(하트). 켜짐은 저마다의 색, 꺼짐은 회색이다. */
  private addBadge(x: number, y: number, glyph: "bookmark" | "heart", onColor: number, onToggle: () => void): BadgeHandle {
    const size = 76;
    const container = this.scene.add.container(x, y);
    container.add(drawLayer(this.scene, 0, 0, chipPoints(size, size, {
      bevel: { topLeft: size * 0.3, topRight: 0, bottomRight: size * 0.3, bottomLeft: 0 },
    }), { fill: 0x121820, alpha: HOLO.glass }));
    let mark = drawGlyph(this.scene, glyph, 0, 0, size * 0.5, BADGE_OFF);
    container.add(mark);
    const hit = this.scene.add.rectangle(0, 0, size + 12, size + 12, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => container.setScale(1.12));
    hit.on("pointerout", () => container.setScale(1));
    hit.on("pointerup", () => {
      container.setScale(1);
      onToggle();
    });
    container.add(hit);
    this.chrome.add(container);
    return {
      paint: (on, enabled) => {
        mark.destroy();
        mark = drawGlyph(this.scene, glyph, 0, 0, size * 0.5, on ? onColor : BADGE_OFF);
        container.addAt(mark, 1);
        container.setAlpha(enabled ? 1 : 0.35);
        hit.setVisible(enabled);
      },
    };
  }

  /** 개체번호·프로젝트명·기원·발굴지는 한 장의 관찰 일지로 모은다. */
  private addJournalButton(x: number, y: number): void {
    const size = 76;
    const container = this.scene.add.container(x, y);
    container.add(drawLayer(this.scene, 0, 0, chipPoints(size, size, {
      bevel: { topLeft: size * 0.3, topRight: 0, bottomRight: size * 0.3, bottomLeft: 0 },
    }), { fill: 0x121820, alpha: HOLO.glass }));
    container.add(drawGlyph(this.scene, "scroll", 0, 0, size * 0.54, 0xd8c7a0));
    const hit = this.scene.add.rectangle(0, 0, size + 12, size + 12, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => container.setScale(1.12));
    hit.on("pointerout", () => container.setScale(1));
    hit.on("pointerup", () => {
      container.setScale(1);
      this.openJournal();
    });
    container.add(hit);
    this.chrome.add(container);
  }

  /** 더 볼 것이 있다는 표시. 자리만 다를 뿐 생김새와 크기는 같다. */
  private addMagnifier(x: number, y: number, onClick: () => void): void {
    const container = this.scene.add.container(x, y);
    container.add(drawGlyph(this.scene, "magnifier", 0, 0, 44, COLOR.accent));
    const hit = this.scene.add.rectangle(x, y, 84, 84, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => container.setScale(1.15));
    hit.on("pointerout", () => container.setScale(1));
    hit.on("pointerup", () => {
      container.setScale(1);
      onClick();
    });
    this.chrome.add([container, hit]);
  }

  /**
   * 급여 버튼.
   *
   * 한 번 누르면 한 번 먹이고, 꾹 누르고 있으면 계속 먹인다. 잠깐 누르고 있으면 그 위로 한 번에
   * 여러 레벨을 채우는 작은 팝업이 떠서, 레벨 하나에 수십 번 두드리지 않아도 된다.
   */
  private addFeedButton(x: number, y: number, width: number, height: number): { container: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text } {
    const container = this.scene.add.container(x, y);
    const shape = slantedRect(width, height, 16);
    container.add(drawLayer(this.scene, 0, 0, shape, { fill: 0x18261c, alpha: 0.92, edge: FEED_GREEN, edgeAlpha: 0.9, sheen: 0.06 }));
    const label = this.scene.add.text(0, -10, "급여하기", textStyle({ role: "display", size: 38 })).setOrigin(0.5);
    const hint = this.scene.add.text(0, 24, "잡초 " + FEED_UNIT.weeds + " · 꾹 누르면 계속", textStyle({ role: "body", size: 19, color: COLOR.inkDim })).setOrigin(0.5);
    container.add([label, hint]);
    const hit = this.scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => {
      container.setScale(1.04);
      void this.feed(1);
      this.feedHold = this.scene.time.addEvent({ delay: 260, loop: true, callback: () => void this.feed(1) });
      this.scene.time.delayedCall(420, () => {
        if (this.feedHold) this.openFeedBulk(x, y - height);
      });
    });
    const release = (): void => {
      container.setScale(1);
      this.feedHold?.remove();
      this.feedHold = undefined;
    };
    hit.on("pointerup", release);
    hit.on("pointerout", release);
    container.add(hit);
    this.chrome.add(container);
    return { container, label };
  }

  /** 한 번에 여러 레벨을 채우는 임시 팝업. 급여 버튼 바로 위에 뜬다. */
  private openFeedBulk(x: number, y: number): void {
    if (this.popups.isOpen) return;
    this.popups.open({ width: 420, height: 190, x, y: y - 60 }, (body, close) => {
      body.add(this.scene.add.text(0, -58, "한 번에 급여", textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0.5));
      ([["1 레벨", 1], ["10 레벨", 10]] as const).forEach(([label, levels], index) => {
        const bx = index === 0 ? -100 : 100;
        body.add(drawLayer(this.scene, bx, 18, slantedRect(170, 76, 14), { fill: 0x18261c, alpha: 0.92, edge: FEED_GREEN, edgeAlpha: 0.8 }));
        body.add(this.scene.add.text(bx, 18, label, textStyle({ role: "display", size: 28 })).setOrigin(0.5));
        const hit = this.scene.add.rectangle(bx, 18, 170, 76, 0xffffff, 0).setInteractive({ useHandCursor: true });
        hit.on("pointerup", () => {
          close();
          void this.feedLevels(levels);
        });
        body.add(hit);
      });
    });
  }

  /** 지금 레벨에서 목표 레벨까지 필요한 급여 횟수를 계산해 한 번에 요청한다. */
  private async feedLevels(levels: number): Promise<void> {
    if (!this.currentDef) return;
    const progress = relicProgression.getProgress(this.currentDef.id);
    let need = 0;
    let level = progress.level;
    let exp = progress.exp;
    for (let i = 0; i < levels && level < RELIC_LEVEL_CAP; i += 1) {
      need += Math.ceil((relicExpToNext(level) - exp) / FEED_UNIT.exp);
      level += 1;
      exp = 0;
    }
    await this.feed(Math.max(1, need));
  }

  private async feed(feeds: number): Promise<void> {
    const def = this.currentDef;
    if (!def || !this.ownedNow || this.feeding) return;
    if (!canFeedRelic(relicProgression.getProgress(def.id), session.wallet.weeds)) return;
    this.feeding = true;
    try {
      await gameApi.feedRelic(def.id, feeds);
    } catch {
      // 잡초 부족·상한은 화면에서 이미 막는다. 실패하면 상태만 다시 그린다.
    } finally {
      this.feeding = false;
      this.refreshGrowth();
    }
  }

  /** 능력치 칩 하나. 큰 수치가 먼저 읽히고 기본치·성장분은 그 아래 작게 붙는다. */
  private addStatChip(chip: { key: keyof Stats; label: string; color: number }, index: number): void {
    const x = COLUMN.x - COLUMN.width / 2 + 76 + (index % 2) * (COLUMN.width / 2 - 8);
    const y = 906 + Math.floor(index / 2) * 118;
    const size = 62;
    const container = this.scene.add.container(x - 34, y);
    container.add(drawLayer(this.scene, 0, 0, chipPoints(size, size, {
      bevel: { topLeft: size * 0.32, topRight: 0, bottomRight: size * 0.32, bottomLeft: 0 },
    }), { fill: 0x11161d, alpha: 0.92, edge: chip.color, edgeAlpha: 0.95 }));
    container.add(this.scene.add.text(0, 0, chip.label, textStyle({ role: "emphasis", size: 21 })).setOrigin(0.5));
    this.chrome.add(container);

    const value = this.scene.add.text(x + 12, y - 26, "", textStyle({ role: "display", size: 36 })).setOrigin(0, 0);
    const gain = this.scene.add.text(x + 12, y + 16, "", textStyle({ role: "body", size: 18, color: COLOR.inkDim })).setOrigin(0, 0);
    this.statValues.push(value);
    this.statGains.push(gain);
    this.chrome.add([value, gain]);
  }

  /**
   * 하트 젬 슬롯.
   *
   * 하트 세 개가 아니라 하트 **하나를 셋으로 가른** 자리다. 세 조각이 다 차야 온전한 하트가
   * 완성되므로, 빈 자리가 곧 "아직 덜 채운 마음"으로 읽힌다.
   */
  private addGemSlot(index: number): GemSlot {
    const center = { x: COLUMN.x + 30, y: 1382 };
    const size = 210;
    const piece = this.scene.add.graphics({ x: center.x, y: center.y });
    const shape = heartSlice(size, index);
    const spot = heartSliceCenter(size, index);
    this.chrome.add(piece);

    const label = this.scene.add
      .text(center.x + spot.x, center.y + spot.y, "", textStyle({ role: "body", size: 16, color: COLOR.inkDim, align: "center", wrap: 92 }))
      .setOrigin(0.5);
    this.chrome.add(label);

    const hit = this.scene.add
      .rectangle(center.x + spot.x, center.y + spot.y, size * 0.44, size * 0.44, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerup", () => this.openGemPicker(index));
    this.chrome.add(hit);

    return {
      paint: (gemId) => {
        piece.clear();
        // 낀 조각만 보석처럼 빛난다. 두 겹으로 칠해 가장자리보다 안쪽이 밝게 남는다.
        piece.fillStyle(gemId ? GEM_GLOW : 0x11161d, gemId ? 0.32 : 0.85);
        piece.fillPoints(toPoints(shape), true);
        piece.fillStyle(gemId ? GEM_FILL : 0x161c25, gemId ? 0.95 : 0.7);
        piece.fillPoints(toPoints(heartSlice(size * 0.84, index)), true);
        piece.lineStyle(2, gemId ? GEM_EDGE : 0x2a3440, 0.9);
        piece.strokePoints(toPoints(shape), true);
        label.setText(gemId ? getHeartGem(gemId).name.replace(" Heart Gem", "") : "빈 자리");
        label.setColor(gemId ? COLOR.ink : COLOR.inkDim);
      },
    };
  }

  /** 슬롯 하나에 낄 젬을 고르는 팝업. */
  private openGemPicker(index: number): void {
    const def = this.currentDef;
    if (!def || !this.ownedNow) return;
    this.popups.open({ width: 820, height: 620, title: "HEART GEM " + (index + 1) }, (body, close) => {
      const owned = HEART_GEMS.filter((gem) => session.ownedHeartGemIds.includes(gem.id));
      const rows: { id: string | null; name: string; effect: string }[] = [
        { id: null, name: "비우기", effect: "" },
        ...owned.map((gem) => ({
          id: gem.id,
          name: gem.name,
          effect: Object.entries(gem.statPercent).map(([key, percent]) => (STAT_LABEL[key] ?? key) + " +" + percent + "%").join("   "),
        })),
      ];
      rows.forEach((row, rowIndex) => {
        const y = -200 + rowIndex * 96;
        body.add(drawLayer(this.scene, 0, y, slantedRect(700, 82, 14), { fill: 0x141a22, alpha: 0.9, edge: COLOR.accent, edgeAlpha: 0.3 }));
        body.add(this.scene.add.text(-320, y - 20, row.name, textStyle({ role: "display", size: 26 })).setOrigin(0, 0));
        if (row.effect) body.add(this.scene.add.text(-320, y + 12, row.effect, textStyle({ role: "body", size: 20, color: COLOR.accentText })).setOrigin(0, 0));
        const hit = this.scene.add.rectangle(0, y, 700, 82, 0xffffff, 0).setInteractive({ useHandCursor: true });
        hit.on("pointerup", () => {
          relicProgression.equipHeartGem(def.id, index, row.id);
          close();
          this.refreshGrowth();
        });
        body.add(hit);
      });
    });
  }

  /** 개체번호·프로젝트명·기원·발굴지·기록을 한 장에 모은 관찰 일지. */
  private openJournal(): void {
    const def = this.currentDef;
    if (!def) return;
    const disclosure = getRelicCatalogDisclosure(def, this.ownedNow);
    this.popups.open({ width: 880, height: 760, title: "관찰 일지", tilt: -1.2 }, (body) => {
      const lines = disclosure.access === "full"
        ? [
            "개체번호   NO." + disclosure.specimenNumber,
            "프로젝트   " + disclosure.projectName,
            "기원         " + disclosure.origin,
            "발굴지      " + disclosure.excavationSite,
          ]
        : ["개체번호   NO." + disclosure.specimenNumber, "프로젝트   기록 없음", "기원         미상", "발굴지      미상"];
      body.add(this.scene.add.text(-380, -276, lines.join("\n"), textStyle({ role: "body", size: 26, lineSpacing: 14 })).setOrigin(0, 0));
      body.add(drawHairline(this.scene, 0, -84, 760, { color: COLOR.accent, alpha: 0.35 }));
      const record = disclosure.access === "full" ? disclosure.record : def.catalogSummary + "\n\n상세 기록은 개체 획득 후 해제됩니다.";
      const text = this.keywords.layout(record, { width: 760, size: 26, lineSpacing: 10 });
      text.setPosition(-380, -48);
      body.add(text);
    });
  }

  /** 각성 단계 테크트리. 0~5단계를 세우고 지금 어디까지 왔는지 알린다. */
  private openAwakening(): void {
    const def = this.currentDef;
    if (!def) return;
    const awakening = relicProgression.getProgress(def.id).awakening;
    this.popups.open({ width: 900, height: 640, title: "각성", tilt: -1.2 }, (body) => {
      body.add(this.scene.add.text(-390, -226, "같은 렐릭을 다시 발굴하면 한 단계씩 깨어난다.", textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(0, 0));
      for (let step = 1; step <= AWAKENING_CAP; step += 1) {
        const y = -160 + step * 84;
        const reached = step <= awakening;
        body.add(drawLayer(this.scene, 0, y, slantedRect(700, 70, 14), {
          fill: reached ? 0x2a2418 : 0x121820,
          alpha: reached ? 0.95 : 0.7,
          edge: COLOR.accent,
          edgeAlpha: reached ? 0.9 : 0.2,
        }));
        const star = this.scene.add.star(-306, y, 4, 7, 17, reached ? COLOR.accent : 0x000000, reached ? 1 : 0.4);
        if (!reached) star.setStrokeStyle(2, BADGE_OFF, 0.85);
        body.add(star);
        body.add(this.scene.add.text(-274, y, step + "단계", textStyle({ role: "display", size: 26, color: reached ? COLOR.accentText : COLOR.inkDim })).setOrigin(0, 0.5));
        body.add(this.scene.add.text(-160, y, "모든 능력치 +3%" + (step === AWAKENING_CAP ? "   ·   단계 효과 예정" : ""), textStyle({ role: "body", size: 22, color: reached ? COLOR.ink : COLOR.inkDim })).setOrigin(0, 0.5));
      }
      body.add(this.scene.add.text(0, 256, "현재 " + awakening + " / " + AWAKENING_CAP + " 단계", textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0.5));
    });
  }

  /** 공격 속도처럼 자주 보지 않는 수치는 돋보기 안에만 둔다. */
  private openExtraStats(): void {
    const def = this.currentDef;
    if (!def) return;
    const stats = relicProgression.getFinalStats(def.id);
    this.popups.open({ width: 720, height: 520, title: "추가 능력치", tilt: -1.2 }, (body) => {
      EXTRA_STATS.forEach((row, index) => {
        const y = -140 + index * 76;
        body.add(this.scene.add.text(-290, y, row.label, textStyle({ role: "body", size: 26, color: COLOR.inkDim })).setOrigin(0, 0.5));
        body.add(this.scene.add.text(290, y, stats[row.key].toLocaleString() + (row.suffix ?? ""), textStyle({ role: "display", size: 30 })).setOrigin(1, 0.5));
        body.add(drawHairline(this.scene, 0, y + 34, 580, { color: COLOR.accent, alpha: 0.15 }));
      });
    });
  }

  /** 코스튬은 아직 데이터가 없다. 자리와 여는 방법만 먼저 정해 둔다. */
  private addCostumeButton(x: number, y: number): void {
    const size = 78;
    const container = this.scene.add.container(x, y);
    container.add(drawLayer(this.scene, 0, 0, chipPoints(size, size, {
      bevel: { topLeft: size * 0.3, topRight: 0, bottomRight: size * 0.3, bottomLeft: 0 },
    }), { fill: 0x121820, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.4 }));
    container.add(drawGlyph(this.scene, "costume", 0, 0, size * 0.54, 0xd2d6dc));
    const hit = this.scene.add.rectangle(0, 0, size + 10, size + 10, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerup", () => {
      this.popups.open({ width: 720, height: 420, title: "옷장" }, (body) => {
        body.add(this.scene.add.text(0, 20, "코스튬은 준비 중이다.", textStyle({ role: "body", size: 28, color: COLOR.inkDim })).setOrigin(0.5));
      });
    });
    container.add(hit);
    this.chrome.add(container);
  }

  /** SD 피규어가 공중에 뜨지 않도록 받침을 깐다. 대사는 그 위에 뜬다. */
  private buildFigureStand(): void {
    this.chrome.add(this.scene.add.ellipse(FIGURE.x, FIGURE.y + 6, 206, 52, COLOR.void, 0.55));
    this.chrome.add(this.scene.add.ellipse(FIGURE.x, FIGURE.y, 192, 44, 0x141920, 0.92));
    this.chrome.add(drawHairline(this.scene, FIGURE.x, FIGURE.y - 20, 172, { color: COLOR.accent, alpha: 0.4 }));
    this.chrome.add(
      this.scene.add.text(FIGURE.x, FIGURE.y + 32, "IN-GAME SD", textStyle({ role: "body", size: 17, color: COLOR.inkDim })).setOrigin(0.5, 0),
    );
  }

  /** 캐릭터 대사. SD 위에 떠서 오른쪽 판들과 겹치지 않는다. */
  private say(line: string): void {
    this.liveLine?.destroy();
    const text = this.scene.add
      .text(FIGURE.x, FIGURE.y - FIGURE.height - 30, line, textStyle({ role: "body", size: 24, align: "center", wrap: 300 }))
      .setOrigin(0.5, 1)
      .setDepth(1006);
    this.liveLine = text;
    this.scene.tweens.add({ targets: text, alpha: { from: 0, to: 1 }, y: text.y - 14, duration: 200 });
    this.scene.tweens.add({ targets: text, alpha: 0, delay: 2400, duration: 400, onComplete: () => text.destroy() });
  }

  get isOpen(): boolean {
    return this.root.visible;
  }

  /** 팝업이 떠 있으면 그것부터 닫는다. 뒤로가기 한 번에 화면이 통째로 사라지지 않게. */
  hide(): void {
    if (this.popups.isOpen) {
      this.popups.closeTop();
      return;
    }
    this.root.setVisible(false);
    this.chrome.setVisible(false);
    this.portraitWanted = false;
    this.portrait?.setVisible(false);
    this.figure?.setVisible(false);
    this.liveLine?.destroy();
    setDebugInfoOpen(false);
    this.onClose?.();
  }

  private toggleBookmark(): void {
    if (!this.currentDef || !this.ownedNow) return;
    relicCollection.toggleBookmark(this.currentDef.id);
    this.refreshBadges();
  }

  private toggleFavorite(): void {
    if (!this.currentDef || !this.ownedNow) return;
    relicCollection.setFavorite(this.currentDef.id);
    this.refreshBadges();
  }

  private refreshBadges(): void {
    const def = this.currentDef;
    const owned = this.ownedNow && def !== undefined && relicCollection.owns(def.id);
    this.bookmarkBadge.paint(owned && relicCollection.isBookmarked(def!.id), owned);
    this.favoriteBadge.paint(owned && session.favorite === def!.id, owned);
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
    this.portrait?.destroy();
    this.portrait = portrait;
    enableHitOnClick(this.scene, portrait);
    if (portraitUsesRelicTint(def.portraitAssetId)) tintPuppet(portrait, mixWhite(tintFor(def.id), 0.55));
    portrait.setVisible(this.portraitWanted && this.root.visible);
  }

  private async loadFigure(def: RelicDef): Promise<void> {
    const request = ++this.figureRequest;
    const figure = await spawnPuppet(this.scene, battleAssetFor(def.id), {
      x: FIGURE.x,
      groundY: FIGURE.y,
      height: FIGURE.height,
      depth: 1004,
    });
    if (request !== this.figureRequest) { figure.destroy(); return; }
    this.figure?.destroy();
    this.figure = figure;
    enableHitOnClick(this.scene, figure);
    figure.on("pointerup", () => this.say(def.name + "는 당신을 바라본다."));
    figure.setVisible(this.portraitWanted && this.root.visible);
  }

  /** 원화 아래 스킬 아이콘 세 개. 누르면 정형 팝업이 뜬다. */
  private buildSkillIcons(def: RelicDef): void {
    for (const icon of this.skillIcons.splice(0)) icon.destroy();
    const entries: [string, Skill, number | undefined][] = [
      ["패시브", { ...def.passive, power: def.passive.value, damageType: "physical" } as unknown as Skill, undefined],
      ["일반 공격", def.basic, undefined],
      ["궁극기", def.ultimate, def.ultimate.cost],
    ];
    entries.forEach(([kindLabel, skill, gaugeCost], index) => {
      const size = 116;
      const container = this.scene.add.container(112 + index * 132, BASE_HEIGHT - 176);
      container.add(drawLayer(this.scene, 0, 0, chipPoints(size, size, {
        bevel: { topLeft: size * 0.26, topRight: 0, bottomRight: size * 0.26, bottomLeft: 0 },
      }), { fill: index === 2 ? 0x2a2418 : 0x141a22, alpha: 0.92, edge: COLOR.accent, edgeAlpha: index === 2 ? 0.9 : 0.4 }));
      const texture = this.scene.textures.exists(skill.iconAssetId) ? skill.iconAssetId : FALLBACK_SKILL_ICON;
      container.add(this.scene.add.image(0, -8, texture).setDisplaySize(size * 0.5, size * 0.5));
      container.add(this.scene.add.text(0, size / 2 - 24, kindLabel, textStyle({ role: "body", size: 17, color: COLOR.inkDim })).setOrigin(0.5));
      const hit = this.scene.add.rectangle(0, 0, size, size, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => container.setScale(1.08));
      hit.on("pointerout", () => container.setScale(1));
      hit.on("pointerup", () => {
        container.setScale(1);
        openSkillPopup(this.scene, this.popups, this.keywords, this.skillViewModel(kindLabel, skill, gaugeCost));
      });
      container.add(hit);
      this.chrome.add(container);
      this.skillIcons.push(container);
    });
  }

  /** 현재 화면 문맥에 따라 도감 배율 또는 대상 방어력이 반영된 전투 피해를 만든다. */
  private skillViewModel(kindLabel: string, skill: Skill, gaugeCost?: number): SkillInfoViewModel {
    const attacker = this.currentUnit ?? (this.currentDef && {
      def: this.currentDef, hp: this.currentDef.stats.hp, maxHp: this.currentDef.stats.hp,
      energy: 0, ferocity: 0, bondLevel: 0, stunTurns: 0, justSwapped: false,
    });
    const preview = attacker && kindLabel !== "패시브" ? previewSkillDamage(attacker, skill, this.previewTarget, true) : undefined;
    const valueLabel = preview?.kind === "damage"
      ? preview.label + "  " + preview.amount.toLocaleString() + " (대상 방어 반영)"
      : preview ? preview.label + "  " + preview.stat + " " + preview.power + "% (도감 기준)" : undefined;
    return {
      name: skill.name,
      kindLabel,
      iconAssetId: skill.iconAssetId as SkillIconAssetId,
      effectType: skill.effectType,
      valueLabel,
      gaugeCost,
      description: skill.desc,
    };
  }

  /** 도감은 보유 여부를 전달해 정적 기록과 성장 정보의 잠금을 한곳에서 적용한다. */
  showRelic(def: RelicDef, owned = true): void {
    this.openCharacter(def, undefined, undefined, undefined, owned);
  }

  /** target을 함께 넘긴 전투 정보창은 방어력/저항력을 적용한 비치명타 예상값을 표시한다. */
  showUnit(unit: BattleUnit, _isFront: boolean, target?: BattleUnit): void {
    this.openCharacter(
      unit.def,
      "HP " + unit.hp.toLocaleString() + " / " + unit.maxHp.toLocaleString() + "   ·   궁극기 " + unit.energy + "/" + ULTIMATE_ENERGY_MAX + "   ·   야성 " + unit.ferocity + "/100",
      unit,
      target,
    );
  }

  /** 팀 요약은 별도 팝업 없이 첫 유닛의 공용 캐릭터 상세로 진입한다. */
  showEnemyTeam(units: BattleUnit[], order: number[]): void {
    const front = units[order[0]];
    if (front) this.showUnit(front, true);
  }

  private openCharacter(def: RelicDef, live?: string, unit?: BattleUnit, target?: BattleUnit, owned = true): void {
    this.currentDef = def;
    this.ownedNow = owned;
    this.currentUnit = unit;
    this.previewTarget = target;
    this.popups.closeAll();

    this.rarityText.setText(owned ? def.rarity : "???");
    this.nameText.setText(owned ? def.name : "미발굴 개체");
    this.roleText.setText("NO." + def.specimenNumber + (owned ? "   " + def.origin + " · " + ROLE_LABEL[def.role] : "   실루엣 기록"));
    this.refreshBadges();
    this.paintStars(def);
    this.buildSkillIcons(def);
    this.refreshGrowth();

    // 미보유 개체는 원화·스킬을 감추고 번호와 실루엣만 남긴다.
    for (const icon of this.skillIcons) icon.setVisible(owned);
    this.portraitWanted = owned;
    this.portrait?.setVisible(false);
    this.figure?.setVisible(false);
    if (owned) {
      void this.loadPortrait(def);
      void this.loadFigure(def);
    }
    this.root.setVisible(true);
    this.chrome.setVisible(true);
    setDebugInfoOpen(true);
    if (live) this.say(live);
  }

  /** 성급은 등급에서만 나온다. 각성 단계는 옆의 돋보기가 맡는다. */
  private paintStars(def: RelicDef): void {
    this.starRow.removeAll(true);
    const filled = def.rarity === "SSR" ? 5 : def.rarity === "SR" ? 4 : 3;
    const gap = 52;
    const left = -((5 - 1) * gap) / 2 - 40;
    for (let i = 0; i < 5; i += 1) {
      const on = i < filled;
      const star = this.scene.add.star(left + i * gap, 0, 4, 8, 22, on ? COLOR.accent : 0x000000, on ? 1 : 0.35);
      if (!on) star.setStrokeStyle(2, BADGE_OFF, 0.85);
      this.starRow.add(star);
    }
  }

  /** 레벨·경험치·유대·능력치·젬을 지금 상태로 다시 칠한다. */
  private refreshGrowth(): void {
    const def = this.currentDef;
    if (!def) return;
    const progress = relicProgression.getProgress(def.id);
    const finalStats = relicProgression.getFinalStats(def.id);
    const maxed = progress.level >= RELIC_LEVEL_CAP;

    this.levelValue.setText(String(progress.level));
    this.levelCap.setText("/ " + RELIC_LEVEL_CAP);
    const need = maxed ? 0 : relicExpToNext(progress.level);
    this.expBar.setValue(maxed ? 1 : progress.exp / need);
    this.expLabel.setText(maxed ? "MAX" : progress.exp + " / " + need + " EXP   ·   보유 잡초 " + session.wallet.weeds);
    this.feedButton.setAlpha(this.ownedNow && canFeedRelic(progress, session.wallet.weeds) ? 1 : 0.4);
    this.feedLabel.setText(maxed ? "최대 레벨" : "급여하기");

    const bondMaxed = progress.bondLevel >= BOND_LEVEL_CAP;
    const bondBase = BOND_TOTAL_XP_BY_LEVEL[progress.bondLevel];
    const bondNext = bondMaxed ? bondBase : BOND_TOTAL_XP_BY_LEVEL[progress.bondLevel + 1];
    this.bondValue.setText(String(progress.bondLevel));
    this.bondBar.setValue(bondMaxed ? 1 : (progress.bondXp - bondBase) / (bondNext - bondBase));
    const reduction = Math.round((1 - BOND_FEROCITY_MULTIPLIER[progress.bondLevel]) * 100);
    this.bondLabel.setText((bondMaxed ? "MAX" : progress.bondXp + " / " + bondNext + " EXP") + "   ·   야성 증가 -" + reduction + "%");

    STAT_CHIPS.forEach((chip, index) => {
      const base = def.stats[chip.key];
      const gain = finalStats[chip.key] - base;
      this.statValues[index].setText(finalStats[chip.key].toLocaleString());
      this.statGains[index].setText("기본 " + base.toLocaleString());
      this.statGains[index].setColor(COLOR.inkDim);
      if (gain > 0) {
        this.statGains[index].setText("기본 " + base.toLocaleString() + "   +" + gain.toLocaleString());
        this.statGains[index].setColor(COLOR.accentText);
      }
    });

    progress.heartGemSlots.forEach((id, index) => this.gemSlots[index].paint(id));
  }
}

/** 얇은 게이지 하나. 홈과 채움 두 겹으로만 그린다. */
class Gauge {
  private readonly fill: Phaser.GameObjects.Graphics;
  private readonly track: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly width: number, private readonly height: number, private readonly color: number) {
    this.track = scene.add.graphics({ x, y });
    this.track.fillStyle(0x000000, 0.55);
    this.track.fillPoints(toPoints(slantedRect(width, height, height)), true);
    this.fill = scene.add.graphics({ x, y });
    this.setValue(0);
  }

  get objects(): Phaser.GameObjects.Graphics[] {
    return [this.track, this.fill];
  }

  setValue(ratio: number): void {
    const filled = this.width * Phaser.Math.Clamp(Number.isFinite(ratio) ? ratio : 0, 0, 1);
    this.fill.clear();
    if (filled <= 0) return;
    const s = this.height / 2;
    const left = -this.width / 2;
    this.fill.fillStyle(this.color, 1);
    this.fill.fillPoints(toPoints([
      left + s, -this.height / 2,
      left + filled + s, -this.height / 2,
      left + filled - s, this.height / 2,
      left - s, this.height / 2,
    ]), true);
  }
}

/**
 * 하트 하나를 세 조각으로 가른 다각형.
 *
 * 하트 곡선을 촘촘히 찍어 외곽을 만들고, 가운데에서 세 갈래로 잘라 왼쪽 봉우리 · 오른쪽
 * 봉우리 · 아래 꼭짓점을 나눈다. 세 조각이 다 차야 하트 하나가 완성된다.
 */
function heartOutline(t: number, size: number): [number, number] {
  const scale = size / 32;
  const x = 16 * Math.sin(t) ** 3;
  // 수학 좌표의 하트를 화면 좌표(아래가 +)로 뒤집는다.
  const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
  return [x * scale, y * scale];
}

/** 조각 하나가 차지하는 곡선 구간. 0번 왼쪽 봉우리, 1번 오른쪽 봉우리, 2번 아래다. */
const HEART_RANGES: readonly [number, number][] = [
  [Math.PI * 1.34, Math.PI * 2],
  [0, Math.PI * 0.66],
  [Math.PI * 0.66, Math.PI * 1.34],
];

/** 세 조각이 만나는 가운데 점. 하트의 무게중심보다 살짝 위다. */
function heartCenter(size: number): [number, number] {
  return [0, (-2 * size) / 32];
}

function heartSlice(size: number, index: number): number[] {
  const [from, to] = HEART_RANGES[index];
  const center = heartCenter(size);
  const points: number[] = [...center];
  const steps = 22;
  for (let i = 0; i <= steps; i += 1) {
    points.push(...heartOutline(from + ((to - from) * i) / steps, size));
  }
  return points;
}

/** 조각 안쪽의 글자 자리. 곡선 구간의 한가운데와 중심을 반씩 섞는다. */
function heartSliceCenter(size: number, index: number): { x: number; y: number } {
  const [from, to] = HEART_RANGES[index];
  const [mx, my] = heartOutline((from + to) / 2, size);
  const [cx, cy] = heartCenter(size);
  return { x: (mx + cx) / 2, y: (my + cy) / 2 };
}
