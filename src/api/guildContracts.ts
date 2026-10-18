import type { GuildBadge } from "../core/guildBadge";
import type { GuildJoinMode, GuildRole } from "../core/guild";

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
  "PRODUCT_LIMIT", "INSUFFICIENT_COINS", "INSUFFICIENT_GEMS", "INVALID_REQUEST",
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
export interface GuildShopItem { productId: string; price: number; weeklyLimit: number; bought: number }
export interface GuildShopState { coin: number; items: GuildShopItem[]; serverTime: number }

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
}

export const GUILD_API_METHODS = [
  "getGuild", "searchGuilds", "getMembers", "joinGuild", "cancelJoinRequest", "leaveGuild", "decideJoinRequest", "kickMember",
  "setMemberRole", "transferLeader", "updateGuild", "disbandGuild", "getAttendance", "getShop",
] as const satisfies readonly (keyof GuildApi)[];
export type GuildApiMethod = (typeof GUILD_API_METHODS)[number];
export const isGuildApiMethod = (value: string): value is GuildApiMethod => (GUILD_API_METHODS as readonly string[]).includes(value);
export const GUILD_READ_METHODS: readonly GuildApiMethod[] = ["getGuild", "searchGuilds", "getMembers", "getAttendance", "getShop"];

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
  /** 길드를 만든다. 젬 차감은 부르는 쪽(`GameApi`)이 한 호출 안에서 확정한다. */
  createGuild(actor: GuildActor, input: { name: string; joinMode: GuildJoinMode; badge: GuildBadge }, requestId: string): Promise<GuildStateResponse>;
  /** 길드장만. 바뀌었는지와 값을 치러야 했는지(첫 변경은 무료)를 돌려줘 부르는 쪽이 젬을 받을지 정한다. */
  changeBadge(actor: GuildActor, badge: GuildBadge, requestId: string): Promise<{ changed: boolean; charged: boolean }>;
  /** 오늘 칸을 찍는다. 돌려주는 `day`가 지갑에 들 몫을 정한다(`guildAttendanceDay`). */
  stampAttendance(actor: GuildActor, requestId: string): Promise<{ attendance: GuildAttendanceState; day: number }>;
  purchase(actor: GuildActor, productId: string, requestId: string): Promise<{ shop: GuildShopState }>;
}
