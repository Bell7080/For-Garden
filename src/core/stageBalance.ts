import { FEED_UNIT, relicExpToNext, relicLevelCap } from "./relicProgression";

/**
 * 스토리만 밀었을 때 파티가 실제로 얼마나 자라는가.
 *
 * 관문 난이도를 **플레이어의 성장 곡선에서 거꾸로** 잡기 위한 규칙이다. 예전에는 적 레벨을
 * 눈대중으로 적었고, 그 결과 1레벨 셋이 조합만 맞추면 챕터 2까지 밀렸다 — 관문이 요구하는
 * 힘이 관문을 밀어서 얻는 힘보다 느리게 자랐기 때문이다.
 *
 * 여기서 말하는 **바닥**은 "스토리 첫 클리어 보상만 받고 다른 콘텐츠를 하나도 하지 않은
 * 사람"이다. 일일 복원·발굴·원정은 전부 이 위에 얹히므로, 바닥에 맞춰 두면 실제 플레이어는
 * 늘 그보다 여유가 있다. 반대로 바닥이 통과하지 못하면 스토리가 막히므로 이 선을 넘지 않는다.
 */
export const STORY_FLOOR = {
  /** 보상을 나눠 먹는 인원. 편성 칸이 셋이므로 한 명에게 몰아주지 않는 쪽을 기준으로 본다. */
  partySize: 3,
  /** 한 개체가 낄 수 있는 룬 칸. 넘게 받아도 더 세지지 않는다. */
  runeSlots: 3,
} as const;

/**
 * 치즈케이크를 전부 급여에 썼을 때 닿는 레벨.
 *
 * 급여 단가와 경험치 곡선은 `relicProgression`이 갖고 있으므로 여기서 다시 적지 않고 그대로
 * 되짚는다 — 두 곳이 갈리면 관문 난이도가 실제 성장과 다른 곡선을 보게 된다.
 */
export function levelFromCheesecake(cheesecake: number): number {
  if (!Number.isFinite(cheesecake) || cheesecake < 0) throw new RangeError("치즈케이크가 올바르지 않습니다.");
  const cap = relicLevelCap(0);
  let level = 1;
  let spent = 0;
  while (level < cap) {
    // 한 레벨에 드는 급여 횟수만큼의 치즈케이크. 경험치는 급여마다 같은 양이 오른다.
    const need = Math.ceil(relicExpToNext(level) / FEED_UNIT.exp) * FEED_UNIT.cheesecake;
    if (spent + need > cheesecake) break;
    spent += need;
    level += 1;
  }
  return level;
}

/**
 * 같은 보상을 **어떻게 나눠 쓰는가.**
 *
 * 편성 칸이 셋이라고 셋을 고르게 키우지 않는다 — 많은 사람이 제 취향의 애착 하나에 자원을
 * 몰아 **하이퍼 캐리**를 만든다. 두 갈래가 요구하는 힘이 다르므로 관문은 **둘 다** 통과하도록
 * 잡는다.
 */
export type InvestmentShape =
  /** 한 명에게 치즈케이크와 룬을 전부 몰아준다. 나머지 둘은 1레벨 맨몸이다. */
  | "carry"
  /** 셋에게 고르게 나눈다. 룬도 한 칸씩 돌아간다. */
  | "spread";

/** 그 관문에 들어서는 순간의 바닥 파티. 편성 순서대로 한 명씩의 상태다. */
export interface StoryFloorGrowth {
  /** 급여로 닿은 레벨. */
  levels: readonly [number, number, number];
  /** 그 개체가 낀 초록 룬 수(0~3). */
  runes: readonly [number, number, number];
}

/**
 * 이 관문을 **열기 전까지** 받은 보상만으로 자란 상태.
 *
 * 직전 관문까지의 누적을 쓰는 이유는, 그 관문의 보상은 그 관문을 깨야 들어오기 때문이다 —
 * 자기 보상까지 세면 처음 들어서는 사람이 가진 적 없는 힘을 기준으로 난이도를 잡게 된다.
 */
export function storyFloorGrowth(
  cumulativeCheesecakeBefore: number, clearedStages: number, shape: InvestmentShape,
  /** 몰아줄 자리. 편성 순서는 진형이 정하므로 **누구에게 몰아주는지**는 따로 받는다. */
  carryIndex = 0,
): StoryFloorGrowth {
  if (!Number.isInteger(clearedStages) || clearedStages < 0) throw new RangeError("클리어 관문 수가 올바르지 않습니다.");
  if (!Number.isInteger(carryIndex) || carryIndex < 0 || carryIndex >= STORY_FLOOR.partySize) {
    throw new RangeError("몰아줄 자리가 편성 범위를 벗어났습니다.");
  }
  const cap = STORY_FLOOR.runeSlots;
  if (shape === "carry") {
    const pick = <T>(value: T, other: T): [T, T, T] =>
      [0, 1, 2].map((slot) => slot === carryIndex ? value : other) as [T, T, T];
    return {
      levels: pick(levelFromCheesecake(cumulativeCheesecakeBefore), 1),
      runes: pick(Math.min(cap, clearedStages), 0),
    };
  }
  const level = levelFromCheesecake(Math.floor(cumulativeCheesecakeBefore / STORY_FLOOR.partySize));
  const runes = Math.min(cap, Math.floor(clearedStages / STORY_FLOOR.partySize));
  return { levels: [level, level, level], runes: [runes, runes, runes] };
}

/**
 * 관문이 **전멸선에 얼마나 다가서는가.**
 *
 * 잔여 체력을 목표로 삼지 않는 이유는 그 값이 적 레벨에 단조롭지 않기 때문이다 — 실제로
 * 재 보면 65~85% 사이를 오르내리는 넓은 고원이 이어지다가 어느 레벨에서 한 번에 전멸로
 * 떨어진다. 단조로운 것은 **전멸선**(바닥 파티가 아직 전승하는 최고 레벨) 하나뿐이라,
 * 난이도는 그 선에 얼마나 붙느냐로 정한다.
 *
 * **챕터마다 비율을 되돌리지 않는다.** 처음에는 2·3장 시작에서 비율을 낮춰 숨을 돌리게
 * 했는데, 파티가 자란 만큼 천장도 함께 올라가서 그 리셋이 **적 레벨을 실제로 뒤로 보냈다** —
 * 2-1의 적이 1-10보다 여덟 레벨 낮아졌고, 성장을 하나도 하지 않은 파티가 1-7에서 막히고도
 * 2-3은 잔여 79%로 통과했다. 한 줄기로 끝까지 올라가고, 구역이 바뀌는 느낌은 적 구성과
 * 별(돌파)이 맡는다.
 */
export const STORY_APPROACH = {
  first: 0.35,
  last: 1,
  /**
   * 앞을 가파르게 만드는 지수. 1이면 곧은 직선이고 작을수록 1장에서 빨리 올라간다.
   *
   * 직선으로 두면 1장이 통째로 느슨해진다 — 1-9의 적이 Lv13에 머물러 **성장을 하나도 하지
   * 않은 파티도 1장을 그대로 통과한다.** 1장은 "키우지 않으면 막힌다"를 가르치는 구간이라
   * 여기서 이미 전멸선의 3/4까지 올라가야 하고, 2·3장은 그 위에서 천천히 조여 든다.
   */
  curve: 0.4,
} as const;

/** 스토리 전체에서 관문 순서(0부터)에 따라 올라가는 접근 비율. 앞이 가파른 곡선이다. */
export function stageApproachRatio(globalOrder: number, totalStages = 30): number {
  if (!Number.isInteger(globalOrder) || globalOrder < 0) throw new RangeError("관문 순서가 올바르지 않습니다.");
  const t = totalStages <= 1 ? 0 : Math.min(1, globalOrder / (totalStages - 1));
  return STORY_APPROACH.first + (STORY_APPROACH.last - STORY_APPROACH.first) * Math.pow(t, STORY_APPROACH.curve);
}
