import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import type { PopupLayer } from "./PopupLayer";
import { BETA_POPUP as L } from "./candyNoticeLayout";
import { paintCandyBackdrop } from "./candyBackdrop";
import { addCandyGuide, addCandySparkles, addCandyWordmark, drawCandyPlate } from "./candyPopupKit";
import { COUPON_TONE as TONE } from "./couponPopupLayout";
import { RouletteSpinButton } from "./RouletteSpinButton";
import { SPARKLE_TEXTURE, ensureSparkleTexture } from "./WelcomeBannerCast";
import { fitTextToBox } from "./textFit";
import { textStyle } from "./theme";

const BETA_GUIDE = "parua";
/** 맨 위의 굵은 제목 글자 — 정식 베타보다 앞선 시험 기간이라 「PRE-BETA」다. 번역하지 않는다. */
const BETA_WORDMARK = "PRE-BETA";
/** 안내 줄. 베타 전 테스트라는 것 → 서버 지연·큰 패치 → 기록 초기화 → 알리는 길 순이다. */
const BETA_LINES: readonly TextKey[] = ["beta.line.stage", "beta.line.unstable", "beta.line.reset", "beta.line.report"];

/**
 * 첫 닉네임을 정한 뒤 한 번 서는 안내 — 지금은 정식 베타도 아닌 「베타 전 테스트」 기간이라는 것을 파루아가 조심스레 알린다.
 * 확인·판 밖 누르기·우하단 뒤로가기 어느 쪽으로 닫아도 `onClosed`가 한 번 불린다.
 */
export function openBetaNoticePopup(scene: Phaser.Scene, layer: PopupLayer, options: { onClosed?: () => void } = {}): void {
  const animate = motionPolicy(session.settings).nonEssentialDistanceFactor > 0;
  layer.open({ width: L.width, height: L.height, title: t("beta.title"), dim: true, closeOnBackdrop: true, backButton: true, onClose: options.onClosed }, (body, close) => {
    paintCandyBackdrop(scene, body, { width: L.width, height: L.height, top: L.backdrop.top, bottom: L.backdrop.bottom, glowY: L.wordmark.y }, animate);
    addCandyWordmark(scene, body, BETA_WORDMARK, L.wordmark, animate);
    addCandySparkles(scene, body, L.sparkles, animate);
    addCandyGuide(scene, body, { relicId: BETA_GUIDE, sd: L.sd, nameY: L.nameY, bubble: L.bubble, greeting: t("beta.greeting"), greetingSize: 26 }, animate);

    const { card } = L;
    body.add(drawCandyPlate(scene, 0, card.y, card.width, card.height, card.radius, card.rim, card.outline, 0xc9a6ff));
    ensureSparkleTexture(scene);
    const left = -card.width / 2 + card.padX;
    const textX = left + card.bullet + 18;
    const room = card.width / 2 - card.padX - textX;
    const lines = BETA_LINES.map((key, index) => {
      // 첫 줄(지금이 어떤 기간인지)만 이름표 굵기로 세운다.
      const style = index === 0
        ? textStyle({ role: "display", size: 27, color: "#7a3f9e", lineSpacing: 6 })
        : textStyle({ role: "emphasis", size: 27, color: TONE.inkText, lineSpacing: 6 });
      const line = scene.add.text(textX, 0, t(key), style).setOrigin(0, 0);
      fitTextToBox(line, { width: room });
      return line;
    });
    // 줄을 실제 높이로 쌓아 카드 가운데에 모은다. 넘치면 모두 함께 한 단계씩 줄인다.
    const inner = card.height - 60;
    let total = lines.reduce((sum, line) => sum + line.displayHeight, 0) + card.lineGap * (lines.length - 1);
    if (total > inner) {
      for (const line of lines) fitTextToBox(line, { width: room, height: line.displayHeight * inner / total });
      total = lines.reduce((sum, line) => sum + line.displayHeight, 0) + card.lineGap * (lines.length - 1);
    }
    let y = card.y - total / 2;
    lines.forEach((line, index) => {
      line.y = y;
      const star = scene.add.image(left + card.bullet / 2, y + 18, SPARKLE_TEXTURE).setTint(index === 0 ? 0xb07cff : 0xff8fb8).setDisplaySize(card.bullet, card.bullet);
      body.add([star, line]);
      y += line.displayHeight + card.lineGap;
    });

    body.add(new RouletteSpinButton(scene, 0, L.okY, { ...L.ok, label: t("beta.ok"), onClick: () => close() }));
  });
}
