/**
 * 길드 기본 규칙 — 레벨·정원·혜택·직위 권한·출석 도장·상점의 **순수 값 한 곳**.
 *
 * 서버(`FakeGuildServer`, 실서버 RPC)는 이 함수들로 상태를 확정하고 화면은 결과만 그린다.
 * Phaser를 모르고 난수·시각은 인자로 받는다. 설계 근거는 `/mnt/project-files/guild/proposal.md`.
 */

export const GUILD_CREATE_GEMS = 2_000;
/** 길드장이 뱃지를 바꿀 때의 젬. 첫 생성에서 고른 뱃지는 무료다. */
export const GUILD_BADGE_CHANGE_GEMS = 500;
export const GUILD_NAME_MIN = 2;
export const GUILD_NAME_MAX = 12;
export const GUILD_NOTICE_MAX = 120;
/** 탈퇴 뒤 다른 길드에 들어갈 수 있을 때까지. */
export const GUILD_LEAVE_COOLDOWN_MS = 24 * 3_600_000;
/** 길드장이 이만큼 접속하지 않으면 알림, 그 두 배를 넘으면 기여도 1위 임원에게 자동 위임한다. */
export const GUILD_LEADER_WARN_DAYS = 7;
export const GUILD_LEADER_TRANSFER_DAYS = 14;
/** 길드 레벨이 열리는 연구원 레벨은 `CONTENT_UNLOCKS`가 갖는다. */
export const GUILD_MAX_LEVEL = 10;

export type GuildRole = "leader" | "vice" | "officer" | "member";
export type GuildJoinMode = "open" | "approval";

/** 자리 수 상한. 길드장은 늘 한 명이다. */
export const GUILD_ROLE_LIMIT: Readonly<Record<GuildRole, number>> = { leader: 1, vice: 2, officer: 5, member: Number.POSITIVE_INFINITY };
const ROLE_RANK: Readonly<Record<GuildRole, number>> = { leader: 3, vice: 2, officer: 1, member: 0 };

export type GuildAction = "approve" | "kick" | "notice" | "formation" | "promote" | "badge" | "joinMode" | "disband";

/** 직위가 할 수 있는 일. 길드장 아래는 권한이 겹치지 않게 좁다. */
const ROLE_ACTIONS: Readonly<Record<GuildRole, readonly GuildAction[]>> = {
  leader: ["approve", "kick", "notice", "formation", "promote", "badge", "joinMode", "disband"],
  vice: ["approve", "kick", "notice", "formation"],
  officer: ["approve", "notice", "formation"],
  member: [],
};

export const guildCan = (role: GuildRole, action: GuildAction): boolean => ROLE_ACTIONS[role].includes(action);
/** 추방은 자기보다 낮은 직위만. 부길드장은 임원 이하, 길드장은 모두. */
export const guildCanKick = (actor: GuildRole, target: GuildRole): boolean => guildCan(actor, "kick") && ROLE_RANK[actor] > ROLE_RANK[target];

// ── 레벨·정원·혜택 ──────────────────────────────────────────────────────────────

export interface GuildLevelDef {
  level: number;
  /** 이 레벨에 닿는 누적 부흥도. */
  prosperity: number;
  capacity: number;
}

/**
 * 부흥도(길드 경험치)로 오르는 레벨. 활성 20명이 2~3주에 한 레벨을 올리는 속도를 기준으로 잡았다 —
 * 출석(하루 10)과 수호전·길드전이 얹는 몫이 합쳐 하루 200~400쯤이다.
 */
export const GUILD_LEVELS: readonly GuildLevelDef[] = [
  { level: 1, prosperity: 0, capacity: 20 },
  { level: 2, prosperity: 2_500, capacity: 22 },
  { level: 3, prosperity: 6_000, capacity: 24 },
  { level: 4, prosperity: 10_500, capacity: 26 },
  { level: 5, prosperity: 16_000, capacity: 28 },
  { level: 6, prosperity: 22_500, capacity: 30 },
  { level: 7, prosperity: 30_000, capacity: 33 },
  { level: 8, prosperity: 39_000, capacity: 36 },
  { level: 9, prosperity: 49_000, capacity: 38 },
  { level: 10, prosperity: 60_000, capacity: 40 },
];

export function guildLevelOf(prosperity: number): number {
  let level = 1;
  for (const def of GUILD_LEVELS) if (prosperity >= def.prosperity) level = def.level;
  return level;
}
const levelDef = (level: number): GuildLevelDef => GUILD_LEVELS[Math.min(GUILD_MAX_LEVEL, Math.max(1, Math.floor(level))) - 1];
export const guildCapacity = (level: number): number => levelDef(level).capacity;

/** 다음 레벨까지의 진행. 최고 레벨이면 `next`가 null이다. */
export function guildLevelProgress(prosperity: number): { level: number; into: number; span: number; next: number | null } {
  const level = guildLevelOf(prosperity);
  if (level >= GUILD_MAX_LEVEL) return { level, into: 0, span: 0, next: null };
  const here = levelDef(level), next = levelDef(level + 1);
  return { level, into: prosperity - here.prosperity, span: next.prosperity - here.prosperity, next: next.level };
}

/** 길드 레벨이 주는 편의. 전투 능력치 버프는 없다 — 재화·시간 쪽만 5%·10% 단위다. */
export interface GuildPerks { excavationBonusPercent: number; dispatchTimeReductionPercent: number; shopSlots: number }
export function guildPerks(level: number): GuildPerks {
  return {
    excavationBonusPercent: level >= 7 ? 10 : level >= 3 ? 5 : 0,
    dispatchTimeReductionPercent: level >= 9 ? 10 : level >= 5 ? 5 : 0,
    shopSlots: level >= GUILD_MAX_LEVEL ? 4 : 3,
  };
}

// ── 이름 ───────────────────────────────────────────────────────────────────────

export type GuildNameProblem = "empty" | "short" | "long" | "invalid";
/** 화면에 서는 글자 수. 이모지 하나가 둘로 세어지지 않게 자소 단위로 센다. */
export const guildGlyphCount = (text: string): number =>
  typeof Intl !== "undefined" && "Segmenter" in Intl ? [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].length : Array.from(text).length;

/** 앞뒤 공백을 걷고 연속 공백을 하나로 줄인다. */
export const normalizeGuildName = (raw: string): string => raw.normalize("NFC").replace(/\s+/g, " ").trim();

/** 문자·숫자·공백만 허용한다(제어 문자·기호·이모지 제외). 금칙어와 중복은 서버가 따로 검사한다. */
export function validateGuildName(raw: string): { ok: true; name: string } | { ok: false; problem: GuildNameProblem } {
  const name = normalizeGuildName(raw);
  if (!name) return { ok: false, problem: "empty" };
  if (!/^[\p{L}\p{N} ]+$/u.test(name)) return { ok: false, problem: "invalid" };
  const count = guildGlyphCount(name);
  if (count < GUILD_NAME_MIN) return { ok: false, problem: "short" };
  if (count > GUILD_NAME_MAX) return { ok: false, problem: "long" };
  return { ok: true, name };
}

/** 이름 비교 키 — 대소문자·공백을 무시해 비슷한 이름의 겹침을 막는다. */
export const guildNameKey = (name: string): string => normalizeGuildName(name).replace(/ /g, "").toLowerCase();

// ── 시각 키 ────────────────────────────────────────────────────────────────────

/** 서버 UTC 날짜 키(YYYY-MM-DD). */
export const guildDateKey = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
/** 월요일 00:00 UTC에 시작하는 주의 키(그 월요일의 날짜). */
export function guildWeekKey(ms: number): string {
  const day = new Date(ms).getUTCDay();
  return guildDateKey(ms - ((day + 6) % 7) * 86_400_000);
}
/** 월요일이 0인 요일 번호. */
export const guildWeekdayIndex = (ms: number): number => (new Date(ms).getUTCDay() + 6) % 7;

// ── 출석 도장 ──────────────────────────────────────────────────────────────────

export type GuildAttendanceChoice = "gold" | "cheesecake";
export const GUILD_ATTENDANCE_CHOICES: readonly GuildAttendanceChoice[] = ["gold", "cheesecake"];
/** 하루 도장 하나. 골드와 치즈케이크는 같은 환산 가치(일일 상점 소 구매분 정도, 젬 16)다. */
export const GUILD_ATTENDANCE_REWARD: Readonly<Record<GuildAttendanceChoice, number>> = { gold: 8_000, cheesecake: 32 };
/** 출석 한 번이 길드에 얹는 몫. 길드 코인은 상점의 씨앗이라 소량이다(수호전·길드전이 본 수급처). */
export const GUILD_ATTENDANCE_GAIN = { prosperity: 10, contribution: 10, coin: 5 } as const;
/** 한 주 7칸을 모두 찍으면 얹는 소량 보너스. */
export const GUILD_ATTENDANCE_WEEK_BONUS = { gems: 20, contribution: 20, coin: 10 } as const;
export const GUILD_STAMP_DAYS = 7;

// ── 상점 (길드 코인) ────────────────────────────────────────────────────────────

/** 길드 코인 하나가 젬 몇 개 값인가 — 결투 휘장과 같은 0.5. 받는 것은 낸 값의 1.0~1.25배 안에 든다. */
export const GUILD_COIN_GEM_VALUE = 0.5;
export interface GuildShopProduct {
  id: string;
  price: number;
  /** 한 주(월요일 초기화) 동안 살 수 있는 수. */
  weeklyLimit: number;
  grant: { gold?: number; cheesecake?: number; item?: { id: string; quantity: number } };
}
export const GUILD_SHOP_PRODUCTS: readonly GuildShopProduct[] = [
  { id: "guild-gold", price: 20, weeklyLimit: 5, grant: { gold: 5_500 } },
  { id: "guild-cheesecake", price: 20, weeklyLimit: 5, grant: { cheesecake: 24 } },
  { id: "guild-tonic", price: 90, weeklyLimit: 2, grant: { item: { id: "stamina-tonic", quantity: 1 } } },
];
export const findGuildProduct = (id: string): GuildShopProduct | undefined => GUILD_SHOP_PRODUCTS.find((p) => p.id === id);

// ── 길드장 자동 위임 ────────────────────────────────────────────────────────────

export interface GuildSuccessorCandidate { userId: string; role: GuildRole; contributionTotal: number; joinedAt: number }
/** 14일 미접속 길드장의 후계 — 기여도 1위 임원 이상(부길드장 포함). 없으면 null이라 길드장이 그대로 남는다. */
export function guildSuccessor(members: readonly GuildSuccessorCandidate[]): string | null {
  const eligible = members.filter((m) => m.role === "vice" || m.role === "officer");
  eligible.sort((a, b) => b.contributionTotal - a.contributionTotal || ROLE_RANK[b.role] - ROLE_RANK[a.role] || a.joinedAt - b.joinedAt || a.userId.localeCompare(b.userId));
  return eligible[0]?.userId ?? null;
}
