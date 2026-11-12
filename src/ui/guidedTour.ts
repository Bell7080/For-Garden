import Phaser from "phaser";
import { t } from "../i18n";
import { TutorialSpotlight } from "./TutorialSpotlight";
import { followTutorialTarget } from "./tutorialTarget";

type Rect = { x: number; y: number; width: number; height: number };

/**
 * 안내형 튜토리얼의 한 칸.
 *
 * `done`이 없으면 **보는 칸**이다 — 화면을 어둡게 덮고 한 자리만 밝혀 글을 세우며, 화면 어디를 눌러도 다음 칸으로
 * 넘어간다(소개 중에 아래 버튼이 눌리면 순서가 엉킨다). `done`이 있으면 **해 보는 칸**이다 — 구멍 안의 조작만
 * 아래 화면으로 지나가고, 그 값이 참이 되는 순간 안내가 끝난다. 해 보는 칸은 늘 마지막에 둔다.
 */
export interface GuidedTourStep {
  /** 밝힐 자리(씬 좌표). 없으면 그 칸을 건너뛴다. 해 보는 칸은 매 프레임 다시 읽는다(지도를 끌어도 따라간다). */
  rect: () => Rect | undefined;
  text: () => string;
  /** 칸에 들어서기 전에 화면을 옮긴다(지도를 그 유적 쪽으로 미는 일 등). 준비가 끝나면 `ready`를 부른다. */
  enter?: (ready: () => void) => void;
  done?: () => boolean;
  side?: "above" | "below";
}

/** 칸이 서자마자 그 칸을 넘기지 않게 막는 시간 — 앞 칸을 넘긴 손가락이 떨어지는 사건이 다음 칸까지 넘기지 않도록. */
const ADVANCE_GUARD_MS = 260;

/**
 * 칸들을 차례로 짚는다. 건너뛰기는 어느 칸에서나 오른쪽 위에 서고, 누르면 안내 전체가 끝난다.
 * 화면이 바뀌면(씬 종료) 조용히 걷힌다. 돌려주는 함수를 부르면 바깥에서 끝낼 수 있다.
 */
export function runGuidedTour(scene: Phaser.Scene, steps: readonly GuidedTourStep[], onEnd?: () => void): () => void {
  let index = -1, finished = false;
  let spotlight: TutorialSpotlight | undefined;
  let stopFollow: (() => void) | undefined;
  const viewed = steps.filter((step) => !step.done).length;
  let viewedSoFar = 0;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    spotlight?.destroy(); spotlight = undefined;
    stopFollow?.(); stopFollow = undefined;
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, finish);
    onEnd?.();
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, finish);

  const show = (step: GuidedTourStep): void => {
    if (finished || !scene.scene.isActive()) return;
    const rect = step.rect();
    if (!rect) { advance(); return; }
    if (step.done) {
      const done = step.done;
      stopFollow = followTutorialTarget(scene, {
        enabled: () => !finished && !done(),
        rect: step.rect,
        text: step.text,
        onSkip: finish,
        side: () => step.side,
      });
      // 조작이 끝나면 따라가기가 스스로 걷히므로, 그 순간을 매 프레임 확인해 안내 전체를 닫는다.
      const watch = (): void => { if (finished || done()) { scene.events.off(Phaser.Scenes.Events.PRE_UPDATE, watch); finish(); } };
      scene.events.on(Phaser.Scenes.Events.PRE_UPDATE, watch);
      return;
    }
    viewedSoFar += 1;
    const shownAt = scene.time.now;
    spotlight = new TutorialSpotlight(scene, {
      rect,
      text: step.text(),
      side: step.side,
      hint: t("tutorial.tour.next", { step: viewedSoFar, total: viewed }),
      onSkip: finish,
      skipLabel: t("tutorial.skip"),
      onAdvance: () => { if (scene.time.now - shownAt >= ADVANCE_GUARD_MS) advance(); },
    });
  };

  const advance = (): void => {
    if (finished) return;
    spotlight?.destroy(); spotlight = undefined;
    index += 1;
    const step = steps[index];
    if (!step) { finish(); return; }
    if (step.enter) step.enter(() => show(step));
    else show(step);
  };

  advance();
  return finish;
}
