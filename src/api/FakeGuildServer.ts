import { QA_TOOLS_ENABLED } from "../core/buildFlavor";
import { isContentUnlocked } from "../core/contentUnlock";
import {
  GUILD_LEADER_TRANSFER_DAYS, GUILD_LEAVE_COOLDOWN_MS, GUILD_NOTICE_MAX, GUILD_ROLE_LIMIT, GUILD_SHOP_PRODUCTS, findGuildProduct, guildAttendanceDay, guildAttendanceView,
  guildCan, guildCanKick, guildCapacity, guildDateKey, guildGlyphCount, guildLevelOf, guildMonthKey, guildNameKey, guildSuccessor, guildWeekKey, validateGuildName,
  type GuildJoinMode, type GuildRole, type GuildShopProduct,
} from "../core/guild";
import { isGuildBadge, sameGuildBadge, type GuildBadge } from "../core/guildBadge";
import { combatPower } from "../core/combatPower";
import { rankGuildWar } from "../core/guildWar";
import { guildWarNow } from "../core/guildPages";
import { guildWarMapSlots, parseGuildWarSlotId } from "../core/guildWarMap";
import { guildQaClockShift } from "./guildQaClock";
import { guildGuardDayKey, guildGuardTotal, rankGuildGuardMembers } from "../core/guildGuard";
import { PLAYABLE_RELICS } from "../data/relics";
import { GUILD_GUARD_DAILY_RANK_COINS, GUILD_WEEKLY_RANK_REWARDS, rankRewardGems } from "../data/competitiveRewards";
import { rankGuildScores } from "../core/guildRankRewards";
import {
  GuildApiError, type GuildActor, type GuildAttendanceState, type GuildBackend, type GuildDetail, type GuildErrorCode, type GuildJoinRequestView,
  type GuildGuardBoard, type GuildGuardGuildEntry, type GuildRankingEntry, type GuildRankingResponse, type GuildWeeklyRankAward, type GuildWarDeckEntry, type GuildWarDefenseInput, type GuildWarMapState, type GuildMemberCard, type GuildMemberView, type GuildMembersResponse, type GuildSearchResponse, type GuildShopState, type GuildStateResponse, type GuildSummary,
} from "./guildContracts";

interface MemberRow {
  userId: string; name: string; level: number; role: GuildRole; avatarRelicId: string; frameId: string;
  joinedAt: number; lastActiveAt: number; coin: number;
  contributionWeekKey: string; contributionWeek: number; contributionTotal: number;
  /** 이번 바퀴에 찍은 수(0~7)와 마지막으로 찍은 날짜 키. */
  attendanceCount: number; attendanceLast: string | null;
  card: GuildMemberCard | null;
  purchases: Map<string, number>; purchaseWeekKey: string;
  /** 월간 상품의 산 수와 그 달 키(`guildMonthKey`). */
  monthPurchases: Map<string, number>; purchaseMonthKey: string;
  /** 수호전 — 기록한 날(UTC 날짜 번호)과 그날 최고 점수·처음 그 점수를 낸 시각. */
  guardDay: number; guardBest: number; guardAt: number;
  /** 가장 최근에 받은 수호전 일일 길드 순위 보상(`settleGuardRewards`). */
  guardReward: { day: number; rank: number; coin: number } | null;
  /** QA 표본 길드원 — 수호전 기록을 날마다 정해진 값으로 채운다(`sampleGuard`). */
  sample?: boolean;
}
interface GuildRow {
  id: string; name: string; badge: GuildBadge; joinMode: GuildJoinMode; notice: string; prosperity: number; createdAt: number; badgeChanges: number;
  /** QA 길드전·수호전 점수(`guildQa`가 정한다). 열리기 전에는 null이라 순위 줄이 「-」로 선다. */
  warScore?: number | null; warReachedAt?: number; guardScore?: number | null;
  members: Map<string, MemberRow>; requests: Map<string, { actor: GuildActor; requestedAt: number }>;
  /** 방어진 지도 — 칸 id → 그 칸을 맡은 길드원의 방어덱. 한 길드원은 한 칸만 맡는다. */
  war?: Map<string, WarDefenseRow>;
}
interface WarDefenseRow { userId: string; deck: GuildWarDeckEntry[]; lineup: GuildWarDefenseInput["lineup"] | null; placedAt: number }

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
  /**
   * 순위 보상의 장부 — 길드원 행은 주·날이 바뀌면 값을 비우므로(게으른 초기화) 마감 뒤에는 지난 값을 읽을 수 없다.
   * 기여도·수호전 기록이 오를 때마다 (기간 → 길드 → 길드원) 값을 적어 두고, 마감 정산은 이 장부만 읽는다.
   */
  private readonly weekLedger = new Map<string, Map<string, Map<string, number>>>();
  private readonly guardLedger = new Map<number, Map<string, Map<string, number>>>();
  /** 받은 순위 보상 — `week:주:id`·`guard:날:id`. 한 사람은 한 기간에 한 번만 받는다. */
  private readonly rankAwarded = new Set<string>();
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
        member.contributionTotal = 200 + (seed % 4_000); member.contributionWeek = seed % 700; member.coin = 0; member.sample = true;
        members.set(userId, member);
        this.noteContribution(id, member);
      }
      this.guilds.set(id, { id, name, badge, joinMode, notice, prosperity, createdAt: this.now() - 30 * 86_400_000, badgeChanges: 0, members, requests: new Map(), warScore, warReachedAt: this.now() });
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
      attendanceCount: 0, attendanceLast: null, card: actor.card ? structuredClone(actor.card) : null, purchases: new Map(), purchaseWeekKey: guildWeekKey(at), monthPurchases: new Map(), purchaseMonthKey: guildMonthKey(at),
      guardDay: -1, guardBest: 0, guardAt: 0, guardReward: null,
    };
  }

  // ── 조회 도우미 ──────────────────────────────────────────────────────────────
  private myGuild(actor: GuildActor): GuildRow | undefined { const id = this.userGuild.get(actor.userId); return id ? this.guilds.get(id) : undefined; }
  private requireGuild(actor: GuildActor): { guild: GuildRow; me: MemberRow } {
    const guild = this.myGuild(actor);
    const me = guild?.members.get(actor.userId);
    if (!guild || !me) return fail("NOT_IN_GUILD");
    this.touch(me, actor);
    this.reviewLeader(guild);
    this.settleGuardRewards(actor.userId, me);
    return { guild, me };
  }
  /** 길드장이 14일 접속하지 않았으면 기여도 1위 임원 이상에게 넘긴다(`guildSuccessor`). 길드원이 길드를 부를 때마다 본다. */
  private reviewLeader(guild: GuildRow): void {
    const leader = this.leaderOf(guild);
    if (this.now() - leader.lastActiveAt < GUILD_LEADER_TRANSFER_DAYS * 86_400_000) return;
    const heir = guildSuccessor([...guild.members.values()]);
    if (!heir) return;
    leader.role = "member";
    guild.members.get(heir)!.role = "leader";
  }
  /** 호출마다 이름·레벨·마지막 접속을 최신으로 맞추고 주가 넘어갔으면 주간 기여도를 비운다. */
  private touch(member: MemberRow, actor: GuildActor): void {
    const now = this.now();
    member.name = actor.name; member.level = actor.level; member.avatarRelicId = actor.avatarRelicId; member.frameId = actor.frameId; member.lastActiveAt = now;
    if (actor.card) member.card = structuredClone(actor.card);
    const week = guildWeekKey(now);
    if (member.contributionWeekKey !== week) { member.contributionWeekKey = week; member.contributionWeek = 0; }
    if (member.purchaseWeekKey !== week) { member.purchaseWeekKey = week; member.purchases = new Map(); }
    const month = guildMonthKey(now);
    if (member.purchaseMonthKey !== month) { member.purchaseMonthKey = month; member.monthPurchases = new Map(); }
  }
  private leaderOf(guild: GuildRow): MemberRow { return [...guild.members.values()].find((m) => m.role === "leader")!; }
  private level(guild: GuildRow): number { return guildLevelOf(guild.prosperity); }
  private summary(guild: GuildRow): GuildSummary {
    const level = this.level(guild);
    return { id: guild.id, name: guild.name, badge: { ...guild.badge }, level, memberCount: guild.members.size, capacity: guildCapacity(level), joinMode: guild.joinMode, leaderName: this.leaderOf(guild).name, notice: guild.notice,
      prosperity: guild.prosperity, contributionTotal: [...guild.members.values()].reduce((sum, m) => sum + m.contributionTotal, 0), warScore: guild.warScore ?? null, guardScore: this.guardScoreOf(guild) };
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
    this.noteContribution(guild.id, me);
  }
  private static ledgerSlot<K>(ledger: Map<K, Map<string, Map<string, number>>>, period: K, guildId: string): Map<string, number> {
    let byGuild = ledger.get(period);
    if (!byGuild) ledger.set(period, byGuild = new Map());
    let byMember = byGuild.get(guildId);
    if (!byMember) byGuild.set(guildId, byMember = new Map());
    return byMember;
  }
  /** 이번 주 기여도를 장부에 적는다 — 그 주 안에서는 오르기만 하므로 덮어써도 된다. */
  private noteContribution(guildId: string, me: MemberRow): void {
    if (me.contributionWeek > 0) FakeGuildServer.ledgerSlot(this.weekLedger, me.contributionWeekKey, guildId).set(me.userId, me.contributionWeek);
  }
  private static sum(byMember: Map<string, number> | undefined): number { let total = 0; for (const value of byMember?.values() ?? []) total += value; return total; }
  /** 그 주의 길드 순위 — 장부에 점수가 있는 길드만 선다(`rankGuildScores`). */
  private weekStandings(week: string): { guildId: string; score: number; rank: number }[] {
    return rankGuildScores([...(this.weekLedger.get(week) ?? new Map<string, Map<string, number>>()).entries()].map(([guildId, byMember]) => ({ guildId, score: FakeGuildServer.sum(byMember) })));
  }
  /**
   * 그날의 수호전 길드 순위. 기록은 장부에서, 표본 길드원은 날짜에서 나오는 값으로, QA가 정해 둔 길드 점수(`guardScore`)를 더해
   * 판(`getGuard`)이 그날 보여 준 합과 같게 센다.
   */
  private guardStandings(day: number): { guildId: string; score: number; rank: number }[] {
    const recorded = this.guardLedger.get(day);
    const ids = new Set<string>([...this.guilds.keys(), ...(recorded?.keys() ?? [])]);
    return rankGuildScores([...ids].map((guildId) => {
      const guild = this.guilds.get(guildId);
      let score = FakeGuildServer.sum(recorded?.get(guildId));
      for (const member of guild?.members.values() ?? []) if (member.sample) score += sampleGuardRecord(member.userId, member.level, day).best;
      return { guildId, score: score + (guild?.guardScore ?? 0) };
    }));
  }
  /**
   * 마감된 날의 수호전 순위 보상을 길드원 행의 코인으로 넣는다. 그날 한 판이라도 기록한 날만 받고(장부에 이름이 있다),
   * 받는 순간 어느 길드에도 없으면 넣을 행이 없어 그 몫은 사라진다. 길드원이 길드를 부를 때마다 본다.
   */
  private settleGuardRewards(userId: string, me: MemberRow): void {
    const today = guildGuardDayKey(this.now());
    for (const [day, byGuild] of this.guardLedger) {
      if (day >= today || this.rankAwarded.has(`guard:${day}:${userId}`)) continue;
      const played = [...byGuild.entries()].filter(([, byMember]) => byMember.has(userId)).sort((a, b) => (b[1].get(userId) ?? 0) - (a[1].get(userId) ?? 0))[0];
      if (!played) continue;
      this.rankAwarded.add(`guard:${day}:${userId}`);
      const standings = this.guardStandings(day);
      const rank = standings.find((entry) => entry.guildId === played[0])?.rank ?? standings.length + 1;
      const coin = rankRewardGems(GUILD_GUARD_DAILY_RANK_COINS, rank, Math.max(1, standings.length));
      me.coin += coin;
      if (!me.guardReward || me.guardReward.day < day) me.guardReward = { day, rank, coin };
    }
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
    if (guild && me) { this.touch(me, actor); this.reviewLeader(guild); this.settleGuardRewards(actor.userId, me); }
    return {
      guild: guild ? this.detail(guild) : null,
      me: me ? { role: me.role, coin: me.coin, contributionWeek: me.contributionWeek, contributionTotal: me.contributionTotal, joinedAt: me.joinedAt, guardReward: me.guardReward ? { ...me.guardReward } : null } : null,
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
    } else { guild.members.delete(actor.userId); this.dropWarDefense(guild, actor.userId); }
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
    this.dropWarDefense(guild, userId);
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

  private bucketOf(me: MemberRow, product: GuildShopProduct): Map<string, number> { return product.refresh === "monthly" ? me.monthPurchases : me.purchases; }
  private shopOf(guild: GuildRow, me: MemberRow): GuildShopState {
    return {
      coin: me.coin, guildLevel: this.level(guild), serverTime: this.now(),
      items: GUILD_SHOP_PRODUCTS.map((p) => ({ productId: p.id, price: p.price, limit: p.limit, refresh: p.refresh, ...(p.minGuildLevel ? { minGuildLevel: p.minGuildLevel } : {}), bought: this.bucketOf(me, p).get(p.id) ?? 0 })),
    };
  }
  async getShop(actor: GuildActor): Promise<GuildShopState> { const { guild, me } = this.requireGuild(actor); return this.shopOf(guild, me); }

  async purchase(actor: GuildActor, productId: string, requestId: string): Promise<{ shop: GuildShopState }> {
    return this.once(actor, requestId, () => {
      const product = findGuildProduct(productId);
      if (!product) return fail("PRODUCT_NOT_FOUND");
      const { guild, me } = this.requireGuild(actor);
      if (product.minGuildLevel && this.level(guild) < product.minGuildLevel) fail("GUILD_LEVEL_LOW");
      const bucket = this.bucketOf(me, product);
      const bought = bucket.get(product.id) ?? 0;
      if (bought >= product.limit) fail("PRODUCT_LIMIT");
      if (me.coin < product.price) fail("INSUFFICIENT_COINS");
      me.coin -= product.price; bucket.set(product.id, bought + 1);
      return { shop: this.shopOf(guild, me) };
    });
  }

  // ── 수호전 ─────────────────────────────────────────────────────────────────
  /** 표본 길드원의 오늘 기록 — 날짜와 id에서만 나오는 값이라 다시 읽어도 같다. */
  private sampleGuard(member: MemberRow, day: number): void {
    if (!member.sample || member.guardDay === day) return;
    const record = sampleGuardRecord(member.userId, member.level, day);
    member.guardDay = day; member.guardBest = record.best; member.guardAt = record.at;
  }
  /** 오늘의 기록만 센다 — 지난날의 최고는 0이다. */
  private guardBestOf(member: MemberRow, day: number): number {
    this.sampleGuard(member, day);
    return member.guardDay === day ? member.guardBest : 0;
  }
  /** 길드 수호전 점수 = 길드원 오늘 최고의 합. QA가 정해 둔 값(`qaSetScores`)이 있으면 그 값을 더한다. */
  private guardScoreOf(guild: GuildRow): number | null {
    const day = guildGuardDayKey(this.now());
    const total = guildGuardTotal([...guild.members.values()].map((m) => ({ score: this.guardBestOf(m, day) })));
    return guild.guardScore == null ? total : guild.guardScore + total;
  }

  async getGuard(actor: GuildActor): Promise<GuildGuardBoard> {
    const { guild } = this.requireGuild(actor);
    const now = this.now();
    const day = guildGuardDayKey(now);
    const members = rankGuildGuardMembers([...guild.members.values()].map((m) => ({
      accountId: m.userId, userId: m.userId, name: m.name, level: m.level, avatarRelicId: m.avatarRelicId, frameId: m.frameId,
      score: this.guardBestOf(m, day), at: m.guardDay === day ? m.guardAt : Number.MAX_SAFE_INTEGER, isMe: m.userId === actor.userId,
    }))).map(({ rank, userId, name, level, avatarRelicId, frameId, score, isMe }) => ({ rank, userId, name, level, avatarRelicId, frameId, score, isMe }));
    const ranked: GuildGuardGuildEntry[] = [...this.guilds.values()]
      .map((g) => ({ id: g.id, name: g.name, badge: { ...g.badge }, level: this.level(g), score: this.guardScoreOf(g) ?? 0, isMine: g.id === guild.id }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
    return { day, members, guilds: ranked.slice(0, 50), mine: ranked.find((entry) => entry.isMine) ?? null, serverTime: now };
  }

  async recordGuard(actor: GuildActor, record: { day: number; score: number; coin: number }, requestId: string): Promise<{ best: number; coin: number }> {
    return this.once(actor, requestId, () => {
      const { guild, me } = this.requireGuild(actor);
      const score = Math.max(0, Math.round(record.score));
      if (me.guardDay !== record.day) { me.guardDay = record.day; me.guardBest = 0; me.guardAt = 0; }
      if (score > me.guardBest || me.guardAt === 0) { me.guardBest = Math.max(me.guardBest, score); me.guardAt = this.now(); }
      me.coin += Math.max(0, Math.round(record.coin));
      FakeGuildServer.ledgerSlot(this.guardLedger, me.guardDay, guild.id).set(me.userId, me.guardBest);
      return { best: me.guardBest, coin: me.coin };
    });
  }

  // ── 길드 주간 순위 ─────────────────────────────────────────────────────────
  private rankingEntry(guild: GuildRow, standing: { score: number; rank: number } | undefined, mine: string | undefined): GuildRankingEntry {
    return { ...this.summary(guild), rank: standing?.rank ?? null, weekScore: standing?.score ?? 0, isMine: guild.id === mine };
  }
  async getRanking(actor: GuildActor): Promise<GuildRankingResponse> {
    const mine = this.myGuild(actor);
    const week = guildWeekKey(this.now());
    const standings = this.weekStandings(week);
    const guilds = standings.filter(({ guildId }) => this.guilds.has(guildId)).slice(0, 50).map((standing) => this.rankingEntry(this.guilds.get(standing.guildId)!, standing, mine?.id));
    const mineEntry = mine ? this.rankingEntry(mine, standings.find(({ guildId }) => guildId === mine.id), mine.id) : null;
    return { week, guilds, mine: mineEntry, total: standings.length, serverTime: this.now() };
  }
  /**
   * 마감된 주의 길드 주간 순위 보상 — 그 주에 기여도가 1 이상인 길드원이 한 번씩 받는다. 여러 길드에서 기여했으면 가장 크게
   * 기여한 길드의 몫이다. 받은 것으로 적고 돌려주며, 우편은 부르는 쪽(`FakeServer`)이 세운다.
   */
  async claimWeeklyRankRewards(actor: GuildActor): Promise<GuildWeeklyRankAward[]> {
    const current = guildWeekKey(this.now());
    const awards: GuildWeeklyRankAward[] = [];
    for (const [week, byGuild] of [...this.weekLedger.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (week >= current || this.rankAwarded.has(`week:${week}:${actor.userId}`)) continue;
      const own = [...byGuild.entries()].filter(([, byMember]) => (byMember.get(actor.userId) ?? 0) > 0).sort((a, b) => (b[1].get(actor.userId) ?? 0) - (a[1].get(actor.userId) ?? 0))[0];
      if (!own) continue;
      this.rankAwarded.add(`week:${week}:${actor.userId}`);
      const standings = this.weekStandings(week);
      const rank = standings.find(({ guildId }) => guildId === own[0])!.rank;
      awards.push({ week, guildName: this.guilds.get(own[0])?.name ?? "", rank, total: standings.length, gems: rankRewardGems(GUILD_WEEKLY_RANK_REWARDS, rank, standings.length) });
    }
    return awards;
  }

  // ── 길드전 방어진 지도 ──────────────────────────────────────────────────────
  private warOf(guild: GuildRow): Map<string, WarDefenseRow> { return guild.war ?? (guild.war = new Map()); }
  private dropWarDefense(guild: GuildRow, userId: string): void {
    for (const [slotId, row] of this.warOf(guild)) if (row.userId === userId) this.warOf(guild).delete(slotId);
  }
  /**
   * QA 표본 길드원은 아직 칸을 맡지 않았으면 레벨 높은 순으로 앞 칸(우두머리 → 정예 → 일반)을 채운다. 덱은 id에서만
   * 나오는 값이라 다시 읽어도 같다. 플레이어가 고를 칸이 남도록 표본은 열린 칸의 3분의 2까지만 채운다.
   */
  private seedSampleWar(guild: GuildRow): void {
    const war = this.warOf(guild);
    const holders = new Set([...war.values()].map(({ userId }) => userId));
    const slots = guildWarMapSlots(this.level(guild));
    const order = [...slots].sort((a, b) => ({ boss: 0, elite: 1, grunt: 2 })[a.kind] - ({ boss: 0, elite: 1, grunt: 2 })[b.kind] || a.branch - b.branch || a.index - b.index);
    const cap = Math.floor(slots.length * 2 / 3);
    const samples = [...guild.members.values()].filter((m) => m.sample && !holders.has(m.userId)).sort((a, b) => b.level - a.level || a.userId.localeCompare(b.userId));
    for (const member of samples) {
      if (war.size >= cap) break;
      const slot = order.find(({ id }) => !war.has(id));
      if (!slot) break;
      let h = 2166136261;
      for (const ch of member.userId) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
      h >>>= 0;
      const deck: GuildWarDeckEntry[] = [0, 1, 2].map((offset) => {
        const relic = PLAYABLE_RELICS[(h + offset * 7) % PLAYABLE_RELICS.length];
        const level = Math.max(1, member.level - offset * 2);
        return { relicId: relic.id, level, breakthrough: Math.min(5, Math.max(0, Math.ceil((level - 20) / 10))), power: Math.round(combatPower(relic.stats) * (0.6 + level / 40)) };
      });
      if (new Set(deck.map(({ relicId }) => relicId)).size < deck.length) continue;
      war.set(slot.id, { userId: member.userId, deck, lineup: null, placedAt: guild.createdAt });
    }
  }
  private warMapOf(guild: GuildRow, me: MemberRow): GuildWarMapState {
    if (guild.members.size > 0 && [...guild.members.values()].some((m) => m.sample)) this.seedSampleWar(guild);
    const now = this.now();
    const war = this.warOf(guild);
    const level = this.level(guild);
    const { phase, endsAt } = guildWarNow(now);
    const slots = guildWarMapSlots(level).map((slot) => {
      const row = war.get(slot.id);
      const member = row ? guild.members.get(row.userId) : undefined;
      return {
        ...slot,
        holder: member ? { userId: member.userId, name: member.name, level: member.level, avatarRelicId: member.avatarRelicId, frameId: member.frameId, isMe: member.userId === me.userId } : null,
        deck: member && row ? row.deck.map((entry) => ({ ...entry })) : [],
        power: member && row ? row.deck.reduce((sum, entry) => sum + entry.power, 0) : 0,
      };
    });
    const mine = [...war.entries()].find(([, row]) => row.userId === me.userId)?.[0] ?? null;
    return { level, phase, endsAt, slots, mySlotId: mine, canArrange: guildCan(me.role, "formation"), serverTime: now };
  }

  async getWarMap(actor: GuildActor): Promise<GuildWarMapState> {
    const { guild, me } = this.requireGuild(actor);
    return this.warMapOf(guild, me);
  }

  async clearWarSlot(actor: GuildActor, slotId: string): Promise<GuildWarMapState> {
    const { guild, me } = this.requireGuild(actor);
    if (guildWarNow(this.now()).phase !== "prep") fail("WAR_LOCKED");
    if (!parseGuildWarSlotId(slotId)) fail("SLOT_INVALID");
    const row = this.warOf(guild).get(slotId);
    if (!row) fail("SLOT_INVALID");
    if (row!.userId !== me.userId && !guildCan(me.role, "formation")) fail("NO_PERMISSION");
    this.warOf(guild).delete(slotId);
    return this.warMapOf(guild, me);
  }

  async placeWarDefense(actor: GuildActor, input: GuildWarDefenseInput, requestId: string): Promise<GuildWarMapState> {
    this.once(actor, requestId, () => {
      const { guild, me } = this.requireGuild(actor);
      if (guildWarNow(this.now()).phase !== "prep") fail("WAR_LOCKED");
      const slot = parseGuildWarSlotId(input?.slotId);
      if (!slot || !guildWarMapSlots(this.level(guild)).some(({ id }) => id === slot.id)) return fail("SLOT_INVALID");
      if (!Array.isArray(input.deck) || input.deck.length !== 3 || new Set(input.deck.map(({ relicId }) => relicId)).size !== 3) fail("INVALID_REQUEST");
      const war = this.warOf(guild);
      const current = war.get(slot.id);
      if (current && current.userId !== me.userId) fail("SLOT_TAKEN");
      this.dropWarDefense(guild, me.userId);
      war.set(slot.id, { userId: me.userId, deck: input.deck.map((entry) => ({ ...entry })), lineup: structuredClone(input.lineup), placedAt: this.now() });
      return true;
    });
    return this.getWarMap(actor);
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
      member.contributionTotal = 150 + index * 37; member.sample = true;
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

  /**
   * QA 빌드가 접속하자마자 길드전·수호전을 시험할 수 있게 호출자를 표본 길드의 **길드장**으로 앉힌다. 원래 길드장(표본)은
   * 부길드장으로 내려 직위 상한을 지킨다. 이미 어느 길드에 있으면 그대로 둔다.
   */
  qaJoinAsLeader(actor: GuildActor, guildId: string): boolean {
    const guild = this.guilds.get(guildId);
    if (!guild || this.userGuild.has(actor.userId)) return false;
    for (const member of guild.members.values()) if (member.role === "leader") member.role = "vice";
    const vices = [...guild.members.values()].filter((m) => m.role === "vice").sort((a, b) => b.joinedAt - a.joinedAt);
    for (const extra of vices.slice(GUILD_ROLE_LIMIT.vice)) extra.role = "officer";
    guild.members.set(actor.userId, this.newMember(actor, "leader", this.now()));
    this.userGuild.set(actor.userId, guildId); this.requestedBy.delete(actor.userId);
    return true;
  }

  /** 테스트·QA 도구용 — 한 길드에 부흥도를 얹는다. */
  addProsperityForTest(guildId: string, amount: number): void { const guild = this.guilds.get(guildId); if (guild) guild.prosperity += amount; }
}

/** 표본 길드원의 그날 수호전 기록 — 날짜와 id에서만 나오는 값이라 다시 읽어도 같다. */
function sampleGuardRecord(userId: string, level: number, day: number): { best: number; at: number } {
  let h = 2166136261;
  for (const ch of `${userId}:${day}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h >>>= 0;
  return { best: h % 5 === 0 ? 0 : 80 + (h % 400) + level * (10 + (h >>> 8) % 25), at: day * 86_400_000 + (h % 80_000_000) };
}

const SAMPLE_NAMES = ["하늘", "새봄", "이슬", "마루", "다온", "보람", "나래", "가람", "솔", "누리", "한결", "도담", "모아", "미르", "아라", "초롱", "온새미", "라온", "해든", "소담"];
const SAMPLE_BIOS = ["오늘도 복원 중", "치즈케이크는 사랑입니다", "길드전 같이 해요", "느긋하게 가는 중", "수호전 개근 목표", "고고학 전문가", "잘 부탁드립니다"];

const roleRank = (role: GuildRole): number => ({ leader: 3, vice: 2, officer: 1, member: 0 })[role];

/** 이 기기의 임시 길드 백엔드. 서버가 연결되지 않은 빌드(QA·개발)에서 `FakeServer`와 `guildApi`가 함께 쓴다. */
export const localGuildBackend: FakeGuildServer = new FakeGuildServer(() => Date.now() + guildQaClockShift());
