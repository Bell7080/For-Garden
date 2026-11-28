import { combatPower } from "./combatPower";
import { activeBreakthroughOf, calculateFinalStats } from "./relicProgression";
import { displayCombatStats } from "./combatStats";
import type { RuneInstance, RunePart } from "./runes";
import { RUNE_TRAIT_GRADES } from "./runeTraits";
import type { RelicProgress, RelicRarity, Stats } from "./types";
import { getRelic } from "../data/relics";

/**
 * 룬 장착 추천 — 렐릭 하나의 세 칸에 무엇을 낄지 고른다.
 *
 * **잣대는 정보창의 전투력 하나다**(`combatPower` — 표시 전용 값이라 전투 계산에는 쓰지 않는다).
 * 룬 옵션은 대부분 그 개체의 능력치에 곱해지므로, 쓰지 않는 능력치(물리형의 주문력)는 태생이 낮아
 * 같은 %를 받아도 전투력을 덜 올린다 — 직군·피해 종류를 따로 읽지 않아도 그 개체가 쓰는 쪽으로 기운다.
 * 정보창에 서 있는 그 수가 오르는 쪽을 고르므로 "추천했는데 전투력이 내려갔다"가 생기지 않는다.
 *
 * 특성(`RuneInstance.trait`)은 능력치가 아니라 전투 규칙이라 전투력으로 잴 수 없다 — 같은 값일 때만
 * 특성 등급이 높은 쪽을 고른다. 칸끼리는 거의 독립이라(옵션이 각자 곱해진다) 칸마다 따로 고른다.
 */

/** 추천에 쓰는 렐릭의 지금 성장 — 룬만 바꿔 끼워 본다. */
export interface RuneLoadoutRelic {
  readonly relicId: string;
  readonly base: Stats;
  readonly rarity: RelicRarity;
  readonly progress: RelicProgress;
}

export type RuneLoadoutSlots = readonly [string | null, string | null, string | null];

export interface RuneLoadoutOptions {
  /**
   * 다른 렐릭이 끼고 있는 룬도 후보로 본다. 고르면 그 렐릭에서 빼 와야 하므로(`moveFromOther`) 기본은 끈다.
   */
  readonly includeOthers?: boolean;
  /** 이미 낀 칸은 그대로 두고 빈 칸만 채운다. */
  readonly emptyOnly?: boolean;
}

export interface RuneLoadoutPlan {
  readonly slots: RuneLoadoutSlots;
  /** 지금 낀 상태의 전투력. */
  readonly powerBefore: number;
  /** 추천대로 낀 뒤의 전투력. */
  readonly powerAfter: number;
  /** 칸마다 다른 렐릭에게서 빼 오는 룬이면 그 렐릭 ID. */
  readonly movedFrom: readonly [string | null, string | null, string | null];
  /** 지금과 달라지는 칸이 하나라도 있는가. */
  readonly changed: boolean;
}

const PARTS: readonly RunePart[] = [0, 1, 2];

/** 그 칸 구성으로 잰 전투력. 칸에 없는 룬 ID는 빈 칸으로 본다. */
export function runeLoadoutPower(relic: RuneLoadoutRelic, slots: RuneLoadoutSlots, runes: readonly RuneInstance[]): number {
  const byId = new Map(runes.map((rune) => [rune.instanceId, rune]));
  const gems = slots.flatMap((id) => {
    const rune = id === null ? undefined : byId.get(id);
    return rune ? [rune] : [];
  });
  const stats = calculateFinalStats(relic.base, { ...relic.progress, heartGemSlots: [...slots] as [string | null, string | null, string | null] }, gems, relic.rarity);
  return combatPower(displayCombatStats(getRelic(relic.relicId), stats, activeBreakthroughOf(relic.progress), gems), relic.base);
}

function traitRank(rune: RuneInstance): number {
  return rune.trait === undefined ? -1 : RUNE_TRAIT_GRADES.indexOf(rune.trait.grade);
}

/**
 * 추천 구성을 구한다.
 *
 * `holders`는 룬 ID → 그 룬을 낀 렐릭 ID다(이 렐릭 자신 포함). 지금 낀 룬보다 낫지 않으면 그대로 둔다 —
 * 같은 값이면 바꾸지 않아, 누를 때마다 같은 값의 다른 룬으로 오가는 일이 없다.
 */
export function recommendRuneLoadout(
  relic: RuneLoadoutRelic,
  runes: readonly RuneInstance[],
  holders: ReadonlyMap<string, string>,
  options: RuneLoadoutOptions = {},
): RuneLoadoutPlan {
  const current = relic.progress.heartGemSlots;
  const slots: (string | null)[] = [...current];
  const movedFrom: (string | null)[] = [null, null, null];
  for (const part of PARTS) {
    const kept = current[part];
    if (options.emptyOnly && kept !== null) continue;
    const solo = (id: string | null): number => runeLoadoutPower(relic, PARTS.map((p) => (p === part ? id : null)) as unknown as RuneLoadoutSlots, runes);
    let bestId = kept;
    let bestPower = solo(kept);
    let bestRune = kept === null ? undefined : runes.find((rune) => rune.instanceId === kept);
    for (const rune of runes) {
      if (rune.part !== part || rune.instanceId === kept) continue;
      const holder = holders.get(rune.instanceId);
      if (holder !== undefined && holder !== relic.relicId && !options.includeOthers) continue;
      // 이 렐릭의 다른 칸에 낀 룬은 자리가 달라 여기 올 수 없다(룬은 제 자리에만 든다).
      if (holder === relic.relicId) continue;
      const power = solo(rune.instanceId);
      const better = power > bestPower
        || (power === bestPower && bestRune !== undefined && traitRank(rune) > traitRank(bestRune));
      if (!better) continue;
      bestId = rune.instanceId; bestPower = power; bestRune = rune;
    }
    slots[part] = bestId;
    const holder = bestId === null ? undefined : holders.get(bestId);
    movedFrom[part] = holder !== undefined && holder !== relic.relicId ? holder : null;
  }
  const next = slots as unknown as RuneLoadoutSlots;
  return {
    slots: next,
    powerBefore: runeLoadoutPower(relic, current, runes),
    powerAfter: runeLoadoutPower(relic, next, runes),
    movedFrom: movedFrom as unknown as RuneLoadoutPlan["movedFrom"],
    changed: PARTS.some((part) => next[part] !== current[part]),
  };
}

/** 룬 ID → 낀 렐릭 ID. 저장의 장착표에서 만든다. */
export function runeHolders(progress: Readonly<Record<string, Pick<RelicProgress, "heartGemSlots">>>): Map<string, string> {
  const holders = new Map<string, string>();
  for (const [relicId, { heartGemSlots }] of Object.entries(progress)) {
    for (const id of heartGemSlots) if (id !== null) holders.set(id, relicId);
  }
  return holders;
}
