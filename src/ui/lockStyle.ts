import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";

/**
 * 잠금 덮개·자물쇠·토스트의 값 — Phaser를 모르는 순수 표다. 화면이 숫자를 따로 적으면 같은 잠금이 화면마다 다르게 보인다.
 */

/**
 * 개방 연출의 박자(ms): 깨어남(잠긴 칸이 밝아지고 자물쇠가 살짝 움츠린다) → 덜컥(잦아드는 흔들림) → 찰칵(고리가 튀어 올라
 * 옆으로 젖혀진다) → 머묾 → 놓음(자물쇠가 위로 떠오르며 녹고 덮개가 걷힌다). 실제 시간이며 배속을 곱하지 않는다.
 */
export const UNLOCK_SEQUENCE = { wake: 260, jiggle: 340, open: 260, hold: 180, release: 380 } as const;
export const UNLOCK_SEQUENCE_TOTAL_MS = UNLOCK_SEQUENCE.wake + UNLOCK_SEQUENCE.jiggle + UNLOCK_SEQUENCE.open + UNLOCK_SEQUENCE.hold + UNLOCK_SEQUENCE.release;

/** 놓을 때 남는 것 — 옅은 마름모 섬광 하나와 위로 뜨는 작은 조각 몇 개. 터뜨리지 않고 흩어지게 둔다. */
export const UNLOCK_BURST = { shards: 6, reach: 70, rise: 70, flashAlpha: 0.32 } as const;

/** 찰칵의 몸짓 — 고리가 자물쇠 크기의 몇 배만큼 올라가 몇 도 젖혀지는지, 흔들림의 첫 각도. */
export const UNLOCK_MOTION = { shackleLift: 0.16, shackleTilt: -32, jiggleAngle: 9, jiggleTurns: 3, releaseRise: 0.45 } as const;

/** 덮개의 어둠 농도 — 아래 그림이 비치되 잠겼다는 것이 먼저 읽힌다. */
export const LOCK_COVER = { dimAlpha: 0.74, lockRatio: 0.5, lockMax: 84 } as const;

/**
 * 「꺼진」 칸의 모습 — 상점·친구 같은 레일 칩과 하단 탭, 로비의 작은 입구가 같은 값으로 흐려진다.
 * 판은 반쯤 비치고 글자는 더 흐리며, 원래 아이콘 자리를 대신 선 자물쇠는 회색이다.
 */
export const LOCK_DIM = { plateAlpha: 0.4, labelAlpha: 0.38, lockAlpha: 0.72, entranceAlpha: 0.38, lockColor: 0x9aa3ad } as const;

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
  /** 몸통 — 왼쪽 위·오른쪽 아래를 깎은 칩(다른 UI 칩과 같은 결). */
  body: { x: number; y: number; width: number; height: number; bevel: number };
  /** 고리 — 열린 꺾은선. 두 다리 끝은 몸통 안으로 들어가 이음매가 보이지 않는다. */
  shackle: number[];
  shackleWidth: number;
  /** 고리가 열릴 때 도는 축 — 왼쪽 다리의 밑동. */
  pivot: { x: number; y: number };
  /** 열쇠 구멍 머리 — 마름모. 몸통에서 뚫어 낸다. */
  keyhole: number[];
  /** 열쇠 구멍 꼬리 — 마름모 아래로 내려오는 좁은 홈. */
  keyslot: { x: number; y: number; width: number; height: number };
}

/**
 * 자물쇠 한 개의 도형 — 다른 아이콘처럼 **한 색으로 채운 실루엣**이다. 몸통은 모서리를 어긋나게 깎은 칩, 고리는 굵은
 * 각진 띠, 열쇠 구멍은 몸통에서 뚫어 낸 빈자리라 판 위에 얹으면 그 판이 비친다. 전체가 `size`짜리 정사각 안에 든다.
 */
export function padlockGeometry(size: number): PadlockGeometry {
  const s = size;
  return {
    body: { x: -0.42 * s, y: -0.06 * s, width: 0.84 * s, height: 0.52 * s, bevel: 0.13 * s },
    shackle: [-0.24 * s, 0.02 * s, -0.24 * s, -0.24 * s, -0.11 * s, -0.42 * s, 0.11 * s, -0.42 * s, 0.24 * s, -0.24 * s, 0.24 * s, 0.02 * s],
    shackleWidth: 0.13 * s,
    pivot: { x: -0.24 * s, y: 0.02 * s },
    keyhole: [0, 0.06 * s, 0.075 * s, 0.14 * s, 0, 0.22 * s, -0.075 * s, 0.14 * s],
    keyslot: { x: -0.03 * s, y: 0.16 * s, width: 0.06 * s, height: 0.14 * s },
  };
}
