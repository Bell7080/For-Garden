/**
 * 한계 돌파·공명 확정 창의 **뒷배경 도형** — Phaser 없는 순수 규칙(응태 요청 2026-11-24, 「팝업 자체가 한계를 돌파하는 느낌」).
 *
 * 판 한 장이 곧 「한계」다. 등급 표식 줄을 가로지르는 **눈금 한계선**이 가운데(`▶` 자리)에서 깨져 벌어지고, 그 틈으로
 * 아래에서 차오른 빛이 위로 뚫고 나가며 부서진 마름모 조각이 위로 튄다. 판 밑에서는 옅은 빛 알갱이가 쉬지 않고 떠오른다.
 *
 * 화면 전체의 규칙을 그대로 지킨다 — 동그라미가 아니라 마름모, 아래로 쏟지 않고 위로, 섬광은 옅게, **난수 없이**
 * 번호에서 자리를 정한다(같은 창이 늘 같은 그림이다). 모든 좌표는 판 가운데가 (0, 0)인 국소 좌표다.
 */
import { POPUP_BODY_BEVEL_RATIO } from "./popupGeometry";

export const BREAK_BACKDROP = {
  /** 판 밑에서 차오르는 빛 — 판 높이의 이만큼까지 번진다. */
  rise: { reach: 0.62, alpha: 0.3 },
  /** 깨진 자리에서 퍼지는 빛무리(눌린 타원 대신 그라데이션 한 장). 숨 쉬는 몫은 `pulse`. */
  burst: { radius: 360, squash: 0.62, alpha: 0.42, pulse: { from: 0.55, to: 1, duration: 1500 } },
  /** 깨진 자리에서 위로 부채처럼 뻗는 빛줄기. */
  rays: { count: 9, spreadDegrees: 128, length: 760, halfWidthDegrees: 3.2, alpha: 0.11 },
  /** 한계선 — 판 가장자리에서 이만큼 들어와 시작하고, 가운데가 `gap`만큼 벌어진다. */
  limit: { inset: 34, gap: 58, tickEvery: 46, tickHeight: 10, majorEvery: 4, alpha: 0.42, lift: 22 },
  /** 깨진 틈에서 위로 튄 마름모 조각(그 자리에 멈춘 순간). */
  shards: { count: 9, spreadDegrees: 140, nearest: 46, farthest: 230, size: [26, 9] as const, alpha: [0.85, 0.3] as const },
  /** 판 밑에서 떠오르는 알갱이 — 한 자리 수 남짓으로 끊는다. */
  motes: { count: 11, size: [16, 8] as const, travel: 0.72, duration: [3600, 5200] as const, alpha: 0.55 },
} as const;

export interface BackdropPoint { x: number; y: number }

/** 팝업 몸판의 실루엣(왼쪽 위·오른쪽 아래만 깎인다) — `PopupLayer`가 그리는 판과 같은 비율이다. */
export function backdropSilhouette(width: number, height: number): BackdropPoint[] {
  const bevel = Math.min(width, height) * POPUP_BODY_BEVEL_RATIO;
  const hw = width / 2;
  const hh = height / 2;
  return [
    { x: -hw, y: -hh + bevel }, { x: -hw + bevel, y: -hh }, { x: hw, y: -hh },
    { x: hw, y: hh - bevel }, { x: hw - bevel, y: hh }, { x: -hw, y: hh },
  ];
}

/** 깎인 모서리를 피한 안쪽 네모 — 움직이는 것은 이 안에만 서야 판 밖으로 삐져나오지 않는다. */
export function backdropSafeBox(width: number, height: number): { left: number; right: number; top: number; bottom: number } {
  const bevel = Math.min(width, height) * POPUP_BODY_BEVEL_RATIO;
  return { left: -width / 2 + bevel, right: width / 2 - bevel, top: -height / 2 + bevel, bottom: height / 2 - bevel };
}

/** 점이 실루엣 안에 드는가(볼록 다각형). */
export function insideSilhouette(width: number, height: number, point: BackdropPoint): boolean {
  const shape = backdropSilhouette(width, height);
  for (let i = 0; i < shape.length; i += 1) {
    const a = shape[i];
    const b = shape[(i + 1) % shape.length];
    if ((b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x) < 0) return false;
  }
  return true;
}

/**
 * 한계선의 두 토막. 가운데가 벌어지고 **깨진 끝은 위로 꺾여 들린다** — 밑에서 밀어 올려 부러진 선으로 읽힌다.
 * 각 토막은 판 가장자리에서 틈 쪽으로 가는 꺾은선이다.
 */
export function limitLineSegments(width: number, y: number): { left: BackdropPoint[]; right: BackdropPoint[] } {
  const { inset, gap, lift } = BREAK_BACKDROP.limit;
  const edge = width / 2 - inset;
  const half = gap / 2;
  const bend = half + 54;
  const side = (sign: number): BackdropPoint[] => [
    { x: sign * edge, y },
    { x: sign * bend, y },
    { x: sign * (half + 22), y: y - lift * 0.45 },
    { x: sign * half, y: y - lift },
  ];
  return { left: side(-1), right: side(1) };
}

/** 한계선 눈금의 x — 틈 근처(꺾인 구간)에는 세우지 않는다. 큰 눈금은 `majorEvery`마다. */
export function limitTicks(width: number): { x: number; major: boolean }[] {
  const { inset, gap, tickEvery, majorEvery } = BREAK_BACKDROP.limit;
  const edge = width / 2 - inset;
  const stop = gap / 2 + 54;
  const ticks: { x: number; major: boolean }[] = [];
  for (let step = 0; ; step += 1) {
    const x = edge - step * tickEvery;
    if (x < stop) break;
    ticks.push({ x, major: step % majorEvery === 0 }, { x: -x, major: step % majorEvery === 0 });
  }
  return ticks;
}

/** 틈에서 뻗는 금 — 깨진 끝 둘에서 위아래로 짧게 갈라진다. 고정된 꺾임표라 늘 같은 그림이다. */
export function limitCracks(y: number): BackdropPoint[][] {
  const { gap, lift } = BREAK_BACKDROP.limit;
  const half = gap / 2;
  const top = y - lift;
  const shape = (sign: number): BackdropPoint[][] => [
    [{ x: sign * half, y: top }, { x: sign * (half + 16), y: top - 30 }, { x: sign * (half + 8), y: top - 52 }, { x: sign * (half + 30), y: top - 84 }],
    [{ x: sign * (half + 22), y: y - lift * 0.45 }, { x: sign * (half + 48), y: y + 18 }, { x: sign * (half + 40), y: y + 40 }],
    [{ x: sign * (half + 54), y }, { x: sign * (half + 76), y: y - 24 }],
  ];
  return [...shape(-1), ...shape(1)];
}

/** 위로 뻗는 빛줄기의 각도(라디안, 화면 좌표라 위가 음수). 부채를 고르게 나눈다. */
export function backdropRayAngles(): number[] {
  const { count, spreadDegrees } = BREAK_BACKDROP.rays;
  const spread = (spreadDegrees * Math.PI) / 180;
  const step = spread / count;
  return Array.from({ length: count }, (_, index) => -Math.PI / 2 - spread / 2 + step * (index + 0.5));
}

export interface BackdropShard { x: number; y: number; size: number; angle: number; alpha: number }

/** 틈에서 위로 튄 조각 — 부채를 고르게 나누고 거리는 번호로 번갈아 둔다(가까운 것이 크고 진하다). */
export function backdropShards(y: number): BackdropShard[] {
  const { count, spreadDegrees, nearest, farthest, size, alpha } = BREAK_BACKDROP.shards;
  const spread = (spreadDegrees * Math.PI) / 180;
  const step = spread / count;
  const distances = [0.15, 0.7, 0.4, 1, 0.25, 0.85, 0.55, 0.05, 0.95];
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 - spread / 2 + step * (index + 0.5);
    const t = distances[index % distances.length];
    const distance = nearest + (farthest - nearest) * t;
    return {
      x: Math.cos(angle) * distance,
      y: y - BREAK_BACKDROP.limit.lift + Math.sin(angle) * distance,
      size: size[0] + (size[1] - size[0]) * t,
      angle: angle + Math.PI / 2 + (index % 2 === 0 ? 0.35 : -0.3),
      alpha: alpha[0] + (alpha[1] - alpha[0]) * t,
    };
  });
}

export interface BackdropMote { x: number; fromY: number; toY: number; size: number; duration: number; delay: number }

/** 떠오르는 알갱이 — 안쪽 네모 안에서만 오르내린다. 자리·박자는 번호로 정한다(황금비 걸음). */
export function backdropMotes(width: number, height: number): BackdropMote[] {
  const { count, size, travel, duration } = BREAK_BACKDROP.motes;
  const box = backdropSafeBox(width, height);
  const margin = 20;
  const left = box.left + margin;
  const span = box.right - margin - left;
  const bottom = box.bottom - margin;
  const reach = (box.bottom - box.top - margin * 2) * travel;
  return Array.from({ length: count }, (_, index) => {
    const t = (index * 0.618034) % 1;
    const u = (index * 0.381966 + 0.21) % 1;
    const length = duration[0] + (duration[1] - duration[0]) * u;
    return {
      x: left + span * t,
      fromY: bottom,
      toY: bottom - reach * (0.7 + 0.3 * u),
      size: size[0] + (size[1] - size[0]) * u,
      duration: length,
      delay: (index / count) * length,
    };
  });
}
