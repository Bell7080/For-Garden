import Phaser from "phaser";
import type { GameApi, IdleExcavationResponse } from "../api/contracts";
import { excavationProductionDisplayModel, type ExcavationCurrency } from "../core/idleExcavation";
import { formatCurrency } from "../core/formatCurrency";
import { RELICS } from "../data/relics";
import { battleAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { session } from "../state/session";
import { setDebugIdleExcavationPopup } from "../debug";
import { Button } from "./Button";
import { addCurrencyChip } from "./CurrencyChip";
import { drawHairline } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";

/** 방치 발굴 쪽지의 고정 크기다. 세로 안전 영역 안에서 로비 조작부를 충분히 가린다. */
const PANEL = { width: 900, height: 1320 } as const;
const RESOURCE_TONE: Record<ExcavationCurrency, number> = { gold: 0xe5b755, cheesecake: 0xe99aaa };

/** 초 단위 시간을 사용자가 빠르게 훑을 수 있는 짧은 문구로 바꾼다. */
function durationLabel(seconds: number): string {
  if (!Number.isFinite(seconds)) return "생산 없음";
  const safe = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(safe / 3600)}시간 ${Math.floor((safe % 3600) / 60)}분`;
}

/** PopupLayer 한 장 안에서 조회·재시도·Puppet·자원 마스크의 생명주기를 함께 소유한다. */
export class IdleExcavationPopup {
  private body?: Phaser.GameObjects.Container;
  private content?: Phaser.GameObjects.Container;
  private creatures: PuppetCreature[] = [];
  private maskGraphics: Phaser.GameObjects.Graphics[] = [];
  private syncEvent?: Phaser.Time.TimerEvent;
  private requestGeneration = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly popups: PopupLayer,
    private readonly api: GameApi,
    private readonly onClosed?: () => void,
  ) {}

  /** 연타는 기존 한 장을 그대로 둔다. 조회 중에도 새 API 요청을 만들지 않는다. */
  open(): void {
    if (this.body) return;
    this.body = this.popups.open({
      width: PANEL.width,
      height: PANEL.height,
      title: "방치 발굴",
      dim: true,
      closeOnBackdrop: false,
      onClose: () => this.dispose(),
    }, (body) => {
      body.setName("idle-excavation-popup");
      this.showLoading(body);
    });
    void this.fetch();
  }

  /** 서버 정산 시각이 포함된 응답만 화면에 그리며 실패하면 같은 쪽지 안에서 재시도한다. */
  private async fetch(): Promise<void> {
    const generation = ++this.requestGeneration;
    try {
      const response = await this.api.getIdleExcavation();
      if (!this.body || generation !== this.requestGeneration) return;
      this.render(response);
    } catch {
      if (!this.body || generation !== this.requestGeneration) return;
      this.showError(this.body);
    }
  }

  private clearContent(): Phaser.GameObjects.Container | undefined {
    this.content?.destroy(true);
    this.content = undefined;
    for (const mask of this.maskGraphics) mask.destroy();
    this.maskGraphics = [];
    this.syncEvent?.remove(false);
    this.syncEvent = undefined;
    if (!this.body) return undefined;
    this.content = this.scene.add.container(0, 0);
    this.body.add(this.content);
    return this.content;
  }

  /** 로딩은 판을 비우지 않고 진행 상황이 팝업 문맥 안에 있음을 명시한다. */
  private showLoading(body: Phaser.GameObjects.Container): void {
    const content = this.clearContent();
    content?.add(this.scene.add.text(0, 0, "발굴 현황을 정산하고 있습니다…", textStyle({ role: "body", size: 28, color: COLOR.inkDim })).setOrigin(0.5));
    body.setData("state", "loading");
    setDebugIdleExcavationPopup("loading");
  }

  /** 네트워크 오류 뒤에도 로비로 내보내지 않고 같은 팝업에서 명시적으로 다시 조회한다. */
  private showError(body: Phaser.GameObjects.Container): void {
    const content = this.clearContent();
    if (!content) return;
    content.add(this.scene.add.text(0, -55, "발굴 기록을 불러오지 못했습니다.", textStyle({ role: "body", size: 28, color: COLOR.dangerText })).setOrigin(0.5));
    const retry = new Button(this.scene, 0, 55, { width: 260, height: 82, label: "다시 시도", fontSize: 27, onClick: () => {
      this.showLoading(body);
      void this.fetch();
    } });
    content.add(retry);
    body.setData("state", "error");
    setDebugIdleExcavationPopup("error");
  }

  /** 서버 누적량과 같은 정산 기준으로 생산량·잔여 보관 시간을 한 번에 표시한다. */
  private render(response: IdleExcavationResponse): void {
    const content = this.clearContent();
    if (!content || !this.body) return;
    const state = response.excavation;
    const production = excavationProductionDisplayModel(state.assignedRelicIds, RELICS, session.relicProgress).totalsPerHour;
    const assigned = state.assignedRelicIds.filter((id): id is string => id !== null);

    content.add(this.scene.add.text(-390, -560, `탐사 인원 ${assigned.length} / 3`, textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0, 0.5));
    content.add(drawHairline(this.scene, 0, -330, 790, { color: COLOR.accent, alpha: 0.26 }));
    this.addPuppets(content, state.assignedRelicIds);

    const serverNow = new Date(response.serverTime).getTime();
    const extensionActive = state.storageExtensionExpiresAt !== null && serverNow < new Date(state.storageExtensionExpiresAt).getTime();
    const storageSeconds = state.baseStorageSeconds * (extensionActive ? 2 : 1);
    (Object.keys(production) as ExcavationCurrency[]).forEach((currency, index) => {
      const y = -245 + index * 220;
      const label = currency === "gold" ? "골드 광맥" : "보급 식량";
      const icon = currency === "gold" ? "currency-gold" : "currency-cheesecake";
      content.add(this.scene.add.text(-390, y - 58, label, textStyle({ role: "emphasis", size: 25, color: COLOR.ink })).setOrigin(0, 0.5));
      const wallet = addCurrencyChip(this.scene, 240, y - 58, icon, { width: 280, height: 66, parent: content });
      wallet.setText(formatCurrency(session.wallet[currency]));
      content.add(this.scene.add.text(-390, y + 2, `현재 누적  ${formatCurrency(Math.floor(state.unclaimed[currency]))}`, textStyle({ role: "display", size: 32 })).setOrigin(0, 0.5));
      content.add(this.scene.add.text(-390, y + 48, `시간당  ${formatCurrency(Math.floor(production[currency]))}`, textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5));
      const remaining = production[currency] > 0 ? Math.max(0, storageSeconds - state.unclaimed[currency] / production[currency] * 3600) : Number.POSITIVE_INFINITY;
      content.add(this.scene.add.text(390, y + 48, `보관 한도까지 ${durationLabel(remaining)}`, textStyle({ role: "body", size: 22, color: COLOR.accentText })).setOrigin(1, 0.5));
    });

    content.add(drawHairline(this.scene, 0, 190, 790, { color: COLOR.accent, alpha: 0.2 }));
    this.addResourceBed(content, state.unclaimed, production, storageSeconds);
    this.body.setData("state", "ready");
    setDebugIdleExcavationPopup("ready");
  }

  /** 배치 슬롯은 SD 전용 asset과 core 앵커를 사용한다. 저사양/모션 감소면 캡처처럼 정지한다. */
  private addPuppets(parent: Phaser.GameObjects.Container, ids: readonly (string | null)[]): void {
    const staticPresentation = session.settings.presentation.lowSpecMode || session.settings.accessibility.reduceMotion;
    ids.forEach((id, index) => {
      const x = -250 + index * 250;
      if (!id) {
        // 빈 슬롯도 배치 위치를 잃지 않도록 얇은 홀로그램 표식만 남긴다.
        parent.add(this.scene.add.text(x, -445, "EMPTY", textStyle({ role: "emphasis", size: 20, color: COLOR.inkDim })).setOrigin(0.5).setAlpha(0.45));
        return;
      }
      void spawnPuppet(this.scene, battleAssetFor(id), { focusX: { anchor: "core", x }, groundY: -350, height: 230 }).then((creature) => {
        if (!this.body || !parent.active) { creature.destroy(); return; }
        if (staticPresentation) creature.core.setSpeed(0);
        parent.add(creature);
        this.creatures.push(creature);
      });
    });
  }

  /** 누적 비율만큼 아래 마스크가 걷히면서 두 자원 더미가 드러난다. */
  private addResourceBed(parent: Phaser.GameObjects.Container, unclaimed: Record<ExcavationCurrency, number>, rates: Record<ExcavationCurrency, number>, storageSeconds: number): void {
    const masks: Array<{ mask: Phaser.GameObjects.Graphics; x: number; y: number; width: number; height: number; ratio: number }> = [];
    (["gold", "cheesecake"] as ExcavationCurrency[]).forEach((currency, index) => {
      const x = index === 0 ? -205 : 205;
      const y = 405;
      const width = 330;
      const height = 250;
      const capacity = rates[currency] * storageSeconds / 3600;
      const ratio = capacity > 0 ? Phaser.Math.Clamp(unclaimed[currency] / capacity, 0, 1) : 0;
      const pile = this.scene.add.graphics();
      // 전용 발굴 일러스트가 들어오기 전에도 실제 비율을 읽을 수 있는 각진 광석 더미를 쓴다.
      pile.fillStyle(RESOURCE_TONE[currency], 0.88);
      for (let row = 0; row < 5; row++) for (let col = row; col < 7 - row; col++) pile.fillTriangle(x - 145 + col * 47, y + 95 - row * 38, x - 124 + col * 47, y + 57 - row * 38, x - 103 + col * 47, y + 95 - row * 38);
      parent.add(pile);
      const mask = this.scene.add.graphics().setVisible(false);
      pile.setMask(mask.createGeometryMask());
      this.maskGraphics.push(mask);
      masks.push({ mask, x, y, width, height, ratio });
      parent.add(this.scene.add.text(x, y + 145, `${Math.round(ratio * 100)}%`, textStyle({ role: "display", size: 26, color: COLOR.ink })).setOrigin(0.5));
    });

    // GeometryMask는 부모 Container 변환을 물려받지 않는다. 등장 tween과 이후 이동/배율을 계속 동기화한다.
    const syncMasks = (): void => {
      if (!this.body) return;
      const matrix = parent.getWorldTransformMatrix();
      for (const item of masks) {
        const point = matrix.transformPoint(item.x - item.width / 2, item.y + item.height / 2 - item.height * item.ratio);
        item.mask.clear().fillStyle(0xffffff, 1).fillRect(point.x, point.y, item.width * matrix.scaleX, item.height * item.ratio * matrix.scaleY);
      }
    };
    syncMasks();
    this.syncEvent = this.scene.time.addEvent({ delay: 16, loop: true, callback: syncMasks });
  }

  /** 팝업 소유물만 폐기한다. LobbyScene과 애착 Puppet은 건드리지 않는다. */
  private dispose(): void {
    this.requestGeneration++;
    this.syncEvent?.remove(false);
    this.syncEvent = undefined;
    for (const mask of this.maskGraphics) mask.destroy();
    this.maskGraphics = [];
    for (const creature of this.creatures) creature.destroy();
    this.creatures = [];
    this.body = undefined;
    this.content = undefined;
    setDebugIdleExcavationPopup(undefined);
    this.onClosed?.();
  }
}
