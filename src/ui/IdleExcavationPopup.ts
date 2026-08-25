import Phaser from "phaser";
import type { AdOperationsConfigResponse, AdPresentationResult, AdSlotOperationsDto, GameApi, HarvestExcavationResponse, IdleExcavationResponse } from "../api/contracts";
import { excavationProductionDisplayModel, placeExcavationRelic, type ExcavationCurrency, type IdleExcavationState } from "../core/idleExcavation";
import { formatCurrency } from "../core/formatCurrency";
import { RELICS } from "../data/relics";
import { portraitUsesRelicTint, sdAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { tintFor } from "../puppets/tints";
import { session } from "../state/session";
import { setDebugIdleExcavationPopup } from "../debug";
import { Button } from "./Button";
import { chipPoints, drawHairline, drawLayer, drawShapeOutline, slantedRect } from "./holo";
import { PortraitCard } from "./PortraitCard";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { EXCAVATION_TRAIT_ICON } from "./excavationIcons";
import { completedAdToken } from "../data/adRewards";
import { addCurrencyChip } from "./CurrencyChip";
import type { CurrencyIconKey } from "./currencyIcons";
import { addSectionTitle } from "./SectionTitle";
import { addPopupBackgroundImage, BACKGROUND, type PopupBackgroundImage } from "./backgrounds";

/** 한 팝업 안에서 현황과 편집 그리드가 교대하므로 모바일 안전 영역을 넘지 않는 고정 크기를 쓴다. */
const PANEL = { width: 900, height: 1320 } as const;
/** 보유 렐릭은 이 창 안에서만 세로로 흐르며 상단 슬롯과 하단 완료 버튼을 침범하지 않는다. */
const GRID_VIEW = { left: -370, right: 370, top: -145, bottom: 425, columnGap: 250, rowGap: 280, cardWidth: 215, cardHeight: 235 } as const;
/** 손가락이 이 거리 이상 움직여야 카드 선택이 아니라 스크롤로 판정한다. */
const GRID_DRAG_SLOP = 12;
/** 팝업 자체는 원화를 품지 않고 현재 청흑색 면과 굵은 액자선으로 로비 배경에서 분리한다. */
const POPUP_FRAME = chipPoints(PANEL.width - 24, PANEL.height - 24, { bevel: { topLeft: 118, bottomRight: 118 } });
/** 두 재화 칩은 같은 고정 폭을 공유해 값의 자릿수가 늘어도 하단 요약부의 열이 움직이지 않는다. */
const SUMMARY_CHIP = { width: 350, height: 108, x: 190 } as const;
/** 좁은 안전 영역에서도 팝업 제목·닫기와 겹치지 않는 현황 히어로의 고정 세로 범위다. */
const STATUS_HERO = { x: 0, y: -385, width: 800, height: 300, headerY: -570, slotY: -385 } as const;
type Formation = IdleExcavationState["assignedRelicIds"];

/** 발굴 지급 재화는 생산 특성 표식과 달리 다색 공용 재화 이미지를 직접 사용한다. */
const EXCAVATION_CURRENCY_ICON: Record<ExcavationCurrency, CurrencyIconKey> = {
  gold: "currency-gold",
  cheesecake: "currency-cheesecake",
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

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly api: GameApi, private readonly onClosed?: () => void, private readonly presentAd?: (slotId: string) => Promise<AdPresentationResult>) {}

  /** 연타는 기존 한 장을 유지하며 닫기는 저장되지 않은 draft를 버린다. */
  open(): void {
    if (this.body) return;
    this.body = this.popups.open({ width: PANEL.width, height: PANEL.height, title: "발굴 · 자원 수집", dim: true, closeOnBackdrop: false, onClose: () => this.dispose() }, (body) => {
      body.setName("idle-excavation-popup");
      this.showMessage("발굴 현황을 정산하고 있습니다…", "loading");
    });
    void this.fetch();
  }

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
    // 원화 대신 팝업 색의 굵은 안쪽 액자를 유지해 뒤 화면의 일러스트와 조작면을 명확히 가른다.
    this.content.add(drawShapeOutline(this.scene, 0, 0, POPUP_FRAME, { color: COLOR.accent, alpha: 0.62, width: 5 }));
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
    // 1순위 발굴대 상태: 전용 발굴장 원화를 슬롯/SD와 같은 히어로에 묶어 배경-캐릭터 연동을 보존한다.
    if (this.scene.textures.exists(BACKGROUND.excavation)) {
      this.statusBackground = addPopupBackgroundImage(this.scene, content, BACKGROUND.excavation, STATUS_HERO);
    }
    const headerState = this.saving ? "수확 처리 중…" : "발굴 진행 중";
    addSectionTitle(this.scene, -380, STATUS_HERO.headerY, `${headerState} · 배치 ${formation.filter(Boolean).length}/3`, { size: 23, parent: content });
    content.add(this.scene.add.text(380, STATUS_HERO.headerY, `총 효율  ${formatCurrency(Math.floor(rate.gold))}G · ${formatCurrency(Math.floor(rate.cheesecake))}보급 /시간`, textStyle({ role: "emphasis", size: 19, color: COLOR.accentText })).setOrigin(1, 0.5));
    content.add(drawHairline(this.scene, 0, -535, 760, { color: COLOR.accent, alpha: 0.42 }));
    // 2순위 작업 중 SD/슬롯: 현황에서도 칸 자체가 편성 그리드의 유일한 진입점이다.
    const slotCards = this.addSlots(content, formation, false);
    // draft 편집에는 SD를 만들지 않는다. 서버 확정값을 그리는 현황에서만 비동기 세대를 시작한다.
    this.loadStatusSD(content, formation, slotCards);
    // 기능 차이는 핵심 현황 뒤의 작은 정보 문구로 낮춰 반복 진입 때 먼저 읽히지 않게 한다.
    content.add(this.scene.add.text(0, -205, "ℹ 연구소는 캐릭터 획득 연구 · 발굴은 배치형 자원 생산", textStyle({ role: "body", size: 17, color: COLOR.inkDim })).setOrigin(0.5));
    const baseServerMs = new Date(response.serverTime).getTime();
    let harvestButton: Button | undefined;
    // 공용 CurrencyChip은 아이콘과 가장 큰 누적값만 책임지고, 발굴 전용 보조 라벨이 생산 속도를 설명한다.
    // 3순위 누적 보상: SD 아래에서 현재 수확량과 시간당 생산량을 한 번에 훑는다.
    content.add(drawLayer(this.scene, 0, 30, slantedRect(800, 205), { fill: 0x05070a, alpha: 0.9, edge: COLOR.accent, edgeAlpha: 0.42 }));
    const rows = (["gold", "cheesecake"] as ExcavationCurrency[]).map((currency, index) => {
      const x = index === 0 ? -SUMMARY_CHIP.x : SUMMARY_CHIP.x;
      const amount = addCurrencyChip(this.scene, x, 5, EXCAVATION_CURRENCY_ICON[currency], { parent: content, width: SUMMARY_CHIP.width, height: SUMMARY_CHIP.height });
      // 이름을 되풀이하지 않고 칩 바로 아래에 같은 단위의 생산 속도만 작게 붙인다.
      content.add(this.scene.add.text(x, 88, `+${formatCurrency(Math.floor(rate[currency]))} /시간`, textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0.5));
      return { currency, amount };
    });
    const availability = this.scene.add.text(0, 145, "", textStyle({ role: "body", size: 19, color: COLOR.inkDim })).setOrigin(0.5);
    content.add(availability);
    const refreshEstimate = (): void => {
      // 서버 응답 이후의 로컬 경과분만 더하는 표시용 예상치이며 정산 기준 시각은 절대 갱신하지 않는다.
      const elapsedHours = Math.max(0, Date.now() - baseServerMs) / 3_600_000;
      // 틱에서는 CurrencyChip이 돌려준 값 Text만 바꾼다. 이미지와 불투명 요약 레이어는 재생성하지 않는다.
      for (const row of rows) row.amount.setText(formatCurrency(Math.floor(response.excavation.unclaimed[row.currency] + rate[row.currency] * elapsedHours)));
      // 창을 열어 둔 사이 정수 1개가 쌓이는 순간에도 새 조회 없이 버튼 상태만 정확히 갱신한다.
      const harvestable = (["gold", "cheesecake"] as ExcavationCurrency[]).some((currency) => Math.floor(response.excavation.unclaimed[currency] + rate[currency] * elapsedHours) > 0);
      harvestButton?.setEnabled(harvestable && !this.saving);
      // 비활성 이유를 누적 0 또는 가장 빠른 재화의 다음 정수 생산 시각으로 짧게 설명한다.
      const seconds = (["gold", "cheesecake"] as ExcavationCurrency[]).map((currency) => {
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
    const discarded = result ? result.discarded.gold + result.discarded.cheesecake : 0;
    const notice = this.harvestError ?? (discarded > 0 ? "수확 완료 · 지갑 상한 손실" : result ? "수확이 완료되었습니다." : "빈 슬롯은 허용되며 생산량 0으로 계산됩니다.");
    content.add(this.scene.add.text(0, 215, notice, textStyle({ role: "body", size: 19, color: discarded > 0 || this.harvestError ? COLOR.dangerText : COLOR.inkDim, align: "center" })).setOrigin(0.5));
    if (result) {
      // 실제 지급은 공용 칩 값으로, 같은 재화의 손실은 그 아이콘 아래 위험색 보조 숫자로 분리한다.
      (["gold", "cheesecake"] as ExcavationCurrency[]).forEach((currency, index) => {
        const granted = result.granted[currency];
        const lost = result.discarded[currency];
        if (granted <= 0 && lost <= 0) return;
        const x = index === 0 ? -150 : 150;
        const amount = addCurrencyChip(this.scene, x, 260, EXCAVATION_CURRENCY_ICON[currency], { parent: content, width: 260, height: 66 });
        amount.setText(`+${formatCurrency(granted)}`);
        if (lost > 0) content.add(this.scene.add.text(x + 35, 292, `손실 -${formatCurrency(lost)}`, textStyle({ role: "emphasis", size: 17, color: COLOR.dangerText })).setOrigin(0.5, 1));
      });
    }
    this.addAdOffers(content, response.serverTime);
    // 5순위 주요 행동: 별도 편성 버튼은 없애고, 하단 전체 폭은 수확 primary 하나에만 준다.
    harvestButton = new Button(this.scene, 0, 545, { width: 520, height: 98, label: this.saving ? "수확 중…" : "수확", variant: "primary", onClick: () => void this.harvest() });
    // 서버 확정 누적량이 1 미만이거나 요청 중이면 지급할 것이 없으므로 입력부터 막는다.
    refreshEstimate(); content.add(harvestButton);
    this.setState(this.saving ? "saving" : "ready");
    if (result) { this.playHarvestSuccess(content, rows.map((row) => row.amount), result); this.harvestResult = undefined; }
  }

  /** 좌우 제안은 유효한 서버 설정에서 활성인 발굴 슬롯만 남은 횟수와 효과를 직접 말한다. */
  private addAdOffers(content: Phaser.GameObjects.Container, serverTime: string): void {
    const config = this.adOperations;
    if (!config || new Date(config.expiresAt).getTime() <= new Date(serverTime).getTime()) return;
    const slots = ["excavation-harvest", "excavation-storage"].map((id) => config.slots.find((slot) => slot.slotId === id && slot.enabled)).filter((slot): slot is AdSlotOperationsDto => Boolean(slot));
    slots.forEach((slot, index) => {
      const sameUtcDay = session.dailyAdRewards.date === serverTime.slice(0, 10);
      const remaining = Math.max(0, slot.dailyLimitUtc - (sameUtcDay ? session.dailyAdRewards.claimsBySlot[slot.slotId] ?? 0 : 0));
      if (remaining === 0) return;
      const label = `${slot.displayText} · 오늘 ${remaining}회`;
      // 4순위 보조 혜택: 광고는 primary와 거리를 두고 더 낮고 작은 보조 버튼으로만 제안한다.
      content.add(new Button(this.scene, index === 0 ? -205 : 205, 385, { width: 350, height: 72, label, onClick: () => void this.claimAdEffect(slot) }));
    });
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

  /** 서버 성공 뒤에만 재화가 우상단 지갑 쪽으로 흐르며, 모션 감소 시 숫자 강조로 대체한다. */
  private playHarvestSuccess(content: Phaser.GameObjects.Container, amounts: Phaser.GameObjects.Text[], result: HarvestExcavationResponse): void {
    const hasGrant = result.granted.gold + result.granted.cheesecake > 0;
    if (!hasGrant) return;
    for (const amount of amounts) {
      this.scene.tweens.add({ targets: amount, scale: 1.12, duration: 110, yoyo: true });
    }
    if (session.settings.accessibility.reduceMotion) return;
    // 작은 단색 점은 기존 홀로그램 강조색을 재사용하며 별도 이미지 자산을 만들지 않는다.
    for (let index = 0; index < 8; index += 1) {
      const particle = this.scene.add.circle(180 + index * 12, 90 + (index % 2) * 35, 5, COLOR.accent, 0.8);
      content.add(particle);
      this.scene.tweens.add({ targets: particle, x: 410, y: -620, alpha: 0, duration: 360 + index * 35, onComplete: () => particle.destroy() });
    }
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
      const card = new PortraitCard(this.scene, x, y, { width: GRID_VIEW.cardWidth, height: GRID_VIEW.cardHeight, portraitAssetId: relic.portraitAssetId, tint: portraitUsesRelicTint(relic.portraitAssetId) ? tintFor(relic.id) : undefined, label: relic.name, level: progress?.level ?? 1, rarity: relic.rarity, stars: (progress?.breakthrough ?? 0) + 1, subIcon: EXCAVATION_TRAIT_ICON[relic.excavationTrait.primaryCurrency], sub: `${Math.floor(detail?.totalPerHour ?? 0)}/시간` });
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
      let hit: Phaser.GameObjects.GameObject;
      if (relic) {
        const progress = session.relicProgress[relic.id];
        const card = new PortraitCard(this.scene, x, STATUS_HERO.slotY, { width: 210, height: 245, portraitAssetId: relic.portraitAssetId, tint: portraitUsesRelicTint(relic.portraitAssetId) ? tintFor(relic.id) : undefined, label: relic.name, level: progress?.level ?? 1, rarity: relic.rarity, stars: (progress?.breakthrough ?? 0) + 1 });
        card.setSelected(editable && index === this.selectedSlot);
        parent.add(card); hit = card.hit; cards[index] = card;
      } else {
        const empty = this.scene.add.container(x, STATUS_HERO.slotY);
        empty.add(drawLayer(this.scene, 0, 0, slantedRect(210, 245), { fill: 0x151a22, alpha: 0.45, edge: index === this.selectedSlot && editable ? COLOR.accent : 0x6f7884, edgeAlpha: 0.55 }));
        empty.add(this.scene.add.text(0, 0, `빈 슬롯\n${index + 1}`, textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim, align: "center" })).setOrigin(0.5));
        const area = this.scene.add.rectangle(0, 0, 210, 245, 0xffffff, 0).setInteractive({ useHandCursor: true }); empty.add(area);
        if (editable && index === this.selectedSlot) empty.setScale(1.06);
        parent.add(empty); hit = area;
      }
      // 현황 칸을 누르면 그 칸이 선택된 편집 그리드가 열리고, 편집 중에는 선택 칸만 바뀐다.
      hit.on("pointerup", () => {
        if (this.saving) return;
        if (!editable) { this.beginEdit(index); return; }
        this.selectedSlot = index; this.renderEditor();
      });
    });
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
    this.sdContainer?.destroy(true); this.sdContainer = undefined;
  }

  /** 확정 슬롯의 카드 위에 SD가 준비된 자리만 교체하며 실패한 자리는 카드 미리보기를 보존한다. */
  private loadStatusSD(parent: Phaser.GameObjects.Container, formation: Formation, cards: Array<Phaser.GameObjects.Container | undefined>): void {
    const generation = this.sdLoadGeneration;
    const layer = this.scene.add.container(0, 0).setName("idle-excavation-confirmed-sd");
    this.sdContainer = layer; parent.add(layer);
    formation.forEach((relicId, index) => {
      if (!relicId) return;
      const x = -250 + index * 250;
      const groundY = -275;
      // 사방 테두리나 입체 판 대신 얇은 홀로그램 투영 그림자만 발 아래에 둔다.
      layer.add(this.scene.add.ellipse(x, groundY + 2, 172, 25, COLOR.accent, 0.16));
      void this.loadStatusPuppet(relicId, index, x, groundY, generation, layer, cards[index]);
    });
  }

  /** 로딩 완료 시 현재 세대인지 재검증하며, 늦게 도착한 결과는 컨테이너에 넣지 않고 즉시 폐기한다. */
  private async loadStatusPuppet(relicId: string, index: number, x: number, groundY: number, generation: number, layer: Phaser.GameObjects.Container, fallback?: Phaser.GameObjects.Container): Promise<void> {
    try {
      const puppet = await spawnPuppet(this.scene, sdAssetFor(relicId), { x, groundY, height: 205, depth: 1 });
      if (!this.body || generation !== this.sdLoadGeneration || layer !== this.sdContainer) { puppet.destroy(); return; }
      layer.add(puppet); this.sdPuppets.add(puppet);
      // 성공한 자리만 카드를 감춘다. ZIP/텍스처 실패 시 catch가 카드를 그대로 남긴다.
      fallback?.setVisible(false);
      const reduced = session.settings.accessibility.reduceMotion;
      const delays = [180, 570, 930];
      const heights = [11, 17, 8];
      const waits = [760, 1130, 910];
      const tween = this.scene.tweens.add(reduced
        ? { targets: puppet, scaleX: puppet.scaleX * 1.025, scaleY: puppet.scaleY * 1.025, alpha: 0.9, duration: 420, delay: delays[index], hold: waits[index], yoyo: true, repeat: -1 }
        : { targets: puppet, y: groundY - heights[index], duration: 250 + index * 45, delay: delays[index], hold: 90 + index * 35, yoyo: true, repeat: -1, repeatDelay: waits[index], ease: "Sine.easeOut" });
      this.sdTweens.add(tween);
    } catch {
      // Puppet 실패는 슬롯 전체의 실패가 아니다. 카드가 확정 편성을 계속 설명한다.
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
    this.draft = undefined; this.body = undefined; this.content = undefined;
    setDebugIdleExcavationPopup(undefined); this.onClosed?.();
  }
}
