import Phaser from "phaser";
import { t } from "../i18n";
import { session } from "../state/session";
import { ARENA_TONE } from "./arenaTheme";
import { ARENA_MATCH_INTRO as S, arenaMatchIntroDuration } from "./arenaMatchIntroStyle";
import { drawLayer, slantedRect } from "./holo";
import { shakeCamera } from "./screenShake";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

export interface ArenaMatchIntroHandle { skip(): void }

/**
 * 큐가 잡혀 밴픽 화면에 처음 들어온 순간 한 번 도는 「나 VS 상대」. 밴픽 화면 위에 겹쳐 서고, 끝나면 스스로 걷힌다.
 * 화면 전체가 손을 받아 누르면 빠지는 박자로 곧바로 넘어간다 — 밴 시계는 그동안에도 돈다.
 */
export function playArenaMatchIntro(scene: Phaser.Scene, names: { me: string; foe: string }, onDone: () => void = () => undefined): ArenaMatchIntroHandle {
  const reduce = session.settings.accessibility.reduceMotion;
  const root = scene.add.container(0, 0).setDepth(S.depth).setName("arena-match-intro");
  const dim = scene.add.rectangle(540, 960, 1080 * 1.2, 1920 * 1.2, 0x05070a, S.dimAlpha).setAlpha(0).setInteractive();
  root.add(dim);

  const band = (y: number, name: string, label: string, color: number, textColor: string, fromRight: boolean): Phaser.GameObjects.Container => {
    const c = scene.add.container(540 + (reduce ? 0 : (fromRight ? S.offscreen : -S.offscreen)), y);
    c.add(drawLayer(scene, 0, 0, slantedRect(S.band.width, S.band.height, S.band.slant), { fill: ARENA_TONE.panel, alpha: 0.96, edge: color, edgeAlpha: 0.95, glow: { color, strength: 0.4, height: 0.9 } }));
    c.add(scene.add.text(0, -S.name.labelGap, label, textStyle({ role: "emphasis", size: S.name.labelSize, color: COLOR.inkDim })).setOrigin(0.5));
    c.add(squeezeTextToWidth(scene.add.text(0, 14, name, textStyle({ role: "display", size: S.name.size, color: textColor })).setOrigin(0.5).setStroke("#05070a", 7), S.name.maxWidth));
    root.add(c);
    return c;
  };
  const foe = band(S.foe.y, names.foe, t("arena.invite.opponent"), ARENA_TONE.foe, ARENA_TONE.foeText, true);
  const me = band(S.me.y, names.me, t("arena.invite.me"), ARENA_TONE.ally, ARENA_TONE.allyText, false);
  const vs = scene.add.text(540, S.vs.y, "VS", textStyle({ role: "display", size: S.vs.size, color: ARENA_TONE.sparkText }))
    .setOrigin(0.5).setAngle(-8).setStroke("#05070a", 12).setShadow(0, 8, "#000000", 0, true, true)
    .setAlpha(reduce ? 1 : 0).setScale(reduce ? 1 : S.slamFromScale);
  root.add(vs);

  let leaving = false;
  let done = false;
  const timers: Phaser.Time.TimerEvent[] = [];
  // 수명은 실제 시간이 지킨다 — 프레임이 드문 기기에서는 씬 시계와 트윈이 밀려 밴픽 화면을 오래 덮을 수 있다.
  const lifetime = window.setTimeout(() => finish(), arenaMatchIntroDuration(reduce) + S.realTimeSlackMs);
  const finish = (): void => {
    if (done) return;
    done = true;
    window.clearTimeout(lifetime);
    timers.forEach((timer) => timer.remove(false));
    scene.tweens.killTweensOf([dim, foe, me, vs]);
    root.destroy();
    onDone();
  };
  // ③ 슈륭 — 두 띠가 들어온 반대쪽으로 빠지고 VS는 부풀며 사라진다.
  const leave = (): void => {
    if (leaving || done) return;
    leaving = true;
    timers.forEach((timer) => timer.remove(false));
    scene.tweens.killTweensOf([foe, me, vs]);
    if (reduce) {
      scene.tweens.add({ targets: root, alpha: 0, duration: S.slideOutMs, onComplete: finish });
      return;
    }
    scene.tweens.add({ targets: foe, x: 540 - S.offscreen, duration: S.slideOutMs, ease: "Cubic.easeIn" });
    scene.tweens.add({ targets: me, x: 540 + S.offscreen, duration: S.slideOutMs, ease: "Cubic.easeIn" });
    scene.tweens.add({ targets: vs, scale: 1.7, alpha: 0, duration: S.slideOutMs, ease: "Quad.easeIn" });
    scene.tweens.add({ targets: dim, alpha: 0, duration: S.slideOutMs, ease: "Quad.easeIn", onComplete: finish });
  };
  dim.on("pointerup", leave);
  root.once(Phaser.GameObjects.Events.DESTROY, () => { done = true; window.clearTimeout(lifetime); timers.forEach((timer) => timer.remove(false)); });

  scene.tweens.add({ targets: dim, alpha: 1, duration: S.dimInMs });
  if (reduce) {
    timers.push(scene.time.delayedCall(S.dimInMs + S.reducedHoldMs, leave));
  } else {
    // ① 스르륵
    scene.tweens.add({ targets: [foe, me], x: 540, delay: S.dimInMs, duration: S.slideInMs, ease: "Cubic.easeOut" });
    // ② 쾅
    scene.tweens.add({
      targets: vs, scale: 1, alpha: 1, delay: S.dimInMs + S.slamDelayMs, duration: S.slamMs, ease: "Quad.easeIn",
      onComplete: () => { if (!leaving) shakeCamera(scene.cameras.main, S.shake.ms, S.shake.intensity); },
    });
    timers.push(scene.time.delayedCall(S.dimInMs + S.slamDelayMs + S.slamMs + S.holdMs, leave));
  }
  return { skip: leave };
}
