import Phaser from "phaser";
import { t } from "../i18n";
import { maxSweepCount, settleSweep, sweepRefusal, SWEEP_TICKET_ITEM, type DungeonRunCost } from "../core/dungeonShortcut";
import { formatCurrency } from "../core/formatCurrency";
import { findItem } from "../data/items";
import { session } from "../state/session";
import { Button } from "./Button";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { chipPoints, drawLayer } from "./holo";
import { addFramedIcon, guideForIcon } from "./itemFrame";
import { pressIn, pressOut } from "./pressFeedback";
import { addItemDefinitionIcon } from "./itemDefinitionIcon";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { SWEEP_POPUP, sweepCountControlX, sweepPopupHeight } from "./sweepPopupLayout";

/** 멤버십이 없을 때 소탕 창의 소탕권 줄 — 가진 수와 오늘의 광고. */
export interface SweepTickets {
  held: number;
  /** 오늘 더 볼 수 있는 광고 수와 하루 한도. */
  adRemaining: number;
  adLimit: number;
  /** 광고 한 번에 채워지는 장수. */
  adQuantity: number;
}

export interface SweepPopupOptions {
  tierName: string;
  level: number;
  /** 한 판의 값. 곱하기는 단축 규칙(`settleSweep`)이 한다. */
  cost: DungeonRunCost;
  /** 이 단계를 이겨 봤는가 — 이긴 단계만 소탕한다. */
  cleared: boolean;
  /** 멤버십이면 소탕권이 들지 않는다. 광고를 보고 돌아오면 값이 바뀌므로 그릴 때마다 묻는다. */
  membership: () => boolean;
  /** 멤버십이 아니면 소탕권 줄(가진 수 · 광고 남은 횟수). */
  tickets: () => SweepTickets | undefined;
  onWatchAd: () => Promise<void>;
  /** 배율을 고르고 소탕을 누른 순간. 창은 먼저 닫힌다. */
  onConfirm: (count: number) => void;
}

/**
 * **소탕 창** — 입구의 소탕 버튼이 여는 정식 창.
 *
 * 입구 아래에 − 횟수 + MAX · 소탕권 · 광고를 한 줄로 늘어놓던 때는 조작 여섯 개가 좁은 줄에 붙어
 * 무엇을 얼마나 치르고 무엇을 받는지가 한눈에 읽히지 않았다. 이 창은 **배율 하나를 고르는 자리**다 —
 * 배율(×N)을 올릴 때마다 드는 스테미나와 **소탕권이 한 장씩** 함께 늘고, 받을 것도 같은 배수로 선다.
 *
 * - 멤버십이면 소탕권 줄 대신 「소탕권 없이 소탕 가능.」이 선다.
 * - 소탕권이 모자라면 그 수가 붉고, 광고 버튼이 강조 판으로 바뀌어 다음에 할 일을 말한다(소탕은 꺼진다).
 * - 판정은 화면이 새로 짓지 않고 단축 규칙(`sweepRefusal`·`maxSweepCount`)을 그대로 읽는다 — 서버가
 *   거절하는 조건과 창이 꺼 두는 조건이 갈리지 않는다.
 */
export function openSweepPopup(scene: Phaser.Scene, popups: PopupLayer, options: SweepPopupOptions): void {
  const L = SWEEP_POPUP;
  const height = sweepPopupHeight();
  let count = 1;
  let adBusy = false;
  popups.open({ width: L.width, height, title: t("dungeon.sweep"), dim: true, dimAlpha: 0.66, closeOnBackdrop: true, hideCloseButton: true }, (body, close) => {
    const top = -height / 2;
    let content: Phaser.GameObjects.Container | undefined;

    const render = (): void => {
      const next = scene.add.container(0, 0);
      body.add(next);
      content?.destroy();
      content = next;
      const membership = options.membership();
      const tickets = membership ? undefined : options.tickets();
      const held = { stamina: session.wallet.stamina, tickets: tickets?.held ?? 0 };
      const cap = Math.max(1, maxSweepCount({ stamina: held.stamina, tickets: held.tickets, adFreeMembership: membership, cost: options.cost }));
      count = Phaser.Math.Clamp(count, 1, cap);
      const settlement = settleSweep(options.cost, count, membership);
      const refusal = sweepRefusal({ cleared: options.cleared, count, adFreeMembership: membership, tickets: held.tickets, stamina: held.stamina, cost: options.cost });

      // 단계 이름 · 레벨 — 무엇을 소탕하는지가 창의 첫 줄이다.
      next.add(scene.add.text(0, top + L.tierY, t("dungeon.sweep.tier", { name: options.tierName, level: options.level }), textStyle({ role: "display", size: 34, color: COLOR.ink })).setOrigin(0.5));

      // 배율 — − ×N + MAX. 판 가운데의 ×N이 이 창에서 가장 큰 수다.
      const x = sweepCountControlX();
      const countY = top + L.count.y;
      const stepper = (cx: number, width: number, label: string, target: number, enabled: boolean): void => {
        next.add(new Button(scene, cx, countY, { width, height: L.count.height, label, fontSize: 36, onClick: () => { count = target; render(); } }).setEnabled(enabled));
      };
      stepper(x.minus, L.count.step, "-", count - 1, count > 1);
      const plate = scene.add.container(x.plate, countY);
      const plateShape = chipPoints(L.count.plate, L.count.height, { bevel: { topLeft: 16, topRight: 0, bottomRight: 16, bottomLeft: 0 } });
      plate.add(drawLayer(scene, 0, 0, plateShape, { fill: 0x1d1a12, alpha: 0.96, edge: COLOR.accent, edgeAlpha: 0.9 }));
      plate.add(scene.add.text(0, 0, t("dungeon.sweep.count", { count }), textStyle({ role: "display", size: 44, color: COLOR.accentText })).setOrigin(0.5).setShadow(0, 3, "#000000", 4, false, true));
      next.add(plate);
      stepper(x.plus, L.count.step, "+", count + 1, count < cap);
      stepper(x.max, L.count.max, t("dungeon.sweep.max"), cap, count < cap);

      // 드는 것 — 안쪽 판 한 장에 두 줄. 수는 `드는 수 / 가진 수`이고 모자란 쪽만 붉다.
      const panelWidth = L.width - 80;
      const panelY = top + L.cost.top + L.cost.height / 2;
      next.add(drawLayer(scene, 0, panelY, chipPoints(panelWidth, L.cost.height, { bevel: { topLeft: 20, topRight: 0, bottomRight: 20, bottomLeft: 0 } }), { fill: 0x121821, alpha: 0.92, edge: COLOR.accent, edgeAlpha: 0.5 }));
      const left = -panelWidth / 2 + L.cost.padX;
      const lineY = (index: number): number => panelY + (index - 0.5) * L.cost.lineGap;
      const addLine = (index: number, label: string, icon: (x: number, y: number) => Phaser.GameObjects.GameObject, need: number, have: number, right: number): void => {
        const y = lineY(index);
        next.add(scene.add.text(left, y, label, textStyle({ role: "emphasis", size: L.cost.labelSize, color: COLOR.inkDim })).setOrigin(0, 0.5));
        const value = scene.add.text(right, y, t("dungeon.sweep.needHave", { need: formatCurrency(need), have: formatCurrency(have) }), textStyle({ role: "display", size: L.cost.valueSize, color: need > have ? COLOR.dangerText : COLOR.ink })).setOrigin(1, 0.5);
        next.add(value);
        next.add(icon(right - value.width - 14 - L.cost.icon / 2, y));
      };
      /**
       * 드는 것의 그림도 눌린다 — 액자(`addFramedIcon`)와 같은 규칙으로 그 그림의 안내창이 열린다.
       * 이 줄만 맨 그림이라 스테미나·소탕권을 눌러도 아무 일이 없었다.
       */
      const tappable = (holder: Phaser.GameObjects.Container, textureKey: string): Phaser.GameObjects.Container => {
        const open = guideForIcon(scene, textureKey);
        if (!open) return holder;
        const size = L.cost.icon + 24;
        const hit = scene.add.rectangle(0, 0, size, size, 0xffffff, 0).setInteractive({ useHandCursor: true });
        hit.on("pointerdown", () => pressIn(holder));
        hit.on("pointerout", () => pressOut(holder, "normal", { pop: false }));
        hit.on("pointerup", () => { pressOut(holder); open(); });
        holder.add(hit);
        return holder;
      };
      const panelRight = panelWidth / 2 - L.cost.padX;
      addLine(0, t("dungeon.sweep.stamina"), (ix, iy) => tappable(
        scene.add.container(ix, iy, [scene.add.image(0, 0, CURRENCY_ICON_BY_WALLET.stamina).setDisplaySize(L.cost.icon, L.cost.icon)]),
        CURRENCY_ICON_BY_WALLET.stamina,
      ), settlement.staminaCost, held.stamina, panelRight);
      if (tickets) {
        const ticket = findItem(SWEEP_TICKET_ITEM);
        const short = held.tickets < settlement.ticketCost;
        const adRight = panelRight;
        const valueRight = adRight - L.ad.width - 24;
        addLine(1, ticket?.name ?? "", (ix, iy) => {
          const holder = scene.add.container(ix, iy);
          if (ticket) holder.add(addItemDefinitionIcon(scene, ticket.icon, 0, 0, L.cost.icon));
          return ticket?.icon.kind === "asset" ? tappable(holder, ticket.icon.key) : holder;
        }, settlement.ticketCost, held.tickets, valueRight);
        // 광고 — 모자라면 강조 판으로 서서 「여기서 채운다」를 말한다. 오늘 남은 횟수가 아래 줄이다.
        const ad = new Button(scene, adRight - L.ad.width / 2, lineY(1), {
          width: L.ad.width, height: L.ad.height, label: t("dungeon.sweep.ad", { count: tickets.adQuantity }), fontSize: 24,
          sub: t("dungeon.sweep.adUsage", { used: tickets.adLimit - tickets.adRemaining, limit: tickets.adLimit }), subFontSize: 16,
          ...(short ? { variant: "primary" as const } : {}),
          onClick: () => {
            if (adBusy) return;
            adBusy = true;
            void options.onWatchAd().finally(() => { adBusy = false; if (body.active) render(); });
          },
        });
        ad.setEnabled(tickets.adRemaining > 0 && !adBusy);
        next.add(ad);
      } else {
        next.add(scene.add.text(0, lineY(1), t("dungeon.sweep.membership"), textStyle({ role: "display", size: 28, color: COLOR.accentText })).setOrigin(0.5));
      }

      // 왜 못 하는지 — 모자란 것 하나만 말한다.
      const notice = refusal === "not_enough_tickets" ? t("dungeon.sweep.ticketShort")
        : refusal === "not_enough_stamina" ? t("dungeon.sweep.staminaShort")
          : refusal === "not_cleared" ? t("dungeon.sweep.notCleared") : "";
      if (notice) next.add(scene.add.text(0, top + L.notice.y, notice, textStyle({ role: "emphasis", size: L.notice.size, color: COLOR.dangerText })).setOrigin(0.5));

      // 받을 것 — 한 판의 보상 × 배율.
      next.add(scene.add.text(0, top + L.reward.titleY, t("dungeon.sweep.expected"), textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0.5));
      const rewards = Object.entries(settlement.rewards).filter(([, amount]) => amount > 0);
      rewards.forEach(([currency, amount], index) => {
        const rx = (index - (rewards.length - 1) / 2) * L.reward.gap;
        const key = CURRENCY_ICON_BY_WALLET[currency as keyof typeof CURRENCY_ICON_BY_WALLET];
        if (key) addFramedIcon(scene, next, rx, top + L.reward.y, L.reward.frame, key, { amount: formatCurrency(amount) });
      });

      // 취소 · 소탕 — 확인 창과 같은 두 판.
      const half = (L.buttons.width + L.buttons.gap) / 2;
      const buttonY = top + L.buttons.y;
      next.add(new Button(scene, -half, buttonY, { width: L.buttons.width, height: L.buttons.height, label: t("popup.cancel"), fontSize: L.buttons.fontSize, onClick: close }));
      next.add(new Button(scene, half, buttonY, {
        width: L.buttons.width, height: L.buttons.height, label: t("dungeon.sweep"), fontSize: L.buttons.fontSize,
        variant: "primary", fill: 0x3a2e14, decorDots: true,
        onClick: () => { const chosen = count; close(); options.onConfirm(chosen); },
      }).setEnabled(refusal === null && !adBusy));
    };
    render();
  });
}
