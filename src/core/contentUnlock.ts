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
export type ContentId = "excavation" | "interaction" | "cakeOperation" | "bounty" | "expedition" | "raid" | "duel" | "archaeology" | "shop" | "trade" | "friends";

export interface ContentUnlock { id: ContentId; level: number; }

/**
 * 여는 순서이자 레벨. 같은 레벨에 둘을 열지 않는다 — 한 번에 하나씩 새것이 서야 무엇이 열렸는지 읽힌다.
 *
 * **시작부터 열려 있는 것**(표에 없다): 출격(스토리), 연구소(뽑기), 도감, 임무, 우편, 가방, 프리미엄, 이벤트, 설정.
 * 수집형 RPG의 첫 몇 분은 「스토리 → 뽑기 → 육성 → 임무」 한 바퀴가 전부라 그 고리에 드는 것은 닫지 않는다.
 *
 * 차례의 기준은 「그 콘텐츠가 필요한 재화·이해가 쌓이는 때」다.
 * - 2~4: 육성 재료를 방치·탐사로 모으는 서브 콘텐츠(발굴 → 고고학 → 교류)를 하나씩 맛보게 한다.
 * - 5: 치즈케이크(급여·돌파 재료)를 모으는 일일 던전 — 육성이 막히기 시작하는 때다.
 * - 6: 결투 — 편성이 갖춰진 뒤의 첫 대인 콘텐츠.
 * - 7: 상점 — 재화가 쌓인 뒤에 쓰는 곳이다.
 * - 8~10: 현상수배 → 친구 → 레이드. 친구는 레이드(공동 토벌)의 전제라 그 앞에 둔다.
 * - 11~12: 무역(남는 재화 교환)과 20층 원정 — 가장 무겁고 마지막에 닿는 콘텐츠.
 */
export const CONTENT_UNLOCKS: readonly ContentUnlock[] = [
  { id: "excavation", level: 2 },
  { id: "archaeology", level: 3 },
  { id: "interaction", level: 4 },
  { id: "cakeOperation", level: 5 },
  { id: "duel", level: 6 },
  { id: "shop", level: 7 },
  { id: "bounty", level: 8 },
  { id: "friends", level: 9 },
  { id: "raid", level: 10 },
  { id: "trade", level: 11 },
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
