import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { addCategoryTab } from "./CategoryTab";
import { slideTabPage } from "./screenTransition";
import { changedRuneParts, clearRuneDraftSlot, leaveRuneDraftSlot, rebaseRuneDraftAfterApply, recommendIntoDraft, runeCandidatePowerDelta, runeCompareLines, runeDraftMovedFrom, RUNE_DRAFT_PARTS, tapRuneDraft } from "../core/runeDraft";
import { runeHolders, runeLoadoutPower, type RuneLoadoutRelic, type RuneLoadoutSlots } from "../core/runeLoadout";
import { formatRuneOptionValue, runeOptionValue, runeRarityLabel, type RuneInstance, type RunePart } from "../core/runes";
import { getRelic } from "../data/relics";
import { logError } from "../managers/ErrorReporter";
import { relicProgression } from "../managers/RelicProgressionManager";
import { session } from "../state/session";
import { Button } from "./Button";
import { FaceFrame } from "./FaceFrame";
import { addClippedHit } from "./clippedHit";
import type { ClipRect } from "./clipRect";
import { showContentToast } from "./ContentToast";
import { addSectionTitle } from "./SectionTitle";
import { BACK_BUTTON_SIZE, BACK_SLOT } from "./popupGeometry";
import { attachDragScroll } from "./dragScroll";
import { chipPoints, drawLayer, drawShapeOutline } from "./holo";
import { bindLongPress } from "./longPressInfo";
import { POPUP_TITLE_SIZE, type PopupLayer } from "./PopupLayer";
import { shapeClipMask } from "./popupArt";
import { pressIn, pressOut } from "./pressFeedback";
import { addRuneCard, addRuneFrame, RUNE_ACCENT, RUNE_CENTER_Y, runeAccentCss, runeHeartSpot, runeSeatTexture, runeTexture } from "./runeIcons";
import { playRunePick, playRuneSeatEffect, playRuneSeatPlate } from "./runeSeatEffect";
import { RUNE_SEAT_FX, runeSeatChange, type RuneSeatChange } from "./runeSeatEffectStyle";
import { createRuneListState, RuneListControls, visibleRuneList } from "./RuneListControls";
import { openRuneInfoPopup, runeStatLabel } from "./RunePopup";
import { RUNE_WORKBENCH, runeWorkbenchCell, runeWorkbenchFooterWidth, runeWorkbenchFooterX, runeWorkbenchMinScroll, runeWorkbenchRows, runeWorkbenchSideSpan, RUNE_WORKBENCH_BACK_CLEARANCE } from "./runeWorkbenchLayout";
import { addScrollHint } from "./ScrollHint";
import { isTap } from "./tapGuard";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";
import { followTutorialTarget } from "./tutorialTarget";

/** 오르는 수·내리는 수의 색. 비교 판과 카드의 전투력 차가 같은 두 색을 쓴다. */
const UP_TEXT = COLOR.hpText;
const DOWN_TEXT = COLOR.dangerText;
/** 바뀐 칸의 「변경」 꼬리표 — 강조색(금)은 장착·고른 칸이 이미 쓰므로 푸른 계열로 가른다. */
const CHANGED_TONE = COLOR.shieldFill;
/** 닫기를 막고 확인 창을 띄운 직후 같은 닫기가 다시 오면 통과시킨다 — `closeAll`이 확인 창과 번갈아 끝없이 돌지 않게. */
const CLOSE_GUARD_MS = 400;
/** 목록 마스크 밖의 입력면이 받는 창 — 자를 것이 없다. */
const OPEN_CLIP = (): ClipRect => ({ left: -Infinity, right: Infinity, top: -Infinity, bottom: Infinity });

export interface RuneWorkbenchOptions {
  readonly relicId: string;
  /** 처음 고른 칸. */
  readonly part: RunePart;
  /** 장착이 바뀌었다(적용·쪽지에서의 판매 등) — 정보창이 성장 칸을 다시 칠한다. */
  readonly onChanged: () => void;
  /**
   * 무료 각인 체험 뒤의 장착 안내 — 목록의 룬 카드 → 「적용」을 차례로 가리키고(건너뛸 수 없다), 이 칸에 룬이 실제로
   * 끼워지면 `onDone`을 부른다. 어느 룬이든 끼우면 끝이다.
   */
  readonly tutorial?: { readonly onDone: () => void };
}

/**
 * 룬 정비 — 정보창의 세 칸을 한 판에서 골라 보고, 비교하고, 한 번에 적용한다.
 *
 * 위의 세 칸 중 하나를 고르면 아래 목록이 그 조각의 룬만 세운다. 카드를 **누르면 그 칸의 임시 후보**가 되어
 * **교체 비교 판에만** 올라간다 — 지금 → 후보의 옵션 차(▲▼)와 전투력 차가 서고, 하트와 옆 글 판은 「적용」 전까지
 * 지금 낀 룬 그대로다(누르기만 해도 바꿔 낀 것처럼 보였다 — 응태 2026-11-23). 바뀔 칸에는 「변경」 꼬리표만 붙는다.
 * 같은 카드를 다시 누르면 되돌린다. **꾹 누르면** 룬 쪽지(세공·잠금·판매)가 열린다. 추천은 「남은 룬 끼기」·
 * 「옮겨 끼기」 두 버튼으로 갈리고, 누르면 그 추천 룬을 먼저 보여 준 뒤 교체 비교에 올린다. 저장은 「적용」이
 * `setRuneLoadout` 한 번으로 한다(`core/runeDraft.ts`). 적용하지 않고 닫으면 공용 확인 창이 한 번 묻는다.
 */
export function openRuneWorkbench(scene: Phaser.Scene, popups: PopupLayer, options: RuneWorkbenchOptions): void {
  const def = getRelic(options.relicId);
  const W = RUNE_WORKBENCH;
  const rows = runeWorkbenchRows();
  const height = rows.height;
  const top = -height / 2;
  const relic = (): RuneLoadoutRelic => ({ relicId: def.id, base: def.stats, rarity: def.rarity, progress: relicProgression.getProgress(def.id) });
  const slotsOf = (): RuneLoadoutSlots => [...relicProgression.getProgress(def.id).heartGemSlots] as unknown as RuneLoadoutSlots;
  const runeById = (id: string | null): RuneInstance | undefined => (id === null ? undefined : session.runeInventory.find(({ instanceId }) => instanceId === id));

  let base = slotsOf();
  let draft = base;
  let part: RunePart = options.part;
  /** 추천·모두 해제처럼 여러 칸을 한꺼번에 올린 칸 — 칸을 옮겨도 후보가 남는다(`leaveRuneDraftSlot`). */
  let kept = new Set<RunePart>();
  let busy = false;
  /** 저장 중인 구성 — 도는 동안 칸 이동·되누르기는 이것을 「저장된 룬」으로 본다(보낸 후보가 떠나는 칸에서 되돌려지지 않게). */
  let inflight: RuneLoadoutSlots | undefined;
  const settled = (): RuneLoadoutSlots => inflight ?? base;
  let forceClose = false;
  /** 다음 한 번의 칠하기가 돌릴 연출 — 적용이 끝난 칸의 끼움·교체·빼기, 방금 고른 후보의 톡. 칠하며 비운다. */
  let pendingSeat: { readonly before: RuneLoadoutSlots; readonly changes: ReadonlyMap<RunePart, RuneSeatChange> } | undefined;
  let pendingPick = false;
  let askedAt = -Infinity;

  /** 룬 쪽지 — 목록 카드 꾹 누르기 · 비교 판 그림 누르기 · 하트 조각 꾹 누르기가 같은 쪽지를 연다. */
  const openInfo = (id: string): void => {
    openRuneInfoPopup(scene, popups, { runeInstanceId: id, onChanged: () => { resync(); options.onChanged(); repaint?.(false); }, traitResearch: true });
  };
  const changedCount = (): number => changedRuneParts(base, draft).length;
  const movedFrom = (): (string | null)[] => runeDraftMovedFrom(draft, runeHolders(session.relicProgress), def.id);

  /** 저장이 밖에서 바뀌었다(쪽지에서 판매 등) — 지금 저장을 새 기준으로 삼고, 아직 있는 후보만 남긴다. */
  const resync = (): void => {
    const fresh = slotsOf();
    draft = RUNE_DRAFT_PARTS.map((p) => (draft[p] !== base[p] && runeById(draft[p]) ? draft[p] : fresh[p])) as unknown as RuneLoadoutSlots;
    base = fresh;
    kept = new Set([...kept].filter((p) => draft[p] !== base[p]));
  };

  const apply = (after?: () => void): void => {
    if (busy || changedCount() === 0) { after?.(); return; }
    busy = true;
    const before = runeLoadoutPower(relic(), base, session.runeInventory);
    const target = draft;
    const moving = movedFrom().some((id) => id !== null);
    const savedBefore = base;
    inflight = target;
    void relicProgression.setRuneLoadout(def.id, target, undefined, { moveFromOther: moving }).then(() => {
      base = slotsOf();
      // 저장이 끝난 순간 바뀐 칸에만 끼움·교체·빼기 연출이 돈다 — 하트는 저장된 룬만 그리므로 이때가 「끼운」 순간이다.
      const changes = new Map<RunePart, RuneSeatChange>();
      RUNE_DRAFT_PARTS.forEach((p) => { const kind = runeSeatChange(savedBefore[p], base[p]); if (kind) changes.set(p, kind); });
      if (changes.size > 0) pendingSeat = { before: savedBefore, changes };
      // 저장이 도는 사이 다른 칸에 올린 후보는 남긴다 — 통째로 덮으면 그 후보가 저장이 끝나는 순간 빠진다.
      draft = rebaseRuneDraftAfterApply(target, base, draft, (id) => runeById(id) !== undefined);
      kept = new Set([...kept].filter((p) => draft[p] !== base[p]));
      options.onChanged();
      const powerAfter = runeLoadoutPower(relic(), base, session.runeInventory);
      showContentToast(scene, t("info.rune.loadout.done", { before: before.toLocaleString(), after: powerAfter.toLocaleString() }), "info");
      // 다시 칠하기는 `finally` 한 번뿐이다 — 여기서도 칠하면 끼움 연출이 돌던 조각을 곧바로 새 조각이 덮는다.
      after?.();
    }, (error: unknown) => {
      logError("info.runeWorkbench", "룬 정비 적용 실패", error);
      showContentToast(scene, t("info.rune.loadout.failed"), "refused");
    }).finally(() => { busy = false; inflight = undefined; repaint?.(false); });
  };

  let repaint: ((resetScroll: boolean) => void) | undefined;
  // 확인 창에서 「적용하지 않기」·적용이 끝난 뒤 이 판을 닫는 손잡이.
  let closeSelf: (() => void) | undefined;

  popups.open({
    // 길게 서는 창이라 화면 가운데가 아니라 판 밖 뒤로가기 바로 위에 밑변을 맞춘다.
    y: BACK_SLOT.y - BACK_BUTTON_SIZE / 2 - RUNE_WORKBENCH_BACK_CLEARANCE - height / 2,
    width: W.width, height, title: t("info.rune.workbench.title"), titleSize: POPUP_TITLE_SIZE.workboard, dim: true, backButton: true,
    canClose: () => {
      if (forceClose || changedCount() === 0) return true;
      const now = performance.now();
      if (now - askedAt < CLOSE_GUARD_MS) return true;
      askedAt = now;
      const moved = [...new Set(movedFrom().filter((id): id is string => id !== null))];
      const message = t("info.rune.workbench.unsaved", { count: String(changedCount()) })
        + (moved.length > 0 ? "\n" + t("info.rune.loadout.moves", { names: moved.map((id) => getRelic(id).name).join(", ") }) : "");
      popups.confirm({
        title: t("info.rune.workbench.unsavedTitle"), message,
        // 「적용하지 않기」는 바꾼 칸을 버리는 되돌릴 수 없는 쪽이라 붉게 선다.
        confirmLabel: t("info.rune.workbench.applyAndLeave"), cancelLabel: t("info.rune.workbench.discard"), cancelDestructive: true,
        onCancel: () => { forceClose = true; closeSelf?.(); },
      }, () => apply(() => { forceClose = true; closeSelf?.(); }));
      return false;
    },
  }, (body, close) => {
    closeSelf = close;

    // ── 전투력(제목표 오른쪽) ─────────────────────────────────────────────
    const right = W.width / 2 - W.padX;
    const powerLabel = scene.add.text(right, top + W.power.y - W.power.value / 2 - W.power.gap, t("info.rune.workbench.power"), textStyle({ role: "body", size: W.power.label, color: COLOR.inkDim })).setOrigin(1, 1);
    const powerValue = scene.add.text(right, top + W.power.y, "", textStyle({ role: "display", size: W.power.value, color: COLOR.ink })).setOrigin(1, 0.5).setStroke("#05070a", 7);
    body.add([powerLabel, powerValue]);

    // ── 세 칸 ────────────────────────────────────────────────────────────
    const slotLayer = scene.add.container(0, 0);
    body.add(slotLayer);
    // ── 비교 판 ──────────────────────────────────────────────────────────
    const compareLayer = scene.add.container(0, 0);
    body.add(compareLayer);

    // ── 칸 조작 ──────────────────────────────────────────────────────────
    const actionY = top + rows.actionsY;
    // 룬 정보 버튼은 두지 않는다 — 비교 판의 룬 그림을 누르거나 하트 조각을 꾹 누르면 쪽지가 열린다.
    const actionCommon = { width: runeWorkbenchFooterWidth(), height: W.actions.height, fontSize: W.actions.fontSize };
    const clearButton = new Button(scene, runeWorkbenchFooterX(0), actionY, { ...actionCommon, label: t("info.rune.workbench.unequip"), onClick: () => {
      draft = clearRuneDraftSlot(draft, part);
      kept.delete(part);
      repaint?.(false);
    } });
    const clearAllButton = new Button(scene, runeWorkbenchFooterX(1), actionY, { ...actionCommon, label: t("info.rune.loadout.clear"), onClick: () => {
      draft = [null, null, null];
      kept = new Set(changedRuneParts(base, draft));
      repaint?.(false);
    } });
    body.add([clearButton, clearAllButton]);

    // ── 아래 조작 ────────────────────────────────────────────────────────
    const footerY = top + rows.footerY;
    const takeDraft = (slots: RuneLoadoutSlots): void => {
      draft = slots;
      showContentToast(scene, t("info.rune.workbench.drafted"), "info");
      repaint?.(false);
    };
    /**
     * 「추천 룬」 — 누르면 곧바로 채우지 않고 추천 창(`openRecommendPreviewPopup`)이 선다. 그 안의 두 탭이
     * 「남은 룬 끼기」(아무도 끼지 않은 룬만)와 「옮겨 끼기」(다른 렐릭이 낀 룬까지)를 가르고, 고른 쪽의 추천 룬이
     * 앞에 선다. 「교체 비교에 올리기」를 눌러야 임시 구성에 얹힌다.
     */
    const openRecommend = (): void => {
      const holders = runeHolders(session.relicProgress);
      const planOf = (mode: RecommendMode): RecommendPlan | undefined => {
        const plan = recommendIntoDraft(relic(), draft, session.runeInventory, holders, mode);
        if (!plan.changed) return undefined;
        return {
          slots: plan.slots,
          takes: RUNE_DRAFT_PARTS.flatMap((p) => {
            const id = plan.slots[p];
            const from = id !== null && plan.slots[p] !== draft[p] ? holders.get(id) : undefined;
            return id !== null && from !== undefined && from !== def.id ? [{ part: p, runeId: id, from }] : [];
          }),
        };
      };
      const plans = { auto: planOf("auto"), recommend: planOf("recommend") };
      if (!plans.auto && !plans.recommend) { showContentToast(scene, t("info.rune.loadout.none"), "refused"); return; }
      openRecommendPreviewPopup(scene, popups, {
        mode: plans.auto ? "auto" : "recommend", plans, relic: relic(), current: draft, saved: base,
        onTake: (slots) => {
          // 바뀐 칸 가운데 첫 칸을 골라 비교 판이 곧바로 그 칸을 말하게 한다.
          const first = RUNE_DRAFT_PARTS.find((p) => slots[p] !== draft[p]);
          if (first !== undefined) part = first;
          // 추천은 여러 칸을 한꺼번에 올린 것이라 칸을 옮겨 가며 확인해도 남는다.
          kept = new Set(changedRuneParts(base, slots));
          takeDraft(slots);
        },
      });
    };
    const footer = { width: runeWorkbenchFooterWidth(), height: W.footer.height, fontSize: W.footer.fontSize };
    const recommendButton = new Button(scene, runeWorkbenchFooterX(0), footerY, { ...footer, label: t("info.rune.workbench.recommend"), onClick: openRecommend });
    // 적용 버튼은 칸 수를 적지 않는다 — 바뀌는 칸은 하트 판의 「변경」 꼬리표가 이미 말한다.
    const applyButton = new Button(scene, runeWorkbenchFooterX(1), footerY, { ...footer, label: t("info.rune.workbench.applyNone"), variant: "primary", onClick: () => apply() });
    body.add([recommendButton, applyButton]);

    // ── 목록 ─────────────────────────────────────────────────────────────
    const g = W.grid;
    const state = createRuneListState(undefined, "workbench");
    const frame = scene.add.container(0, top + rows.listTop);
    body.add(frame);
    const half = (g.columns * g.cell) / 2;
    const viewHeight = rows.viewHeight;
    const drag = scene.add.rectangle(0, viewHeight / 2, half * 2, viewHeight, 0xffffff, 0).setVisible(false);
    frame.add(drag);
    const content = scene.add.container(0, 0);
    frame.add(content);
    content.setMask(shapeClipMask(scene, frame, [-half, 0, half, 0, half, viewHeight, -half, viewHeight]));
    let scroll = 0;
    let minScroll = 0;
    let dragged = false;
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
    /** 장착 안내가 가리킬 카드 — 지금 칸에 저장된 룬이 아닌 첫 카드. 목록을 다시 그릴 때마다 다시 고른다. */
    let tutorialCard: Phaser.GameObjects.Container | undefined;
    let shownCount = 0;
    const paintList = (resetScroll: boolean): void => {
      content.removeAll(true);
      tutorialCard = undefined;
      const allowed = new Set(session.runeInventory.filter((rune) => rune.part === part).map((rune) => rune.instanceId));
      const shown = visibleRuneList(state, allowed);
      controls?.setCount(shown.length, allowed.size);
      const holders = runeHolders(session.relicProgress);
      const showHolder = session.settings.game.runeBag.showHolder;
      const current = relic();
      shown.forEach((rune, order) => {
        const { x, y } = runeWorkbenchCell(order);
        const holder = holders.get(rune.instanceId);
        const other = holder !== undefined && holder !== def.id;
        const picked = draft[part] === rune.instanceId;
        const cell = scene.add.container(x, y);
        // 지금 칸의 후보는 강조색 테로 두른다 — 고른 카드가 목록 어디에 있는지 한눈에 읽힌다.
        if (picked) cell.add(drawShapeOutline(scene, 0, 0, chipPoints(g.card + 10, g.card + 10, { bevel: { topLeft: (g.card + 10) * 0.19, topRight: 0, bottomRight: (g.card + 10) * 0.19, bottomLeft: 0 } }), { color: COLOR.accent, alpha: 1, width: 4 }));
        const card = addRuneCard(scene, 0, 0, g.card, g.card, rune, {
          dimmed: other && !picked,
          holder: other && showHolder ? { relicId: holder } : undefined,
        });
        cell.add(card);
        // 이 칸에 지금 저장된 룬은 오른쪽 위에 「장착」 꼬리표를 단다 — 오른쪽 아래의 전투력 차와 겹치지 않는다.
        if (base[part] === rune.instanceId) cell.add(addTag(scene, g.card / 2 - 6, -g.card / 2 + g.tag / 2 + 10, t("info.rune.workbench.equipped"), COLOR.accent, "#05070a", g.tag, 1));
        if (!picked) {
          const delta = runeCandidatePowerDelta(current, draft, part, rune.instanceId, session.runeInventory);
          if (delta !== 0) {
            // 액자 수량과 같은 자리(우하단)에 검은 획으로 겹친다 — 가운데에 두면 조각 그림을 가렸다(응태 2026-11-18).
            cell.add(scene.add.text(g.card / 2 - 8, g.card / 2 - 6, (delta > 0 ? "+" : "") + delta.toLocaleString(), textStyle({ role: "emphasis", size: g.delta, color: delta > 0 ? UP_TEXT : DOWN_TEXT }))
              .setOrigin(1, 1).setStroke("#05070a", 5));
          }
        }
        const hit = addClippedHit(scene, cell, 0, 0, g.card, g.card, clip);
        hit.on("pointerdown", () => { dragged = false; pressIn(cell); });
        hit.on("pointerout", () => { if (!popups.isOpen || popups.isTop(body)) pressOut(cell, "normal", { pop: false }); });
        hit.on("pointerup", (pointer: Phaser.Input.Pointer) => { dragged = !isTap(pointer); if (dragged) pressOut(cell, "normal", { pop: false }); });
        bindLongPress(scene, hit, {
          onTap: () => {
            pressOut(cell);
            draft = tapRuneDraft(settled(), draft, part, rune.instanceId);
            kept.delete(part);
            // 후보로 올렸을 때만 톡 — 되돌릴 때는 비교 판이 비워질 뿐이다.
            pendingPick = draft[part] === rune.instanceId && draft[part] !== settled()[part];
            repaint?.(false);
          },
          allowTap: () => !dragged,
          onLongPress: () => {
            pressOut(cell, "normal", { pop: false });
            openInfo(rune.instanceId);
          },
          enabled: () => popups.isTop(body),
          depth: popups.baseDepth + 400,
        });
        content.add(cell);
        if (tutorialCard === undefined && base[part] !== rune.instanceId) tutorialCard = cell;
      });
      shownCount = shown.length;
      minScroll = runeWorkbenchMinScroll(shown.length, viewHeight);
      applyScroll(resetScroll ? 0 : scroll);
    };
    controls = new RuneListControls({
      scene, parent: body, popups,
      left: -W.width / 2 + W.padX, right: W.width / 2 - W.padX, y: top + rows.controlsY,
      state, parts: false, onChange: () => paintList(true), isActive: () => popups.isTop(body),
    });

    const paintPower = (): void => {
      const before = runeLoadoutPower(relic(), base, session.runeInventory);
      const after = runeLoadoutPower(relic(), draft, session.runeInventory);
      const diff = after - before;
      powerValue.setText(diff === 0 ? before.toLocaleString() : `${before.toLocaleString()} → ${after.toLocaleString()}  ${diff > 0 ? "▲" : "▼"}${Math.abs(diff).toLocaleString()}`)
        .setColor(diff === 0 ? COLOR.ink : diff > 0 ? UP_TEXT : DOWN_TEXT);
      squeezeTextToWidth(powerValue, W.power.room);
    };

    const paintSlots = (): void => {
      slotLayer.removeAll(true);
      const seat = pendingSeat;
      pendingSeat = undefined;
      const changed = new Set(changedRuneParts(base, draft));
      const H = W.heart;
      const cy = top + rows.heartY;
      const plateWidth = W.width - W.padX * 2 + 24;
      // 하트 판 — 아래 비교 판과 떨어진 한 장이라, 「어느 칸을 고르나」와 「무엇이 바뀌나」가 두 덩어리로 읽힌다.
      slotLayer.add(drawLayer(scene, 0, top + H.top + H.height / 2, chipPoints(plateWidth, H.height, { bevel: { topLeft: 34, topRight: 0, bottomRight: 34, bottomLeft: 0 } }), { fill: 0x0a0e14, alpha: 0.72, edge: COLOR.accent, edgeAlpha: 0.35 }));
      const selectPart = (p: RunePart): void => {
        if (p === part) return;
        // 적용하지 않고 칸을 옮기면 떠나는 칸에 손으로 올린 후보는 빠진다 — 한 칸씩 보며 고른 것만 적용한다.
        draft = leaveRuneDraftSlot(settled(), draft, part, kept);
        part = p;
        repaint?.(true);
      };

      // 조각 셋 — 고른 조각만 강조색 테를 두르고 바깥으로 튀어나오며, 나머지는 한 톤 가라앉는다.
      // 하트와 글 판은 **저장된** 룬을 그린다 — 후보는 교체 비교 판에만 서고 「적용」해야 여기로 들어온다.
      RUNE_DRAFT_PARTS.forEach((p) => {
        const selected = p === part;
        const rune = runeById(base[p]);
        const spot = runeHeartSpot(H.size, p);
        const reach = Math.hypot(spot.x, spot.y) || 1;
        const push = selected ? H.pop : rune ? 0 : H.pop * 0.4;
        const x = (spot.x / reach) * push;
        const y = cy + (spot.y / reach) * push;
        const texture = rune ? runeSeatTexture(rune.rarity, p) : runeTexture(undefined, p);
        const scale = rune ? 1 : 0.955;
        // 이 칸의 조각을 이루는 그림 — 끼움 연출이 한 덩어리로 바깥에서 끌어온다.
        const pieces: Phaser.GameObjects.Image[] = [];
        const keep = <T extends Phaser.GameObjects.Image>(image: T): T => { pieces.push(image); return image; };
        // 고른 조각은 강조색 테, 빈 조각은 옅은 테 — 검은 구멍이 아니라 「끼울 자리」로 읽힌다.
        if (selected || !rune) {
          slotLayer.add(keep(scene.add.image(x, y, texture).setOrigin(0.5, RUNE_CENTER_Y).setDisplaySize(H.size * scale * 1.08, H.size * scale * 1.08).setTintFill(COLOR.accent).setAlpha(selected ? 0.95 : 0.4)));
        }
        if (rune) {
          slotLayer.add(keep(scene.add.image(x, y, texture).setOrigin(0.5, RUNE_CENTER_Y).setDisplaySize(H.size * 1.18, H.size * 1.18).setTint(RUNE_ACCENT[rune.rarity]).setBlendMode(Phaser.BlendModes.ADD).setAlpha(selected ? 0.45 : 0.22)));
        }
        slotLayer.add(keep(scene.add.image(x, y, texture).setOrigin(0.5, RUNE_CENTER_Y).setDisplaySize(H.size * scale, H.size * scale).setAlpha(selected ? 1 : rune ? 0.78 : 0.6)));
        if (!rune) {
          slotLayer.add(scene.add.image(x, y, texture).setOrigin(0.5, RUNE_CENTER_Y).setDisplaySize(H.size * scale, H.size * scale).setTintFill(COLOR.accent).setAlpha(selected ? 0.28 : 0.14));
        }
        // 조각 위 칸 번호 — 옆 글 판의 번호와 같은 수라 어느 글이 어느 조각인지 잇는다.
        // 조각의 무게중심은 `runeHeartSpot`보다 안쪽이라(손이 닿을 넓은 자리) 번호는 그 반쯤에 앉힌다.
        slotLayer.add(scene.add.text(x + spot.x * 0.6, y + spot.y * 0.6, String(p + 1), textStyle({ role: "display", size: H.number, color: selected ? COLOR.accentText : COLOR.ink }))
          .setOrigin(0.5).setStroke("#05070a", 7).setAlpha(selected ? 1 : 0.8));
        const change = seat?.changes.get(p);
        if (change) {
          const old = runeById(seat!.before[p]);
          playRuneSeatEffect(scene, {
            kind: change, layer: slotLayer, x, y, outward: { x: spot.x / reach, y: spot.y / reach },
            size: H.size, originY: RUNE_CENTER_Y,
            oldTexture: old ? runeSeatTexture(old.rarity, p) : undefined,
            // 빼기면 빈 자리 테는 그대로 두고 옛 조각만 튕겨 나간다.
            pieces: rune ? pieces : undefined,
            newTexture: rune ? texture : undefined,
            color: rune ? RUNE_ACCENT[rune.rarity] : COLOR.accent,
          });
        }
        const pieceHit = addClippedHit(scene, slotLayer, x + spot.x * 0.6, y + spot.y * 0.6, H.size * 0.32, H.size * 0.32, OPEN_CLIP);
        bindLongPress(scene, pieceHit, {
          onTap: () => selectPart(p),
          onLongPress: () => { if (rune) openInfo(rune.instanceId); },
          enabled: () => popups.isTop(body), depth: popups.baseDepth + 400,
        });
      });

      // 글 판 셋 — 1번 왼쪽 · 2번 오른쪽 · 3번 아래.
      RUNE_DRAFT_PARTS.forEach((p) => {
        const selected = p === part;
        const rune = runeById(base[p]);
        const bottom = p === 2;
        const span = bottom ? { left: -H.bottom.width / 2, right: H.bottom.width / 2 } : runeWorkbenchSideSpan(p === 0 ? "left" : "right");
        const width = span.right - span.left;
        const height = bottom ? H.bottom.height : H.side.height;
        const block = scene.add.container((span.left + span.right) / 2, cy + (bottom ? H.bottom.y : H.side.y));
        block.add(drawLayer(scene, 0, 0, chipPoints(width, height, { bevel: { topLeft: height * 0.2, topRight: 0, bottomRight: height * 0.2, bottomLeft: 0 } }), {
          fill: selected ? 0x1d2430 : 0x0d1219, alpha: selected ? 0.96 : 0.7,
          edge: selected ? COLOR.accent : rune ? RUNE_ACCENT[rune.rarity] : COLOR.inkDimHex,
          edgeAlpha: selected ? 1 : 0.35, edgeWidth: selected ? 4 : 2,
        }));
        const name = rune ? (rune.customName ?? t("info.rune.named", { rarity: runeRarityLabel(rune.rarity) })) : t("info.rune.empty");
        const stats = rune ? rune.mainStats.map(({ key }) => runeStatLabel(key) + " " + formatRuneOptionValue(key, runeOptionValue(rune, key))) : [t("info.rune.workbench.pickBelow")];
        // 글은 하트 쪽으로 붙는다 — 왼쪽 판은 오른쪽 정렬, 오른쪽 판은 왼쪽 정렬, 아래 판은 가운데.
        const align = bottom ? 0.5 : p === 0 ? 1 : 0;
        const textX = bottom ? 0 : p === 0 ? width / 2 - 18 : -width / 2 + 18;
        const room = width - 36 - (bottom ? 60 : 0);
        const numberX = p === 0 ? -width / 2 + 16 : width / 2 - 16;
        block.add(scene.add.text(bottom ? -width / 2 + 22 : numberX, bottom ? 0 : -height / 2 + 12, String(p + 1), textStyle({ role: "display", size: H.number * 0.6, color: selected ? COLOR.accentText : COLOR.inkDim }))
          .setOrigin(bottom ? 0.5 : p === 0 ? 0 : 1, bottom ? 0.5 : 0));
        if (bottom) {
          const nameText = scene.add.text(textX, -15, name, textStyle({ role: "display", size: H.bottom.name, color: rune ? runeAccentCss(rune.rarity) : COLOR.inkDim })).setOrigin(0.5).setStroke("#05070a", 4);
          squeezeTextToWidth(nameText, room);
          const statText = scene.add.text(textX, 17, stats.join(" · "), textStyle({ role: "emphasis", size: H.bottom.stat, color: rune ? COLOR.ink : COLOR.accentText })).setOrigin(0.5);
          squeezeTextToWidth(statText, room);
          block.add([nameText, statText]);
        } else {
          const firstY = -height / 2 + 26 + (stats.length === 1 ? H.side.line / 2 : 0);
          const nameText = scene.add.text(textX, firstY + 18, name, textStyle({ role: "display", size: H.side.name, color: rune ? runeAccentCss(rune.rarity) : COLOR.inkDim })).setOrigin(align, 0.5).setStroke("#05070a", 4);
          squeezeTextToWidth(nameText, room - 30);
          block.add(nameText);
          stats.forEach((line, i) => {
            const statText = scene.add.text(textX, firstY + 18 + H.side.line * (i + 1) + 2, line, textStyle({ role: "emphasis", size: H.side.stat, color: rune ? COLOR.ink : COLOR.accentText })).setOrigin(align, 0.5);
            squeezeTextToWidth(statText, room);
            block.add(statText);
          });
        }
        if (changed.has(p)) {
          block.add(bottom
            ? addTag(scene, width / 2 - 10, 0, t("info.rune.workbench.changed"), CHANGED_TONE, "#05070a", H.tag, 1)
            : addTag(scene, p === 0 ? -width / 2 + 10 : width / 2 - 10, height / 2 - 18, t("info.rune.workbench.changed"), CHANGED_TONE, "#05070a", H.tag, p === 0 ? 0 : 1));
        }
        // 판은 목록 마스크 밖이라 자를 것이 없다 — 입력면만 같은 관문(`addClippedHit`)을 지나 판 전체를 창으로 준다.
        const hit = addClippedHit(scene, block, 0, 0, width, height, OPEN_CLIP);
        hit.on("pointerdown", () => pressIn(block));
        hit.on("pointerout", () => pressOut(block, "normal", { pop: false }));
        hit.on("pointerup", () => pressOut(block));
        // 짧게 누르면 그 칸을 고르고, 꾹 누르면 지금 그 칸에 든 룬의 쪽지가 열린다.
        bindLongPress(scene, hit, {
          onTap: () => selectPart(p),
          onLongPress: () => { pressOut(block, "normal", { pop: false }); if (rune) openInfo(rune.instanceId); },
          enabled: () => popups.isTop(body), depth: popups.baseDepth + 400,
        });
        slotLayer.add(block);
        const plateChange = seat?.changes.get(p);
        if (plateChange) playRuneSeatPlate(scene, block, plateChange === "swap" ? RUNE_SEAT_FX.insert.swapDelay : 0);
      });
    };

    const paintCompare = (): void => {
      compareLayer.removeAll(true);
      const C = W.compare;
      const cTop = top + rows.compareTop;
      const plateWidth = W.width - W.padX * 2;
      compareLayer.add(drawLayer(scene, 0, cTop + C.height / 2, chipPoints(plateWidth, C.height, { bevel: { topLeft: C.height * 0.14, topRight: 0, bottomRight: C.height * 0.14, bottomLeft: 0 } }), { fill: 0x0a0e14, alpha: 0.9 }));
      const before = runeById(base[part]);
      const after = runeById(draft[part]);
      // 제목표가 판 윗변에 걸터앉아 위 하트 판과 다른 덩어리임을 말한다.
      compareLayer.add(addSectionTitle(scene, -plateWidth / 2 - 6, cTop, t("info.rune.workbench.compareTitle"), { size: C.title }));
      const leftX = -plateWidth / 2 + C.pad;
      const midX = -plateWidth / 2 + plateWidth * 0.45;
      const rightX = midX + 44;
      const rightEdge = plateWidth / 2 - C.pad;
      const labelY = cTop + C.pad + 12;
      const iconY = labelY + C.label + 8 + C.icon / 2;
      const nameY = iconY - C.icon / 2;
      const linesTop = nameY + C.name + 10;
      const linesRoom = cTop + C.height - C.pad - linesTop;
      let lastHeadIcon: Phaser.GameObjects.Container | undefined;
      const nameOf = (rune: RuneInstance | undefined): string => (rune ? (rune.customName ?? t("info.rune.named", { rarity: runeRarityLabel(rune.rarity) })) : t("info.rune.empty"));
      // 룬 그림 + 이름. 그림은 가방 카드와 같은 액자라 아래 목록에서 고른 카드와 같은 얼굴로 읽힌다. 돌려주는 값은 글이 서는 x.
      const addHead = (x: number, rune: RuneInstance | undefined, room: number): number => {
        const icon = addRuneFrame(scene, x + C.icon / 2, iconY, C.icon, rune?.rarity, part, { mainStats: rune?.mainStats, engraved: (rune?.engravings.length ?? 0) > 0 }).setAlpha(rune ? 1 : 0.5);
        compareLayer.add(icon);
        lastHeadIcon = icon;
        // 그림을 누르면 그 룬의 쪽지 — 「룬 정보」 버튼을 따로 두지 않는다.
        if (rune) {
          const iconHit = addClippedHit(scene, icon, 0, 0, C.icon, C.icon, OPEN_CLIP);
          iconHit.on("pointerdown", () => pressIn(icon));
          iconHit.on("pointerout", () => pressOut(icon, "normal", { pop: false }));
          iconHit.on("pointerup", (pointer: Phaser.Input.Pointer) => { pressOut(icon); if (isTap(pointer) && popups.isTop(body)) openInfo(rune.instanceId); });
        }
        const textX = x + C.icon + 14;
        const text = scene.add.text(textX, nameY, nameOf(rune), textStyle({ role: "display", size: C.name, color: rune ? runeAccentCss(rune.rarity) : COLOR.inkDim })).setOrigin(0, 0).setStroke("#05070a", 4);
        squeezeTextToWidth(text, room - C.icon - 14);
        compareLayer.add(text);
        return textX;
      };

      // 왼쪽 — 지금 이 칸에 저장된 룬.
      compareLayer.add(scene.add.text(leftX, labelY, t("info.rune.workbench.current"), textStyle({ role: "body", size: C.label, color: COLOR.inkDim })).setOrigin(0, 0));
      const ownX = addHead(leftX, before, midX - leftX - 16);
      const own = before ? [...before.mainStats.map(({ key }) => ({ key, main: true })), ...before.subStats.map(({ key }) => ({ key, main: false }))] : [];
      const ownStep = own.length > 0 ? Math.min(C.lineHeight, linesRoom / own.length) : C.lineHeight;
      own.forEach(({ key, main }, i) => {
        const text = scene.add.text(ownX, linesTop + i * ownStep, runeStatLabel(key) + " " + formatRuneOptionValue(key, runeOptionValue(before!, key)), main ? textStyle({ role: "emphasis", size: Math.min(C.line, ownStep * 0.82), color: COLOR.ink }) : textStyle({ role: "body", size: Math.min(C.line, ownStep * 0.82), color: COLOR.inkDim })).setOrigin(0, 0);
        squeezeTextToWidth(text, midX - ownX - 16);
        compareLayer.add(text);
      });

      // 가운데 화살표 · 오른쪽 — 후보.
      compareLayer.add(scene.add.text(midX + 14, cTop + C.height / 2, "▶", textStyle({ role: "display", size: C.arrow, color: COLOR.accentText })).setOrigin(0.5));
      compareLayer.add(scene.add.text(rightX, labelY, t("info.rune.workbench.picked"), textStyle({ role: "body", size: C.label, color: COLOR.inkDim })).setOrigin(0, 0));
      if (draft[part] === base[part]) {
        const hint = scene.add.text(rightX, nameY + 10, t("info.rune.workbench.pickHint"), textStyle({ role: "body", size: C.line, color: COLOR.accentText, wrap: rightEdge - rightX })).setOrigin(0, 0);
        compareLayer.add(hint);
        return;
      }
      const pickedX = addHead(rightX, after, rightEdge - rightX);
      if (pendingPick && lastHeadIcon) playRunePick(scene, lastHeadIcon);
      pendingPick = false;
      let y = linesTop;
      const mover = movedFrom()[part];
      if (mover) {
        const moved = scene.add.text(pickedX, y, t("info.rune.workbench.movedFrom", { name: getRelic(mover).name }), textStyle({ role: "emphasis", size: C.moved, color: COLOR.shieldText })).setOrigin(0, 0);
        squeezeTextToWidth(moved, rightEdge - pickedX);
        compareLayer.add(moved);
        y += C.moved + 8;
      }
      const lines = runeCompareLines(before, after);
      const step = lines.length > 0 ? Math.min(C.lineHeight, (cTop + C.height - C.pad - y) / lines.length) : C.lineHeight;
      const size = Math.min(C.line, step * 0.82);
      lines.forEach(({ key, main, after: value, delta }, i) => {
        const ly = y + i * step;
        const has = after !== undefined && (after.mainStats.some((o) => o.key === key) || after.subStats.some((o) => o.key === key));
        const label = scene.add.text(pickedX, ly, runeStatLabel(key) + " " + (has ? formatRuneOptionValue(key, value) : "—"), main ? textStyle({ role: "emphasis", size, color: COLOR.ink }) : textStyle({ role: "body", size, color: COLOR.inkDim })).setOrigin(0, 0);
        squeezeTextToWidth(label, rightEdge - pickedX - 110);
        compareLayer.add(label);
        if (delta !== 0) {
          compareLayer.add(scene.add.text(rightEdge, ly, (delta > 0 ? "▲" : "▼") + formatRuneOptionValue(key, Math.abs(delta)).replace(/^\+/, ""), textStyle({ role: "emphasis", size, color: delta > 0 ? UP_TEXT : DOWN_TEXT })).setOrigin(1, 0));
        }
      });
    };

    repaint = (resetScroll: boolean): void => {
      if (!body.active) return;
      paintPower();
      paintSlots();
      paintCompare();
      paintList(resetScroll);
      const count = changedCount();
      clearButton.setEnabled(draft[part] !== null);
      clearAllButton.setEnabled(draft.some((id) => id !== null));
      applyButton.setEnabled(count > 0 && !busy);
      recommendButton.setEnabled(!busy);
    };
    repaint(true);

    const tutorial = options.tutorial;
    if (tutorial) {
      const startSlot = base[part];
      let done = false;
      const finish = (): void => { if (done) return; done = true; tutorial.onDone(); };
      // 끼울 룬이 없으면(이 칸의 룬을 이미 다 끼웠다) 가리킬 것이 없으므로 안내를 마친다 — 막만 남아 갇히지 않게.
      if (shownCount === 0 || tutorialCard === undefined) finish();
      followTutorialTarget(scene, {
        enabled: () => {
          if (done || !body.active) return false;
          if (base[part] !== null && base[part] !== startSlot) { finish(); return false; }
          return true;
        },
        blocked: () => !popups.isTop(body),
        rect: () => {
          if (draft[part] !== base[part]) return applyButton.getBounds();
          if (!tutorialCard?.active) return undefined;
          // getBounds는 잘린 목록 안의 숨은 자식까지 품어 엉뚱하게 커진다 — 칸 자리와 크기로 잰다.
          const m = tutorialCard.getWorldTransformMatrix();
          const size = W.grid.card * m.scaleX;
          return new Phaser.Geom.Rectangle(m.tx - size / 2, m.ty - size / 2, size, size);
        },
        shape: () => (draft[part] !== base[part] ? applyButton.outlineInScene() : undefined),
        text: () => t(draft[part] !== base[part] ? "tutorial.rune.equipApply" : "tutorial.rune.equipPick"),
        side: () => "above",
      });
    }
  });
}

/** 깎인 작은 꼬리표(「변경」·「장착」). `originX` 0이면 왼쪽 끝, 1이면 오른쪽 끝이 `x`다. */
function addTag(scene: Phaser.Scene, x: number, y: number, label: string, fill: number, color: string, size: number, originX: 0 | 1): Phaser.GameObjects.Container {
  const text = scene.add.text(0, 0, label, textStyle({ role: "emphasis", size, color })).setOrigin(0.5);
  const width = text.width + 16;
  const height = size + 10;
  const tag = scene.add.container(originX === 0 ? x + width / 2 : x - width / 2, y);
  tag.add(drawLayer(scene, 0, 0, chipPoints(width, height, { bevel: { topLeft: height * 0.4, topRight: 0, bottomRight: height * 0.4, bottomLeft: 0 } }), { fill, alpha: 0.95, shadow: false }));
  tag.add(text);
  return tag;
}

/** 추천 미리보기 창 자리. */
const PREVIEW_POPUP = {
  width: 920,
  /** 두 갈래 탭 — 제목표 바로 아래. */
  tabs: { y: 74, width: 330, height: 64, gap: 16 },
  /** 탭 아래 안내 줄 가운데. */
  leadY: 140,
  lead: 22,
  /** 첫 줄 판 윗변. */
  rowsTop: 180,
  row: 156,
  rune: 92,
  slot: 20,
  name: 24,
  stat: 20,
  face: 64,
  holder: 18,
  drop: 22,
  arrow: 28,
  /** 마지막 줄 아래 · 전투력 요약 한 줄. */
  summaryGap: 24,
  summary: 40,
  summaryLine: 60,
  button: { gap: 30, height: 84, width: 460, fontSize: 26, bottom: 40 },
  padX: 40,
} as const;

type RecommendMode = "auto" | "recommend";

interface RecommendPlan {
  readonly slots: RuneLoadoutSlots;
  /** 다른 렐릭에게서 새로 빼 오는 룬 — 칸 · 룬 · 지금 끼고 있는 렐릭. */
  readonly takes: readonly { part: RunePart; runeId: string; from: string }[];
}

interface RecommendPreviewOptions {
  /** 처음 여는 탭 — `auto` 남은 룬 끼기 · `recommend` 옮겨 끼기. */
  readonly mode: RecommendMode;
  /** 두 갈래의 추천. 나을 것이 없는 쪽은 비어 있다. */
  readonly plans: Readonly<Record<RecommendMode, RecommendPlan | undefined>>;
  readonly relic: RuneLoadoutRelic;
  /** 지금 교체 비교에 올라 있는 구성 — 추천이 여기서 출발한다. */
  readonly current: RuneLoadoutSlots;
  /** 저장된 구성 — 전투력 차를 잰다. */
  readonly saved: RuneLoadoutSlots;
  /** 「교체 비교에 올리기」 — 아직 아무것도 저장하지 않는다. */
  readonly onTake: (slots: RuneLoadoutSlots) => void;
}

const RECOMMEND_MODES: readonly RecommendMode[] = ["auto", "recommend"];
const RECOMMEND_TAB_LABEL: Record<RecommendMode, TextKey> = { auto: "info.rune.workbench.moveFree", recommend: "info.rune.workbench.moveAccept" };

/**
 * 추천 룬 — 정비 창의 「추천 룬」 하나가 연다. 위의 두 탭이 「남은 룬 끼기」·「옮겨 끼기」를 가르고, 고른 탭의
 * 추천 룬이 그 아래에 선다(곧바로 채우지 않는다).
 *
 * 바뀌는 칸마다 한 줄: 칸 번호 → 지금 룬 ▶ 추천 룬(이름 · 주 옵션)이고, 다른 렐릭에게서 빼 오는 룬이면 그 줄
 * 오른쪽에 그 렐릭의 얼굴과 전투력 감소가 붉게 선다 — 남의 편성을 말없이 허물지 않는다. 아래에 이 렐릭의 전투력
 * 차가 크게 서고, 버튼 하나(「교체 비교에 올리기」)가 비교 판으로 넘긴다. 저장은 정비 창의 「적용」이 한다.
 * 창 높이는 두 탭 가운데 줄이 많은 쪽에 맞춰 탭을 바꿔도 판이 출렁이지 않는다.
 */
function openRecommendPreviewPopup(scene: Phaser.Scene, popups: PopupLayer, options: RecommendPreviewOptions): void {
  const M = PREVIEW_POPUP;
  const partsOf = (mode: RecommendMode): RunePart[] => {
    const plan = options.plans[mode];
    return plan ? RUNE_DRAFT_PARTS.filter((p) => plan.slots[p] !== options.current[p]) : [];
  };
  const rowCount = Math.max(1, ...RECOMMEND_MODES.map((mode) => partsOf(mode).length));
  const summaryTop = M.rowsTop + rowCount * M.row + M.summaryGap;
  const buttonY = summaryTop + M.summaryLine + M.button.gap + M.button.height / 2;
  const height = buttonY + M.button.height / 2 + M.button.bottom;
  const find = (id: string | null): RuneInstance | undefined => (id === null ? undefined : session.runeInventory.find(({ instanceId }) => instanceId === id));
  const holderRelic = (id: string): RuneLoadoutRelic => {
    const holder = getRelic(id);
    return { relicId: id, base: holder.stats, rarity: holder.rarity, progress: relicProgression.getProgress(id) };
  };
  const nameOf = (rune: RuneInstance | undefined): string => (rune ? (rune.customName ?? t("info.rune.named", { rarity: runeRarityLabel(rune.rarity) })) : t("info.rune.empty"));
  let mode = options.mode;

  popups.open({ width: M.width, height, title: t("info.rune.workbench.recommend"), dim: true, backButton: true }, (body, close) => {
    const top = -height / 2;
    const left = -M.width / 2 + M.padX;
    const right = M.width / 2 - M.padX;
    const tabs = scene.add.container(0, top + M.tabs.y);
    const page = scene.add.container(0, 0);
    body.add([tabs, page]);
    const button = new Button(scene, 0, top + buttonY, { width: M.button.width, height: M.button.height, fontSize: M.button.fontSize, label: t("info.rune.workbench.toCompare"), variant: "primary",
      onClick: () => { const plan = options.plans[mode]; if (!plan) return; close(); options.onTake(plan.slots); } });
    body.add(button);

    const paintTabs = (): void => {
      tabs.removeAll(true);
      RECOMMEND_MODES.forEach((id, index) => {
        addCategoryTab(scene, tabs, {
          x: (index - 0.5) * (M.tabs.width + M.tabs.gap), y: 0, width: M.tabs.width, height: M.tabs.height, label: t(RECOMMEND_TAB_LABEL[id]), selected: mode === id, face: "down",
          onSelect: () => {
            if (mode === id) return;
            const from = RECOMMEND_MODES.indexOf(mode);
            mode = id;
            paintTabs();
            paintPage();
            slideTabPage(scene, [page], from, index);
          },
        });
      });
    };

    const paintPage = (): void => {
      page.removeAll(true);
      const plan = options.plans[mode];
      button.setEnabled(plan !== undefined);
      if (!plan) {
        page.add(scene.add.text(0, top + M.rowsTop + M.row / 2, t("info.rune.loadout.none"), textStyle({ role: "body", size: M.lead + 2, color: COLOR.inkDim, align: "center", wrap: M.width - M.padX * 2 })).setOrigin(0.5));
        return;
      }
      const lead = plan.takes.length > 0 ? t("info.rune.workbench.moveLead") : t("info.rune.workbench.freeLead");
      page.add(scene.add.text(0, top + M.leadY, lead, textStyle({ role: "body", size: M.lead, color: COLOR.inkDim, align: "center", wrap: M.width - M.padX * 2 })).setOrigin(0.5));
      // 빼앗기는 쪽의 전투력 감소 — 같은 렐릭에게서 둘 이상 빠지면 그 렐릭의 첫 줄이 합을 말한다.
      const dropOf = new Map<string, number>();
      for (const from of new Set(plan.takes.map(({ from }) => from))) {
        const holder = holderRelic(from);
        const slots = [...holder.progress.heartGemSlots] as unknown as RuneLoadoutSlots;
        const taken = new Set(plan.takes.filter((take) => take.from === from).map(({ runeId }) => runeId));
        const after = slots.map((id) => (id !== null && taken.has(id) ? null : id)) as unknown as RuneLoadoutSlots;
        dropOf.set(from, runeLoadoutPower(holder, after, session.runeInventory) - runeLoadoutPower(holder, slots, session.runeInventory));
      }

      const shown = new Set<string>();
      partsOf(mode).forEach((p, index) => {
        const y = top + M.rowsTop + index * M.row + M.row / 2;
        const was = find(options.current[p]);
        const rune = find(plan.slots[p]);
        const take = plan.takes.find((entry) => entry.part === p);
        page.add(drawLayer(scene, 0, y, chipPoints(right - left, M.row - 14, { bevel: { topLeft: 22, topRight: 0, bottomRight: 22, bottomLeft: 0 } }),
          { fill: 0x0d1219, alpha: 0.82, edge: take ? COLOR.danger : COLOR.accent, edgeAlpha: 0.5, shadow: false }));
        // 칸 번호 · 지금 룬 ▶ 추천 룬.
        page.add(scene.add.text(left + 20, y - M.row / 2 + 20, t("info.rune.workbench.moveSlot", { slot: String(p + 1) }), textStyle({ role: "emphasis", size: M.slot, color: COLOR.inkDim })).setOrigin(0, 0));
        const wasX = left + 24 + M.rune / 2;
        const runeY = y + 12;
        page.add(addRuneFrame(scene, wasX, runeY, M.rune * 0.8, was?.rarity, p, { mainStats: was?.mainStats, engraved: (was?.engravings.length ?? 0) > 0 }).setAlpha(was ? 0.8 : 0.4));
        const arrowX = wasX + M.rune / 2 + 22;
        page.add(scene.add.text(arrowX, runeY, "▶", textStyle({ role: "display", size: M.arrow, color: COLOR.accentText })).setOrigin(0.5));
        const runeX = arrowX + 22 + M.rune / 2;
        page.add(addRuneFrame(scene, runeX, runeY, M.rune, rune?.rarity, p, { mainStats: rune?.mainStats, engraved: (rune?.engravings.length ?? 0) > 0 }));
        // 이름 · 주 옵션.
        const textX = runeX + M.rune / 2 + 18;
        const textRoom = (take ? right - 200 : right - 16) - textX;
        const name = scene.add.text(textX, y - 26, nameOf(rune), textStyle({ role: "display", size: M.name, color: rune ? runeAccentCss(rune.rarity) : COLOR.inkDim })).setOrigin(0, 0.5).setStroke("#05070a", 4);
        squeezeTextToWidth(name, textRoom);
        page.add(name);
        (rune?.mainStats ?? []).forEach(({ key }, i) => {
          const line = scene.add.text(textX, y + 6 + i * (M.stat + 8), runeStatLabel(key) + " " + formatRuneOptionValue(key, runeOptionValue(rune!, key)), textStyle({ role: "emphasis", size: M.stat, color: COLOR.ink })).setOrigin(0, 0.5);
          squeezeTextToWidth(line, textRoom);
          page.add(line);
        });
        // 빼 오는 룬 — 지금 끼고 있는 렐릭의 얼굴 · 이름 · 전투력 감소.
        if (take) {
          const faceX = right - 170 + M.face / 2;
          page.add(new FaceFrame(scene, faceX, y - 12, { portraitAssetId: getRelic(take.from).portraitAssetId, size: M.face, color: COLOR.danger }));
          const holderX = faceX + M.face / 2 + 10;
          const from = scene.add.text(faceX - M.face / 2, y + M.face / 2 + 6, t("info.rune.workbench.movedFrom", { name: getRelic(take.from).name }), textStyle({ role: "emphasis", size: M.holder, color: COLOR.dangerText })).setOrigin(0, 0.5);
          squeezeTextToWidth(from, right - 12 - (faceX - M.face / 2));
          page.add(from);
          const drop = dropOf.get(take.from) ?? 0;
          if (!shown.has(take.from) && drop !== 0) {
            const dropText = scene.add.text(holderX, y - 12, (drop > 0 ? "▲" : "▼") + Math.abs(drop).toLocaleString(), textStyle({ role: "display", size: M.drop, color: drop > 0 ? UP_TEXT : DOWN_TEXT })).setOrigin(0, 0.5).setStroke("#05070a", 4);
            squeezeTextToWidth(dropText, right - 12 - holderX);
            page.add(dropText);
          }
          shown.add(take.from);
        }
      });

      // 이 렐릭이 얻는 몫 — 저장된 구성에서 추천 구성까지.
      const before = runeLoadoutPower(options.relic, options.saved, session.runeInventory);
      const after = runeLoadoutPower(options.relic, plan.slots, session.runeInventory);
      const diff = after - before;
      const sy = top + summaryTop + M.summaryLine / 2;
      const value = scene.add.text(right, sy, `${before.toLocaleString()} → ${after.toLocaleString()}  ${diff === 0 ? "" : (diff > 0 ? "▲" : "▼") + Math.abs(diff).toLocaleString()}`.trimEnd(),
        textStyle({ role: "display", size: M.summary, color: diff > 0 ? UP_TEXT : diff < 0 ? DOWN_TEXT : COLOR.ink })).setOrigin(1, 0.5).setStroke("#05070a", 6);
      squeezeTextToWidth(value, right - left - 160);
      page.add(value);
      page.add(scene.add.text(left, sy, t("info.rune.workbench.power"), textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5));
    };

    paintTabs();
    paintPage();
  });
}
