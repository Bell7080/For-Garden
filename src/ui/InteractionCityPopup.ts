import Phaser from "phaser";
import { t } from "../i18n";
import { INTERACTION_DEPARTMENT_LABEL, interactionDurationLabel } from "../data/interactionCities";
import { addFramedIcon } from "./itemFrame";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import type { WalletItemKey } from "../data/items";
import { formatCurrency } from "../core/formatCurrency";
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
import { addFormationRemoveChip, addFormationSlotPlate, addFormationSlotSelection } from "./formationSlotChrome";
import { addPopupBackgroundImage, type PopupBackgroundImage } from "./backgrounds";
import { chipPoints, drawLayer, drawHairline, HOLO } from "./holo";
import {
  INTERACTION_CITY_ACTION,
  INTERACTION_CITY_BRIEF_ART,
  INTERACTION_CITY_BRIEF_ROWS,
  INTERACTION_CITY_BRIEF_TEXT,
  INTERACTION_CITY_LOWER,
  INTERACTION_CITY_PANEL,
  INTERACTION_CITY_REWARD_FRAME,
  INTERACTION_CITY_SLOT,
  INTERACTION_CITY_SLOT_GROUND_OFFSET,
} from "./interactionCityLayout";
import type { PopupLayer } from "./PopupLayer";
import { POPUP_BODY_BEVEL_RATIO } from "./popupGeometry";
import { COLOR, textStyle } from "./theme";
import { currencyRecordToRewardItems, openRewardPopup } from "./RewardPopup";
import { interactionRemainingLabel, relicsAwayOnInteraction, autoAssignInteractionParty, type InteractionLayerView } from "./interactionLayerModel";
import { combatPower } from "../core/combatPower";
import { tapFormationSlot, tapRosterRelic, toFormationSlots, formationMembers } from "../core/formationSlots";
import { bindLongPress } from "./longPressInfo";
import { CurrencyGuidePopup } from "./CurrencyGuidePopup";
import { startPuppetHop } from "./puppetHop";
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
/** 돌아오는 것 줄에서 누름과 끌기를 가르는 거리. 그리드와 같은 몫이라 손맛이 갈리지 않는다. */
const REWARD_TAP_SLOP = GRID_DRAG_SLOP;
const REWARD_FRAME = INTERACTION_CITY_REWARD_FRAME;
const BRIEF_ROWS = INTERACTION_CITY_BRIEF_ROWS;
const BRIEF_TEXT = INTERACTION_CITY_BRIEF_TEXT;
const BRIEF_ART = INTERACTION_CITY_BRIEF_ART;
/** 팝업 판(PopupLayer 기본 2000) 바로 위. 그 위에 열리는 보상 팝업보다는 아래에 남는다. */
const SD_DEPTH = 2601;
const BLUE = 0x55b9e8;
/**
 * 판 뒤에 깔리는 원화의 마스크 — `PopupLayer`가 몸판을 그리는 실루엣과 같은 값이다.
 *
 * 네모로 깔면 왼쪽 위와 오른쪽 아래의 깎인 모서리 밖으로 그림이 삐져나와, 한 창 안에 판이 두
 * 장 보인다. 깎이는 깊이는 `POPUP_BODY_BEVEL_RATIO` 한 값에서 나와 판과 그림이 갈리지 않는다.
 */
const PANEL_BEVEL = Math.min(PANEL.width, PANEL.height) * POPUP_BODY_BEVEL_RATIO;
const PANEL_SHAPE = chipPoints(PANEL.width, PANEL.height, { bevel: { topLeft: PANEL_BEVEL, topRight: 0, bottomRight: PANEL_BEVEL, bottomLeft: 0 } });
/**
 * 뒷배경 원화의 진하기와 그 위에 덮는 청흑색의 세기.
 *
 * 글과 칸보다 먼저 읽히면 배경이 아니라 그림이 된다 — 아래 칸이 또렷하게 세우는 그 원화가
 * 이 판의 주인공이고, 뒤에 깔리는 한 겹은 "여기가 어느 도시인가"의 결만 남기면 된다.
 */
const BACKDROP = { alpha: 0.13, overlay: 1.6 } as const;
/** 남은 시간이 초까지 도는 시계라 초가 바뀌는 순간을 놓치지 않을 만큼만 자주 본다. */
const CLOCK_TICK_MS = 200;

export class InteractionCityPopup {
  private view?: InteractionLayerView;
  /** 빈 자리를 `null`로 남기는 고정 세 자리. 빼도 뒤가 당겨지지 않는다. */
  private party: (string | null)[] = [null, null, null];
  /** 목록을 눌렀을 때 캐릭터가 설 자리. 아무 칸도 고르지 않은 상태가 있다. */
  private selectedSlot: number | undefined;
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
  /** 목록 카드. 편성이 바뀌면 눌림 표시만 갈아 끼워 그리드를 다시 만들지 않는다. */
  private readonly rosterCards = new Map<string, PortraitCard>();
  /** 어느 자리에 세우는 중인지 말하는 줄. 고른 칸이 바뀌면 글자만 갈아 끼운다. */
  private rosterHint?: Phaser.GameObjects.Text;
  private sdLayer?: Phaser.GameObjects.Container;
  private chromeLayer?: Phaser.GameObjects.Container;
  private gridMask?: Phaser.GameObjects.Graphics;
  private detachGrid?: () => void;
  /** 판 뒤에 은은하게 깔리는 그 도시의 원화. 판을 닫을 때 마스크와 함께 걷어 낸다. */
  private backdrop?: PopupBackgroundImage;
  /** 아래 칸 안내가 세우는 원화. 아래 칸이 그리드로 바뀔 때마다 함께 걷힌다. */
  private briefArt?: PopupBackgroundImage;
  /** 나가 있는 동안 초까지 도는 시계. 그 줄 하나만 갈아 끼운다. */
  private remainingLabel?: Phaser.GameObjects.Text;
  private clock?: Phaser.Time.TimerEvent;
  /** 지금 서버 시각. 씬이 서버와 맞춰 둔 시계를 그대로 받는다. */
  private now: () => number = () => Date.now();
  /** 세워 둔 SD가 제자리에서 뛰는 tween. 그 SD를 버릴 때 함께 멈춘다. */
  private readonly hops = new Map<string, Phaser.Tweens.Tween>();
  private onChanged?: () => void;
  private onOpenJournal?: (cityId: string) => void;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly manager: InteractionManager) {}

  open(view: InteractionLayerView, hooks: { onChanged?: () => void; onOpenJournal?: (cityId: string) => void; now?: () => number } = {}): void {
    this.view = view;
    this.onChanged = hooks.onChanged;
    this.onOpenJournal = hooks.onOpenJournal;
    this.now = hooks.now ?? (() => Date.now());
    this.party = toFormationSlots(view.state === "idle" ? [] : (view.dispatch?.party ?? []), 3);
    this.selectedSlot = undefined;
    this.editing = false;
    this.gridScrollY = 0;
    this.busy = false;
    this.popups.closeAll();

    const title = `${view.city.displayName} ${INTERACTION_DEPARTMENT_LABEL[view.city.department]}`;
    // 오른쪽 위 X 대신 **화면과 같은 우하단 뒤로가기**를 쓴다. 이 쪽지는 읽고 마는 쪽지가 아니라
    // 편성을 세우고 보내는 작업판이라, 닫는 손이 화면의 다른 작업판과 같은 자리에 있어야 한다.
    this.body = this.popups.open({ width: PANEL.width, height: PANEL.height, title, titleSize: 34, dim: true, closeOnBackdrop: true, backButton: true, onClose: () => this.dispose() }, (body) => {
      body.setName("interaction-city-popup");
      // **판 뒤에는 그 도시의 원화가 은은하게 깔린다.** 빈 남색 판 위에 칸과 글만 서면 어느
      // 도시의 쪽지인지 제목 한 줄로만 읽힌다. 아래 칸이 또렷하게 세우는 그 원화를 판 전체에
      // 한 겹 더 깔되 거의 보이지 않을 만큼 눌러, 글과 칸보다 먼저 읽히지 않게 한다.
      if (this.scene.textures.exists(view.city.illustration)) {
        this.backdrop = addPopupBackgroundImage(this.scene, body, view.city.illustration, {
          x: 0, y: 0, width: PANEL.width, height: PANEL.height, maskShape: PANEL_SHAPE,
          imageAlpha: BACKDROP.alpha, overlayStrength: BACKDROP.overlay,
        });
      }
      this.upper = this.scene.add.container(0, 0);
      this.lower = this.scene.add.container(0, 0);
      this.actions = this.scene.add.container(0, 0);
      body.add([this.upper, this.lower, this.actions]);
      // SD는 판 위에 서지만 판의 자식이라 팝업의 이동·배율·alpha를 그대로 물려받는다.
      this.sdLayer = this.scene.add.container(0, 0).setName("interaction-party-sd").setDepth(SD_DEPTH);
      body.add(this.sdLayer);
      // 빼는 표식만 SD보다 앞선 층에 산다. 고른 칸의 밑판은 반대로 SD 뒤(upper)에 깔린다.
      this.chromeLayer = this.scene.add.container(0, 0).setName("interaction-party-chrome").setDepth(SD_DEPTH + 2);
      body.add(this.chromeLayer);
      // 일지는 그 도시에서만 쌓이므로 도시 쪽지가 유일한 진입점이다.
      if (this.onOpenJournal) body.add(new Button(this.scene, PANEL.width / 2 - 130, -PANEL.height / 2 + 96, {
        width: 200, height: 62, fontSize: 22, label: t("interaction.journal"), accentColor: BLUE,
        onClick: () => this.onOpenJournal?.(view.city.id),
      }));
    });
    // 나가 있는 동안에는 남은 시간이 초까지 돈다. 그 줄 하나만 갈아 끼워 SD와 칸은 그대로 둔다.
    this.clock = this.scene.time.addEvent({ delay: CLOCK_TICK_MS, loop: true, callback: () => this.tickClock() });
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
    this.chromeLayer?.removeAll(true);
    const editable = view.state === "idle";
    this.releaseUnusedPuppets();

    this.remainingLabel = undefined;
    if (view.state === "away") {
      this.remainingLabel = this.scene.add.text(0, SLOT.y - SLOT.height / 2 - 52, t("interaction.dispatched", { remaining: interactionRemainingLabel(this.remainingMs(view)) }), textStyle({ role: "display", size: 34, color: "#a8ddf5" })).setOrigin(0.5);
      parent.add(this.remainingLabel);
    } else if (view.state === "done") {
      parent.add(this.scene.add.text(0, SLOT.y - SLOT.height / 2 - 52, t("interaction.awaitingClaim"), textStyle({ role: "display", size: 34, color: "#e0a83e" })).setOrigin(0.5));
    }

    this.party.forEach((relicId, index) => {
      const x = (index - 1) * SLOT.step;
      const box = { x, y: SLOT.y, width: SLOT.width, height: SLOT.height };
      if (editable && index === this.selectedSlot) addFormationSlotSelection(this.scene, parent, box, BLUE);
      // 칸의 밑판·발밑 그림자·빈 자리 번호는 네 편성 화면이 공유하는 한 장이다. 판은 서 있든
      // 비었든 늘 깔린다 — 세 칸이 같은 판 위에 서야 무엇을 더 고를 수 있는지가 보인다.
      addFormationSlotPlate(this.scene, parent, box, {
        accent: BLUE, occupied: Boolean(relicId), index, groundOffset: SLOT_GROUND_OFFSET,
      });
      if (relicId) this.standPuppet(relicId, x);
      if (!editable) return;
      const hit = this.scene.add.rectangle(x, SLOT.y, SLOT.width, SLOT.height, 0xffffff, 0)
        .setName(`interaction-party-slot-${index + 1}`).setDepth(SD_DEPTH + 1).setInteractive({ useHandCursor: true });
      hit.on("pointerup", () => this.tapSlot(index));
      parent.add(hit);
      // 빼는 표식은 SD보다 앞선 층에 선다 — 같은 컨테이너에 두면 머리에 가린다.
      if (index === this.selectedSlot && relicId && this.chromeLayer) addFormationRemoveChip(this.scene, this.chromeLayer, box, () => this.tapSlot(index, "clear"));
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

  /**
   * 지금 남은 밀리초.
   *
   * 열 때 받아 둔 `remainingMs`를 그대로 쓰지 않는다 — 그 값은 쪽지를 연 순간의 사진이라,
   * 판을 열어 둔 채 기다리면 시계가 멈춘 것처럼 보인다. 끝나는 시각에서 지금을 뺀다.
   */
  private remainingMs(view: InteractionLayerView): number {
    const completesAt = view.dispatch ? Date.parse(view.dispatch.completesAt) : Number.NaN;
    if (!Number.isFinite(completesAt)) return view.remainingMs ?? 0;
    return Math.max(0, completesAt - this.now());
  }

  /** 초가 흐른 결과. 다녀온 순간에만 판 전체를 다시 그리고 그 밖에는 시계 글자만 갈아 끼운다. */
  private tickClock(): void {
    const view = this.view;
    if (!view || !this.body || view.state !== "away") return;
    const remaining = this.remainingMs(view);
    if (remaining <= 0) { this.onChanged?.(); return; }
    this.remainingLabel?.setText(t("interaction.dispatched", { remaining: interactionRemainingLabel(remaining) }));
  }

  /** 아래 칸 — 이 도시가 어떤 곳이고 얼마나 걸리며 무엇이 돌아오는가. */
  private renderBrief(view: InteractionLayerView): void {
    const parent = this.lower;
    if (!parent) return;
    this.teardownGrid();
    this.teardownBriefArt();
    this.rosterHint = undefined;
    parent.removeAll(true);
    const artHeight = BRIEF_ART.height;
    const artY = LOWER.top + artHeight / 2;
    const shape = chipPoints(LOWER.right - LOWER.left, artHeight, { bevel: { topLeft: 96, bottomRight: 96 } });
    // **판을 먼저 깔고 그 위에 원화를 얹는다.** 예전에는 이미 올라온 텍스처만 세우고 아니면 판
    // 하나로 끝냈는데, 부트가 미리 읽는 두 장 말고는 **어느 도시 원화도 그 순간에는 없어서**
    // 늘 빈 판만 보였다. 원화는 들어올 때 읽고 나올 때 내리는 것이 규칙이므로(`backgrounds.ts`),
    // 도착하기 전까지는 이 판이 그 자리를 지키고 도착하면 그 위에 그려진다.
    parent.add(drawLayer(this.scene, 0, artY, shape, { fill: COLOR.panel, alpha: HOLO.glass }));
    // 판 비율에 맞춰 늘이지 않고 `cover`로 키운 뒤 넘치는 쪽만 마스크가 자른다 — 가로 원화가
    // 세로 칸에 들어가도 찌그러지지 않는다.
    this.briefArt = addPopupBackgroundImage(this.scene, parent, view.city.illustration, { x: 0, y: artY, width: LOWER.right - LOWER.left, height: artHeight, maskShape: shape, overlayStrength: 0.5 });

    const left = LOWER.left + 10;
    parent.add(this.scene.add.text(left, artY + artHeight / 2 + BRIEF_ART.descriptionGap, view.city.description, textStyle({ role: "body", size: BRIEF_ART.descriptionSize })).setWordWrapWidth(LOWER.right - LOWER.left - 20));
    parent.add(drawHairline(this.scene, 0, LOWER.bottom + BRIEF_ROWS.divider, LOWER.right - LOWER.left - 40, { color: BLUE, alpha: 0.32 }));
    parent.add(this.scene.add.text(left, LOWER.bottom + BRIEF_ROWS.duration, interactionDurationLabel(view.city.durationMinutes), textStyle({ role: "emphasis", size: BRIEF_TEXT.duration, color: COLOR.accentText })).setOrigin(0, 0.5));

    // **돌아오는 것은 글이 아니라 액자다.** 재화 이름을 늘어놓으면 무엇이 오는지 읽어야 알지만,
    // 액자 한 줄은 훑기만 해도 보인다. 품목이 늘면 판을 키우지 않고 **가로로 흐른다** — 판이
    // 커지면 위 칸의 파견대와 아래 조작이 함께 밀린다.
    parent.add(this.scene.add.text(left, LOWER.bottom + BRIEF_ROWS.rewardLabel, t("interaction.returning"), textStyle({ role: "emphasis", size: BRIEF_TEXT.rewardLabel, color: COLOR.inkDim })).setOrigin(0, 0.5));
    const rail = this.scene.add.container(0, LOWER.bottom + BRIEF_ROWS.rewardFrames);
    parent.add(rail);
    const step = REWARD_FRAME.size + REWARD_FRAME.gap;
    const startX = LOWER.left + 10 + REWARD_FRAME.size / 2;
    const frames = view.city.rewards.map((entry, index) => addFramedIcon(this.scene, rail, startX + index * step, 0, REWARD_FRAME.size, CURRENCY_ICON_BY_WALLET[entry.currency], {
      amount: formatCurrency(entry.amount),
    }));
    this.attachRewardRail(parent, rail, view.city.rewards, frames);
  }

  /**
   * 돌아오는 것 줄의 유일한 입력면 — **끌면 흐르고 누르면 그 재화의 안내가 열린다.**
   *
   * 액자마다 입력면을 두지 않는 이유는, 줄이 판보다 길 때 그 위를 덮는 드래그 면이 액자의
   * 손짓을 통째로 삼키기 때문이다. 한 면이 둘을 함께 맡으면 어디까지 끌었는지와 어느 액자를
   * 눌렀는지가 같은 자리에서 갈린다.
   *
   * 판보다 길면 그 줄만 가로로 흐른다. 세로로 접거나 판을 키우지 않는다 — 판이 커지면 위 칸의
   * 파견대와 아래 조작이 함께 밀리고, 두 줄이 되면 "무엇이 오는가"가 한눈에 들어오지 않는다.
   */
  private attachRewardRail(
    parent: Phaser.GameObjects.Container,
    rail: Phaser.GameObjects.Container,
    rewards: readonly { readonly currency: WalletItemKey }[],
    frames: readonly Phaser.GameObjects.Container[],
  ): void {
    const viewLeft = LOWER.left + 10;
    const viewWidth = LOWER.right - LOWER.left - 20;
    const contentWidth = rewards.length * REWARD_FRAME.size + Math.max(0, rewards.length - 1) * REWARD_FRAME.gap;
    const overflow = Math.max(0, contentWidth - viewWidth);
    let originX = 0;
    let downX = 0;
    let moved = 0;
    let dragging = false;
    const hit = this.scene.add.rectangle(viewLeft + viewWidth / 2, rail.y, viewWidth, REWARD_FRAME.size + 16, 0xffffff, 0).setInteractive({ useHandCursor: true });
    /** 포인터 밑에 있는 액자. 줄이 흘러 간 만큼을 빼고 판 안쪽 좌표로 되돌려 찾는다. */
    const frameAt = (pointer: Phaser.Input.Pointer): number => {
      const matrix = parent.getWorldTransformMatrix();
      const local = (pointer.x - matrix.tx) / (matrix.scaleX || 1) - rail.x;
      return frames.findIndex((frame) => Math.abs(local - frame.x) <= REWARD_FRAME.size / 2);
    };
    hit.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      dragging = true; downX = pointer.x; originX = rail.x; moved = 0;
      frames[frameAt(pointer)]?.setScale(1.1);
    });
    const release = (): void => { dragging = false; for (const frame of frames) frame.setScale(1); };
    hit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      const index = moved <= REWARD_TAP_SLOP ? frameAt(pointer) : -1;
      release();
      const entry = rewards[index];
      // **액자를 누르면 그 재화의 안내가 열린다.** 무엇이 돌아오는지 보고 "그게 어디에 쓰이더라"를
      // 묻는 손이 상단 재화 줄까지 되돌아가지 않게 한다 — 재화 그림이 선 자리는 어디서나 같은
      // 창으로 이어져야 한다.
      if (entry) new CurrencyGuidePopup(this.scene, this.popups).open(entry.currency);
    });
    hit.on("pointerout", release);
    hit.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!dragging || !pointer.isDown) return;
      moved = Math.max(moved, Math.abs(pointer.x - downX));
      if (moved > REWARD_TAP_SLOP) for (const frame of frames) frame.setScale(1);
      if (overflow > 0) rail.setX(Phaser.Math.Clamp(originX + (pointer.x - downX), -overflow, 0));
    });
    parent.add(hit);
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
    this.teardownBriefArt();
    this.rosterHint = undefined;
    parent.removeAll(true);

    const away = relicsAwayOnInteraction(session.interaction.slots.filter((slot): slot is InteractionDispatchSnapshot => slot !== null));
    const roster = RELICS.filter((relic) => session.owned.has(relic.id) && !away.has(relic.id));
    this.rosterCards.clear();

    this.rosterHint = this.scene.add.text(LOWER.left + 10, LOWER.top - 42, this.rosterHintText(), textStyle({ role: "emphasis", size: 23, color: COLOR.accentText })).setOrigin(0, 0.5);
    parent.add(this.rosterHint);
    // 조작 설명 대신 그 조작을 대신해 주는 단추를 둔다. 교류에는 발굴의 생산 특화 같은 개체별
    // 기준이 없어 고를 축이 전투력뿐이라, 발굴처럼 기준을 돌려 고르는 화살표는 두지 않는다.
    parent.add(new Button(this.scene, LOWER.right - 90, LOWER.top - 42, {
      width: 170, height: 52, fontSize: 22, label: t("interaction.autoPlace"), accentColor: BLUE,
      onClick: () => {
        this.party = toFormationSlots(autoAssignInteractionParty(
          roster.map((relic) => ({ id: relic.id, power: combatPower(relicProgression.getFinalStats(relic.id)) })),
          view.city.partySize.max,
        ), 3);
        this.selectedSlot = undefined;
        this.render();
      },
    }));

    if (roster.length === 0) {
      parent.add(this.scene.add.text(0, (LOWER.top + LOWER.bottom) / 2, t("interaction.noRelics"), textStyle({ role: "body", size: 26, color: COLOR.inkDim })).setOrigin(0.5));
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
        label: relic.name, level: progress.level, rarity: relic.rarity, breakthroughGrade: relicProgression.getBreakthroughGrade(relic.id),
        affinity: { element: relic.element, role: relic.role },
        // 이미 자리에 나가 있는 카드는 떠오르지 않고 눌려 들어간다.
        selectedStyle: "pressed",
      });
      card.setSelected(this.party.includes(relic.id));
      this.rosterCards.set(relic.id, card);
      bindLongPress(this.scene, card.hit, {
        onTap: () => {
          // 이미 어느 칸에 선 렐릭이면 옮기지 않고 그 칸을 고른다.
          const result = tapRosterRelic(this.party, this.selectedSlot, relic.id);
          this.party = result.formation;
          this.selectedSlot = result.selectedSlot;
          this.renderSlots(view);
          this.renderActions(view);
          // 카드를 누른 뒤 고른 칸이 옆으로 옮겨 가므로 그 줄도 함께 따라간다 — 목록을 통째로
          // 다시 만들면 방금 누른 카드가 눈앞에서 사라졌다 돌아온다.
          this.rosterHint?.setText(this.rosterHintText());
          for (const [relicId, card] of this.rosterCards) card.setSelected(this.party.includes(relicId));
        },
        allowTap: () => this.gridDragMoved <= GRID_DRAG_SLOP,
        onLongPress: () => this.info().showRelic(relic),
        depth: SD_DEPTH + 2,
      });
      grid.add(card);
    });

    this.attachGridScroll(parent, grid, roster.length);
  }

  /** 지금 어느 자리에 세우는 중인지. 아무 칸도 고르지 않았으면 목록 이름만 남는다. */
  private rosterHintText(): string {
    return this.selectedSlot === undefined ? t("interaction.ownedRelics") : t("interaction.ownedRelicsForSlot", { slot: this.selectedSlot + 1 });
  }

  /** 아래 칸이 무엇을 보여 주든 주요 조작은 같은 높이에 선다. */
  private renderActions(view: InteractionLayerView): void {
    const parent = this.actions;
    if (!parent) return;
    parent.removeAll(true);
    if (view.state === "away") return;
    if (view.state === "done") {
      parent.add(new Button(this.scene, 0, ACTION.y, {
        width: ACTION.width, height: ACTION.height, label: this.busy ? t("interaction.claiming") : t("interaction.claim"), variant: "primary",
        accentColor: COLOR.missionClaim, onClick: () => void this.claim(view.dispatch),
      }));
      return;
    }

    const picked = formationMembers(this.party);
    // 배치 중에만 취소가 그 왼쪽에 나타난다 — 발굴과 같은 자리, 같은 폭이다.
    if (this.editing) {
      const cancel = new Button(this.scene, ACTION.cancelX, ACTION.y, {
        width: ACTION.cancelWidth, height: ACTION.cancelHeight, label: t("interaction.cancel"), onClick: () => { if (!this.busy) { this.editing = false; this.render(); } },
      });
      cancel.setEnabled(!this.busy);
      parent.add(cancel);
    }
    const send = new Button(this.scene, this.editing ? ACTION.primaryX : 0, ACTION.y, {
      width: this.editing ? ACTION.editingWidth : ACTION.width, height: this.editing ? ACTION.editingHeight : ACTION.height,
      label: this.busy ? t("interaction.sending") : t("interaction.send"),
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
      // 자리를 옮길 때는 뛰던 것을 멈추고 바닥에서 다시 시작한다 — 뛰던 중의 y를 기준으로
      // 다시 걸면 그 SD만 조금씩 위로 떠오른 채 굳는다.
      this.stopHop(relicId);
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
      adopt: (puppet) => {
        puppet.disableInteractive(); layer.add(puppet); this.puppets.set(relicId, puppet);
        // **세워 두는 동안에는 뛰지 않는다.** 자리를 고르는 내내 통통 튀면 그 움직임이 "지금
        // 무슨 일이 일어났다"를 말하지 못하고, 어느 칸을 고르는 중인지도 흐려진다. 뛰는 것은
        // 보내는 순간의 배웅 한 번뿐이다(`hopFarewell`).
      },
    }).finally(() => this.puppetLoading.delete(relicId));
  }

  /** 편성에서 빠진 렐릭의 SD와 그 도약만 폐기한다. */
  private releaseUnusedPuppets(): void {
    for (const [relicId, puppet] of this.puppets) {
      if (this.party.includes(relicId)) continue;
      this.stopHop(relicId);
      this.sdLayer?.remove(puppet, false);
      puppet.destroy();
      this.puppets.delete(relicId);
    }
  }

  private stopHop(relicId: string): void {
    this.hops.get(relicId)?.stop();
    this.hops.delete(relicId);
  }

  /** 아래 칸이 바뀔 때마다 안내 원화의 마스크와 PRE_RENDER 갱신을 함께 뗀다. */
  private teardownBriefArt(): void {
    this.briefArt?.destroy();
    this.briefArt = undefined;
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
    const onUp = (_pointer: Phaser.Input.Pointer, objects: Phaser.GameObjects.GameObject[]): void => {
      dragging = false;
      // 칸·카드 밖에서 뗀 손은 고른 자리를 푼다. 표시가 계속 떠 있으면 다 고른 뒤에도 할 일이
      // 남은 것처럼 보인다.
      if (objects.length > 0 || this.selectedSlot === undefined) return;
      this.selectedSlot = undefined;
      this.render();
    };
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
    this.teardownBriefArt();
    this.backdrop?.destroy(); this.backdrop = undefined;
    this.clock?.remove(false); this.clock = undefined;
    this.remainingLabel = undefined;
    for (const tween of this.hops.values()) tween.stop();
    this.hops.clear();
    for (const puppet of this.puppets.values()) puppet.destroy();
    this.puppets.clear();
    this.puppetLoading.clear();
    this.sdLayer = undefined; this.chromeLayer = undefined;
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
      // 보내는 순간에만 한 번 뛴다 — 서버가 답하는 동안 배웅이 지나가므로 기다림이 늘지 않는다.
      const farewell = this.hopFarewell();
      await Promise.all([this.manager.start(view.city.id, party), farewell]);
      this.popups.closeAll();
      this.onChanged?.();
    } finally { this.busy = false; }
  }

  /** 서 있는 SD가 한 번씩 폴짝 뛴다. 칸마다 박자가 달라 셋이 한 몸으로 흔들리지 않는다. */
  private async hopFarewell(): Promise<void> {
    const jumps = [...this.puppets].map(([relicId, puppet]) => new Promise<void>((resolve) => {
      this.stopHop(relicId);
      const tween = startPuppetHop(this.scene, puppet, Math.max(0, this.party.indexOf(relicId)), { once: true });
      tween.once(Phaser.Tweens.Events.TWEEN_COMPLETE, () => { this.stopHop(relicId); resolve(); });
      this.hops.set(relicId, tween);
    }));
    await Promise.all(jumps);
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
        title: t("interaction.rewardTitle"),
        items: currencyRecordToRewardItems({ [response.granted.currency]: response.granted.amount }),
      });
    } finally { this.busy = false; }
  }
}
