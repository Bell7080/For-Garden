import Phaser from "phaser";
import { CHEST_GRADE_MAX } from "../core/chestForge";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { CHEST_ART, CHEST_ART_CONTENT, chestGlowColor, ensureChestTexture } from "./chestArt";
import type { EventCardPuppet } from "./eventCardSd";
import { burstSparkles } from "./chestForgeFx";
import { shapeClipMask } from "./popupArt";
import { addCurrencyRain, drawSparkle } from "./rouletteWheel";

/** 보물상자 이벤트 코인 그림 — 비와 상자에서 튀어나오는 한 닢이 같은 그림이다. */
export const CHEST_EVENT_COIN_ICON = "currency-treasure-chest-coin";

export interface ChestCardShowcaseSpec {
  width: number;
  height: number;
  /** 상자 가운데의 x(카드 가운데 기준). 상자는 늘 카드 밑변에 살짝 묻혀 앉는다. */
  x: number;
  /** 화면에 서는 상자 몸의 높이(px) — 원화의 닫힌 상자 실측 높이에서 배율을 구한다. */
  chestHeight: number;
  /** 밑변 아래로 묻히는 깊이(px). */
  sink: number;
  /** SD가 상자를 콩 두드리는 간격(ms). 두드릴 때마다 상자가 한 등급씩 빛나고, 끝에 닿으면 처음으로 돌아간다. */
  bonkMs: number;
  rain: { count: number; size: number; alpha: number; fallMs: number };
}

/**
 * 이벤트 카드의 보물상자 장면 — 카드 밑변에 앉은 상자, 그 뒤 은은한 빛무리, 위로 내리는 이벤트 코인.
 * 모두 카드 실루엣 안에서만 그려진다(돌림판 장면과 같은 마스크). 원화·어둠 위, 제목 글 아래 층이다.
 *
 * 토리카(SD)가 도착하면 `attachBonker`로 넘겨받아 가끔 상자 쪽으로 기울며 콩 두드린다 — 상자가 움찔하며 한 등급
 * 화려해지고, 입에서 코인 한 닢이 반짝이와 함께 튀어 오른다. 「두드릴수록 상자가 좋아진다」가 이 이벤트의 한 줄이다.
 * 움직임 줄이기에서는 상자도 토리카도 멈춰 서고 코인 비도 멈춘다.
 */
export function addChestCardShowcase(
  scene: Phaser.Scene,
  card: Phaser.GameObjects.Container,
  shape: readonly number[],
  spec: ChestCardShowcaseSpec,
): { attachBonker: (puppet: EventCardPuppet) => void } {
  const stage = scene.add.container(0, 0);
  card.add(stage);
  stage.setMask(shapeClipMask(scene, card, shape));
  addCurrencyRain(scene, stage, { left: -spec.width / 2 + 20, right: spec.width / 2 - 20, top: -spec.height / 2, bottom: spec.height / 2, keys: [CHEST_EVENT_COIN_ICON], ...spec.rain });

  const content = CHEST_ART_CONTENT.closed;
  const scale = spec.chestHeight / (content.bottom - content.top);
  const centerX = (content.left + content.right) / 2 - CHEST_ART.width / 2;
  const x = spec.x - centerX * scale;
  // 상자 몸의 밑변이 카드 밑변에서 `sink`만큼 묻히도록 그림 가운데를 잡는다.
  const y = spec.height / 2 + spec.sink - (content.bottom - CHEST_ART.height / 2) * scale;
  const mouthY = y + (content.top - CHEST_ART.height / 2) * scale + spec.chestHeight * 0.18;
  const bodyY = y + ((content.top + content.bottom) / 2 - CHEST_ART.height / 2) * scale;

  const aura = scene.add.graphics();
  stage.add(aura);
  // 숨 쉬기는 바깥 틀이, 두드려 움찔하는 일은 그림이 맡는다 — 같은 배율을 두 트윈이 다투지 않는다.
  const body = scene.add.container(x, y + (content.bottom - CHEST_ART.height / 2) * scale);
  stage.add(body);
  const image = scene.add.image(0, -(content.bottom - CHEST_ART.height / 2) * scale, ensureChestTexture(scene, 0, false)).setScale(scale);
  body.add(image);
  const twinkle = scene.add.graphics();
  stage.add(twinkle);

  let grade = 0;
  const paintGrade = (): void => {
    image.setTexture(ensureChestTexture(scene, grade, false));
    const glow = chestGlowColor(grade);
    const radius = spec.chestHeight * (0.95 + grade * 0.1);
    aura.clear();
    for (let ring = 4; ring >= 1; ring -= 1) {
      aura.fillStyle(glow, (0.06 + grade * 0.025) * (5 - ring) / 4);
      aura.fillEllipse(spec.x, bodyY, radius * (0.9 + ring * 0.32), radius * (0.6 + ring * 0.22));
    }
    twinkle.clear();
    // 등급이 오를수록 상자 둘레의 반짝임이 늘어난다(0등급은 없다).
    for (let index = 0; index < grade * 2; index += 1) {
      const angle = -Math.PI * (0.1 + (index / Math.max(1, grade * 2 - 1)) * 0.8);
      const reach = spec.chestHeight * (0.72 + (index % 2) * 0.18);
      drawSparkle(twinkle, spec.x + Math.cos(angle) * reach, bodyY + Math.sin(angle) * reach * 0.62, 7 + (index % 3) * 3, index % 2 ? 0xffffff : glow, 0.9);
    }
  };
  paintGrade();

  const loops = motionPolicy(session.settings).nonEssentialRepeatFactor > 0;
  if (loops) {
    // 숨 쉬듯 아주 살짝 커졌다 작아진다 — 서 있는 그림이 아니라 무언가 든 상자로 읽힌다.
    scene.tweens.add({ targets: body, scaleX: 1.025, scaleY: 0.985, duration: 900, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    scene.tweens.add({ targets: twinkle, alpha: 0.45, duration: 700, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  }

  /** 상자 입에서 코인 한 닢이 반짝이와 함께 위로 튀어 오른다. */
  const popCoin = (seed: number): void => {
    const coin = scene.add.image(spec.x, mouthY, CHEST_EVENT_COIN_ICON).setDisplaySize(44, 44);
    stage.add(coin);
    const size = coin.scale;
    const toX = spec.x - 40 - (seed % 3) * 26;
    scene.tweens.add({ targets: coin, x: toX, duration: 760, ease: "Linear" });
    scene.tweens.add({ targets: coin, y: mouthY - 96, duration: 380, yoyo: true, ease: "Quad.Out" });
    scene.tweens.add({ targets: coin, angle: -280, scale: size * 1.18, alpha: { from: 1, to: 0 }, duration: 760, ease: "Quad.In", onComplete: () => coin.destroy() });
    burstSparkles(scene, stage, spec.x, mouthY, { count: 6 + grade * 2, radius: 46 + grade * 8, size: 9, colors: [0xffffff, chestGlowColor(grade), 0xffe27a], seed: seed * 13 + 1, rise: 18 });
  };

  return {
    attachBonker: (puppet) => {
      if (!loops) return;
      const restX = puppet.x;
      let count = 0;
      const bonk = scene.time.addEvent({ delay: spec.bonkMs, loop: true, callback: () => {
        if (!card.active || !puppet.active) return;
        count += 1;
        const seed = count;
        // 상자 쪽(왼쪽)으로 기울며 콩 — 기울어지는 끝에서 상자가 움찔하고 한 등급 오른다.
        scene.tweens.add({ targets: puppet, angle: -10, x: restX - 18, duration: 150, yoyo: true, ease: "Sine.InOut" });
        scene.time.delayedCall(150, () => {
          if (!card.active) return;
          grade = (grade + 1) % (CHEST_GRADE_MAX + 1);
          paintGrade();
          scene.tweens.add({ targets: image, scaleX: { from: scale * 1.12, to: scale }, scaleY: { from: scale * 0.86, to: scale }, duration: 420, ease: "Back.Out" });
          if (grade > 0) popCoin(seed);
          else burstSparkles(scene, stage, spec.x, bodyY, { count: 10, radius: spec.chestHeight * 0.7, size: 11, colors: [0xffffff, 0xffe27a, 0xffc7a8], seed: seed * 7, rise: 10 });
        });
      } });
      card.once(Phaser.GameObjects.Events.DESTROY, () => bonk.remove());
    },
  };
}
