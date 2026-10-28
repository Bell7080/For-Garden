import Phaser from "phaser";
import { t } from "../i18n";
import { EMPTY_RUNE_LIST_FILTER, runeListFilterCount, runeListMatches, type RuneListFilter } from "../core/runeListFilter";
import { runeDisplayName, runePartLabel, runeRarityLabel, type RuneInstance } from "../core/runes";
import { DEFAULT_INVENTORY_SORT, InventoryManager, type InventorySort } from "../managers/InventoryManager";
import { session } from "../state/session";
import { addFilterButton, type FilterButton } from "./FilterButton";
import { PopupLayer } from "./PopupLayer";
import { addRuneBagToggles, RUNE_BAG_TOGGLE_ROW_WIDTH } from "./runeHolderCycle";
import { openRuneFilterPopup } from "./RuneFilterPopup";
import { equippedRuneSlot, runeStatLabel } from "./RunePopup";
import { runeTraitName } from "./runeTraitPresentation";
import { SortControl } from "./SortControl";
import { TextInputField } from "./TextInputField";
import { COLOR, textStyle } from "./theme";
import { RUNE_LIST_CONTROLS } from "./runeListControlsLayout";

export { RUNE_LIST_CONTROLS };


/** 목록 하나가 들고 다니는 조건. 판이 사는 동안만 기억한다(토글은 설정에 남는다). */
export interface RuneListState {
  query: string;
  filter: RuneListFilter;
  sort: InventorySort;
}

export function createRuneListState(sort: InventorySort = DEFAULT_INVENTORY_SORT): RuneListState {
  return { query: "", filter: EMPTY_RUNE_LIST_FILTER, sort: { ...sort } };
}

/** 검색이 읽는 글 — 이름 · 부위 · 등급 · 옵션 · 특성 이름. 「공격력」을 치면 그 옵션이 붙은 룬이 남는다. */
function runeSearchText(rune: RuneInstance): string {
  return [
    runeDisplayName(rune), runePartLabel(rune.part), runeRarityLabel(rune.rarity),
    ...rune.mainStats.map(({ key }) => runeStatLabel(key)), ...rune.subStats.map(({ key }) => runeStatLabel(key)),
    ...(rune.trait ? [runeTraitName(rune.trait.id)] : []),
  ].join(" ");
}

/**
 * 고를 수 있는 룬(`allowed`) 중 지금 조건에 남는 것을 정렬된 순서로.
 *
 * 정렬은 가방과 같은 규칙(`InventoryManager`)을 쓴다 — 두 판이 따로 정렬하면 같은 기준이 판마다 다른 줄을 세운다.
 */
export function visibleRuneList(state: RuneListState, allowed?: ReadonlySet<string>): RuneInstance[] {
  const toggles = session.settings.game.runeBag;
  return new InventoryManager(session).displayList("rune", state.sort)
    .flatMap((item) => (item.kind === "rune" ? [item.rune] : []))
    .filter((rune) => (allowed === undefined || allowed.has(rune.instanceId))
      && runeListMatches(rune, { filter: state.filter, toggles, text: state.query }, { equipped: equippedRuneSlot(rune.instanceId) !== undefined, searchText: runeSearchText(rune) }));
}

export interface RuneListControlsOptions {
  readonly scene: Phaser.Scene;
  readonly parent: Phaser.GameObjects.Container;
  readonly popups: PopupLayer;
  /** 두 줄의 왼쪽·오른쪽 끝과 위 줄의 세로 중심(부모 기준). */
  readonly left: number;
  readonly right: number;
  readonly y: number;
  readonly state: RuneListState;
  /** 부위가 하나로 정해진 목록(장착 가방)이면 끈다 — 필터 판에 부위 줄이 서지 않는다. */
  readonly parts: boolean;
  /** 조건이 바뀌었다. 부른 쪽은 목록만 다시 그린다 — 조작 줄까지 다시 세우면 검색 칸의 초점이 끊긴다. */
  readonly onChange: () => void;
  /** 이 판이 맨 위인가. 아니면 검색 칸의 DOM을 숨기고 자판을 내린다(위 판을 누른 손이 칸에 닿지 않게). */
  readonly isActive?: () => boolean;
}

/**
 * 룬 목록의 조작 두 줄 — 가방 룬 탭 · 장착 가방 · 특성 연구 · 합성 고르기가 같은 한 장을 쓴다.
 *
 * 필터 칩·필터 판·정렬 칩은 도감·편성 목록과 같은 프리팹이고, 검색 칸은 공용 입력 칸(`TextInputField`)이다.
 * 아래 줄의 토글(`addRuneBagToggles`)은 설정에 남아 네 판이 같은 모습으로 열린다.
 */
export class RuneListControls {
  private readonly filterButton: FilterButton;
  private readonly sort: SortControl<InventorySort["key"]>;
  private readonly search: TextInputField;
  private readonly count: Phaser.GameObjects.Text;

  constructor(options: RuneListControlsOptions) {
    const { scene, parent, popups, left, right, y, state } = options;
    const { rowHeight, rowGap, gap, filterWidth, sortWidth, dirWidth, fontSize } = RUNE_LIST_CONTROLS;
    this.filterButton = addFilterButton(scene, parent, { x: left + filterWidth / 2, y, width: filterWidth, height: rowHeight }, () => {
      this.sort.closeMenu();
      this.search.blur();
      const world = parent.getWorldTransformMatrix().transformPoint(left + filterWidth / 2, y + rowHeight / 2 + 26);
      openRuneFilterPopup(scene, popups, { x: world.x, y: world.y }, () => state.filter, (next) => {
        state.filter = next;
        this.filterButton.setCount(runeListFilterCount(next));
        options.onChange();
      }, { parts: options.parts });
    });
    this.filterButton.setCount(runeListFilterCount(state.filter));

    const dirX = right - dirWidth / 2;
    const sortX = dirX - dirWidth / 2 - gap - sortWidth / 2;
    const searchLeft = left + filterWidth + gap;
    const searchWidth = sortX - sortWidth / 2 - gap - searchLeft;
    this.search = new TextInputField(scene, searchLeft + searchWidth / 2, y, {
      width: searchWidth, height: rowHeight, value: state.query, maxGlyphs: 24, fontSize: 24,
      ariaLabel: t("rune.search"), placeholder: t("rune.search"), icon: "search",
      onChange: (value) => { state.query = value; options.onChange(); },
    });
    parent.add(this.search);

    this.sort = new SortControl(scene, {
      x: sortX, y, height: rowHeight, sortWidth, dirWidth, gap, fontSize, parent,
      sortOptions: ([
        ["relic", "inventory.sort.relic"], ["acquired", "inventory.sort.acquired"], ["rarity", "inventory.sort.rarity"], ["part", "inventory.sort.part"],
        ["trait", "inventory.sort.trait"], ["enhancement", "inventory.sort.craft"], ["equipped", "inventory.sort.equipped"],
      ] as const).filter(([id]) => options.parts || id !== "part").map(([id, key]) => ({ id, label: t(key) })),
      sortMode: state.sort.key, descending: state.sort.direction === "desc",
      onSort: (key) => { state.sort = { ...state.sort, key }; options.onChange(); },
      onDirection: (descending) => { state.sort = { ...state.sort, direction: descending ? "desc" : "asc" }; options.onChange(); },
    });

    const toggleY = y + rowHeight + rowGap;
    addRuneBagToggles(scene, parent, left, toggleY, () => options.onChange());
    // 개수는 토글 줄 오른쪽 끝 — 거른 결과가 몇 장인지가 토글을 누른 손에 바로 답한다.
    this.count = scene.add.text(right, toggleY, "", textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(1, 0.5);
    parent.add(this.count);
    if (right - left - RUNE_BAG_TOGGLE_ROW_WIDTH < 120) this.count.setVisible(false);

    if (options.isActive) {
      const sync = (): void => {
        const active = options.isActive!();
        this.search.setVisible(active);
        if (!active) this.search.blur();
      };
      scene.events.on(Phaser.Scenes.Events.PRE_UPDATE, sync);
      this.search.once(Phaser.GameObjects.Events.DESTROY, () => scene.events.off(Phaser.Scenes.Events.PRE_UPDATE, sync));
    }
  }

  /** 거른 수 / 고를 수 있는 수. */
  setCount(shown: number, total: number): void {
    this.count.setText(t("rune.list.count", { shown: shown.toLocaleString(), total: total.toLocaleString() }));
  }
}
