/**
 * 자리를 고르는 편성 — 스토리·원정·발굴·교류 파견이 나눠 쓰는 하나의 규칙.
 *
 * **편성은 길이가 고정된 배열이고 빈 자리는 `null`이다.** 배열을 줄이지 않는 것이 이 모듈의
 * 전부다 — 2번을 비웠는데 3번이 앞으로 당겨지면 손대지 않은 자리가 저 혼자 바뀌고, 화면 위의
 * 캐릭터가 사람이 누르지 않은 곳에서 움직인다. 채우는 순서도 자리를 정하지 않는다. 어디에 설지는
 * **고른 칸**이 정하고, 목록은 그 칸에 넣기만 한다.
 *
 * 순수 규칙이라 난수도 저장도 없다. 씬은 여기서 나온 새 배열을 그리기만 한다.
 */

/** 빈 자리를 `null`로 남기는 고정 길이 편성. */
export type FormationSlots = readonly (string | null)[];

/** 호출자의 배열을 건드리지 않고 같은 길이의 사본을 돌려준다. */
function copy(formation: FormationSlots): (string | null)[] {
  return [...formation];
}

function inRange(formation: FormationSlots, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < formation.length;
}

/**
 * 한 자리를 비운다.
 *
 * **뒤 자리를 당기지 않는다.** 2번을 비우면 3번은 3번에 그대로 선다.
 */
export function clearFormationSlot(formation: FormationSlots, index: number): (string | null)[] {
  const next = copy(formation);
  if (!inRange(formation, index)) return next;
  next[index] = null;
  return next;
}

/**
 * 고른 칸에 렐릭을 세운다.
 *
 * 그 렐릭이 다른 칸에 이미 서 있으면 **두 칸을 맞바꾼다** — 그러지 않으면 같은 렐릭이 두 자리에
 * 선다. 같은 칸의 렐릭을 목록에서 다시 누르면 그 자리를 비운다(누른 것을 한 번 더 누르면
 * 되돌아가는 것이 목록의 기본 계약이다).
 */
export function placeFormationRelic(formation: FormationSlots, targetSlot: number, relicId: string): (string | null)[] {
  const next = copy(formation);
  if (!inRange(formation, targetSlot)) return next;
  const sourceSlot = next.indexOf(relicId);
  if (sourceSlot === targetSlot) {
    next[targetSlot] = null;
    return next;
  }
  const displaced = next[targetSlot];
  next[targetSlot] = relicId;
  if (sourceSlot >= 0) next[sourceSlot] = displaced;
  return next;
}

/**
 * 한 칸을 채운 뒤 이어서 고를 칸.
 *
 * 여러 자리를 채우는 일은 보통 연속으로 일어나므로, 카드를 고를 때마다 사람이 다시 칸을 누르게
 * 하면 그 손이 그대로 낭비다. 뒤쪽 빈 칸을 먼저 보고, 없으면 앞쪽 빈 칸, 그것도 없으면 다음
 * 칸으로 넘어간다.
 */
export function nextFormationSlot(formation: FormationSlots, placedSlot: number): number {
  const count = formation.length;
  if (count === 0) return 0;
  for (let step = 1; step <= count; step += 1) {
    const index = (placedSlot + step) % count;
    if (formation[index] === null) return index;
  }
  return (placedSlot + 1) % count;
}

/**
 * 칸을 누른 뒤 남는 상태.
 *
 * **누르는 것과 빼는 것을 가른다.** 빈 칸이든 찬 칸이든 한 번 누르면 그 칸이 골라질 뿐이고,
 * 이미 골라 둔 칸을 한 번 더 누를 때만 비운다 — 잘못 누른 손이 세워 둔 캐릭터를 곧바로
 * 지우지 않게 하려는 것이다. 빼는 손이 급한 사람을 위해 고른 칸 위에 `−`가 따로 서고, 그것도
 * 같은 결과(`intent: "clear"`)를 부른다.
 */
export interface FormationSlotTap {
  formation: (string | null)[];
  selectedSlot: number;
  /** 이번 누름이 실제로 한 자리를 비웠는지. 화면이 다시 그릴 이유를 이 값으로 판단한다. */
  cleared: boolean;
}

export function tapFormationSlot(
  formation: FormationSlots,
  index: number,
  selectedSlot: number,
  intent: "select" | "clear" = "select",
): FormationSlotTap {
  if (!inRange(formation, index)) return { formation: copy(formation), selectedSlot, cleared: false };
  const occupied = formation[index] !== null && formation[index] !== undefined;
  const clearing = occupied && (intent === "clear" || index === selectedSlot);
  return {
    formation: clearing ? clearFormationSlot(formation, index) : copy(formation),
    // 비운 자리도 골라진 채로 남는다 — 비운 손 다음에 오는 것은 대부분 다시 채우는 손이다.
    selectedSlot: index,
    cleared: clearing,
  };
}

/** 빈 자리를 뺀 실제 편성원. 서버로 보내거나 인원 수를 셀 때 쓴다. */
export function formationMembers(formation: FormationSlots): string[] {
  return formation.filter((id): id is string => typeof id === "string");
}

/** 고정 길이 편성으로 맞춘다. 모자라면 빈 자리로 채우고 넘치면 자른다. */
export function toFormationSlots(ids: readonly (string | null | undefined)[], size: number): (string | null)[] {
  return Array.from({ length: size }, (_unused, index) => ids[index] ?? null);
}
