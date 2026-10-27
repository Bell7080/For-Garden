import { GUILD_NOTICE_MAX, findGuildProduct, guildGlyphCount, guildNameKey, validateGuildName } from "../core/guild";
import type { GuildJoinMode, GuildRole } from "../core/guild";
import { isGuildBadge, type GuildBadge } from "../core/guildBadge";
import { GuildApiError, type GuildActor, type GuildBackend } from "./guildContracts";

/** DB 함수 `server_guild_call`을 부르는 얇은 호출자다(서비스 롤 키는 서버 환경에만 있다). */
export type GuildCaller = (actor: GuildActor, method: string, args: unknown[], requestId: string | null) => Promise<unknown>;

const ASSIGNABLE_ROLES: readonly string[] = ["vice", "officer", "member"];
const invalid = (): never => { throw new GuildApiError("INVALID_REQUEST", "INVALID_REQUEST"); };
const isJoinMode = (value: unknown): value is GuildJoinMode => value === "open" || value === "approval";
const isId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 64;

/**
 * 운영 서버의 길드 백엔드. 규칙의 원본은 `FakeGuildServer`와 순수 모듈이고, 이름·뱃지·공지처럼 문자 규칙이 필요한 검증은
 * (DB 정규식이 `\p{L}`을 모르므로) 여기서 먼저 끝낸 값만 DB 함수로 넘긴다. DB 함수는 정원·직위·중복·멱등을 판정한다.
 */
export function createSupabaseGuildBackend(call: GuildCaller): GuildBackend {
  const run = <T>(actor: GuildActor, method: string, args: unknown[] = [], requestId: string | null = null) =>
    call(actor, method, args, requestId) as Promise<T>;
  return {
    getGuild: (actor) => run(actor, "getGuild"),
    searchGuilds: (actor, query) => run(actor, "searchGuilds", [typeof query === "string" ? query.slice(0, 40) : ""]),
    getMembers: (actor) => run(actor, "getMembers"),
    joinGuild: (actor, guildId) => (isId(guildId) ? run(actor, "joinGuild", [guildId]) : invalid()),
    cancelJoinRequest: async (actor, guildId) => { if (!isId(guildId)) invalid(); await run(actor, "cancelJoinRequest", [guildId]); },
    leaveGuild: async (actor) => { await run(actor, "leaveGuild"); },
    decideJoinRequest: async (actor, userId, approve) => {
      if (!isId(userId) || typeof approve !== "boolean") invalid();
      await run(actor, "decideJoinRequest", [userId, approve]);
    },
    kickMember: async (actor, userId) => { if (!isId(userId)) invalid(); await run(actor, "kickMember", [userId]); },
    setMemberRole: async (actor, userId, role: Exclude<GuildRole, "leader">) => {
      if (!isId(userId) || !ASSIGNABLE_ROLES.includes(role)) invalid();
      await run(actor, "setMemberRole", [userId, role]);
    },
    transferLeader: async (actor, userId) => { if (!isId(userId)) invalid(); await run(actor, "transferLeader", [userId]); },
    updateGuild: async (actor, update) => {
      const clean: { notice?: string; joinMode?: GuildJoinMode } = {};
      if (update.notice !== undefined) {
        if (typeof update.notice !== "string") invalid();
        const notice = update.notice.replace(/\s+/g, " ").trim();
        if (guildGlyphCount(notice) > GUILD_NOTICE_MAX) invalid();
        clean.notice = notice;
      }
      if (update.joinMode !== undefined) {
        if (!isJoinMode(update.joinMode)) invalid();
        clean.joinMode = update.joinMode;
      }
      await run(actor, "updateGuild", [clean]);
    },
    disbandGuild: async (actor) => { await run(actor, "disbandGuild"); },
    getAttendance: (actor) => run(actor, "getAttendance"),
    getShop: (actor) => run(actor, "getShop"),
    getGuard: (actor) => run(actor, "getGuard"),
    recordGuard: async (actor, record, requestId) => {
      const whole = (value: unknown, max: number): boolean => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= max;
      if (!whole(record?.day, 1_000_000) || !whole(record.score, 10_000_000) || !whole(record.coin, 100)) invalid();
      return run(actor, "recordGuard", [{ day: record.day, score: record.score, coin: record.coin }], requestId);
    },
    createGuild: (actor, input, requestId) => {
      const checked = validateGuildName(String(input?.name ?? ""));
      if (!checked.ok) throw new GuildApiError("NAME_INVALID", "NAME_INVALID");
      if (!isJoinMode(input.joinMode)) invalid();
      if (!isGuildBadge(input.badge)) throw new GuildApiError("BADGE_INVALID", "BADGE_INVALID");
      return run(actor, "createGuild", [{ name: checked.name, nameKey: guildNameKey(checked.name), joinMode: input.joinMode, badge: input.badge }], requestId);
    },
    changeBadge: (actor, badge: GuildBadge, requestId) => {
      if (!isGuildBadge(badge)) throw new GuildApiError("BADGE_INVALID", "BADGE_INVALID");
      return run(actor, "changeBadge", [badge], requestId);
    },
    stampAttendance: (actor, requestId) => run(actor, "stampAttendance", [], requestId),
    purchase: (actor, productId, requestId) => {
      if (!findGuildProduct(productId)) throw new GuildApiError("PRODUCT_NOT_FOUND", "PRODUCT_NOT_FOUND");
      return run(actor, "purchase", [productId], requestId);
    },
  };
}
