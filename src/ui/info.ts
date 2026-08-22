import Phaser from "phaser";
import type { PuppetCreature } from "../puppets/assets";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { previewSkillDamage, ULTIMATE_ENERGY_MAX, type BattleUnit } from "../core/battle";
import type { Element, RelicDef, Role, Skill, SkillIconAssetId, Stats } from "../core/types";
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
import { addStarRow } from "./stars";
import { openSkillPopup, type SkillInfoViewModel } from "./SkillPopup";
import { relicCollection } from "../managers/RelicCollectionManager";
import { COLOR, textStyle } from "./theme";
import { FALLBACK_SKILL_ICON } from "./skillIcons";
import { gameApi } from "../api/FakeServer";
import { AWAKENING_CAP, AWAKENING_STEPS, canFeedRelic, FEED_UNIT, RELIC_LEVEL_CAP, relicExpToNext } from "../core/relicProgression";
import { session } from "../state/session";
import { BOND_FEROCITY_MULTIPLIER, BOND_LEVEL_CAP, BOND_TOTAL_XP_BY_LEVEL } from "../core/bond";
import { getRelicCatalogDisclosure } from "../core/relicCatalog";

export type { SkillInfoViewModel } from "./SkillPopup";

/** 전신 원화의 코어(`중심1`) 관절이 놓이는 자리와 확대 높이. 정보창의 주인공은 캐릭터다. */
const PORTRAIT_FOCUS = { x: 336, y: 980, height: 1820 } as const;

/** 정보창 구석에 세우는 SD 피규어. 받침 위에서 idle만 재생한다. */
const FIGURE = { x: 762, y: 1786, height: 240 } as const;

/** 오른쪽 정보 기둥. 캐릭터를 덮지 않도록 화면 오른쪽 절반만 쓴다. */
const COLUMN = { x: 818, width: 476 } as const;

/** 판 하나하나가 같은 각도로 기울어 한 벌로 읽힌다. */
const PANEL_TILT = -1.6;

/**
 * 판의 왼쪽 변이 오른쪽 변보다 짧아지는 양(px).
 *
 * 네 판이 같은 값을 쓰므로 변의 기울기가 같아진다. 높이에 비례시키면 큰 판만 크게 기울어
 * 한 벌로 읽히지 않는다. 값이 커지면 왼쪽 위 구석이 안쪽으로 깊이 파여 제목이 판 밖으로
 * 밀려나므로, 기울어 보이는 최소한만 남긴다.
 */
const PANEL_TAPER = 12;

/** 꺼진 뱃지·빈 별의 선 색. 글자용 문자열 색과 달리 도형은 숫자 색이 필요하다. */
const BADGE_OFF = 0x8b8f96;
/** 즐겨찾기는 노랑, 애착은 분홍. 색만으로도 둘이 갈린다. */
const BOOKMARK_ON = 0xf2c744;
const FAVORITE_ON = 0xf2789f;
/**
 * 원화 아래 스킬 아이콘 세 개의 자리와 크기.
 *
 * 앞으로 SVG 일러스트가 들어올 액자라 넉넉하게 잡는다. 셋의 간격도 여기서만 정한다.
 */
const SKILL_ICON = { size: 150, x: 124, step: 168 } as const;

/**
 * 유대 하트의 지름.
 *
 * 가로세로 같은 자리에 앉는다(1:1). 하트 곡선은 세로가 조금 짧아서 그대로 그리면 납작해
 * 보이므로, 그리는 쪽에서 세로만 늘려 정사각형 자리를 꽉 채운다.
 */
const BOND_HEART_SIZE = 59;

/** 정보창의 별은 화면에서 가장 큰 성급 표시다. 모양과 색은 `stars.ts`가 정한다. */
const STAR_SIZE = 34;

/** 야성 뱃지의 색. 게이지가 끓는 쪽이라 붉은 기가 돈다. */
const FEROCITY_BADGE = 0x8f3a2a;
/** 유대 하트와 급여 버튼의 색. 하트는 반투명하게 겹쳐 발광하는 붉은 빛으로 쓴다. */
const BOND_HEART = 0xe23a46;
/** 하트 안쪽에 한 겹 더 얹는 밝은 심지. */
const BOND_HEART_CORE = 0xff8a7a;
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

/**
 * 팝업을 부른 자리.
 *
 * 팝업은 새 화면이 아니라 누른 것 위에 얹히는 쪽지다. 그래서 여는 쪽은 언제나 "어디를
 * 눌렀는지"와 "닫히면 무엇을 되돌릴지"를 함께 넘긴다.
 */
interface PopupSource {
  x: number;
  y: number;
  onClose: () => void;
}

/** 부른 자리를 팝업 옵션으로 옮긴다. */
function anchorOf(from: PopupSource): { anchor: { x: number; y: number }; onClose: () => void } {
  return { anchor: { x: from.x, y: from.y }, onClose: from.onClose };
}

/**
 * 화면 좌표로 만든 것을 기울어진 판 안으로 옮긴다.
 *
 * 자리는 전부 화면 기준으로 적는 편이 읽기 쉽다. 그래서 만들 때는 화면 좌표를 쓰고, 판에
 * 넣는 순간 판 기준으로 바꾼다 — 그래야 판과 내용물이 같은 각도로 함께 기운다.
 */
function attach(panel: Phaser.GameObjects.Container, ...objects: Phaser.GameObjects.Components.Transform[]): void {
  for (const object of objects) {
    object.x -= panel.x;
    object.y -= panel.y;
    panel.add(object as unknown as Phaser.GameObjects.GameObject);
  }
}

/** 뱃지 하나를 다시 칠하는 손잡이. */
interface BadgeHandle {
  paint(on: boolean, enabled: boolean): void;
}

/** 젬 조각 하나를 다시 칠하는 손잡이. */
interface GemSlot {
  paint(gemId: string | null): void;
}

/** 역할은 전투 공식을 바꾸지 않는 특화 태그로만 노출한다. */
export const ROLE_LABEL: Record<Role, string> = { warrior: "전사", tank: "탱커", assassin: "암살자", support: "지원가" };
/** 상세 정보에서 코드 키 대신 일관된 한국어 속성명을 보여 준다. */
export const ELEMENT_LABEL: Record<Element, string> = { fire: "불", water: "물", grass: "풀", earth: "땅", wind: "바람" };

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
    this.addMagnifier(COLUMN.x + COLUMN.width / 2 - 40, 196, (from) => this.openAwakening(from));

    // 오른쪽 수치는 칸마다 판을 따로 깐다. 대신 칸의 내용물을 그 판 **안에** 넣어 판과 같은
    // 각도로 함께 기운다. 판만 기울고 글자가 반듯하면 판 위에 종이를 얹어 둔 것처럼 어긋난다.
    const levelPanel = this.addPanel(COLUMN.x, 442, COLUMN.width, 332);
    const bondPanel = this.addPanel(COLUMN.x, 706, COLUMN.width, 144);
    const statPanel = this.addPanel(COLUMN.x, 1024, COLUMN.width, 396);
    const gemPanel = this.addPanel(COLUMN.x, 1398, COLUMN.width, 292);

    // 레벨 · 경험치 · 급여.
    this.levelValue = scene.add.text(COLUMN.x - COLUMN.width / 2 + 92, 296, "", textStyle({ role: "display", size: 96 })).setOrigin(0, 0).setScale(1, 1.16);
    this.levelCap = scene.add.text(COLUMN.x + COLUMN.width / 2 - 46, 376, "", textStyle({ role: "body", size: 26, color: COLOR.inkDim })).setOrigin(1, 0);
    this.expBar = new Gauge(scene, COLUMN.x, 452, COLUMN.width - 88, 16, COLOR.accent);
    this.expLabel = scene.add.text(COLUMN.x, 470, "", textStyle({ role: "body", size: 20, color: COLOR.inkDim })).setOrigin(0.5, 0);
    attach(levelPanel,
      scene.add.text(COLUMN.x - COLUMN.width / 2 + 50, 310, "LV", textStyle({ role: "display", size: 30, color: COLOR.accentText })).setOrigin(0, 0),
      this.levelValue, this.levelCap, ...this.expBar.objects, this.expLabel);
    const feed = this.addFeedButton(COLUMN.x, 556, COLUMN.width - 96, 112, levelPanel);
    this.feedButton = feed.container;
    this.feedLabel = feed.label;

    // 유대.
    const bondHeart = scene.add.container(COLUMN.x - COLUMN.width / 2 + 92, 710);
    // 하트도 별과 같은 방식이다 — 그림자·빛무리·몸통을 겹으로 쌓고 어두운 선으로 마무리한다.
    bondHeart.add(paintBondHeart(scene, BOND_HEART_SIZE));
    this.bondValue = scene.add.text(0, 1, "", textStyle({ role: "display", size: 32 })).setOrigin(0.5);
    bondHeart.add(this.bondValue);
    this.bondBar = new Gauge(scene, COLUMN.x + 76, 718, COLUMN.width - 256, 14, BOND_HEART);
    this.bondLabel = scene.add.text(COLUMN.x - COLUMN.width / 2 + 186, 734, "", textStyle({ role: "body", size: 20, color: COLOR.inkDim })).setOrigin(0, 0);
    attach(bondPanel, bondHeart,
      scene.add.text(COLUMN.x - COLUMN.width / 2 + 172, 660, "유대", textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0, 0),
      ...this.bondBar.objects, this.bondLabel);

    // 능력치.
    attach(statPanel, scene.add.text(COLUMN.x - COLUMN.width / 2 + 56, 846, "능력치", textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0, 0));
    this.addMagnifier(COLUMN.x + COLUMN.width / 2 - 48, 852, (from) => this.openExtraStats(from), statPanel);
    STAT_CHIPS.forEach((chip, index) => this.addStatChip(chip, index, statPanel));

    // 하트 젬 — 하트 하나를 셋으로 가른 자리.
    attach(gemPanel, scene.add.text(COLUMN.x - COLUMN.width / 2 + 56, 1282, "HEART GEM", textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0, 0));
    for (let index = 0; index < 3; index += 1) this.gemSlots.push(this.addGemSlot(index, gemPanel));

    this.buildFigureStand();
    this.addCostumeButton(FIGURE.x + 152, FIGURE.y - 206);
    this.chrome.add(addBackButton(scene, () => this.hide()));
  }

  /**
   * 오른쪽 기둥의 판 하나.
   *
   * 판만 기울고 그 위의 글자와 칩이 반듯하면 종이를 얹어 둔 것처럼 어긋난다. 그래서 판을
   * 돌려주고, 칸의 내용물은 전부 이 컨테이너 **안에** 넣어 같은 각도로 함께 기운다.
   */
  private addPanel(x: number, y: number, width: number, height: number): Phaser.GameObjects.Container {
    const panel = this.scene.add.container(x, y).setRotation(Phaser.Math.DegToRad(PANEL_TILT));
    // 좁아지는 양을 비율이 아니라 픽셀로 고정한다. 비율로 두면 높은 판이 더 많이 좁아져
    // 판마다 변의 기울기가 달라지고, 네 장이 저마다 다른 방향으로 노는 것처럼 보인다.
    const shape = perspectiveRect(width, height, { tall: "right", taper: (2 * PANEL_TAPER) / height });
    panel.add(drawLayer(this.scene, 0, 0, shape, { fill: 0x0b0f15, alpha: 0.6, edge: COLOR.accent, edgeAlpha: 0.4 }));
    panel.add(drawShapeEdge(this.scene, 0, 0, shape, "bottom", { color: COLOR.accent, alpha: 0.22, inset: 10 }));
    this.chrome.add(panel);
    return panel;
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
    hit.on("pointerout", () => { if (!this.popups.isOpen) container.setScale(1); });
    hit.on("pointerup", () => {
      container.setScale(1.12);
      this.openJournal({ x, y: y + size / 2, onClose: () => container.setScale(1) });
    });
    container.add(hit);
    this.chrome.add(container);
  }

  /** 더 볼 것이 있다는 표시. 자리만 다를 뿐 생김새와 크기는 같다. */
  private addMagnifier(x: number, y: number, onClick: (from: PopupSource) => void, panel?: Phaser.GameObjects.Container): void {
    const container = this.scene.add.container(x, y);
    container.add(drawGlyph(this.scene, "magnifier", 0, 0, 44, COLOR.accent));
    const hit = this.scene.add.rectangle(x, y, 84, 84, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => container.setScale(1.15));
    hit.on("pointerout", () => { if (!this.popups.isOpen) container.setScale(1); });
    hit.on("pointerup", () => {
      container.setScale(1.15);
      onClick({ x, y: y - 30, onClose: () => container.setScale(1) });
    });
    if (panel) attach(panel, container, hit);
    else this.chrome.add([container, hit]);
  }

  /**
   * 급여 버튼.
   *
   * 한 번 누르면 한 번 먹이고, 꾹 누르고 있으면 계속 먹인다. 잠깐 누르고 있으면 그 위로 한 번에
   * 여러 레벨을 채우는 작은 팝업이 떠서, 레벨 하나에 수십 번 두드리지 않아도 된다.
   */
  private addFeedButton(x: number, y: number, width: number, height: number, panel: Phaser.GameObjects.Container): { container: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text } {
    const container = this.scene.add.container(x, y);
    const shape = slantedRect(width, height, 16);
    container.add(drawLayer(this.scene, 0, 0, shape, { fill: 0x18261c, alpha: 0.92, edge: FEED_GREEN, edgeAlpha: 0.9, sheen: 0.06 }));
    const label = this.scene.add.text(0, -22, "급여하기", textStyle({ role: "display", size: 38 })).setOrigin(0.5);
    const hint = this.scene.add.text(0, 16, "잡초 " + FEED_UNIT.weeds + " · 꾹 누르면 계속", textStyle({ role: "body", size: 19, color: COLOR.inkDim })).setOrigin(0.5);
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
    attach(panel, container);
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
  private addStatChip(chip: { key: keyof Stats; label: string; color: number }, index: number, panel: Phaser.GameObjects.Container): void {
    // 칩은 왼쪽으로 34만큼 더 나가므로 판 가장자리에서 넉넉히 띄운다. 판 밖으로 걸치면
    // 내용물이 판에 얹힌 것이 아니라 흘러넘친 것처럼 보인다.
    const x = COLUMN.x - COLUMN.width / 2 + 104 + (index % 2) * (COLUMN.width / 2 - 26);
    const y = 906 + Math.floor(index / 2) * 118;
    const size = 62;
    const container = this.scene.add.container(x - 34, y);
    container.add(drawLayer(this.scene, 0, 0, chipPoints(size, size, {
      bevel: { topLeft: size * 0.32, topRight: 0, bottomRight: size * 0.32, bottomLeft: 0 },
    }), { fill: 0x11161d, alpha: 0.92, edge: chip.color, edgeAlpha: 0.95 }));
    container.add(this.scene.add.text(0, 0, chip.label, textStyle({ role: "emphasis", size: 21 })).setOrigin(0.5));

    const value = this.scene.add.text(x + 12, y - 26, "", textStyle({ role: "display", size: 36 })).setOrigin(0, 0);
    const gain = this.scene.add.text(x + 12, y + 16, "", textStyle({ role: "body", size: 18, color: COLOR.inkDim })).setOrigin(0, 0);
    this.statValues.push(value);
    this.statGains.push(gain);
    attach(panel, container, value, gain);
  }

  /**
   * 하트 젬 슬롯.
   *
   * 하트 세 개가 아니라 하트 **하나를 셋으로 가른** 자리다. 세 조각이 다 차야 온전한 하트가
   * 완성되므로, 빈 자리가 곧 "아직 덜 채운 마음"으로 읽힌다.
   */
  private addGemSlot(index: number, panel: Phaser.GameObjects.Container): GemSlot {
    const center = { x: COLUMN.x - 48, y: 1404 };
    const size = 214;
    const piece = this.scene.add.graphics({ x: center.x, y: center.y });
    const shape = heartSlice(size, index);
    const spot = heartSliceCenter(size, index);

    // 이름은 하트 오른쪽에 세 줄로 세운다. 조각 안에 넣으면 좁은 면에 글자가 눌려 읽히지 않는다.
    const label = this.scene.add
      .text(center.x + size * 0.62, center.y - 46 + index * 46, "", textStyle({ role: "body", size: 20, color: COLOR.inkDim }))
      .setOrigin(0, 0.5);

    const hit = this.scene.add
      .rectangle(center.x + spot.x, center.y + spot.y, size * 0.44, size * 0.44, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerup", () => this.openGemPicker(index));
    attach(panel, piece, label, hit);

    return {
      paint: (gemId) => {
        piece.clear();
        // 낀 조각만 보석처럼 빛난다. 두 겹으로 칠해 가장자리보다 안쪽이 밝게 남는다.
        piece.fillStyle(gemId ? GEM_GLOW : 0x1b2330, gemId ? 0.32 : 0.95);
        piece.fillPoints(toPoints(shape), true);
        piece.fillStyle(gemId ? GEM_FILL : 0x232c39, gemId ? 0.95 : 0.95);
        piece.fillPoints(toPoints(heartSlice(size * 0.84, index)), true);
        // 커팅면. 낀 조각은 밝게 갈라지고 빈 자리는 흐릿한 결만 남는다.
        piece.lineStyle(2, gemId ? GEM_EDGE : 0x2a3440, gemId ? 0.7 : 0.35);
        for (const line of heartFacetLines(size * 0.84, index)) {
          piece.lineBetween(line.from[0], line.from[1], line.to[0], line.to[1]);
        }
        piece.lineStyle(3, gemId ? GEM_EDGE : 0x55637a, 0.95);
        piece.strokePoints(toPoints(shape), true);
        label.setText((index + 1) + "   " + (gemId ? getHeartGem(gemId).name.replace(" Heart Gem", "") : "빈 자리"));
        label.setColor(gemId ? COLOR.ink : COLOR.inkDim);
      },
    };
  }

  /** 슬롯 하나에 낄 젬을 고르는 팝업. */
  private openGemPicker(index: number): void {
    const def = this.currentDef;
    if (!def || !this.ownedNow) return;
    this.popups.open({ width: 820, height: 620, title: "HEART GEM " + (index + 1), dim: true }, (body, close) => {
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
  private openJournal(from: PopupSource): void {
    const def = this.currentDef;
    if (!def) return;
    const disclosure = getRelicCatalogDisclosure(def, this.ownedNow);
    this.popups.open({ width: 880, height: 760, title: "관찰 일지", tilt: -1.2, ...anchorOf(from) }, (body) => {
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
  private openAwakening(from: PopupSource): void {
    const def = this.currentDef;
    if (!def) return;
    const awakening = relicProgression.getProgress(def.id).awakening;
    this.popups.open({ width: 900, height: 640, title: "각성", tilt: -1.2, ...anchorOf(from) }, (body) => {
      body.add(this.scene.add.text(-390, -226, "같은 렐릭을 다시 발굴하면 한 단계씩 깨어난다.", textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(0, 0));
      for (const entry of AWAKENING_STEPS) {
        const step = entry.step;
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
        // 단계 효과 문구는 core의 표 하나에서만 온다. 화면이 따로 적어 두면 수치가 갈라진다.
        const note = entry.readyUltimate ? entry.label + "   ·   준비 중" : entry.label;
        body.add(this.scene.add.text(-160, y, note, textStyle({ role: "body", size: 22, color: reached ? COLOR.ink : COLOR.inkDim })).setOrigin(0, 0.5));
      }
      body.add(this.scene.add.text(0, 256, "현재 " + awakening + " / " + AWAKENING_CAP + " 단계", textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0.5));
    });
  }

  /** 공격 속도처럼 자주 보지 않는 수치는 돋보기 안에만 둔다. */
  private openExtraStats(from: PopupSource): void {
    const def = this.currentDef;
    if (!def) return;
    const stats = relicProgression.getFinalStats(def.id);
    this.popups.open({ width: 720, height: 520, title: "추가 능력치", tilt: -1.2, ...anchorOf(from) }, (body) => {
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
      this.popups.open({ width: 720, height: 420, title: "옷장", dim: true }, (body) => {
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
      const size = SKILL_ICON.size;
      const container = this.scene.add.container(SKILL_ICON.x + index * SKILL_ICON.step, BASE_HEIGHT - 196);
      const bevel = { topLeft: size * 0.26, topRight: 0, bottomRight: size * 0.26, bottomLeft: 0 };
      // 바깥 칩이 액자, 안쪽 칩이 그림 자리다. 나중에 들어올 SVG 일러스트가 액자 안에 앉는다.
      container.add(drawLayer(this.scene, 0, 0, chipPoints(size, size, { bevel }), {
        fill: index === 2 ? 0x2a2418 : 0x141a22,
        alpha: 0.94,
        edge: COLOR.accent,
        edgeAlpha: index === 2 ? 0.9 : 0.45,
      }));
      const innerSize = size - 16;
      container.add(drawLayer(this.scene, 0, -6, chipPoints(innerSize, innerSize - 14, {
        bevel: { topLeft: innerSize * 0.22, topRight: 0, bottomRight: innerSize * 0.22, bottomLeft: 0 },
      }), { fill: 0x05080c, alpha: 0.55 }));
      const texture = this.scene.textures.exists(skill.iconAssetId) ? skill.iconAssetId : FALLBACK_SKILL_ICON;
      container.add(this.scene.add.image(0, -8, texture).setDisplaySize(size * 0.52, size * 0.52));
      container.add(this.scene.add.text(0, size / 2 - 26, kindLabel, textStyle({ role: "emphasis", size: 19, color: index === 2 ? COLOR.accentText : COLOR.inkDim })).setOrigin(0.5));
      const hit = this.scene.add.rectangle(0, 0, size, size, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => container.setScale(1.08));
      hit.on("pointerout", () => { if (!this.popups.isOpen) container.setScale(1); });
      hit.on("pointerup", () => {
        // 팝업이 떠 있는 동안 아이콘은 눌린 채로 남는다. 어디서 나온 쪽지인지 보이게 한다.
        container.setScale(1.08);
        openSkillPopup(this.scene, this.popups, this.keywords, this.skillViewModel(kindLabel, skill, gaugeCost), {
          x: container.x,
          y: container.y - size / 2,
          onClose: () => container.setScale(1),
        });
      });
      container.add(hit);
      // 패시브 위에만 이 개체의 피버 발현을 작게 얹는다. 야성은 벌이 아니라 상이라는 표시다.
      if (index === 0) this.addFerocityBadge(container, size, def);
      this.chrome.add(container);
      this.skillIcons.push(container);
    });
  }

  /**
   * 패시브 아이콘 위에 붙는 야성(피버) 뱃지.
   *
   * 야성은 모든 개체가 공유하는 규칙이지만 어떻게 터지는지는 개체마다 다르다. 그 차이만
   * 이름 두 글자로 알리고, 자세한 것은 눌렀을 때 그 위에 뜨는 쪽지가 맡는다.
   */
  private addFerocityBadge(icon: Phaser.GameObjects.Container, size: number, def: RelicDef): void {
    // 이름표가 아니라 아이콘이다. 스킬 액자 어깨에 걸린 작은 불꽃 하나로 알린다.
    const badgeSize = 72;
    // 액자 위로 넉넉히 띄운다. 붙여 두면 아이콘이 액자에 얹힌 얼룩처럼 보인다.
    const badge = this.scene.add.container(0, -size / 2 - 56);
    const shape = chipPoints(badgeSize, badgeSize, {
      bevel: { topLeft: badgeSize * 0.34, topRight: 0, bottomRight: badgeSize * 0.34, bottomLeft: 0 },
    });
    badge.add(drawLayer(this.scene, 0, 0, shape, { fill: FEROCITY_BADGE, alpha: 0.96, edge: 0xf0a58a, edgeAlpha: 0.8 }));
    badge.add(drawGlyph(this.scene, "ferocity", 0, 1, badgeSize * 0.56, 0xffd9c4));
    const hit = this.scene.add.rectangle(0, 0, badgeSize + 18, badgeSize + 18, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => badge.setScale(1.1));
    hit.on("pointerout", () => { if (!this.popups.isOpen) badge.setScale(1); });
    hit.on("pointerup", () => {
      badge.setScale(1.1);
      this.openFerocityTrait(def, { x: icon.x, y: icon.y - size / 2 - 92, onClose: () => badge.setScale(1) });
    });
    badge.add(hit);
    icon.add(badge);
  }

  /** 개체별 피버 발현 설명. 야성 규칙 자체는 강조된 말을 눌러 다시 열 수 있다. */
  private openFerocityTrait(def: RelicDef, from: PopupSource): void {
    this.popups.open({ width: 720, height: 340, title: def.ferocityTrait.name, tilt: -1.2, ...anchorOf(from) }, (body) => {
      body.add(
        this.scene.add
          .text(-720 / 2 + 52, -340 / 2 + 74, "야성 발현", textStyle({ role: "emphasis", size: 22, color: COLOR.accentText }))
          .setOrigin(0, 0),
      );
      const text = this.keywords.layout("[[ferocity|야성]]이 가득 차면 피버에 들어간다. " + def.ferocityTrait.desc, {
        width: 610,
        size: 25,
        lineSpacing: 8,
      });
      text.setPosition(-720 / 2 + 52, -340 / 2 + 118);
      body.add(text);
    });
  }

  /** 현재 화면 문맥에 따라 도감 배율 또는 대상 방어력이 반영된 전투 피해를 만든다. */
  private skillViewModel(kindLabel: string, skill: Skill, gaugeCost?: number): SkillInfoViewModel {
    const attacker = this.currentUnit ?? (this.currentDef && {
      def: this.currentDef, hp: this.currentDef.stats.hp, maxHp: this.currentDef.stats.hp,
      energy: 0, ferocity: 0, bondLevel: 0, stunTurns: 0, justSwapped: false,
      awakening: relicProgression.getProgress(this.currentDef.id).awakening,
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
    this.roleText.setText("NO." + def.specimenNumber + (owned ? "   " + def.origin + " · " + ELEMENT_LABEL[def.element] + " · " + ROLE_LABEL[def.role] : "   실루엣 기록"));
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

  /** 성급은 등급에서만 나온다. 별 모양과 색은 `stars.ts` 하나가 정한다. */
  private paintStars(def: RelicDef): void {
    this.starRow.removeAll(true);
    const filled = def.rarity === "SSR" ? 5 : def.rarity === "SR" ? 4 : 3;
    addStarRow(this.scene, this.starRow, -34, 0, STAR_SIZE, filled, 5);
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
    // 유대는 야성을 눌러 주는 것이 아니라 더 빨리 끓게 한다. 피버로 가는 지름길이다.
    const boost = Math.round((BOND_FEROCITY_MULTIPLIER[progress.bondLevel] - 1) * 100);
    this.bondLabel.setText((bondMaxed ? "MAX" : progress.bondXp + " / " + bondNext + " EXP") + "   ·   야성 상승 +" + boost + "%");

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
/**
 * 유대 하트 한 덩이.
 *
 * 글자 하트(♥)는 글꼴마다 모양과 두께가 달라지므로 젬과 같은 곡선식으로 직접 그린다.
 * 다만 성급 별처럼 화려하게 쌓지는 않는다 — 별은 등급을 자랑하는 자리지만 이것은 게이지
 * 옆의 이름표라, 테두리 없이 옅은 그림자와 한 겹의 빛무리로만 조용히 앉는다.
 */
function paintBondHeart(scene: Phaser.Scene, size: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const shape = (scale: number, dx = 0, dy = 0): Phaser.Geom.Point[] => {
    const list: Phaser.Geom.Point[] = [];
    for (let i = 0; i <= 72; i += 1) {
      const [x, y] = heartOutline((Math.PI * 2 * i) / 72, size * scale);
      // 하트 곡선은 세로가 짧다. 1:1 자리를 꽉 채우도록 세로만 늘린다.
      list.push(new Phaser.Geom.Point(x + dx, y * BOND_HEART_STRETCH + dy));
    }
    return list;
  };
  // 반투명한 붉은 빛이다. 판때기처럼 꽉 채우지 않고, 옅은 빛이 세 겹 겹쳐 안쪽이 밝게
  // 남는다. 뒤의 게이지와 글자가 살짝 비쳐야 "빛나는 표시"로 읽힌다.
  g.fillStyle(BOND_HEART, 0.18);
  g.fillPoints(shape(1.14), true);
  g.fillStyle(BOND_HEART, 0.3);
  g.fillPoints(shape(1.06), true);
  g.fillStyle(BOND_HEART, 0.5);
  g.fillPoints(shape(1), true);
  g.fillStyle(BOND_HEART_CORE, 0.34);
  g.fillPoints(shape(0.72, 0, -size * 0.02), true);
  return g;
}

/** 하트 곡선의 세로를 늘리는 비율. 1:1 자리에 꽉 차게 앉힌다. */
const BOND_HEART_STRETCH = 1.16;

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
  // 곡선을 촘촘히 따면 매끈한 하트가 되지만, 이것은 보석이다. 몇 개의 곧은 면으로만 깎아
  // 각 조각이 커팅된 것처럼 보이게 한다.
  const facets = 4;
  for (let i = 0; i <= facets; i += 1) {
    points.push(...heartOutline(from + ((to - from) * i) / facets, size));
  }
  return points;
}

/** 조각 안쪽에 긋는 커팅면. 중심에서 각 꼭짓점으로 뻗는 선이 보석의 결을 만든다. */
function heartFacetLines(size: number, index: number): { from: [number, number]; to: [number, number] }[] {
  const [start, end] = HEART_RANGES[index];
  const [cx, cy] = heartCenter(size);
  const lines: { from: [number, number]; to: [number, number] }[] = [];
  for (let i = 1; i < 4; i += 1) {
    const [x, y] = heartOutline(start + ((end - start) * i) / 4, size * 0.9);
    lines.push({ from: [cx, cy], to: [x, y] });
  }
  return lines;
}

/** 조각 안쪽의 글자 자리. 곡선 구간의 한가운데와 중심을 반씩 섞는다. */
function heartSliceCenter(size: number, index: number): { x: number; y: number } {
  const [from, to] = HEART_RANGES[index];
  const [mx, my] = heartOutline((from + to) / 2, size);
  const [cx, cy] = heartCenter(size);
  return { x: (mx + cx) / 2, y: (my + cy) / 2 };
}
