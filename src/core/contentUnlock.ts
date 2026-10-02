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
 * 여는 순서이자 레벨. 한 번에 하나씩 새것이 서야 무엇이 열렸는지 읽히지만, **한 쌍으로 읽히는 콘텐츠는 같은 레벨에 함께 연다**
 * (상점+무역 — 둘 다 재화를 쓰는 곳, 대작전+현상수배 — 둘 다 일일 던전).
 *
 * **시작부터 열려 있는 것**(표에 없다): 출격(스토리), 연구소(뽑기), 도감, 임무, 우편, 가방, 프리미엄, 이벤트, 설정.
 * 수집형 RPG의 첫 몇 분은 「스토리 → 뽑기 → 육성 → 임무」 한 바퀴가 전부라 그 고리에 드는 것은 닫지 않는다.
 *
 * 차례의 기준은 「그 콘텐츠가 필요한 재화·이해가 쌓이는 때」다.
 * - 2: 발굴 — 방치형이라 가장 먼저 맛보게 한다.
 * - 3: 상점+무역 — 재화를 쓰는 창구는 일찍 열고, 얼마나 사 모을지는 재화 공급 쪽이 조인다.
 * - 4: 대작전+현상수배 — 급여·돌파 재료 파밍. 한꺼번에 밀고 싶어도 **적 레벨 사다리(난이도)** 가 막으므로 재화 인플레이션은 거기서 조인다.
 * - 5~6: 교류 → 결투 — 서브 콘텐츠를 차례로, 결투는 편성이 갖춰진 뒤.
 * - 7~10: 친구 → 레이드(공동 토벌이라 친구가 먼저) → 원정 — 가장 무겁고 마지막에 닿는 콘텐츠.
 *
 * **개방 속도의 목표**: 진득하게 하는 계정이 하루~이틀(시간 회복만 쓸 때 2일 안)에 거의 다 연다. 레벨별로 몇 스테미나를 녹여야
 * 하는지는 `naturalStaminaToReach`가 재고 `docs/content-unlock-pacing.md`에 표로 남겼다. 레벨을 옮길 때는 그 표와 테스트를 함께 본다.
 * - 고고학은 레벨이 아니라 **스테이지 클리어**로 연다(`CONTENT_STAGE_UNLOCKS`) — 원석과 특성이 처음 열리는 1-10을 깬 사람이 그것을 쓸 곳이다.
 */
export const CONTENT_UNLOCKS: readonly ContentUnlock[] = [
  { id: "excavation", level: 2 },
  { id: "shop", level: 3 },
  { id: "trade", level: 3 },
  { id: "cakeOperation", level: 4 },
  { id: "bounty", level: 4 },
  { id: "interaction", level: 5 },
  { id: "duel", level: 6 },
  { id: "friends", level: 7 },
  { id: "raid", level: 9 },
  { id: "expedition", level: 10 },
] as const;

/** 레벨이 아니라 **스테이지 클리어**로 열리는 콘텐츠. 그 스테이지를 깨는 순간 열린다. */
export const CONTENT_STAGE_UNLOCKS: Partial<Record<ContentId, string>> = { archaeology: "1-10" };

/** 개방 조건이 있는 모든 콘텐츠. */
export const ALL_GATED_CONTENT: readonly ContentId[] = [...CONTENT_UNLOCKS.map((entry) => entry.id), ...(Object.keys(CONTENT_STAGE_UNLOCKS) as ContentId[])];

/** 레벨 잠금을 거는지. 끄면 모든 콘텐츠가 열려 있다. */
export const CONTENT_LEVEL_GATES_ENABLED = true;

export function contentUnlockLevel(id: ContentId): number {
  return CONTENT_UNLOCKS.find((entry) => entry.id === id)?.level ?? 1;
}

export function isContentUnlocked(id: ContentId, playerLevel: number, gates = CONTENT_LEVEL_GATES_ENABLED, clearedStages: ReadonlySet<string> = new Set()): boolean {
  if (!gates) return true;
  const stage = CONTENT_STAGE_UNLOCKS[id];
  if (stage !== undefined) return clearedStages.has(stage);
  return playerLevel >= contentUnlockLevel(id);
}

/** 아직 닫힌 것 중 가장 먼저 열리는 하나. 잠금을 걸지 않는 동안에는 없다. */
export function nextContentUnlock(playerLevel: number, gates = CONTENT_LEVEL_GATES_ENABLED): ContentUnlock | undefined {
  if (!gates) return undefined;
  return CONTENT_UNLOCKS.find((entry) => entry.level > playerLevel);
}

/** 아직 못 연 스테이지 조건 콘텐츠 중 하나(레벨 표와 별개의 조건이라 따로 읽는다). */
export function nextStageUnlock(clearedStages: ReadonlySet<string>, gates = CONTENT_LEVEL_GATES_ENABLED): { id: ContentId; stageId: string } | undefined {
  if (!gates) return undefined;
  for (const [id, stageId] of Object.entries(CONTENT_STAGE_UNLOCKS) as [ContentId, string][]) if (!clearedStages.has(stageId)) return { id, stageId };
  return undefined;
}

/** 한 레벨업으로 새로 열린 것들(`from` 초과 ~ `to` 이하). 레벨업 알림이 읽는다. */
export function contentUnlockedBetween(from: number, to: number, gates = CONTENT_LEVEL_GATES_ENABLED): ContentUnlock[] {
  if (!gates) return [];
  return CONTENT_UNLOCKS.filter((entry) => entry.level > from && entry.level <= to);
}
