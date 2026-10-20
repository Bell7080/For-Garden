import Phaser from "phaser";
import { t } from "../i18n";
import { tutorialManager } from "../managers/TutorialManager";
import { settingsManager } from "../managers/SettingsManager";
import { session } from "../state/session";
import { drawIcon, type BottomNav } from "./BottomNav";
import { Button } from "./Button";
import { COLOR, textStyle } from "./theme";
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
    rect: () => {
      const step = tutorialManager.lobbyStep();
      if (step === "feed" || step === "feedLevel") return nav.tabRect("relics");
      if (step === "pull") return nav.tabRect("lab");
      if (tutorialManager.featureToTeach() && session.cleared.has("1-1")) return sortie.getBounds();
      return undefined;
    },
    text: () => {
      const step = tutorialManager.lobbyStep();
      return step === "feed" || step === "feedLevel" ? t("tutorial.lobby.relics") : step === "pull" ? t("tutorial.lobby.lab") : t("tutorial.lobby.sortie");
    },
  });
  const step = async (): Promise<void> => {
    if (stopped || !scene.scene.isActive() || tutorialManager.next() !== "gift") return;
    if (anyPopupOpen()) { scene.time.delayedCall(500, () => void step()); return; }
    if (!giftAnnounced) {
      giftAnnounced = true;
      popups.open({ width: 820, height: 650, title: t("tutorial.research.open.title"), hideCloseButton: true, closeOnBackdrop: false }, (body, close) => {
        const icon = drawIcon(scene, "lab", 0, -125, COLOR.accent).setScale(2);
        body.add(icon);
        if (!settingsManager.get().accessibility.reduceMotion) {
          icon.setScale(1).setAlpha(0);
          scene.tweens.add({ targets: icon, scale: 2, alpha: 1, duration: 420, ease: "Back.Out" });
        }
        body.add(scene.add.text(0, 5, t("tutorial.research.open.body"), textStyle({ role: "body", size: 30, wrap: 690, align: "center" })).setOrigin(.5));
        body.add(new Button(scene, 0, 205, { width: 520, height: 90, label: t("settings.action.confirm"), variant: "primary", onClick: () => { close(); void step(); } }));
      });
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
