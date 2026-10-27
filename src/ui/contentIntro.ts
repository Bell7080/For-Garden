import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import type { ContentIntroId } from "../core/tutorial";
import { tutorialManager } from "../managers/TutorialManager";
import { anyPopupOpen, PopupLayer } from "./PopupLayer";

/**
 * 콘텐츠 첫 방문 안내 — 처음 들어온 화면에서 한 번만 뜨는 짧은 쪽지.
 *
 * 첫 플레이 튜토리얼이 끝나기 전에는 뜨지 않고(진행 중인 안내와 겹치지 않게), 다른 팝업이 떠 있으면 비는 순간까지
 * 기다린다. 뜨는 순간 본 것으로 남겨, 확인 전에 나가도 같은 쪽지가 되풀이되지 않는다.
 */
export function showContentIntro(scene: Phaser.Scene, id: ContentIntroId): void {
  if (!tutorialManager.shouldShowIntro(id)) return;
  let stopped = false;
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { stopped = true; });
  const attempt = (): void => {
    if (stopped || !scene.scene.isActive() || !tutorialManager.shouldShowIntro(id)) return;
    if (anyPopupOpen()) { scene.time.delayedCall(600, attempt); return; }
    void tutorialManager.markIntroSeen(id);
    new PopupLayer(scene, 2650).confirm({
      title: t("intro.title"),
      message: t(`intro.${id}` as TextKey),
      confirmLabel: t("intro.confirm"),
      cancelLabel: false,
    });
  };
  scene.time.delayedCall(800, attempt);
}
