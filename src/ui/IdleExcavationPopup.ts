import Phaser from "phaser";
import { t } from "../i18n";
import type { AdOperationsConfigResponse, AdPresentationResult, AdSlotOperationsDto, GameApi, HarvestExcavationResponse, IdleExcavationResponse } from "../api/contracts";
import { motionPolicy, powerSavingPolicy } from "../core/settings";
import { emptyExcavationAmounts, EXCAVATION_CURRENCIES, excavationProductionDisplayModel, excavationStorageFillRatio, excavationStorageLimitSeconds, type ExcavationCurrency, type IdleExcavationState } from "../core/idleExcavation";
import { tapFormationSlot, tapRosterRelic } from "../core/formationSlots";
import { RELICS } from "../data/relics";
import { placePuppet, spawnPuppet, type PuppetAsset, type PuppetCreature } from "../puppets/assets";
import { session } from "../state/session";
import { setDebugExcavationAdOffers, setDebugFormationDragVisual, setDebugIdleExcavationControls, setDebugIdleExcavationPopup, setDebugIdleExcavationSdReady, setDebugIdleExcavationSlots } from "../debug";
import { relicAppearanceManager } from "../managers/RelicAppearanceManager";
import { notificationManager } from "../managers/NotificationManager";
import { Button } from "./Button";
import { chipPoints, drawHairline, drawLayer, HOLO, HoloBar, slantedRect } from "./holo";
import { PortraitCard } from "./PortraitCard";
import { autoAssignExcavation, excavationAutoModeLabel, EXCAVATION_AUTO_MODES, type ExcavationAutoMode, type ExcavationCandidate } from "../core/excavationAutoAssign";
import { bindLongPress } from "./longPressInfo";
import { type InfoManager, sceneInfoManager } from "./info";
import { formationRosterColumnX, formationRosterGrid, PORTRAIT_GRID_MASK_GAP, portraitGridContentHeight, portraitGridFirstRowY } from "./portraitGrid";
import { addFormationRemoveChip, addFormationSlotPlate, addFormationSlotSelection } from "./formationSlotChrome";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { completedAdToken } from "../data/adRewards";
import type { CurrencyIconKey } from "./currencyIcons";
import { openRewardPopup } from "./RewardPopup";
import { addPopupBackgroundImage, BACKGROUND, type PopupBackgroundImage } from "./backgrounds";
import { addSectionTitle } from "./SectionTitle";
import { excavationDisplayModel } from "./excavationDisplayModel";
import { ExcavationCurrencyFrame, formatRate } from "./ExcavationCurrencyFrame";
import { excavationAdOfferDisplayModel, type ExcavationAdOfferId } from "./excavationAdOfferModel";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { loadOwnedPuppet } from "./statusPuppetLoad";
import { startPuppetHop } from "./puppetHop";
import { BACK_SLOT } from "./IconButton";
import { moveFormationSlot } from "../core/formation";
import { bindFormationDrag, type FormationDragSlot } from "./formationDrag";
import { FORMATION_DRAG_VISUAL } from "./formationDragVisual";
import { createFormationDragVisualController, type FormationDragVisualController } from "./formationDragVisualController";

/** 한 팝업 안에서 현황과 편집 그리드가 교대하므로 모바일 안전 영역을 넘지 않는 고정 크기를 쓴다. */
const PANEL = { width: 900, height: 1320 } as const;
/** 현황의 누적 액자 판. 배치 그리드도 같은 윗변에서 시작해 두 화면이 한 자리를 공유한다. */
const STATUS_SUMMARY = { y: 30, width: 800, height: 205 } as const;
/** SD 발밑과 누적 액자 사이, 보관 한도가 찬 비율을 보여주는 좁은 자리다. */
const STORAGE_GAUGE = { labelY: -158, y: -128, width: 700, height: 20 } as const;
/**
 * 보유 렐릭은 이 창 안에서만 세로로 흐르며 상단 슬롯과 하단 완료 버튼을 침범하지 않는다.
 *
 * `top`은 현황의 누적 액자 판과 같은 윗변이다. 첫 줄 카드는 그보다 머리 돌출만큼 내려 서므로
 * 눈에 보이는 그리드의 윗선(머리 끝)이 액자 판의 윗선과 정확히 맞는다.
 */
// 카드 비율(세로/가로)을 도감 그리드(300×400)와 맞춰, 머리 관절 기준 잘라내기가 카드 크기와
// 무관하게 같은 구도로 보이게 한다 — 비율이 다르면 같은 캐릭터도 화면마다 잘리는 범위가
// 달라진다(`computeHeadCardFrame`은 카드 가로세로비를 그대로 잘라내기 비율로 쓴다).
const GRID_VIEW = { left: -415, right: 415, top: STATUS_SUMMARY.y - STATUS_SUMMARY.height / 2, bottom: 425 } as const;
/** 한 줄에 몇 칸이고 카드가 얼마나 큰지는 화면이 정하지 않는다 — 폭만 주면 공용 규칙이 정한다. */
const ROSTER = formationRosterGrid(GRID_VIEW.right - GRID_VIEW.left);
/** 손가락이 이 거리 이상 움직여야 카드 선택이 아니라 스크롤로 판정한다. */
const GRID_DRAG_SLOP = 12;
/** 팝업 판(PopupLayer 기본 2000) 바로 위. 그 위에 열리는 보상 팝업(2002)보다는 아래에 남는다. */
const SD_DEPTH = 2001;
/** 원화는 별도 액자를 만들지 않고 PopupLayer 판의 비대칭 실루엣에 직접 맞춘다. */
const POPUP_ART_SHAPE = chipPoints(PANEL.width - 24, PANEL.height - 24, { bevel: { topLeft: 118, bottomRight: 118 } });
/** 좁은 안전 영역에서도 팝업 제목·닫기와 겹치지 않는 현황 히어로의 고정 세로 범위다. */
// 슬롯 줄은 배경 원화의 발굴 벽면 가운데에 서도록 제목 아래로 조금 내려 둔다.
const STATUS_HERO = { x: 0, y: -310, width: 800, height: 300, headerY: -570, slotY: -310 } as const;
/** SD가 서는 바닥은 슬롯 칸 안쪽이라 칸 중심에서 늘 같은 거리를 유지한다. */
const SLOT_GROUND_OFFSET = 110;
/**
 * 현황과 배치가 나눠 쓰는 아래 칸의 주요 조작 자리다.
 *
 * 슬롯을 눌러도 새 화면이 열리지 않고 이 아래 칸만 그리드로 바뀐다. 그래서 수확과 배치는
 * 같은 높이에 서고, 취소는 배치 중에만 그 왼쪽에 나타났다 사라진다.
 */
const BOTTOM_ACTION = { y: 545, cancelX: -280, primaryX: 125 } as const;
/** 팝업 로컬 좌표를 게임 좌표로 바꾸는 디버그 입력 계약이다. */
const POPUP_CENTER = { x: BASE_WIDTH / 2, y: BASE_HEIGHT / 2 } as const;
type Formation = IdleExcavationState["assignedRelicIds"];

/** SD 비동기 경계를 테스트에서 성공·실패·지연 완료로 바꿀 수 있게 좁게 주입한다. */
export interface StatusPuppetLoader {
  assetFor: (relicId: string) => PuppetAsset;
  spawn: typeof spawnPuppet;
}

const DEFAULT_STATUS_PUPPET_LOADER: StatusPuppetLoader = { assetFor: (relicId) => relicAppearanceManager.sdAssetFor(relicId), spawn: spawnPuppet };

/** 발굴 지급 재화는 생산 특성 표식과 달리 다색 공용 재화 이미지를 직접 사용한다. */
const EXCAVATION_CURRENCY_ICON: Record<ExcavationCurrency, CurrencyIconKey> = {
  gold: "currency-gold",
  cheesecake: "currency-cheesecake",
  // UI 명칭 다이아/일반 화석은 실제 Wallet 키 gems/fossil에 대응한다.
  fossil: "currency-fossil",
  gems: "currency-gems",
};

/** 서버 요청을 재시도해도 같은 입력만 한 번 처리하도록 브라우저 난수와 시각을 함께 쓴다. */
function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `excavation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** 서버 확정값과 분리된 편집 사본을 만드는 좁은 복사 함수다. */
function copyFormation(value: Formation): Formation { return [...value] as Formation; }

/** 화면 포인터를 Puppet 레이어의 로컬 좌표로 되돌려 부모 변환이 있어도 드래그 발끝을 맞춘다. */
function layerScreenToLocal(layer: Phaser.GameObjects.Container | undefined, x: number, y: number): Phaser.Math.Vector2 {
  if (!layer) return new Phaser.Math.Vector2(x, y);
  return layer.getWorldTransformMatrix().applyInverse(x, y);
}

/** PopupLayer 한 장 안에서 서버 확정 편성과 임시 편집 편성의 생명주기를 소유한다. */
export class IdleExcavationPopup {
  private body?: Phaser.GameObjects.Container;
  private content?: Phaser.GameObjects.Container;
  /** 슬롯 줄과 SD가 사는 위 칸. 현황과 배치가 같은 것을 본다. */
  private upper?: Phaser.GameObjects.Container;
  /** 현황 요약과 배치 그리드가 번갈아 사는 아래 칸이다. */
  private lower?: Phaser.GameObjects.Container;
  /** 지금 SD를 읽는 중인 렐릭. 같은 렐릭을 두 번 읽지 않게 한다. */
  private readonly sdLoading = new Set<string>();
  /** 로딩·오류 문구가 떠 있는 동안에는 현황이 본문을 통째로 다시 만든다. */
  private messageShown = false;
  /** 히어로 원화의 컨테이너 밖 마스크/이벤트까지 reset 때 함께 폐기한다. */
  private statusBackground?: PopupBackgroundImage;
  /** 현황 SD만 담아 카드/편집 UI와 비동기 수명을 분리하는 전용 레이어다. */
  private sdContainer?: Phaser.GameObjects.Container;
  private readonly sdPuppets = new Set<PuppetCreature>();
  /** 생산 틱 연출이 해당 기여 렐릭을 바로 찾도록 ID별 SD 참조를 보관한다. */
  private readonly sdPuppetByRelicId = new Map<string, PuppetCreature>();
  /** 팝업 본문 재생성과 함께 취소되는 공용 편성 표현 수명이다. */
  private formationDragVisual?: FormationDragVisualController;
  private readonly sdTweens = new Set<Phaser.Tweens.Tween>();
  /** 재렌더나 닫기 전 시작된 Puppet 로딩 결과가 새 현황에 섞이지 않게 하는 세대 번호다. */
  private sdLoadGeneration = 0;
  private confirmed?: IdleExcavationResponse;
  private draft?: Formation;
  /** 목록을 눌렀을 때 렐릭이 설 칸. 아무 칸도 고르지 않은 상태가 있고, 판 밖을 누르면 풀린다. */
  private selectedSlot: number | undefined;
  /**
   * 선택만 바뀌었을 때 다시 그릴 것들.
   *
   * 칸을 하나 누를 때마다 아래 칸의 그리드를 통째로 다시 만들면 스크롤이 처음으로 돌아가고
   * 카드 수십 장이 한 프레임에 새로 태어난다. 고른 칸이 바뀌는 것은 **표시**만 달라지는 일이라
   * 여기 모아 둔 것만 갈아 끼운다.
   */
  private readonly slotSelectionAppliers: Array<(selected: boolean) => void> = [];
  /** 고른 칸의 밑판. SD보다 **뒤**에 깔려야 고른 칸의 캐릭터가 판에 덮이지 않는다. */
  private slotPlateLayer?: Phaser.GameObjects.Container;
  /** 빼는 표식. SD보다 **앞**에 서야 머리에 가리지 않는다. */
  private slotChromeLayer?: Phaser.GameObjects.Container;
  /** 편집 중 선택 칸을 말하는 두 글자. 선택만 바뀌면 이 둘만 다시 적는다. */
  private editTitle?: Phaser.GameObjects.Container;
  private rosterLabel?: Phaser.GameObjects.Text;
  /** 목록 카드. 편성이 바뀌면 눌림 표시만 갈아 끼운다. */
  private readonly rosterCards = new Map<string, PortraitCard>();
  private gridScrollY = 0;
  private gridDragging = false;
  private gridDragOrigin = 0;
  private gridDragMoved = 0;
  private gridMask?: Phaser.GameObjects.Graphics;
  private gridWheelHandler?: (_pointer: Phaser.Input.Pointer, objects: Phaser.GameObjects.GameObject[], deltaX: number, deltaY: number) => void;
  private gridPointerDownHandler?: (pointer: Phaser.Input.Pointer) => void;
  private gridPointerMoveHandler?: (pointer: Phaser.Input.Pointer) => void;
  private gridPointerUpHandler?: () => void;
  private saving = false;
  /** 자동 배치의 기준. 창을 여는 동안만 남는다 — 다음에 열 때는 다시 골고루부터 본다. */
  private autoMode: ExcavationAutoMode = "balanced";
  /** 전송 실패 재시도에서도 같은 멱등 키를 유지하고 성공한 뒤에만 비운다. */
  private harvestRequestId?: string;
  /** 성공 결과는 다음 현황 렌더 한 번에만 안내·연출하고 즉시 소비한다. */
  private harvestResult?: HarvestExcavationResponse;
  /** 조회 실패 시 undefined를 유지해 번들 표로 광고를 임의 노출하지 않는다. */
  private adOperations?: AdOperationsConfigResponse;
  private adMessage?: string;
  private harvestError?: string;
  private ticker?: Phaser.Time.TimerEvent;
  private requestGeneration = 0;
  /** PopupLayer가 만든 close 함수를 보관해 외부 화면 아이콘도 동일한 onClose 정리를 통과시킨다. */
  private closeAction?: () => void;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly api: GameApi, private readonly onClosed?: () => void, private readonly presentAd?: (slotId: string) => Promise<AdPresentationResult>, private readonly puppetLoader: StatusPuppetLoader = DEFAULT_STATUS_PUPPET_LOADER) {}

  /** 연타는 기존 한 장을 유지하며 닫기는 저장되지 않은 draft를 버린다. */
  open(): void {
    if (this.body) return;
    this.body = this.popups.open({ width: PANEL.width, height: PANEL.height, title: t("excavation.title"), titleSize: 34, dim: true, closeOnBackdrop: false, hideCloseButton: true, onClose: () => this.dispose() }, (body, close) => {
      this.closeAction = close;
      body.setName("idle-excavation-popup");
      this.showMessage(t("excavation.settling"), "loading");
    });
    // E2E는 새 레이아웃의 실제 입력 중심을 사용하고 게임 데이터에는 접근하지 않는다.
    setDebugIdleExcavationControls({
      close: { ...BACK_SLOT },
      harvest: { x: POPUP_CENTER.x, y: POPUP_CENTER.y + BOTTOM_ACTION.y },
      cancelEdit: { x: POPUP_CENTER.x + BOTTOM_ACTION.cancelX, y: POPUP_CENTER.y + BOTTOM_ACTION.y },
      ads: [
        { slotId: "excavation-harvest", x: POPUP_CENTER.x - 205, y: POPUP_CENTER.y + 385 },
        { slotId: "excavation-storage", x: POPUP_CENTER.x + 205, y: POPUP_CENTER.y + 385 },
      ],
    });
    void this.fetch();
  }

  /** 로비 화면의 공용 뒤로가기 아이콘이 팝업 구현을 몰라도 현재 발굴 화면을 닫는다. */
  close(): void { this.closeAction?.(); }

  /** 조회 성공 전에는 확정 상태를 만들지 않으며 오류는 같은 팝업에서 재시도한다. */
  private async fetch(): Promise<void> {
    const generation = ++this.requestGeneration;
    try {
      const response = await this.api.getIdleExcavation();
      // 운영 설정 실패는 선택 광고만 숨기며 기본 4시간 생산과 일반 수확 진입은 그대로 계속한다.
      try { this.adOperations = await this.api.getAdOperationsConfig(); } catch { this.adOperations = undefined; }
      if (!this.body || generation !== this.requestGeneration) return;
      this.confirmed = response;
      this.renderStatus();
    } catch {
      if (!this.body || generation !== this.requestGeneration) return;
      this.showMessage(t("excavation.loadFailed"), "error", true);
    }
  }

  /** 배경 원화와 SD까지 버리고 본문을 통째로 새로 만든다. 로딩·오류·첫 현황에서만 쓴다. */
  private resetContent(): Phaser.GameObjects.Container | undefined {
    // 팝업 배경 helper의 GeometryMask는 content 자식이 아니므로 자식 파괴보다 먼저 정리한다.
    this.statusBackground?.destroy(); this.statusBackground = undefined;
    // SD는 content 바깥 GPU 자원과 tween을 가지므로 화면 자식 파괴에 기대지 않고 한 번만 정리한다.
    this.clearStatusSD();
    this.releaseLower();
    this.upper?.destroy(true); this.upper = undefined;
    this.lower?.destroy(true); this.lower = undefined;
    this.content?.destroy(true);
    if (!this.body) return undefined;
    this.content = this.scene.add.container(0, 0);
    this.body.add(this.content);
    // 본문은 판 전체를 덮는 원화를 담으므로, 머리글은 그 위로 다시 올린다.
    this.popups.raiseChrome(this.body);
    return this.content;
  }

  /** 아래 칸이 소유하던 타이머와 씬 입력 리스너를 뗀다. 자식이 아니라서 파괴로 사라지지 않는다. */
  private releaseLower(): void {
    this.gridMask?.destroy(); this.gridMask = undefined;
    if (this.gridWheelHandler) this.scene.input.off("wheel", this.gridWheelHandler);
    if (this.gridPointerDownHandler) this.scene.input.off("pointerdown", this.gridPointerDownHandler);
    if (this.gridPointerMoveHandler) this.scene.input.off("pointermove", this.gridPointerMoveHandler);
    if (this.gridPointerUpHandler) this.scene.input.off("pointerup", this.gridPointerUpHandler);
    this.gridWheelHandler = undefined;
    this.gridPointerDownHandler = undefined; this.gridPointerMoveHandler = undefined; this.gridPointerUpHandler = undefined;
    this.ticker?.remove(false); this.ticker = undefined;
  }

  /**
   * 아래 칸만 비우고 새 컨테이너를 돌려준다.
   *
   * 슬롯을 눌렀을 때 팝업이 통째로 갈리면 새 화면이 열린 것처럼 보인다. 위 칸(슬롯·SD)은
   * 그대로 두고 이 아래 칸만 현황 요약 ↔ 배치 그리드로 바뀌어야 한 화면 안의 일로 읽힌다.
   */
  private resetLower(): Phaser.GameObjects.Container | undefined {
    this.releaseLower();
    this.lower?.destroy(true); this.lower = undefined;
    if (!this.content) return undefined;
    this.lower = this.scene.add.container(0, 0);
    this.content.add(this.lower);
    return this.lower;
  }

  /**
   * 슬롯 줄과 그 위의 SD는 현황·배치가 함께 쓰는 위 칸이다.
   *
   * 편성이 그대로면 이미 선 SD를 다시 세우지 않는다. 카드 한 장을 옮길 때마다 세 마리를 다시
   * 읽으면 그 사이 카드가 깜빡이고, 뛰던 박자도 처음으로 되돌아간다.
   */
  private renderUpper(formation: Formation, editable: boolean): void {
    const content = this.content;
    if (!content) return;
    this.upper?.destroy(true);
    const upper = this.scene.add.container(0, 0);
    this.upper = upper; content.add(upper);
    // 밑판은 슬롯 카드보다 먼저 들어가야 뒤에 깔린다. 빼는 표식만 SD 위 전용 층에 산다.
    this.slotPlateLayer = this.scene.add.container(0, 0);
    upper.add(this.slotPlateLayer);
    this.slotChromeLayer?.destroy(true);
    this.slotChromeLayer = this.scene.add.container(0, 0).setDepth(SD_DEPTH + 1);
    this.body?.add(this.slotChromeLayer);
    this.editTitle = undefined;
    if (editable) {
      this.editTitle = addSectionTitle(this.scene, -380, STATUS_HERO.headerY, this.editTitleText(), { size: 23, parent: upper });
    } else {
      // 진행 문구는 일반 강조, 배치 수는 같은 행의 얇은 보조 정보로 두어 제목 위계를 만들지 않는다.
      upper.add(this.scene.add.text(-360, STATUS_HERO.headerY, this.saving ? t("excavation.harvesting") : t("excavation.running"), textStyle({ role: "emphasis", size: 27, color: COLOR.accentText })).setOrigin(0, 0.5));
      upper.add(this.scene.add.text(-160, STATUS_HERO.headerY, t("excavation.placed", { count: formation.filter(Boolean).length }), textStyle({ role: "body", size: 18, color: COLOR.inkDim })).setOrigin(0, 0.5));
    }
    upper.add(drawHairline(this.scene, 0, -535, 760, { color: COLOR.accent, alpha: 0.42 }));
    this.addSlots(upper, formation, editable);
    this.syncStatusSD(formation);
  }

  private showMessage(message: string, state: "loading" | "error", retry = false): void {
    const content = this.resetContent();
    this.messageShown = true;
    if (!content || !this.body) return;
    // 상태 문구는 비워 둔 액자 중앙에 놓아 로딩 피드백이 제목이나 닫기 조작을 가리지 않는다.
    content.add(this.scene.add.text(0, 20, message, textStyle({ role: "body", size: 28, color: state === "error" ? COLOR.dangerText : COLOR.inkDim })).setOrigin(0.5));
    if (retry) content.add(new Button(this.scene, 0, 65, { width: 260, height: 82, label: t("excavation.retry"), onClick: () => { this.showMessage(t("excavation.settling"), "loading"); void this.fetch(); } }));
    this.setState(state);
  }

  /** 확정 편성 기준 현황이다. 표시 누적량만 매초 예상하고 서버 상태나 세션은 바꾸지 않는다. */
  private renderStatus(): void {
    const response = this.confirmed;
    if (!response) return;
    // 배경 원화와 SD는 살려 둔다. 배치에서 돌아올 때 화면이 통째로 새로 열리지 않게 하기 위해서다.
    const content = this.content && !this.messageShown ? this.content : this.resetContent();
    if (!content) return;
    this.messageShown = false;
    const formation = response.excavation.assignedRelicIds;
    const rate = excavationProductionDisplayModel(formation, RELICS, session.relicProgress).totalsPerHour;
    // 1순위 발굴대 상태: 전용 원화를 팝업 전체에 한 장으로 깔아 히어로와 조작부를 끊지 않는다.
    // 발굴장 원화는 25MB짜리라 이 팝업을 열 때 읽고 닫으면 내린다. 도착 전에는 판이 비어
    // 보이지만 조작은 그대로 선다 — 원화 한 장이 화면을 막지 않는다.
    if (!this.statusBackground) {
      this.statusBackground = addPopupBackgroundImage(this.scene, content, BACKGROUND.excavation, { x: 0, y: 0, width: PANEL.width - 24, height: PANEL.height - 24, maskShape: POPUP_ART_SHAPE });
      if (this.body) this.popups.raiseChrome(this.body);
    }
    // 2순위 작업 중 SD/슬롯: 현황에서도 칸 자체가 편성 그리드의 유일한 진입점이다.
    this.renderUpper(formation, false);
    this.renderStatusLower(response, rate);
  }

  /** 누적·생산·광고·수확은 배치 그리드와 같은 아래 칸을 쓰므로 한 곳에서만 그린다. */
  private renderStatusLower(response: IdleExcavationResponse, rate: Record<ExcavationCurrency, number>): void {
    const content = this.resetLower();
    if (!content) return;
    const baseServerMs = new Date(response.serverTime).getTime();
    let harvestButton: Button | undefined;
    // SD 발밑과 누적 액자 사이: 생산을 이어 담을 수 있는 보관 한도가 지금 몇 % 찼는지 보여 준다.
    const storageLabel = this.scene.add.text(0, STORAGE_GAUGE.labelY, "", textStyle({ role: "emphasis", size: 20, color: COLOR.accentText })).setOrigin(0.5);
    content.add(storageLabel);
    const storageGauge = new HoloBar(this.scene, 0, STORAGE_GAUGE.y, STORAGE_GAUGE.width, STORAGE_GAUGE.height, { color: COLOR.accent, trackAlpha: 0.8, outline: true }).addTo(content);
    // 발굴 전용 액자는 큰 누적값을, 아래의 독립 칩은 같은 아이콘과 생산 속도만 책임진다.
    // 3순위 누적 보상: SD 아래에서 현재 수확량과 시간당 생산량을 한 번에 훑는다.
    content.add(drawLayer(this.scene, 0, STATUS_SUMMARY.y, slantedRect(STATUS_SUMMARY.width, STATUS_SUMMARY.height), { fill: COLOR.panel, alpha: HOLO.glassLight, edge: COLOR.accent, edgeAlpha: 0.42 }));
    const display = excavationDisplayModel(response.excavation.unclaimed, rate);
    // 상단 CurrencyChip을 늘리지 않고 발굴 전용 반투명 액자와 별도 생산 칩을 한 줄로 세운다.
    const rows = display.map((item) => {
      const frame = new ExcavationCurrencyFrame(this.scene, item.x, 26, EXCAVATION_CURRENCY_ICON[item.currency]);
      frame.setValues(item.unclaimed, item.rate); content.add(frame);
      return { ...item, frame, previousAmount: Math.floor(item.unclaimed) };
    });
    const availability = this.scene.add.text(0, 145, "", textStyle({ role: "body", size: 19, color: COLOR.inkDim })).setOrigin(0.5);
    content.add(availability);
    const refreshEstimate = (): void => {
      // 서버 응답 이후의 로컬 경과분만 더하는 표시용 예상치이며 정산 기준 시각은 절대 갱신하지 않는다.
      const elapsedHours = Math.max(0, Date.now() - baseServerMs) / 3_600_000;
      const liveAmounts = emptyExcavationAmounts();
      // 틱에서는 프리팹의 Text만 바꾼다. 이미지와 불투명 요약 레이어는 재생성하지 않는다.
      for (const row of rows) {
        const amount = response.excavation.unclaimed[row.currency] + rate[row.currency] * elapsedHours;
        liveAmounts[row.currency] = amount;
        row.frame.setValues(amount, row.rate);
        // 정수 단위가 실제로 증가한 틱에만 기여 렐릭의 SD와 자원 아이콘으로 생산 피드백을 준다.
        if (Math.floor(amount) > row.previousAmount) this.playProductionTick(row.currency);
        row.previousAmount = Math.floor(amount);
      }
      // 창을 열어 둔 사이 정수 1개가 쌓이는 순간에도 새 조회 없이 버튼 상태만 정확히 갱신한다.
      const harvestable = EXCAVATION_CURRENCIES.some((currency) => Math.floor(liveAmounts[currency]) > 0);
      harvestButton?.setEnabled(harvestable && !this.saving);
      // 비활성 이유를 누적 0 또는 가장 빠른 재화의 다음 정수 생산 시각으로 짧게 설명한다.
      const seconds = EXCAVATION_CURRENCIES.map((currency) => (
        rate[currency] > 0 ? Math.max(0, Math.ceil((1 - liveAmounts[currency]) / rate[currency] * 3600)) : Number.POSITIVE_INFINITY
      ));
      const next = Math.min(...seconds);
      availability.setText(harvestable ? t("excavation.readyToHarvest") : Number.isFinite(next) ? t("excavation.nextHarvest", { minutes: Math.max(1, Math.ceil(next / 60)) }) : t("excavation.needRelics"));
      // 실제로 쌓인 재화량 자체를 보관 한도와 비교한다 — 경과 시간 기준으로 계산하면 창을 열
      // 때마다 서버 정산이 일어나 기준 시각이 현재로 밀리면서 게이지가 늘 0%로 보였다.
      const limitSeconds = excavationStorageLimitSeconds(response.excavation, new Date());
      const storageRatio = excavationStorageFillRatio(liveAmounts, rate, limitSeconds);
      storageGauge.setValue(storageRatio);
      storageLabel.setText(t("excavation.storage", { percent: Math.round(storageRatio * 100) }));
    };
    refreshEstimate();
    this.ticker?.remove(false);
    this.ticker = this.scene.time.addEvent({ delay: 1000, loop: true, callback: refreshEstimate });
    content.add(drawHairline(this.scene, 0, 180, 760, { color: COLOR.accent, alpha: 0.25 }));
    const result = this.harvestResult;
    const discarded = result ? EXCAVATION_CURRENCIES.reduce((sum, currency) => sum + result.discarded[currency], 0) : 0;
    const notice = this.harvestError ?? (discarded > 0 ? t("excavation.harvestCapped") : result ? t("excavation.harvestDone") : t("excavation.emptySlotNote"));
    content.add(this.scene.add.text(0, 250, notice, textStyle({ role: "body", size: 21, color: discarded > 0 || this.harvestError ? COLOR.dangerText : COLOR.inkDim, align: "center" })).setOrigin(0.5));
    this.addAdOffers(content, response.serverTime);
    // 5순위 주요 행동: 별도 편성 버튼은 없애고, 하단 전체 폭은 수확 primary 하나에만 준다.
    harvestButton = new Button(this.scene, 0, BOTTOM_ACTION.y, { width: 520, height: 98, label: this.saving ? t("excavation.harvestBusy") : t("excavation.harvest"), variant: "primary", onClick: () => void this.harvest() });
    // 서버 확정 누적량이 1 미만이거나 요청 중이면 지급할 것이 없으므로 입력부터 막는다.
    refreshEstimate(); content.add(harvestButton);
    this.setState(this.saving ? "saving" : "ready");
    if (result) {
      // 서버 확정 지급분만 공용 획득 팝업에 넘긴다. 지갑 상한 손실은 현황 경고로 남기고 보상처럼 꾸미지 않는다.
      openRewardPopup(this.scene, this.popups, {
        title: t("excavation.rewardTitle"),
        // 수확 결과는 일반 영수증보다 한 단계 큰 제목을 쓰고, 암전은 공용 기본값(짙은 검정)을 그대로 받는다.
        titleSize: 30,
        items: EXCAVATION_CURRENCIES.map((currency) => ({
          icon: EXCAVATION_CURRENCY_ICON[currency],
          amount: result.granted[currency],
        })),
      });
      this.harvestResult = undefined;
    }
  }

  /** 좌우 제안은 유효한 서버 설정에서 활성인 발굴 슬롯만 남은 횟수와 효과를 직접 말한다. */
  private addAdOffers(content: Phaser.GameObjects.Container, serverTime: string): void {
    const config = this.adOperations;
    if (!config || new Date(config.expiresAt).getTime() <= new Date(serverTime).getTime()) { setDebugExcavationAdOffers([]); return; }
    const slotIds: readonly ExcavationAdOfferId[] = ["excavation-harvest", "excavation-storage"];
    const slots = slotIds.map((id) => config.slots.find((slot) => slot.slotId === id && slot.enabled)).filter((slot): slot is AdSlotOperationsDto & { slotId: ExcavationAdOfferId } => Boolean(slot));
    const debugOffers: NonNullable<Window["__PF_DEBUG"]>["excavationAdOffers"] = [];
    slots.forEach((slot, index) => {
      const sameUtcDay = session.dailyAdRewards.date === serverTime.slice(0, 10);
      const remaining = Math.max(0, slot.dailyLimitUtc - (sameUtcDay ? session.dailyAdRewards.claimsBySlot[slot.slotId] ?? 0 : 0));
      // 서버 displayText 대신 슬롯별 표시 모델을 사용하고, 남은 횟수에서 실제 사용 횟수를 구한다.
      const offer = excavationAdOfferDisplayModel(slot.slotId, slot.dailyLimitUtc, remaining);
      const production = slot.slotId === "excavation-harvest";
      // E2E에는 Canvas에서 사용자가 읽는 값만 노출하고 서버 displayText와 광고 토큰은 제외한다.
      debugOffers.push({ slotId: slot.slotId, label: offer.label, usage: offer.usage, enabled: offer.enabled && !this.saving });
      // 4순위 보조 혜택: 광고는 primary와 거리를 두고 더 낮고 작은 보조 버튼으로만 제안한다.
      const button = new Button(this.scene, index === 0 ? -205 : 205, 385, {
        width: 350, height: 78, label: offer.label, sub: offer.usage, fontSize: 27, subFontSize: 17,
        // 생산은 청록/푸른 강조, 보관은 보라 강조와 어두운 호박 면으로 기존 토큰의 채도를 따른다.
        accentColor: production ? COLOR.excavationProduction : COLOR.excavationStorage,
        fill: production ? COLOR.panel : COLOR.excavationStorageFill,
        onClick: () => void this.claimAdEffect(slot),
      });
      // 한도를 다 쓴 2/2 같은 상태도 진행 정보로 남기되 입력과 손 모양은 비활성화한다.
      button.setEnabled(offer.enabled && !this.saving);
      content.add(button);
    });
    setDebugExcavationAdOffers(debugOffers);
    if (this.adMessage) content.add(this.scene.add.text(0, 438, this.adMessage, textStyle({ role: "body", size: 18, color: COLOR.inkDim })).setOrigin(0.5));
  }

  /** 취소·동의 거부·SDK/재고 실패는 메시지만 바꾸며 일반 수확 버튼과 발굴 상태를 건드리지 않는다. */
  private async claimAdEffect(slot: AdSlotOperationsDto): Promise<void> {
    if (!this.presentAd || this.saving) { this.adMessage = t("excavation.ad.unavailable"); this.renderStatus(); return; }
    const presentation = await this.presentAd(slot.slotId);
    const verificationToken = completedAdToken(presentation);
    if (!verificationToken) { this.adMessage = t("excavation.ad.cancelled"); this.renderStatus(); return; }
    try {
      const result = await this.api.claimAdReward({ slotId: slot.slotId, verificationToken, requestId: requestId() });
      if (result.excavation) session.idleExcavation = { ...result.excavation, assignedRelicIds: copyFormation(result.excavation.assignedRelicIds), unclaimed: { ...result.excavation.unclaimed } };
      session.dailyAdRewards = { date: result.dailyAdRewards.date, claimsBySlot: { ...result.dailyAdRewards.claimsBySlot }, requestIds: session.dailyAdRewards.requestIds };
      // 광고 적용 뒤에도 임시 응답을 조립하지 않고 비율·알림이 포함된 발굴 API 스냅샷을 다시 받는다.
      this.confirmed = await this.api.getIdleExcavation(); this.adMessage = t("excavation.ad.applied"); this.renderStatus();
    } catch { this.adMessage = t("excavation.ad.verifyFailed"); this.renderStatus(); }
  }

  /** 편집을 열 때에만 확정 배열을 복사하므로 취소/닫기가 서버 편성을 건드릴 수 없다. */
  private beginEdit(slot: number | undefined = undefined): void {
    if (!this.confirmed || this.saving) return;
    this.draft = copyFormation(this.confirmed.excavation.assignedRelicIds);
    this.selectedSlot = slot;
    this.gridScrollY = 0;
    this.renderEditor();
  }

  /**
   * 배치는 새 화면이 아니라 아래 칸의 교대다.
   *
   * 위 칸의 슬롯과 SD는 그대로 서 있고, 현황 요약이 있던 자리에만 보유 렐릭 그리드가 들어온다.
   * 수확 자리에는 배치가 서고, 그 왼쪽에 취소가 배치 중에만 나타난다.
   */
  /** 팝업은 열 때마다 새로 만들어지므로 창은 씬 보관대에서 꺼낸다. 팝업 판 위에 서야 해 층을 올린다. */
  private info(): InfoManager {
    return sceneInfoManager(this.scene, { key: "excavation-relic", portraitDepth: 2601, baseDepth: 2600 });
  }

  /** 보유한 렐릭과 그 성장만 넘긴다 — 무엇을 세울지는 순수 규칙이 정한다. */
  private autoCandidates(): ExcavationCandidate[] {
    return RELICS.filter((relic) => session.owned.has(relic.id)).map((def) => ({
      def,
      progress: session.relicProgress[def.id] ?? { level: 1, breakthrough: 0 },
    }));
  }

  private renderEditor(error?: string): void {
    if (!this.draft || !this.content) return;
    this.renderUpper(this.draft, true);
    const content = this.resetLower();
    if (!content) return;
    this.rosterLabel = this.scene.add.text(GRID_VIEW.left + 10, GRID_VIEW.top - 42, (this.selectedSlot === undefined ? t("excavation.ownedRelics") : t("excavation.ownedRelicsForSlot", { slot: this.selectedSlot + 1 })), textStyle({ role: "emphasis", size: 23, color: COLOR.accentText })).setOrigin(0, 0.5);
    content.add(this.rosterLabel);
    // 조작 설명 대신 **그 조작을 대신해 주는 단추**를 둔다. 기준은 화살표로 돌려 고르고,
    // 무엇을 많이 캘지는 지금 모자란 재화에 따라 그때그때 달라지므로 하나로 고정하지 않는다.
    const autoY = GRID_VIEW.top - 42;
    content.add(new Button(this.scene, GRID_VIEW.right - 205, autoY, {
      width: 190, height: 56, fontSize: 22,
      label: t("excavation.autoPlace"), sub: excavationAutoModeLabel(this.autoMode),
      onClick: () => {
        if (this.saving || !this.draft) return;
        this.draft = autoAssignExcavation(this.autoCandidates(), this.autoMode);
        // 자동으로 채운 뒤에는 첫 빈 칸(없으면 1번)이 다음 손을 기다린다.
        this.selectedSlot = undefined;
        this.refreshEditorSlots();
      },
    }));
    content.add(new Button(this.scene, GRID_VIEW.right - 75, autoY, {
      width: 56, height: 56, fontSize: 24, label: "▶",
      onClick: () => {
        const index = EXCAVATION_AUTO_MODES.indexOf(this.autoMode);
        this.autoMode = EXCAVATION_AUTO_MODES[(index + 1) % EXCAVATION_AUTO_MODES.length];
        this.renderEditor();
      },
    }));
    const owned = RELICS.filter((relic) => session.owned.has(relic.id));
    this.rosterCards.clear();
    const grid = this.scene.add.container(0, GRID_VIEW.top + this.gridScrollY);
    owned.forEach((relic, index) => {
      const x = formationRosterColumnX(ROSTER, index % ROSTER.columns);
      // 머리는 칩 밖으로 나오므로 첫 줄은 공용 안전 영역만큼 내려 세운다. 그러지 않으면 정수리가 잘린다.
      const y = portraitGridFirstRowY(0, ROSTER.cardHeight, PORTRAIT_GRID_MASK_GAP) + Math.floor(index / ROSTER.columns) * ROSTER.rowStep;
      const detail = excavationProductionDisplayModel([relic.id, null, null], RELICS, session.relicProgress).relics[0];
      const progress = session.relicProgress[relic.id];
      const card = new PortraitCard(this.scene, x, y, {
        width: ROSTER.cardWidth, height: ROSTER.cardHeight, relicId: relic.id,
        label: relic.name, level: progress?.level ?? 1, rarity: relic.rarity, stars: (progress?.breakthrough ?? 0) + 1,
        subIcon: CURRENCY_ICON_BY_WALLET[relic.excavationTrait.primaryCurrency], sub: formatRate(detail?.totalPerHour ?? 0), subStyle: "currency",
        // 이미 칸에 나가 있는 카드는 떠오르지 않고 눌려 들어간다. 튀어나온 머리 몫은
        // PortraitCard가 원화 알파 그대로 복제해 겹치므로 여기서는 양식만 고른다.
        selectedStyle: "pressed",
      });
      card.setSelected(this.draft!.includes(relic.id));
      this.rosterCards.set(relic.id, card);
      // 짧은 탭은 배치, 꾹 누름은 상세다. 편성 그리드와 같은 조작이라 화면마다 다르게 익히지 않는다.
      bindLongPress(this.scene, card.hit, {
        onTap: () => {
          if (this.saving || !this.draft) return;
          // 이미 어느 칸에 선 렐릭이면 옮기지 않고 그 칸을 고른다. 그때는 편성이 그대로라
          // 슬롯 줄도 목록도 다시 만들 이유가 없다.
          const result = tapRosterRelic(this.draft, this.selectedSlot, relic.id);
          const moved = result.formation.join("|") !== this.draft.join("|");
          this.draft = result.formation as Formation;
          this.selectedSlot = result.selectedSlot;
          if (moved) this.refreshEditorSlots();
          else this.paintSlotSelection();
        },
        allowTap: () => this.gridDragMoved <= GRID_DRAG_SLOP,
        onLongPress: () => this.info().showRelic(relic),
        // 팝업 판(2000) 위에 게이지가 보여야 한다.
        depth: 2400,
      });
      grid.add(card);
    });
    content.add(grid);
    this.addGridScroll(content, grid, owned.length);
    if (error) content.add(this.scene.add.text(0, 455, error, textStyle({ role: "body", size: 22, color: COLOR.dangerText })).setOrigin(0.5));
    // 수확이 서 있던 자리를 배치가 그대로 물려받고, 취소는 배치 중에만 그 왼쪽에 나타난다.
    const cancel = new Button(this.scene, BOTTOM_ACTION.cancelX, BOTTOM_ACTION.y, { width: 220, height: 82, label: t("excavation.cancel"), onClick: () => { if (!this.saving) { this.draft = undefined; this.renderStatus(); } } });
    const done = new Button(this.scene, BOTTOM_ACTION.primaryX, BOTTOM_ACTION.y, { width: 500, height: 92, label: this.saving ? t("excavation.saving") : t("excavation.place"), variant: "primary", onClick: () => void this.saveDraft() });
    cancel.setEnabled(!this.saving); done.setEnabled(!this.saving);
    content.add([cancel, done]);
    this.setState(this.saving ? "saving" : error ? "save-error" : "editing");
  }

  /** 보유 카드가 두 줄을 넘으면 드래그와 휠이 같은 연속 스크롤 값을 갱신한다. */
  private addGridScroll(parent: Phaser.GameObjects.Container, grid: Phaser.GameObjects.Container, relicCount: number): void {
    const viewportHeight = GRID_VIEW.bottom - GRID_VIEW.top;
    const rows = Math.ceil(relicCount / ROSTER.columns);
    // 첫 줄 머리 여유와 마스크 여백까지 넣어야 마지막 줄이 끝까지 올라온다.
    const contentHeight = rows > 0 ? PORTRAIT_GRID_MASK_GAP + portraitGridContentHeight(rows, ROSTER.rowStep, ROSTER.cardHeight) : 0;
    // 도감 그리드(RelicsScene)와 같은 28px 여유를 아래에도 둔다 — 안 그러면 마지막 줄의
    // 밑변이 마스크 경계에 정확히 겹쳐 앤티에일리어싱에 한 줄이 깎여 보인다.
    const minScroll = Math.min(0, viewportHeight - contentHeight - 28);
    this.gridScrollY = Phaser.Math.Clamp(this.gridScrollY, minScroll, 0);
    grid.setY(GRID_VIEW.top + this.gridScrollY);

    // 마스크는 부모 Container의 등장 배율을 물려받지 않으므로 매 프레임 월드 좌표에 동기화한다.
    this.gridMask = this.scene.make.graphics({});
    grid.setMask(this.gridMask.createGeometryMask());
    const syncMask = (): void => {
      if (!this.content || !this.gridMask) return;
      const matrix = parent.getWorldTransformMatrix();
      const topLeft = matrix.transformPoint(GRID_VIEW.left, GRID_VIEW.top);
      this.gridMask.clear().fillStyle(0xffffff, 1).fillRect(topLeft.x, topLeft.y, (GRID_VIEW.right - GRID_VIEW.left) * matrix.scaleX, viewportHeight * matrix.scaleY);
      // PortraitCard의 자체 기하 마스크는 부모(그리드) 이동을 상속하지 않으므로 스크롤 중에도
      // 매 프레임 월드 좌표로 다시 맞춘다 — 그러지 않으면 카드는 내려가도 원화는 예전 자리에
      // 그대로 남아 그리드와 어긋나 보인다.
      for (const card of grid.list as PortraitCard[]) card.syncMask();
    };
    this.ticker?.remove(false);
    this.ticker = this.scene.time.addEvent({ delay: 16, loop: true, callback: syncMask });
    syncMask();

    // 얇은 홈과 짧은 채움만 써 기존 HoloBar 계열처럼 외곽 판 없이 현재 위치를 보여 준다.
    const railX = GRID_VIEW.right + 8;
    // Phaser 도형은 CSS 문자열이 아니라 숫자 색을 받으므로 흐린 잉크와 같은 중성 회색을 사용한다.
    const rail = this.scene.add.rectangle(railX, (GRID_VIEW.top + GRID_VIEW.bottom) / 2, 3, viewportHeight, 0x8d939d, 0.22);
    const thumbHeight = contentHeight > viewportHeight ? Math.max(54, viewportHeight * viewportHeight / contentHeight) : viewportHeight;
    const thumb = this.scene.add.rectangle(railX, GRID_VIEW.top + thumbHeight / 2, 7, thumbHeight, COLOR.accent, contentHeight > viewportHeight ? 0.7 : 0.18);
    parent.add([rail, thumb]);
    const scrollTo = (value: number): void => {
      this.gridScrollY = Phaser.Math.Clamp(value, minScroll, 0);
      grid.setY(GRID_VIEW.top + this.gridScrollY);
      const progress = minScroll < 0 ? this.gridScrollY / minScroll : 0;
      thumb.setY(GRID_VIEW.top + thumbHeight / 2 + progress * (viewportHeight - thumbHeight));
    };
    scrollTo(this.gridScrollY);

    const inViewport = (pointer: Phaser.Input.Pointer): boolean => {
      const matrix = parent.getWorldTransformMatrix();
      const topLeft = matrix.transformPoint(GRID_VIEW.left, GRID_VIEW.top);
      const bottomRight = matrix.transformPoint(GRID_VIEW.right, GRID_VIEW.bottom);
      return pointer.x >= topLeft.x && pointer.x <= bottomRight.x && pointer.y >= topLeft.y && pointer.y <= bottomRight.y;
    };
    // 전역 포인터를 쓰면 카드 위에서 시작한 손짓도 자연스럽게 스크롤로 승격할 수 있다.
    this.gridPointerDownHandler = (pointer: Phaser.Input.Pointer) => {
      if (!inViewport(pointer) || minScroll === 0) return;
      this.gridDragging = true; this.gridDragMoved = 0; this.gridDragOrigin = this.gridScrollY - pointer.y;
    };
    this.gridPointerMoveHandler = (pointer: Phaser.Input.Pointer) => {
      if (!this.gridDragging || !pointer.isDown) return;
      this.gridDragMoved += Math.abs(pointer.velocity.y); scrollTo(this.gridDragOrigin + pointer.y);
    };
    this.gridPointerUpHandler = (pointer?: Phaser.Input.Pointer, objects?: Phaser.GameObjects.GameObject[]) => {
      this.gridDragging = false;
      this.scene.time.delayedCall(0, () => { this.gridDragMoved = 0; });
      // 판 안의 입력면 밖에서 뗀 손은 고른 칸을 푼다 — 표시가 계속 떠 있으면 다 고른 뒤에도
      // 할 일이 남은 것처럼 보인다. 슬롯·카드 위에서 뗀 손은 그 입력면의 일이다.
      void pointer;
      if ((objects?.length ?? 0) > 0 || this.selectedSlot === undefined || !this.draft) return;
      this.selectedSlot = undefined;
      this.paintSlotSelection();
    };
    this.scene.input.on("pointerdown", this.gridPointerDownHandler);
    this.scene.input.on("pointermove", this.gridPointerMoveHandler);
    this.scene.input.on("pointerup", this.gridPointerUpHandler);
    this.gridWheelHandler = (pointer, _objects, _deltaX, deltaY) => { if (inViewport(pointer)) scrollTo(this.gridScrollY - deltaY); };
    this.scene.input.on("wheel", this.gridWheelHandler);
  }

  /** 편집 중 제목이 말하는 것. 선택만 바뀌어도 이 한 줄은 따라와야 한다. */
  private editTitleText(): string {
    if (this.saving) return t("excavation.formationSaving");
    return this.selectedSlot === undefined ? t("excavation.editTitle") : t("excavation.editTitleSlot", { slot: this.selectedSlot + 1 });
  }

  /**
   * 고른 칸만 다시 그린다.
   *
   * **아래 칸의 그리드는 건드리지 않는다.** 칸을 하나 누를 때마다 목록을 통째로 다시 만들면
   * 스크롤이 처음으로 돌아가고 카드 수십 장이 한 프레임에 새로 태어난다 — 정작 바뀐 것은
   * "어디에 세울지" 하나뿐이다.
   */
  private paintSlotSelection(editable = Boolean(this.draft)): void {
    this.slotPlateLayer?.removeAll(true);
    this.slotChromeLayer?.removeAll(true);
    this.slotSelectionAppliers.forEach((apply, index) => apply(editable && index === this.selectedSlot));
    if (this.editTitle) {
      const label = this.editTitle.list.find((child): child is Phaser.GameObjects.Text => child instanceof Phaser.GameObjects.Text);
      label?.setText(this.editTitleText());
    }
    this.rosterLabel?.setText(this.selectedSlot === undefined ? t("excavation.ownedRelics") : t("excavation.ownedRelicsForSlot", { slot: this.selectedSlot + 1 }));
    setDebugIdleExcavationSlots(
      [0, 1, 2].map((index) => ({ index, x: BASE_WIDTH / 2 - 250 + index * 250, y: BASE_HEIGHT / 2 + STATUS_HERO.slotY, width: 210, height: 245 })),
      editable ? this.selectedSlot : undefined,
    );
    const index = this.selectedSlot;
    if (!editable || index === undefined) return;
    const box = { x: -250 + index * 250, y: STATUS_HERO.slotY, width: 210, height: 245 };
    if (this.slotPlateLayer) addFormationSlotSelection(this.scene, this.slotPlateLayer, box);
    // 빼는 표식은 고른 칸에 누군가 서 있을 때만 선다.
    if (this.slotChromeLayer && this.draft?.[index]) {
      addFormationRemoveChip(this.scene, this.slotChromeLayer, box, () => {
        if (this.saving || !this.draft) return;
        this.draft = tapFormationSlot(this.draft, index, this.selectedSlot, "clear").formation as Formation;
        this.selectedSlot = index;
        this.refreshEditorSlots();
      });
    }
  }

  /** 편성이 바뀌었을 때만 슬롯 카드와 SD를 다시 세운다. 아래 칸의 그리드는 그대로 둔다. */
  private refreshEditorSlots(): void {
    if (!this.draft) return;
    this.renderUpper(this.draft, true);
    for (const [relicId, card] of this.rosterCards) card.setSelected(this.draft.includes(relicId));
  }

  /** 슬롯은 빈 판만 그리고 그 위에 SD가 선다. 어느 칸이 편집 대상인지는 밑판·확대가 알린다. */
  private addSlots(parent: Phaser.GameObjects.Container, formation: Formation, editable: boolean): void {
    this.formationDragVisual?.destroy(); this.formationDragVisual = undefined;
    const dragSlots: FormationDragSlot[] = [];
    this.slotSelectionAppliers.length = 0;
    formation.forEach((id, index) => {
      const x = -250 + index * 250;
      const relic = id ? RELICS.find((item) => item.id === id) : undefined;
      // **칸에는 카드가 아니라 SD가 선다.** 예전에는 카드를 먼저 세우고 SD가 도착하면 감췄는데,
      // 한 자리를 바꿀 때마다 세 칸이 카드로 돌아갔다가 다시 SD가 되어 화면이 통째로 새로고침
      // 되는 것처럼 보였다. 칸은 빈 판만 그리고, 그 위에 SD가 살아남은 채로 자리만 옮긴다.
      const slot = this.scene.add.container(x, STATUS_HERO.slotY);
      // 칸의 밑판·발밑 그림자·빈 자리 번호는 네 편성 화면이 공유하는 한 장이다.
      addFormationSlotPlate(this.scene, slot, { x: 0, y: 0, width: 210, height: 245 }, {
        accent: COLOR.accent, occupied: Boolean(relic), index, groundOffset: SLOT_GROUND_OFFSET,
      });
      parent.add(slot);
      // 테두리 색으로 선택을 알리지 않는다 — 뒤에 깔리는 밑판이 이미 그 말을 하고, 색을 바꾸려면
      // 도형을 다시 그려야 해서 선택만 바뀌어도 판을 새로 만들게 된다.
      this.slotSelectionAppliers.push((selected) => slot.setScale(selected ? 1.06 : 1));
      // SD보다 나중에 추가한 투명 전용 입력면이 현황/편집의 동일한 210×245 슬롯 계약을 소유한다.
      const hit = this.scene.add.rectangle(x, STATUS_HERO.slotY, 210, 245, 0xffffff, 0).setName(`idle-excavation-slot-${index + 1}`).setDepth(100).setInteractive({ useHandCursor: true });
      parent.add(hit);
      dragSlots.push({ hit, x: POPUP_CENTER.x - 250 + index * 250, y: POPUP_CENTER.y + STATUS_HERO.slotY, width: 210, height: 245 });
    });
    this.paintSlotSelection(editable);
    // Puppet은 body의 로컬 좌표에 서며 renderer가 팝업의 변환과 alpha를 최종 화면에 합성한다.
    this.formationDragVisual = createFormationDragVisualController({
      scene: this.scene, slots: dragSlots, formation: () => formation, color: COLOR.accent,
      zoneDepth: SD_DEPTH - 1, dimDepth: SD_DEPTH - 2,
      renderPreview: ({ preview, pointer }) => formation.forEach((relicId, index) => {
        if (!relicId) return;
        const puppet = this.sdPuppetByRelicId.get(relicId); if (!puppet) return;
        const lifted = preview[index]?.lifted;
        const target = preview.findIndex((entry) => entry.relicId === relicId);
        // 포인터는 화면 좌표이므로 드래그 중일 때만 SD 레이어의 로컬 좌표로 역변환한다.
        const localPointer = layerScreenToLocal(this.sdContainer, pointer.x, pointer.y);
        const x = lifted ? localPointer.x : -250 + (target < 0 ? index : target) * 250;
        const groundY = lifted ? localPointer.y + 245 / 2 : STATUS_HERO.slotY + SLOT_GROUND_OFFSET;
        placePuppet(puppet, this.puppetLoader.assetFor(relicId), { x, groundY, height: lifted ? 205 * FORMATION_DRAG_VISUAL.liftScale : 205 });
        puppet.setDepth(lifted ? SD_DEPTH + 2 : SD_DEPTH).setAlpha(lifted ? FORMATION_DRAG_VISUAL.liftAlpha : target === index ? 1 : FORMATION_DRAG_VISUAL.previewAlpha);
      }),
      restore: () => formation.forEach((relicId, index) => {
        if (!relicId) return;
        const puppet = this.sdPuppetByRelicId.get(relicId); if (!puppet) return;
        placePuppet(puppet, this.puppetLoader.assetFor(relicId), { x: -250 + index * 250, groundY: STATUS_HERO.slotY + SLOT_GROUND_OFFSET, height: 205 });
        puppet.setDepth(SD_DEPTH).setAlpha(1);
      }),
      onVisualState: (state) => setDebugFormationDragVisual(state ? { owner: "excavation", ...state } : undefined),
    });
    bindFormationDrag(this.scene, dragSlots, {
      // 현황에서는 짧은 탭만 편집을 열며, 순서 드래그는 draft가 존재하는 편집 중에만 허용한다.
      dragStart: (slot, x, y) => this.formationDragVisual?.beginDrag(slot, x, y),
      dragMove: (slot, x, y) => this.formationDragVisual?.moveDrag(slot, x, y),
      cancel: () => this.formationDragVisual?.endDrag(),
      tap: (index) => {
        if (this.gridDragging || this.gridDragMoved >= GRID_DRAG_SLOP || this.saving) return;
        if (!editable) { this.beginEdit(index); return; }
        if (!this.draft) return;
        // 편집 중의 짧은 탭은 그 칸을 **고르기만** 한다. 이미 골라 둔 칸을 한 번 더 눌러야 비고,
        // 그때도 뒤 칸은 당겨지지 않는다. 고르기만 했다면 목록은 손대지 않는다.
        const result = tapFormationSlot(this.draft, index, this.selectedSlot);
        this.draft = result.formation as Formation;
        this.selectedSlot = result.selectedSlot;
        if (result.cleared) this.refreshEditorSlots();
        else this.paintSlotSelection();
      },
      drop: (from, to) => {
        this.formationDragVisual?.endDrag();
        if (!editable || !this.draft || this.saving) return;
        this.draft = moveFormationSlot(this.draft, from, to) as Formation;
        this.selectedSlot = to;
        // 저장 전에는 서버 응답과 Session을 건드리지 않고 슬롯 줄만 다시 세운다.
        this.refreshEditorSlots();
      },
    }, { enabled: () => !this.saving, canDrag: () => editable });
  }

  /** 현황 전용 Puppet/tween을 중복 파괴 없이 비우고 진행 중 로딩도 무효화한다. */
  private clearStatusSD(): void {
    this.sdLoadGeneration += 1;
    this.sdLoading.clear();
    for (const tween of this.sdTweens) tween.stop();
    this.sdTweens.clear();
    // Container의 destroy(true)가 같은 Puppet을 다시 순회하지 않도록 먼저 소유권에서 떼고 폐기한다.
    for (const puppet of this.sdPuppets) { this.sdContainer?.remove(puppet, false); puppet.destroy(); }
    this.sdPuppets.clear();
    this.sdPuppetByRelicId.clear();
    this.sdContainer?.destroy(true); this.sdContainer = undefined;
  }

  /**
   * 편성이 바뀐 만큼만 SD를 손본다.
   *
   * **이미 선 SD는 살려 두고 자리만 옮긴다.** 예전에는 편성이 한 글자라도 다르면 세 SD를 통째로
   * 버리고 다시 읽어, 2번 칸을 바꿔도 1·3번이 함께 사라졌다가 카드로 한 번 나타난 뒤 SD로
   * 돌아왔다. 버릴 때는 그 렐릭이 편성에서 빠질 때뿐이다.
   *
   * SD 레이어는 팝업 body의 자식이고 Puppet은 그 로컬 좌표를 쓴다. indexed renderer가 body의
   * 이동·배율·회전·alpha와 카메라를 합성하므로 팝업과 Puppet이 하나의 시각 계층으로 움직인다.
   */
  private syncStatusSD(formation: Formation): void {
    const body = this.body;
    if (!body) return;
    if (!this.sdContainer) {
      this.sdContainer = this.scene.add.container(0, 0).setName("idle-excavation-confirmed-sd").setDepth(SD_DEPTH);
      body.add(this.sdContainer);
    }
    const layer = this.sdContainer;
    // 편성에서 빠진 렐릭의 SD와 그 도약만 폐기한다.
    for (const [relicId, puppet] of this.sdPuppetByRelicId) {
      if (formation.includes(relicId)) continue;
      layer.remove(puppet, false); puppet.destroy();
      this.sdPuppets.delete(puppet);
      this.sdPuppetByRelicId.delete(relicId);
    }
    const generation = ++this.sdLoadGeneration;
    formation.forEach((relicId, index) => {
      if (!relicId) return;
      const x = -250 + index * 250;
      const groundY = STATUS_HERO.slotY + SLOT_GROUND_OFFSET;
      const standing = this.sdPuppetByRelicId.get(relicId);
      if (standing) {
        placePuppet(standing, this.puppetLoader.assetFor(relicId), { x, groundY, height: 205 });
        standing.setDepth(SD_DEPTH).setAlpha(1);
        return;
      }
      if (this.sdLoading.has(relicId)) return;
      this.sdLoading.add(relicId);
      void this.loadStatusPuppet(relicId, index, x, groundY, generation, layer)
        .finally(() => this.sdLoading.delete(relicId));
    });
  }

  /** 로딩 완료 시 현재 세대인지 재검증하며, 늦게 도착한 결과는 컨테이너에 넣지 않고 즉시 폐기한다. */
  private async loadStatusPuppet(relicId: string, index: number, x: number, groundY: number, generation: number, layer: Phaser.GameObjects.Container): Promise<void> {
    let asset;
    try { asset = this.puppetLoader.assetFor(relicId); } catch (error) {
      if (import.meta.env.DEV) console.warn(`[IdleExcavation] SD asset lookup failed (relic=${relicId}, asset=unresolved)`, error);
      return;
    }
    const result = await loadOwnedPuppet({
      spawn: () => this.puppetLoader.spawn(this.scene, asset, { x, groundY, height: 205, depth: SD_DEPTH }),
      // 판이 다시 그려져도 SD는 살아남는다. 늦게 온 결과는 그 렐릭이 아직 편성에 있을 때만 받는다.
      isCurrent: () => Boolean(this.body) && generation <= this.sdLoadGeneration && layer === this.sdContainer,
      // ZIP은 열렸는데 텍스처가 없는 묶음만 걸러 낸다. 그 뒤의 가시성은 이 레이어가 통째로 책임진다.
      isDisplayable: (puppet) => Boolean(puppet.active && puppet.texture?.key && this.scene.textures.exists(puppet.texture.key)),
      adopt: (puppet) => {
        // Puppet는 장식 레이어다. 내부 Image가 향후 interactive로 내보내져도 슬롯 입력면을 가로채지 않는다.
        puppet.disableInteractive();
        // 방치 정산은 서버 시간을 그대로 쓰고, 화면에 세운 장식 SD의 갱신 빈도만 낮춘다.
        puppet.setDecorativeUpdateFactor(powerSavingPolicy(session.settings).idlePuppetUpdateFactor);
        layer.add(puppet); this.sdPuppets.add(puppet);
        this.sdPuppetByRelicId.set(relicId, puppet);
        setDebugIdleExcavationSdReady(index);
        // 통통 튀는 모션은 파견과 나눠 쓰는 공용 규칙 하나가 갖는다. 여기서는 칸 번호만 준다.
        this.sdTweens.add(startPuppetHop(this.scene, puppet, index));
      },
    });
    // Puppet 실패는 슬롯 전체의 실패가 아니다. 개발 경고만 남기고 빈 판을 그대로 둔다.
    if (import.meta.env.DEV && result.status === "failed") console.warn(`[IdleExcavation] SD puppet spawn failed (relic=${relicId}, asset=${asset.url})`, result.error);
    if (import.meta.env.DEV && result.status === "discarded" && result.reason === "not-displayable") console.warn(`[IdleExcavation] SD puppet is not displayable (relic=${relicId}, asset=${asset.url})`);
  }

  /** 해당 재화 생산에 기여한 SD가 통 튀고 머리 위 기존 이미지 아이콘이 떠올랐다 사라진다. */
  private playProductionTick(currency: ExcavationCurrency): void {
    const contributors = excavationProductionDisplayModel(this.confirmed?.excavation.assignedRelicIds ?? [null, null, null], RELICS, session.relicProgress).relics.filter((item) => item.currency === currency);
    for (const contributor of contributors) {
      const puppet = this.sdPuppetByRelicId.get(contributor.relicId);
      if (!puppet || !this.sdContainer) continue;
      const icon = this.scene.add.image(puppet.x, puppet.y - 165, EXCAVATION_CURRENCY_ICON[currency]).setDisplaySize(42, 42).setAlpha(0);
      this.sdContainer.add(icon);
      // 생산 반응의 이동 거리도 같은 공용 배율을 써 팝업만 별도 강도를 만들지 않는다.
      const motion = motionPolicy(session.settings);
      this.scene.tweens.add({ targets: puppet, scaleX: puppet.scaleX * (1 + 0.1 * motion.nonEssentialDistanceFactor), scaleY: puppet.scaleY * (1 + 0.1 * motion.nonEssentialDistanceFactor), duration: 130, yoyo: true, ease: "Back.easeOut" });
      this.scene.tweens.add({ targets: icon, y: icon.y - 55 * motion.nonEssentialDistanceFactor, alpha: { from: 1, to: 0 }, duration: 720, ease: "Sine.easeOut", onComplete: () => icon.destroy() });
    }
  }

  /** 완료는 한 요청 동안 모든 입력을 막고 성공 응답을 받은 뒤에만 확정 편성과 세션을 바꾼다. */
  private async saveDraft(): Promise<void> {
    if (!this.draft || this.saving) return;
    this.saving = true; this.renderEditor();
    const submitted = copyFormation(this.draft);
    try {
      const response = await this.api.saveExcavationFormation({ requestId: requestId(), assignedRelicIds: submitted });
      if (!this.body) return;
      this.confirmed = response;
      session.idleExcavation = { ...response.excavation, assignedRelicIds: copyFormation(response.excavation.assignedRelicIds), unclaimed: { ...response.excavation.unclaimed } };
      this.draft = undefined; this.saving = false; this.renderStatus();
    } catch {
      if (!this.body) return;
      this.saving = false; this.renderEditor(t("excavation.formationFailed"));
    }
  }

  /** 현황 화면의 수확만 서버를 거치며 편집 중에는 완료 버튼이 같은 최하단 자리를 대신한다. */
  private async harvest(): Promise<void> {
    if (this.saving) return;
    this.saving = true; this.harvestError = undefined; this.renderStatus();
    // 네트워크 실패 뒤 사용자가 다시 누르면 최초 요청의 ID를 그대로 재전송한다.
    this.harvestRequestId ??= requestId();
    try {
      const result = await this.api.harvestExcavation({ requestId: this.harvestRequestId });
      if (!this.body) return;
      session.wallet = { ...result.wallet };
      session.idleExcavation = { ...result.excavation, assignedRelicIds: copyFormation(result.excavation.assignedRelicIds), unclaimed: { ...result.excavation.unclaimed } };
      this.confirmed = result; this.saving = false; this.harvestRequestId = undefined; this.harvestResult = result; this.renderStatus();
      // 성공 수확만 알림 해제 계기가 되며 manager가 새 서버 잔량을 즉시 다시 확정한다.
      void notificationManager.refresh().catch(() => undefined);
    } catch {
      if (!this.body) return;
      this.saving = false; this.harvestError = t("excavation.harvestFailed"); this.renderStatus();
    }
  }

  private setState(state: NonNullable<Parameters<typeof setDebugIdleExcavationPopup>[0]>): void {
    // Canvas 안 상태를 E2E가 사용자 가시 단계 이름으로만 관찰하도록 실제 편성 데이터는 노출하지 않는다.
    this.body?.setData("state", state); setDebugIdleExcavationPopup(state);
  }

  /** 타이머와 임시 편성을 버리며 서버에서 받은 confirmed 객체는 외부 상태에 역으로 쓰지 않는다. */
  private dispose(): void {
    this.formationDragVisual?.destroy(); this.formationDragVisual = undefined; setDebugFormationDragVisual(undefined);
    this.requestGeneration++; this.statusBackground?.destroy(); this.statusBackground = undefined; this.clearStatusSD(); this.ticker?.remove(false); this.ticker = undefined;
    // PopupLayer가 본체를 먼저 파괴하므로 씬에 직접 등록한 스크롤 자원은 종료 콜백에서 별도로 치운다.
    this.gridMask?.destroy(); this.gridMask = undefined;
    if (this.gridWheelHandler) this.scene.input.off("wheel", this.gridWheelHandler);
    if (this.gridPointerDownHandler) this.scene.input.off("pointerdown", this.gridPointerDownHandler);
    if (this.gridPointerMoveHandler) this.scene.input.off("pointermove", this.gridPointerMoveHandler);
    if (this.gridPointerUpHandler) this.scene.input.off("pointerup", this.gridPointerUpHandler);
    this.gridWheelHandler = undefined; this.gridPointerDownHandler = undefined; this.gridPointerMoveHandler = undefined; this.gridPointerUpHandler = undefined;
    this.draft = undefined; this.body = undefined; this.content = undefined; this.upper = undefined; this.lower = undefined; this.closeAction = undefined; this.messageShown = false;
    setDebugIdleExcavationPopup(undefined); setDebugIdleExcavationSlots(undefined); setDebugIdleExcavationControls(undefined); this.onClosed?.();
  }
}
