import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { t } from "../i18n";
import { TutorialSpotlight } from "./TutorialSpotlight";

type Rect = { x: number; y: number; width: number; height: number };
/** 실제 입력 대상의 수명을 따라간다. 다른 창이 가리면 걷고 돌아오면 다시 가리킨다. */
export function followTutorialTarget(scene: Phaser.Scene, options: {
  enabled: () => boolean; rect: () => Rect | undefined; text: () => string;
  blocked?: () => boolean; onSkip?: () => void;
}): () => void {
  let stopped = false, spotlight: TutorialSpotlight | undefined, signature = "";
  let waiting: Phaser.GameObjects.Rectangle | undefined;
  const clear = () => { spotlight?.destroy(); spotlight = undefined; signature = ""; };
  const stop = () => { stopped = true; scene.events.off(Phaser.Scenes.Events.PRE_UPDATE, poll); scene.events.off(Phaser.Scenes.Events.SHUTDOWN, stop); clear(); waiting?.destroy(); waiting = undefined; };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
  const poll = () => {
    if (stopped || !scene.scene.isActive()) return;
    if (!options.enabled()) { stop(); return; }
    const modal = options.blocked?.() === true;
    const rect = modal ? undefined : options.rect();
    if (!rect) {
      clear();
      // 대기 중에도 원래 화면은 잠근다. 열린 팝업은 이 막 위에서 정상 입력을 받는다.
      waiting ??= scene.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, 0, 0).setInteractive();
      waiting.setDepth(modal ? 999 : 6000);
    }
    else {
      waiting?.destroy(); waiting = undefined;
      const text = options.text();
      const next = JSON.stringify([rect.x, rect.y, rect.width, rect.height, text]);
      if (next !== signature) {
        clear(); signature = next;
        spotlight = new TutorialSpotlight(scene, { rect, text, side: rect.y < 700 ? "below" : "above", onSkip: options.onSkip, skipLabel: t("tutorial.skip") });
      }
    }
  };
  // 생성 직후와 매 프레임 갱신해 안내 사이의 입력 공백을 없앤다.
  scene.events.on(Phaser.Scenes.Events.PRE_UPDATE, poll);
  // 팝업 본문을 조립하는 중에는 isOpen이 아직 false일 수 있어 첫 프레임에 다시 확인한다.
  if (options.enabled()) poll();
  return stop;
}
