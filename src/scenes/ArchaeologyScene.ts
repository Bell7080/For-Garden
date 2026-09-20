import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { gameApi } from "../api/FakeServer";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { setDebugArchaeologyDig, setDebugArchaeologyMap, setDebugScene, setDebugStorefrontControls } from "../debug";
import { strataBoardHaul, type StrataBoardView } from "../core/strataDig";
import { findStrataLayer, type StrataRewardKind } from "../data/strataLayers";
import { ARCHAEOLOGY_SITES, type ArchaeologySiteDefinition } from "../data/archaeologySites";
import { resolveArchaeologyFocusSite, rewardExpectationRating } from "../core/archaeologyMap";
import { archaeologySitePopupLayout } from "../ui/archaeologySitePopupLayout";
import { archaeologyRatingColor, STRATA_ZONE_TONE } from "../ui/strataTones";
import { ArchaeologyMapView } from "../ui/ArchaeologyMapView";
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
import { chipPoints, drawFrameVignette, drawLayer, drawVignette, HOLO, HoloBar } from "../ui/holo";
import { addSectionTitle } from "../ui/SectionTitle";
import { addFramedIcon } from "../ui/itemFrame";
import { KeywordManager } from "../managers/KeywordManager";
import { PopupLayer } from "../ui/PopupLayer";
import { RailButton } from "../ui/RailButton";
import { openRuneTraitReroll } from "../ui/RuneTraitPopup";
import { openRuneTraitOdds } from "../ui/RuneTraitOddsPopup";
import { coverSourceCrop, STRATA_ART, STRATA_BOARD, strataBoardFrame, strataCropPlacement, strataLayerTextureKey, strataTileCenter, strataTileCrop, type ScreenRect, type SourceCropRect } from "../ui/strataBoardLayout";
import { UI_ICON } from "../ui/icons";
import { TopBar } from "../ui/TopBar";
import { bindCurrencyGuide, openCurrencyGuide } from "../ui/currencyGuideEntry";
import { COLOR, textStyle } from "../ui/theme";
import { openRewardPopup, type RewardPopupItem } from "../ui/RewardPopup";
import { StrataDigEffect } from "../ui/StrataDigEffect";
import type { ArchaeologyStateResponse } from "../api/contracts";
import { formatCountdown } from "../core/formatCountdown";
import { archaeologyProgressManager } from "../managers/ArchaeologyProgressManager";

/**
 * 고고학. 하단 탭 첫 슬롯이다.
 *
 * 두 가지 일을 한다 — **지층 탐사**는 타일을 직접 눌러 파는 짧은 비전투 플레이이고,
 * **특성 연구**는 그렇게 캔 원석으로 룬의 숨은 한 줄을 가공하는 자리다.
 *
 * 로비의 **발굴**(배치해 두고 시간이 지나 걷는 방치형)과 다른 콘텐츠다. 같은 말로 부르면
 * "발굴을 두 군데서 한다"가 되어 어느 쪽을 말하는지 매번 물어야 한다.
 */

/** 두 갈래. 씬 하나 안에서 판만 갈아 끼운다 — 화면을 넘기는 상점은 이 줄에 서지 않는다. */
type ArchaeologyTab = "strata" | "research";

/** 화면의 세로 좌표를 한 곳에서 잡는다. */
const ARCHAEOLOGY = {
  titleY: 185,
  /** 라벨 줄은 하단 탭 바로 위에 선다 — 손가락이 가장 잘 닿는 자리다. */
  tabY: BASE_HEIGHT - 268,
  tabWidth: 280,
  tabHeight: 84,
  /**
   * 화면 제목 줄의 오른쪽 — **이 화면의 고정 입구 둘이 나란히 서는 자리다.**
   *
   * 아래에서 시작하는 판(탐사판·연구대·지도)이 어느 탭에서도 덮지 않는 자리라, 굴리기 전에
   * 무엇이 나올 수 있는지 읽고 들어갈 수 있다. 예전에는 확률만 횟수 줄 높이(262)에 혼자
   * 섰고 상점은 하단 라벨 줄의 셋째 라벨이었다 — 라벨 줄은 **이 화면의 갈래**를 고르는
   * 자리인데 셋째만 화면을 통째로 넘겨, 켜진 채로 남지 못하고 돌아오는 길도 라벨이 아니라
   * 우하단 뒤로가기였다. 화면을 넘기는 입구는 교류의 교환소처럼 판 밖의 버튼이 맡는다.
   */
  oddsX: BASE_WIDTH - 96,
  entryY: 220,
  /** 상점 버튼 — 확률 돋보기 왼쪽에 서고 오른쪽 끝을 그 칩과 맞춘다. */
  shopButton: { x: 790, width: 240, height: 86 },
  /**
   * 횟수 판.
   *
   * **수만 서 있던 자리를 이름표가 붙은 판이 감싼다.** 지도 위에 `5/5`만 떠 있던 때는 그 수가
   * 무엇의 수인지 화면이 말하지 않아, 스테미나인지 남은 발굴인지 눌러 보고 알아야 했다.
   * 판 하나에 곡괭이·이름표·수·다음 충전을 함께 세우면 한 덩어리로 읽힌다.
   */
  chargePanel: { y: 352, width: 620, height: 126, icon: 58 },
  /** 진행 중인 판 위에 서는 남은 발굴 횟수 판. 같은 양식을 조금 줄여 쓴다. */
  digsPanel: { y: 292, width: 470, height: 104, icon: 46 },
  /** 판 아래 전리품 줄과 그 아래 중간 종료. 둘 다 판 크기와 무관하게 같은 자리에 선다. */
  haul: { y: 1372, frame: 116, gap: 152 },
  /**
   * 중간 종료.
   *
   * **하단 라벨 줄(윗변 1600)에 닿지 않는다** — 1560에 두었을 때는 켜진 라벨이 한 뼘 솟아
   * 그 판과 겹쳐, 화면을 넘기지 않는 이 버튼이 라벨 줄의 셋째 칸처럼 보였다.
   */
  finishButton: { y: 1500, width: 340, height: 84 },
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

/**
 * 잘라낸 원본 영역만 남겨 화면 사각형을 꽉 채운다. 배율·위치 계산은 순수 배치표가 갖고
 * 여기서는 그 값을 물리기만 한다 — 화면이 다시 재면 판과 칸이 서로 다른 셈을 쓴다.
 */
function fillWithCrop(image: Phaser.GameObjects.Image, crop: SourceCropRect, target: ScreenRect): void {
  const placement = strataCropPlacement(crop, target);
  image.setCrop(crop.x, crop.y, crop.width, crop.height);
  image.setScale(placement.scaleX, placement.scaleY).setPosition(placement.x, placement.y);
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
  /** 서버 확정 해금/완료 상태만 지도에 전달한다. */
  private siteStates: ArchaeologyStateResponse["sites"] = [];
  private charges = 0;
  private chargesMax = 0;
  /** 서버가 확정한 다음 충전 시각과 응답 순간에 계산한 서버-클라이언트 시계 차이다. */
  private nextChargeAt: number | null = null;
  private serverClockOffsetMs = 0;
  /** 매초 표기만 갱신하는 Phaser 타이머와 현재 횟수 판에 붙은 두 글자다. */
  private chargeTimer: Phaser.Time.TimerEvent | null = null;
  /** 「3/5」처럼 지금 몇 번 남았는지. */
  private chargeValueText: Phaser.GameObjects.Text | null = null;
  /** 그 옆의 다음 충전까지 남은 시간. 가득 차면 「가득 참」만 남는다. */
  private chargeNoteText: Phaser.GameObjects.Text | null = null;
  /** 0초 경계에서 서버 확정 조회를 중복으로 보내지 않는다. */
  private chargeRefreshPending = false;
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
  /** 서버 응답을 기다리는 동안 같은 칸을 두 번 누르지 못하게 한다. */
  private digging = false;
  /** 판 전체를 다시 만들지 않고 결과 한 칸만 갈아 끼우기 위한 렌더 경계다. */
  private readonly strataTiles = new Map<number, Phaser.GameObjects.Container>();
  private strataGrid: Phaser.GameObjects.Container | null = null;
  /** 판 아래 영수증 줄. 한 칸만 갈아 끼우는 굴착에서도 이 줄은 다시 그린다. */
  private strataHaul: Phaser.GameObjects.Container | null = null;
  /** 한 칸 결과마다 판 전체를 다시 만들지 않고 남은/총 굴착 횟수만 고치는 글자다. */
  private strataDigsText: Phaser.GameObjects.Text | null = null;
  /** 씬 종료 때 네트워크와 독립적으로 남아 있을 수 있는 연출을 모두 정리한다. */
  private readonly digEffects = new Set<StrataDigEffect>();
  /** 자동화에는 실제 API 호출 경계를 그대로 세어 한 입력당 한 요청인지 알린다. */
  private digRequests = 0;
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
    /*
     * **화면을 넘기는 입구는 제목 줄의 오른쪽에 선다** — 교류의 교환소와 같은 문법이다.
     *
     * 하단 라벨 줄은 이 화면의 갈래(탐사·연구)를 고르는 자리라, 거기 선 라벨은 눌러도 이
     * 화면에 남는다. 상점만 그 줄에서 화면을 통째로 넘기던 때는 셋째 라벨이 켜진 채로 남지
     * 못해 늘 꺼진 모습이었고, 돌아오는 길도 라벨이 아니라 우하단 뒤로가기였다.
     */
    this.add.existing(new Button(this, ARCHAEOLOGY.shopButton.x, ARCHAEOLOGY.entryY, {
      width: ARCHAEOLOGY.shopButton.width,
      height: ARCHAEOLOGY.shopButton.height,
      label: t("archaeology.shop"),
      icon: "shop",
      // 같은 상점 씬을 상품표만 바꿔 다시 쓴다 — 새 씬을 만들면 선반·격자·값줄 규칙이
      // 두 곳이 되고 한쪽만 고치는 사고가 난다.
      onClick: () => this.scene.start("shop", { storefront: "archaeology", returnScene: "archaeology" }),
    }));
    // 자동화도 런타임과 같은 고정 버튼을 누르도록 최소 입력 중심만 공개한다.
    setDebugStorefrontControls({ archaeology: { shop: { x: ARCHAEOLOGY.shopButton.x, y: ARCHAEOLOGY.entryY } } });
    // **확률 정보는 그 오른쪽 끝에 선다.** 어느 탭에서도 가려지지 않는 자리라 굴리기 전에
    // 무엇이 나올 수 있는지 읽고 들어갈 수 있다.
    new RailButton(this, ARCHAEOLOGY.oddsX, ARCHAEOLOGY.entryY, {
      icon: "magnifier",
      label: t("rune.trait.odds"),
      accent: true,
      // **누른 자리에 붙이지 않는다** — 표 두 장이 든 큰 판이라 위로 붙이면 제목·횟수 줄을
      // 덮는다. 한동안 머무는 판은 화면 가운데에 서고 우하단 뒤로가기로 닫는다.
      onClick: () => openRuneTraitOdds({ scene: this, popups: this.popups }),
    });

    this.view = this.add.container(0, 0);
    this.tabRow = this.add.container(0, 0);
    // Phaser 시계에 묶어 탭이 백그라운드에 있는 동안 불필요한 브라우저 interval을 남기지 않는다.
    this.chargeTimer = this.time.addEvent({ delay: 1000, loop: true, callback: () => this.updateChargeCountdown() });
    this.paintTabs();
    new BottomNav(this, "archaeology");
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.digEffects.forEach((effect) => effect.destroy());
      this.digEffects.clear();
      this.chargeTimer?.destroy(); this.chargeTimer = null; this.chargeValueText = null; this.chargeNoteText = null;
      this.strataTiles.clear(); this.strataGrid = null; this.strataHaul = null; this.strataDigsText = null; this.digging = false;
      setDebugArchaeologyDig(undefined);
    });
    void this.refresh();
  }

  /**
   * 좌하단 라벨 두 장. 가방·상점과 같은 한 장(`CategoryTab`)을 쓴다.
   *
   * **이 줄에 서는 것은 이 화면의 갈래뿐이다.** 눌러도 화면에 남고 켜진 채로 선다 — 화면을
   * 넘기는 상점이 셋째로 서 있던 때는 그 하나만 켜지지 못해, 같은 줄의 라벨이 저마다 다른
   * 문법으로 열렸다. 그 입구는 제목 줄 오른쪽의 버튼으로 나갔다.
   */
  private paintTabs(): void {
    const tabs: ReadonlyArray<{ key: ArchaeologyTab; labelKey: TextKey }> = [
      { key: "strata", labelKey: "archaeology.tab.strata" },
      { key: "research", labelKey: "archaeology.tab.research" },
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
    this.applyArchaeologyState(state);
    this.paintView();
  }

  /** 모든 고고학 응답의 충전·판·서버 시각을 한 원자적 경로로 반영한다. */
  private applyArchaeologyState(state: ArchaeologyStateResponse): void {
    const receivedAt = Date.now();
    const serverTime = Date.parse(state.serverTime);
    const nextChargeAt = state.nextChargeAt === null ? Number.NaN : Date.parse(state.nextChargeAt);
    this.charges = state.charges;
    this.chargesMax = state.chargesMax;
    this.board = state.board;
    this.siteStates = state.sites;
    // 구 저장의 진행 판도 다음 지도 복귀 때 같은 유적을 가리키도록 의미 있는 ID로 승격한다.
    if (state.board?.siteId) archaeologyProgressManager.selectSite(state.board.siteId);
    // 잘못된 서버 시각은 로컬 시각을 서버 시각이라고 추측하지 않고 안전한 정지 상태로 둔다.
    this.serverClockOffsetMs = Number.isFinite(serverTime) ? serverTime - receivedAt : 0;
    this.nextChargeAt = Number.isFinite(serverTime) && Number.isFinite(nextChargeAt) ? nextChargeAt : null;
    this.chargeRefreshPending = false;
  }

  /** 서버 시계로 남은 시간을 그리며, 경계에 닿았을 때만 서버에 실제 횟수를 다시 묻는다. */
  private updateChargeCountdown(): void {
    const value = this.chargeValueText;
    const note = this.chargeNoteText;
    if (value === null || !value.active) return;
    if (this.charges >= this.chargesMax || this.nextChargeAt === null) {
      // 최대 충전은 정책상 시간 대신 횟수만 보여 다음 충전이 있다는 오해를 막는다.
      value.setText(t("archaeology.chargeFull", { charges: this.charges, max: this.chargesMax }));
      note?.setText(t("archaeology.charge.full"));
      return;
    }
    const remainingMs = this.nextChargeAt - (Date.now() + this.serverClockOffsetMs);
    value.setText(t("archaeology.chargeCountdown", { charges: this.charges, max: this.chargesMax }));
    note?.setText(t("archaeology.charge.next", { time: formatCountdown(remainingMs) }));
    if (remainingMs > 0 || this.chargeRefreshPending) return;
    // 로컬에서는 횟수를 올리지 않는다. 서버가 충전을 정산한 응답만 apply 메서드로 반영한다.
    this.chargeRefreshPending = true;
    void this.refresh().catch(() => { this.chargeRefreshPending = false; });
  }

  private paintView(): void {
    // 명시적인 화면 전환에서만 기존 판 경계를 버린다. 한 칸 결과에는 이 메서드를 호출하지 않는다.
    this.strataTiles.clear(); this.strataGrid = null; this.strataHaul = null; this.strataDigsText = null;
    this.view.removeAll(true);
    this.chargeValueText = null; this.chargeNoteText = null;
    setDebugArchaeologyMap(undefined);
    if (this.tab === "strata") this.paintStrata();
    else this.paintResearch();
  }

  /* ── 지층 탐사 ────────────────────────────────────────────────────────────── */

  /**
   * 수 하나가 서던 자리를 이름표가 붙은 판으로 감싼다.
   *
   * **지도의 탐사 횟수와 판 위의 남은 굴착이 같은 한 장을 쓴다** — 둘 다 「곡괭이를 몇 번 더
   * 휘두를 수 있나」라 생김새가 갈리면 화면을 옮길 때마다 다른 것으로 읽힌다. 크기만 다르다.
   */
  private addCountPanel(spot: { y: number; width: number; height: number; icon: number }, label: string):
  { value: Phaser.GameObjects.Text; note: Phaser.GameObjects.Text } {
    const panel = this.add.container(BASE_WIDTH / 2, spot.y);
    this.view.add(panel);
    const shape = chipPoints(spot.width, spot.height, { bevel: { topLeft: spot.height * 0.34, bottomRight: spot.height * 0.34 } });
    panel.add(drawLayer(this, 0, 0, shape, { fill: 0x0b1116, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.8 }));
    const left = -spot.width / 2;
    panel.add(this.add.image(left + 30 + spot.icon / 2, 0, UI_ICON.pickaxe).setDisplaySize(spot.icon, spot.icon));
    const textX = left + 44 + spot.icon;
    panel.add(this.add.text(textX, -spot.height * 0.2, label,
      textStyle({ role: "emphasis", size: Math.round(spot.height * 0.21), color: COLOR.inkDim })).setOrigin(0, 0.5));
    const value = this.add.text(textX, spot.height * 0.22, "",
      textStyle({ role: "display", size: Math.round(spot.height * 0.3), color: COLOR.accentText })).setOrigin(0, 0.5);
    // 다음 충전 시각은 **지금 조작을 바꾸지 않는 수**라 이름표보다 작고 흐리게 오른쪽 끝에 붙는다.
    const note = this.add.text(spot.width / 2 - 26, spot.height * 0.22, "",
      textStyle({ role: "body", size: Math.round(spot.height * 0.19), color: COLOR.inkDim })).setOrigin(1, 0.5);
    panel.add([value, note]);
    return { value, note };
  }

  private paintStrata(): void {
    const board = this.board;
    if (board === null) {
      // 단일 시작 버튼 대신 양축 유적 지도를 세우고, 서버가 확정한 상태를 노드에만 투영한다.
      const charge = this.addCountPanel(ARCHAEOLOGY.chargePanel, t("archaeology.charge.label"));
      this.chargeValueText = charge.value; this.chargeNoteText = charge.note;
      this.updateChargeCountdown();
      const focus = resolveArchaeologyFocusSite(
        ARCHAEOLOGY_SITES,
        this.siteStates,
        undefined,
        session.archaeology.lastSelectedSiteId,
      );
      // 삭제되거나 다시 잠긴 선택은 화면에서만 우회하지 않고 안전한 유적으로 저장도 복구한다.
      if (focus && focus.id !== session.archaeology.lastSelectedSiteId) archaeologyProgressManager.repairSelection(focus.id);
      const map = new ArchaeologyMapView(this, {
        top: ARCHAEOLOGY.chargePanel.y + ARCHAEOLOGY.chargePanel.height / 2 + 24,
        bottom: ARCHAEOLOGY.tabY - 64,
        sites: ARCHAEOLOGY_SITES,
        states: this.siteStates.map((state) => ({
          ...state,
          cooldownUntilMs: state.cooldownUntil === null ? null : Date.parse(state.cooldownUntil),
        })),
        focusSiteId: focus?.id,
        onSelect: (site) => {
          // 서버가 확정한 해금 노드만 마지막 선택으로 남긴다. 잠긴 노드 열람은 진행 선택이 아니다.
          if (this.siteStates.find(({ siteId }) => siteId === site.id)?.unlocked) archaeologyProgressManager.selectSite(site.id);
          this.openSitePreview(site);
        },
        // 열세 자리가 얽힌 그물망에서 테스트가 좌표를 손으로 적지 않도록 실제 자리를 알린다.
        onLayout: (nodes) => setDebugArchaeologyMap({ nodes: nodes.map(({ siteId, x, y, state }) => ({ siteId, x, y, state })) }),
      });
      this.view.add(map);
      return;
    }

    const frame = strataBoardFrame(board.columns, board.rows, BASE_WIDTH);
    const grid = this.add.container(frame.centerX, frame.centerY);
    this.strataGrid = grid;
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
    grid.add(addBoardImage(this, BACKGROUND.strataBase, (image) => fillWithCrop(image, boardCrop, { centerX: 0, centerY: 0, width: frame.width, height: frame.height })));
    grid.add(this.add.rectangle(0, 0, frame.width, frame.height, COLOR.void, STRATA_BOARD.baseShade));

    /*
     * **칸마다 제 컨테이너를 갖는다.** 결과가 들어올 때 판을 통째로 다시 그리면 그 프레임에
     * 모든 칸이 한 번씩 깜빡이고, 굴착 연출이 도는 중에 그 아래 판이 갈아 끼워진다.
     * 비어 있는(이미 판) 칸도 자리를 만들어 두어야 그 자리에 결과를 넣을 수 있다.
     */
    for (const tile of board.tiles) {
      const tileView = this.add.container(0, 0);
      this.strataTiles.set(tile.index, tileView);
      grid.add(tileView);
      this.paintStrataTile(tile.index, board, boardCrop);
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

    /*
     * **판 안쪽을 네 변에서 눌러 둔다.** 격자만 그어 두었을 때는 판이 배경 원화 위에 놓인
     * 한 장이 아니라 화면에 직접 그은 선으로 보였다 — 가장자리가 어두워야 「여기까지가 땅」이
     * 읽힌다. 같은 도형을 줄여 가며 두르는 `drawInnerVignette`은 6×5처럼 가로로 긴 판에서
     * 좌우가 더 많이 줄어 검은 줄이 여러 겹 어긋난 잔상으로 남으므로 네 변 그라데이션을 쓴다.
     */
    grid.add(drawFrameVignette(this, 0, 0, frame.width, frame.height, { strength: 0.52, spread: 0.26 }));

    // 곡괭이는 충전 횟수가 아니라 현재 판에서 실제로 파는 횟수 옆에서만 의미를 갖는다.
    // 지도의 횟수 판과 **같은 한 장**을 조금 줄여 쓴다.
    const digs = this.addCountPanel(ARCHAEOLOGY.digsPanel, t("archaeology.digs.label"));
    this.strataDigsText = digs.value;
    digs.note.setVisible(false);
    this.paintStrataProgress(board);

    /*
     * **중간에 그만둘 수 있다.**
     *
     * 판을 여는 데 이미 횟수를 하나 치렀으므로 남은 칸을 다 파지 않고 떠나면 그 판은 영영
     * 열린 채로 남았다 — 다른 유적을 열 수도 없다(진행 중인 판은 하나뿐이다). 캔 것은 칸을
     * 팔 때 이미 지갑에 들어갔으니 여기서는 판을 닫기만 한다.
     */
    const finish = new Button(this, BASE_WIDTH / 2, ARCHAEOLOGY.finishButton.y, {
      width: ARCHAEOLOGY.finishButton.width, height: ARCHAEOLOGY.finishButton.height,
      label: t("archaeology.finish"),
      onClick: () => { if (!this.digging) void this.finishRun(board); },
    });
    this.view.add(this.add.existing(finish));

    this.paintStrataHaul(board);
    this.publishDigDebug();
  }

  /**
   * 칸 한 장을 그린다. 처음 판을 세울 때와 결과 한 칸을 갈아 끼울 때가 **같은 자리**를 지난다.
   *
   * 두 곳에서 따로 그리던 때는 갈아 끼운 칸만 구역 색을 잃어, 판 가운데에 색이 빠진 구멍이
   * 하나씩 늘었다.
   */
  private paintStrataTile(index: number, board: StrataBoardView, boardCrop: SourceCropRect): void {
    const tileView = this.strataTiles.get(index);
    const tile = board.tiles[index];
    if (tileView === undefined || tile === undefined) return;
    tileView.removeAll(true);
    const frame = strataBoardFrame(board.columns, board.rows, BASE_WIDTH);
    const center = strataTileCenter(index, board.columns, frame);
    if (!tile.revealed) {
      // **겉장은 칸마다 같은 원화를 잘라 쓴다.** 조각을 따로 굽지 않으므로 칸 사이에 이음매가
      // 없고, 부순 칸만 지우면 그 자리에 아래층이 그대로 드러난다.
      const crop = strataTileCrop(index, board.columns, board.rows, boardCrop);
      tileView.add(addBoardImage(this, strataLayerTextureKey(board.art), (image) => {
        // 크롭은 원본 px, 칸은 화면 px이다. 두 좌표계를 한 연산에 섞지 않고 배치표가 환산한다.
        fillWithCrop(image, crop, { centerX: center.x, centerY: center.y, width: frame.cellWidth, height: frame.cellHeight });
      }));
    }
    /*
     * **구역의 색.** 판을 만들 때 이미 구역마다 색이 정해져 있는데(`StrataZone`) 화면이 한
     * 번도 그리지 않아, 스물다섯 칸이 전부 같은 흙으로 보이고 어디를 파든 같은 선택이었다.
     * 흙빛은 칠하지 않으므로(`alpha` 0) 특화 구역 셋만 바탕 위로 떠오른다. 부순 칸에도
     * 그대로 남는다 — 색은 그 칸의 내용이 아니라 **땅의 성질**이다.
     */
    const tone = STRATA_ZONE_TONE[board.zones[tile.zone]?.tone ?? "soil"];
    if (tone.alpha > 0) {
      tileView.add(this.add.rectangle(center.x, center.y, frame.cellWidth, frame.cellHeight, tone.color, tone.alpha)
        .setBlendMode(Phaser.BlendModes.ADD));
    }
    if (tile.revealed) {
      // 보상은 부순 칸 위에 선다. 액자 없이 그림만 두면 흙 위에 얹힌 그림으로 읽히지 않는다.
      const texture = tile.kind === undefined ? null : rewardTexture(tile.kind);
      if (texture === null) return;
      // 룬처럼 수가 뜻이 없는 것에는 수를 적지 않는다 — 「1」이 서면 하나를 세는 자리로 읽힌다.
      const amount = tile.kind === "rune" ? undefined : String(tile.amount ?? 0);
      addFramedIcon(this, tileView, center.x, center.y, Math.min(frame.cellWidth, frame.cellHeight) * 0.82, texture,
        { ...(amount ? { amount } : {}), plain: true });
      return;
    }
    const hit = this.add.rectangle(center.x, center.y, frame.cellWidth, frame.cellHeight, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerup", () => this.dig(index));
    tileView.add(hit);
  }

  /** 남은 횟수를 버리고 판을 닫는다. 이미 캔 것은 그대로 남으므로 영수증만 한 장 띄운다. */
  private async finishRun(board: StrataBoardView): Promise<void> {
    this.digging = true;
    try {
      const response = await gameApi.abandonStrataRun({ requestId: `strata-finish-${Date.now()}` });
      this.applyArchaeologyState(response);
      this.paintView();
      const items: RewardPopupItem[] = strataBoardHaul(board).flatMap(({ kind, amount }) => {
        const icon = rewardTexture(kind);
        return icon === null ? [] : [{ icon, amount }];
      });
      if (items.length > 0) openRewardPopup(this, this.popups, { items });
    } catch {
      // 서버가 확정하지 않았으면 판을 그대로 둔다. 화면만 닫으면 치른 횟수가 조용히 사라진다.
    } finally {
      this.digging = false;
    }
  }

  /**
   * 잠긴 노드도 여는 유적 미리보기.
   *
   * **공용 팝업 한 장 위에 선다.** 예전에는 씬이 둥근 사각형을 직접 그려 씬 몸통에 얹었다 —
   * 화면 어디서나 같은 문법으로 열리는 쪽지가 이 자리에서만 다른 판이었고, 닫는 길도 판 안의
   * 버튼뿐이라 뒤를 눌러 닫을 수 없었다. 창 높이는 손으로 적지 않고 **보상 줄 수에서 거꾸로**
   * 구한다(`archaeologySitePopupLayout`).
   *
   * **기대 획득은 별이 아니라 다섯 칸 게이지다.** 별 다섯 개가 세 줄이면 열다섯 개가 반짝여
   * 어느 보상이 센지보다 별이 먼저 읽혔다 — 길이와 색은 세지 않아도 견줄 수 있다.
   */
  private openSitePreview(site: ArchaeologySiteDefinition): void {
    const state = this.siteStates.find((entry) => entry.siteId === site.id);
    const layer = findStrataLayer(site.layerId);
    if (!state || !layer) return;
    const rewards: Array<["rawStone" | "rune" | "gold", TextKey]> = [
      ["rawStone", "archaeology.reward.rawStone"], ["rune", "archaeology.reward.rune"], ["gold", "archaeology.reward.gold"],
    ];
    const spot = archaeologySitePopupLayout(rewards.length);
    const coolingUntil = state.cooldownUntil === null ? null : Date.parse(state.cooldownUntil);
    const cooling = coolingUntil !== null && Number.isFinite(coolingUntil) && coolingUntil > Date.now();
    const startable = state.unlocked && !cooling && this.charges > 0;

    this.popups.open({
      width: spot.width, height: spot.height, title: t(site.nameKey as TextKey),
      dim: true, closeOnBackdrop: true, hideCloseButton: true,
    }, (body, close) => {
      body.add(this.add.text(0, spot.subtitleY,
        // 굴착 횟수는 「8/8」이 아니라 이름이 붙은 한 마디여야 한다 — 미리보기에는 아직 쓴
        // 횟수가 없어 같은 수 둘이 마주 보면 무엇을 세는 자리인지 말하지 못한다.
        `${layer.columns}×${layer.rows}  ·  ${t("archaeology.map.digs", { count: layer.digs })}  ·  ${t("archaeology.map.recommended", { level: site.recommendedLevel })}`,
        textStyle({ role: "body", size: 27, color: COLOR.inkDim })).setOrigin(0.5));

      // 기대 획득 판. 제목표가 윗변에 걸터앉는 화면 전체의 문법을 그대로 쓴다.
      const panel = this.add.container(0, spot.panel.y);
      body.add(panel);
      const shape = chipPoints(spot.panel.width, spot.panel.height, { bevel: { topLeft: 40, bottomRight: 40 } });
      panel.add(drawLayer(this, 0, 0, shape, { fill: 0x0b1116, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.6 }));
      addSectionTitle(this, -spot.panel.width / 2 + 26, -spot.panel.height / 2, t("archaeology.reward.expected"), { size: 28, parent: panel });

      rewards.forEach(([kind, key], index) => {
        const rating = rewardExpectationRating(layer, kind);
        const y = spot.rowYs[index] - spot.panel.y;
        panel.add(this.add.text(spot.labelX, y, t(key), textStyle({ role: "emphasis", size: 29 })).setOrigin(0, 0.5));
        /*
         * 게이지는 화면 전체가 쓰는 `HoloBar` 한 장이다 — 칸 넷을 나누는 눈금과 최대치를
         * 두르는 흰 선이 「다섯 중 몇」을 세지 않고 읽히게 한다.
         */
        const bar = new HoloBar(this, spot.gaugeX, y, spot.gauge.width, spot.gauge.height, {
          color: archaeologyRatingColor(rating.filled), trackAlpha: 0.82, outline: true, ticks: 4,
        });
        bar.setValue(rating.filled / 5);
        panel.add([...bar.objects]);
        /*
         * **게이지 하나에 뜻을 맡기지 않는다.** 색과 길이를 읽지 못해도 같은 줄의 글자가
         * 상대 기대도를 그대로 말한다 — 없는 보상과 아주 드문 보상은 애초에 채울 칸이 없어
         * 수 대신 그 사실을 적는다.
         */
        const label = rating.state === "rated"
          ? t("archaeology.reward.grade", { count: rating.filled })
          : t(rating.state === "veryRare" ? "archaeology.reward.veryRare" : "archaeology.reward.unavailable");
        panel.add(this.add.text(spot.gaugeX, y, label,
          textStyle({ role: "emphasis", size: 21, color: COLOR.ink })).setOrigin(0.5).setStroke("#05070a", 5));
      });

      /*
       * 못 들어가는 이유는 저마다 다르고 지금 할 일도 그만큼 다르다 — 레벨을 올린다, 옆
       * 유적을 판다, 기다린다, 횟수가 차기를 기다린다. 한 마디로 뭉치지 않는다.
       */
      const reason = cooling
        ? t("archaeology.map.cooling", { time: formatCountdown((coolingUntil ?? 0) - Date.now()) })
        : !state.unlocked
          ? (state.missingLevel > 0
            ? t("archaeology.map.needLevel", { level: site.minimumLevel })
            : t("archaeology.map.needSite", { site: state.missingPrerequisiteIds.map((id) => t(ARCHAEOLOGY_SITES.find((candidate) => candidate.id === id)?.nameKey as TextKey)).join(", ") }))
          : this.charges <= 0 ? t("archaeology.map.noCharge") : t("archaeology.map.available");
      body.add(this.add.text(0, spot.reasonY, reason,
        textStyle({ role: "emphasis", size: 27, color: startable ? COLOR.accentText : COLOR.dangerText })).setOrigin(0.5));

      const closeButton = new Button(this, spot.buttonCenters[0], spot.buttonY, {
        width: spot.buttonWidth, height: spot.buttonHeight, label: t("archaeology.map.close"), onClick: close,
      });
      const start = new Button(this, spot.buttonCenters[1], spot.buttonY, {
        width: spot.buttonWidth, height: spot.buttonHeight, label: t("archaeology.map.start"), variant: "primary",
        onClick: () => {
          if (!startable) return;
          close();
          void gameApi.startStrataRun({ siteId: site.id, requestId: `strata-${Date.now()}` })
            .then((response) => { this.applyArchaeologyState(response); this.paintView(); })
            // 서버가 거절한 시작은 화면이 판을 지어내지 않는다. 지금 상태를 다시 받아 그린다.
            .catch(() => void this.refresh());
        },
      });
      start.setEnabled(startable);
      body.add([closeButton, start]);
    });
  }

  /** 서버 처리와 충돌 프레임을 병렬로 기다리고 성공한 결과 칸만 제자리에서 교체한다. */
  private async dig(index: number): Promise<void> {
    if (this.digging) return;
    this.digging = true;
    // 투명 입력면까지 모두 꺼야 빠른 멀티 터치가 다른 칸의 pointerup으로 확정되지 않는다.
    this.strataTiles.forEach((tile) => tile.list.forEach((child) => {
      if (child instanceof Phaser.GameObjects.Rectangle && child.input) child.disableInteractive();
    }));
    const board = this.board;
    if (board === null || this.strataGrid === null) { this.digging = false; return; }
    const frame = strataBoardFrame(board.columns, board.rows, BASE_WIDTH);
    const center = strataTileCenter(index, board.columns, frame);
    const effect = new StrataDigEffect(this, frame.centerX + center.x, frame.centerY + center.y,
      Math.min(frame.cellWidth, frame.cellHeight));
    this.digEffects.add(effect);
    const playback = effect.play();
    this.digRequests += 1; this.publishDigDebug();
    const request = gameApi.digStrataTile({ tileIndex: index, requestId: `dig-${Date.now()}` });
    try {
      const [result] = await Promise.all([request, playback.impact]);
      /*
       * **판이 닫히기 전에 이번 판의 영수증을 먼저 만든다.** 서버는 마지막 굴착과 동시에 판을
       * 닫아 `result.board`를 비우므로, 그 뒤에 읽으면 한 판에서 무엇을 캤는지 말할 자리가
       * 통째로 사라진다. 보상은 이미 지급됐고 팝업은 그 사실만 확인시킨다.
       */
      const completedBoard = {
        ...board,
        // 응답이 판을 닫아도 총 횟수는 직전 공개 모델이 소유하므로 마지막 0/max를 그릴 수 있다.
        digsMax: result.board?.digsMax ?? board.digsMax,
        digsLeft: result.board?.digsLeft ?? 0,
        tiles: board.tiles.map((tile) => tile.index === result.tile.index
          ? { ...tile, revealed: true, kind: result.tile.kind, amount: result.tile.amount }
          : tile),
      } satisfies StrataBoardView;
      this.applyArchaeologyState(result);
      if (result.board === null) {
        /*
         * 마지막 충돌에도 판을 곧바로 치우지 않는다. 선택 칸, 0/총 횟수, 최종 영수증을 먼저
         * 반영하고 곡괭이가 퇴장한 뒤 짧게 머물러 최종 보상을 눈으로 확인하게 한다.
         */
        this.replaceStrataTile(index, completedBoard);
        this.paintStrataProgress(completedBoard);
        this.paintStrataHaul(completedBoard);
        await playback.finished;
        await this.waitForFinalBoardConfirmation();
        this.paintView();
        const items: RewardPopupItem[] = strataBoardHaul(completedBoard).flatMap(({ kind, amount }) => {
          const icon = rewardTexture(kind);
          return icon === null ? [] : [{ icon, amount }];
        });
        openRewardPopup(this, this.popups, { items });
      } else {
        this.replaceStrataTile(index, result.board);
        this.paintStrataProgress(result.board);
        // **판 아래 영수증도 함께 자란다.** 칸 하나만 갈아 끼우면 그 줄이 직전 판에서 멈춘다.
        this.paintStrataHaul(result.board);
      }
      this.publishDigDebug(index);
    } catch {
      // 실패는 서버가 확정하지 않은 상태다. 흙을 그대로 두고 입력만 되돌린다.
    } finally {
      /*
       * **퇴장을 기다리지 않고 손을 돌려준다.**
       *
       * 예전에는 여기서 `playback.finished`를 기다렸다 — 결과는 이미 판에 서 있는데 곡괭이가
       * 화면 밖으로 날아가 사라질 때까지 다음 칸을 누를 수 없어, 여덟 번짜리 한 판에서 그
       * 기다림만 8초였다. 연출은 제 수명을 스스로 끝내고 씬은 그때 목록에서만 지운다.
       */
      void playback.finished.then(() => this.digEffects.delete(effect));
      this.digging = false;
      this.restoreStrataInputs();
      this.publishDigDebug();
    }
  }

  /**
   * 판 아래 빈 띠에 지금까지 캔 결과를 액자 영수증으로 세운다.
   *
   * **제 컨테이너를 갖는다** — 한 칸만 갈아 끼우는 굴착에서도 이 줄은 다시 그려야 하는데,
   * 씬이나 몸통에 직접 얹으면 지울 방법이 없어 판을 팔 때마다 액자가 겹쳐 쌓인다.
   */
  private paintStrataHaul(board: StrataBoardView): void {
    this.strataHaul?.destroy(true);
    const frame = strataBoardFrame(board.columns, board.rows, BASE_WIDTH);
    const row = this.add.container(0, 0);
    this.strataHaul = row;
    this.view.add(row);
    const haul = strataBoardHaul(board);
    /*
     * **액자를 키우고 판 밑변이 아니라 고정된 자리에 세운다.**
     *
     * 84px짜리가 판 바로 아래에 붙어 있던 때는, 이 판에서 무엇을 캤는지가 격자의 덤처럼
     * 읽혔고 판 크기(5×5·6×5·6×6)가 바뀔 때마다 그 줄의 높이도 함께 움직였다. 지금 자리는
     * 판과 무관한 아래 띠라, 어느 유적에 들어가도 같은 자리에서 같은 크기로 자란다.
     */
    haul.forEach(({ kind, amount }, index) => {
      const texture = rewardTexture(kind);
      if (texture === null) return;
      const x = frame.centerX - ((haul.length - 1) * ARCHAEOLOGY.haul.gap) / 2 + index * ARCHAEOLOGY.haul.gap;
      addFramedIcon(this, row, x, ARCHAEOLOGY.haul.y, ARCHAEOLOGY.haul.frame, texture, { amount: String(amount), plain: true });
    });
  }

  /** 서버가 돌려준 결과 중 선택한 칸만 기존 컨테이너 안에서 교체한다. */
  private replaceStrataTile(index: number, board: StrataBoardView): void {
    const frame = strataBoardFrame(board.columns, board.rows, BASE_WIDTH);
    this.paintStrataTile(index, board, coverSourceCrop(STRATA_ART.width, STRATA_ART.height, frame.width, frame.height));
  }

  /** 곡괭이 옆의 짧은 진행 표기만 서버 공개 모델의 남은/총 횟수로 갱신한다. */
  private paintStrataProgress(board: StrataBoardView): void {
    this.strataDigsText?.setText(t("archaeology.digsCount", { current: board.digsLeft, max: board.digsMax }));
  }

  /** 마지막 곡괭이가 사라진 뒤 최종 판을 읽을 수 있게 보장하는 짧은 정지다. */
  private waitForFinalBoardConfirmation(): Promise<void> {
    // 연출 자체가 절반 아래로 짧아졌으므로 그 뒤의 정지도 함께 줄인다 — 판은 이미 다 서 있고,
    // 이 정지는 「마지막 한 칸을 눈으로 확인하는」 한 박자일 뿐이다.
    const delay = session.settings.accessibility.reduceMotion ? 120 : 280;
    return new Promise((resolve) => { this.time.delayedCall(delay, resolve); });
  }

  /** 성공·실패 뒤 현재도 팔 수 있는 모든 칸에만 입력을 되돌린다. */
  private restoreStrataInputs(): void {
    const board = this.board;
    if (!board || board.digsLeft <= 0) return;
    board.tiles.forEach((tile) => {
      if (tile.revealed) return;
      const hit = this.strataTiles.get(tile.index)?.list.find((child) => child instanceof Phaser.GameObjects.Rectangle);
      if (hit instanceof Phaser.GameObjects.Rectangle) hit.setInteractive({ useHandCursor: true });
    });
  }

  /** 테스트에는 보상 내용 없이 실제 입력점과 공개 순서만 게시한다. */
  private publishDigDebug(impactIndex?: number): void {
    const board = this.board;
    if (!board) { setDebugArchaeologyDig(undefined); return; }
    const frame = strataBoardFrame(board.columns, board.rows, BASE_WIDTH);
    setDebugArchaeologyDig({ requests: this.digRequests, active: this.digging, impactIndex,
      revealedIndices: board.tiles.filter((tile) => tile.revealed).map((tile) => tile.index),
      tiles: board.tiles.filter((tile) => !tile.revealed).map((tile) => {
        const point = strataTileCenter(tile.index, board.columns, frame);
        return { index: tile.index, x: frame.centerX + point.x, y: frame.centerY + point.y };
      }) });
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
