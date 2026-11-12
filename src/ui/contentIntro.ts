import Phaser from "phaser";
import type { ContentIntroId, GuidedIntroId, IconIntroId } from "../core/tutorial";
import { tutorialManager } from "../managers/TutorialManager";
import { CONTENT_INTRO_PAGES } from "./contentIntroPages";
import { openIconIntro } from "./IconIntroPopup";
import { anyPopupOpen, PopupLayer } from "./PopupLayer";

/**
 * 콘텐츠 첫 방문 안내 — 처음 들어온 화면에서 한 번만 뜬다.
 *
 * 첫 플레이 튜토리얼이 끝나기 전에는 뜨지 않고(진행 중인 안내와 겹치지 않게), 다른 팝업이 떠 있으면 비는 순간까지
 * 기다린다. 뜨는 순간 본 것으로 남겨, 끝까지 보기 전에 나가도 같은 안내가 되풀이되지 않는다.
 *
 * 아이콘 쪽지(`IconIntroPopup`)가 기본이고, 안내형 튜토리얼(고고학)은 `start`로 그 화면의 안내를 시작한다. 언제 뜨고
 * 언제 본 것으로 남는지는 둘이 같다 — 화면마다 첫 방문 판정을 따로 만들지 않는다.
 */
export function showContentIntro(scene: Phaser.Scene, id: IconIntroId): void;
export function showContentIntro(scene: Phaser.Scene, id: GuidedIntroId, start: () => void): void;
export function showContentIntro(scene: Phaser.Scene, id: ContentIntroId, start?: () => void): void {
  if (!tutorialManager.shouldShowIntro(id)) return;
  /*
   * **기다림은 씬 시계가 아니라 실제 시간이다.** 씬 타이머는 프레임이 돌아야 깨어나 무거운 화면(고고학 판의 안개)에서는
   * 0.8초가 십수 초로 늘어, 판을 다 파고 나서야 안내가 떴다.
   */
  let stopped = false, timer: number | undefined;
  const later = (ms: number): void => { timer = window.setTimeout(attempt, ms); };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { stopped = true; window.clearTimeout(timer); });
  const attempt = (): void => {
    if (stopped || !scene.scene.isActive() || !tutorialManager.shouldShowIntro(id)) return;
    if (anyPopupOpen()) { later(600); return; }
    void tutorialManager.markIntroSeen(id);
    if (start) { start(); return; }
    openIconIntro(scene, new PopupLayer(scene, 2650), CONTENT_INTRO_PAGES[id as IconIntroId]);
  };
  later(800);
}
