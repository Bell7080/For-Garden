import Phaser from "phaser";
import { attachRoll } from "./RollingValue";
import { t } from "../i18n";
import type { AdPresentationResult, DuelStatusResponse, GameApi } from "../api/contracts";
import { DUEL_DAILY_ATTEMPTS, DUEL_EXTRA_ATTEMPT_PRICES } from "../core/duelArena";
import { completedAdToken, findAdRewardSlot } from "../data/adRewards";
import { findItem } from "../data/items";
import { InventoryManager } from "../managers/InventoryManager";
import { managerEvents } from "../managers/ManagerEvents";
import { presentRewardedAd } from "../platform/rewardedAds";
import { session } from "../state/session";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { drawLayer } from "./holo";
import { UI_ICON } from "./icons";
import { addFramedIcon } from "./itemFrame";
import { remainingDetail } from "./itemExpiry";
import { PopupLayer } from "./PopupLayer";
import { openRewardPopup } from "./RewardPopup";
import { adRewardToRewardItems } from "./rewardPopupModel";
import { addSectionTitle } from "./SectionTitle";
import { heroStack, staminaPopupLayout } from "./staminaPopupLayout";
import { addRechargeCell, rechargePanelShape, type RechargeCellView } from "./RechargeCell";
import { COLOR, textStyle } from "./theme";

/** 광고로 도전권을 받는 슬롯. 한도·장 수는 광고 표가 갖는다. */
const AD_SLOT_ID = "duel-attempt";
const TICKET_ICON = "item-duel-ticket";

/**
 * 결투 도전권 창 — 스테미나 창과 **같은 양식**이다(`staminaPopupLayout`을 칸 둘·사용처 없이 쓴다).
 *
 * 위 판이 「오늘 남은 도전권 / 하루 기본 몫」과 다음 초기화까지를, 아래 두 칸이 지금 채우는 수단(젬 구매 ·
 * 광고)을 같은 크기로 나란히 세운다 — 둘은 서로 대체재라 어느 하나를 크게 세우면 값을 비교하기 전에
 * 크기가 답을 정한다. 차감과 지급은 서버(`buyDuelAttempt`·`claimAdReward`)가 확정하고, 화면은 응답으로
 * 받은 결투장 상태만 다시 그린다.
 */
const LAYOUT = staminaPopupLayout(0, 0, 2);
const TONE = { value: "#ffe9a3", timer: COLOR.inkDim } as const;

export interface DuelTicketPopupOptions {
  /** 결투장 상태가 바뀌었을 때(샀거나 광고로 받았을 때). 결투장 화면이 그 상태로 다시 그린다. */
  onStatus: (status: DuelStatusResponse) => void;
  /** 광고 표시 다리. SDK가 없으면 성공을 흉내 내지 않고 실패로 돌아온다. */
  presentAd?: (slotId: string) => Promise<AdPresentationResult>;
}

export function openDuelTicketPopup(scene: Phaser.Scene, popups: PopupLayer, api: GameApi, status: DuelStatusResponse, options: DuelTicketPopupOptions): void {
  const inventory = new InventoryManager(session);
  const presentAd = options.presentAd ?? presentRewardedAd;
  let current = status;
  let pending = false;
  let message = "";
  let repaint: (() => void) | undefined;

  const run = async (action: () => Promise<DuelStatusResponse | undefined>): Promise<void> => {
    if (pending) return;
    pending = true; message = ""; repaint?.();
    try {
      const next = await action();
      if (next) { current = next; options.onStatus(next); }
    } catch {
      message = t("duel.ticketPopup.failed");
    } finally {
      pending = false; repaint?.();
    }
  };

  const buy = (): void => {
    const price = current.nextAttemptPrice;
    if (price === null || pending) return;
    const held = session.wallet.gems;
    popups.confirm({
      title: t("duel.attempts.buyTitle"), message: t("duel.attempts.buyMessage"), confirmLabel: t("duel.attempts.buyTitle"),
      costs: [{ iconKey: CURRENCY_ICON_BY_WALLET.gems, amount: price }],
      balance: { iconKey: CURRENCY_ICON_BY_WALLET.gems, before: held, after: held - price },
    }, () => void run(() => api.buyDuelAttempt()));
  };

  const watchAd = (): void => void run(async () => {
    const verificationToken = completedAdToken(await presentAd(AD_SLOT_ID));
    if (!verificationToken) { message = t("stamina.adCancelled"); return undefined; }
    const response = await inventory.claimAdReward(api, { slotId: AD_SLOT_ID, verificationToken, requestId: adRequestId() });
    const status = await api.getDuelStatus();
    openRewardPopup(scene, popups, { items: adRewardToRewardItems(response) });
    return status;
  });

  const paint = (view: Phaser.GameObjects.Container): void => {
    // 위 판 — 그림 · 남은/기본 · 다음 초기화까지. 도전권은 UTC 자정에 기본 몫으로 돌아간다.
    view.add(drawLayer(scene, 0, LAYOUT.hero.y, rechargePanelShape(LAYOUT.hero.width, LAYOUT.hero.height), { fill: 0x101720, alpha: 0.9, edge: COLOR.accent, edgeAlpha: 0.35 }));
    const stack = heroStack(LAYOUT.hero.y, true);
    addFramedIcon(scene, view, 0, stack.frameY, LAYOUT.frameSize, TICKET_ICON, { plain: true });
    view.add(attachRoll(scene.add.text(0, stack.valueY, `${current.attemptsLeft.toLocaleString()} / ${DUEL_DAILY_ATTEMPTS}`, textStyle({ role: "display", size: 52, color: current.attemptsLeft > 0 ? TONE.value : COLOR.dangerText }))
      .setOrigin(0.5).setShadow(2, 6, "#05070a", 7, false, true), { memoryKey: "duel-ticket-popup:attempts" }));
    if (stack.timerY !== undefined) view.add(scene.add.text(0, stack.timerY, t("duel.ticketPopup.reset", { time: remainingDetail(nextUtcMidnight(current.serverTime)), count: DUEL_DAILY_ATTEMPTS }), textStyle({ role: "body", size: 22, color: TONE.timer })).setOrigin(0.5));

    view.add(addSectionTitle(scene, -LAYOUT.hero.width / 2, LAYOUT.rechargeTitleY, t("stamina.recharge"), { size: 28 }));
    const price = current.nextAttemptPrice;
    const gems = session.wallet.gems;
    const ad = findAdRewardSlot(AD_SLOT_ID);
    const adUsed = session.dailyAdRewards.claimsBySlot[AD_SLOT_ID] ?? 0;
    const adLimit = ad?.dailyLimitUtc ?? 0;
    const adGain = ad?.reward.kind === "duel_attempt" ? ad.reward.quantity : 0;
    const cells: RechargeCellView[] = [
      {
        kind: "gem", texture: CURRENCY_ICON_BY_WALLET.gems, owned: gems, gain: 1, name: t("duel.ticketPopup.gemName"),
        detail: t("duel.ticketPopup.gemDetail", { count: current.attemptsPurchased, limit: DUEL_EXTRA_ATTEMPT_PRICES.length }),
        // 버튼은 젬 그림과 값만 말한다 — 스테미나 창의 젬 칸과 같다. 다 산 날만 「매진」이 선다.
        button: {
          label: price === null ? t("duel.attempts.soldOut") : "",
          cost: price === null ? undefined : { amount: price, affordable: gems >= price },
          enabled: price !== null && gems >= price && !pending, onClick: buy,
        },
      },
      {
        // 남은 횟수는 버튼이 광고 그림과 함께 `3/3`으로 말한다 — 스테미나 창의 광고 칸과 같다.
        kind: "ad", texture: UI_ICON.ad, gain: adGain, name: t("duel.ticketPopup.adName"), detail: "",
        button: { label: `${Math.max(0, adLimit - adUsed)}/${adLimit}`, art: UI_ICON.ad, enabled: ad !== undefined && adUsed < adLimit && !pending, onClick: watchAd },
      },
    ];
    cells.forEach((cell, index) => {
      const x = LAYOUT.cell.centers[index];
      if (x !== undefined) view.add(addRechargeCell(scene, x, LAYOUT.cell.y, LAYOUT.cell, cell));
    });
    if (message) view.add(scene.add.text(0, LAYOUT.cell.y + LAYOUT.cell.height / 2 + 20, message, textStyle({ role: "body", size: 19, color: COLOR.inkDim })).setOrigin(0.5));
  };

  popups.open({ width: LAYOUT.width, height: LAYOUT.height, title: findItem("duel-ticket")?.name ?? t("duel.ticket.label"), dim: true, dimAlpha: 0.34 }, (body) => {
    const view = scene.add.container(0, 0);
    body.add(view);
    const render = (): void => { view.removeAll(true); paint(view); };
    repaint = render;
    render();
    // 초기화까지 남은 시간은 1초마다, 젬 보유는 지갑이 바뀔 때 다시 그린다.
    const timer = scene.time.addEvent({ delay: 1_000, loop: true, callback: render });
    const unsubscribe = managerEvents.subscribe("wallet", render);
    view.once(Phaser.GameObjects.Events.DESTROY, () => { timer.remove(); unsubscribe(); repaint = undefined; });
  });
}

/** 서버 시각 기준 다음 UTC 자정 — 결투장의 하루(`duelDayKey`)가 넘어가는 순간이다. */
function nextUtcMidnight(serverTime: string): string {
  const now = new Date(serverTime);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
}

/** 재전송으로 같은 광고 보상이 두 번 확정되지 않게 한다. */
function adRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `duel-ad-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
