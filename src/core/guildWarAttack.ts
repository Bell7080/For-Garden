import { GUILD_WAR_ATTACKS_PER_MEMBER, GUILD_WAR_BRANCH_SWEEP_BONUS, GUILD_WAR_SLOT_SCORE, guildWarBossOpen, guildWarElitesOpen, type GuildWarBranch, type GuildWarOutcome } from "./guildWar";
import { GUILD_WAR_BRANCHES, guildWarMapSlots, type GuildWarMapSlotDef } from "./guildWarMap";

/**
 * 길드전 공격의 **순수 규칙** — 상대 영지에서 어느 칸을 칠 수 있는지, 격파한 칸이 몇 점인지, 하루가 끝났을 때 누가 이겼는지.
 * 전투는 `guildWarBattle.ts`, 칸 목록은 `guildWarMap.ts`가 갖는다. 로컬 서버와 DB 함수가 같은 규칙을 옮겨 적는다
 * (`tests/unit/guildSql.test.ts`가 수를 대조한다).
 *
 * - **빈 칸**(방어덱이 없는 칸)은 처음부터 무너진 것으로 본다 — 지키는 사람이 없는 자리가 뒤 칸을 막지 않는다. 점수는 없다:
 *   점수는 싸워서 이긴 칸만 준다.
 * - 칸은 **한 번 격파되면 끝**이다. 같은 칸을 다시 이겨도 점수가 늘지 않는다.
 * - 정예는 그 지부 일반 칸의 절반(올림)이, 우두머리는 정예 둘이 무너져야 열린다.
 * - 지부의 모든 칸이 무너지면 지부 점령 보너스가 붙는다 — 다만 그 지부에서 한 칸이라도 직접 격파했을 때만이다.
 */

export interface GuildWarFrontSlot extends GuildWarMapSlotDef {
  defended: boolean;
  captured: boolean;
  /** 지금 칠 수 있는가 — 지키는 사람이 있고, 아직 격파되지 않았고, 앞 칸 조건을 채웠다. */
  open: boolean;
}

const down = (slot: { defended: boolean; captured: boolean }): boolean => slot.captured || !slot.defended;

export function guildWarFront(level: number, defended: ReadonlySet<string>, captured: ReadonlySet<string>): GuildWarFrontSlot[] {
  const slots = guildWarMapSlots(level).map((slot) => ({ ...slot, defended: defended.has(slot.id), captured: defended.has(slot.id) && captured.has(slot.id) }));
  return slots.map((slot) => {
    const branch = slots.filter((other) => other.branch === slot.branch);
    const grunts = branch.filter(({ kind }) => kind === "grunt");
    const elitesDown = branch.filter(({ kind }) => kind === "elite").filter(down).length;
    const gate = slot.kind === "grunt" ? true
      : slot.kind === "elite" ? guildWarElitesOpen(grunts.length, grunts.filter(down).length)
        : guildWarBossOpen(elitesDown);
    return { ...slot, open: slot.defended && !slot.captured && gate };
  });
}

/** 격파한 칸의 점수 + 지부 점령 보너스. */
export function guildWarPoints(front: readonly GuildWarFrontSlot[]): number {
  let points = front.reduce((sum, slot) => sum + (slot.captured ? GUILD_WAR_SLOT_SCORE[slot.kind] : 0), 0);
  for (const branch of GUILD_WAR_BRANCHES) {
    const slots = front.filter((slot) => slot.branch === branch);
    if (slots.length > 0 && slots.every(down) && slots.some(({ captured }) => captured)) points += GUILD_WAR_BRANCH_SWEEP_BONUS;
  }
  return points;
}

/** 지부 하나가 다 무너졌는가(화면의 점령 표시). */
export const guildWarBranchSwept = (front: readonly GuildWarFrontSlot[], branch: GuildWarBranch): boolean =>
  front.filter((slot) => slot.branch === branch).every(down);

export const guildWarAttacksLeft = (used: number): number => Math.max(0, GUILD_WAR_ATTACKS_PER_MEMBER - Math.max(0, used));

/** 전투일이 시작되기 전에 길드에 있던 길드원만 그날 공격한다 — 전투일에 옮겨 와 두 길드에서 치는 길을 막는다. */
export const guildWarCanAttack = (joinedAt: number, battleDayStart: number): boolean => joinedAt < battleDayStart;

export interface GuildWarSide { points: number; attacks: number; reachedAt: number }

/**
 * 하루가 끝난 뒤 한쪽의 결과. 한 번도 치지 않은 길드는 기권이다(상대도 치지 않았으면 둘 다 기권). 상대만 기권이면 이긴다.
 * 둘 다 쳤으면 점수가 높은 쪽, 같으면 그 점수에 먼저 닿은 쪽이 이긴다. 시각까지 같으면 둘 다 진 것으로 본다.
 */
export function guildWarResult(mine: GuildWarSide, theirs: GuildWarSide): Exclude<GuildWarOutcome, "bye"> {
  if (mine.attacks <= 0) return "forfeit";
  if (theirs.attacks <= 0) return "win";
  if (mine.points !== theirs.points) return mine.points > theirs.points ? "win" : "loss";
  return mine.reachedAt < theirs.reachedAt ? "win" : "loss";
}

/**
 * 전투일 결과의 길드 코인(2026-10-28 응태 승인 — 안 A). 그날 한 번이라도 공격한 길드원만 받는다. 부전승은 칠 상대가 없으니
 * 전투일 전에 길드에 있던 길드원 모두가 받는다. 기권은 없다.
 */
export const GUILD_WAR_COIN: Readonly<Record<GuildWarOutcome, number>> = { win: 30, loss: 15, bye: 20, forfeit: 0 };
