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

/** 한 팝업 안에서 현황과 편집 그리드가 교대하므로 모바일 안전 영역을 넘지 않는 고정 크기를 쓴다. */
const PANEL = { width: 900, height: 1320 } as const;
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
    owned.forEach((relic, index) => {
      const x = -250 + (index % 3) * 250;
      const y = -15 + Math.floor(index / 3) * 280;
      const detail = excavationProductionDisplayModel([relic.id, null, null], RELICS, session.relicProgress).relics[0];
      const progress = session.relicProgress[relic.id];
      const icon = relic.excavationTrait.primaryCurrency === "gold" ? "◈" : "◇";
      const card = new PortraitCard(this.scene, x, y, { width: 215, height: 235, portraitAssetId: relic.portraitAssetId, tint: portraitUsesRelicTint(relic.portraitAssetId) ? tintFor(relic.id) : undefined, label: relic.name, level: progress?.level ?? 1, rarity: relic.rarity, stars: (progress?.breakthrough ?? 0) + 1, sub: `${icon} ${Math.floor(detail?.totalPerHour ?? 0)}/시간` });
      card.setSelected(this.draft!.includes(relic.id));
      card.hit.on("pointerup", () => { if (this.saving || !this.draft) return; this.draft = placeExcavationRelic(this.draft, this.selectedSlot, relic.id); this.renderEditor(); });
      content.add(card);
    });
    if (error) content.add(this.scene.add.text(0, 430, error, textStyle({ role: "body", size: 22, color: COLOR.dangerText })).setOrigin(0.5));
    const cancel = new Button(this.scene, -205, 540, { width: 350, height: 88, label: "취소", onClick: () => { if (!this.saving) { this.draft = undefined; this.renderStatus(); } } });
    const done = new Button(this.scene, 205, 540, { width: 350, height: 88, label: this.saving ? "저장 중…" : "완료", variant: "primary", onClick: () => void this.saveDraft() });
    cancel.setEnabled(!this.saving); done.setEnabled(!this.saving);
    content.add([cancel, done]);
    this.setState(this.saving ? "saving" : error ? "save-error" : "editing");
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
    this.draft = undefined; this.body = undefined; this.content = undefined;
    setDebugIdleExcavationPopup(undefined); this.onClosed?.();
  }
}
