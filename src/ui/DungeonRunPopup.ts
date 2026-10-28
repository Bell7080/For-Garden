import Phaser from "phaser";
import { t } from "../i18n";
import { autoRepeatRunCap, pickAutoDrink, type AutoRepeatDrink, type AutoRepeatOptions } from "../core/autoRepeat";
import { maxSweepCount, settleSweep, sweepRefusal, SWEEP_TICKET_ITEM, type DungeonRunCost } from "../core/dungeonShortcut";
import { formatCurrency } from "../core/formatCurrency";
import { findItem } from "../data/items";
import { sortByRewardPriority } from "../data/rewardPriority";
import { managerEvents } from "../managers/ManagerEvents";
import { session } from "../state/session";
import { Button } from "./Button";
import { CURRENCY_ICON_BY_WALLET, type CurrencyIconKey } from "./currencyIcons";
import { DUNGEON_RUN_POPUP, DUNGEON_RUN_TONE, dungeonRunInnerWidth, dungeonRunPopupHeight, dungeonRunRechargeCells, dungeonRunSliderSpan, runSliderRatio, runSliderValue, type DungeonRunMode } from "./dungeonRunPopupLayout";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawLayer, slantedRect } from "./holo";
import { UI_ICON } from "./icons";
import { addItemDefinitionIcon } from "./itemDefinitionIcon";
import { addFramedIcon } from "./itemFrame";
import type { PopupLayer } from "./PopupLayer";
import { pressIn, pressOut } from "./pressFeedback";
import { addSectionTitle } from "./SectionTitle";
import type { StaminaPopup } from "./StaminaPopup";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/** 멤버십이 없을 때 소탕 창의 소탕권 줄 — 가진 수와 오늘의 광고. */
export interface SweepTickets {
  held: number;
  /** 오늘 더 볼 수 있는 광고 수와 하루 한도. */
  adRemaining: number;
  adLimit: number;
  /** 광고 한 번에 채워지는 장수. */
  adQuantity: number;
}

interface DungeonRunPopupCommon {
  tierName: string;
  level: number;
  /** 창 안의 충전 칸 셋을 그리는 스테미나 창 — 병·젬·광고가 그 창과 같은 길을 지난다. */
  recharge: StaminaPopup;
}

export interface AutoRunPopupOptions extends DungeonRunPopupCommon {
  mode: "auto";
  /** 한 판의 스테미나. 진 판은 쓰지 않지만 막대는 모두 이긴다고 보고 잰다. */
  staminaCost: number;
  /** 한 판을 이겼을 때의 보상 — 예상 획득은 이 값 × 횟수(전승 시)다. */
  reward: { icon: CurrencyIconKey; amount: number };
  /** 가방의 에너지 드링크 — 자동 사용을 켜면 막대 끝이 그만큼 늘어난다. */
  drinks: () => AutoRepeatDrink[];
  onStart: (options: AutoRepeatOptions) => void;
  /** 고른 옵션을 남기는 자리(기기 설정). */
  initial: AutoRepeatOptions;
  save: (options: AutoRepeatOptions) => void;
}

export interface SweepRunPopupOptions extends DungeonRunPopupCommon {
  mode: "sweep";
  /** 한 판의 값. 곱하기는 단축 규칙(`settleSweep`)이 한다. */
  cost: DungeonRunCost;
  /** 이 단계를 이겨 봤는가 — 이긴 단계만 소탕한다. */
  cleared: boolean;
  /** 멤버십이면 소탕권이 들지 않는다. 광고를 보고 돌아오면 값이 바뀌므로 그릴 때마다 묻는다. */
  membership: () => boolean;
  tickets: () => SweepTickets | undefined;
  onWatchAd: () => Promise<void>;
  onConfirm: (count: number) => void;
}

export type DungeonRunPopupOptions = AutoRunPopupOptions | SweepRunPopupOptions;

/** 그 횟수를 돌려면 병이 몇 개 드는가 — 자동 사용이 따는 차례(`pickAutoDrink`) 그대로 센다. */
function drinksNeeded(need: number, stamina: number, drinks: readonly AutoRepeatDrink[]): number {
  let short = need - stamina;
  if (short <= 0) return 0;
  const pool = drinks.map((drink) => ({ ...drink }));
  let used = 0;
  while (short > 0) {
    const next = pickAutoDrink(pool);
    if (!next) break;
    next.quantity -= 1;
    short -= next.amount;
    used += 1;
  }
  return used;
}

/**
 * **던전 횟수 창** — 입구의 「자동 전투」와 「소탕」이 함께 여는 한 장.
 *
 * 횟수는 칩이 아니라 **스테미나가 허락하는 만큼의 막대**로 고른다 — 끝(MAX)이 곧 「지금 몇 번 돌 수
 * 있나」라, 막대를 끝까지 밀면 가진 스테미나를 다 쓰는 횟수가 된다. − / + 와 MIN · MAX로 한 칸씩·끝까지
 * 옮긴다. 모자라면 그 자리에서 채운다 — 스테미나 창과 같은 충전 칸 셋(병 · 젬 · 광고)이 창 가운데에 서고,
 * 채우는 대로 막대 끝이 늘어난다.
 *
 * 두 창은 틀이 같고 **색**(`DUNGEON_RUN_TONE`)과 갈래 줄만 다르다 — 자동 전투는 비취빛에 옵션 두 칩(패배 시
 * 중단 · 드링크 자동 사용), 소탕은 호박빛에 소탕권 줄. 판정은 화면이 새로 짓지 않는다: 자동 전투 막대 끝은
 * `autoRepeatRunCap`, 소탕은 `maxSweepCount`·`sweepRefusal`을 그대로 읽는다. 취소는 판 밖 우하단 공용
 * 뒤로가기가 맡는다.
 */
export function openDungeonRunPopup(scene: Phaser.Scene, popups: PopupLayer, options: DungeonRunPopupOptions): void {
  const L = DUNGEON_RUN_POPUP;
  const tone = DUNGEON_RUN_TONE[options.mode as DungeonRunMode];
  const height = dungeonRunPopupHeight();
  const inner = dungeonRunInnerWidth();
  const auto: AutoRepeatOptions | undefined = options.mode === "auto" ? { ...options.initial } : undefined;
  let count = options.mode === "auto" ? options.initial.runs : 1;
  let adBusy = false;
  const title = options.mode === "auto" ? t("autoRepeat.title") : t("dungeon.sweep");

  popups.open({ width: L.width, height, title, dim: true, dimAlpha: 0.66, closeOnBackdrop: false, hideCloseButton: true, backButton: true }, (body, close) => {
    const top = -height / 2;
    let view: Phaser.GameObjects.Container | undefined;
    let countLayer: Phaser.GameObjects.Container | undefined;

    /** 지금 막대 끝. 한 번도 못 돌면 0이다(막대는 1에 서고 확정이 꺼진다). */
    const capNow = (): number => {
      if (options.mode === "auto") {
        const drinkStamina = options.drinks().reduce((sum, drink) => sum + drink.quantity * drink.amount, 0);
        return autoRepeatRunCap({ stamina: session.wallet.stamina, staminaCost: options.staminaCost, drinkStamina, autoDrink: auto!.autoDrink });
      }
      const membership = options.membership();
      return maxSweepCount({ stamina: session.wallet.stamina, tickets: options.tickets()?.held ?? 0, adFreeMembership: membership, cost: options.cost });
    };

    const setCount = (next: number): void => {
      const cap = Math.max(1, capNow());
      const clamped = Phaser.Math.Clamp(Math.round(next), 1, cap);
      if (clamped === count && countLayer) return;
      count = clamped;
      if (auto && options.mode === "auto") { auto.runs = count; options.save({ ...auto }); }
      paintCount();
    };

    // ── 횟수 판: 큰 수 · MIN/MAX · 막대 — 막대 홈과 손이 닿는 면은 한 번만 세우고 채움·손잡이만 갈아 끼운다.
    const slider = dungeonRunSliderSpan();
    const sliderY = top + L.count.top + L.count.sliderY;
    let trackOrigin: Phaser.GameObjects.Container | undefined;

    const render = (): void => {
      const next = scene.add.container(0, 0);
      body.add(next);
      view?.destroy();
      view = next;
      countLayer = undefined;

      next.add(scene.add.text(0, top + L.tierY, t("dungeon.sweep.tier", { name: options.tierName, level: options.level }), textStyle({ role: "display", size: 34, color: COLOR.ink })).setOrigin(0.5));

      // 횟수 판의 몸.
      const countTop = top + L.count.top;
      next.add(drawLayer(scene, 0, countTop + L.count.height / 2, panelShape(inner, L.count.height), { fill: tone.glass, alpha: 0.94, edge: tone.accent, edgeAlpha: 0.7 }));
      // 막대 홈 — 판과 같은 비스듬한 면.
      next.add(drawLayer(scene, slider.trackLeft + slider.trackWidth / 2, sliderY, slantedRect(slider.trackWidth, L.count.trackHeight, 10), { fill: 0x05080b, alpha: 0.92, edge: tone.accent, edgeAlpha: 0.25 }));
      const origin = scene.add.container(slider.trackLeft, sliderY);
      trackOrigin = origin;
      next.add(origin);
      const hit = scene.add.rectangle(slider.trackLeft + slider.trackWidth / 2, sliderY, slider.trackWidth + 40, L.count.knobHeight + 30, 0xffffff, 0).setInteractive({ useHandCursor: true });
      next.add(hit);
      const fromPointer = (pointer: Phaser.Input.Pointer): void => {
        if (!trackOrigin?.active) return;
        const local = trackOrigin.getWorldTransformMatrix().applyInverse(pointer.worldX, pointer.worldY);
        setCount(runSliderValue(local.x / slider.trackWidth, 1, Math.max(1, capNow())));
      };
      hit.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        fromPointer(pointer);
        const move = (moved: Phaser.Input.Pointer): void => { if (moved.isDown) fromPointer(moved); };
        scene.input.on("pointermove", move);
        scene.input.once("pointerup", () => scene.input.off("pointermove", move));
        hit.once(Phaser.GameObjects.Events.DESTROY, () => scene.input.off("pointermove", move));
      });

      // ── 스테미나 충전 — 스테미나 창의 칸 셋을 작게.
      next.add(addSectionTitle(scene, -inner / 2, top + L.recharge.titleY, t("dungeon.run.recharge"), { size: 24 }));
      const held = scene.add.text(inner / 2, top + L.recharge.titleY, "", textStyle({ role: "display", size: 26, color: "#ffe9a3" })).setOrigin(1, 0.5);
      held.setText(t("dungeon.run.held", { amount: formatCurrency(session.wallet.stamina) }));
      next.add(held);
      next.add(scene.add.image(inner / 2 - held.width - 26, top + L.recharge.titleY, CURRENCY_ICON_BY_WALLET.stamina).setDisplaySize(40, 40));
      const cells = dungeonRunRechargeCells();
      options.recharge.mountCompact(next, { y: top + L.recharge.top + L.recharge.height / 2, width: cells.width, height: L.recharge.height, centers: cells.centers, edge: tone.accent }, () => { if (body.active) render(); });

      // ── 갈래 줄.
      const branchY = top + L.branch.y;
      if (options.mode === "auto") paintAutoToggles(next, branchY);
      else paintTicketLine(next, branchY, options);

      paintCount();
    };

    /** 자동 전투의 옵션 두 칩 — 누르면 그 자리에서 켜고 끈다. 드링크를 켜면 막대 끝이 병만큼 늘어난다. */
    const paintAutoToggles = (parent: Phaser.GameObjects.Container, y: number): void => {
      if (!auto || options.mode !== "auto") return;
      const width = (inner - 16) / 2;
      const chips: Array<[string, keyof Pick<AutoRepeatOptions, "stopOnDefeat" | "autoDrink">]> = [[t("autoRepeat.stopOnDefeat"), "stopOnDefeat"], [t("autoRepeat.autoDrink"), "autoDrink"]];
      chips.forEach(([label, key], index) => {
        const on = auto[key];
        const chip = scene.add.container(-inner / 2 + width / 2 + index * (width + 16), y);
        chip.add(drawLayer(scene, 0, 0, slantedRect(width, L.branch.height - 14, 12), { fill: on ? tone.deep : 0x10151c, alpha: 0.95, edge: tone.accent, edgeAlpha: on ? 0.95 : 0.3 }));
        const boxX = -width / 2 + 40;
        chip.add(drawLayer(scene, boxX, 0, slantedRect(34, 34, 6), { fill: on ? tone.accent : 0x05080b, alpha: on ? 1 : 0.9, edge: tone.accent, edgeAlpha: 0.6 }));
        if (on) chip.add(drawGlyph(scene, "check", boxX, 0, 26, 0x0b1210, 1, 4));
        chip.add(squeezeTextToWidth(scene.add.text(boxX + 32, 0, label, textStyle({ role: "emphasis", size: 24, color: on ? tone.accentText : COLOR.inkDim })).setOrigin(0, 0.5), width - 96));
        const hit = scene.add.rectangle(0, 0, width, L.branch.height - 14, 0xffffff, 0).setInteractive({ useHandCursor: true });
        hit.on("pointerdown", () => pressIn(chip));
        hit.on("pointerout", () => pressOut(chip, "normal", { pop: false }));
        hit.on("pointerup", () => {
          pressOut(chip);
          auto[key] = !auto[key];
          options.save({ ...auto });
          render();
        });
        chip.add(hit);
        parent.add(chip);
      });
    };

    /** 소탕권 줄 — 그림 · 이름 · 가진 수, 오른쪽에 남은 광고 횟수를 단 광고 그림과 「광고 보고 N개 받기」. 멤버십이면 한 줄 안내다. */
    const paintTicketLine = (parent: Phaser.GameObjects.Container, y: number, sweep: SweepRunPopupOptions): void => {
      const tickets = sweep.membership() ? undefined : sweep.tickets();
      parent.add(drawLayer(scene, 0, y, slantedRect(inner, L.branch.height - 6, 12), { fill: tone.glass, alpha: 0.9, edge: tone.accent, edgeAlpha: 0.35 }));
      if (!tickets) {
        parent.add(scene.add.text(0, y, t("dungeon.sweep.membership"), textStyle({ role: "display", size: 26, color: tone.accentText })).setOrigin(0.5));
        return;
      }
      const ticket = findItem(SWEEP_TICKET_ITEM);
      const left = -inner / 2 + 30;
      if (ticket) parent.add(addItemDefinitionIcon(scene, ticket.icon, left + L.branch.icon / 2, y, L.branch.icon));
      parent.add(squeezeTextToWidth(scene.add.text(left + L.branch.icon + 14, y, t("dungeon.run.ticketHeld", { name: ticket?.name ?? "", count: formatCurrency(tickets.held) }), textStyle({ role: "emphasis", size: 24, color: COLOR.ink })).setOrigin(0, 0.5), inner - L.branch.adWidth - L.branch.adGap - L.branch.icon * 2 - 100));
      const need = settleSweep(sweep.cost, count, false).ticketCost;
      const adX = inner / 2 - 20 - L.branch.adWidth / 2;
      // 광고 그림 위에 남은 횟수(`3/3`)를 겹치고, 그 옆 버튼이 얼마를 받는지 말한다.
      const adIconX = adX - L.branch.adWidth / 2 - L.branch.adGap - L.branch.icon / 2;
      parent.add(scene.add.image(adIconX, y, UI_ICON.ad).setDisplaySize(L.branch.icon, L.branch.icon).setAlpha(tickets.adRemaining > 0 ? 1 : 0.45));
      parent.add(scene.add.text(adIconX + L.branch.icon / 2 + 6, y + L.branch.icon / 2 + 2, t("dungeon.sweep.adUsage", { left: tickets.adRemaining, limit: tickets.adLimit }), textStyle({ role: "display", size: 20, color: tickets.adRemaining > 0 ? COLOR.ink : COLOR.inkDim })).setStroke("#000000", 5).setOrigin(1, 1));
      const ad = new Button(scene, adX, y, {
        width: L.branch.adWidth, height: L.branch.adHeight, label: t("dungeon.sweep.ad", { count: tickets.adQuantity }), fontSize: 22,
        ...(tickets.held < need ? { variant: "primary" as const, accentColor: tone.accent, accentTextColor: tone.accentText } : {}),
        onClick: () => {
          if (adBusy) return;
          adBusy = true;
          void sweep.onWatchAd().finally(() => { adBusy = false; if (body.active) render(); });
        },
      });
      ad.setEnabled(tickets.adRemaining > 0 && !adBusy);
      parent.add(ad);
    };

    /** 횟수가 바뀔 때 다시 그리는 것 — 큰 수 · 막대 채움 · 소모/획득 · 확정. */
    function paintCount(): void {
      if (!view) return;
      const next = scene.add.container(0, 0);
      view.add(next);
      countLayer?.destroy();
      countLayer = next;
      const rawCap = capNow();
      const cap = Math.max(1, rawCap);
      count = Phaser.Math.Clamp(count, 1, cap);
      const countTop = top + L.count.top;
      const plateY = countTop + L.count.plateY;

      // 큰 수 — `횟수 / 끝`.
      next.add(drawLayer(scene, 0, plateY, chipPoints(L.count.plateWidth, L.count.plateHeight, { bevel: { topLeft: 18, topRight: 0, bottomRight: 18, bottomLeft: 0 } }), { fill: tone.deep, alpha: 0.98, edge: tone.accent, edgeAlpha: 0.95 }));
      next.add(scene.add.text(0, plateY, t("dungeon.run.count", { count, max: rawCap }), textStyle({ role: "display", size: L.count.valueSize, color: tone.accentText })).setOrigin(0.5).setShadow(0, 3, "#000000", 4, false, true));
      const side = L.count.plateWidth / 2 + L.count.sideGap + L.count.sideWidth / 2;
      next.add(new Button(scene, -side, plateY, { width: L.count.sideWidth, height: L.count.sideHeight, label: t("dungeon.run.min"), fontSize: 28, onClick: () => setCount(1) }).setEnabled(count > 1));
      next.add(new Button(scene, side, plateY, {
        width: L.count.sideWidth, height: L.count.sideHeight, label: t("dungeon.sweep.max"), fontSize: 30, variant: "primary", accentColor: tone.accent, accentTextColor: tone.accentText,
        onClick: () => setCount(cap),
      }).setEnabled(count < cap));
      const perRunCost = options.mode === "auto" ? options.staminaCost : options.cost.staminaCost;
      next.add(scene.add.text(0, countTop + L.count.perRunY, t("dungeon.run.perRun", { cost: perRunCost }), textStyle({ role: "body", size: 20, color: COLOR.inkDim })).setOrigin(0.5));

      // 막대 채움 · 손잡이 · − +.
      const sliderY = countTop + L.count.sliderY;
      const ratio = runSliderRatio(count, 1, cap);
      const fillWidth = Math.max(L.count.trackHeight, slider.trackWidth * ratio);
      next.add(drawLayer(scene, slider.trackLeft + fillWidth / 2, sliderY, slantedRect(fillWidth, L.count.trackHeight - 8, 8), { fill: tone.accent, alpha: rawCap > 0 ? 0.95 : 0.35 }));
      const knob = scene.add.container(slider.trackLeft + slider.trackWidth * ratio, sliderY);
      knob.add(drawLayer(scene, 0, 0, slantedRect(L.count.knobWidth, L.count.knobHeight, 8), { fill: 0xfdf7e8, alpha: 1, edge: tone.accent, edgeAlpha: 1 }));
      knob.add(scene.add.rectangle(0, 0, 4, L.count.knobHeight * 0.5, tone.deep, 0.9));
      next.add(knob);
      const step = (x: number, label: string, delta: number, enabled: boolean): void => {
        next.add(new Button(scene, x, sliderY, { width: L.count.stepSize, height: L.count.stepSize, label, fontSize: 38, onClick: () => setCount(count + delta) }).setEnabled(enabled));
      };
      step(slider.minus, "−", -1, count > 1);
      step(slider.plus, "+", 1, count < cap);

      // ── 예상 소모 | 예상 획득.
      const sumTop = top + L.summary.top;
      const sumY = sumTop + L.summary.height / 2;
      next.add(drawLayer(scene, 0, sumY, panelShape(inner, L.summary.height), { fill: 0x10151c, alpha: 0.94, edge: tone.accent, edgeAlpha: 0.45 }));
      next.add(scene.add.rectangle(0, sumY + 10, 2, L.summary.height - 70, tone.accent, 0.25));
      const leftX = -inner / 4;
      const rightX = inner / 4;
      next.add(scene.add.text(leftX, sumTop + L.summary.titleY, t("dungeon.run.cost"), textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0.5));
      next.add(scene.add.text(rightX, sumTop + L.summary.titleY, options.mode === "auto" ? t("dungeon.run.rewardAuto") : t("dungeon.sweep.expected"), textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0.5));
      const frameY = sumTop + L.summary.frameY;
      const row = (x: number, items: Array<{ key: string; amount: number; short?: boolean }>): void => {
        items.forEach((item, index) => {
          const fx = x + (index - (items.length - 1) / 2) * L.summary.gap;
          addFramedIcon(scene, next, fx, frameY, L.summary.frame, item.key, { amount: formatCurrency(item.amount) });
          if (item.short) next.add(scene.add.text(fx, frameY + L.summary.frame / 2 + 4, t("dungeon.run.short"), textStyle({ role: "emphasis", size: 18, color: COLOR.dangerText })).setOrigin(0.5, 0));
        });
      };

      let enabled: boolean;
      let notice = "";
      if (options.mode === "auto") {
        const need = count * options.staminaCost;
        const drinks = drinksNeeded(need, session.wallet.stamina, options.drinks());
        row(leftX, [{ key: CURRENCY_ICON_BY_WALLET.stamina, amount: need, short: need > session.wallet.stamina && !auto!.autoDrink }]);
        if (need > session.wallet.stamina && auto!.autoDrink && drinks > 0) {
          next.add(scene.add.text(leftX, frameY + L.summary.frame / 2 + 4, t("dungeon.run.drinks", { count: drinks }), textStyle({ role: "emphasis", size: 18, color: tone.accentText })).setOrigin(0.5, 0));
        }
        row(rightX, [{ key: options.reward.icon, amount: options.reward.amount * count }]);
        enabled = rawCap >= 1 && session.wallet.stamina >= options.staminaCost;
        if (!enabled) notice = t("dungeon.sweep.staminaShort");
      } else {
        const membership = options.membership();
        const tickets = membership ? undefined : options.tickets();
        const settlement = settleSweep(options.cost, count, membership);
        const ticket = findItem(SWEEP_TICKET_ITEM);
        const costs: Array<{ key: string; amount: number; short?: boolean }> = [{ key: CURRENCY_ICON_BY_WALLET.stamina, amount: settlement.staminaCost, short: settlement.staminaCost > session.wallet.stamina }];
        if (tickets && ticket?.icon.kind === "asset") costs.push({ key: ticket.icon.key, amount: settlement.ticketCost, short: settlement.ticketCost > tickets.held });
        row(leftX, costs);
        const rewards = sortByRewardPriority(Object.entries(settlement.rewards).filter(([, amount]) => amount > 0), ([currency]) => currency)
          .flatMap(([currency, amount]) => { const key = CURRENCY_ICON_BY_WALLET[currency as keyof typeof CURRENCY_ICON_BY_WALLET]; return key ? [{ key, amount }] : []; })
          .slice(0, 3);
        row(rightX, rewards);
        const refusal = sweepRefusal({ cleared: options.cleared, count, adFreeMembership: membership, tickets: tickets?.held ?? 0, stamina: session.wallet.stamina, cost: options.cost });
        enabled = refusal === null && !adBusy;
        notice = refusal === "not_enough_tickets" ? t("dungeon.sweep.ticketShort")
          : refusal === "not_enough_stamina" ? t("dungeon.sweep.staminaShort")
            : refusal === "not_cleared" ? t("dungeon.sweep.notCleared") : "";
      }
      if (notice) next.add(scene.add.text(0, top + L.notice.y, notice, textStyle({ role: "emphasis", size: L.notice.size, color: COLOR.dangerText })).setOrigin(0.5));

      // ── 확정 — 그 창의 색으로 물든 주 버튼 하나. 취소는 우하단 공용 뒤로가기다.
      next.add(new Button(scene, 0, top + L.confirm.y, {
        width: L.confirm.width, height: L.confirm.height,
        label: options.mode === "auto" ? t("dungeon.run.startAuto") : t("dungeon.run.startSweep", { count }),
        fontSize: L.confirm.fontSize, variant: "primary", fill: tone.deep, accentColor: tone.accent, accentTextColor: tone.accentText, decorDots: true,
        onClick: () => {
          const chosen = count;
          close();
          if (options.mode === "auto") options.onStart({ ...auto!, runs: chosen });
          else options.onConfirm(chosen);
        },
      }).setEnabled(enabled));
    }

    render();
    // 충전 칸·다른 창에서 채우고 돌아와도 막대 끝과 소모가 곧바로 맞도록 지갑을 듣는다.
    const unsubscribe = managerEvents.subscribe("wallet", () => { if (body.active) render(); });
    body.once(Phaser.GameObjects.Events.DESTROY, unsubscribe);
  });
}

/** 팝업 몸판과 같은 비율로 깎은 안쪽 판. */
function panelShape(width: number, height: number): number[] {
  const unit = Math.min(width, height) * 0.14;
  return chipPoints(width, height, { bevel: { topLeft: unit, topRight: 0, bottomRight: unit, bottomLeft: 0 } });
}
