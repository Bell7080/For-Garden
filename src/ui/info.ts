import Phaser from "phaser";
import type { PuppetCreature } from "../puppets/assets";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import type { Combatant } from "../core/combatTypes";
import { previewSkillDamage } from "../core/damage";
import type { Element, RelicDef, RelicProgress, RelicRarity, Role, Skill, SkillIconAssetId, Stats } from "../core/types";
import { setDebugInfoOpen } from "../debug";
import { getHeartGem } from "../data/heartGems";
import { RELICS } from "../data/relics";
import { KeywordManager } from "../managers/KeywordManager";
import { relicProgression } from "../managers/RelicProgressionManager";
import {
  battleAssetFor,
  enableHitOnClick,
  placePuppet,
  playMotion,
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
import { AffinityBadge } from "./AffinityBadge";
import { ELEMENT_ICON, ROLE_ICON } from "./affinityIcons";
import { addStarRow } from "./stars";
import { RUNE_ACCENT, RUNE_CENTER_Y, runeTexture } from "./runeIcons";
import { StatRadar } from "./StatRadar";
import { openSkillPopup, type SkillInfoViewModel } from "./SkillPopup";
import { relicCollection } from "../managers/RelicCollectionManager";
import { COLOR, textStyle } from "./theme";
import { FALLBACK_SKILL_ICON } from "./skillIcons";
import { gameApi } from "../api/FakeServer";
import { AWAKENING_CAP, AWAKENING_STEPS, canBreakThrough, canFeedRelic, FEED_UNIT, nextBreakthrough, relicExpToNext, relicLevelCap } from "../core/relicProgression";
import { session } from "../state/session";
import { BOND_FEROCITY_MULTIPLIER, BOND_LEVEL_CAP, BOND_TOTAL_XP_BY_LEVEL, BOND_XP_REWARD } from "../core/bond";
import { getRelicCatalogDisclosure } from "../core/relicCatalog";
import { observations } from "../managers/ObservationManager";
import { observationQuestionForDate } from "../data/observations";
import type { PublicRelicProfileDto } from "../api/contracts";
import type { Fighter } from "../core/skirmish";
import { capabilitiesFor, type InfoCapabilities, type InfoContext } from "../core/infoCapabilities";

export type { SkillInfoViewModel } from "./SkillPopup";

export { capabilitiesFor, type InfoCapabilities, type InfoContext } from "../core/infoCapabilities";

/** 전신 원화의 코어(`중심1`) 관절이 놓이는 자리와 확대 높이. 정보창의 주인공은 캐릭터다. */
const PORTRAIT_FOCUS = { x: 336, y: 980, height: 1820 } as const;

/** 정보창 구석에 세우는 SD 피규어. 받침 위에서 idle만 재생한다. */
const FIGURE = { x: 762, y: 1786, height: 240 } as const;

/** 오른쪽 정보 기둥. 캐릭터를 덮지 않도록 화면 오른쪽 절반만 쓴다. */
const COLUMN = {
  x: 818,
  width: 476,
  /** 기둥 전체를 화면 왼쪽 위로 미는 양. 판과 제목이 함께 움직인다. */
  offsetX: -26,
  offsetY: -22,
} as const;

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

/**
 * 등급 글자에 흐르는 보석 색.
 *
 * 위 → 가운데 → 아래 순서로 색이 넘어간다. SSR은 황금 호박, SR은 보랏빛에서 분홍, R은
 * 청량한 푸른빛이다. 등급은 화면마다 다른 색으로 칠하지 않는다.
 */
const RARITY_GEM: Record<RelicRarity, readonly [string, string, string]> = {
  SSR: ["#fff3c4", "#f5a623", "#a25c0c"],
  SR: ["#ffd6f5", "#c07cff", "#6d4bd8"],
  R: ["#d6f2ff", "#63c4f2", "#2a6fd0"],
};

/** 이름 옆 속성·직군 뱃지의 크기와 이름에서 띄우는 간격. */
const AFFINITY = { main: 96, sub: 72, gap: 30 } as const;

/** 정보창의 별은 화면에서 가장 큰 성급 표시다. 모양과 색은 `stars.ts`가 정한다. */
const STAR_SIZE = 34;

/** 야성 뱃지의 색. 게이지가 끓는 쪽이라 붉은 기가 돈다. */
const FEROCITY_BADGE = 0x8f3a2a;
/** 유대 하트와 급여 버튼의 색. 하트는 반투명하게 겹쳐 발광하는 붉은 빛으로 쓴다. */
const BOND_HEART = 0xe23a46;
/** 하트 안쪽에 한 겹 더 얹는 밝은 심지. */
const BOND_HEART_CORE = 0xff8a7a;
const FEED_GREEN = 0x7fc47f;
/**
 * 유대로 하나씩 열리는 이야기 네 편.
 *
 * 아직 대사 데이터가 없어 제목과 조건만 둔다. 원문이 생기면 `src/data/dialogues`에 넣고
 * 여기서는 그 id만 가리키게 바꾼다 — 대사를 화면에 적어 두지 않기 위해서다.
 */
const BOND_STORY_STEPS: readonly { level: number; title: string }[] = [
  { level: 2, title: "1화 · 첫 인사" },
  { level: 4, title: "2화 · 사육장의 밤" },
  { level: 7, title: "3화 · 옛 기억의 조각" },
  { level: 10, title: "4화 · 이터널 시티의 끝" },
];

/** 돌파 버튼과 팝업이 함께 쓰는 색. 레벨(초록)과 갈라 놓아 다른 종류의 성장임을 알린다. */
const BREAK_EDGE = 0xa88cf0;

/** 이만큼 누르고 있으면 한 번에 급여 팝업이 열린다(ms). */
const FEED_HOLD_MS = 420;

/** 옆 캐릭터로 넘어가는 데 필요한 가로 이동(px). */
const SWIPE_DISTANCE = 110;

/** 빈 자리가 제 크기에서 물러나는 비율. 셋이 물러나면 사이에 고른 틈이 생긴다. */
const RUNE_GAP = 0.955;

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
  setVisible(visible: boolean): void;
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
  /** 오른쪽 기둥(판과 칸 제목)을 한꺼번에 옮기는 층. */
  private readonly column: Phaser.GameObjects.Container;
  private readonly popups: PopupLayer;
  private readonly keywords: KeywordManager;

  private readonly rarityText: Phaser.GameObjects.Text;
  /** 등급 글자 뒤에 깔리는 같은 모양의 발광. 보석처럼 스스로 빛나 보이게 한다. */
  private readonly rarityGlow: Phaser.GameObjects.Text;
  private readonly nameText: Phaser.GameObjects.Text;
  /** 이름 뒤에 한 겹 어긋나게 깔리는 같은 글자. 겹친 레이어처럼 보이는 그림자다. */
  private readonly nameShadow: Phaser.GameObjects.Text;
  private readonly elementBadge: AffinityBadge;
  private readonly roleBadge: AffinityBadge;
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
  private liveLine?: Phaser.GameObjects.Text;
  private portrait?: PuppetCreature;
  private portraitWanted = false;
  private portraitRequest = 0;
  private figure?: PuppetCreature;
  private figureRequest = 0;
  /** 전신 감상 중일 때 화면을 덮는 종료 판. 없으면 감상 중이 아니다. */
  private gallery?: Phaser.GameObjects.Rectangle;
  /** 좌우 넘김이 진행 중인지. 연달아 밀어도 한 번에 한 명씩만 넘어간다. */
  private sliding = false;
  /** 급여 버튼의 켜짐·꺼짐 판 두 장. */
  /** 돌파 버튼. 레벨 옆에 붙어 지금 뚫을 수 있는지를 진하기로 알린다. */
  private breakButton?: { container: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text };
  private feedPlate?: { on: Phaser.GameObjects.Graphics; off: Phaser.GameObjects.Graphics };
  private feedHold?: Phaser.Time.TimerEvent;
  private feeding = false;
  /** 생성 시 고정한 문맥 덕분에 읽기 전용 창이 도중에 소유자 권한으로 승격되지 않는다. */
  private readonly capabilities: Readonly<InfoCapabilities>;
  private publicProfile?: PublicRelicProfileDto;

  /** 정보창이 닫힐 때 목록 화면이 카드 표시를 다시 맞출 수 있게 알린다. */
  onClose?: () => void;
  /** 급여·돌파가 지갑을 바꾼 직후 소유 씬의 상단 재화 줄을 갱신하는 경계다. */
  onWalletChange?: () => void;

  constructor(private readonly scene: Phaser.Scene, private readonly portraitDepth = 1001, context: InfoContext = "owner") {
    this.capabilities = capabilitiesFor(context);
    this.root = scene.add.container(0, 0).setDepth(1000).setVisible(false);
    this.chrome = scene.add.container(0, 0).setDepth(1002).setVisible(false);
    // 판과 제목은 이 층에 담아 한꺼번에 옮긴다. 자리를 조금 고칠 때마다 수십 개의 좌표를
    // 다시 계산하지 않기 위해서다.
    this.column = scene.add.container(COLUMN.offsetX, COLUMN.offsetY);
    this.chrome.add(this.column);
    this.popups = new PopupLayer(scene, 2000);
    this.keywords = new KeywordManager(scene, this.popups);

    this.root.add(addSceneBackground(scene, BACKGROUND.info, 0));
    this.root.add(scene.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.52).setInteractive());
    this.root.add(drawVignette(scene, BASE_WIDTH, BASE_HEIGHT, { depth: 0, strength: 0.6 }));

    // 인물을 누르는 자리. 코어(중심1) 관절 둘레의 몸통만 받는다. 원화 전체를 입력으로 두면
    // 빈 배경을 눌러도 캐릭터가 튀어 정신이 없다.
    const body = scene.add
      .rectangle(PORTRAIT_FOCUS.x, PORTRAIT_FOCUS.y, 340, 620, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    body.on("pointerup", () => {
      if (this.portrait) playMotion(scene, this.portrait, "hit");
    });
    this.root.add(body);
    this.enableSwipe();

    // 이름줄은 판때기가 아니라 위에서 내려오는 어둠이다. 배경 원화를 자르지 않는다.
    this.chrome.add(drawGlassFade(scene, BASE_WIDTH / 2, 150, BASE_WIDTH, 420, { topAlpha: 0.92, bottomAlpha: 0 }));
    this.rarityGlow = scene.add.text(46, 56, "", textStyle({ role: "display", size: 44 })).setOrigin(0, 0).setAlpha(0.55).setScale(1.06).setBlendMode(Phaser.BlendModes.ADD);
    this.rarityText = scene.add.text(46, 56, "", textStyle({ role: "display", size: 44 })).setOrigin(0, 0);
    // 이름은 같은 글자를 한 겹 어긋나게 깔아 그림자를 만든다. 흐린 그림자보다 또렷하다.
    this.nameShadow = scene.add.text(52, 112, "", textStyle({ role: "display", size: 84, color: "#05070a" })).setOrigin(0, 0).setAlpha(0.85);
    this.nameText = scene.add.text(46, 104, "", textStyle({ role: "display", size: 84 })).setOrigin(0, 0);
    this.roleText = scene.add.text(50, 206, "", textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(0, 0);
    this.chrome.add([this.rarityGlow, this.rarityText, this.nameShadow, this.nameText, this.roleText]);
    // 이름 오른쪽에 속성과 직군을 세운다. 이름 줄에 붙어 있어야 "이 개체가 무엇인지"가 한
    // 덩어리로 읽힌다. 카드와 마찬가지로 속성이 크고 직군이 조금 작다.
    this.elementBadge = new AffinityBadge(scene, 0, 152, ELEMENT_ICON.fire, AFFINITY.main);
    this.roleBadge = new AffinityBadge(scene, 0, 152, ROLE_ICON.warrior, AFFINITY.sub);
    this.chrome.add([this.elementBadge, this.roleBadge]);

    this.bookmarkBadge = this.addBadge(84, 300, "bookmark", BOOKMARK_ON, () => this.toggleBookmark());
    this.favoriteBadge = this.addBadge(176, 300, "heart", FAVORITE_ON, () => this.toggleFavorite());
    this.addJournalButton(268, 300);
    this.addMagnifier(84, 392, () => this.enterGallery());

    this.starRow = scene.add.container(COLUMN.x, 150);
    this.chrome.add(this.starRow);
    this.addMagnifier(COLUMN.x + COLUMN.width / 2 - 30, 158, (from) => this.openAwakening(from));

    // 오른쪽 수치는 칸마다 판을 따로 깐다. 대신 칸의 내용물을 그 판 **안에** 넣어 판과 같은
    // 각도로 함께 기운다. 판만 기울고 글자가 반듯하면 판 위에 종이를 얹어 둔 것처럼 어긋난다.
    const levelPanel = this.addPanel(COLUMN.x, 442, COLUMN.width, 332);
    const bondPanel = this.addPanel(COLUMN.x, 706, COLUMN.width, 144);
    const statPanel = this.addPanel(COLUMN.x, 1024, COLUMN.width, 396);
    const gemPanel = this.addPanel(COLUMN.x, 1398, COLUMN.width, 292);
    // 친구에게는 유대/룬 판을, 적에게는 성장 기둥 전체를 노출하지 않는다.
    bondPanel.setVisible(this.capabilities.showBond);
    gemPanel.setVisible(this.capabilities.mutateProgress);
    if (this.capabilities.showRuntimeCombat) this.column.setVisible(false);

    // 레벨 · 경험치 · 급여.
    this.addSectionTitle("레벨", 442 - 166);
    this.levelValue = scene.add
      .text(COLUMN.x - COLUMN.width / 2 + 54, 300, "", textStyle({ role: "display", size: 96 }))
      .setOrigin(0, 0)
      .setScale(1, 1.16)
      .setShadow(3, 8, "#05070a", 10, false, true);
    // 상한은 숫자의 **발치**에 붙는다. 가운데에 두면 현재 레벨과 같은 무게로 읽혀 헷갈린다.
    this.levelCap = scene.add.text(0, 384, "", textStyle({ role: "emphasis", size: 28, color: COLOR.inkDim })).setOrigin(0, 1);
    this.expBar = new Gauge(scene, COLUMN.x, 452, COLUMN.width - 88, 16, COLOR.accent);
    this.expLabel = scene.add.text(COLUMN.x, 470, "", textStyle({ role: "body", size: 20, color: COLOR.inkDim })).setOrigin(0.5, 0);
    attach(levelPanel, this.levelValue, this.levelCap, ...this.expBar.objects, this.expLabel);
    this.breakButton = this.addBreakButton(COLUMN.x + COLUMN.width / 2 - 96, 330, levelPanel);
    const feed = this.addFeedButton(COLUMN.x, 546, COLUMN.width - 130, 98, levelPanel);
    this.feedButton = feed.container;
    this.feedLabel = feed.label;
    this.feedButton.setVisible(this.capabilities.mutateProgress);
    this.breakButton.container.setVisible(this.capabilities.mutateProgress);

    // 유대.
    const bondHeart = scene.add.container(COLUMN.x - COLUMN.width / 2 + 92, 710);
    // 하트도 별과 같은 방식이다 — 그림자·빛무리·몸통을 겹으로 쌓고 어두운 선으로 마무리한다.
    bondHeart.add(paintBondHeart(scene, BOND_HEART_SIZE));
    this.bondValue = scene.add.text(0, 1, "", textStyle({ role: "display", size: 32 })).setOrigin(0.5);
    bondHeart.add(this.bondValue);
    this.bondBar = new Gauge(scene, COLUMN.x + 40, 718, COLUMN.width - 184, 14, BOND_HEART);
    this.bondLabel = scene.add.text(COLUMN.x - COLUMN.width / 2 + 152, 738, "", textStyle({ role: "body", size: 20, color: COLOR.inkDim })).setOrigin(0, 0);
    attach(bondPanel, bondHeart, ...this.bondBar.objects, this.bondLabel);
    this.addSectionTitle("유대", 706 - 72).setVisible(this.capabilities.showBond);
    this.addMagnifier(COLUMN.x + COLUMN.width / 2 - 30, 686, (from) => this.openBondDetail(from), bondPanel);

    // 능력치.
    this.addSectionTitle("능력치", 1024 - 198);
    this.addMagnifier(COLUMN.x + COLUMN.width / 2 - 30, 876, (from) => this.openExtraStats(from), statPanel);
    STAT_CHIPS.forEach((chip, index) => this.addStatChip(chip, index, statPanel));

    // 하트 젬 — 하트 하나를 셋으로 가른 자리.
    this.addSectionTitle("룬", 1398 - 146).setVisible(this.capabilities.mutateProgress);
    this.addMagnifier(COLUMN.x + COLUMN.width / 2 - 30, 1316, (from) => this.openRuneOverview(from), gemPanel);
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
    this.column.add(panel);
    return panel;
  }

  /**
   * 칸 제목.
   *
   * 판은 기울지만 제목은 기울지 않는다 — 세 칸의 제목이 저마다 다른 각도로 누우면 어느 것이
   * 같은 위계인지 읽히지 않는다. 그래서 판 밖(기울지 않는 층)에 얹고, 셋 다 같은 x에 선다.
   * 왼쪽의 짧은 막대와 아래로 흐르는 얇은 선이 제목을 판에 묶어 준다.
   */
  private addSectionTitle(text: string, panelTop: number): Phaser.GameObjects.Container {
    // 제목은 판의 왼쪽 끝에서 시작해 윗변에 걸터앉는다. 판 안으로 들여놓으면 아래 수치와
    // 한 덩어리로 읽히고, 어중간하게 띄우면 어느 판의 제목인지 흐려진다.
    const left = COLUMN.x - COLUMN.width / 2;
    const y = panelTop - 4;
    const label = this.scene.add
      .text(left + 34, y, text, textStyle({ role: "display", size: 34, color: COLOR.accentText }))
      .setOrigin(0, 0.5);
    const width = label.width + 62;
    const plate = drawLayer(this.scene, left + width / 2 + 8, y, slantedRect(width, 52, 16), {
      fill: 0x05070a,
      alpha: 0.92,
      edge: COLOR.accent,
      edgeAlpha: 0.55,
    });
    const bar = this.scene.add.graphics();
    bar.fillStyle(COLOR.accent, 0.95);
    bar.fillPoints(toPoints(slantedRect(9, 36, 7)).map((point) => new Phaser.Geom.Point(point.x + left + 16, point.y + y)), true);
    const title = this.scene.add.container(0, 0, [plate, bar, label]);
    this.column.add(title);
    return title;
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
      setVisible: (visible) => container.setVisible(visible),
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
    // 자리는 늘 판의 오른쪽 끝 안쪽이다. 끝에 붙어야 "이 칸에 딸린 것"으로 읽히고, 안쪽으로
    // 조금 들여야 기울어진 변에 걸치지 않는다.
    const container = this.scene.add.container(x, y);
    // 작고 흐린 회색이다. 이것은 "더 있다"는 힌트일 뿐이라, 옆의 수치보다 먼저 눈에 들어오면
    // 안 된다. 대신 작아진 만큼 선은 굵게 줘야 형태가 뭉개지지 않는다.
    container.add(drawGlyph(this.scene, "magnifier", 0, 0, 30, 0xb9c0ca, 0.42, 4));
    const hit = this.scene.add.rectangle(x, y, 78, 78, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => container.setScale(1.15));
    hit.on("pointerout", () => { if (!this.popups.isOpen) container.setScale(1); });
    hit.on("pointerup", () => {
      container.setScale(1.15);
      onClick({ x, y: y - 26, onClose: () => container.setScale(1) });
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
    // 켜진 상태와 꺼진 상태를 판 두 장으로 나눠 둔다. 켜진 쪽만 진하게 차오르고 빛나서,
    // 지금 누를 수 있는지가 글자를 읽기 전에 보인다.
    const off = drawLayer(this.scene, 0, 0, shape, { fill: 0x10160f, alpha: 0.55, edge: FEED_GREEN, edgeAlpha: 0.3 });
    const on = drawLayer(this.scene, 0, 0, shape, {
      fill: 0x1f3a24,
      alpha: 0.98,
      edge: 0x9ee6a0,
      edgeAlpha: 1,
      edgeWidth: 4,
      glow: { color: FEED_GREEN, strength: 0.45, height: 0.7 },
    });
    container.add([off, on]);
    const label = this.scene.add.text(0, -20, "급여하기", textStyle({ role: "display", size: 36 })).setOrigin(0.5);
    const hint = this.scene.add.text(0, 16, "치즈케이크 " + FEED_UNIT.cheesecake + " · 꾹 누르면 한 번에", textStyle({ role: "body", size: 18, color: COLOR.inkDim })).setOrigin(0.5);
    container.add([label, hint]);
    const hit = this.scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    let heldFrom = 0;
    hit.on("pointerdown", () => {
      container.setScale(1.04);
      heldFrom = this.scene.time.now;
      void this.feed(1);
      this.feedHold = this.scene.time.addEvent({ delay: 260, loop: true, callback: () => void this.feed(1) });
    });
    const release = (opened: boolean): void => {
      container.setScale(1);
      const held = this.scene.time.now - heldFrom;
      this.feedHold?.remove();
      this.feedHold = undefined;
      // 꾹 누른 손을 뗀 **뒤에** 연다. 누르고 있는 동안 열면 손을 떼는 그 입력이 곧바로
      // 팝업을 닫아 버려 잠깐 번쩍이고 사라진다.
      if (opened && heldFrom > 0 && held >= FEED_HOLD_MS) this.openFeedBulk(x, y + height / 2);
      heldFrom = 0;
    };
    hit.on("pointerup", () => release(true));
    hit.on("pointerout", () => release(false));
    container.add(hit);
    attach(panel, container);
    this.feedPlate = { on, off };
    return { container, label };
  }

  /**
   * 돌파 버튼.
   *
   * 레벨 옆에 붙는다 — 천장을 여는 일이라 레벨과 같은 칸에 있어야 "여기까지가 끝"이라는
   * 맥락이 이어진다. 누르면 필요한 재료를 먼저 보여 주고, 거기서 확정한다.
   */
  private addBreakButton(x: number, y: number, panel: Phaser.GameObjects.Container): { container: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text } {
    const container = this.scene.add.container(x, y);
    const shape = slantedRect(150, 62, 12);
    container.add(drawLayer(this.scene, 0, 0, shape, { fill: 0x24202f, alpha: 0.94, edge: BREAK_EDGE, edgeAlpha: 0.9, glow: { color: BREAK_EDGE, strength: 0.4, height: 0.6 } }));
    const label = this.scene.add.text(0, 0, "돌파", textStyle({ role: "display", size: 30 })).setOrigin(0.5);
    container.add(label);
    const hit = this.scene.add.rectangle(0, 0, 158, 74, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => container.setScale(1.08));
    hit.on("pointerout", () => { if (!this.popups.isOpen) container.setScale(1); });
    hit.on("pointerup", () => {
      container.setScale(1.08);
      this.openBreakthrough({ x, y: y - 40, onClose: () => container.setScale(1) });
    });
    container.add(hit);
    attach(panel, container);
    return { container, label };
  }

  /** 돌파할 수 있는 상태인지 알린다. 재료가 모자라도 눌러 무엇이 필요한지 볼 수 있다. */
  private paintBreakButton(progress: RelicProgress): void {
    const step = nextBreakthrough(progress.breakthrough);
    const ready = this.ownedNow && canBreakThrough(progress, session.wallet);
    this.breakButton?.container.setAlpha(step ? (ready ? 1 : 0.62) : 0.35);
    this.breakButton?.label.setText(step ? "돌파" : "최대");
    this.breakButton?.label.setColor(ready ? COLOR.ink : COLOR.inkDim);
  }

  /** 돌파에 드는 재료와 열리는 상한을 보여 주고 그 자리에서 확정한다. */
  private openBreakthrough(from: PopupSource): void {
    if (!this.capabilities.mutateProgress) return;
    const def = this.currentDef;
    if (!def) return;
    const progress = relicProgression.getProgress(def.id);
    const step = nextBreakthrough(progress.breakthrough);
    this.popups.open({ width: 720, height: 460, title: "돌파", tilt: -1.2, ...anchorOf(from) }, (body, close) => {
      if (!step) {
        body.add(this.scene.add.text(0, 20, "더 뚫을 천장이 없다.", textStyle({ role: "body", size: 28, color: COLOR.inkDim })).setOrigin(0.5));
        return;
      }
      const cap = relicLevelCap(progress.breakthrough);
      body.add(
        this.scene.add
          .text(0, -120, "레벨 상한 " + cap + "  →  " + step.levelCap, textStyle({ role: "display", size: 34, color: COLOR.accentText }))
          .setOrigin(0.5),
      );
      const rows: [string, number, number][] = [
        ["DNA 조각", step.dnaFragments, session.wallet.dnaFragments],
        ["치즈케이크", step.cheesecake, session.wallet.cheesecake],
      ];
      rows.forEach(([label, need, have], index) => {
        const y = -40 + index * 60;
        const enough = have >= need;
        body.add(this.scene.add.text(-280, y, label, textStyle({ role: "body", size: 26, color: COLOR.inkDim })).setOrigin(0, 0.5));
        body.add(
          this.scene.add
            .text(280, y, have.toLocaleString() + " / " + need.toLocaleString(), textStyle({ role: "display", size: 28, color: enough ? COLOR.ink : COLOR.dangerText }))
            .setOrigin(1, 0.5),
        );
      });
      const ready = canBreakThrough(progress, session.wallet);
      const reason = progress.level < cap ? "레벨을 " + cap + "까지 올려야 한다." : ready ? "" : "재료가 부족하다.";
      body.add(drawLayer(this.scene, 0, 130, slantedRect(360, 76, 14), {
        fill: ready ? 0x2d2440 : 0x161a20,
        alpha: ready ? 0.98 : 0.7,
        edge: BREAK_EDGE,
        edgeAlpha: ready ? 1 : 0.25,
      }));
      body.add(this.scene.add.text(0, 130, "돌파하기", textStyle({ role: "display", size: 30, color: ready ? COLOR.ink : COLOR.inkDim })).setOrigin(0.5));
      if (reason) body.add(this.scene.add.text(0, 186, reason, textStyle({ role: "body", size: 21, color: COLOR.inkDim })).setOrigin(0.5));
      if (!ready) return;
      const hit = this.scene.add.rectangle(0, 130, 360, 76, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerup", () => {
        close();
        void this.breakThrough();
      });
      body.add(hit);
    });
  }

  /** 재료 차감과 단계 확정은 서버가 한 처리로 맡는다. 화면은 결과만 다시 그린다. */
  private async breakThrough(): Promise<void> {
    const def = this.currentDef;
    if (!def) return;
    try {
      await gameApi.breakThroughRelic(def.id);
      // 성공한 서버 처리만 알린다. 실패했을 때는 지갑 값이 바뀌지 않는다.
      this.onWalletChange?.();
    } catch {
      // 조건은 화면에서 이미 막는다. 실패하면 상태만 다시 그린다.
    }
    this.refreshGrowth();
  }

  /** 급여를 지금 할 수 있는지에 따라 버튼의 진하기를 바꾼다. */
  private paintFeedButton(enabled: boolean): void {
    this.feedPlate?.on.setAlpha(enabled ? 1 : 0);
    this.feedLabel.setColor(enabled ? COLOR.ink : COLOR.inkDim);
    this.feedButton.setAlpha(enabled ? 1 : 0.7);
  }

  /** 한 번에 여러 레벨을 채우는 쪽지. 급여 버튼 바로 아래에 뜨고 다른 곳을 누를 때까지 남는다. */
  private openFeedBulk(x: number, y: number): void {
    if (this.popups.isOpen) return;
    this.popups.open({ width: 420, height: 190, x, y: y + 120 }, (body, close) => {
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
    const cap = relicLevelCap(progress.breakthrough);
    for (let i = 0; i < levels && level < cap; i += 1) {
      need += Math.ceil((relicExpToNext(level) - exp) / FEED_UNIT.exp);
      level += 1;
      exp = 0;
    }
    await this.feed(Math.max(1, need));
  }

  private async feed(feeds: number): Promise<void> {
    const def = this.currentDef;
    if (!def || !this.ownedNow || this.feeding) return;
    if (!canFeedRelic(relicProgression.getProgress(def.id), session.wallet.cheesecake)) return;
    this.feeding = true;
    try {
      await gameApi.feedRelic(def.id, feeds);
      // 정보창과 상단 줄 모두 확정된 단일 세션 지갑을 읽도록 성공 직후 알린다.
      this.onWalletChange?.();
    } catch {
      // 치즈케이크 부족·상한은 화면에서 이미 막는다. 실패하면 상태만 다시 그린다.
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
    // 어떤 능력치인지는 색으로 알린다. 다만 색을 테두리로 두르면 선이 면 밖으로 튀어나오므로,
    // 칩 안쪽 위에서 아래로 사라지는 발광으로 물들인다.
    }), { fill: 0x11161d, alpha: 0.92, edge: chip.color, edgeAlpha: 0.85, glow: { color: chip.color, strength: 0.42, height: 0.5 } }));
    container.add(this.scene.add.text(0, 2, chip.label, textStyle({ role: "emphasis", size: 21 })).setOrigin(0.5));

    const value = this.scene.add.text(x + 12, y - 26, "", textStyle({ role: "display", size: 36 })).setOrigin(0, 0);
    const gain = this.scene.add.text(x + 12, y + 16, "", textStyle({ role: "body", size: 18, color: COLOR.inkDim })).setOrigin(0, 0);
    this.statValues.push(value);
    this.statGains.push(gain);
    attach(panel, container, value, gain);
  }

  /**
   * 하트 젬(룬) 슬롯.
   *
   * 하트 세 개가 아니라 하트 원화 **하나를 셋으로 가른** 조각이다. 세 조각을 같은 자리에
   * 겹치면 다시 한 장의 하트로 돌아간다 — `scripts/prepare_icons.py`가 항상 같은 중심점을
   * 기준으로 잘라 두었기 때문이다. 등급 색은 `RUNE_ACCENT`가 유일한 기준이다.
   */
  private addGemSlot(index: number, panel: Phaser.GameObjects.Container): GemSlot {
    const center = { x: COLUMN.x - 48, y: 1404 };
    const size = 214;
    // 조각의 대략적인 무게중심. 세 조각이 나뉘는 방향(위 왼쪽·위 오른쪽·아래)을 그대로 따른다.
    const spot = runeSpot(size, index);

    // 등급색 발광 → 조각 그림 순으로 쌓는다. 빈 자리는 발광 없이 어두운 조각만 남는다.
    const glow = this.scene.add
      .image(center.x, center.y, runeTexture(undefined, index))
      .setOrigin(0.5, RUNE_CENTER_Y)
      .setDisplaySize(size * 1.22, size * 1.22)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    const piece = this.scene.add
      .image(center.x, center.y, runeTexture(undefined, index))
      .setOrigin(0.5, RUNE_CENTER_Y)
      .setDisplaySize(size, size);
    // 이름은 하트 오른쪽에 세 줄로 세운다. 조각 안에 넣으면 좁은 면에 글자가 눌려 읽히지 않는다.
    const label = this.scene.add
      .text(center.x + size * 0.62, center.y - 46 + index * 46, "", textStyle({ role: "body", size: 20, color: COLOR.inkDim }))
      .setOrigin(0, 0.5);

    const hit = this.scene.add
      .rectangle(center.x + spot.x, center.y + spot.y, size * 0.42, size * 0.42, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerup", () => this.openGemPicker(index));
    attach(panel, glow, piece, label, hit);

    return {
      paint: (gemId) => {
        const gem = gemId ? getHeartGem(gemId) : undefined;
        piece.setTexture(runeTexture(gem?.rarity, index));
        // 빈 자리는 제 크기보다 조금 오므라들어 조각 사이에 틈이 생긴다. 룬을 끼우면 제
        // 크기로 펴져 틈이 메워지므로, 셋을 다 채우면 이음매 없는 하트 한 장이 된다.
        piece.setDisplaySize(size, size).setScale(piece.scaleX * (gem ? 1 : RUNE_GAP), piece.scaleY * (gem ? 1 : RUNE_GAP));
        if (gem) {
          glow.setTexture(runeTexture(gem.rarity, index)).setTint(RUNE_ACCENT[gem.rarity]).setAlpha(0.4);
          label.setText(index + 1 + "   " + gem.name.replace(" Heart Gem", "")).setColor(COLOR.ink);
        } else {
          glow.setAlpha(0);
          label.setText(index + 1 + "   빈 자리").setColor(COLOR.inkDim);
        }
      },
    };
  }

  /** 칸 하나에 낄 룬을 고르는 가방. 그 칸에 낄 수 있는 것만 늘어놓는다. */
  private openGemPicker(index: number): void {
    if (!this.capabilities.mutateProgress) return;
    const def = this.currentDef;
    if (!def || !this.ownedNow) return;
    this.popups.open({ width: 820, height: 620, title: "룬 가방 · " + (index + 1) + "번 칸", dim: true }, (body, close) => {
      // 가방은 정적 카탈로그가 아니라 실제 보유 인스턴스를 표시하고 슬롯에도 instanceId를 쓴다.
      const owned = session.runeInventory.map((rune) => ({ id: rune.instanceId, name: rune.customName ?? rune.baseName, statPercent: Object.fromEntries([...rune.mainStats, ...rune.subStats].map(({ key, value }) => [key, value])) }));
      const rows: { id: string | null; name: string; effect: string }[] = [
        { id: null, name: "비우기", effect: "" },
        ...owned.map((gem) => ({
          id: gem.id,
          // 칸 이름이 "룬"이므로 가방에서도 룬으로 부른다. 데이터의 정적 이름은 그대로 둔다.
          name: gem.name.replace(" Heart Gem", " 룬"),
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
    this.popups.open({ width: 880, height: 980, title: "관찰 일지", tilt: -1.2, ...anchorOf(from) }, (body, close) => {
      const lines = disclosure.access === "full"
        ? [
            "개체번호   NO." + disclosure.specimenNumber,
            "프로젝트   " + disclosure.projectName,
            "기원         " + disclosure.origin,
            "발굴지      " + disclosure.excavationSite,
          ]
        : ["개체번호   NO." + disclosure.specimenNumber, "프로젝트   기록 없음", "기원         미상", "발굴지      미상"];
      body.add(this.scene.add.text(-380, -386, lines.join("\n"), textStyle({ role: "body", size: 26, lineSpacing: 14 })).setOrigin(0, 0));
      body.add(drawHairline(this.scene, 0, -194, 760, { color: COLOR.accent, alpha: 0.35 }));
      const record = disclosure.access === "full" ? disclosure.record : def.catalogSummary + "\n\n상세 기록은 개체 획득 후 해제됩니다.";
      const text = this.keywords.layout(record, { width: 760, size: 26, lineSpacing: 10 });
      text.setPosition(-380, -158);
      body.add(text);

      // 기존 일지 아래에 날짜·질문·답변·발견 습성을 같은 쪽지 안에서 시간순으로 보여 준다.
      // 작은 쪽지에는 가장 최근 한 건만 두고 전체 이력은 저장에 유지해 내용이 겹치지 않게 한다.
      const entries = observations.recordFor(def.id).slice(-1).reverse();
      body.add(drawHairline(this.scene, 0, 92, 760, { color: COLOR.accent, alpha: 0.35 }));
      body.add(this.scene.add.text(-380, 116, "관찰 인터뷰", textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0, 0));
      if (!entries.length) body.add(this.scene.add.text(-380, 158, "아직 기록된 인터뷰가 없습니다.", textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0, 0));
      entries.forEach((entry, index) => {
        const y = 158 + index * 128;
        const copy = `${entry.date}  ·  #${entry.personalityTag}\nQ. ${entry.question}\nA. ${entry.answer}\n발견  ${entry.discoveredHabit}`;
        body.add(this.scene.add.text(-380, y, copy, textStyle({ role: "body", size: 20, color: COLOR.ink, lineSpacing: 4 })).setOrigin(0, 0));
      });

      // 초기 버전은 공용 질문을 일지에서 바로 답하게 해 별도 대형 화면 제작을 피한다.
      const utcDate = new Date().toISOString().slice(0, 10);
      if (this.ownedNow && observations.canStart(def.id, utcDate)) {
        const question = observationQuestionForDate(utcDate);
        const y = entries.length ? 300 : 238;
        body.add(this.scene.add.text(-380, y, "오늘의 질문  " + question.prompt, textStyle({ role: "emphasis", size: 21, color: COLOR.accentText })).setOrigin(0, 0));
        question.choices.forEach((choice, index) => {
          const buttonY = y + 64 + index * 54;
          body.add(drawLayer(this.scene, 0, buttonY, slantedRect(740, 44, 12), { fill: 0x141a22, alpha: 0.92, edge: COLOR.accent, edgeAlpha: 0.4 }));
          body.add(this.scene.add.text(-350, buttonY, choice.label, textStyle({ role: "body", size: 20 })).setOrigin(0, 0.5));
          const hit = this.scene.add.rectangle(0, buttonY, 740, 44, 0xffffff, 0).setInteractive({ useHandCursor: true });
          hit.on("pointerup", () => { observations.complete(def.id, utcDate, choice.id); close(); this.openJournal(from); this.refreshGrowth(); });
          body.add(hit);
        });
      }
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

  /**
   * 좌우로 밀어 옆 캐릭터로 넘긴다.
   *
   * 도감에서 하나씩 닫았다 여는 대신 손가락 한 번으로 옆으로 간다. 전투에서 연 정보창은
   * 그 유닛의 것이므로 넘기지 않는다.
   */
  private enableSwipe(): void {
    let start: { x: number; y: number } | undefined;
    this.scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      start = this.root.visible ? { x: pointer.x, y: pointer.y } : undefined;
    });
    this.scene.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      const from = start;
      start = undefined;
      if (!from || !this.root.visible || this.popups.isOpen || this.gallery) return;
      const dx = pointer.x - from.x;
      // 세로로 더 많이 움직였으면 넘기지 않는다. 목록을 훑다가 실수로 넘어가지 않게 한다.
      if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(pointer.y - from.y) > Math.abs(dx) * 0.8) return;
      this.slideToNeighbor(dx < 0 ? 1 : -1);
    });
  }

  /** 옆 캐릭터로 미끄러져 간다. 판이 한쪽으로 빠지고 반대쪽에서 새로 들어온다. */
  private slideToNeighbor(step: 1 | -1): void {
    const current = this.currentDef;
    if (!current || this.sliding) return;
    const order = RELICS;
    const index = order.findIndex((def) => def.id === current.id);
    if (index === -1) return;
    const next = order[(index + step + order.length) % order.length];
    this.sliding = true;
    const distance = 150 * step;
    this.scene.tweens.add({
      targets: this.chrome,
      x: -distance,
      alpha: 0,
      duration: 150,
      ease: "Cubic.In",
      onComplete: () => {
        this.openCharacter(next, relicCollection.owns(next.id));
        this.chrome.setPosition(distance, 0).setAlpha(0);
        this.scene.tweens.add({
          targets: this.chrome,
          x: 0,
          alpha: 1,
          duration: 260,
          ease: "Cubic.Out",
          onComplete: () => { this.sliding = false; },
        });
      },
    });
  }

  /**
   * 전신 감상.
   *
   * 수치를 읽는 화면과 인물을 보는 화면은 목적이 다르다. 판을 흐리게 지우는 대신 **화면
   * 바깥으로 밀어내고** 원화만 가운데로 옮겨 크게 세운다. 아무 데나 누르면 되돌아온다.
   */
  private enterGallery(): void {
    const def = this.currentDef;
    if (!def || this.gallery || !this.portrait) return;
    const asset = portraitAssetFor(def.portraitAssetId);
    const portrait = this.portrait;
    // 되돌릴 때 쓸 원래 자리. 화면 크기가 바뀌지 않으므로 값 하나면 충분하다.
    const before = { x: portrait.x, y: portrait.y, scale: portrait.scaleX };
    placePuppet(portrait, asset, {
      focus: { anchor: "core", x: BASE_WIDTH / 2, y: BASE_HEIGHT * 0.52 },
      height: BASE_HEIGHT * 1.02,
    });
    portrait.setAlpha(0.001);
    this.scene.tweens.add({ targets: portrait, alpha: 1, duration: 260 });
    // SD는 판이 아니라 따로 선 인형이라 함께 빠지지 않는다. 감상 중에는 접어 둔다.
    this.figure?.setVisible(false);
    // 판은 오른쪽으로, 이름줄과 스킬은 그대로 두면 인물을 가리므로 chrome 통째로 민다.
    this.scene.tweens.add({ targets: this.chrome, x: BASE_WIDTH, alpha: 0, duration: 320, ease: "Cubic.In" });
    const exit = this.scene.add
      .rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, 0xffffff, 0)
      .setDepth(1600)
      .setInteractive({ useHandCursor: true });
    exit.on("pointerup", () => this.leaveGallery(before));
    this.gallery = exit;
  }

  /** 감상에서 나온다. 판이 다시 제자리로 미끄러져 들어온다. */
  private leaveGallery(before: { x: number; y: number; scale: number }): void {
    const portrait = this.portrait;
    this.gallery?.destroy();
    this.gallery = undefined;
    if (portrait) {
      this.scene.tweens.add({ targets: portrait, x: before.x, y: before.y, scale: before.scale, duration: 320, ease: "Cubic.Out" });
    }
    this.scene.tweens.add({ targets: this.chrome, x: 0, alpha: 1, duration: 320, ease: "Cubic.Out" });
    this.figure?.setVisible(this.portraitWanted && this.root.visible);
  }

  /**
   * 유대가 지금 무엇을 얼마나 바꾸고 있는지.
   *
   * 게이지 옆의 "+5%" 한 줄로는 무엇이 5% 오르는지 알 수 없다. 지금 레벨의 효과와 다음
   * 레벨의 효과를 나란히 두고, 아래에 지금까지 열린 이야기를 함께 건다.
   */
  private openBondDetail(from: PopupSource): void {
    const def = this.currentDef;
    if (!def) return;
    const progress = relicProgression.getProgress(def.id);
    const level = progress.bondLevel;
    const next = Math.min(BOND_LEVEL_CAP, level + 1);
    this.popups.open({ width: 820, height: 900, title: "유대 " + level + " / " + BOND_LEVEL_CAP, tilt: -1.2, ...anchorOf(from) }, (body) => {
      const rows: [string, string, string][] = [
        ["야성 상승", "+" + Math.round((BOND_FEROCITY_MULTIPLIER[level] - 1) * 100) + "%", "+" + Math.round((BOND_FEROCITY_MULTIPLIER[next] - 1) * 100) + "%"],
        ["로비 상호작용", "하루 한 번 " + BOND_XP_REWARD.firstLobbyInteraction + " EXP", "같음"],
        ["전투 승리", "편성 렐릭 전원 " + BOND_XP_REWARD.partyVictory + " EXP", "같음"],
      ];
      body.add(this.scene.add.text(-350, -368, "지금", textStyle({ role: "emphasis", size: 22, color: COLOR.accentText })).setOrigin(0, 0.5));
      body.add(this.scene.add.text(348, -368, "다음 단계", textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(1, 0.5));
      rows.forEach(([label, now, later], index) => {
        const y = -300 + index * 84;
        body.add(this.scene.add.text(-350, y - 18, label, textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(0, 0));
        body.add(this.scene.add.text(-350, y + 14, now, textStyle({ role: "display", size: 28 })).setOrigin(0, 0));
        body.add(this.scene.add.text(348, y + 14, later, textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(1, 0));
        body.add(drawHairline(this.scene, 0, y + 56, 700, { color: COLOR.accent, alpha: 0.14 }));
      });
      body.add(this.scene.add.text(-350, -20, "유대 이야기", textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0, 0));
      // 이야기는 유대 레벨로 하나씩 열린다. 아직 잠긴 것도 자리를 보여 줘 다음 목표가 된다.
      BOND_STORY_STEPS.forEach((step, index) => {
        const y = 46 + index * 92;
        const open = level >= step.level;
        body.add(drawLayer(this.scene, 0, y + 30, slantedRect(700, 76, 14), {
          fill: open ? 0x1a2130 : 0x0d1219,
          alpha: open ? 0.95 : 0.7,
          edge: COLOR.accent,
          edgeAlpha: open ? 0.6 : 0.16,
        }));
        body.add(this.scene.add.text(-318, y + 12, step.title, textStyle({ role: "display", size: 26, color: open ? COLOR.ink : COLOR.inkDim })).setOrigin(0, 0));
        body.add(
          this.scene.add
            .text(318, y + 18, open ? "열림" : "유대 " + step.level + " 필요", textStyle({ role: "body", size: 21, color: open ? COLOR.accentText : COLOR.inkDim }))
            .setOrigin(1, 0),
        );
      });
    });
  }

  /** 세 룬을 한 장에 펼쳐 무엇이 얼마나 붙었는지 한 번에 본다. */
  private openRuneOverview(from: PopupSource): void {
    const def = this.currentDef;
    if (!def) return;
    const slots = relicProgression.getProgress(def.id).heartGemSlots;
    this.popups.open({ width: 800, height: 620, title: "룬 세 자리", tilt: -1.2, ...anchorOf(from) }, (body) => {
      slots.forEach((gemId, index) => {
        const y = -180 + index * 130;
        const gem = gemId ? getHeartGem(gemId) : undefined;
        body.add(drawLayer(this.scene, 0, y, slantedRect(680, 108, 16), {
          fill: gem ? 0x1c1520 : 0x0d1219,
          alpha: gem ? 0.95 : 0.7,
          edge: gem ? RUNE_ACCENT[gem.rarity] : COLOR.accent,
          edgeAlpha: gem ? 0.7 : 0.16,
        }));
        body.add(this.scene.add.text(-306, y - 26, index + 1 + "번 칸", textStyle({ role: "body", size: 20, color: COLOR.inkDim })).setOrigin(0, 0));
        body.add(
          this.scene.add
            .text(-306, y + 2, gem ? gem.name.replace(" Heart Gem", " 룬") : "빈 자리", textStyle({ role: "display", size: 28, color: gem ? COLOR.ink : COLOR.inkDim }))
            .setOrigin(0, 0),
        );
        if (gem) {
          const effect = Object.entries(gem.statPercent).map(([key, percent]) => (STAT_LABEL[key] ?? key) + " +" + percent + "%").join("   ");
          body.add(this.scene.add.text(306, y + 8, effect, textStyle({ role: "emphasis", size: 22, color: COLOR.accentText })).setOrigin(1, 0));
        }
      });
      const filled = slots.filter(Boolean).length;
      body.add(
        this.scene.add
          .text(0, 240, filled === 3 ? "세 조각이 모두 맞물렸다." : "채운 자리 " + filled + " / 3", textStyle({ role: "emphasis", size: 24, color: COLOR.accentText }))
          .setOrigin(0.5),
      );
    });
  }

  /** 공격 속도처럼 자주 보지 않는 수치는 돋보기 안에만 둔다. */
  private openExtraStats(from: PopupSource): void {
    const def = this.currentDef;
    if (!def) return;
    const stats = relicProgression.getFinalStats(def.id);
    this.popups.open({ width: 800, height: 900, title: "능력치 상세", tilt: -1.2, ...anchorOf(from) }, (body) => {
      // 위쪽은 다섯 축을 한눈에 견주는 오각형이다. 숫자 다섯 줄보다 "무엇이 센 개체인지"가
      // 먼저 읽힌다. 아래쪽은 그 오각형에 들어가지 않는 세부 수치를 따로 모은 칸이다.
      const radar = new StatRadar(this.scene, 0, -210, 148);
      radar.draw(stats, 148);
      body.add(radar);
      body.add(drawHairline(this.scene, 0, -6, 660, { color: COLOR.accent, alpha: 0.35 }));
      body.add(
        this.scene.add
          .text(-330, 16, "세부 능력치", textStyle({ role: "emphasis", size: 24, color: COLOR.accentText }))
          .setOrigin(0, 0),
      );
      EXTRA_STATS.forEach((row, index) => {
        const y = 90 + index * 74;
        body.add(this.scene.add.text(-330, y, row.label, textStyle({ role: "body", size: 26, color: COLOR.inkDim })).setOrigin(0, 0.5));
        body.add(this.scene.add.text(330, y, stats[row.key].toLocaleString() + (row.suffix ?? ""), textStyle({ role: "display", size: 30 })).setOrigin(1, 0.5));
        if (index < EXTRA_STATS.length - 1) body.add(drawHairline(this.scene, 0, y + 37, 660, { color: COLOR.accent, alpha: 0.14 }));
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
    if (!this.capabilities.mutateProgress) return;
    if (!this.currentDef || !this.ownedNow) return;
    relicCollection.toggleBookmark(this.currentDef.id);
    this.refreshBadges();
  }

  private toggleFavorite(): void {
    if (!this.capabilities.mutateProgress) return;
    if (!this.currentDef || !this.ownedNow) return;
    relicCollection.setFavorite(this.currentDef.id);
    this.refreshBadges();
  }

  private refreshBadges(): void {
    if (!this.capabilities.mutateProgress) {
      // 읽기 전용 문맥에서는 애착/즐겨찾기 입력 객체 자체를 화면에서 제거한다.
      this.bookmarkBadge.setVisible(false);
      this.favoriteBadge.setVisible(false);
      return;
    }
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
    // 화면 아무 데나 눌러도 통통 튀면 정신이 없다. 코어 관절 둘레의 몸통에서만 반응한다.
    portrait.disableInteractive();
    if (portraitUsesRelicTint(def.portraitAssetId)) tintPuppet(portrait, mixWhite(tintFor(def.id), 0.55));
    portrait.setVisible(this.portraitWanted && this.root.visible);
    // 새 인물은 살짝 떠오르며 나타난다. 좌우로 넘길 때 갈아 끼우는 티가 덜 난다.
    portrait.setAlpha(0);
    this.scene.tweens.add({ targets: portrait, alpha: 1, duration: 220 });
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
      if (index === 0) this.addFerocityBadge(container.x, container.y - size / 2 - 56, def);
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
  private addFerocityBadge(x: number, y: number, def: RelicDef): void {
    // 스킬 아이콘의 자식으로 두면 아이콘을 눌러 커질 때 뱃지까지 함께 커져, 패시브를 눌렀는데
    // 야성까지 눌린 것처럼 보인다. 자리만 아이콘 위로 잡고 층은 따로 세운다.
    const badgeSize = 72;
    const badge = this.scene.add.container(x, y);
    const shape = chipPoints(badgeSize, badgeSize, {
      bevel: { topLeft: badgeSize * 0.34, topRight: 0, bottomRight: badgeSize * 0.34, bottomLeft: 0 },
    });
    badge.add(drawLayer(this.scene, 0, 0, shape, { fill: FEROCITY_BADGE, alpha: 0.96, edge: 0xf0a58a, edgeAlpha: 0.8 }));
    badge.add(drawGlyph(this.scene, "ferocity", 0, 1, badgeSize * 0.56, 0xffd9c4));
    // 입력 영역도 뱃지 크기에 딱 맞춘다. 넓게 잡으면 아래 아이콘의 터치를 가로챈다.
    const hit = this.scene.add.rectangle(0, 0, badgeSize, badgeSize, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => badge.setScale(1.1));
    hit.on("pointerout", () => { if (!this.popups.isOpen) badge.setScale(1); });
    hit.on("pointerup", () => {
      badge.setScale(1.1);
      this.openFerocityTrait(def, { x, y: y - badgeSize / 2 - 12, onClose: () => badge.setScale(1) });
    });
    badge.add(hit);
    this.chrome.add(badge);
    // 스킬 아이콘과 같은 목록에 담아 미보유 개체에서 함께 숨고 다시 그릴 때 함께 지워진다.
    this.skillIcons.push(badge);
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

  /** 읽기 전용 도감에 실제 방어력을 가정하지 않은 스킬 능력치 배율을 만든다. */
  private skillViewModel(kindLabel: string, skill: Skill, gaugeCost?: number): SkillInfoViewModel {
    const attacker: Combatant | undefined = this.currentDef && {
      def: this.currentDef, hp: this.currentDef.stats.hp, maxHp: this.currentDef.stats.hp,
      energy: 0, ferocity: 0, bondLevel: 0, ferocityFever: false,
      awakening: relicProgression.getProgress(this.currentDef.id).awakening,
    };
    const preview = attacker && kindLabel !== "패시브" ? previewSkillDamage(attacker, skill) : undefined;
    const valueLabel = preview?.kind === "scaling"
      ? preview.label + "  " + preview.stat + " " + preview.power + "% (도감 기준)"
      : undefined;
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
    this.publicProfile = undefined;
    this.openCharacter(def, owned);
  }

  /** 친구 서버가 공개한 스냅샷만 사용하며 로컬 `session.relicProgress`는 읽지 않는다. */
  showFriend(profile: PublicRelicProfileDto): void {
    this.publicProfile = profile;
    const def = RELICS.find((relic) => relic.id === profile.relicId);
    if (!def) throw new Error(`알 수 없는 공개 렐릭 id: ${profile.relicId}`);
    this.openCharacter(def, true);
  }

  /** 전투 스냅샷에서 허용된 현재 게이지와 상태이상만 헤더에 붙이는 적 전용 진입점이다. */
  showEnemy(fighter: Fighter): void {
    this.publicProfile = { relicId: fighter.def.id, level: 1, stars: 0, stats: { ...fighter.def.stats }, skillIds: [fighter.def.basic.id, fighter.def.passive.id, fighter.def.ultimate.id] };
    this.openCharacter(fighter.def, true);
    const ailment = fighter.bleed ? `  ·  출혈 ${Math.ceil(fighter.bleed.remaining)}초` : "  ·  상태이상 없음";
    this.roleText.setText(`${ELEMENT_LABEL[fighter.def.element]} · ${ROLE_LABEL[fighter.def.role]}  ·  HP ${Math.ceil(fighter.hp)}/${fighter.maxHp}  ·  궁극 ${Math.round(fighter.energy)}  ·  야성 ${Math.round(fighter.ferocity)}${ailment}`);
  }

  /** 정적 렐릭 정의만 받아 읽기 전용 상세 화면의 상태를 교체한다. */
  private openCharacter(def: RelicDef, owned = true): void {
    this.currentDef = def;
    this.ownedNow = owned;
    this.popups.closeAll();

    this.paintRarity(owned ? def.rarity : undefined);
    this.nameText.setText(owned ? def.name : "미발굴 개체");
    this.nameShadow.setText(this.nameText.text);
    // 이름 폭이 캐릭터마다 다르므로 뱃지 자리도 그릴 때마다 이름 끝에서 다시 잡는다.
    const badgeLeft = this.nameText.x + this.nameText.width + AFFINITY.gap;
    this.elementBadge.setIcon(ELEMENT_ICON[def.element], AFFINITY.main).setPosition(badgeLeft + AFFINITY.main / 2, 152).setVisible(owned);
    this.roleBadge.setIcon(ROLE_ICON[def.role], AFFINITY.sub).setPosition(badgeLeft + AFFINITY.main + AFFINITY.sub / 2 + 12, 158).setVisible(owned);
    // 속성과 직군은 옆의 아이콘이 말한다. 같은 것을 글자로 또 적으면 줄만 길어진다.
    this.roleText.setText("NO." + def.specimenNumber + (owned ? "   " + def.origin : "   실루엣 기록"));
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
  }

  /**
   * 등급 글자를 보석처럼 칠한다.
   *
   * SSR은 황금 호박, SR은 보랏빛에서 분홍으로 넘어가는 결, R은 청량한 푸른빛이다. 색만
   * 바꾸면 그냥 색 글씨라, 위아래로 색이 흐르는 결과 뒤에 깔리는 같은 색 발광을 함께 쓴다.
   */
  private paintRarity(rarity?: RelicRarity): void {
    const stops = rarity ? RARITY_GEM[rarity] : ["#9aa3ad", "#6f7681", "#4a5058"] as const;
    this.rarityText.setText(rarity ?? "???");
    this.rarityGlow.setText(rarity ?? "???").setColor(stops[1]);
    // 글자 높이를 따라 색이 흐르게 한다. Phaser Text는 캔버스 채우기를 그대로 받는다.
    const gradient = this.rarityText.context.createLinearGradient(0, 0, 0, this.rarityText.height);
    gradient.addColorStop(0, stops[0]);
    gradient.addColorStop(0.55, stops[1]);
    gradient.addColorStop(1, stops[2]);
    this.rarityText.setFill(gradient);
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
    // 공개 프로필은 필요한 표시용 기본값도 DTO로부터 만들며 플레이어 저장을 건드리지 않는다.
    const progress: RelicProgress = this.publicProfile
      ? { level: this.publicProfile.level, exp: 0, awakening: 0, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, null, null] }
      : relicProgression.getProgress(def.id);
    const finalStats = this.publicProfile?.stats ?? relicProgression.getFinalStats(def.id);
    const cap = relicLevelCap(progress.breakthrough);
    const maxed = progress.level >= cap;

    this.levelValue.setText(String(progress.level));
    this.levelCap.setText("/ " + cap);
    // 숫자 폭이 자리 수에 따라 달라지므로 붙는 자리도 그릴 때마다 다시 잡는다.
    this.levelCap.setX(this.levelValue.x + this.levelValue.displayWidth + 14);
    const need = maxed ? 0 : relicExpToNext(progress.level);
    this.expBar.setValue(maxed ? 1 : progress.exp / need);
    // 보유 치즈케이크는 상단 줄 한 곳에서만 보여 중복되거나 서로 다른 시점의 값이 보이지 않게 한다.
    this.expLabel.setText(maxed ? "MAX" : progress.exp + " / " + need + " EXP");
    this.paintFeedButton(this.ownedNow && canFeedRelic(progress, session.wallet.cheesecake));
    this.feedLabel.setText(maxed ? "최대 레벨" : "급여하기");
    this.paintBreakButton(progress);

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

/**
 * 룬 조각의 대략적인 무게중심(px, `center` 기준 상대 좌표).
 *
 * 실제 자르는 각도는 `scripts/prepare_icons.py`의 `RUNE_CUTS`가 정한다. 여기서는 그 세 구간의
 * 가운데 각도만 그대로 옮겨, 손이 닿을 자리와 이름표를 놓을 자리로 쓴다.
 */
function runeSpot(size: number, index: number): { x: number; y: number } {
  const midDegrees = [210, 330, 90][index];
  const radius = size * 0.3;
  const rad = Phaser.Math.DegToRad(midDegrees);
  return { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius };
}
