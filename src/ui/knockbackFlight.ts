import { KNOCKBACK, type Arena } from "../core/skirmish";

/**
 * 튕겨 날아가는 한 구간. 벽에 닿을 때마다 하나씩 끊긴다.
 *
 * 좌표를 미리 다 계산해 두는 이유는, 화면이 매 프레임 위치를 적분하면 배속과 프레임 시간에
 * 따라 튕기는 자리가 달라지기 때문이다. 구간으로 끊어 두면 tween 하나가 그 구간을 맡고
 * 배속이 바뀌어도 **부딪히는 자리는 그대로**다.
 */
export interface FlightLeg {
  x: number;
  y: number;
  /** 이 구간을 지나는 데 걸리는 시간(ms). */
  durationMs: number;
  /** 이 구간의 끝이 벽인가. 벽에 닿는 순간에만 튕기는 반응을 낸다. */
  bounced: boolean;
}

export interface FlightOptions {
  x: number;
  y: number;
  vx: number;
  vy: number;
  arena: Arena;
  /**
   * 벽에 부딪히는 횟수. 이 수를 다 채우면 궤적이 끝난다.
   *
   * 끝을 시간이 아니라 횟수로 정하는 이유는, 시간으로 끊으면 전장 크기와 속도에 따라 어떤
   * 판에서는 두 번, 어떤 판에서는 다섯 번 튕겨 같은 연출이 다른 무게로 읽히기 때문이다.
   */
  bounces: number;
  /** 한 번 튕길 때마다 남는 속도의 비율. 코어의 `KNOCKBACK.restitution`과 같은 값을 기본으로 쓴다. */
  restitution?: number;
  /** 이 속도 아래로 떨어지면 남은 횟수와 무관하게 그 자리에 선다(0으로 나누지 않기 위한 경계이기도 하다). */
  minSpeed?: number;
}

/** 벽에 닿을 때마다 방향만 뒤집으며 정해진 횟수만큼 전장 안을 가로지르는 궤적을 구한다. */
export function knockbackFlightPath(options: FlightOptions): FlightLeg[] {
  const { arena, restitution = KNOCKBACK.restitution, minSpeed = 40 } = options;
  const legs: FlightLeg[] = [];
  let { x, y, vx, vy } = options;

  for (let bounce = 0; bounce < Math.max(0, options.bounces); bounce += 1) {
    const speed = Math.hypot(vx, vy);
    if (speed < minSpeed) break;
    // 각 벽까지 남은 시간 중 가장 이른 것이 이번 구간의 끝이다.
    const timeToWall = Math.min(
      vx > 0 ? (arena.right - x) / vx : vx < 0 ? (arena.left - x) / vx : Infinity,
      vy > 0 ? (arena.bottom - y) / vy : vy < 0 ? (arena.top - y) / vy : Infinity,
    );
    if (!Number.isFinite(timeToWall)) break;
    const step = Math.max(0, timeToWall);
    x += vx * step;
    y += vy * step;
    legs.push({ x, y, durationMs: step * 1_000, bounced: true });
    // 닿은 변만 뒤집는다. 모서리에서는 둘 다 뒤집혀 온 길로 되돌아간다.
    if (x <= arena.left + 1e-3 || x >= arena.right - 1e-3) vx = -vx;
    if (y <= arena.top + 1e-3 || y >= arena.bottom - 1e-3) vy = -vy;
    vx *= restitution;
    vy *= restitution;
  }

  // 마지막 튕김 뒤에도 속도가 남아 있으면 짧게 미끄러지며 선다 — 벽에 붙은 채 끝나지 않는다.
  const speed = Math.hypot(vx, vy);
  if (legs.length > 0 && speed >= minSpeed) {
    const glide = 0.12;
    const nextX = Math.min(arena.right, Math.max(arena.left, x + vx * glide));
    const nextY = Math.min(arena.bottom, Math.max(arena.top, y + vy * glide));
    legs.push({ x: nextX, y: nextY, durationMs: glide * 1_000, bounced: false });
  }
  return legs;
}
