import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { gameApi } from "../api/FakeServer";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { setDebugArchaeologyDig, setDebugArchaeologyMap, setDebugScene, setDebugStorefrontControls } from "../debug";
import { strataBoardHaul, strataHaulKey, type StrataBoardView, type StrataHaulEntry } from "../core/strataDig";
import { composeStrataFog, strataFogFields } from "../core/strataFog";
import { strataLegend } from "../core/strataLegend";
import { motionPolicy } from "../core/settings";
import { findStrataLayer } from "../data/strataLayers";
import { ARCHAEOLOGY_SITES, type ArchaeologySiteDefinition } from "../data/archaeologySites";
import { resolveArchaeologyFocusSite, rewardExpectationRating } from "../core/archaeologyMap";
import { archaeologySitePopupLayout } from "../ui/archaeologySitePopupLayout";
import { archaeologyRatingColor, STRATA_FOG_TONE } from "../ui/strataTones";
import { ArchaeologyMapView } from "../ui/ArchaeologyMapView";
import { session } from "../state/session";
import { canGrantRuneTraitAtLeast, canUpgradeRuneTraitGrade, RUNE_TRAIT_RULES } from "../core/runeTraits";
import { RUNE_TRAIT_ITEMS } from "../data/runeTraits";
import type { RuneInstance, RunePart, RuneRarity } from "../core/runes";
import { addResearchBench, type ResearchBenchAction } from "../ui/ResearchBench";
import { addSceneBackground, BACKGROUND, useBackgroundTexture } from "../ui/backgrounds";
import { BottomNav } from "../ui/BottomNav";
import { addRatesLink, addSideShopButton, SIDE_SHOP } from "../ui/sideShop";
import { Button } from "../ui/Button";
import { addCategoryTab } from "../ui/CategoryTab";
import { CURRENCY_ICON_BY_WALLET } from "../ui/currencyIcons";
import { runeTexture } from "../ui/runeIcons";
import { chipPoints, drawFrameVignette, drawLayer, drawVignette, HOLO, HoloBar } from "../ui/holo";
import { addSectionTitle } from "../ui/SectionTitle";
import { addFramedIcon } from "../ui/itemFrame";
import { KeywordManager } from "../managers/KeywordManager";
import { PopupLayer } from "../ui/PopupLayer";
import { openRuneTraitReroll } from "../ui/RuneTraitPopup";
import { openRuneTraitOdds } from "../ui/RuneTraitOddsPopup";
import { coverSourceCrop, STRATA_ART, STRATA_BOARD, STRATA_LEGEND, strataBoardFrame, strataCropPlacement, strataHaulLayout, strataLayerTextureKey, strataLegendFrame, strataTileCenter, strataTileCrop, type ScreenRect, type SourceCropRect, type StrataBoardFrame } from "../ui/strataBoardLayout";
import { StrataRewardPop } from "../ui/StrataRewardPop";
import { STRATA_REWARD_POP, strataRewardTier } from "../ui/strataRewardPopStyle";
import { addRuneFrame } from "../ui/runeIcons";
import { openRuneInfoPopup } from "../ui/RunePopup";
import { findItem } from "../data/items";
import { pressIn, pressOut } from "../ui/pressFeedback";
import { UI_ICON } from "../ui/icons";
import { TopBar } from "../ui/TopBar";
import { bindCurrencyGuide, openCurrencyGuide } from "../ui/currencyGuideEntry";
import { COLOR, textStyle } from "../ui/theme";
import { openRewardPopup, type RewardPopupItem } from "../ui/RewardPopup";
import { StrataDigEffect } from "../ui/StrataDigEffect";
import type { ArchaeologyStateResponse } from "../api/contracts";
import { formatCountdown } from "../core/formatCountdown";
import { archaeologyProgressManager } from "../managers/ArchaeologyProgressManager";
import { playSceneEntrance, startScene, slideTabPage } from "../ui/screenTransition";

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
   * 확률 정보 — 제목 바로 아래의 **작고 흐린 글줄**이다(연구소와 같은 한 벌, `addRatesLink`).
   *
   * 황금빛 아이콘 칩으로 제목 줄 오른쪽에 세우던 때는 이 화면에서 가장 눈에 띄는 조작이 확률
   * 정보였다 — 누르면 열리는 정보일 뿐 고르는 조작이 아니다. 상점은 그 자리를 떠나 연구소의
   * 마일리지 상점과 **같은 자리·같은 아이콘 칩**(`SIDE_SHOP.screen`)에 선다.
   */
  rates: { x: 58, y: 262 },
  /**
   * 횟수 판.
   *
   * **수만 서 있던 자리를 이름표가 붙은 판이 감싼다.** 지도 위에 `5/5`만 떠 있던 때는 그 수가
   * 무엇의 수인지 화면이 말하지 않아, 스테미나인지 남은 발굴인지 눌러 보고 알아야 했다.
   * 판 하나에 곡괭이·이름표·수·다음 충전을 함께 세우면 한 덩어리로 읽힌다.
   */
  chargePanel: { y: 352, width: 620, height: 126, icon: 58 },
  /** 진행 중인 판 위에 서는 남은 발굴 횟수 판. 같은 양식을 조금 줄여 쓴다. */
  digsPanel: { y: 292, width: 620, height: 96, icon: 50 },
  /** 판 아래 전리품 줄과 그 아래 중간 종료. 둘 다 판 크기와 무관하게 같은 자리에 선다. */
  haul: { y: 1382, frame: 116, gap: 152 },
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

/**
 * 안개 밭을 굽는 해상도(칸 하나가 차지하는 픽셀)와 훑는 빛띠의 굵기.
 *
 * 밭이 작아도 화면에서는 늘려 그리므로 선형 보간이 가장자리를 한 번 더 풀어 준다.
 */
const FOG = { resolution: 20, sweepBand: 150, sweepKey: "strata-sweep" } as const;

/** 두 겹의 안개가 경계를 서로 다르게 비튼다. 겹쳐 엇갈리는 동안 경계가 일렁인다. */
const FOG_WARP = [
  { amplitude: 0.16, frequency: 1.7, phase: 0 },
  { amplitude: 0.24, frequency: 2.4, phase: 2.1 },
] as const;

/**
 * 보상 종류를 액자에 세울 그림 키로 바꾼다. 화면이 종류마다 그림을 따로 고르지 않는다.
 *
 * **룬은 원석 그림이 아니라 룬 조각이고, 연구 재료는 실제로 받은 아이템의 그림이다.** 예전에는 룬 칸이
 * 원석 아이콘으로, 연구 재료 칸이 게임에 없는 「룬 가루」 그림으로 서서 무엇이 나왔는지 읽히지 않았다.
 */
function rewardTexture(entry: Pick<StrataHaulEntry, "kind" | "runeRarity" | "itemId">): string | null {
  const { kind } = entry;
  if (kind === "empty") return null;
  if (kind === "rune") return runeTexture(entry.runeRarity ?? "uncommon", 0);
  if (kind === "researchItem") {
    const definition = entry.itemId ? findItem(entry.itemId) : undefined;
    return definition?.icon.kind === "asset" ? definition.icon.key : null;
  }
  return CURRENCY_ICON_BY_WALLET[kind];
}

/** 캔 것의 영수증 한 줄(보상 팝업)로 바꾼다. */
function haulToRewardItems(haul: readonly StrataHaulEntry[]): RewardPopupItem[] {
  return haul.flatMap((entry) => {
    const icon = rewardTexture(entry);
    return icon === null ? [] : [{ icon, amount: entry.amount }];
  });
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
  /**
   * 칸마다의 **입력면**. 칸 컨테이너에서 찾아 쓰지 않고 따로 들고 있는다.
   *
   * 예전에는 `list.find(child instanceof Rectangle)`로 골랐는데, **특화 구역 칸에는 색
   * 사각형이 한 장 더 깔려 있어** 그 자리에서 먼저 걸렸다. 입력을 되돌릴 때 색면에
   * `setInteractive`를 먹이고 진짜 입력면은 꺼진 채 남아, **한 칸을 판 뒤로 특화 구역 칸이
   * 전부 눌리지 않았다** — 색이 없는 흙칸만 계속 파여 「나머지가 안 캐진다」로 보였다.
   */
  private readonly strataHits = new Map<number, Phaser.GameObjects.Rectangle>();
  private strataGrid: Phaser.GameObjects.Container | null = null;
  /** 판 아래 영수증 줄. 한 칸만 갈아 끼우는 굴착에서도 이 줄은 다시 그린다. */
  private strataHaul: Phaser.GameObjects.Container | null = null;
  /** 한 칸 결과마다 판 전체를 다시 만들지 않고 남은/총 굴착 횟수만 고치는 글자다. */
  private strataDigsText: Phaser.GameObjects.Text | null = null;
  /** 남은 굴착 횟수 게이지. 글자와 함께 칸 하나를 팔 때마다 갱신한다. */
  private strataDigsBar: HoloBar | null = null;
  /** 씬 종료 때 네트워크와 독립적으로 남아 있을 수 있는 연출을 모두 정리한다. */
  private readonly digEffects = new Set<StrataDigEffect>();
  /** 캔 보상이 떠올랐다 전리품으로 들어가는 연출. 판이 바뀌거나 씬이 죽으면 걷는다. */
  private readonly pops = new Set<StrataRewardPop>();
  /** 아직 전리품에 닿지 않은 칸. 줄은 닿은 몫만 세운다. */
  private readonly flying = new Set<number>();
  /** 마지막 굴착까지 반영한 판. 날아갈 전리품 칸의 자리를 여기서 구한다. */
  private haulBoard: StrataBoardView | null = null;
  /** 이번 판에서 받은 룬. 전리품의 룬 칸을 누르면 이 중 가장 최근 것의 정보가 열린다. */
  private readonly grantedRunes: Array<{ rarity: RuneRarity; instanceId: string }> = [];
  /** 판 뒤를 눌러 주는 어둠. 판이 없을 때는 투명하다. */
  private boardDim!: Phaser.GameObjects.Rectangle;
  /** 안개 두 겹과 훑는 빛띠. 판을 다시 그릴 때마다 새로 세운다. */
  private fogImages: Phaser.GameObjects.Image[] = [];
  private fogTextures: Phaser.Textures.CanvasTexture[] = [];
  private ambientTweens: Phaser.Tweens.Tween[] = [];
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
    /*
     * **Phaser는 씬 인스턴스를 재사용한다.** 필드 초기값(`= false`)은 게임이 씬을 만들 때 딱
     * 한 번 도는데, 굴착이 도는 중에 화면을 떠나면 이 씬 객체에 `digging = true`가 남을 수
     * 있다 — 돌아온 판은 첫 손짓부터 되돌아가 **아무 칸도 파이지 않는다.** 한 판의 상태는
     * 화면을 열 때마다 되돌린다(상점의 첫 마디가 같은 이유로 재진입부터 사라졌다).
     */
    this.digging = false;
    this.chargeRefreshPending = false;
    addSceneBackground(this, BACKGROUND.archaeology);
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { depth: -20, strength: 0.72 });
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.5).setDepth(-19);
    // 판을 파는 동안에는 뒤를 한 겹 더 눌러 발굴판이 떠오르게 한다. 배경 바로 위, 화면 요소 아래다.
    this.boardDim = this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 1).setDepth(-18).setAlpha(0);
    this.flying.clear(); this.pops.clear(); this.grantedRunes.length = 0; this.haulBoard = null;
    this.fogImages = []; this.fogTextures = []; this.ambientTweens = [];
    this.popups = new PopupLayer(this, 2600);
    this.keywords = new KeywordManager(this, this.popups);
    bindCurrencyGuide({ scene: this, popups: this.popups });
    // 고고학은 제 경제를 갖는다 — 상단 줄도 원석이 첫 칸이다.
    new TopBar(this, 40, {
      currencies: "archaeology",
      onSettings: () => startScene(this, "settings", { returnScene: "archaeology" }),
      onCurrency: (currency) => openCurrencyGuide({ scene: this, popups: this.popups }, currency),
    });

    this.add.text(60, ARCHAEOLOGY.titleY, t("archaeology.title"), textStyle({ role: "display", size: 52 })).setOrigin(0, 0);
    /*
     * 상점은 화면을 통째로 넘기는 입구라 하단 라벨 줄(이 화면의 갈래)에 두지 않는다. 연구소의
     * 마일리지 상점과 같은 자리·같은 아이콘 칩이다(`SIDE_SHOP.screen`) — 같은 상점 씬을 상품표만
     * 바꿔 다시 쓴다(새 씬을 만들면 선반·격자·값줄 규칙이 두 곳이 된다).
     */
    const shopSlot = SIDE_SHOP.screen;
    addSideShopButton(this, shopSlot.x, shopSlot.y, shopSlot.size, t("archaeology.shop"),
      () => startScene(this, "shop", { storefront: "archaeology", returnScene: "archaeology" }));
    // 자동화도 런타임과 같은 고정 버튼을 누르도록 최소 입력 중심만 공개한다.
    setDebugStorefrontControls({ archaeology: { shop: { x: shopSlot.x, y: shopSlot.y } } });
    // **누른 자리에 붙이지 않는다** — 표 두 장이 든 큰 판이라 위로 붙이면 제목·횟수 줄을 덮는다.
    // 한동안 머무는 판은 화면 가운데에 서고 우하단 뒤로가기로 닫는다.
    addRatesLink(this, ARCHAEOLOGY.rates.x, ARCHAEOLOGY.rates.y, t("rune.trait.odds"), () => openRuneTraitOdds({ scene: this, popups: this.popups }));

    this.view = this.add.container(0, 0);
    this.tabRow = this.add.container(0, 0);
    // Phaser 시계에 묶어 탭이 백그라운드에 있는 동안 불필요한 브라우저 interval을 남기지 않는다.
    this.chargeTimer = this.time.addEvent({ delay: 1000, loop: true, callback: () => this.updateChargeCountdown() });
    this.paintTabs();
    new BottomNav(this, "archaeology");
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.digEffects.forEach((effect) => effect.destroy());
      this.digEffects.clear();
      this.pops.forEach((pop) => pop.destroy()); this.pops.clear(); this.flying.clear();
      this.destroyFog();
      this.chargeTimer?.destroy(); this.chargeTimer = null; this.chargeValueText = null; this.chargeNoteText = null;
      this.strataTiles.clear(); this.strataHits.clear(); this.strataGrid = null; this.strataHaul = null; this.strataDigsText = null; this.strataDigsBar = null; this.digging = false;
      setDebugArchaeologyDig(undefined);
    });
    void this.refresh();
    // 화면이 한 뼘 아래에서 떠오르며 들어온다. 조각마다 트윈을 걸지 않고 카메라 하나를
    // 움직이므로, 이 뒤에 무엇을 더 세워도 함께 지나간다 — 그래서 `create`의 맨 끝이다.
    playSceneEntrance(this);
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
          const from = tabs.findIndex((tab) => tab.key === this.tab);
          this.tab = key;
          this.paintTabs();
          this.paintView();
          slideTabPage(this, [this.view], from, index);
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
    this.strataTiles.clear(); this.strataHits.clear(); this.strataGrid = null; this.strataHaul = null; this.strataDigsText = null; this.strataDigsBar = null;
    // 떠 있던 보상은 이 판의 것이다 — 판이 바뀌면 함께 걷는다(닿을 전리품 칸도 사라진다).
    this.pops.forEach((pop) => pop.destroy()); this.pops.clear(); this.flying.clear();
    this.destroyFog();
    this.view.removeAll(true);
    this.chargeValueText = null; this.chargeNoteText = null;
    setDebugArchaeologyMap(undefined);
    if (this.tab === "strata") this.paintStrata();
    else this.paintResearch();
    this.setBoardDim(this.tab === "strata" && this.board !== null);
  }

  /** 판이 있을 때만 뒤를 눌러 둔다. 움직임 줄이기에서는 곧바로 바뀐다. */
  private setBoardDim(on: boolean): void {
    const target = on ? 0.46 : 0;
    this.tweens.killTweensOf(this.boardDim);
    if (session.settings.accessibility.reduceMotion || this.boardDim.alpha === target) { this.boardDim.setAlpha(target); return; }
    this.tweens.add({ targets: this.boardDim, alpha: target, duration: 260, ease: "Quad.Out" });
  }

  /* ── 지층 탐사 ────────────────────────────────────────────────────────────── */

  /**
   * 수 하나가 서던 자리를 이름표가 붙은 판으로 감싼다.
   *
   * 유적에 들어가는 횟수는 **입장권**으로 선다. 한 판 안에서 곡괭이를 휘두르는 횟수(게이지)와 같은
   * 곡괭이 그림을 두 번 쓰면 둘이 같은 수처럼 읽힌다.
   */
  private addCountPanel(spot: { y: number; width: number; height: number; icon: number }, label: string, icon: string = UI_ICON.ticket):
  { value: Phaser.GameObjects.Text; note: Phaser.GameObjects.Text } {
    const panel = this.add.container(BASE_WIDTH / 2, spot.y);
    this.view.add(panel);
    const shape = chipPoints(spot.width, spot.height, { bevel: { topLeft: spot.height * 0.34, bottomRight: spot.height * 0.34 } });
    panel.add(drawLayer(this, 0, 0, shape, { fill: 0x0b1116, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.8 }));
    const left = -spot.width / 2;
    panel.add(this.add.image(left + 30 + spot.icon / 2, 0, icon).setDisplaySize(spot.icon, spot.icon));
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
    this.haulBoard = board;
    this.paintBoardStage(frame);
    const grid = this.add.container(frame.centerX, frame.centerY);
    this.strataGrid = grid;
    this.view.add(grid);

    // 그림자 → 금속 외곽 → 홀로그램 안쪽 선 순으로 판의 깊이를 만든다. 모두 입력 타일보다 아래다.
    const shadow = this.add.graphics().fillStyle(COLOR.void, 0.5)
      .fillRoundedRect(-frame.width / 2 + 10, -frame.height / 2 + 18, frame.width, frame.height, 18);
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

    // 구역의 성질은 칸마다 칠하지 않고 판 위에 깔리는 안개로 말한다. 겉장(칸)과 격자선 사이에 낀다.
    this.paintFog(grid, board, frame);

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

    this.paintLegend(board, frame);

    // 남은 굴착은 곡괭이 옆의 게이지다. 유적에 들어오는 입장권과 다른 그림이라 두 수가 갈려 읽힌다.
    this.paintDigsGauge(board);

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
      onClick: () => { if (!this.digging) this.requestFinish(board); },
    });
    this.view.add(this.add.existing(finish));

    this.paintStrataHaul(board);
    this.publishDigDebug();
  }

  /**
   * 발굴판이 서는 무대.
   *
   * **판이 배경 위에 놓인 한 장이 아니라 화면의 주인공이 되도록** 뒤를 한 겹 더 깐다 — 판과 범례를
   * 함께 품는 어두운 유리 판, 네 모서리의 꺽쇠, 판 뒤에서 은은히 번지는 빛이다. 판때기를 두껍게 받치지
   * 않고 유리 한 장과 얇은 윗변선, 모서리 표식만 쓴다(화면 전체의 규칙).
   */
  private paintBoardStage(frame: StrataBoardFrame): void {
    const left = STRATA_BOARD.left - 14; const right = BASE_WIDTH - STRATA_BOARD.left + 14;
    const top = frame.centerY - frame.height / 2 - 22; const bottom = frame.centerY + frame.height / 2 + 22;
    const width = right - left; const height = bottom - top;
    const stage = this.add.container((left + right) / 2, (top + bottom) / 2);
    this.view.add(stage);
    const shape = chipPoints(width, height, { bevel: { topLeft: 46, bottomRight: 46 } });
    stage.add(drawLayer(this, 0, 0, shape, { fill: 0x04070a, alpha: 0.78, edge: COLOR.accent, edgeAlpha: 0.5 }));
    // 판 뒤에서 번지는 빛: 겹쳐 밝아지는 합성이라 아주 옅게만 깐다.
    stage.add(this.add.ellipse(frame.centerX - stage.x, frame.centerY - stage.y, frame.width * 1.2, frame.height * 1.1, COLOR.accent, 0.05)
      .setBlendMode(Phaser.BlendModes.ADD));
    const bracket = this.add.graphics().lineStyle(4, COLOR.accent, 0.72);
    const reach = 40; const inset = 12;
    const corners: ReadonlyArray<readonly [number, number, number, number]> = [
      [-width / 2 + inset, -height / 2 + inset, 1, 1], [width / 2 - inset, -height / 2 + inset, -1, 1],
      [-width / 2 + inset, height / 2 - inset, 1, -1], [width / 2 - inset, height / 2 - inset, -1, -1],
    ];
    for (const [cx, cy, dx, dy] of corners) {
      bracket.moveTo(cx + dx * reach, cy).lineTo(cx, cy).lineTo(cx, cy + dy * reach);
    }
    bracket.strokePath();
    stage.add(bracket);
  }

  /**
   * 아직 캐지 않은 땅 위의 안개.
   *
   * 구역의 색을 칸마다 칠하면 색 타일이 된다. 안개는 **구역 하나를 한 덩어리로** 덮고 가장자리가
   * 이웃과 스며든다 — 레이더에 잡힌 불특정한 영역처럼 어디까지가 그 구역인지는 대략만 읽힌다.
   * 서로 다른 경계를 그린 두 겹이 천천히 엇갈려 일렁이고, 그 위로 얇은 빛띠가 판을 훑는다.
   * 판 밖으로 번지지 않도록 크기를 키우거나 옮기지 않고 **진하기만** 움직인다(마스크가 컨테이너
   * 이동을 물려받지 않아 판 밖을 자를 수 없다).
   */
  private paintFog(grid: Phaser.GameObjects.Container, board: StrataBoardView, frame: StrataBoardFrame): void {
    this.destroyFog();
    const width = board.columns * FOG.resolution; const height = board.rows * FOG.resolution;
    const calm = motionPolicy(session.settings).nonEssentialRepeatFactor === 0;
    FOG_WARP.forEach((_, variant) => {
      const key = `strata-fog-${variant}`;
      if (this.textures.exists(key)) this.textures.remove(key);
      const texture = this.textures.createCanvas(key, width, height);
      if (texture === null) return;
      this.fogTextures.push(texture);
      const image = this.add.image(0, 0, key).setDisplaySize(frame.width, frame.height).setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(variant === 0 ? 1 : calm ? 0.45 : 0.2);
      grid.add(image);
      this.fogImages.push(image);
    });
    this.bakeFog(board);
    if (calm) return;
    const [first, second] = this.fogImages;
    if (first) this.ambientTweens.push(this.tweens.add({ targets: first, alpha: 0.38, duration: 2600, yoyo: true, repeat: -1, ease: "Sine.InOut" }));
    if (second) this.ambientTweens.push(this.tweens.add({ targets: second, alpha: 0.95, duration: 3300, yoyo: true, repeat: -1, ease: "Sine.InOut", delay: 400 }));

    // 훑는 빛띠: 위에서 아래로 천천히 지나간다. 양 끝에서는 투명해 판 밖으로 번져 보이지 않는다.
    if (!this.textures.exists(FOG.sweepKey)) {
      const sweep = this.textures.createCanvas(FOG.sweepKey, 4, 128);
      const context = sweep?.getContext();
      if (sweep && context) {
        const gradient = context.createLinearGradient(0, 0, 0, 128);
        gradient.addColorStop(0, "rgba(255,255,255,0)"); gradient.addColorStop(0.5, "rgba(255,255,255,0.9)"); gradient.addColorStop(1, "rgba(255,255,255,0)");
        context.fillStyle = gradient; context.fillRect(0, 0, 4, 128);
        sweep.refresh();
      }
    }
    if (!this.textures.exists(FOG.sweepKey)) return;
    const band = this.add.image(0, 0, FOG.sweepKey).setDisplaySize(frame.width, FOG.sweepBand)
      .setBlendMode(Phaser.BlendModes.ADD).setTint(0xbdf3ff).setAlpha(0);
    grid.add(band);
    this.fogImages.push(band);
    this.ambientTweens.push(this.tweens.addCounter({
      from: 0, to: 1, duration: 4600, repeat: -1, repeatDelay: 1400,
      onUpdate: (counter) => {
        const progress = counter.getValue() ?? 0;
        band.setY(-frame.height / 2 - FOG.sweepBand / 2 + progress * (frame.height + FOG.sweepBand));
        band.setAlpha(0.2 * Math.sin(Math.PI * progress));
      },
    }));
  }

  /** 안개 밭을 지금 판 상태로 다시 굽는다. 칸을 팔 때마다 판 자리의 안개가 걷힌다. */
  private bakeFog(board: StrataBoardView): void {
    const tones = board.tiles.map((tile) => board.zones[tile.zone]?.tone ?? "soil");
    const revealed = board.tiles.map((tile) => tile.revealed);
    this.fogTextures.forEach((texture, variant) => {
      const context = texture.getContext();
      if (!context) return;
      const fog = strataFogFields({ columns: board.columns, rows: board.rows, toneOfTile: tones, revealed, resolution: FOG.resolution, warp: FOG_WARP[variant] });
      const pixels = composeStrataFog(fog, STRATA_FOG_TONE);
      context.putImageData(new ImageData(new Uint8ClampedArray(pixels), fog.width, fog.height), 0, 0);
      texture.refresh();
    });
  }

  /** 안개 텍스처와 그 움직임을 걷는다. 판을 다시 그리거나 씬이 죽을 때 부른다. */
  private destroyFog(): void {
    this.ambientTweens.forEach((tween) => tween.stop()); this.ambientTweens = [];
    this.fogImages = [];
    for (const texture of this.fogTextures) { if (this.textures.exists(texture.key)) this.textures.remove(texture.key); }
    this.fogTextures = [];
  }

  /**
   * 판 오른쪽의 범례. **어떤 색이 무엇이 나오기 쉬운 자리인지** 그림으로 말한다.
   *
   * 확률은 숫자로 적지 않는다 — 색마다 유난히 잘 나오는 것만 뽑아 아이콘으로 세운다
   * (`strataLegend`). 흙빛(안개 없음)은 가장 흔한 것을 보여 준다.
   */
  private paintLegend(board: StrataBoardView, frame: StrataBoardFrame): void {
    const layer = findStrataLayer(board.layerId);
    if (layer === undefined) return;
    const rows = strataLegend(layer, board.zones.map((zone) => zone.tone));
    const spot = strataLegendFrame(frame, rows.length, BASE_WIDTH);
    const panel = this.add.container(0, 0);
    this.view.add(panel);
    const shape = chipPoints(spot.width, spot.height, { bevel: { topLeft: 30, bottomRight: 30 } });
    panel.add(drawLayer(this, spot.centerX, spot.top + spot.height / 2, shape, { fill: 0x0b1116, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.55 }));
    panel.add(this.add.text(spot.centerX, spot.top + STRATA_LEGEND.titleHeight / 2 + 2, t("archaeology.legend.title"),
      textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0.5));
    rows.forEach((row, index) => {
      const top = spot.rowTops[index];
      if (index > 0) panel.add(this.add.rectangle(spot.centerX, top, spot.width - 36, 2, COLOR.accent, 0.18));
      // 견본: 안개 한 덩어리를 작게 — 겹겹이 옅게 깔아 가장자리가 번지게 한다. 흙빛은 안개가 없어 맨 흙색이다.
      const tone = STRATA_FOG_TONE[row.tone];
      const swatch = this.add.graphics({ x: spot.centerX, y: top + 34 });
      const size = STRATA_LEGEND.swatch;
      const blob = (scale: number, alpha: number, color: number): void => {
        swatch.fillStyle(color, alpha);
        swatch.fillPoints([
          new Phaser.Geom.Point(-size * scale * 0.62, 0), new Phaser.Geom.Point(-size * scale * 0.1, -size * scale * 0.5),
          new Phaser.Geom.Point(size * scale * 0.62, -size * scale * 0.05), new Phaser.Geom.Point(size * scale * 0.12, size * scale * 0.5),
        ], true);
      };
      if (row.tone === "soil") blob(0.9, 0.7, COLOR.archaeologySoil);
      else { blob(1.5, 0.12, tone.color); blob(1.2, 0.2, tone.color); blob(0.9, 0.5, tone.color); }
      panel.add(swatch);
      const iconY = top + 34 + size / 2 + 12 + STRATA_LEGEND.icon / 2;
      const gap = 4;
      const total = row.kinds.length * STRATA_LEGEND.icon + Math.max(0, row.kinds.length - 1) * gap;
      row.kinds.forEach((kind, i) => {
        const x = spot.centerX - total / 2 + STRATA_LEGEND.icon / 2 + i * (STRATA_LEGEND.icon + gap);
        if (kind === "rune") { panel.add(addRuneFrame(this, x, iconY, STRATA_LEGEND.icon, "rare", 1)); return; }
        const texture = kind === "researchItem" ? "item-ancient-core" : rewardTexture({ kind });
        if (texture !== null) addFramedIcon(this, panel, x, iconY, STRATA_LEGEND.icon, texture, {});
      });
    });
  }

  /** 남은 굴착 횟수: 곡괭이 + 게이지 + `남은/전체`. 칸 하나를 팔 때마다 `paintStrataProgress`가 채운다. */
  private paintDigsGauge(board: StrataBoardView): void {
    const spot = ARCHAEOLOGY.digsPanel;
    const panel = this.add.container(BASE_WIDTH / 2, spot.y);
    this.view.add(panel);
    const shape = chipPoints(spot.width, spot.height, { bevel: { topLeft: spot.height * 0.34, bottomRight: spot.height * 0.34 } });
    panel.add(drawLayer(this, 0, 0, shape, { fill: 0x0b1116, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.8 }));
    const left = -spot.width / 2;
    panel.add(this.add.image(left + 34 + spot.icon / 2, 0, UI_ICON.pickaxe).setDisplaySize(spot.icon, spot.icon));
    const barX = left + 34 + spot.icon + 24;
    const barWidth = spot.width - (barX - left) - 150;
    panel.add(this.add.text(barX, -spot.height * 0.3, t("archaeology.digs.label"),
      textStyle({ role: "emphasis", size: 20, color: COLOR.inkDim })).setOrigin(0, 0.5));
    const bar = new HoloBar(this, barX + barWidth / 2, spot.height * 0.12, barWidth, 24, {
      color: COLOR.accent, trackAlpha: 0.85, outline: true, ticks: Math.max(0, board.digsMax - 1),
    });
    panel.add([...bar.objects]);
    this.strataDigsBar = bar;
    this.strataDigsText = this.add.text(spot.width / 2 - 30, spot.height * 0.08, "",
      textStyle({ role: "display", size: 38, color: COLOR.accentText })).setOrigin(1, 0.5);
    panel.add(this.strataDigsText);
    this.paintStrataProgress(board);
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
    // 자식을 통째로 버렸으므로 옛 입력면도 함께 잊는다 — 남겨 두면 죽은 객체를 되살리려 든다.
    this.strataHits.delete(index);
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
    if (tile.revealed) {
      // 판 자리는 맨땅만 남는다. 캔 보상은 잠깐 떠올랐다가 전리품으로 들어가므로(`StrataRewardPop`)
      // 칸에 그대로 남기지 않는다 — 판에도 남고 전리품에도 있으면 어디에 있는 것인지 애매했다.
      tileView.add(this.add.rectangle(center.x, center.y, frame.cellWidth, frame.cellHeight, COLOR.void, 0.24));
      return;
    }
    const hit = this.add.rectangle(center.x, center.y, frame.cellWidth, frame.cellHeight, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerup", () => this.dig(index));
    tileView.add(hit);
    this.strataHits.set(index, hit);
  }

  /** 남은 횟수를 버리고 판을 닫는다. 이미 캔 것은 그대로 남으므로 영수증만 한 장 띄운다. */
  /**
   * 굴착이 남아 있으면 한 번 묻는다 — 판을 여는 데 이미 횟수를 치렀고 남은 굴착은 돌아오지 않는다.
   * 다 판 판은 묻지 않고 곧바로 닫는다(버릴 것이 없다).
   */
  private requestFinish(board: StrataBoardView): void {
    if (board.digsLeft <= 0) { void this.finishRun(board); return; }
    this.popups.confirm({
      title: t("archaeology.finish"),
      message: t("archaeology.finishMessage", { count: board.digsLeft }),
      confirmLabel: t("archaeology.finish"),
      destructive: true,
    }, () => { if (!this.digging) void this.finishRun(board); });
  }

  private async finishRun(board: StrataBoardView): Promise<void> {
    this.digging = true;
    try {
      const response = await gameApi.abandonStrataRun({ requestId: `strata-finish-${Date.now()}` });
      this.applyArchaeologyState(response);
      this.paintView();
      const items = haulToRewardItems(strataBoardHaul(board));
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
       * 못 들어가는 이유는 저마다 다르고 지금 할 일도 그만큼 다르다 — 레벨을 올린다,
       * 기다린다, 횟수가 차기를 기다린다. 한 마디로 뭉치지 않는다.
       */
      const reason = cooling
        ? t("archaeology.map.cooling", { time: formatCountdown((coolingUntil ?? 0) - Date.now()) })
        : !state.unlocked ? t("archaeology.map.needLevel", { level: site.minimumLevel })
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
    this.strataHits.forEach((hit) => { if (hit.input) hit.disableInteractive(); });
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
        // 내용은 이 응답이 확정한 칸을 덧붙여 받는다. 서버가 판을 닫아도 지금까지 캔 것은 그대로 쌓인다.
        tiles: (result.board?.tiles ?? board.tiles).map((tile) => tile.index === result.tile.index
          ? {
            ...tile, revealed: true, kind: result.tile.kind, amount: result.tile.amount,
            ...(result.tile.runeRarity ? { runeRarity: result.tile.runeRarity } : {}),
            ...(result.tile.runePart !== undefined && result.tile.kind === "rune" ? { runePart: result.tile.runePart } : {}),
            ...(result.tile.itemId ? { itemId: result.tile.itemId } : {}),
          }
          : tile),
      } satisfies StrataBoardView;
      this.applyArchaeologyState(result);
      if (result.grantedRune) this.grantedRunes.push({ rarity: result.grantedRune.rarity, instanceId: result.grantedRune.instanceId });
      this.haulBoard = completedBoard;
      const shown = result.board ?? completedBoard;
      this.replaceStrataTile(index, completedBoard);
      this.bakeFog(completedBoard);
      this.paintStrataProgress(shown);
      // 캔 보상은 판에 남기지 않고 잠깐 떠올렸다가 전리품 칸으로 들여보낸다. 줄은 닿은 몫만 센다.
      this.startRewardPop(index, completedBoard, frame);
      this.paintStrataHaul(completedBoard);
      if (result.board === null) {
        /*
         * 마지막 충돌에도 판을 곧바로 치우지 않는다. 곡괭이가 물러나고 마지막 보상이 전리품에
         * 들어간 뒤에 판을 치워 최종 보상을 눈으로 확인하게 한다.
         */
        await playback.finished;
        await Promise.all([...this.pops].map((pop) => pop.done));
        if (!this.scene.isActive()) return;
        this.paintView();
        openRewardPopup(this, this.popups, { items: haulToRewardItems(strataBoardHaul(completedBoard)) });
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

  /** 이 칸의 결과를 담은 전리품 칸의 열쇠. 캘 수 없는 예전 빈 칸은 없다. */
  private startRewardPop(index: number, board: StrataBoardView, frame: StrataBoardFrame): void {
    const tile = board.tiles[index];
    if (tile === undefined || tile.kind === undefined || tile.kind === "empty") return;
    const entry: StrataHaulEntry = {
      kind: tile.kind, amount: tile.amount ?? 0,
      ...(tile.runePart !== undefined ? { runePart: tile.runePart } : {}),
      ...(tile.runeRarity ? { runeRarity: tile.runeRarity } : {}), ...(tile.itemId ? { itemId: tile.itemId } : {}),
    };
    const key = strataHaulKey(entry);
    const center = strataTileCenter(index, board.columns, frame);
    const cell = Math.min(frame.cellWidth, frame.cellHeight);
    this.flying.add(index);
    const pop = new StrataRewardPop(this, {
      x: frame.centerX + center.x, y: frame.centerY + center.y,
      size: Math.round(cell * STRATA_REWARD_POP.sizeRatio),
      tier: strataRewardTier({ kind: tile.kind, runeRarity: tile.runeRarity, itemId: tile.itemId }),
      buildFrame: (size) => this.buildRewardFrame(entry, size, tile.runePart),
      target: () => this.haulTarget(key),
      onLand: () => {
        this.flying.delete(index);
        if (this.strataHaul?.active && this.haulBoard) this.paintStrataHaul(this.haulBoard);
      },
    });
    this.pops.add(pop);
    void pop.play().finally(() => { this.pops.delete(pop); this.flying.delete(index); });
  }

  /** 떠오르는 보상의 액자 한 장. 룬은 실제 조각과 등급색, 그 밖의 것은 공용 액자다. */
  private buildRewardFrame(entry: StrataHaulEntry, size: number, part?: RunePart, showAmount = true): Phaser.GameObjects.Container {
    if (entry.kind === "rune") return addRuneFrame(this, 0, 0, size, entry.runeRarity ?? "uncommon", part ?? 0);
    const texture = rewardTexture(entry) ?? "";
    return addFramedIcon(this, undefined, 0, 0, size, texture, { plain: true, ...(showAmount ? { amount: String(entry.amount) } : {}) });
  }

  /** 날아가 닿을 전리품 칸의 화면 중심과 크기. 이미 줄이 바뀌었으면 마지막 칸으로 떨어진다. */
  private haulTarget(key: string): { x: number; y: number; size: number } {
    const haul = this.haulBoard === null ? [] : strataBoardHaul(this.haulBoard);
    const layout = strataHaulLayout(haul.length, BASE_WIDTH, { frame: ARCHAEOLOGY.haul.frame, gap: ARCHAEOLOGY.haul.gap });
    const found = haul.findIndex((entry) => strataHaulKey(entry) === key);
    const at = found >= 0 ? found : Math.max(0, haul.length - 1);
    return { x: layout.xs[at] ?? BASE_WIDTH / 2, y: ARCHAEOLOGY.haul.y, size: layout.frame };
  }

  /**
   * 판 아래 빈 띠에 지금까지 캔 결과를 액자 영수증으로 세운다.
   *
   * **제 컨테이너를 갖는다** — 한 칸만 갈아 끼우는 굴착에서도 이 줄은 다시 그려야 하는데,
   * 씬이나 몸통에 직접 얹으면 지울 방법이 없어 판을 팔 때마다 액자가 겹쳐 쌓인다.
   *
   * **자리는 떠오른 보상까지 센 전체로 정하고, 그려 넣는 것은 닿은 몫뿐이다** — 날아오는 중인 칸이
   * 늘 때마다 줄이 옆으로 밀리면 날아가는 액자가 닿을 자리를 잃는다. 판 밑변이 아니라 고정된 자리라
   * 어느 유적에 들어가도 같은 자리에서 같은 크기로 자란다. **칸을 누르면 그 재화·아이템의 안내창이
   * 열린다**(룬은 이번 판에서 받은 가장 최근 것의 정보).
   */
  private paintStrataHaul(board: StrataBoardView): void {
    this.strataHaul?.destroy(true);
    const row = this.add.container(0, 0);
    this.strataHaul = row;
    this.view.add(row);
    const full = strataBoardHaul(board);
    const landed = new Map(strataBoardHaul({ ...board, tiles: board.tiles.filter((tile) => !this.flying.has(tile.index)) })
      .map((entry) => [strataHaulKey(entry), entry] as const));
    const layout = strataHaulLayout(full.length, BASE_WIDTH, { frame: ARCHAEOLOGY.haul.frame, gap: ARCHAEOLOGY.haul.gap });
    full.forEach((entry, index) => {
      const shown = landed.get(strataHaulKey(entry));
      if (shown === undefined) return;
      const x = layout.xs[index];
      if (entry.kind !== "rune") {
        const texture = rewardTexture(entry);
        // 안내창을 여는 것은 액자 공용 규칙이다(재화·아이템 어느 쪽이든 같은 그림은 같은 일을 한다).
        if (texture !== null) addFramedIcon(this, row, x, ARCHAEOLOGY.haul.y, layout.frame, texture, { amount: String(shown.amount) });
        return;
      }
      const holder = this.add.container(x, ARCHAEOLOGY.haul.y);
      row.add(holder);
      holder.add(this.buildRewardFrame(shown, layout.frame, shown.runePart));
      if (shown.amount > 1) {
        holder.add(this.add.text(layout.frame / 2 - 8, layout.frame / 2 - 6, String(shown.amount),
          textStyle({ role: "display", size: Math.max(18, Math.round(layout.frame * 0.23)), color: COLOR.accentText }))
          .setOrigin(1, 1).setStroke("#000000", 6));
      }
      const hit = this.add.rectangle(0, 0, layout.frame, layout.frame, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => pressIn(holder));
      hit.on("pointerout", () => pressOut(holder, "normal", { pop: false }));
      hit.on("pointerup", () => { pressOut(holder); this.openHaulRune(shown.runeRarity); });
      holder.add(hit);
    });
  }

  /** 전리품의 룬 칸을 누르면 이번 판에서 받은 그 등급의 가장 최근 룬 정보가 열린다. */
  private openHaulRune(rarity: RuneRarity | undefined): void {
    for (let at = this.grantedRunes.length - 1; at >= 0; at -= 1) {
      const granted = this.grantedRunes[at];
      if (granted.rarity !== rarity) continue;
      if (!session.runeInventory.some(({ instanceId }) => instanceId === granted.instanceId)) continue;
      openRuneInfoPopup(this, this.popups, { runeInstanceId: granted.instanceId });
      return;
    }
  }

  /** 서버가 돌려준 결과 중 선택한 칸만 기존 컨테이너 안에서 교체한다. */
  private replaceStrataTile(index: number, board: StrataBoardView): void {
    const frame = strataBoardFrame(board.columns, board.rows, BASE_WIDTH);
    this.paintStrataTile(index, board, coverSourceCrop(STRATA_ART.width, STRATA_ART.height, frame.width, frame.height));
  }

  /** 곡괭이 옆 게이지와 `남은/전체` 글자를 서버 공개 모델의 값으로 맞춘다. */
  private paintStrataProgress(board: StrataBoardView): void {
    this.strataDigsText?.setText(t("archaeology.digsCount", { current: board.digsLeft, max: board.digsMax }));
    this.strataDigsBar?.setValue(board.digsMax > 0 ? board.digsLeft / board.digsMax : 0);
  }

  /** 성공·실패 뒤 현재도 팔 수 있는 모든 칸에만 입력을 되돌린다. */
  private restoreStrataInputs(): void {
    const board = this.board;
    if (!board || board.digsLeft <= 0) return;
    board.tiles.forEach((tile) => {
      if (tile.revealed) return;
      // 칸 컨테이너를 뒤지지 않는다 — 특화 구역 칸은 색면이 먼저 걸려 진짜 입력면이 꺼진 채 남았다.
      this.strataHits.get(tile.index)?.setInteractive({ useHandCursor: true });
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
   * **영웅 이상 확정 부여는 영웅 아래에서만 선다**(`canGrantRuneTraitAtLeast`). 영웅 위에 세우면
   * 잘해야 같은 등급의 다른 특성이고, 전설 위에서는 등급을 떨어뜨리는 버튼이 된다 — 눌러도
   * 나아지지 않는 칸은 준비 상태를 과장한다.
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

    // 확정 부여가 보장하는 등급(영웅)에 이미 닿았으면 세우지 않는다.
    if (canGrantRuneTraitAtLeast(trait, grantHigh.minimumGrade)) {
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
