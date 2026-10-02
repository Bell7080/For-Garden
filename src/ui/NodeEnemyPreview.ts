import Phaser from "phaser";
import { t } from "../i18n";
import type { RelicDef, StageEnemyDef } from "../core/types";
import { setDebugEnemyPreview } from "../debug";
import { battleAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { chipPoints, drawHairline, drawLayer } from "./holo";
import { COLOR, textStyle } from "./theme";
import { addUnitNameplate } from "./unitNameplate";
import { AffinityBadge } from "./AffinityBadge";
import { ELEMENT_ICON, ROLE_ICON } from "./affinityIcons";
import { addBreakthroughGradeMark } from "./rarityMark";
import { combatPower } from "../core/combatPower";

import { ENCOUNTER_ROLE, encounterRoleFor } from "../core/levelDesign";
import { addStageEliteMark } from "./stageEliteMark";
import { anchorEnemyPreview, enemyPreviewColumns, enemyPreviewSlotHalfWidth, NODE_ENEMY_PREVIEW, NODE_ENEMY_SITUATION, NODE_ENEMY_SLOT, STORY_PREVIEW, storyPreviewLayout, storyPreviewRewardColumns } from "./nodeEnemyPreviewLayout";
import { addSdFootShadow } from "./SdFootShadow";
import type { StageFirstClearReward } from "../core/stageRewards";
import { drawGlyph } from "./glyphs";
import { addStageRewardFrame } from "./stageRewardFrame";

/**
 * 스토리 판의 두 칸이 열려 있는가. **관문을 옮겨 다녀도 그대로 남는다** — 줄거리를 접어 둔 손이
 * 노드를 누를 때마다 다시 접어야 하면 칸을 접을 수 있다는 것이 오히려 짐이 된다. 화면 안에서만
 * 기억하는 편의라 저장하지 않는다. 처음에는 적 정보만 펼친다(고를 때 필요한 쪽이다).
 */
const sectionOpen = { enemies: true, story: false };

export interface NodeEnemyPreviewOptions {
  title: string;
  /** 제목 아래 한 줄. 비우면 그 줄을 그리지 않는다 — 서사가 없는 관문은 예전 그대로다. */
  situation?: string;
  /**
   * **스토리 관문의 칸 구성** — 있으면 적 정보·줄거리를 여닫는 칸으로 세우고 맨 아래에 초회 보상을
   * 한 줄 둔다(`STORY_PREVIEW`). 원정 노드는 넘기지 않아 예전의 한 장 그대로다.
   */
  sections?: {
    rewards: readonly StageFirstClearReward[];
    rewardsClaimed: boolean;
    /** 룬 액자를 누르면 부른다 — 받기 전의 룬은 등급·자리만 알려 주는 미리보기 쪽지를 연다. */
    onRuneClick?: (reward: Extract<StageFirstClearReward, { kind: "rune" }>, point: { x: number; y: number }) => void;
  };
  /** 렌더된 적과 같은 슬롯 순서의 공개 성장 상태다. */
  growth: readonly Pick<StageEnemyDef, "level" | "breakthrough">[];
  enemies: readonly RelicDef[];
  /**
   * **단일 정예 조우**인가. 그러면 그 하나가 크게 서고 머리 위에 정예 이름표가 붙는다.
   *
   * 수를 세어 판단하지 않는다 — 원정의 최종층 보스도 하나이지만 그쪽은 정예가 아니라 보스다.
   */
  elite?: boolean;
  top: number;
  bottom: number;
  depth?: number;
  onEnemyClick: (enemy: RelicDef, growth: Pick<StageEnemyDef, "level" | "breakthrough">) => void;
}

/** 스토리와 원정 지도가 공유하는 노드 부착형 적 SD 편성 프리팹이다. */
export class NodeEnemyPreview extends Phaser.GameObjects.Container {
  private readonly puppets = new Set<PuppetCreature>();
  /** 꼬리는 추적 중 위/아래 방향이 바뀔 때 같은 Graphics를 다시 그린다. */
  private tail?: Phaser.GameObjects.Graphics;
  private generation = 0;
  private shown = false;
  /** 첫 출현 확대가 끝나기 전에는 컨테이너 밖 SD도 따로 감춘다. */
  private revealed = false;
  private options: NodeEnemyPreviewOptions;
  /** 지금 판의 높이 — 스토리 판은 칸을 여닫을 때마다 바뀐다. */
  private panelHeight: number = NODE_ENEMY_PREVIEW.height;
  /** 판이 붙은 노드의 화면 y. 칸을 여닫아 다시 그릴 때 같은 자리에 붙인다. */
  private nodeY = 0;

  constructor(scene: Phaser.Scene, options: NodeEnemyPreviewOptions) {
    super(scene, scene.scale.width / 2, 0);
    this.options = options;
    scene.add.existing(this);
    this.setDepth(options.depth ?? 60).setVisible(false);
    // 씬 종료와 선택 변경은 같은 폐기 경로를 사용해 늦은 비동기 로드도 채택되지 않게 한다.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    this.once(Phaser.GameObjects.Events.DESTROY, () => { this.clearPuppets(); setDebugEnemyPreview(undefined); });
  }

  /** 새 노드의 제목·레벨·편성을 원자적으로 갈아 끼우고 노드에 꼬리를 붙인다. */
  showAt(nodeY: number, options: Partial<Pick<NodeEnemyPreviewOptions, "title" | "situation" | "growth" | "enemies" | "elite" | "onEnemyClick" | "sections">> = {}): void {
    // 넘기지 않은 칸 구성이 직전 노드의 것으로 남지 않게 한다.
    this.options = { ...this.options, sections: undefined, ...options };
    this.nodeY = nodeY;
    if (this.options.sections) { this.renderSectioned(false); this.reveal(); return; }
    this.panelHeight = NODE_ENEMY_PREVIEW.height;
    this.removeAll(true); this.clearPuppets();
    const generation = ++this.generation;
    const { y, above } = anchorEnemyPreview(nodeY, this.options.top, this.options.bottom);
    this.setY(y);
    const bevel = Math.min(NODE_ENEMY_PREVIEW.width, NODE_ENEMY_PREVIEW.height) * 0.16;
    this.add(drawLayer(this.scene, 0, 0, chipPoints(NODE_ENEMY_PREVIEW.width, NODE_ENEMY_PREVIEW.height, { bevel: { topLeft: bevel, bottomRight: bevel } }), { fill: 0x0b0f15, alpha: 0.92, edge: COLOR.accent, edgeAlpha: 0.55 }));
    this.tail = this.scene.add.graphics(); this.add(this.tail); this.drawTail(above);
    const titleLeft = -NODE_ENEMY_PREVIEW.width / 2 + bevel * 0.7;
    this.add(this.scene.add.text(titleLeft, NODE_ENEMY_SLOT.titleY, this.options.title, textStyle({ role: "display", size: 32 })).setOrigin(0, 0));
    this.add(this.scene.add.text(NODE_ENEMY_PREVIEW.width / 2 - 30, NODE_ENEMY_SLOT.titleY + 4, t("enemyPreview.title"), textStyle({ role: "emphasis", size: 22, color: COLOR.dangerText })).setOrigin(1, 0));
    // **관문 한 줄은 제목 바로 아래에 선다.** 판 아래로 내리면 총 전투력과 같은 무게가 되고,
    // 별도 판으로 빼면 아무도 열지 않는다 — 이유는 `nodeEnemyPreviewLayout`에 적어 두었다.
    // 문장이므로 역할은 `body`다. 제목이 `display`라 위계는 저절로 갈린다.
    if (this.options.situation) {
      const wrap = NODE_ENEMY_PREVIEW.width - NODE_ENEMY_SITUATION.wrapInset * 2;
      // 역할은 스타일을 여는 줄에 **함께** 적는다 — 글꼴 규칙 테스트가 줄 단위로 역할 누락을
      // 잡으므로, 여러 줄로 펼치면 역할을 골랐는데도 고르지 않은 호출로 읽힌다.
      this.add(this.scene.add
        .text(titleLeft, NODE_ENEMY_SITUATION.y, this.options.situation, textStyle({ role: "body", size: NODE_ENEMY_SITUATION.size, color: COLOR.inkDim, wrap }))
        .setOrigin(0, 0));
    }
    this.add(drawHairline(this.scene, 0, NODE_ENEMY_SLOT.dividerY, NODE_ENEMY_PREVIEW.width - 60, { color: COLOR.accent, alpha: 0.35 }));
    const columns = enemyPreviewColumns(this.options.enemies.length);
    const compact = columns.length > 3;
    const half = enemyPreviewSlotHalfWidth(this.options.enemies.length);
    const ground = NODE_ENEMY_SLOT.ground;
    this.options.enemies.forEach((enemy, index) => {
      const growth = this.options.growth[index] ?? { level: 1, breakthrough: 0 };
      const x = columns[index];
      addSdFootShadow(this.scene, x, ground + 4, compact ? 112 : 150, this);
      // **카드 그리드와 같은 양식을 쓰되 칸이 아니라 SD로 세운다.** 속성·직군은 왼쪽 위에
      // 아이콘으로, 돌파는 오른쪽 위에 로마자로 — 화면마다 다른 글로 적으면 같은 값이 어디서는
      // 표식, 어디서는 문장이 된다.
      const badgeSize = compact ? 40 : 52;
      const badgeX = x - half + badgeSize * 0.62;
      const badgeTop = NODE_ENEMY_SLOT.dividerY + 46;
      this.add(new AffinityBadge(this.scene, badgeX, badgeTop, ELEMENT_ICON[enemy.element], badgeSize, 0.62));
      this.add(new AffinityBadge(this.scene, badgeX, badgeTop + badgeSize * 0.94, ROLE_ICON[enemy.role], badgeSize * 0.74, 0.62));
      addBreakthroughGradeMark(this.scene, this, x + half - 20, badgeTop - 4, compact ? 34 : 42, growth.breakthrough + 1);
      // 카드의 이름줄과 같은 규칙이다 — 레벨은 강조색, 이름은 흰색. 체력은 적지 않는다:
      // 붙어 볼지 정하는 데 필요한 것은 개체별 수치가 아니라 판 아래의 총 전투력 하나다.
      addUnitNameplate(this.scene, this, x, NODE_ENEMY_SLOT.nameY, growth.level, enemy.name, compact ? 24 : 30);
      const hit = this.scene.add.rectangle(x, ground - 70, compact ? 145 : 230, 300, 0xffffff, 0).setInteractive({ useHandCursor: true });
      // 누른 칸의 성장 상태를 함께 넘긴다 — 화면이 배열 index로 다시 찾으면 순서가 바뀌는 날 어긋난다.
      hit.on("pointerup", () => this.options.onEnemyClick(enemy, growth)); this.add(hit);
      const sdHeight = (compact ? 158 : NODE_ENEMY_PREVIEW.sdHeight)
        * ENCOUNTER_ROLE[encounterRoleFor(this.options.enemies.length, { elite: this.options.elite === true })].bodyScale;
      void this.spawnEnemy(enemy.id, x, ground, sdHeight, generation);
      // 셋이 아니라 하나가 선 자리라는 것을 머리 위 이름표가 말한다.
      if (this.options.elite) addStageEliteMark(this.scene, this, x, ground - sdHeight - 6, compact ? 22 : 26);
    });
    // **판 아래는 이 편성이 얼마나 센가 한 줄이다.** 개체별 수치를 다 읽지 않고도 붙어 볼지
    // 말지를 정할 수 있어야 한다. 전투력은 표시·정렬 전용이라 전투 계산에는 들어가지 않는다.
    // 이름표는 짧게 둔다 — "예상"이나 "종합" 같은 수식은 무엇을 재는지 바꾸지 않는다.
    const power = this.options.enemies.reduce((sum, enemy) => sum + combatPower(enemy.stats), 0);
    this.add(drawHairline(this.scene, 0, NODE_ENEMY_SLOT.footerDividerY, NODE_ENEMY_PREVIEW.width - 60, { color: COLOR.accent, alpha: 0.28 }));
    this.add(this.scene.add
      .text(0, NODE_ENEMY_SLOT.powerY, t("enemyPreview.totalPower", { power: power.toLocaleString() }), textStyle({ role: "display", size: 28, color: COLOR.dangerText }))
      .setOrigin(0.5, 0)
      .setShadow(0, 3, "#05070a", 4, false, true));
    // 상세 진입 E2E는 고정 숫자를 복제하지 않고 실제 적 입력 중심을 사용한다.
    setDebugEnemyPreview({ top: this.options.top, bottom: this.options.bottom, panelTop: y - NODE_ENEMY_PREVIEW.height / 2, panelBottom: y + NODE_ENEMY_PREVIEW.height / 2, above, enemyTargets: columns.map((x) => ({ x: this.x + x, y: y + ground })) });
    this.reveal();
  }

  /** 처음 뜰 때만 한 뼘 작게 떠오르고, 이미 떠 있으면 그 자리에서 갈아 끼운다. */
  private reveal(): void {
    if (!this.shown) {
      this.shown = true; this.setVisible(true).setAlpha(0).setScale(0.94);
      this.scene.tweens.add({ targets: this, alpha: 1, scale: 1, duration: 260, ease: "Cubic.Out", onComplete: () => {
        this.revealed = true; for (const puppet of this.puppets) puppet.setVisible(true);
      } });
    } else { this.revealed = true; this.setVisible(true).setAlpha(1).setScale(1); }
  }

  /** 지도 스크롤을 따라 판과 컨테이너 밖 Puppet을 함께 옮기고 노드가 마스크 밖이면 감춘다. */
  trackNode(nodeY: number, nodeVisible: boolean): void {
    if (!this.shown) return;
    this.nodeY = nodeY;
    const previousY = this.y;
    const { y, above } = anchorEnemyPreview(nodeY, this.options.top, this.options.bottom, this.panelHeight);
    this.setY(y); this.drawTail(above);
    for (const puppet of this.puppets) puppet.setY(puppet.y + y - previousY);
    this.setVisible(nodeVisible);
    for (const puppet of this.puppets) puppet.setVisible(nodeVisible && this.revealed);
    if (!nodeVisible) { setDebugEnemyPreview(undefined); return; }
    this.publishDebug(above);
  }

  /** E2E가 판의 실제 자리와 적 입력 중심을 읽는 채널. 접힌 적 칸은 누를 적이 없다. */
  private publishDebug(above: boolean): void {
    const half = this.panelHeight / 2;
    const ground = this.options.sections ? this.sectionGround() : NODE_ENEMY_SLOT.ground;
    const columns = ground === undefined ? [] : enemyPreviewColumns(this.options.enemies.length);
    setDebugEnemyPreview({ top: this.options.top, bottom: this.options.bottom, panelTop: this.y - half, panelBottom: this.y + half, above, enemyTargets: columns.map((x) => ({ x: this.x + x, y: this.y + (ground ?? 0) })) });
  }

  /** 스토리 판에서 SD 발끝의 판-가운데 기준 y. 적 칸이 접혀 있으면 없다. */
  private sectionGround(): number | undefined {
    const layout = this.currentSectionLayout;
    if (layout?.enemyBodyTop === undefined) return undefined;
    return layout.enemyBodyTop + STORY_PREVIEW.enemyBody.ground - layout.height / 2;
  }

  private currentSectionLayout?: ReturnType<typeof storyPreviewLayout>;

  /**
   * 스토리 관문의 판 — 제목 · 적 칸(총 전투력 ▾) · 줄거리 칸(▾) · 초회 보상.
   *
   * `keepPuppets`는 **줄거리 칸만 여닫을 때**다. 적 칸은 그대로라 SD를 다시 세우지 않고 판이 움직인
   * 만큼만 옮긴다 — 다시 세우면 칸 하나 눌렀을 뿐인데 적이 사라졌다가 쏙 다시 선다.
   */
  private renderSectioned(keepPuppets: boolean): void {
    const sections = this.options.sections!;
    const previousGroundScreen = keepPuppets ? this.sectionGroundScreen() : undefined;
    this.removeAll(true);
    if (!keepPuppets) this.clearPuppets();
    const generation = this.generation;
    const width = NODE_ENEMY_PREVIEW.width;
    const spec = STORY_PREVIEW;
    const story = this.options.situation;
    const textWidth = width - spec.storyText.inset * 2;
    // 줄거리 글은 높이를 먼저 재야 판 높이가 나온다. 잰 글을 그대로 판에 얹는다.
    const storyText = story && sectionOpen.story
      ? this.scene.add.text(0, 0, story, textStyle({ role: "body", size: spec.storyText.size, color: COLOR.inkDim, wrap: textWidth })).setOrigin(0, 0)
      : undefined;
    const layout = storyPreviewLayout({
      enemiesOpen: sectionOpen.enemies, storyOpen: sectionOpen.story, hasStory: Boolean(story),
      storyTextHeight: storyText?.height ?? 0, rewardCount: sections.rewards.length,
    });
    this.currentSectionLayout = layout;
    this.panelHeight = layout.height;
    const top = -layout.height / 2;
    const { y, above } = anchorEnemyPreview(this.nodeY, this.options.top, this.options.bottom, layout.height);
    this.setY(y);
    // 깎임은 판 높이가 아니라 고정값이다 — 높이를 따르면 줄거리를 펼칠 때 깎임이 커져 글줄의 왼쪽 시작점이 함께 안쪽으로 밀린다.
    const bevel = STORY_PREVIEW.bevel;
    this.add(drawLayer(this.scene, 0, 0, chipPoints(width, layout.height, { bevel: { topLeft: bevel, bottomRight: bevel } }), { fill: 0x0b0f15, alpha: 0.92, edge: COLOR.accent, edgeAlpha: 0.55 }));
    this.tail = this.scene.add.graphics(); this.add(this.tail); this.drawTail(above);
    const left = -width / 2 + Math.max(56, bevel * 0.7);
    const right = width / 2 - 40;
    this.add(this.scene.add.text(left, top + layout.titleY, this.options.title, textStyle({ role: "display", size: spec.titleSize })).setOrigin(0, 0));
    for (const divider of layout.dividers) this.add(drawHairline(this.scene, 0, top + divider, width - 60, { color: COLOR.accent, alpha: 0.3 }));

    // ── 적 칸: 머리줄이 곧 총 전투력이다. 접어도 "얼마나 센가"는 남는다.
    const power = this.options.enemies.reduce((sum, enemy) => sum + combatPower(enemy.stats), 0);
    this.addSectionHeader(top + layout.enemyHeaderY, spec.enemyHeader, sectionOpen.enemies, () => { sectionOpen.enemies = !sectionOpen.enemies; this.renderSectioned(false); this.publishDebug(this.isAbove()); });
    this.add(this.scene.add
      .text(left, top + layout.enemyHeaderY, t("enemyPreview.totalPower", { power: power.toLocaleString() }), textStyle({ role: "display", size: 30, color: COLOR.dangerText }))
      .setOrigin(0, 0.5).setShadow(0, 3, "#05070a", 4, false, true));
    this.addSectionToggleLabel(right, top + layout.enemyHeaderY, t("enemyPreview.enemyInfo"), sectionOpen.enemies, 24, COLOR.ink);
    if (layout.enemyBodyTop !== undefined) this.addEnemySlots(top + layout.enemyBodyTop, generation, keepPuppets);

    // ── 줄거리 칸: 한 등급 가볍다 — 머리줄이 낮고 글자가 작고 흐리다.
    if (layout.storyHeaderY !== undefined) {
      this.addSectionHeader(top + layout.storyHeaderY, spec.storyHeader, sectionOpen.story, () => { sectionOpen.story = !sectionOpen.story; this.renderSectioned(true); this.publishDebug(this.isAbove()); });
      this.add(this.scene.add.text(left, top + layout.storyHeaderY, t("enemyPreview.story"), textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(0, 0.5));
      this.addSectionToggleLabel(right, top + layout.storyHeaderY, "", sectionOpen.story, 20, COLOR.inkDim);
    }
    if (storyText && layout.storyTextY !== undefined) { storyText.setPosition(left, top + layout.storyTextY); this.add(storyText); }
    else storyText?.destroy();

    // ── 초회 보상: 접지 않는다. 받은 관문이면 액자마다 검은 막과 노란 체크가 선다.
    if (layout.rewardLabelY !== undefined && layout.rewardRowY !== undefined) {
      this.add(this.scene.add.text(left, top + layout.rewardLabelY, t("stageComplete.firstClear"), textStyle({ role: "emphasis", size: spec.reward.labelSize, color: COLOR.inkDim })).setOrigin(0, 0));
      const columns = storyPreviewRewardColumns(sections.rewards.length, width);
      sections.rewards.forEach((reward, index) => {
        const x = columns[index];
        const y = top + layout.rewardRowY!;
        addStageRewardFrame(this.scene, this, x, y, spec.reward.frame, reward, { claimed: sections.rewardsClaimed });
        if (reward.kind !== "rune" || !sections.onRuneClick) return;
        const onRuneClick = sections.onRuneClick;
        const hit = this.scene.add.rectangle(x, y, spec.reward.frame, spec.reward.frame, 0xffffff, 0).setInteractive({ useHandCursor: true });
        hit.on("pointerup", () => onRuneClick(reward, { x: this.x + x, y: this.y + y - spec.reward.frame / 2 }));
        this.add(hit);
      });
    }

    if (keepPuppets && previousGroundScreen !== undefined) {
      const nextGroundScreen = this.sectionGroundScreen();
      if (nextGroundScreen !== undefined) for (const puppet of this.puppets) puppet.setY(puppet.y + nextGroundScreen - previousGroundScreen);
    }
    this.publishDebug(above);
  }

  /** SD 발끝의 화면 y. 적 칸이 접혀 있으면 없다. */
  private sectionGroundScreen(): number | undefined {
    const ground = this.sectionGround();
    return ground === undefined ? undefined : this.y + ground;
  }

  private isAbove(): boolean {
    return anchorEnemyPreview(this.nodeY, this.options.top, this.options.bottom, this.panelHeight).above;
  }

  /** 칸 머리줄 전체가 누르는 자리다 — 작은 ▾만 받으면 손끝이 빗나간다. */
  private addSectionHeader(y: number, height: number, _open: boolean, onToggle: () => void): void {
    const hit = this.scene.add.rectangle(0, y, NODE_ENEMY_PREVIEW.width - 40, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerup", onToggle);
    this.add(hit);
  }

  /** 오른쪽 끝의 「이름 ▾」. 접히면 ▾가 옆으로 누워 "펼칠 수 있다"를 말한다. */
  private addSectionToggleLabel(right: number, y: number, label: string, open: boolean, size: number, color: string): void {
    const caretSize = size * 0.9;
    const caret = drawGlyph(this.scene, "caret-down", right - caretSize / 2, y, caretSize, Phaser.Display.Color.HexStringToColor(color).color, 0.9, Math.max(2.5, caretSize * 0.14));
    caret.setAngle(open ? 0 : -90);
    this.add(caret);
    if (label) this.add(this.scene.add.text(right - caretSize - 12, y, label, textStyle({ role: "emphasis", size, color })).setOrigin(1, 0.5));
  }

  /** 펼친 적 칸 — 표식·이름줄·SD. 칸 윗변(`bodyTop`, 판 가운데 기준)에서 잰다. */
  private addEnemySlots(bodyTop: number, generation: number, keepPuppets: boolean): void {
    const body = STORY_PREVIEW.enemyBody;
    const columns = enemyPreviewColumns(this.options.enemies.length);
    const compact = columns.length > 3;
    const half = enemyPreviewSlotHalfWidth(this.options.enemies.length);
    const ground = bodyTop + body.ground;
    this.options.enemies.forEach((enemy, index) => {
      const growth = this.options.growth[index] ?? { level: 1, breakthrough: 0 };
      const x = columns[index];
      addSdFootShadow(this.scene, x, ground + 4, compact ? 112 : 150, this);
      const badgeSize = compact ? 40 : 52;
      const badgeX = x - half + badgeSize * 0.62;
      const badgeTop = bodyTop + body.badgeTop;
      this.add(new AffinityBadge(this.scene, badgeX, badgeTop, ELEMENT_ICON[enemy.element], badgeSize, 0.62));
      this.add(new AffinityBadge(this.scene, badgeX, badgeTop + badgeSize * 0.94, ROLE_ICON[enemy.role], badgeSize * 0.74, 0.62));
      addBreakthroughGradeMark(this.scene, this, x + half - 20, badgeTop - 4, compact ? 34 : 42, growth.breakthrough + 1);
      addUnitNameplate(this.scene, this, x, bodyTop + body.nameY, growth.level, enemy.name, compact ? 24 : 30);
      const hit = this.scene.add.rectangle(x, ground - 70, compact ? 145 : 230, 300, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerup", () => this.options.onEnemyClick(enemy, growth)); this.add(hit);
      const sdHeight = (compact ? 158 : NODE_ENEMY_PREVIEW.sdHeight)
        * ENCOUNTER_ROLE[encounterRoleFor(this.options.enemies.length, { elite: this.options.elite === true })].bodyScale;
      if (!keepPuppets) void this.spawnEnemy(enemy.id, x, ground, sdHeight, generation);
      if (this.options.elite) addStageEliteMark(this.scene, this, x, ground - sdHeight - 6, compact ? 22 : 26);
    });
  }

  /** 노드 또는 판 밖 탭은 선택과 비동기 요청을 함께 취소해 다음 선택이 새로 출현하게 한다. */
  dismiss(): void {
    if (!this.shown) return;
    this.scene.tweens.killTweensOf(this); this.removeAll(true); this.clearPuppets();
    this.tail = undefined; this.shown = false; this.revealed = false; this.setVisible(false);
    setDebugEnemyPreview(undefined);
  }

  /** 씬이 지도 밖 입력을 판 내부 입력과 구분할 때 쓰는 화면 좌표 판정이다. */
  containsScreenPoint(x: number, y: number): boolean {
    return this.visible && x >= this.x - NODE_ENEMY_PREVIEW.width / 2 && x <= this.x + NODE_ENEMY_PREVIEW.width / 2
      && y >= this.y - this.panelHeight / 2 && y <= this.y + this.panelHeight / 2;
  }

  /** 컨테이너를 뒤집지 않고 꼬리만 현재 노드 방향으로 다시 그린다. */
  private drawTail(above: boolean): void {
    if (!this.tail) return;
    const edge = above ? this.panelHeight / 2 : -this.panelHeight / 2;
    this.tail.clear().lineStyle(3, COLOR.accent, 0.55).lineBetween(0, edge, 0, edge + (above ? 52 : -52));
  }

  /** Puppet은 화면 좌표에 직접 세우며 세대가 바뀐 로드 결과는 즉시 폐기한다. */
  private async spawnEnemy(id: string, x: number, ground: number, height: number, generation: number): Promise<void> {
    const puppet = await spawnPuppet(this.scene, battleAssetFor(id), { x: this.x + x, groundY: this.y + ground, height, flipX: true, tint: 0xffffff, depth: this.depth + 1 });
    if (!this.active || generation !== this.generation || !this.scene.scene.isActive()) { puppet.destroy(); return; }
    puppet.setVisible(this.revealed); this.puppets.add(puppet);
  }

  /** 현재 세대를 무효화한 뒤 컨테이너 밖 GPU 개체까지 명시적으로 정리한다. */
  private clearPuppets(): void {
    this.generation += 1;
    for (const puppet of this.puppets) puppet.destroy();
    this.puppets.clear();
  }
}
