import Phaser from "phaser";
import type { RuneInstance } from "../core/runes";
import { session } from "../state/session";
import { attachDragScroll } from "./dragScroll";
import { addScrollHint } from "./ScrollHint";
import { addClippedHit } from "./clippedHit";
import type { ClipRect } from "./clipRect";
import { pressIn, pressOut } from "./pressFeedback";
import { PopupLayer } from "./PopupLayer";
import { shapeClipMask } from "./popupArt";
import { addRuneCard } from "./runeIcons";
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
export function mountRunePickerGrid(
  scene: Phaser.Scene,
  body: Phaser.GameObjects.Container,
  options: {
    popups: PopupLayer;
    runes: readonly RuneInstance[];
    onPick: (rune: RuneInstance) => void;
    /** 부위가 하나로 정해진 목록(장착 가방)이면 끈다 — 부위 필터·정렬이 서지 않는다. */
    parts?: boolean;
    /** 팝업이 떠 있는 동안 손을 뗀 카드가 되돌아가지 않게 하는 검사. */
    isCovered?: () => boolean;
    isActive?: () => boolean;
  },
): void {
  const g = RUNE_PICK_GRID;
  const { width, height, viewHeight } = runePickerSize(options.runes.length);
  const top = -height / 2;
  const firstX = -((g.columns - 1) * g.cellWidth) / 2;
  const state = createRuneListState();
  const allowed = new Set(options.runes.map((rune) => rune.instanceId));

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
  const paint = (): void => {
    content.removeAll(true);
    const view = session.settings.game.runeBag;
    const shown = visibleRuneList(state, allowed);
    controls?.setCount(shown.length, options.runes.length);
    shown.forEach((rune, order) => {
      const x = firstX + (order % g.columns) * g.cellWidth;
      const y = g.cellHeight / 2 + Math.floor(order / g.columns) * g.cellHeight;
      const holder = equippedRuneSlot(rune.instanceId);
      const card = addRuneCard(scene, x, y, g.cardWidth, g.cardHeight, rune, {
        holder: holder && view.showHolder ? { relicId: holder.relicId } : undefined,
      });
      // 입력면은 목록 창 안에서만 받는다 — 마스크는 그림만 자르고, 창 밖으로 밀린 카드가 위 조작 줄을 누른 손을 가로챈다.
      const hit = addClippedHit(scene, card, 0, 0, g.cardWidth, g.cardHeight, clip);
      hit.on("pointerdown", () => pressIn(card));
      hit.on("pointerout", () => { if (!options.isCovered?.()) pressOut(card, "normal", { pop: false }); });
      onTap(hit, () => { pressOut(card); options.onPick(rune); }, card);
      content.add(card);
    });
    minScroll = runePickerMinScroll(shown.length, viewHeight);
    // 조건이 바뀌면 처음부터 본다 — 이어 두면 줄어든 목록의 빈 아래쪽에 머문다.
    applyScroll(0);
  };
  controls = new RuneListControls({
    scene, parent: body, popups: options.popups,
    left: -width / 2 + g.padX, right: width / 2 - g.padX, y: top + g.controlsY,
    state, parts: options.parts ?? true, onChange: paint, isActive: options.isActive,
  });
  paint();
}
