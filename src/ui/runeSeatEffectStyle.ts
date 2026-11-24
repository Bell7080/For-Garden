/**
 * 룬 정비 창에서 룬이 하트 조각 자리에 끼워지고 빠지는 연출의 값과 판정(Phaser 없음).
 *
 * 연출은 「적용」이 저장을 마친 순간 바뀐 칸에만 돈다 — 후보를 고르는 동안에는 하트가 저장된 룬을 그리므로
 * (응태 2026-11-23) 그때 끼워지는 척하면 아직 끼지 않은 룬이 낀 것처럼 읽힌다. 후보를 고를 때는 교체 비교 판의
 * 후보 그림만 톡 튀어 「골랐다」만 말한다.
 *
 * - **끼움**(`insert`): 빈 자리에 새 조각이 바깥에서 하트 쪽으로 쏙 들어와 박히고, 박히는 순간 「핑」(장착음) ·
 *   조각 모양 섬광 · 납작한 마름모 파문 한 겹 · 바깥으로 튀는 작은 마름모 몇 조각.
 * - **교체**(`swap`): 낀 조각이 먼저 바깥으로 튕겨 나가며 옅어지고(빠지는 소리), 한 박자 뒤 새 조각이 끼움과
 *   같이 박힌다.
 * - **빼기**(`remove`): 낀 조각이 바깥으로 튕겨 나가며 옅어질 뿐, 박히는 연출은 없다.
 *
 * 그림은 새로 굽지 않는다 — 조각 그림(`runeSeatTexture`)과 공용 마름모 파편(`EFFECT_TEXTURE.shard`)만 쓴다.
 * 한 번에 바뀌는 칸은 많아야 셋이고 모든 움직임은 0.7초 안에 끝나는 트윈 한두 개라 프레임 부담이 없다.
 * 움직임 줄이기에서는 날아오고 튕기는 몸짓을 걷고 섬광만 옅게 남긴다.
 */
export type RuneSeatChange = "insert" | "swap" | "remove";

export const RUNE_SEAT_FX = {
  /** 빠지는 옛 조각 — 하트 바깥쪽으로 이만큼 튕겨 나가며 옅어진다. */
  eject: { distance: 70, duration: 230, scale: 0.82, spin: 14 },
  /** 들어오는 새 조각 — 바깥 이만큼에서 시작해 하트 쪽으로 박힌다. 교체면 옛 조각이 비킨 뒤(`swapDelay`)다. */
  insert: { distance: 64, duration: 190, fromScale: 1.32, swapDelay: 150 },
  /** 박힌 뒤 한 번 눌렸다 돌아오는 몫. */
  settle: { squash: 0.9, duration: 170 },
  /** 조각 모양 그대로의 섬광. 겹쳐 밝아지는 합성이라 상한(0.6)보다 낮게 둔다. */
  flash: { alpha: 0.55, grow: 1.16, duration: 300 },
  /** 납작한 마름모 파문 한 겹 — 조각 크기에 대한 비율. */
  ripple: { from: 0.25, to: 0.85, thickness: 5, squash: 0.55, duration: 340, alpha: 0.9 },
  /** 바깥 부채꼴로 튀는 작은 마름모. 한 자리 수로 끊는다. */
  spark: { count: 5, size: 20, distance: 90, spreadDegrees: 110, duration: 340 },
  /** 옆 글 판이 새 값으로 한 번 밝아지는 몫. */
  plate: { fromAlpha: 0.35, duration: 260 },
  /** 후보를 고를 때 비교 판의 후보 그림이 톡 튀는 몫. */
  pick: { fromScale: 0.78, duration: 220 },
} as const;

/** 저장 전후 한 칸의 룬 ID로 그 칸에 무슨 일이 일어났는지 고른다. 같으면 연출이 없다. */
export function runeSeatChange(before: string | null, after: string | null): RuneSeatChange | undefined {
  if (before === after) return undefined;
  if (before === null) return "insert";
  if (after === null) return "remove";
  return "swap";
}

/**
 * 바깥으로 튀는 파편 하나의 방향. 조각이 놓인 쪽(하트 가운데에서 조각으로 향하는 단위 벡터)을 가운데로
 * 부채꼴을 고르게 나눈다 — 난수를 쓰지 않아 같은 칸은 늘 같은 그림을 그린다.
 */
export function runeSeatSparkVector(index: number, count: number, outward: { x: number; y: number }): { x: number; y: number } {
  const spread = (RUNE_SEAT_FX.spark.spreadDegrees * Math.PI) / 180;
  const base = Math.atan2(outward.y, outward.x);
  const step = spread / Math.max(1, count);
  const angle = base - spread / 2 + step * (index + 0.5);
  return { x: Math.cos(angle), y: Math.sin(angle) };
}
