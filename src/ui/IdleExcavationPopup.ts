import Phaser from "phaser";
import type { AdOperationsConfigResponse, AdPresentationResult, AdSlotOperationsDto, GameApi, HarvestExcavationResponse, IdleExcavationResponse } from "../api/contracts";
import { EXCAVATION_CURRENCIES, excavationProductionDisplayModel, placeExcavationRelic, type ExcavationCurrency, type IdleExcavationState } from "../core/idleExcavation";
import { RELICS } from "../data/relics";
import { portraitUsesRelicTint, sdAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { tintFor } from "../puppets/tints";
import { session } from "../state/session";
import { setDebugExcavationAdOffers, setDebugIdleExcavationPopup, setDebugIdleExcavationSdReady, setDebugIdleExcavationSlots } from "../debug";
import { Button } from "./Button";
import { chipPoints, drawHairline, drawLayer, HOLO, slantedRect } from "./holo";
import { PortraitCard } from "./PortraitCard";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { EXCAVATION_TRAIT_ICON } from "./excavationIcons";
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

/** 한 팝업 안에서 현황과 편집 그리드가 교대하므로 모바일 안전 영역을 넘지 않는 고정 크기를 쓴다. */
const PANEL = { width: 900, height: 1320 } as const;
/** 보유 렐릭은 이 창 안에서만 세로로 흐르며 상단 슬롯과 하단 완료 버튼을 침범하지 않는다. */
const GRID_VIEW = { left: -370, right: 370, top: -145, bottom: 425, columnGap: 250, rowGap: 280, cardWidth: 215, cardHeight: 235 } as const;
/** 손가락이 이 거리 이상 움직여야 카드 선택이 아니라 스크롤로 판정한다. */
const GRID_DRAG_SLOP = 12;
/** 팝업 판(PopupLayer 기본 2000) 바로 위. 그 위에 열리는 보상 팝업(2002)보다는 아래에 남는다. */
const SD_DEPTH = 2001;
/** 원화는 별도 액자를 만들지 않고 PopupLayer 판의 비대칭 실루엣에 직접 맞춘다. */
const POPUP_ART_SHAPE = chipPoints(PANEL.width - 24, PANEL.height - 24, { bevel: { topLeft: 118, bottomRight: 118 } });
/** 좁은 안전 영역에서도 팝업 제목·닫기와 겹치지 않는 현황 히어로의 고정 세로 범위다. */
const STATUS_HERO = { x: 0, y: -385, width: 800, height: 300, headerY: -570, slotY: -385 } as const;
type Formation = IdleExcavationState["assignedRelicIds"];

/** SD 비동기 경계를 테스트에서 성공·실패·지연 완료로 바꿀 수 있게 좁게 주입한다. */
export interface StatusPuppetLoader {
  assetFor: typeof sdAssetFor;
  spawn: typeof spawnPuppet;
}

const DEFAULT_STATUS_PUPPET_LOADER: StatusPuppetLoader = { assetFor: sdAssetFor, spawn: spawnPuppet };

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

/** PopupLayer 한 장 안에서 서버 확정 편성과 임시 편집 편성의 생명주기를 소유한다. */
export class IdleExcavationPopup {
  private body?: Phaser.GameObjects.Container;
  private content?: Phaser.GameObjects.Container;
  /** 히어로 원화의 컨테이너 밖 마스크/이벤트까지 reset 때 함께 폐기한다. */
  private statusBackground?: PopupBackgroundImage;
  /** 현황 SD만 담아 카드/편집 UI와 비동기 수명을 분리하는 전용 레이어다. */
  private sdContainer?: Phaser.GameObjects.Container;
  private readonly sdPuppets = new Set<PuppetCreature>();
  /** 생산 틱 연출이 해당 기여 렐릭을 바로 찾도록 ID별 SD 참조를 보관한다. */
  private readonly sdPuppetByRelicId = new Map<string, PuppetCreature>();
  private readonly sdTweens = new Set<Phaser.Tweens.Tween>();
  /** 재렌더나 닫기 전 시작된 Puppet 로딩 결과가 새 현황에 섞이지 않게 하는 세대 번호다. */
  private sdLoadGeneration = 0;
  private confirmed?: IdleExcavationResponse;
  private draft?: Formation;
  private selectedSlot = 0;
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
    this.body = this.popups.open({ width: PANEL.width, height: PANEL.height, title: "발굴", titleSize: 34, dim: true, closeOnBackdrop: false, hideCloseButton: true, onClose: () => this.dispose() }, (body, close) => {
      this.closeAction = close;
      body.setName("idle-excavation-popup");
      this.showMessage("발굴 현황을 정산하고 있습니다…", "loading");
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
      this.showMessage("발굴 기록을 불러오지 못했습니다.", "error", true);
    }
  }

  /** 다시 그릴 때 PortraitCard의 외부 마스크까지 명시적으로 함께 정리한다. */
  private resetContent(): Phaser.GameObjects.Container | undefined {
    // 팝업 배경 helper의 GeometryMask는 content 자식이 아니므로 자식 파괴보다 먼저 정리한다.
    this.statusBackground?.destroy(); this.statusBackground = undefined;
    // SD는 content 바깥 GPU 자원과 tween을 가지므로 화면 자식 파괴에 기대지 않고 한 번만 정리한다.
    this.clearStatusSD();
    // 편집 그리드의 GeometryMask와 씬 입력 리스너는 content 자식이 아니므로 화면 교체 전에 직접 뗀다.
    this.gridMask?.destroy(); this.gridMask = undefined;
    if (this.gridWheelHandler) this.scene.input.off("wheel", this.gridWheelHandler);
    if (this.gridPointerDownHandler) this.scene.input.off("pointerdown", this.gridPointerDownHandler);
    if (this.gridPointerMoveHandler) this.scene.input.off("pointermove", this.gridPointerMoveHandler);
    if (this.gridPointerUpHandler) this.scene.input.off("pointerup", this.gridPointerUpHandler);
    this.gridWheelHandler = undefined;
    this.gridPointerDownHandler = undefined; this.gridPointerMoveHandler = undefined; this.gridPointerUpHandler = undefined;
    this.ticker?.remove(false); this.ticker = undefined;
    this.content?.destroy(true);
    if (!this.body) return undefined;
    this.content = this.scene.add.container(0, 0);
    this.body.add(this.content);
    return this.content;
  }

  private showMessage(message: string, state: "loading" | "error", retry = false): void {
    const content = this.resetContent();
    if (!content || !this.body) return;
    // 상태 문구는 비워 둔 액자 중앙에 놓아 로딩 피드백이 제목이나 닫기 조작을 가리지 않는다.
    content.add(this.scene.add.text(0, 20, message, textStyle({ role: "body", size: 28, color: state === "error" ? COLOR.dangerText : COLOR.inkDim })).setOrigin(0.5));
    if (retry) content.add(new Button(this.scene, 0, 65, { width: 260, height: 82, label: "다시 시도", onClick: () => { this.showMessage("발굴 현황을 정산하고 있습니다…", "loading"); void this.fetch(); } }));
    this.setState(state);
  }

  /** 확정 편성 기준 현황이다. 표시 누적량만 매초 예상하고 서버 상태나 세션은 바꾸지 않는다. */
  private renderStatus(): void {
    const response = this.confirmed;
    const content = this.resetContent();
    if (!response || !content) return;
    const formation = response.excavation.assignedRelicIds;
    const rate = excavationProductionDisplayModel(formation, RELICS, session.relicProgress).totalsPerHour;
    // 1순위 발굴대 상태: 전용 원화를 팝업 전체에 한 장으로 깔아 히어로와 조작부를 끊지 않는다.
    if (this.scene.textures.exists(BACKGROUND.excavation)) {
      this.statusBackground = addPopupBackgroundImage(this.scene, content, BACKGROUND.excavation, { x: 0, y: 0, width: PANEL.width - 24, height: PANEL.height - 24, maskShape: POPUP_ART_SHAPE });
    }
    const headerState = this.saving ? "수확 처리 중…" : "발굴 진행 중";
    // 진행 문구는 일반 강조, 배치 수는 같은 행의 얇은 보조 정보로 두어 제목 위계를 만들지 않는다.
    content.add(this.scene.add.text(-360, STATUS_HERO.headerY, headerState, textStyle({ role: "emphasis", size: 27, color: COLOR.accentText })).setOrigin(0, 0.5));
    content.add(this.scene.add.text(-160, STATUS_HERO.headerY, `배치 ${formation.filter(Boolean).length}/3`, textStyle({ role: "body", size: 18, color: COLOR.inkDim })).setOrigin(0, 0.5));
    content.add(drawHairline(this.scene, 0, -535, 760, { color: COLOR.accent, alpha: 0.42 }));
    // 2순위 작업 중 SD/슬롯: 현황에서도 칸 자체가 편성 그리드의 유일한 진입점이다.
    const slotCards = this.addSlots(content, formation, false);
    // draft 편집에는 SD를 만들지 않는다. 서버 확정값을 그리는 현황에서만 비동기 세대를 시작한다.
    this.loadStatusSD(formation, slotCards);
    const baseServerMs = new Date(response.serverTime).getTime();
    let harvestButton: Button | undefined;
    // 발굴 전용 액자는 큰 누적값을, 아래의 독립 칩은 같은 아이콘과 생산 속도만 책임진다.
    // 3순위 누적 보상: SD 아래에서 현재 수확량과 시간당 생산량을 한 번에 훑는다.
    content.add(drawLayer(this.scene, 0, 30, slantedRect(800, 205), { fill: COLOR.panel, alpha: HOLO.glassLight, edge: COLOR.accent, edgeAlpha: 0.42 }));
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
      // 틱에서는 프리팹의 Text만 바꾼다. 이미지와 불투명 요약 레이어는 재생성하지 않는다.
      for (const row of rows) {
        const amount = response.excavation.unclaimed[row.currency] + rate[row.currency] * elapsedHours;
        row.frame.setValues(amount, row.rate);
        // 정수 단위가 실제로 증가한 틱에만 기여 렐릭의 SD와 자원 아이콘으로 생산 피드백을 준다.
        if (Math.floor(amount) > row.previousAmount) this.playProductionTick(row.currency);
        row.previousAmount = Math.floor(amount);
      }
      // 창을 열어 둔 사이 정수 1개가 쌓이는 순간에도 새 조회 없이 버튼 상태만 정확히 갱신한다.
      const harvestable = EXCAVATION_CURRENCIES.some((currency) => Math.floor(response.excavation.unclaimed[currency] + rate[currency] * elapsedHours) > 0);
      harvestButton?.setEnabled(harvestable && !this.saving);
      // 비활성 이유를 누적 0 또는 가장 빠른 재화의 다음 정수 생산 시각으로 짧게 설명한다.
      const seconds = EXCAVATION_CURRENCIES.map((currency) => {
        const current = response.excavation.unclaimed[currency] + rate[currency] * elapsedHours;
        return rate[currency] > 0 ? Math.max(0, Math.ceil((1 - current) / rate[currency] * 3600)) : Number.POSITIVE_INFINITY;
      });
      const next = Math.min(...seconds);
      availability.setText(harvestable ? "현재 누적 보상을 수확할 수 있습니다." : Number.isFinite(next) ? `현재 누적 0 · 다음 수확까지 약 ${Math.max(1, Math.ceil(next / 60))}분` : "현재 누적 0 · 렐릭을 배치하면 생산이 시작됩니다.");
    };
    refreshEstimate();
    this.ticker?.remove(false);
    this.ticker = this.scene.time.addEvent({ delay: 1000, loop: true, callback: refreshEstimate });
    content.add(drawHairline(this.scene, 0, 180, 760, { color: COLOR.accent, alpha: 0.25 }));
    const result = this.harvestResult;
    const discarded = result ? EXCAVATION_CURRENCIES.reduce((sum, currency) => sum + result.discarded[currency], 0) : 0;
    const notice = this.harvestError ?? (discarded > 0 ? "수확 완료 · 지갑 상한 손실" : result ? "수확이 완료되었습니다." : "빈 슬롯은 허용되며 생산량 0으로 계산됩니다.");
    content.add(this.scene.add.text(0, 250, notice, textStyle({ role: "body", size: 21, color: discarded > 0 || this.harvestError ? COLOR.dangerText : COLOR.inkDim, align: "center" })).setOrigin(0.5));
    this.addAdOffers(content, response.serverTime);
    // 5순위 주요 행동: 별도 편성 버튼은 없애고, 하단 전체 폭은 수확 primary 하나에만 준다.
    harvestButton = new Button(this.scene, 0, 545, { width: 520, height: 98, label: this.saving ? "수확 중…" : "수확", variant: "primary", onClick: () => void this.harvest() });
    // 서버 확정 누적량이 1 미만이거나 요청 중이면 지급할 것이 없으므로 입력부터 막는다.
    refreshEstimate(); content.add(harvestButton);
    this.setState(this.saving ? "saving" : "ready");
    if (result) {
      // 서버 확정 지급분만 공용 획득 팝업에 넘긴다. 지갑 상한 손실은 현황 경고로 남기고 보상처럼 꾸미지 않는다.
      openRewardPopup(this.scene, this.popups, {
        title: "발굴 보상 획득",
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
    if (!this.presentAd || this.saving) { this.adMessage = "광고를 이용할 수 없어도 일반 수확은 계속할 수 있습니다."; this.renderStatus(); return; }
    const presentation = await this.presentAd(slot.slotId);
    const verificationToken = completedAdToken(presentation);
    if (!verificationToken) { this.adMessage = "광고가 취소되었거나 준비되지 않았습니다. 일반 수확을 이용해 주세요."; this.renderStatus(); return; }
    try {
      const result = await this.api.claimAdReward({ slotId: slot.slotId, verificationToken, requestId: requestId() });
      if (result.excavation) session.idleExcavation = { ...result.excavation, assignedRelicIds: copyFormation(result.excavation.assignedRelicIds), unclaimed: { ...result.excavation.unclaimed } };
      session.dailyAdRewards = { date: result.dailyAdRewards.date, claimsBySlot: { ...result.dailyAdRewards.claimsBySlot }, requestIds: session.dailyAdRewards.requestIds };
      this.confirmed = { excavation: result.excavation ?? session.idleExcavation, serverTime: result.serverTime }; this.adMessage = "발굴 효과가 적용되었습니다."; this.renderStatus();
    } catch { this.adMessage = "광고 검증에 실패했습니다. 일반 수확은 그대로 가능합니다."; this.renderStatus(); }
  }

  /** 편집을 열 때에만 확정 배열을 복사하므로 취소/닫기가 서버 편성을 건드릴 수 없다. */
  private beginEdit(slot = 0): void {
    if (!this.confirmed || this.saving) return;
    this.draft = copyFormation(this.confirmed.excavation.assignedRelicIds);
    this.selectedSlot = slot;
    this.gridScrollY = 0;
    this.renderEditor();
  }

  /** 상단 슬롯과 보유 렐릭 그리드는 동일한 draft를 보되 저장 성공 전에는 confirmed에 쓰지 않는다. */
  private renderEditor(error?: string): void {
    const content = this.resetContent();
    if (!content || !this.draft) return;
    this.ticker?.remove(false); this.ticker = undefined;
    // 편집 헤더도 현황과 같은 위치를 써 저장 네트워크 상태가 화면 위에서 즉시 보인다.
    addSectionTitle(this.scene, -380, STATUS_HERO.headerY, this.saving ? "편성 저장 중…" : `배치 편집 · 슬롯 ${this.selectedSlot + 1}/3`, { size: 23, parent: content });
    content.add(drawHairline(this.scene, 0, -535, 760, { color: COLOR.accent, alpha: 0.42 }));
    this.addSlots(content, this.draft, true);
    content.add(this.scene.add.text(-360, -185, "보유 렐릭 · 선택한 슬롯에 배치", textStyle({ role: "emphasis", size: 23, color: COLOR.accentText })).setOrigin(0, 0.5));
    content.add(this.scene.add.text(360, -185, "빈 칸 이동 · 찬 칸 자리 교체 · 같은 카드 재선택 해제", textStyle({ role: "body", size: 17, color: COLOR.inkDim })).setOrigin(1, 0.5));
    const owned = RELICS.filter((relic) => session.owned.has(relic.id));
    const grid = this.scene.add.container(0, GRID_VIEW.top + this.gridScrollY);
    owned.forEach((relic, index) => {
      const x = -250 + (index % 3) * GRID_VIEW.columnGap;
      const y = GRID_VIEW.cardHeight / 2 + Math.floor(index / 3) * GRID_VIEW.rowGap;
      const detail = excavationProductionDisplayModel([relic.id, null, null], RELICS, session.relicProgress).relics[0];
      const progress = session.relicProgress[relic.id];
      const card = new PortraitCard(this.scene, x, y, { width: GRID_VIEW.cardWidth, height: GRID_VIEW.cardHeight, portraitAssetId: relic.portraitAssetId, tint: portraitUsesRelicTint(relic.portraitAssetId) ? tintFor(relic.id) : undefined, label: relic.name, level: progress?.level ?? 1, rarity: relic.rarity, stars: (progress?.breakthrough ?? 0) + 1, subIcon: EXCAVATION_TRAIT_ICON[relic.excavationTrait.primaryCurrency], sub: formatRate(detail?.totalPerHour ?? 0) });
      card.setSelected(this.draft!.includes(relic.id));
      card.hit.on("pointerup", () => { if (this.saving || !this.draft || this.gridDragMoved > GRID_DRAG_SLOP) return; this.draft = placeExcavationRelic(this.draft, this.selectedSlot, relic.id); this.renderEditor(); });
      grid.add(card);
    });
    content.add(grid);
    this.addGridScroll(content, grid, owned.length);
    if (error) content.add(this.scene.add.text(0, 455, error, textStyle({ role: "body", size: 22, color: COLOR.dangerText })).setOrigin(0.5));
    // 현황의 수확 자리와 같은 primary가 편집 중에만 '배치 완료' 역할로 전환된다.
    const cancel = new Button(this.scene, -280, 540, { width: 220, height: 82, label: "취소", onClick: () => { if (!this.saving) { this.draft = undefined; this.renderStatus(); } } });
    const done = new Button(this.scene, 125, 540, { width: 500, height: 92, label: this.saving ? "저장 중…" : "배치 완료", variant: "primary", onClick: () => void this.saveDraft() });
    cancel.setEnabled(!this.saving); done.setEnabled(!this.saving);
    content.add([cancel, done]);
    this.setState(this.saving ? "saving" : error ? "save-error" : "editing");
  }

  /** 보유 카드가 두 줄을 넘으면 드래그와 휠이 같은 연속 스크롤 값을 갱신한다. */
  private addGridScroll(parent: Phaser.GameObjects.Container, grid: Phaser.GameObjects.Container, relicCount: number): void {
    const viewportHeight = GRID_VIEW.bottom - GRID_VIEW.top;
    const rows = Math.ceil(relicCount / 3);
    const contentHeight = rows > 0 ? (rows - 1) * GRID_VIEW.rowGap + GRID_VIEW.cardHeight : 0;
    const minScroll = Math.min(0, viewportHeight - contentHeight);
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
    this.gridPointerUpHandler = () => { this.gridDragging = false; this.scene.time.delayedCall(0, () => { this.gridDragMoved = 0; }); };
    this.scene.input.on("pointerdown", this.gridPointerDownHandler);
    this.scene.input.on("pointermove", this.gridPointerMoveHandler);
    this.scene.input.on("pointerup", this.gridPointerUpHandler);
    this.gridWheelHandler = (pointer, _objects, _deltaX, deltaY) => { if (inViewport(pointer)) scrollTo(this.gridScrollY - deltaY); };
    this.scene.input.on("wheel", this.gridWheelHandler);
  }

  /** 슬롯은 빈 면과 PortraitCard를 구분하고 어느 칸이 편집 대상인지 확대/발광으로 알린다. */
  private addSlots(parent: Phaser.GameObjects.Container, formation: Formation, editable: boolean): Array<Phaser.GameObjects.Container | undefined> {
    const cards: Array<Phaser.GameObjects.Container | undefined> = [];
    formation.forEach((id, index) => {
      const x = -250 + index * 250;
      const relic = id ? RELICS.find((item) => item.id === id) : undefined;
      if (relic) {
        const progress = session.relicProgress[relic.id];
        const card = new PortraitCard(this.scene, x, STATUS_HERO.slotY, { width: 210, height: 245, portraitAssetId: relic.portraitAssetId, tint: portraitUsesRelicTint(relic.portraitAssetId) ? tintFor(relic.id) : undefined, label: relic.name, level: progress?.level ?? 1, rarity: relic.rarity, stars: (progress?.breakthrough ?? 0) + 1 });
        card.setSelected(editable && index === this.selectedSlot);
        // 카드 내부 hit는 카드 자체 용도로 남기되 슬롯 선택은 아래 공용 입력면 하나만 담당한다.
        card.hit.disableInteractive(); parent.add(card); cards[index] = card;
      } else {
        const empty = this.scene.add.container(x, STATUS_HERO.slotY);
        empty.add(drawLayer(this.scene, 0, 0, slantedRect(210, 245), { fill: COLOR.panel, alpha: HOLO.glassLight, edge: index === this.selectedSlot && editable ? COLOR.accent : COLOR.inkDimHex, edgeAlpha: 0.55 }));
        empty.add(this.scene.add.text(0, 0, `빈 슬롯\n${index + 1}`, textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim, align: "center" })).setOrigin(0.5));
        if (editable && index === this.selectedSlot) empty.setScale(1.06);
        parent.add(empty);
      }
      // SD보다 나중에 추가한 투명 전용 입력면이 현황/편집의 동일한 210×245 슬롯 계약을 소유한다.
      const hit = this.scene.add.rectangle(x, STATUS_HERO.slotY, 210, 245, 0xffffff, 0).setName(`idle-excavation-slot-${index + 1}`).setDepth(100).setInteractive({ useHandCursor: true });
      let pressed = false;
      hit.on("pointerdown", () => { pressed = true; hit.setScale(1.06); });
      hit.on("pointerout", () => { pressed = false; hit.setScale(1); });
      hit.on("pointerup", () => {
        hit.setScale(1);
        // 그리드가 스크롤로 승격된 포인터는 pointerup 뒤에 이어지는 클릭으로 슬롯을 바꾸지 않는다.
        if (!pressed || this.gridDragging || this.gridDragMoved >= GRID_DRAG_SLOP) { pressed = false; return; }
        pressed = false;
        if (this.saving) return;
        if (!editable) { this.beginEdit(index); return; }
        this.selectedSlot = index; this.renderEditor();
      });
      parent.add(hit);
    });
    setDebugIdleExcavationSlots(formation.map((_id, index) => ({ index, x: BASE_WIDTH / 2 - 250 + index * 250, y: BASE_HEIGHT / 2 + STATUS_HERO.slotY, width: 210, height: 245 })), editable ? this.selectedSlot : undefined);
    return cards;
  }

  /** 현황 전용 Puppet/tween을 중복 파괴 없이 비우고 진행 중 로딩도 무효화한다. */
  private clearStatusSD(): void {
    this.sdLoadGeneration += 1;
    for (const tween of this.sdTweens) tween.stop();
    this.sdTweens.clear();
    // Container의 destroy(true)가 같은 Puppet을 다시 순회하지 않도록 먼저 소유권에서 떼고 폐기한다.
    for (const puppet of this.sdPuppets) { this.sdContainer?.remove(puppet, false); puppet.destroy(); }
    this.sdPuppets.clear();
    this.sdPuppetByRelicId.clear();
    this.sdContainer?.destroy(true); this.sdContainer = undefined;
  }

  /**
   * 확정 슬롯의 카드 위에 SD가 준비된 자리만 교체하며 실패한 자리는 카드 미리보기를 보존한다.
   *
   * Puppet은 자신의 **화면 좌표**로 직접 그리는 GPU 개체라 컨테이너 이동·배율을 물려받지 않는다.
   * 팝업 본문(화면 가운데로 옮겨진 컨테이너) 안에 넣으면 국소 좌표 그대로 화면 왼쪽 위 바깥에
   * 그려져 아무것도 보이지 않는다. 그래서 SD만 원점에 선 별도 레이어에 세우고 좌표도 팝업 판의
   * 중심을 더한 화면 좌표로 넘긴다.
   */
  private loadStatusSD(formation: Formation, cards: Array<Phaser.GameObjects.Container | undefined>): void {
    // 로드 시작 자체가 새 세대다. clear 호출 횟수와 무관하게 이전 render와 같은 번호를 공유하지 않는다.
    const generation = ++this.sdLoadGeneration;
    const body = this.body;
    if (!body) return;
    const layer = this.scene.add.container(0, 0).setName("idle-excavation-confirmed-sd").setDepth(SD_DEPTH);
    this.sdContainer = layer;
    formation.forEach((relicId, index) => {
      if (!relicId) return;
      const x = body.x - 250 + index * 250;
      const groundY = body.y - 275;
      // 사방 테두리나 입체 판 대신 얇은 홀로그램 투영 그림자만 발 아래에 둔다.
      layer.add(this.scene.add.ellipse(x, groundY + 2, 172, 25, COLOR.accent, 0.16));
      void this.loadStatusPuppet(relicId, index, x, groundY, generation, layer, cards[index]);
    });
  }

  /** 로딩 완료 시 현재 세대인지 재검증하며, 늦게 도착한 결과는 컨테이너에 넣지 않고 즉시 폐기한다. */
  private async loadStatusPuppet(relicId: string, index: number, x: number, groundY: number, generation: number, layer: Phaser.GameObjects.Container, fallback?: Phaser.GameObjects.Container): Promise<void> {
    let asset;
    try { asset = this.puppetLoader.assetFor(relicId); } catch (error) {
      if (import.meta.env.DEV) console.warn(`[IdleExcavation] SD asset lookup failed (relic=${relicId}, asset=unresolved)`, error);
      return;
    }
    const result = await loadOwnedPuppet({
      spawn: () => this.puppetLoader.spawn(this.scene, asset, { x, groundY, height: 205, depth: SD_DEPTH }),
      isCurrent: () => Boolean(this.body) && generation === this.sdLoadGeneration && layer === this.sdContainer,
      // ZIP은 열렸는데 텍스처가 없는 묶음만 걸러 낸다. 그 뒤의 가시성은 이 레이어가 통째로 책임진다.
      isDisplayable: (puppet) => Boolean(puppet.active && puppet.texture?.key && this.scene.textures.exists(puppet.texture.key)),
      adopt: (puppet) => {
        // Puppet는 장식 레이어다. 내부 Image가 향후 interactive로 내보내져도 슬롯 입력면을 가로채지 않는다.
        puppet.disableInteractive();
        layer.add(puppet); this.sdPuppets.add(puppet);
        this.sdPuppetByRelicId.set(relicId, puppet);
        setDebugIdleExcavationSdReady(index);
        // 성공한 자리만 카드를 감춘다. ZIP/텍스처 실패 시 카드를 그대로 남긴다.
        fallback?.setVisible(false);
        const reduced = session.settings.accessibility.reduceMotion;
        const delays = [180, 570, 930];
        const heights = [11, 17, 8];
        const waits = [760, 1130, 910];
        const tween = this.scene.tweens.add(reduced
          ? { targets: puppet, scaleX: puppet.scaleX * 1.025, scaleY: puppet.scaleY * 1.025, alpha: 0.9, duration: 420, delay: delays[index], hold: waits[index], yoyo: true, repeat: -1 }
          : { targets: puppet, y: groundY - heights[index], duration: 250 + index * 45, delay: delays[index], hold: 90 + index * 35, yoyo: true, repeat: -1, repeatDelay: waits[index], ease: "Sine.easeOut" });
        this.sdTweens.add(tween);
      },
    });
    // Puppet 실패는 슬롯 전체의 실패가 아니다. 개발 경고만 남기고 카드는 계속 표시한다.
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
      const reduced = session.settings.accessibility.reduceMotion;
      this.scene.tweens.add({ targets: puppet, scaleX: puppet.scaleX * 1.1, scaleY: puppet.scaleY * 1.1, duration: reduced ? 90 : 130, yoyo: true, ease: "Back.easeOut" });
      this.scene.tweens.add({ targets: icon, y: icon.y - (reduced ? 20 : 55), alpha: { from: 1, to: 0 }, duration: reduced ? 420 : 720, ease: "Sine.easeOut", onComplete: () => icon.destroy() });
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
      this.saving = false; this.renderEditor("편성을 저장하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.");
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
    } catch {
      if (!this.body) return;
      this.saving = false; this.harvestError = "수확하지 못했습니다. 같은 요청으로 다시 시도해 주세요."; this.renderStatus();
    }
  }

  private setState(state: NonNullable<Parameters<typeof setDebugIdleExcavationPopup>[0]>): void {
    // Canvas 안 상태를 E2E가 사용자 가시 단계 이름으로만 관찰하도록 실제 편성 데이터는 노출하지 않는다.
    this.body?.setData("state", state); setDebugIdleExcavationPopup(state);
  }

  /** 타이머와 임시 편성을 버리며 서버에서 받은 confirmed 객체는 외부 상태에 역으로 쓰지 않는다. */
  private dispose(): void {
    this.requestGeneration++; this.statusBackground?.destroy(); this.statusBackground = undefined; this.clearStatusSD(); this.ticker?.remove(false); this.ticker = undefined;
    // PopupLayer가 본체를 먼저 파괴하므로 씬에 직접 등록한 스크롤 자원은 종료 콜백에서 별도로 치운다.
    this.gridMask?.destroy(); this.gridMask = undefined;
    if (this.gridWheelHandler) this.scene.input.off("wheel", this.gridWheelHandler);
    if (this.gridPointerDownHandler) this.scene.input.off("pointerdown", this.gridPointerDownHandler);
    if (this.gridPointerMoveHandler) this.scene.input.off("pointermove", this.gridPointerMoveHandler);
    if (this.gridPointerUpHandler) this.scene.input.off("pointerup", this.gridPointerUpHandler);
    this.gridWheelHandler = undefined; this.gridPointerDownHandler = undefined; this.gridPointerMoveHandler = undefined; this.gridPointerUpHandler = undefined;
    this.draft = undefined; this.body = undefined; this.content = undefined; this.closeAction = undefined;
    setDebugIdleExcavationPopup(undefined); setDebugIdleExcavationSlots(undefined); this.onClosed?.();
  }
}
