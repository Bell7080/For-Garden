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
  seconds: number;
  arena: Arena;
  /** 한 번 튕길 때마다 남는 속도의 비율. 코어의 `KNOCKBACK.restitution`과 같은 값을 기본으로 쓴다. */
  restitution?: number;
  /** 안전장치. 이 수를 넘게 튕기면 남은 시간을 마지막 구간에 몰아 끝낸다. */
  maxBounces?: number;
}

/** 벽에 닿을 때마다 방향만 뒤집으며 전장 안을 가로지르는 궤적을 구한다. */
export function knockbackFlightPath(options: FlightOptions): FlightLeg[] {
  const { arena, restitution = KNOCKBACK.restitution, maxBounces = 8 } = options;
  const legs: FlightLeg[] = [];
  let { x, y, vx, vy } = options;
  let remaining = Math.max(0, options.seconds);

  for (let bounce = 0; bounce <= maxBounces && remaining > 1e-4; bounce += 1) {
    const speed = Math.hypot(vx, vy);
    // 속도를 다 잃으면 남은 시간 동안 그 자리에 머문다 — 0으로 나누지 않기 위한 경계이기도 하다.
    if (speed < 1e-4) {
      legs.push({ x, y, durationMs: remaining * 1_000, bounced: false });
      remaining = 0;
      break;
    }
    // 각 벽까지 남은 시간 중 가장 이른 것이 이번 구간의 끝이다.
    const timeToWall = Math.min(
      vx > 0 ? (arena.right - x) / vx : vx < 0 ? (arena.left - x) / vx : Infinity,
      vy > 0 ? (arena.bottom - y) / vy : vy < 0 ? (arena.top - y) / vy : Infinity,
    );
    const step = Math.min(remaining, Math.max(0, timeToWall));
    x += vx * step;
    y += vy * step;
    remaining -= step;
    const hitsWall = remaining > 1e-4 && bounce < maxBounces;
    legs.push({ x, y, durationMs: step * 1_000, bounced: hitsWall });
    if (!hitsWall) break;
    // 닿은 변만 뒤집는다. 모서리에서는 둘 다 뒤집혀 온 길로 되돌아간다.
    if (x <= arena.left + 1e-3 || x >= arena.right - 1e-3) vx = -vx;
    if (y <= arena.top + 1e-3 || y >= arena.bottom - 1e-3) vy = -vy;
    vx *= restitution;
    vy *= restitution;
  }

  // 시간이 남았는데 튕길 횟수를 다 쓴 경우, 마지막 자리에서 남은 시간을 흘려보낸다.
  if (remaining > 1e-4) legs.push({ x, y, durationMs: remaining * 1_000, bounced: false });
  return legs;
}
