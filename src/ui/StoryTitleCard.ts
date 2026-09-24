import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import type { DialogueTitleCard } from "../core/dialogue";
import { STORY_TITLE_CARD } from "./dialogueStageLayout";
import { COLOR, textStyle } from "./theme";

/**
 * 이야기에 들어가는 순간의 제목표.
 *
 * **검은 화면에서 시작한다.** 무대(배경·스탠딩)는 그 뒤에서 미리 서 있다가 막이 걷히며 한꺼번에
 * 드러난다 — 막보다 먼저 보이면 화면이 한 번 조립되는 과정이 그대로 보인다.
 *
 * 제목과 부제는 **가운데에서 좌우로 열린다.** 타이틀 로고와 같은 문법이라 글자를 늘이지 않고
 * 잘라 내는 창을 넓히며, 벌어지는 틈을 따라 옅은 섬광이 함께 퍼진다. 잠시 머문 뒤 글자가
 * 걷히는 것과 겹쳐 검은 막이 옅어진다. 화면을 누르면 머무는 시간을 건너뛴다.
 *
 * 막이 다 걷히면 돌려준 약속이 풀린다. 씬이 먼저 닫히면 그 자리에서 풀어 기다리는 쪽이 매달리지 않게 한다.
 */
export function playStoryTitleCard(scene: Phaser.Scene, card: DialogueTitleCard, depth = 900): Promise<void> {
  return new Promise<void>((resolve) => {
    const cx = BASE_WIDTH / 2;
    const { titleY, titleSize, subtitleGap, subtitleSize, ruleWidth } = STORY_TITLE_CARD;
    const curtain = scene.add.rectangle(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, 0x000000, 1).setDepth(depth);
    const title = scene.add.text(cx, titleY, card.title, textStyle({ role: "display", size: titleSize })).setOrigin(0.5).setDepth(depth + 1);
    const rule = scene.add.rectangle(cx, titleY + subtitleGap / 2 + 6, ruleWidth, 3, COLOR.accent, 0.9).setDepth(depth + 1);
    const subtitle = scene.add
      .text(cx, titleY + subtitleGap, card.subtitle, textStyle({ role: "emphasis", size: subtitleSize, color: COLOR.accentText }))
      .setOrigin(0.5)
      .setDepth(depth + 1);
    const words = [title, rule, subtitle];

    // 창은 제목과 부제를 함께 품는 띠 하나다. 기하 마스크는 컨테이너 변환을 물려받지 않으므로
    // 화면 좌표에 직접 세운다 — 이 셋은 컨테이너 없이 씬에 바로 선다.
    const bandTop = titleY - titleSize;
    const bandHeight = subtitleGap + titleSize + subtitleSize * 1.4;
    const bandWidth = Math.max(title.width, subtitle.width, ruleWidth) + 80;
    const window = scene.make.graphics({ x: 0, y: 0 }, false);
    const mask = window.createGeometryMask();
    for (const word of words) word.setMask(mask);
    const flash = scene.add
      .rectangle(cx, bandTop + bandHeight / 2, 4, bandHeight, 0xffffff, 0.8)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(depth + 2);

    let finished = false;
    let closing = false;
    const cleanup = (): void => {
      if (finished) return;
      finished = true;
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup);
      // 열리는 도중에 끝나도 마스크를 남기지 않는다 — 남기면 이후 모든 프레임의 비용이 된다.
      for (const word of words) if (word.active) word.clearMask();
      mask.destroy();
      window.destroy();
      for (const object of [curtain, flash, ...words]) if (object.active) object.destroy();
      resolve();
    };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);

    const opening = { t: 0 };
    const openTween = scene.tweens.add({
      targets: opening,
      t: 1,
      duration: STORY_TITLE_CARD.openMs,
      ease: "Cubic.Out",
      onUpdate: () => {
        const open = bandWidth * opening.t;
        window.clear();
        window.fillStyle(0xffffff, 1);
        window.fillRect(cx - open / 2, bandTop, open, bandHeight);
      },
    });
    scene.tweens.add({
      targets: flash,
      displayWidth: bandWidth,
      alpha: 0,
      duration: STORY_TITLE_CARD.openMs + 180,
      ease: "Quad.Out",
    });

    const close = (): void => {
      if (closing || finished) return;
      closing = true;
      holdTimer.remove(false);
      openTween.complete();
      // 다 열린 창은 할 일이 없다. 걷히는 동안 글자가 창 밖으로 흘러도 잘리지 않게 푼다.
      for (const word of words) word.clearMask();
      scene.tweens.add({ targets: words, alpha: 0, y: "-=18", duration: STORY_TITLE_CARD.closeMs, ease: "Quad.In" });
      scene.tweens.add({
        targets: curtain,
        alpha: 0,
        delay: STORY_TITLE_CARD.closeMs * 0.4,
        duration: STORY_TITLE_CARD.revealMs,
        ease: "Sine.InOut",
        onComplete: cleanup,
      });
    };
    const holdTimer = scene.time.delayedCall(STORY_TITLE_CARD.openMs + STORY_TITLE_CARD.holdMs, close);
    // 한 번 본 이야기를 다시 여는 사람이 기다리지 않도록 누르면 곧바로 걷힌다.
    curtain.setInteractive().on("pointerup", close);
  });
}
