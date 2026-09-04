import Phaser from "phaser";
import { INTERACTION_DEPARTMENT_LABEL, interactionDurationLabel } from "../data/interactionCities";
import { currencyGuide } from "../data/currencyGuide";
import { RELICS } from "../data/relics";
import { relicProgression } from "../managers/RelicProgressionManager";
import type { InteractionManager } from "../managers/InteractionManager";
import { session } from "../state/session";
import type { InteractionDispatchSnapshot } from "../state/session";
import { Button } from "./Button";
import { PortraitCard } from "./PortraitCard";
import { PORTRAIT_GRID_MASK_GAP, portraitGridFirstRowY } from "./portraitGrid";
import { addPopupBackgroundImage } from "./backgrounds";
import { chipPoints, drawLayer, drawHairline, HOLO, slantedRect } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { currencyRecordToRewardItems, openRewardPopup } from "./RewardPopup";
import { interactionRemainingLabel, relicsAwayOnInteraction, type InteractionLayerView } from "./interactionLayerModel";

/** 창 한 장의 규격. 위(원화) · 가운데(설명·기대 재화) · 아래(파견대 세 칸) 순서다. */
const PANEL = { width: 900, height: 1240 } as const;
const ART = { y: -420, height: 360 } as const;
const SLOT = { y: 300, width: 230, height: 250, gap: 26 } as const;
/** 파견대 그리드가 올라와 덮는 창. 세 칸 바로 위에서 시작해 창 아래까지다. */
const GRID = { top: 60, bottom: 600, cardW: 150, cardH: 182, cols: 5, gapX: 16, gapY: 30, rows: 2 } as const;

/**
 * 도시 한 곳의 쪽지.
 *
 * **여기서 파견대를 세운다.** 세 칸 중 하나를 누르면 아직 나가지 않은 렐릭이 아래에서 올라와
 * 덮고, 고르면 다시 내려간다 — 칸과 목록을 한 화면에 나란히 두면 카드가 너무 작아져 얼굴로
 * 고를 수 없다.
 */
export class InteractionCityPopup {
  private view?: InteractionLayerView;
  private party: (string | null)[] = [null, null, null];
  private pickingSlot: number | null = null;
  private busy = false;
  private onChanged?: () => void;
  private onOpenJournal?: (cityId: string) => void;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly manager: InteractionManager) {}

  open(view: InteractionLayerView, hooks: { onChanged?: () => void; onOpenJournal?: (cityId: string) => void } = {}): void {
    this.view = view; this.onChanged = hooks.onChanged; this.onOpenJournal = hooks.onOpenJournal;
    this.party = [null, null, null];
    this.pickingSlot = null;
    this.busy = false;
    this.render();
  }

  private render(): void {
    const view = this.view;
    if (!view) return;
    this.popups.closeAll();
    const title = `${view.city.displayName} ${INTERACTION_DEPARTMENT_LABEL[view.city.department]}`;
    this.popups.open({ width: PANEL.width, height: PANEL.height, title, dim: true, closeOnBackdrop: true }, (body) => {
      this.buildArt(body, view);
      this.buildBrief(body, view);
      if (view.state === "away") this.buildAway(body, view);
      else if (view.state === "done") this.buildDone(body, view);
      else this.buildDispatch(body, view);
      // 일지는 그 도시에서만 쌓이므로 도시 쪽지가 유일한 진입점이다.
      if (this.onOpenJournal) body.add(new Button(this.scene, PANEL.width / 2 - 130, -PANEL.height / 2 + 96, {
        width: 200, height: 62, fontSize: 22, label: "도시 일지", accentColor: 0x55b9e8,
        onClick: () => this.onOpenJournal?.(view.city.id),
      }));
      if (this.pickingSlot !== null) this.buildRoster(body);
    });
  }

  /** 상단 원화. 전용 원화가 오기 전까지 도시마다 다른 배경 키를 나눠 쓴다. */
  private buildArt(body: Phaser.GameObjects.Container, view: InteractionLayerView): void {
    const shape = chipPoints(PANEL.width - 24, ART.height, { bevel: { topLeft: 96, bottomRight: 96 } });
    if (this.scene.textures.exists(view.city.illustration)) {
      addPopupBackgroundImage(this.scene, body, view.city.illustration, { x: 0, y: ART.y, width: PANEL.width - 24, height: ART.height, maskShape: shape, overlayStrength: 0.5 });
    } else {
      body.add(drawLayer(this.scene, 0, ART.y, shape, { fill: COLOR.panel, alpha: HOLO.glass }));
    }
  }

  /** 가운데 — 설명과 **기대 재화**. 무엇이 돌아오는지가 보내는 이유다. */
  private buildBrief(body: Phaser.GameObjects.Container, view: InteractionLayerView): void {
    body.add(this.scene.add.text(-PANEL.width / 2 + 60, -196, view.city.description, textStyle({ role: "body", size: 25 })).setWordWrapWidth(PANEL.width - 120));
    body.add(drawHairline(this.scene, 0, -100, PANEL.width - 140, { color: 0x55b9e8, alpha: 0.32 }));
    body.add(this.scene.add.text(-PANEL.width / 2 + 60, -78, `걸리는 시간  ${interactionDurationLabel(view.city.durationMinutes)}`, textStyle({ role: "emphasis", size: 26, color: COLOR.accentText })).setOrigin(0, 0));
    const rewards = view.city.rewards.map((entry) => `${currencyGuide(entry.currency).name} ${entry.amount.toLocaleString()}`).join("   ");
    body.add(this.scene.add.text(-PANEL.width / 2 + 60, -24, rewards, textStyle({ role: "body", size: 25 })).setWordWrapWidth(PANEL.width - 120));
  }

  /** 나가 있는 동안에는 누가 갔는지와 남은 시간만 남는다. */
  private buildAway(body: Phaser.GameObjects.Container, view: InteractionLayerView): void {
    body.add(this.scene.add.text(0, SLOT.y - 120, `파견 중 · ${interactionRemainingLabel(view.remainingMs ?? 0)}`, textStyle({ role: "display", size: 34, color: "#a8ddf5" })).setOrigin(0.5));
    this.buildSlots(body, (view.dispatch?.party ?? []).map((id) => id ?? null), false);
  }

  /** 다녀온 파견은 누르는 즉시 보상 영수증으로 이어진다. */
  private buildDone(body: Phaser.GameObjects.Container, view: InteractionLayerView): void {
    this.buildSlots(body, view.dispatch?.party ?? [], false);
    body.add(new Button(this.scene, 0, SLOT.y + 220, {
      width: 460, height: 108, label: this.busy ? "수령 중…" : "보상 수령", variant: "primary",
      accentColor: COLOR.missionClaim, onClick: () => void this.claim(view.dispatch),
    }));
  }

  /** 아직 보내지 않은 층 — 세 칸을 채우고 내보낸다. */
  private buildDispatch(body: Phaser.GameObjects.Container, view: InteractionLayerView): void {
    this.buildSlots(body, this.party, true);
    const picked = this.party.filter((id): id is string => id !== null);
    const button = new Button(this.scene, 0, SLOT.y + 220, {
      width: 460, height: 108, label: this.busy ? "보내는 중…" : "파견 보내기",
      sub: `${picked.length} / 3`, variant: "primary", accentColor: 0x55b9e8, accentTextColor: "#d9f3ff",
      onClick: () => void this.start(view),
    });
    button.setEnabled(!this.busy && picked.length >= view.city.partySize.min);
    body.add(button);
  }

  /** 파견대 세 칸. 누르면 그리드가 올라온다. */
  private buildSlots(body: Phaser.GameObjects.Container, party: readonly (string | null)[], editable: boolean): void {
    const step = SLOT.width + SLOT.gap;
    for (let index = 0; index < 3; index += 1) {
      const x = (index - 1) * step;
      const relicId = party[index] ?? null;
      const relic = relicId ? RELICS.find((entry) => entry.id === relicId) : undefined;
      if (relic) {
        const progress = relicProgression.getProgress(relic.id);
        const card = new PortraitCard(this.scene, x, SLOT.y, {
          width: SLOT.width, height: SLOT.height, portraitAssetId: relic.portraitAssetId,
          label: relic.name, level: progress.level, rarity: relic.rarity, stars: relicProgression.getStars(relic.id),
        });
        card.hit.disableInteractive();
        body.add(card);
      } else {
        body.add(drawLayer(this.scene, x, SLOT.y, slantedRect(SLOT.width, SLOT.height, 18), { fill: COLOR.panel, alpha: HOLO.glassLight, edge: COLOR.inkDimHex, edgeAlpha: 0.5 }));
        body.add(this.scene.add.text(x, SLOT.y, `${index + 1}`, textStyle({ role: "display", size: 40, color: COLOR.inkDim })).setOrigin(0.5));
      }
      if (!editable) continue;
      const hit = this.scene.add.rectangle(x, SLOT.y, SLOT.width, SLOT.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerup", () => {
        // 찬 칸을 누르면 비우고, 빈 칸을 누르면 목록이 올라온다.
        if (this.party[index]) { this.party[index] = null; this.pickingSlot = null; }
        else this.pickingSlot = index;
        this.render();
      });
      body.add(hit);
    }
  }

  /**
   * 아래에서 올라와 덮는 파견대 그리드.
   *
   * **이미 나가 있는 렐릭은 보여 주지 않는다** — 목록에 남겨 두고 누를 때 막으면, 왜 안 되는지
   * 화면이 말하지 않은 채 손만 헛돈다.
   */
  private buildRoster(body: Phaser.GameObjects.Container): void {
    const away = relicsAwayOnInteraction(session.interaction.slots.filter((slot): slot is InteractionDispatchSnapshot => slot !== null));
    const picked = new Set(this.party.filter((id): id is string => id !== null));
    const roster = RELICS.filter((relic) => session.owned.has(relic.id) && !away.has(relic.id) && !picked.has(relic.id));

    const height = GRID.bottom - GRID.top;
    body.add(drawLayer(this.scene, 0, GRID.top + height / 2, slantedRect(PANEL.width - 40, height, 22), { fill: COLOR.void, alpha: 0.93, edge: 0x55b9e8, edgeAlpha: 0.7 }));
    body.add(this.scene.add.text(-PANEL.width / 2 + 60, GRID.top + 26, `${(this.pickingSlot ?? 0) + 1}번 자리에 세울 렐릭`, textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0, 0.5));
    body.add(new Button(this.scene, PANEL.width / 2 - 110, GRID.top + 26, { width: 140, height: 52, fontSize: 22, label: "닫기", onClick: () => { this.pickingSlot = null; this.render(); } }));

    const gridWidth = GRID.cols * GRID.cardW + (GRID.cols - 1) * GRID.gapX;
    const startX = -gridWidth / 2 + GRID.cardW / 2;
    const firstRowY = portraitGridFirstRowY(GRID.top + 60, GRID.cardH, PORTRAIT_GRID_MASK_GAP);
    roster.slice(0, GRID.cols * GRID.rows).forEach((relic, index) => {
      const progress = relicProgression.getProgress(relic.id);
      const card = new PortraitCard(this.scene, startX + (index % GRID.cols) * (GRID.cardW + GRID.gapX), firstRowY + Math.floor(index / GRID.cols) * (GRID.cardH + GRID.gapY), {
        width: GRID.cardW, height: GRID.cardH, portraitAssetId: relic.portraitAssetId,
        label: relic.name, level: progress.level, rarity: relic.rarity, stars: relicProgression.getStars(relic.id),
        affinity: { element: relic.element, role: relic.role },
      });
      card.hit.on("pointerup", () => {
        const slot = this.pickingSlot;
        if (slot === null) return;
        this.party[slot] = relic.id;
        // 한 칸을 채우면 다음 빈 칸으로 저절로 넘어가 세 번의 선택이 끊기지 않는다.
        const next = this.party.findIndex((id) => id === null);
        this.pickingSlot = next >= 0 ? next : null;
        this.render();
      });
      body.add(card);
    });
    if (roster.length === 0) body.add(this.scene.add.text(0, GRID.top + height / 2, "보낼 수 있는 렐릭이 없다", textStyle({ role: "body", size: 26, color: COLOR.inkDim })).setOrigin(0.5));
    // 카드의 기하 마스크는 컨테이너 이동을 물려받지 않으므로 자리를 잡은 뒤 한 번 맞춘다.
    this.scene.time.delayedCall(0, () => { for (const child of body.list) if (child instanceof PortraitCard) child.syncMask(); });
  }

  private async start(view: InteractionLayerView): Promise<void> {
    const party = this.party.filter((id): id is string => id !== null);
    if (this.busy || party.length < view.city.partySize.min) return;
    this.busy = true; this.render();
    try {
      await this.manager.start(view.city.id, party);
      this.popups.closeAll();
      this.onChanged?.();
    } finally { this.busy = false; }
  }

  private async claim(dispatch: InteractionDispatchSnapshot | undefined): Promise<void> {
    if (!dispatch || this.busy) return;
    this.busy = true; this.render();
    try {
      const response = await this.manager.claim(dispatch.dispatchId, crypto.randomUUID());
      this.popups.closeAll();
      this.onChanged?.();
      // 영수증은 공용 표기 한 장이 그린다 — 재화 키를 아이콘으로 바꾸는 표도 그쪽이 갖는다.
      openRewardPopup(this.scene, this.popups, {
        title: "교류 보상",
        items: currencyRecordToRewardItems({ [response.granted.currency]: response.granted.amount }),
      });
    } finally { this.busy = false; }
  }
}
