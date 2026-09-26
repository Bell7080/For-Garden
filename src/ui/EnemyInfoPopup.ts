import Phaser from "phaser";
import { galleryPortraitPlacement, infoPortraitPlacement } from "./portraitPlacement";
import { battleAssetFor, enableHitOnClick, placePuppet, playMotion, portraitAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { setDebugInfoAssetReady } from "../debug";
import { breakthroughEnhances, breakthroughGrade, relicLevelCap } from "../core/relicProgression";
import type { Passive, RelicDef, Skill, Ultimate } from "../core/types";
import { KeywordManager } from "../managers/KeywordManager";
import { AffinityBadge } from "./AffinityBadge";
import { ELEMENT_ICON, ROLE_ICON } from "./affinityIcons";
import { openElementPopup, openRolePopup } from "./affinityPopups";
import { ENEMY_INFO, enemyInfoPanelCenterY } from "./enemyInfoLayout";
import {
  addInfoFerocityBadge, addInfoFigureStand, addInfoMagnifier, addInfoPanel, addInfoRoleBadge, buildSkillViewModel,
  openBreakthroughStepsPopup, openEncounterRolePopup, openExtraStatsPopup, openFerocityTraitPopup, paintRarityGem, slotFallbackIcon,
} from "./info";
import { mountInfoPopupFrame } from "./infoPopupFrame";
import { addObservationJournalButton, openObservationJournal } from "./ObservationJournal";
import { POPUP_TITLE_SIZE, type PopupLayer } from "./PopupLayer";
import { addBreakthroughGradeMark } from "./rarityMark";
import { addSectionTitle } from "./SectionTitle";
import { shrinkTextToWidth } from "./textFit";
import { addSkillIconFrame, skillSlotLabel } from "./SkillIconFrame";
import { openSkillPopup } from "./SkillPopup";
import { breakthroughEffectText } from "./skillPresentation";
import type { SkillArtSlot } from "./skillArt";
import { StatRadar } from "./StatRadar";
import { reachLabel, STAT_TONE } from "./statTones";
import { COLOR, textStyle } from "./theme";
import { t } from "../i18n";
import { pressIn, pressOut } from "./pressFeedback";

/** 그 적이 실제로 서 있는 상태. 화면이 레벨 보정을 다시 하지 않고 배치된 값을 그대로 받는다. */
export interface EnemyInfoSnapshot {
  /** 스테이지·노드가 성장시킨 정의. `stats`는 이미 레벨·돌파가 반영된 값이다. */
  def: RelicDef;
  level: number;
  breakthrough: number;
  /** 야성으로 얹힌 추가 레벨. 레벨 옆에 작고 붉게 선다. */
}

/** 팝업 몸판 가운데가 화면에서 앉는 자리. 원화와 SD는 컨테이너가 아니라 이 화면 좌표에 선다. */
const SCREEN_CENTER = { x: BASE_WIDTH / 2, y: BASE_HEIGHT / 2 } as const;

/**
 * 적 정보 — **아군 정보창을 조금 줄여 놓은 팝업 한 장이다.**
 *
 * 적에게는 유대도 급여도 룬도 없다. 그 절반만 남은 내용을 화면 한 장(정보창 씬)에 펼치면 판
 * 넷 중 둘이 비어 초라하게 읽혔다. 그래서 적만 **출격 선택판만 한 팝업**에 같은 요소를 모으되,
 * 생김새는 하나도 새로 만들지 않는다 — 배경 원화, 이름 블록, 돌파 등급 표식과 돋보기, 기울어진
 * 칸과 제목표, 오각형, 왼쪽 아래 스킬 액자와 폭주 뱃지, SD 받침이 모두 정보창의 프리팹이다.
 *
 * **전투 중 줄(체력·궁극·야성·상태이상)은 두지 않는다.** 그 값은 전장의 머리 위 바와 상태 칩이
 * 실시간으로 말하고 있어, 판을 여는 순간 멈춘 숫자를 한 번 더 적을 이유가 없다.
 */
export class EnemyInfoPopup {
  private readonly keywords: KeywordManager;
  /** 원화·SD와 그 위에 얹히는 칸·액자는 판보다 위에 서므로 팝업 층 위의 제 층을 갖는다. */
  private chrome?: Phaser.GameObjects.Container;
  private portrait?: PuppetCreature;
  private figure?: PuppetCreature;
  /** 감상 중에만 사는 것들. 원화를 되돌릴 자리와 판을 덮은 입력면을 함께 붙잡는다. */
  private gallery?: { exit: Phaser.GameObjects.Rectangle; home: { x: number; y: number; scale: number }; mask: Phaser.Display.Masks.GeometryMask; onClose?: () => void };
  private galleryBody?: Phaser.GameObjects.Container;
  /** 감상이 어느 개체의 원화를 세워야 하는지. 열려 있는 동안의 스냅샷을 그대로 붙잡는다. */
  private shownDef?: RelicDef;
  /** 늦게 도착한 원화가 이미 닫힌 판 위에 서지 않도록 세대를 센다. */
  private generation = 0;
  private open = false;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer) {
    this.keywords = new KeywordManager(scene, popups);
  }

  /** 배치된 그 개체를 그대로 연다. 창은 레벨·돌파를 다시 계산하지 않는다. */
  show(snapshot: EnemyInfoSnapshot): void {
    if (this.open) return;
    this.open = true;
    const generation = ++this.generation;
    this.popups.open({
      // 제목은 개체 이름이 아니라 **정보창**이다 — 이름은 판 안의 이름 블록이 이미 크게 말하고,
      // 머리글이 같은 말을 반복하면 한 창에 이름이 두 번 선다.
      width: ENEMY_INFO.width, height: ENEMY_INFO.height, title: t("info.enemy.title"), titleSize: POPUP_TITLE_SIZE.workboard,
      dim: true, dimAlpha: 0.64, closeOnBackdrop: false, backButton: true,
      onClose: () => this.dispose(),
    }, (body) => {
      // 판(배경 원화·검은 면·가장자리 누르기·외곽선)과 그 위의 칸 층은 소환수 창과 같은 한 장이다.
      const { chrome, mask, depth } = mountInfoPopupFrame(this.scene, this.popups, body, ENEMY_INFO);
      this.chrome = chrome;
      const ctx = { scene: this.scene, popups: this.popups, keywords: this.keywords };
      paintInfoHeader(ctx, chrome, snapshot.def, ENEMY_INFO);
      this.paintLevel(chrome, snapshot);
      paintInfoStats(ctx, chrome, snapshot.def, ENEMY_INFO);
      paintInfoSkills(ctx, chrome, snapshot, ENEMY_INFO, ["passive", "basic", "ultimate"]);
      addInfoFigureStand(this.scene, chrome, ENEMY_INFO.figure.x, ENEMY_INFO.figure.groundY);
      // 아군 창과 같은 돋보기 — 원화를 통째로 보는 입구다. 판이 열려 있는 동안에만 살아 있다.
      this.galleryBody = body;
      this.shownDef = snapshot.def;
      addInfoMagnifier(this.scene, this.popups, chrome, ENEMY_INFO.portraitMagnifier.x, ENEMY_INFO.portraitMagnifier.y, (from) => this.enterGallery(from.onClose, mask));
      /*
       * **관찰 일지도 아군 창과 같은 한 장이다.**
       *
       * 적 개체도 개체번호·프로젝트·발굴지·복원 후 관찰 기록과 소속 스쿼드를 제 정의에 온전히
       * 갖고 있는데, 그것을 여는 문이 아군 정보창에만 있어 화면 어디에서도 읽을 수 없었다.
       * **인터뷰만 세우지 않는다** — 적은 복원해 데려온 개체가 아니라 매일 물어볼 상대가
       * 아니고, 그 영역을 빈 칸으로 남기느니 통째로 비운다.
       */
      addObservationJournalButton({ scene: this.scene, popups: this.popups }, chrome,
        ENEMY_INFO.journalButton.x, ENEMY_INFO.journalButton.y,
        (from) => openObservationJournal({ scene: this.scene, popups: this.popups, keywords: this.keywords },
          { def: snapshot.def, owned: false, interviews: false, from }),
        ENEMY_INFO.journalButton.size);
      void this.loadPuppets(snapshot.def, generation, depth + 0.4, depth + 0.7, mask);
    });
  }

  /** 지도·전투가 같은 창을 닫을 수 있게 하는 단일 종료점이다. */
  close(): void { if (this.open) this.popups.closeTop(); }

  get isOpen(): boolean { return this.open; }

  private dispose(): void {
    this.open = false;
    this.generation += 1;
    setDebugInfoAssetReady(undefined);
    this.gallery?.exit.destroy(); this.gallery = undefined;
    this.galleryBody = undefined;
    this.shownDef = undefined;
    this.portrait?.destroy(); this.portrait = undefined;
    this.figure?.destroy(); this.figure = undefined;
    this.chrome?.destroy(); this.chrome = undefined;
  }

  /**
   * 원화만 남기고 통째로 본다.
   *
   * 아군 정보창과 **같은 손짓·같은 결과**다 — 판과 제목이 옆으로 빠지고 원화가 화면 한가운데에
   * 한 조각도 잘리지 않게 선다. 다른 점은 자를 것이 하나 더 있다는 것뿐이다: 이 창의 원화는
   * 판과 같은 실루엣의 마스크로 잘려 있으므로, 감상하는 동안 그 마스크를 벗겼다가 돌아올 때
   * 다시 씌운다(벗기지 않으면 판 자리 밖은 보이지 않는다).
   */
  private enterGallery(onClose: (() => void) | undefined, mask: Phaser.Display.Masks.GeometryMask): void {
    const portrait = this.portrait;
    if (!portrait || this.gallery) return;
    const home = { x: portrait.x, y: portrait.y, scale: portrait.scaleX };
    const def = this.shownDef;
    if (!def) return;
    const asset = portraitAssetFor(def.portraitAssetId);
    this.scene.tweens.killTweensOf(portrait);
    portrait.clearMask(false);
    placePuppet(portrait, asset, galleryPortraitPlacement(asset));
    // SD와 판·머리글은 원화를 가리므로 함께 물러난다. 판을 없애지 않고 밀어내는 이유는
    // 돌아올 때 그대로 미끄러져 들어와야 같은 창을 보고 있었다는 것이 읽히기 때문이다.
    this.figure?.setVisible(false);
    const targets = [this.galleryBody, this.chrome].filter(Boolean) as Phaser.GameObjects.Container[];
    this.scene.tweens.add({ targets, x: BASE_WIDTH, alpha: 0, duration: 320, ease: "Cubic.In" });
    const exit = this.scene.add
      .rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, 0xffffff, 0)
      .setDepth(portrait.depth + 0.05)
      .setInteractive({ useHandCursor: true });
    exit.on("pointerup", () => this.leaveGallery());
    this.gallery = { exit, home, mask, onClose };
  }

  /** 감상에서 나온다. 원화는 **처음 세운 자리**로 돌아가고 판이 다시 미끄러져 들어온다. */
  private leaveGallery(): void {
    const state = this.gallery;
    const portrait = this.portrait;
    if (!state) return;
    this.gallery = undefined;
    state.exit.destroy();
    // 부른 돋보기를 눌린 크기에서 풀어 준다.
    state.onClose?.();
    if (portrait) {
      this.scene.tweens.killTweensOf(portrait);
      portrait.setMask(state.mask);
      this.scene.tweens.add({ targets: portrait, x: state.home.x, y: state.home.y, scale: state.home.scale, duration: 320, ease: "Cubic.Out" });
    }
    const targets = [this.galleryBody, this.chrome].filter(Boolean) as Phaser.GameObjects.Container[];
    this.scene.tweens.add({ targets, x: SCREEN_CENTER.x, alpha: 1, duration: 320, ease: "Cubic.Out" });
    this.figure?.setVisible(true);
  }



  /**
   * 돌파 등급 표식과 레벨 칸.
   *
   * 정보창과 같이 표식은 **레벨 칸 위**에 서고 그 옆에 돌파 단계표 돋보기가 붙는다. 칸 안은
   * 큰 레벨 숫자와 발치에 붙는 상한 한 줄이며, **야성으로 얹힌 몫만 그 오른쪽에 작고 붉게**
   * 선다 — 같은 개체가 사나워진 것이지 갑자기 서른 살이 된 것이 아니기 때문이다.
   */
  private paintLevel(chrome: Phaser.GameObjects.Container, snapshot: EnemyInfoSnapshot): void {
    const scene = this.scene;
    const { column, gradeRow, gradeMagnifier, levelPanel } = ENEMY_INFO;
    const grade = breakthroughGrade(snapshot.breakthrough);
    const gradeContainer = scene.add.container(gradeRow.x, gradeRow.y);
    addBreakthroughGradeMark(scene, gradeContainer, 0, 0, gradeRow.size, grade);
    chrome.add(gradeContainer);
    addInfoMagnifier(scene, this.popups, chrome, gradeMagnifier.x, gradeMagnifier.y, () => openBreakthroughStepsPopup(scene, this.popups, this.keywords, snapshot.def, grade, snapshot.def.stats));

    const panel = addInfoPanel(scene, chrome, column.x, enemyInfoPanelCenterY(levelPanel), column.width, levelPanel.height);
    addSectionTitle(scene, column.x - column.width / 2, levelPanel.top - 4, t("info.level"), { parent: chrome });
    const value = scene.add
      .text(-column.width / 2 + 54, -66, String(snapshot.level), textStyle({ role: "display", size: 96 }))
      .setOrigin(0, 0)
      .setScale(1, 1.16)
      .setShadow(3, 8, "#05070a", 10, false, true);
    panel.add(value);
    // 상한은 숫자의 **발치**에 붙는다. 가운데에 두면 현재 레벨과 같은 무게로 읽혀 헷갈린다.
    panel.add(scene.add
      .text(value.x + value.displayWidth + 14, value.y + value.displayHeight - 4, `/ ${relicLevelCap(snapshot.breakthrough)}`, textStyle({ role: "emphasis", size: 28, color: COLOR.inkDim }))
      .setOrigin(0, 1));
  }







  /**
   * 전신 원화와 SD.
   *
   * 정보창과 **같은 배치 경로**(`infoPortraitPlacement`)를 지나 코어 관절을 기준으로 크게 서고,
   * 판과 같은 실루엣의 마스크가 종아리쯤에서 잘라 준다 — Puppet은 컨테이너 변환을 물려받지
   * 않으므로 자리도 마스크도 화면 좌표로 잡는다.
   */
  private async loadPuppets(def: RelicDef, generation: number, portraitDepth: number, figureDepth: number, mask: Phaser.Display.Masks.GeometryMask): Promise<void> {
    const asset = portraitAssetFor(def.portraitAssetId);
    const [portrait, figure] = await Promise.all([
      spawnPuppet(this.scene, asset, {
        ...infoPortraitPlacement(asset, {
          x: SCREEN_CENTER.x + ENEMY_INFO.portrait.x,
          y: SCREEN_CENTER.y + ENEMY_INFO.portrait.coreY,
          height: ENEMY_INFO.portrait.height,
        }),
        depth: portraitDepth,
      }),
      spawnPuppet(this.scene, battleAssetFor(def.id), {
        x: SCREEN_CENTER.x + ENEMY_INFO.figure.x,
        groundY: SCREEN_CENTER.y + ENEMY_INFO.figure.groundY,
        height: ENEMY_INFO.figure.height,
        depth: figureDepth,
      }),
    ]);
    if (generation !== this.generation || !this.open) { portrait.destroy(); figure.destroy(); return; }
    this.portrait?.destroy();
    this.figure?.destroy();
    this.portrait = portrait;
    this.figure = figure;
    for (const puppet of [portrait, figure]) {
      puppet.disableInteractive();
      puppet.setMask(mask);
      puppet.setAlpha(0);
      this.scene.tweens.add({ targets: puppet, alpha: 1, duration: 220 });
    }
    // SD는 아군 정보창과 같이 **누르면 한 번 튄다** — 같은 받침에 선 SD가 한쪽 창에서만 반응하면
    // 적 창의 SD가 그림으로 읽힌다.
    enableHitOnClick(this.scene, figure);
    setDebugInfoAssetReady({ portrait: true, sd: true });
  }

}

/** 표식 위에 얹는 투명한 입력면. 뱃지 자체는 발광을 겹친 그림이라 입력을 받지 않는다. */
function addAffinityTap(scene: Phaser.Scene, x: number, y: number, size: number, onTap: () => void): Phaser.GameObjects.Rectangle {
  const hit = scene.add.rectangle(x, y, size, size, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerup", onTap);
  return hit;
}

/**
 * 화면에 크게 선 적 원화를 누르면 그 적의 정보창을 연다(레이드 시즌 보스 · 원정 기록 화면).
 *
 * 입력은 원화가 아니라 **상반신 둘레의 투명한 면**이 받는다 — 화면 밑동까지 서는 원화를 통째로
 * 입력으로 두면 그 앞의 목록·조작 뒤에 비친 다리까지 눌린다. 면은 원화(층 5) 바로 위, 그 앞의
 * 판·버튼보다 아래에 서므로 버튼과 목록이 먼저 손을 받는다. 누르면 정보창의 인물과 같이 한 번
 * 튀고 창이 열린다.
 */
export function addEnemyPortraitTap(
  scene: Phaser.Scene,
  zone: { top: number; bottom: number; width: number },
  portrait: () => PuppetCreature | undefined,
  onTap: () => void,
): Phaser.GameObjects.Rectangle {
  const hit = scene.add
    .rectangle(BASE_WIDTH / 2, (zone.top + zone.bottom) / 2, zone.width, zone.bottom - zone.top, 0xffffff, 0)
    .setDepth(6)
    .setInteractive({ useHandCursor: true });
  hit.on("pointerup", () => {
    const creature = portrait();
    if (creature) playMotion(scene, creature, "hit");
    onTap();
  });
  return hit;
}

/** 창과 그 안의 쪽지가 함께 쓰는 셋. 적 창과 소환수 창이 같은 경계로 쪽지를 연다. */
export interface InfoPopupContext {
  scene: Phaser.Scene;
  popups: PopupLayer;
  keywords: KeywordManager;
}

/** 두 창이 같은 칸을 세우는 데 필요한 자리. `ENEMY_INFO`와 `SUMMON_INFO`가 모두 이 모양이다. */
type Widen<T> = T extends number ? number : { readonly [K in keyof T]: Widen<T[K]> };
export type InfoPopupLayout = Widen<Pick<typeof ENEMY_INFO, "width" | "left" | "rarityY" | "nameY" | "numberY" | "badge" | "nameRight" | "column" | "statPanel" | "radar" | "reach" | "statMagnifier" | "skills" | "ferocityBadgeOffsetY" | "roleBadgeOffsetY">>;

/** 스킬 액자가 서는 x. 왼쪽 끝에서 같은 간격으로 이어진다. */
function infoSkillColumns(L: InfoPopupLayout, count: number): number[] {
  return Array.from({ length: count }, (_, index) => L.skills.x + index * L.skills.step);
}

/** 왼쪽 위 이름 블록 — 정보창과 같은 순서·같은 글자 크기·같은 그림자다. */
export function paintInfoHeader(ctx: InfoPopupContext, chrome: Phaser.GameObjects.Container, def: RelicDef, L: InfoPopupLayout,
  /** 등급 글자 자리에 대신 세울 한 줄(소환수의 「디안의 소환수」). 비우면 등급을 칠한다. */
  eyebrow?: string): void {
  const scene = ctx.scene;
  if (eyebrow === undefined) {
    // 등급 글자는 **정보창과 같은 함수**가 칠한다 — 글자 높이를 따라 색이 흐르는 보석 연출이라
    // 화면이 단색으로 다시 칠하면 같은 등급이 여기서만 맨 글자로 보인다.
    const rarityGlow = scene.add.text(L.left, L.rarityY, "", textStyle({ role: "display", size: 44 }))
      .setOrigin(0, 0.5).setAlpha(0.55).setScale(1.06).setBlendMode(Phaser.BlendModes.ADD);
    const rarityText = scene.add.text(L.left, L.rarityY, "", textStyle({ role: "display", size: 44 })).setOrigin(0, 0.5);
    chrome.add([rarityGlow, rarityText]);
    paintRarityGem(rarityText, rarityGlow, def.rarity);
  } else {
    // 소환수는 등급이 아니라 **누구의 몸인가**가 먼저다. 같은 자리·같은 크기로 이름 위에 선다.
    chrome.add(scene.add.text(L.left, L.rarityY, eyebrow, textStyle({ role: "emphasis", size: 34, color: COLOR.accentText })).setOrigin(0, 0.5).setShadow(2, 4, "#05070a", 6, false, true));
  }
  // 이름은 같은 글자를 검게 한 겹 어긋나게 깔아 그림자를 만든다. 흐린 그림자보다 또렷하다.
  const shadow = scene.add.text(L.left + 6, L.nameY + 8, def.name, textStyle({ role: "display", size: 84, color: "#05070a" })).setOrigin(0, 0.5).setAlpha(0.85);
  const name = scene.add.text(L.left, L.nameY, def.name, textStyle({ role: "display", size: 84 })).setOrigin(0, 0.5);
  // 이름과 뱃지 둘이 돌파 등급 표식 앞에서 끝나도록 이름만 줄인다. 뱃지를 줄이면 속성·직군이
  // 개체마다 다른 크기로 서고, 그대로 두면 긴 이름이 뱃지를 오른쪽 기둥 위로 밀어낸다.
  const { badge } = ENEMY_INFO;
  shrinkTextToWidth(name, L.nameRight - L.left - (badge.gap + badge.element + 12 + badge.role));
  shadow.setFontSize(name.style.fontSize);
  chrome.add([shadow, name]);
  chrome.add(scene.add.text(L.left + 4, L.numberY, `NO.${def.specimenNumber}   ${def.origin}`, textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5));
  // 이름 폭이 개체마다 다르므로 뱃지 자리도 그릴 때마다 이름 끝에서 다시 잡는다.
  const badgeLeft = L.left + name.width + L.badge.gap;
  const elementX = badgeLeft + L.badge.element / 2;
  const roleX = badgeLeft + L.badge.element + L.badge.role / 2 + 12;
  chrome.add(new AffinityBadge(scene, elementX, L.nameY, ELEMENT_ICON[def.element], L.badge.element));
  chrome.add(new AffinityBadge(scene, roleX, L.nameY + 6, ROLE_ICON[def.role], L.badge.role));
  // 적 표식도 아군 창과 **같은 쪽지**를 연다. 같은 그림이 어느 창에서 눌리느냐에 따라 다른
  // 말을 하면 상성을 두 번 배우게 된다.
  chrome.add(addAffinityTap(scene, elementX, L.nameY, L.badge.element, () => openElementPopup(scene, ctx.popups, def.element, { x: elementX, y: L.nameY })));
  chrome.add(addAffinityTap(scene, roleX, L.nameY + 6, L.badge.role, () => openRolePopup(scene, ctx.popups, def.role, { x: roleX, y: L.nameY })));
}

/** 능력치 칸 — 정보창과 **같은 오각형·같은 반지름·같은 사거리 줄**이다. */
export function paintInfoStats(ctx: InfoPopupContext, chrome: Phaser.GameObjects.Container, def: RelicDef, L: InfoPopupLayout): void {
  const scene = ctx.scene;
  const { column, statPanel, radar, reach, statMagnifier } = L;
  const panel = addInfoPanel(scene, chrome, column.x, enemyInfoPanelCenterY(statPanel), column.width, statPanel.height);
  addSectionTitle(scene, column.x - column.width / 2, statPanel.top - 4, t("info.section.stats"), { parent: chrome });
  addInfoMagnifier(scene, ctx.popups, panel, column.x + column.width / 2 - 30, enemyInfoPanelCenterY(statPanel) + statMagnifier.offsetY, (from) => openExtraStatsPopup(scene, ctx.popups, def, def.stats, from), true);
  // 사거리는 오각형에 없는 축이라 제목 바로 아래에 이름표처럼 한 줄로만 선다.
  panel.add(scene.add
    .text(reach.offsetX, reach.offsetY, t("info.enemy.reach", { tier: reachLabel(def.reachTier) }), textStyle({ role: "body", size: 22, color: COLOR.inkDim }))
    .setOrigin(0, 0.5));
  const chart = new StatRadar(scene, 0, radar.offsetY, radar.radius, {
    size: 24,
    colors: Object.fromEntries((["hp", "atk", "ap", "def", "res"] as const).map((key) => [key, `#${STAT_TONE[key].toString(16).padStart(6, "0")}`])),
    values: true,
    power: true,
  });
  panel.add(chart);
  // 스테이지가 성장시킨 정의를 그대로 읽는다 — 창이 레벨 보정을 다시 하면 지도·편성·전투가
  // 같은 적을 다른 수치로 말한다.
  chart.draw(def.stats, radar.radius);
}

/**
 * 왼쪽 아래 스킬 액자 셋과 패시브 위의 폭주 뱃지 — 정보창과 같은 자리·같은 크기다.
 *
 * 쪽지는 아군 창과 **같은 조립기**(`buildSkillViewModel`)를 지나므로 그 안의 태그도 그대로
 * 열린다 — 화면마다 따로 만들면 같은 궁극기가 어디서는 실제 피해로, 어디서는 위력 %로 적힌다.
 */
export function paintInfoSkills(ctx: InfoPopupContext, chrome: Phaser.GameObjects.Container, snapshot: EnemyInfoSnapshot, L: InfoPopupLayout,
  /** 세울 액자. 소환수는 패시브가 성장 칸과 같은 말을 해 빼고 일반 공격부터 세운다. */
  slots: readonly ("passive" | "basic" | "ultimate")[]): void {
  const { def } = snapshot;
  const all: { label: string; slot: SkillArtSlot; skill: Skill | Passive; gaugeCost?: number }[] = [
    { label: skillSlotLabel("passive"), slot: "passive", skill: { ...def.passive, power: def.passive.value, damageType: "physical" } as unknown as Skill },
    { label: skillSlotLabel("basic"), slot: "basic", skill: def.basic },
    { label: skillSlotLabel("ultimate"), slot: "ultimate", skill: def.ultimate, gaugeCost: (def.ultimate as Ultimate).cost },
  ];
  const entries = all.filter((entry) => slots.includes(entry.slot as "passive" | "basic" | "ultimate"));
  const columns = infoSkillColumns(L, entries.length);
  entries.forEach((entry, index) => {
    const size = L.skills.size;
    const container = ctx.scene.add.container(columns[index], L.skills.y);
    container.add(addSkillIconFrame(ctx.scene, {
      size, slot: entry.slot, relicId: def.id,
      fallbackIcon: slotFallbackIcon(def, entry.slot),
      element: def.element, role: def.role, label: entry.label,
      // 강조는 돌파로 자란 칸만 갖는다 — 아군 창과 같은 규칙이다.
      enhanced: breakthroughEnhances(def, snapshot.breakthrough, entry.slot),
    }));
    const hit = ctx.scene.add.rectangle(0, 0, size, size, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => pressIn(container));
    hit.on("pointerout", () => { if (!ctx.popups.isOpen) pressOut(container, "normal", { pop: false }); });
    hit.on("pointerup", () => {
      pressIn(container);
      openInfoSkill(ctx, snapshot, entry, { x: SCREEN_CENTER.x + container.x, y: SCREEN_CENTER.y + container.y - size / 2, onClose: () => pressOut(container) });
    });
    container.add(hit);
    chrome.add(container);
    // 패시브 위에만 이 개체의 피버 발현을 작게 얹는다. 야성은 벌이 아니라 상이라는 표시다.
    if (index === 0) {
      addInfoFerocityBadge(ctx.scene, ctx.popups, chrome, container.x, container.y + L.ferocityBadgeOffsetY, def, (from) => {
        const breakthroughEffect = breakthroughEnhances(def, snapshot.breakthrough, "ferocity") ? breakthroughEffectText(def, "ferocity", def.stats) : undefined;
        openFerocityTraitPopup(ctx.scene, ctx.popups, ctx.keywords, def, { ...from, x: SCREEN_CENTER.x + from.x, y: SCREEN_CENTER.y + from.y }, { breakthroughEffect });
      });
      /*
       * **그 위에 역할(잡졸·무리·정예·보스·불사)이 같은 크기로 선다.** 자리가 곱하는 배율과
       * 보스·불사가 갖는 강인함·경감은 개체의 패시브가 아니라 이 칸이 말한다. 자리를 새기지
       * 않은 정의(도감처럼 전장에 서지 않은 개체)에는 세우지 않는다.
       */
      const role = def.encounterRole;
      if (role !== undefined) {
        addInfoRoleBadge(ctx.scene, ctx.popups, chrome, container.x, container.y + L.roleBadgeOffsetY, def, role, (from) => {
          openEncounterRolePopup(ctx.scene, ctx.popups, ctx.keywords, role, { ...from, x: SCREEN_CENTER.x + from.x, y: SCREEN_CENTER.y + from.y });
        });
      }
    }
  });
}

/** 스킬 쪽지는 아군 창과 **같은 조립기**를 지난다. 태그도 그대로 열린다. */
function openInfoSkill(
  ctx: InfoPopupContext,
  snapshot: EnemyInfoSnapshot,
  entry: { label: string; slot: SkillArtSlot; skill: Skill | Passive; gaugeCost?: number },
  from: { x: number; y: number; onClose: () => void },
): void {
  const { def, breakthrough } = snapshot;
  // 적도 돌파로 스킬에 효과가 붙는다. 열린 등급의 몫만 노란 줄로 선다.
  const breakthroughEffect = breakthroughEnhances(def, breakthrough, entry.slot) ? breakthroughEffectText(def, entry.slot, def.stats) : undefined;
  openSkillPopup(ctx.scene, ctx.popups, ctx.keywords, buildSkillViewModel({
    def, breakthrough, kindLabel: entry.label, skill: entry.skill, gaugeCost: entry.gaugeCost, slot: entry.slot,
    breakthroughEffect,
  }), from);
}
