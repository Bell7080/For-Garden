import Phaser from "phaser";
import { t } from "../i18n";
import type { InfoManager } from "./info";
import { TutorialSpotlight } from "./TutorialSpotlight";

/**
 * 첫 편성에서 꾹 눌러 연 정보창을 한 칸씩 짚어 주는 안내.
 *
 * 칸마다 **눌러도 아래 버튼이 눌리지 않는다** — 소개 중에 쪽지가 열리면 순서가 엉킨다. 화면 어디를 눌러도
 * 다음 칸으로 가고, 마지막 칸만 구멍이 열려 **뒤로가기**를 가리킨다. 그 칸은 테두리가 번지고 휘어진
 * 화살표가 버튼으로 내려꽂혀 "소개는 끝났고 이제 이걸 누르면 된다"를 글보다 먼저 말한다.
 * 정보창이 닫히면(뒤로가기든 다른 길이든) 안내도 걷고 `onFinish`를 부른다.
 */
export function runInfoTutorialTour(scene: Phaser.Scene, info: InfoManager, onFinish: () => void): () => void {
  let index = 0;
  let spotlight: TutorialSpotlight | undefined;
  let shown = -1;
  let stopped = false;
  // 정보창이 서는 동안 한 박자 기다린다 — 서자마자 덮으면 무엇을 연 것인지 볼 틈이 없다.
  const openedAt = scene.time.now;
  const stop = (finished: boolean): void => {
    if (stopped) return;
    stopped = true;
    scene.events.off(Phaser.Scenes.Events.PRE_UPDATE, poll);
    spotlight?.destroy();
    spotlight = undefined;
    if (finished) onFinish();
  };
  const poll = (): void => {
    if (stopped) return;
    if (!info.isOpen) { stop(true); return; }
    if (scene.time.now - openedAt < 450) return;
    const targets = info.tutorialTourTargets();
    if (index === shown) return;
    spotlight?.destroy();
    shown = index;
    if (index < targets.length) {
      const target = targets[index];
      spotlight = new TutorialSpotlight(scene, {
        rect: target.rect,
        text: t(target.textKey),
        side: target.rect.y < 900 ? "below" : "above",
        hint: t("tutorial.info.next", { step: index + 1, total: targets.length }),
        onAdvance: () => { index += 1; },
        onSkip: () => { index = targets.length; },
        skipLabel: t("tutorial.skip"),
      });
      return;
    }
    // 마지막 칸: 뒤로가기. 구멍이 열려 그 버튼만 눌린다.
    const back = info.tutorialBackBounds();
    const cx = back.x + back.width / 2;
    spotlight = new TutorialSpotlight(scene, {
      rect: back,
      text: t("tutorial.info.done"),
      side: "above",
      textGap: 420,
      pulse: true,
      guide: { from: { x: cx - 330, y: back.y - 300 }, to: { x: cx - 18, y: back.y - 40 }, bend: 0.38 },
    });
  };
  scene.events.on(Phaser.Scenes.Events.PRE_UPDATE, poll);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => stop(false));
  return () => stop(false);
}
