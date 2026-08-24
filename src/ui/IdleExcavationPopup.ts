import Phaser from "phaser";
import type { GameApi, IdleExcavationResponse } from "../api/contracts";
import { excavationProductionDisplayModel, placeExcavationRelic, type ExcavationCurrency, type IdleExcavationState } from "../core/idleExcavation";
import { formatCurrency } from "../core/formatCurrency";
import { RELICS } from "../data/relics";
import { portraitUsesRelicTint } from "../puppets/assets";
import { tintFor } from "../puppets/tints";
import { session } from "../state/session";
import { setDebugIdleExcavationPopup } from "../debug";
import { Button } from "./Button";
import { drawHairline, drawLayer, slantedRect } from "./holo";
import { PortraitCard } from "./PortraitCard";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { EXCAVATION_TRAIT_ICON } from "./excavationIcons";

/** 한 팝업 안에서 현황과 편집 그리드가 교대하므로 모바일 안전 영역을 넘지 않는 고정 크기를 쓴다. */
const PANEL = { width: 900, height: 1320 } as const;
/** 보유 렐릭은 이 창 안에서만 세로로 흐르며 상단 슬롯과 하단 완료 버튼을 침범하지 않는다. */
const GRID_VIEW = { left: -370, right: 370, top: -145, bottom: 425, columnGap: 250, rowGap: 280, cardWidth: 215, cardHeight: 235 } as const;
/** 손가락이 이 거리 이상 움직여야 카드 선택이 아니라 스크롤로 판정한다. */
const GRID_DRAG_SLOP = 12;
type Formation = IdleExcavationState["assignedRelicIds"];

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
  private ticker?: Phaser.Time.TimerEvent;
  private requestGeneration = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly api: GameApi, private readonly onClosed?: () => void) {}

  /** 연타는 기존 한 장을 유지하며 닫기는 저장되지 않은 draft를 버린다. */
  open(): void {
    if (this.body) return;
    this.body = this.popups.open({ width: PANEL.width, height: PANEL.height, title: "방치 발굴", dim: true, closeOnBackdrop: false, onClose: () => this.dispose() }, (body) => {
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
      if (!this.body || generation !== this.requestGeneration) return;
      this.confirmed = response;
      this.renderStatus();
    } catch {
      if (!this.body || generation !== this.requestGeneration) return;
      this.showMessage("발굴 기록을 불러오지 못했습니다.", "error", true);
    }
  }

  /** 다시 그릴 때 PortraitCard의 외부 마스크까지 Container destroy 경로로 함께 정리한다. */
  private resetContent(): Phaser.GameObjects.Container | undefined {
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
    content.add(this.scene.add.text(0, -40, message, textStyle({ role: "body", size: 28, color: state === "error" ? COLOR.dangerText : COLOR.inkDim })).setOrigin(0.5));
    if (retry) content.add(new Button(this.scene, 0, 65, { width: 260, height: 82, label: "다시 시도", onClick: () => { this.showMessage("발굴 현황을 정산하고 있습니다…", "loading"); void this.fetch(); } }));
    this.setState(state);
  }

  /** 확정 편성 기준 현황이다. 표시 누적량만 매초 예상하고 서버 상태나 세션은 바꾸지 않는다. */
  private renderStatus(): void {
    const response = this.confirmed;
    const content = this.resetContent();
    if (!response || !content) return;
    const formation = response.excavation.assignedRelicIds;
    this.addSlots(content, formation, false);
    const rate = excavationProductionDisplayModel(formation, RELICS, session.relicProgress).totalsPerHour;
    const baseServerMs = new Date(response.serverTime).getTime();
    const rows = (["gold", "cheesecake"] as ExcavationCurrency[]).map((currency, index) => {
      const y = 20 + index * 105;
      const label = currency === "gold" ? "골드" : "치즈케이크";
      content.add(this.scene.add.text(-350, y, `${label} · 시간당 ${formatCurrency(Math.floor(rate[currency]))}`, textStyle({ role: "body", size: 23, color: COLOR.inkDim })).setOrigin(0, 0.5));
      const amount = this.scene.add.text(350, y, "", textStyle({ role: "display", size: 30 })).setOrigin(1, 0.5);
      content.add(amount);
      return { currency, amount };
    });
    const refreshEstimate = (): void => {
      // 서버 응답 이후의 로컬 경과분만 더하는 표시용 예상치이며 정산 기준 시각은 절대 갱신하지 않는다.
      const elapsedHours = Math.max(0, Date.now() - baseServerMs) / 3_600_000;
      for (const row of rows) row.amount.setText(`예상 ${formatCurrency(Math.floor(response.excavation.unclaimed[row.currency] + rate[row.currency] * elapsedHours))}`);
    };
    refreshEstimate();
    this.ticker?.remove(false);
    this.ticker = this.scene.time.addEvent({ delay: 1000, loop: true, callback: refreshEstimate });
    content.add(drawHairline(this.scene, 0, 235, 760, { color: COLOR.accent, alpha: 0.25 }));
    content.add(this.scene.add.text(0, 285, "빈 슬롯은 허용되며 생산량 0으로 계산됩니다.", textStyle({ role: "body", size: 21, color: COLOR.inkDim })).setOrigin(0.5));
    content.add(new Button(this.scene, -205, 515, { width: 350, height: 92, label: "편성 변경", onClick: () => this.beginEdit() }));
    content.add(new Button(this.scene, 205, 515, { width: 350, height: 92, label: "수확", variant: "primary", onClick: () => void this.harvest() }));
    this.setState("ready");
  }

  /** 편집을 열 때에만 확정 배열을 복사하므로 취소/닫기가 서버 편성을 건드릴 수 없다. */
  private beginEdit(): void {
    if (!this.confirmed || this.saving) return;
    this.draft = copyFormation(this.confirmed.excavation.assignedRelicIds);
    this.selectedSlot = 0;
    this.gridScrollY = 0;
    this.renderEditor();
  }

  /** 상단 슬롯과 보유 렐릭 그리드는 동일한 draft를 보되 저장 성공 전에는 confirmed에 쓰지 않는다. */
  private renderEditor(error?: string): void {
    const content = this.resetContent();
    if (!content || !this.draft) return;
    this.ticker?.remove(false); this.ticker = undefined;
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
    const cancel = new Button(this.scene, -205, 540, { width: 350, height: 88, label: "취소", onClick: () => { if (!this.saving) { this.draft = undefined; this.renderStatus(); } } });
    const done = new Button(this.scene, 205, 540, { width: 350, height: 88, label: this.saving ? "저장 중…" : "완료", variant: "primary", onClick: () => void this.saveDraft() });
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
  private addSlots(parent: Phaser.GameObjects.Container, formation: Formation, editable: boolean): void {
    parent.add(this.scene.add.text(-360, -550, editable ? `편집 슬롯 ${this.selectedSlot + 1}` : `확정 편성 ${formation.filter(Boolean).length} / 3`, textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0, 0.5));
    formation.forEach((id, index) => {
      const x = -250 + index * 250;
      const relic = id ? RELICS.find((item) => item.id === id) : undefined;
      let hit: Phaser.GameObjects.GameObject;
      if (relic) {
        const progress = session.relicProgress[relic.id];
        const card = new PortraitCard(this.scene, x, -385, { width: 210, height: 245, portraitAssetId: relic.portraitAssetId, tint: portraitUsesRelicTint(relic.portraitAssetId) ? tintFor(relic.id) : undefined, label: relic.name, level: progress?.level ?? 1, rarity: relic.rarity, stars: (progress?.breakthrough ?? 0) + 1 });
        card.setSelected(editable && index === this.selectedSlot);
        parent.add(card); hit = card.hit;
      } else {
        const empty = this.scene.add.container(x, -385);
        empty.add(drawLayer(this.scene, 0, 0, slantedRect(210, 245), { fill: 0x151a22, alpha: 0.45, edge: index === this.selectedSlot && editable ? COLOR.accent : 0x6f7884, edgeAlpha: 0.55 }));
        empty.add(this.scene.add.text(0, 0, `빈 슬롯\n${index + 1}`, textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim, align: "center" })).setOrigin(0.5));
        const area = this.scene.add.rectangle(0, 0, 210, 245, 0xffffff, 0).setInteractive({ useHandCursor: editable }); empty.add(area);
        if (editable && index === this.selectedSlot) empty.setScale(1.06);
        parent.add(empty); hit = area;
      }
      if (editable) hit.on("pointerup", () => { if (!this.saving) { this.selectedSlot = index; this.renderEditor(); } });
    });
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
    this.saving = true;
    try {
      const result = await this.api.harvestExcavation({ requestId: requestId() });
      if (!this.body) return;
      session.wallet = { ...result.wallet };
      session.idleExcavation = { ...result.excavation, assignedRelicIds: copyFormation(result.excavation.assignedRelicIds), unclaimed: { ...result.excavation.unclaimed } };
      this.confirmed = result; this.saving = false; this.renderStatus();
    } catch {
      if (!this.body) return;
      this.saving = false; this.showMessage("수확하지 못했습니다. 다시 시도해 주세요.", "error", true);
    }
  }

  private setState(state: NonNullable<Parameters<typeof setDebugIdleExcavationPopup>[0]>): void {
    // Canvas 안 상태를 E2E가 사용자 가시 단계 이름으로만 관찰하도록 실제 편성 데이터는 노출하지 않는다.
    this.body?.setData("state", state); setDebugIdleExcavationPopup(state);
  }

  /** 타이머와 임시 편성을 버리며 서버에서 받은 confirmed 객체는 외부 상태에 역으로 쓰지 않는다. */
  private dispose(): void {
    this.requestGeneration++; this.ticker?.remove(false); this.ticker = undefined;
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
