import Phaser from "phaser";
import { t } from "../i18n";
import { RELIC_SORT_MODES, type RelicSortMode } from "../core/relicSort";
import { rosterFilterCount, withRosterSort, type RosterView } from "../core/rosterView";
import { addFilterButton, type FilterButton } from "./FilterButton";
import { PopupLayer } from "./PopupLayer";
import { openRelicFilterPopup, type RelicFilterPreset } from "./RelicFilterPopup";
import { SortControl } from "./SortControl";

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
  /**
   * 필터 판이 사는 층. **팝업 안에 서는 줄이면 그 팝업의 층을 반드시 넘긴다** — 이 줄이 따로 만든 층은
   * 깊이가 고정(2200)이라, 그보다 높은 층에 선 팝업(교류 2600) 안에서 열면 판이 그 팝업 **뒤**에 깔렸다.
   * 같은 층에 쌓으면 이미 열린 어느 판보다 위에 선다.
   */
  readonly popups?: PopupLayer;
  /** 필터 판이 세우는 축(`RELIC_FILTER_PRESET_AXES`). 화면이 무엇으로 고르는지에 맞춘다. 기본은 전투 편성. */
  readonly filterPreset?: RelicFilterPreset;
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
  private readonly filter: FilterButton;
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

    this.filter = addFilterButton(scene, this.layer, { x: options.left + filterWidth / 2, y, width: filterWidth, height }, () => {
      this.sort.closeMenu();
      // 판은 줄 **바로 아래**에서 목록을 덮으며 열린다. 가로는 목록 가운데 — 칩 하나에 맞추면 판이
      // 화면 왼쪽 끝으로 밀려 팝업 밖으로 비어져 나왔다.
      const below = { x: (options.left + options.right) / 2, y: y + height / 2 + 12 };
      const world = options.parent ? options.parent.getWorldTransformMatrix().transformPoint(below.x, below.y) : below;
      openRelicFilterPopup(scene, this.popups, { below: { x: world.x, y: world.y } }, () => this.view.filter,
        (next) => this.change({ ...this.view, filter: next }), options.filterPreset ?? "battle");
    });

    const dirX = options.right - dirWidth / 2;
    this.sort = new SortControl(scene, {
      x: dirX - dirWidth / 2 - gap - sortWidth / 2, y, height, sortWidth, dirWidth, gap, fontSize,
      sortOptions: RELIC_SORT_MODES.map((mode) => ({ id: mode, label: t(`relics.sort.${mode === "number" ? "id" : mode}`) })),
      sortMode: this.view.sortMode, descending: this.view.descending, parent: this.layer,
      // 펼친 목록이 그리드 **위**에 서도록 연 순간 이 줄을 부모의 맨 위로 올린다. 그리드는 이 줄보다 늦게
      // 더해지므로 그대로 두면 목록이 카드 뒤에 깔리고 카드가 먼저 손을 받았다.
      onOpen: () => { this.options.parent?.bringToTop(this.layer); },
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
    this.filter.setCount(rosterFilterCount(this.view));
  }
}
