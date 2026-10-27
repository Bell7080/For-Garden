import Phaser from "phaser";
import { t } from "../i18n";
import { formatCurrency } from "../core/formatCurrency";
import { motionPolicy } from "../core/settings";
import { audioManager } from "../managers/AudioManager";
import { settingsManager } from "../managers/SettingsManager";
import { textStyle } from "./theme";

/**
 * **대성공 연출** — 결과판(한 판)과 소탕 영수증(여러 판)이 같은 한 벌을 쓴다.
 *
 * 1. 귀여운 팡파레 — 액자 줄 위로 색종이 마름모가 톡톡 튀어 오르고(떨어지지 않는다), 음이 한 번 울린다.
 * 2. 액자가 **쾅** 맥동한다 — 커졌다 제자리로 튀며 섬광이 한 번 번진다. 소탕은 대성공 판 수만큼(최대 다섯) 거듭 친다.
 * 3. 액자 우상단에 **삐딱한 「대성공」 도장**이 찍힌다.
 * 4. 수량이 기본 몫에서 받은 몫까지 띠리링 올라간다.
 *
 * 움직임 줄이기에서는 튀지도 세지도 않고 도장과 최종 수만 선다.
 */
export const GREAT_SUCCESS_FX = {
  /** 판이 서고 연출이 시작되기까지 — 결과판이 먼저 한 번 읽혀야 한다. */
  startDelayMs: 620,
  pulse: { scale: 1.24, upMs: 90, downMs: 260, gapMs: 340 },
  stamp: { dx: 0.36, dy: -0.5, angle: -14, size: 0.2, slamFrom: 2.4, slamMs: 220, color: "#ffd75e", stroke: "#5a1e00" },
  count: { durationMs: 520 },
  confetti: { pieces: 14, spread: 360, rise: 220, lifeMs: 900, colors: [0xffd75e, 0xff8fb1, 0x8fe3ff, 0xb9ff8f, 0xffffff] },
  flash: { alpha: 0.55, ms: 260 },
} as const;

/** 움직임 줄이기면 튀지 않는다. */
export function greatSuccessReduced(): boolean {
  return motionPolicy(settingsManager.get()).nonEssentialRepeatFactor === 0;
}

/** 액자 안의 수량 글자. `addFramedIcon`이 만든 홀더에서 글자는 수량 하나뿐이다. */
export function frameAmountText(holder: Phaser.GameObjects.Container): Phaser.GameObjects.Text | undefined {
  return holder.list.find((child): child is Phaser.GameObjects.Text => child instanceof Phaser.GameObjects.Text);
}

/** 액자 우상단에 박히는 삐딱한 「대성공」. `slam`이면 크게서 쾅 내려앉는다. */
export function addGreatSuccessStamp(scene: Phaser.Scene, holder: Phaser.GameObjects.Container, size: number, slam: boolean): Phaser.GameObjects.Text {
  const S = GREAT_SUCCESS_FX.stamp;
  const stamp = scene.add.text(size * S.dx, size * S.dy, t("greatSuccess.stamp"), textStyle({ role: "display", size: Math.max(20, Math.round(size * S.size)), color: S.color }))
    .setOrigin(0.5).setAngle(S.angle).setStroke(S.stroke, 7).setShadow(2, 4, "#000000", 3, false, true);
  holder.add(stamp);
  if (slam) {
    stamp.setScale(S.slamFrom).setAlpha(0);
    scene.tweens.add({ targets: stamp, scale: 1, alpha: 1, duration: S.slamMs, ease: "Back.Out" });
  }
  return stamp;
}

/** 한 번 쾅. 섬광은 액자 크기의 납작한 마름모로 한 번 번진다. */
export function pulseFrame(scene: Phaser.Scene, holder: Phaser.GameObjects.Container, size: number): void {
  const P = GREAT_SUCCESS_FX.pulse;
  const base = holder.getData("greatBaseScale") as number | undefined ?? holder.scale;
  holder.setData("greatBaseScale", base);
  scene.tweens.killTweensOf(holder);
  holder.setScale(base);
  scene.tweens.add({ targets: holder, scale: base * P.scale, duration: P.upMs, ease: "Quad.Out", yoyo: false,
    onComplete: () => scene.tweens.add({ targets: holder, scale: base, duration: P.downMs, ease: "Back.Out" }) });
  const flash = scene.add.graphics();
  flash.fillStyle(0xfff3c4, GREAT_SUCCESS_FX.flash.alpha);
  const r = size * 0.62;
  flash.fillPoints([new Phaser.Math.Vector2(0, -r * 0.62), new Phaser.Math.Vector2(r, 0), new Phaser.Math.Vector2(0, r * 0.62), new Phaser.Math.Vector2(-r, 0)], true);
  flash.setBlendMode(Phaser.BlendModes.ADD);
  holder.add(flash);
  scene.tweens.add({ targets: flash, alpha: 0, scale: 1.5, duration: GREAT_SUCCESS_FX.flash.ms, onComplete: () => flash.destroy() });
}

/** 수량을 `from`에서 `to`까지 띠리링 올린다. */
export function countAmount(scene: Phaser.Scene, text: Phaser.GameObjects.Text | undefined, from: number, to: number, durationMs: number = GREAT_SUCCESS_FX.count.durationMs): void {
  if (!text) return;
  const counter = { value: from };
  scene.tweens.add({
    targets: counter, value: to, duration: durationMs, ease: "Quad.Out",
    onUpdate: () => { if (text.active) text.setText(formatCurrency(Math.round(counter.value))); },
    onComplete: () => { if (text.active) text.setText(formatCurrency(to)); },
  });
}

/**
 * 팡파레 — `parent` 국소 좌표 (x, y)에서 색종이 마름모가 위로 톡톡 튄다. 난수를 쓰지 않는다(번호에서
 * 각도·거리를 정한다) — 같은 대성공은 늘 같은 그림이다.
 */
export function playFanfare(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number): void {
  audioManager?.playUi("ui.levelup");
  const C = GREAT_SUCCESS_FX.confetti;
  for (let index = 0; index < C.pieces; index += 1) {
    const ratio = index / Math.max(1, C.pieces - 1);
    const dx = (ratio - 0.5) * C.spread * (1 + (index % 3) * 0.18);
    const rise = C.rise * (0.6 + ((index * 7) % 5) / 10);
    const piece = scene.add.graphics();
    const w = 9 + (index % 3) * 3;
    piece.fillStyle(C.colors[index % C.colors.length]!, 1);
    piece.fillPoints([new Phaser.Math.Vector2(0, -w * 1.3), new Phaser.Math.Vector2(w * 0.7, 0), new Phaser.Math.Vector2(0, w * 1.1), new Phaser.Math.Vector2(-w * 0.8, 0)], true);
    piece.lineStyle(2, 0x1a1208, 0.8).strokePoints([new Phaser.Math.Vector2(0, -w * 1.3), new Phaser.Math.Vector2(w * 0.7, 0), new Phaser.Math.Vector2(0, w * 1.1), new Phaser.Math.Vector2(-w * 0.8, 0)], true);
    piece.setPosition(x, y).setScale(0.4);
    parent.add(piece);
    scene.tweens.add({ targets: piece, x: x + dx, y: y - rise, scale: 1, angle: (index % 2 === 0 ? 1 : -1) * (120 + index * 20), duration: C.lifeMs * 0.55, ease: "Cubic.Out" });
    scene.tweens.add({ targets: piece, alpha: 0, delay: C.lifeMs * 0.45, duration: C.lifeMs * 0.55, onComplete: () => piece.destroy() });
  }
}

/**
 * 기다림은 씬 시계가 아니라 **트윈의 `delay`**다 — 결과판이 서는 전투 화면에서는 `delayedCall`이 깨어나지
 * 않는다(경험치 블록과 같은 이유).
 */
function after(scene: Phaser.Scene, ms: number, run: () => void): void {
  scene.tweens.addCounter({ from: 0, to: 1, duration: 1, delay: ms, onComplete: run });
}

/** 얹힌 몫이 있는 액자 하나. `pulses`번 쾅 치며 수가 그만큼 나눠 오른다. */
export interface GreatSuccessFrame {
  holder: Phaser.GameObjects.Container;
  size: number;
  amount: number;
  bonus: number;
}

/**
 * 액자 여럿에 대성공을 입힌다. 수량 글자는 **기본 몫**으로 먼저 세워 두고 이 함수가 받은 몫까지 올린다.
 * `fanfareAt`은 팡파레가 터지는 자리(`parent` 국소 좌표)다.
 */
export function playGreatSuccess(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, frames: readonly GreatSuccessFrame[], pulses: number, fanfareAt: { x: number; y: number }): void {
  if (frames.length === 0 || pulses <= 0) return;
  for (const frame of frames) frameAmountText(frame.holder)?.setText(formatCurrency(frame.amount - frame.bonus));
  if (greatSuccessReduced()) {
    for (const frame of frames) { frameAmountText(frame.holder)?.setText(formatCurrency(frame.amount)); addGreatSuccessStamp(scene, frame.holder, frame.size, false); }
    return;
  }
  const P = GREAT_SUCCESS_FX.pulse;
  after(scene, GREAT_SUCCESS_FX.startDelayMs, () => {
    if (!parent.active) return;
    playFanfare(scene, parent, fanfareAt.x, fanfareAt.y);
    for (const frame of frames) addGreatSuccessStamp(scene, frame.holder, frame.size, true);
  });
  for (let beat = 0; beat < pulses; beat += 1) {
    after(scene, GREAT_SUCCESS_FX.startDelayMs + 140 + beat * P.gapMs, () => {
      if (!parent.active) return;
      for (const frame of frames) {
        if (!frame.holder.active) continue;
        pulseFrame(scene, frame.holder, frame.size);
        const step = (value: number) => frame.amount - frame.bonus + Math.round(frame.bonus * value / pulses);
        countAmount(scene, frameAmountText(frame.holder), step(beat), step(beat + 1), Math.min(GREAT_SUCCESS_FX.count.durationMs, P.gapMs - 40));
      }
    });
  }
}
