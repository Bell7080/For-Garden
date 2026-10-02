/**
 * 연구원 레벨이 여는 콘텐츠.
 *
 * **처음부터 버튼을 다 보여 주지 않는다.** 시작하자마자 교류·발굴·결투·대작전·현상수배·레이드·
 * 원정이 한꺼번에 서면 무엇부터 해야 할지 모르는 화면이 된다 — 수집형 RPG가 계정 레벨로
 * 콘텐츠를 하나씩 여는 이유다. 어느 콘텐츠가 몇 레벨에 열리는지는 **이 표 하나**가 갖고,
 * 화면·서버·프로필 모두 여기서 읽는다.
 *
 * 잠금은 켜져 있다(`CONTENT_LEVEL_GATES_ENABLED`). 1레벨 계정에는 발굴·교류·결투가 로비에서
 * 보이지 않고(열릴 때 자물쇠가 터지며 나타난다), 고고학 탭과 출격 안의 입구는 자물쇠가 걸린 채
 * 남는다. QA는 설정의 「레벨 만렙 · 모두 개방」으로 한 번에 연다.
 */
export type ContentId = "excavation" | "interaction" | "cakeOperation" | "bounty" | "expedition" | "raid" | "duel" | "archaeology";

export interface ContentUnlock { id: ContentId; level: number; }

/** 여는 순서이자 레벨. 같은 레벨에 둘을 열지 않는다 — 한 번에 하나씩 새것이 서야 무엇이 열렸는지 읽힌다. */
export const CONTENT_UNLOCKS: readonly ContentUnlock[] = [
  { id: "excavation", level: 2 },
  { id: "archaeology", level: 3 },
  { id: "interaction", level: 4 },
  { id: "cakeOperation", level: 5 },
  { id: "duel", level: 6 },
  { id: "bounty", level: 8 },
  { id: "raid", level: 10 },
  { id: "expedition", level: 12 },
] as const;

/** 레벨 잠금을 거는지. 끄면 모든 콘텐츠가 열려 있다. */
export const CONTENT_LEVEL_GATES_ENABLED = true;

export function contentUnlockLevel(id: ContentId): number {
  return CONTENT_UNLOCKS.find((entry) => entry.id === id)?.level ?? 1;
}

export function isContentUnlocked(id: ContentId, playerLevel: number, gates = CONTENT_LEVEL_GATES_ENABLED): boolean {
  return !gates || playerLevel >= contentUnlockLevel(id);
}

/** 아직 닫힌 것 중 가장 먼저 열리는 하나. 잠금을 걸지 않는 동안에는 없다. */
export function nextContentUnlock(playerLevel: number, gates = CONTENT_LEVEL_GATES_ENABLED): ContentUnlock | undefined {
  if (!gates) return undefined;
  return CONTENT_UNLOCKS.find((entry) => entry.level > playerLevel);
}

/** 한 레벨업으로 새로 열린 것들(`from` 초과 ~ `to` 이하). 레벨업 알림이 읽는다. */
export function contentUnlockedBetween(from: number, to: number, gates = CONTENT_LEVEL_GATES_ENABLED): ContentUnlock[] {
  if (!gates) return [];
  return CONTENT_UNLOCKS.filter((entry) => entry.level > from && entry.level <= to);
}
