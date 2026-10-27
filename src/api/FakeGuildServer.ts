import { QA_TOOLS_ENABLED } from "../core/buildFlavor";
import { isContentUnlocked } from "../core/contentUnlock";
import {
  GUILD_LEAVE_COOLDOWN_MS, GUILD_NOTICE_MAX, GUILD_ROLE_LIMIT, GUILD_SHOP_PRODUCTS, findGuildProduct, guildAttendanceDay, guildAttendanceView,
  guildCan, guildCanKick, guildCapacity, guildDateKey, guildGlyphCount, guildLevelOf, guildNameKey, guildWeekKey, validateGuildName,
  type GuildJoinMode, type GuildRole,
} from "../core/guild";
import { isGuildBadge, sameGuildBadge, type GuildBadge } from "../core/guildBadge";
import { combatPower } from "../core/combatPower";
import { rankGuildWar } from "../core/guildWar";
import { PLAYABLE_RELICS } from "../data/relics";
import {
  GuildApiError, type GuildActor, type GuildAttendanceState, type GuildBackend, type GuildDetail, type GuildErrorCode, type GuildJoinRequestView,
  type GuildMemberCard, type GuildMemberView, type GuildMembersResponse, type GuildSearchResponse, type GuildShopState, type GuildStateResponse, type GuildSummary,
} from "./guildContracts";

interface MemberRow {
  userId: string; name: string; level: number; role: GuildRole; avatarRelicId: string; frameId: string;
  joinedAt: number; lastActiveAt: number; coin: number;
  contributionWeekKey: string; contributionWeek: number; contributionTotal: number;
  /** 이번 바퀴에 찍은 수(0~7)와 마지막으로 찍은 날짜 키. */
  attendanceCount: number; attendanceLast: string | null;
  card: GuildMemberCard | null;
  purchases: Map<string, number>; purchaseWeekKey: string;
}
interface GuildRow {
  id: string; name: string; badge: GuildBadge; joinMode: GuildJoinMode; notice: string; prosperity: number; createdAt: number; badgeChanges: number;
  /** QA 길드전·수호전 점수(`guildQa`가 정한다). 열리기 전에는 null이라 순위 줄이 「-」로 선다. */
  warScore?: number | null; warReachedAt?: number; guardScore?: number | null;
  members: Map<string, MemberRow>; requests: Map<string, { actor: GuildActor; requestedAt: number }>;
}

/** 서버가 모르는 요청을 거절하는 한 줄 도우미. */
const fail = (code: GuildErrorCode, message?: string): never => { throw new GuildApiError(code, message); };

/**
 * 길드 백엔드의 메모리 구현. **QA 전용 임시 구현**이며 새로고침하면 초기화된다 — 서버가 연결된 빌드는 DB 함수가
 * 같은 규칙을 대신 확정한다. 서버 쪽 규칙 테스트도 이 클래스를 기준 구현으로 쓴다(`tests/unit/guildServer.test.ts`).
 */
export class FakeGuildServer implements GuildBackend {
  private readonly guilds = new Map<string, GuildRow>();
  private readonly userGuild = new Map<string, string>();
  private readonly leftAt = new Map<string, number>();
  private readonly requestedBy = new Map<string, Set<string>>();
  private readonly receipts = new Map<string, unknown>();
  private sequence = 0;

  constructor(private readonly now: () => number = Date.now, private readonly options: { seed?: boolean; levelGate?: boolean } = {}) {
    if (options.seed ?? QA_TOOLS_ENABLED) this.seedSamples();
  }

  private seedSamples(): void {
    const roster = PLAYABLE_RELICS;
    const hash = (text: string): number => { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return h >>> 0; };
    const sample = (name: string, badge: GuildBadge, joinMode: GuildJoinMode, prosperity: number, count: number, notice: string, warScore: number | null) => {
      const id = `sample-${++this.sequence}`;
      const members = new Map<string, MemberRow>();
      for (let i = 0; i < count; i++) {
        const userId = `${id}-m${i}`;
        const seed = hash(userId);
        const relic = roster[seed % roster.length];
        const level = Math.max(8, Math.min(60, 54 - i * 3 + (seed % 7)));
        const role: GuildRole = i === 0 ? "leader" : i === 1 ? "vice" : i < 4 ? "officer" : "member";
        const memberName = i === 0 ? `${name} 마스터` : `${SAMPLE_NAMES[(seed >>> 3) % SAMPLE_NAMES.length]}${i + 1}`;
        const frameId = level >= 45 ? "garden" : level >= 30 ? "abyss" : level >= 20 ? "amber" : "holo";
        const card: GuildMemberCard = {
          uid: `QA${String(seed).padStart(10, "0").slice(0, 10)}`, bio: SAMPLE_BIOS[seed % SAMPLE_BIOS.length],
          favorite: { relicId: relic.id, level, breakthroughGrade: Math.min(5, 1 + Math.floor(level / 14)), power: Math.round(combatPower(relic.stats) * (0.6 + level / 40)), skinId: null },
          highestStageId: level >= 30 ? "2-5" : "1-8", expeditionBest: (seed % 90) * 1_000,
        };
        const member = this.newMember({ userId, name: memberName, level, avatarRelicId: relic.id, frameId, card }, role, this.now() - i * 3_600_000);
        member.contributionTotal = 200 + (seed % 4_000); member.contributionWeek = seed % 700; member.coin = 0;
        members.set(userId, member);
      }
      this.guilds.set(id, { id, name, badge, joinMode, notice, prosperity, createdAt: this.now() - 30 * 86_400_000, badgeChanges: 0, members, requests: new Map(), warScore, warReachedAt: this.now(), guardScore: warScore === null ? null : Math.round(warScore * 24) });
      for (const userId of members.keys()) this.userGuild.set(userId, id);
    };
    // 길드전·수호전을 해 볼 수 있게 열 명 이상인 길드를 여럿 둔다. 점수는 열린 길드마다 조금씩 다르다.
    sample("포가든 수호대", { shape: "shield", shapeColor: "blue", icon: "sword", iconColor: "silver" }, "open", 12_000, 16, "함께 성장해요!", 1_340);
    sample("이끼 연구소", { shape: "hexagon", shapeColor: "green", icon: "leaf", iconColor: "ink" }, "approval", 3_000, 12, "느긋하게 복원합니다.", 1_180);
    sample("새벽 발굴단", { shape: "banner", shapeColor: "violet", icon: "moon", iconColor: "amber" }, "open", 700, 3, "", null);
    sample("붉은 사막 탐험대", { shape: "shield", shapeColor: "crimson", icon: "flame", iconColor: "amber" }, "open", 8_500, 14, "사막은 아침에 건넌다.", 1_260);
    sample("심해 기록 연맹", { shape: "hexagon", shapeColor: "blue", icon: "moon", iconColor: "silver" }, "approval", 5_200, 12, "기록은 곧 힘.", 1_090);
    sample("바람 언덕 학회", { shape: "banner", shapeColor: "green", icon: "leaf", iconColor: "amber" }, "open", 2_100, 10, "", 1_020);
  }

  private newMember(actor: GuildActor, role: GuildRole, at: number): MemberRow {
    return {
      userId: actor.userId, name: actor.name, level: actor.level, role, avatarRelicId: actor.avatarRelicId, frameId: actor.frameId,
      joinedAt: at, lastActiveAt: at, coin: 0, contributionWeekKey: guildWeekKey(at), contributionWeek: 0, contributionTotal: 0,
      attendanceCount: 0, attendanceLast: null, card: actor.card ? structuredClone(actor.card) : null, purchases: new Map(), purchaseWeekKey: guildWeekKey(at),
    };
  }

  // ── 조회 도우미 ──────────────────────────────────────────────────────────────
  private myGuild(actor: GuildActor): GuildRow | undefined { const id = this.userGuild.get(actor.userId); return id ? this.guilds.get(id) : undefined; }
  private requireGuild(actor: GuildActor): { guild: GuildRow; me: MemberRow } {
    const guild = this.myGuild(actor);
    const me = guild?.members.get(actor.userId);
    if (!guild || !me) return fail("NOT_IN_GUILD");
    this.touch(me, actor);
    return { guild, me };
  }
  /** 호출마다 이름·레벨·마지막 접속을 최신으로 맞추고 주가 넘어갔으면 주간 기여도를 비운다. */
  private touch(member: MemberRow, actor: GuildActor): void {
    const now = this.now();
    member.name = actor.name; member.level = actor.level; member.avatarRelicId = actor.avatarRelicId; member.frameId = actor.frameId; member.lastActiveAt = now;
    if (actor.card) member.card = structuredClone(actor.card);
    const week = guildWeekKey(now);
    if (member.contributionWeekKey !== week) { member.contributionWeekKey = week; member.contributionWeek = 0; }
    if (member.purchaseWeekKey !== week) { member.purchaseWeekKey = week; member.purchases = new Map(); }
  }
  private leaderOf(guild: GuildRow): MemberRow { return [...guild.members.values()].find((m) => m.role === "leader")!; }
  private level(guild: GuildRow): number { return guildLevelOf(guild.prosperity); }
  private summary(guild: GuildRow): GuildSummary {
    const level = this.level(guild);
    return { id: guild.id, name: guild.name, badge: { ...guild.badge }, level, memberCount: guild.members.size, capacity: guildCapacity(level), joinMode: guild.joinMode, leaderName: this.leaderOf(guild).name, notice: guild.notice,
      prosperity: guild.prosperity, contributionTotal: [...guild.members.values()].reduce((sum, m) => sum + m.contributionTotal, 0), warScore: guild.warScore ?? null, guardScore: guild.guardScore ?? null };
  }
  private detail(guild: GuildRow): GuildDetail { return { ...this.summary(guild), createdAt: guild.createdAt, warRank: this.warRankOf(guild), badgeFree: guild.badgeChanges === 0 }; }
  /** 길드전 등수 — 점수가 있는 길드끼리 줄 세운다. 점수가 없으면 null이다. */
  private warRankOf(guild: GuildRow): number | null {
    if (guild.warScore == null) return null;
    const standings = [...this.guilds.values()].filter((g) => g.warScore != null).map((g) => ({ guildId: g.id, score: g.warScore!, reachedAt: g.warReachedAt ?? 0 }));
    return rankGuildWar(standings).find((entry) => entry.guildId === guild.id)?.rank ?? null;
  }
  private assertUnlocked(actor: GuildActor): void {
    if (this.options.levelGate !== false && !isContentUnlocked("guild", actor.level)) fail("LEVEL_LOCKED");
  }
  private gain(guild: GuildRow, me: MemberRow, gain: { prosperity?: number; contribution?: number; coin?: number }): void {
    guild.prosperity += gain.prosperity ?? 0;
    me.contributionWeek += gain.contribution ?? 0; me.contributionTotal += gain.contribution ?? 0; me.coin += gain.coin ?? 0;
  }
  /** 같은 requestId의 재전송은 첫 응답을 그대로 돌려준다(서버 영수증 표). */
  private once<T>(actor: GuildActor, requestId: string, run: () => T): T {
    const key = `${actor.userId}:${requestId}`;
    if (this.receipts.has(key)) return structuredClone(this.receipts.get(key)) as T;
    const result = run();
    this.receipts.set(key, structuredClone(result));
    return result;
  }
  private pendingCount(guild: GuildRow | undefined, me: MemberRow | undefined): number { return guild && me && guildCan(me.role, "approve") ? guild.requests.size : 0; }

  // ── GuildBackend ─────────────────────────────────────────────────────────────
  async getGuild(actor: GuildActor): Promise<GuildStateResponse> {
    const guild = this.myGuild(actor);
    const me = guild?.members.get(actor.userId);
    if (guild && me) this.touch(me, actor);
    return {
      guild: guild ? this.detail(guild) : null,
      me: me ? { role: me.role, coin: me.coin, contributionWeek: me.contributionWeek, contributionTotal: me.contributionTotal, joinedAt: me.joinedAt } : null,
      leaveCooldownUntil: Math.max(0, (this.leftAt.get(actor.userId) ?? 0) + GUILD_LEAVE_COOLDOWN_MS),
      pendingRequests: this.pendingCount(guild, me),
      requestedGuildIds: [...(this.requestedBy.get(actor.userId) ?? [])],
      serverTime: this.now(),
    };
  }

  async searchGuilds(_actor: GuildActor, query: string): Promise<GuildSearchResponse> {
    const key = guildNameKey(query.slice(0, 40));
    const list = [...this.guilds.values()]
      .filter((guild) => !key || guildNameKey(guild.name).includes(key))
      .sort((a, b) => b.prosperity - a.prosperity)
      .slice(0, 20).map((guild) => this.summary(guild));
    return { guilds: list, serverTime: this.now() };
  }

  async getMembers(actor: GuildActor): Promise<GuildMembersResponse> {
    const { guild, me } = this.requireGuild(actor);
    const members = [...guild.members.values()].sort((a, b) => roleRank(b.role) - roleRank(a.role) || b.contributionTotal - a.contributionTotal || a.joinedAt - b.joinedAt)
      .map((m): GuildMemberView => ({ userId: m.userId, name: m.name, level: m.level, role: m.role, avatarRelicId: m.avatarRelicId, frameId: m.frameId, contributionWeek: m.contributionWeekKey === guildWeekKey(this.now()) ? m.contributionWeek : 0, contributionTotal: m.contributionTotal, lastActiveAt: m.lastActiveAt, isMe: m.userId === actor.userId, card: m.card ? structuredClone(m.card) : null }));
    const requests: GuildJoinRequestView[] = guildCan(me.role, "approve")
      ? [...guild.requests.values()].sort((a, b) => a.requestedAt - b.requestedAt).map(({ actor: a, requestedAt }) => ({ userId: a.userId, name: a.name, level: a.level, avatarRelicId: a.avatarRelicId, frameId: a.frameId, requestedAt }))
      : [];
    return { members, requests, serverTime: this.now() };
  }

  async createGuild(actor: GuildActor, input: { name: string; joinMode: GuildJoinMode; badge: GuildBadge }, requestId: string): Promise<GuildStateResponse> {
    this.once(actor, requestId, () => {
      this.assertUnlocked(actor);
      if (this.myGuild(actor)) fail("ALREADY_IN_GUILD");
      if (this.now() < (this.leftAt.get(actor.userId) ?? 0) + GUILD_LEAVE_COOLDOWN_MS) fail("LEAVE_COOLDOWN");
      const checked = validateGuildName(input.name);
      if (!checked.ok) return fail("NAME_INVALID");
      if ([...this.guilds.values()].some((g) => guildNameKey(g.name) === guildNameKey(checked.name))) fail("NAME_TAKEN");
      if (!isGuildBadge(input.badge)) fail("BADGE_INVALID");
      if (input.joinMode !== "open" && input.joinMode !== "approval") fail("INVALID_REQUEST");
      const id = `guild-${++this.sequence}-${Math.abs(Math.floor(this.now())).toString(36)}`;
      const guild: GuildRow = { id, name: checked.name, badge: { ...input.badge }, joinMode: input.joinMode, notice: "", prosperity: 0, createdAt: this.now(), badgeChanges: 0, members: new Map(), requests: new Map() };
      guild.members.set(actor.userId, this.newMember(actor, "leader", this.now()));
      this.guilds.set(id, guild); this.userGuild.set(actor.userId, id);
      this.requestedBy.delete(actor.userId);
      return true;
    });
    return this.getGuild(actor);
  }

  async joinGuild(actor: GuildActor, guildId: string): Promise<{ status: "joined" | "requested" }> {
    this.assertUnlocked(actor);
    if (this.myGuild(actor)) fail("ALREADY_IN_GUILD");
    if (this.now() < (this.leftAt.get(actor.userId) ?? 0) + GUILD_LEAVE_COOLDOWN_MS) fail("LEAVE_COOLDOWN");
    const guild = this.guilds.get(guildId);
    if (!guild) return fail("GUILD_NOT_FOUND");
    if (guild.members.size >= guildCapacity(this.level(guild))) fail("GUILD_FULL");
    if (guild.joinMode === "open") { this.admit(guild, actor); return { status: "joined" }; }
    if (guild.requests.has(actor.userId)) fail("REQUEST_EXISTS");
    guild.requests.set(actor.userId, { actor, requestedAt: this.now() });
    (this.requestedBy.get(actor.userId) ?? this.requestedBy.set(actor.userId, new Set()).get(actor.userId)!).add(guildId);
    return { status: "requested" };
  }
  private admit(guild: GuildRow, actor: GuildActor): void {
    guild.members.set(actor.userId, this.newMember(actor, "member", this.now()));
    this.userGuild.set(actor.userId, guild.id);
    this.dropRequests(actor.userId);
  }
  private dropRequests(userId: string): void {
    for (const id of this.requestedBy.get(userId) ?? []) this.guilds.get(id)?.requests.delete(userId);
    this.requestedBy.delete(userId);
  }

  async cancelJoinRequest(actor: GuildActor, guildId: string): Promise<void> {
    const guild = this.guilds.get(guildId);
    if (!guild?.requests.delete(actor.userId)) fail("REQUEST_NOT_FOUND");
    this.requestedBy.get(actor.userId)?.delete(guildId);
  }

  async leaveGuild(actor: GuildActor): Promise<void> {
    const { guild, me } = this.requireGuild(actor);
    if (me.role === "leader") {
      if (guild.members.size > 1) fail("LEADER_CANNOT_LEAVE");
      this.guilds.delete(guild.id);
    } else guild.members.delete(actor.userId);
    this.userGuild.delete(actor.userId);
    this.leftAt.set(actor.userId, this.now());
  }

  async decideJoinRequest(actor: GuildActor, userId: string, approve: boolean): Promise<void> {
    const { guild, me } = this.requireGuild(actor);
    if (!guildCan(me.role, "approve")) fail("NO_PERMISSION");
    const request = guild.requests.get(userId);
    if (!request) return fail("REQUEST_NOT_FOUND");
    guild.requests.delete(userId); this.requestedBy.get(userId)?.delete(guild.id);
    if (!approve) return;
    if (this.userGuild.has(userId)) return;
    if (guild.members.size >= guildCapacity(this.level(guild))) fail("GUILD_FULL");
    this.admit(guild, request.actor);
  }

  async kickMember(actor: GuildActor, userId: string): Promise<void> {
    const { guild, me } = this.requireGuild(actor);
    const target = guild.members.get(userId);
    if (!target) return fail("MEMBER_NOT_FOUND");
    if (!guildCanKick(me.role, target.role)) fail("NO_PERMISSION");
    guild.members.delete(userId); this.userGuild.delete(userId); this.leftAt.set(userId, this.now());
  }

  async setMemberRole(actor: GuildActor, userId: string, role: Exclude<GuildRole, "leader">): Promise<void> {
    const { guild, me } = this.requireGuild(actor);
    if (!guildCan(me.role, "promote")) fail("NO_PERMISSION");
    const target = guild.members.get(userId);
    if (!target) return fail("MEMBER_NOT_FOUND");
    if (target.role === "leader" || !(role in GUILD_ROLE_LIMIT) || role === ("leader" as string)) fail("INVALID_TARGET");
    if (target.role !== role && [...guild.members.values()].filter((m) => m.role === role).length >= GUILD_ROLE_LIMIT[role]) fail("ROLE_FULL");
    target.role = role;
  }

  async transferLeader(actor: GuildActor, userId: string): Promise<void> {
    const { guild, me } = this.requireGuild(actor);
    if (me.role !== "leader") fail("NO_PERMISSION");
    const target = guild.members.get(userId);
    if (!target || target === me) return fail("INVALID_TARGET");
    target.role = "leader"; me.role = "vice";
  }

  async updateGuild(actor: GuildActor, update: { notice?: string; joinMode?: GuildJoinMode }): Promise<void> {
    const { guild, me } = this.requireGuild(actor);
    if (update.notice !== undefined) {
      if (!guildCan(me.role, "notice")) fail("NO_PERMISSION");
      const notice = update.notice.replace(/\s+/g, " ").trim();
      if (guildGlyphCount(notice) > GUILD_NOTICE_MAX) fail("INVALID_REQUEST");
      guild.notice = notice;
    }
    if (update.joinMode !== undefined) {
      if (!guildCan(me.role, "joinMode")) fail("NO_PERMISSION");
      if (update.joinMode !== "open" && update.joinMode !== "approval") fail("INVALID_REQUEST");
      guild.joinMode = update.joinMode;
      if (guild.joinMode === "open") guild.requests.clear();
    }
  }

  async disbandGuild(actor: GuildActor): Promise<void> {
    const { guild, me } = this.requireGuild(actor);
    if (!guildCan(me.role, "disband")) fail("NO_PERMISSION");
    if (guild.members.size > 1) fail("LEADER_CANNOT_LEAVE");
    this.guilds.delete(guild.id); this.userGuild.delete(actor.userId); this.leftAt.set(actor.userId, this.now());
  }

  async changeBadge(actor: GuildActor, badge: GuildBadge, requestId: string): Promise<{ changed: boolean; charged: boolean }> {
    return this.once(actor, requestId, () => {
      const { guild, me } = this.requireGuild(actor);
      if (!guildCan(me.role, "badge")) fail("NO_PERMISSION");
      if (!isGuildBadge(badge)) fail("BADGE_INVALID");
      if (sameGuildBadge(guild.badge, badge)) return { changed: false, charged: false };
      const charged = guild.badgeChanges > 0;
      guild.badge = { ...badge }; guild.badgeChanges += 1;
      return { changed: true, charged };
    });
  }

  private attendanceOf(me: MemberRow): GuildAttendanceState {
    const now = this.now();
    return { ...guildAttendanceView(me.attendanceCount, me.attendanceLast, guildDateKey(now)), serverTime: now };
  }
  async getAttendance(actor: GuildActor): Promise<GuildAttendanceState> { return this.attendanceOf(this.requireGuild(actor).me); }

  async stampAttendance(actor: GuildActor, requestId: string): Promise<{ attendance: GuildAttendanceState; day: number }> {
    return this.once(actor, requestId, () => {
      const { guild, me } = this.requireGuild(actor);
      const view = this.attendanceOf(me);
      if (view.stampedToday) fail("ALREADY_STAMPED");
      me.attendanceCount = view.day; me.attendanceLast = guildDateKey(this.now());
      const day = guildAttendanceDay(view.day);
      this.gain(guild, me, { prosperity: day.prosperity, contribution: day.contribution, coin: day.coin });
      return { attendance: this.attendanceOf(me), day: view.day };
    });
  }

  private shopOf(me: MemberRow): GuildShopState {
    return { coin: me.coin, items: GUILD_SHOP_PRODUCTS.map((p) => ({ productId: p.id, price: p.price, weeklyLimit: p.weeklyLimit, bought: me.purchases.get(p.id) ?? 0 })), serverTime: this.now() };
  }
  async getShop(actor: GuildActor): Promise<GuildShopState> { return this.shopOf(this.requireGuild(actor).me); }

  async purchase(actor: GuildActor, productId: string, requestId: string): Promise<{ shop: GuildShopState }> {
    return this.once(actor, requestId, () => {
      const product = findGuildProduct(productId);
      if (!product) return fail("PRODUCT_NOT_FOUND");
      const { me } = this.requireGuild(actor);
      const bought = me.purchases.get(product.id) ?? 0;
      if (bought >= product.weeklyLimit) fail("PRODUCT_LIMIT");
      if (me.coin < product.price) fail("INSUFFICIENT_COINS");
      me.coin -= product.price; me.purchases.set(product.id, bought + 1);
      return { shop: this.shopOf(me) };
    });
  }

  // ── QA 전용 — 길드전·수호전 시험판(`guildQa`)이 쓰는 조회·조작. 운영 서버의 계약에는 없다. ─────────────
  /** 모든 길드의 id·이름·점수. */
  qaGuilds(): { id: string; name: string; badge: GuildBadge; level: number; memberCount: number; warScore: number | null; guardScore: number | null; warReachedAt: number }[] {
    return [...this.guilds.values()].map((g) => ({ id: g.id, name: g.name, badge: { ...g.badge }, level: this.level(g), memberCount: g.members.size, warScore: g.warScore ?? null, guardScore: g.guardScore ?? null, warReachedAt: g.warReachedAt ?? 0 }));
  }
  /** 한 길드의 길드원 공개 값. */
  qaMembers(guildId: string): { userId: string; name: string; level: number; role: GuildRole; avatarRelicId: string; frameId: string }[] {
    return [...(this.guilds.get(guildId)?.members.values() ?? [])].map(({ userId, name, level, role, avatarRelicId, frameId }) => ({ userId, name, level, role, avatarRelicId, frameId }));
  }
  qaGuildOf(userId: string): string | undefined { return this.userGuild.get(userId); }
  qaSetScores(guildId: string, scores: { warScore?: number | null; guardScore?: number | null }): void {
    const guild = this.guilds.get(guildId);
    if (!guild) return;
    if (scores.warScore !== undefined) { if (scores.warScore !== guild.warScore) guild.warReachedAt = this.now(); guild.warScore = scores.warScore; }
    if (scores.guardScore !== undefined) guild.guardScore = scores.guardScore;
  }
  /** 길드원이 모자라면 표본 길드원으로 채운다(정원은 넘기지 않는다). 채운 수를 돌려준다. */
  qaFillMembers(guildId: string, target: number): number {
    const guild = this.guilds.get(guildId);
    if (!guild) return 0;
    let added = 0;
    const capacity = guildCapacity(this.level(guild));
    while (guild.members.size < Math.min(target, capacity)) {
      const index = guild.members.size + added;
      const userId = `${guild.id}-qa${index}`;
      if (guild.members.has(userId)) { added += 1; continue; }
      const relic = PLAYABLE_RELICS[(index * 7 + 3) % PLAYABLE_RELICS.length];
      const level = Math.max(8, 44 - index * 2);
      const member = this.newMember({ userId, name: `${SAMPLE_NAMES[index % SAMPLE_NAMES.length]}${index + 1}`, level, avatarRelicId: relic.id, frameId: "holo" }, "member", this.now());
      member.contributionTotal = 150 + index * 37;
      guild.members.set(userId, member); this.userGuild.set(userId, guild.id);
      added += 1;
    }
    return added;
  }
  /** 호출자가 길드에 없으면 새로 만들고(길드장), 있으면 그 길드를 돌려준다. 젬·레벨 조건은 보지 않는다. */
  qaEnsureGuild(actor: GuildActor, badge: GuildBadge, name = "QA 연합"): string {
    const current = this.userGuild.get(actor.userId);
    if (current && this.guilds.has(current)) return current;
    let unique = name; let n = 1;
    while ([...this.guilds.values()].some((g) => guildNameKey(g.name) === guildNameKey(unique))) unique = `${name} ${++n}`;
    const id = `guild-${++this.sequence}-${Math.abs(Math.floor(this.now())).toString(36)}`;
    const guild: GuildRow = { id, name: unique, badge: { ...badge }, joinMode: "open", notice: "", prosperity: 3_000, createdAt: this.now(), badgeChanges: 0, members: new Map(), requests: new Map() };
    guild.members.set(actor.userId, this.newMember(actor, "leader", this.now()));
    this.guilds.set(id, guild); this.userGuild.set(actor.userId, id); this.requestedBy.delete(actor.userId);
    return id;
  }

  /** 테스트·QA 도구용 — 한 길드에 부흥도를 얹는다. */
  addProsperityForTest(guildId: string, amount: number): void { const guild = this.guilds.get(guildId); if (guild) guild.prosperity += amount; }
}

const SAMPLE_NAMES = ["하늘", "새봄", "이슬", "마루", "다온", "보람", "나래", "가람", "솔", "누리", "한결", "도담", "모아", "미르", "아라", "초롱", "온새미", "라온", "해든", "소담"];
const SAMPLE_BIOS = ["오늘도 복원 중", "치즈케이크는 사랑입니다", "길드전 같이 해요", "느긋하게 가는 중", "수호전 개근 목표", "고고학 전문가", "잘 부탁드립니다"];

const roleRank = (role: GuildRole): number => ({ leader: 3, vice: 2, officer: 1, member: 0 })[role];

/** 이 기기의 임시 길드 백엔드. 서버가 연결되지 않은 빌드(QA·개발)에서 `FakeServer`와 `guildApi`가 함께 쓴다. */
export const localGuildBackend: FakeGuildServer = new FakeGuildServer();
