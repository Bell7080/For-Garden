import Phaser from "phaser";
import { t } from "../i18n";
import { TutorialSpotlight } from "./TutorialSpotlight";

type Rect = { x: number; y: number; width: number; height: number };
/** 실제 입력 대상의 수명을 따라간다. 다른 창이 가리면 걷고 돌아오면 다시 가리킨다. */
export function followTutorialTarget(scene: Phaser.Scene, options: {
  enabled: () => boolean; rect: () => Rect | undefined; text: () => string;
  blocked?: () => boolean; onSkip?: () => void;
}): () => void {
  let stopped = false, spotlight: TutorialSpotlight | undefined, signature = "";
  let timer: Phaser.Time.TimerEvent | undefined;
  const clear = () => { spotlight?.destroy(); spotlight = undefined; signature = ""; };
  const stop = () => { stopped = true; timer?.remove(false); clear(); };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
  const poll = () => {
    if (stopped || !scene.scene.isActive()) return;
    if (!options.enabled()) { stop(); return; }
    const rect = options.blocked?.() ? undefined : options.rect();
    if (!rect) clear();
    else {
      const text = options.text();
      const next = JSON.stringify([rect.x, rect.y, rect.width, rect.height, text]);
      if (next !== signature) {
        clear(); signature = next;
        spotlight = new TutorialSpotlight(scene, { rect, text, side: rect.y < 700 ? "below" : "above", onSkip: options.onSkip, skipLabel: t("tutorial.skip") });
      }
    }
    timer = scene.time.delayedCall(250, poll);
  };
  timer = scene.time.delayedCall(700, poll);
  return stop;
}
