import Phaser from "phaser";
import { ROULETTE_REWARDS, rouletteIndexAtPointer } from "../core/roulette";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { formatCurrency } from "../core/formatCurrency";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { drawGlyph } from "./glyphs";
import { addFramedIcon } from "./itemFrame";

/**
 * 행운의 돌림판 한 벌 — 팝업의 큰 바퀴와 이벤트 카드의 반쯤 솟은 작은 바퀴가 **같은 그림**을 쓴다.
 *
 * 화면 전체의 어두운 홀로그램 판 위에 서는 장난감이라, 바퀴만 사탕 빛 파스텔이다. 칸은 같은 크기로
 * 여덟이고(확률은 칸마다 다르며 확률 정보 창이 말한다), 젬 1,000 칸만 금빛 + 반짝이로 한눈에 갈린다.
 * 테두리에는 놀이공원 전구가 번갈아 깜빡이고, 바늘은 칸을 넘을 때마다 톡 튕긴다.
 */
export const ROULETTE_TONE = {
  /** 칸 여덟의 사탕 빛 — 이웃한 칸끼리 밝기와 색이 함께 갈린다. */
  slices: [0xffe7a3, 0xffbfd6, 0xc4f0dd, 0xffd8f0, 0xcfe2ff, 0xffd2b8, 0xe2d4ff, 0xbfeaf5],
  jackpot: 0xffc93f,
  jackpotRay: 0xfff4c2,
  rim: 0xff8fb8,
  rimDark: 0xc95a86,
  cream: 0xfff6e4,
  /** 장난감 결의 굵은 외곽선 — 검정보다 부드러운 짙은 자두빛. */
  ink: 0x4a2337,
  inkText: "#4a2337",
  bulbOn: 0xfff3a6,
  bulbOff: 0xb8577f,
  pointer: 0xff5f94,
  hub: 0xff8fb8,
} as const;

export interface RouletteWheelOptions {
  radius: number;
  /** 칸마다 수량 글자를 세운다. 작은 카드 바퀴는 그림만 둔다. */
  amounts: boolean;
  /** 테두리 전구 수. */
  bulbs: number;
}

export interface RouletteWheelParts {
  /** 도는 몸 — 칸·그림. 각도는 이 컨테이너의 `angle`이다. */
  readonly wheel: Phaser.GameObjects.Container;
  /** 칸 그림 받침. 바퀴가 돌아도 늘 똑바로 서도록 `syncHolders`가 거꾸로 돌린다. */
  readonly holders: Phaser.GameObjects.Container[];
  readonly pointer: Phaser.GameObjects.Container;
  /** 바퀴 각도가 바뀐 뒤 부른다 — 그림을 세우고, 바늘 밑 칸이 바뀌면 바늘을 톡 튕긴다. */
  sync(): void;
  /** 전구가 깜빡이는 빠르기 — 돌 때는 빠르게. */
  setBulbSpeed(scale: number): void;
  /** 바늘 아래 칸을 한 번 부풀린다. */
  celebrate(index: number): void;
  destroy(): void;
}

const point = (x: number, y: number): Phaser.Geom.Point => new Phaser.Geom.Point(x, y);

/** 네 갈래 반짝이 — 동그라미가 아니라 좌우 높이를 어긋나게 깎은 마름모 두 장(화면 전체의 반짝임 규칙). */
export function drawSparkle(graphics: Phaser.GameObjects.Graphics, x: number, y: number, size: number, color: number, alpha = 1): void {
  graphics.fillStyle(color, alpha);
  graphics.fillPoints([point(x, y - size), point(x + size * 0.28, y - size * 0.05), point(x, y + size), point(x - size * 0.26, y + size * 0.04)], true);
  graphics.fillPoints([point(x - size * 0.82, y), point(x, y - size * 0.22), point(x + size * 0.82, y), point(x, y + size * 0.24)], true);
}

/** 칸 하나의 가운데 각도(라디안). 첫 칸이 12시에 서고 시계 방향으로 돈다. */
export function rouletteSliceAngle(index: number): number {
  return -Math.PI / 2 + index * (Math.PI * 2 / ROULETTE_REWARDS.length);
}

export function addRouletteWheel(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, options: RouletteWheelOptions): RouletteWheelParts {
  const { radius } = options;
  const rimWidth = Math.max(14, radius * 0.11);
  const count = ROULETTE_REWARDS.length;
  const step = Math.PI * 2 / count;
  const ink = Math.max(3, radius * 0.016);
  const tweens: Phaser.Tweens.Tween[] = [];

  // 그림자 한 장 — 아래로 민 같은 원(장난감이 판 위에 놓인 것처럼).
  const shadow = scene.add.circle(x + radius * 0.03, y + radius * 0.07, radius + rimWidth + 4, 0x000000, 0.32);
  // 테두리 — 분홍 테 + 크림 안쪽 띠 + 짙은 외곽선.
  const rim = scene.add.graphics({ x, y });
  rim.fillStyle(ROULETTE_TONE.ink, 1).fillCircle(0, 0, radius + rimWidth + ink);
  rim.fillStyle(ROULETTE_TONE.rimDark, 1).fillCircle(0, ink * 0.8, radius + rimWidth);
  rim.fillStyle(ROULETTE_TONE.rim, 1).fillCircle(0, 0, radius + rimWidth - ink * 0.6);
  rim.fillStyle(ROULETTE_TONE.cream, 1).fillCircle(0, 0, radius + ink * 0.8);
  parent.add([shadow, rim]);

  // 전구 — 꺼진 바닥 한 벌 위에 짝·홀 두 벌이 번갈아 켜진다.
  const bulbRadius = rimWidth * 0.3;
  const bulbAt = (index: number): { x: number; y: number } => {
    const angle = -Math.PI / 2 + (index + 0.5) * Math.PI * 2 / options.bulbs;
    return { x: x + Math.cos(angle) * (radius + rimWidth * 0.52), y: y + Math.sin(angle) * (radius + rimWidth * 0.52) };
  };
  const bulbBase = scene.add.graphics();
  const bulbGroups = [scene.add.graphics(), scene.add.graphics()];
  for (let index = 0; index < options.bulbs; index += 1) {
    const at = bulbAt(index);
    bulbBase.fillStyle(ROULETTE_TONE.bulbOff, 1).fillCircle(at.x, at.y, bulbRadius);
    const lit = bulbGroups[index % 2];
    lit.fillStyle(ROULETTE_TONE.bulbOn, 0.35).fillCircle(at.x, at.y, bulbRadius * 1.9);
    lit.fillStyle(ROULETTE_TONE.bulbOn, 1).fillCircle(at.x, at.y, bulbRadius);
    lit.fillStyle(0xffffff, 0.9).fillCircle(at.x - bulbRadius * 0.3, at.y - bulbRadius * 0.3, bulbRadius * 0.35);
  }
  parent.add([bulbBase, ...bulbGroups]);
  const repeat = motionPolicy(session.settings).nonEssentialRepeatFactor > 0;
  bulbGroups[1].setAlpha(0.15);
  if (repeat) bulbGroups.forEach((group, index) => {
    tweens.push(scene.tweens.add({ targets: group, alpha: index === 0 ? 0.15 : 1, duration: 420, yoyo: true, repeat: -1, ease: "Stepped", easeParams: [2] }));
  });

  // 도는 몸.
  const wheel = scene.add.container(x, y);
  const faces = scene.add.graphics();
  ROULETTE_REWARDS.forEach((reward, index) => {
    const start = rouletteSliceAngle(index) - step / 2;
    const jackpot = reward.tier === "jackpot";
    faces.fillStyle(jackpot ? ROULETTE_TONE.jackpot : ROULETTE_TONE.slices[index % ROULETTE_TONE.slices.length], 1);
    faces.slice(0, 0, radius, start, start + step, false).fillPath();
    // 칸 안쪽의 옅은 띠 — 가운데로 갈수록 한 톤 밝아 바퀴가 말랑해 보인다(그라데이션이 아니라 띠 한 겹).
    faces.fillStyle(0xffffff, 0.22);
    faces.slice(0, 0, radius * 0.5, start, start + step, false).fillPath();
    if (jackpot) {
      // 금빛 칸에서 바깥으로 뻗는 빛줄기 셋.
      for (const offset of [-0.28, 0, 0.28]) {
        const angle = start + step / 2 + offset * step;
        faces.fillStyle(ROULETTE_TONE.jackpotRay, 0.55);
        faces.fillPoints([
          point(Math.cos(angle - 0.04) * radius * 0.3, Math.sin(angle - 0.04) * radius * 0.3),
          point(Math.cos(angle - 0.07) * radius * 0.97, Math.sin(angle - 0.07) * radius * 0.97),
          point(Math.cos(angle + 0.07) * radius * 0.97, Math.sin(angle + 0.07) * radius * 0.97),
          point(Math.cos(angle + 0.04) * radius * 0.3, Math.sin(angle + 0.04) * radius * 0.3),
        ], true);
      }
    }
  });
  // 칸 사이의 흰 칸막이와 끝의 작은 못.
  faces.lineStyle(Math.max(3, radius * 0.018), 0xffffff, 0.95);
  for (let index = 0; index < count; index += 1) {
    const angle = rouletteSliceAngle(index) - step / 2;
    faces.lineBetween(Math.cos(angle) * radius * 0.2, Math.sin(angle) * radius * 0.2, Math.cos(angle) * radius, Math.sin(angle) * radius);
    faces.fillStyle(ROULETTE_TONE.cream, 1).fillCircle(Math.cos(angle) * radius * 0.92, Math.sin(angle) * radius * 0.92, radius * 0.022);
  }
  wheel.add(faces);

  const holders: Phaser.GameObjects.Container[] = [];
  // 칸의 보상은 화면 어디서나 같은 **액자 + 우하단 수** 한 장이다(`addFramedIcon`). 대박 칸만 테가 금빛이다.
  const frameSize = radius * (options.amounts ? 0.3 : 0.32);
  const holderRadius = radius * 0.64;
  ROULETTE_REWARDS.forEach((reward, index) => {
    const angle = rouletteSliceAngle(index);
    const holder = scene.add.container(Math.cos(angle) * holderRadius, Math.sin(angle) * holderRadius);
    const jackpot = reward.tier === "jackpot";
    // 바퀴는 돌리는 판이라 칸을 눌러도 안내창을 열지 않는다(`plain`).
    addFramedIcon(scene, holder, 0, 0, frameSize, CURRENCY_ICON_BY_WALLET[reward.currency], {
      plain: true,
      color: jackpot ? ROULETTE_TONE.jackpot : undefined,
      amount: options.amounts ? formatCurrency(reward.amount) : undefined,
      amountColor: jackpot ? "#fff3b0" : "#ffffff",
      amountRatio: 0.3,
    });
    if (jackpot) {
      const sparkle = scene.add.graphics();
      drawSparkle(sparkle, frameSize * 0.5, -frameSize * 0.5, frameSize * 0.2, 0xffffff);
      drawSparkle(sparkle, -frameSize * 0.56, frameSize * 0.12, frameSize * 0.13, 0xffffff, 0.9);
      holder.add(sparkle);
      if (repeat) tweens.push(scene.tweens.add({ targets: sparkle, alpha: 0.25, duration: 520, yoyo: true, repeat: -1, ease: "Sine.InOut" }));
    }
    wheel.add(holder);
    holders.push(holder);
  });
  parent.add(wheel);

  // 가운데 뚜껑 — 분홍 단추 + 하트.
  const hub = scene.add.graphics({ x, y });
  const hubRadius = radius * 0.19;
  hub.fillStyle(ROULETTE_TONE.ink, 1).fillCircle(0, hubRadius * 0.12, hubRadius + ink);
  hub.fillStyle(ROULETTE_TONE.cream, 1).fillCircle(0, 0, hubRadius);
  hub.fillStyle(ROULETTE_TONE.hub, 1).fillCircle(0, 0, hubRadius * 0.74);
  hub.fillStyle(0xffffff, 0.7).fillCircle(-hubRadius * 0.28, -hubRadius * 0.3, hubRadius * 0.16);
  parent.add(hub);
  parent.add(drawGlyph(scene, "heart", x, y + hubRadius * 0.04, hubRadius * 0.9, 0xffffff, 1));

  // 바늘 — 12시의 분홍 물방울 핀. 칸을 넘을 때마다 톡 튕긴다.
  const pointer = scene.add.container(x, y - radius - rimWidth * 0.2);
  const pin = scene.add.graphics();
  const head = Math.max(12, radius * 0.085);
  const tipY = rimWidth * 0.2 + radius * 0.13;
  pin.fillStyle(ROULETTE_TONE.ink, 1);
  pin.fillCircle(0, -head * 0.9, head + ink);
  pin.fillTriangle(-head - ink * 0.7, -head * 0.6, head + ink * 0.7, -head * 0.6, 0, tipY + ink * 1.4);
  pin.fillStyle(ROULETTE_TONE.pointer, 1);
  pin.fillCircle(0, -head * 0.9, head);
  pin.fillTriangle(-head, -head * 0.62, head, -head * 0.62, 0, tipY);
  pin.fillStyle(0xffffff, 0.85).fillCircle(-head * 0.32, -head * 1.2, head * 0.3);
  pointer.add(pin);
  parent.add(pointer);

  let lastIndex = rouletteIndexAtPointer(wheel.angle);
  let kick: Phaser.Tweens.Tween | undefined;
  const sync = (): void => {
    holders.forEach((holder) => { holder.angle = -wheel.angle; });
    const index = rouletteIndexAtPointer(wheel.angle);
    if (index === lastIndex) return;
    lastIndex = index;
    kick?.stop();
    pointer.angle = -16;
    kick = scene.tweens.add({ targets: pointer, angle: 0, duration: 180, ease: "Back.Out" });
  };
  return {
    wheel, holders, pointer, sync,
    setBulbSpeed: (scale) => { tweens.forEach((tween) => { if (tween.targets.some((target) => bulbGroups.includes(target as Phaser.GameObjects.Graphics))) tween.timeScale = scale; }); },
    celebrate: (index) => {
      const holder = holders[index];
      if (holder) scene.tweens.add({ targets: holder, scale: 1.28, duration: 180, yoyo: true, repeat: 2, ease: "Back.Out" });
    },
    destroy: () => { tweens.forEach((tween) => tween.remove()); kick?.remove(); },
  };
}

export interface CurrencyRainOptions {
  left: number;
  right: number;
  top: number;
  bottom: number;
  count: number;
  size: number;
  alpha: number;
  /** 한 장이 위에서 아래까지 지나는 시간(ms). */
  fallMs: number;
}

/** 내리는 재화 — 바퀴가 주는 것들이 반짝이며 천천히 쏟아진다. */
export const ROULETTE_RAIN_KEYS = [
  CURRENCY_ICON_BY_WALLET.gems, CURRENCY_ICON_BY_WALLET.gold, CURRENCY_ICON_BY_WALLET.cheesecake,
  CURRENCY_ICON_BY_WALLET.gems, CURRENCY_ICON_BY_WALLET.stamina, CURRENCY_ICON_BY_WALLET.rawStone,
] as const;

/**
 * 재화 비를 깐다. 난수를 쓰지 않는다 — 번호에서 자리·빠르기·흔들림을 정해 열 때마다 같은 결로 내린다.
 * 움직임 줄이기에서는 흩어진 채 멈춰 선 그림만 남는다. 씬의 update 하나가 모두를 옮기고, 부모가 사라지면 함께 멈춘다.
 */
export function addCurrencyRain(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, options: CurrencyRainOptions): Phaser.GameObjects.Container {
  const layer = scene.add.container(0, 0);
  parent.add(layer);
  const span = options.bottom - options.top;
  const width = options.right - options.left;
  const drops = Array.from({ length: options.count }, (_, index) => {
    const lane = (index * 0.618034) % 1;
    const size = options.size * (0.72 + ((index * 37) % 10) / 22);
    const image = scene.add.image(options.left + lane * width, 0, ROULETTE_RAIN_KEYS[index % ROULETTE_RAIN_KEYS.length])
      .setDisplaySize(size, size).setAlpha(options.alpha * (0.7 + ((index * 53) % 10) / 33));
    layer.add(image);
    return { image, baseX: image.x, phase: (index * 0.377) % 1, speed: 0.78 + ((index * 29) % 10) / 22, sway: 10 + ((index * 17) % 10) * 2, spin: (index % 2 ? 1 : -1) * (40 + ((index * 13) % 10) * 9) };
  });
  const place = (elapsed: number): void => {
    for (const drop of drops) {
      const progress = (drop.phase + (elapsed / options.fallMs) * drop.speed) % 1;
      drop.image.y = options.top + progress * span;
      drop.image.x = drop.baseX + Math.sin((progress + drop.phase) * Math.PI * 4) * drop.sway;
      drop.image.angle = (elapsed / 1000) * drop.spin + drop.phase * 360;
      // 위아래 끝에서는 녹아 들어오고 녹아 나간다 — 판 가장자리에서 툭 끊기지 않는다.
      const edge = Math.min(progress, 1 - progress) / 0.12;
      drop.image.setVisible(true);
      drop.image.alpha = Math.min(1, edge) * options.alpha;
    }
  };
  place(0);
  if (motionPolicy(session.settings).nonEssentialRepeatFactor === 0) return layer;
  let elapsed = 0;
  const update = (_time: number, delta: number): void => {
    if (!layer.active) return;
    elapsed += delta;
    place(elapsed);
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, update);
  layer.once(Phaser.GameObjects.Events.DESTROY, () => scene.events.off(Phaser.Scenes.Events.UPDATE, update));
  return layer;
}
