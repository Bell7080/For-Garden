/**
 * 전투 조작 칩(기여도·배속·자동 궁극기·연출)의 켜짐 연출 값.
 *
 * Phaser 없는 순수 모듈에 두는 이유는 회귀 테스트가 그리기 구현이 아니라 이 값을 읽어야 하기
 * 때문이다 — 그리는 것은 `ControlChip` 한 곳이다.
 *
 * **켜진 칩은 판이 노랗게 물들고 테두리를 빛이 돈다.** 글자색만 바꾸던 때는 켜진 것과 꺼진 것이
 * 같은 판이라 무엇이 돌고 있는지 글자를 읽어야 알았다. 도는 빛은 "지금 작동 중"을 말하는 흔한
 * 문법이라 따로 배우지 않아도 읽힌다.
 *
 * **단계가 오를수록 세진다**(배속 1.5 → 2 → 3). 빛이 빨리 돌고, 꼬리가 길어지고, 줄기가
 * 늘고, 판이 더 짙게 물든다. 켜고 끄기만 있는 칩(자동·연출·기여도)은 1단계를 쓴다.
 */
export interface ControlChipTier {
  /** 판을 물들이는 노란 겹의 진하기. */
  fillAlpha: number;
  /** 빛이 테두리를 한 바퀴 도는 시간(ms). */
  spinMs: number;
  /** 동시에 도는 빛 줄기 수. 둘레를 고르게 나눠 선다. */
  comets: number;
  /** 한 줄기의 꼬리 길이(둘레 대비). */
  tail: number;
  /** 줄기 선 두께와 그 밑에 까는 번짐 두께. */
  lineWidth: number;
  glowWidth: number;
  /** 번짐의 진하기. 겹쳐 밝아지는 합성이라 진하면 글자가 묻힌다. */
  glowAlpha: number;
}

export type ControlChipTierLevel = 1 | 2 | 3;

export const CONTROL_CHIP_ACTIVE = {
  /** 판을 물들이는 색. 강조색(금빛)과 같은 계열이다. */
  fill: 0xe8c45a,
  /** 늘 도는 줄기보다 옅게 둘레 전체를 한 번 두른다 — 줄기가 지나가지 않은 자리도 켜진 판으로 읽힌다. */
  outlineAlpha: 0.55,
  /** 줄기의 머리 색. 꼬리로 갈수록 강조색으로 잦아든다. */
  headColor: 0xfff4c8,
  /** 꼬리를 몇 토막으로 나눠 옅게 하는가. 많을수록 매끄럽지만 매 프레임 그리는 선이 는다. */
  segments: 14,
  tiers: {
    1: { fillAlpha: 0.2, spinMs: 2000, comets: 1, tail: 0.28, lineWidth: 3, glowWidth: 9, glowAlpha: 0.28 },
    2: { fillAlpha: 0.28, spinMs: 1300, comets: 2, tail: 0.24, lineWidth: 3.5, glowWidth: 12, glowAlpha: 0.36 },
    3: { fillAlpha: 0.36, spinMs: 850, comets: 3, tail: 0.2, lineWidth: 4, glowWidth: 16, glowAlpha: 0.46 },
  } satisfies Record<ControlChipTierLevel, ControlChipTier>,
} as const;

/** 닫힌 다각형(평평한 좌표 배열)의 둘레 길이. */
export function polygonPerimeter(points: readonly number[]): number {
  let total = 0;
  for (let index = 0; index < points.length; index += 2) {
    const next = (index + 2) % points.length;
    total += Math.hypot(points[next] - points[index], points[next + 1] - points[index + 1]);
  }
  return total;
}

/**
 * 둘레를 따라 `t`(0~1)만큼 간 자리. 꼭짓점 사이를 길이 비례로 나눠 빛이 모서리에서 멈칫하지 않고
 * 같은 빠르기로 돈다.
 */
export function perimeterPoint(points: readonly number[], t: number): { x: number; y: number } {
  const total = polygonPerimeter(points);
  let remaining = (((t % 1) + 1) % 1) * total;
  for (let index = 0; index < points.length; index += 2) {
    const next = (index + 2) % points.length;
    const length = Math.hypot(points[next] - points[index], points[next + 1] - points[index + 1]);
    if (remaining <= length || next === 0) {
      const ratio = length === 0 ? 0 : Math.min(1, remaining / length);
      return {
        x: points[index] + (points[next] - points[index]) * ratio,
        y: points[index + 1] + (points[next + 1] - points[index + 1]) * ratio,
      };
    }
    remaining -= length;
  }
  return { x: points[0], y: points[1] };
}
