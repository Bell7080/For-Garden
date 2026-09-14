import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { gameApi } from "../api/FakeServer";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import { strataBoardHaul, type StrataBoardView } from "../core/strataDig";
import { DEFAULT_STRATA_LAYER_ID, type StrataRewardKind } from "../data/strataLayers";
import { session } from "../state/session";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { BottomNav } from "../ui/BottomNav";
import { Button } from "../ui/Button";
import { addCategoryTab } from "../ui/CategoryTab";
import { CURRENCY_ICON_BY_WALLET } from "../ui/currencyIcons";
import { chipPoints, drawLayer, drawVignette, HOLO } from "../ui/holo";
import { addFramedIcon } from "../ui/itemFrame";
import { KeywordManager } from "../managers/KeywordManager";
import { PopupLayer } from "../ui/PopupLayer";
import { openRuneTraitPopup } from "../ui/RuneTraitPopup";
import { addRuneCard } from "../ui/runeIcons";
import { addSectionTitle } from "../ui/SectionTitle";
import { STRATA_BOARD, STRATA_ZONE_TONE, strataBoardMetrics, strataTileCenter } from "../ui/strataBoardLayout";
import { runeTraitName } from "../ui/runeTraitPresentation";
import { TopBar } from "../ui/TopBar";
import { bindCurrencyGuide, openCurrencyGuide } from "../ui/currencyGuideEntry";
import { COLOR, textStyle } from "../ui/theme";

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
} as const;

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
  private chargeText!: Phaser.GameObjects.Text;
  /** 서버 응답을 기다리는 동안 같은 칸을 두 번 누르지 못하게 한다. */
  private digging = false;

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
    this.chargeText = this.add.text(62, ARCHAEOLOGY.chargeY, "", textStyle({ role: "emphasis", size: 27, color: COLOR.inkDim })).setOrigin(0, 0);

    this.view = this.add.container(0, 0);
    this.paintTabs();
    new BottomNav(this, "archaeology");
    void this.refresh();
  }

  /** 좌하단 라벨 두 장. 가방·상점과 같은 한 장(`CategoryTab`)을 쓴다. */
  private paintTabs(): void {
    const tabs: ReadonlyArray<{ key: ArchaeologyTab; labelKey: TextKey }> = [
      { key: "strata", labelKey: "archaeology.tab.strata" },
      { key: "research", labelKey: "archaeology.tab.research" },
    ];
    tabs.forEach(({ key, labelKey }, index) => {
      addCategoryTab(this, undefined, {
        x: 60 + ARCHAEOLOGY.tabWidth / 2 + index * (ARCHAEOLOGY.tabWidth + 16),
        y: ARCHAEOLOGY.tabY,
        width: ARCHAEOLOGY.tabWidth,
        height: ARCHAEOLOGY.tabHeight,
        label: t(labelKey),
        selected: this.tab === key,
        onSelect: () => {
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

    const { cell, height } = strataBoardMetrics(board.columns, board.rows);
    const grid = this.add.container(BASE_WIDTH / 2, ARCHAEOLOGY.boardY);
    this.view.add(grid);
    this.view.add(this.add.text(BASE_WIDTH / 2, ARCHAEOLOGY.boardY - height / 2 - 72,
      t("archaeology.digsLeft", { digs: board.digsLeft }),
      textStyle({ role: "display", size: 34, color: COLOR.accentText })).setOrigin(0.5));

    for (const tile of board.tiles) {
      const { x, y } = strataTileCenter(tile.index, board.columns, board.rows);
      const shape = chipPoints(cell, cell, {
        bevel: { topLeft: cell * STRATA_BOARD.bevelRatio, topRight: 0, bottomRight: cell * STRATA_BOARD.bevelRatio, bottomLeft: 0 },
      });
      const tone = STRATA_ZONE_TONE[board.zones[tile.zone]?.tone ?? "soil"];
      // 연 칸은 흙을 걷어 낸 자리다 — 어두워지고 구역 색이 빠진다.
      grid.add(drawLayer(this, x, y, shape, {
        fill: tile.revealed ? 0x0a0f15 : tone.color,
        alpha: tile.revealed ? 0.82 : tone.alpha + HOLO.glass * 0.5,
      }));
      if (tile.revealed) {
        const texture = tile.kind === undefined ? null : rewardTexture(tile.kind);
        if (texture === null) continue;
        // 룬처럼 수가 뜻이 없는 것에는 수를 적지 않는다 — 「1」이 서면 하나를 세는 자리로 읽힌다.
        const amount = tile.kind === "rune" ? undefined : String(tile.amount ?? 0);
        addFramedIcon(this, grid, x, y, cell * 0.7, texture, { ...(amount ? { amount } : {}), plain: true });
        continue;
      }
      const hit = this.add.rectangle(x, y, cell, cell, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      hit.on("pointerup", () => this.dig(tile.index));
      grid.add(hit);
    }

    // 이번 판에서 캔 것. 세는 일은 순수 규칙이 하고 화면은 늘어놓기만 한다.
    const haul = strataBoardHaul(board);
    if (haul.length > 0) {
      const haulY = ARCHAEOLOGY.boardY + height / 2 + 96;
      addSectionTitle(this, 60, haulY - 70, t("archaeology.haul"));
      haul.forEach((entry, index) => {
        const texture = rewardTexture(entry.kind);
        if (texture === null) return;
        addFramedIcon(this, this.view, 110 + index * 126, haulY, 104, texture, { amount: String(entry.amount), plain: true });
      });
    }
  }

  private dig(index: number): void {
    if (this.digging) return;
    this.digging = true;
    void gameApi.digStrataTile({ tileIndex: index, requestId: `dig-${Date.now()}` })
      .then((result) => {
        this.charges = result.charges;
        this.board = result.board;
        this.paintView();
      })
      .finally(() => { this.digging = false; });
  }

  /* ── 특성 연구 ────────────────────────────────────────────────────────────── */

  private paintResearch(): void {
    const runes = [...session.runeInventory]
      // 특성이 있는 룬이 먼저 선다 — 연구 중인 것이 곧 지금 보고 싶은 것이다.
      .sort((a, b) => Number(b.trait !== undefined) - Number(a.trait !== undefined) || (a.sequence ?? 0) - (b.sequence ?? 0));
    if (runes.length === 0) return;

    const columns = 4;
    const cardWidth = 200;
    const cardHeight = 250;
    const gap = 18;
    const left = (BASE_WIDTH - (columns * cardWidth + (columns - 1) * gap)) / 2 + cardWidth / 2;
    runes.slice(0, 12).forEach((rune, index) => {
      const x = left + (index % columns) * (cardWidth + gap);
      const y = ARCHAEOLOGY.gridTop + Math.floor(index / columns) * (cardHeight + gap + 34);
      const card = addRuneCard(this, x, y, cardWidth, cardHeight, rune);
      card.setInteractive(new Phaser.Geom.Rectangle(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight), Phaser.Geom.Rectangle.Contains);
      card.on("pointerup", () => openRuneTraitPopup({
        scene: this, popups: this.popups, keywords: this.keywords, rune,
        onChanged: () => void this.refresh(),
      }));
      this.view.add(card);
      // 특성은 카드 밑에 이름 한 줄로만 말한다 — 카드 안에 넣으면 얼굴보다 먼저 읽힌다.
      this.view.add(this.add.text(x, y + cardHeight / 2 + 22,
        rune.trait ? runeTraitName(rune.trait.id) : t("rune.trait.none"),
        textStyle({ role: "emphasis", size: 22, color: rune.trait ? COLOR.accentText : COLOR.inkDim })).setOrigin(0.5));
    });
  }
}
