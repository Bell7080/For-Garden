/**
 * 출석 도장판 위의 기여도 경쟁 줄 — 이번 주 기여도로 줄을 세워 **내 바로 위 한 사람**과 나를 나란히 세운다.
 * 도장을 찍어 내 기여도가 그 사람을 넘으면 두 줄이 자리를 바꾼다(역전). 이미 1위면 나를 위에, 2위를 아래에 둔다.
 *
 * 화면은 이 값을 그리기만 한다 — 몇 위였고 몇 위가 되는지, 누구를 넘었는지를 화면이 다시 세지 않는다.
 */
export interface GuildRaceEntry { userId: string; isMe: boolean; contributionWeek: number; contributionTotal: number }

export interface GuildRaceView<T extends GuildRaceEntry> {
  me: T;
  /** 나와 함께 서는 한 사람(위 또는 아래). 혼자인 길드면 없다. */
  rival?: T;
  /** 찍기 전 위아래 — `meOnTop`이면 내가 윗줄이다. */
  meOnTopBefore: boolean;
  meOnTopAfter: boolean;
  rankBefore: number;
  rankAfter: number;
  /** 함께 선 사람의 찍기 전·뒤 순위. */
  rivalRankBefore: number;
  rivalRankAfter: number;
  /** 찍은 뒤의 내 이번 주 기여도. */
  after: number;
  /** 이번 도장으로 함께 선 사람을 넘었다. */
  overtook: boolean;
}

const order = (a: GuildRaceEntry, b: GuildRaceEntry): number =>
  b.contributionWeek - a.contributionWeek || b.contributionTotal - a.contributionTotal || (a.isMe === b.isMe ? 0 : a.isMe ? 1 : -1);

/** 순위는 「나보다 이번 주 기여가 **많은** 사람 수 + 1」이다 — 같은 값은 앞지른 것이 아니다. */
const rankOf = (others: readonly GuildRaceEntry[], value: number): number => 1 + others.filter((m) => m.contributionWeek > value).length;

export function guildAttendanceRace<T extends GuildRaceEntry>(members: readonly T[], gain: number): GuildRaceView<T> | null {
  const me = members.find((m) => m.isMe);
  if (!me) return null;
  const sorted = [...members].sort(order);
  const index = sorted.indexOf(me);
  const others = sorted.filter((m) => m !== me);
  const after = me.contributionWeek + Math.max(0, gain);
  const above = index > 0 ? sorted[index - 1] : undefined;
  const rival = above ?? sorted[index + 1];
  const overtook = Boolean(above && after > above.contributionWeek);
  const rivalRank = (myValue: number): number => !rival ? 0
    : 1 + others.filter((o) => o !== rival && o.contributionWeek > rival.contributionWeek).length + (myValue > rival.contributionWeek ? 1 : 0);
  return {
    me, rival, rivalRankBefore: rivalRank(me.contributionWeek), rivalRankAfter: rivalRank(after), meOnTopBefore: !above, meOnTopAfter: !above || overtook,
    rankBefore: rankOf(others, me.contributionWeek), rankAfter: rankOf(others, after), after, overtook,
  };
}
