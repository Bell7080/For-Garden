import Phaser from "phaser";
import { gaugePosition } from "../core/shuteFishing";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import type { EventCardPuppet } from "./eventCardSd";
import { burstSparkles } from "./chestForgeFx";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { shapeClipMask } from "./popupArt";
import { addCurrencyRain } from "./rouletteWheel";
import { SHUTE_TONE, paintShuteGauge, shuteGaugeTrack } from "./shuteFishingStyle";

/** 리듬 낚시 이벤트 코인 그림 — 비와 창의 코인 칩이 같은 그림이다. */
export const SHUTE_EVENT_COIN_ICON = "currency-shute-rhythm-coin";

export interface ShuteCardShowcaseSpec {
  width: number;
  height: number;
  /** 게이지 가운데의 x(카드 가운데 기준). 게이지는 카드 밑변 가까이에 눕는다. */
  x: number;
  /** 게이지 판의 폭·높이(px). */
  gaugeWidth: number;
  gaugeHeight: number;
  /** 게이지 가운데가 카드 밑변에서 떨어진 거리(px). */
  lift: number;
  /** 바늘이 한쪽 끝에서 다른 끝까지 가는 시간(ms). */
  sweepMs: number;
  /** 슈테(SD)가 박자에 맞춰 탭하는 간격(ms). 탭할 때마다 칸이 번쩍이며 보물 하나가 튀어 오르고, 칸이 옮겨 간다. */
  tapMs: number;
  rain: { count: number; size: number; alpha: number; fallMs: number };
}

/** 칸이 옮겨 가는 자리와 튀어 오르는 보물 — 난수 없이 차례로 돈다. */
const ZONE_CENTERS = [0.62, 0.3, 0.74, 0.45, 0.22, 0.56] as const;
const POP_ICONS = [CURRENCY_ICON_BY_WALLET.gems, CURRENCY_ICON_BY_WALLET.gold, CURRENCY_ICON_BY_WALLET.cheesecake, CURRENCY_ICON_BY_WALLET.fossil] as const;

/**
 * 이벤트 카드의 리듬 낚시 장면 — 카드 밑변 가까이에 누운 작은 게이지와 오가는 바늘, 위로 내리는 리듬 코인.
 * 모두 카드 실루엣 안에서만 그려진다(돌림판·보물상자 장면과 같은 마스크). 원화·어둠 위, 제목 글 아래 층이다.
 *
 * 슈테(SD)가 도착하면 `attachTapper`로 넘겨받아 박자마다 게이지 쪽으로 까딱 탭한다 — 칸이 번쩍이고 보물 하나가
 * 반짝이와 함께 튀어 오른 뒤 칸이 다른 자리로 옮겨 간다. 「박자에 맞춰 누르면 낚인다」가 이 이벤트의 한 줄이다.
 * 움직임 줄이기에서는 바늘도 슈테도 멈추고 코인 비도 멈춘다.
 */
export function addShuteCardShowcase(
  scene: Phaser.Scene,
  card: Phaser.GameObjects.Container,
  shape: readonly number[],
  spec: ShuteCardShowcaseSpec,
): { attachTapper: (puppet: EventCardPuppet) => void } {
  const stage = scene.add.container(0, 0);
  card.add(stage);
  stage.setMask(shapeClipMask(scene, card, shape));
  addCurrencyRain(scene, stage, { left: -spec.width / 2 + 20, right: spec.width / 2 - 20, top: -spec.height / 2, bottom: spec.height / 2, keys: [SHUTE_EVENT_COIN_ICON], ...spec.rain });

  const gaugeY = spec.height / 2 - spec.lift;
  const gauge = scene.add.graphics().setPosition(spec.x, gaugeY);
  stage.add(gauge);
  let zone = 0;
  let flash = 0;
  let elapsed = 0;
  const paint = (): void => {
    paintShuteGauge(gauge, {
      width: spec.gaugeWidth, height: spec.gaugeHeight,
      zone: { center: ZONE_CENTERS[zone % ZONE_CENTERS.length], width: 0.22 },
      position: gaugePosition(spec.sweepMs, elapsed), flash, compact: true,
    });
  };
  paint();

  const loops = motionPolicy(session.settings).nonEssentialRepeatFactor > 0;
  if (loops) {
    const update = (_time: number, delta: number): void => {
      if (!card.active) return;
      elapsed += delta;
      flash = Math.max(0, flash - delta / 300);
      paint();
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, update);
    card.once(Phaser.GameObjects.Events.DESTROY, () => scene.events.off(Phaser.Scenes.Events.UPDATE, update));
  }

  /** 칸 자리에서 보물 하나가 위로 튀어 올랐다 녹는다. */
  const popTreasure = (seed: number): void => {
    const track = shuteGaugeTrack(spec.gaugeWidth, spec.gaugeHeight);
    const fromX = spec.x + track.left + ZONE_CENTERS[zone % ZONE_CENTERS.length] * track.width;
    const icon = scene.add.image(fromX, gaugeY - 10, POP_ICONS[seed % POP_ICONS.length]).setDisplaySize(46, 46);
    stage.add(icon);
    const size = icon.scale;
    scene.tweens.add({ targets: icon, y: gaugeY - 110, duration: 420, ease: "Quad.Out" });
    scene.tweens.add({ targets: icon, scale: { from: size * 0.6, to: size * 1.15 }, angle: { from: -12, to: 10 }, duration: 420, ease: "Back.Out" });
    scene.tweens.add({ targets: icon, alpha: 0, delay: 460, duration: 260, onComplete: () => icon.destroy() });
    burstSparkles(scene, stage, fromX, gaugeY - 8, { count: 7, radius: 44, size: 9, colors: [0xffffff, SHUTE_TONE.yellow, SHUTE_TONE.cyan], seed: seed * 11 + 3, rise: 18 });
  };

  return {
    attachTapper: (puppet) => {
      if (!loops) return;
      const restX = puppet.x;
      let count = 0;
      const tap = scene.time.addEvent({ delay: spec.tapMs, loop: true, callback: () => {
        if (!card.active || !puppet.active) return;
        count += 1;
        const seed = count;
        // 게이지 쪽(왼쪽)으로 까딱 — 기우는 끝에서 칸이 번쩍이고 보물이 튄다.
        scene.tweens.add({ targets: puppet, angle: -8, x: restX - 14, duration: 120, yoyo: true, ease: "Sine.InOut" });
        scene.time.delayedCall(120, () => {
          if (!card.active) return;
          flash = 1;
          popTreasure(seed);
          zone += 1;
        });
      } });
      card.once(Phaser.GameObjects.Events.DESTROY, () => tap.remove());
    },
  };
}
