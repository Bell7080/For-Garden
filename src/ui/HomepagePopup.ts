import Phaser from "phaser";
import { t } from "../i18n";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { openPreregistrationPage } from "../scenes/policyNavigation";
import type { PopupLayer } from "./PopupLayer";
import { HOMEPAGE_POPUP as L } from "./candyNoticeLayout";
import { paintCandyBackdrop } from "./candyBackdrop";
import { addCandyGuide, addCandySparkles, addCandyWordmark, drawCandyPlate } from "./candyPopupKit";
import { COUPON_TONE as TONE } from "./couponPopupLayout";
import { drawGlyph } from "./glyphs";
import { RouletteSpinButton } from "./RouletteSpinButton";
import { pressIn, pressOut } from "./pressFeedback";
import { fitTextToBox } from "./textFit";
import { textStyle } from "./theme";

const HOMEPAGE_GUIDE = "torika";
/** 맨 위의 굵은 제목 글자. 어느 언어에서나 같은 표식이라 번역하지 않는다. */
const HOMEPAGE_WORDMARK = "PRE-REGISTER";

/**
 * 토리카가 사전예약 홈페이지로 이끄는 창. 버튼은 시스템 브라우저로 홈페이지의 사전예약 칸(`#register`)을 연다.
 * 로비는 피드백 창 다음에 한 번 띄우고, 환경설정 계정 탭의 「공식 홈페이지」가 언제든 다시 연다.
 */
export function openHomepagePopup(scene: Phaser.Scene, layer: PopupLayer, options: { onClosed?: () => void } = {}): void {
  const animate = motionPolicy(session.settings).nonEssentialDistanceFactor > 0;
  layer.open({ width: L.width, height: L.height, title: t("homepage.title"), dim: true, closeOnBackdrop: true, backButton: true, onClose: options.onClosed }, (body, close) => {
    paintCandyBackdrop(scene, body, { width: L.width, height: L.height, top: L.backdrop.top, bottom: L.backdrop.bottom, glowY: L.wordmark.y }, animate);
    addCandyWordmark(scene, body, HOMEPAGE_WORDMARK, L.wordmark, animate);
    addCandySparkles(scene, body, L.sparkles, animate);
    addCandyGuide(scene, body, { relicId: HOMEPAGE_GUIDE, sd: L.sd, nameY: L.nameY, bubble: L.bubble, greeting: t("homepage.greeting"), greetingSize: 26 }, animate);

    const { card } = L;
    body.add(drawCandyPlate(scene, 0, card.y, card.width, card.height, card.radius, card.rim, card.outline, 0xffc27a));
    const globeSize = 44;
    const info = scene.add.text(-card.width / 2 + 70 + globeSize, card.y, t("homepage.body"), textStyle({ role: "emphasis", size: 27, color: TONE.inkText, lineSpacing: 8 })).setOrigin(0, .5);
    fitTextToBox(info, { width: card.width - 130 - globeSize, height: card.height - 40 });
    body.add([drawGlyph(scene, "globe", -card.width / 2 + 50 + globeSize / 2, card.y, globeSize, TONE.ink, 1, 3), info]);

    body.add(new RouletteSpinButton(scene, 0, L.goY, { ...L.go, label: t("homepage.go"), onClick: () => openPreregistrationPage() }));

    const later = scene.add.text(0, L.laterY, t("homepage.later"), textStyle({ role: "display", size: 27, color: TONE.soft })).setOrigin(.5);
    const underline = scene.add.rectangle(0, L.laterY + later.height / 2 + 2, later.width, 3, TONE.rim, 1);
    const hit = scene.add.rectangle(0, L.laterY, L.laterHit.width, L.laterHit.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => pressIn(later));
    hit.on("pointerout", () => pressOut(later, "normal", { pop: false }));
    hit.on("pointerup", () => { pressOut(later); close(); });
    body.add([later, underline, hit]);
  });
}
