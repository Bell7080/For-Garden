import Phaser from "phaser";
import type { PuppetCreature } from "../puppets/assets";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import type { Combatant } from "../core/combatTypes";
import { RUNE_PART_LABELS, RUNE_RARITY_LABELS, type RunePart } from "../core/runes";
import { previewSkillDamage } from "../core/damage";
import type { BasicAttack, Element, RelicDef, RelicProgress, RelicRarity, Role, Passive, Skill, SkillIconAssetId, Stats, Ultimate } from "../core/types";
import { setDebugFeedButton, setDebugInfoOpen } from "../debug";
import { formatCurrency } from "../core/formatCurrency";
import { RELICS } from "../data/relics";
import { KeywordManager } from "../managers/KeywordManager";
import { relicProgression } from "../managers/RelicProgressionManager";
import {
  battleAssetFor,
  enableHitOnClick,
  placePuppet,
  playMotion,
  portraitAssetFor,
  spawnPuppet,
} from "../puppets/assets";
import { addPopupBackgroundImage, addSceneBackground, BACKGROUND } from "./backgrounds";
import { addBackButton } from "./IconButton";
import { chipPoints, drawGlassFade, drawHairline, drawInnerVignette, drawLayer, drawShapeEdge, drawShapeOutline, drawVignette, HOLO, perspectiveRect, slantedRect, toPoints } from "./holo";
import { drawGlyph } from "./glyphs";
import { PopupLayer } from "./PopupLayer";
import { calculateObservationJournalFlow, OBSERVATION_JOURNAL_SIZE, withoutRepeatedProfileDetails } from "./observationJournalLayout";
import { AffinityBadge } from "./AffinityBadge";
import { ELEMENT_ICON, ROLE_ICON } from "./affinityIcons";
import { addStarMark } from "./rarityMark";
import { addMarkChip } from "./MarkChip";
import { addRuneCard, addRuneFrame, RUNE_ACCENT, RUNE_CENTER_Y, runeTexture } from "./runeIcons";
import { REACH_LABEL, STAT_TONE, reachToneHex } from "./statTones";
import { equippedRelicName, openRuneInfoPopup, RUNE_STAT_LABEL } from "./RunePopup";
import { combatPower } from "../core/combatPower";
import { StatRadar } from "./StatRadar";
import { addSectionTitle } from "./SectionTitle";
import { openSkillPopup, type SkillInfoViewModel } from "./SkillPopup";
import { relicCollection } from "../managers/RelicCollectionManager";
import { COLOR, textStyle } from "./theme";
import { FALLBACK_SKILL_ICON } from "./skillIcons";
import { skillArtFor, skillArtTint, SKILL_ART_WASH_ALPHA, type SkillArtSlot } from "./skillArt";
import { gameApi } from "../api/FakeServer";
import { BREAKTHROUGH_STEPS, canBreakThrough, canFeedRelic, FEED_UNIT, nextBreakthrough, relicExpToNext, relicLevelCap, RELIC_STAR_CAP, relicStars } from "../core/relicProgression";
import { session } from "../state/session";
import { BOND_FEROCITY_MULTIPLIER, BOND_LEVEL_CAP, BOND_TOTAL_XP_BY_LEVEL, BOND_XP_REWARD } from "../core/bond";
import { getRelicCatalogDisclosure } from "../core/relicCatalog";
import { observations } from "../managers/ObservationManager";
import { clampObservationPage, sortedObservationHistory } from "./observationHistory";
import { observationQuestionForRelicAndDate } from "../data/observations";
import type { PublicRelicProfileDto } from "../api/contracts";
import type { Fighter } from "../core/skirmish";
import { capabilitiesFor, type InfoCapabilities, type InfoContext } from "../core/infoCapabilities";
import { allyHealPowerKeyword, attackSpeedCompositeDamageKeyword, canPreviewSkillDamage, damageKeyword, ferocityTraitDescription, passiveDescription, overpaintDetonationDamageKeyword, passiveShieldKeyword, skillDescription } from "./skillPresentation";
import type { KeywordDef } from "../data/keywords";
import { addFactionMark, factionMarkBounds } from "./FactionMark";
import { SQUADS } from "../data/factions";
import { OBSERVATION_INTERVIEW_LAYOUT, observationInterviewPanelState, type ObservationInterviewPanelState } from "./observationInterviewPanel";
import { INFO_PORTRAIT_FOCUS, infoPortraitPlacement } from "./portraitPlacement";

export type { SkillInfoViewModel } from "./SkillPopup";

export { capabilitiesFor, type InfoCapabilities, type InfoContext } from "../core/infoCapabilities";
// 관찰 일지 크기 표는 공용 정보 UI의 공개 계약으로 내보내 테스트와 후속 작업이 같은 값을 쓴다.
export { OBSERVATION_JOURNAL_SIZE } from "./observationJournalLayout";

/**
 * 관찰 일지 우상단의 소속 표식 자리.
 *
 * 전용 크기 표가 정한 확장 판의 안쪽 모서리다. 원화 클립은 좌상단·우하단만 깎으므로 **우상단은 직각**이라
 * 표식이 모서리에 바짝 붙어도 사선에 잘리지 않는다. 제목 줄은 판 윗변에 걸터앉으므로 표식은
 * 그보다 아래로 내려 세운다.
 */
/** 기존 관찰 일지 엠블럼 대비 30% 확대. 배율을 분리해 기준 크기와 의도를 함께 보존한다. */
const JOURNAL_SQUAD_MARK_SCALE = 1.3;
const JOURNAL_SQUAD_MARK = {
  size: 104 * JOURNAL_SQUAD_MARK_SCALE,
  // 가장 넓은 정사각 엠블럼의 복제 그림자도 본문 오른쪽 안전선 안에 남기는 중심 좌표다.
  x: 320,
  nameGap: 12,
  metadataGap: 24,
} as const;

// 일지 원화는 정보보다 먼저 읽히지 않을 만큼 낮추고, 어두운 페이드는 본문 대비를 보존한다.
const JOURNAL_ART_ALPHA = 0.18;
const JOURNAL_TEXT_FADE_ALPHA = 0.42;

/** 전신 원화가 서는 자리. 정보창의 주인공은 캐릭터라 값은 순수 배치 모듈이 소유한다. */
const PORTRAIT_FOCUS = INFO_PORTRAIT_FOCUS;

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
  SSR: ["#fff3c4", "#ffc247", "#c78a1c"],
  SR: ["#ffe2ff", "#e070f5", "#9b3fc0"],
  R: ["#e8fbff", "#5fd4ff", "#2f9ad4"],
};

/** 이름 옆 속성·직군 뱃지의 크기와 이름에서 띄우는 간격. */
const AFFINITY = { main: 96, sub: 72, gap: 30 } as const;

/** 능력치 칸에 서는 오각형의 반지름. 축 이름까지 판 안에 들어오는 크기다. */
const STAT_RADAR_RADIUS = 128;

/** 정보창의 등급 표식 기준 크기. 로마자 한 글자가 이 두 배 높이로 선다. */
const STAR_SIZE = 34;

/**
 * 야성 뱃지의 색.
 *
 * 게이지가 끓는 쪽이라 붉은 기가 돌되, 스킬 액자와 나란히 설 때 혼자 새빨갛게 튀지 않도록
 * 채도를 덜어 둔다. 강조는 색이 아니라 살구빛 테두리와 발광이 맡는다.
 */
const FEROCITY_BADGE = 0x4b2f2b;
/** 유대 하트와 급여 버튼의 색. 하트는 반투명하게 겹쳐 발광하는 붉은 빛으로 쓴다. */
const BOND_HEART = 0xe23a46;
/** 하트 안쪽에 한 겹 더 얹는 밝은 심지. */
const BOND_HEART_CORE = 0xff8a7a;
/**
 * 급여 버튼의 색.
 *
 * 치즈케이크의 노란빛을 그대로 쓴다. 무엇을 먹이는 버튼인지가 글자를 읽기 전에 보여야 하기
 * 때문이다. 판의 생김새는 다른 판과 같다 — 반투명한 유리에 살짝 기운 면이다.
 */
const FEED_AMBER = 0xf0b429;
/** 판 안쪽에 파인 자리의 치즈케이크 수. 그 자리는 어둡게 눌러 두므로 크림빛으로 적는다. */
const FEED_TEXT = "#ffe9c9";

/**
 * 급여에 쓰는 치즈케이크 한 조각.
 *
 * 상단 재화 줄과 같은 그림 파일을 쓰고, 그림자를 한 겹 깔아 같은 방식으로 앉는다. 급여는
 * 치즈케이크를 먹이는 일이므로 버튼과 팝업 어디서든 수치 옆에 이 그림이 함께 선다.
 */
function cheesecakeIcon(scene: Phaser.Scene, x: number, y: number, size: number): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  container.add(scene.add.image(3, 4, "currency-cheesecake").setDisplaySize(size, size).setTint(0x05070a).setAlpha(0.55));
  container.add(scene.add.image(0, 0, "currency-cheesecake").setDisplaySize(size, size));
  return container;
}

/**
 * 치즈케이크 값줄 — `아이콘 가진 수/드는 수`.
 *
 * 급여 버튼과 한 번에 급여 팝업이 같은 줄을 쓴다. 아이콘은 **하나만** 크게 세우고 두 수를
 * 빗금으로 묶는다. 아이콘을 수마다 하나씩 붙이면 같은 재화가 둘로 보이고, 빗금 없이 떼어 놓으면
 * "가진 것"과 "나가는 것"이 서로 다른 값처럼 읽힌다.
 *
 * 판 안에 한 겹 더 파인 자리를 두는 이유는 이 줄이 버튼 라벨보다 크기 때문이다 — 눌러야 할
 * 판과 읽어야 할 수가 같은 높이에 있으면 어느 쪽이 버튼인지 흐려진다.
 */
function feedCostRow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  size: number,
): { container: Phaser.GameObjects.Container; text: Phaser.GameObjects.Text; layout: () => void } {
  const container = scene.add.container(x, y);
  container.add(drawLayer(scene, 0, 0, slantedRect(width, height, 8), { fill: 0x1a1408, alpha: 0.66, edge: FEED_AMBER, edgeAlpha: 0.22 }));
  const icon = Math.round(height * 0.86);
  // 아이콘과 수는 바짝 붙는다. 멀리 떼면 "치즈케이크"와 "숫자"가 두 정보로 읽힌다.
  const gap = Math.round(icon * 0.12);
  // 아이콘과 수를 한 덩어리로 담아 통째로 가운데에 세운다. 아이콘을 판 왼쪽 끝에 붙이면
  // 자릿수가 적을 때 값이 왼쪽으로 쏠려 판 오른쪽이 휑하게 빈다.
  const group = scene.add.container(0, 0);
  group.add(cheesecakeIcon(scene, 0, 0, icon));
  // 세로로만 늘여 굵고 크게 보이게 한다. 가로까지 키우면 자릿수가 늘 때 판을 넘는다.
  const text = scene.add.text(icon / 2 + gap, 1, "", textStyle({ role: "display", size, color: FEED_TEXT })).setOrigin(0, 0.5).setScale(1, 1.14);
  group.add(text);
  container.add(group);
  // 값이 바뀌면 폭도 바뀌므로 다시 부른다. 덩어리의 왼쪽 끝은 아이콘 반쪽이다.
  const layout = (): void => { group.setX(-(gap + text.width) / 2); };
  layout();
  return { container, text, layout };
}
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
  { key: "hp", label: "체력", color: STAT_TONE.hp },
  { key: "atk", label: "공격", color: STAT_TONE.atk },
  { key: "def", label: "방어", color: STAT_TONE.def },
  { key: "res", label: "저항", color: STAT_TONE.res },
  { key: "ap", label: "주문", color: STAT_TONE.ap },
];

/**
 * 장착용 룬 가방의 격자.
 *
 * 가방(`INVENTORY_LAYOUT`)과 같은 카드 크기·같은 칸 간격을 쓴다. 같은 룬이 두 화면에서
 * 다른 크기로 서면 어느 쪽이 원래 모습인지 알 수 없다. `headerHeight`는 제목과 "비우기" 줄
 * 아래로 첫 줄 카드 **중심**이 서는 자리다.
 */
const RUNE_PICKER = { columns: 4, cardWidth: 180, cardHeight: 180, cellWidth: 208, cellHeight: 208, padX: 48, headerHeight: 272 } as const;

/**
 * 능력치 상세가 서는 세로 자리.
 *
 * 화면 한가운데보다 아주 조금만 위다 — 정확히 가운데에 두면 판 밑변이 하단 조작 줄과
 * 겹쳐 보인다. 판 높이가 바뀌면 이 값이 아니라 높이만 고치면 된다.
 */
const EXTRA_STATS_POPUP_Y = 920;

/** 돋보기로만 여는 보조 능력치. 평소에는 다섯 축만 보여 화면을 비운다. */
const EXTRA_STATS: readonly { key: keyof Stats; label: string; suffix?: string }[] = [
  { key: "attackSpeed", label: "공격 속도" },
  { key: "moveSpeed", label: "이동 속도" },
  { key: "critChance", label: "치명타 확률", suffix: "%" },
  { key: "critDamage", label: "치명타 피해", suffix: "%" },
  { key: "energyGain", label: "궁극기 충전량" },
];

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
/**
 * 씬 하나가 같은 상세 창을 다시 만들지 않게 묶어 두는 보관대.
 *
 * 팝업이나 그리드는 열 때마다 새로 만들어지지만 상세 창은 씬에 붙는 무거운 객체다. 열 때마다
 * 새로 세우면 씬이 살아 있는 동안 창이 겹겹이 쌓인다. 키가 같으면 같은 창을 돌려주고, 씬이
 * 내려갈 때 보관대도 함께 비운다.
 */
const INFO_BY_SCENE = new WeakMap<Phaser.Scene, Map<string, InfoManager>>();

export function sceneInfoManager(
  scene: Phaser.Scene,
  options: { key: string; portraitDepth?: number; context?: InfoContext; baseDepth?: number },
): InfoManager {
  let byKey = INFO_BY_SCENE.get(scene);
  if (!byKey) {
    byKey = new Map();
    INFO_BY_SCENE.set(scene, byKey);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => INFO_BY_SCENE.delete(scene));
  }
  const found = byKey.get(options.key);
  if (found) return found;
  const made = new InfoManager(scene, options.portraitDepth ?? 1001, options.context ?? "owner", options.baseDepth ?? 1000);
  byKey.set(options.key, made);
  return made;
}

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

  /** 능력치 칸 제목 아래에 서는 사거리 한 줄. */
  private reachLabel!: Phaser.GameObjects.Text;
  /** 능력치 칸의 오각형. 숫자는 돋보기로 연 상세가 맡는다. */
  private statRadar?: StatRadar;
  private readonly gemSlots: GemSlot[] = [];
  private readonly skillIcons: Phaser.GameObjects.Container[] = [];

  private currentDef?: RelicDef;
  private ownedNow = true;
  /** 전투에서 연 정보창일 때 실제 공격자와 피해 대상을 보존한다. */
  private liveLine?: Phaser.GameObjects.Text;
  private portrait?: PuppetCreature;
  private portraitWanted = false;
  private portraitRequest = 0;
  /**
   * 원화가 정보창에서 서 있어야 할 제자리.
   *
   * 전신 감상에서 돌아올 때 **지금 값**을 되돌리면 안 된다. 되돌아오는 도중에 다시 감상을 열면
   * 그 순간의 커진 값이 "제자리"로 굳어, 열고 닫을 때마다 원화가 조금씩 커진다.
   */
  private portraitHome?: { x: number; y: number; scale: number };
  private figure?: PuppetCreature;
  private figureRequest = 0;
  /** 전신 감상 중일 때 화면을 덮는 종료 판. 없으면 감상 중이 아니다. */
  private gallery?: Phaser.GameObjects.Rectangle;
  /** 감상을 연 돋보기를 눌린 크기에서 되돌리는 콜백. */
  private galleryReturn?: () => void;
  /** 좌우 넘김이 진행 중인지. 연달아 밀어도 한 번에 한 명씩만 넘어간다. */
  private sliding = false;
  /** 급여 버튼의 켜짐·꺼짐 판 두 장. */
  /** 돌파 버튼. 레벨 옆에 붙어 지금 뚫을 수 있는지를 진하기로 알린다. */
  private breakButton?: { container: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text; cost: Phaser.GameObjects.Text };
  private feedPlate?: { on: Phaser.GameObjects.Graphics; off: Phaser.GameObjects.Graphics };
  /** 급여 버튼의 치즈케이크 값줄 — `가진 수/한 번에 드는 수`. */
  private feedCost?: Phaser.GameObjects.Text;
  /** 값이 바뀔 때마다 아이콘과 수를 다시 가운데로 모은다. */
  private feedCostLayout?: () => void;
  private feedHold?: Phaser.Time.TimerEvent;
  private feeding = false;
  /** A feed note is a singleton; this also bridges the async feed lock and popup creation. */
  private feedPopupOpen = false;
  /** 생성 시 고정한 문맥 덕분에 읽기 전용 창이 도중에 소유자 권한으로 승격되지 않는다. */
  private readonly capabilities: Readonly<InfoCapabilities>;
  private publicProfile?: PublicRelicProfileDto;
  /** 전투 중인 적에게만 붙는 현재 체력·게이지·상태이상 한 줄. */
  private readonly combatLine: Phaser.GameObjects.Text;

  /** 정보창이 닫힐 때 목록 화면이 카드 표시를 다시 맞출 수 있게 알린다. */
  onClose?: () => void;
  /** 급여·돌파가 지갑을 바꾼 직후 소유 씬의 상단 재화 줄을 갱신하는 경계다. */
  onWalletChange?: () => void;

  /**
   * `baseDepth`는 창 전체가 서는 층이다. 팝업 위에서 여는 창(발굴 배치처럼 팝업 안의 그리드를
   * 꾹 눌러 여는 경우)은 팝업 층보다 위여야 한다 — 기본값으로 두면 창이 팝업 판 뒤에 가려
   * 아무것도 열리지 않은 것처럼 보인다.
   */
  constructor(private readonly scene: Phaser.Scene, private readonly portraitDepth = 1001, context: InfoContext = "owner", baseDepth = 1000) {
    this.capabilities = capabilitiesFor(context);
    this.root = scene.add.container(0, 0).setDepth(baseDepth).setVisible(false);
    this.chrome = scene.add.container(0, 0).setDepth(baseDepth + 2).setVisible(false);
    // 판과 제목은 이 층에 담아 한꺼번에 옮긴다. 자리를 조금 고칠 때마다 수십 개의 좌표를
    // 다시 계산하지 않기 위해서다.
    this.column = scene.add.container(COLUMN.offsetX, COLUMN.offsetY);
    this.chrome.add(this.column);
    this.popups = new PopupLayer(scene, baseDepth + 1000);
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
    // 개체번호 줄 바로 아래다. 지금 값이라 붉게 쓰고, 전투 밖에서는 아예 감춘다.
    this.combatLine = scene.add
      .text(50, 240, "", textStyle({ role: "emphasis", size: 23, color: COLOR.dangerText }))
      .setOrigin(0, 0)
      .setVisible(false);
    this.chrome.add([this.rarityGlow, this.rarityText, this.nameShadow, this.nameText, this.roleText, this.combatLine]);
    // 이름 오른쪽에 속성과 직군을 세운다. 이름 줄에 붙어 있어야 "이 개체가 무엇인지"가 한
    // 덩어리로 읽힌다. 카드와 마찬가지로 속성이 크고 직군이 조금 작다.
    this.elementBadge = new AffinityBadge(scene, 0, 152, ELEMENT_ICON.fire, AFFINITY.main);
    this.roleBadge = new AffinityBadge(scene, 0, 152, ROLE_ICON.warrior, AFFINITY.sub);
    this.chrome.add([this.elementBadge, this.roleBadge]);

    this.bookmarkBadge = this.addBadge(84, 300, "bookmark", BOOKMARK_ON, () => this.toggleBookmark());
    this.favoriteBadge = this.addBadge(176, 300, "heart", FAVORITE_ON, () => this.toggleFavorite());
    // 관찰 일지와 옷장은 내 렐릭에게만 있다. 친구·적 창에서는 아예 세우지 않는다.
    if (this.capabilities.mutateProgress) this.addJournalButton(268, 300);
    this.addMagnifier(84, 392, (from) => this.enterGallery(from.onClose));

    // 별은 오른쪽, 돌파 버튼은 그 왼쪽이다. 별이 오른쪽 돋보기(돌파 단계표) 바로 옆에 서야
    // 표식과 그 표식을 자세히 보는 입구가 한 덩어리로 읽힌다.
    this.starRow = scene.add.container(COLUMN.x + 132, 150);
    this.chrome.add(this.starRow);
    this.addMagnifier(COLUMN.x + COLUMN.width / 2 - 30, 158, (from) => this.openBreakthroughSteps(from));

    // 오른쪽 수치는 칸마다 판을 따로 깐다. 대신 칸의 내용물을 그 판 **안에** 넣어 판과 같은
    // 각도로 함께 기운다. 판만 기울고 글자가 반듯하면 판 위에 종이를 얹어 둔 것처럼 어긋난다.
    // 급여·돌파·경험치가 빠지는 읽기 전용 창에서는 레벨 판도 숫자에 맞춰 줄인다. 판만 남고
    // 속이 비면 "여기 뭔가 빠졌다"로 읽힌다.
    const levelPanel = this.capabilities.mutateProgress
      ? this.addPanel(COLUMN.x, 442, COLUMN.width, 332)
      : this.addPanel(COLUMN.x, 360, COLUMN.width, 168);
    const bondPanel = this.addPanel(COLUMN.x, 706, COLUMN.width, 144);
    const statPanel = this.addPanel(COLUMN.x, 1024, COLUMN.width, 396);
    const gemPanel = this.addPanel(COLUMN.x, 1398, COLUMN.width, 292);
    // 친구·적에게는 유대와 룬 판을 세우지 않는다.
    bondPanel.setVisible(this.capabilities.showBond);
    gemPanel.setVisible(this.capabilities.mutateProgress);

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
    // 경험치는 내가 키우는 렐릭에게만 있는 값이다. 친구·적에게 빈 눈금을 보여 주면 없는
    // 정보를 있는 것처럼 읽게 된다 — 레벨 숫자만 남긴다.
    if (!this.capabilities.mutateProgress) {
      this.expBar.objects.forEach((object) => object.setVisible(false));
      this.expLabel.setVisible(false);
    }
    // 한계 돌파는 별을 올리는 일이라 레벨 칸이 아니라 **별 옆**에 선다. 파편이 모였는지도
    // 그 자리에서 읽혀야 "지금 초월할 수 있는가"가 한눈에 들어온다.
    this.breakButton = this.addBreakButton(COLUMN.x - 78, 150, this.chrome);
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
    // 사거리는 오각형에 없는 축이라 제목 바로 아래에 이름표처럼 한 줄로만 선다. 색은 상세
    // 팝업이 맡고 여기서는 회색으로 물러난다 — 늘 떠 있는 자리는 균형이 먼저 읽혀야 한다.
    this.reachLabel = scene.add
      .text(COLUMN.x - COLUMN.width / 2 + 42, 874, "", textStyle({ role: "body", size: 22, color: COLOR.inkDim }))
      .setOrigin(0, 0.5);
    attach(statPanel, this.reachLabel);
    // 칸에는 숫자가 아니라 **오각형**이 선다. 다섯 축의 균형은 숫자 다섯 줄보다 한눈에 읽히고,
    // 정확한 값이 필요할 때만 돋보기로 연다. 축 이름은 굵게 키우고 능력치 색을 입힌다.
    // 판 한가운데(1024)에 두면 위쪽 축만 이름 위에 수치를 한 줄 더 이고 있어 오각형이 판
    // 천장에 붙어 보인다. 그 한 줄만큼 아래로 내려 위아래 여백을 맞춘다.
    this.statRadar = new StatRadar(this.scene, COLUMN.x, 1042, STAT_RADAR_RADIUS, {
      size: 24,
      colors: Object.fromEntries(STAT_CHIPS.map((chip) => [chip.key, `#${chip.color.toString(16).padStart(6, "0")}`])),
      // 축마다 실제 수치를 같은 색으로 적고, 면 안에는 전투력을 옅게 깐다.
      values: true,
      power: true,
    });
    attach(statPanel, this.statRadar);

    // 하트 젬 — 하트 하나를 셋으로 가른 자리.
    this.addSectionTitle("룬", 1398 - 146).setVisible(this.capabilities.mutateProgress);
    this.addMagnifier(COLUMN.x + COLUMN.width / 2 - 30, 1316, (from) => this.openRuneOverview(from), gemPanel);
    for (let index = 0; index < 3; index += 1) this.gemSlots.push(this.addGemSlot(index, gemPanel));

    this.buildFigureStand();
    if (this.capabilities.mutateProgress) this.addCostumeButton(FIGURE.x + 152, FIGURE.y - 206);
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
    // 모양은 `SectionTitle`이 정한다 — 정보창의 칸 제목과 팝업 머리글이 같은 표를 쓴다.
    return addSectionTitle(this.scene, COLUMN.x - COLUMN.width / 2, panelTop - 4, text, { parent: this.column });
  }

  /**
   * 즐겨찾기(별)와 애착(하트). 켜짐은 저마다의 색, 꺼짐은 회색이다.
   *
   * 모양은 공용 표식 칩(`MarkChip`)이 정한다 — 룬 쪽지의 잠금·즐겨찾기와 같은 한 장이라
   * 한쪽만 다른 크기·다른 눌림으로 갈라지지 않는다.
   */
  private addBadge(x: number, y: number, glyph: "bookmark" | "heart", onColor: number, onToggle: () => void): BadgeHandle {
    return addMarkChip(this.scene, this.chrome, x, y, { glyph, onColor, onToggle });
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
   *
   * 버튼에서 가장 크게 읽어야 하는 것은 "급여하기"라는 행동 이름이 아니라 **치즈케이크 수**다 —
   * 지금 몇 개를 가졌고 한 번 누르면 몇 개가 나가는지. 행동 이름은 이미 초록 판과 아이콘으로
   * 짐작되므로 작게 얹고, 꾹 누르기 안내는 적지 않는다.
   */
  private addFeedButton(x: number, y: number, width: number, height: number, panel: Phaser.GameObjects.Container): { container: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text } {
    const container = this.scene.add.container(x, y);
    const shape = slantedRect(width, height, 16);
    // 켜진 상태와 꺼진 상태를 판 두 장으로 나눠 둔다. 켜진 쪽만 진하게 차오르고 빛나서,
    // 지금 누를 수 있는지가 글자를 읽기 전에 보인다. 색만 치즈케이크의 노랑이다.
    const off = drawLayer(this.scene, 0, 0, shape, { fill: 0x1a1710, alpha: 0.55, edge: FEED_AMBER, edgeAlpha: 0.3 });
    const on = drawLayer(this.scene, 0, 0, shape, {
      fill: 0x3d2f12,
      alpha: 0.98,
      edge: 0xffe08a,
      edgeAlpha: 1,
      edgeWidth: 4,
      glow: { color: FEED_AMBER, strength: 0.45, height: 0.7 },
    });
    container.add([off, on]);
    const label = this.scene.add.text(0, -height / 2 + 22, "급여하기", textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(0.5);
    container.add(label);
    const row = feedCostRow(this.scene, 0, 16, width - 40, 54, 36);
    this.feedCost = row.text;
    this.feedCostLayout = row.layout;
    container.add(row.container);
    const hit = this.scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    let heldFrom = 0;
    let feedStarted: Promise<boolean> | undefined;
    let repeated = false;
    hit.on("pointerdown", () => {
      // The first serving belongs to pointerdown for both gestures.  Only pointerup decides whether the
      // gesture was a tap or a hold, after this server-confirmed request has completed.
      if (this.feeding || this.feedPopupOpen) return;
      container.setScale(1.04);
      heldFrom = this.scene.time.now;
      repeated = false;
      feedStarted = this.feed(1);
      this.feedHold = this.scene.time.addEvent({ delay: 260, loop: true, callback: () => {
        repeated = true;
        void this.feed(1);
      } });
    });
    const release = async (opened: boolean): Promise<void> => {
      container.setScale(1);
      // **제스처의 소유권을 기다리기 전에 먼저 가져온다.** `pointerup`과 `pointerout`이 잇달아
      // 오면 둘 다 이 함수로 들어오는데, 예전에는 뒤에 온 쪽이 앞선 호출이 서버 응답을 기다리는
      // 동안 `heldFrom`을 0으로 지웠다. 그래서 짧은 탭은 급여가 실제로 성사되고도 성장 팝업을
      // 열지 못했다 — 조건이 이미 0이 된 값을 읽었기 때문이다.
      const startedAt = heldFrom;
      heldFrom = 0;
      if (startedAt === 0) return;
      const held = this.scene.time.now - startedAt;
      this.feedHold?.remove();
      this.feedHold = undefined;
      const started = feedStarted;
      feedStarted = undefined;
      // The response is the only proof that EXP changed.  Waiting here also keeps rapid releases behind the
      // existing `feeding` lock, so several notes cannot be stacked while the network is slow.
      const changed = await started;
      const wasHold = repeated || held >= FEED_HOLD_MS;
      // A short successful tap offers the next currently-valid growth action immediately.  A hold keeps its
      // repeat behavior and opens the same singleton only after the hand has been released.
      if (opened && (wasHold || changed)) this.openFeedBulk(x, y + height / 2);
    };
    hit.on("pointerup", () => void release(true));
    // 손을 **뗀 자리**로 판단한다. `pointerout`으로 취소하면 급여가 레벨을 올려 판이 다시 그려질
    // 때 그 사건이 먼저 도착해, 아직 누르고 있는 제스처를 취소로 삼켜 버린다 — 그래서 급여는
    // 성사되는데 성장 팝업만 뜨지 않는 일이 생겼다(레벨업이 걸리는 회차에만 나타나 흔들렸다).
    // 벗어남은 되풀이 급여만 멈추고, 열지 말지는 실제로 떼는 순간에 정한다.
    hit.on("pointerupoutside", () => void release(false));
    hit.on("pointerout", () => { this.feedHold?.remove(); this.feedHold = undefined; });
    container.add(hit);
    attach(panel, container);
    this.feedPlate = { on, off };
    return { container, label };
  }

  /**
   * 한계 돌파 버튼.
   *
   * **별 바로 옆**에 붙는다 — 올리는 것이 별이라 별과 같은 줄에 있어야 무엇이 오르는지가
   * 눌러 보기 전에 읽힌다. 아래 줄에는 지금 가진 파편과 다음 별에 드는 파편을 함께 적고,
   * 누르면 남은 재료를 마저 보여 준 뒤 거기서 확정한다.
   */
  private addBreakButton(x: number, y: number, panel: Phaser.GameObjects.Container): { container: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text; cost: Phaser.GameObjects.Text } {
    const container = this.scene.add.container(x, y);
    const shape = slantedRect(196, 74, 12);
    container.add(drawLayer(this.scene, 0, 0, shape, { fill: 0x24202f, alpha: 0.94, edge: BREAK_EDGE, edgeAlpha: 0.9, glow: { color: BREAK_EDGE, strength: 0.4, height: 0.6 } }));
    const label = this.scene.add.text(0, -12, "한계 돌파", textStyle({ role: "display", size: 26 })).setOrigin(0.5);
    const cost = this.scene.add.text(0, 18, "", textStyle({ role: "emphasis", size: 20, color: COLOR.accentText })).setOrigin(0.5);
    container.add([label, cost]);
    const hit = this.scene.add.rectangle(0, 0, 204, 86, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => container.setScale(1.08));
    hit.on("pointerout", () => { if (!this.popups.isOpen) container.setScale(1); });
    hit.on("pointerup", () => {
      container.setScale(1.08);
      this.openBreakthrough({ x, y: y + 60, onClose: () => container.setScale(1) });
    });
    container.add(hit);
    attach(panel, container);
    return { container, label, cost };
  }

  /** 돌파할 수 있는 상태인지 알린다. 재료가 모자라도 눌러 무엇이 필요한지 볼 수 있다. */
  private paintBreakButton(progress: RelicProgress): void {
    const def = this.currentDef;
    const step = nextBreakthrough(progress.breakthrough);
    const held = def ? relicProgression.getFragments(def.id) : 0;
    const ready = this.ownedNow && canBreakThrough(progress, held, session.wallet.cheesecake);
    this.breakButton?.container.setAlpha(step ? (ready ? 1 : 0.62) : 0.35);
    this.breakButton?.label.setText(step ? "한계 돌파" : "별 최대");
    this.breakButton?.label.setColor(ready ? COLOR.ink : COLOR.inkDim);
    // 파편이 몇 개 모였는지는 버튼이 직접 말한다. 눌러 보고서야 아는 값이면 늦다.
    this.breakButton?.cost.setText(step ? held + " / " + step.fragments : "");
    this.breakButton?.cost.setColor(step && held < step.fragments ? COLOR.dangerText : COLOR.accentText);
  }

  /** 돌파에 드는 재료와 열리는 상한을 보여 주고 그 자리에서 확정한다. */
  private openBreakthrough(from: PopupSource): void {
    if (!this.capabilities.mutateProgress) return;
    const def = this.currentDef;
    if (!def) return;
    const progress = relicProgression.getProgress(def.id);
    const step = nextBreakthrough(progress.breakthrough);
    this.popups.open({ width: 720, height: 460, title: "한계 돌파", tilt: -1.2, ...anchorOf(from) }, (body, close) => {
      if (!step) {
        body.add(this.scene.add.text(0, 20, "이미 별 다섯이다. 중복은 DNA 조각으로 쌓인다.", textStyle({ role: "body", size: 26, color: COLOR.inkDim })).setOrigin(0.5).setWordWrapWidth(600));
        return;
      }
      const cap = relicLevelCap(progress.breakthrough);
      body.add(
        this.scene.add
          .text(0, -150, "별 " + relicStars(progress.breakthrough) + "  →  " + (relicStars(progress.breakthrough) + 1), textStyle({ role: "display", size: 34, color: COLOR.accentText }))
          .setOrigin(0.5),
      );
      body.add(
        this.scene.add
          .text(0, -104, "레벨 상한 " + cap + "  →  " + step.levelCap + "   ·   " + step.label, textStyle({ role: "body", size: 23, color: COLOR.inkDim }))
          .setOrigin(0.5),
      );
      const rows: [string, number, number][] = [
        [def.name + " 파편", step.fragments, relicProgression.getFragments(def.id)],
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
      const ready = canBreakThrough(progress, relicProgression.getFragments(def.id), session.wallet.cheesecake);
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

  /**
   * 한 번에 여러 레벨을 채우는 쪽지. 급여 버튼 바로 아래에 뜨고 다른 곳을 누를 때까지 남는다.
   *
   * 여기서도 크게 읽어야 하는 것은 레벨 수가 아니라 **나가는 치즈케이크 수**다. 한 번에
   * 수십 번을 먹이는 자리라 지갑이 얼마나 줄어드는지 모르고 누르면 안 된다.
   */
  private openFeedBulk(x: number, y: number): void {
    if (this.feedPopupOpen || this.popups.isOpen) return;
    const def = this.currentDef;
    if (!def) return;
    const progress = relicProgression.getProgress(def.id);
    const canFeed = canFeedRelic(progress, session.wallet.cheesecake);
    const step = nextBreakthrough(progress.breakthrough);
    // Growth actions are derived from the current confirmed state, never from “did this tap level up?”.  At
    // the cap the note becomes an explicit route to breakthrough and explains why it is not yet available.
    const atCap = progress.level >= relicLevelCap(progress.breakthrough);
    if (!canFeed && !atCap) return;
    this.feedPopupOpen = true;
    this.popups.open({
      width: 500,
      height: 250,
      x,
      y: y + 150,
      title: "한 번에 급여",
      hideCloseButton: true,
      closeOnBackdrop: true,
      onClose: () => { this.feedPopupOpen = false; },
    }, (body, close) => {
      if (atCap) {
        const held = relicProgression.getFragments(def.id);
        const ready = !!step && canBreakThrough(progress, held, session.wallet.cheesecake);
        body.add(this.scene.add.text(0, -26, step ? "레벨 상한 · 한계 돌파" : "최대 성장", textStyle({ role: "display", size: 28, color: ready ? COLOR.ink : COLOR.inkDim })).setOrigin(0.5));
        const reason = !step ? "별 최대" : progress.level < relicLevelCap(progress.breakthrough) ? "레벨 상한 필요" : held < step.fragments ? `파편 부족 ${held} / ${step.fragments}` : session.wallet.cheesecake < step.cheesecake ? `치즈케이크 부족 ${session.wallet.cheesecake} / ${step.cheesecake}` : "돌파 가능";
        body.add(this.scene.add.text(0, 22, reason, textStyle({ role: "body", size: 21, color: ready ? COLOR.accentText : COLOR.dangerText })).setOrigin(0.5));
        if (step) {
          const route = this.scene.add.rectangle(0, 72, 300, 64, 0xffffff, 0).setInteractive({ useHandCursor: true });
          route.on("pointerup", () => {
            close();
            this.openBreakthrough({ x, y: y + 80, onClose: () => undefined });
          });
          body.add([this.scene.add.text(0, 72, "한계 돌파 보기", textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0.5), route]);
        }
        return;
      }
      ([["1 레벨", 1], ["10 레벨", 10]] as const).forEach(([label, levels], index) => {
        const bx = index === 0 ? -118 : 118;
        const cost = this.feedsForLevels(levels) * FEED_UNIT.cheesecake;
        const enough = session.wallet.cheesecake >= cost;
        body.add(drawLayer(this.scene, bx, 12, slantedRect(212, 116, 14), { fill: 0x3d2f12, alpha: 0.92, edge: FEED_AMBER, edgeAlpha: enough ? 0.8 : 0.3 }));
        body.add(this.scene.add.text(bx, -22, label, textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(0.5));
        // 버튼과 같은 값줄이다. 여기서 바뀌는 것은 오른쪽 수(한 번에 나가는 양)뿐이다.
        const price = feedCostRow(this.scene, bx, 32, 184, 48, 28);
        price.text.setText(formatCurrency(session.wallet.cheesecake) + "/" + formatCurrency(cost));
        price.text.setColor(enough ? FEED_TEXT : COLOR.dangerText);
        price.layout();
        body.add(price.container);
        if (!enough) return;
        const hit = this.scene.add.rectangle(bx, 12, 212, 116, 0xffffff, 0).setInteractive({ useHandCursor: true });
        hit.on("pointerup", () => {
          close();
          void this.feedLevels(levels);
        });
        body.add(hit);
      });
    });
  }

  /** 지금 레벨에서 목표 레벨까지 필요한 급여 횟수. 팝업의 소모량 표기와 실제 요청이 같은 값을 쓴다. */
  private feedsForLevels(levels: number): number {
    if (!this.currentDef) return 1;
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
    return Math.max(1, need);
  }

  /** 필요한 급여 횟수를 한 번에 요청한다. */
  private async feedLevels(levels: number): Promise<void> {
    await this.feed(this.feedsForLevels(levels));
  }

  /** Returns whether the server-confirmed response actually increased EXP or level. */
  private async feed(feeds: number): Promise<boolean> {
    const def = this.currentDef;
    if (!def || !this.ownedNow || this.feeding) return false;
    if (!canFeedRelic(relicProgression.getProgress(def.id), session.wallet.cheesecake)) return false;
    const before = relicProgression.getProgress(def.id);
    this.feeding = true;
    let changed = false;
    try {
      await gameApi.feedRelic(def.id, feeds);
      const after = relicProgression.getProgress(def.id);
      changed = after.level > before.level || after.exp > before.exp;
      // 정보창과 상단 줄 모두 확정된 단일 세션 지갑을 읽도록 성공 직후 알린다.
      this.onWalletChange?.();
    } catch {
      // 치즈케이크 부족·상한은 화면에서 이미 막는다. 실패하면 상태만 다시 그린다.
    } finally {
      this.feeding = false;
      this.refreshGrowth();
    }
    return changed;
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

    let currentRuneId: string | null = null;
    const hit = this.scene.add
      .rectangle(center.x + spot.x, center.y + spot.y, size * 0.42, size * 0.42, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerup", () => {
      // 채운 조각은 룬 쪽지(세공은 거기서 한 번 더 고른다), 빈 조각은 장착 가방을 연다.
      if (currentRuneId) {
        openRuneInfoPopup(this.scene, this.popups, {
          runeInstanceId: currentRuneId,
          anchor: { x: center.x + spot.x, y: center.y + spot.y },
          onChanged: () => this.refreshGrowth(),
        });
      } else this.openGemPicker(index);
    });
    attach(panel, glow, piece, label, hit);

    return {
      paint: (gemId) => {
        currentRuneId = gemId;
        const gem = gemId ? session.runeInventory.find(({ instanceId }) => instanceId === gemId) : undefined;
        piece.setTexture(runeTexture(gem?.rarity, index));
        // 빈 자리는 제 크기보다 조금 오므라들어 조각 사이에 틈이 생긴다. 룬을 끼우면 제
        // 크기로 펴져 틈이 메워지므로, 셋을 다 채우면 이음매 없는 하트 한 장이 된다.
        piece.setDisplaySize(size, size).setScale(piece.scaleX * (gem ? 1 : RUNE_GAP), piece.scaleY * (gem ? 1 : RUNE_GAP));
        if (gem) {
          glow.setTexture(runeTexture(gem.rarity, index)).setTint(RUNE_ACCENT[gem.rarity]).setAlpha(0.4);
          label.setText(index + 1 + "   " + (gem.customName ?? `${RUNE_RARITY_LABELS[gem.rarity]} 룬`)).setColor(COLOR.ink);
        } else {
          glow.setAlpha(0);
          label.setText(index + 1 + "   빈 자리").setColor(COLOR.inkDim);
        }
      },
    };
  }

  /**
   * 칸 하나에 낄 룬을 고르는 가방.
   *
   * 가방(`InventoryPopup`)과 **같은 카드 한 장**을 쓴다. 여기에만 이름·옵션을 늘어놓으면 같은
   * 룬이 두 화면에서 다른 무게로 읽히고, 한쪽을 고칠 때 다른 쪽이 옛 모습으로 남는다. 카드는
   * 액자 한 장이고 이름과 옵션 수치는 눌러서 여는 쪽지가 맡는다.
   */
  private openGemPicker(index: number): void {
    if (!this.capabilities.mutateProgress) return;
    const def = this.currentDef;
    if (!def || !this.ownedNow) return;
    // 룬은 제 자리에만 들어간다. 다른 조각까지 늘어놓으면 고를 수 없는 것을 고르게 된다.
    const runes = session.runeInventory.filter((rune) => rune.part === index);
    const columns = RUNE_PICKER.columns;
    const rows = Math.max(1, Math.ceil(runes.length / columns));
    const pickerWidth = columns * RUNE_PICKER.cellWidth + RUNE_PICKER.padX * 2;
    // 판 높이는 가진 룬 수를 따르되 화면을 넘지 않는다. 못으로 박아 두면 룬이 늘어난 만큼 잘린다.
    const pickerHeight = Math.min(BASE_HEIGHT - 120, RUNE_PICKER.headerHeight + (rows - 1) * RUNE_PICKER.cellHeight + RUNE_PICKER.cardHeight / 2 + 48);
    this.popups.open({ width: pickerWidth, height: pickerHeight, title: "룬 가방 · " + RUNE_PART_LABELS[index as RunePart], dim: true }, (body, close) => {
      const top = -pickerHeight / 2;
      // 비우기는 격자 위 한 줄이다. 룬 카드와 섞이면 실수로 누르기 쉽다.
      body.add(drawLayer(this.scene, 0, top + 128, slantedRect(pickerWidth - 96, 66, 12), { fill: 0x141a22, alpha: 0.92, edge: COLOR.accent, edgeAlpha: 0.3 }));
      body.add(this.scene.add.text(0, top + 128, "비우기", textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0.5));
      const clearHit = this.scene.add.rectangle(0, top + 128, pickerWidth - 96, 66, 0xffffff, 0).setInteractive({ useHandCursor: true });
      clearHit.on("pointerup", () => void relicProgression.unequipRune(def.id, index).then(() => { close(); this.refreshGrowth(); }));
      body.add(clearHit);

      const firstX = -((columns - 1) * RUNE_PICKER.cellWidth) / 2;
      runes.forEach((rune, order) => {
        const x = firstX + (order % columns) * RUNE_PICKER.cellWidth;
        const y = top + RUNE_PICKER.headerHeight + Math.floor(order / columns) * RUNE_PICKER.cellHeight;
        const holder = equippedRelicName(rune.instanceId);
        const card = addRuneCard(this.scene, x, y, RUNE_PICKER.cardWidth, RUNE_PICKER.cardHeight, rune, { dimmed: holder !== undefined });
        const hit = this.scene.add.rectangle(0, 0, RUNE_PICKER.cardWidth, RUNE_PICKER.cardHeight, 0xffffff, 0).setInteractive({ useHandCursor: true });
        hit.on("pointerdown", () => card.setScale(1.06));
        hit.on("pointerout", () => { if (!this.popups.isOpen) card.setScale(1); });
        hit.on("pointerup", () => {
          card.setScale(1);
          // 가방에서도 곧바로 끼우지 않고 쪽지를 먼저 연다. 무엇을 끼우는지 보고 고르게 한다.
          openRuneInfoPopup(this.scene, this.popups, {
            runeInstanceId: rune.instanceId,
            anchor: { x: 540, y: 960 },
            onChanged: () => this.refreshGrowth(),
            // 정보창에서 연 룬이므로 쪽지에 장착 버튼이 함께 선다.
            equip: { relicId: def.id, slotIndex: index, onEquipped: () => { close(); this.refreshGrowth(); } },
          });
        });
        card.add(hit);
        body.add(card);
      });
    });
  }

  /** 메타데이터·발굴 기록·복원 후 관찰 기록을 높이 기반으로 잇는 관찰 일지. */
  private openJournal(from: PopupSource): void {
    const def = this.currentDef;
    if (!def) return;
    const disclosure = getRelicCatalogDisclosure(def, this.ownedNow);
    const journal = OBSERVATION_JOURNAL_SIZE;
    const bodyLeft = -journal.body.width / 2;
    // 상단 식별 정보는 라벨(회색)과 값(흰색)을 갈라 무엇이 이름표고 무엇이 실제 값인지
    // 색으로 먼저 읽히게 한다 — 이름표와 같은 무게로 묻히면 "지금 보고 있는 개체가 정확히
    // 무엇인지"가 느리게 읽힌다.
    const identityLines: { label: string; value: string }[] = disclosure.access === "full"
      ? [
          { label: "개체번호", value: "NO." + disclosure.specimenNumber },
          { label: "프로젝트", value: disclosure.projectName },
          { label: "기원", value: disclosure.origin },
          { label: "발굴지", value: disclosure.excavationSite },
          ...(def.observationProfile ? [
            { label: "기원 연대", value: def.observationProfile.originYear },
            // 복원 연도는 저장된 경과 시간이 아니라 정적 도감의 세계관 나잇대만 단독으로 표시한다.
            { label: "복원 연도", value: def.observationProfile.restorationYear },
            { label: "성장 단계", value: `${def.observationProfile.lifeStage} · 키 ${def.observationProfile.height} · 몸무게 ${def.observationProfile.weight}` },
          ] : []),
        ]
      : [
          { label: "개체번호", value: "NO." + disclosure.specimenNumber },
          { label: "프로젝트", value: "기록 없음" },
          { label: "기원", value: "미상" },
          { label: "발굴지", value: "미상" },
        ];

    // 텍스트를 먼저 만들어 실제 height를 얻는다. 이후 배치는 줄 수나 개체별 문단 길이를 추측하지 않는다.
    const markBounds = factionMarkBounds(JOURNAL_SQUAD_MARK.size);
    // 상단 정보는 확대된 표식의 실제 왼쪽 외곽(복제 그림자 포함) 전까지만 사용한다.
    const metadataWidth = JOURNAL_SQUAD_MARK.x + markBounds.left - JOURNAL_SQUAD_MARK.metadataGap - bodyLeft;
    const identity = this.buildJournalIdentity(identityLines, metadataWidth, journal.font.regular, journal.spacing.line);
    const rawRecord = disclosure.access === "full" ? disclosure.record : def.catalogSummary + "\n\n상세 기록은 개체 획득 후 해제됩니다.";
    const excavationRecord = withoutRepeatedProfileDetails(rawRecord, def.observationProfile?.height, def.observationProfile?.weight);
    const excavation = this.keywords.layout(excavationRecord, { width: journal.body.width, size: journal.font.large, color: COLOR.inkDim, lineSpacing: journal.spacing.line });
    // 다른 스쿼드를 향한 동경은 unlockRecord의 관찰 문장이 담당하므로, 여기서는 소속 메모만 그린다.
    const squad = disclosure.access === "full" && def.squadNote
      ? this.scene.add.text(0, 0, def.squadNote, textStyle({ role: "body", size: journal.font.small, color: COLOR.inkDim, lineSpacing: journal.spacing.compactLine, wrap: journal.body.width })).setOrigin(0, 0)
      : undefined;
    const observationHeading = this.scene.add.text(0, 0, "복원 후 관찰 기록", textStyle({ role: "emphasis", size: journal.font.regular, color: COLOR.ink })).setOrigin(0, 0);
    // 이 판에는 가장 최근 관찰 기록 한 건만 둔다. 쌓인 전체 이력은 별도 레이어(관찰 기록)가
    // 한 건씩 넘겨 보여 준다 — 매일 쌓이는 인터뷰를 전부 여기 밀어 넣으면 캐릭터 소개보다
    // 로그가 더 길어진다.
    const allEntries = observations.recordFor(def.id);
    const entries = allEntries.slice(-1).reverse();
    const observationCopy = entries.length
      ? entries.map((entry) => `${entry.date}  ·  #${entry.personalityTag}\nQ. ${entry.question}\nA. ${entry.answer}\n발견  ${entry.discoveredHabit}`).join("\n\n")
      : "아직 기록된 관찰이 없습니다.";
    const observation = this.scene.add.text(0, 0, observationCopy, textStyle({ role: "body", size: entries.length ? journal.font.regular : journal.font.small, color: COLOR.ink, lineSpacing: journal.spacing.compactLine, wrap: journal.body.width })).setOrigin(0, 0);
    // 링크 한 줄만큼 흐름 계산에 미리 더해 둔다 — 그러지 않으면 바로 아래 인터뷰 조작과 겹친다.
    const historyLinkHeight = allEntries.length > 1 ? journal.spacing.compactLine + journal.font.small + 16 : 0;
    const actionHeight = this.ownedNow ? OBSERVATION_INTERVIEW_LAYOUT.trigger.height : 0;
    const flow = calculateObservationJournalFlow({
      metadata: identity.height, excavation: excavation.height, squad: squad?.height ?? 0,
      observationHeading: observationHeading.height, observation: observation.height + historyLinkHeight, action: actionHeight,
    });

    this.popups.open({ width: journal.popup.width, height: flow.popupHeight, title: "관찰 일지", titleSize: journal.font.title, tilt: journal.popup.tilt, ...anchorOf(from) }, (body, close) => {
      const artWidth = journal.popup.width - journal.art.inset * 2;
      const artHeight = flow.popupHeight - journal.art.inset * 2;
      if (this.scene.textures.exists("content-observation-journal")) {
        const journalMask = chipPoints(artWidth, artHeight, { bevel: { topLeft: artWidth * 0.14, topRight: 0, bottomRight: artWidth * 0.14, bottomLeft: 0 } });
        const journalArt = addPopupBackgroundImage(this.scene, body, "content-observation-journal", { x: 0, y: 0, width: artWidth, height: artHeight, maskShape: journalMask, fit: "native-center" });
        journalArt.image.setAlpha(JOURNAL_ART_ALPHA); journalArt.fade.setAlpha(JOURNAL_TEXT_FADE_ALPHA); journalArt.syncMask();
      }

      // 흐르는 본문만 별도 컨테이너에 담아, 화면 안전 높이를 넘을 때 판과 배경은 고정한 채 스크롤한다.
      const content = this.scene.add.container(0, -flow.popupHeight / 2);
      const y = (value: number): number => value;
      identity.container.setPosition(bodyLeft, y(flow.metadataY)); content.add(identity.container);
      content.add(drawHairline(this.scene, 0, y(flow.excavationDividerY), journal.body.width, { color: COLOR.accent, alpha: 0.35 }));
      excavation.setPosition(bodyLeft, y(flow.excavationY)); content.add(excavation);
      if (squad && flow.squadY !== undefined) { squad.setPosition(bodyLeft, y(flow.squadY)); content.add(squad); }
      content.add(drawHairline(this.scene, 0, y(flow.observationDividerY), journal.body.width, { color: COLOR.accent, alpha: 0.35 }));
      observationHeading.setPosition(bodyLeft, y(flow.observationHeadingY)); content.add(observationHeading);
      observation.setPosition(bodyLeft, y(flow.observationY)); content.add(observation);
      if (allEntries.length > 1) {
        // 이 개체의 다른 날짜 기록은 여기 밀어 넣지 않고 전용 레이어에서 한 건씩 넘겨 본다.
        const linkY = y(flow.observationY) + observation.height + journal.spacing.compactLine;
        const link = this.scene.add.text(bodyLeft, linkY, `전체 기록 보기 (${allEntries.length}건)`, textStyle({ role: "emphasis", size: journal.font.small, color: COLOR.accentText })).setOrigin(0, 0);
        content.add(link);
        // 글자 자체보다 넉넉한 손끝 크기의 히트 영역을 따로 둔다 — 작은 글자 그대로 입력을
        // 받으면 모바일에서 자주 빗나간다.
        const linkHit = this.scene.add.rectangle(bodyLeft + link.width / 2, linkY + link.height / 2, link.width + 80, 96, 0xffffff, 0)
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true });
        linkHit.on("pointerup", () => this.openObservationHistory(def, from));
        content.add(linkHit);
      }

      // 소속 표식은 메타데이터 영역 안에만 앉혀 세 영역의 읽기 순서를 흐리지 않는다.
      // 그림자의 위쪽 실제 외곽을 메타데이터 상단에 맞춰 제목 영역으로 번지지 않게 한다.
      const markY = flow.metadataY - markBounds.top;
      const squadMark = addFactionMark(this.scene, JOURNAL_SQUAD_MARK.x, markY, def.squad, { size: JOURNAL_SQUAD_MARK.size });
      if (squadMark) content.add(squadMark);
      if (disclosure.access === "full") content.add(this.scene.add.text(JOURNAL_SQUAD_MARK.x, markY + markBounds.bottom + JOURNAL_SQUAD_MARK.nameGap, SQUADS[def.squad].name, textStyle({ role: "display", size: journal.font.regular, color: COLOR.accentText, align: "center" })).setOrigin(0.5, 0));

      if (this.ownedNow) {
        const utcDate = new Date().toISOString().slice(0, 10);
        const interview = OBSERVATION_INTERVIEW_LAYOUT;
        const canStart = observations.canStart(def.id, utcDate);
        const trigger = this.scene.add.container(0, flow.actionY + actionHeight / 2);
        trigger.add(drawLayer(this.scene, 0, 0, slantedRect(interview.trigger.width, interview.trigger.height, interview.trigger.bevel), { fill: canStart ? 0x141a22 : 0x10141a, alpha: canStart ? 0.92 : 0.58, edge: COLOR.accent, edgeAlpha: canStart ? 0.4 : 0.16 }));
        trigger.add(this.scene.add.text(0, 0, canStart ? "관찰 인터뷰 열기" : "오늘의 관찰 인터뷰 완료", textStyle({ role: "emphasis", size: journal.font.large, color: canStart ? COLOR.accentText : COLOR.inkDim })).setOrigin(0.5));
        let interviewState: ObservationInterviewPanelState = { open: false, completedToday: !canStart };
        if (canStart) {
          const hit = this.scene.add.rectangle(0, 0, interview.trigger.width, interview.trigger.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
          hit.on("pointerdown", () => trigger.setScale(1.06)); hit.on("pointerout", () => { if (!interviewState.open) trigger.setScale(1); });
          hit.on("pointerup", () => {
            trigger.setScale(1); if (interviewState.open) { this.popups.closeTop(); return; }
            interviewState = observationInterviewPanelState(interviewState, "toggle");
            const question = observationQuestionForRelicAndDate(def.id, utcDate);
            this.popups.open({ ...interview.popup, title: "관찰 인터뷰", closeOnBackdrop: false, dim: true, dimAlpha: 0.25, onClose: () => { interviewState = observationInterviewPanelState(interviewState, "close"); trigger.setScale(1); } }, (panel, closeInterview) => {
              panel.add(this.scene.add.text(interview.question.x, interview.question.y, question.prompt, textStyle({ role: "emphasis", size: journal.font.question, color: COLOR.accentText, wrap: interview.question.width })).setOrigin(0, 0));
              question.choices.forEach((choice, index) => {
                const choiceButton = this.scene.add.container(0, interview.choice.firstY + index * interview.choice.step);
                choiceButton.add(drawLayer(this.scene, 0, 0, slantedRect(interview.choice.width, interview.choice.height, interview.choice.bevel), { fill: 0x141a22, alpha: 0.94, edge: COLOR.accent, edgeAlpha: 0.42 }));
                choiceButton.add(this.scene.add.text(0, 0, choice.label, textStyle({ role: "emphasis", size: journal.font.large })).setOrigin(0.5));
                const choiceHit = this.scene.add.rectangle(0, 0, interview.choice.width, interview.choice.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
                choiceHit.on("pointerdown", () => choiceButton.setScale(1.06)); choiceHit.on("pointerout", () => choiceButton.setScale(1));
                choiceHit.on("pointerup", () => { observations.complete(def.id, utcDate, choice.id); interviewState = observationInterviewPanelState(interviewState, "complete"); closeInterview(); close(); this.openJournal(from); });
                choiceButton.add(choiceHit); panel.add(choiceButton);
              });
            });
          });
          trigger.add(hit);
        }
        content.add(trigger);
      }
      body.add(content);

      if (flow.scrollable) {
        // 휠과 손가락 드래그가 같은 clamp를 써 콘텐츠가 위아래 안전 여백 밖으로 빠지지 않는다.
        const viewportTop = -flow.popupHeight / 2 + journal.body.top;
        const viewport = this.scene.add.rectangle(0, viewportTop + flow.viewportHeight / 2, journal.body.width, flow.viewportHeight, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
        const minY = flow.popupHeight / 2 - flow.contentHeight;
        const maxY = -flow.popupHeight / 2;
        const move = (delta: number): void => { content.setY(Phaser.Math.Clamp(content.y + delta, minY, maxY)); };
        // GeometryMask는 화면 좌표를 쓰므로 팝업 중심을 더한다. 본문만 잘리고 고정 배경·제목은 남는다.
        const maskGraphics = this.scene.make.graphics({ x: body.x, y: body.y });
        maskGraphics.fillStyle(0xffffff).fillRect(-journal.body.width / 2, viewportTop, journal.body.width, flow.viewportHeight);
        content.setMask(maskGraphics.createGeometryMask());
        body.once(Phaser.GameObjects.Events.DESTROY, () => maskGraphics.destroy());
        viewport.on("wheel", (_pointer: Phaser.Input.Pointer, _dx: number, dy: number) => move(-dy));
        let lastY = 0;
        viewport.on("pointerdown", (pointer: Phaser.Input.Pointer) => { lastY = pointer.y; });
        viewport.on("pointermove", (pointer: Phaser.Input.Pointer) => { if (pointer.isDown) { move(pointer.y - lastY); lastY = pointer.y; } });
        body.add(viewport);
      }
    });
  }

  /**
   * 상단 식별 정보 한 줄씩을 라벨(회색)·값(흰색) 두 텍스트로 그린다.
   *
   * 값이 길어 줄바꿈되는 경우까지 감안해 각 줄의 실제 렌더 높이를 재고 누적한다 — 눈대중
   * 상수는 "성장 단계" 줄처럼 긴 값이 두 줄로 접히는 순간 다음 구분선과 겹친다.
   */
  private buildJournalIdentity(
    lines: readonly { label: string; value: string }[],
    width: number,
    fontSize: number,
    lineSpacing: number,
  ): { container: Phaser.GameObjects.Container; height: number } {
    const container = this.scene.add.container(0, 0);
    const labelWidth = 150;
    let cursor = 0;
    lines.forEach((line, index) => {
      if (index > 0) cursor += lineSpacing;
      const label = this.scene.add.text(0, cursor, line.label, textStyle({ role: "body", size: fontSize, color: COLOR.inkDim })).setOrigin(0, 0);
      const value = this.scene.add.text(labelWidth, cursor, line.value, textStyle({ role: "body", size: fontSize, color: COLOR.ink, wrap: width - labelWidth })).setOrigin(0, 0);
      container.add([label, value]);
      cursor += Math.max(label.height, value.height);
    });
    return { container, height: cursor };
  }

  /**
   * 관찰 기록 레이어.
   *
   * 관찰 일지 쪽지에는 가장 최근 한 건만 두고, 쌓인 전체 이력은 이 팝업이 한 건씩 넘겨
   * 보여 준다 — 매일 쌓이는 기록을 전부 한 판에 밀어 넣으면 캐릭터 소개보다 인터뷰 로그가
   * 더 길어진다. 페이지를 넘길 때마다 팝업을 닫고 다시 여는 건 룬 세공 갱신과 같은 경계다.
   */
  private openObservationHistory(def: RelicDef, from: PopupSource, page = 0): void {
    const history = sortedObservationHistory(observations.recordFor(def.id));
    const index = clampObservationPage(page, history.length);
    const entry = history[index];
    // 이 레이어는 눌린 자리 위에 얹히는 쪽지가 아니라 따로 읽는 기록판이다. 관찰 일지와
    // 같은 자리에 겹쳐 열면 두 판의 닫기 X가 거의 포개져 헷갈린다 — 화면 가운데 그대로 둔다.
    this.popups.open({ width: 820, height: 620, title: "관찰 기록" }, (body, close) => {
      if (!entry) {
        body.add(this.scene.add.text(0, 0, "아직 기록된 인터뷰가 없습니다.", textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(0.5));
        return;
      }
      const goTo = (next: number): void => { close(); this.openObservationHistory(def, from, next); };
      // 날짜·성향 태그는 부가 정보라 옅게, 실제 문답·발견 습성은 잘 보여야 하는 관찰 내용이라
      // 희다 — 관찰 일지 본문과 같은 색 규칙을 그대로 잇는다.
      body.add(this.scene.add
        .text(0, -246, `${entry.date}  ·  #${entry.personalityTag}`, textStyle({ role: "body", size: 22, color: COLOR.inkDim, align: "center" }))
        .setOrigin(0.5, 0));
      const copy = `Q. ${entry.question}\n\nA. ${entry.answer}\n\n발견  ${entry.discoveredHabit}`;
      body.add(this.scene.add
        .text(0, -196, copy, textStyle({ role: "body", size: 26, color: COLOR.ink, lineSpacing: 10, align: "center", wrap: 720 }))
        .setOrigin(0.5, 0));

      // 목록은 최신(1)에서 과거로 갈수록 페이지가 커진다. 화살표는 그 순서를 그대로 따라간다
      // — 왼쪽이 더 최근, 오른쪽이 더 과거다.
      const pagerY = 240;
      const hasNewer = index > 0;
      const hasOlder = index < history.length - 1;
      body.add(drawGlyph(this.scene, "page-prev", -300, pagerY, 40, hasNewer ? COLOR.inkHex : COLOR.inkDimHex, hasNewer ? 1 : 0.35));
      if (hasNewer) {
        const hit = this.scene.add.rectangle(-300, pagerY, 90, 90, 0xffffff, 0).setInteractive({ useHandCursor: true });
        hit.on("pointerup", () => goTo(index - 1));
        body.add(hit);
      }
      body.add(this.scene.add.text(0, pagerY, `${index + 1} / ${history.length}`, textStyle({ role: "emphasis", size: 24, color: COLOR.ink })).setOrigin(0.5));
      body.add(drawGlyph(this.scene, "page-next", 300, pagerY, 40, hasOlder ? COLOR.inkHex : COLOR.inkDimHex, hasOlder ? 1 : 0.35));
      if (hasOlder) {
        const hit = this.scene.add.rectangle(300, pagerY, 90, 90, 0xffffff, 0).setInteractive({ useHandCursor: true });
        hit.on("pointerup", () => goTo(index + 1));
        body.add(hit);
      }
    });
  }

  /**
   * 한계 돌파 테크트리.
   *
   * 별 하나에서 시작해 다섯까지 오르는 길을 한 장에 세운다. 단계마다 드는 **그 개체의 파편**과
   * 열리는 효과·레벨 상한을 함께 적어, 연구소 중복 획득이 무엇으로 돌아오는지 여기서 다 읽히게 한다.
   */
  private openBreakthroughSteps(from: PopupSource): void {
    const def = this.currentDef;
    if (!def) return;
    const progress = relicProgression.getProgress(def.id);
    const stars = this.publicProfile ? Math.max(1, this.publicProfile.stars) : relicStars(progress.breakthrough);
    const held = this.publicProfile ? 0 : relicProgression.getFragments(def.id);
    this.popups.open({ width: 900, height: 700, title: "한계 돌파", tilt: -1.2, ...anchorOf(from) }, (body) => {
      body.add(this.scene.add.text(-390, -262, "연구소에서 같은 개체를 다시 획득하면 그 개체의 파편이 쌓인다.", textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(0, 0));
      body.add(this.scene.add.text(-390, -226, "파편으로 한계를 돌파할 때마다 별이 하나 오른다.", textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(0, 0));
      BREAKTHROUGH_STEPS.forEach((entry, index) => {
        // 돌파 한 번이 별 하나다. 표의 첫 줄이 곧 "별 둘로 가는 길"이다.
        const star = index + 2;
        const y = -140 + index * 84;
        const reached = stars >= star;
        body.add(drawLayer(this.scene, 0, y, slantedRect(700, 70, 14), {
          fill: reached ? 0x2a2418 : 0x121820,
          alpha: reached ? 0.95 : 0.7,
          edge: COLOR.accent,
          edgeAlpha: reached ? 0.9 : 0.2,
        }));
        const mark = this.scene.add.container(-306, y);
        addStarMark(this.scene, mark, 0, 0, 30, star);
        mark.setAlpha(reached ? 1 : 0.45);
        body.add(mark);
        body.add(this.scene.add.text(-268, y, "파편 " + entry.fragments, textStyle({ role: "display", size: 24, color: reached ? COLOR.accentText : COLOR.inkDim })).setOrigin(0, 0.5));
        // 단계 효과 문구는 core의 표 하나에서만 온다. 화면이 따로 적어 두면 수치가 갈라진다.
        body.add(this.scene.add.text(-140, y, entry.label + "   ·   레벨 " + entry.levelCap, textStyle({ role: "body", size: 22, color: reached ? COLOR.ink : COLOR.inkDim })).setOrigin(0, 0.5));
      });
      const line = this.publicProfile
        ? "별 " + stars + " / " + RELIC_STAR_CAP
        : "별 " + stars + " / " + RELIC_STAR_CAP + "   ·   가진 파편 " + held;
      body.add(this.scene.add.text(0, 250, line, textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0.5));
      if (stars >= RELIC_STAR_CAP) {
        body.add(this.scene.add.text(0, 288, "별 다섯 뒤의 중복은 DNA 조각으로 쌓인다.", textStyle({ role: "body", size: 21, color: COLOR.inkDim })).setOrigin(0.5));
      }
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
  private enterGallery(onClose?: () => void): void {
    const def = this.currentDef;
    if (!def || this.gallery || !this.portrait) return;
    const asset = portraitAssetFor(def.portraitAssetId);
    const portrait = this.portrait;
    // 되돌아오는 트윈이 아직 돌고 있으면 여기서 끊는다. 그대로 두면 감상 중에도 원화가
    // 제자리를 향해 계속 움직인다.
    this.scene.tweens.killTweensOf(portrait);
    this.galleryReturn = onClose;
    // 감상 모드도 일반 창과 같은 보정을 거쳐 적 전용 우회 좌표를 만들지 않는다.
    placePuppet(portrait, asset, infoPortraitPlacement(asset, { x: BASE_WIDTH / 2, y: BASE_HEIGHT * 0.52, height: BASE_HEIGHT * 1.02 }));
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
    exit.on("pointerup", () => this.leaveGallery());
    this.gallery = exit;
  }

  /** 감상에서 나온다. 판이 다시 제자리로 미끄러져 들어온다. */
  private leaveGallery(): void {
    const portrait = this.portrait;
    this.gallery?.destroy();
    this.gallery = undefined;
    // 부른 돋보기를 눌린 크기에서 풀어 준다.
    this.galleryReturn?.();
    this.galleryReturn = undefined;
    // 돌아갈 곳은 지금 값이 아니라 **처음 세운 자리**다. 자세히 보기를 몇 번을 여닫아도
    // 원화 크기가 그대로인 이유가 여기에 있다.
    const home = this.portraitHome;
    if (portrait && home) {
      this.scene.tweens.killTweensOf(portrait);
      this.scene.tweens.add({ targets: portrait, x: home.x, y: home.y, scale: home.scale, duration: 320, ease: "Cubic.Out" });
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
        const gem = gemId ? session.runeInventory.find(({ instanceId }) => instanceId === gemId) : undefined;
        body.add(drawLayer(this.scene, 0, y, slantedRect(680, 108, 16), {
          fill: gem ? 0x1c1520 : 0x0d1219,
          alpha: gem ? 0.95 : 0.7,
          edge: gem ? RUNE_ACCENT[gem.rarity] : COLOR.accent,
          edgeAlpha: gem ? 0.7 : 0.16,
        }));
        // 자리마다 들어갈 조각이 정해져 있으므로 빈 칸도 제 조각을 옅게 세워 둔다.
        body.add(addRuneFrame(this.scene, -272, y, 92, gem?.rarity, index as RunePart, { mainStats: gem?.mainStats, engraved: (gem?.engravings.length ?? 0) > 0 }));
        body.add(this.scene.add.text(-206, y - 26, RUNE_PART_LABELS[index as RunePart], textStyle({ role: "body", size: 20, color: COLOR.inkDim })).setOrigin(0, 0));
        body.add(
          this.scene.add
            .text(-206, y + 2, gem ? (gem.customName ?? `${RUNE_RARITY_LABELS[gem.rarity]} 룬`) : "빈 자리", textStyle({ role: "display", size: 28, color: gem ? COLOR.ink : COLOR.inkDim }))
            .setOrigin(0, 0),
        );
        if (gem) {
          const effect = [...gem.mainStats, ...gem.subStats].map(({ key, value }) => RUNE_STAT_LABEL[key] + " +" + value + "%").join("   ");
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
    // 판은 글자가 들어가는 만큼만 넓다. 남는 여백은 읽는 데 도움이 되지 않고 뒤 화면만 가린다.
    const width = 700;
    const edge = width / 2 - 34;
    const height = 1150;
    // 이 창만 **누른 자리에 붙지 않고 화면 가운데에 선다.** 열두 줄이 쌓인 성적표라 돋보기에
    // 매달면 판이 통째로 아래로 밀려 마지막 줄이 화면 밑변에 붙는다(v0.58.0까지 그랬다) —
    // 손이 닿기도 읽기도 어려운 자리다. 관찰 기록판과 같은 이유로 자리를 고정한다.
    this.popups.open({
      width, height, title: "능력치 상세", tilt: -1.2,
      x: BASE_WIDTH / 2, y: EXTRA_STATS_POPUP_Y, onClose: from.onClose,
    }, (body) => {
      // 칸에는 오각형이 서 있으므로 여기서는 **숫자**를 맡는다. 총 전투력이 먼저 오고, 다섯
      // 축의 정확한 값과 기본값 대비 상승분, 그 아래에 오각형에 없는 세부 수치가 온다.
      const top = -height / 2;
      // 총 전투력은 판때기 없이 맨 글자로 선다. 이 창에서 가장 굵고 큰 수라 판을 깔지 않아도
      // 저절로 맨 앞에 읽히고, 판을 깔면 아래 목록과 다른 종류의 값처럼 보인다.
      body.add(this.scene.add.text(-edge, top + 100, "전투력", textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5));
      body.add(
        this.scene.add
          .text(edge, top + 100, combatPower(stats).toLocaleString(), textStyle({ role: "display", size: 52 }))
          .setOrigin(1, 0.5)
          .setScale(1, 1.12)
          .setShadow(3, 6, "#05070a", 8, false, true),
      );
      body.add(drawHairline(this.scene, 0, top + 142, width - 68, { color: COLOR.accent, alpha: 0.3 }));
      STAT_CHIPS.forEach((chip, index) => {
        const y = top + 204 + index * 84;
        const base = def.stats[chip.key];
        const gain = stats[chip.key] - base;
        // 칸의 축 이름과 같은 색이라 그래프에서 본 축을 그대로 따라 읽는다.
        body.add(this.scene.add.text(-edge, y, chip.label, textStyle({ role: "display", size: 30, color: `#${chip.color.toString(16).padStart(6, "0")}` })).setOrigin(0, 0.5));
        body.add(this.scene.add.text(edge, y - 12, stats[chip.key].toLocaleString(), textStyle({ role: "display", size: 36 })).setOrigin(1, 0.5));
        const detail = gain > 0 ? `기본 ${base.toLocaleString()}   +${gain.toLocaleString()}` : `기본 ${base.toLocaleString()}`;
        const detailStyle = gain > 0
          ? textStyle({ role: "body", size: 21, color: COLOR.accentText })
          : textStyle({ role: "body", size: 21, color: COLOR.inkDim });
        body.add(this.scene.add.text(edge, y + 22, detail, detailStyle).setOrigin(1, 0.5));
        body.add(drawHairline(this.scene, 0, y + 42, width - 68, { color: COLOR.accent, alpha: 0.14 }));
      });
      // 사거리는 오각형에 없는 축이라 다섯 줄 **아래**에 한 줄로 붙는다. 값이 아니라 단계라
      // 기본값 대비 상승분이 없고, 단계 자체를 색이 말한다(근거리 붉은색·중거리 푸른색·원거리 노란색).
      const reachY = top + 204 + STAT_CHIPS.length * 84;
      const reachHex = reachToneHex(def.reachTier);
      body.add(this.scene.add.text(-edge, reachY, "사거리", textStyle({ role: "display", size: 30, color: reachHex })).setOrigin(0, 0.5));
      body.add(this.scene.add.text(edge, reachY, REACH_LABEL[def.reachTier], textStyle({ role: "display", size: 36, color: reachHex })).setOrigin(1, 0.5));
      body.add(drawHairline(this.scene, 0, reachY + 42, width - 68, { color: COLOR.accent, alpha: 0.14 }));
      body.add(
        this.scene.add
          .text(-edge, top + 700, "세부 능력치", textStyle({ role: "emphasis", size: 26, color: COLOR.accentText }))
          .setOrigin(0, 0),
      );
      EXTRA_STATS.forEach((row, index) => {
        const y = top + 772 + index * 76;
        body.add(this.scene.add.text(-edge, y, row.label, textStyle({ role: "body", size: 28, color: COLOR.inkDim })).setOrigin(0, 0.5));
        body.add(this.scene.add.text(edge, y, stats[row.key].toLocaleString() + (row.suffix ?? ""), textStyle({ role: "display", size: 33 })).setOrigin(1, 0.5));
        if (index < EXTRA_STATS.length - 1) body.add(drawHairline(this.scene, 0, y + 38, width - 68, { color: COLOR.accent, alpha: 0.14 }));
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
      // 지도와 전투의 CharacterInfoManager가 모두 이 경로를 써서 폰토스 보정도 동일하다.
      ...infoPortraitPlacement(asset, PORTRAIT_FOCUS),
      depth: Math.max(this.portraitDepth, this.root.depth + 1),
    });
    if (request !== this.portraitRequest) { portrait.destroy(); return; }
    this.portrait?.destroy();
    this.portrait = portrait;
    // 세운 그 자리가 곧 제자리다. 전신 감상은 여기로만 되돌아온다.
    this.portraitHome = { x: portrait.x, y: portrait.y, scale: portrait.scaleX };
    // 화면 아무 데나 눌러도 통통 튀면 정신이 없다. 코어 관절 둘레의 몸통에서만 반응한다.
    portrait.disableInteractive();
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
    const entries: [string, Skill, number | undefined, SkillArtSlot][] = [
      ["패시브", { ...def.passive, power: def.passive.value, damageType: "physical" } as unknown as Skill, undefined, "passive"],
      ["일반 공격", def.basic, undefined, "basic"],
      ["궁극기", def.ultimate, def.ultimate.cost, "ultimate"],
    ];
    const tint = skillArtTint(def.element, def.role);
    entries.forEach(([kindLabel, skill, gaugeCost, slot], index) => {
      const size = SKILL_ICON.size;
      const container = this.scene.add.container(SKILL_ICON.x + index * SKILL_ICON.step, BASE_HEIGHT - 196);
      const bevel = { topLeft: size * 0.26, topRight: 0, bottomRight: size * 0.26, bottomLeft: 0 };
      const chip = chipPoints(size, size, { bevel });
      // 아이콘은 **액자**다. 배경 원화가 비쳐 보이면 그림 두 장이 겹쳐 무엇이 스킬인지 흐려지므로
      // 판을 불투명하게 채우고 사방을 한 줄로 두른다(화면의 다른 판과 다른 이유가 이것이다).
      container.add(drawLayer(this.scene, 0, 0, chip, {
        fill: index === 2 ? 0x241f16 : 0x11161d,
        alpha: 1,
        edge: COLOR.accent,
        edgeAlpha: index === 2 ? 0.9 : 0.45,
      }));
      const innerSize = size - 16;
      const inner = chipPoints(innerSize, innerSize - 14, {
        bevel: { topLeft: innerSize * 0.22, topRight: 0, bottomRight: innerSize * 0.22, bottomLeft: 0 },
      });
      container.add(drawLayer(this.scene, 0, -6, inner, { fill: 0x05080c, alpha: 1, shadow: false }));
      const art = skillArtFor(def.id, slot);
      // 그림 자리에 같은 색을 아주 옅게 한 겹 깔아 아이콘이 색판 위에 앉은 것처럼 보이게 한다.
      // 전용 아트가 아직 없는 개체(적 등)도 같은 색판을 깐다 — 그림만 공용 아이콘일 뿐 액자는
      // 같은 체계여야, 아군 창과 적 창이 서로 다른 화면처럼 보이지 않는다.
      container.add(drawLayer(this.scene, 0, -6, inner, { fill: tint, alpha: art ? SKILL_ART_WASH_ALPHA : SKILL_ART_WASH_ALPHA * 0.7, shadow: false }));
      // 테두리 안쪽으로 스며드는 어둠. 그림이 액자 안으로 들어앉아 보인다.
      container.add(drawInnerVignette(this.scene, 0, -6, inner, { strength: 0.55 }));
      const texture = art ?? (this.scene.textures.exists(skill.iconAssetId) ? skill.iconAssetId : FALLBACK_SKILL_ICON);
      const image = this.scene.add.image(0, -8, texture).setDisplaySize(size * (art ? 0.74 : 0.52), size * (art ? 0.74 : 0.52));
      // 전용 일러스트는 흰 실루엣이라 여기서 속성·직군을 섞은 색을 입는다.
      if (art) image.setTint(tint);
      container.add(image);
      // 액자 안의 이름은 그림 다음으로 먼저 읽히는 것이라 굵고 크게 둔다.
      const kindStyle = index === 2
        ? textStyle({ role: "display", size: 25, color: COLOR.accentText })
        : textStyle({ role: "display", size: 25, color: COLOR.ink });
      container.add(this.scene.add.text(0, size / 2 - 27, kindLabel, kindStyle).setOrigin(0.5));
      // 액자 테두리. 채운 판 위에 한 줄을 얹어 배경 원화와 확실히 갈라 놓는다.
      container.add(drawShapeOutline(this.scene, 0, 0, chip, { color: COLOR.accent, alpha: index === 2 ? 0.75 : 0.42, width: 3 }));
      const hit = this.scene.add.rectangle(0, 0, size, size, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => container.setScale(1.08));
      hit.on("pointerout", () => { if (!this.popups.isOpen) container.setScale(1); });
      hit.on("pointerup", () => {
        // 팝업이 떠 있는 동안 아이콘은 눌린 채로 남는다. 어디서 나온 쪽지인지 보이게 한다.
        container.setScale(1.08);
        openSkillPopup(this.scene, this.popups, this.keywords, this.skillViewModel(kindLabel, skill, gaugeCost, slot), {
          x: container.x,
          y: container.y - size / 2,
          onClose: () => container.setScale(1),
        });
      });
      container.add(hit);
      // 패시브 위에만 이 개체의 피버 발현을 작게 얹는다. 야성은 벌이 아니라 상이라는 표시다.
      if (index === 0) this.addFerocityBadge(container.x, container.y - size / 2 - 64, def);
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
    // 스킬 아이콘(150)보다는 작게 두되, 그림이 무엇인지 알아볼 만큼은 키운다. 너무 작으면
    // 폭주 일러스트가 점처럼 뭉갠다.
    const badgeSize = 96;
    const badge = this.scene.add.container(x, y);
    const shape = chipPoints(badgeSize, badgeSize, {
      bevel: { topLeft: badgeSize * 0.34, topRight: 0, bottomRight: badgeSize * 0.34, bottomLeft: 0 },
    });
    badge.add(drawLayer(this.scene, 0, 0, shape, { fill: FEROCITY_BADGE, alpha: 1, edge: 0xf0a58a, edgeAlpha: 0.8, glow: { color: 0x8f3a2a, strength: 0.35, height: 0.6 } }));
    badge.add(drawInnerVignette(this.scene, 0, 0, shape, { strength: 0.4 }));
    // 폭주도 스킬 넷 중 하나라 전용 일러스트를 쓴다. 다만 붉은 판 위에서는 속성 색을 그대로
    // 얹으면 판에 묻히므로, 여기서만 야성의 살구빛을 쓴다 — 이 뱃지는 개체 구분이 아니라
    // "야성이 이렇게 터진다"를 알리는 자리이기 때문이다.
    const art = skillArtFor(def.id, "ferocity");
    if (art) {
      badge.add(this.scene.add.image(0, -13, art).setDisplaySize(badgeSize * 0.64, badgeSize * 0.64).setTint(0xffd9c4));
    } else {
      badge.add(drawGlyph(this.scene, "ferocity", 0, -13, badgeSize * 0.46, 0xffd9c4));
    }
    // 스킬 액자와 같은 방식으로 이름을 안쪽 아래에 단다. 셋과 나란히 읽히려면 이름이 있어야 한다.
    badge.add(this.scene.add.text(0, badgeSize / 2 - 23, "폭주", textStyle({ role: "display", size: 19, color: "#ffd9c4" })).setOrigin(0.5));
    // 입력 영역도 뱃지 크기에 딱 맞춘다. 넓게 잡으면 아래 아이콘의 터치를 가로챈다.
    const hit = this.scene.add.rectangle(0, 0, badgeSize, badgeSize, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => badge.setScale(1.1));
    hit.on("pointerout", () => { if (!this.popups.isOpen) badge.setScale(1); });
    hit.on("pointerup", () => {
      badge.setScale(1.1);
      this.openFerocityTrait(def, { x, y: y - badgeSize / 2 - 12, onClose: () => badge.setScale(1) });
    });
    badge.add(drawShapeOutline(this.scene, 0, 0, shape, { color: 0xf0a58a, alpha: 0.65, width: 3 }));
    badge.add(hit);
    this.chrome.add(badge);
    // 스킬 아이콘과 같은 목록에 담아 미보유 개체에서 함께 숨고 다시 그릴 때 함께 지워진다.
    this.skillIcons.push(badge);
  }

  /** 개체별 폭주 발현 설명. 야성 규칙 자체는 강조된 말을 눌러 다시 열 수 있다. */
  private openFerocityTrait(def: RelicDef, from: PopupSource): void {
    const { atk: attack, def: defense } = relicProgression.getFinalStats(def.id);
    const defensePercent = def.ferocityTrait.effectId === "splashDamage" ? def.ferocityTrait.defenseDamagePercent : undefined;
    const attackPercent = def.ferocityTrait.effectId === "crescendoStaccato" ? def.ferocityTrait.damagePercent : undefined;
    // 폭주 추가 피해도 일반 스킬과 같은 수치 링크를 써서 캐릭터가 늘어도 별도 팝업을 만들지 않는다.
    const convertedDamage = defensePercent !== undefined ? Math.round(defense * defensePercent / 100)
      : attackPercent !== undefined ? Math.round(attack * attackPercent / 100)
      : undefined;
    const damageSourceLabel = defensePercent !== undefined ? "방어력" : "공격력";
    const contextualKeywords: KeywordDef[] = [];
    if (convertedDamage !== undefined) contextualKeywords.push({
      id: "damage-value", term: String(convertedDamage), kind: "규칙",
      description: `현재 ${damageSourceLabel}에서 ${defensePercent ?? attackPercent}%를 받아 계산한 추가 피해 수치다.`,
    });
    // 메테의 스타카토 추가타는 기본 공격과 같은 효과를 다시 부르는 것이므로 그 뜻을 여기서 짧게 설명한다.
    if (def.ferocityTrait.effectId === "crescendoStaccato") contextualKeywords.push({
      id: "mette-staccato", term: "스타카토", kind: "규칙",
      description: "메테의 [[basic-attack|기본 공격]]과 같은 마법 추가타다. 적중한 대상을 [[stagger|경직]]시킨다.",
    });
    // 폭주도 패시브와 같은 정형 상세창을 사용한다. 별도 제목 레이어 없이 아이콘 옆에서
    // 스킬 종류·이름·발현 유형을 한 번에 읽게 한다.
    openSkillPopup(this.scene, this.popups, this.keywords, {
      name: def.ferocityTrait.name,
      kindLabel: "폭주",
      iconAssetId: "skill-icon-buff",
      art: skillArtFor(def.id, "ferocity"),
      tint: skillArtTint(def.element, def.role),
      effectType: "buff",
      valueLabel: "야성 발현",
      contextualKeywords: contextualKeywords.length > 0 ? contextualKeywords : undefined,
      // 설명 수치는 전투가 읽는 특성 필드에서 생성해 정적 문구와 실제 효과가 갈라지지 않는다.
      description: "[[ferocity|야성 게이지]]가 가득 차면 폭주한다. "
        + ferocityTraitDescription(def.ferocityTrait, { attack, defense }),
    }, from);
  }

  /** 읽기 전용 도감에 실제 방어력을 가정하지 않은 스킬 능력치 배율을 만든다. */
  private skillViewModel(kindLabel: string, skill: Skill | Passive, gaugeCost?: number, slot?: SkillArtSlot): SkillInfoViewModel {
    // 레벨·돌파·장착 룬을 모두 반영한 정의를 미리보기에 넘겨 74 같은 기본치가 성장 후에 남지 않게 한다.
    const finalDef = this.currentDef && { ...this.currentDef, stats: relicProgression.getFinalStats(this.currentDef.id) };
    const attacker: Combatant | undefined = finalDef && {
      def: finalDef, hp: finalDef.stats.hp, maxHp: finalDef.stats.hp,
      energy: 0, ferocity: 0, bondLevel: 0, ferocityFever: false,
      breakthrough: relicProgression.getProgress(finalDef.id).breakthrough,
    };
    // 공격 속도 복합 궁극기(스피나 등)는 위력만 보는 previewSkillDamage로는 실제 한 방의
    // 절반만 계산되므로, 상단 라벨과 본문이 같은 하나의 합산 수치를 쓰도록 먼저 따로 구한다.
    const attackSpeedPower = "attackSpeedPower" in skill ? (skill as Ultimate).attackSpeedPower : undefined;
    const compositeDamage = attackSpeedPower !== undefined
      ? attackSpeedCompositeDamageKeyword(skill as Ultimate, attacker?.def.stats.atk, attacker?.def.stats.attackSpeed)
      : undefined;
    const preview = !compositeDamage && attacker && canPreviewSkillDamage(skill, kindLabel)
      ? previewSkillDamage(attacker, skill as Skill) : undefined;
    // 주기 타격에만 얹히는 몫(토리카의 셋째 뿔)은 본 타격과 다른 능력치에서 나오므로 같은
    // 미리보기 경계를 한 번 더 지나 제 실제 수치를 구한다 — 본문이 스스로 곱하면 전투와 갈린다.
    const periodicBonus = "periodicBonusScaling" in skill ? (skill as BasicAttack).periodicBonusScaling : undefined;
    const periodicBonusPreview = periodicBonus !== undefined && attacker && canPreviewSkillDamage(skill, kindLabel)
      ? previewSkillDamage(attacker, {
        ...(skill as Skill),
        power: periodicBonus.power,
        scalingStat: periodicBonus.stat,
        secondaryScaling: undefined,
        damageType: "physical",
      } as Skill)
      : undefined;
    // 순환 기본 공격은 걸음마다 위력이 통째로 달라 한 수로 말할 수 없다. 걸음마다 같은
    // 미리보기 경계를 지나 제 수치를 구하고, 본문이 그 순서 그대로 읽는다.
    const cycle = "cycle" in skill ? (skill as BasicAttack).cycle : undefined;
    const cycleDamage = cycle && attacker && canPreviewSkillDamage(skill, kindLabel)
      ? cycle.map((step) => {
        const stepPreview = previewSkillDamage(attacker, { ...(skill as Skill), power: step.power } as Skill);
        return stepPreview.kind === "scaling" ? stepPreview.amount : 0;
      })
      : undefined;
    // 덧칠 폭발 궁극기의 위력은 겹당 값이라, 상단 라벨만 겹을 다 쌓았을 때의 최대 피해를 말한다.
    // 겹 상한은 궁극기가 아니라 그 덧칠을 만드는 기본 공격이 갖고 있으므로 거기서 읽는다.
    const overpaintCap = finalDef?.basic.statusEffects?.find((effect) => effect.kind === "overpaint");
    const detonationDamage = "overpaintDetonation" in skill && (skill as Ultimate).overpaintDetonation === true
      ? overpaintDetonationDamageKeyword(preview?.kind === "scaling" ? preview.amount : undefined,
        overpaintCap?.kind === "overpaint" ? overpaintCap.maxStacks : undefined)
      : undefined;
    const damageDetail = compositeDamage ?? detonationDamage ?? damageKeyword(preview);
    const shieldDetail = "kind" in skill ? passiveShieldKeyword(skill as Passive, attacker?.def.stats.atk) : undefined;
    const allyHealingPower = "allyHealingPower" in skill ? (skill as Ultimate).allyHealingPower : undefined;
    const healDetail = allyHealingPower !== undefined ? allyHealPowerKeyword(allyHealingPower, attacker?.def.stats.ap) : undefined;
    const valueLabel = compositeDamage
      ? `피해량 [[damage-value|${compositeDamage.term}]]`
      : detonationDamage
        ? `예상 최대 피해량 [[damage-value|${detonationDamage.term}]]`
        : preview?.kind === "scaling"
          ? `${preview.label} [[damage-value|${preview.amount}]]`
          : undefined;
    return {
      name: skill.name,
      kindLabel,
      iconAssetId: skill.iconAssetId as SkillIconAssetId,
      // 전용 일러스트가 있으면 팝업도 같은 그림과 같은 색을 쓴다. 아이콘과 쪽지가 갈라지면
      // 어느 스킬을 눌렀는지 되짚어야 한다.
      art: this.currentDef && slot ? skillArtFor(this.currentDef.id, slot) : undefined,
      tint: this.currentDef && skillArtTint(this.currentDef.element, this.currentDef.role),
      effectType: skill.effectType,
      valueLabel,
      contextualKeywords: [damageDetail, shieldDetail, healDetail].filter((item): item is KeywordDef => item !== undefined),
      // 정적 문장에서 수치를 재해석하지 않고 전투 정의를 그대로 팝업에 넘긴다.
      targeting: "targeting" in skill ? skill.targeting as Ultimate["targeting"] : undefined,
      statusEffects: "statusEffects" in skill ? skill.statusEffects : undefined,
      durationSeconds: "durationSeconds" in skill ? skill.durationSeconds as number : undefined,
      recoveryPercent: "kind" in skill && skill.kind === "emergencyRecovery" && "value" in skill
        ? skill.value as number
        : undefined,
      damageHealingPercent: "damageHealingPercent" in skill ? skill.damageHealingPercent as number : undefined,
      gaugeCost,
      // 구조화된 연격·복합 계수는 정적 설명을 복제하지 않고 키워드가 연결된 공용 문장으로 표시한다.
      description: "kind" in skill
        ? passiveDescription(skill as Passive, attacker?.def.stats.atk)
        : skillDescription(skill as Skill, {
          ap: attacker?.def.stats.ap,
          atk: attacker && { atk: attacker.def.stats.atk, attackSpeed: attacker.def.stats.attackSpeed },
          // 본문은 아이콘 위 라벨과 **같은** 수치를 받아 쓴다. 따로 계산하면 위아래가 갈린다.
          damage: preview?.kind === "scaling" ? preview.amount : undefined,
          periodicBonusDamage: periodicBonusPreview?.kind === "scaling" ? periodicBonusPreview.amount : undefined,
          cycleDamage,
        }),
    };
  }

  /** 도감은 보유 여부를 전달해 정적 기록과 성장 정보의 잠금을 한곳에서 적용한다. */
  showRelic(def: RelicDef, owned = true): void {
    this.publicProfile = undefined;
    this.combatLine.setVisible(false);
    this.openCharacter(def, owned);
  }

  /** 친구 서버가 공개한 스냅샷만 사용하며 로컬 `session.relicProgress`는 읽지 않는다. */
  showFriend(profile: PublicRelicProfileDto): void {
    this.publicProfile = profile;
    const def = RELICS.find((relic) => relic.id === profile.relicId);
    if (!def) throw new Error(`알 수 없는 공개 렐릭 id: ${profile.relicId}`);
    this.combatLine.setVisible(false);
    this.openCharacter(def, true);
  }

  /**
   * 적 하나를 연다.
   *
   * 친구 창과 같은 판을 쓰고 급여·돌파·유대·룬만 빠진다. 적을 위한 화면을 따로 만들지 않는
   * 이유는, 정보창이 좋아질 때 그 화면만 옛 모습으로 남기 때문이다.
   *
   * `def.stats`는 이미 스테이지 레벨이 반영된 값이다(`getStageEnemies`). 창이 레벨 보정을
   * 다시 하지 않아야 지도·편성·전투가 같은 수치를 보여 준다.
   */
  showEnemy(def: RelicDef, options: { level?: number; live?: Fighter } = {}): void {
    // 보스도 호출자가 지정한 표시 레벨을 공개 프로필에 보존하며 일반 적의 기본 LV.1은 유지한다.
    this.publicProfile = {
      relicId: def.id,
      level: options.level ?? 1,
      stars: 0,
      stats: { ...def.stats },
      skillIds: [def.passive.id, def.basic.id, def.ultimate.id],
    };
    this.openCharacter(def, true);
    const live = options.live;
    this.combatLine.setVisible(this.capabilities.showRuntimeCombat && live !== undefined);
    if (!live) return;
    const ailment = live.bleed ? `출혈 ${Math.ceil(live.bleed.remaining)}초` : "상태이상 없음";
    this.combatLine.setText(`HP ${Math.ceil(live.hp)} / ${live.maxHp}   ·   궁극 ${Math.round(live.energy)}   ·   야성 ${Math.round(live.ferocity)}   ·   ${ailment}`);
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
    // 급여 버튼 자리를 **열 때마다** 알린다. 만들 때 한 번만 알리면, 씬을 오갈 때 새 창이 먼저
    // 알린 값을 옛 창이 사라지며 지워 버린다 — 그 뒤로는 아무도 다시 알리지 않는다.
    // 판이 제자리를 잡은 다음 프레임에 재야 기울임과 이동이 반영된 실제 좌표가 나온다.
    this.scene.time.delayedCall(0, () => {
      if (!this.feedButton.active || !this.isOpen) return;
      const bounds = this.feedButton.getBounds();
      setDebugFeedButton({ x: bounds.centerX, y: bounds.centerY });
    });
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

  /**
   * 별은 다섯 칸이 아니라 로마자 한 글자다. 모양과 색은 `rarityMark.ts`가 정한다.
   *
   * 세는 것은 희귀도가 아니라 한계 돌파 단계다. 친구·적처럼 공개 프로필로 여는 창은 그쪽이
   * 알려 준 별을 그대로 쓰고, 값이 없으면 모든 개체의 시작인 별 하나로 본다.
   */
  private paintStars(def: RelicDef): void {
    this.starRow.removeAll(true);
    const stars = this.publicProfile
      ? Math.max(1, this.publicProfile.stars)
      : relicStars(relicProgression.getProgress(def.id).breakthrough);
    addStarMark(this.scene, this.starRow, 0, 0, STAR_SIZE * 2, stars);
  }

  /** 레벨·경험치·유대·능력치·젬을 지금 상태로 다시 칠한다. */
  private refreshGrowth(): void {
    const def = this.currentDef;
    if (!def) return;
    // 공개 프로필은 필요한 표시용 기본값도 DTO로부터 만들며 플레이어 저장을 건드리지 않는다.
    const progress: RelicProgress = this.publicProfile
      ? { level: this.publicProfile.level, exp: 0, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, null, null] }
      : relicProgression.getProgress(def.id);
    const finalStats = this.publicProfile?.stats ?? relicProgression.getFinalStats(def.id);
    const cap = relicLevelCap(progress.breakthrough);
    const maxed = progress.level >= cap;

    // 사거리는 성장하지 않는 정적 값이지만, 다른 캐릭터로 넘길 때 함께 갈아 끼워야 한다.
    this.reachLabel.setText("사거리 · " + REACH_LABEL[def.reachTier]);
    this.levelValue.setText(String(progress.level));
    this.levelCap.setText("/ " + cap);
    // 숫자 폭이 자리 수에 따라 달라지므로 붙는 자리도 그릴 때마다 다시 잡는다.
    this.levelCap.setX(this.levelValue.x + this.levelValue.displayWidth + 14);
    // 상한은 숫자의 **발치**에 붙는다. 숫자 높이는 자리 수와 무관하게 늘 같지만, 글꼴이
    // 늦게 도착하면 처음 그린 높이가 다르므로 그릴 때마다 다시 맞춘다.
    this.levelCap.setY(this.levelValue.y + this.levelValue.displayHeight - 4);
    const need = maxed ? 0 : relicExpToNext(progress.level);
    this.expBar.setValue(maxed ? 1 : progress.exp / need);
    // 경험치 줄은 "얼마나 컸는가"만 말한다. 급여에 드는 치즈케이크는 바로 아래 버튼이 맡는다.
    this.expLabel.setText(maxed ? "MAX" : progress.exp + " / " + need + " EXP");
    this.paintFeedButton(this.ownedNow && canFeedRelic(progress, session.wallet.cheesecake));
    this.feedLabel.setText(maxed ? "최대 레벨" : "급여하기");
    // 급여는 치즈케이크를 먹이는 일이라 버튼이 그 수를 직접 말한다. 상단 줄과 같은 세션 지갑을
    // 읽으므로 두 곳의 값이 갈라지지 않는다.
    this.feedCost?.setText(formatCurrency(session.wallet.cheesecake) + "/" + (maxed ? "—" : String(FEED_UNIT.cheesecake)));
    // 모자라면 줄 전체가 붉어진다. 두 수 중 하나만 물들이면 어느 쪽이 모자란 것인지 되레 헷갈린다.
    this.feedCost?.setColor(!maxed && session.wallet.cheesecake < FEED_UNIT.cheesecake ? COLOR.dangerText : FEED_TEXT);
    this.feedCostLayout?.();
    this.paintBreakButton(progress);

    const bondMaxed = progress.bondLevel >= BOND_LEVEL_CAP;
    const bondBase = BOND_TOTAL_XP_BY_LEVEL[progress.bondLevel];
    const bondNext = bondMaxed ? bondBase : BOND_TOTAL_XP_BY_LEVEL[progress.bondLevel + 1];
    this.bondValue.setText(String(progress.bondLevel));
    this.bondBar.setValue(bondMaxed ? 1 : (progress.bondXp - bondBase) / (bondNext - bondBase));
    // 유대는 야성을 눌러 주는 것이 아니라 더 빨리 끓게 한다. 피버로 가는 지름길이다.
    const boost = Math.round((BOND_FEROCITY_MULTIPLIER[progress.bondLevel] - 1) * 100);
    this.bondLabel.setText((bondMaxed ? "MAX" : progress.bondXp + " / " + bondNext + " EXP") + "   ·   야성 상승 +" + boost + "%");

    this.statRadar?.draw(finalStats, STAT_RADAR_RADIUS);

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
