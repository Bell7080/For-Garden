import type { GuildBadge } from "../core/guildBadge";
import type { GuildJoinMode, GuildRole } from "../core/guild";
import type { GuildWarBranch, GuildWarPhase, GuildWarSlotKind } from "../core/guildWar";
import type { GuildGuardSlotUnit } from "../core/guildGuardBattle";

/**
 * 길드 서버 경계의 계약. 규칙은 `src/core/guild*.ts` 순수 모듈이 갖고, 이 파일은 응답 모양과 오류 코드만 갖는다.
 *
 * 길드 상태(가입·직위·출석 기록·길드 코인)는 길드 백엔드가 소유하고, **지갑을 건드리는 네 조작**(생성·뱃지 변경·
 * 출석 보상·상점 구매)은 `GameApi`가 맡아 지갑 변경과 길드 변경을 한 호출 안에서 확정한다.
 */

export const GUILD_ERROR_CODES = [
  "UNAVAILABLE", "LEVEL_LOCKED", "ALREADY_IN_GUILD", "NOT_IN_GUILD", "NAME_INVALID", "NAME_TAKEN", "NAME_BLOCKED", "BADGE_INVALID",
  "GUILD_NOT_FOUND", "GUILD_FULL", "LEAVE_COOLDOWN", "REQUEST_EXISTS", "REQUEST_NOT_FOUND", "MEMBER_NOT_FOUND",
  "NO_PERMISSION", "ROLE_FULL", "INVALID_TARGET", "LEADER_CANNOT_LEAVE", "ALREADY_STAMPED", "PRODUCT_NOT_FOUND",
  "PRODUCT_LIMIT", "INSUFFICIENT_COINS", "INSUFFICIENT_GEMS", "INVALID_REQUEST", "GUARD_LIMIT", "GUARD_NOT_ENTERED",
  "WAR_LOCKED", "SLOT_INVALID", "SLOT_TAKEN", "GUILD_LEVEL_LOW",
] as const;
export type GuildErrorCode = (typeof GUILD_ERROR_CODES)[number];
export const isGuildErrorCode = (value: string): value is GuildErrorCode => (GUILD_ERROR_CODES as readonly string[]).includes(value);

export class GuildApiError extends Error {
  constructor(public readonly code: GuildErrorCode, message: string = code) { super(message); this.name = "GuildApiError"; }
}

/** 길드 백엔드가 호출자를 알아보는 값. 서버는 JWT의 사용자와 저장된 진행에서 만들고 클라이언트의 말을 쓰지 않는다. */
export interface GuildActor { userId: string; name: string; level: number; avatarRelicId: string; frameId: string; card?: GuildMemberCard }

/**
 * 길드원이 서로 보는 공개 카드 — 친구 카드와 같은 값만 담는다(인증·계정 내부 키는 없다).
 * 서버가 저장된 진행에서 굳혀 호출마다 길드원 행에 새로 적는다.
 */
export interface GuildMemberCard {
  uid: string;
  bio: string;
  favorite: { relicId: string; level: number; breakthroughGrade: number; power: number; skinId: string | null } | null;
  highestStageId: string | null;
  expeditionBest: number;
  /** 고대 지층에서 가장 깊이 깬 층(0이면 아직 들어가지 않았다). 예전 카드에는 없다. */
  ancientFloor?: number;
  /** 결투장 점수(이번 시즌). 결투장을 연 적이 없으면 비어 있다. 예전 카드에는 없다. */
  duelScore?: number;
  /** 아레나 RP — 한 판이라도 한 길드원만 서버가 싣는다(`server_arena_weekly` 트리거). */
  arenaScore?: number;
}

export interface GuildSummary {
  id: string; name: string; badge: GuildBadge; level: number; memberCount: number; capacity: number;
  joinMode: GuildJoinMode; leaderName: string; notice: string;
  /** 순위 줄이 읽는 값 — 부흥도, 길드원 누적 기여도의 합, 길드전·수호전 점수(열리기 전에는 null). */
  prosperity: number; contributionTotal: number; warScore: number | null; guardScore: number | null;
}
export interface GuildDetail extends GuildSummary {
  createdAt: number;
  /** 길드전 등수(길드전이 열리기 전에는 null). 점수는 요약이 갖는다. */
  warRank: number | null;
  /** 뱃지를 아직 한 번도 바꾸지 않았으면 처음 한 번은 무료다. */
  badgeFree: boolean;
}
export interface GuildMe { role: GuildRole; coin: number; contributionWeek: number; contributionTotal: number; joinedAt: number }

export interface GuildStateResponse {
  guild: GuildDetail | null; me: GuildMe | null;
  /** 이 시각 전에는 다른 길드에 들어갈 수 없다(0이면 자유). */
  leaveCooldownUntil: number;
  /** 승인 대기 중인 가입 신청 수 — 승인 권한이 있는 직위에게만 센다. */
  pendingRequests: number;
  /** 가입 신청을 보내 둔 길드 id. */
  requestedGuildIds: string[];
  serverTime: number;
}

export interface GuildMemberView {
  userId: string; name: string; level: number; role: GuildRole; avatarRelicId: string; frameId: string;
  contributionWeek: number; contributionTotal: number; lastActiveAt: number; isMe: boolean;
  /** 카드를 아직 한 번도 적지 않은 길드원(가입 직후)은 null이다. */
  card: GuildMemberCard | null;
}
export interface GuildJoinRequestView { userId: string; name: string; level: number; avatarRelicId: string; frameId: string; requestedAt: number }
export interface GuildMembersResponse { members: GuildMemberView[]; requests: GuildJoinRequestView[]; serverTime: number }

export interface GuildSearchResponse { guilds: GuildSummary[]; serverTime: number }

/** 일곱 칸을 도는 출석 도장판(`guildAttendanceView`). */
export interface GuildAttendanceState {
  /** 이번 바퀴에 찍혀 보이는 칸 수(0~7). */
  filled: number;
  /** 오늘 찍을(또는 찍은) 칸의 번호(1~7). */
  day: number;
  stampedToday: boolean;
  serverTime: number;
}
/** 수호전 길드 안 순위 한 줄 — 오늘 최고 점수. */
export interface GuildGuardMemberEntry { rank: number; userId: string; name: string; level: number; avatarRelicId: string; frameId: string; score: number; isMe: boolean }
/** 수호전 길드 순위 한 줄 — 길드원 오늘 최고 점수의 합. */
export interface GuildGuardGuildEntry { rank: number; id: string; name: string; badge: GuildBadge; level: number; score: number; isMine: boolean }
/** 수호전 판 — 오늘(UTC 날짜 번호)의 길드 안·길드 순위. 도전 횟수와 편성은 게임 서버(`getGuildGuard`)가 갖는다. */
export interface GuildGuardBoard {
  day: number;
  members: GuildGuardMemberEntry[];
  /** 위 50길드. 내 길드가 그 밖이면 `mine`이 따로 말한다. */
  guilds: GuildGuardGuildEntry[];
  mine: GuildGuardGuildEntry | null;
  serverTime: number;
}

/** 방어덱 한 자리 — 지도와 칸 쪽지가 읽는 공개 값. 전투가 읽는 스냅샷은 따로 든다(`GuildWarDefenseInput.lineup`). */
export interface GuildWarDeckEntry { relicId: string; level: number; breakthrough: number; power: number }
/** 방어진 지도의 칸 하나. 비어 있으면 `holder`가 null이다. */
export interface GuildWarMapSlot {
  id: string; branch: GuildWarBranch; kind: GuildWarSlotKind; index: number;
  holder: { userId: string; name: string; level: number; avatarRelicId: string; frameId: string; isMe: boolean } | null;
  deck: GuildWarDeckEntry[];
  power: number;
}
/** 우리 길드의 방어진 지도 — 정비일에만 고칠 수 있다. */
export interface GuildWarMapState {
  level: number; phase: GuildWarPhase; endsAt: number;
  slots: GuildWarMapSlot[];
  /** 내가 방어덱을 세운 칸(없으면 null). 한 사람은 한 칸만 맡는다. */
  mySlotId: string | null;
  /** 다른 길드원의 칸을 비울 수 있는 직위인가(`guildCan(role, "formation")`). */
  canArrange: boolean;
  serverTime: number;
}
/** 방어덱 게시 — 게임 서버가 보유·성장을 확인해 굳힌 값만 길드 백엔드로 넘어간다. */
export interface GuildWarDefenseInput { slotId: string; deck: GuildWarDeckEntry[]; lineup: GuildGuardSlotUnit[] }

/** 산 수(`bought`)는 그 상품의 주기(주간·월간) 안에서 센다. */
export interface GuildShopItem { productId: string; price: number; limit: number; refresh: "weekly" | "monthly"; minGuildLevel?: number; bought: number }
/** `guildLevel`은 레벨 칸(`minGuildLevel`)을 여는 지금 길드 레벨이다. */
export interface GuildShopState { coin: number; guildLevel: number; items: GuildShopItem[]; serverTime: number }

/** 지갑과 무관한 길드 조작 — 클라이언트가 `guildApi`로 부른다. */
export interface GuildApi {
  getGuild(): Promise<GuildStateResponse>;
  searchGuilds(query: string): Promise<GuildSearchResponse>;
  getMembers(): Promise<GuildMembersResponse>;
  joinGuild(guildId: string): Promise<{ status: "joined" | "requested" }>;
  cancelJoinRequest(guildId: string): Promise<void>;
  leaveGuild(): Promise<void>;
  decideJoinRequest(userId: string, approve: boolean): Promise<void>;
  kickMember(userId: string): Promise<void>;
  setMemberRole(userId: string, role: Exclude<GuildRole, "leader">): Promise<void>;
  transferLeader(userId: string): Promise<void>;
  updateGuild(update: { notice?: string; joinMode?: GuildJoinMode }): Promise<void>;
  disbandGuild(): Promise<void>;
  getAttendance(): Promise<GuildAttendanceState>;
  getShop(): Promise<GuildShopState>;
  getGuard(): Promise<GuildGuardBoard>;
  getWarMap(): Promise<GuildWarMapState>;
  /** 정비일에만. 자기 칸이거나 배치 권한(`formation`)이 있으면 비운다. */
  clearWarSlot(slotId: string): Promise<GuildWarMapState>;
}

export const GUILD_API_METHODS = [
  "getGuild", "searchGuilds", "getMembers", "joinGuild", "cancelJoinRequest", "leaveGuild", "decideJoinRequest", "kickMember",
  "setMemberRole", "transferLeader", "updateGuild", "disbandGuild", "getAttendance", "getShop", "getGuard",
  "getWarMap", "clearWarSlot",
] as const satisfies readonly (keyof GuildApi)[];
export type GuildApiMethod = (typeof GUILD_API_METHODS)[number];
export const isGuildApiMethod = (value: string): value is GuildApiMethod => (GUILD_API_METHODS as readonly string[]).includes(value);
export const GUILD_READ_METHODS: readonly GuildApiMethod[] = ["getGuild", "searchGuilds", "getMembers", "getAttendance", "getShop", "getGuard", "getWarMap"];

/**
 * 길드 백엔드 — `GuildApi`의 모든 조작에 호출자(`actor`)를 앞세우고, 지갑이 얽힌 네 조작을 더한 것이다.
 * 로컬은 `FakeGuildServer`, 운영 서버는 DB 함수를 부르는 구현이 같은 모양을 채운다.
 */
export interface GuildBackend {
  getGuild(actor: GuildActor): Promise<GuildStateResponse>;
  searchGuilds(actor: GuildActor, query: string): Promise<GuildSearchResponse>;
  getMembers(actor: GuildActor): Promise<GuildMembersResponse>;
  joinGuild(actor: GuildActor, guildId: string): Promise<{ status: "joined" | "requested" }>;
  cancelJoinRequest(actor: GuildActor, guildId: string): Promise<void>;
  leaveGuild(actor: GuildActor): Promise<void>;
  decideJoinRequest(actor: GuildActor, userId: string, approve: boolean): Promise<void>;
  kickMember(actor: GuildActor, userId: string): Promise<void>;
  setMemberRole(actor: GuildActor, userId: string, role: Exclude<GuildRole, "leader">): Promise<void>;
  transferLeader(actor: GuildActor, userId: string): Promise<void>;
  updateGuild(actor: GuildActor, update: { notice?: string; joinMode?: GuildJoinMode }): Promise<void>;
  disbandGuild(actor: GuildActor): Promise<void>;
  getAttendance(actor: GuildActor): Promise<GuildAttendanceState>;
  getShop(actor: GuildActor): Promise<GuildShopState>;
  getGuard(actor: GuildActor): Promise<GuildGuardBoard>;
  /**
   * 수호전 한 판의 기록 — 게임 서버가 다시 굴려 확정한 점수와 그 판의 코인만 넘긴다. 오늘 최고 점수를 갱신하고 코인을
   * 길드원 행에 더한다. 돌려주는 `best`는 오늘 최고, `coin`은 더한 뒤의 보유 코인이다.
   */
  recordGuard(actor: GuildActor, record: { day: number; score: number; coin: number }, requestId: string): Promise<{ best: number; coin: number }>;
  getWarMap(actor: GuildActor): Promise<GuildWarMapState>;
  clearWarSlot(actor: GuildActor, slotId: string): Promise<GuildWarMapState>;
  /** 정비일에만, 빈 칸에만. 이미 다른 칸을 맡았으면 그 칸을 비우고 옮긴다. */
  placeWarDefense(actor: GuildActor, input: GuildWarDefenseInput, requestId: string): Promise<GuildWarMapState>;
  /** 길드를 만든다. 젬 차감은 부르는 쪽(`GameApi`)이 한 호출 안에서 확정한다. */
  createGuild(actor: GuildActor, input: { name: string; joinMode: GuildJoinMode; badge: GuildBadge }, requestId: string): Promise<GuildStateResponse>;
  /** 길드장만. 바뀌었는지와 값을 치러야 했는지(첫 변경은 무료)를 돌려줘 부르는 쪽이 젬을 받을지 정한다. */
  changeBadge(actor: GuildActor, badge: GuildBadge, requestId: string): Promise<{ changed: boolean; charged: boolean }>;
  /** 오늘 칸을 찍는다. 돌려주는 `day`가 지갑에 들 몫을 정한다(`guildAttendanceDay`). */
  stampAttendance(actor: GuildActor, requestId: string): Promise<{ attendance: GuildAttendanceState; day: number }>;
  purchase(actor: GuildActor, productId: string, requestId: string): Promise<{ shop: GuildShopState }>;
}
