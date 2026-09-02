import type { RunePart } from "../core/runes";

/**
 * 조각 원화에서 실제로 그림이 있는 자리(알파 경계).
 *
 * 조각 셋은 하트 한 장을 부채꼴로 가른 것이라 **저마다 캔버스의 다른 자리**를 쓴다 — 1번은
 * 왼쪽 위, 2번은 오른쪽 위, 3번은 아래 가운데다. 셋을 같은 중심으로 겹치면 하트가 되므로
 * 하트를 세우는 자리(정보창의 젬 슬롯)에서는 그 자리를 그대로 둬야 한다. 반대로 **액자
 * 한 칸에는 조각 하나만** 서므로, 캔버스 그대로 넣으면 그림이 칸 한쪽으로 쏠려 앉는다.
 *
 * 값은 `public/sprites/runes/*.webp`의 알파 경계를 실측한 비율(0~1)이고 등급이 달라도 같다 —
 * `scripts/prepare_icons.py`가 같은 부채꼴 마스크로 오리기 때문이다. 아트를 다시 구우면 같은
 * 방법으로 다시 재서 이 표만 고친다.
 */
export const RUNE_PIECE_CONTENT: Readonly<Record<RunePart, { left: number; top: number; right: number; bottom: number }>> = {
  0: { left: 0.1875, top: 0.2070, right: 0.5039, bottom: 0.5703 },
  1: { left: 0.5000, top: 0.2070, right: 0.8281, bottom: 0.5703 },
  2: { left: 0.2695, top: 0.4375, right: 0.7344, bottom: 0.8203 },
};

/** 조각 이미지를 세울 때 쓰는 세로 기준점. `prepare_icons.py`의 `RUNE_CENTER_Y`와 같다. */
const ORIGIN_Y = 0.44;

/** 액자 한 칸에 조각을 앉히는 자리와 크기. */
export interface RunePieceFit {
  /** 원본 캔버스 전체를 이만큼으로 늘려 그린다(`setDisplaySize`). */
  size: number;
  /** 기준점(0.5, 0.44)을 둘 자리. 액자 중심 기준의 국소 좌표다. */
  x: number;
  y: number;
  /** 실제로 보이는 그림의 한 변. 그림자 거리처럼 "보이는 크기"를 따라야 하는 값이 쓴다. */
  content: number;
}

/**
 * 조각의 **보이는 부분**을 액자 한가운데에 가장 크게 앉힌다.
 *
 * 캔버스가 아니라 알파 경계를 기준으로 맞추므로, 자리마다 다른 여백이 그대로 상쇄된다.
 * `fill`은 액자 한 변 대비 그림이 차지할 비율이다 — 1에 가까우면 잘린 모서리와 안쪽
 * 비네트에 그림이 닿는다.
 */
export function runePieceFit(part: RunePart, frameSize: number, fill: number): RunePieceFit {
  const box = RUNE_PIECE_CONTENT[part];
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  const size = (frameSize * fill) / Math.max(width, height);
  return {
    size,
    x: -((box.left + box.right) / 2 - 0.5) * size,
    y: -((box.top + box.bottom) / 2 - ORIGIN_Y) * size,
    content: frameSize * fill,
  };
}
