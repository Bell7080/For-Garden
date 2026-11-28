import Phaser from "phaser";
import { CONTENT_INTRO_IDS, type ContentIntroId, type IconIntroId } from "../core/tutorial";
import { HELP_BASICS_PAGE_COUNT, HELP_TERM_GROUPS, type HelpTermId } from "../data/helpCenter";
import { t, type TextKey } from "../i18n";
import { tutorialManager } from "../managers/TutorialManager";
import { ROLE_ICON } from "./affinityIcons";
import { BACKGROUND, useBackgroundTexture } from "./backgrounds";
import { addCategoryTab } from "./CategoryTab";
import { addClippedHit } from "./clippedHit";
import type { ClipRect } from "./clipRect";
import { CONTENT_INTRO_PAGES } from "./contentIntroPages";
import { coverCrop } from "./coverCrop";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { drawGlyph } from "./glyphs";
import { HELP_LAYOUT, HELP_TABS, helpRevealScroll, helpRowAt, helpTermRowHeight, helpViewportHeight, stackHelpRows, type HelpTab } from "./helpLayout";
import { chipPoints, drawLayer, drawShapeEdge } from "./holo";
import { openIconIntro, type IconIntroPage } from "./IconIntroPopup";
import type { PopupLayer } from "./PopupLayer";
import { POPUP_TITLE_SIZE } from "./PopupLayer";
import { shapeClipMask } from "./popupArt";
import { pressIn, pressOut } from "./pressFeedback";
import { addScrollHint } from "./ScrollHint";
import { slideTabPage } from "./screenTransition";
import { addSectionTitle } from "./SectionTitle";
import { shrinkTextToWidth, squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/** 손가락이 이만큼 움직이면 누름이 아니라 끌기다. */
const TAP_SLOP = 14;

const W = CURRENCY_ICON_BY_WALLET;

/** 다시 보기 원화 위 어둠의 색 — 글자 획과 같은 먹색이다. */
const FADE_INK = 0x05070a;

/** 첫 플레이 튜토리얼을 한데 묶은 다시 보기 쪽지 — 궁극기 → 전투 조작 → 급여 → 복원 연구. */
const BASICS_ICONS: readonly string[] = [ROLE_ICON.warrior, ROLE_ICON.assassin, W.cheesecake, W.fossil];

export function helpBasicsPages(): readonly IconIntroPage[] {
  return Array.from({ length: HELP_BASICS_PAGE_COUNT }, (_, index) => ({
    icon: BASICS_ICONS[index] ?? W.fossil,
    headingKey: `help.basics.${index + 1}.heading` as TextKey,
    bodyKey: `help.basics.${index + 1}.body` as TextKey,
  }));
}

/** 다시 볼 수 있는 안내 하나. */
export type HelpTutorialEntry =
  | { kind: "basics"; id: "basics" }
  | { kind: "intro"; id: IconIntroId }
  | { kind: "guided"; id: "archaeology" | "duelDefense"; intro: ContentIntroId };

/**
 * 다시 보기 차례 — 첫 플레이 → 지도·편성(누구나 가장 먼저 지나는 곳) → 고고학 → 나머지는 콘텐츠가 열리는 대략의 순서.
 * 첫 방문 안내 ID가 늘면 `helpTutorialEntries`가 빠진 것을 맨 뒤에 붙여 목록에서 사라지지 않게 한다.
 */
const TUTORIAL_ORDER: readonly HelpTutorialEntry[] = [
  { kind: "basics", id: "basics" },
  { kind: "intro", id: "stageMap" },
  { kind: "intro", id: "party" },
  { kind: "guided", id: "archaeology", intro: "archaeologyTour" },
  { kind: "intro", id: "shop" },
  { kind: "intro", id: "cakeOperation" },
  { kind: "intro", id: "bounty" },
  { kind: "intro", id: "interaction" },
  { kind: "intro", id: "duel" },
  { kind: "guided", id: "duelDefense", intro: "duelDefense" },
  { kind: "intro", id: "friends" },
  { kind: "intro", id: "raid" },
  { kind: "intro", id: "expedition" },
  { kind: "intro", id: "premium" },
];

export function helpTutorialEntries(): readonly HelpTutorialEntry[] {
  const listed = new Set<string>(TUTORIAL_ORDER.flatMap((entry) => (entry.kind === "guided" ? (entry.id === "archaeology" ? [entry.intro, "archaeologyBoard"] : [entry.intro]) : [entry.id])));
  const rest = CONTENT_INTRO_IDS.filter((id) => !listed.has(id))
    .map((id): HelpTutorialEntry => ({ kind: "intro", id: id as IconIntroId }));
  return [...TUTORIAL_ORDER, ...rest];
}

/** 이 안내를 이미 지나왔나 — 지나온 것만 다시 열린다. */
export function helpTutorialSeen(entry: HelpTutorialEntry): boolean {
  if (entry.kind === "basics") return tutorialManager.isDone("ultimate");
  return tutorialManager.introSeen(entry.kind === "guided" ? entry.intro : entry.id);
}

/**
 * 다시 보기 줄에 까는 원화 — 그 안내가 짚는 화면의 그림이다. 아이콘 한 장으로는 어느 화면 이야기인지 읽히지 않아
 * 층 전체에 그 화면을 깐다. 표에 없는 새 안내는 로비 원화로 선다.
 */
const TUTORIAL_BACKDROP: Readonly<Record<string, string>> = {
  basics: BACKGROUND.combat,
  stageMap: BACKGROUND.stageMap,
  party: BACKGROUND.battleArea,
  archaeology: BACKGROUND.archaeology,
  shop: BACKGROUND.shop,
  cakeOperation: BACKGROUND.sortieCake,
  bounty: BACKGROUND.sortieBounty,
  interaction: BACKGROUND.interactionDoppelParlor,
  duel: BACKGROUND.sortieDuel,
  duelDefense: BACKGROUND.sortieDuel,
  friends: BACKGROUND.lobby,
  raid: BACKGROUND.sortieRaid,
  expedition: BACKGROUND.expeditionRanking,
  premium: BACKGROUND.premiumShop,
  descendingMap: BACKGROUND.stageMapPrisonApproach,
};

export function helpTutorialBackdrop(entry: HelpTutorialEntry): string {
  return TUTORIAL_BACKDROP[entry.id] ?? BACKGROUND.lobby;
}

/** 줄 아래 한 줄 — 그 안내의 첫 쪽 제목이다(안내형은 제 한 줄). */
function entrySubtitleKey(entry: HelpTutorialEntry): TextKey {
  if (entry.kind === "basics") return "help.basics.1.heading";
  if (entry.kind === "guided") return entry.id === "archaeology" ? "help.tutorial.archaeology.sub" : "help.tutorial.duelDefense.sub";
  return `intro.${entry.id}.1.heading` as TextKey;
}

export interface HelpPopupOptions {
  /** 고고학 안내를 다시 돌 수 있도록 그 화면으로 간다. 넘기지 않으면 고고학 줄은 서지 않는다. */
  onReplayArchaeology?: () => void;
  /** 결투장 방어덱 안내를 다시 돌도록 결투장으로 간다. 넘기지 않으면 그 줄은 서지 않는다. */
  onReplayDuelDefense?: () => void;
}

/**
 * 도움말 — 게임 고유 용어 설명과 지난 안내 다시 보기를 한 창의 두 탭으로 연다.
 *
 * 흩어져 있던 안내(고고학의 「탐사 안내」처럼 화면마다 따로 세우던 다시 보기 버튼)를 이곳 한 문으로 모은다. 새 콘텐츠에
 * 첫 방문 안내를 더하면 이 목록에도 저절로 선다(`helpTutorialEntries`). 아이콘 쪽지는 이 창 위에 겹쳐 열려, 다 읽고
 * 닫으면 목록으로 돌아온다. 안내형(고고학)만 실제 화면을 짚어야 해서 그 화면으로 간다.
 */
export class HelpPopup {
  private tab: HelpTab = "terms";
  private body?: Phaser.GameObjects.Container;
  private list?: Phaser.GameObjects.Container;
  private tabs?: Phaser.GameObjects.Container;
  private content?: Phaser.GameObjects.Container;
  private rows: Phaser.GameObjects.Container[] = [];
  /** 줄마다 누르면 할 일 — 갈래 머리줄·잠긴 안내는 없다. */
  private actions: Array<(() => void) | undefined> = [];
  /** 지금 펼친 용어 하나. */
  private openTerm?: HelpTermId;
  private tops: number[] = [];
  private heights: number[] = [];
  /** 줄마다 앞의 틈 — 끝 높이를 다시 쌓을 때 같은 값을 쓴다. */
  private gaps: number[] = [];
  private scroll = 0;
  private minScroll = 0;
  private close?: () => void;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly options: HelpPopupOptions = {}) {}

  open(): void {
    if (this.body) return;
    const { popup } = HELP_LAYOUT;
    this.popups.open({
      width: popup.width, height: popup.height, title: t("help.title"), titleSize: POPUP_TITLE_SIZE.workboard, dim: true, dimAlpha: 0.72,
      onClose: () => { this.body = undefined; this.list = undefined; this.tabs = undefined; this.content = undefined; this.rows = []; this.close = undefined; },
    }, (body, close) => {
      this.body = body;
      this.close = close;
      this.render();
    });
  }

  private tutorials(): readonly HelpTutorialEntry[] {
    return helpTutorialEntries().filter((entry) => entry.kind !== "guided" || this.guidedReplay(entry) !== undefined);
  }

  private guidedReplay(entry: Extract<HelpTutorialEntry, { kind: "guided" }>): (() => void) | undefined {
    return entry.id === "archaeology" ? this.options.onReplayArchaeology : this.options.onReplayDuelDefense;
  }

  private render(keepScroll = false): void {
    const body = this.body; if (!body) return;
    const previousList = this.list; const previousTabs = this.tabs;
    const scroll = keepScroll ? this.scroll : 0;
    this.rows = []; this.tops = []; this.heights = []; this.actions = [];
    const list = this.buildFrame(body);
    if (this.tab === "terms") this.fillTerms(); else this.fillTutorials();
    this.finishList();

    const tabs = this.scene.add.container(0, 0);
    const { tab } = HELP_LAYOUT;
    const startX = -((HELP_TABS.length - 1) * (tab.width + tab.gap)) / 2;
    HELP_TABS.forEach((key, index) => {
      addCategoryTab(this.scene, tabs, {
        x: startX + index * (tab.width + tab.gap), y: tab.y, width: tab.width, height: tab.height,
        label: t(key === "terms" ? "help.tab.terms" : "help.tab.tutorials"), selected: key === this.tab,
        onSelect: () => {
          if (key === this.tab) return;
          const from = HELP_TABS.indexOf(this.tab);
          this.tab = key; this.openTerm = undefined; this.render();
          if (this.list) slideTabPage(this.scene, [this.list], from, HELP_TABS.indexOf(key));
        },
      });
    });
    body.add(tabs);
    previousList?.destroy(); previousTabs?.destroy();
    this.list = list; this.tabs = tabs;
    this.applyScroll(scroll);
  }

  /** 용어 하나를 펼치거나 접는다 — 펼치는 줄은 하나뿐이고, 펼친 줄이 창 밖으로 넘치면 보이는 자리까지 흐른다. */
  private toggleTerm(id: HelpTermId): void {
    this.openTerm = this.openTerm === id ? undefined : id;
    this.render(true);
    if (!this.openTerm) return;
    const index = this.rows.findIndex((row) => row.getData("term") === id);
    if (index < 0) return;
    this.applyScroll(helpRevealScroll(this.scroll, this.tops[index], this.heights[index], helpViewportHeight(), this.minScroll));
  }

  /**
   * 흐르는 창. 회고 창과 같은 문법이다 — 창 전체가 끌기를 받고, 끌지 않은 누름이 떨어진 자리의 줄을 연다.
   * 마스크는 흐르지 않는 틀을 따라가므로 판이 떠오르는 동안에도 어긋나지 않는다.
   */
  private buildFrame(body: Phaser.GameObjects.Container): Phaser.GameObjects.Container {
    const { viewport, row } = HELP_LAYOUT;
    const frame = this.scene.add.container(0, viewport.top);
    body.add(frame);
    const viewHeight = helpViewportHeight();
    const half = row.width / 2 + 24;
    const clip = (): ClipRect => {
      const matrix = frame.getWorldTransformMatrix();
      const scale = matrix.scaleY || 1;
      return { left: matrix.tx - half * scale, right: matrix.tx + half * scale, top: matrix.ty, bottom: matrix.ty + viewHeight * scale };
    };
    const drag = addClippedHit(this.scene, frame, 0, viewHeight / 2, half * 2, viewHeight, clip, { useHandCursor: false });
    this.scene.input.setDraggable(drag);
    const content = this.scene.add.container(0, 0);
    frame.add(content);
    content.setMask(shapeClipMask(this.scene, frame, [-half, 0, half, 0, half, viewHeight, -half, viewHeight]));
    this.content = content;
    addScrollHint(this.scene, frame, {
      x: 0, y: viewHeight / 2, width: half * 2, height: viewHeight, owner: content,
      read: () => ({ offset: this.scroll, min: this.minScroll }),
    });
    const localY = (pointer: Phaser.Input.Pointer): number => {
      const matrix = frame.getWorldTransformMatrix();
      return (pointer.worldY - matrix.ty) / (matrix.scaleY || 1) - this.scroll;
    };
    const tappable = (index: number | undefined): (() => void) | undefined => (index === undefined ? undefined : this.actions[index]);
    let lastY = 0; let travel = 0; let pressed: Phaser.GameObjects.Container | undefined;
    const release = (pop: boolean): void => { if (pressed) pressOut(pressed, "normal", { pop }); pressed = undefined; };
    drag.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      travel = 0;
      const index = helpRowAt(localY(pointer), this.tops, this.heights);
      if (tappable(index)) { pressed = this.rows[index!]; pressIn(pressed); }
    });
    drag.on("dragstart", (pointer: Phaser.Input.Pointer) => { lastY = pointer.y; });
    drag.on("drag", (pointer: Phaser.Input.Pointer) => {
      const scale = frame.getWorldTransformMatrix().scaleY || 1;
      travel += Math.abs(pointer.y - lastY);
      if (travel > TAP_SLOP) release(false);
      this.applyScroll(this.scroll + (pointer.y - lastY) / scale); lastY = pointer.y;
    });
    drag.on("pointerout", () => release(false));
    drag.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      const wasPressed = pressed !== undefined;
      release(true);
      if (!wasPressed || travel > TAP_SLOP) return;
      tappable(helpRowAt(localY(pointer), this.tops, this.heights))?.();
    });
    drag.on("wheel", (_pointer: Phaser.Input.Pointer, _dx: number, dy: number) => this.applyScroll(this.scroll - dy * 0.65));
    return frame;
  }

  private finishList(): void {
    const { total } = stackHelpRows(this.heights, this.gaps);
    this.minScroll = Math.min(0, helpViewportHeight() - total);
  }

  private applyScroll(value: number): void {
    const content = this.content; if (!content?.active) return;
    this.scroll = Phaser.Math.Clamp(value, this.minScroll, 0);
    content.y = this.scroll;
    const viewHeight = helpViewportHeight();
    this.rows.forEach((row, index) => {
      const top = this.tops[index] + this.scroll;
      row.setVisible(top + this.heights[index] > 0 && top < viewHeight);
    });
  }

  /** 줄 판의 실루엣 — 왼쪽 위·오른쪽 아래만 깎는다. */
  private rowShape(height: number): number[] {
    const { width, bevel } = HELP_LAYOUT.row;
    return chipPoints(width, height, { bevel: { topLeft: bevel, topRight: 0, bottomRight: bevel, bottomLeft: 0 } });
  }

  /** 줄 판 한 장. 판때기는 두르지 않고 윗변 한 줄만 강조한다(`drawLayer`의 edge). */
  private addPlate(row: Phaser.GameObjects.Container, height: number, tone: { alpha: number; edge?: number; edgeAlpha?: number }): void {
    const shape = this.rowShape(height);
    row.add(drawLayer(this.scene, 0, height / 2, shape, { fill: COLOR.panel, alpha: tone.alpha, edge: tone.edge, edgeAlpha: tone.edgeAlpha ?? 0.5 }));
    row.add(drawShapeEdge(this.scene, 0, height / 2, shape, "bottom", { color: COLOR.accent, alpha: tone.edge ? 0.18 : 0.08, inset: 8 }));
  }

  private place(holder: Phaser.GameObjects.Container, top: number, height: number, action?: () => void): void {
    holder.y = top;
    this.content?.add(holder);
    this.rows.push(holder); this.tops.push(top); this.heights.push(height); this.actions.push(action);
  }

  /**
   * 용어 — 갈래 머리줄(공용 제목표) 아래 이름만 선 접힌 줄이 늘어서고, 누른 줄 하나만 설명을 펼친다.
   * 펼친 줄의 높이는 설명 글이 실제로 차지한 높이에서 구한다.
   */
  private fillTerms(): void {
    if (!this.content) return;
    const { row, term, group } = HELP_LAYOUT;
    const left = -row.width / 2 + row.inset;
    const caretX = row.width / 2 - term.caretRight;
    const textWidth = caretX - term.caretSize - left;
    const built: Array<{ holder: Phaser.GameObjects.Container; height: number; gap: number; action?: () => void }> = [];
    HELP_TERM_GROUPS.forEach((termGroup, groupIndex) => {
      const header = this.scene.add.container(0, 0);
      header.add(addSectionTitle(this.scene, -row.width / 2, group.height / 2, t(`help.group.${termGroup.id}` as TextKey), { size: group.titleSize }));
      built.push({ holder: header, height: group.height, gap: groupIndex === 0 ? 0 : group.gapBefore });
      termGroup.terms.forEach((id, termIndex) => {
        const open = this.openTerm === id;
        const holder = this.scene.add.container(0, 0).setData("term", id);
        const name = this.scene.add.text(left, term.padTop + term.nameSize / 2, t(`help.term.${id}.name` as TextKey),
          textStyle({ role: "display", size: term.nameSize, color: open ? COLOR.accentText : "#ffffff" })).setOrigin(0, 0.5);
        shrinkTextToWidth(name, textWidth);
        let height: number = term.collapsed;
        let bodyText: Phaser.GameObjects.Text | undefined;
        if (open) {
          bodyText = this.scene.add.text(left, term.padTop + term.nameSize + term.nameGap, t(`help.term.${id}.body` as TextKey),
            textStyle({ role: "body", size: term.bodySize, color: COLOR.ink }))
            .setOrigin(0, 0).setLineSpacing(term.lineSpacing).setWordWrapWidth(row.width - row.inset * 2, true);
          height = helpTermRowHeight(bodyText.height);
        }
        this.addPlate(holder, height, open ? { alpha: 0.9, edge: COLOR.accent, edgeAlpha: 0.7 } : { alpha: 0.62 });
        // 펼침 표식 — 접힌 줄은 아래를, 펼친 줄은 위를 가리킨다. 자리는 이름 줄 높이에 붙박는다.
        const caret = drawGlyph(this.scene, "caret-down", caretX, term.collapsed / 2, term.caretSize, open ? COLOR.accent : COLOR.inkDimHex, 0.95, 4);
        if (open) caret.setAngle(180);
        holder.add([name, caret]);
        if (bodyText) holder.add(bodyText);
        built.push({ holder, height, gap: termIndex === 0 ? group.gapAfter : term.gap, action: () => this.toggleTerm(id) });
      });
    });
    const { tops } = stackHelpRows(built.map(({ height }) => height), built.map(({ gap }) => gap));
    built.forEach(({ holder, height, action }, index) => this.place(holder, tops[index], height, action));
    this.gaps = built.map(({ gap }) => gap);
  }

  /**
   * 다시 보기 — 그 안내가 짚는 화면의 원화를 층 전체에 깔고 이름과 첫 쪽 제목을 얹는다. 글이 서는 왼쪽만 어둠이
   * 짙고 오른쪽으로 갈수록 원화가 비친다. 아직 지나오지 않은 안내는 원화가 가라앉고 자물쇠가 선다.
   *
   * 원화는 흐르는 목록 안에 있어 기하 마스크가 아니라 **이미지 자신의 crop**으로 줄 크기에 맞춘다. 깎인 두 모서리만
   * 줄을 따라가는 실루엣 마스크로 지운다(교류 목록과 같은 길).
   */
  private fillTutorials(): void {
    if (!this.content) return;
    const { row, tutorial } = HELP_LAYOUT;
    const entries = this.tutorials();
    const height = tutorial.height;
    const { tops } = stackHelpRows(entries.map(() => height));
    this.gaps = [];
    entries.forEach((entry, index) => {
      const seen = helpTutorialSeen(entry);
      const holder = this.scene.add.container(0, 0);
      const shape = this.rowShape(height);
      holder.add(drawLayer(this.scene, 0, height / 2, shape, { fill: COLOR.panel, alpha: 0.9 }));
      this.addArt(holder, helpTutorialBackdrop(entry), height, shape, seen);
      if (seen) holder.add(drawShapeEdge(this.scene, 0, height / 2, shape, "top", { color: COLOR.accent, alpha: 0.6, width: 3 }));
      const mid = height / 2;
      const left = -row.width / 2 + row.inset;
      const markX = row.width / 2 - tutorial.markRight;
      const textWidth = markX - 50 - left;
      const name = this.scene.add.text(left, mid + tutorial.nameY, t(`help.tutorial.${entry.id}` as TextKey),
        textStyle({ role: "display", size: tutorial.nameSize, color: seen ? "#ffffff" : COLOR.inkDim }))
        .setOrigin(0, 0.5).setStroke("#05070a", 6);
      shrinkTextToWidth(name, textWidth);
      holder.add(name);
      if (seen) {
        const sub = this.scene.add.text(left, mid + tutorial.subY, t(entrySubtitleKey(entry)),
          textStyle({ role: "body", size: tutorial.subSize, color: COLOR.ink }))
          .setOrigin(0, 0.5).setStroke("#05070a", 5);
        squeezeTextToWidth(sub, textWidth);
        holder.add(sub);
        holder.add(drawGlyph(this.scene, "page-next", markX, mid, 42, COLOR.accent, 0.95, 4));
      } else {
        holder.add(drawGlyph(this.scene, "lock", markX, mid, 46, COLOR.inkDimHex, 0.85, 4));
      }
      this.place(holder, tops[index], height, seen ? () => this.replay(entry) : undefined);
    });
  }

  /** 층 원화 + 왼쪽에서 걷히는 어둠. 둘을 한 상자에 담아 줄 실루엣으로 함께 자른다. */
  private addArt(holder: Phaser.GameObjects.Container, key: string, height: number, shape: number[], seen: boolean): void {
    const { row, tutorial } = HELP_LAYOUT;
    const layer = this.scene.add.container(0, height / 2);
    holder.add(layer);
    const art = this.scene.add.image(0, 0, "__DEFAULT").setAlpha(0);
    layer.add(art);
    const alpha = seen ? 1 : tutorial.lockedArtAlpha;
    const alreadyLoaded = this.scene.textures.exists(key);
    useBackgroundTexture(this.scene, art, key, (loaded) => {
      const crop = coverCrop(loaded.width, loaded.height, row.width, height);
      loaded.setScale(crop.scale).setCrop(crop.cropX, crop.cropY, crop.cropWidth, crop.cropHeight);
      if (alreadyLoaded) loaded.setAlpha(alpha);
      else this.scene.tweens.add({ targets: loaded, alpha, duration: 160 });
    });
    const fade = this.scene.add.graphics();
    // 두 구간으로 나눠 글이 서는 왼쪽 절반은 오래 짙게 버티고, 오른쪽에서 원화가 드러난다(한 구간이면 밝은 원화 위에서 글 뒤가 일찍 풀린다).
    const split = -row.width / 2 + row.width * tutorial.fadeSplit;
    fade.fillGradientStyle(FADE_INK, FADE_INK, FADE_INK, FADE_INK, tutorial.fadeLeft, tutorial.fadeMid, tutorial.fadeLeft, tutorial.fadeMid);
    fade.fillRect(-row.width / 2, -height / 2, split + row.width / 2, height);
    fade.fillGradientStyle(FADE_INK, FADE_INK, FADE_INK, FADE_INK, tutorial.fadeMid, tutorial.fadeRight, tutorial.fadeMid, tutorial.fadeRight);
    fade.fillRect(split, -height / 2, row.width / 2 - split, height);
    layer.add(fade);
    layer.setMask(shapeClipMask(this.scene, layer, shape));
  }

  private replay(entry: HelpTutorialEntry): void {
    if (entry.kind === "guided") {
      const go = this.guidedReplay(entry);
      this.close?.();
      go?.();
      return;
    }
    const pages = entry.kind === "basics" ? helpBasicsPages() : CONTENT_INTRO_PAGES[entry.id];
    openIconIntro(this.scene, this.popups, pages);
  }
}

