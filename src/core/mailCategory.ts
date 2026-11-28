import { ARENA_TIERS } from "./arenaStanding";

/**
 * 콘텐츠 보상 우편의 갈래 — 결투장 티어·순위, 아레나 티어·순위, 원정·고대 지층·길드 순위.
 *
 * 우편함은 이 값 하나로 특수 우편(콘텐츠 색 · 티어 휘장 · 원화 배경)을 세운다. 새 우편은 서버가 `kind`·`meta`를
 * 함께 실어 보내고(`mails.kind`), 그 열이 생기기 전에 쌓인 우편은 **제목과 본문의 모양**으로 갈래를 되짚는다 —
 * 그 우편들은 SQL 함수가 정해진 문구로만 썼으므로 모양이 곧 갈래다. DB·Phaser를 모른다.
 */
export type MailSpecialKind = "duelTier" | "duelRank" | "arenaTier" | "arenaRank" | "expeditionRank" | "ancientRank" | "guildRank";
export type MailContent = "duel" | "arena" | "expedition" | "ancient" | "guild";

export interface MailSpecial {
  kind: MailSpecialKind;
  /** 티어 우편의 티어 ID(결투장·아레나가 같은 ID 체계를 쓴다). */
  tier?: string;
  /** 순위 우편의 순위. 백분율·참여 구간이면 그 계정의 실제 순위다. */
  rank?: number;
  /** 정산한 기간 — 주간은 그 주 월요일(`YYYY-MM-DD`), 월간은 `YYYY-MM`. */
  period?: string;
}

export const MAIL_SPECIAL_KINDS: readonly MailSpecialKind[] = ["duelTier", "duelRank", "arenaTier", "arenaRank", "expeditionRank", "ancientRank", "guildRank"];

export function mailContentOf(kind: MailSpecialKind): MailContent {
  if (kind === "duelTier" || kind === "duelRank") return "duel";
  if (kind === "arenaTier" || kind === "arenaRank") return "arena";
  if (kind === "expeditionRank") return "expedition";
  if (kind === "ancientRank") return "ancient";
  return "guild";
}

const isKind = (value: unknown): value is MailSpecialKind => typeof value === "string" && (MAIL_SPECIAL_KINDS as readonly string[]).includes(value);
const PERIOD = /^\d{4}-\d{2}(-\d{2})?$/;

/** 서버가 실어 보낸 `kind`·`meta`를 검증해 특수 우편 값으로 옮긴다. 모르는 값은 버린다. */
export function mailSpecialFromKind(kind: unknown, meta: unknown): MailSpecial | undefined {
  if (!isKind(kind)) return undefined;
  const m = meta && typeof meta === "object" ? meta as Record<string, unknown> : {};
  const special: MailSpecial = { kind };
  if (typeof m.tier === "string" && /^[a-z]+$/.test(m.tier)) special.tier = m.tier;
  if (typeof m.rank === "number" && Number.isInteger(m.rank) && m.rank > 0) special.rank = m.rank;
  if (typeof m.period === "string" && PERIOD.test(m.period)) special.period = m.period;
  return special;
}

/** 아레나 RP가 선 티어. 예전 「아레나 주간 보상」 우편은 본문의 RP만 남아 있어 그것으로 휘장을 되짚는다. */
export function arenaTierOfScore(score: number): string {
  let tier = ARENA_TIERS[0].id;
  for (const def of ARENA_TIERS) if (score >= def.floor) tier = def.id;
  return tier;
}

/**
 * `kind` 열이 생기기 전의 우편을 제목·본문으로 되짚는다. SQL 함수와 로컬 서버가 쓰던 정해진 문구뿐이라
 * 운영자가 손으로 쓴 우편은 여기 걸리지 않는다(그 우편은 보통 우편으로 선다).
 */
export function legacyMailSpecial(mail: { id: string; title: string; body: string }): MailSpecial | undefined {
  const rank = Number(/(\d+)위/.exec(mail.body)?.[1] ?? NaN);
  const period = PERIOD.exec(mail.body.trim().split(/\s/)[0] ?? "")?.[0];
  const base = (kind: MailSpecialKind): MailSpecial => ({ kind, ...(rank > 0 ? { rank } : {}), ...(period ? { period } : {}) });
  if (mail.id.startsWith("expedition-rank:")) return { kind: "expeditionRank", period: mail.id.slice("expedition-rank:".length) };
  if (mail.id.startsWith("guild-week:")) return { ...base("guildRank"), period: mail.id.slice("guild-week:".length) };
  switch (mail.title) {
    case "결투장 주간 순위 보상": return base("duelRank");
    case "원정 주간 순위 보상": return base("expeditionRank");
    case "고대 지층 월간 순위 보상": return base("ancientRank");
    case "길드 주간 순위 보상": return base("guildRank");
    case "아레나 주간 보상": {
      const score = Number(/(\d+)\s*RP/.exec(mail.body)?.[1] ?? NaN);
      return { ...base("arenaRank"), ...(Number.isFinite(score) ? { tier: arenaTierOfScore(score) } : {}) };
    }
    default: return undefined;
  }
}
