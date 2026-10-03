import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";

/**
 * 잠금 덮개·자물쇠·토스트의 값 — Phaser를 모르는 순수 표다. 화면이 숫자를 따로 적으면 같은 잠금이 화면마다 다르게 보인다.
 */

/** 개방 연출의 박자(ms): 맥동 → 흔들림 → 하얗게 점멸 → 부풂 → 핑(터짐). 실제 시간이며 배속을 곱하지 않는다. */
export const UNLOCK_SEQUENCE = { pulse: 480, shake: 420, blink: 360, grow: 240, ping: 300 } as const;
export const UNLOCK_SEQUENCE_TOTAL_MS = UNLOCK_SEQUENCE.pulse + UNLOCK_SEQUENCE.shake + UNLOCK_SEQUENCE.blink + UNLOCK_SEQUENCE.grow + UNLOCK_SEQUENCE.ping;

/** 터질 때 튀는 조각 수와 거리. 난수 없이 번호에서 방향을 정하고 위로 튄다. */
export const UNLOCK_BURST = { shards: 10, reach: 130, rise: 60, flashAlpha: 0.5 } as const;

/** 덮개의 어둠 농도 — 아래 그림이 비치되 잠겼다는 것이 먼저 읽힌다. */
export const LOCK_COVER = { dimAlpha: 0.74, lockRatio: 0.5, lockMax: 84, plateRatio: 1.34 } as const;

/** 잠금·개방 토스트. 자리는 예전과 같고 뒤판이 글자를 받친다. */
export const LOCK_TOAST = {
  y: BASE_HEIGHT - 420,
  depth: 3000,
  height: 88,
  padX: 48,
  iconGap: 18,
  minWidth: 360,
  edgeMargin: 40,
  fillAlpha: 0.9,
  fontSize: 30,
  riseMs: 160,
  holdMs: 1500,
  fadeMs: 320,
  riseDistance: 22,
} as const;

/** 토스트 판 폭 — 글자 + 양옆 여백(아이콘이 있으면 그 자리까지), 화면 밖으로 나가지 않게 자른다. */
export function toastWidth(textWidth: number, withIcon: boolean): number {
  const raw = textWidth + LOCK_TOAST.padX * 2 + (withIcon ? 40 + LOCK_TOAST.iconGap : 0);
  return Math.min(BASE_WIDTH - LOCK_TOAST.edgeMargin * 2, Math.max(LOCK_TOAST.minWidth, Math.ceil(raw)));
}

export interface PadlockGeometry {
  body: { x: number; y: number; width: number; height: number };
  /** 고리 — 열린 꺾은선. */
  shackle: number[];
  shackleWidth: number;
  /** 열쇠 구멍 — 마름모. */
  keyhole: number[];
}

/** 자물쇠 한 개의 도형. 전체가 `size`짜리 정사각 안에 들고 몸통은 채우며 고리는 굵은 꺾은선이다(둥근 모서리 없이 각지게). */
export function padlockGeometry(size: number): PadlockGeometry {
  const s = size;
  return {
    body: { x: -0.43 * s, y: -0.02 * s, width: 0.86 * s, height: 0.5 * s },
    shackle: [-0.25 * s, -0.02 * s, -0.25 * s, -0.26 * s, -0.12 * s, -0.46 * s, 0.12 * s, -0.46 * s, 0.25 * s, -0.26 * s, 0.25 * s, -0.02 * s],
    shackleWidth: 0.12 * s,
    keyhole: [0, 0.14 * s, 0.07 * s, 0.23 * s, 0, 0.32 * s, -0.07 * s, 0.23 * s],
  };
}
