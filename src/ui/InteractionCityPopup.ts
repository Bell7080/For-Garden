import Phaser from "phaser";
import { INTERACTION_DEPARTMENT_LABEL, interactionDurationLabel } from "../data/interactionCities";
import { currencyGuide } from "../data/currencyGuide";
import { RELICS } from "../data/relics";
import { relicAppearanceManager } from "../managers/RelicAppearanceManager";
import { relicProgression } from "../managers/RelicProgressionManager";
import type { InteractionManager } from "../managers/InteractionManager";
import { placePuppet, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { session } from "../state/session";
import type { InteractionDispatchSnapshot } from "../state/session";
import { Button } from "./Button";
import { PortraitCard } from "./PortraitCard";
import {
  formationRosterColumnX,
  formationRosterGrid,
  PORTRAIT_GRID_MASK_GAP,
  portraitGridContentHeight,
  portraitGridFirstRowY,
} from "./portraitGrid";
import { addFormationRemoveChip, addFormationSlotSelection } from "./formationSlotChrome";
import { addPopupBackgroundImage } from "./backgrounds";
import { chipPoints, drawLayer, drawHairline, HOLO, slantedRect } from "./holo";
import {
  INTERACTION_CITY_ACTION,
  INTERACTION_CITY_LOWER,
  INTERACTION_CITY_PANEL,
  INTERACTION_CITY_SLOT,
  INTERACTION_CITY_SLOT_GROUND_OFFSET,
} from "./interactionCityLayout";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { currencyRecordToRewardItems, openRewardPopup } from "./RewardPopup";
import { interactionRemainingLabel, relicsAwayOnInteraction, autoAssignInteractionParty, type InteractionLayerView } from "./interactionLayerModel";
import { combatPower } from "../core/combatPower";
import { nextFormationSlot, placeFormationRelic, tapFormationSlot, toFormationSlots, formationMembers } from "../core/formationSlots";
import { bindLongPress } from "./longPressInfo";
import { loadOwnedPuppet } from "./statusPuppetLoad";
import { sceneInfoManager, type InfoManager } from "./info";

/**
 * 도시 한 곳의 쪽지 — **발굴 배치와 같은 구조**다.
 *
 * 위 칸에는 파견대 세 자리와 그 자리에 선 SD가 늘 서 있고, 아래 칸만 **도시 안내**와 **보유 렐릭
 * 그리드**로 교대한다. 칸을 누르는 것은 새 화면을 여는 일이 아니라 어느 자리에 세울지 고르는
 * 일이므로, 세워 둔 SD가 사라졌다 다시 나타나지 않는다.
 */
const PANEL = INTERACTION_CITY_PANEL;
const SLOT = INTERACTION_CITY_SLOT;
const SLOT_GROUND_OFFSET = INTERACTION_CITY_SLOT_GROUND_OFFSET;
const LOWER = INTERACTION_CITY_LOWER;
const ACTION = INTERACTION_CITY_ACTION;
/** 한 줄에 몇 칸이고 카드가 얼마나 큰지는 화면이 정하지 않는다 — 폭만 주면 공용 규칙이 정한다. */
const ROSTER = formationRosterGrid(LOWER.right - LOWER.left);
/** 손가락이 이 거리 이상 움직여야 카드 선택이 아니라 스크롤로 판정한다. */
const GRID_DRAG_SLOP = 12;
/** 팝업 판(PopupLayer 기본 2000) 바로 위. 그 위에 열리는 보상 팝업보다는 아래에 남는다. */
const SD_DEPTH = 2601;
const BLUE = 0x55b9e8;

export class InteractionCityPopup {
  private view?: InteractionLayerView;
  /** 빈 자리를 `null`로 남기는 고정 세 자리. 빼도 뒤가 당겨지지 않는다. */
  private party: (string | null)[] = [null, null, null];
  /** 목록을 눌렀을 때 캐릭터가 설 자리. 늘 한 자리가 골라져 있다. */
  private selectedSlot = 0;
  /** 아래 칸이 지금 무엇을 보여 주는가. 칸을 누르면 배치로, 취소하면 안내로 돌아온다. */
  private editing = false;
  private busy = false;
  private gridScrollY = 0;
  private gridDragMoved = 0;
  private body?: Phaser.GameObjects.Container;
  /** 자리·SD가 사는 위 칸과 안내/그리드가 교대하는 아래 칸. */
  private upper?: Phaser.GameObjects.Container;
  private lower?: Phaser.GameObjects.Container;
  private actions?: Phaser.GameObjects.Container;
  /** 이미 세운 SD를 렐릭 ID로 붙잡아 둔다. 편성에서 빠지는 순간에만 폐기한다. */
  private readonly puppets = new Map<string, PuppetCreature>();
  private readonly puppetLoading = new Set<string>();
  private sdLayer?: Phaser.GameObjects.Container;
  private gridMask?: Phaser.GameObjects.Graphics;
  private detachGrid?: () => void;
  private onChanged?: () => void;
  private onOpenJournal?: (cityId: string) => void;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly manager: InteractionManager) {}

  open(view: InteractionLayerView, hooks: { onChanged?: () => void; onOpenJournal?: (cityId: string) => void } = {}): void {
    this.view = view;
    this.onChanged = hooks.onChanged;
    this.onOpenJournal = hooks.onOpenJournal;
    this.party = toFormationSlots(view.state === "idle" ? [] : (view.dispatch?.party ?? []), 3);
    this.selectedSlot = 0;
    this.editing = false;
    this.gridScrollY = 0;
    this.busy = false;
    this.popups.closeAll();

    const title = `${view.city.displayName} ${INTERACTION_DEPARTMENT_LABEL[view.city.department]}`;
    this.body = this.popups.open({ width: PANEL.width, height: PANEL.height, title, titleSize: 34, dim: true, closeOnBackdrop: true, onClose: () => this.dispose() }, (body) => {
      body.setName("interaction-city-popup");
      this.upper = this.scene.add.container(0, 0);
      this.lower = this.scene.add.container(0, 0);
      this.actions = this.scene.add.container(0, 0);
      body.add([this.upper, this.lower, this.actions]);
      // SD는 판 위에 서지만 판의 자식이라 팝업의 이동·배율·alpha를 그대로 물려받는다.
      this.sdLayer = this.scene.add.container(0, 0).setName("interaction-party-sd").setDepth(SD_DEPTH);
      body.add(this.sdLayer);
      // 일지는 그 도시에서만 쌓이므로 도시 쪽지가 유일한 진입점이다.
      if (this.onOpenJournal) body.add(new Button(this.scene, PANEL.width / 2 - 130, -PANEL.height / 2 + 96, {
        width: 200, height: 62, fontSize: 22, label: "도시 일지", accentColor: BLUE,
        onClick: () => this.onOpenJournal?.(view.city.id),
      }));
    });
    this.render();
  }

  /** 위 칸·아래 칸·조작을 지금 상태에 맞춘다. 팝업 판 자체는 다시 열지 않는다. */
  private render(): void {
    const view = this.view;
    if (!view || !this.body) return;
    this.renderSlots(view);
    if (this.editing) this.renderRoster(view);
    else this.renderBrief(view);
    this.renderActions(view);
  }

  /**
   * 파견대 세 자리.
   *
   * 나가 있거나 다녀온 파견은 고칠 수 없으므로 칸을 눌러도 아무 일도 일어나지 않는다. 아직
   * 보내지 않은 도시만 칸을 눌러 자리를 고르고, 고른 자리에 누가 서 있으면 `−`가 함께 선다.
   */
  private renderSlots(view: InteractionLayerView): void {
    const parent = this.upper;
    if (!parent) return;
    parent.removeAll(true);
    const editable = view.state === "idle";
    this.releaseUnusedPuppets();

    if (view.state === "away") {
      parent.add(this.scene.add.text(0, SLOT.y - SLOT.height / 2 - 52, `파견 중 · ${interactionRemainingLabel(view.remainingMs ?? 0)}`, textStyle({ role: "display", size: 34, color: "#a8ddf5" })).setOrigin(0.5));
    } else if (view.state === "done") {
      parent.add(this.scene.add.text(0, SLOT.y - SLOT.height / 2 - 52, "수령 대기", textStyle({ role: "display", size: 34, color: "#e0a83e" })).setOrigin(0.5));
    }

    this.party.forEach((relicId, index) => {
      const x = (index - 1) * SLOT.step;
      const box = { x, y: SLOT.y, width: SLOT.width, height: SLOT.height };
      if (editable && index === this.selectedSlot) addFormationSlotSelection(this.scene, parent, box, BLUE);
      if (relicId) {
        parent.add(this.scene.add.ellipse(x, SLOT.y + SLOT_GROUND_OFFSET + 2, 172, 25, BLUE, 0.16));
        this.standPuppet(relicId, x);
      } else {
        parent.add(drawLayer(this.scene, x, SLOT.y, slantedRect(SLOT.width, SLOT.height, 18), {
          fill: COLOR.panel, alpha: HOLO.glassLight,
          edge: editable && index === this.selectedSlot ? BLUE : COLOR.inkDimHex, edgeAlpha: 0.55,
        }));
        parent.add(this.scene.add.text(x, SLOT.y, `${index + 1}`, textStyle({ role: "display", size: 40, color: COLOR.inkDim })).setOrigin(0.5));
      }
      if (!editable) return;
      const hit = this.scene.add.rectangle(x, SLOT.y, SLOT.width, SLOT.height, 0xffffff, 0)
        .setName(`interaction-party-slot-${index + 1}`).setDepth(SD_DEPTH + 1).setInteractive({ useHandCursor: true });
      hit.on("pointerup", () => this.tapSlot(index));
      parent.add(hit);
      if (index === this.selectedSlot && relicId) addFormationRemoveChip(this.scene, parent, box, () => this.tapSlot(index, "clear"));
    });
  }

  /**
   * 칸을 누르면 그 자리를 고르고 아래 칸이 목록으로 바뀐다.
   *
   * 이미 고른 자리를 한 번 더 누르거나 `−`를 누를 때만 비고, 그때도 뒤 자리는 당겨지지 않는다.
   */
  private tapSlot(index: number, intent: "select" | "clear" = "select"): void {
    if (this.busy) return;
    const result = tapFormationSlot(this.party, index, this.selectedSlot, intent);
    this.party = result.formation;
    this.selectedSlot = result.selectedSlot;
    // 비우려고 누른 손까지 목록을 열지는 않는다 — 비운 자리를 그대로 두고 보낼 수도 있다.
    if (intent === "select" && !result.cleared) this.editing = true;
    this.render();
  }

  /** 아래 칸 — 이 도시가 어떤 곳이고 얼마나 걸리며 무엇이 돌아오는가. */
  private renderBrief(view: InteractionLayerView): void {
    const parent = this.lower;
    if (!parent) return;
    this.teardownGrid();
    parent.removeAll(true);
    const artHeight = 250;
    const artY = LOWER.top + artHeight / 2;
    const shape = chipPoints(LOWER.right - LOWER.left, artHeight, { bevel: { topLeft: 96, bottomRight: 96 } });
    if (this.scene.textures.exists(view.city.illustration)) {
      addPopupBackgroundImage(this.scene, parent, view.city.illustration, { x: 0, y: artY, width: LOWER.right - LOWER.left, height: artHeight, maskShape: shape, overlayStrength: 0.5 });
    } else {
      parent.add(drawLayer(this.scene, 0, artY, shape, { fill: COLOR.panel, alpha: HOLO.glass }));
    }

    const left = LOWER.left + 10;
    parent.add(this.scene.add.text(left, artY + artHeight / 2 + 26, view.city.description, textStyle({ role: "body", size: 25 })).setWordWrapWidth(LOWER.right - LOWER.left - 20));
    const factsY = LOWER.bottom - 40;
    parent.add(drawHairline(this.scene, 0, factsY - 34, LOWER.right - LOWER.left - 40, { color: BLUE, alpha: 0.32 }));
    // 시간과 돌아오는 것은 짧아 한 줄에 함께 선다.
    parent.add(this.scene.add.text(left, factsY, interactionDurationLabel(view.city.durationMinutes), textStyle({ role: "emphasis", size: 26, color: COLOR.accentText })).setOrigin(0, 0.5));
    const rewards = view.city.rewards.map((entry) => `${currencyGuide(entry.currency).name} ${entry.amount.toLocaleString()}`).join("   ");
    parent.add(this.scene.add.text(LOWER.right - 10, factsY, rewards, textStyle({ role: "body", size: 25 })).setOrigin(1, 0.5));
  }

  /**
   * 아래 칸 — 보유 렐릭 그리드.
   *
   * 이미 다른 도시에 나가 있는 렐릭은 아예 보여 주지 않는다. 목록에 남겨 두고 누를 때 막으면
   * 왜 안 되는지 화면이 말하지 않은 채 손만 헛돈다. 반대로 **이 파견대에 이미 선 렐릭은 남긴다** —
   * 그래야 누르는 것만으로 두 자리를 맞바꿀 수 있다.
   */
  private renderRoster(view: InteractionLayerView): void {
    const parent = this.lower;
    if (!parent) return;
    this.teardownGrid();
    parent.removeAll(true);

    const away = relicsAwayOnInteraction(session.interaction.slots.filter((slot): slot is InteractionDispatchSnapshot => slot !== null));
    const roster = RELICS.filter((relic) => session.owned.has(relic.id) && !away.has(relic.id));

    parent.add(this.scene.add.text(LOWER.left + 10, LOWER.top - 42, `보유 렐릭 · ${this.selectedSlot + 1}번 자리에 배치`, textStyle({ role: "emphasis", size: 23, color: COLOR.accentText })).setOrigin(0, 0.5));
    // 조작 설명 대신 그 조작을 대신해 주는 단추를 둔다. 교류에는 발굴의 생산 특화 같은 개체별
    // 기준이 없어 고를 축이 전투력뿐이라, 발굴처럼 기준을 돌려 고르는 화살표는 두지 않는다.
    parent.add(new Button(this.scene, LOWER.right - 90, LOWER.top - 42, {
      width: 170, height: 52, fontSize: 22, label: "자동 배치", accentColor: BLUE,
      onClick: () => {
        this.party = toFormationSlots(autoAssignInteractionParty(
          roster.map((relic) => ({ id: relic.id, power: combatPower(relicProgression.getFinalStats(relic.id)) })),
          view.city.partySize.max,
        ), 3);
        this.selectedSlot = Math.max(0, this.party.findIndex((id) => id === null));
        this.render();
      },
    }));

    if (roster.length === 0) {
      parent.add(this.scene.add.text(0, (LOWER.top + LOWER.bottom) / 2, "보낼 수 있는 렐릭이 없다", textStyle({ role: "body", size: 26, color: COLOR.inkDim })).setOrigin(0.5));
      return;
    }

    const grid = this.scene.add.container(0, LOWER.top + this.gridScrollY);
    parent.add(grid);
    roster.forEach((relic, index) => {
      const progress = relicProgression.getProgress(relic.id);
      const x = formationRosterColumnX(ROSTER, index % ROSTER.columns);
      const y = portraitGridFirstRowY(0, ROSTER.cardHeight, PORTRAIT_GRID_MASK_GAP) + Math.floor(index / ROSTER.columns) * ROSTER.rowStep;
      const card = new PortraitCard(this.scene, x, y, {
        width: ROSTER.cardWidth, height: ROSTER.cardHeight, relicId: relic.id,
        label: relic.name, level: progress.level, rarity: relic.rarity, stars: relicProgression.getStars(relic.id),
        affinity: { element: relic.element, role: relic.role },
        // 이미 자리에 나가 있는 카드는 떠오르지 않고 눌려 들어간다.
        selectedStyle: "pressed",
      });
      card.setSelected(this.party.includes(relic.id));
      bindLongPress(this.scene, card.hit, {
        onTap: () => {
          const slot = this.selectedSlot;
          this.party = placeFormationRelic(this.party, slot, relic.id);
          this.selectedSlot = this.party[slot] === null ? slot : nextFormationSlot(this.party, slot);
          this.render();
        },
        allowTap: () => this.gridDragMoved <= GRID_DRAG_SLOP,
        onLongPress: () => this.info().showRelic(relic),
        depth: SD_DEPTH + 2,
      });
      grid.add(card);
    });

    this.attachGridScroll(parent, grid, roster.length);
  }

  /** 아래 칸이 무엇을 보여 주든 주요 조작은 같은 높이에 선다. */
  private renderActions(view: InteractionLayerView): void {
    const parent = this.actions;
    if (!parent) return;
    parent.removeAll(true);
    if (view.state === "away") return;
    if (view.state === "done") {
      parent.add(new Button(this.scene, 0, ACTION.y, {
        width: 460, height: 108, label: this.busy ? "수령 중…" : "보상 수령", variant: "primary",
        accentColor: COLOR.missionClaim, onClick: () => void this.claim(view.dispatch),
      }));
      return;
    }

    const picked = formationMembers(this.party);
    // 배치 중에만 취소가 그 왼쪽에 나타난다 — 발굴과 같은 자리, 같은 폭이다.
    if (this.editing) {
      const cancel = new Button(this.scene, ACTION.cancelX, ACTION.y, {
        width: 220, height: 82, label: "취소", onClick: () => { if (!this.busy) { this.editing = false; this.render(); } },
      });
      cancel.setEnabled(!this.busy);
      parent.add(cancel);
    }
    const send = new Button(this.scene, this.editing ? ACTION.primaryX : 0, ACTION.y, {
      width: this.editing ? 500 : 460, height: this.editing ? 92 : 108,
      label: this.busy ? "보내는 중…" : "파견 보내기",
      sub: `${picked.length} / 3`, variant: "primary", accentColor: BLUE, accentTextColor: "#d9f3ff",
      onClick: () => void this.start(view),
    });
    send.setEnabled(!this.busy && picked.length >= view.city.partySize.min);
    parent.add(send);
  }

  /** 아직 서 있지 않은 렐릭만 읽어 세우고, 이미 선 SD는 자리만 옮긴다. */
  private standPuppet(relicId: string, x: number): void {
    const layer = this.sdLayer;
    if (!layer) return;
    const groundY = SLOT.y + SLOT_GROUND_OFFSET;
    const standing = this.puppets.get(relicId);
    if (standing) {
      placePuppet(standing, relicAppearanceManager.sdAssetFor(relicId), { x, groundY, height: 205 });
      standing.setDepth(SD_DEPTH);
      return;
    }
    if (this.puppetLoading.has(relicId)) return;
    this.puppetLoading.add(relicId);
    void loadOwnedPuppet({
      spawn: () => spawnPuppet(this.scene, relicAppearanceManager.sdAssetFor(relicId), { x, groundY, height: 205, depth: SD_DEPTH }),
      // 아래 칸이 몇 번을 바뀌어도 SD는 살아남는다. 버릴 때는 그 렐릭이 편성에서 빠질 때뿐이다.
      isCurrent: () => Boolean(this.body) && layer === this.sdLayer && this.party.includes(relicId),
      isDisplayable: (puppet) => Boolean(puppet.active && puppet.texture?.key && this.scene.textures.exists(puppet.texture.key)),
      adopt: (puppet) => { puppet.disableInteractive(); layer.add(puppet); this.puppets.set(relicId, puppet); },
    }).finally(() => this.puppetLoading.delete(relicId));
  }

  /** 편성에서 빠진 렐릭의 SD만 폐기한다. */
  private releaseUnusedPuppets(): void {
    for (const [relicId, puppet] of this.puppets) {
      if (this.party.includes(relicId)) continue;
      this.sdLayer?.remove(puppet, false);
      puppet.destroy();
      this.puppets.delete(relicId);
    }
  }

  /** 보유 카드가 한 줄을 넘으면 드래그와 휠이 같은 연속 스크롤 값을 갱신한다. */
  private attachGridScroll(parent: Phaser.GameObjects.Container, grid: Phaser.GameObjects.Container, relicCount: number): void {
    const viewportHeight = LOWER.bottom - LOWER.top;
    const rows = Math.ceil(relicCount / ROSTER.columns);
    const contentHeight = PORTRAIT_GRID_MASK_GAP + portraitGridContentHeight(rows, ROSTER.rowStep, ROSTER.cardHeight);
    const minScroll = Math.min(0, viewportHeight - contentHeight - 28);
    this.gridScrollY = Phaser.Math.Clamp(this.gridScrollY, minScroll, 0);
    grid.setY(LOWER.top + this.gridScrollY);

    // 기하 마스크는 컨테이너 이동을 물려받지 않으므로 팝업 판이 자리를 잡은 뒤 월드 좌표로 맞춘다.
    const mask = this.scene.make.graphics({});
    this.gridMask = mask;
    const syncMask = (): void => {
      const matrix = parent.getWorldTransformMatrix();
      const topLeft = matrix.transformPoint(LOWER.left, LOWER.top);
      mask.clear().fillStyle(0xffffff, 1)
        .fillRect(topLeft.x, topLeft.y, (LOWER.right - LOWER.left) * matrix.scaleX, viewportHeight * matrix.scaleY);
      for (const child of grid.list) if (child instanceof PortraitCard) child.syncMask();
    };
    syncMask();
    grid.setMask(mask.createGeometryMask());
    const ticker = this.scene.time.addEvent({ delay: 16, loop: true, callback: syncMask });

    const scrollTo = (value: number): void => {
      this.gridScrollY = Phaser.Math.Clamp(value, minScroll, 0);
      grid.setY(LOWER.top + this.gridScrollY);
      syncMask();
    };
    const inside = (pointer: Phaser.Input.Pointer): boolean => {
      const matrix = parent.getWorldTransformMatrix();
      const topLeft = matrix.transformPoint(LOWER.left, LOWER.top);
      const bottomRight = matrix.transformPoint(LOWER.right, LOWER.bottom);
      return pointer.x >= topLeft.x && pointer.x <= bottomRight.x && pointer.y >= topLeft.y && pointer.y <= bottomRight.y;
    };
    let dragging = false;
    let originY = 0;
    const onDown = (pointer: Phaser.Input.Pointer): void => {
      if (!inside(pointer) || minScroll === 0) return;
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
    this.detachGrid = () => {
      this.scene.input.off("pointerdown", onDown); this.scene.input.off("pointermove", onMove);
      this.scene.input.off("pointerup", onUp); this.scene.input.off("pointerupoutside", onUp);
      this.scene.input.off("wheel", onWheel);
      ticker.remove(false);
      mask.destroy();
      if (this.gridMask === mask) this.gridMask = undefined;
    };
  }

  /** 아래 칸이 바뀔 때마다 그리드의 전역 리스너·틱커·마스크를 함께 뗀다. */
  private teardownGrid(): void {
    this.detachGrid?.();
    this.detachGrid = undefined;
  }

  /** 팝업이 닫히면 SD와 전역 리스너까지 남김없이 정리한다. */
  private dispose(): void {
    this.teardownGrid();
    for (const puppet of this.puppets.values()) puppet.destroy();
    this.puppets.clear();
    this.puppetLoading.clear();
    this.sdLayer = undefined;
    this.upper = undefined; this.lower = undefined; this.actions = undefined;
    this.body = undefined;
  }

  /** 팝업은 열 때마다 새로 만들어지므로 정보창은 씬 보관대에서 꺼낸다. 팝업 판 위에 서야 해 층을 올린다. */
  private info(): InfoManager {
    return sceneInfoManager(this.scene, { key: "interaction-relic", portraitDepth: SD_DEPTH + 4, baseDepth: SD_DEPTH + 3 });
  }

  private async start(view: InteractionLayerView): Promise<void> {
    const party = formationMembers(this.party);
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
