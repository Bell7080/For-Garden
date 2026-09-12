import Phaser from "phaser";
import { infoPortraitPlacement } from "./portraitPlacement";
import { battleAssetFor, portraitAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { breakthroughGrade, isBreakthroughSlotOpen, relicLevelCap } from "../core/relicProgression";
import type { Passive, RelicDef, Skill, Ultimate } from "../core/types";
import { KeywordManager } from "../managers/KeywordManager";
import { AffinityBadge } from "./AffinityBadge";
import { ELEMENT_ICON, ROLE_ICON } from "./affinityIcons";
import { addPopupBackgroundImage, BACKGROUND } from "./backgrounds";
import { ENEMY_INFO, enemyInfoPanelCenterY, enemyInfoSkillColumns } from "./enemyInfoLayout";
import {
  addInfoFerocityBadge, addInfoFigureStand, addInfoMagnifier, addInfoPanel, buildSkillViewModel,
  openBreakthroughStepsPopup, openExtraStatsPopup, openFerocityTraitPopup, RARITY_GEM, slotFallbackIcon,
} from "./info";
import type { PopupLayer } from "./PopupLayer";
import { drawFrameVignette, drawGlassFade, drawShapeOutline } from "./holo";
import { popupArtShape, popupBodyShapeMask } from "./popupArt";
import { addBreakthroughGradeMark } from "./rarityMark";
import { addSectionTitle } from "./SectionTitle";
import { addSkillIconFrame, SKILL_SLOT_LABEL } from "./SkillIconFrame";
import { openSkillPopup } from "./SkillPopup";
import { breakthroughEffectText } from "./skillPresentation";
import type { SkillArtSlot } from "./skillArt";
import { StatRadar } from "./StatRadar";
import { REACH_LABEL, STAT_TONE } from "./statTones";
import { COLOR, textStyle } from "./theme";

/** 그 적이 실제로 서 있는 상태. 화면이 레벨 보정을 다시 하지 않고 배치된 값을 그대로 받는다. */
export interface EnemyInfoSnapshot {
  /** 스테이지·노드가 성장시킨 정의. `stats`는 이미 레벨·돌파가 반영된 값이다. */
  def: RelicDef;
  level: number;
  breakthrough: number;
  /** 야성으로 얹힌 추가 레벨. 레벨 옆에 작고 붉게 선다. */
  ferocityLevel?: number;
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
      width: ENEMY_INFO.width, height: ENEMY_INFO.height, title: "정보창",
      dim: true, dimAlpha: 0.64, closeOnBackdrop: false, backButton: true,
      onClose: () => this.dispose(),
    }, (body) => {
      // 정보창을 줄여 놓은 판이라 **배경 원화도 같은 것을 깐다.** 판과 같은 실루엣으로 잘라
      // 깎인 모서리 밖으로 나가지 않게 한다.
      const shape = popupArtShape(ENEMY_INFO.width, ENEMY_INFO.height);
      addPopupBackgroundImage(this.scene, body, BACKGROUND.info, { x: 0, y: 0, width: ENEMY_INFO.width, height: ENEMY_INFO.height, maskShape: shape, overlayStrength: 0.62 });
      // 정보창은 원화 위에 **은은한 검은 면 한 겹**을 깔아 인물과 글자를 앞으로 끌어낸다.
      // 같은 값(`COLOR.void` 0.52)을 그대로 쓰고 판과 같은 실루엣으로 자른다.
      body.add(this.scene.add.rectangle(0, 0, ENEMY_INFO.width, ENEMY_INFO.height, COLOR.void, 0.52).setMask(popupBodyShapeMask(this.scene, body, shape)));
      // 가장자리 누르기도 정보창과 **같은 세기**(0.6)다. 화면이 아니라 판 안에서 가운데로 눈이 간다.
      body.add(drawFrameVignette(this.scene, 0, 0, ENEMY_INFO.width, ENEMY_INFO.height, { strength: 0.6, spread: 0.18 }).setMask(popupBodyShapeMask(this.scene, body, shape)));
      /*
       * **이 창만 사방 외곽선을 두른다.**
       *
       * 홀로그램 규칙은 판때기에 테두리를 두르지 않지만(위·구분선만), 이 판은 배경 원화 위에
       * 원화 한 장을 통째로 세우고 그 원화가 판 밑변에서 잘린다 — 선이 없으면 어디까지가 창이고
       * 어디부터가 뒤 화면인지 흐려져 잘린 단면이 "덜 그려진 것"처럼 보인다. 선은 **몸판과 같은
       * 도형**을 따라가므로 깎인 두 모서리도 그대로 돈다.
       *
       * 판(`body`)에 넣는 이유는 제목표 때문이다 — 제목은 윗변에 걸터앉아 있어, 원화 위층에
       * 두르면 선이 `/정보창` 한가운데를 가로지른다. 판에 두면 `raiseChrome`이 제목을 그 위로
       * 다시 올려 준다.
       */
      body.add(drawShapeOutline(this.scene, 0, 0, shape, { color: COLOR.accent, alpha: 0.55, width: 3 }));
      // 원화와 SD는 판 위에 서지만 그 위의 칸·액자에는 가려야 한다. Puppet은 컨테이너 변환을
      // 물려받지 않아 판 안에 넣을 수 없으므로, 팝업 층과 다음 팝업(쪽지) 사이에 두 층을 낸다.
      const depth = body.parentContainer?.depth ?? this.popups.baseDepth;
      const mask = popupBodyShapeMask(this.scene, body, shape);
      const chrome = this.scene.add.container(body.x, body.y).setDepth(depth + 0.6).setAlpha(0).setScale(0.96);
      // 이름줄 뒤의 어둠은 원화보다 위, 글자보다 아래다 — 정보창과 같이 판이 아니라 내려오는
      // 그라데이션 한 겹이라, 밝은 원화 앞에서도 이름과 개체번호가 읽힌다.
      chrome.add(drawGlassFade(this.scene, 0, ENEMY_INFO.nameFade.top + ENEMY_INFO.nameFade.height / 2, ENEMY_INFO.width, ENEMY_INFO.nameFade.height, { topAlpha: 0.9, bottomAlpha: 0 }).setMask(popupBodyShapeMask(this.scene, chrome, shape)));
      this.chrome = chrome;
      // 판과 함께 떠오르게 같은 등장 tween을 건다 — 층이 다르다고 따로 나타나면 두 장으로 보인다.
      this.scene.tweens.add({ targets: chrome, alpha: 1, duration: 160 });
      this.scene.tweens.add({ targets: chrome, scale: 1, duration: 200, ease: "Cubic.Out" });
      this.paintHeader(chrome, snapshot);
      this.paintLevel(chrome, snapshot);
      this.paintStats(chrome, snapshot.def);
      this.paintSkills(chrome, snapshot);
      addInfoFigureStand(this.scene, chrome, ENEMY_INFO.figure.x, ENEMY_INFO.figure.groundY);
      void this.loadPuppets(snapshot.def, generation, depth + 0.4, depth + 0.7, mask);
    });
  }

  /** 지도·전투가 같은 창을 닫을 수 있게 하는 단일 종료점이다. */
  close(): void { if (this.open) this.popups.closeTop(); }

  get isOpen(): boolean { return this.open; }

  private dispose(): void {
    this.open = false;
    this.generation += 1;
    this.portrait?.destroy(); this.portrait = undefined;
    this.figure?.destroy(); this.figure = undefined;
    this.chrome?.destroy(); this.chrome = undefined;
  }

  /** 왼쪽 위 이름 블록 — 정보창과 같은 순서·같은 글자 크기·같은 그림자다. */
  private paintHeader(chrome: Phaser.GameObjects.Container, snapshot: EnemyInfoSnapshot): void {
    const { def } = snapshot;
    const scene = this.scene;
    const gem = RARITY_GEM[def.rarity];
    chrome.add(scene.add.text(ENEMY_INFO.left, ENEMY_INFO.rarityY, def.rarity, textStyle({ role: "display", size: 44, color: gem[1] }))
      .setOrigin(0, 0.5).setAlpha(0.55).setScale(1.06).setBlendMode(Phaser.BlendModes.ADD));
    chrome.add(scene.add.text(ENEMY_INFO.left, ENEMY_INFO.rarityY, def.rarity, textStyle({ role: "display", size: 44, color: gem[1] })).setOrigin(0, 0.5));
    // 이름은 같은 글자를 검게 한 겹 어긋나게 깔아 그림자를 만든다. 흐린 그림자보다 또렷하다.
    chrome.add(scene.add.text(ENEMY_INFO.left + 6, ENEMY_INFO.nameY + 8, def.name, textStyle({ role: "display", size: 84, color: "#05070a" })).setOrigin(0, 0.5).setAlpha(0.85));
    const name = scene.add.text(ENEMY_INFO.left, ENEMY_INFO.nameY, def.name, textStyle({ role: "display", size: 84 })).setOrigin(0, 0.5);
    chrome.add(name);
    chrome.add(scene.add.text(ENEMY_INFO.left + 4, ENEMY_INFO.numberY, `NO.${def.specimenNumber}   ${def.origin}`, textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5));
    // 이름 폭이 개체마다 다르므로 뱃지 자리도 그릴 때마다 이름 끝에서 다시 잡는다.
    const badgeLeft = ENEMY_INFO.left + name.width + ENEMY_INFO.badge.gap;
    chrome.add(new AffinityBadge(scene, badgeLeft + ENEMY_INFO.badge.element / 2, ENEMY_INFO.nameY, ELEMENT_ICON[def.element], ENEMY_INFO.badge.element));
    chrome.add(new AffinityBadge(scene, badgeLeft + ENEMY_INFO.badge.element + ENEMY_INFO.badge.role / 2 + 12, ENEMY_INFO.nameY + 6, ROLE_ICON[def.role], ENEMY_INFO.badge.role));
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
    addInfoMagnifier(scene, this.popups, chrome, gradeMagnifier.x, gradeMagnifier.y, () => openBreakthroughStepsPopup(scene, this.popups, snapshot.def, grade));

    const panel = addInfoPanel(scene, chrome, column.x, enemyInfoPanelCenterY(levelPanel), column.width, levelPanel.height);
    addSectionTitle(scene, column.x - column.width / 2, levelPanel.top - 4, "레벨", { parent: chrome });
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
    const bonus = Math.max(0, snapshot.ferocityLevel ?? 0);
    if (bonus > 0) {
      panel.add(scene.add
        .text(column.width / 2 - 44, 6, `+${bonus}`, textStyle({ role: "display", size: 46, color: COLOR.ferocityHotText }))
        .setOrigin(1, 0.5)
        .setShadow(3, 8, "#05070a", 10, false, true));
    }
  }

  /** 능력치 칸 — 정보창과 **같은 오각형·같은 반지름·같은 사거리 줄**이다. */
  private paintStats(chrome: Phaser.GameObjects.Container, def: RelicDef): void {
    const scene = this.scene;
    const { column, statPanel, radar, reach, statMagnifier } = ENEMY_INFO;
    const panel = addInfoPanel(scene, chrome, column.x, enemyInfoPanelCenterY(statPanel), column.width, statPanel.height);
    addSectionTitle(scene, column.x - column.width / 2, statPanel.top - 4, "능력치", { parent: chrome });
    addInfoMagnifier(scene, this.popups, panel, column.x + column.width / 2 - 30, enemyInfoPanelCenterY(statPanel) + statMagnifier.offsetY, (from) => openExtraStatsPopup(scene, this.popups, def, def.stats, from), true);
    // 사거리는 오각형에 없는 축이라 제목 바로 아래에 이름표처럼 한 줄로만 선다.
    panel.add(scene.add
      .text(reach.offsetX, reach.offsetY, `사거리 · ${REACH_LABEL[def.reachTier]}`, textStyle({ role: "body", size: 22, color: COLOR.inkDim }))
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
  private paintSkills(chrome: Phaser.GameObjects.Container, snapshot: EnemyInfoSnapshot): void {
    const { def } = snapshot;
    const entries: { label: string; slot: SkillArtSlot; skill: Skill | Passive; gaugeCost?: number }[] = [
      { label: SKILL_SLOT_LABEL.passive, slot: "passive", skill: { ...def.passive, power: def.passive.value, damageType: "physical" } as unknown as Skill },
      { label: SKILL_SLOT_LABEL.basic, slot: "basic", skill: def.basic },
      { label: SKILL_SLOT_LABEL.ultimate, slot: "ultimate", skill: def.ultimate, gaugeCost: (def.ultimate as Ultimate).cost },
    ];
    const columns = enemyInfoSkillColumns(entries.length);
    entries.forEach((entry, index) => {
      const size = ENEMY_INFO.skills.size;
      const container = this.scene.add.container(columns[index], ENEMY_INFO.skills.y);
      container.add(addSkillIconFrame(this.scene, {
        size, slot: entry.slot, relicId: def.id,
        fallbackIcon: slotFallbackIcon(def, entry.slot),
        element: def.element, role: def.role, label: entry.label,
        // 궁극기 한 칸만 강조한다. 한 판에 강조가 여럿이면 위계가 사라진다.
        emphasis: entry.slot === "ultimate",
      }));
      const hit = this.scene.add.rectangle(0, 0, size, size, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => container.setScale(1.08));
      hit.on("pointerout", () => { if (!this.popups.isOpen) container.setScale(1); });
      hit.on("pointerup", () => {
        container.setScale(1.08);
        this.openSkill(snapshot, entry, { x: SCREEN_CENTER.x + container.x, y: SCREEN_CENTER.y + container.y - size / 2, onClose: () => container.setScale(1) });
      });
      container.add(hit);
      chrome.add(container);
      // 패시브 위에만 이 개체의 피버 발현을 작게 얹는다. 야성은 벌이 아니라 상이라는 표시다.
      if (index === 0) {
        addInfoFerocityBadge(this.scene, this.popups, chrome, container.x, container.y + ENEMY_INFO.ferocityBadgeOffsetY, def, (from) => {
          const breakthroughEffect = isBreakthroughSlotOpen(snapshot.breakthrough, "ferocity") ? breakthroughEffectText(def, "ferocity") : undefined;
          openFerocityTraitPopup(this.scene, this.popups, this.keywords, def, { ...from, x: SCREEN_CENTER.x + from.x, y: SCREEN_CENTER.y + from.y }, { breakthroughEffect });
        });
      }
    });
  }

  /** 스킬 쪽지는 아군 창과 **같은 조립기**를 지난다. 태그도 그대로 열린다. */
  private openSkill(
    snapshot: EnemyInfoSnapshot,
    entry: { label: string; slot: SkillArtSlot; skill: Skill | Passive; gaugeCost?: number },
    from: { x: number; y: number; onClose: () => void },
  ): void {
    const { def, breakthrough } = snapshot;
    // 적도 돌파로 스킬에 효과가 붙는다. 열린 등급의 몫만 노란 줄로 선다.
    const breakthroughEffect = isBreakthroughSlotOpen(breakthrough, entry.slot) ? breakthroughEffectText(def, entry.slot) : undefined;
    openSkillPopup(this.scene, this.popups, this.keywords, buildSkillViewModel({
      def, breakthrough, kindLabel: entry.label, skill: entry.skill, gaugeCost: entry.gaugeCost, slot: entry.slot,
      breakthroughEffect,
    }), from);
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
  }
}
