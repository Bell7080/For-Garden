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
import { PORTRAIT_GRID_MASK_GAP, portraitGridContentHeight, portraitGridFirstRowY } from "./portraitGrid";
import { addPopupBackgroundImage } from "./backgrounds";
import { chipPoints, drawLayer, drawHairline, HOLO, slantedRect } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { currencyRecordToRewardItems, openRewardPopup } from "./RewardPopup";
import { autoAssignInteractionParty, interactionRemainingLabel, relicsAwayOnInteraction, type InteractionLayerView } from "./interactionLayerModel";
import { combatPower } from "../core/combatPower";
import { bindLongPress } from "./longPressInfo";
import { sceneInfoManager, type InfoManager } from "./info";

/**
 * 창 한 장의 규격. 위(원화) · 설명 · **파견대 세 칸** · 보유 렐릭 그리드 · 조작 순서다.
 *
 * 예전에는 칸 하나를 누를 때마다 목록이 아래에서 **올라와 덮었다.** 그래서 세 번을 고르는 동안
 * 목록이 세 번 열리고 닫혔고, 칸이 보이지 않는 순간에는 지금 누구를 세웠는지도 사라졌다.
 * 발굴 배치와 같은 구조로 바꾼다 — **세 칸과 목록이 한 화면에 함께 있고**, 칸을 누르는 것은
 * 화면을 여는 일이 아니라 어느 자리에 세울지 고르는 일이다.
 */
const PANEL = { width: 900, height: 1240 } as const;
const ART = { y: -462, height: 260 } as const;
/** 설명·시간·기대 재화. 시간과 재화는 짧아 한 줄에 함께 선다. */
const BRIEF = { descY: -312, lineY: -230, factsY: -205 } as const;
const SLOT = { y: -40, width: 230, height: 250, gap: 26 } as const;
/**
 * 보유 렐릭 그리드.
 *
 * 카드 크기와 줄 간격은 **발굴 배치와 같은 값**이다 — 같은 일을 하는 두 화면이 다른 크기의
 * 카드를 쓰면 얼굴이 화면마다 다르게 잘린다.
 */
const GRID = { left: -380, right: 380, top: 145, bottom: 505, cardWidth: 215, cardHeight: 268, columnGap: 250, rowGap: 313, cols: 3 } as const;
/** 손가락이 이 거리 이상 움직여야 카드 선택이 아니라 스크롤로 판정한다. */
const GRID_DRAG_SLOP = 12;
const ACTION = { y: 560 } as const;

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
  /** 지금 고른 자리. 발굴 배치와 같이 **늘 한 자리가 골라져 있다** — 목록을 눌렀을 때 어디에 설지가 정해져 있어야 손이 한 번에 끝난다. */
  private selectedSlot = 0;
  private busy = false;
  private gridScrollY = 0;
  private gridDragMoved = 0;
  private gridMask?: Phaser.GameObjects.Graphics;
  private onChanged?: () => void;
  private onOpenJournal?: (cityId: string) => void;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly manager: InteractionManager) {}

  open(view: InteractionLayerView, hooks: { onChanged?: () => void; onOpenJournal?: (cityId: string) => void } = {}): void {
    this.view = view; this.onChanged = hooks.onChanged; this.onOpenJournal = hooks.onOpenJournal;
    this.party = [null, null, null];
    this.selectedSlot = 0;
    this.gridScrollY = 0;
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
    const left = -PANEL.width / 2 + 60;
    body.add(this.scene.add.text(left, BRIEF.descY, view.city.description, textStyle({ role: "body", size: 25 })).setWordWrapWidth(PANEL.width - 120));
    body.add(drawHairline(this.scene, 0, BRIEF.lineY, PANEL.width - 140, { color: 0x55b9e8, alpha: 0.32 }));
    // 시간과 돌아오는 것은 짧아 한 줄에 함께 선다. 두 줄로 나누면 그만큼 그리드가 좁아진다.
    body.add(this.scene.add.text(left, BRIEF.factsY, interactionDurationLabel(view.city.durationMinutes), textStyle({ role: "emphasis", size: 26, color: COLOR.accentText })).setOrigin(0, 0.5));
    const rewards = view.city.rewards.map((entry) => `${currencyGuide(entry.currency).name} ${entry.amount.toLocaleString()}`).join("   ");
    body.add(this.scene.add.text(PANEL.width / 2 - 60, BRIEF.factsY, rewards, textStyle({ role: "body", size: 25 })).setOrigin(1, 0.5));
  }

  /** 나가 있는 동안에는 누가 갔는지와 남은 시간만 남는다. */
  private buildAway(body: Phaser.GameObjects.Container, view: InteractionLayerView): void {
    body.add(this.scene.add.text(0, SLOT.y - SLOT.height / 2 - 40, `파견 중 · ${interactionRemainingLabel(view.remainingMs ?? 0)}`, textStyle({ role: "display", size: 34, color: "#a8ddf5" })).setOrigin(0.5));
    this.buildSlots(body, (view.dispatch?.party ?? []).map((id) => id ?? null), false);
  }

  /** 다녀온 파견은 누르는 즉시 보상 영수증으로 이어진다. */
  private buildDone(body: Phaser.GameObjects.Container, view: InteractionLayerView): void {
    this.buildSlots(body, view.dispatch?.party ?? [], false);
    body.add(new Button(this.scene, 0, ACTION.y, {
      width: 460, height: 108, label: this.busy ? "수령 중…" : "보상 수령", variant: "primary",
      accentColor: COLOR.missionClaim, onClick: () => void this.claim(view.dispatch),
    }));
  }

  /**
   * 아직 보내지 않은 층 — **세 칸과 목록이 한 화면에 함께 선다.**
   *
   * 발굴 배치와 같은 구조다. 칸을 누르는 것은 화면을 여는 일이 아니라 어느 자리에 세울지
   * 고르는 일이고, 목록은 늘 그 아래에 있다.
   */
  private buildDispatch(body: Phaser.GameObjects.Container, view: InteractionLayerView): void {
    this.buildSlots(body, this.party, true);
    this.buildRoster(body, view);
    const picked = this.party.filter((id): id is string => id !== null);
    const button = new Button(this.scene, 0, ACTION.y, {
      width: 460, height: 108, label: this.busy ? "보내는 중…" : "파견 보내기",
      sub: `${picked.length} / 3`, variant: "primary", accentColor: 0x55b9e8, accentTextColor: "#d9f3ff",
      onClick: () => void this.start(view),
    });
    button.setEnabled(!this.busy && picked.length >= view.city.partySize.min);
    body.add(button);
  }

  /**
   * 파견대 세 칸.
   *
   * **고른 칸은 발광으로 알린다.** 목록을 눌렀을 때 어디에 설지가 늘 정해져 있어야 손이 한 번에
   * 끝난다. 이미 선 렐릭을 누르면 그 자리를 비우고, 빈 칸을 누르면 그 자리를 고른다.
   */
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
        if (editable && index === this.selectedSlot) card.setSelected(true);
        body.add(card);
      } else {
        const selected = editable && index === this.selectedSlot;
        body.add(drawLayer(this.scene, x, SLOT.y, slantedRect(SLOT.width, SLOT.height, 18), {
          fill: COLOR.panel, alpha: HOLO.glassLight,
          edge: selected ? 0x55b9e8 : COLOR.inkDimHex, edgeAlpha: selected ? 0.95 : 0.5,
        }));
        body.add(this.scene.add.text(x, SLOT.y, `${index + 1}`, textStyle({ role: "display", size: 40, color: selected ? "#d9f3ff" : COLOR.inkDim })).setOrigin(0.5));
      }
      if (!editable) continue;
      const hit = this.scene.add.rectangle(x, SLOT.y, SLOT.width, SLOT.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerup", () => {
        // 선 렐릭을 누르면 뺀다. 빈 칸을 누르면 그 자리를 고른다 — 둘 다 그 자리가 골라진 채로 남는다.
        if (this.party[index]) this.party[index] = null;
        this.selectedSlot = index;
        this.render();
      });
      body.add(hit);
    }
  }

  /**
   * 보유 렐릭 그리드. **늘 화면에 있다.**
   *
   * 이미 다른 도시에 나가 있는 렐릭은 아예 보여 주지 않는다 — 목록에 남겨 두고 누를 때 막으면
   * 왜 안 되는지 화면이 말하지 않은 채 손만 헛돈다. 반대로 **이 파견대에 이미 선 렐릭은 남긴다.**
   * 그래야 누르는 것만으로 두 자리를 맞바꿀 수 있다.
   */
  private buildRoster(body: Phaser.GameObjects.Container, view: InteractionLayerView): void {
    const away = relicsAwayOnInteraction(session.interaction.slots.filter((slot): slot is InteractionDispatchSnapshot => slot !== null));
    const roster = RELICS.filter((relic) => session.owned.has(relic.id) && !away.has(relic.id));

    body.add(this.scene.add.text(GRID.left + 10, GRID.top - 40, `보유 렐릭 · ${this.selectedSlot + 1}번 자리에 배치`, textStyle({ role: "emphasis", size: 23, color: COLOR.accentText })).setOrigin(0, 0.5));
    // 조작 설명 대신 **그 조작을 대신해 주는 단추**를 둔다. 교류에는 발굴의 생산 특화 같은
    // 개체별 기준이 없어 고를 축이 전투력뿐이라, 발굴처럼 기준을 돌려 고르는 화살표는 두지 않는다.
    body.add(new Button(this.scene, GRID.right - 90, GRID.top - 40, {
      width: 170, height: 52, fontSize: 22, label: "자동 배치", accentColor: 0x55b9e8,
      onClick: () => {
        this.party = autoAssignInteractionParty(
          roster.map((relic) => ({ id: relic.id, power: combatPower(relicProgression.getFinalStats(relic.id)) })),
          view.city.partySize.max,
        );
        this.selectedSlot = Math.max(0, this.party.findIndex((id) => id === null));
        this.render();
      },
    }));

    const viewportHeight = GRID.bottom - GRID.top;
    const grid = this.scene.add.container(0, GRID.top + this.gridScrollY);
    body.add(grid);
    roster.forEach((relic, index) => {
      const progress = relicProgression.getProgress(relic.id);
      const x = -GRID.columnGap + (index % GRID.cols) * GRID.columnGap;
      const y = portraitGridFirstRowY(0, GRID.cardHeight, PORTRAIT_GRID_MASK_GAP) + Math.floor(index / GRID.cols) * GRID.rowGap;
      const placedAt = this.party.indexOf(relic.id);
      const card = new PortraitCard(this.scene, x, y, {
        width: GRID.cardWidth, height: GRID.cardHeight, portraitAssetId: relic.portraitAssetId,
        label: relic.name, level: progress.level, rarity: relic.rarity, stars: relicProgression.getStars(relic.id),
        affinity: { element: relic.element, role: relic.role },
      });
      // 이미 선 렐릭은 발광으로 알린다. 목록에서 지우지 않는 이유는 맞바꾸기 때문이다.
      if (placedAt >= 0) card.setSelected(true);
      bindLongPress(this.scene, card.hit, {
        onTap: () => {
          if (this.gridDragMoved > GRID_DRAG_SLOP) return;
          const slot = this.selectedSlot;
          const current = this.party[slot];
          // 다른 자리에 이미 서 있으면 두 자리를 맞바꾼다. 그러지 않으면 같은 렐릭이 두 칸에 선다.
          if (placedAt >= 0) this.party[placedAt] = current;
          this.party[slot] = relic.id;
          const next = this.party.findIndex((id) => id === null);
          this.selectedSlot = next >= 0 ? next : slot;
          this.render();
        },
        onLongPress: () => this.info().showRelic(relic),
        depth: 2600,
      });
      grid.add(card);
    });
    if (roster.length === 0) {
      body.add(this.scene.add.text(0, GRID.top + viewportHeight / 2, "보낼 수 있는 렐릭이 없다", textStyle({ role: "body", size: 26, color: COLOR.inkDim })).setOrigin(0.5));
      return;
    }

    const rows = Math.ceil(roster.length / GRID.cols);
    const contentHeight = PORTRAIT_GRID_MASK_GAP + portraitGridContentHeight(rows, GRID.rowGap, GRID.cardHeight);
    const minScroll = Math.min(0, viewportHeight - contentHeight);
    this.gridScrollY = Phaser.Math.Clamp(this.gridScrollY, minScroll, 0);
    grid.setY(GRID.top + this.gridScrollY);

    // 기하 마스크는 컨테이너 이동을 물려받지 않으므로 팝업 판이 자리를 잡은 뒤 월드 좌표로 맞춘다.
    this.gridMask?.destroy();
    const mask = this.scene.make.graphics({});
    this.gridMask = mask;
    const syncMask = (): void => {
      const matrix = body.getWorldTransformMatrix();
      const topLeft = matrix.transformPoint(GRID.left, GRID.top);
      mask.clear().fillStyle(0xffffff, 1)
        .fillRect(topLeft.x, topLeft.y, (GRID.right - GRID.left) * matrix.scaleX, viewportHeight * matrix.scaleY);
    };
    syncMask();
    grid.setMask(mask.createGeometryMask());
    body.once(Phaser.GameObjects.Events.DESTROY, () => { mask.destroy(); if (this.gridMask === mask) this.gridMask = undefined; });

    let dragging = false;
    let originY = 0;
    const inside = (pointer: Phaser.Input.Pointer): boolean => {
      const matrix = body.getWorldTransformMatrix();
      const topLeft = matrix.transformPoint(GRID.left, GRID.top);
      const bottomRight = matrix.transformPoint(GRID.right, GRID.bottom);
      return pointer.x >= topLeft.x && pointer.x <= bottomRight.x && pointer.y >= topLeft.y && pointer.y <= bottomRight.y;
    };
    const scrollTo = (value: number): void => {
      this.gridScrollY = Phaser.Math.Clamp(value, minScroll, 0);
      grid.setY(GRID.top + this.gridScrollY);
      for (const child of grid.list) if (child instanceof PortraitCard) child.syncMask();
    };
    const onDown = (pointer: Phaser.Input.Pointer): void => {
      if (!inside(pointer)) return;
      dragging = true; originY = this.gridScrollY - pointer.y; this.gridDragMoved = 0;
    };
    const onMove = (pointer: Phaser.Input.Pointer): void => {
      if (!dragging || !pointer.isDown) return;
      this.gridDragMoved = Math.max(this.gridDragMoved, Math.abs(pointer.y - pointer.downY));
      scrollTo(originY + pointer.y);
    };
    const onUp = (): void => { dragging = false; };
    const onWheel = (pointer: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number): void => { if (inside(pointer)) scrollTo(this.gridScrollY - dy); };
    this.scene.input.on("pointerdown", onDown); this.scene.input.on("pointermove", onMove);
    this.scene.input.on("pointerup", onUp); this.scene.input.on("pointerupoutside", onUp);
    this.scene.input.on("wheel", onWheel);
    body.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.scene.input.off("pointerdown", onDown); this.scene.input.off("pointermove", onMove);
      this.scene.input.off("pointerup", onUp); this.scene.input.off("pointerupoutside", onUp);
      this.scene.input.off("wheel", onWheel);
    });
    // 카드의 기하 마스크는 컨테이너 이동을 물려받지 않으므로 자리를 잡은 뒤 한 번 맞춘다.
    this.scene.time.delayedCall(0, () => { syncMask(); for (const child of grid.list) if (child instanceof PortraitCard) child.syncMask(); });
  }

  /** 팝업은 열 때마다 새로 만들어지므로 정보창은 씬 보관대에서 꺼낸다. 팝업 판 위에 서야 해 층을 올린다. */
  private info(): InfoManager {
    return sceneInfoManager(this.scene, { key: "interaction-relic", portraitDepth: 2601, baseDepth: 2600 });
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
