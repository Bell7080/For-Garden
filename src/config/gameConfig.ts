import type Phaser from "phaser";

export const BASE_WIDTH = 1080;
export const BASE_HEIGHT = 1920;

/** Phaser TimeStep의 단일 런타임 경계에서만 렌더/업데이트 호출 빈도를 바꾼다. */
export function applyFrameRateLimit(game: Phaser.Game, limit: 30 | 60): void {
  // TimeStep은 공개 setter가 없으나 시작 시 같은 필드로 limit를 구성하므로 이 어댑터 밖에서 내부값을 만지지 않는다.
  const loop = game.loop as Phaser.Core.TimeStep & { fpsLimit: number; hasFpsLimit: boolean; _limitRate: number };
  loop.fpsLimit = limit;
  loop.hasFpsLimit = true;
  loop._limitRate = 1000 / limit;
}
