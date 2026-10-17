import Phaser from "phaser";
import { t } from "../i18n";
import { tutorialManager } from "../managers/TutorialManager";
import type { BottomNav } from "./BottomNav";
import { anyPopupOpen, type PopupLayer } from "./PopupLayer";
import { currencyRecordToRewardItems, openRewardPopup } from "./RewardPopup";
import { TutorialSpotlight } from "./TutorialSpotlight";

/**
 * 로비가 이어 가는 튜토리얼 칸 — 도감(급여) → 선물 → 연구소(뽑기). 팝업이 떠 있는 동안에는 기다리고
 * (출석·레벨업 알림이 먼저다) 비는 순간 지금 차례인 칸 하나만 연다. 도감·연구소 안의 안내는 각 화면이 맡는다.
 */
export function startLobbyTutorial(scene: Phaser.Scene, nav: BottomNav, popups: PopupLayer): void {
  let spotlight: TutorialSpotlight | undefined;
  let stopped = false;
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { stopped = true; spotlight?.destroy(); });

  const point = (key: "relics" | "lab", text: string, skip?: () => void): void => {
    const rect = nav.tabRect(key);
    if (!rect) return;
    spotlight = new TutorialSpotlight(scene, { rect, text, side: "above", onSkip: skip, skipLabel: t("tutorial.skip") });
  };

  const step = async (): Promise<void> => {
    if (stopped || !scene.scene.isActive()) return;
    if (anyPopupOpen()) { scene.time.delayedCall(500, () => void step()); return; }
    const next = tutorialManager.lobbyStep();
    if (next === "feed") {
      point("relics", t("tutorial.lobby.relics"), () => { spotlight?.destroy(); spotlight = undefined; void tutorialManager.complete("feed").then(() => step()); });
    } else if (next === "gift") {
      const response = await tutorialManager.complete("gift");
      if (stopped) return;
      const fossil = response?.granted?.fossil ?? 0;
      if (fossil > 0) openRewardPopup(scene, popups, { title: t("tutorial.gift.title"), items: currencyRecordToRewardItems({ fossil }), onConfirm: () => void step() });
      else void step();
    } else if (next === "pull") {
      point("lab", t("tutorial.lobby.lab"), () => { spotlight?.destroy(); spotlight = undefined; void tutorialManager.complete("pull"); });
    }
  };
  scene.time.delayedCall(900, () => void step());
}
