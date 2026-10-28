/**
 * 상태가 **걸리는 순간**과 겹이 **터지는 순간**의 공용 연출.
 *
 * 머리 위 칩은 "지금 무엇이 걸려 있나"를 말하지만, 칩이 하나 더 붙는 것만으로는 **방금 걸렸다**가
 * 읽히지 않는다 — 기절이 들어간 순간, 순풍을 받은 순간, 출혈이 열린 순간이 전부 숫자 하나나
 * 피격 섬광 하나로 지나갔다. 그 순간마다 상태의 색으로 짧은 잉크 조각을 한 번 세운다.
 *
 * 색은 새로 고르지 않는다 — 머리 위 칩(`UNIT_STATUS_COLOR`)과 피해 수치(`DEBUFF_TONE`)의 색을
 * 그대로 받아야 걸린 순간과 걸려 있는 동안이 한 상태로 읽힌다.
 *
 * Phaser를 들여오지 않는다 — 값과 판정을 테스트가 그대로 잰다.
 */

/** 연출이 붙는 순간. 코어 사건의 성격에서 그대로 나온다. */
export type StatusCueId =
  /** 기절 — 머리 위에서 별 셋이 한 바퀴 돈다. */
  | "stun"
  /** 빙결 — 얼음 조각이 몸에서 바깥으로 튀고 파문이 조여 든다. */
  | "frozen"
  /** 공포 — 식은땀이 양옆으로 튀고 파문이 안으로 움츠러든다. */
  | "fear"
  /** 잠듦 — 연기 조각 셋이 천천히 떠오른다. */
  | "sleep"
  /** 강화를 받음 — 위를 가리키는 화살 셋이 솟고 발밑 마름모가 벌어진다. */
  | "buff"
  /** 지속 피해가 열림(출혈·중독) — 방울이 위로 튀고 작은 별이 선다. */
  | "dotStart"
  /** 쌓아 둔 겹이 터짐(손질·낙서·수압·깨움·독 청산) — 별과 네 갈래 불꽃이 바깥으로 벌어진다. */
  | "debuffBurst";

export interface StatusCueSpec {
  /** 한 번의 연출이 끝나기까지(ms). 3배속에서도 한 프레임에 조각이 남도록 짧게 둔다. */
  ms: number;
  /** 같은 순간을 다시 여는 최소 간격(ms). 광역 기절이 다섯을 한꺼번에 묶어도 화면이 끓지 않게 한다. */
  minGapMs: number;
  /** 조각 수. 한 자리를 넘기지 않는다. */
  pieces: number;
  /** 조각이 벌어지는 거리(px). */
  travel: number;
  /** 조각 배율. */
  scale: number;
  /** 조각 사이의 박자(ms). 0이면 한꺼번에 선다. */
  staggerMs: number;
}

/**
 * 순간마다의 값.
 *
 * 전부 **잉크 조각**이고 밝아지는 합성을 쓰지 않는다 — 밝은 배경 원화 위에서 하얗게 뭉갰다.
 * 피격 별·궁극기 파문보다 한 등급 작게 둔다: 상태는 타격의 결과라 타격보다 먼저 읽히면 안 된다.
 */
export const STATUS_CUE: Readonly<Record<StatusCueId, StatusCueSpec>> = {
  // 머리 위 칩의 자리(체력 바 위)보다 조금 아래에서 돈다 — 칩을 덮지 않는다.
  stun: { ms: 620, minGapMs: 120, pieces: 3, travel: 46, scale: 0.34, staggerMs: 0 },
  frozen: { ms: 420, minGapMs: 120, pieces: 6, travel: 82, scale: 0.9, staggerMs: 0 },
  fear: { ms: 480, minGapMs: 120, pieces: 2, travel: 64, scale: 1, staggerMs: 60 },
  sleep: { ms: 900, minGapMs: 200, pieces: 3, travel: 70, scale: 0.8, staggerMs: 180 },
  // 순풍은 편성 전원에게 한꺼번에 들어가므로 간격을 두지 않는다 — 다만 한 프레임 예산은 지난다.
  buff: { ms: 560, minGapMs: 0, pieces: 3, travel: 92, scale: 0.42, staggerMs: 70 },
  dotStart: { ms: 380, minGapMs: 90, pieces: 3, travel: 58, scale: 0.85, staggerMs: 0 },
  debuffBurst: { ms: 360, minGapMs: 60, pieces: 4, travel: 86, scale: 0.9, staggerMs: 0 },
};

/** 이번 순간을 실제로 열지 정한다. 예산이 넘치면 조용히 버린다(놓친 연출보다 끊긴 프레임이 크다). */
export function allowStatusCue(id: StatusCueId, now: number, lastAt: number | undefined): boolean {
  const gap = STATUS_CUE[id].minGapMs;
  if (gap <= 0 || lastAt === undefined) return true;
  return now - lastAt >= gap;
}

/**
 * 조각 `index`가 `count`개 중에서 서는 각(라디안).
 *
 * 난수를 쓰지 않는다 — 같은 상태가 늘 같은 그림을 그려야 무엇이 걸렸는지 모양으로 익는다.
 * `upward`면 위쪽 반원(-π ~ 0)에만 벌린다. 위에서 내려다보는 난전이라 발밑으로 쏟아지면
 * "걸렸다"가 아니라 "흘렸다"로 보인다.
 */
export function cueAngle(index: number, count: number, upward: boolean): number {
  if (upward) {
    const lane = count === 1 ? 0.5 : index / (count - 1);
    // 양 끝을 살짝 안쪽으로 당겨 수평으로 눕지 않게 한다.
    return -Math.PI * (0.18 + lane * 0.64);
  }
  return (index / count) * Math.PI * 2 - Math.PI / 2;
}

/** 기절 별이 `t`(0~1)에 서는 자리. 머리 위를 납작한 타원으로 한 바퀴 돈다. */
export function stunOrbit(index: number, count: number, t: number, radius: number): { x: number; y: number } {
  const angle = (index / count) * Math.PI * 2 + t * Math.PI * 2;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * 0.36 };
}
