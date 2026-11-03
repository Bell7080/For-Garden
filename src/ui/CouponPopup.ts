import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { couponCodeReady, type CouponError } from "../api/CouponApi";
import { couponApi } from "../managers/CouponManager";
import { notificationManager } from "../managers/NotificationManager";
import { getRelic } from "../data/relics";
import { sdAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { openCouponPage } from "../scenes/policyNavigation";
import { COUPON_POPUP as L, COUPON_TONE as TONE } from "./couponPopupLayout";
import { drawGlyph } from "./glyphs";
import { paintCouponBackdrop } from "./couponBackdrop";
import { SPARKLE_TEXTURE, ensureSparkleTexture } from "./WelcomeBannerCast";
import { RouletteSpinButton } from "./RouletteSpinButton";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import type { PopupLayer } from "./PopupLayer";
import { pressIn, pressOut } from "./pressFeedback";
import { addSdFootShadow } from "./SdFootShadow";
import { TextInputField } from "./TextInputField";
import { startPuppetHop } from "./puppetHop";
import { textStyle } from "./theme";
import { logError } from "../managers/ErrorReporter";

const COUPON_GUIDE = "torika";
const COUPON_MAX_GLYPHS = 40;
/** 창 맨 위의 굵은 제목 글자. 「RESOURCE」처럼 어느 언어에서나 같은 표식이라 번역하지 않는다. */
const COUPON_WORDMARK = "COUPON";

export function couponErrorKey(error: CouponError): TextKey {
  return `coupon.error.${error}` as TextKey;
}

/** 글자 높이를 따라 색이 흐르게 칠한다. */
function paintGradient(text: Phaser.GameObjects.Text, stops: readonly [string, string, string]): void {
  const gradient = text.context.createLinearGradient(0, 0, 0, text.height);
  gradient.addColorStop(0, stops[0]);
  gradient.addColorStop(0.55, stops[1]);
  gradient.addColorStop(1, stops[2]);
  text.setFill(gradient);
}

/** 굵은 외곽선 + 제 색 테 + 크림 면의 말랑한 판 — 돌림판 버튼과 같은 장난감 결. */
function drawCandyPlate(scene: Phaser.Scene, x: number, y: number, width: number, height: number, radius: number, rim: number, outline: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  g.fillStyle(0x000000, 0.18).fillRoundedRect(-width / 2 + 6, -height / 2 + 12, width, height, radius);
  g.fillStyle(TONE.ink, 1).fillRoundedRect(-width / 2 - outline, -height / 2 - outline, width + outline * 2, height + outline * 2, radius + outline);
  g.fillStyle(TONE.rim, 1).fillRoundedRect(-width / 2, -height / 2, width, height, radius);
  g.fillStyle(TONE.cream, 1).fillRoundedRect(-width / 2 + rim, -height / 2 + rim, width - rim * 2, height - rim * 2, radius - rim);
  g.fillStyle(0xffffff, 0.85).fillRoundedRect(-width / 2 + radius * 0.8, -height / 2 + rim + 8, width - radius * 1.6, 8, 4);
  return g;
}

/**
 * 토리카가 맞아 주는 쿠폰 등록창. 코드는 서버 경계(`couponApi().redeem`)만 지나고, 보상은 우편함으로 간다 —
 * 이 창은 지갑을 바꾸지 않는다. 등록이 끝나면 창을 닫고 영수증을 띄운 뒤 우편 점을 다시 읽는다.
 *
 * 생김새는 가챠·이벤트 판과 같은 **밝은 사탕 결**이다. 그림 대신 굵은 COUPON 글자가 무엇을 하는 창인지
 * 먼저 말하고, 받을 것(젬·골드·치즈케이크)은 배경 가장자리에만 흩어진다. 토리카를 누르면 톡 뛰며 반짝인다.
 * 움직임 줄이기에서는 모두 멈춘 채 선다.
 *
 * 홈페이지 길을 위해 창이 열릴 때 연결 티켓을 미리 받아 둔다. 누르는 순간 받으면 그 사이 손짓이 끊겨
 * 브라우저가 새 창을 막는다.
 */
export function openCouponPopup(scene: Phaser.Scene, layer: PopupLayer): void {
  let pending = false, disposed = false, ticket: string | null = null;
  let figure: PuppetCreature | undefined;
  let hop: Phaser.Tweens.Tween | undefined;
  let shadow: Phaser.GameObjects.Container | undefined;
  const animate = motionPolicy(session.settings).nonEssentialDistanceFactor > 0;
  const cleanup = (): void => {
    if (disposed) return;
    disposed = true;
    hop?.stop(); figure?.destroy(); shadow?.destroy();
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup);
  };
  void couponApi().createWebTicket().then((result) => { if (result.ok) ticket = result.value; });
  layer.open({ width: L.width, height: L.height, title: t("coupon.title"), dim: true, closeOnBackdrop: true, backButton: true, canClose: () => !pending }, (body, close) => {
    body.once(Phaser.GameObjects.Events.DESTROY, cleanup);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    const depth = (body.parentContainer?.depth ?? 0) + 1;
    ensureSparkleTexture(scene);
    paintCouponBackdrop(scene, body, animate);

    // 굵은 제목 글자 — 아래로 떨어지는 그림자 + 짙은 자두빛 획 + 흐르는 색. 숨 쉬듯 살짝 부푼다.
    const { wordmark } = L;
    const markStyle = textStyle({ role: "display", size: wordmark.size });
    const mark = scene.add.container(0, wordmark.y).setAngle(wordmark.angle);
    const markShadow = scene.add.text(0, wordmark.shadowY, COUPON_WORDMARK, markStyle).setOrigin(.5).setColor(TONE.inkText).setStroke(TONE.inkText, wordmark.stroke).setLetterSpacing(4);
    const markFace = scene.add.text(0, 0, COUPON_WORDMARK, markStyle).setOrigin(.5).setStroke(TONE.inkText, wordmark.stroke).setLetterSpacing(4);
    paintGradient(markFace, wordmark.gradient);
    mark.add([markShadow, markFace]);
    body.add(mark);
    if (animate) scene.tweens.add({ targets: mark, scale: 1.04, duration: 1100, ease: "Sine.InOut", yoyo: true, repeat: -1 });

    for (const spot of L.sparkles) {
      const star = scene.add.image(spot.x, spot.y, SPARKLE_TEXTURE).setTint(spot.color).setDisplaySize(spot.size, spot.size);
      body.add(star);
      const scale = star.scaleX;
      if (!animate) { star.setAlpha(0.7); continue; }
      star.setAlpha(0).setScale(scale * 0.3);
      scene.tweens.add({ targets: star, alpha: 1, scale, angle: 45, duration: 700, yoyo: true, ease: "Sine.InOut", delay: spot.delay, repeat: -1, repeatDelay: 500 });
    }

    // 말풍선: 흰 면 + 분홍 테 + 자두빛 외곽선, 꼬리는 토리카 쪽.
    const { bubble } = L;
    const bubbleBox = scene.add.container(bubble.x, bubble.y);
    const tail = scene.add.graphics();
    const tx = -bubble.width / 2;
    tail.fillStyle(TONE.ink, 1).fillTriangle(tx + 12, -14, tx - bubble.tail - 9, 18, tx + 12, 40);
    tail.fillStyle(TONE.rim, 1).fillTriangle(tx + 12, -6, tx - bubble.tail, 18, tx + 12, 32);
    bubbleBox.add([tail, drawCandyPlate(scene, 0, 0, bubble.width, bubble.height, bubble.radius, bubble.rim, 5)]);
    bubbleBox.add(scene.add.text(0, 2, t("coupon.greeting"),
      textStyle({ role: "display", size: 30, color: TONE.inkText, align: "center", wrap: bubble.width - 60, lineSpacing: 10 })).setOrigin(.5));
    body.add(bubbleBox);
    if (animate) scene.tweens.add({ targets: bubbleBox, y: bubble.y - 6, duration: 1500, ease: "Sine.InOut", yoyo: true, repeat: -1 });

    body.add(scene.add.text(L.sd.x, L.name.y, getRelic(COUPON_GUIDE).name,
      textStyle({ role: "display", size: 26, color: "#ffffff" })).setOrigin(.5).setStroke(TONE.inkText, 7));
    const guideHit = scene.add.rectangle(L.sd.x, L.sd.groundY - L.sd.height / 2, L.sd.height * 0.7, L.sd.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    guideHit.on("pointerup", () => {
      if (!figure || disposed) return;
      hop?.stop();
      hop = startPuppetHop(scene, figure, 0, { once: true });
      for (let index = 0; index < 3; index += 1) {
        const burst = scene.add.image(L.sd.x + (index - 1) * 70, L.sd.groundY - L.sd.height * 0.8 - (index % 2) * 30, SPARKLE_TEXTURE)
          .setTint(index === 1 ? 0xfff3a6 : 0xffffff).setDisplaySize(40, 40).setAlpha(0);
        body.add(burst);
        scene.tweens.add({ targets: burst, alpha: 1, y: burst.y - 30, angle: 90, duration: 260, yoyo: true, delay: index * 70, onComplete: () => burst.destroy() });
      }
    });
    body.add(guideHit);
    void spawnPuppet(scene, sdAssetFor(COUPON_GUIDE), {
      x: body.x + L.sd.x, groundY: body.y + L.sd.groundY, height: L.sd.height, depth,
    }).then((spawned) => {
      if (disposed) { spawned.destroy(); return; }
      figure = spawned;
      figure.setName("coupon-guide");
      figure.disableInteractive();
      shadow = addSdFootShadow(scene, body.x + L.sd.x, body.y + L.sd.groundY, L.sd.shadowWidth).setDepth(depth - .1);
      hop = startPuppetHop(scene, figure, 0, { once: true });
    }).catch((error) => logError("puppet.display", "쿠폰 안내 SD 표시 실패", error));

    // 코드 카드.
    const { card } = L;
    body.add(drawCandyPlate(scene, 0, card.y, card.width, card.height, card.radius, card.rim, card.outline));
    body.add(scene.add.text(-L.field.width / 2, card.y + L.labelY, t("coupon.field"),
      textStyle({ role: "display", size: 30, color: TONE.inkText })).setOrigin(0, .5));
    const error = scene.add.text(0, L.errorY, "", textStyle({ role: "emphasis", size: 26, color: TONE.danger, align: "center", wrap: card.width })).setOrigin(.5).setStroke("#ffffff", 6);
    let submit: RouletteSpinButton | undefined;
    const field = new TextInputField(scene, 0, card.y + L.fieldY, { ...L.field,
      value: "", maxGlyphs: COUPON_MAX_GLYPHS, ariaLabel: t("coupon.field"), fontSize: 38, placeholder: "XXXX-XXXX-XXXX", autocomplete: "off",
      palette: { fill: TONE.fieldFill, fillAlpha: 1, ink: TONE.inkText, placeholder: TONE.placeholder, accent: TONE.fieldAccent },
      onChange: (value) => {
        // 코드는 대문자로만 발급된다 — 소문자로 적어도 보이는 글자가 곧 등록될 글자가 되게 맞춘다.
        const upper = value.toUpperCase();
        if (upper !== value) field.setValue(upper);
        error.setText("");
        submit?.setEnabled(!pending && couponCodeReady(upper));
      },
    });
    body.add([field, error]);
    const notice = scene.add.text(0, L.noticeY, t("coupon.notice"),
      textStyle({ role: "emphasis", size: 25, color: TONE.soft, align: "center", wrap: card.width })).setOrigin(.5);
    const mailSize = 30, mailGap = 12;
    notice.x = (mailSize + mailGap) / 2;
    body.add([drawGlyph(scene, "mail", notice.x - notice.width / 2 - mailGap - mailSize / 2, L.noticeY, mailSize, TONE.ink, 0.7, 3), notice]);

    submit = new RouletteSpinButton(scene, 0, L.submitY, { ...L.submit,
      label: t("coupon.submit"),
      onClick: () => {
        if (pending || disposed || !couponCodeReady(field.value)) return;
        pending = true; submit!.setEnabled(false); field.blur();
        void couponApi().redeem(field.value).then((result) => {
          pending = false;
          if (disposed) return;
          if (!result.ok) { error.setText(t(couponErrorKey(result.error))); submit!.setEnabled(true); return; }
          close();
          layer.confirm({ title: t("coupon.done.title"), message: t("coupon.done.body", { name: result.value.name }), confirmLabel: t("settings.action.confirm"), cancelLabel: false });
          void notificationManager.refresh().catch(() => undefined);
        }).catch(() => {
          pending = false;
          if (disposed) return;
          error.setText(t("coupon.error.network")); submit!.setEnabled(true);
        });
      },
    });
    submit.setEnabled(false);
    body.add(submit);

    // 홈페이지 길: 같은 계정의 UID·닉네임이 채워진 쿠폰 페이지가 열린다. 지구 표식 + 밑줄로 링크임을 말한다.
    const web = scene.add.container(0, L.webY);
    const webLabel = scene.add.text(0, 0, t("coupon.web"), textStyle({ role: "display", size: 27, color: TONE.inkText })).setOrigin(.5);
    const globeSize = 30, globeGap = 12;
    webLabel.x = (globeSize + globeGap) / 2;
    const globe = drawGlyph(scene, "globe", webLabel.x - webLabel.width / 2 - globeGap - globeSize / 2, 0, globeSize, TONE.ink, 1, 3);
    const underline = scene.add.rectangle(webLabel.x, webLabel.height / 2 + 4, webLabel.width, 3, TONE.rim, 1);
    web.add([globe, webLabel, underline]);
    const webHit = scene.add.rectangle(0, L.webY, L.webHit.width, L.webHit.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    webHit.on("pointerdown", () => pressIn(web));
    webHit.on("pointerout", () => pressOut(web, "normal", { pop: false }));
    webHit.on("pointerup", () => { pressOut(web); if (!pending) openCouponPage(ticket); });
    body.add([web, webHit]);
  });
}
