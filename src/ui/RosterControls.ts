import Phaser from "phaser";
import { t } from "../i18n";
import { RELIC_SORT_MODES, type RelicSortMode } from "../core/relicSort";
import { rosterFilterCount, withRosterSort, type RosterView } from "../core/rosterView";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawLayer, slantedRect, toPoints } from "./holo";
import { PopupLayer } from "./PopupLayer";
import { pressIn, pressOut } from "./pressFeedback";
import { openRelicFilterPopup } from "./RelicFilterPopup";
import { CONTROL_BAR as BAR, SortControl } from "./SortControl";
import { COLOR, textStyle } from "./theme";

/** 조작 줄의 자리. 도감의 큰 줄(84)보다 한 뼘 낮게 잡아 편성 화면의 그리드 위 한 줄에 든다. */
export const ROSTER_CONTROLS = { height: 56, gap: 12, filterWidth: 96, sortWidth: 190, dirWidth: 64, fontSize: 24 } as const;

/** 씬 위에 바로 서는 줄의 깊이. 정보창(1000)과 그 위 팝업보다 아래여야 창이 떠 있는 동안 눌리지 않는다. */
export const ROSTER_CONTROLS_DEPTH = 500;

export interface RosterControlsOptions {
  /** 조작 줄의 왼쪽·오른쪽 끝(화면 좌표). 필터는 왼쪽, 정렬·방향은 오른쪽 끝에 붙는다. */
  readonly left: number;
  readonly right: number;
  /** 줄의 세로 중심. */
  readonly y: number;
  readonly view: RosterView;
  readonly onChange: (view: RosterView) => void;
  /** 필터 판이 사는 층. 넘기지 않으면 이 줄이 하나 만든다. */
  readonly popups?: PopupLayer;
  /** 펼친 정렬 목록·필터 판이 다른 입력 위에 얹히도록 하는 깊이. */
  readonly depth?: number;
  /**
   * 팝업 안에 서는 줄이면 그 내용 컨테이너. 좌표(`left`·`right`·`y`)가 그 컨테이너 기준이 되고,
   * 필터 판은 그 자리의 화면 좌표에서 열린다. 넘기지 않으면 씬 위에 바로 선다.
   */
  readonly parent?: Phaser.GameObjects.Container;
}

/**
 * 편성 목록 위 한 줄 — **필터 · 정렬 · 방향**. 도감(`RelicControlBar`)과 같은 칩·같은 판·같은 필터 판이다.
 *
 * 편성 화면(파티·원정·발굴·교류)이 모두 이 한 장을 쓴다. 이름 검색은 두지 않는다 — 도감과 달리 여기서는
 * 보유한 몇 장을 훑어 고르는 자리라, 자판이 올라와 편성 미리보기를 덮을 이유가 없다.
 */
export class RosterControls {
  private view: RosterView;
  private readonly sort: SortControl<RelicSortMode>;
  private readonly badge: Phaser.GameObjects.Container;
  private readonly badgeText: Phaser.GameObjects.Text;
  private readonly layer: Phaser.GameObjects.Container;
  private readonly popups: PopupLayer;

  constructor(scene: Phaser.Scene, private readonly options: RosterControlsOptions) {
    const { height, gap, filterWidth, sortWidth, dirWidth, fontSize } = ROSTER_CONTROLS;
    const { y } = options;
    this.view = options.view;
    this.popups = options.popups ?? new PopupLayer(scene, 2200);
    // 정보창(1000)보다 아래에 둔다 — 3000에 서 있던 때는 정보창을 연 채로도 필터가 눌려 판이 겹쳐 열렸다.
    this.layer = scene.add.container(0, 0).setDepth(options.depth ?? ROSTER_CONTROLS_DEPTH);
    options.parent?.add(this.layer);

    const filter = scene.add.container(options.left + filterWidth / 2, y);
    const shape = chipPoints(filterWidth, height, { bevel: { topLeft: height * 0.26, topRight: 0, bottomRight: height * 0.26, bottomLeft: 0 } });
    filter.add(drawLayer(scene, 0, 0, shape, { fill: BAR.fill, alpha: BAR.alpha }));
    filter.add(drawGlyph(scene, "filter", 0, 2, 30, COLOR.accent, 0.95, 3));
    this.badge = scene.add.container(filterWidth / 2 - 10, -height / 2 + 10);
    const plate = scene.add.graphics();
    plate.fillStyle(0xe23a46, 1);
    plate.fillPoints(toPoints(slantedRect(28, 24, 6)), true);
    this.badgeText = scene.add.text(0, 0, "", textStyle({ role: "display", size: 17, color: COLOR.ink })).setOrigin(0.5);
    this.badge.add([plate, this.badgeText]);
    filter.add(this.badge);
    // 누르는 면은 보이는 칩보다 한 뼘 넓다 — 엄지가 칩 가장자리를 빗나가지 않게.
    const hit = scene.add.rectangle(0, 0, filterWidth + 16, height + 16, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => pressIn(filter));
    hit.on("pointerout", () => pressOut(filter, "normal", { pop: false }));
    hit.on("pointerup", () => {
      pressOut(filter);
      this.sort.closeMenu();
      const anchor = { x: options.left + filterWidth / 2, y: y + height / 2 + 26 };
      const world = options.parent ? options.parent.getWorldTransformMatrix().transformPoint(anchor.x, anchor.y) : anchor;
      openRelicFilterPopup(scene, this.popups, { x: world.x, y: world.y }, () => this.view.filter, (next) => this.change({ ...this.view, filter: next }), "battle");
    });
    filter.add(hit);
    this.layer.add(filter);

    const dirX = options.right - dirWidth / 2;
    this.sort = new SortControl(scene, {
      x: dirX - dirWidth / 2 - gap - sortWidth / 2, y, height, sortWidth, dirWidth, gap, fontSize,
      sortOptions: RELIC_SORT_MODES.map((mode) => ({ id: mode, label: t(`relics.sort.${mode === "number" ? "id" : mode}`) })),
      sortMode: this.view.sortMode, descending: this.view.descending, parent: this.layer,
      onSort: (mode) => { this.change(withRosterSort(this.view, mode), true); },
      onDirection: (descending) => this.change({ ...this.view, descending }),
    });
    this.paintBadge();
    if (!options.parent) scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.layer.destroy(true));
  }

  private change(view: RosterView, syncDirection = false): void {
    this.view = view;
    if (syncDirection) this.sort.setDirection(view.descending);
    this.paintBadge();
    this.options.onChange(view);
  }

  private paintBadge(): void {
    const count = rosterFilterCount(this.view);
    this.badge.setVisible(count > 0);
    this.badgeText.setText(String(count));
  }
}
