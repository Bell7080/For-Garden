import Phaser from "phaser";
import { t } from "../i18n";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { battleAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { ANCIENT_RESET_WARNING as L } from "./ancientResetWarningLayout";
import { Button } from "./Button";
import { chipPoints, drawLayer } from "./holo";
import { remainingDetail } from "./itemExpiry";
import type { PopupLayer } from "./PopupLayer";
import { addSdFootShadow } from "./SdFootShadow";
import { COLOR, textStyle } from "./theme";

/**
 * 지층 초기화가 사흘 안으로 다가오면 지층에 들어올 때 한 번 뜨는 예고 창. 아모가 말풍선으로 알리며 허둥대고,
 * 밑동에는 남은 시간이 붉게 선다. 언제 띄울지는 화면이 아니라 `ancientResetWarningDue`가 정한다.
 */
export function openAncientResetWarning(scene: Phaser.Scene, layer: PopupLayer, endsAt: Date, onClose?: () => void): void {
  const motion = motionPolicy(session.settings);
  const still = motion.nonEssentialRepeatFactor === 0;
  let figure: PuppetCreature | undefined;
  let shadow: Phaser.GameObjects.GameObject | undefined;
  const tweens: Phaser.Tweens.Tween[] = [];
  const timers: Phaser.Time.TimerEvent[] = [];
  let disposed = false;
  const cleanup = (): void => {
    if (disposed) return;
    disposed = true;
    tweens.forEach((tween) => tween.remove());
    timers.forEach((timer) => timer.remove());
    figure?.destroy();
    shadow?.destroy();
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup);
  };

  layer.open({ width: L.width, height: L.height, title: t("ancient.resetWarning.title"), dim: true, closeOnBackdrop: true, onClose }, (body, close) => {
    body.once(Phaser.GameObjects.Events.DESTROY, cleanup);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    const depth = (body.parentContainer?.depth ?? 0) + 1;

    // 말풍선 — 판의 깎임 규칙(왼쪽 위·오른쪽 아래)을 따르고, 꼬리만 아래로 내민다.
    const b = L.bubble;
    const tail = scene.add.graphics();
    tail.fillStyle(b.fill, 1);
    tail.fillTriangle(b.tail.x - b.tail.width / 2, b.y + b.height / 2 - 2, b.tail.x + b.tail.width / 2, b.y + b.height / 2 - 2, b.tail.x - b.tail.width * .8, b.y + b.height / 2 + b.tail.depth);
    body.add(drawLayer(scene, 0, b.y, chipPoints(b.width, b.height, { bevel: { topLeft: b.bevel, bottomRight: b.bevel } }),
      { fill: b.fill, alpha: 1, edge: b.edge, edgeAlpha: 1, edgeWidth: 6 }));
    body.add(tail);
    body.add(scene.add.text(0, b.y + b.line.y, t("ancient.resetWarning.line"),
      textStyle({ role: "display", size: b.line.size, color: b.line.color, align: "center", wrap: b.line.wrap })).setOrigin(.5));
    body.add(scene.add.text(0, b.y + b.body.y, t("ancient.resetWarning.body"),
      textStyle({ role: "body", size: b.body.size, color: b.body.color, align: "center", wrap: b.body.wrap })).setOrigin(.5));

    // 놀란 표식 — 머리 옆에서 좌우로 흔들린다.
    const alarm = scene.add.text(L.sd.x + L.alarm.x, L.sd.groundY - L.sd.height + L.alarm.y, "!?",
      textStyle({ role: "display", size: L.alarm.size, color: L.alarm.color })).setStroke("#1a0f14", 8).setOrigin(.5, 1);
    body.add(alarm);
    if (!still) tweens.push(scene.tweens.add({ targets: alarm, angle: { from: -L.alarm.swing, to: L.alarm.swing }, duration: L.alarm.duration, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }));

    // 땀방울 — 머리 둘레에서 마름모가 튀어 올랐다 흩어진다. 난수 없이 번호에서 자리를 정한다.
    if (!still) {
      let drop = 0;
      timers.push(scene.time.addEvent({ delay: L.sweat.every, loop: true, callback: () => {
        if (disposed) return;
        const side = drop % 2 === 0 ? -1 : 1, lean = ((drop * 37) % 5) / 4;
        const g = scene.add.graphics({ x: L.sd.x + side * (40 + lean * 30), y: L.sd.groundY - L.sd.height + L.sweat.originY });
        const s = L.sweat.size;
        g.fillStyle(L.sweat.color, .95);
        g.fillPoints([new Phaser.Math.Vector2(0, -s * 1.4), new Phaser.Math.Vector2(s * .75, 0), new Phaser.Math.Vector2(0, s * .9), new Phaser.Math.Vector2(-s * .7, 0)], true);
        body.add(g);
        drop += 1;
        scene.tweens.add({ targets: g, x: g.x + side * L.sweat.spread * (.5 + lean * .5), y: g.y - L.sweat.rise * (.6 + lean * .4), angle: side * 40, alpha: 0, duration: L.sweat.life, ease: "Quad.easeOut", onComplete: () => g.destroy() });
      } }));
    }

    // 아모 — 바들바들 떨며 콩콩 뛴다.
    void spawnPuppet(scene, battleAssetFor("amo"), { x: body.x + L.sd.x, groundY: body.y + L.sd.groundY, height: L.sd.height, depth }).then((sd) => {
      if (disposed) { sd.destroy(); return; }
      figure = sd;
      sd.setName("ancient-reset-amo");
      sd.disableInteractive();
      shadow = addSdFootShadow(scene, body.x + L.sd.x, body.y + L.sd.groundY, L.sd.shadowWidth).setDepth(depth - .1);
      if (still) return;
      const restX = sd.x, restY = sd.y, jitter = { x: 0, hop: 0 };
      tweens.push(scene.tweens.add({ targets: jitter, x: { from: -1, to: 1 }, duration: L.sd.shake.duration, yoyo: true, repeat: -1 }));
      tweens.push(scene.tweens.add({ targets: jitter, hop: 1, duration: L.sd.hop.duration, repeat: -1, repeatDelay: L.sd.hop.rest }));
      tweens.push(scene.tweens.add({ targets: {}, duration: 1000, repeat: -1, onUpdate: () => {
        sd.x = restX + jitter.x * L.sd.shake.distance * motion.nonEssentialDistanceFactor;
        sd.y = restY - L.sd.hop.rise * motion.nonEssentialDistanceFactor * (1 - (2 * jitter.hop - 1) ** 2);
      } }));
    }).catch((error) => console.warn("지층 초기화 예고 SD 표시 실패", error));

    // 남은 시간 — 붉게, 초마다 다시 적는다.
    body.add(scene.add.text(0, L.timer.labelY, t("ancient.resetWarning.left"),
      textStyle({ role: "emphasis", size: L.timer.labelSize, color: COLOR.inkDim })).setOrigin(.5));
    const value = scene.add.text(0, L.timer.valueY, "", textStyle({ role: "display", size: L.timer.valueSize, color: COLOR.dangerText })).setStroke("#000000", 8).setOrigin(.5);
    body.add(value);
    const paint = (): void => { value.setText(remainingDetail(endsAt.toISOString())); };
    paint();
    timers.push(scene.time.addEvent({ delay: 1000, loop: true, callback: () => { if (!disposed) paint(); } }));

    body.add(new Button(scene, 0, L.ok.y, { width: L.ok.width, height: L.ok.height, label: t("ancient.resetWarning.ok"), fontSize: L.ok.fontSize, variant: "primary", onClick: close }));
  });
}
