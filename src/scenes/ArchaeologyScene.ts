import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { gameApi } from "../api/FakeServer";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import { strataBoardHaul, type StrataBoardView } from "../core/strataDig";
import { DEFAULT_STRATA_LAYER_ID, type StrataRewardKind } from "../data/strataLayers";
import { session } from "../state/session";
import { canUpgradeRuneTraitGrade, RUNE_TRAIT_GRADES, RUNE_TRAIT_RULES } from "../core/runeTraits";
import { RUNE_TRAIT_ITEMS } from "../data/runeTraits";
import type { RuneInstance } from "../core/runes";
import { addResearchBench, type ResearchBenchAction } from "../ui/ResearchBench";
import { addSceneBackground, BACKGROUND, useBackgroundTexture } from "../ui/backgrounds";
import { BottomNav } from "../ui/BottomNav";
import { Button } from "../ui/Button";
import { addCategoryTab } from "../ui/CategoryTab";
import { CURRENCY_ICON_BY_WALLET } from "../ui/currencyIcons";
import { drawVignette } from "../ui/holo";
import { addFramedIcon } from "../ui/itemFrame";
import { KeywordManager } from "../managers/KeywordManager";
import { PopupLayer } from "../ui/PopupLayer";
import { RailButton } from "../ui/RailButton";
import { openRuneTraitReroll } from "../ui/RuneTraitPopup";
import { openRuneTraitOdds } from "../ui/RuneTraitOddsPopup";
import { coverSourceCrop, STRATA_ART, STRATA_BOARD, strataBoardFrame, strataLayerTextureKey, strataTileCenter, strataTileCrop } from "../ui/strataBoardLayout";
import { UI_ICON } from "../ui/icons";
import { TopBar } from "../ui/TopBar";
import { bindCurrencyGuide, openCurrencyGuide } from "../ui/currencyGuideEntry";
import { COLOR, textStyle } from "../ui/theme";
import { openRewardPopup, type RewardPopupItem } from "../ui/RewardPopup";

/**
 * 고고학. 하단 탭 첫 슬롯이다.
 *
 * 두 가지 일을 한다 — **지층 탐사**는 타일을 직접 눌러 파는 짧은 비전투 플레이이고,
 * **특성 연구**는 그렇게 캔 원석으로 룬의 숨은 한 줄을 가공하는 자리다.
 *
 * 로비의 **발굴**(배치해 두고 시간이 지나 걷는 방치형)과 다른 콘텐츠다. 같은 말로 부르면
 * "발굴을 두 군데서 한다"가 되어 어느 쪽을 말하는지 매번 물어야 한다.
 */

/** 두 갈래. 씬 하나 안에서 판만 갈아 끼운다. */
type ArchaeologyTab = "strata" | "research";

/** 화면의 세로 좌표를 한 곳에서 잡는다. */
const ARCHAEOLOGY = {
  titleY: 185,
  chargeY: 268,
  boardY: 900,
  /** 라벨 줄은 하단 탭 바로 위에 선다 — 손가락이 가장 잘 닿는 자리다. */
  tabY: BASE_HEIGHT - 268,
  tabWidth: 280,
  tabHeight: 84,
  gridTop: 420,
  /** 남은 횟수를 말하는 곡괭이의 한 변. */
  chargeIcon: 46,
  /**
   * 확률 정보 입구.
   *
   * **횟수 줄과 같은 높이의 오른쪽 끝이다.** 그 아래에서 시작하는 판(탐사판·연구대)이 덮지
   * 않는 마지막 자리다. 예전에는 상점이 여기 섰고, 지금은 하단 라벨 줄의 셋째 자리로 갔다.
   */
  oddsX: BASE_WIDTH - 96,
  oddsY: 262,
} as const;

/**
 * 아직 올라오지 않았을 수도 있는 배경 원화를 세운다.
 *
 * **이미 올라와 있으면 그 키로 만들어야 한다** — `useBackgroundTexture`는 텍스처가 이미
 * 있으면 `setTexture`를 하지 않고 곧바로 `onReady`만 부르는 계약이라, 늘 `__DEFAULT`로
 * 만들면 두 번째 그리기부터 투명한 32×32가 그대로 남는다(판을 한 칸 판 뒤 판이 통째로
 * 사라졌다). 도착이 늦을 때만 자리지기를 쓰고 그때는 보이지 않게 둔다.
 */
function addBoardImage(scene: Phaser.Scene, key: string, apply: (image: Phaser.GameObjects.Image) => void): Phaser.GameObjects.Image {
  const ready = scene.textures.exists(key);
  const image = scene.add.image(0, 0, ready ? key : "__DEFAULT").setAlpha(ready ? 1 : 0);
  useBackgroundTexture(scene, image, key, (loaded) => { apply(loaded); loaded.setAlpha(1); });
  return image;
}

/** 보상 종류를 액자에 세울 그림 키로 바꾼다. 화면이 종류마다 그림을 따로 고르지 않는다. */
function rewardTexture(kind: StrataRewardKind): string | null {
  if (kind === "empty") return null;
  if (kind === "rune") return "currency-orestone";
  if (kind === "researchItem") return "item-rune-dust";
  return CURRENCY_ICON_BY_WALLET[kind];
}

export class ArchaeologyScene extends Phaser.Scene {
  private popups!: PopupLayer;
  private keywords!: KeywordManager;
  private tab: ArchaeologyTab = "strata";
  /** 지금 그려진 판. 서버 응답을 그대로 들고 있고 씬이 고쳐 쓰지 않는다. */
  private board: StrataBoardView | null = null;
  private charges = 0;
  private chargesMax = 0;
  /** 갈아 끼우는 몸통. 탭을 바꾸면 통째로 비운다. */
  private view!: Phaser.GameObjects.Container;
  /**
   * 라벨 줄을 담는 컨테이너.
   *
   * **씬에 직접 붙이면 다시 그릴 때 이전 것이 남는다** — `addCategoryTab`은 부모를 주지 않으면
   * 씬에 그대로 얹으므로, 탭을 누를 때마다 새 라벨이 옛 라벨 위에 겹쳐 글자가 두 겹으로
   * 보였다. 줄을 담을 자리를 씬이 갖고 다시 그리기 전에 비운다.
   */
  private tabRow!: Phaser.GameObjects.Container;
  private chargeText!: Phaser.GameObjects.Text;
  /** 서버 응답을 기다리는 동안 같은 칸을 두 번 누르지 못하게 한다. */
  private digging = false;
  /**
   * 연구대에 끼워 둔 룬.
   *
   * **인스턴스가 아니라 ID를 들고 있는다** — 특성을 바꾸면 서버가 새 값을 주므로, 객체를
   * 붙잡아 두면 화면만 옛 특성을 계속 그린다.
   */
  private benchRuneId: string | null = null;
  /** 방금 끼운 참인가. 연구대가 올라가며 들어서는 연출을 그 한 번만 태운다. */
  private benchJustSlotted = false;

  constructor() {
    super("archaeology");
  }

  create(): void {
    setDebugScene("archaeology");
    addSceneBackground(this, BACKGROUND.archaeology);
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { depth: -20, strength: 0.72 });
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.5).setDepth(-19);
    this.popups = new PopupLayer(this, 2600);
    this.keywords = new KeywordManager(this, this.popups);
    bindCurrencyGuide({ scene: this, popups: this.popups });
    // 고고학은 제 경제를 갖는다 — 상단 줄도 원석이 첫 칸이다.
    new TopBar(this, 40, {
      currencies: "archaeology",
      onSettings: () => this.scene.start("settings", { returnScene: "archaeology" }),
      onCurrency: (currency) => openCurrencyGuide({ scene: this, popups: this.popups }, currency),
    });

    this.add.text(60, ARCHAEOLOGY.titleY, t("archaeology.title"), textStyle({ role: "display", size: 52 })).setOrigin(0, 0);
    // 남은 횟수는 곡괭이 하나와 수 하나다. 「탐사」라고 다시 적지 않는다 — 이 화면에서 곡괭이가
    // 세는 것은 그것뿐이고, 그림이 이미 무엇을 세는지 말한다.
    this.add.image(60 + ARCHAEOLOGY.chargeIcon / 2, ARCHAEOLOGY.chargeY + ARCHAEOLOGY.chargeIcon / 2, UI_ICON.pickaxe)
      .setDisplaySize(ARCHAEOLOGY.chargeIcon, ARCHAEOLOGY.chargeIcon);
    this.chargeText = this.add.text(60 + ARCHAEOLOGY.chargeIcon + 10, ARCHAEOLOGY.chargeY + ARCHAEOLOGY.chargeIcon / 2, "",
      textStyle({ role: "display", size: 32, color: COLOR.ink })).setOrigin(0, 0.5);

    // **확률 정보는 판이 시작하기 전의 마지막 줄에 선다.** 어느 탭에서도 가려지지 않는 자리라
    // 굴리기 전에 무엇이 나올 수 있는지 읽고 들어갈 수 있다. 상점은 하단 라벨 줄로 내려갔다.
    new RailButton(this, ARCHAEOLOGY.oddsX, ARCHAEOLOGY.oddsY, {
      icon: "magnifier",
      label: t("rune.trait.odds"),
      accent: true,
      // **누른 자리에 붙이지 않는다** — 표 두 장이 든 큰 판이라 위로 붙이면 제목·횟수 줄을
      // 덮는다. 한동안 머무는 판은 화면 가운데에 서고 우하단 뒤로가기로 닫는다.
      onClick: () => openRuneTraitOdds({ scene: this, popups: this.popups }),
    });

    this.view = this.add.container(0, 0);
    this.tabRow = this.add.container(0, 0);
    this.paintTabs();
    new BottomNav(this, "archaeology");
    void this.refresh();
  }

  /**
   * 좌하단 라벨 석 장. 가방·상점과 같은 한 장(`CategoryTab`)을 쓴다.
   *
   * **셋째는 판을 갈아 끼우지 않고 상점으로 건너간다.** 오른쪽 위 아이콘으로 서 있던 때는
   * 같은 화면의 두 갈래(탐사·연구)와 다른 문법으로 열려, 같은 콘텐츠의 세 갈래가 두 자리에
   * 나뉘어 있었다. 선택된 채로 남지 않으므로 셋째 라벨은 늘 꺼진 모습이다.
   */
  private paintTabs(): void {
    const tabs: ReadonlyArray<{ key: ArchaeologyTab | "shop"; labelKey: TextKey }> = [
      { key: "strata", labelKey: "archaeology.tab.strata" },
      { key: "research", labelKey: "archaeology.tab.research" },
      { key: "shop", labelKey: "archaeology.shop" },
    ];
    // 옛 라벨을 먼저 지운다. 남겨 두면 누를 때마다 한 겹씩 쌓인다.
    this.tabRow.removeAll(true);
    tabs.forEach(({ key, labelKey }, index) => {
      addCategoryTab(this, this.tabRow, {
        x: 60 + ARCHAEOLOGY.tabWidth / 2 + index * (ARCHAEOLOGY.tabWidth + 16),
        y: ARCHAEOLOGY.tabY,
        width: ARCHAEOLOGY.tabWidth,
        height: ARCHAEOLOGY.tabHeight,
        label: t(labelKey),
        selected: key !== "shop" && this.tab === key,
        onSelect: () => {
          if (key === "shop") {
            // 같은 상점 씬을 상품표만 바꿔 다시 쓴다 — 새 씬을 만들면 선반·격자·값줄 규칙이
            // 두 곳이 되고 한쪽만 고치는 사고가 난다.
            this.scene.start("shop", { storefront: "archaeology", returnScene: "archaeology" });
            return;
          }
          if (this.tab === key) return;
          this.tab = key;
          this.paintTabs();
          this.paintView();
        },
      });
    });
  }

  /** 서버에서 지금 상태를 받아 다시 그린다. 씬이 횟수나 판을 스스로 계산하지 않는다. */
  private async refresh(): Promise<void> {
    const state = await gameApi.archaeologyState();
    this.charges = state.charges;
    this.chargesMax = state.chargesMax;
    this.board = state.board;
    this.paintView();
  }

  private paintView(): void {
    this.view.removeAll(true);
    this.chargeText.setText(t("archaeology.charges", { charges: this.charges, max: this.chargesMax }));
    if (this.tab === "strata") this.paintStrata();
    else this.paintResearch();
  }

  /* ── 지층 탐사 ────────────────────────────────────────────────────────────── */

  private paintStrata(): void {
    const board = this.board;
    if (board === null) {
      // 판이 없으면 여는 버튼 하나만 선다. **조회 중·준비 안 됨 같은 상태 문구는 두지 않는다.**
      const button = new Button(this, BASE_WIDTH / 2, ARCHAEOLOGY.boardY, {
        width: 560, height: 132, label: t("archaeology.start"), variant: "primary",
        onClick: () => {
          if (this.charges <= 0) return;
          void gameApi.startStrataRun({ layerId: DEFAULT_STRATA_LAYER_ID, requestId: `strata-${Date.now()}` })
            .then((state) => { this.charges = state.charges; this.board = state.board; this.paintView(); });
        },
      });
      button.setEnabled(this.charges > 0);
      this.view.add(button);
      return;
    }

    const frame = strataBoardFrame(board.columns, board.rows, BASE_WIDTH);
    const grid = this.add.container(frame.centerX, frame.centerY);
    this.view.add(grid);

    // 그림자 → 금속 외곽 → 홀로그램 안쪽 선 순으로 판의 깊이를 만든다. 모두 입력 타일보다 아래다.
    const shadow = this.add.graphics().fillStyle(COLOR.void, 0.42)
      .fillRoundedRect(-frame.width / 2 + 10, -frame.height / 2 + 16, frame.width, frame.height, 18);
    grid.add(shadow);
    const frameArt = this.add.graphics();
    frameArt.lineStyle(8, COLOR.strataFrame, 0.78).strokeRoundedRect(-frame.width / 2 - 7, -frame.height / 2 - 7, frame.width + 14, frame.height + 14, 20);
    frameArt.lineStyle(2, COLOR.strataFrameGlow, 0.68).strokeRect(-frame.width / 2 + 5, -frame.height / 2 + 5, frame.width - 10, frame.height - 10);
    grid.add(frameArt);

    // 두 원화 모두 같은 cover 크롭을 써서 열린 칸과 닫힌 칸의 흙 결 좌표가 이어진다.
    const boardCrop = coverSourceCrop(STRATA_ART.width, STRATA_ART.height, frame.width, frame.height);

    // **아래층이 맨 밑에 깔린다.** 겉장을 부순 칸에 드러나는 맨 흙이고, 겉장보다 가라앉아
    // 보이도록 한 겹 눌러 둔다 — 같은 밝기면 부순 자리가 아니라 다른 무늬로 보인다.
    grid.add(addBoardImage(this, BACKGROUND.strataBase, (image) => image.setCrop(boardCrop.x, boardCrop.y, boardCrop.width, boardCrop.height).setDisplaySize(frame.width, frame.height)));
    grid.add(this.add.rectangle(0, 0, frame.width, frame.height, COLOR.void, STRATA_BOARD.baseShade));

    // **겉장은 칸마다 같은 원화를 잘라 쓴다.** 조각을 따로 굽지 않으므로 칸 사이에 이음매가
    // 없고, 부순 칸만 지우면 그 자리에 아래층이 그대로 드러난다.
    const layerKey = strataLayerTextureKey(board.art);
    for (const tile of board.tiles) {
      if (tile.revealed) continue;
      const crop = strataTileCrop(tile.index, board.columns, board.rows, boardCrop);
      const center = strataTileCenter(tile.index, board.columns, frame);
      grid.add(addBoardImage(this, layerKey, (image) => {
        // 크롭은 원본 px, 배치와 표시 크기는 화면 px이다. 두 좌표계를 한 연산에 섞지 않는다.
        image.setCrop(crop.x, crop.y, crop.width, crop.height);
        image.setDisplaySize(frame.cellWidth, frame.cellHeight).setPosition(center.x, center.y);
      }));
    }

    // 보상은 부순 칸 위에 선다. 액자 없이 그림만 두면 흙 위에 얹힌 그림으로 읽히지 않는다.
    for (const tile of board.tiles) {
      const { x, y } = strataTileCenter(tile.index, board.columns, frame);
      if (tile.revealed) {
        const texture = tile.kind === undefined ? null : rewardTexture(tile.kind);
        if (texture === null) continue;
        // 룬처럼 수가 뜻이 없는 것에는 수를 적지 않는다 — 「1」이 서면 하나를 세는 자리로 읽힌다.
        const amount = tile.kind === "rune" ? undefined : String(tile.amount ?? 0);
        addFramedIcon(this, grid, x, y, Math.min(frame.cellWidth, frame.cellHeight) * 0.82, texture,
          { ...(amount ? { amount } : {}), plain: true });
        continue;
      }
      const hit = this.add.rectangle(x, y, frame.cellWidth, frame.cellHeight, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true });
      hit.on("pointerup", () => this.dig(tile.index));
      grid.add(hit);
    }

    // 경계는 입력 사각형과 분리된 단 하나의 Graphics가 일괄 그린다. 열린 칸도 같은 선을 공유한다.
    // 원화 뒤에 먼저 만들어 둔 외곽선을 원화 앞으로 올리되, 입력 객체와는 계속 분리해 둔다.
    grid.bringToTop(frameArt);
    const gridLines = this.add.graphics().lineStyle(2, COLOR.strataGrid, 0.62);
    for (let column = 0; column <= board.columns; column += 1) {
      const x = -frame.width / 2 + column * frame.cellWidth;
      gridLines.moveTo(x, -frame.height / 2).lineTo(x, frame.height / 2);
    }
    for (let row = 0; row <= board.rows; row += 1) {
      const y = -frame.height / 2 + row * frame.cellHeight;
      gridLines.moveTo(-frame.width / 2, y).lineTo(frame.width / 2, y);
    }
    gridLines.strokePath();
    grid.add(gridLines);

    this.view.add(this.add.text(frame.centerX, STRATA_BOARD.top - 34,
      t("archaeology.digsLeft", { digs: board.digsLeft }),
      textStyle({ role: "display", size: 34, color: COLOR.accentText })).setOrigin(0.5, 1));

    // 판 아래 빈 띠는 현재까지 얻은 결과를 작은 액자 영수증으로 채운다.
    const haul = strataBoardHaul(board);
    const haulY = frame.centerY + frame.height / 2 + 62;
    haul.forEach(({ kind, amount }, index) => {
      const texture = rewardTexture(kind);
      if (texture === null) return;
      const x = frame.centerX - ((haul.length - 1) * 116) / 2 + index * 116;
      addFramedIcon(this, this.view, x, haulY, 84, texture, { amount: String(amount), plain: true });
    });
  }

  private dig(index: number): void {
    if (this.digging) return;
    this.digging = true;
    void gameApi.digStrataTile({ tileIndex: index, requestId: `dig-${Date.now()}` })
      .then((result) => {
        // 서버는 마지막 굴착과 동시에 판을 닫으므로, 닫기 전 화면 판에 마지막 영수증을 합쳐
        // 이번 판 전체 보상을 만든다. 보상은 이미 지급됐고 팝업은 그 사실만 확인시킨다.
        const completedBoard = this.board === null ? null : {
          ...this.board,
          digsLeft: result.board?.digsLeft ?? 0,
          tiles: this.board.tiles.map((tile) => tile.index === result.tile.index ? { ...tile, revealed: true, kind: result.tile.kind, amount: result.tile.amount } : tile),
        } satisfies StrataBoardView;
        this.charges = result.charges;
        this.board = result.board;
        this.paintView();
        if (result.board === null && completedBoard !== null) {
          const items: RewardPopupItem[] = strataBoardHaul(completedBoard).flatMap(({ kind, amount }) => {
            const icon = rewardTexture(kind);
            return icon === null ? [] : [{ icon, amount }];
          });
          openRewardPopup(this, this.popups, { items });
        }
      })
      .finally(() => { this.digging = false; });
  }

  /* ── 특성 연구 ────────────────────────────────────────────────────────────── */

  /**
   * 연구대 한 판.
   *
   * **룬을 늘어놓지 않는다** — 칸 하나에 끼우고 그 룬만 들여다본다. 위가 연구대, 아래가 그
   * 룬의 특성에 대해 지금 할 수 있는 일이다.
   */
  private paintResearch(): void {
    // 끼워 둔 룬이 팔리거나 바뀌었을 수 있다. 저장에서 다시 찾아 지금 값을 쓴다.
    const rune = this.benchRuneId === null
      ? undefined
      : session.runeInventory.find(({ instanceId }) => instanceId === this.benchRuneId);
    if (rune === undefined) this.benchRuneId = null;
    // 끼우는 그 한 번만 연출을 태운다. 부여·재해석 뒤의 다시 그리기까지 태우면 조작할 때마다
    // 판이 통째로 다시 조립되는 것으로 보인다.
    const animate = this.benchJustSlotted;
    this.benchJustSlotted = false;
    addResearchBench({
      scene: this, parent: this.view, popups: this.popups, keywords: this.keywords, rune, animate,
      onPick: (picked) => { this.benchRuneId = picked.instanceId; this.benchJustSlotted = true; this.paintView(); },
      onClear: () => { this.benchRuneId = null; this.paintView(); },
      actions: rune === undefined ? [] : this.traitActions(rune),
    });
  }

  /**
   * 그 룬의 특성에 지금 할 수 있는 일.
   *
   * **부여는 특성이 없는 룬에만 선다.** 이미 붙은 특성을 같은 버튼으로 갈아 치우면, 굴려서
   * 얻은 것을 한 번의 오조작으로 잃는 자리가 재해석 바로 위에 선다 — 다시 뽑는 일은 등급이
   * 내려가지 않는 **재해석**이 맡는다.
   *
   * **재해석이 맨 위다.** 이 화면에서 되풀이하는 조작이 그것뿐이고, 아래 셋은 아이템이 있을
   * 때만 한 번씩 누르는 일이다.
   *
   * **영웅 이상 확정 부여는 영웅 이하에서만 선다.** 전설 특성 위에 세우면 눌러서 등급을
   * 떨어뜨리는 버튼이 되고, 눌러도 나아지지 않는 칸은 준비 상태를 과장한다.
   */
  private traitActions(rune: RuneInstance): ResearchBenchAction[] {
    const owned = (itemId: string): number => session.itemInventory.find((stack) => stack.itemId === itemId)?.quantity ?? 0;
    const grant = RUNE_TRAIT_ITEMS.grant;
    const grantHigh = RUNE_TRAIT_ITEMS.grantHigh;
    const upgrade = RUNE_TRAIT_ITEMS.upgrade;
    const request = (name: string): string => `${name}-${Date.now()}`;
    const actions: ResearchBenchAction[] = [];
    const trait = rune.trait;

    if (trait !== undefined) {
      actions.push({
        labelKey: "rune.traitAction.reroll",
        enabled: session.wallet.rawStone >= RUNE_TRAIT_RULES.rerollCost[trait.grade],
        cost: { icon: "currency-orestone", amount: RUNE_TRAIT_RULES.rerollCost[trait.grade] },
        onPress: () => void gameApi.rerollRuneTrait({ runeInstanceId: rune.instanceId, requestId: request("trait-reroll") })
          .then((result) => openRuneTraitReroll({
            scene: this, popups: this.popups, keywords: this.keywords,
            runeInstanceId: rune.instanceId, current: result.current, candidate: result.candidate,
            upgraded: result.upgraded, onResolved: () => this.paintView(),
          })),
      });
    } else {
      actions.push({
        labelKey: "rune.traitAction.grant",
        enabled: owned(grant.itemId) > 0,
        item: { itemId: grant.itemId, owned: owned(grant.itemId), cost: 1 },
        onPress: () => void gameApi.grantRuneTrait({ runeInstanceId: rune.instanceId, itemId: grant.itemId, requestId: request("trait") })
          .then(() => this.paintView()),
      });
    }

    // 확정 부여가 보장하는 등급(영웅)보다 이미 위면 세우지 않는다.
    if (trait === undefined || RUNE_TRAIT_GRADES.indexOf(trait.grade) <= RUNE_TRAIT_GRADES.indexOf(grantHigh.minimumGrade)) {
      actions.push({
        labelKey: "rune.traitAction.grantHigh",
        enabled: owned(grantHigh.itemId) > 0,
        item: { itemId: grantHigh.itemId, owned: owned(grantHigh.itemId), cost: 1 },
        onPress: () => void gameApi.grantRuneTrait({ runeInstanceId: rune.instanceId, itemId: grantHigh.itemId, requestId: request("trait-high") })
          .then(() => this.paintView()),
      });
    }

    if (trait !== undefined && canUpgradeRuneTraitGrade(trait)) {
      actions.push({
        labelKey: "rune.traitAction.upgrade",
        enabled: owned(upgrade.itemId) > 0,
        item: { itemId: upgrade.itemId, owned: owned(upgrade.itemId), cost: 1 },
        onPress: () => void gameApi.upgradeRuneTrait({ runeInstanceId: rune.instanceId, itemId: upgrade.itemId, requestId: request("trait-up") })
          .then(() => this.paintView()),
      });
    }
    return actions;
  }
}
