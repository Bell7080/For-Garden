/** 조력자 대여가 허용되는 콘텐츠 분류다. 경쟁·고난도 콘텐츠는 의도적으로 포함하지 않는다. */
export type HelperContentKind = "story_normal" | "resource" | "daily_restoration" | "story_hard" | "ranked" | "raid";

/** 하루에 다른 연구원의 애착 렐릭을 빌릴 수 있는 최대 횟수다. */
export const DAILY_HELPER_LIMIT = 3;

/** 한 번의 정상 대여가 성립했을 때 대여자와 제공자 양쪽에 지급하는 친구 포인트다. */
export const FRIEND_POINTS_PER_RENTAL = 10;

/**
 * 조력자는 성장 격차를 메우는 편의 수단일 뿐, 고난도 클리어 조건이 되어서는 안 된다.
 * 따라서 일반 스토리와 반복 재료 콘텐츠에서만 한 슬롯을 보조할 수 있다.
 */
export function canUseFriendHelper(kind: HelperContentKind): boolean {
  return kind === "story_normal" || kind === "resource" || kind === "daily_restoration";
}

/** 서버가 기록한 오늘 사용량을 기준으로 대여 가능 여부와 남은 횟수를 한 규칙으로 계산한다. */
export function helperRentalAvailability(usedToday: number): { allowed: boolean; remaining: number } {
  const normalized = Math.max(0, Math.floor(usedToday));
  const remaining = Math.max(0, DAILY_HELPER_LIMIT - normalized);
  return { allowed: remaining > 0, remaining };
}

/** 친구로 둘 수 있는 최대 인원. 이 수를 넘기는 수락·신청은 서버가 거절한다. */
export const FRIEND_LIMIT = 50;

/** 받은 신청·보낸 신청을 각각 쌓아 둘 수 있는 수. 넘치면 새 신청을 받지 않는다. */
export const FRIEND_REQUEST_LIMIT = 30;

/** 마지막 활동이 이 안이면 「접속 중」으로 본다. 서버가 붙으면 하트비트 주기에 맞춰 다시 잰다. */
export const ONLINE_WINDOW_MS = 5 * 60_000;

/** 친구 목록 정렬 기준. 접속순이 기본이다. */
export const FRIEND_SORT_MODES = ["lastActive", "name", "level"] as const;
export type FriendSortMode = (typeof FRIEND_SORT_MODES)[number];

/** 친구 목록 필터. 한 번에 하나만 켠다. */
export const FRIEND_FILTERS = ["all", "favorite", "online"] as const;
export type FriendFilter = (typeof FRIEND_FILTERS)[number];

/** 찾기 방식. 이름은 부분 일치, 고유 ID(UID)는 정확히 일치한다. */
export const USER_SEARCH_MODES = ["name", "uid"] as const;
export type UserSearchMode = (typeof USER_SEARCH_MODES)[number];

/** 한 이용자와 나의 관계. 차단한 이용자는 검색·추천에서 빠지므로 여기에는 없다. */
export type FriendRelation = "none" | "friend" | "incoming" | "outgoing";

/** 목록·정렬이 읽는 최소한의 친구 모양. */
export interface FriendListItem {
  id: string;
  displayName: string;
  level: number;
  lastActiveAt: number;
}

/** 지금 접속 중인가. 시계가 거꾸로 가도(미래 시각) 접속 중으로 본다. */
export function isOnline(lastActiveAt: number, nowMs: number): boolean {
  return nowMs - lastActiveAt <= ONLINE_WINDOW_MS;
}

export type LastActiveUnit = "online" | "minute" | "hour" | "day";

/** 「12분 전」「3시간 전」「2일 전」을 만들 값. 접속 중이면 단위만 `online`이다. */
export function lastActiveAge(lastActiveAt: number, nowMs: number): { unit: LastActiveUnit; value: number } {
  const elapsed = Math.max(0, nowMs - lastActiveAt);
  if (isOnline(lastActiveAt, nowMs)) return { unit: "online", value: 0 };
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return { unit: "minute", value: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { unit: "hour", value: hours };
  return { unit: "day", value: Math.floor(hours / 24) };
}

export interface FriendViewOptions {
  filter: FriendFilter;
  sort: FriendSortMode;
  /** 큰 값이 먼저인가. 접속순·레벨순은 기본이 true, 이름순은 false(가나다순). */
  descending: boolean;
  favoriteIds: ReadonlySet<string>;
  nowMs: number;
}

/** 정렬 기준마다 처음 보여 줄 방향. */
export function defaultFriendSortDirection(sort: FriendSortMode): boolean {
  return sort !== "name";
}

/**
 * 친구 목록에 서는 줄과 순서. 즐겨찾기는 어느 기준에서든 **맨 위에 모은다** — 별을 눌러 둔 보람이 정렬을
 * 바꿀 때마다 사라지면 안 된다. 기준이 같으면 이름순으로 가른다(순서가 매번 흔들리지 않게).
 */
export function viewFriends<T extends FriendListItem>(friends: readonly T[], options: FriendViewOptions): T[] {
  const { filter, sort, descending, favoriteIds, nowMs } = options;
  const kept = friends.filter((friend) => {
    if (filter === "favorite") return favoriteIds.has(friend.id);
    if (filter === "online") return isOnline(friend.lastActiveAt, nowMs);
    return true;
  });
  const direction = descending ? -1 : 1;
  const key = (friend: T): number | string => (sort === "lastActive" ? friend.lastActiveAt : sort === "level" ? friend.level : friend.displayName.toLocaleLowerCase());
  return [...kept].sort((a, b) => {
    const starA = favoriteIds.has(a.id) ? 0 : 1;
    const starB = favoriteIds.has(b.id) ? 0 : 1;
    if (starA !== starB) return starA - starB;
    const ka = key(a); const kb = key(b);
    const compared = typeof ka === "number" && typeof kb === "number" ? ka - kb : String(ka).localeCompare(String(kb));
    if (compared !== 0) return compared * direction;
    return a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id);
  });
}

/** 입력 칸의 글자를 찾기용으로 다듬는다. 앞뒤 공백을 걷고, UID는 숫자만 남긴다. */
export function normalizeSearchQuery(mode: UserSearchMode, raw: string): string {
  const trimmed = raw.trim();
  return mode === "uid" ? trimmed.replace(/\D/g, "") : trimmed;
}

/** 이름은 대소문자를 가리지 않는 부분 일치, UID는 정확히 일치한다. 빈 검색어는 아무와도 맞지 않는다. */
export function matchesUserQuery(user: { displayName: string; uid: string }, mode: UserSearchMode, query: string): boolean {
  const normalized = normalizeSearchQuery(mode, query);
  if (normalized.length === 0) return false;
  if (mode === "uid") return user.uid === normalized;
  return user.displayName.toLocaleLowerCase().includes(normalized.toLocaleLowerCase());
}
