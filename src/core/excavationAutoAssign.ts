import type { ExcavationCurrency, IdleExcavationState } from "./idleExcavation";
import { relicExcavationProduction } from "./idleExcavation";
import type { RelicDef, RelicProgress } from "./types";

/**
 * 발굴 자동 배치의 기준.
 *
 * **무엇을 많이 캘지는 플레이어가 정한다.** 지금 모자란 재화가 무엇인지는 그때그때 다르므로
 * 한 가지 "가장 좋은 배치"를 강요하지 않는다. 치우친 기준은 그 재화를 캐는 렐릭만 세우고,
 * 균형은 서로 다른 재화를 캐는 셋을 세운다.
 */
export type ExcavationAutoMode = "balanced" | "cheesecake" | "fossil" | "gold" | "gems";

/** 화면이 화살표로 돌려 가며 고르는 순서다. 목록이 곧 순환 순서라 화면이 따로 적지 않는다. */
export const EXCAVATION_AUTO_MODES: readonly ExcavationAutoMode[] = ["balanced", "cheesecake", "fossil", "gold", "gems"] as const;

/** 기준의 이름. 화면은 이 표만 읽고 제 문구를 만들지 않는다. */
export const EXCAVATION_AUTO_MODE_LABEL: Readonly<Record<ExcavationAutoMode, string>> = {
  balanced: "골고루",
  cheesecake: "치즈케이크",
  fossil: "화석",
  gold: "골드",
  gems: "젬",
};

/** 치우친 기준이 노리는 재화. 균형에는 없다. */
const MODE_CURRENCY: Readonly<Record<Exclude<ExcavationAutoMode, "balanced">, ExcavationCurrency>> = {
  cheesecake: "cheesecake", fossil: "fossil", gold: "gold", gems: "gems",
};

/** 배치 후보 한 명. 정의와 성장만 있으면 생산량이 정해지므로 이름은 보지 않는다. */
export interface ExcavationCandidate {
  readonly def: RelicDef;
  readonly progress: Pick<RelicProgress, "level" | "breakthrough">;
}

interface Ranked { readonly id: string; readonly currency: ExcavationCurrency; readonly perHour: number }

/**
 * 시간당 생산이 큰 순으로 줄을 세운다.
 *
 * 같은 값이면 개체 id로 갈라 **같은 입력이 늘 같은 배치**를 내놓게 한다 — 누를 때마다 결과가
 * 바뀌면 자동 배치를 다시 눌러 보는 것이 곧 뽑기가 된다.
 */
function rank(candidates: readonly ExcavationCandidate[]): Ranked[] {
  return candidates
    .map(({ def, progress }) => {
      const production = relicExcavationProduction(def, progress);
      return { id: def.id, currency: production.currency, perHour: production.totalPerHour };
    })
    .sort((a, b) => b.perHour - a.perHour || a.id.localeCompare(b.id));
}

/**
 * 세 자리를 채운 배치를 돌려준다. 후보가 모자라면 남는 자리는 빈 칸이다.
 *
 * 균형은 **서로 다른 재화를 먼저** 한 명씩 세우고 남는 자리만 생산량 순으로 채운다. 한 재화만
 * 잔뜩 캐면 다른 재화가 마르는데, 그 상태는 화면이 알려 주지 않고 몇 시간 뒤 수확에서야 드러난다.
 */
export function autoAssignExcavation(
  candidates: readonly ExcavationCandidate[],
  mode: ExcavationAutoMode,
): IdleExcavationState["assignedRelicIds"] {
  const ranked = rank(candidates);
  const picked: string[] = [];
  if (mode === "balanced") {
    const usedCurrencies = new Set<ExcavationCurrency>();
    for (const entry of ranked) {
      if (picked.length >= 3 || usedCurrencies.has(entry.currency)) continue;
      usedCurrencies.add(entry.currency); picked.push(entry.id);
    }
  } else {
    const wanted = MODE_CURRENCY[mode];
    for (const entry of ranked) {
      if (picked.length >= 3 || entry.currency !== wanted) continue;
      picked.push(entry.id);
    }
  }
  // 고른 기준으로 세 자리를 다 못 채우면 남는 자리는 생산량이 큰 순서로 메운다 — 빈 칸은
  // 아무것도 캐지 않으므로, 기준을 지키느라 자리를 비우는 것이 더 손해다.
  for (const entry of ranked) {
    if (picked.length >= 3) break;
    if (!picked.includes(entry.id)) picked.push(entry.id);
  }
  return [picked[0] ?? null, picked[1] ?? null, picked[2] ?? null];
}
