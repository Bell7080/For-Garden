import { effectiveElement, elementMultiplier } from "./element";
import type { Element, RelicDef } from "./types";

/** 편성 전체가 적 전체를 상대할 때 생기는 유리·불리·중립 교차 매치 수다. */
export interface PartyAffinitySummary {
  advantage: number;
  disadvantage: number;
  neutral: number;
}

/** 한 렐릭이 이번 적 편성 전체에 대해 갖는 상성 방향이다. */
export type AffinityDirection = "up" | "down" | "neutral";

/**
 * 선택 렐릭과 모든 적의 유리/불리 횟수를 합산해 다수결로 방향을 정한다.
 * 유리와 불리가 같은 수로 상쇄되거나 적 목록이 비었으면 중립이다. 최고 위험이나 평균 배율 대신
 * 합계를 고정해, 한 극단값이 나머지 적과의 관계를 가리지 않고 자동 배치의 전체 합산 관점과 맞춘다.
 */
export function relicAffinityDirection(relic: RelicDef, enemies: readonly RelicDef[]): AffinityDirection {
  const balance = enemies.reduce((sum, enemy) => {
    const multiplier = elementMultiplier(effectiveElement(relic), effectiveElement(enemy));
    return sum + (multiplier > 1 ? 1 : multiplier < 1 ? -1 : 0);
  }, 0);
  return balance > 0 ? "up" : balance < 0 ? "down" : "neutral";
}

/** 적 편성의 속성별 인원수를 첫 등장 순서대로 반환해 UI가 같은 정보를 재계산하지 않게 한다. */
export function elementDistribution(defs: readonly RelicDef[]): Array<{ element: Element; count: number }> {
  const counts = new Map<Element, number>();
  for (const def of defs) counts.set(def.element, (counts.get(def.element) ?? 0) + 1);
  return [...counts].map(([element, count]) => ({ element, count }));
}

/** 아군과 적의 모든 조합을 비교한다. 같은 속성은 어느 쪽에도 치우치지 않는 중립이다. */
export function partyAffinitySummary(allies: readonly RelicDef[], enemies: readonly RelicDef[]): PartyAffinitySummary {
  const summary: PartyAffinitySummary = { advantage: 0, disadvantage: 0, neutral: 0 };
  for (const ally of allies) {
    for (const enemy of enemies) {
      const multiplier = elementMultiplier(effectiveElement(ally), effectiveElement(enemy));
      if (multiplier > 1) summary.advantage += 1;
      else if (multiplier < 1) summary.disadvantage += 1;
      else summary.neutral += 1;
    }
  }
  return summary;
}

/**
 * 적 전체를 향한 속성 배율 합이 높은 순서로 **누구를** 데려갈지 고르고, 직군으로 **어디에** 세울지
 * 정한다(`arrangeByRole`). 점수가 같으면 보유 목록 순서를 지켜 결과가 매번 바뀌지 않으며, 직군은
 * 고르는 데에는 쓰지 않는다 — 숨은 보정이 아니라 자리만 정한다.
 */
export function autoPickParty(roster: readonly RelicDef[], enemies: readonly RelicDef[], size = 3): string[] {
  const picked = roster
    .map((relic, index) => ({
      relic,
      index,
      score: enemies.reduce((sum, enemy) => sum + elementMultiplier(effectiveElement(relic), effectiveElement(enemy)), 0),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, Math.max(0, size))
    .map(({ relic }) => relic);
  return arrangeByRole(picked).map(({ id }) => id);
}

/**
 * 가운데 자리에 먼저 설 직군. 가운데(2번)는 한 걸음 앞으로 나선 자리라(`spawnSpots`의 stagger)
 * 적과 가장 먼저 부딪힌다 — 탱커가 서야 뒤를 받치고, 없으면 전사가 앞을 맡는다.
 */
const CENTER_PRIORITY: Readonly<Record<RelicDef["role"], number>> = { tank: 0, warrior: 1, assassin: 2, support: 3 };

/** 남은 둘 중 왼쪽(1번)에 먼저 설 직군. 암살자가 파고드는 쪽, 지원가가 뒤를 받치는 오른쪽(3번)이다. */
const LEFT_PRIORITY: Readonly<Record<RelicDef["role"], number>> = { assassin: 0, warrior: 1, tank: 2, support: 3 };

/**
 * 셋의 자리를 직군으로 정한다 — **가운데에 탱커·전사, 양옆에 암살자·지원가.**
 *
 * 1·3번은 옆으로 비켜 선 자리라 적이 먼저 닿지 않는다. 약한 몸을 거기 두고 앞으로 나선 가운데에
 * 튼튼한 몸을 세워야 한 명이 먼저 쓰러지는 일이 줄어든다. 같은 직군끼리는 들어온 순서를 지킨다.
 * 셋이 아니면(빈 자리가 섞인 편성 등) 순서를 건드리지 않는다.
 */
/**
 * 편성 칸마다 추천하는 직군 — `arrangeByRole`이 세우는 자리를 화면에 미리 보여 주는 표다.
 *
 * 가운데(2번)는 한 걸음 앞으로 나선 자리라 탱커·전사, 양옆(1·3번)은 비켜 선 자리라 암살자·지원가다.
 * 자동 배치는 암살자를 왼쪽, 지원가를 오른쪽에 먼저 세우지만 **추천은 양옆에 같은 둘을 적는다** —
 * 셋 중 둘이 딜러이거나 지원가가 둘이면 어느 쪽에 서도 되는 자리이기 때문이다.
 */
export const RECOMMENDED_SLOT_ROLES: readonly (readonly RelicDef["role"][])[] = [
  ["assassin", "support"],
  ["tank", "warrior"],
  ["assassin", "support"],
];

export function arrangeByRole<T extends Pick<RelicDef, "role">>(members: readonly T[]): T[] {
  if (members.length !== 3) return [...members];
  const indexed = members.map((member, index) => ({ member, index }));
  const center = [...indexed].sort((a, b) => CENTER_PRIORITY[a.member.role] - CENTER_PRIORITY[b.member.role] || a.index - b.index)[0];
  const [left, right] = indexed
    .filter((entry) => entry !== center)
    .sort((a, b) => LEFT_PRIORITY[a.member.role] - LEFT_PRIORITY[b.member.role] || a.index - b.index);
  return [left.member, center.member, right.member];
}
