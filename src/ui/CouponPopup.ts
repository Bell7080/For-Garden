import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { couponCodeReady, type CouponError } from "../api/CouponApi";
import { couponApi } from "../managers/CouponManager";
import { notificationManager } from "../managers/NotificationManager";
import { getRelic } from "../data/relics";
import { sdAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { openCouponPage } from "../scenes/policyNavigation";
import { Button } from "./Button";
import { COUPON_POPUP as L } from "./couponPopupLayout";
import { drawLayer, slantedRect } from "./holo";
import { UI_ICON } from "./icons";
import type { PopupLayer } from "./PopupLayer";
import { pressIn, pressOut } from "./pressFeedback";
import { addSdFootShadow } from "./SdFootShadow";
import { TextInputField } from "./TextInputField";
import { startPuppetHop } from "./puppetHop";
import { COLOR, textStyle } from "./theme";

const COUPON_GUIDE = "torika";
const COUPON_MAX_GLYPHS = 40;

export function couponErrorKey(error: CouponError): TextKey {
  return `coupon.error.${error}` as TextKey;
}

/**
 * 토리카가 맞아 주는 쿠폰 등록창. 코드는 서버 경계(`couponApi().redeem`)만 지나고, 보상은 우편함으로 간다 —
 * 이 창은 지갑을 바꾸지 않는다. 등록이 끝나면 창을 닫고 영수증을 띄운 뒤 우편 점을 다시 읽는다.
 *
 * 홈페이지 길을 위해 창이 열릴 때 연결 티켓을 미리 받아 둔다. 누르는 순간 받으면 그 사이 손짓이 끊겨
 * 브라우저가 새 창을 막는다.
 */
export function openCouponPopup(scene: Phaser.Scene, layer: PopupLayer): void {
  let pending = false, disposed = false, ticket: string | null = null;
  let figure: PuppetCreature | undefined;
  let hop: Phaser.Tweens.Tween | undefined;
  let shadow: Phaser.GameObjects.Container | undefined;
  const cleanup = (): void => {
    if (disposed) return;
    disposed = true;
    hop?.stop(); figure?.destroy(); shadow?.destroy();
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup);
  };
  void couponApi().createWebTicket().then((result) => { if (result.ok) ticket = result.value; });
  layer.open({ width: L.width, height: L.height, title: t("coupon.title"), dim: true, closeOnBackdrop: true, canClose: () => !pending }, (body, close) => {
    body.once(Phaser.GameObjects.Events.DESTROY, cleanup);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    const depth = (body.parentContainer?.depth ?? 0) + 1;

    // 말풍선: 판보다 한 톤 밝은 유리 + SD 쪽으로 내민 꼬리.
    const { bubble } = L;
    const bubbleShape = slantedRect(bubble.width, bubble.height, 18);
    body.add(drawLayer(scene, bubble.x, bubble.y, bubbleShape, { fill: 0x23303f, alpha: 0.96 }));
    const tail = scene.add.triangle(bubble.x - bubble.width / 2 + 6, bubble.y + 26, 0, 0, bubble.tail, -bubble.tail / 2, bubble.tail, bubble.tail / 2, 0x23303f, 0.96).setOrigin(1, .5);
    body.add(tail);
    body.add(scene.add.text(bubble.x, bubble.y, t("coupon.greeting"),
      textStyle({ role: "emphasis", size: 28, color: COLOR.ink, align: "center", wrap: bubble.width - 60, lineSpacing: 8 })).setOrigin(.5));

    // 토리카 머리 위에서 쿠폰 한 장이 둥실 떠 있다.
    const ticketArt = scene.add.image(L.ticket.x, L.ticket.y, UI_ICON.ticket).setDisplaySize(L.ticket.size, L.ticket.size).setAngle(-12);
    body.add(ticketArt);
    scene.tweens.add({ targets: ticketArt, y: L.ticket.y - 12, angle: -4, duration: 1100, ease: "Sine.easeInOut", yoyo: true, repeat: -1 });

    body.add(scene.add.text(L.sd.x, L.sd.groundY + 34, getRelic(COUPON_GUIDE).name,
      textStyle({ role: "body", size: 22, color: COLOR.accentText })).setOrigin(.5));
    void spawnPuppet(scene, sdAssetFor(COUPON_GUIDE), {
      x: body.x + L.sd.x, groundY: body.y + L.sd.groundY, height: L.sd.height, depth,
    }).then((spawned) => {
      if (disposed) { spawned.destroy(); return; }
      figure = spawned;
      figure.setName("coupon-guide");
      figure.disableInteractive();
      shadow = addSdFootShadow(scene, body.x + L.sd.x, body.y + L.sd.groundY, L.sd.shadowWidth).setDepth(depth - .1);
      hop = startPuppetHop(scene, figure, 0, { once: true });
    }).catch((error) => console.warn("쿠폰 안내 SD 표시 실패", error));

    body.add(scene.add.text(-L.field.width / 2, L.fieldLabelY, t("coupon.field"),
      textStyle({ role: "emphasis", size: 28, color: COLOR.ink })).setOrigin(0, .5));
    const error = scene.add.text(-L.field.width / 2, L.errorY, "", textStyle({ role: "body", size: 23, color: COLOR.dangerText, wrap: L.field.width })).setOrigin(0, .5);
    let submit: Button | undefined;
    const field = new TextInputField(scene, 0, L.fieldY, { ...L.field,
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
    body.add(scene.add.text(0, L.noticeY, t("coupon.notice"),
      textStyle({ role: "body", size: 24, color: COLOR.accentText, align: "center", wrap: L.field.width })).setOrigin(.5));

    submit = new Button(scene, 0, L.submitY, { ...L.submit,
      label: t("coupon.submit"), fontSize: 32, variant: "primary", art: UI_ICON.ticket,
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

    // 홈페이지 길: 같은 계정의 UID·닉네임이 채워진 쿠폰 페이지가 열린다.
    const web = scene.add.text(0, L.webY, t("coupon.web"), textStyle({ role: "emphasis", size: 25, color: COLOR.inkDim })).setOrigin(.5);
    const webHit = scene.add.rectangle(0, L.webY, L.webHit.width, L.webHit.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    webHit.on("pointerdown", () => pressIn(web));
    webHit.on("pointerout", () => pressOut(web, "normal", { pop: false }));
    webHit.on("pointerup", () => { pressOut(web); if (!pending) openCouponPage(ticket); });
    body.add([web, webHit]);
  });
}
