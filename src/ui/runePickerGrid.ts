import Phaser from "phaser";
import type { RuneInstance } from "../core/runes";
import type { InventorySort } from "../managers/InventoryManager";
import type { RuneViewScreen } from "../core/listViewMemory";
import { session } from "../state/session";
import { attachDragScroll } from "./dragScroll";
import { addScrollHint } from "./ScrollHint";
import { addClippedHit } from "./clippedHit";
import type { ClipRect } from "./clipRect";
import { pressIn, pressOut } from "./pressFeedback";
import { PopupLayer } from "./PopupLayer";
import { shapeClipMask } from "./popupArt";
import { addRuneCard, addRuneCardSelection } from "./runeIcons";
import { createRuneListState, RuneListControls, visibleRuneList } from "./RuneListControls";
import { RUNE_PICK_GRID, runePickerListTop, runePickerMinScroll, runePickerSize } from "./runePickerLayout";
import { equippedRuneSlot } from "./RunePopup";
import { onTap } from "./tapGuard";

/**
 * 룬을 고르는 판의 내용 — 위에 공용 조작 두 줄, 아래에 세로로 흐르는 카드 목록.
 *
 * 특성 연구 · 합성 · 정보창의 장착 가방이 같은 한 장을 쓴다. 조건이 바뀌면 **목록만** 다시 그린다 — 조작 줄까지
 * 다시 세우면 검색 칸의 초점이 끊겨 한 글자마다 자판이 내려간다.
 */
/** 목록을 다시 그리는 손잡이. 고르기만 하는 판은 쓰지 않고, 여럿을 고르는 판(일괄 세공)이 고른 표시를 갈아 끼울 때 쓴다. */
export interface RunePickerGridHandle {
  /** 지금 조건으로 목록을 다시 그린다. 스크롤은 그대로 둔다. */
  repaint(): void;
  /** 지금 조건(토글·필터·검색)을 지난 룬들 — 화면에 선 순서다. */
  shown(): readonly RuneInstance[];
}

export function mountRunePickerGrid(
  scene: Phaser.Scene,
  body: Phaser.GameObjects.Container,
  options: {
    popups: PopupLayer;
    /** 고를 수 있는 룬. 함수면 다시 그릴 때마다 새로 읽는다(고르는 동안 목록이 바뀌는 판). */
    runes: readonly RuneInstance[] | (() => readonly RuneInstance[]);
    onPick: (rune: RuneInstance) => void;
    /** 부위가 하나로 정해진 목록(장착 가방)이면 끈다 — 부위 필터·정렬이 서지 않는다. */
    parts?: boolean;
    /** 팝업이 떠 있는 동안 손을 뗀 카드가 되돌아가지 않게 하는 검사. */
    isCovered?: () => boolean;
    isActive?: () => boolean;
    /** 보이는 줄 수의 상한. 아래에 다른 조작을 세우는 판이 줄인다. */
    maxRows?: number;
    /** 판 크기를 정할 룬 수. 목록이 바뀌는 판은 거르기 전 최대 수를 넘겨 판이 줄었다 늘지 않게 한다. */
    sizeFor?: number;
    /** 판 안에서 목록이 서는 세로 자리(판 가운데 기준 윗변). 주지 않으면 판 높이에서 구한다. */
    top?: number;
    /** 고른 표시 — 참이면 카드에 고른 칸 표식이 선다. */
    isSelected?: (rune: RuneInstance) => boolean;
    /** 처음 정렬. 주지 않으면 가방 기본 정렬이다(특성 일괄 부여는 세공 많은 순으로 연다). */
    initialSort?: InventorySort;
    /** 필터·정렬을 기억할 화면 — 주면 지난번 조건으로 열리고, 바꾸면 남는다(`core/listViewMemory.ts`). */
    memory?: RuneViewScreen;
  },
): RunePickerGridHandle {
  const g = RUNE_PICK_GRID;
  const readRunes = (): readonly RuneInstance[] => typeof options.runes === "function" ? options.runes() : options.runes;
  const { width, height, viewHeight } = runePickerSize(options.sizeFor ?? readRunes().length, options.maxRows);
  const top = options.top ?? -height / 2;
  const firstX = -((g.columns - 1) * g.cellWidth) / 2;
  const state = createRuneListState(options.initialSort, options.memory);

  // 목록 틀 — 마스크와 끌기 영역이 같은 사각형을 쓴다(마스크는 매 프레임 틀의 월드 자리로 따라간다).
  const frame = scene.add.container(0, top + runePickerListTop());
  body.add(frame);
  const half = width / 2 - g.padX / 2;
  const drag = scene.add.rectangle(0, viewHeight / 2, half * 2, viewHeight, 0xffffff, 0).setVisible(false);
  frame.add(drag);
  const content = scene.add.container(0, 0);
  frame.add(content);
  content.setMask(shapeClipMask(scene, frame, [-half, 0, half, 0, half, viewHeight, -half, viewHeight]));

  let scroll = 0;
  let minScroll = 0;
  const clip = (): ClipRect => { const r = drag.getBounds(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
  const applyScroll = (value: number): void => {
    if (!content.active) return;
    scroll = Phaser.Math.Clamp(value, minScroll, 0);
    content.y = scroll;
  };
  attachDragScroll(scene, {
    owner: drag, root: frame, bounds: () => drag.getBounds(),
    onDelta: (dy) => applyScroll(scroll + dy / (frame.getWorldTransformMatrix().scaleY || 1)),
  });

  addScrollHint(scene, frame, { x: 0, y: viewHeight / 2, width: half * 2, height: viewHeight, owner: frame, read: () => ({ offset: scroll, min: minScroll }) });

  let controls: RuneListControls | undefined;
  let lastShown: readonly RuneInstance[] = [];
  const paint = (keepScroll = false): void => {
    content.removeAll(true);
    const view = session.settings.game.runeBag;
    const all = readRunes();
    const allowed = new Set(all.map((rune) => rune.instanceId));
    const shown = visibleRuneList(state, allowed);
    lastShown = shown;
    controls?.setCount(shown.length, all.length);
    shown.forEach((rune, order) => {
      const x = firstX + (order % g.columns) * g.cellWidth;
      const y = g.cellHeight / 2 + Math.floor(order / g.columns) * g.cellHeight;
      const holder = equippedRuneSlot(rune.instanceId);
      const card = addRuneCard(scene, x, y, g.cardWidth, g.cardHeight, rune, {
        holder: holder && view.showHolder ? { relicId: holder.relicId } : undefined,
      });
      if (options.isSelected?.(rune)) addRuneCardSelection(scene, card, g.cardWidth, g.cardHeight);
      // 입력면은 목록 창 안에서만 받는다 — 마스크는 그림만 자르고, 창 밖으로 밀린 카드가 위 조작 줄을 누른 손을 가로챈다.
      const hit = addClippedHit(scene, card, 0, 0, g.cardWidth, g.cardHeight, clip);
      hit.on("pointerdown", () => pressIn(card));
      hit.on("pointerout", () => { if (!options.isCovered?.()) pressOut(card, "normal", { pop: false }); });
      onTap(hit, () => { pressOut(card); options.onPick(rune); }, card);
      content.add(card);
    });
    minScroll = runePickerMinScroll(shown.length, viewHeight);
    // 조건이 바뀌면 처음부터 본다 — 이어 두면 줄어든 목록의 빈 아래쪽에 머문다. 고른 표시만 바꿀 때는 그 자리에 둔다.
    applyScroll(keepScroll ? scroll : 0);
  };
  controls = new RuneListControls({
    scene, parent: body, popups: options.popups,
    left: -width / 2 + g.padX, right: width / 2 - g.padX, y: top + g.controlsY,
    state, parts: options.parts ?? true, onChange: () => paint(), isActive: options.isActive,
  });
  paint();
  return { repaint: () => paint(true), shown: () => lastShown };
}
