import { audioManager } from "../managers/AudioManager";
import Phaser from "phaser";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { breakthroughShardVector, burstDiamond } from "./breakthroughBurst";
import { ensureEffectTextures, EFFECT_TEXTURE } from "./effectTextures";
import { toPoints } from "./holo";
import { RUNE_SYNTHESIS } from "./runeSynthesisLayout";
import { t } from "../i18n";
import { runeRarityLabel, type RuneInstance } from "../core/runes";
import { addRuneFrame } from "./runeIcons";
import { COLOR, textStyle } from "./theme";

/**
 * 룬 합성의 연출 — 셋이 가운데 빛으로 빨려 들고 → 팡 → 새 룬이 선다.
 *
 * **결과에 따라 결이 갈린다.** 등급이 오르면 새 등급색의 섬광·파문 세 겹·파편이 크게 터지고 화면이
 * 한 번 울린다. 같은 등급이면 빛이 작게 퍼졌다가 **아래로 가라앉으며** 꺼진다 — 실패를 꾸짖지
 * 않되, 올랐을 때와 같은 무게로 터지면 무엇이 달라졌는지 읽히지 않는다.
 *
 * 화면 전체의 규칙을 지킨다: 동그라미 대신 납작한 마름모, 섬광은 옅게(상한 0.6), 난수 없음,
 * 흔들림·거리는 움직임 설정을 지난다. 터지기까지 0.7초를 넘기지 않아 조작이 기다리지 않는다.
 *
 * **터진 자리에 결과가 선다.** 예전에는 빛이 걷히자마자 일반 룬 쪽지가 떠서 "올랐다/그대로다"를
 * 말해 주는 순간이 없었다 — 가운데에 새 룬 액자와 판정 한 줄(「등급 상승!」 · 「고급 유지」)이 잠깐
 * 섰다가 쪽지로 넘어간다. 파편·파문은 어두운 유리판 위에서 묻히지 않도록 보통 합성으로 그리고,
 * 빛을 더하는 합성은 옅은 섬광·빛무리에만 남긴다.
 */
export interface RuneSynthesisEffectOptions {
  scene: Phaser.Scene;
  /** 꼭짓점의 룬 액자. 가운데로 빨려 든다. */
  frames: readonly Phaser.GameObjects.Container[];
  center: { x: number; y: number };
  /** 결과 등급의 색. */
  color: number;
  upgraded: boolean;
  /** 만들어진 룬. 터진 자리에 액자로 선다. */
  rune: RuneInstance;
  depth: number;
  /** 터지는 프레임에 한 번 — 화면은 그때 새 룬을 세운다. */
  onImpact: () => void;
  /** 남은 빛까지 다 걷힌 뒤 — 결과 쪽지를 연다. */
  onDone: () => void;
}

export function playRuneSynthesisEffect(options: RuneSynthesisEffectOptions): void {
  const { scene, center, color, upgraded } = options;
  ensureEffectTextures(scene);
  const motion = motionPolicy(session.settings);
  const distance = Math.max(0.25, motion.nonEssentialDistanceFactor);
  const camera = scene.cameras.main;
  const layer = scene.add.container(0, 0).setDepth(options.depth);
  let impacted = false;
  audioManager?.playUi("rune.synth");

  // 모이는 빛 — 가운데에서 부풀며 숨을 고른다.
  const gather = scene.add.image(center.x, center.y, EFFECT_TEXTURE.glow).setTint(color).setDisplaySize(80, 80)
    .setAlpha(0.3).setBlendMode(Phaser.BlendModes.ADD);
  layer.add(gather);
  scene.tweens.add({ targets: gather, displayWidth: 320, displayHeight: 260, alpha: 0.75, duration: RUNE_SYNTHESIS.gatherMs, ease: "Cubic.easeIn" });

  const impact = (): void => {
    if (impacted) return;
    impacted = true;
    options.frames.forEach((frame) => frame.setVisible(false));
    gather.destroy();
    options.onImpact();
    const flash = upgraded ? 0.5 : 0.18;
    const wash = scene.add.rectangle(camera.width / 2, camera.height / 2, camera.width, camera.height, color, 0).setBlendMode(Phaser.BlendModes.ADD);
    layer.add(wash);
    scene.tweens.add({ targets: wash, alpha: flash, duration: upgraded ? 120 : 160, yoyo: true, repeat: upgraded && motion.nonEssentialRepeatFactor > 0 ? 1 : 0, ease: "Sine.easeOut", onComplete: () => wash.destroy() });

    const ripples = upgraded ? 3 : 1;
    for (let index = 0; index < ripples; index += 1) {
      const ring = scene.add.graphics({ x: center.x, y: center.y });
      layer.add(ring);
      const spread = { radius: 50 };
      const reach = (upgraded ? 460 + index * 110 : 220) * distance;
      scene.tweens.add({
        targets: spread, radius: reach, duration: upgraded ? 620 : 520, delay: index * 120, ease: "Cubic.easeOut",
        onUpdate: () => {
          const life = (spread.radius - 50) / Math.max(1, reach - 50);
          ring.clear();
          const points = toPoints(burstDiamond(spread.radius, 0.46));
          const fade = 1 - life;
          // 먹선 한 겹을 먼저 깔아 밝은 원화·어두운 판 어디서든 선이 떨어져 나오게 한다.
          ring.lineStyle((upgraded ? 12 - index * 3 : 6), 0x05070a, 0.55 * fade);
          ring.strokePoints(points, true);
          ring.lineStyle(upgraded ? 7 - index * 2 : 4, color, (upgraded ? 0.95 : 0.6) * fade);
          ring.strokePoints(points, true);
        },
        onComplete: () => ring.destroy(),
      });
    }

    // 파편 — 오르면 위로 크게 튀고, 아니면 몇 조각이 짧게 떴다가 **아래로 가라앉는다**.
    const shards = upgraded ? 16 : 6;
    for (let index = 0; index < shards; index += 1) {
      const vector = breakthroughShardVector(index, shards);
      const reach = (upgraded ? 360 : 120) * distance;
      const piece = scene.add.image(center.x, center.y, EFFECT_TEXTURE.shard).setTint(color).setDisplaySize(upgraded ? 40 : 28, upgraded ? 40 : 28)
        .setAlpha(upgraded ? 1 : 0.75);
      layer.add(piece);
      scene.tweens.add({
        targets: piece,
        x: center.x + vector.x * reach,
        y: center.y + (upgraded ? vector.y * reach : Math.abs(vector.y) * 40 + 70),
        alpha: 0, scale: 0.3, angle: vector.x * 150,
        duration: upgraded ? 720 : 900, delay: index * 18, ease: upgraded ? "Cubic.easeOut" : "Sine.easeIn",
        onComplete: () => piece.destroy(),
      });
    }

    if (upgraded && motion.nonEssentialRepeatFactor > 0) {
      // 남은 빛 알갱이 — 새 룬 위로 천천히 떠오른다. 한 자리 수로 끊는다.
      for (let index = 0; index < 8; index += 1) {
        const mote = scene.add.image(center.x + (index - 3.5) * 46, center.y + 50, EFFECT_TEXTURE.glow).setTint(color)
          .setDisplaySize(44, 44).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
        layer.add(mote);
        scene.tweens.add({ targets: mote, y: center.y - 170 - (index % 3) * 40, alpha: { from: 0.8, to: 0 }, duration: 950 + index * 60, delay: 140 + index * 45, ease: "Sine.easeOut", onComplete: () => mote.destroy() });
      }
      camera.shake(260, 0.009 * motion.cameraShakeFactor);
    } else if (!upgraded) {
      // 아쉬움 — 가운데에 남은 작은 빛이 한 번 숨을 내쉬듯 꺼지며 내려앉는다.
      const ember = scene.add.image(center.x, center.y, EFFECT_TEXTURE.glow).setTint(color).setDisplaySize(160, 130).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
      layer.add(ember);
      scene.tweens.add({ targets: ember, y: center.y + 40, displayWidth: 60, displayHeight: 40, alpha: 0, duration: 760, ease: "Sine.easeIn", onComplete: () => ember.destroy() });
    }
    // 결과 — 새 룬 액자가 톡 튀어 서고 판정 한 줄이 그 아래에 선다.
    const result = scene.add.container(center.x, center.y).setScale(0.4).setAlpha(0);
    layer.add(result);
    const slot = RUNE_SYNTHESIS.resultSlot;
    result.add(addRuneFrame(scene, 0, 0, slot, options.rune.rarity, options.rune.part, { mainStats: options.rune.mainStats, engraved: true }));
    const verdict = scene.add.text(0, slot / 2 + 56, upgraded ? t("archaeology.synth.resultUp") : t("archaeology.synth.resultKeep", { rarity: runeRarityLabel(options.rune.rarity) }),
      textStyle({ role: "display", size: upgraded ? 56 : 44, color: upgraded ? `#${color.toString(16).padStart(6, "0")}` : COLOR.ink }))
      .setOrigin(0.5).setStroke("#05070a", 10).setShadow(0, 6, "#000000", 0, true, true);
    result.add(verdict);
    if (upgraded) {
      result.add(scene.add.text(0, -slot / 2 - 44, runeRarityLabel(options.rune.rarity), textStyle({ role: "emphasis", size: 32, color: COLOR.ink }))
        .setOrigin(0.5).setStroke("#05070a", 8));
    }
    scene.tweens.add({ targets: result, scale: 1, alpha: 1, duration: 260, ease: "Back.easeOut" });
    if (upgraded && motion.nonEssentialRepeatFactor > 0) {
      scene.tweens.add({ targets: verdict, scale: 1.08, duration: 240, delay: 260, yoyo: true, ease: "Sine.easeInOut" });
    }
    const hold = RUNE_SYNTHESIS.resultHoldMs + (upgraded ? 300 : 0);
    scene.tweens.add({ targets: result, alpha: 0, duration: 200, delay: hold });
    scene.time.delayedCall(hold + 200, () => { layer.destroy(); options.onDone(); });
  };

  // 룬 액자 셋이 돌며 가운데로 빨려 든다 — 마지막 것이 닿는 순간이 곧 터지는 순간이다.
  options.frames.forEach((frame, index) => {
    scene.tweens.add({
      targets: frame, x: center.x, y: center.y, scale: 0.25, angle: 200, alpha: 0.6,
      duration: RUNE_SYNTHESIS.gatherMs, delay: index * 40, ease: "Cubic.easeIn",
      onComplete: () => { if (index === options.frames.length - 1) impact(); },
    });
  });
  if (options.frames.length === 0) scene.time.delayedCall(RUNE_SYNTHESIS.gatherMs, impact);
  // 트윈이 끊겨도 터짐은 반드시 한 번 온다.
  scene.time.delayedCall(RUNE_SYNTHESIS.gatherMs + 600, impact);
}
