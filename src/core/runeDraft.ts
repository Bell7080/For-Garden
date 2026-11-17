import { recommendRuneLoadout, runeLoadoutPower, type RuneLoadoutRelic, type RuneLoadoutSlots } from "./runeLoadout";
import { runeOptionValue, type RuneInstance, type RunePart, type RuneStatKey } from "./runes";

/**
 * 룬 정비 — 세 칸을 **임시 구성**으로 바꿔 보고 한 번에 적용한다.
 *
 * 정비 창(`RuneWorkbenchPopup`)이 카드를 누를 때마다 서버에 장착을 보내면 바꿔 보기만 해도 다른 렐릭의 룬이
 * 빠지고, 세 칸을 손볼 때 저장이 세 번 돈다. 그래서 고르는 동안은 이 모듈의 순수 구성만 바뀌고, 적용이
 * `setRuneLoadout` 한 번으로 세 칸을 확정한다. 화면은 비교 줄·전투력 차·옮겨 끼는 렐릭을 여기서 읽기만 한다.
 */

export const RUNE_DRAFT_PARTS: readonly RunePart[] = [0, 1, 2];

/** 저장된 구성과 달라진 칸. */
export function changedRuneParts(base: RuneLoadoutSlots, draft: RuneLoadoutSlots): RunePart[] {
  return RUNE_DRAFT_PARTS.filter((part) => base[part] !== draft[part]);
}

function withSlot(slots: RuneLoadoutSlots, part: RunePart, id: string | null): RuneLoadoutSlots {
  return RUNE_DRAFT_PARTS.map((p) => (p === part ? id : slots[p])) as unknown as RuneLoadoutSlots;
}

/**
 * 카드를 눌렀다 — 그 룬을 칸의 후보로 놓는다. 이미 후보인 룬을 다시 누르면 저장된 룬으로 되돌린다
 * (저장된 룬을 누르면 그대로다). 「이 룬으로」 버튼을 따로 세우지 않고 누름 하나가 고르기·되돌리기를 맡는다.
 */
export function tapRuneDraft(base: RuneLoadoutSlots, draft: RuneLoadoutSlots, part: RunePart, runeId: string): RuneLoadoutSlots {
  if (draft[part] === runeId) return withSlot(draft, part, base[part]);
  return withSlot(draft, part, runeId);
}

/** 칸을 비운다(임시). */
export function clearRuneDraftSlot(draft: RuneLoadoutSlots, part: RunePart): RuneLoadoutSlots {
  return withSlot(draft, part, null);
}

/**
 * 칸마다 다른 렐릭에게서 빼 오는 룬이면 그 렐릭 ID. `holders`는 저장 기준(룬 ID → 낀 렐릭)이다.
 */
export function runeDraftMovedFrom(draft: RuneLoadoutSlots, holders: ReadonlyMap<string, string>, relicId: string): (string | null)[] {
  return RUNE_DRAFT_PARTS.map((part) => {
    const id = draft[part];
    const holder = id === null ? undefined : holders.get(id);
    return holder !== undefined && holder !== relicId ? holder : null;
  });
}

export interface RuneCompareLine {
  readonly key: RuneStatKey;
  /** 두 룬 중 어느 쪽에서든 주 옵션이었다. */
  readonly main: boolean;
  /** 지금 낀 룬의 값(없으면 0). */
  readonly before: number;
  /** 후보 룬의 값(없으면 0). */
  readonly after: number;
  readonly delta: number;
}

/**
 * 지금 → 후보 옵션 비교. 두 룬의 옵션을 합쳐 주 옵션 먼저, 그다음 부 옵션 순서로 세운다. 한쪽에만 있는
 * 옵션은 다른 쪽을 0으로 읽는다 — 빠지는 옵션도 ▼로 보여야 바꿔도 되는지 판단이 선다.
 */
export function runeCompareLines(before: RuneInstance | undefined, after: RuneInstance | undefined): RuneCompareLine[] {
  const keys: { key: RuneStatKey; main: boolean }[] = [];
  const push = (key: RuneStatKey, main: boolean): void => {
    const found = keys.find((entry) => entry.key === key);
    if (found) { if (main) found.main = true; return; }
    keys.push({ key, main });
  };
  for (const rune of [after, before]) rune?.mainStats.forEach(({ key }) => push(key, true));
  for (const rune of [after, before]) rune?.subStats.forEach(({ key }) => push(key, false));
  const has = (rune: RuneInstance | undefined, key: RuneStatKey): boolean =>
    rune !== undefined && (rune.mainStats.some((option) => option.key === key) || rune.subStats.some((option) => option.key === key));
  const value = (rune: RuneInstance | undefined, key: RuneStatKey): number => (rune && has(rune, key) ? runeOptionValue(rune, key) : 0);
  const ordered = [...keys.filter(({ main }) => main), ...keys.filter(({ main }) => !main)];
  return ordered.map(({ key, main }) => {
    const b = value(before, key);
    const a = value(after, key);
    return { key, main, before: b, after: a, delta: Math.round((a - b) * 100) / 100 };
  });
}

/** 그 룬을 이 칸 후보로 놓으면 전투력이 지금 임시 구성보다 얼마나 달라지나. */
export function runeCandidatePowerDelta(relic: RuneLoadoutRelic, draft: RuneLoadoutSlots, part: RunePart, runeId: string, runes: readonly RuneInstance[]): number {
  return runeLoadoutPower(relic, withSlot(draft, part, runeId), runes) - runeLoadoutPower(relic, draft, runes);
}

/**
 * 자동·추천을 임시 구성 위에 얹는다 — 아무것도 저장하지 않는다. 추천 규칙은 「지금」에서 출발하므로
 * 임시 구성을 지금으로 보게 하고, 장착표도 이 렐릭의 칸을 임시 구성으로 갈아 끼워 넘긴다.
 */
export function recommendIntoDraft(
  relic: RuneLoadoutRelic,
  draft: RuneLoadoutSlots,
  runes: readonly RuneInstance[],
  holders: ReadonlyMap<string, string>,
  mode: "auto" | "recommend",
): { slots: RuneLoadoutSlots; changed: boolean } {
  const local = new Map([...holders].filter(([, holder]) => holder !== relic.relicId));
  for (const id of draft) if (id !== null) local.set(id, relic.relicId);
  const plan = recommendRuneLoadout(
    { ...relic, progress: { ...relic.progress, heartGemSlots: [...draft] as [string | null, string | null, string | null] } },
    runes,
    local,
    mode === "recommend" ? { includeOthers: true } : {},
  );
  return { slots: plan.slots, changed: plan.changed };
}
