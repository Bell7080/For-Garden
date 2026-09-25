import Phaser from "phaser";
import { t } from "../i18n";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawLayer, slantedRect, toPoints } from "./holo";
import { CONTROL_BAR as BAR, SortControl, type SortOption } from "./SortControl";
import { COLOR, textStyle } from "./theme";
import {
  RELIC_AFFINITY_BUTTON,
  RELIC_CONTROL_ROW,
  relicAffinityButtonY,
  relicControlSpots,
} from "./relicGridLayout";

export type { SortOption };

export interface RelicControlBarOptions<T extends string> {
  readonly sortOptions: readonly SortOption<T>[];
  readonly sortMode: T;
  readonly onSort: (mode: T) => void;
  /** 지금 방향. 아래(내림차순)면 큰 값이 먼저 선다. */
  readonly descending: boolean;
  /** 방향을 뒤집는다. 기준은 그대로 두고 줄만 반대로 선다. */
  readonly onDirection: (descending: boolean) => void;
  readonly onFilter: (anchor: { x: number; y: number }) => void;
  readonly onSearch: (query: string) => void;
  /** 속성 상성표를 여는 버튼. 필터 버튼 바로 아래에 같은 폭으로 선다. */
  readonly onAffinity: (anchor: { x: number; y: number }) => void;
  /** 지금 걸린 조건 수. 0이면 표식을 세우지 않는다. */
  readonly filterCount: number;
}

/** 글자가 깜빡이는 주기. 손이 지금 이 칸에 있다는 것만 말하면 되므로 느리게 둔다. */
const CARET = { width: 4, duration: 520 } as const;

/**
 * 도감 상단의 조작 줄 — 필터 · 이름 검색 · 정렬.
 *
 * **검색 글자는 Phaser가 그리고 DOM은 입력만 받는다.** 투명한 `<input>`을 칸 위에 겹쳐 두면
 * 모바일에서 운영체제 자판이 올라오고, 글자 모양·자리·깜빡이는 막대는 화면 전체와 같은
 * 홀로그램 규칙을 따른다 — DOM이 직접 글자를 그리면 그 칸만 브라우저 기본 글꼴이 되어 한
 * 화면에 두 가지 글씨체가 보인다.
 */
export class RelicControlBar {
  private readonly input: HTMLInputElement;
  private readonly dom: Phaser.GameObjects.DOMElement;
  private readonly queryText: Phaser.GameObjects.Text;
  private readonly placeholder: Phaser.GameObjects.Text;
  private readonly caret: Phaser.GameObjects.Rectangle;
  private caretTween?: Phaser.Tweens.Tween;
  /** 정렬 기준 + 방향 — 룬 가방과 같은 한 장(`SortControl`). */
  private readonly sort: SortControl<string>;
  private readonly filterBadge: Phaser.GameObjects.Container;
  private readonly filterCountText: Phaser.GameObjects.Text;

  constructor(private readonly scene: Phaser.Scene, private readonly options: RelicControlBarOptions<string>) {
    const spots = relicControlSpots();
    const { y, height } = RELIC_CONTROL_ROW;

    // ── 필터 ──────────────────────────────────────────────────────────────
    const filter = scene.add.container(spots.filter.x, y);
    const filterShape = chipPoints(spots.filter.width, height, {
      bevel: { topLeft: height * 0.26, topRight: 0, bottomRight: height * 0.26, bottomLeft: 0 },
    });
    filter.add(drawLayer(scene, 0, 0, filterShape, { fill: BAR.fill, alpha: BAR.alpha }));
    filter.add(drawGlyph(scene, "filter", 0, 2, 40, COLOR.accent, 0.95, 3));
    // 걸린 조건 수는 **표식 하나**로만 알린다. 무엇이 걸렸는지는 눌러서 여는 판이 말한다.
    this.filterBadge = scene.add.container(spots.filter.width / 2 - 12, -height / 2 + 14);
    const badgePlate = scene.add.graphics();
    badgePlate.fillStyle(0xe23a46, 1);
    badgePlate.fillPoints(toPoints(slantedRect(34, 30, 8)), true);
    this.filterCountText = scene.add.text(0, 0, "", textStyle({ role: "display", size: 21, color: COLOR.ink })).setOrigin(0.5);
    this.filterBadge.add([badgePlate, this.filterCountText]);
    filter.add(this.filterBadge);
    const filterHit = scene.add.rectangle(0, 0, spots.filter.width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    filterHit.on("pointerdown", () => filter.setScale(1.08));
    filterHit.on("pointerout", () => filter.setScale(1));
    filterHit.on("pointerup", () => {
      filter.setScale(1);
      this.closeMenu();
      // 판의 머리글이 조작 줄 바로 밑에 붙지 않도록 한 뼘 띄운다 — 붙으면 `/필터`가 검색
      // 칸에 얹혀 두 줄이 한 덩어리로 읽힌다.
      options.onFilter({ x: spots.filter.x, y: y + height / 2 + 26 });
    });
    filter.add(filterHit);
    this.setFilterCount(options.filterCount);

    // ── 속성 상성 ─────────────────────────────────────────────────────────
    const affinityY = relicAffinityButtonY();
    const affinity = scene.add.container(spots.filter.x, affinityY);
    const affinityShape = chipPoints(spots.filter.width, RELIC_AFFINITY_BUTTON.height, {
      bevel: { topLeft: RELIC_AFFINITY_BUTTON.height * 0.26, topRight: 0, bottomRight: RELIC_AFFINITY_BUTTON.height * 0.26, bottomLeft: 0 },
    });
    affinity.add(drawLayer(scene, 0, 0, affinityShape, { fill: BAR.fill, alpha: BAR.alpha }));
    affinity.add(drawGlyph(scene, "affinity", 0, 1, 40, COLOR.accent, 0.95, 3));
    const affinityHit = scene.add.rectangle(0, 0, spots.filter.width, RELIC_AFFINITY_BUTTON.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    affinityHit.on("pointerdown", () => affinity.setScale(1.08));
    affinityHit.on("pointerout", () => affinity.setScale(1));
    affinityHit.on("pointerup", () => {
      affinity.setScale(1);
      this.closeMenu();
      options.onAffinity({ x: spots.filter.x, y: affinityY + RELIC_AFFINITY_BUTTON.height / 2 + 26 });
    });
    affinity.add(affinityHit);

    // ── 이름 검색 ─────────────────────────────────────────────────────────
    const searchShape = slantedRect(spots.search.width, height, 16);
    drawLayer(scene, spots.search.x, y, searchShape, { fill: BAR.fill, alpha: BAR.alpha });
    const textLeft = spots.search.x - spots.search.width / 2 + 62;
    drawGlyph(scene, "search", spots.search.x - spots.search.width / 2 + 34, y + 1, 32, COLOR.accent, 0.8, 3);
    this.placeholder = scene.add
      .text(textLeft, y, t("relics.search"), textStyle({ role: "body", size: 26, color: COLOR.inkDim }))
      .setOrigin(0, 0.5);
    this.queryText = scene.add
      .text(textLeft, y, "", textStyle({ role: "emphasis", size: 28, color: COLOR.ink }))
      .setOrigin(0, 0.5);
    this.caret = scene.add.rectangle(textLeft, y, CARET.width, height * 0.46, COLOR.accent, 1).setVisible(false);

    this.input = document.createElement("input");
    this.input.type = "search";
    this.input.setAttribute("aria-label", t("relics.search"));
    // 글자는 Phaser가 그린다. DOM은 자판과 입력만 맡으므로 **보이지 않게** 둔다 — 브라우저가
    // 기본 글꼴로 한 겹 더 그리면 한 칸에 글자가 두 벌 겹친다.
    this.input.style.cssText = [
      `width:${spots.search.width - 74}px`,
      `height:${height - 18}px`,
      "background:transparent",
      "border:0",
      "outline:none",
      "padding:0",
      "margin:0",
      "color:transparent",
      "caret-color:transparent",
      // iOS는 16px보다 작은 입력 칸에 초점이 가면 화면을 확대한다. 보이지 않는 글자라 값만 맞춘다.
      "font-size:16px",
      "-webkit-appearance:none",
    ].join(";");
    this.dom = scene.add.dom(spots.search.x + 37, y, this.input).setOrigin(0.5);
    this.input.addEventListener("input", () => this.syncQuery());
    // 자판의 확인을 누르면 초점을 놓아 목록을 볼 수 있게 한다.
    this.input.addEventListener("keydown", (event) => { if (event.key === "Enter") this.input.blur(); });
    this.input.addEventListener("focus", () => this.setCaretVisible(true));
    this.input.addEventListener("blur", () => this.setCaretVisible(false));
    // 칸 어디를 눌러도 초점이 간다 — 투명한 입력면은 좁아 가장자리를 누르면 자판이 뜨지 않는다.
    const searchHit = scene.add.rectangle(spots.search.x, y, spots.search.width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    searchHit.on("pointerup", () => this.input.focus());

    // ── 정렬 · 방향 ───────────────────────────────────────────────────────
    this.sort = new SortControl(scene, {
      x: spots.sort.x, y, height, sortWidth: spots.sort.width, dirWidth: spots.sortDir.width, gap: RELIC_CONTROL_ROW.gap,
      sortOptions: options.sortOptions, sortMode: options.sortMode, descending: options.descending,
      onSort: options.onSort, onDirection: options.onDirection,
    });

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /**
   * 기준이 바뀌면 그 기준이 처음 보여 주는 방향으로 되돌린다.
   *
   * 전투력을 높은 순으로 보다가 개체번호로 바꾸면 001이 아니라 마지막 번호부터 서는데, 그건
   * 고른 기준이 아니라 직전 방향이 남긴 결과다 — 기준을 고르는 손은 방향까지 고른 적이 없다.
   */
  setDirection(descending: boolean): void {
    this.sort.setDirection(descending);
  }

  /** 걸린 조건 수를 다시 적는다. 0이면 표식 자체가 사라진다. */
  setFilterCount(count: number): void {
    this.filterBadge.setVisible(count > 0);
    this.filterCountText.setText(String(count));
  }

  /** 검색 글을 비운다. 화면이 조건을 되돌릴 때 DOM 값까지 함께 맞춘다. */
  clearQuery(): void {
    this.input.value = "";
    this.syncQuery();
  }

  private syncQuery(): void {
    const value = this.input.value;
    this.queryText.setText(value);
    this.placeholder.setVisible(value === "");
    this.caret.x = this.queryText.x + this.queryText.width + 4;
    this.options.onSearch(value);
  }

  private setCaretVisible(visible: boolean): void {
    this.caretTween?.remove();
    this.caretTween = undefined;
    this.caret.setVisible(visible).setAlpha(1);
    if (!visible) return;
    this.caretTween = this.scene.tweens.add({ targets: this.caret, alpha: 0.1, duration: CARET.duration, yoyo: true, repeat: -1 });
  }

  private closeMenu(): void {
    this.sort.closeMenu();
  }

  private destroy(): void {
    this.caretTween?.remove();
    this.closeMenu();
    // DOM 요소는 캔버스 밖에 살아 있으므로 씬이 내려갈 때 직접 거둔다.
    this.dom.destroy();
  }
}
