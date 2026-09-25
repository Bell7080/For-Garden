import Phaser from "phaser";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawLayer, drawShapeEdge, slantedRect } from "./holo";
import { RELIC_SORT_MENU, relicSortMenuHeight, relicSortMenuRowY } from "./relicGridLayout";
import { COLOR, textStyle } from "./theme";
import { pressIn, pressOut } from "./pressFeedback";

/** 정렬 목록 한 줄. 화면이 아니라 부르는 쪽이 기준과 이름을 함께 넘긴다. */
export interface SortOption<T extends string> {
  readonly id: T;
  readonly label: string;
}

export interface SortControlOptions<T extends string> {
  /** 정렬 칩의 가운데. 방향 칩은 그 오른쪽에 `gap`만큼 떨어져 선다. */
  readonly x: number;
  readonly y: number;
  readonly height: number;
  readonly sortWidth: number;
  readonly dirWidth: number;
  readonly gap: number;
  /** 글자 크기 — 도감의 큰 줄과 팝업 안의 줄이 같은 한 장을 크기만 달리 쓴다. */
  readonly fontSize?: number;
  readonly sortOptions: readonly SortOption<T>[];
  readonly sortMode: T;
  readonly descending: boolean;
  readonly onSort: (mode: T) => void;
  readonly onDirection: (descending: boolean) => void;
  /** 펼친 목록이 앉을 층. 씬 바로 위에 선 줄이면 비워 둔다. */
  readonly parent?: Phaser.GameObjects.Container;
  /** 목록이 펼쳐지기 전에 부르는 쪽이 다른 판을 닫을 수 있게 알린다. */
  readonly onOpen?: () => void;
}

/** 조작 줄의 판 색 — 도감과 가방이 같은 판을 쓴다. */
export const CONTROL_BAR = { fill: 0x080d13, alpha: 0.86 } as const;

/**
 * 정렬 기준 칩 + 방향 칩 — **도감과 룬 가방이 같은 한 장을 쓴다.**
 *
 * 기준은 누를 때마다 도는 글자가 아니라 **열고 닫는 목록**이다. 가방이 기준 다섯을 맨 글자로
 * 늘어놓았을 때는 무엇이 버튼인지, 지금 어느 기준인지가 작은 화살표 하나로만 읽혔다. 방향은 목록
 * 이름과 따로 선다 — 한 칸에 두면 누를 때마다 기준을 고르는지 방향을 뒤집는지 손이 알 수 없다.
 * 화살표가 아래를 가리키면 큰 값이 먼저다.
 */
export class SortControl<T extends string> {
  private readonly label: Phaser.GameObjects.Text;
  private readonly arrow: Phaser.GameObjects.Container;
  private menu?: Phaser.GameObjects.Container;
  private mode: T;
  private descending: boolean;
  readonly objects: Phaser.GameObjects.Container[] = [];

  constructor(private readonly scene: Phaser.Scene, private readonly options: SortControlOptions<T>) {
    const { x, y, height, sortWidth, dirWidth, gap, parent } = options;
    const fontSize = options.fontSize ?? 27;
    this.mode = options.sortMode;
    this.descending = options.descending;

    const sortShape = slantedRect(sortWidth, height, 16);
    const sort = scene.add.container(x, y);
    sort.add(drawLayer(scene, 0, 0, sortShape, { fill: CONTROL_BAR.fill, alpha: CONTROL_BAR.alpha }));
    sort.add(drawShapeEdge(scene, 0, 0, sortShape, "top", { color: COLOR.accent, alpha: 0.6, width: 3 }));
    this.label = scene.add.text(-sortWidth / 2 + 30, 0, this.labelOf(this.mode), textStyle({ role: "display", size: fontSize, color: COLOR.accentText })).setOrigin(0, 0.5);
    sort.add(this.label);
    sort.add(drawGlyph(scene, "caret-down", sortWidth / 2 - 32, 2, Math.round(fontSize * 0.96), COLOR.accent, 0.9, 3));
    const sortHit = scene.add.rectangle(0, 0, sortWidth, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    sortHit.on("pointerdown", () => pressIn(sort));
    sortHit.on("pointerout", () => pressOut(sort, "normal", { pop: false }));
    sortHit.on("pointerup", () => { pressOut(sort); this.toggleMenu(); });
    sort.add(sortHit);

    const dirX = x + sortWidth / 2 + gap + dirWidth / 2;
    const dirShape = slantedRect(dirWidth, height, 16);
    const direction = scene.add.container(dirX, y);
    direction.add(drawLayer(scene, 0, 0, dirShape, { fill: CONTROL_BAR.fill, alpha: CONTROL_BAR.alpha }));
    this.arrow = scene.add.container(0, 0);
    this.arrow.add(drawGlyph(scene, "sort-arrow", 0, 0, Math.round(height * 0.43), COLOR.accent, 0.95, 3));
    direction.add(this.arrow);
    this.paintDirection();
    const dirHit = scene.add.rectangle(0, 0, dirWidth, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    dirHit.on("pointerdown", () => pressIn(direction));
    dirHit.on("pointerout", () => pressOut(direction, "normal", { pop: false }));
    dirHit.on("pointerup", () => {
      pressOut(direction);
      this.closeMenu();
      this.descending = !this.descending;
      this.paintDirection();
      options.onDirection(this.descending);
    });
    direction.add(dirHit);

    this.objects.push(sort, direction);
    parent?.add([sort, direction]);
    sort.once(Phaser.GameObjects.Events.DESTROY, () => this.closeMenu());
  }

  /** 기준이 바뀌어 방향을 되돌릴 때 화살표만 뒤집는다 — 같은 그림이라 뜻이 흔들리지 않는다. */
  setDirection(descending: boolean): void {
    this.descending = descending;
    this.paintDirection();
  }

  private paintDirection(): void {
    this.arrow.setAngle(this.descending ? 0 : 180);
  }

  private labelOf(mode: T): string {
    return this.options.sortOptions.find((option) => option.id === mode)?.label ?? "";
  }

  /**
   * 목록을 펼치고 접는다. 판은 칩 **바로 아래**에 붙는다 — 가운데에 띄우면 무엇을 눌러서 열린
   * 판인지 끊어진다. 바깥을 누르면 고르지 않고 닫힌다.
   */
  private toggleMenu(): void {
    if (this.menu) { this.closeMenu(); return; }
    this.options.onOpen?.();
    const { x, y, height: rowHeight, sortWidth: width, parent } = this.options;
    const options = this.options.sortOptions;
    const height = relicSortMenuHeight(options.length);
    const menu = this.scene.add.container(x, y + rowHeight / 2 + 10 + height / 2);
    if (parent) parent.add(menu); else menu.setDepth(60);

    // 바깥을 눌러 닫는 막. 부모가 팝업이면 그 좌표계라 화면보다 넉넉히 덮는다.
    const backdrop = this.scene.add.rectangle(0, 0, 8000, 8000, 0x000000, 0).setInteractive();
    backdrop.on("pointerup", () => this.closeMenu());
    menu.add(backdrop);

    const shape = chipPoints(width, height, { bevel: { topLeft: width * 0.12, topRight: 0, bottomRight: width * 0.12, bottomLeft: 0 } });
    menu.add(drawLayer(this.scene, 0, 0, shape, { fill: 0x0b0f15, alpha: 0.97, edge: COLOR.accent, edgeAlpha: 0.6 }));
    options.forEach((option, index) => {
      const rowY = relicSortMenuRowY(index, options.length);
      const on = option.id === this.mode;
      // 지금 기준은 판이 아니라 **크기와 강조색**으로 알린다.
      menu.add(this.scene.add.text(0, rowY, option.label, textStyle({ role: "display", size: on ? 30 : 26, color: on ? COLOR.accentText : COLOR.inkDim })).setOrigin(0.5));
      if (on) menu.add(drawShapeEdge(this.scene, 0, rowY, slantedRect(width - RELIC_SORT_MENU.padding * 2, RELIC_SORT_MENU.rowHeight, 12), "bottom", { color: COLOR.accent, alpha: 0.5, width: 3, inset: 30 }));
      const hit = this.scene.add.rectangle(0, rowY, width - RELIC_SORT_MENU.padding * 2, RELIC_SORT_MENU.rowHeight, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerup", () => {
        this.closeMenu();
        if (option.id === this.mode) return;
        this.mode = option.id;
        this.label.setText(option.label);
        this.options.onSort(option.id);
      });
      menu.add(hit);
    });
    this.menu = menu;
  }

  closeMenu(): void {
    this.menu?.destroy();
    this.menu = undefined;
  }
}
