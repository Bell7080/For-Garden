/**
 * 곡괭이를 휘두르는 기하. Phaser를 읽지 않는다.
 *
 * 곡괭이는 몸통 가운데를 축으로 돌리면 자루가 허공에서 돌 뿐 **날이 칸을 치지 않는다.** 그래서
 * 축을 손잡이 끝(쥔 곳)에 두고, 내려꽂는 순간 **날 끝이 정확히 칸 가운데에 닿도록** 손 자리를
 * 거꾸로 구한다. 원화(256×256)의 쥔 곳과 왼쪽 날 끝을 실측해 아래에 적는다 — 아트를 다시 구우면
 * 같은 방법으로 다시 재서 이 값만 고친다.
 */

/** 원화 안 좌표(px). 쥔 곳(자루 끝)과 내려찍는 날 끝, 원화 한 변. */
export const PICKAXE_ART = { size: 256, grip: { x: 196, y: 196 }, tip: { x: 30, y: 150 } } as const;

/**
 * 각도(도, 시계 방향이 +).
 * - `strike`: 날 끝의 접선이 아래를 향하는 자세. 원화에서 날 끝이 (-0.5, 0.85) 방향으로 휘어 있어 30도 눕히면 곧게 아래다.
 * - `raised`: 머리를 뒤(오른쪽 위)로 젖힌 자세. `strike`에서 92도 뒤다.
 */
export const PICKAXE_ANGLE = { rest: 30, raised: 62, strike: -30 } as const;

/** 회전 뒤의 점. */
function rotate(x: number, y: number, degrees: number): { x: number; y: number } {
  const radian = (degrees * Math.PI) / 180;
  return { x: x * Math.cos(radian) - y * Math.sin(radian), y: x * Math.sin(radian) + y * Math.cos(radian) };
}

/** 쥔 곳을 원점으로 한 날 끝의 화면 자리(표시 한 변 `displaySize`, 회전 `degrees`). */
export function pickaxeTipOffset(displaySize: number, degrees: number): { x: number; y: number } {
  const k = displaySize / PICKAXE_ART.size;
  return rotate((PICKAXE_ART.tip.x - PICKAXE_ART.grip.x) * k, (PICKAXE_ART.tip.y - PICKAXE_ART.grip.y) * k, degrees);
}

/** 이미지 원점(0~1) — 쥔 곳이 곧 회전축이다. */
export const PICKAXE_ORIGIN = { x: PICKAXE_ART.grip.x / PICKAXE_ART.size, y: PICKAXE_ART.grip.y / PICKAXE_ART.size } as const;

export interface PickaxePose { x: number; y: number; angle: number }

/**
 * 한 칸을 내려치는 세 자세.
 *
 * `strike`에서 날 끝이 칸 가운데(`center`)에 닿는다. `raised`는 손이 한 뼘 위·뒤로 물러나 있고,
 * `rest`는 시작 자세다. 손은 칸 오른쪽에 서서 자루를 왼쪽으로 뻗는다 — 판 위에서 다른 칸을 덜 가린다.
 */
export function pickaxePoses(center: { x: number; y: number }, cell: number, displaySize: number): { rest: PickaxePose; raised: PickaxePose; strike: PickaxePose } {
  const tip = pickaxeTipOffset(displaySize, PICKAXE_ANGLE.strike);
  const strikeHand = { x: center.x - tip.x, y: center.y - tip.y };
  return {
    strike: { ...strikeHand, angle: PICKAXE_ANGLE.strike },
    raised: { x: strikeHand.x + cell * 0.14, y: strikeHand.y - cell * 0.3, angle: PICKAXE_ANGLE.raised },
    rest: { x: strikeHand.x + cell * 0.08, y: strikeHand.y - cell * 0.18, angle: PICKAXE_ANGLE.rest },
  };
}
