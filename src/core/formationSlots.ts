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
 * 목록의 카드를 누른 결과.
 *
 * **이미 어느 칸에 선 렐릭을 누르면 그 칸을 고른다.** 고른 칸으로 끌어오지 않는다 — 목록에서
 * 이미 나가 있는 얼굴을 누르는 손은 대개 "쟤가 몇 번이지"를 확인하거나 그 자리를 손보려는
 * 것이지, 다른 칸으로 옮기려는 것이 아니다. 옮기는 일은 칸을 끌어서 한다.
 *
 * 아직 어디에도 없는 렐릭은 **고른 칸**에 선다. 그 칸에 누가 서 있었다면 그대로 갈아 끼운다.
 * 채운 뒤에도 **선택은 그 자리에 머문다** — 다음 빈 칸으로 밀면 방금 세운 렐릭을 곧바로 다시
 * 바꿔 볼 수 없고, 사람이 고른 자리가 사람이 누르지 않은 곳으로 옮겨 간다.
 */
export function tapRosterRelic(formation: FormationSlots, selectedSlot: number | undefined, relicId: string): FormationSlotTap {
  const placedAt = formation.indexOf(relicId);
  if (placedAt >= 0) return { formation: copy(formation), selectedSlot: placedAt, cleared: false };
  const next = copy(formation);
  // 아무 칸도 고르지 않았으면 **빈 칸 하나**에만 세운다. 처음 셋을 채우는 동안에는 어느 칸이든
  // 상관없어 칸을 먼저 누르게 하는 것이 손만 늘리는 일이기 때문이다. 반대로 이미 다 찼다면
  // 누구를 물릴지는 사람이 정해야 하므로 아무 일도 하지 않는다 — 마지막 칸을 임의로 바꾸면
  // 누르지 않은 자리의 캐릭터가 사라진다.
  const target = selectedSlot ?? next.indexOf(null);
  if (!inRange(formation, target)) return { formation: next, selectedSlot, cleared: false };
  next[target] = relicId;
  return { formation: next, selectedSlot: target, cleared: false };
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
  /** 이 손짓 뒤에 골라져 있는 칸. 아무 칸도 고르지 않은 상태는 `undefined`다. */
  selectedSlot: number | undefined;
  /** 이번 누름이 실제로 한 자리를 비웠는지. 화면이 다시 그릴 이유를 이 값으로 판단한다. */
  cleared: boolean;
}

export function tapFormationSlot(
  formation: FormationSlots,
  index: number,
  selectedSlot: number | undefined,
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
