import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { couponCodeReady, type CouponError } from "../api/CouponApi";
import { couponApi } from "../managers/CouponManager";
import { notificationManager } from "../managers/NotificationManager";
import { getRelic } from "../data/relics";
import { sdAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { openCouponPage } from "../scenes/policyNavigation";
import { Button } from "./Button";
import { COUPON_POPUP as L, couponCardMainX } from "./couponPopupLayout";
import { chipPoints, drawLayer } from "./holo";
import { drawGlyph } from "./glyphs";
import { EFFECT_TEXTURE, ensureEffectTextures } from "./effectTextures";
import { SPARKLE_TEXTURE, ensureSparkleTexture } from "./WelcomeBannerCast";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { UI_ICON } from "./icons";
import type { PopupLayer } from "./PopupLayer";
import { pressIn, pressOut } from "./pressFeedback";
import { addSdFootShadow } from "./SdFootShadow";
import { TextInputField } from "./TextInputField";
import { startPuppetHop } from "./puppetHop";
import { COLOR, textStyle } from "./theme";
import { logError } from "../managers/ErrorReporter";

const COUPON_GUIDE = "torika";
const COUPON_MAX_GLYPHS = 40;

export function couponErrorKey(error: CouponError): TextKey {
  return `coupon.error.${error}` as TextKey;
}

/**
 * 토리카가 맞아 주는 쿠폰 등록창. 코드는 서버 경계(`couponApi().redeem`)만 지나고, 보상은 우편함으로 간다 —
 * 이 창은 지갑을 바꾸지 않는다. 등록이 끝나면 창을 닫고 영수증을 띄운 뒤 우편 점을 다시 읽는다.
 *
 * 생김새는 **선물 받는 자리**다: 금빛 기운 위에 토리카가 서고 쿠폰 몇 장이 둥실 떠다니며, 코드 칸은
 * 절취선이 그어진 쿠폰 한 장 안에 선다. 토리카를 누르면 톡 뛰며 반짝인다. 움직임 줄이기에서는 멈춘 채 선다.
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
    ensureEffectTextures(scene);
    ensureSparkleTexture(scene);

    // 무대: 토리카 뒤의 금빛 기운 + 반짝임 + 떠다니는 쿠폰.
    const glow = scene.add.image(L.stage.x, L.stage.y, EFFECT_TEXTURE.glow).setTint(L.stage.color).setAlpha(L.stage.alpha).setDisplaySize(L.stage.size, L.stage.size);
    body.add(glow);
    if (animate) scene.tweens.add({ targets: glow, alpha: L.stage.alpha * 0.6, duration: 1600, ease: "Sine.InOut", yoyo: true, repeat: -1 });
    const twinkle = (star: Phaser.GameObjects.Image, delay: number): void => {
      const scale = star.scaleX;
      if (!animate) { star.setAlpha(0.5); return; }
      star.setAlpha(0).setScale(scale * 0.3);
      scene.tweens.add({ targets: star, alpha: 0.95, scale, angle: 45, duration: 700, yoyo: true, ease: "Sine.InOut", delay, repeat: -1, repeatDelay: 500 });
    };
    for (const spot of L.sparkles) {
      const star = scene.add.image(spot.x, spot.y, SPARKLE_TEXTURE).setTint(spot.color).setDisplaySize(spot.size, spot.size);
      body.add(star);
      twinkle(star, spot.delay);
    }
    for (const spot of L.tickets) {
      const art = scene.add.image(spot.x, spot.y, UI_ICON.ticket).setDisplaySize(spot.size, spot.size).setAngle(spot.angle);
      body.add(art);
      if (animate) scene.tweens.add({ targets: art, y: spot.y - 14, angle: spot.angle + 8, duration: 1300, ease: "Sine.InOut", yoyo: true, repeat: -1, delay: spot.delay });
    }

    // 크림빛 말풍선: 꼬리가 왼쪽 토리카 얼굴 쪽으로 내민다. 판과 같은 깎임(왼쪽 위·오른쪽 아래)을 쓴다.
    const { bubble } = L;
    const bubbleBox = scene.add.container(bubble.x, bubble.y);
    const hw = bubble.width / 2, hh = bubble.height / 2, cut = 22;
    bubbleBox.add(drawLayer(scene, 0, 0, [
      -hw, -hh + cut, -hw + cut, -hh, hw, -hh, hw, hh - cut, hw - cut, hh, -hw, hh,
      -hw, 16, -hw - bubble.tail, 2, -hw, -20,
    ], { fill: bubble.fill, alpha: 0.98 }));
    bubbleBox.add(scene.add.text(0, 0, t("coupon.greeting"),
      textStyle({ role: "emphasis", size: 30, color: bubble.ink, align: "center", wrap: bubble.width - 60, lineSpacing: 10 })).setOrigin(.5));
    body.add(bubbleBox);
    if (animate) scene.tweens.add({ targets: bubbleBox, y: bubble.y - bubble.bob, duration: 1500, ease: "Sine.InOut", yoyo: true, repeat: -1 });

    body.add(scene.add.text(L.sd.x, L.name.y, getRelic(COUPON_GUIDE).name,
      textStyle({ role: "display", size: 24, color: COLOR.accentText })).setOrigin(.5).setStroke("#05070a", 6));
    // 토리카를 누르면 톡 뛰며 반짝인다 — 고를 것은 없고 손에 반응만 준다.
    const guideHit = scene.add.rectangle(L.sd.x, L.sd.groundY - L.sd.height / 2, L.sd.height * 0.7, L.sd.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    guideHit.on("pointerup", () => {
      if (!figure || disposed) return;
      hop?.stop();
      hop = startPuppetHop(scene, figure, 0, { once: true });
      for (const [index, spot] of L.sparkles.slice(0, 3).entries()) {
        const burst = scene.add.image(L.sd.x + (index - 1) * 70, L.sd.groundY - L.sd.height * 0.8 - (index % 2) * 30, SPARKLE_TEXTURE)
          .setTint(spot.color).setDisplaySize(spot.size * 1.3, spot.size * 1.3).setAlpha(0);
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

    // 쿠폰 한 장: 왼쪽 귀퉁이에 쿠폰 그림, 점선 절취선, 오른쪽 본판에 코드 칸.
    const { card } = L;
    const cardHalfW = card.width / 2, cardHalfH = card.height / 2, cardCut = 28;
    body.add(drawLayer(scene, 0, card.y, chipPoints(card.width, card.height, { bevel: { topLeft: cardCut, bottomRight: cardCut } }),
      { fill: card.fill, alpha: 0.96, edge: card.accent, edgeAlpha: 0.9, glow: { color: card.accent, strength: 0.16 } }));
    const perforation = -cardHalfW + card.stub;
    body.add(drawLayer(scene, 0, card.y, [
      -cardHalfW, -cardHalfH + cardCut, -cardHalfW + cardCut, -cardHalfH, perforation, -cardHalfH, perforation, cardHalfH, -cardHalfW, cardHalfH,
    ], { fill: card.accent, alpha: 0.12, shadow: false }));
    const dots = scene.add.graphics({ x: perforation, y: card.y });
    dots.fillStyle(card.accent, 0.55);
    for (let dy = -cardHalfH + 18; dy <= cardHalfH - 12; dy += 22) dots.fillPoints([{ x: 0, y: dy - 5 }, { x: 3, y: dy }, { x: 0, y: dy + 5 }, { x: -3, y: dy }], true);
    body.add(dots);
    const stubArt = scene.add.image(-cardHalfW + card.stub / 2, card.y, UI_ICON.ticket).setDisplaySize(L.stubTicket.size, L.stubTicket.size).setAngle(L.stubTicket.angle);
    body.add(stubArt);
    if (animate) scene.tweens.add({ targets: stubArt, angle: L.stubTicket.angle + 10, duration: 900, ease: "Sine.InOut", yoyo: true, repeat: -1 });

    const mainX = couponCardMainX();
    body.add(scene.add.text(mainX - L.field.width / 2, card.y + L.labelY, t("coupon.field"),
      textStyle({ role: "emphasis", size: 28, color: COLOR.accentText })).setOrigin(0, .5));
    const error = scene.add.text(0, L.errorY, "", textStyle({ role: "body", size: 24, color: COLOR.dangerText, align: "center", wrap: card.width })).setOrigin(.5);
    let submit: Button | undefined;
    const field = new TextInputField(scene, mainX, card.y + L.fieldY, { ...L.field,
      value: "", maxGlyphs: COUPON_MAX_GLYPHS, ariaLabel: t("coupon.field"), fontSize: 34, placeholder: "XXXX-XXXX-XXXX", autocomplete: "off",
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
      textStyle({ role: "body", size: 25, color: COLOR.inkDim, align: "center", wrap: card.width })).setOrigin(.5);
    const mailSize = 30, mailGap = 12;
    notice.x = (mailSize + mailGap) / 2;
    body.add([drawGlyph(scene, "mail", notice.x - notice.width / 2 - mailGap - mailSize / 2, L.noticeY, mailSize, 0xd8b978, 0.9), notice]);

    submit = new Button(scene, 0, L.submitY, { ...L.submit,
      label: t("coupon.submit"), fontSize: 34, variant: "primary", art: UI_ICON.ticket, decorDots: true,
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
    const webLabel = scene.add.text(0, 0, t("coupon.web"), textStyle({ role: "emphasis", size: 26, color: COLOR.accentText })).setOrigin(.5);
    const globeSize = 30, globeGap = 12;
    webLabel.x = (globeSize + globeGap) / 2;
    const globe = drawGlyph(scene, "globe", webLabel.x - webLabel.width / 2 - globeGap - globeSize / 2, 0, globeSize, 0xd8b978, 1);
    const underline = scene.add.rectangle(webLabel.x, webLabel.height / 2 + 4, webLabel.width, 2, 0xd8b978, 0.55);
    web.add([globe, webLabel, underline]);
    const webHit = scene.add.rectangle(0, L.webY, L.webHit.width, L.webHit.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    webHit.on("pointerdown", () => pressIn(web));
    webHit.on("pointerout", () => pressOut(web, "normal", { pop: false }));
    webHit.on("pointerup", () => { pressOut(web); if (!pending) openCouponPage(ticket); });
    body.add([web, webHit]);
  });
}
