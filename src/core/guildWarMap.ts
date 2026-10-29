import { GUILD_WAR_GRUNTS, guildWarSlots, type GuildWarBranch, type GuildWarSlotKind } from "./guildWar";

/**
 * 길드전 방어진 지도 — 우리 길드 영지에 선 **칸의 목록과 배치 규칙**. 칸 수는 `guildWar.ts`의 레벨 표가 정하고, 이 모듈은
 * 그 칸에 id를 붙이고 누가 어디에 설 수 있는지만 판정한다. 전투는 `skirmish.ts`가 돈다.
 *
 * 지부 하나는 우두머리 1 · 정예 2 · 일반 N(레벨이 늘린다)이고, 길드원은 **한 칸에만** 방어덱 셋을 세운다. 지도는 정비일에만
 * 고칠 수 있다 — 전투일에는 상대가 그 지도를 친다.
 */

export const GUILD_WAR_BRANCHES: readonly GuildWarBranch[] = [1, 2, 3];
/** 방어덱 한 벌의 수 — 결투장과 같은 3대3이다. */
export const GUILD_WAR_DECK_SIZE = 3;

export interface GuildWarMapSlotDef { id: string; branch: GuildWarBranch; kind: GuildWarSlotKind; index: number }

export const guildWarSlotId = (branch: GuildWarBranch, kind: GuildWarSlotKind, index: number): string => `${branch}:${kind}:${index}`;

/** 레벨이 여는 모든 칸 — 지부 순서, 지부 안에서는 우두머리 → 정예 → 일반 순이다. */
export function guildWarMapSlots(level: number): GuildWarMapSlotDef[] {
  const { grunts } = guildWarSlots(level);
  return GUILD_WAR_BRANCHES.flatMap((branch) => [
    { id: guildWarSlotId(branch, "boss", 0), branch, kind: "boss" as const, index: 0 },
    ...[0, 1].map((index) => ({ id: guildWarSlotId(branch, "elite", index), branch, kind: "elite" as const, index })),
    ...Array.from({ length: grunts[branch] }, (_, index) => ({ id: guildWarSlotId(branch, "grunt", index), branch, kind: "grunt" as const, index })),
  ]);
}

/** 어느 레벨에서도 열리지 않는 칸 id는 받지 않는다. 열려 있는지는 `guildWarMapSlots(level)`로 따로 본다. */
export function parseGuildWarSlotId(id: unknown): GuildWarMapSlotDef | null {
  if (typeof id !== "string") return null;
  const match = /^([123]):(boss|elite|grunt):(\d{1,2})$/.exec(id);
  if (!match) return null;
  const branch = Number(match[1]) as GuildWarBranch;
  const kind = match[2] as GuildWarSlotKind;
  const index = Number(match[3]);
  const max = kind === "boss" ? 1 : kind === "elite" ? 2 : Math.max(...GUILD_WAR_GRUNTS.map((row) => row[branch - 1]));
  return index < max ? { id, branch, kind, index } : null;
}

export const guildWarSlotOpen = (level: number, slotId: string): boolean => guildWarMapSlots(level).some((slot) => slot.id === slotId);

/** 방어덱 검증 — 셋, 서로 다른 렐릭. 보유 여부는 서버가 따로 본다. */
export function normalizeGuildWarDeck(ids: readonly unknown[]): string[] {
  if (!Array.isArray(ids) || ids.length !== GUILD_WAR_DECK_SIZE) throw new RangeError("방어덱은 셋입니다.");
  const deck = ids.map((id) => {
    if (typeof id !== "string" || id.length === 0 || id.length > 64) throw new RangeError("방어덱 칸이 잘못되었습니다.");
    return id;
  });
  if (new Set(deck).size !== deck.length) throw new RangeError("같은 렐릭을 두 번 세울 수 없습니다.");
  return deck;
}

/**
 * 자동 배치의 칸 순서 — 무거운 자리부터다. 우두머리 셋(지부 순) → 정예 여섯(지부를 돌아가며) → 일반 칸(지부를 돌아가며)이라,
 * 전투력 순으로 세우면 가장 센 셋이 각 지부의 우두머리가 되고 남는 힘이 지부 셋에 고르게 퍼진다.
 */
export function guildWarAutoOrder(level: number): string[] {
  const slots = guildWarMapSlots(level);
  const kindRank = { boss: 0, elite: 1, grunt: 2 } as const;
  return [...slots]
    .sort((a, b) => kindRank[a.kind] - kindRank[b.kind] || a.index - b.index || a.branch - b.branch)
    .map(({ id }) => id);
}

/** 아직 아무도 서지 않은 칸 중 자동 배치 순서로 가장 앞 칸. 다 찼으면 null이다. */
export function guildWarFirstOpenSlot(level: number, taken: ReadonlySet<string>): string | null {
  return guildWarAutoOrder(level).find((id) => !taken.has(id)) ?? null;
}

/**
 * 방어덱을 세운 길드원 전부를 전투력 순으로 다시 세운다(`slotId → userId`). 같은 전투력은 userId 순이라 다시 불러도 같다.
 * 칸보다 사람이 많으면 남는 사람은 빠진다 — 칸은 레벨이 정한다.
 */
export function guildWarAutoArrange(level: number, defenders: readonly { userId: string; power: number }[]): Map<string, string> {
  const order = guildWarAutoOrder(level);
  const ranked = [...defenders].sort((a, b) => b.power - a.power || a.userId.localeCompare(b.userId));
  return new Map(ranked.slice(0, order.length).map(({ userId }, index) => [order[index], userId]));
}
