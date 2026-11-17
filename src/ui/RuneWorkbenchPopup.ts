import Phaser from "phaser";
import { t } from "../i18n";
import { changedRuneParts, clearRuneDraftSlot, recommendIntoDraft, runeCandidatePowerDelta, runeCompareLines, runeDraftMovedFrom, RUNE_DRAFT_PARTS, tapRuneDraft } from "../core/runeDraft";
import { runeHolders, runeLoadoutPower, type RuneLoadoutRelic, type RuneLoadoutSlots } from "../core/runeLoadout";
import { formatRuneOptionValue, runeOptionValue, runeRarityLabel, type RuneInstance, type RunePart } from "../core/runes";
import { getRelic } from "../data/relics";
import { logError } from "../managers/ErrorReporter";
import { relicProgression } from "../managers/RelicProgressionManager";
import { session } from "../state/session";
import { Button } from "./Button";
import { addClippedHit } from "./clippedHit";
import type { ClipRect } from "./clipRect";
import { showContentToast } from "./ContentToast";
import { attachDragScroll } from "./dragScroll";
import { chipPoints, drawLayer, drawShapeOutline } from "./holo";
import { bindLongPress } from "./longPressInfo";
import { POPUP_TITLE_SIZE, type PopupLayer } from "./PopupLayer";
import { shapeClipMask } from "./popupArt";
import { pressIn, pressOut } from "./pressFeedback";
import { addRuneCard, addRuneFrame, RUNE_ACCENT, runeAccentCss } from "./runeIcons";
import { createRuneListState, RuneListControls, visibleRuneList } from "./RuneListControls";
import { openRuneInfoPopup, runeStatLabel } from "./RunePopup";
import { RUNE_WORKBENCH, runeWorkbenchCell, runeWorkbenchColumnWidth, runeWorkbenchColumnX, runeWorkbenchMinScroll, runeWorkbenchRows } from "./runeWorkbenchLayout";
import { addScrollHint } from "./ScrollHint";
import { isTap } from "./tapGuard";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/** 오르는 수·내리는 수의 색. 비교 판과 카드의 전투력 차가 같은 두 색을 쓴다. */
const UP_TEXT = COLOR.hpText;
const DOWN_TEXT = COLOR.dangerText;
/** 바뀐 칸의 「변경」 꼬리표 — 강조색(금)은 장착·고른 칸이 이미 쓰므로 푸른 계열로 가른다. */
const CHANGED_TONE = COLOR.shieldFill;
/** 닫기를 막고 확인 창을 띄운 직후 같은 닫기가 다시 오면 통과시킨다 — `closeAll`이 확인 창과 번갈아 끝없이 돌지 않게. */
const CLOSE_GUARD_MS = 400;

export interface RuneWorkbenchOptions {
  readonly relicId: string;
  /** 처음 고른 칸. */
  readonly part: RunePart;
  /** 장착이 바뀌었다(적용·쪽지에서의 판매 등) — 정보창이 성장 칸을 다시 칠한다. */
  readonly onChanged: () => void;
}

/**
 * 룬 정비 — 정보창의 세 칸을 한 판에서 골라 보고, 비교하고, 한 번에 적용한다.
 *
 * 위의 세 칸 중 하나를 고르면 아래 목록이 그 조각의 룬만 세운다. 카드를 **누르면 그 칸의 임시 후보**가 되어
 * 비교 판에 지금 → 후보의 옵션 차(▲▼)와 전투력 차가 선다. 같은 카드를 다시 누르면 되돌린다. **꾹 누르면** 룬
 * 쪽지(세공·잠금·판매)가 열린다. 자동·추천 장착도 임시 구성만 채우고, 저장은 「적용」이 `setRuneLoadout` 한
 * 번으로 한다(`core/runeDraft.ts`). 적용하지 않고 닫으면 공용 확인 창이 한 번 묻는다.
 */
export function openRuneWorkbench(scene: Phaser.Scene, popups: PopupLayer, options: RuneWorkbenchOptions): void {
  const def = getRelic(options.relicId);
  const W = RUNE_WORKBENCH;
  const rows = runeWorkbenchRows();
  const height = rows.height;
  const top = -height / 2;
  const column = runeWorkbenchColumnWidth();
  const relic = (): RuneLoadoutRelic => ({ relicId: def.id, base: def.stats, rarity: def.rarity, progress: relicProgression.getProgress(def.id) });
  const slotsOf = (): RuneLoadoutSlots => [...relicProgression.getProgress(def.id).heartGemSlots] as unknown as RuneLoadoutSlots;
  const runeById = (id: string | null): RuneInstance | undefined => (id === null ? undefined : session.runeInventory.find(({ instanceId }) => instanceId === id));

  let base = slotsOf();
  let draft = base;
  let part: RunePart = options.part;
  let busy = false;
  let forceClose = false;
  let askedAt = -Infinity;

  const changedCount = (): number => changedRuneParts(base, draft).length;
  const movedFrom = (): (string | null)[] => runeDraftMovedFrom(draft, runeHolders(session.relicProgress), def.id);

  /** 저장이 밖에서 바뀌었다(쪽지에서 판매 등) — 지금 저장을 새 기준으로 삼고, 아직 있는 후보만 남긴다. */
  const resync = (): void => {
    const fresh = slotsOf();
    draft = RUNE_DRAFT_PARTS.map((p) => (draft[p] !== base[p] && runeById(draft[p]) ? draft[p] : fresh[p])) as unknown as RuneLoadoutSlots;
    base = fresh;
  };

  const apply = (after?: () => void): void => {
    if (busy || changedCount() === 0) { after?.(); return; }
    busy = true;
    const before = runeLoadoutPower(relic(), base, session.runeInventory);
    const target = draft;
    const moving = movedFrom().some((id) => id !== null);
    void relicProgression.setRuneLoadout(def.id, target, undefined, { moveFromOther: moving }).then(() => {
      base = slotsOf();
      draft = base;
      options.onChanged();
      const powerAfter = runeLoadoutPower(relic(), base, session.runeInventory);
      showContentToast(scene, t("info.rune.loadout.done", { before: before.toLocaleString(), after: powerAfter.toLocaleString() }), "info");
      repaint?.(false);
      after?.();
    }, (error: unknown) => {
      logError("info.runeWorkbench", "룬 정비 적용 실패", error);
      showContentToast(scene, t("info.rune.loadout.failed"), "refused");
    }).finally(() => { busy = false; repaint?.(false); });
  };

  let repaint: ((resetScroll: boolean) => void) | undefined;
  // 확인 창에서 「버리고 나가기」·적용이 끝난 뒤 이 판을 닫는 손잡이.
  let closeSelf: (() => void) | undefined;

  popups.open({
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
        confirmLabel: t("info.rune.workbench.applyAndLeave"), cancelLabel: t("info.rune.workbench.discard"),
        onCancel: () => { forceClose = true; closeSelf?.(); },
      }, () => apply(() => { forceClose = true; closeSelf?.(); }));
      return false;
    },
  }, (body, close) => {
    closeSelf = close;

    // ── 전투력(제목표 오른쪽) ─────────────────────────────────────────────
    const right = W.width / 2 - W.padX;
    const powerLabel = scene.add.text(right, top + W.power.y - W.power.value / 2 - W.power.gap, t("info.rune.workbench.power"), textStyle({ role: "body", size: W.power.label, color: COLOR.inkDim })).setOrigin(1, 1);
    const powerValue = scene.add.text(right, top + W.power.y, "", textStyle({ role: "display", size: W.power.value, color: COLOR.ink })).setOrigin(1, 0.5).setStroke("#05070a", 5);
    body.add([powerLabel, powerValue]);

    // ── 세 칸 ────────────────────────────────────────────────────────────
    const slotLayer = scene.add.container(0, 0);
    body.add(slotLayer);
    // ── 비교 판 ──────────────────────────────────────────────────────────
    const compareLayer = scene.add.container(0, 0);
    body.add(compareLayer);

    // ── 칸 조작 ──────────────────────────────────────────────────────────
    const actionY = top + rows.actionsY;
    const actionCommon = { width: column, height: W.actions.height, fontSize: W.actions.fontSize };
    const infoButton = new Button(scene, runeWorkbenchColumnX(0), actionY, { ...actionCommon, label: t("info.rune.workbench.info"), onClick: () => {
      const id = draft[part];
      if (id) openRuneInfoPopup(scene, popups, { runeInstanceId: id, onChanged: () => { resync(); options.onChanged(); repaint?.(false); }, traitResearch: true });
    } });
    const clearButton = new Button(scene, runeWorkbenchColumnX(1), actionY, { ...actionCommon, label: t("info.rune.workbench.unequip"), onClick: () => {
      draft = clearRuneDraftSlot(draft, part);
      repaint?.(false);
    } });
    const clearAllButton = new Button(scene, runeWorkbenchColumnX(2), actionY, { ...actionCommon, label: t("info.rune.loadout.clear"), onClick: () => {
      draft = [null, null, null];
      repaint?.(false);
    } });
    body.add([infoButton, clearButton, clearAllButton]);

    // ── 아래 조작 ────────────────────────────────────────────────────────
    const footerY = top + rows.footerY;
    const footerCommon = { width: column, height: W.footer.height, fontSize: W.footer.fontSize };
    const recommendInto = (mode: "auto" | "recommend"): void => {
      const plan = recommendIntoDraft(relic(), draft, session.runeInventory, runeHolders(session.relicProgress), mode);
      if (!plan.changed) { showContentToast(scene, t("info.rune.loadout.none"), "refused"); return; }
      draft = plan.slots;
      showContentToast(scene, t("info.rune.workbench.drafted"), "info");
      repaint?.(false);
    };
    const autoButton = new Button(scene, runeWorkbenchColumnX(0), footerY, { ...footerCommon, label: t("info.rune.loadout.auto"), onClick: () => recommendInto("auto") });
    const recommendButton = new Button(scene, runeWorkbenchColumnX(1), footerY, { ...footerCommon, label: t("info.rune.loadout.recommend"), onClick: () => recommendInto("recommend") });
    const applyButton = new Button(scene, runeWorkbenchColumnX(2), footerY, { ...footerCommon, label: t("info.rune.workbench.applyNone"), variant: "primary", onClick: () => apply() });
    body.add([autoButton, recommendButton, applyButton]);

    // ── 목록 ─────────────────────────────────────────────────────────────
    const g = W.grid;
    const state = createRuneListState();
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
    const paintList = (resetScroll: boolean): void => {
      content.removeAll(true);
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
        // 이 칸에 지금 저장된 룬은 「장착」 꼬리표를 단다.
        if (base[part] === rune.instanceId) cell.add(addTag(scene, g.card / 2 - 8, g.card / 2 - 18, t("info.rune.workbench.equipped"), COLOR.accent, "#05070a", g.tag, 1));
        if (!picked) {
          const delta = runeCandidatePowerDelta(current, draft, part, rune.instanceId, session.runeInventory);
          if (delta !== 0) {
            cell.add(scene.add.text(0, g.card / 2 - 14, (delta > 0 ? "+" : "") + delta.toLocaleString(), textStyle({ role: "emphasis", size: g.delta, color: delta > 0 ? UP_TEXT : DOWN_TEXT }))
              .setOrigin(0.5).setStroke("#05070a", 5));
          }
        }
        const hit = addClippedHit(scene, cell, 0, 0, g.card, g.card, clip);
        hit.on("pointerdown", () => { dragged = false; pressIn(cell); });
        hit.on("pointerout", () => { if (!popups.isOpen || popups.isTop(body)) pressOut(cell, "normal", { pop: false }); });
        hit.on("pointerup", (pointer: Phaser.Input.Pointer) => { dragged = !isTap(pointer); if (dragged) pressOut(cell, "normal", { pop: false }); });
        bindLongPress(scene, hit, {
          onTap: () => {
            pressOut(cell);
            draft = tapRuneDraft(base, draft, part, rune.instanceId);
            repaint?.(false);
          },
          allowTap: () => !dragged,
          onLongPress: () => {
            pressOut(cell, "normal", { pop: false });
            openRuneInfoPopup(scene, popups, { runeInstanceId: rune.instanceId, onChanged: () => { resync(); options.onChanged(); repaint?.(false); }, traitResearch: true });
          },
          enabled: () => popups.isTop(body),
          depth: popups.baseDepth + 400,
        });
        content.add(cell);
      });
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
      squeezeTextToWidth(powerValue, W.width / 2 - W.padX - 120);
    };

    const paintSlots = (): void => {
      slotLayer.removeAll(true);
      const changed = new Set(changedRuneParts(base, draft));
      const S = W.slots;
      RUNE_DRAFT_PARTS.forEach((p) => {
        const selected = p === part;
        const rune = runeById(draft[p]);
        const x = runeWorkbenchColumnX(p);
        const y = top + rows.slotsY - (selected ? S.raise : 0);
        const slot = scene.add.container(x, y);
        const shape = chipPoints(column, S.height, { bevel: { topLeft: S.height * 0.2, topRight: 0, bottomRight: S.height * 0.2, bottomLeft: 0 } });
        slot.add(drawLayer(scene, 0, 0, shape, {
          fill: selected ? 0x1d2430 : 0x0d1219, alpha: selected ? 0.98 : 0.82,
          edge: selected ? COLOR.accent : rune ? RUNE_ACCENT[rune.rarity] : COLOR.inkDimHex,
          edgeAlpha: selected ? 1 : 0.35, edgeWidth: selected ? 4 : 2,
        }));
        const frameX = -column / 2 + 14 + S.frame / 2;
        slot.add(addRuneFrame(scene, frameX, 0, S.frame, rune?.rarity, p, { mainStats: rune?.mainStats, engraved: (rune?.engravings.length ?? 0) > 0 }).setAlpha(rune ? 1 : 0.55));
        const textX = frameX + S.frame / 2 + 12;
        const room = column / 2 - 12 - textX;
        slot.add(scene.add.text(column / 2 - 12, -S.height / 2 + 10, String(p + 1), textStyle({ role: "display", size: S.part, color: selected ? COLOR.accentText : COLOR.inkDim })).setOrigin(1, 0));
        const name = scene.add.text(textX, -18, rune ? (rune.customName ?? t("info.rune.named", { rarity: runeRarityLabel(rune.rarity) })) : t("info.rune.empty"), textStyle({ role: "display", size: S.name, color: rune ? runeAccentCss(rune.rarity) : COLOR.inkDim }))
          .setOrigin(0, 0.5).setStroke("#05070a", 4);
        squeezeTextToWidth(name, room - 20);
        const stat = scene.add.text(textX, 16, rune ? rune.mainStats.map(({ key }) => runeStatLabel(key) + " " + formatRuneOptionValue(key, runeOptionValue(rune, key))).join(" · ") : t("info.rune.workbench.pickBelow"), textStyle({ role: "emphasis", size: S.stat, color: rune ? COLOR.ink : COLOR.accentText }))
          .setOrigin(0, 0.5);
        squeezeTextToWidth(stat, room);
        slot.add([name, stat]);
        if (changed.has(p)) slot.add(addTag(scene, -column / 2 + 10, S.height / 2 - 18, t("info.rune.workbench.changed"), CHANGED_TONE, "#05070a", S.tag, 0));
        // 칸 카드는 목록 마스크 밖이라 자를 것이 없다 — 입력면만 같은 관문(`addClippedHit`)을 지나 판 전체를 창으로 준다.
        const hit = addClippedHit(scene, slot, 0, 0, column, S.height, () => ({ left: -Infinity, right: Infinity, top: -Infinity, bottom: Infinity }));
        hit.on("pointerdown", () => pressIn(slot));
        hit.on("pointerout", () => pressOut(slot, "normal", { pop: false }));
        hit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
          pressOut(slot);
          if (!isTap(pointer) || p === part) return;
          part = p;
          repaint?.(true);
        });
        slotLayer.add(slot);
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
      const leftX = -plateWidth / 2 + C.pad;
      const midX = -plateWidth / 2 + plateWidth * 0.43;
      const rightX = midX + 44;
      const rightEdge = plateWidth / 2 - C.pad;
      const labelY = cTop + C.pad;
      const nameY = labelY + C.label + 8;
      const linesTop = nameY + C.name + 10;
      const linesRoom = cTop + C.height - C.pad - linesTop;
      const nameOf = (rune: RuneInstance | undefined): string => (rune ? (rune.customName ?? t("info.rune.named", { rarity: runeRarityLabel(rune.rarity) })) : t("info.rune.empty"));
      const addName = (x: number, rune: RuneInstance | undefined, room: number): void => {
        const text = scene.add.text(x, nameY, nameOf(rune), textStyle({ role: "display", size: C.name, color: rune ? runeAccentCss(rune.rarity) : COLOR.inkDim })).setOrigin(0, 0).setStroke("#05070a", 4);
        squeezeTextToWidth(text, room);
        compareLayer.add(text);
      };

      // 왼쪽 — 지금 이 칸에 저장된 룬.
      compareLayer.add(scene.add.text(leftX, labelY, t("info.rune.workbench.current"), textStyle({ role: "body", size: C.label, color: COLOR.inkDim })).setOrigin(0, 0));
      addName(leftX, before, midX - leftX - 16);
      const own = before ? [...before.mainStats.map(({ key }) => ({ key, main: true })), ...before.subStats.map(({ key }) => ({ key, main: false }))] : [];
      const ownStep = own.length > 0 ? Math.min(C.lineHeight, linesRoom / own.length) : C.lineHeight;
      own.forEach(({ key, main }, i) => {
        const text = scene.add.text(leftX, linesTop + i * ownStep, runeStatLabel(key) + " " + formatRuneOptionValue(key, runeOptionValue(before!, key)), main ? textStyle({ role: "emphasis", size: Math.min(C.line, ownStep * 0.82), color: COLOR.ink }) : textStyle({ role: "body", size: Math.min(C.line, ownStep * 0.82), color: COLOR.inkDim })).setOrigin(0, 0);
        squeezeTextToWidth(text, midX - leftX - 16);
        compareLayer.add(text);
      });
      if (!before) compareLayer.add(scene.add.text(leftX, linesTop, "—", textStyle({ role: "body", size: C.line, color: COLOR.inkDim })).setOrigin(0, 0));

      // 가운데 화살표 · 오른쪽 — 후보.
      compareLayer.add(scene.add.text(midX + 14, cTop + C.height / 2, "▶", textStyle({ role: "display", size: C.arrow, color: COLOR.accentText })).setOrigin(0.5));
      compareLayer.add(scene.add.text(rightX, labelY, t("info.rune.workbench.picked"), textStyle({ role: "body", size: C.label, color: COLOR.inkDim })).setOrigin(0, 0));
      if (draft[part] === base[part]) {
        const hint = scene.add.text(rightX, nameY + 6, t("info.rune.workbench.pickHint"), textStyle({ role: "body", size: C.line, color: COLOR.accentText, wrap: rightEdge - rightX })).setOrigin(0, 0);
        compareLayer.add(hint);
        return;
      }
      addName(rightX, after, rightEdge - rightX);
      let y = linesTop;
      const mover = movedFrom()[part];
      if (mover) {
        const moved = scene.add.text(rightX, y, t("info.rune.workbench.movedFrom", { name: getRelic(mover).name }), textStyle({ role: "emphasis", size: C.moved, color: COLOR.shieldText })).setOrigin(0, 0);
        squeezeTextToWidth(moved, rightEdge - rightX);
        compareLayer.add(moved);
        y += C.moved + 8;
      }
      const lines = runeCompareLines(before, after);
      const step = lines.length > 0 ? Math.min(C.lineHeight, (cTop + C.height - C.pad - y) / lines.length) : C.lineHeight;
      const size = Math.min(C.line, step * 0.82);
      lines.forEach(({ key, main, after: value, delta }, i) => {
        const ly = y + i * step;
        const has = after !== undefined && (after.mainStats.some((o) => o.key === key) || after.subStats.some((o) => o.key === key));
        const label = scene.add.text(rightX, ly, runeStatLabel(key) + " " + (has ? formatRuneOptionValue(key, value) : "—"), main ? textStyle({ role: "emphasis", size, color: COLOR.ink }) : textStyle({ role: "body", size, color: COLOR.inkDim })).setOrigin(0, 0);
        squeezeTextToWidth(label, rightEdge - rightX - 110);
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
      infoButton.setEnabled(draft[part] !== null);
      clearButton.setEnabled(draft[part] !== null);
      clearAllButton.setEnabled(draft.some((id) => id !== null));
      applyButton.setLabel(count > 0 ? t("info.rune.workbench.apply", { count: String(count) }) : t("info.rune.workbench.applyNone")).setEnabled(count > 0 && !busy);
      autoButton.setEnabled(!busy);
      recommendButton.setEnabled(!busy);
    };
    repaint(true);
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
