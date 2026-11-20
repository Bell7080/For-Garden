import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { supportApi } from "../managers/SupportManager";
import { notificationManager } from "../managers/NotificationManager";
import { reportCatch } from "../managers/ErrorReporter";
import type { SupportError } from "../api/SupportApi";
import type { PopupLayer } from "./PopupLayer";
import { FEEDBACK_POPUP as L } from "./candyNoticeLayout";
import { paintCandyBackdrop } from "./candyBackdrop";
import { addCandyGuide, addCandySparkles, addCandyWordmark, drawCandyPlate } from "./candyPopupKit";
import { COUPON_TONE as TONE } from "./couponPopupLayout";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { RouletteSpinButton } from "./RouletteSpinButton";
import { TextInputField } from "./TextInputField";
import { pressIn, pressOut } from "./pressFeedback";
import { shrinkTextToWidth } from "./textFit";
import { textStyle } from "./theme";

const FEEDBACK_GUIDE = "dodo";
/** 맨 위의 굵은 제목 글자. 어느 언어에서나 같은 표식이라 번역하지 않는다. */
const FEEDBACK_WORDMARK = "FEEDBACK";
/** 첫 피드백 감사 선물 — 지급은 서버(`submit_feedback`)가 대상 우편으로 한다. 이 값은 보여 주기만 한다. */
export const FEEDBACK_REWARD_GEMS = 500;

export interface FeedbackPopupOptions {
  /** 창이 닫힌 뒤(보냈든 미뤘든) 한 번. 로비는 여기서 사전예약 안내를 잇는다. */
  onClosed?: () => void;
}

function feedbackErrorKey(error: SupportError): TextKey {
  return `support.error.${error}` as TextKey;
}

/**
 * 도디가 받아 적는 피드백 창. 글은 문의 표의 「피드백」 종류로 쌓여 운영 콘솔 문의 목록이 그대로 읽는다.
 * 첫 피드백만 젬 500을 그 계정의 우편으로 받는다 — 판정과 지급은 서버가 하고, 이 창은 지갑을 바꾸지 않는다.
 * 닫기는 판 밖 누르기·우하단 뒤로가기·「다음에 할게요」 셋이다.
 */
export function openFeedbackPopup(scene: Phaser.Scene, layer: PopupLayer, options: FeedbackPopupOptions = {}): void {
  let pending = false, disposed = false, notified = false, sent = false;
  const animate = motionPolicy(session.settings).nonEssentialDistanceFactor > 0;
  const closed = (): void => { if (notified) return; notified = true; options.onClosed?.(); };
  layer.open({ width: L.width, height: L.height, title: t("feedback.title"), dim: true, closeOnBackdrop: true, backButton: true, canClose: () => !pending,
    // 보낸 뒤에는 감사 창이 이어 서므로, 그 창이 닫힐 때 알린다.
    onClose: () => { if (!sent) closed(); } }, (body, close) => {
    body.once(Phaser.GameObjects.Events.DESTROY, () => { disposed = true; });
    paintCandyBackdrop(scene, body, { width: L.width, height: L.height, top: L.backdrop.top, bottom: L.backdrop.bottom, glowY: L.wordmark.y, loot: L.loot }, animate);
    addCandyWordmark(scene, body, FEEDBACK_WORDMARK, L.wordmark, animate);
    addCandySparkles(scene, body, L.sparkles, animate);
    addCandyGuide(scene, body, { relicId: FEEDBACK_GUIDE, sd: L.sd, nameY: L.nameY, bubble: L.bubble, greeting: t("feedback.greeting"), greetingSize: 26 }, animate);

    // 감사 선물 줄 — 받기 전에는 젬 그림과 수, 이미 받았으면 고마움만 말한다.
    const { reward } = L;
    body.add(drawCandyPlate(scene, 0, reward.y, reward.width, reward.height, reward.height / 2, 7, 5, 0x7ddbb4));
    const gem = scene.add.image(0, reward.y, CURRENCY_ICON_BY_WALLET.gems).setDisplaySize(reward.gem, reward.gem);
    const rewardText = scene.add.text(0, reward.y, "", textStyle({ role: "display", size: 28, color: TONE.inkText })).setOrigin(0, .5);
    body.add([gem, rewardText]);
    const paintReward = (rewarded: boolean): void => {
      if (disposed) return;
      gem.setVisible(!rewarded);
      rewardText.setText(rewarded ? t("feedback.rewardDone") : t("feedback.reward", { amount: FEEDBACK_REWARD_GEMS.toLocaleString() }));
      rewardText.setScale(1);
      shrinkTextToWidth(rewardText, reward.width - (rewarded ? 70 : 150));
      const span = rewarded ? rewardText.displayWidth : reward.gem + 14 + rewardText.displayWidth;
      gem.x = -span / 2 + reward.gem / 2;
      rewardText.x = rewarded ? -span / 2 : gem.x + reward.gem / 2 + 14;
    };
    paintReward(false);
    void supportApi().feedbackRewarded().then((result) => { if (result.ok) paintReward(result.value); }, reportCatch("feedback.status"));

    // 글 카드.
    const { card } = L;
    body.add(drawCandyPlate(scene, 0, card.y, card.width, card.height, card.radius, card.rim, card.outline));
    const error = scene.add.text(0, L.errorY, "", textStyle({ role: "emphasis", size: 25, color: TONE.danger, align: "center", wrap: card.width })).setOrigin(.5).setStroke("#ffffff", 6);
    let submit: RouletteSpinButton | undefined;
    const field = new TextInputField(scene, 0, card.y, { ...L.field,
      value: "", maxGlyphs: L.maxGlyphs, ariaLabel: t("feedback.title"), fontSize: 28, multiline: true, placeholder: t("feedback.placeholder"),
      palette: { fill: 0xffffff, fillAlpha: 1, ink: TONE.inkText, placeholder: TONE.placeholder, accent: 0x7ddbb4 },
      onChange: (value) => { error.setText(""); submit?.setEnabled(!pending && value.trim().length > 0); },
    });
    // 피드백이 없어도 응원 한 줄이면 된다 — 회색으로 작게, 부담 없이.
    const cheer = scene.add.text(0, L.cheerY, t("feedback.cheer"), textStyle({ role: "body", size: 24, color: "#8b8794", align: "center", wrap: card.width - 20, lineSpacing: 6 })).setOrigin(.5);
    body.add([field, cheer, error]);

    submit = new RouletteSpinButton(scene, 0, L.submitY, { ...L.submit,
      label: t("feedback.submit"),
      onClick: () => {
        const text = field.value.trim();
        if (pending || disposed || text.length === 0) return;
        pending = true; submit!.setEnabled(false); field.blur();
        void supportApi().submitFeedback(text).then((result) => {
          pending = false;
          if (disposed) return;
          if (!result.ok) { error.setText(t(feedbackErrorKey(result.error))); submit!.setEnabled(true); return; }
          sent = true;
          close();
          layer.confirm({
            title: t("feedback.sent.title"),
            message: t(result.value.rewarded ? "feedback.sent.rewarded" : "feedback.sent.body", { amount: FEEDBACK_REWARD_GEMS.toLocaleString() }),
            confirmLabel: t("settings.action.confirm"), cancelLabel: false, onCancel: closed,
          }, closed);
          if (result.value.rewarded) void notificationManager.refresh().catch(reportCatch("feedback.notify"));
        }).catch(() => {
          pending = false;
          if (disposed) return;
          error.setText(t("support.error.network")); submit!.setEnabled(true);
        });
      },
    });
    submit.setEnabled(false);
    body.add(submit);

    // 「다음에 할게요」 — 밑줄 글자 링크. 판 밖 누르기와 같이 닫는다.
    const later = scene.add.text(0, L.laterY, t("feedback.later"), textStyle({ role: "display", size: 27, color: TONE.soft })).setOrigin(.5);
    const underline = scene.add.rectangle(0, L.laterY + later.height / 2 + 2, later.width, 3, TONE.rim, 1);
    const laterHit = scene.add.rectangle(0, L.laterY, L.laterHit.width, L.laterHit.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    laterHit.on("pointerdown", () => pressIn(later));
    laterHit.on("pointerout", () => pressOut(later, "normal", { pop: false }));
    laterHit.on("pointerup", () => { pressOut(later); if (!pending) close(); });
    body.add([later, underline, laterHit]);
  });
}
