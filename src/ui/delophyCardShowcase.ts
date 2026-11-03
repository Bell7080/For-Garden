import Phaser from "phaser";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { burstSparkles } from "./chestForgeFx";
import { DELOPHY_COIN_ICON, paintBack, paintTreasureFace } from "./delophyCardArt";
import type { EventCardPuppet } from "./eventCardSd";
import { shapeClipMask } from "./popupArt";
import { addCurrencyRain } from "./rouletteWheel";

export interface DelophyCardShowcaseSpec {
  width: number;
  height: number;
  /** 카드 부채의 가운데 x(카드 가운데 기준). */
  x: number;
  /** 엎은 카드 한 장의 폭. 높이는 창의 카드와 같은 1.42배다. */
  cardWidth: number;
  /** 카드 사이 간격(가운데에서 가운데까지). */
  spread: number;
  /** 카드 밑변이 판 밑변 아래로 묻히는 깊이(px). */
  sink: number;
  /** 델로피가 카드를 한 번 섞는 간격(ms). 세 번째마다 한 장이 뒤집혀 보물을 보인다. */
  shuffleMs: number;
  rain: { count: number; size: number; alpha: number; fallMs: number };
}

/** 가끔 뒤집혀 보이는 보물 — 차례로 돈다(난수 없이). 대박을 말하는 젬이 가장 자주 선다. */
const PEEK_ICONS = ["currency-gems", "currency-gold", "currency-gems", "currency-amber", "currency-gems", "currency-fossil"] as const;
const SLANT = [-11, 0, 11] as const;

/**
 * 이벤트 카드의 델로피 장면 — 카드 밑변에 엎어 둔 카드 세 장(창과 같은 뒷면), 그 위로 내리는 도둑 코인.
 * 모두 카드 실루엣 안에서만 그려진다(돌림판·보물상자 장면과 같은 마스크). 원화·어둠 위, 제목 글 아래 층이다.
 *
 * 델로피(SD)가 도착하면 `attachShuffler`로 넘겨받아 가끔 카드 쪽으로 몸을 틀며 두 장을 휙 바꿔 놓고, 세 번째마다
 * 가운데 한 장을 슬쩍 뒤집어 보물을 보였다가 다시 엎는다 — 「섞인 카드 속 보물을 찾는다」가 이 이벤트의 한 줄이다.
 * 움직임 줄이기에서는 카드도 델로피도 멈춰 서고 코인 비도 멈춘다.
 */
export function addDelophyCardShowcase(
  scene: Phaser.Scene,
  card: Phaser.GameObjects.Container,
  shape: readonly number[],
  spec: DelophyCardShowcaseSpec,
): { attachShuffler: (puppet: EventCardPuppet) => void } {
  const stage = scene.add.container(0, 0);
  card.add(stage);
  stage.setMask(shapeClipMask(scene, card, shape));
  addCurrencyRain(scene, stage, { left: -spec.width / 2 + 20, right: spec.width / 2 - 20, top: -spec.height / 2, bottom: spec.height / 2, keys: [DELOPHY_COIN_ICON], ...spec.rain });

  const cardHeight = Math.round(spec.cardWidth * 1.42);
  const baseY = spec.height / 2 + spec.sink - cardHeight / 2;
  // 뒤로 은은한 보랏빛 무대 — 엎은 카드가 원화 속에 묻히지 않게 한다.
  const aura = scene.add.graphics();
  for (let ring = 4; ring >= 1; ring -= 1) aura.fillStyle(0xb48cff, 0.05 * (5 - ring)).fillEllipse(spec.x, baseY + 10, spec.spread * (1.6 + ring * 0.5), cardHeight * (0.6 + ring * 0.28));
  stage.add(aura);
  const slots = SLANT.map((angle, index) => ({ x: spec.x + (index - 1) * spec.spread, y: baseY + Math.abs(index - 1) * 8, angle }));
  // `order[i]`는 i번 자리에 선 카드다 — 바꿔 놓을 때마다 자리만 바뀌고 카드는 그대로다.
  const holders = slots.map((slot) => {
    const holder = scene.add.container(slot.x, slot.y).setAngle(slot.angle);
    paintBack(scene, holder, spec.cardWidth, cardHeight);
    stage.add(holder);
    return holder;
  });
  const order = [0, 1, 2];

  return {
    attachShuffler: (puppet) => {
      if (motionPolicy(session.settings).nonEssentialRepeatFactor <= 0) return;
      const restX = puppet.x;
      let beat = 0, peeking = false;
      const shuffle = scene.time.addEvent({ delay: spec.shuffleMs, loop: true, callback: () => {
        if (!card.active || !puppet.active || peeking) return;
        beat += 1;
        scene.tweens.add({ targets: puppet, angle: -8, x: restX - 14, duration: 140, yoyo: true, ease: "Sine.InOut" });
        if (beat % 3 === 0) {
          // 가운데 한 장을 슬쩍 뒤집어 보물을 보이고 다시 엎는다.
          peeking = true;
          const holder = holders[order[1]];
          const icon = PEEK_ICONS[(beat / 3 - 1) % PEEK_ICONS.length];
          scene.tweens.add({ targets: holder, y: slots[1].y - 22, scaleX: 0.02, duration: 110, ease: "Quad.In", onComplete: () => {
            if (!holder.active) return;
            paintTreasureFace(scene, holder, spec.cardWidth, cardHeight, icon);
            burstSparkles(scene, stage, holder.x, holder.y, { count: 7, radius: 70, size: 10, colors: [0xffffff, 0xffe38a, 0xd6c2ff], seed: beat, rise: 16 });
            scene.tweens.add({ targets: holder, scaleX: 1.08, scaleY: 1.08, duration: 130, ease: "Back.Out" });
            scene.tweens.add({ targets: holder, scaleX: 0.02, scaleY: 1, delay: 760, duration: 100, ease: "Quad.In", onComplete: () => {
              if (!holder.active) return;
              paintBack(scene, holder, spec.cardWidth, cardHeight);
              scene.tweens.add({ targets: holder, scaleX: 1, y: slots[1].y, duration: 120, ease: "Quad.Out", onComplete: () => { peeking = false; } });
            } });
          } });
          return;
        }
        // 두 장이 휙 자리를 바꾼다 — 한 장은 위로, 한 장은 아래로 곡선을 그린다.
        const pair = beat % 3 === 1 ? [0, 1] : [1, 2];
        const [a, b] = pair.map((slot) => holders[order[slot]]);
        const [sa, sb] = pair.map((slot) => slots[slot]);
        stage.bringToTop(a);
        scene.tweens.addCounter({ from: 0, to: 1, duration: 260, ease: "Sine.InOut", onUpdate: (tween) => {
          const v = tween.getValue() ?? 0, lift = Math.sin(Math.PI * v) * 26;
          a.setPosition(sa.x + (sb.x - sa.x) * v, sa.y + (sb.y - sa.y) * v - lift).setAngle(sa.angle + (sb.angle - sa.angle) * v);
          b.setPosition(sb.x + (sa.x - sb.x) * v, sb.y + (sa.y - sb.y) * v + lift * 0.4).setAngle(sb.angle + (sa.angle - sb.angle) * v);
        } });
        [order[pair[0]], order[pair[1]]] = [order[pair[1]], order[pair[0]]];
      } });
      card.once(Phaser.GameObjects.Events.DESTROY, () => shuffle.remove());
    },
  };
}
