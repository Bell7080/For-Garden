import Phaser from "phaser";
import type { GameApi, ProductDto, ProgressPassDto, ProgressPassMilestoneDto } from "../api/contracts";
import type { PlatformPaymentAdapter } from "../api/PlatformPayment";
import { runPlatformPurchase } from "../api/platformPurchase";
import { formatCurrency } from "../core/formatCurrency";
import { t, type TextKey } from "../i18n";
import { platformPayment } from "../platform/payment";
import { Button } from "./Button";
import { drawLayer, HoloBar, slantedRect } from "./holo";
import { addFrameAmount, addFramedIcon } from "./itemFrame";
import { PASS_TRACK, passTrackHeight, passTrackRowY } from "./premiumLayout";
import { grantTiles, progressPassAction } from "./premiumModel";
import type { PopupLayer } from "./PopupLayer";
import { openRewardPopup, productGrantsToRewardItems } from "./RewardPopup";
import { COLOR, textStyle } from "./theme";
import { squeezeTextToWidth } from "./textFit";

/** 패스마다의 색. 카드와 길 창이 같은 값을 읽는다 — 스토리는 금빛, 레벨은 초록, 레이드는 보랏빛. */
export const PROGRESS_PASS_TONE: Readonly<Record<ProgressPassDto["id"], number>> = {
  story: 0xe0a83e, level: 0x6fc47f, raid: 0xb48ce0,
};

/** 진행도 한 줄(「스토리 클리어 12 / 30」). 카드와 길 창이 같은 문구를 쓴다. */
export function progressPassProgressLabel(pass: Pick<ProgressPassDto, "metric" | "progress" | "goal">): string {
  return t(`shop.premium.pass.metric.${pass.metric}` as TextKey, { progress: Math.min(pass.progress, pass.goal), goal: pass.goal });
}

/** 마디 한 칸의 이름(「13회 클리어」·「Lv.30」·「8회 도전」). */
export function progressPassStepLabel(metric: ProgressPassDto["metric"], threshold: number): string {
  return t(`shop.premium.pass.step.${metric}` as TextKey, { threshold });
}

export interface PassTrackPopupOptions {
  api: GameApi;
  pass: ProgressPassDto;
  product: ProductDto;
  /** 결제 SDK 어댑터. 비우면 빌드가 가진 어댑터를 결제 순간에 읽는다. */
  payment?: PlatformPaymentAdapter;
  /** 열기·받기가 끝난 뒤 — 화면이 지갑과 목록을 새로 읽는다. */
  onChanged: () => void | Promise<void>;
}

/**
 * 진행 패스의 길 창.
 *
 * 마디가 위에서 아래로 서고, 줄마다 **어디까지 가면(문턱) · 무엇을(액자) · 지금 어떤지(상태)** 를 말한다.
 * 밑동의 버튼 하나가 열기 전엔 「패스 열기」(값), 연 뒤엔 「모두 받기」다 — 받을 수 있는 마디를 하나씩 누르게
 * 하지 않는다. 열기 전에 이미 닿은 마디는 「열면 받음」으로 서서, 사는 순간 무엇이 들어오는지 먼저 보인다.
 */
export function openPassTrackPopup(scene: Phaser.Scene, popups: PopupLayer, options: PassTrackPopupOptions): void {
  const { pass, product } = options;
  const count = pass.milestones.length;
  const height = passTrackHeight(count);
  const tone = PROGRESS_PASS_TONE[pass.id];
  popups.open({ width: PASS_TRACK.width, height, title: product.name, dim: true, closeOnBackdrop: true }, (body, close) => {
    const top = -height / 2 + PASS_TRACK.top;
    const barWidth = PASS_TRACK.rowWidth;
    body.add(scene.add.text(-barWidth / 2, top + PASS_TRACK.progressLabelY, progressPassProgressLabel(pass), textStyle({ role: "emphasis", size: 30, color: COLOR.ink }))
      .setOrigin(0, 0.5));
    const bar = new HoloBar(scene, 0, top + PASS_TRACK.barY, barWidth, PASS_TRACK.barHeight, {
      color: tone, trackAlpha: 0.85, outline: true, ticks: Math.max(0, count - 1),
    });
    bar.setValue(pass.goal > 0 ? Math.min(1, pass.progress / pass.goal) : 0);
    body.add([...bar.objects]);

    pass.milestones.forEach((milestone, index) => paintMilestoneRow(scene, body, pass, milestone, passTrackRowY(index, count), tone));

    // 밑동 — 열기 전엔 값을 단 열기 버튼, 연 뒤엔 모두 받기. 받을 것이 없으면 버튼을 세우지 않는다.
    const action = progressPassAction(pass);
    const buttonY = height / 2 - PASS_TRACK.footer / 2;
    const message = scene.add.text(0, buttonY - PASS_TRACK.messageGap, "", textStyle({ role: "body", size: 22, color: COLOR.dangerText })).setOrigin(0.5);
    body.add(message);
    let pending = false;
    if (action === "buy" || action === "claim") {
      const label = action === "buy" ? t("shop.premium.pass.open") : t("shop.premium.pass.claimAll");
      const sub = action === "buy" && product.acquisition.kind === "platform_payment" ? product.acquisition.displayPrice : undefined;
      const button = new Button(scene, 0, buttonY, {
        width: PASS_TRACK.button.width, height: PASS_TRACK.button.height, label, sub, variant: "primary",
        onClick: () => {
          if (pending) return;
          pending = true; message.setText("");
          void (action === "buy" ? buy() : claim()).finally(() => { pending = false; });
        },
      });
      body.add(button);
    } else {
      body.add(scene.add.text(0, buttonY, action === "complete" ? t("shop.premium.pass.complete") : t("shop.premium.pass.inProgress"), textStyle({ role: "emphasis", size: 28, color: COLOR.inkDim })).setOrigin(0.5));
    }

    async function buy(): Promise<void> {
      const outcome = await runPlatformPurchase(options.api, options.payment ?? platformPayment(), product);
      if (outcome.status === "purchased") {
        close();
        await options.onChanged();
        return;
      }
      message.setText(outcome.status === "cancelled" ? t("shop.premium.cancelled")
        : outcome.status === "unsupported" ? t("shop.premium.unsupported")
        : outcome.message || t("shop.purchase.failed"));
    }

    async function claim(): Promise<void> {
      try {
        const result = await options.api.claimProgressPass({ passId: pass.id, requestId: `pass-${pass.id}-${Date.now()}` });
        close();
        openRewardPopup(scene, popups, {
          title: t("shop.premium.pass.rewardTitle"),
          items: productGrantsToRewardItems(result.granted),
          onConfirm: () => { void options.onChanged(); },
        });
      } catch (error) {
        message.setText(error instanceof Error ? error.message : t("shop.purchase.failed"));
      }
    }
  });
}

/** 마디 한 줄 — 문턱 · 보상 액자 · 상태. 받은 줄은 눌러 두고, 받을 수 있는 줄만 강조색 선이 흐른다. */
function paintMilestoneRow(scene: Phaser.Scene, body: Phaser.GameObjects.Container, pass: ProgressPassDto, milestone: ProgressPassMilestoneDto, y: number, tone: number): void {
  const row = scene.add.container(0, y);
  const ready = milestone.state === "claimable" || milestone.state === "reached";
  row.add(drawLayer(scene, 0, 0, slantedRect(PASS_TRACK.rowWidth, PASS_TRACK.rowPlate, 18), {
    fill: 0x101722, alpha: 0.9,
    ...(ready ? { edge: tone, edgeAlpha: 0.95, glow: { color: tone, strength: 0.22, height: 0.8 } } : {}),
  }));
  const step = scene.add.text(PASS_TRACK.stepX, 0, progressPassStepLabel(pass.metric, milestone.threshold), textStyle({ role: "display", size: 32, color: ready ? COLOR.ink : COLOR.inkDim }))
    .setOrigin(0, 0.5).setStroke("#000000", 5);
  row.add(squeezeTextToWidth(step, PASS_TRACK.framesX - PASS_TRACK.frame / 2 - 24 - PASS_TRACK.stepX, 0.7));
  grantTiles(milestone.rewards).forEach((tile, index) => {
    const x = PASS_TRACK.framesX + index * (PASS_TRACK.frame + PASS_TRACK.frameGap);
    const frame = addFramedIcon(scene, row, x, 0, PASS_TRACK.frame, tile.icon, { iconAlpha: milestone.state === "claimed" ? 0.45 : 1 });
    frame.add(addFrameAmount(scene, PASS_TRACK.frame, formatCurrency(tile.amount)));
  });
  const stateColor = milestone.state === "claimable" ? COLOR.accentText : milestone.state === "reached" ? COLOR.accentText : COLOR.inkDim;
  row.add(scene.add.text(PASS_TRACK.stateX, 0, t(`shop.premium.pass.state.${milestone.state}` as TextKey), textStyle({ role: "emphasis", size: 26, color: stateColor }))
    .setOrigin(1, 0.5));
  if (milestone.state === "claimed") row.setAlpha(0.55);
  body.add(row);
}
