import Phaser from "phaser";
import { t } from "../i18n";
import { BASE_WIDTH } from "../config/gameConfig";
import { setDebugRelicScroll, setDebugScene } from "../debug";
import { sortRelicsByRarity, sortRelicsBySpecimenNumber } from "../data/relics";
import { combatPower } from "../core/combatPower";
import type { RelicDef } from "../core/types";
import { relicCollection } from "../managers/RelicCollectionManager";
import { session } from "../state/session";
import { BottomNav, NAV_TOP } from "../ui/BottomNav";
import { CharacterInfoManager } from "../managers/CharacterInfoManager";
import { TopBar } from "../ui/TopBar";
import { PortraitCard } from "../ui/PortraitCard";
import { PORTRAIT_GRID_MASK_GAP, portraitGridFirstRowY } from "../ui/portraitGrid";
import { relicProgression } from "../managers/RelicProgressionManager";
import { COLOR, textStyle } from "../ui/theme";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { SectionDivider } from "../ui/SectionDivider";
import { compareBookmarkedOwnedRelics } from "../core/relicCatalog";
import { drawVignette } from "../ui/holo";
import { relicSkinManager } from "../managers/RelicSkinManager";
import { RelicControlBar } from "../ui/RelicControlBar";
import { openRelicFilterPopup } from "../ui/RelicFilterPopup";
import { PopupLayer } from "../ui/PopupLayer";
import {
  RELIC_GRID,
  RELIC_GRID_INTRO,
  relicGridColumnX,
  relicGridIntroDelay,
  relicGridViewportTop,
} from "../ui/relicGridLayout";
import { openElementChartPopup } from "../ui/affinityPopups";
import {
  EMPTY_RELIC_FILTER,
  matchesRelicFilter,
  relicFilterCount,
  type RelicFilter,
} from "../core/relicFilter";

/** 조작 줄·상성 버튼과 하단 탭 사이만 목록에 내주는 고정 화면 경계다. */
const VIEWPORT_TOP = relicGridViewportTop();
const VIEWPORT_BOTTOM = NAV_TOP;
/** 카드 규격은 순수 배치표 하나가 갖는다. 첫 줄 자리와 미보유 구역이 같은 값을 읽어야 한다. */
const GRID_CARD = { width: RELIC_GRID.card.width, height: RELIC_GRID.card.height, gapX: RELIC_GRID.gapX, gapY: RELIC_GRID.gapY } as const;
/** 첫 줄의 돌출된 머리가 상단 마스크에 닿지 않도록 공용 안전 영역 계산만 쓴다. */
const GRID_FIRST_ROW_Y = portraitGridFirstRowY(VIEWPORT_TOP, GRID_CARD.height, PORTRAIT_GRID_MASK_GAP);
/** 드래그와 카드 탭을 구분하는 최소 이동 거리다. */
const DRAG_SLOP = 18;

/**
 * 렐릭 — 보유 중인 렐릭을 훑어보는 화면.
 *
 * 가지지 않은 렐릭도 자리는 남겨 둔다. 무엇이 더 있는지 보여야 뽑을 마음이 든다.
 * 카드를 누르면 곧바로 정보창이 열린다. 요약 칸을 따로 두지 않는 이유는, 같은 정보를 두 곳에
 * 두면 어느 쪽을 봐야 하는지 흐려지고 그리드에 쓸 자리도 줄기 때문이다.
 */
/** 도감 정렬 기준. 버튼 하나가 이 순서대로 돌아간다. */
type SortMode = "number" | "rarity" | "power";
const SORT_ORDER: readonly SortMode[] = ["number", "rarity", "power"];
/** 정렬 기준의 이름. 표가 아니라 함수인 이유는 표가 모듈을 읽는 순간 굳기 때문이다. */
const sortLabel = (mode: SortMode): string => t(`relics.sort.${mode === "number" ? "id" : mode}`);

export class RelicsScene extends Phaser.Scene {
  private info!: CharacterInfoManager;
  /** 필터 판이 사는 층. 조작 줄 위에 얹히는 쪽지라 화면을 새로 열지 않는다. */
  private popups!: PopupLayer;
  /** 상단 줄은 재화 칸 없이 프로필·설정만 세운다. 지갑이 바뀌면 디버그 표시만 다시 읽는다. */
  private topBar!: TopBar;
  private cards = new Map<string, PortraitCard>();
  /** 스토리 배열 순서와 분리된 도감 표시 정렬 기준이다. */
  private sortMode: SortMode = "number";
  /** 필터·검색·정렬을 한 줄에 세우는 조작 줄이다. */
  private controls!: RelicControlBar;
  /** 목록을 좁히는 조건. 화면이 규칙을 복제하지 않고 순수 모듈에 묻는다. */
  private filter: RelicFilter = EMPTY_RELIC_FILTER;
  /**
   * 다음 재조립에서 칸이 차례로 깔릴지.
   *
   * 목록이 **바뀌는** 순간에만 켠다 — 정보창을 닫고 돌아올 때마다 다시 깔리면 애착을 바꾸러
   * 들어갔다 나온 손이 매번 그 연출을 다시 본다.
   */
  private playIntro = true;
  /** 카드·구분선·미보유 제목을 함께 움직이고 한 번에 잘라 내는 유일한 콘텐츠 계층이다. */
  private content!: Phaser.GameObjects.Container;
  private viewportMask?: Phaser.GameObjects.Graphics;
  private contentBottom = VIEWPORT_TOP;
  /** 카드가 **놓인 자리**로 잰 그리드의 끝. 들어오는 연출의 임시 좌표와 섞이지 않는다. */
  private gridBottom = VIEWPORT_TOP;
  private minScrollY = 0;
  private velocityY = 0;
  private pointerDown = false;
  private pointerY = 0;
  private draggedDistance = 0;
  private readonly onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (pointer.y < VIEWPORT_TOP || pointer.y >= VIEWPORT_BOTTOM) return;
    // 스크롤이 불필요한 소수 카드에서도 이전 제스처의 이동량이 카드 탭을 막지 않게 초기화한다.
    this.draggedDistance = 0;
    if (!this.scrollEnabled()) return;
    this.pointerDown = true;
    this.pointerY = pointer.y;
    this.velocityY = 0;
  };
  private readonly onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (!this.pointerDown || !pointer.isDown) return;
    const delta = pointer.y - this.pointerY;
    this.pointerY = pointer.y;
    this.draggedDistance += Math.abs(delta);
    this.velocityY = delta * 60;
    this.scrollTo(this.content.y + delta);
  };
  private readonly onPointerUp = (): void => { this.pointerDown = false; };
  private readonly onWheel = (_pointer: Phaser.Input.Pointer, _objects: Phaser.GameObjects.GameObject[], _dx: number, dy: number): void => {
    if (this.scrollEnabled()) this.scrollTo(this.content.y - dy * 0.8);
  };

  constructor() {
    super("relics");
  }

  create(): void {
    setDebugScene("relics");
    this.cards.clear();
    this.content = this.add.container(0, 0);
    // 화면 좌표에 고정된 마스크는 콘텐츠가 움직여도 제목·탭 영역을 절대 침범하지 않는다.
    this.viewportMask = this.make.graphics();
    // 단일 기하 마스크가 정렬 조작 아래와 BottomNav 위에서 그리드를 확실히 끊는다.
    // BitmapMask의 반투명 띠는 일부 렌더러에서 씬 배경까지 사라진 듯 보이게 하므로 사용하지 않는다.
    this.viewportMask.fillStyle(0xffffff, 1).fillRect(0, VIEWPORT_TOP, BASE_WIDTH, VIEWPORT_BOTTOM - VIEWPORT_TOP);
    this.content.setMask(this.viewportMask.createGeometryMask());

    const cx = BASE_WIDTH / 2;
    // background_002를 렐릭 탭의 야외 유적 전경으로 사용한다.
    addSceneBackground(this, BACKGROUND.relics);
    // 비네팅은 스크롤 content가 아니라 씬 좌표에 둔다. 그래야 그리드 마스크 안에서 함께
    // 움직이거나 잘리지 않고 배경 원화의 화면 가장자리만 안정적으로 누른다.
    drawVignette(this, BASE_WIDTH, 1920, { depth: -28, strength: 0.62 });
    // 밝은 원화 위에서도 카드와 본문을 읽을 수 있도록 기존 void 색을 얇게 덮는다.
    this.add.rectangle(cx, 960, BASE_WIDTH, 1920, COLOR.void, 0.48).setDepth(-29);
    // 도감에서 재화를 쓰는 곳은 정보창뿐이고, 거기서 급여 버튼이 치즈케이크 수를 직접 말한다.
    // 목록을 훑는 화면이라 상단 줄에는 설정만 남긴다. 프로필도 재화도 여기서는 볼 일이 없다.
    this.topBar = new TopBar(this, 40, {
      currencies: "none", profile: false,
      // 설정을 닫으면 목록의 현재 정렬 상태를 가진 이 씬 인스턴스로 돌아온다.
      onSettings: () => this.scene.start("settings", { returnScene: "relics" }),
    });

    const ownedCount = relicCollection.owned.length;
    this.add
      .text(40, 152, t("relics.owned"), textStyle({ role: "display", size: 56 }))
      .setOrigin(0, 0);
    this.add
      .text(
        BASE_WIDTH - 40,
        176,
        `${ownedCount} / ${relicCollection.catalog.length}`,
        textStyle({ role: "emphasis", size: 32, color: COLOR.accentText }),
      )
      .setOrigin(1, 0);

    // 조작 줄은 왼쪽부터 **필터 · 이름 검색 · 정렬**이다. 정렬은 눌러 돌리는 버튼이 아니라
    // 열고 닫는 목록이다 — 기준이 셋을 넘으면 원하는 것을 만날 때까지 눌러야 했다.
    this.popups = new PopupLayer(this);
    this.controls = new RelicControlBar(this, {
      sortOptions: SORT_ORDER.map((mode) => ({ id: mode, label: sortLabel(mode) })),
      sortMode: this.sortMode,
      filterCount: relicFilterCount(this.filter),
      onSort: (mode) => this.setSortMode(mode as SortMode),
      onFilter: (anchor) => openRelicFilterPopup(this, this.popups, anchor, () => this.filter, (filter) => this.setFilter(filter)),
      onSearch: (query) => this.setFilter({ ...this.filter, query }),
      onAffinity: (anchor) => openElementChartPopup(this, this.popups, anchor),
    });

    this.info = new CharacterInfoManager(this);
    // 정보창 안에서 애착·즐겨찾기가 바뀔 수 있으므로 닫힐 때 표시와 정렬을 함께 다시 맞춘다.
    this.info.onClose = () => this.refresh();
    // 서버가 재화 차감을 확정한 직후 정보창과 상단 줄이 같은 세션 지갑을 다시 읽는다.
    this.info.onWalletChange = () => this.topBar.refresh();
    // manager 사건을 받으면 열린 정보창 뒤의 도감 카드도 같은 resolver 결과로 즉시 재조립한다.
    const unsubscribeSkin = relicSkinManager.subscribe(() => this.refresh());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribeSkin);
    this.refresh(true);
    this.installScrollInput();

    // 그리드는 BottomNav 경계에서 잘리고 배경 원화는 하단 탭 뒤까지 이어진다.
    new BottomNav(this, "relics");
  }

  /** 모바일 관성은 프레임 시간으로 감쇠하며, 이동한 프레임마다 카드 내부 마스크도 동기화한다. */
  update(_time: number, delta: number): void {
    if (!this.pointerDown && Math.abs(this.velocityY) > 4 && this.scrollEnabled()) {
      this.scrollTo(this.content.y + this.velocityY * Math.min(delta, 34) / 1000);
      this.velocityY *= Math.pow(0.9, delta / 16.67);
    }
    this.syncCardMasks();
  }

  /**
   * 카드 그리드.
   *
   * 카드마다 전신 원화의 얼굴 부분을 꽉 채워 넣는다. 이름·역할 같은 글자는 아래 띠에만 두고
   * 세부 수치는 요약 칸으로 미뤄, 한눈에 "누가 있는지"부터 보이게 한다.
   */
  private buildGrid(): void {
    const cols = RELIC_GRID.columns;
    const { width: cardW, height: cardH, gapX, gapY } = GRID_CARD;
    const startX = relicGridColumnX(0);
    const startY = GRID_FIRST_ROW_Y;

    // 보유와 미보유를 섞지 않는다. 가진 것을 먼저 다 보여 준 뒤, 아직 없는 것을 아래로
    // 몰아 따로 세운다 — 정렬 기준이 무엇이든 "내 것"이 위에 모여 있어야 훑기 쉽다.
    const sorted = this.sortRelics(relicCollection.catalog).filter((relic) => matchesRelicFilter(relic, this.filter));
    // 선택 정렬의 정확한 결과 순위를 fallback으로 주입해 씬에는 즐겨찾기 세부 규칙을 복제하지 않는다.
    const selectedOrder = new Map(sorted.map((relic, index) => [relic.id, index]));
    const owned = sorted.filter((relic) => relicCollection.owns(relic.id)).sort((a, b) => compareBookmarkedOwnedRelics(a, b, {
      bookmarked: session.bookmarked,
      bondOf: (relic) => relicProgression.getProgress(relic.id),
      fallback: (left, right) => (selectedOrder.get(left.id) ?? 0) - (selectedOrder.get(right.id) ?? 0),
    }));
    // 미보유는 즐겨찾기 비교에 넣지 않아 기존 하단 구역과 선택 정렬 결과를 그대로 유지한다.
    const locked = sorted.filter((relic) => !relicCollection.owns(relic.id));
    const ownedRows = Math.max(1, Math.ceil(owned.length / cols));
    // 보유 그리드의 마지막 줄 아래에서 제목 한 줄을 두고 다시 시작한다. 붙여 놓으면 제목이
    // 위 카드의 이름줄과 같은 덩어리로 읽혀 어디부터가 미보유인지 흐려진다.
    const ownedBottom = startY + (ownedRows - 1) * (cardH + gapY) + cardH / 2;
    // 들어오는 순서는 보유·미보유를 하나로 이어 세어야 한다 — 구역마다 0부터 다시 세면
    // 아래 구역이 위와 동시에 깔려 "첫 칸부터 차례로"가 두 번 일어난다.
    let introIndex = 0;
    this.gridBottom = VIEWPORT_TOP;
    const place = (list: RelicDef[], baseY: number): void => list.forEach((relic, i) => {
      const x = startX + (i % cols) * (cardW + gapX);
      const y = baseY + Math.floor(i / cols) * (cardH + gapY);
      this.placeCard(relic, x, y, cardW, cardH, introIndex);
      this.gridBottom = Math.max(this.gridBottom, y + cardH / 2);
      introIndex += 1;
    });
    place(owned, startY);
    if (locked.length > 0) {
      // 미보유 항목이 있을 때만 구분선과 제목을 같은 컨테이너에 만든다. 빈 섹션에는 장식도 없다.
      const section = this.add.container(0, 0);
      const dividerY = ownedBottom + Math.round(gapY * 0.72);
      section.add(new SectionDivider(this, BASE_WIDTH / 2, dividerY, BASE_WIDTH - 80));

      // 실제 접근성 글꼴 배율이 반영된 displayHeight를 읽어 첫 카드의 윗경계를 계산한다.
      // 카드 본체 높이뿐 아니라 머리 원화의 돌출 높이도 포함해 제목·등급 표식과 겹치지 않게 한다.
      const labelTop = dividerY + Math.round(gapY * 0.48);
      const label = this.add.text(40, labelTop, t("relics.unowned"), textStyle({ role: "display", size: 40, color: COLOR.inkDim })).setOrigin(0, 0);
      const count = this.add.text(BASE_WIDTH - 40, labelTop, String(locked.length), textStyle({ role: "emphasis", size: 26, color: COLOR.inkDim })).setOrigin(1, 0);
      section.add([label, count]);
      this.content.add(section);

      const labelHeight = Math.max(label.displayHeight, count.displayHeight);
      const labelToCardGap = Math.round(labelHeight * 0.7);
      const firstCardY = portraitGridFirstRowY(labelTop + labelHeight + labelToCardGap, cardH);
      place(locked, firstCardY);
    }
    // 마지막 카드의 몸체 아래가 실제 콘텐츠 끝이다. 항목이 적으면 min=max=0이 되어 입력도 꺼진다.
    // **카드의 지금 y가 아니라 놓인 자리로 잰다** — 들어오는 연출이 도는 동안에는 카드가 아직
    // 제자리보다 아래에 있어, 그때 재면 스크롤 범위가 연출 높이만큼 늘어난 채 굳는다.
    this.contentBottom = this.gridBottom;
  }

  /** 지금 기준으로 목록을 정렬한다. 기준이 무엇이든 같은 카드 조립을 쓴다. */
  private sortRelics(catalog: readonly RelicDef[]): RelicDef[] {
    if (this.sortMode === "rarity") return sortRelicsByRarity(catalog);
    if (this.sortMode === "power") {
      // 미보유는 성장이 없으므로 기본 능력치의 전투력으로 줄을 세운다.
      const powerOf = (relic: RelicDef): number => combatPower(relicCollection.owns(relic.id) ? relicProgression.getFinalStats(relic.id) : relic.stats);
      return [...catalog].sort((a, b) => powerOf(b) - powerOf(a) || a.specimenNumber.localeCompare(b.specimenNumber));
    }
    return sortRelicsBySpecimenNumber(catalog);
  }

  /** 카드 한 장. 자리는 부르는 쪽이 정하고 여기서는 생김새와 입력만 맞춘다. */
  private placeCard(relic: RelicDef, x: number, y: number, cardW: number, cardH: number, introIndex: number): void {
    {
      const owned = relicCollection.owns(relic.id);

      const card = new PortraitCard(this, x, y, {
        width: cardW,
        height: cardH,
        relicId: relic.id,
        label: relic.name,
        level: owned ? relicProgression.getProgress(relic.id).level : undefined,
        rarity: relic.rarity,
        breakthroughGrade: owned ? relicProgression.getBreakthroughGrade(relic.id) : undefined,
        bookmarked: owned && relicCollection.isBookmarked(relic.id),
        affinity: { element: relic.element, role: relic.role },
        locked: !owned,
        // 애착 렐릭은 떠오르지 않고 붉게 탄다. 크기까지 바뀌면 옆 칸과 줄이 어긋나 목록을
        // 훑는 눈이 거기서 걸린다.
        selectedStyle: "favorite",
      });
      this.content.add(card);
      if (this.playIntro) this.playCardIntro(card, introIndex, y);
      // 카드를 누르면 바로 정보창이 열린다. 애착 설정도 그 안의 뱃지가 맡는다.
      card.hit.on("pointerup", () => {
        // 드래그 종료가 카드 선택으로 새지 않도록 포인터 이동 허용치를 넘은 탭은 버린다.
        if (this.draggedDistance <= DRAG_SLOP) this.info.showRelic(relic, relicCollection.owns(relic.id));
      });
      this.cards.set(relic.id, card);
    }
  }

  /**
   * 칸 하나가 들어오는 몫.
   *
   * **얕게 둔다.** 첫 줄이 촤르륵 깔리는 것만 보이고 그 뒤는 이미 서 있어야 한다 — 지연에
   * 상한이 있는 이유는 순수 배치표(`relicGridIntroDelay`)에 적어 두었다. 마스크 안에서 도는
   * 트윈이라 자리를 옮기는 동안에도 카드의 기하 마스크를 함께 맞춘다.
   */
  private playCardIntro(card: PortraitCard, index: number, finalY: number): void {
    card.setAlpha(0);
    card.y = finalY + RELIC_GRID_INTRO.rise;
    this.tweens.add({
      targets: card,
      alpha: 1,
      y: finalY,
      duration: RELIC_GRID_INTRO.duration,
      delay: relicGridIntroDelay(index),
      ease: "Quad.easeOut",
      onUpdate: () => card.syncMask(),
    });
  }

  /** 정렬을 바꾸면 카드만 재조립하고 선택·보유 상태는 그대로 보존한다. */
  private setSortMode(mode: SortMode): void {
    if (this.sortMode === mode) return;
    this.sortMode = mode;
    this.refresh(true);
  }

  /** 조건이 바뀌면 걸린 수를 조작 줄에 알리고 목록을 다시 세운다. */
  private setFilter(filter: RelicFilter): void {
    this.filter = filter;
    this.controls.setFilterCount(relicFilterCount(filter));
    this.refresh(true);
  }

  /** 정보창 변경을 반영해 카드 표식과 즐겨찾기 우선순위를 한 번에 다시 구성한다. */
  private refresh(intro = false): void {
    this.playIntro = intro;
    // 카드 자체를 다시 만들지 않으면 새 즐겨찾기 표식만 바뀌고 기존 좌표는 그대로 남는다.
    for (const card of this.cards.values()) card.destroy();
    this.cards.clear();
    // 정렬 전 콘텐츠 자식을 모두 없애 이전 장식·카드 입력면·마스크 참조가 남지 않게 한다.
    this.content.removeAll(true);
    this.buildGrid();
    for (const [id, card] of this.cards) {
      card.setSelected(relicCollection.owns(id) && id === session.favorite);
    }
    // 새 콘텐츠 높이로 범위를 다시 계산하고 이전 정렬의 위치를 가장 가까운 안전 경계로 접는다.
    this.minScrollY = Math.min(0, VIEWPORT_BOTTOM - this.contentBottom - 28);
    this.velocityY = 0;
    this.scrollTo(this.content.y);
    this.playIntro = false;
  }

  /** 씬 단위 핸들러는 종료 때 정확히 같은 함수 참조로 제거해 재진입 중복 입력을 막는다. */
  private installScrollInput(): void {
    this.input.on("pointerdown", this.onPointerDown);
    this.input.on("pointermove", this.onPointerMove);
    this.input.on("pointerup", this.onPointerUp);
    this.input.on("pointerupoutside", this.onPointerUp);
    this.input.on("wheel", this.onWheel);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off("pointerdown", this.onPointerDown);
      this.input.off("pointermove", this.onPointerMove);
      this.input.off("pointerup", this.onPointerUp);
      this.input.off("pointerupoutside", this.onPointerUp);
      this.input.off("wheel", this.onWheel);
      this.viewportMask?.destroy();
      this.viewportMask = undefined;
      setDebugRelicScroll(undefined);
    });
  }

  /** 휠·드래그·관성이 공유하는 유일한 clamp 경로다. */
  private scrollTo(y: number): void {
    this.content.y = Phaser.Math.Clamp(y, this.minScrollY, 0);
    if (this.content.y === this.minScrollY || this.content.y === 0) this.velocityY = 0;
    this.syncCardMasks();
    setDebugRelicScroll({ y: this.content.y, minY: this.minScrollY, maxY: 0, enabled: this.scrollEnabled(), viewportTop: VIEWPORT_TOP, viewportBottom: VIEWPORT_BOTTOM });
  }

  /** PortraitCard의 자체 마스크는 부모 이동을 상속하지 않으므로 월드 변환을 명시적으로 갱신한다. */
  private syncCardMasks(): void {
    for (const card of this.cards.values()) card.syncMask();
  }

  private scrollEnabled(): boolean { return this.minScrollY < 0; }
}
