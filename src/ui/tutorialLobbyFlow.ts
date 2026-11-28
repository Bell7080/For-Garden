import Phaser from "phaser";
import { t } from "../i18n";
import { tutorialManager } from "../managers/TutorialManager";
import { session } from "../state/session";
import type { BottomNav } from "./BottomNav";
import type { Button } from "./Button";
import { TUTORIAL_REWARDS } from "../core/tutorial";
import { formatCurrency } from "../core/formatCurrency";
import { openCuteGuide } from "./CuteGuidePopup";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { chipPoints, drawLayer } from "./holo";
import { addFramedIcon } from "./itemFrame";
import { anyPopupOpen, type PopupLayer } from "./PopupLayer";
import { currencyRecordToRewardItems, openRewardPopup } from "./RewardPopup";
import { followTutorialTarget } from "./tutorialTarget";

/** 안내·지원품은 실제 단계와 서버 영수증을 따른다. 팝업/실패 시 재시도해도 보상을 중복 지급하지 않는다. */
export function startLobbyTutorial(scene: Phaser.Scene, nav: BottomNav, popups: PopupLayer, sortie: Button): void {
  let stopped = false, giftAnnounced = false;
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { stopped = true; });
  followTutorialTarget(scene, {
    enabled: () => !stopped && tutorialManager.next() !== undefined,
    blocked: anyPopupOpen,
    passive: true,
    rect: () => {
      const step = tutorialManager.lobbyStep();
      if (step === "feed" || step === "feedLevel") return nav.tabRect("relics");
      if (step === "pull") return nav.tabRect("lab");
      if (tutorialManager.next() !== "gift" || !session.cleared.has("1-5")) return sortie.getBounds();
      return undefined;
    },
    text: () => {
      const step = tutorialManager.lobbyStep();
      return step === "feed" || step === "feedLevel" ? t("tutorial.lobby.relics") : step === "pull" ? t("tutorial.lobby.lab") : t("tutorial.lobby.sortie");
    },
  });
  const step = async (): Promise<void> => {
    if (stopped || !scene.scene.isActive() || tutorialManager.lobbyStep() !== "gift") return;
    if (anyPopupOpen()) { scene.time.delayedCall(500, () => void step()); return; }
    if (!giftAnnounced) {
      giftAnnounced = true;
      openResearchOpenGuide(scene, popups, () => void step());
      return;
    }
    const response = await tutorialManager.complete("gift");
    if (stopped) return;
    if (!response) { scene.time.delayedCall(3500, () => void step()); return; }
    const fossil = response.granted?.fossil ?? 0;
    if (fossil > 0) openRewardPopup(scene, popups, { title: t("tutorial.gift.title"), items: currencyRecordToRewardItems({ fossil }) });
  };
  scene.time.delayedCall(900, () => void step());
}

/** 연구소를 여는 안내 — 애착 렐릭이 무대에서 뛰며 받을 지원품(화석)을 미리 보여 준다. 지급은 확인 뒤 서버가 한다. */
export function openResearchOpenGuide(scene: Phaser.Scene, popups: PopupLayer, onConfirm: () => void): void {
  openCuteGuide(scene, popups, {
    title: t("intro.title"),
    tone: "lilac",
    required: true,
    confirmLabel: t("settings.action.confirm"),
    pages: [{ heading: t("tutorial.research.open.title"), body: t("tutorial.research.open.body"), icon: CURRENCY_ICON_BY_WALLET.fossil }],
    extra: {
      height: 150,
      paint: (_scene, slot, width, tone) => {
        slot.add(drawLayer(scene, 0, 0, chipPoints(width, 150, { bevel: { topLeft: 30, bottomRight: 30 } }), { fill: tone.deep, alpha: 0.72, shadow: false }));
        addFramedIcon(scene, slot, 0, 0, 116, CURRENCY_ICON_BY_WALLET.fossil, { amount: formatCurrency(TUTORIAL_REWARDS.gift?.fossil ?? 0) });
      },
    },
    onConfirm,
  });
}
