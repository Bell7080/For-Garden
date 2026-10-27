import Phaser from "phaser";
import { t } from "../i18n";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { Button, DESTRUCTIVE_BUTTON_STYLE } from "./Button";
import { chipPoints, drawLayer } from "./holo";
import { COLOR, textStyle } from "./theme";

/**
 * 결과판 밑동의 **자동 전투 띠** — 「화면을 눌러 확인」 자리를 대신한다.
 *
 * - `countdown`: 「자동 전투 3/10 · 다음 전투까지」 아래로 줄이 줄어들고, 다 줄면 다음 판으로 간다. 오른쪽
 *   「중지」가 자동 전투를 끝낸다(띠가 `stopped`처럼 바뀌고 판은 열린 채 남는다).
 * - `stopped`: 왜 멈췄는지와 몇 판을 돌았는지를 한 줄로 말한다. 판은 평소처럼 눌러서 닫는다.
 *
 * 다음 판으로 넘기는 시각은 씬 시계가 아니라 **실제 시간**(`setTimeout`)이 지킨다 — 결과판이 서는 전투
 * 화면은 코어 시간이 멈춰 있고, 바쁜 기기에서 씬 타이머가 밀리면 자동 전투가 그 자리에 붙잡힌다.
 */
export type AutoRepeatBannerOptions =
  | { kind: "countdown"; label: string; ms: number; onElapsed: () => void; onStop: () => void }
  | { kind: "stopped"; label: string };

export const AUTO_REPEAT_BANNER = { y: BASE_HEIGHT - 150, width: 820, height: 104, padX: 34, stop: { width: 168, height: 72 }, bar: { height: 8, y: 30 }, font: 28 } as const;

export function addAutoRepeatBanner(scene: Phaser.Scene, depth: number, options: AutoRepeatBannerOptions, close: () => void): { destroy: () => void } {
  const L = AUTO_REPEAT_BANNER;
  const root = scene.add.container(BASE_WIDTH / 2, L.y).setDepth(depth);
  const shape = chipPoints(L.width, L.height, { bevel: { topLeft: 22, topRight: 0, bottomRight: 22, bottomLeft: 0 } });
  root.add(drawLayer(scene, 0, 0, shape, { fill: 0x0d131c, alpha: 0.94, edge: COLOR.accent, edgeAlpha: 0.7 }));
  // 판 위 아무 곳이나 눌러도 뒤의 판이 닫히지 않게 입력을 먼저 받아 둔다.
  root.add(scene.add.rectangle(0, 0, L.width, L.height, 0xffffff, 0).setInteractive());
  const left = -L.width / 2 + L.padX;
  const label = scene.add.text(left, options.kind === "countdown" ? -10 : 0, options.label, textStyle({ role: "emphasis", size: L.font, color: COLOR.ink })).setOrigin(0, 0.5);
  root.add(label);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let alive = true;
  const destroy = (): void => {
    alive = false;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    scene.tweens.killTweensOf(root);
    if (root.active) root.destroy(true);
  };
  if (options.kind === "countdown") {
    const barWidth = L.width - L.padX * 2 - L.stop.width - 24;
    const track = scene.add.rectangle(left, L.bar.y, barWidth, L.bar.height, 0x000000, 0.7).setOrigin(0, 0.5);
    const fill = scene.add.rectangle(left, L.bar.y, barWidth, L.bar.height, COLOR.accent, 1).setOrigin(0, 0.5);
    root.add([track, fill]);
    scene.tweens.add({ targets: fill, scaleX: 0, duration: options.ms, ease: "Linear" });
    const stop = new Button(scene, L.width / 2 - L.padX / 2 - L.stop.width / 2, 0, {
      width: L.stop.width, height: L.stop.height, label: t("autoRepeat.stop"), fontSize: 26, ...DESTRUCTIVE_BUTTON_STYLE,
      onClick: () => {
        if (timer !== undefined) clearTimeout(timer);
        timer = undefined;
        options.onStop();
        stop.destroy();
        track.destroy();
        fill.destroy();
        label.setY(0).setText(t("autoRepeat.stoppedByUser"));
      },
    });
    root.add(stop);
    timer = setTimeout(() => {
      timer = undefined;
      if (!alive) return;
      options.onElapsed();
      close();
    }, options.ms);
  }
  root.setAlpha(0);
  scene.tweens.add({ targets: root, alpha: 1, duration: 200 });
  return { destroy };
}
