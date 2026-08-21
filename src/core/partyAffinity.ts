import { elementMultiplier } from "./element";
import type { Element, RelicDef } from "./types";

/** 편성 전체가 적 전체를 상대할 때 생기는 유리·불리·중립 교차 매치 수다. */
export interface PartyAffinitySummary {
  advantage: number;
  disadvantage: number;
  neutral: number;
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
      const multiplier = elementMultiplier(ally.element, enemy.element);
      if (multiplier > 1) summary.advantage += 1;
      else if (multiplier < 1) summary.disadvantage += 1;
      else summary.neutral += 1;
    }
  }
  return summary;
}

/**
 * 적 전체를 향한 속성 배율 합이 높은 순서로 자동 편성한다.
 * 점수가 같으면 보유 목록 순서를 지켜 결과가 매번 바뀌지 않으며, 직업은 숨은 보정에 쓰지 않는다.
 */
export function autoPickParty(roster: readonly RelicDef[], enemies: readonly RelicDef[], size = 3): string[] {
  return roster
    .map((relic, index) => ({
      id: relic.id,
      index,
      score: enemies.reduce((sum, enemy) => sum + elementMultiplier(relic.element, enemy.element), 0),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, Math.max(0, size))
    .map(({ id }) => id);
}
