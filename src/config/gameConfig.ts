import type Phaser from "phaser";

export const BASE_WIDTH = 1080;
export const BASE_HEIGHT = 1920;

/**
 * 리미터 경계를 명목 프레임 간격보다 이만큼만 낮춰 잡는다.
 *
 * Phaser의 `stepLimitFPS`는 누적 delta가 `_limitRate` **이상**일 때만 콜백을 부른다. 그런데
 * 60Hz에서 `smoothStep`이 돌려주는 평균은 `1000/60`을 열 번 더해 나눈 `16.666666666666664`이고
 * 임계값 `1000/60`은 `16.666666666666668`이라, 이상적인 60Hz에서도 **부동소수점 한 자리 차이로
 * 늘 미달한다.** 그래서 두 프레임에 한 번만 그려 "60 제한"이 30fps가 되고 "30 제한"은 20fps가
 * 된다(v0.83.0까지 그랬다). 경계를 한 프레임 간격보다 낮춰 두면 제 주기로 온 프레임은 그대로
 * 통과하고, 그보다 빠른 주사율(120Hz)에서만 걸러진다.
 *
 * 0.5보다 커야 한다 — 그 아래로 내리면 주사율이 제한의 두 배인 기기에서 매 프레임이 통과해
 * 제한 자체가 사라진다. 0.9는 제한값의 1.11배까지의 주사율만 통과시킨다.
 */
export const FRAME_LIMIT_MARGIN = 0.9;

/** 기기 주사율과 무관하게 이 제한에서 실제로 쓸 누적 경계(ms). */
export function frameLimitRate(limit: 30 | 60): number {
  return (1000 / limit) * FRAME_LIMIT_MARGIN;
}

/** Phaser TimeStep의 단일 런타임 경계에서만 렌더/업데이트 호출 빈도를 바꾼다. */
export function applyFrameRateLimit(game: Phaser.Game, limit: 30 | 60): void {
  // TimeStep은 공개 setter가 없으나 시작 시 같은 필드로 limit를 구성하므로 이 어댑터 밖에서 내부값을 만지지 않는다.
  const loop = game.loop as Phaser.Core.TimeStep & { fpsLimit: number; hasFpsLimit: boolean; _limitRate: number };
  loop.fpsLimit = limit;
  loop.hasFpsLimit = true;
  // 1000/limit를 그대로 넣지 않는 이유는 위 FRAME_LIMIT_MARGIN 주석에 있다.
  loop._limitRate = frameLimitRate(limit);
}
